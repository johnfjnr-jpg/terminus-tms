// ── Bootstrap ─────────────────────────────────────────────────────────────────
let supabaseClient = null
let currentSession = null

async function init() {
  const { supabaseUrl, supabaseAnonKey } = await fetch('/api/config').then(r => r.json())
  supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey)

  // Round 10 Phase 4 item 3 (2026-08-19). This handler used to call
  // showApp(session) for EVERY session-bearing auth event, and showApp()
  // ends with navigate('leads'). Supabase refreshes the access token in
  // the background, so roughly once an hour a TOKEN_REFRESHED event threw
  // the user back to Leads from wherever they were, with no action of
  // their own. Reproduced directly in Phase 0: visibilitychange and window
  // focus produce no auth event and no navigation; a real refreshSession()
  // produces TOKEN_REFRESHED and moved the app to view-leads.
  //
  // It was REPORTED as "the New Contact dialogue's Save returns me to the
  // Leads page". Neither contact-creation dialogue navigates anywhere -
  // saveContact ends in closeNewLeadModal() + loadContactsData(), and
  // saveInlineBuyerContact reloads the originating record. A periodic
  // background event that steals the user's place is always attributed to
  // whatever they last did deliberately, because that is the only thing
  // they can see. Both save paths are deliberately untouched.
  //
  // Guarded on APP STATE, not on an event-name allowlist. Which events
  // supabase-js emits, and when, varies by version; "am I already inside
  // the app" is the question actually being asked and it cannot drift.
  // Entering the app still lands on Leads exactly as before.
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentSession = session
    window.currentSession = session
    if (!session) { showAuth(); return }
    const alreadyInApp = !document.getElementById('app-shell').classList.contains('hidden')
    if (alreadyInApp) {
      // Refreshed credentials, same session, same place. Keep the header
      // truthful and change nothing else.
      document.getElementById('nav-email').textContent = session.user.email
      return
    }
    showApp(session)
  })

  const { data: { session: existing } } = await supabaseClient.auth.getSession()
  if (existing) {
    currentSession = existing
    window.currentSession = existing
    showApp(existing)
  } else {
    showAuth()
  }
}

init()

// ── Auth ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-google-login').addEventListener('click', async () => {
  document.getElementById('auth-error').textContent = ''
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  if (error) document.getElementById('auth-error').textContent = error.message
})

document.getElementById('btn-signout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut()
})

// ── Navigation ────────────────────────────────────────────────────────────────
const ALL_VIEWS = ['leads', 'leads-legacy', 'contacts', 'contact-detail', 'accounts', 'account-detail', 'test-beds', 'test-bed-detail', 'opportunities', 'opportunity-detail']

function showAuth() {
  document.getElementById('view-auth').classList.remove('hidden')
  document.getElementById('app-shell').classList.add('hidden')
}

function showApp(session) {
  document.getElementById('view-auth').classList.add('hidden')
  document.getElementById('app-shell').classList.remove('hidden')
  document.getElementById('nav-email').textContent = session.user.email
  navigate('leads')
}

function navigate(view, id) {
  ALL_VIEWS.forEach(v => document.getElementById(`view-${v}`)?.classList.add('hidden'))
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'))

  document.getElementById(`view-${view}`)?.classList.remove('hidden')
  document.querySelector(`.nav-link[data-view="${view}"]`)?.classList.add('active')

  if (view === 'leads') loadContactsData()
  else if (view === 'leads-legacy') loadLegacyLeads()
  else if (view === 'contacts') loadContactsData()
  else if (view === 'contact-detail' && id) loadContactDetail(id)
  else if (view === 'accounts') loadAccountsList()
  else if (view === 'account-detail' && id) loadAccountDetail(id)
  else if (view === 'test-beds') loadTestBeds()
  else if (view === 'opportunities') loadOpportunities()
  else if (view === 'test-bed-detail' && id) {
    // The ONE genuine arrival. Everything else that calls loadTestBedDetail
    // is a save refreshing the record the user is already looking at.
    tbFreshNavigation = true
    tbUserPickedTab = false
    loadTestBedDetail(id)
  }
  else if (view === 'opportunity-detail' && id) {
    // Arriving at a record: the default-to-Reference is wanted.
    oppUserPickedTab = false
    loadOpportunityDetail(id)
  }
}

document.querySelectorAll('.nav-link').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.view))
})
document.getElementById('btn-back-opps').addEventListener('click', () => navigate('opportunities'))
document.getElementById('btn-back-testbeds').addEventListener('click', () => navigate('test-beds'))
document.getElementById('btn-back-contact-detail').addEventListener('click', () => navigate(cdReturnView))

// ── Tab strips ────────────────────────────────────────────────────────────────
//
// ONE component, three consumers: Opportunity's detail strip, Test Bed's
// detail strip, and the sub-tab strip Phase 2 puts inside a panel.
//
// Round 16 Phase 1, and the reason it generalises rather than adding a third
// implementation: there were already TWO. switchOppTab and switchTbTab were
// near-identical functions, each wired to a hardcoded container id, each
// reading buttons from static HTML, neither taking a list of panes. A
// standalone sub-tab strip would have made three and Round 17's per-unit
// strip four. That is the shape Round 10 Phase 0A had to collapse after the
// click-to-edit reveal had drifted four ways, and collapsing costs more each
// round it is deferred.
//
// ARIA lives here so all three strips get it at once. Before this there was
// no role="tablist", no role="tab", no aria-selected and no arrow-key
// handling anywhere in the application. Building it into the sub-strip alone
// would have left the one conformant strip nested inside two non-conformant
// parents.
//
// Keyboard follows the APG Tabs pattern: Left/Right move between tabs,
// Home/End jump to the ends, and a roving tabindex keeps exactly one tab in
// the page's tab sequence. LEFT AND RIGHT DELIBERATELY, not up and down:
// Phase 4 gives up and down to field navigation, so the two never contend for
// the same key. The handler is bound to the tab buttons, never to a pane, so
// a field inside a pane cannot have its keys intercepted by the strip.
//
// `activate` is a hook, not a fixed behaviour: Test Bed's stage tabs all share
// one physical panel and need a load call, Opportunity's map one-to-one.
window.createTabStrip = function ({ strip, keyAttr, dataAttr, tabs, tabClass, panes, panelFor, activate, label }) {
  const stripEl = typeof strip === 'string' ? document.getElementById(strip) : strip
  if (!stripEl) return null
  // Two ways in, one code path after this. The two detail strips ADOPT
  // buttons that already exist as static HTML; a sub-tab strip has no static
  // markup and passes `tabs` to have them generated. Everything below -
  // selection, ARIA, keyboard, the roving tabindex - is identical either way,
  // which is the whole point of generalising rather than writing a third one.
  if (tabs) {
    stripEl.innerHTML = tabs.map((t, i) =>
      `<button type="button" class="detail-tab${tabClass ? ' ' + tabClass : ''}${i === 0 ? ' active' : ''}" data-${dataAttr}="${escHtml(t.key)}">${escHtml(t.label)}</button>`
    ).join('')
  }
  const buttons = () => [...stripEl.querySelectorAll('.detail-tab')]
  const keyOf = btn => btn.dataset[keyAttr]

  stripEl.setAttribute('role', 'tablist')
  if (label) stripEl.setAttribute('aria-label', label)

  // Named and exposed as adopt() below, because a strip can gain buttons
  // AFTER construction. Opportunity's stage tabs are generated per record
  // from stage_definitions, long after this factory ran, and without this
  // they would carry the class and the click handling (both live queries)
  // but none of the ARIA a screen reader needs.
  const wireButtons = () => buttons().forEach(btn => {
    const key = keyOf(btn)
    btn.setAttribute('role', 'tab')
    if (!btn.id) btn.id = `${stripEl.id}-tab-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    const pane = panelFor(key)
    // aria-controls only when the pane really exists and carries an id.
    // Pointing it at nothing is worse than omitting it: a screen reader
    // announces a relationship that does not resolve.
    if (pane && pane.id) {
      btn.setAttribute('aria-controls', pane.id)
      pane.setAttribute('role', 'tabpanel')
      if (!pane.hasAttribute('tabindex')) pane.setAttribute('tabindex', '0')
      // aria-labelledby is NOT set here. Test Bed's eight stage tabs all
      // control the one shared #tb-tab-stage-detail panel, so setting it per
      // button in this loop leaves the panel labelled by whichever stage tab
      // happened to be last. It is set in select(), to the tab actually open.
    }
  })
  wireButtons()

  function select(key, { focusTab = false } = {}) {
    const btns = buttons()
    btns.forEach(b => {
      const on = keyOf(b) === key
      b.classList.toggle('active', on)
      b.setAttribute('aria-selected', on ? 'true' : 'false')
      // Roving tabindex: exactly one tab is in the page's tab sequence, so
      // Tab moves THROUGH the strip rather than into every tab in turn.
      // These are <button> elements and stay Enter/Space-activatable.
      b.tabIndex = on ? 0 : -1
    })
    panes().forEach(p => p.classList.add('hidden'))
    if (activate) activate(key)
    else { const pane = panelFor(key); if (pane) pane.classList.remove('hidden') }
    // Labelled by the tab that is actually open, for the shared-panel case
    // above. Set after activate(), which is what reveals the pane.
    const openPane = panelFor(key)
    const openBtn = btns.find(b => keyOf(b) === key)
    if (openPane && openBtn?.id) openPane.setAttribute('aria-labelledby', openBtn.id)
    if (focusTab) openBtn?.focus()
  }

  stripEl.addEventListener('click', e => {
    const btn = e.target.closest('.detail-tab')
    if (btn && stripEl.contains(btn)) select(keyOf(btn))
  })

  stripEl.addEventListener('keydown', e => {
    const btn = e.target.closest('.detail-tab')
    if (!btn || !stripEl.contains(btn)) return
    const btns = buttons()
    const i = btns.indexOf(btn)
    let next = null
    if (e.key === 'ArrowRight') next = btns[(i + 1) % btns.length]
    else if (e.key === 'ArrowLeft') next = btns[(i - 1 + btns.length) % btns.length]
    else if (e.key === 'Home') next = btns[0]
    else if (e.key === 'End') next = btns[btns.length - 1]
    else return
    e.preventDefault()
    select(keyOf(next), { focusTab: true })
  })

  // Initial ARIA state, applied at construction rather than waiting for the
  // first switch. Without this a strip nobody has clicked yet carries
  // role="tab" and aria-controls but no aria-selected at all, which was the
  // live state of the Opportunity strip on a freshly opened record: the
  // .active class said one thing and assistive technology was told nothing.
  // The initial key comes from whichever button already carries .active in
  // the static markup, so this reads the existing state rather than imposing
  // a default on it.
  const initial = buttons().find(b => b.classList.contains('active')) ?? buttons()[0]
  if (initial) {
    buttons().forEach(b => {
      const on = b === initial
      b.setAttribute('aria-selected', on ? 'true' : 'false')
      b.tabIndex = on ? 0 : -1
    })
    const pane = panelFor(keyOf(initial))
    if (pane && initial.id) pane.setAttribute('aria-labelledby', initial.id)
  }

  return { select, adopt: wireButtons, current: () => keyOf(buttons().find(b => b.classList.contains('active'))) }
}

// The sub-tab consumer. Builds the strip and its panes into a mount point and
// returns the pane elements for the caller to fill, so a consumer never has
// to know how selection, ARIA or the keyboard work.
//
// SUBORDINATION, chosen rather than defaulted (Round 16 Phase 1). Two rows of
// tabs with no hierarchy between them is a real usability problem, and the
// parent strip is already sticky as of Round 13 Phase 5. The sub-strip is
// made visibly lesser on three axes at once rather than one, because a single
// difference reads as a variant and three read as a level:
//
//   1. smaller, 10px against the parent's 11px
//   2. sentence case, where the parent is uppercase - uppercase mono reads as
//      page chrome, sentence case reads as content, which is the hierarchy
//   3. no rule across the container, where .detail-tabs draws a full-width
//      1px hairline, and a 1px active underline against the parent's 2px
//
// Reported and looked at rather than asserted, per Verification 4: whether
// one strip reads as subordinate to another is exactly the kind of claim no
// assertion can make.
//
// PANE CLASS. Deliberately .sub-tab-panel, NOT .detail-tab-panel. The parent
// strips sweep .detail-tab-panel to hide panes, and Opportunity's sweep was
// document-wide until this phase scoped it, so a sub-pane reusing that class
// would have been hidden by its own parent. Architecture rule 8.
//
// SELECTION IS NOT RECORD STATE, and does not persist across records. It is
// reset on every mount, which happens per record render. Round 12 Phase 8
// kept the Sensors toggle across records on the reasoning that it is a
// display preference about how much detail the user wants; this is a
// different thing, a position within one record's content, and carrying pane
// 3 over to a record whose pane 3 is empty would be surprising. Stated as a
// decision rather than inherited from the toggle's.
// Round 18 Phase 2: `onSelect` forwards the strip's own selection outward.
//
// createTabStrip has always exposed `current()`, and this function has always
// returned the strip, so a consumer could ASK which tab is open. What no
// consumer could do is find out that it had CHANGED, because nothing here
// passed createTabStrip an `activate` callback and so nothing re-ran on a
// switch. That is the whole gap behind the unit correction control reading a
// different type from the table beside it.
//
// The default pane reveal is reproduced inside `activate` rather than dropped:
// createTabStrip runs `activate(key)` INSTEAD of its own reveal, not before
// it, so a consumer that forgets this would hide every pane and show none.
// With no `onSelect` passed the behaviour is byte-identical to before.
window.createSubTabs = function ({ mount, tabs, label, adopt, onSelect }) {
  const mountEl = typeof mount === 'string' ? document.getElementById(mount) : mount
  if (!mountEl) return null
  // ADOPTED, not rebuilt. Each block is an existing DOM node that gets MOVED
  // into its pane by appendChild, which detaches it from wherever it was.
  // That is the relocation guarantee: a move cannot leave a copy behind, so
  // "exactly one instance, and zero in the old position" is structural rather
  // than something the render has to remember to do. It also keeps every id,
  // every attached listener and every inline handler on those blocks intact,
  // so nothing that reads or writes them needs to know this happened.
  //
  // Captured BEFORE the innerHTML below, because the blocks start life inside
  // this mount: setting innerHTML detaches them, and a reference taken first
  // still points at a live node with its subtree and listeners.
  const adopted = {}
  if (adopt) for (const [key, ref] of Object.entries(adopt)) {
    const el = typeof ref === 'string' ? document.getElementById(ref) : ref
    if (el) { el.remove(); adopted[key] = el }
  }
  mountEl.innerHTML =
    `<div class="sub-tabs" id="${mountEl.id}-strip"></div>` +
    `<div class="sub-tab-panes">` +
    tabs.map((t, i) => `<div class="sub-tab-panel${i === 0 ? '' : ' hidden'}" id="${mountEl.id}-pane-${t.key}"></div>`).join('') +
    `</div>`
  const strip = window.createTabStrip({
    strip: `${mountEl.id}-strip`,
    keyAttr: 'subTab',
    dataAttr: 'sub-tab',
    tabClass: 'sub-tab',
    tabs,
    label,
    panes: () => [...mountEl.querySelectorAll('.sub-tab-panel')],
    panelFor: key => document.getElementById(`${mountEl.id}-pane-${key}`),
    activate: key => {
      const pane = document.getElementById(`${mountEl.id}-pane-${key}`)
      if (pane) pane.classList.remove('hidden')
      if (onSelect) onSelect(key)
    },
  })
  const panes = {}
  for (const t of tabs) {
    panes[t.key] = document.getElementById(`${mountEl.id}-pane-${t.key}`)
    if (adopted[t.key]) panes[t.key].appendChild(adopted[t.key])
  }
  strip.select(tabs[0].key)
  return { strip, panes }
}

// Opportunity detail tabs (Commercials / Documents / Stage & Approvals) -
// wired once, the tab bar is static HTML present for the life of the page,
// not regenerated per opportunity, so this must not run again per-opportunity
// or listeners would stack.
//
// The pane sweep is scoped to #view-opportunity-detail. It used to be a bare
// document.querySelectorAll('.detail-tab-panel'), which also hid Test Bed's
// four panels. Harmless while one detail view is on screen at a time, and
// wrong the moment anything else uses that class - which a sub-tab pane
// would have. Architecture rule 8.
const oppTabStrip = window.createTabStrip({
  strip: 'opp-detail-tabs',
  keyAttr: 'oppTab',
  label: 'Opportunity sections',
  panes: () => [...document.querySelectorAll('#view-opportunity-detail .detail-tab-panel')],
  panelFor: key => document.getElementById(`opp-tab-${key}`),
})
// opts is forwarded rather than dropped. select() accepts { focusTab }, and a
// wrapper that takes one argument silently discards a second: the call site
// reads as though it passed something and the definition never named it. That
// is Architecture rule 9 in miniature, one line wide.
function switchOppTab(tab, opts) { oppTabStrip.select(tab, opts) }

// ── Opportunity stage tabs, Round 21 Phase 2 ────────────────────────────
//
// One tab per working stage, generated from stage_definitions rather than
// written into index.html. Test Bed's eight are static markup that happens
// to match the database, kept in step by hand: Round 20 renamed every
// Opportunity stage, and a hardcoded strip would have gone silently wrong.
//
// WHICH STAGES GET A TAB, expressed as a property rather than a name list:
// every stage EXCEPT those marked reachable_from_any_stage. Closed Lost
// carries that flag, and a stage reachable from anywhere is not a step in a
// sequence, so it has no tab. It has no criteria and no approvals either,
// so its tab would be permanently empty. The chevron already shows it, and
// the control for losing a deal arrives in Phase 7.
//
// Closed Won is terminal but NOT reachable-from-anywhere: it is entered
// from Negotiating like any other forward move, so it keeps its tab.
// The key is SANITISED, and that is not cosmetic.
//
// It becomes part of several element ids, and an id containing a space works
// with getElementById and breaks silently in any CSS selector:
// querySelector('#opp-stage-criteria-stage-Solution Alignment') parses as
// "#opp-stage-criteria-stage-Solution" with a descendant "Alignment" and
// matches nothing, with no error. Four of the six Opportunity stages are two
// words, so the fault would have been latent in two thirds of the panels and
// invisible until something used a selector rather than an id lookup.
//
// Found in Phase 7 by a verification probe doing exactly that. createTabStrip
// already sanitises the same way when it builds button ids, which is where
// the pattern comes from.
//
// The real stage name is never derived back from this: every generated
// element carries data-opp-stage-tab or data-opp-stage-panel with the
// unsanitised name, so two stages that sanitised to the same key would still
// be distinguishable, and none of the seven do.
function oppStageTabKey(stageName) {
  return `stage-${String(stageName).replace(/[^a-zA-Z0-9_-]+/g, '-')}`
}

function renderOppStageTabs(stages, currentStage) {
  const strip = document.getElementById('opp-detail-tabs')
  const host = document.getElementById('view-opportunity-detail')
  if (!strip || !host) return

  const stageTabs = (stages ?? []).filter(s => !s.reachable_from_any_stage)

  // Remove the previous record's generated tabs and panels before adding
  // this record's. Without this, switching between records with different
  // stage lists would accumulate tabs from both.
  strip.querySelectorAll('.detail-tab[data-opp-stage-tab]').forEach(b => b.remove())
  host.querySelectorAll('.detail-tab-panel[data-opp-stage-panel]').forEach(p => p.remove())

  for (const st of stageTabs) {
    const key = oppStageTabKey(st.stage_name)
    // The panel first, so the button's aria-controls resolves when adopt()
    // runs. Pointing it at nothing is worse than omitting it.
    const panel = document.createElement('div')
    panel.className = 'detail-tab-panel hidden'
    panel.id = `opp-tab-${key}`
    panel.dataset.oppStagePanel = st.stage_name
    // Phase 2 renders the slot. Phase 3 moves the exit criteria in, Phase 4
    // the approvals, Phase 5 documents and assessments. A placeholder that
    // says what is coming beats an empty box that looks broken.
    // A TERMINAL stage gets a different panel, not four empty cards.
    //
    // Round 10 Phase 7 settled this for Test Bed, superseding Round 9 Phase
    // 6.3's "renders nothing": the Closed tab hides the panel row and shows
    // the completed record instead. Closed Won has zero exit criteria and
    // zero approvals, because criteria belong to the stage you are LEAVING
    // and nothing leaves a terminal stage, so without this case it would
    // render four permanently empty placeholders. A placeholder on a working
    // stage says "not configured yet"; four of them on a stage that can
    // never have any says the screen is broken.
    //
    // Keyed on is_terminal from the stage row, not on the name 'Closed Won',
    // so a record type whose terminal stage is named something else behaves
    // the same way.
    if (st.is_terminal) {
      panel.innerHTML = `
        <div class="ref-cards">
          <div class="pg-card">
            <p class="pg-card-title">${escHtml(st.stage_name)}</p>
            <p class="empty-state">This is a closed state. There is nothing to complete here:
            exit criteria and approvals belong to the stage a record is leaving, and a closed
            record is not leaving one.</p>
          </div>
        </div>`
      host.appendChild(panel)
      const tbtn = document.createElement('button')
      tbtn.type = 'button'
      tbtn.className = 'detail-tab'
      tbtn.dataset.oppTab = key
      tbtn.dataset.oppStageTab = st.stage_name
      tbtn.textContent = st.stage_name
      strip.appendChild(tbtn)
      continue
    }

    // Phase 3 fills the exit criteria, Phase 4 the approvals. Documents and
    // Assessments are slots: the business wants them visible for what is
    // coming, and Test Bed renders empty panels the same way.
    //
    // Round 22 Phase 1: the order is Assessments, Terminus Documents, Exit
    // Criteria, Approvals, matching Test Bed position for position with
    // Assessments in the slot Test Bed gives Qualification scoring.
    //
    // The previous order was not a decision. Round 21 built these panels in
    // three phases and each appended its card at the end, so the row recorded
    // the build sequence: Phase 3 Exit Criteria, Phase 4 Approvals, Phase 5
    // Documents and Assessments. Nothing else ordered them, and no
    // hand-written document recorded an intended order.
    //
    // This is a 2-up grid at 1240 and 1920, so "left to right" is READING
    // order: Assessments and Terminus Documents on the first row, Exit
    // Criteria and Approvals on the second. At 3440 the row is single and
    // reading order collapses back onto DOM order. Reordering the blocks is
    // enough either way, because DOM position is the only thing that orders
    // them: there is no `order:` declaration anywhere in the stylesheet.
    //
    // Each card addresses its own container by id, so moving the blocks
    // cannot disturb which container a loader fills.
    panel.innerHTML = `
      <div class="ref-cards">
        <div class="pg-card">
          <p class="pg-card-title">Assessments</p>
          <div id="opp-stage-assessments-${escHtml(key)}"><p class="empty-state">No assessments configured for this stage.</p></div>
        </div>
        <div class="pg-card">
          <p class="pg-card-title">Terminus Documents</p>
          <div id="opp-stage-documents-${escHtml(key)}"><p class="empty-state">No documents configured for this stage.</p></div>
        </div>
        <div class="pg-card">
          <p class="pg-card-title">Exit Criteria</p>
          <div id="opp-stage-criteria-${escHtml(key)}"></div>
        </div>
        <div class="pg-card">
          <p class="pg-card-title">Approvals</p>
          <div id="opp-stage-approvals-${escHtml(key)}"></div>
        </div>
      </div>
      <div id="opp-stage-transition-${escHtml(key)}" style="margin-top:24px"></div>`
    host.appendChild(panel)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'detail-tab'
    btn.dataset.oppTab = key
    btn.dataset.oppStageTab = st.stage_name
    btn.textContent = st.stage_name
    strip.appendChild(btn)
  }

  // The generated buttons need the ARIA the factory applies at construction.
  oppTabStrip.adopt()
  markOppCurrentStageTab(currentStage)
}

// One token per stage-tab load, mirroring tbStageTabLoadToken. Clicking
// through tabs quickly leaves two loads in flight, and an older, slower
// response can resolve after a newer one and paint the WRONG stage's
// criteria under the new stage's heading. Test Bed found that live in Round
// 5 Phase 7; this strip is new, so it is guarded from the start rather than
// after the same discovery.
let oppStageTabLoadToken = 0

// What a stage tab shows: the criteria for LEAVING that stage, whether or
// not the record is currently in it.
//
// That is Test Bed's behaviour, read from its source rather than invented.
// renderTbStageExitCriteria fetches ?stage=<the tab's stage> with no
// reference to the record's status, and its `tickable` test is the field
// being a known criterion key with a label, again with no reference to the
// current stage. Confirmed against the API: exit-criteria answers for any
// stage, so a Qualification record asked about Negotiating returns
// Negotiating's eight requirements.
//
// So criteria are tickable on any stage tab. Approvals are the half Test
// Bed DOES gate to the current stage, and that arrives in Phase 4.
//
// The advance control renders only on the record's current stage, because
// that is the only stage it could act on: the transition endpoint moves the
// record from its own status, not from whichever tab is open.
async function loadOppStageTab(recordId, stageName, currentStage, stages) {
  const myToken = ++oppStageTabLoadToken
  currentOppStageTab = stageName
  // A terminal stage's panel is static markup with nothing to fetch. Asking
  // for criteria and approvals it can never have would be two round trips
  // whose only possible answer is empty.
  if ((stages ?? []).find(s => s.stage_name === stageName)?.is_terminal) return
  const key = oppStageTabKey(stageName)
  await renderOppExitCriteria(`opp-stage-criteria-${key}`, recordId, stageName,
    (stages ?? []).find(s => s.stage_name === stageName)?.is_terminal
      ? null
      : nextStageAfter(stages, stageName),
    () => myToken === oppStageTabLoadToken)
  if (myToken !== oppStageTabLoadToken) return
  await renderOppStageApprovals(recordId, stageName, () => myToken === oppStageTabLoadToken)
  if (myToken !== oppStageTabLoadToken) return

  const tEl = document.getElementById(`opp-stage-transition-${key}`)
  if (!tEl) return
  if (stageName !== currentStage) {
    tEl.innerHTML = ''
    return
  }
  renderOppAdvanceControl(tEl, recordId, currentStage, stages)
}

// Approvals for ONE stage, mirroring renderTbStageApprovals.
//
// The asymmetry with the criteria panel is deliberate and is Test Bed's
// rule, not a simplification. Criteria tick on any stage tab. Approvals are
// clickable only when st.state === 'current' AND the track is not already
// approved. Both halves come from buildStageTrackListHtml, which is already
// shared and already correct, so this renders through it rather than
// growing a fourth copy of the same markup.
//
// A non-current stage renders READ-ONLY, not absent. Someone looking at
// Proposal from Qualification should see what will be required there, which
// is the whole reason the tab exists before the record reaches it.
async function renderOppStageApprovals(recordId, stageName, isStillCurrent = () => true) {
  const el = document.getElementById(`opp-stage-approvals-${oppStageTabKey(stageName)}`)
  if (!el) return
  const result = await api('GET', `/api/records/${recordId}/stage-approvals`)
  if (!isStillCurrent()) return
  if (!result.ok) {
    el.innerHTML = '<p class="empty-state">Failed to load approvals for this stage.</p>'
    return
  }
  const entry = (result.data ?? []).find(st => st.stage_name === stageName)
  el.innerHTML = entry
    ? buildStageTrackListHtml(recordId, entry)
    : '<p class="empty-state">Unknown stage.</p>'
}

function nextStageAfter(stages, stageName) {
  const list = stages ?? []
  const i = list.findIndex(s => s.stage_name === stageName)
  if (i < 0) return null
  if (list[i]?.is_terminal) return null
  return list[i + 1]?.stage_name ?? null
}

function renderOppAdvanceControl(el, recordId, currentStage, stages) {
  const next = nextStageAfter(stages, currentStage)
  if (!next) {
    const row = (stages ?? []).find(s => s.stage_name === currentStage)
    el.innerHTML = row?.is_terminal
      ? `<p class="muted" style="font-size:14px">${escHtml(currentStage)} is a closed state. Nothing further to move toward.</p>`
      : '<p class="muted" style="font-size:14px">This record has reached the final stage.</p>'
    return
  }
  // The lose-a-deal control sits BESIDE the advance control, not in the tab
  // row. Settled by measurement rather than preference: Phase 2 measured the
  // eight-tab strip at 876px in 876px, zero margin, so a ninth control there
  // would overflow it at 1240px.
  //
  // btn-ghost, not btn-primary. There is one primary action on this panel
  // and it is advancing; losing is the other thing you can do, and giving
  // both equal weight would put an irreversible action alongside the routine
  // one with nothing to tell them apart.
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <span style="font-size:14px">Advance to <strong>${escHtml(next)}</strong></span>
      <button class="btn-primary" onclick="attemptTransition('${recordId}', '${escHtml(next)}', 'transition-feedback', 'opportunity', '${escHtml(currentStage)}')">
        Move to ${escHtml(next)}
      </button>
      <button class="btn-ghost" onclick="openCloseLostPrompt('${recordId}', '${escHtml(currentStage)}')">
        Mark Closed Lost
      </button>
    </div>
    <div id="transition-feedback"></div>`
}

// Losing a deal, Round 21 Phase 7.
//
// Uses requestChangeReason rather than a second modal, so the focus trap,
// the Escape handling and the stays-open-on-failure behaviour are the ones
// INTERACTION_STANDARDS.md Section 4 already governs. Test Bed's precedent
// for a destructive action is confirm-delete-modal, a bare confirm; the
// precedent for an action needing a reason is this dialogue. Losing a deal
// is both, and this is the one that already carries a reason.
//
// Irreversible today, and the wording says so, because whether a loss can be
// reopened is still an open decision in OPPORTUNITY_DESIGN.md. When that is
// decided the wording changes; until then it must not imply an undo that
// does not exist.
window.openCloseLostPrompt = async (recordId, currentStage) => {
  const reasons = await api('GET', '/api/closed-lost-reasons')
  if (!reasons.ok) {
    const fb = document.getElementById('transition-feedback')
    if (fb) fb.innerHTML = '<p class="msg-error">Could not load the Closed Lost reasons.</p>'
    return
  }
  window.requestChangeReason({
    heading: 'Mark this opportunity Closed Lost',
    contextLabel: 'Stage at which it is being lost',
    contextValue: currentStage,
    choiceLabel: 'Reason (required)',
    choices: (reasons.data ?? []).map(r => ({ value: r.id, label: r.label })),
    promptLabel: 'Notes (optional)',
    confirmLabel: 'Mark Closed Lost',
    // Stated on the screen, not only in a comment. Whether a loss can be
    // reopened is an open decision in OPPORTUNITY_DESIGN.md, so today it
    // cannot be, and the dialogue must not imply an undo that does not
    // exist. When that decision lands, this line changes with it.
    warning: 'This cannot be undone. A closed deal cannot be reopened or moved to another stage.',
    emptyReasonError: 'A reason is required to close a deal as lost.',
    returnFocusTo: 'opp-stage-transition',
    onConfirm: async (note, reasonId) => {
      const result = await api('POST', `/api/opportunities/${recordId}/close-lost`, { reason_id: reasonId, note })
      return { ok: result.ok, error: result.data?.error }
    },
    onDone: async () => { await loadOpportunityDetail(recordId) },
  })
}

// The green dot on the tab matching the record's REAL stage, mirroring
// markTbCurrentStageTab. It matters more here than on Test Bed, because
// Opportunity's stage names are not obviously ordered: Solution Alignment
// and Evaluation give a reader no clue which comes first, so without the
// dot the strip says nothing about where the record actually is.
function markOppCurrentStageTab(currentStage) {
  document.querySelectorAll('#opp-detail-tabs .detail-tab[data-opp-stage-tab]').forEach(btn => {
    const isCurrent = btn.dataset.oppStageTab === currentStage
    let dot = btn.querySelector('.opp-tab-current-dot')
    if (isCurrent && !dot) {
      dot = document.createElement('span')
      dot.className = 'sa-dot opp-tab-current-dot'
      // display:inline-block set explicitly, not left to .sa-dot: that
      // class's width and height only take effect inside a flex container,
      // and a <button> is not one. The same trap markTbCurrentStageTab
      // documents.
      dot.style.cssText = 'background:var(--green);margin-right:6px;display:inline-block'
      btn.prepend(dot)
    } else if (!isCurrent && dot) {
      dot.remove()
    }
  })
}

// A real click on the tab row is the user picking a tab. Wired here rather
// than inside createTabStrip because the shared factory serves Test Bed's
// strip too, and that one already has its own flag.
document.getElementById('opp-detail-tabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.detail-tab')
  if (!btn) return
  oppUserPickedTab = true
  // A stage tab loads its own panel on open, rather than every panel being
  // populated up front. Six stages times two fetches on every record open is
  // work nobody asked for, and Test Bed loads per tab for the same reason.
  const stage = btn.dataset.oppStageTab
  if (stage && currentOppDetailId) {
    loadOppStageTab(currentOppDetailId, stage, currentOppStage, currentOppStages)
  }
})

// Test Bed detail tabs (Reference / Commercials / 8 stage tabs) - same
// static-tab-bar-wired-once pattern as Opportunity's above.
//
// tbUserPickedTab (Round 5 Phase 7, 2026-08-17): a real race found by
// testing, not assumed safe. renderTestBedDetail's own load sequence
// does two real, awaited network round-trips (fetchStages,
// loadTerminusStaffIfNeeded) after the page and its tab bar are already
// visible and clickable, before its own unconditional switchTbTab
// ('reference') call runs - a real user clicking a stage tab in that
// window (the tab buttons are static HTML, clickable the instant the
// view itself is shown, well before that data has necessarily finished)
// had their click silently overwritten moments later when the page's
// own default-to-Reference call finally ran, confirmed live: the
// stage tab's content loaded correctly in the background, but the
// panel stayed hidden, Reference stayed shown. Fixed by tracking
// whether the user has genuinely clicked a tab since the current load
// began; the auto-switch-to-Reference is skipped if so, deferring to
// their real choice instead of quietly discarding it. Reset to false at
// the start of every loadTestBedDetail call, so a genuinely new
// navigation (a different Test Bed, or the existing save-triggered
// reload behaviour, both pre-existing and unchanged) still defaults to
// Reference exactly as before - this only protects a click that
// happens to race ahead of that same load's own completion.
let tbUserPickedTab = false

// tbFreshNavigation (Round 12 Phase 1, 2026-08-20): the flag that separates
// ARRIVING at a record from RELOADING one.
//
// The comment above ends by noting that "the existing save-triggered reload
// behaviour, both pre-existing and unchanged" still defaults to Reference.
// That was accurate and it is the fault: loadTestBedDetail reset
// tbUserPickedTab on every call, and ELEVEN of its thirteen call sites are
// in-app saves rather than navigations. So every save moved the user to
// Reference, from wherever they were doing the work that triggered it.
//
// Round 8 Phase 1 recorded six of those paths and left them for a product
// decision. Round 11 added four more without the question being asked again.
// Round 10 Phase 6 fixed the transition path alone, via tbLandOnStageAfterLoad.
// The business reported two of the eleven, which are simply the two they
// happened to try while doing installation work.
//
// FIXED BY INVERTING THE DEFAULT rather than by patching call sites. Making
// each of the eleven pass "do not reset" would leave the twelfth, added in
// some future round, inheriting the fault - which is the standing rule about
// a fix built for the surfaces that existed, now at four confirmed instances.
// Preserving the tab is now what happens unless something explicitly says
// this is a navigation, and exactly one place says that: navigate().
//
// Set by navigate() and CONSUMED by loadTestBedDetail into tbArrivingFresh
// below, before anything can fail. Consuming it at the top rather than in
// the renderer is not tidiness: loadTestBedDetail returns early when the GET
// fails, so a flag cleared only by the renderer would survive a failed load
// and make the NEXT call - a save - read as an arrival and jump to Reference.
// That is the original fault reintroduced through its own fix, reachable
// whenever a save follows a load that 404ed or dropped.
let tbFreshNavigation = false
let tbArrivingFresh = false

// Round 10 Phase 6 (2026-08-19): after a successful transition the operator
// lands on the tab for the stage the record has just ENTERED, not back on
// Reference. Round 9 Phase 8 measured that return as 7 of the 59 clicks in a
// full lifecycle - a per-transition tax, and the cheapest thing on the list
// to remove.
//
// Carried as an intent flag rather than a parameter because the decision is
// made in attemptTransition and consumed by renderTestBedDetail, which sits
// two calls away and takes only the record. Same shape as tbUserPickedTab
// immediately above, deliberately: one more parameter threaded through
// loadTestBedDetail would have to be threaded through every one of its six
// other call sites, none of which care.
//
// Cleared as soon as it is read, so it can never leak into a later,
// unrelated load.
let tbLandOnStageAfterLoad = null
// Test Bed's strip is the same component. tbUserPickedTab is set on a real
// click here, before the component's own delegated handler runs, so the
// race Round 5 Phase 7 found is unaffected: it only needs to know a human
// chose the tab, not which one.
document.getElementById('tb-detail-tabs').addEventListener('click', e => {
  if (e.target.closest('.detail-tab')) tbUserPickedTab = true
})
// Round 5 Phase 7 (2026-08-17): tab ids starting "stage-" (the 8 new
// stage buttons, data-tb-tab="stage-<Stage Name>") all share one
// physical panel, #tb-tab-stage-detail, rather than 8 separate ones -
// the active-highlighting above still works per-button (each has its
// own distinct data-tb-tab value), only which panel is revealed and
// what's loaded into it is special-cased here.
// Round 5 Phase 7 (2026-08-17): "the current, active stage's tab is
// visually distinguishable from the others" - distinct from .active
// above, which just marks whichever tab is currently *open* (any of the
// 10 can be clicked into at any time, including peeking at a future or
// past stage). This marks whichever ONE of the 8 stage tabs matches the
// record's real current stage (bed.status), regardless of which tab is
// currently selected - same green dot the chevron strip and the
// Approvals row already use for "current," not a new accent colour
// invented for this (this app's own rule: the brand accent is reserved
// for live states, flagging a difference uses a label/marker, not a new
// colour). Called once per detail-page render, not per tab switch - the
// record's real stage doesn't change just from clicking through tabs.
function markTbCurrentStageTab(currentStage) {
  document.querySelectorAll('#tb-detail-tabs .detail-tab[data-tb-tab^="stage-"]').forEach(btn => {
    const stageName = btn.dataset.tbTab.slice('stage-'.length)
    const isReallyCurrent = stageName === currentStage
    let dot = btn.querySelector('.tb-tab-current-dot')
    if (isReallyCurrent && !dot) {
      dot = document.createElement('span')
      dot.className = 'sa-dot tb-tab-current-dot'
      // display:inline-block set explicitly here, not just via the
      // .sa-dot class - .sa-dot's own width/height only take effect
      // inside a flex container (its one existing usage,
      // buildStageApprovalRowHtml's .sa-stage row), a plain <button>
      // like .detail-tab is not one, so width/height on a default
      // display:inline span would otherwise be silently ignored.
      dot.style.cssText = 'background:var(--green);margin-right:6px;display:inline-block'
      btn.prepend(dot)
    } else if (!isReallyCurrent && dot) {
      dot.remove()
    }
  })
}

// The eight stage tabs share ONE physical panel, #tb-tab-stage-detail, and
// need a load call, so this consumer supplies an activate hook rather than
// the default one-tab-one-pane mapping.
// Round 17A Phase 4.2: the save bar's feedback is cleared when the tab
// genuinely CHANGES, and not when the same tab is re-applied.
//
// That distinction is the whole fix. Every reload calls switchTbTab, including
// the branch that re-selects the tab already open, so clearing on any
// activation would erase the message recordTbScores deliberately writes before
// reloading - the one case where a failure must survive a reload, because the
// reload is part of reporting it.
let tbLastActiveTab = null

const tbTabStrip = window.createTabStrip({
  strip: 'tb-detail-tabs',
  keyAttr: 'tbTab',
  label: 'Test Bed sections',
  panes: () => [...document.querySelectorAll('#view-test-bed-detail .detail-tab-panel')],
  panelFor: key => document.getElementById(key.startsWith('stage-') ? 'tb-tab-stage-detail' : `tb-tab-${key}`),
  activate: key => {
    if (tbLastActiveTab && tbLastActiveTab !== key && typeof clearTbSaveFeedback === 'function') {
      clearTbSaveFeedback()
    }
    tbLastActiveTab = key
    // Round 7 Phase 6: Next Stage is gated on the open tab, and the tab can
    // change with no re-render, so the button is refreshed here too.
    refreshTbNextStageButton()
    if (key.startsWith('stage-')) {
      document.getElementById('tb-tab-stage-detail').classList.remove('hidden')
      loadTbStageDetailTab(key.slice('stage-'.length))
    } else {
      document.getElementById(`tb-tab-${key}`).classList.remove('hidden')
    }
  },
})
function switchTbTab(tab) { tbTabStrip.select(tab) }

// ── Up and down navigate between fields ───────────────────────────────────────
//
// Round 16 Phase 4, completing a fix Round 15 delivered half of. The business
// reported two things about the arrow keys: that they changed values, and that
// they should navigate. Round 15 Phase 3 stopped them changing values by
// ending type="number", and did not make them navigate, so they did nothing at
// all. The gap was in that round's report and not in its brief.
//
// THE RULE. Up and down move to the previous and next field. Single-line text
// and numeric inputs only.
//
// Numeric fields are type="text" with an inputmode as of Round 15 Phase 3, so
// text and numeric are the same type now and this rule never has to tell them
// apart: it includes both and treats them identically. The three exclusions
// are each unambiguous on their own, and each has its own reason:
//
//   textarea      up and down are LINE movement. Summary, Notes and Install
//                 Notes are multi-line and jumping out mid-sentence is worse
//                 than the problem being solved.
//   select        up and down move through the option list.
//   input[date]   up and down change the focused date part.
//
// LEFT AND RIGHT ARE NEVER TOUCHED, on any field. Someone correcting a
// character mid-string reaches for the left arrow and that must keep working.
// This handler returns unless the key is up or down, so left and right never
// reach it at all.
const ARROW_NAV_TYPES = new Set(['text', 'email'])

function isArrowNavField(el) {
  if (!el || el.tagName !== 'INPUT') return false
  if (!ARROW_NAV_TYPES.has(el.type)) return false
  if (el.disabled) return false
  return el.offsetParent !== null
}

document.addEventListener('keydown', e => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  // A modified arrow is somebody else's shortcut, not this.
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const el = e.target
  if (!isArrowNavField(el)) return

  // SCOPE. Every focus-trapping dialog in this app carries .modal-backdrop -
  // Park, the two Account modals, New Lead, the inline buyer contact, the
  // change-reason dialogue, New Test Bed. Scoping to the nearest one means
  // arrow navigation can never carry focus out of a trapped dialog, which is
  // the same confinement INTERACTION_STANDARDS Section 4 already requires of
  // Tab. Written against the shared container rather than against a list of
  // dialog ids, so a dialog added later is covered without being enumerated.
  const scope = el.closest('.modal-backdrop') ?? document

  // Candidates include readonly fields, so one can be navigated OUT of.
  const fields = [...scope.querySelectorAll('input')].filter(isArrowNavField)
  const i = fields.indexOf(el)
  if (i === -1) return

  // Always swallow the key on an eligible field, whether or not a move
  // follows. A bare up or down in a single-line input jumps the caret to the
  // start or end of the value, so letting it through at the ends of a form
  // would make the last field behave differently from every other one.
  e.preventDefault()

  // Readonly fields are not landing targets: the ten computed Deal Sheet cost
  // figures would otherwise be stops on a route through fields a person can
  // actually type in. Step past them rather than skipping a single neighbour,
  // since they occur in runs.
  const step = e.key === 'ArrowDown' ? 1 : -1
  for (let j = i + step; j >= 0 && j < fields.length; j += step) {
    if (fields[j].readOnly) continue
    fields[j].focus()
    // Caret to the end, matching what focusing a field by Tab does, rather
    // than leaving it wherever the previous field's offset happened to be.
    try { fields[j].setSelectionRange(fields[j].value.length, fields[j].value.length) } catch { /* not selectable */ }
    return
  }
  // Deliberately no wraparound. Tab does not wrap at the end of a form and
  // neither does this; the last field simply stays put.
})

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  if (!currentSession) return { ok: false, data: { error: 'not authenticated' } }
  // Content-Type: application/json only set when there's a real body -
  // Fastify's JSON body parser rejects an empty body under that header
  // (FST_ERR_CTP_EMPTY_JSON_BODY), which silently broke every bodyless
  // POST (createFromContact's + Create was the one real call site).
  const headers = { Authorization: `Bearer ${currentSession.access_token}` }
  if (body) headers['Content-Type'] = 'application/json'
  // Round 10 Phase 5A: a network-level failure must return {ok:false}, not
  // reject. fetch() rejects on a dropped connection, an offline client or an
  // aborted request, and this function had no catch - so every caller's
  // `if (!result.ok)` branch was unreachable in exactly the case it was
  // written for, and the await threw instead. That was survivable while a
  // failed load simply left the previous content on screen. It stopped being
  // survivable the moment this round added a synchronous pending state: the
  // throw skipped the error branch, nothing cleared the marker, and the
  // panel sat on "Loading ..." permanently - the precise
  // permanently-static-UI outcome the phase was told not to produce.
  // Found by aborting the requests deliberately, not by reasoning.
  let res
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
  } catch (err) {
    return { ok: false, status: 0, data: { error: 'Network request failed. Check your connection and try again.' } }
  }
  // A non-JSON body (a proxy error page, a 502 from infrastructure) must
  // not throw here either, for the same reason.
  let data = null
  try {
    data = await res.json()
  } catch {
    data = { error: `Unexpected response from the server (HTTP ${res.status}).` }
  }
  return { ok: res.ok, status: res.status, data }
}

// ── "Mine" toggle ─────────────────────────────────────────────────────────────
// Read access is team-wide (records_select etc. broadened 2026-08-12);
// this is a client-side filter on top of that, not a security boundary -
// the boundary is still entirely in RLS. Default off (show everything).
// Filters against records.owner_id (present on every list row already),
// not anything in payload, so it works identically across every screen
// that uses it.
function filterMine(records, mineOnly) {
  if (!mineOnly) return records
  const myId = currentSession?.user?.id
  return records.filter(r => r.owner_id === myId)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function daysAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

// Date + time, for records where "when exactly" matters (Notes History)
// - distinct from formatDate(), which every date-only field (Est. Close
// Date, Key Dates, Opportunity's own Notes panel) keeps using unchanged.
function formatDateTime(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${datePart}, ${timePart}`
}

// Exact copy of the prototype's regionForCountry() (Terminus Ops.dc.html
// :7510-7523) - only auto-fills when a match is found, never clears an
// existing region for an unrecognised country. Scoped to the New Lead
// creation form only, per the ask - the detail page's click-to-edit
// fields edit Country and Region completely independently of each other
// (cdEdits has no cross-field reactivity), and wiring that up is a
// separate, larger change to a working mechanism, not attempted here.
function regionForCountry(country) {
  const c = String(country || '').trim().toLowerCase()
  if (!c) return ''
  const map = {
    'united kingdom': 'Europe & UK', 'uk': 'Europe & UK', 'great britain': 'Europe & UK', 'england': 'Europe & UK', 'scotland': 'Europe & UK', 'wales': 'Europe & UK', 'northern ireland': 'Europe & UK',
    'ireland': 'Europe & UK', 'france': 'Europe & UK', 'germany': 'Europe & UK', 'spain': 'Europe & UK', 'portugal': 'Europe & UK', 'italy': 'Europe & UK', 'netherlands': 'Europe & UK', 'belgium': 'Europe & UK',
    'denmark': 'Europe & UK', 'sweden': 'Europe & UK', 'norway': 'Europe & UK', 'finland': 'Europe & UK', 'poland': 'Europe & UK', 'austria': 'Europe & UK', 'switzerland': 'Europe & UK', 'czech republic': 'Europe & UK', 'greece': 'Europe & UK',
    'united states': 'Americas', 'usa': 'Americas', 'us': 'Americas', 'united states of america': 'Americas', 'canada': 'Americas', 'mexico': 'Americas', 'brazil': 'Americas', 'argentina': 'Americas', 'chile': 'Americas', 'colombia': 'Americas', 'peru': 'Americas',
    'united arab emirates': 'Middle East', 'uae': 'Middle East', 'saudi arabia': 'Middle East', 'qatar': 'Middle East', 'kuwait': 'Middle East', 'oman': 'Middle East', 'bahrain': 'Middle East', 'israel': 'Middle East', 'jordan': 'Middle East', 'turkey': 'Middle East', 'egypt': 'Middle East',
    'south africa': 'Africa', 'nigeria': 'Africa', 'kenya': 'Africa', 'ghana': 'Africa', 'morocco': 'Africa', 'ethiopia': 'Africa', 'tanzania': 'Africa', 'rwanda': 'Africa', 'senegal': 'Africa', 'ivory coast': 'Africa', 'uganda': 'Africa', 'zambia': 'Africa',
    'australia': 'APAC', 'new zealand': 'APAC', 'singapore': 'APAC', 'japan': 'APAC', 'south korea': 'APAC', 'korea': 'APAC', 'china': 'APAC', 'hong kong': 'APAC', 'taiwan': 'APAC', 'india': 'APAC', 'malaysia': 'APAC', 'indonesia': 'APAC', 'thailand': 'APAC', 'vietnam': 'APAC', 'philippines': 'APAC',
  }
  return map[c] || ''
}

// Currency label is hardcoded (2026-08-15 fix), not a real backing field
// - no currency picklist/payload key exists anywhere for Test Bed or
// Opportunity cost values, confirmed by checking every formatCost() call
// site (Test Bed's Accumulated Cost, Indicative Cost, per-unit costs;
// Opportunity's Test Bed Cost stat - all 4 share this one function, all
// were showing GBP). Corrected to USD, the currency documented for this
// same cost data elsewhere (Prototype-110826/CLAUDE.md: "Hardware Costs
// (USD/Unit)... mirrored from the Base Cost Data object", and
// PROTOTYPE_SPECIFICATION.md's own Deal sheet (USD) citation). A real per-record currency
// field is a separate, undesigned feature (new field, UI, migration
// decision) - not built here, this is a label correction only.
function formatCost(val) {
  if (val == null || val === '') return '--'
  return `USD ${Number(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Stage definitions cache ───────────────────────────────────────────────────
const stageCache = {}

async function fetchStages(record_type) {
  if (stageCache[record_type]) return stageCache[record_type]
  const result = await api('GET', `/api/stage-definitions?record_type=${encodeURIComponent(record_type)}`)
  if (result.ok && result.data.length) {
    stageCache[record_type] = result.data  // [{stage_name, sort_order, phase}]
  }
  return stageCache[record_type] ?? []
}

// ── Terminus staff cache (2026-08-16) ───────────────────────────────────────
// Sources Terminus Lead / Commercial / Technical / Legal Authority on both
// Test Bed and Opportunity - fetched once, lazily, same pattern as
// stageCache above. Called from both renderTestBedDetail and
// renderOppDetail (app.js) before their own panel's render, since both
// need the names available synchronously by the time their field rows
// build their <select> options.
let terminusStaffCache = []

async function loadTerminusStaffIfNeeded() {
  if (terminusStaffCache.length) return
  const result = await api('GET', '/api/terminus-staff')
  if (result.ok) terminusStaffCache = result.data
}

// ── Inline qualified Contact creation from Buyer Role dropdowns
// (Round 5 Phase 9, 2026-08-17) ──────────────────────────────────────
// Shared by Test Bed and Opportunity - one implementation, matching the
// brief's own "confirmed scope, both." Orchestrates four already-proven,
// existing endpoints in sequence rather than a new backend endpoint:
// POST /contacts, POST /contacts/:id/link-account, POST
// /records/:id/transition (the exact same real gate check every other
// Qualified transition in this app goes through - "being selected as a
// buyer implies qualification" per the brief, not a shortcut that just
// marks the row qualified), then the record type's own buyer-contacts
// endpoint. Each already has its own real validation; chaining them is
// genuinely just orchestration, not a second implementation of
// anything.
let ibcContext = null // { recordType: 'test_bed' | 'opportunity', recordId, accountId, role }
let ibcKeydownHandler = null

window.openInlineBuyerContactModal = async function (recordType, recordId, accountId, role) {
  ibcContext = { recordType, recordId, accountId, role }
  // Round 6 Phase 2 (2026-08-17): title stays "New Contact" regardless
  // of which buyer role triggered this - previously interpolated the
  // role in ("New Client Commercial Buyer"), dropped deliberately, the
  // role context still lives in the subtitle text below and in which
  // field the resulting Contact gets linked back to.
  document.getElementById('inline-buyer-contact-heading').textContent = 'New Contact'
  ;['ibc-name', 'ibc-jobrole', 'ibc-email', 'ibc-mobile', 'ibc-address', 'ibc-address2', 'ibc-city', 'ibc-postcode', 'ibc-country', 'ibc-linkedin', 'ibc-summary']
    .forEach(id => { document.getElementById(id).value = '' })
  document.getElementById('ibc-region').value = ''
  document.getElementById('ibc-source').value = ''
  document.getElementById('inline-buyer-contact-error').classList.add('hidden')

  if (!industriesCache.length) {
    const result = await api('GET', '/api/industries')
    if (result.ok) industriesCache = result.data
  }
  document.getElementById('ibc-industry').innerHTML = '<option value="">Select industry</option>' +
    industriesCache.map(i => `<option value="${i.id}">${escHtml(i.name)}</option>`).join('')
  document.getElementById('ibc-industry').value = ''

  const modal = document.getElementById('inline-buyer-contact-modal')
  modal.classList.remove('hidden')
  document.getElementById('ibc-name').focus()

  // Full focus trap (INTERACTION_STANDARDS.md Section 4), same generic
  // querySelectorAll pattern already used for the Account Details panel
  // (contact-detail.js) rather than a hardcoded field list - this form
  // has a similar field count.
  ibcKeydownHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeInlineBuyerContactModal(); return }
    if (e.key !== 'Tab') return
    const focusable = [...modal.querySelectorAll('input, select, button, textarea')].filter(el => el.offsetParent !== null && !el.disabled)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  document.addEventListener('keydown', ibcKeydownHandler)
}

window.closeInlineBuyerContactModal = function () {
  document.getElementById('inline-buyer-contact-modal').classList.add('hidden')
  if (ibcKeydownHandler) { document.removeEventListener('keydown', ibcKeydownHandler); ibcKeydownHandler = null }
  ibcContext = null
}

window.saveInlineBuyerContact = async function () {
  const errEl = document.getElementById('inline-buyer-contact-error')
  errEl.classList.add('hidden')
  if (!ibcContext) return

  const val = (id) => document.getElementById(id).value.trim()
  const fields = {
    name: val('ibc-name'), industry_id: document.getElementById('ibc-industry').value,
    jobRole: val('ibc-jobrole'), email: val('ibc-email'), mobile: val('ibc-mobile'),
    address: val('ibc-address'), address2: val('ibc-address2'), city: val('ibc-city'),
    postcode: val('ibc-postcode'), country: val('ibc-country'), region: document.getElementById('ibc-region').value,
    linkedin: val('ibc-linkedin'), source: document.getElementById('ibc-source').value, summary: val('ibc-summary'),
  }

  // Client-side check is a hint only - the real, authoritative gate is
  // the Qualified transition attempted below (step 3), same "never
  // trust client-only validation for a decision-relevant state change"
  // rule this app applies everywhere else. address2 deliberately
  // excluded - it's genuinely optional in leadQualifyRequired.
  const REQUIRED = ['name', 'industry_id', 'jobRole', 'email', 'mobile', 'address', 'city', 'postcode', 'country', 'region', 'linkedin', 'source', 'summary']
  const missing = REQUIRED.filter(k => !fields[k])
  if (missing.length) {
    errEl.textContent = `Missing: ${missing.join(', ')}`
    errEl.classList.remove('hidden')
    return
  }

  const btn = document.getElementById('inline-buyer-contact-save')
  btn.disabled = true
  const originalText = btn.textContent
  btn.textContent = 'Creating...'

  try {
    // Step 1: create. Company auto-derived from the record's own real
    // linked Account (never re-typed by the user) - the free-text field
    // still gets a real, accurate value, just not one asked for
    // redundantly when the real Account link (step 2) is what actually
    // matters for qualification.
    const accountName = accountsCache.find(a => a.id === ibcContext.accountId)?.payload?.name ?? ''
    const created = await api('POST', '/api/contacts', {
      name: fields.name, company: accountName, email: fields.email, mobile: fields.mobile,
      industry_id: fields.industry_id, source: fields.source, jobRole: fields.jobRole,
      linkedin: fields.linkedin, address: fields.address, address2: fields.address2 || undefined,
      city: fields.city, postcode: fields.postcode, country: fields.country, region: fields.region,
      summary: fields.summary,
    })
    if (!created.ok) {
      errEl.textContent = created.data?.error ?? 'Failed to create Contact.'
      errEl.classList.remove('hidden')
      return
    }
    const contactId = created.data.id

    // Step 2: the real Account link - satisfies the qualification
    // gate's own "Company" requirement (parent_record_id, not the
    // free-text field written in step 1).
    const linked = await api('POST', `/api/contacts/${contactId}/link-account`, { account_id: ibcContext.accountId })
    if (!linked.ok) {
      errEl.innerHTML = `${escHtml(linked.data?.error ?? 'Failed to link Account.')} The Contact was created but is not yet linked or qualified - open it directly (Contacts list) to fix this rather than creating another one.`
      errEl.classList.remove('hidden')
      return
    }

    // Step 3: the real transition - the exact same endpoint and gate
    // check every other Qualified transition in this app goes through.
    const qualified = await api('POST', `/api/records/${contactId}/transition`, { to_stage: 'Qualified' })
    if (!qualified.ok) {
      const reason = qualified.status === 422 && qualified.data.blocking?.length
        ? qualified.data.blocking.map(b => b.message).join('; ')
        : (qualified.data?.error ?? 'Qualification failed.')
      errEl.innerHTML = `Contact created and linked to the Account, but qualification was genuinely blocked: ${escHtml(reason)}. Open the Contact directly (Contacts list) to fix this.`
      errEl.classList.remove('hidden')
      return
    }

    // Step 4: link as this specific buyer role, the same endpoint the
    // ordinary (already-qualified-Contact) dropdown flow already uses.
    const path = ibcContext.recordType === 'test_bed'
      ? `/api/test-beds/${ibcContext.recordId}/buyer-contacts`
      : `/api/opportunities/${ibcContext.recordId}/buyer-contacts`
    const roleLinked = await api('POST', path, { role: ibcContext.role, contact_id: contactId })
    if (!roleLinked.ok) {
      errEl.innerHTML = `Contact created, linked to the Account, and qualified, but linking as ${escHtml(ibcContext.role)} failed: ${escHtml(roleLinked.data?.error ?? 'unknown error')}. It can be linked directly from the role dropdown now that it's qualified.`
      errEl.classList.remove('hidden')
      return
    }

    // Full success - return to the original screen, per the brief, with
    // the new Contact now selectable and correctly linked (the reload
    // below picks it up via the record's own buyer_contacts, already
    // written by step 4).
    const { recordType, recordId } = ibcContext
    closeInlineBuyerContactModal()
    if (recordType === 'test_bed') {
      await loadTestBedDetail(recordId)
    } else {
      await loadOpportunityDetail(recordId)
    }
  } finally {
    btn.disabled = false
    btn.textContent = originalText
  }
}

document.getElementById('inline-buyer-contact-close').addEventListener('click', window.closeInlineBuyerContactModal)
document.getElementById('inline-buyer-contact-cancel').addEventListener('click', window.closeInlineBuyerContactModal)
document.getElementById('inline-buyer-contact-save').addEventListener('click', window.saveInlineBuyerContact)
document.getElementById('inline-buyer-contact-modal').addEventListener('click', (e) => {
  if (e.target.id === 'inline-buyer-contact-modal') window.closeInlineBuyerContactModal()
})

// Chevron-style strip — used for Test Beds and Opportunities (2026-08-16
// - the old dot-based renderStageTracker, used only by Opportunity, is
// removed entirely, not left dead alongside this).
// Phase groups (e.g. all Planning sub-stages) collapse to a single chevron.
function renderChevronStrip(elementId, currentStage, stages) {
  const el = document.getElementById(elementId)
  if (!el) return

  const hasPhases = stages.some(s => s.phase)
  let mainItems
  if (hasPhases) {
    const seen = new Set()
    mainItems = []
    for (const s of stages) {
      if (s.phase) {
        if (!seen.has(s.phase)) { seen.add(s.phase); mainItems.push({ label: s.phase }) }
      } else {
        mainItems.push({ label: s.stage_name })
      }
    }
  } else {
    mainItems = stages.map(s => ({ label: s.stage_name }))
  }

  const currentStageObj = stages.find(s => s.stage_name === currentStage)
  const currentMainLabel = currentStageObj?.phase ?? currentStage
  const currentMainIdx = mainItems.findIndex(m => m.label === currentMainLabel)

  // Test Bed's flat 8-stage list has no phase grouping to collapse down
  // to the ~6 items this component was originally sized for - see the
  // .chevron-strip.many CSS rule.
  el.classList.toggle('many', mainItems.length > 6)

  el.innerHTML = mainItems.map((item, i) => {
    const cls = i < currentMainIdx ? 'done' : i === currentMainIdx ? 'current' : ''
    const zIndex = mainItems.length - i
    // data-stage only when the label is a real stage rather than a phase
    // grouping - Opportunity's chevron collapses stages into phases, and a
    // phase has no exit-criteria of its own to show.
    const isRealStage = stages.some(s => s.stage_name === item.label)
    const stageAttr = isRealStage ? ` data-stage="${escHtml(item.label)}"` : ''
    return `<div class="chevron-item ${cls}" style="z-index:${zIndex}"${stageAttr}>${escHtml(item.label)}</div>`
  }).join('')
}

// Round 7 Phase 9: hovering a chevron shows that stage's outstanding
// exit criteria.
//
// Two things are prevented BY CONSTRUCTION rather than tested for
// afterwards, because both are transient and nearly unreportable:
//
//  1. Debounce. A pointer sweeps eight chevrons in well under a second.
//     Firing on every mouseover would issue eight requests for one
//     gesture, so the fetch only starts once the pointer has rested.
//  2. A load token, the same discipline loadTbStageDetailTab already uses
//     (tbStageTabLoadToken) after Round 5 Phase 7 found a real race there.
//     Hovering is faster and less deliberate than clicking, so responses
//     can and will arrive out of order; a stale one must never paint. The
//     symptom would be the wrong stage's criteria appearing for a moment
//     and vanishing - invisible to any test that hovers once and waits.
let tbChevronHoverTimer = null
let tbChevronLoadToken = 0
const TB_CHEVRON_HOVER_DELAY_MS = 180

function hideTbChevronPopup() {
  clearTimeout(tbChevronHoverTimer)
  // Bump the token so any in-flight response is stale and cannot paint
  // after the pointer has already left.
  tbChevronLoadToken++
  const popup = document.getElementById('tb-chevron-popup')
  if (popup) popup.classList.add('hidden')
}

// Centre on the chevron, then clamp inside the wrapper. This is what
// stops the leftmost and rightmost popups being clipped at the viewport
// edge - the strip runs the full page width, so Closed sits hard against
// it and a centred popup would overflow.
function positionTbChevronPopup(item, popup, wrap) {
  const wrapRect = wrap.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  popup.classList.remove('hidden')
  const popupWidth = popup.getBoundingClientRect().width
  const centred = (itemRect.left - wrapRect.left) + (itemRect.width / 2) - (popupWidth / 2)
  const maxLeft = wrapRect.width - popupWidth
  popup.style.left = `${Math.max(0, Math.min(centred, Math.max(0, maxLeft)))}px`
}

// Round 18 Phase 1: WHICH RECORD is read at hover time, from the element,
// rather than captured when the listener was created.
//
// Two faults with one cause, both present since Round 7 Phase 9 built this
// (1918f03) and neither touched since:
//
//  1. `tb-chevron-wrap` is STATIC markup in index.html, so `dataset.wired`
//     survives every navigation. The early return meant that on the second
//     and every later Test Bed opened in a page session, this function did
//     nothing and the listener kept the FIRST record's id in its closure.
//  2. The popup cached what it was showing by stage NAME alone, so hovering
//     the same stage name on a different record counted as "already showing
//     this" and issued no request at all, leaving the previous record's
//     answer on screen.
//
// Either alone still gives a wrong answer on a second record, so the fix is
// record identity rather than two patches: the id lives on the element and is
// read when the pointer rests, and the cache key is record plus stage.
//
// WHY IT SURVIVED FOUR ROUNDS: it is correct for the first record opened in a
// page session, and every test opens one record and hovers.
//
// The listeners are still attached exactly once. That part was right, and the
// wrap being static is precisely why attaching per record would accumulate
// them.
function wireTbChevronHover(recordId) {
  const wrap = document.getElementById('tb-chevron-wrap')
  const popup = document.getElementById('tb-chevron-popup')
  if (!wrap || !popup) return

  // Updated on EVERY load, before the wiring guard below.
  wrap.dataset.recordId = recordId
  // A popup still open from the previous record describes a record the user
  // has left. Drop it and its cache key rather than letting a stale answer
  // survive the switch.
  hideTbChevronPopup()
  popup.dataset.key = ''

  if (wrap.dataset.wired === '1') return
  wrap.dataset.wired = '1'

  wrap.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.chevron-item[data-stage]')
    if (!item) return
    const stage = item.dataset.stage
    // Read now, not closed over. This is the line that makes the handler
    // belong to whichever record is on screen.
    const currentId = wrap.dataset.recordId
    if (!currentId) return
    const key = `${currentId}::${stage}`
    if (popup.dataset.key === key && !popup.classList.contains('hidden')) return

    clearTimeout(tbChevronHoverTimer)
    tbChevronHoverTimer = setTimeout(async () => {
      const myToken = ++tbChevronLoadToken
      const result = await api('GET', `/api/records/${currentId}/exit-criteria?stage=${encodeURIComponent(stage)}`)
      // A newer hover has started, or the pointer has left. Drop this one.
      if (myToken !== tbChevronLoadToken) return

      if (!result.ok) {
        popup.innerHTML = '<div class="linked-record-row">Could not load exit criteria.</div>'
      } else {
        const blocking = result.data?.blocking ?? []
        popup.innerHTML = `<p class="chevron-popup-title">${escHtml(stage)}</p>` + (blocking.length
          ? blocking.map(b => `<div class="linked-record-row">${escHtml(b.message)}</div>`).join('')
          : '<div class="linked-record-row">Nothing outstanding.</div>')
      }
      popup.dataset.key = key
      positionTbChevronPopup(item, popup, wrap)
    }, TB_CHEVRON_HOVER_DELAY_MS)
  })

  // On the WRAPPER, so moving the pointer from a chevron into the popup is
  // not a leave. The chevron itself stays non-clickable - confirmed by
  // history in Round 5 Phases 7 and 8 that it has never had a click
  // handler, and adding hover must not add click.
  wrap.addEventListener('mouseleave', hideTbChevronPopup)
}

// The Opportunity exit-criterion payload keys, mirroring the same 19 names
// inside SALESPERSON_WRITABLE_KEYS on the server.
//
// Duplicated here deliberately, for the reason TB_EXIT_CRITERION_KEYS already
// records: the browser has no import path to a server module, and the only
// alternative is trusting whatever `label` a rule happens to carry. `label`
// is additive and ignored by the gate engine, so ANY payload_field_required
// rule may be given one purely for display. A panel keyed on the label alone
// would render that rule as a tick box, and ticking it would write into an
// unrelated payload field. Key-set membership is the half that makes the
// control safe; the label is only the half that makes it readable.
//
// The server validates the same set independently on every PATCH, so drift
// between the two lists costs a rejected save, never a write to an
// unintended field.
// ── Opportunity stage state, Round 21 Phase 1 ───────────────────────────
//
// The tick handler needs to know which record and which stage it is acting
// for WITHOUT re-reading the page, which is the whole point of the fix
// below. Mirrors currentTbStageTab, which Test Bed has kept for ten rounds.
let currentOppDetailId = null
let currentOppStage = null
// The record's stage list, so a tick can work out the destination for its
// own stage without refetching it.
let currentOppStages = []
// Which stage TAB is open, as distinct from currentOppStage, which is the
// record's own stage. Phase 3 made those two different things.
let currentOppStageTab = null

// Serialises ticks. Test Bed's tbCriterionQueue exists because a person
// ticking three boxes quickly issues three overlapping PATCHes and three
// overlapping re-renders, and the slowest can land last and paint a stale
// panel. Round 11A is the precedent this project already paid for: a
// mechanism correct for one interaction and untested for a repeated one.
let oppCriterionQueue = Promise.resolve()

// oppUserPickedTab, Round 21 Phase 1. The same race Round 5 Phase 7 found
// on Test Bed and fixed there with tbUserPickedTab, never ported here.
//
// renderOppDetail ends with an unconditional switchOppTab('reference'), and
// it runs AFTER several awaited round trips, while the tab bar is already
// visible and clickable. A user who clicks Stage and Approvals in that
// window has the click silently overwritten moments later when the page's
// own default finally lands.
//
// Measured in Phase 1 rather than assumed: with the page allowed to settle
// first, three consecutive ticks hold the tab; without settling, the first
// tick appeared to reset it, and that reset was this load completing rather
// than anything the tick did. Two causes, one symptom, and this one
// survived the tick-handler fix.
//
// Cleared on ARRIVAL at a record, so opening an Opportunity still lands on
// Reference exactly as before. This only protects a click that races that
// same load's own completion.
let oppUserPickedTab = false

// oppLandOnStageAfterLoad, Round 22 Phase 2. The Opportunity twin of
// tbLandOnStageAfterLoad, ported rather than invented.
//
// The problem it solves is that an advance is the one case where the SYSTEM
// should move the tab and the user has not asked it to. oppUserPickedTab
// cannot express that: it is armed by any tab click, and the user reaches the
// advance control by clicking a stage tab, so by the time they advance the
// guard is always set and the only switch in renderOppDetail is suppressed.
// The strip is rebuilt with every panel hidden and nothing selects one, so
// the record moves and the screen goes blank.
//
// A one-shot intent is the answer instead of touching the guard. Set at the
// transition, read and cleared once on the next render, and it OUTRANKS the
// guard rather than clearing it. That is what makes the Round 21 Phase 1 race
// unaffected by construction: the guard's own value is never written here.
//
// Measured before building. Three consecutive advances in one session left
// zero panels visible and no active tab at all, stable across ten samples
// over five seconds, so it was a settled empty screen and not a slow render.
// The business hit this four times in two and a half minutes on 2026-08-22.
let oppLandOnStageAfterLoad = null

const OPP_EXIT_CRITERION_KEYS = new Set([
  'exitQualBudget', 'exitQualTimeline', 'exitQualCommitment',
  'exitSolTechnicalSolution', 'exitSolBuyersKnown', 'exitSolKeyStakeholders', 'exitSolTermsReviewed',
  'exitPropPricingApproved', 'exitPropContractTerms', 'exitPropImplSchedule', 'exitPropDocumentation',
  'exitEvalClarificationsResponded', 'exitEvalRevisedPricing', 'exitEvalTechnicalClarifications',
  'exitNegScopeAgreed', 'exitNegPricingAgreed', 'exitNegLegalResolved',
  'exitNegCommercialsApproved', 'exitNegContractExecuted',
])

// The tick list, following the Test Bed panel that is already built and in
// use. The busiest Opportunity transition carries 5 criteria and 3
// approvals; Test Bed's Qualification exit already renders 9 criteria, 2
// approvals and 3 further requirements on one panel, so the pattern carries
// this count with room to spare. Measured in Phase 6 rather than assumed.
async function renderOppExitCriteria(containerId, recordId, fromStage, toStage, isStillCurrent = () => true) {
  const el = document.getElementById(containerId)
  if (!el) return
  const result = await api('GET', `/api/records/${recordId}/exit-criteria?stage=${encodeURIComponent(fromStage)}`)
  // Dropped rather than painted if a newer load has started. Without this a
  // slower response for an earlier tab lands last and shows that stage's
  // criteria under this one's heading.
  if (!isStillCurrent()) return
  if (!result.ok) {
    el.innerHTML = '<p class="empty-state">Unable to load exit criteria.</p>'
    return
  }
  const requirements = result.data?.requirements ?? []
  if (!requirements.length) {
    el.innerHTML = `<p class="muted" style="font-size:14px">No exit criteria configured for ${escHtml(toStage)}.</p>`
    return
  }

  const rows = requirements.map(r => {
    const tickable = r.requirement_type === 'payload_field_required'
      && OPP_EXIT_CRITERION_KEYS.has(r.field)
      && !!r.label
    const mark = r.met
      ? '<span class="tb-crit-box tb-crit-box--met">&#10003;</span>'
      : '<span class="tb-crit-box"></span>'
    if (tickable) {
      // The STAGE travels with the row. Phase 1's handler read the record's
      // own stage, which was right when the panel only ever existed on one
      // screen and is wrong now that a panel can be open for a stage the
      // record is not in.
      return `<div class="tb-crit-row tb-crit-row--tickable" data-field="${escHtml(r.field)}" data-stage="${escHtml(fromStage)}" data-met="${r.met ? 'true' : 'false'}" onclick="toggleOppExitCriterion('${escHtml(recordId)}', '${escHtml(fromStage)}', '${escHtml(r.field)}', ${r.met ? 'true' : 'false'})" title="${r.met ? 'Tick to clear' : 'Tick to confirm'}">
        ${mark}<span class="tb-crit-text">${escHtml(r.label)}</span>
      </div>`
    }
    // Approvals are earned elsewhere and computed here, so they are
    // read-only rows. Presenting one as a tick box would invite a click
    // that cannot do anything.
    // data-stage on the computed rows too. It feeds no handler, but six
    // stage panels now sit in the DOM at once and a row that does not say
    // which panel it belongs to is a row a probe can misattribute.
    return `<div class="tb-crit-row tb-crit-row--computed" data-field="${escHtml(r.field ?? '')}" data-stage="${escHtml(fromStage)}" data-met="${r.met ? 'true' : 'false'}">
      ${mark}<span class="tb-crit-text">${escHtml(r.message)}</span>
    </div>`
  }).join('')

  const outstanding = requirements.filter(r => !r.met).length
  const summary = outstanding === 0
    ? `<p class="sub" style="margin-bottom:10px">All criteria met - ready to move to ${escHtml(toStage)}.</p>`
    : `<p class="sub" style="margin-bottom:10px">${outstanding} of ${requirements.length} outstanding to move to ${escHtml(toStage)}:</p>`
  el.innerHTML = summary + rows
  const fb = document.createElement('div')
  fb.className = 'tb-doc-feedback opp-crit-feedback'
  el.appendChild(fb)
}

// Reflects a SERVER-CONFIRMED tick on the row that was clicked, before the
// panel re-renders. Without it the row sits unchanged for the length of the
// round trip and a second click lands on stale `met` state.
function applyConfirmedOppTick(recordId, stageName, field, met) {
  const row = document.querySelector(
    `.tb-crit-row--tickable[data-field="${CSS.escape(field)}"][data-stage="${CSS.escape(stageName)}"]`)
  if (!row) return
  const box = row.querySelector('.tb-crit-box')
  if (box) {
    box.className = met ? 'tb-crit-box tb-crit-box--met' : 'tb-crit-box'
    box.innerHTML = met ? '&#10003;' : ''
  }
  row.dataset.met = met ? 'true' : 'false'
  row.setAttribute('title', met ? 'Tick to clear' : 'Tick to confirm')
  row.setAttribute('onclick', `toggleOppExitCriterion('${recordId}', '${stageName}', '${field}', ${met ? 'true' : 'false'})`)
}

// Ticking writes an ISO timestamp, clearing writes null, which is the same
// shape Test Bed uses: the gate asks only whether the field is set, and a
// timestamp answers that while also recording when it was confirmed.
// Round 21 Phase 1. THE BLOCKING DEFECT, and it was one line.
//
// This previously ended with `await loadOpportunityDetail(recordId)`, which
// re-renders the entire record page. The page's default active tab is
// Reference, so every tick threw the user back to Reference and the next
// tick cost re-clicking the tab and scrolling down again. Measured in Phase
// 0 across three consecutive ticks: the tab read `reference` after every
// one, and the criteria panel was out of the viewport after every one.
//
// The panel was never on the Reference page, which was the reported
// diagnosis. It sat inside #opp-tab-approvals, a tab Phase 5 has since
// removed entirely. The location was never the
// problem; reloading the page after a write was.
//
// Test Bed has done this correctly since Round 9: re-render the panel, not
// the page, and capture the stage at click time so a tab switch mid-flight
// cannot paint the wrong stage's answer.
window.toggleOppExitCriterion = (recordId, stageName, field, isMet) => {
  if (!OPP_EXIT_CRITERION_KEYS.has(field)) return oppCriterionQueue
  const run = async () => {
    // Round 21 Phase 3: the stage now arrives as an ARGUMENT rather than
    // being read from currentOppStage.
    //
    // Phase 1 captured the record's own stage at click time, which was
    // correct while the panel existed on exactly one screen. A stage tab can
    // now be open for a stage the record is not in, and Test Bed permits
    // ticking there, so the record's status is no longer the stage the click
    // belongs to. Reading it would have re-rendered the wrong panel and left
    // the clicked one showing a stale tick.
    //
    // Still captured at click time in the sense that matters: it is bound
    // into the row's own onclick when the row is rendered, so it cannot
    // drift while the write is in flight.
    const stageAtClick = stageName
    const key = oppStageTabKey(stageAtClick)
    const panel = document.getElementById(`opp-stage-criteria-${key}`)
    const fb = panel?.querySelector('.opp-crit-feedback')
    if (fb) { fb.textContent = ''; fb.className = 'tb-doc-feedback opp-crit-feedback' }

    const result = await api('PATCH', `/api/opportunities/${recordId}`, {
      payload: { [field]: isMet ? null : new Date().toISOString() }
    })

    if (!result.ok) {
      // The control is left exactly as it was. A failed write must not look
      // like a success, which is why nothing optimistic happens before this.
      const el = document.getElementById(`opp-stage-criteria-${key}`)?.querySelector('.opp-crit-feedback')
      if (el) {
        el.textContent = `Could not update: ${result.data?.error ?? 'unknown error'}`
        el.className = 'tb-doc-feedback opp-crit-feedback err'
      }
      return
    }

    // Still the same record, and that stage's panel is still on the page.
    if (currentOppDetailId === recordId && document.getElementById(`opp-stage-criteria-${key}`)) {
      applyConfirmedOppTick(recordId, stageAtClick, field, !isMet)
      const token = ++oppStageTabLoadToken
      await renderOppExitCriteria(`opp-stage-criteria-${key}`, recordId, stageAtClick,
        nextStageAfter(currentOppStages, stageAtClick), () => token === oppStageTabLoadToken)
    }
  }
  oppCriterionQueue = oppCriterionQueue.then(run, run)
  return oppCriterionQueue
}

// Round 22 Phase 2: this was a fork and is now a lookup, because after this
// phase both record types do the SAME two things on a successful transition -
// record where to land, then reload. It was only ever a fork because Test Bed
// had a landing intent and Opportunity had none.
//
// That asymmetry is the seventh instance of the built-for-the-screen-that-
// existed finding, and the second one that was live rather than latent:
// Opportunity took the branch that did less, every time, in production.
// Adding a second branch beside the first would have widened the fork rather
// than closed it.
//
// The discriminator was called `sectionId` and looked like an element id. It
// never was one. It was compared once and never looked up, and no element
// with id 'tb-transition-section' exists anywhere in the app, as the Test Bed
// call site's own comment already said. Renamed to what it actually is.
const TRANSITION_LANDING = {
  test_bed: {
    land: stage => { tbLandOnStageAfterLoad = stage },
    reload: id => loadTestBedDetail(id),
  },
  opportunity: {
    land: stage => { oppLandOnStageAfterLoad = stage },
    reload: id => loadOpportunityDetail(id),
  },
}

window.attemptTransition = async (id, toStage, feedbackId, recordKind, currentStage) => {
  const feedback = document.getElementById(feedbackId)
  if (feedback) feedback.innerHTML = ''

  const result = await api('POST', `/api/records/${id}/transition`, { to_stage: toStage })

  if (result.ok) {
    const target = TRANSITION_LANDING[recordKind]
    // An unrecognised kind is a programming error, not a runtime condition.
    // The old `else` treated every value that was not the Test Bed's as an
    // Opportunity, so a third record type would have silently reloaded the
    // wrong detail view and looked like it worked. Saying so beats guessing.
    if (!target) {
      console.error(`attemptTransition: unknown record kind "${recordKind}"`)
      return
    }
    target.land(toStage)
    await target.reload(id)
    return
  }

  if (!feedback) return

  if (result.status === 422 && result.data.blocking?.length) {
    const items = result.data.blocking.map(b => `<li>${escHtml(b.message)}</li>`).join('')
    feedback.innerHTML = `<p class="msg-error">Transition blocked.</p><ul class="blocking-list">${items}</ul>`
    return
  }

  feedback.innerHTML = `<p class="msg-error">${escHtml(result.data.error ?? 'Transition failed.')}</p>`
}

// ── Leads (legacy, read-only) ───────────────────────────────────────────────
// The 9 pre-existing record_type='lead' rows, frozen since 2026-08-12 -
// POST /leads and both /leads/:id/convert* endpoints are retired (see
// src/routes/leads.js). Unrelated to the live Leads/Contacts views below,
// which are Contact records - this is a different record_type entirely,
// reached only via the "Legacy leads" link.
let legacyLeadsCache = []
let expandedLegacyLeadId = null

async function loadLegacyLeads() {
  const result = await api('GET', '/api/leads')
  if (!result.ok) {
    document.getElementById('legacy-leads-rows').innerHTML =
      '<p class="empty-state">Failed to load leads.</p>'
    return
  }
  legacyLeadsCache = result.data
  renderLegacyLeadsList()
}

// Read-only history view - frozen, nothing here writes anywhere. Fields
// shown are exactly what's in these 9 records' payloads (checked against
// the real data: contact_name, company_name, source, notes - nothing
// else was ever stored on a Lead), not a guessed-at field set.
function renderLegacyLeadsList() {
  const container = document.getElementById('legacy-leads-rows')
  if (!legacyLeadsCache.length) {
    container.innerHTML = '<p class="empty-state">No leads.</p>'
    return
  }

  container.innerHTML = legacyLeadsCache.map(l => {
    const p = l.payload ?? {}
    const isExpanded = expandedLegacyLeadId === l.id
    return `
    <div class="record-card">
      <div class="record-card-main">
        <div class="record-card-title-row">
          <span class="record-card-title">${escHtml(p.contact_name ?? '--')}</span>
          <span class="tag">${escHtml(l.status)}</span>
        </div>
        <div class="record-card-meta">${escHtml(p.company_name ?? '--')} · ${escHtml(p.source ?? '--')}</div>
      </div>
      <div class="record-card-side">
        <span class="record-card-stat">${daysAgo(l.created_at)} ago</span>
        <button class="btn-text" onclick="toggleLegacyLeadExpand('${l.id}')">${isExpanded ? 'Close' : 'View'}</button>
      </div>
    </div>
    ${isExpanded ? renderLegacyLeadHistoryPanel(l) : ''}
    `
  }).join('')
}

function renderLegacyLeadHistoryPanel(l) {
  const p = l.payload ?? {}
  return `
  <div class="contact-manage-panel">
    <div class="lead-history-grid">
      <span class="cm-label">Contact</span><span>${escHtml(p.contact_name ?? '--')}</span>
      <span class="cm-label">Company</span><span>${escHtml(p.company_name ?? '--')}</span>
      <span class="cm-label">Source</span><span>${escHtml(p.source ?? '--')}</span>
      <span class="cm-label">Status</span><span>${escHtml(l.status)}</span>
      <span class="cm-label">Created</span><span>${formatDate(l.created_at)}</span>
    </div>
    <div>
      <span class="cm-label">Notes</span>
      <div class="lead-history-notes">${escHtml(p.notes) || '--'}</div>
    </div>
  </div>`
}

window.toggleLegacyLeadExpand = (id) => {
  expandedLegacyLeadId = expandedLegacyLeadId === id ? null : id
  renderLegacyLeadsList()
}

// ── Leads (live) / Contacts ─────────────────────────────────────────────────
// Two filtered views over the same Contact record type, not two separate
// things (2026-08-13 restructure). Leads = status Unqualified or Parked;
// Contacts = status Qualified, the graduated roster. One shared fetch
// (loadContactsData), one shared cache (contactsCache), one generic row
// renderer (renderContactGrid) called once per view with a different
// status predicate - a status change (Qualify/Park/Unqualify) moves a
// record from one grid to the other on the very next render, since both
// come from the same underlying data.
//
// Qualify/Park/Unqualified are direct row actions (renderContactRowActions
// below), not the old 3-chip Manage picker - that picker is gone. Qualify
// attempts the transition immediately; Park always routes to the Contact
// detail page (contact-detail.js), since it now needs a mandatory reason,
// too much for an inline row form. "Manage" survives only for + Create
// (Qualified only) and Delete.
let contactsCache = []
let accountsCache = []
let industriesCache = []
let leadsMineOnly = false
let contactsMineOnly = false

document.getElementById('live-leads-mine-toggle').addEventListener('click', () => {
  leadsMineOnly = !leadsMineOnly
  document.getElementById('live-leads-mine-toggle').textContent = `Mine: ${leadsMineOnly ? 'On' : 'Off'}`
  renderBothContactGrids()
})
document.getElementById('contacts-mine-toggle').addEventListener('click', () => {
  contactsMineOnly = !contactsMineOnly
  document.getElementById('contacts-mine-toggle').textContent = `Mine: ${contactsMineOnly ? 'On' : 'Off'}`
  renderBothContactGrids()
})

// Accounts/industries are re-fetched on every load, not cached across
// calls - a Contact saved via "+ New account" needs the new account to
// show up in the very next render, and this list is small enough in this
// dev-stage app that the extra round trip isn't worth a staleness bug.
//
// contactsLoadToken guards against a real race found during jsdom
// verification: every stage change reloads afterward, so a slow initial
// load and a fast transition-triggered reload can be in flight together,
// and without this guard whichever resolves last wins - a slower, older
// response can silently overwrite newer data
// on screen. Each call captures its own token; only the most recently
// started call is allowed to apply its result.
let contactsLoadToken = 0

async function loadContactsData() {
  const myToken = ++contactsLoadToken
  const [result, accResult, indResult] = await Promise.all([
    api('GET', '/api/contacts'),
    api('GET', '/api/accounts'),
    api('GET', '/api/industries'),
  ])
  if (myToken !== contactsLoadToken) return // a newer load has since started; drop this stale one

  if (accResult.ok) accountsCache = accResult.data
  if (indResult.ok) industriesCache = indResult.data

  if (!result.ok) {
    document.getElementById('live-leads-rows').innerHTML =
      '<p class="empty-state">Failed to load leads.</p>'
    document.getElementById('contacts-rows').innerHTML =
      '<p class="empty-state">Failed to load contacts.</p>'
    return
  }
  contactsCache = result.data
  renderBothContactGrids()
}

function renderBothContactGrids() {
  renderLeadsCards()
  renderContactGrid('contacts-rows', c => c.status === 'Qualified', contactsMineOnly, 'No contacts yet.')
}

// ── Accounts (Round 5 Phase 10, 2026-08-17) ─────────────────────────────
// Genuinely new module - no list/detail screen existed before this,
// Account was only ever reachable through pickers (Round 4's own
// investigation). List view reuses accountsCache but always refetches
// fresh on load (same "small enough in this dev-stage app, staleness
// risk isn't worth caching" reasoning loadContactsData's own comment
// above already gives for the exact same table).
async function loadAccountsList() {
  const result = await api('GET', '/api/accounts')
  if (!result.ok) {
    document.getElementById('accounts-rows').innerHTML = '<p class="empty-state">Failed to load accounts.</p>'
    return
  }
  accountsCache = result.data
  renderAccountsList(accountsCache)
}

function renderAccountsList(accounts) {
  const el = document.getElementById('accounts-rows')
  if (!accounts.length) {
    el.innerHTML = '<p class="empty-state">No accounts yet.</p>'
    return
  }
  // Parent Account name resolution: a plain client-side lookup against
  // this same already-fetched list - every Parent Account is itself a
  // real Account, so it's always present in the same array, no second
  // fetch needed.
  const byId = {}
  for (const a of accounts) byId[a.id] = a
  const sorted = [...accounts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  el.innerHTML = sorted.map(a => {
    const p = a.payload ?? {}
    const parentName = a.parent_account_id ? (byId[a.parent_account_id]?.payload?.name ?? '--') : '--'
    return `
    <div class="record-grid-row" onclick="navigate('account-detail', '${a.id}')">
      <div class="rg-name">
        <div class="rg-title">${escHtml(p.name ?? '--')}</div>
        <div class="rg-meta">${escHtml(a.reference_code || 'Not yet generated')}</div>
      </div>
      <span class="rg-combined">${escHtml(parentName)}</span>
      <span class="rg-combined">${formatDate(a.created_at)}</span>
    </div>`
  }).join('')
}

// "+ New Account" - a minimal, single-field prompt (see index.html's own
// comment on #new-account-modal for why this stays lightweight rather
// than duplicating the full Account Details field set again) - creates
// via the same real POST /api/accounts Round 4 already built and proved,
// then navigates straight to the new Account's own detail page to fill
// in everything else via click-to-edit.
function openNewAccountModal() {
  document.getElementById('new-account-name').value = ''
  document.getElementById('new-account-error').classList.add('hidden')
  document.getElementById('new-account-modal').classList.remove('hidden')
  document.getElementById('new-account-name').focus()
}
function closeNewAccountModal() {
  document.getElementById('new-account-modal').classList.add('hidden')
}
async function saveNewAccount() {
  const name = document.getElementById('new-account-name').value.trim()
  const errEl = document.getElementById('new-account-error')
  errEl.classList.add('hidden')
  if (!name) {
    errEl.textContent = 'Account Name is required.'
    errEl.classList.remove('hidden')
    return
  }
  const result = await api('POST', '/api/accounts', { name })
  if (!result.ok) {
    errEl.textContent = result.data?.error ?? 'Failed to create Account.'
    errEl.classList.remove('hidden')
    return
  }
  closeNewAccountModal()
  navigate('account-detail', result.data.id)
}
document.getElementById('btn-new-account').addEventListener('click', openNewAccountModal)
document.getElementById('new-account-cancel').addEventListener('click', closeNewAccountModal)
document.getElementById('new-account-modal').addEventListener('click', (e) => {
  if (e.target.id === 'new-account-modal') closeNewAccountModal()
})
document.getElementById('new-account-save').addEventListener('click', saveNewAccount)
document.getElementById('btn-back-account-detail').addEventListener('click', () => navigate('accounts'))

// Shared core of the Add Note mechanism (2026-08-14): just the write,
// into the same real notes array every note-producing action already
// uses (field-edit saves, Park, and now this). Deliberately not the
// whole mechanism end to end - the list card (many rows, needs to find
// its own input via the clicked button, refreshes via loadContactsData)
// and the detail page's onCdAddNoteClick (one singleton input by id,
// refreshes via loadContactDetail) run in genuinely different DOM
// contexts and need different refresh targets, so each keeps its own
// thin wrapper around this one real write.
async function addContactNote(contactId, text, existingNotes) {
  const note = {
    text,
    at: new Date().toISOString(),
    by: currentSession?.user?.email ?? '',
  }
  return api('PATCH', `/api/contacts/${contactId}`, {
    payload: { notes: [note, ...(existingNotes ?? [])] }
  })
}

// Leads: the prototype's real card layout (Terminus_Ops_dc.html:414-472,
// the meta line built the same way at its leadRows mapping, line 10664:
// [jobRole, industry, country].filter(Boolean).join(' · ')), split out
// of renderContactGrid (2026-08-14) so Contacts' own grid layout and
// actions below stay completely unchanged - this is Leads-only.
//
// No Qualify/Park/Manage cluster here anymore (2026-08-14, confirmed):
// those are detail-page-only actions now, this list is for tracking and
// note-taking. The whole card navigates to the detail page on click;
// the notes block (.record-card-divider) stops that click from bubbling
// via its own stopPropagation, so typing a note or clicking Add Note
// never navigates away - tested explicitly via a real click+type+Add
// Note sequence, then a separate click elsewhere on the same card.
//
// notes.slice(0, 2) is correct without a reverse: every note-writing
// path (saveCdFields, onCdAddNoteClick, Park) unshifts the newest note
// to the front, so payload.notes is already newest-first - same
// assumption renderCdNotes already makes on the detail page.
//
// Add Note is the same click-to-edit-in-place mechanism as the detail
// page (2026-08-14, reversed the earlier decision to keep this list's
// mechanism separate - confirmed deliberate now, not an oversight),
// positioned above the two rendered notes rather than beside a "Notes
// History" label this card doesn't have: idle/open-empty-disabled/
// open-dirty-green, same three states, same .ref-field-edit/.dirty
// green underline, same .ref-field-discard. No global open-state
// variable like the detail page's cdNoteOpen - this list renders many
// cards at once, so state is read directly off each card's own DOM
// (wrap.classList.contains('hidden')) rather than tracked separately
// per card. No explicit reset-on-render function needed either
// (unlike the detail page's resetCdNoteInput): renderLeadsCards()
// already rebuilds every card's HTML from scratch on every call, so
// idle is just what a fresh render produces.
function renderLeadsCards() {
  const container = document.getElementById('live-leads-rows')
  const rows = filterMine(contactsCache.filter(c => c.status !== 'Qualified'), leadsMineOnly)
  if (!rows.length) {
    container.innerHTML = `<p class="empty-state">${leadsMineOnly ? 'None owned by you.' : 'No leads.'}</p>`
    return
  }

  container.innerHTML = rows.map(c => {
    const p = c.payload ?? {}
    const account = accountsCache.find(a => a.id === c.parent_record_id)
    const companyDisplay = account?.payload?.name ?? p.company ?? '--'
    const industry = industriesCache.find(i => i.id === c.industry_id)
    const line2 = [companyDisplay, ...[p.jobRole, industry?.name, p.country].filter(Boolean)].join(' · ')
    const line3 = `${p.email ?? '--'} · source ${p.source ?? '--'} · created ${formatDate(c.created_at)}`
    const notes = (p.notes ?? []).slice(0, 2)

    return `
    <div class="record-card record-card-tall is-clickable" onclick="navigate('contact-detail', '${c.id}')">
      <div class="record-card-main">
        <div class="record-card-title-row">
          <span class="record-card-title">${escHtml(p.name ?? '--')}</span>
          <span class="tag">${escHtml(c.status)}</span>
        </div>
        <div class="record-card-meta">${escHtml(line2)}</div>
        <div class="record-card-meta-faint">${escHtml(line3)}</div>
        <div class="ref-notes-text" style="margin-top:10px">${escHtml(p.summary) || 'No summary captured yet.'}</div>

        <div class="record-card-divider" onclick="event.stopPropagation()">
          <button class="btn-sm lead-add-note-btn" onclick="onLeadAddNoteClick(this, '${c.id}')">Add Note</button>
          <div class="ref-field-edit hidden lead-note-input-wrap" style="margin-top:10px">
            <input type="text" class="lead-note-input" placeholder="Record an interaction or update">
            <span class="ref-field-discard" onclick="discardLeadNote(this)">&times;</span>
          </div>
          ${notes.length ? notes.map(n => `
            <div class="ref-notes-row" style="margin-top:10px">
              <span class="ref-notes-when">${formatDateTime(n.at)}</span><span class="ref-notes-author">${escHtml(n.by ?? '--')}</span><span class="ref-notes-text">${escHtml(n.text)}</span>
            </div>`).join('') : '<p class="empty-state" style="margin-top:10px">No notes yet.</p>'}
        </div>
      </div>
    </div>`
  }).join('')
}

window.onLeadAddNoteClick = async function (btn, contactId) {
  const card = btn.closest('.record-card')
  const wrap = card.querySelector('.lead-note-input-wrap')
  const input = card.querySelector('.lead-note-input')

  if (wrap.classList.contains('hidden')) {
    wrap.classList.remove('hidden')
    input.focus()
    btn.disabled = true
    return
  }

  const text = input.value.trim()
  if (!text) return

  const contact = contactsCache.find(c => c.id === contactId)
  const result = await addContactNote(contactId, text, contact?.payload?.notes)
  if (!result.ok) return

  await loadContactsData()
}

window.discardLeadNote = function (discardEl) {
  const card = discardEl.closest('.record-card')
  const wrap = card.querySelector('.lead-note-input-wrap')
  const input = card.querySelector('.lead-note-input')
  const btn = card.querySelector('.lead-add-note-btn')
  input.value = ''
  wrap.classList.add('hidden')
  wrap.classList.remove('dirty')
  btn.disabled = false
  btn.classList.remove('btn-primary')
}

// Delegated, not a per-card addEventListener: renderLeadsCards() fully
// regenerates every card's HTML on each render, so any listener
// attached directly to a .lead-note-input would be gone the next time
// that card re-renders. One listener on the static container catches
// every current and future card's input events via bubbling.
document.getElementById('live-leads-rows').addEventListener('input', (e) => {
  if (!e.target.matches('.lead-note-input')) return
  const card = e.target.closest('.record-card')
  const wrap = card.querySelector('.lead-note-input-wrap')
  const btn = card.querySelector('.lead-add-note-btn')
  const text = e.target.value.trim()
  btn.disabled = !text
  btn.classList.toggle('btn-primary', !!text)
  wrap.classList.toggle('dirty', !!text)
})

// Discrepancy from the prototype's Contacts spec, flagged: Job Role has no
// backing field anywhere in the Contact schema built this session -
// rendered as -- rather than inventing one this pass. Company/Account is
// rendered as a single line, not the prototype's two-line company+account
// cell: the prototype assumed two distinct data sources (a free-text
// company plus a linked account), but this Contact model only ever has
// one - the Account, via parent_record_id.
function renderContactGrid(containerId, statusPredicate, mineOnly, emptyLabel) {
  const container = document.getElementById(containerId)
  const rows = filterMine(contactsCache.filter(statusPredicate), mineOnly)
  if (!rows.length) {
    container.innerHTML = `<p class="empty-state">${mineOnly ? 'None owned by you.' : emptyLabel}</p>`
    return
  }

  container.innerHTML = rows.map(c => {
    const p = c.payload ?? {}
    // Once linked, the real Account's name is authoritative and takes
    // over display everywhere - the free-text company (as typed at fast
    // lead entry) is the fallback until then, never the other way round.
    const account = accountsCache.find(a => a.id === c.parent_record_id)
    const companyDisplay = account?.payload?.name ?? p.company ?? '--'
    const industry = industriesCache.find(i => i.id === c.industry_id)
    return `
    <div class="contact-grid-row" style="cursor:pointer" onclick="navigate('contact-detail', '${c.id}')">
      <div class="contact-row-name">
        <div class="rg-title">${escHtml(p.name ?? '--')}</div>
      </div>
      ${renderContactCountCell(c)}
      <span>${escHtml(companyDisplay)}</span>
      <span>${escHtml(industry?.name ?? '--')}</span>
      <span>${escHtml(p.jobRole ?? '--')}</span>
      <span>${escHtml(p.email ?? '--')}</span>
      <span>${escHtml(p.source ?? '--')}</span>
      <div class="contact-row-actions">${renderContactRowActions(c)}</div>
    </div>
    ${contactCreateFeedback[c.id] ? `<div class="contact-create-feedback-row" onclick="event.stopPropagation()">${contactCreateFeedback[c.id]}</div>` : ''}
    `
  }).join('')
}

// Test Bed/Opportunity counts (2026-08-15) - real record_contacts links
// (contact.linked_test_beds/linked_opportunities, populated by GET
// /api/contacts, matched on (record_id, contact_id) regardless of role),
// not derived client-side. Zero counts render as plain, non-clickable
// text - nothing to show. Non-zero counts show an inline hover preview
// (2026-08-16, Phase 5) rather than opening the shared named-record list
// modal on click - the modal is still used elsewhere (the pre-create
// warning, openLinkedRecordsModal) but a full dialog is heavier than this
// list needs for a quick peek.
//
// The popup is always in the DOM (class="hidden" by default) and toggled
// via plain classList, NOT via a JS state variable + renderBothContactGrids()
// re-render - tried that first and found a real bug: replacing the
// hovered element's own DOM node mid-hover (which innerHTML-based
// re-rendering always does) confuses the browser's mouseenter/mouseleave
// tracking, since those events are edge-triggered against element
// identity. Verified via Puppeteer with instrumented handlers: mouseenter
// fired twice in a loop and mouseleave never fired at all, leaving the
// popup stuck open. Toggling a class on a stable, never-replaced node
// avoids the problem entirely. The wrapper (contact-count-hover)
// contains both the label and the popup, so moving from one into the
// other never counts as leaving.
function renderContactCountCell(c) {
  const tb = c.linked_test_beds ?? []
  const opp = c.linked_opportunities ?? []
  const tbLabel = `${tb.length} Test Bed${tb.length === 1 ? '' : 's'}`
  const oppLabel = `${opp.length} Opportunit${opp.length === 1 ? 'y' : 'ies'}`
  const tbSpan = tb.length ? renderContactCountHover('test_bed', tb, tbLabel) : `<span class="count-zero">${tbLabel}</span>`
  const oppSpan = opp.length ? renderContactCountHover('opportunity', opp, oppLabel) : `<span class="count-zero">${oppLabel}</span>`
  return `<div class="contact-count-cell">${tbSpan}${oppSpan}</div>`
}

function renderContactCountHover(type, records, label) {
  return `
  <span class="contact-count-hover" onmouseenter="event.stopPropagation();this.querySelector('.contact-count-popup').classList.remove('hidden')" onmouseleave="event.stopPropagation();this.querySelector('.contact-count-popup').classList.add('hidden')">
    <span class="count-link">${label}</span>
    ${renderContactCountPopup(records, type)}
  </span>`
}

function renderContactCountPopup(records, type) {
  const view = type === 'test_bed' ? 'test-bed-detail' : 'opportunity-detail'
  const items = records.map(r => `
    <div class="linked-record-row" onclick="event.stopPropagation();navigate('${view}', '${r.id}')">
      <span>${escHtml(r.name || 'Untitled')}</span>
    </div>`).join('')
  return `<div class="contact-count-popup hidden">${items}</div>`
}

// Qualify/Park/Unqualified moved to the detail page only (2026-08-14) -
// this list is for tracking and note-taking now, not stage actions.
// renderContactRowActions is Contacts-only (Leads has its own
// renderLeadsCards above), so c.status is always 'Qualified' here - the
// old isQualified branch this used to guard + Create with is dead in
// this caller and was removed (2026-08-16, Phase 5) along with it.
//
// + Create is now a hover-triggered dropdown, matching the prototype's
// own Contacts row exactly (Terminus Ops.dc.html:303-311), not the old
// click-triggered "Manage" popup. Same always-in-DOM-toggle-a-class
// approach as the count preview above, for the same reason (see the
// comment there) - a state variable + full re-render on hover replaces
// the hovered node itself and breaks mouseleave. The wrapper
// (contact-create-hover) contains both the trigger label and the
// dropdown, so moving from one into the other never counts as leaving.
// Delete stays a plain click, same as the prototype's separate ✕.
let contactCreateFeedback = {} // contactId -> feedback HTML | null

function renderContactRowActions(c) {
  return `
  <span class="contact-create-hover" onmouseenter="event.stopPropagation();this.querySelector('.contact-create-dropdown').classList.remove('hidden')" onmouseleave="event.stopPropagation();this.querySelector('.contact-create-dropdown').classList.add('hidden')">
    <span class="contact-create-trigger">+ Create</span>
    <div class="contact-create-dropdown hidden" onclick="event.stopPropagation()">
      <div class="contact-create-item" onclick="this.closest('.contact-create-dropdown').classList.add('hidden');onContactCreateClick('${c.id}', 'test-bed')">Test Bed</div>
      <div class="contact-create-item" onclick="this.closest('.contact-create-dropdown').classList.add('hidden');onContactCreateClick('${c.id}', 'opportunity')">Opportunity</div>
    </div>
  </span>
  <button class="btn-text" onclick="event.stopPropagation();deleteContact('${c.id}')">✕</button>
  `
}

window.onContactCreateClick = (id, type) => {
  createFromContact(id, type)
}

// Pre-create warning - narrowed (2026-08-16, applied symmetrically to
// both Test Bed and Opportunity per Phase 1's own "applies symmetrically
// to both initialLead and customerLead" precedent) to genuinely check
// the origin-contact field, not any record_contacts link regardless of
// role. The check exists to avoid a duplicate record for the same
// ORIGINATING contact, which is what Client Lead (initialLead) /
// customerLead represent - a Contact who merely holds some buyer role on
// an unrelated record isn't that, and used to trigger this warning
// anyway (the old c.linked_test_beds/linked_opportunities check, still
// used unchanged by the Records column's hover preview below - Phase 5,
// deliberately not touched here, matches on (record_id, contact_id)
// regardless of role by design, a different job than this warning's).
//
// Neither origin-contact field has a record_contacts role of its own to
// filter by - the row written at creation is always role 'commercial
// buyer' regardless (contacts.js's linkContact default), so the only
// reliable signal is a direct match against the record's own
// initialLead/customerLead string against this contact's current name,
// same value it was copied from at creation. Always a fresh fetch, not
// testBedsCache/opportunitiesCache - neither is guaranteed populated
// here, only once its own list has been visited. Fails open (no
// warning) on a fetch error - a courtesy check, not a hard block, so a
// network hiccup shouldn't stop a legitimate create.
window.createFromContact = async (id, type) => {
  const c = contactsCache.find(cc => cc.id === id)
  const recordType = type === 'opportunity' ? 'opportunity' : 'test_bed'
  const contactName = c?.payload?.name ?? ''

  let existing = []
  if (contactName) {
    const path = recordType === 'opportunity' ? '/api/opportunities' : '/api/test-beds'
    const leadKey = recordType === 'opportunity' ? 'customerLead' : 'initialLead'
    const result = await api('GET', path)
    const records = result.ok ? result.data : []
    existing = records
      .filter(r => (r.payload?.[leadKey] ?? '') === contactName)
      .map(r => ({ id: r.id, name: r.payload?.name || r.reference_code || 'Untitled' }))
  }

  if (existing.length) {
    const name = c?.payload?.name || 'This contact'
    openLinkedRecordsModal({
      heading: `${name} already linked to`,
      records: existing,
      type: recordType,
      // Round 3 Phase 2 (2026-08-17): Opportunity only, per that round's
      // brief scope. Round 5 Phase 2 (2026-08-17): Test Bed's own label
      // renamed from 'Add Another' to 'Add New', its own brief's explicit
      // instruction, done alongside the naming-distinguishing fix since
      // 'Add Another' implied "another one just like it," which is
      // exactly the behaviour this phase corrects.
      proceedLabel: recordType === 'opportunity' ? 'Create New Opportunity' : 'Add New',
      // Round 10 Phase 1: for a Test Bed the warning is still the first
      // decision ("you already have one, still want another?"), and the
      // name dialogue is the second. Kept as two steps rather than merged
      // because the warning is shared with Opportunity and folding a Test
      // Bed-only field into it would fork a shared mechanism.
      onProceed: () => startCreateFromContact(id, type),
    })
    return
  }

  startCreateFromContact(id, type)
}

// Round 21 Phase 8: BOTH now go through the name dialogue.
//
// Opportunity used to create directly, and the server filled the name in
// from the Account, so every Opportunity for one Account got the same name.
// The dialogue was already here and already correct for Test Bed; what was
// missing was asking.
//
// The Test Bed path is unchanged in behaviour. The dialogue is parameterised
// by type rather than copied, and its ids, handlers, focus trap and Escape
// owner are the same ones Test Bed has used since Round 10.
async function startCreateFromContact(id, type) {
  await openNewRecordModal(id, type === 'test-bed' ? 'test-bed' : 'opportunity')
}

let ntbContactId = null
let ntbKeydownHandler = null
// Which record type the shared name dialogue is currently creating.
let ntbType = 'test-bed'

// Parameterised by type, Round 21 Phase 8. Test Bed's behaviour is unchanged:
// same element ids, same handlers, same focus trap, same Escape owner, and
// the same suggested-name endpoint. Only the three strings differ.
async function openNewRecordModal(contactId, type) {
  ntbType = type
  const isBed = type === 'test-bed'
  document.getElementById('new-test-bed-heading').textContent = isBed ? 'New Test Bed' : 'New Opportunity'
  document.getElementById('new-test-bed-label').textContent = isBed ? 'Test Bed name' : 'Opportunity name'
  document.getElementById('new-test-bed-save').textContent = isBed ? 'Create Test Bed' : 'Create Opportunity'
  document.getElementById('new-test-bed-sub').textContent = isBed
    ? 'Name this Test Bed. The suggested name is based on the Account, and can be replaced.'
    : 'Name this Opportunity. The suggested name is based on the Account, and should be replaced: '
      + 'an Account usually has more than one Opportunity, and identical names make the pipeline list unreadable.'
  ntbContactId = contactId
  const modal = document.getElementById('new-test-bed-modal')
  const input = document.getElementById('new-test-bed-name')
  const err = document.getElementById('new-test-bed-error')
  err.classList.add('hidden')
  input.value = ''
  input.placeholder = 'Loading suggested name...'
  modal.classList.remove('hidden')

  // The default is the server's, computed by the same function the create
  // endpoint itself uses, so what is offered is by construction what would
  // otherwise have been applied.
  const result = await api('GET', `/api/contacts/${contactId}/test-bed-name-suggestion`)
  if (ntbContactId !== contactId) return // dialogue closed or reopened meanwhile
  if (result.ok) {
    input.value = result.data.suggestedName ?? ''
    input.placeholder = ''
  } else {
    input.placeholder = ''
    err.textContent = result.data?.error ?? 'Could not load a suggested name. Type one to continue.'
    err.classList.remove('hidden')
  }
  input.focus()
  input.select()

  ntbKeydownHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeNewTestBedModal(); return }
    if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); saveNewTestBed(); return }
    if (e.key !== 'Tab') return
    const focusable = [...modal.querySelectorAll('input, button')].filter(el => el.offsetParent !== null && !el.disabled)
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  document.addEventListener('keydown', ntbKeydownHandler)
}

function closeNewTestBedModal() {
  document.getElementById('new-test-bed-modal').classList.add('hidden')
  if (ntbKeydownHandler) { document.removeEventListener('keydown', ntbKeydownHandler); ntbKeydownHandler = null }
  ntbContactId = null
}

async function saveNewTestBed() {
  if (!ntbContactId) return
  const input = document.getElementById('new-test-bed-name')
  const err = document.getElementById('new-test-bed-error')
  const name = input.value.trim()
  if (!name) {
    err.textContent = ntbType === 'test-bed' ? 'Enter a name for this Test Bed.' : 'Enter a name for this Opportunity.'
    err.classList.remove('hidden')
    input.focus()
    return
  }
  const btn = document.getElementById('new-test-bed-save')
  btn.disabled = true
  const original = btn.textContent
  btn.textContent = 'Creating...'
  const contactId = ntbContactId
  const type = ntbType
  try {
    await performCreateFromContact(contactId, type, name)
  } finally {
    btn.disabled = false
    btn.textContent = original
  }
}

document.getElementById('new-test-bed-cancel').addEventListener('click', closeNewTestBedModal)
document.getElementById('new-test-bed-save').addEventListener('click', saveNewTestBed)
document.getElementById('new-test-bed-modal').addEventListener('click', (e) => {
  if (e.target.id === 'new-test-bed-modal') closeNewTestBedModal()
})

// Writes into contactCreateFeedback + a full re-render, not a direct DOM
// write (2026-08-16, Phase 5) - the old feedback div lived inside the
// click-toggled Manage popup, which stayed open until dismissed; the new
// + Create dropdown is hover-only and closes the moment the mouse leaves
// it (already closed by the time this async call resolves), so the
// result needs to persist in state and render as its own row under the
// contact, independent of hover state.
async function performCreateFromContact(id, type, name) {
  const path = type === 'opportunity' ? `/api/contacts/${id}/create-opportunity` : `/api/contacts/${id}/create-test-bed`
  // Always sends a name. The Opportunity route now requires one, and the
  // Test Bed route already did; the old `name ? {name} : undefined` was what
  // let an Opportunity be created with none at all.
  const result = await api('POST', path, { name })

  // A failed create must leave the dialogue OPEN with the reason on it -
  // closing first would strand the user on the list with a message they
  // did not see fail.
  if (!result.ok) {
    const err = document.getElementById('new-test-bed-error')
    if (name && err && !document.getElementById('new-test-bed-modal').classList.contains('hidden')) {
      err.textContent = result.data?.error ?? 'Failed to create Test Bed.'
      err.classList.remove('hidden')
      return
    }
    contactCreateFeedback[id] = `<p class="msg-error">${escHtml(result.data.error ?? 'Failed to create record.')}</p>`
    renderBothContactGrids()
    return
  }
  closeNewTestBedModal()
  contactCreateFeedback[id] = null
  renderBothContactGrids()

  // Round 3 Phase 2 (2026-08-17): Opportunity navigates straight to the new
  // record's detail page rather than leaving the user on the Contacts list
  // with a manual "View it" link. Applies to both the path that goes through
  // the linked-records warning above and the plain first-Opportunity path
  // (they share this one function) - there's no reason the same create action
  // should behave differently depending on whether a warning happened to fire
  // first. Test Bed was untouched, the brief scoped that round to Opportunity
  // only.
  //
  // Round 14 Phase 4 (2026-08-20): Test Bed now does the same, on the same
  // reasoning: the user has just named it and the next thing they do is fill
  // it in. THIS CLOSES A STATED GAP RATHER THAN BUILDING ON A GUESS. Round 14
  // Phase 0 drove the Opportunity path on a clean Contact and confirmed it
  // still lands on view-opportunity-detail, so the precedent being followed
  // was verified rather than assumed. Round 6 Phase 2 once found a brief
  // citing a precedent removed three rounds earlier, which is why that check
  // ran before this line was written.
  //
  // The naming dialogue is already closed above, so nothing is left sitting
  // over the detail screen. The "Created. View it" feedback row is gone: a
  // link to a page you have just been taken to is a control with nothing to
  // do.
  navigate(type === 'opportunity' ? 'opportunity-detail' : 'test-bed-detail', result.data.id)
}

// Not routed through openDiscardConfirm (2026-08-15 check): that dialog's
// heading/button text ("Discard unsaved changes?" / "Keep editing" /
// "Discard") is hardcoded in index.html for the unsaved-edits case it
// was built for (Park, New Lead, contact-detail's guarded actions) and
// has no way to interpolate a record name - reusing it here would either
// misword the prompt or require changing it everywhere else it's used.
// Built as its own dialog instead, same mechanics (focus trap, Escape,
// backdrop-click cancels) as openDiscardConfirm, not duplicated logic
// bolted onto it.
window.deleteContact = (id) => {
  const c = contactsCache.find(cc => cc.id === id)
  const name = c?.payload?.name ?? 'this contact'
  openConfirmDelete(name, async () => {
    const result = await api('DELETE', `/api/contacts/${id}`)
    if (!result.ok) return
    await loadContactsData()
  })
}

let confirmDeleteCallback = null
let confirmDeleteKeydownHandler = null

function openConfirmDelete(name, onConfirm) {
  confirmDeleteCallback = onConfirm
  document.getElementById('confirm-delete-name').textContent = name
  document.getElementById('confirm-delete-modal').classList.remove('hidden')
  document.getElementById('confirm-delete-cancel').focus()

  confirmDeleteKeydownHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeConfirmDelete()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = [document.getElementById('confirm-delete-cancel'), document.getElementById('confirm-delete-confirm')]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', confirmDeleteKeydownHandler)
}

function closeConfirmDelete() {
  document.getElementById('confirm-delete-modal').classList.add('hidden')
  if (confirmDeleteKeydownHandler) {
    document.removeEventListener('keydown', confirmDeleteKeydownHandler)
    confirmDeleteKeydownHandler = null
  }
  confirmDeleteCallback = null
}

document.getElementById('confirm-delete-cancel').addEventListener('click', closeConfirmDelete)
document.getElementById('confirm-delete-confirm').addEventListener('click', () => {
  const callback = confirmDeleteCallback
  closeConfirmDelete()
  if (callback) callback()
})
document.getElementById('confirm-delete-modal').addEventListener('click', (e) => {
  if (e.target.id === 'confirm-delete-modal') closeConfirmDelete()
})

// ── Linked-records modal (2026-08-15) ────────────────────────────────────
// Shared by the Contacts list's count-click (view mode, just a Close
// button) and the pre-create warning (proceed mode, Cancel/proceed-label
// buttons) - same list-rendering, same focus-trap/Escape/backdrop
// mechanics as confirm-delete/discard-confirm, but its own dialog rather
// than repurposing either, same reasoning as why confirm-delete didn't
// reuse discard-confirm: the wording and button set genuinely differ.
function renderLinkedRecordsList(records, type) {
  if (!records.length) return '<p class="empty-state">None yet.</p>'
  const view = type === 'test_bed' ? 'test-bed-detail' : 'opportunity-detail'
  return records.map(r => `
    <div class="linked-record-row" onclick="closeLinkedRecordsModal();navigate('${view}', '${r.id}')">
      <span>${escHtml(r.name || 'Untitled')}</span>
    </div>`).join('')
}

let linkedRecordsCallback = null
let linkedRecordsKeydownHandler = null

// opts: { heading, records, type, proceedLabel, onProceed }. onProceed
// present -> warning mode (Cancel + proceed button); absent -> view mode
// (just Close).
function openLinkedRecordsModal(opts) {
  linkedRecordsCallback = opts.onProceed ?? null
  document.getElementById('linked-records-heading').textContent = opts.heading
  document.getElementById('linked-records-list').innerHTML = renderLinkedRecordsList(opts.records, opts.type)

  const cancelBtn = document.getElementById('linked-records-cancel')
  const proceedBtn = document.getElementById('linked-records-proceed')
  const closeBtn = document.getElementById('linked-records-close')

  if (opts.onProceed) {
    cancelBtn.classList.remove('hidden')
    proceedBtn.classList.remove('hidden')
    proceedBtn.textContent = opts.proceedLabel ?? 'Proceed anyway'
    closeBtn.classList.add('hidden')
  } else {
    cancelBtn.classList.add('hidden')
    proceedBtn.classList.add('hidden')
    closeBtn.classList.remove('hidden')
  }

  document.getElementById('linked-records-modal').classList.remove('hidden')
  ;(opts.onProceed ? cancelBtn : closeBtn).focus()

  linkedRecordsKeydownHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeLinkedRecordsModal()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = [cancelBtn, proceedBtn, closeBtn].filter(el => !el.classList.contains('hidden'))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', linkedRecordsKeydownHandler)
}

function closeLinkedRecordsModal() {
  document.getElementById('linked-records-modal').classList.add('hidden')
  if (linkedRecordsKeydownHandler) {
    document.removeEventListener('keydown', linkedRecordsKeydownHandler)
    linkedRecordsKeydownHandler = null
  }
  linkedRecordsCallback = null
}

document.getElementById('linked-records-cancel').addEventListener('click', closeLinkedRecordsModal)
document.getElementById('linked-records-close').addEventListener('click', closeLinkedRecordsModal)
document.getElementById('linked-records-proceed').addEventListener('click', () => {
  const callback = linkedRecordsCallback
  closeLinkedRecordsModal()
  if (callback) callback()
})
document.getElementById('linked-records-modal').addEventListener('click', (e) => {
  if (e.target.id === 'linked-records-modal') closeLinkedRecordsModal()
})

// ── Shared discard-confirmation dialog ──────────────────────────────────
// One dialog (2026-08-13), used by both New Lead (below) and Park
// (contact-detail.js, loaded after this file, same global scope) for
// Cancel/the close X/Escape while dirty - distinct from backdrop-click's
// own refuse-and-nudge guard (INTERACTION_STANDARDS.md Section 5):
// backdrop-click is accidental, refused outright; these three are
// intentional leave actions, so they get a real choice instead. Defined
// here, not duplicated in contact-detail.js, the strongest guarantee
// both modals can't drift apart on this.
let discardConfirmCallback = null
let discardConfirmKeydownHandler = null

function openDiscardConfirm(onDiscard) {
  discardConfirmCallback = onDiscard
  document.getElementById('discard-confirm-modal').classList.remove('hidden')
  document.getElementById('discard-confirm-keep').focus()

  discardConfirmKeydownHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeDiscardConfirm()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = [document.getElementById('discard-confirm-keep'), document.getElementById('discard-confirm-discard')]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', discardConfirmKeydownHandler)
}

function closeDiscardConfirm() {
  document.getElementById('discard-confirm-modal').classList.add('hidden')
  if (discardConfirmKeydownHandler) {
    document.removeEventListener('keydown', discardConfirmKeydownHandler)
    discardConfirmKeydownHandler = null
  }
  discardConfirmCallback = null
}

document.getElementById('discard-confirm-keep').addEventListener('click', closeDiscardConfirm)
document.getElementById('discard-confirm-discard').addEventListener('click', () => {
  const callback = discardConfirmCallback
  closeDiscardConfirm()
  if (callback) callback()
})
// Clicking this dialog's own backdrop maps to Keep editing, same as
// Escape - never a dead click, never Discard from an ambiguous input.
document.getElementById('discard-confirm-modal').addEventListener('click', (e) => {
  if (e.target.id === 'discard-confirm-modal') closeDiscardConfirm()
})

function discardConfirmIsOpen() {
  return !document.getElementById('discard-confirm-modal').classList.contains('hidden')
}

// ── New Lead modal ───────────────────────────────────────────────────────
// Same focus-trap pattern as Park's popup (contact-detail.js:
// cdParkKeydownHandler), plus click-outside-to-close, matching the real
// prototype's backdrop onClick (Terminus Ops.dc.html:4855) - Park
// doesn't have this, confirmed not to retrofit it there in this same
// pass, a separate follow-up. newLeadKeydownHandler is tracked the same
// way, so a handler left attached from a previous open doesn't stack.
let newLeadKeydownHandler = null

// Neither backdrop-click nor Cancel/the close X/Escape may silently
// discard unsaved data (2026-08-13) - a real, contained instance of
// INTERACTION_STANDARDS.md Section 5's deferred unsaved-changes spec,
// same discipline as Park's focus trap being a small slice of Section 4
// rather than the whole system-wide version. Tracked via one delegated
// input/change listener on the panel (catches every text input,
// textarea, and select via bubbling), not per-field. The two guards are
// deliberately different, not the same mechanism reused: backdrop-click
// is an accidental dismissal, refused outright (highlight + warning,
// stays open). Cancel/X/Escape are intentional leave actions, so they
// get a real choice instead, via the shared discard-confirmation dialog
// above - Discard (closes for real) or Keep editing (returns here,
// nothing lost).
let newLeadDirty = false
document.querySelector('#new-contact-form .modal-panel').addEventListener('input', () => { newLeadDirty = true })
document.querySelector('#new-contact-form .modal-panel').addEventListener('change', () => { newLeadDirty = true })

function clearNewLeadUnsavedWarning() {
  document.getElementById('btn-save-contact').classList.remove('btn-attention')
  document.getElementById('contact-form-unsaved-warning').classList.add('hidden')
}

async function openNewLeadModal() {
  newLeadDirty = false
  document.getElementById('new-contact-form').classList.remove('hidden')
  await populateContactFormPickers()
  document.getElementById('contact-name').focus()

  newLeadKeydownHandler = (e) => {
    // Inert while the discard-confirmation dialog is stacked on top -
    // its own keydown handler owns Tab/Escape until it closes, or a
    // single Escape press could fire both handlers in the same tick.
    if (discardConfirmIsOpen()) return
    if (e.key === 'Escape') {
      e.preventDefault()
      requestCloseNewLeadModal()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = [...document.querySelectorAll('#new-contact-form .modal-panel input, #new-contact-form .modal-panel select, #new-contact-form .modal-panel textarea, #new-contact-form .modal-panel button')]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', newLeadKeydownHandler)
}

// Cancel/the close X/Escape all route through here: a real choice when
// dirty (the shared discard-confirmation dialog), immediate close when
// clean, unchanged from before.
function requestCloseNewLeadModal() {
  if (newLeadDirty) {
    openDiscardConfirm(closeNewLeadModal)
    return
  }
  closeNewLeadModal()
}

function closeNewLeadModal() {
  document.getElementById('new-contact-form').classList.add('hidden')
  if (newLeadKeydownHandler) {
    document.removeEventListener('keydown', newLeadKeydownHandler)
    newLeadKeydownHandler = null
  }
  clearContactForm()
  document.getElementById('btn-new-contact').focus()
}

document.getElementById('btn-new-contact').addEventListener('click', openNewLeadModal)
document.getElementById('contact-country').addEventListener('input', (e) => {
  const region = regionForCountry(e.target.value)
  if (region) document.getElementById('contact-region').value = region
})
document.getElementById('btn-cancel-contact').addEventListener('click', requestCloseNewLeadModal)
document.getElementById('btn-close-new-contact').addEventListener('click', requestCloseNewLeadModal)
document.getElementById('new-contact-form').addEventListener('click', (e) => {
  if (e.target.id !== 'new-contact-form') return
  if (newLeadDirty) {
    document.getElementById('btn-save-contact').classList.add('btn-attention')
    document.getElementById('contact-form-unsaved-warning').classList.remove('hidden')
    // Guarantees Save + the warning are actually visible, not just
    // "shown" somewhere off-screen if the user was scrolled elsewhere
    // in the panel when they clicked outside.
    document.querySelector('#new-contact-form .form-actions').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  closeNewLeadModal()
})
document.getElementById('btn-save-contact').addEventListener('click', saveContact)

// Company is plain free text here (2026-08-13 correction) - no Account
// picker at fast lead entry. Only Industry still needs a real picklist.
// Round 4 Phase 5 (2026-08-17): Company also gets a lightweight <datalist>
// of existing Account names, suggestion only - the field itself is
// unchanged, still a plain text input, no id is ever attached to what's
// typed. Reuses accountsCache as-is (already fresh, loadContactsData()
// refetches it on every Leads page load, same reasoning that cache
// already documents for why it isn't cached across calls here) - no new
// fetch, matching the "no new search endpoint" precedent already set by
// Contact detail's own Account search.
async function populateContactFormPickers() {
  if (!industriesCache.length) {
    const indResult = await api('GET', '/api/industries')
    if (indResult.ok) industriesCache = indResult.data
  }

  document.getElementById('contact-industry').innerHTML = '<option value="">Select industry</option>' +
    industriesCache.map(i => `<option value="${i.id}">${escHtml(i.name)}</option>`).join('')

  document.getElementById('contact-company-list').innerHTML =
    accountsCache.map(a => `<option value="${escHtml(a.payload?.name ?? '')}">`).join('')
}

async function saveContact() {
  const errEl = document.getElementById('contact-form-error')
  errEl.classList.add('hidden')
  // Clicking Save is acting on the unsaved-changes warning, whether the
  // save itself goes on to succeed or fail - if it fails, the red
  // validation error above is the relevant message now, not this one.
  clearNewLeadUnsavedWarning()

  const name = document.getElementById('contact-name').value.trim()
  const company = document.getElementById('contact-company').value.trim()
  const industry_id = document.getElementById('contact-industry').value
  const email = document.getElementById('contact-email').value.trim()
  const mobile = document.getElementById('contact-mobile').value.trim()
  const jobRole = document.getElementById('contact-jobrole').value.trim()
  const linkedin = document.getElementById('contact-linkedin').value.trim()
  const address = document.getElementById('contact-address').value.trim()
  const address2 = document.getElementById('contact-address2').value.trim()
  const city = document.getElementById('contact-city').value.trim()
  const postcode = document.getElementById('contact-postcode').value.trim()
  const country = document.getElementById('contact-country').value.trim()
  const region = document.getElementById('contact-region').value
  const source = document.getElementById('contact-source').value
  const summary = document.getElementById('contact-summary').value.trim()
  const notes = document.getElementById('contact-notes').value.trim()

  // name/company/industry/email/mobile/source are mandatory here. The
  // first five are leadMandatoryFields; Source is a confirmed deliberate
  // departure from that list (2026-08-13 business decision), not a drift.
  // Everything else below is sent only if filled in, since it's optional
  // at creation and only mandatory at qualification (leadQualifyRequired).
  // The real Account link (parent_record_id) isn't part of this form at
  // all - that's resolved later via "Link to Account" on the detail page.
  const body = { name, company, email, mobile, industry_id, source }
  if (jobRole) body.jobRole = jobRole
  if (linkedin) body.linkedin = linkedin
  if (address) body.address = address
  if (address2) body.address2 = address2
  if (city) body.city = city
  if (postcode) body.postcode = postcode
  if (country) body.country = country
  if (region) body.region = region
  if (summary) body.summary = summary
  if (notes) body.notes = notes

  const result = await api('POST', '/api/contacts', body)
  if (!result.ok) {
    errEl.textContent = result.data.error ? `Missing or invalid: ${(result.data.missing ?? []).join(', ') || result.data.error}` : 'Failed to save contact.'
    errEl.classList.remove('hidden')
    return
  }

  closeNewLeadModal()
  loadContactsData()
}

function clearContactForm() {
  ;[
    'contact-name', 'contact-company', 'contact-email', 'contact-mobile', 'contact-summary', 'contact-notes',
    'contact-jobrole', 'contact-linkedin', 'contact-address', 'contact-address2', 'contact-city', 'contact-postcode', 'contact-country',
  ].forEach(id => (document.getElementById(id).value = ''))
  ;['contact-industry', 'contact-source', 'contact-region'].forEach(id => (document.getElementById(id).value = ''))
  const errEl = document.getElementById('contact-form-error')
  errEl.textContent = ''
  errEl.classList.add('hidden')
  newLeadDirty = false
  clearNewLeadUnsavedWarning()
}

// ── Test Beds ─────────────────────────────────────────────────────────────────
// No standalone creation form (removed Milestone 4) - account_id is a hard
// precondition (Milestone 3) with no Account picker built here; creation
// only happens from a Qualified Contact via createFromContact().
let testBedsCache = []
let testBedsMineOnly = false
let tbSortKey = 'created_at'
let tbSortDir = 'desc'
let tbStagesCache = [] // [{stage_name, sort_order, phase}], set once per loadTestBeds()

// Round 9 Phase 6.3: the DETAIL view's own stage list. tbStagesCache is
// populated by loadTestBeds(), the LIST view, so it is empty whenever a
// Test Bed is opened without passing through the list - a direct link, or
// the "View it" button after creating one. Reading it from the stage-tab
// loader made the terminal-stage check silently inert on exactly those
// paths. renderTestBedDetail already fetches the stages it needs for the
// chevron strip and the Next Stage button; this holds on to that result
// instead of fetching a third time.
let tbDetailStages = []

async function loadTestBeds() {
  const [result] = await Promise.all([
    api('GET', '/api/test-beds'),
    industriesCache.length ? Promise.resolve() : api('GET', '/api/industries').then(r => { if (r.ok) industriesCache = r.data }),
  ])
  tbStagesCache = await fetchStages('test_bed')

  if (!result.ok) {
    document.getElementById('testbeds-tbody').innerHTML =
      `<tr><td colspan="10" class="empty-state">Failed to load test beds.</td></tr>`
    return
  }
  testBedsCache = result.data
  renderTestBedMatrices(filterMine(testBedsCache, testBedsMineOnly))
  renderTestBedsTable(filterMine(testBedsCache, testBedsMineOnly))
}

document.getElementById('testbeds-mine-toggle').addEventListener('click', () => {
  testBedsMineOnly = !testBedsMineOnly
  document.getElementById('testbeds-mine-toggle').textContent = `Mine: ${testBedsMineOnly ? 'On' : 'Off'}`
  renderTestBedMatrices(filterMine(testBedsCache, testBedsMineOnly))
  renderTestBedsTable(filterMine(testBedsCache, testBedsMineOnly))
})

// Same 5-region set as test-bed-detail.js's own REGION_OPTIONS
// (duplicated rather than cross-file referenced, same convention that
// file already uses for contact-detail.js's region list - see its own
// comment there).
const TB_MATRIX_REGIONS = ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa']

// Filter applied to the list below by clicking the matrices (2026-08-16,
// same day, added after Phase 6's first pass): { status?, industry_name?,
// region?, label }. A row label click filters by that row's own
// dimension only; a region header click filters by region only; a cell
// number click combines both (the row's dimension AND that column's
// region) - the combined case is the one the required test evidence
// exercises. Independent of testBedsMineOnly - both apply together in
// renderTestBedsTable.
let tbFilter = null

function applyTbFilter(beds) {
  if (!tbFilter) return beds
  return beds.filter(b => {
    if (tbFilter.status != null && (b.status ?? '') !== tbFilter.status) return false
    if (tbFilter.industry_name != null && (b.industry_name ?? '') !== tbFilter.industry_name) return false
    if (tbFilter.region != null && (b.payload?.region ?? '') !== tbFilter.region) return false
    return true
  })
}

window.setTbFilter = function (filter) {
  tbFilter = filter
  renderTestBedsTable(filterMine(testBedsCache, testBedsMineOnly))
  document.getElementById('tb-filter-bar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
window.clearTbFilter = function () {
  tbFilter = null
  renderTestBedsTable(filterMine(testBedsCache, testBedsMineOnly))
}

// Two summary matrices (2026-08-16, Phase 6), matching the prototype's
// own Test Beds list panels exactly (Terminus Ops.dc.html:603-269 area,
// "Test beds by status, by region" / "Test beds by industry, by
// region"). Hover-to-preview on cells (see the Phase 5 count-hover
// comment for why popup visibility is a classList toggle on an
// always-in-DOM node, never a JS state variable + re-render - the same
// mouseenter/mouseleave bug applies here). Click-to-filter on row
// labels, region headers, and individual cells filters the list below
// via tbFilter above - added same-day after the first Phase 6 pass, at
// explicit request, going beyond the prototype's own row/region-only
// click (which never combines both dimensions) since the required test
// evidence specifically needs a single cell's exact combination.
function renderTestBedMatrices(beds) {
  const container = document.getElementById('tb-matrices')
  if (!container) return

  const stageRows = tbStagesCache.length
    ? tbStagesCache.slice().sort((a, b) => a.sort_order - b.sort_order).map(s => ({ key: s.stage_name, label: s.stage_name }))
    : [...new Set(beds.map(b => b.status).filter(Boolean))].sort().map(s => ({ key: s, label: s }))

  const industryRows = industriesCache.slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(i => ({ key: i.name, label: i.name }))
    .filter(row => beds.some(b => (b.industry_name ?? '') === row.key))

  container.innerHTML = `
    <div class="pg-card">
      <div class="pg-card-title">Test beds by stage, by region</div>
      ${renderTbMatrix(beds, stageRows, b => b.status ?? '', 'status')}
    </div>
    <div class="pg-card">
      <div class="pg-card-title">Test beds by industry, by region</div>
      ${renderTbMatrix(beds, industryRows, b => b.industry_name ?? '', 'industry_name')}
    </div>
  `
}

function renderTbMatrix(beds, rowDefs, rowKeyFn, dimensionKey) {
  if (!rowDefs.length) return '<p class="empty-state">No test beds yet.</p>'

  // onclick attributes below are single-quote-delimited so a direct
  // JSON.stringify(...) interpolation (double-quoted JS string values)
  // never collides with the attribute delimiter - same convention
  // contact-detail.js's linkCdAccount call already uses. Filter objects
  // carry the raw, unescaped label text; escaping happens once, only
  // when the filter bar actually renders it as HTML (renderTestBedsTable
  // below) - escaping here too would double-escape it there.
  const header = `
  <div class="tb-matrix-row tb-matrix-head">
    <div></div>
    ${TB_MATRIX_REGIONS.map(r => `
      <div class="tb-matrix-region-head" title="${escHtml(r)}" onclick='setTbFilter(${JSON.stringify({ region: r, label: `Region: ${r}` })})'>${escHtml(r)}</div>`).join('')}
    <div class="tb-matrix-tot-head">Tot</div>
  </div>`

  const rows = rowDefs.map(rowDef => {
    const rowMatches = beds.filter(b => rowKeyFn(b) === rowDef.key)
    const rowFilter = { [dimensionKey]: rowDef.key, label: rowDef.label }
    const cells = TB_MATRIX_REGIONS.map(region => {
      const matches = rowMatches.filter(b => (b.payload?.region ?? '') === region)
      const cellFilter = { [dimensionKey]: rowDef.key, region, label: `${rowDef.label} · Region: ${region}` }
      return renderTbMatrixCell(matches, false, cellFilter)
    }).join('')
    return `
    <div class="tb-matrix-row">
      <div class="tb-matrix-row-label" title="${escHtml(rowDef.label)}" onclick='setTbFilter(${JSON.stringify(rowFilter)})'>${escHtml(rowDef.label)}</div>
      ${cells}
      ${renderTbMatrixCell(rowMatches, true, rowFilter)}
    </div>`
  }).join('')

  return `<div class="tb-matrix">${header}${rows}</div>`
}

function renderTbMatrixCell(matches, isTotal, filter) {
  const cls = isTotal ? 'tb-matrix-tot' : 'tb-matrix-cell'
  if (!matches.length) return `<div class="${cls} tb-matrix-cell-zero">0</div>`
  // Handlers sit on the wrapper (contains both the number and the
  // popup), not the number span alone - same fix as Phase 5's count
  // hover, for the same reason: attaching to the inner element only
  // fires mouseleave the instant the pointer moves down into the popup,
  // since the popup is a sibling, not a descendant, of the number span.
  // Total column's popup anchors right instead of centered (same
  // distinction the prototype itself makes, :211 vs :198) - it's the
  // rightmost track, so a centered popup would overflow the card.
  const popupCls = isTotal ? 'tb-matrix-popup tb-matrix-popup-right' : 'tb-matrix-popup'
  return `
  <span class="tb-matrix-hover" onmouseenter="event.stopPropagation();this.querySelector('.tb-matrix-popup').classList.remove('hidden')" onmouseleave="event.stopPropagation();this.querySelector('.tb-matrix-popup').classList.add('hidden')">
    <span class="${cls}" onclick='event.stopPropagation();setTbFilter(${JSON.stringify(filter)})'>${matches.length}</span>
    <div class="${popupCls} hidden">
      ${matches.map(b => `
        <div class="linked-record-row" onclick="event.stopPropagation();navigate('test-bed-detail', '${b.id}')">
          <span>${escHtml(b.payload?.name || b.reference_code || 'Untitled')}</span>
        </div>`).join('')}
    </div>
  </span>`
}

document.querySelectorAll('#view-test-beds th[data-tb-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.tbSort
    if (tbSortKey === key) {
      tbSortDir = tbSortDir === 'asc' ? 'desc' : 'asc'
    } else {
      tbSortKey = key
      tbSortDir = 'asc'
    }
    renderTestBedsTable(filterMine(testBedsCache, testBedsMineOnly))
  })
})

function tbSortValue(b, key) {
  const p = b.payload ?? {}
  switch (key) {
    case 'reference_code': return (b.reference_code ?? '').toLowerCase()
    case 'name': return (p.name ?? '').toLowerCase()
    case 'account_name': return (b.account_name ?? '').toLowerCase()
    case 'city': return (p.city ?? '').toLowerCase()
    case 'region': return (p.region ?? '').toLowerCase()
    case 'status': return (b.status ?? '').toLowerCase()
    case 'terminus_lead': return (p.terminusLead ?? '').toLowerCase()
    case 'client_lead': return (p.initialLead ?? '').toLowerCase()
    case 'indicative_cost': return Number(p.indicativeCost ?? 0)
    case 'created_at': return b.created_at
    default: return ''
  }
}

function renderTestBedsTable(unfilteredBeds) {
  document.querySelectorAll('#view-test-beds th[data-tb-sort]').forEach(th => {
    th.classList.toggle('sort-active', th.dataset.tbSort === tbSortKey)
    const base = th.textContent.replace(/ [▲▼]$/, '')
    th.textContent = th.dataset.tbSort === tbSortKey ? `${base} ${tbSortDir === 'asc' ? '▲' : '▼'}` : base
  })

  const filterBar = document.getElementById('tb-filter-bar')
  if (tbFilter) {
    const beds = applyTbFilter(unfilteredBeds)
    filterBar.innerHTML = `
      <span>Showing ${beds.length} test bed${beds.length === 1 ? '' : 's'} matching <strong>${escHtml(tbFilter.label)}</strong></span>
      <button class="btn-text" onclick="clearTbFilter()">Clear filter</button>
    `
    filterBar.classList.remove('hidden')
  } else {
    filterBar.innerHTML = ''
    filterBar.classList.add('hidden')
  }

  const beds = applyTbFilter(unfilteredBeds)
  const tbody = document.getElementById('testbeds-tbody')
  if (!beds.length) {
    const message = tbFilter
      ? 'No test beds match this filter.'
      : (testBedsMineOnly ? 'No test beds owned by you.' : 'No test beds yet.')
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state">${message}</td></tr>`
    return
  }

  const sorted = [...beds].sort((a, b) => {
    const av = tbSortValue(a, tbSortKey)
    const bv = tbSortValue(b, tbSortKey)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return tbSortDir === 'asc' ? cmp : -cmp
  })

  // Field set is Phase 6's (2026-08-16): Reference, Test Bed Name,
  // Company, City, Region, Stage, Terminus Lead, Client Lead, Estimated
  // Cost, Created. Company is the linked Account's name (b.account_name,
  // same source the old "Account" column used, just relabeled). Client
  // Lead is Test Bed's own initialLead field (the origin-contact field
  // carried from Phase 1) - the brief's list-column name for it, same
  // field the detail page still calls "Initial Lead". Estimated Cost is
  // indicativeCost, same source and format the old "Indicative Cost"
  // column used. City is a real writable Site Details field (2026-08-16
  // correction - a derive-from-Site-Address heuristic was tried first and
  // found unreliable for non-UK address formats, removed entirely rather
  // than kept as a fallback) - existing Test Beds show an honest blank
  // until someone fills it in, never guessed.
  tbody.innerHTML = sorted.map(b => {
    const p = b.payload ?? {}
    return `
    <tr onclick="navigate('test-bed-detail', '${b.id}')">
      <td class="col-mono">${escHtml(b.reference_code ?? '--')}</td>
      <td class="col-name">${escHtml(p.name ?? '--')}</td>
      <td>${escHtml(b.account_name ?? '--')}</td>
      <td>${escHtml(p.city ?? '--')}</td>
      <td>${escHtml(p.region ?? '--')}</td>
      <td class="col-stage">${escHtml(b.status)}</td>
      <td>${escHtml(p.terminusLead ?? '--')}</td>
      <td>${escHtml(p.initialLead ?? '--')}</td>
      <td class="col-mono">${formatCost(p.indicativeCost)}</td>
      <td class="col-mono">${formatDate(b.created_at)}</td>
    </tr>`
  }).join('')
}

// ── Test Bed detail ───────────────────────────────────────────────────────────
let currentTestBed = null

async function loadTestBedDetail(id) {
  // Round 12 Phase 1: no longer resets tbUserPickedTab. Twelve of this
  // function's thirteen call sites are in-app saves and only navigate() is an
  // arrival. The flag is consumed HERE, before the GET can fail.
  tbArrivingFresh = tbFreshNavigation
  tbFreshNavigation = false
  // Round 17A Phase 4.2: arriving at the view is the other way the thing the
  // message was about goes away. navigate() is the only setter of this flag,
  // so no save path can reach this branch and wipe its own report.
  if (tbArrivingFresh && typeof clearTbSaveFeedback === 'function') clearTbSaveFeedback()
  const result = await api('GET', `/api/test-beds/${id}`)
  if (!result.ok) {
    document.getElementById('tb-detail-name').textContent = 'Not found'
    return
  }
  currentTestBed = result.data
  // Round 17 Phase 4: unit counts are loaded once per detail load and used by
  // both tabs, Commercials to know which counts are locked and the units view
  // to render them. A READ, deliberately: the derive control is the only
  // thing that writes.
  if (typeof window.loadTbUnitCounts === 'function') await window.loadTbUnitCounts(id)
  await renderTestBedDetail(currentTestBed)
}

// Round 7 Phase 5: Summary and the last 2 notes, latest first, filling
// the space to the right of the Test Bed name.
//
// Notes reuse the shared pattern from DESIGN_PRINCIPLES.md Rule 10 -
// timestamp, then author, then text, via .ref-notes-row /
// .ref-notes-when / .ref-notes-author / .ref-notes-text - the same
// markup the Reference tab and every other note list in the app uses.
// Deliberately not a compact header-only variant: Rule 10 exists so a
// note reads identically wherever it appears.
//
// Each block is hidden outright when it has nothing to show, rather
// than rendering an empty container. A record with no notes and a
// record with one note both have to look deliberate.
// Round 8 Phase 5: Notes shows the 2 most recent by default, with an
// expand control revealing the genuine full history. A default view, not
// a truncation - the full record stays reachable from this header, which
// was the explicit requirement.
// Round 10 Phase 2 (2026-08-19): the header renders SUMMARY ONLY. Notes
// moved to the bottom of the Reference tab, where it now carries the
// two-most-recent default and the expansion control this function used to
// own. tbHeaderNotesExpanded / toggleTbHeaderNotes are gone with it - the
// state belongs next to the thing it controls, and keeping a header copy
// would have meant two renderers of the same list, which is exactly how
// the ordering defect below survived unnoticed.
// Round 10A Phase 1 (2026-08-19): this function is gone, and its removal is
// the point rather than a tidy-up.
//
// It rebuilt #tb-header-summary's innerHTML on every render, which is why
// the header instance could only ever be a read-only copy: an editable
// control inside it would have been destroyed, along with anything typed
// into it, on every save-triggered reload. The Summary control is now
// STATIC markup in index.html and is populated by initTestBedDetailPanel
// exactly like every other click-to-edit field, so the open-edit capture
// and restore that already runs across reloads covers it for free.
//
// Nothing replaces this call. renderTestBedDetail no longer touches the
// header summary at all.


async function renderTestBedDetail(bed) {
  const p = bed.payload ?? {}

  document.getElementById('tb-detail-name').textContent = p.name ?? '--'
  document.getElementById('tb-detail-client').textContent = p.client_organisation ?? ''

  // Round 7 Phase 5. The four stat-strip writes that used to sit here
  // (stage, accumulated cost, age, reference code) are gone with the
  // strip itself - every value already had a home and was duplicated
  // there. Age was the exception and now renders in Key Dates on the
  // Reference tab. Removing the markup without removing these lines
  // would have thrown on a null element on every Test Bed open.

  const stages = await fetchStages('test_bed')
  tbDetailStages = stages
  renderChevronStrip('tb-chevron-strip', bed.status, stages)
  wireTbChevronHover(bed.id)
  markTbCurrentStageTab(bed.status)

  await loadTerminusStaffIfNeeded()
  // Round 10 Phase 6: land on the stage just entered, if this load followed
  // a transition. Read and cleared here so a later unrelated load cannot
  // inherit it.
  //
  // THE FINAL TRANSITION IS THE EXCEPTION, AND IT IS DELIBERATE AND
  // TEMPORARY. Closed is terminal and Round 9 Phase 6.3 made it render
  // nothing at all, so landing there today would put the operator on a
  // genuinely blank tab as the reward for completing the lifecycle. Round
  // 10 Phase 7 gives Closed a real panel; until it does, the last
  // transition lands on Reference exactly as before. Terminality is read
  // from the data (no stage after this one) rather than by matching the
  // string 'Closed', matching how loadTbStageDetailTab already decides it.
  // Round 10 Phase 7 removed Phase 6's temporary exception. Phase 6 landed
  // the FINAL transition on Reference because Closed rendered nothing and
  // arriving on a blank tab was a poor reward for completing the lifecycle.
  // Closed now shows the completed record, so every transition including the
  // last lands on the stage just entered, which is the behaviour the brief
  // asked for and the exception was only ever deferring.
  const landing = tbLandOnStageAfterLoad
  tbLandOnStageAfterLoad = null
  const fresh = tbArrivingFresh
  // Read BEFORE any switch, since switchTbTab rewrites the active class.
  const openTab = document.querySelector('#tb-detail-tabs .detail-tab.active')?.dataset.tbTab

  if (landing) {
    // Round 10 Phase 6: a transition lands on the stage just entered. This
    // is deliberate and outranks both branches below.
    switchTbTab(`stage-${landing}`)
  } else if (fresh && !tbUserPickedTab) {
    // A genuine arrival, and the user has not raced the load with a click.
    switchTbTab('reference')
  } else if (openTab) {
    // A RELOAD. Re-apply the open tab rather than leaving it alone, which
    // preserves the tab AND refreshes it: switchTbTab re-runs
    // loadTbStageDetailTab for a stage tab, so the panel shows the record as
    // it now is. Leaving the switch out entirely would keep the tab and show
    // stale content, which trades one fault for a worse one.
    switchTbTab(openTab)
  } else {
    switchTbTab('reference')
  }
  window.initTestBedDetailPanel(bed)

  // Round 5 Phase 7 (2026-08-17): renderTestBedDocuments/loadTbStageApprovals
  // (the old, always-eager calls against the fixed Documents/Approvals
  // tabs) are gone - that content is now per-stage and loaded lazily,
  // only when a given stage-* tab is actually opened
  // (loadTbStageDetailTab, switchTbTab below), not for all 8 stages on
  // every page load. renderTransitionSection stays eager - it's now
  // page-level, always visible above the tabs, not nested in a tab that
  // might never be opened.
  // Round 7 Phase 6: the Test Bed's Stage Transition section is gone; its
  // trigger is the Next Stage button in the tab row. renderTransitionSection
  // itself is NOT deleted - the Opportunity detail page still calls it
  // (loadOpportunityDetail, below) and is untouched by this phase.
  wireTbNextStageButton(bed, stages)
  wireTestBedConvertOnce()
  resetTestBedConvertForm()
}

// Round 5 Phase 8 (2026-08-17): "Next Stage" button, positioned at the
// top of the chevron - a genuinely new, more discoverable trigger for
// the exact same window.attemptTransition already proven by the Stage
// transition section below, not a second, parallel implementation of
// it. Confirmed by investigation first (git log/blame on the chevron
// component): the chevron itself has never had a click handler
// anywhere in this app's real history, so this isn't restoring
// anything, it's the first real click-to-transition entry point built
// alongside it. The fourth argument is the record kind ('test_bed'),
// which selects the landing pair attemptTransition reloads with, so this
// reloads as a Test Bed and not an Opportunity - but feedbackId is its own
// (tb-next-stage-feedback), so a blocking rejection triggered from up
// here is shown right here, not only in the section below, which could
// be scrolled out of view at the moment this button is clicked. Called
// on every render (not wired once) since the real next stage, and
// whether one exists at all, changes with the record's own status.
// Round 7 Phase 6. State the button needs is cached here because the
// button's enabled-ness depends on the OPEN TAB, which changes without a
// re-render - switchTbTab calls refreshTbNextStageButton() directly.
let tbNextStageState = null

function wireTbNextStageButton(bed, stages) {
  const currentIdx = stages.findIndex(s => s.stage_name === bed.status)
  tbNextStageState = {
    recordId: bed.id,
    currentStage: bed.status,
    nextStage: stages[currentIdx + 1]?.stage_name ?? null,
  }
  const feedback = document.getElementById('tb-next-stage-feedback')
  if (feedback) feedback.innerHTML = ''
  refreshTbNextStageButton()
}

// Confirmed business rule: stage progression happens from inside the
// stage itself, so the user must open the record's real current stage
// tab, review its criteria and approvals, and progress from there.
//
// The two disabled reasons are genuinely different and must not collapse
// into one greyed button: "final stage" is terminal and nothing the user
// does will change it, whereas "not the current stage" is a one-click
// fix. Saying only "disabled" would leave the second looking like the
// first.
function refreshTbNextStageButton() {
  const btn = document.getElementById('tb-next-stage-btn')
  if (!btn || !tbNextStageState) return
  const { recordId, currentStage, nextStage } = tbNextStageState

  // Round 8 Phase 4: the explanatory hint alongside the disabled button
  // ("Open the <stage> tab to progress") is removed - the disabled state
  // is taken as sufficient on its own.
  //
  // This reverses half of Round 7 Phase 6, which required the disabled
  // state to carry "a readable reason" distinguishing "not the current
  // stage" from "final stage". Recorded as a deliberate reversal rather
  // than an oversight. The distinction itself SURVIVES, because it was
  // never carried by the hint: it is the button's own label that changes,
  // "Final stage" versus a disabled "Next Stage". What is genuinely lost
  // is the one-line explanation of WHY the not-current-stage case is
  // disabled, which is now inferred from the tab the user is on.
  if (!nextStage) {
    btn.disabled = true
    btn.textContent = 'Final stage'
    btn.onclick = null
    return
  }

  const activeTab = document.querySelector('#tb-detail-tabs .detail-tab.active')?.dataset.tbTab
  const onCurrentStageTab = activeTab === `stage-${currentStage}`

  btn.textContent = 'Next Stage'
  if (!onCurrentStageTab) {
    btn.disabled = true
    btn.onclick = null
    return
  }

  btn.disabled = false
  // Round 22 Phase 2: the fourth argument is the record kind, and now says
  // so. It read as an element id and never was one: attemptTransition only
  // ever compared it, and no element of that id exists. This comment used to
  // carry that explanation; the parameter name carries it now.
  btn.onclick = () => attemptTransition(recordId, nextStage, 'tb-next-stage-feedback', 'test_bed', currentStage)
}

// Round 5 Phase 7 (2026-08-17): one shared panel, 8 buttons - loads
// exactly one stage's Documents+Approvals at a time, on demand. Not
// cached across switches deliberately: the underlying data (document
// statuses, approval decisions) can change from other actions on the
// same page (Send for Approval, an approval click) while this tab stays
// open, so re-fetching on every open is the same "don't show stale
// decision-relevant data" discipline this build already applies
// elsewhere, not an oversight.
//
// tbStageTabLoadToken: a real race found by testing, not assumed safe -
// clicking through the 8 tabs quickly left two loads in flight at once,
// and an older, slower response could resolve after a newer one and
// silently overwrite the panel with the WRONG stage's data (confirmed
// live: Site Assessment's tab showing Qualification's approval row,
// Installation and Commissioning's showing Pre-Site Assessment's - one
// tab "behind", not corrupted data, exactly the ordering symptom of an
// unguarded overlapping fetch). Same fix as loadContactsData()'s own
// contactsLoadToken (app.js) - each call captures its own token, only
// the most recently started call is allowed to apply its result.
let currentTbStageTab = null
let tbStageTabLoadToken = 0

// Round 10 Phase 5A step 2 (2026-08-19): the synchronous pending state.
//
// Parallelising cut the criteria panel's stale window from 2034ms to
// 1083ms, and documents sits at 649ms. Both are still long enough for a
// person to read the previous stage's documents and criteria under the new
// stage's heading, which changes at ~26ms. This closes that.
//
// THE CONTRACT, and it is what makes the panels verifiable:
//   dataset.stage  = the stage whose DATA is currently displayed.
//                    Set only when real data has rendered. Cleared while
//                    pending and on error, so it never claims a stage it
//                    is not showing.
//   dataset.pending = the stage being loaded, present only in flight.
//
// A test therefore still waits on dataset.stage, which is real state and
// cannot be satisfied by this mechanism's own side effects - waiting on
// dataset.pending would be waiting on the fix rather than on the data.
//
// Not a spinner, not a delay, not a debounce: the ordering is fixed by
// marking synchronously at the moment of the click, before any await, so
// there is no window in which stale content is presented as current. And
// it cannot become permanently-static UI, because every renderer below
// replaces it with either data or a real error message.
function markStagePanelsPending(stageName) {
  for (const id of ['tb-stage-documents-section', 'tb-stage-exit-criteria-list', 'tb-stage-approval-row']) {
    const el = document.getElementById(id)
    if (!el) continue
    el.dataset.pending = stageName
    delete el.dataset.stage
    el.innerHTML = `<p class="empty-state">Loading ${escHtml(stageName)}...</p>`
  }
}

// Sets the panel to "showing this stage's real data". Paired with the
// helper above so the two attributes can never drift apart.
function markStagePanelSettled(el, stageName) {
  if (!el) return
  delete el.dataset.pending
  el.dataset.stage = stageName
}

// The fetch failed. The panel shows an error, not this stage's data, so
// dataset.stage must NOT be set - otherwise a check waiting on it would
// pass against an error message.
function markStagePanelFailed(el) {
  if (!el) return
  delete el.dataset.pending
  delete el.dataset.stage
}

const stillCurrentTerminal = (token) => () => token === tbStageTabLoadToken

async function loadTbStageDetailTab(stageName) {
  if (!currentTestBed) return
  const myToken = ++tbStageTabLoadToken
  currentTbStageTab = stageName
  document.getElementById('tb-stage-detail-heading').textContent = stageName

  // Round 9 Phase 6.3: the Closed tab renders NOTHING. Not an empty
  // Terminus Documents card, not an empty Approvals card, nothing.
  // Closed is terminal: it has no exit gate, no documents of its own and
  // no approvals, so every panel here would be permanently empty. That is
  // consistent with the documented decision not to build the Test Bed
  // list matrices - permanently empty UI with no visible explanation is
  // worse than absent UI. Handled by which stage is terminal in the data
  // (no next stage in stage_definitions) rather than by matching the
  // string 'Closed', so a record type whose last stage is named something
  // else behaves the same way.
  // Round 10 Phase 7: fetch the stage list if neither cache holds it yet.
  // tbDetailStages is assigned partway through renderTestBedDetail, AFTER the
  // header name is written, and tbStagesCache is only ever populated by the
  // LIST view - so opening a stage tab on a direct navigation, inside that
  // window, left orderedStages empty, isTerminal false, and the Closed tab
  // rendering the ordinary stage panels instead of the completed record.
  // Round 9 Phase 6.3 hit the same shape from the other side, where the
  // terminal check "read a cache only the list view populates". Resolved by
  // making the check able to answer the question itself rather than by
  // adding another wait somewhere else.
  if (!tbDetailStages.length && !tbStagesCache.length) {
    tbDetailStages = await fetchStages('test_bed')
    if (myToken !== tbStageTabLoadToken) return
  }
  const orderedStages = (tbDetailStages.length ? tbDetailStages : tbStagesCache)
    .slice().sort((a, b) => a.sort_order - b.sort_order)
  const isTerminal = orderedStages.length > 0
    && orderedStages[orderedStages.length - 1].stage_name === stageName
  const panelsRow = document.getElementById('tb-stage-panels-row')
  if (panelsRow) panelsRow.classList.toggle('hidden', isTerminal)
  document.getElementById('tb-tab-closed')?.classList.toggle('hidden', !isTerminal)
  if (isTerminal) {
    document.getElementById('tb-stage-install-section')?.classList.add('hidden')
    // The terminal stage returns before the three fetches, so
    // renderTbStageScoring never runs here and the card would be left with no
    // dataset.stage at all. It is already hidden, with the whole panels row;
    // marking it settled for this stage completes the attribute's contract, so
    // "after a stage tab settles the card names the stage it decided for"
    // holds on all eight tabs rather than seven.
    const terminalScoringCard = document.getElementById('tb-stage-scoring-card')
    if (terminalScoringCard) terminalScoringCard.dataset.stage = stageName
    // Round 10 Phase 7: Closed shows the completed record. Supersedes Round 9
    // Phase 6.3's "renders nothing" - see the panel's own comment in
    // index.html for why this is the opposite case to an empty card.
    await renderTbClosedPanel(currentTestBed.id, stillCurrentTerminal(myToken))
    return
  }

  // Round 6 Phase 3 (2026-08-17): Installer/Test Bed Tech Team/Install
  // Notes only ever apply to the Installation and Commissioning stage -
  // a pure visibility toggle, not a re-render, the fields themselves are
  // rendered once at page load (renderTbInstallSection,
  // test-bed-detail.js) and stay mounted in the DOM the whole time, so
  // switching to a different stage tab and back can never silently lose
  // an in-progress edit here the way tearing down and rebuilding the
  // fields on every switch would.
  const isInstall = stageName === 'Installation and Commissioning'
  document.getElementById('tb-stage-install-section').classList.toggle('hidden', !isInstall)
  // Round 17 Phase 2: units render only for the stage that owns them, and
  // only once that section is visible. Deriving against a hidden section
  // would create records for a tab nobody opened.
  if (isInstall && typeof window.renderTbUnits === 'function') window.renderTbUnits()

  // Round 10 Phase 5A step 1 (2026-08-19): the three fetches run CONCURRENTLY.
  //
  // They were strictly sequential, and measured as such: documents 654ms,
  // approvals 310ms, exit-criteria 1070ms, summing to exactly the 2034ms
  // the criteria panel took to stop showing the previous stage's content.
  // The criteria panel depends on neither of the other two and was waiting
  // on both. Each panel now renders the moment its OWN request lands
  // rather than after all three, so the slowest one no longer sets the
  // floor for the other two.
  //
  // A REQUIRED correctness change came with it, not a nicety:
  // renderTbStageExitCriteria had no token guard at all. It was safe only
  // because it ran last, after two checks, so nothing could overtake it.
  // Started concurrently it can resolve after a newer tab's load and
  // overwrite the panel with the wrong stage - the exact race
  // tbStageTabLoadToken exists to prevent and which Round 5 Phase 7
  // confirmed live on the other two panels. It now takes the same
  // isStillCurrent predicate renderTestBedDocuments already used.
  const stillCurrent = () => myToken === tbStageTabLoadToken

  // Synchronous, before any await: from this instant no panel is showing
  // the previous stage's content as though it were current.
  markStagePanelsPending(stageName)
  // Round 12 Phase 2: the scoring card is hidden on the same instruction and
  // for the same reason. It is revealed only once renderTbStageScoring has
  // derived this stage's own criteria, so Pre-Site Assessment can never show
  // Qualification's five while its fetch is still in flight.
  const scoringCard = document.getElementById('tb-stage-scoring-card')
  if (scoringCard) { scoringCard.classList.add('hidden'); delete scoringCard.dataset.stage }

  const documentsDone = renderTestBedDocuments(currentTestBed, stageName, 'tb-stage-documents-section', stillCurrent)
  const criteriaDone = renderTbStageExitCriteria(stageName, stillCurrent, currentTestBed.id)
  const approvalsDone = renderTbStageApprovals(stageName, stillCurrent)

  // Belt and braces on the same requirement: api() no longer rejects, but
  // any unexpected throw in a renderer must still not leave a panel stuck
  // on its pending marker. Only the current load may clear it, or a stale
  // failure would wipe a newer load's state.
  try {
    await Promise.all([documentsDone, criteriaDone, approvalsDone])
  } catch (err) {
    if (!stillCurrent()) return
    for (const id of ['tb-stage-documents-section', 'tb-stage-exit-criteria-list', 'tb-stage-approval-row']) {
      const el = document.getElementById(id)
      if (!el || !el.dataset.pending) continue
      el.innerHTML = '<p class="empty-state">Could not load this stage. Reopen the tab to retry.</p>'
      markStagePanelFailed(el)
    }
  }
}

// Extracted from loadTbStageDetailTab so all three panels are started the
// same way and each can render on its own response. Behaviour is unchanged.
async function renderTbStageApprovals(stageName, isStillCurrent = () => true) {
  const approvalsResult = await api('GET', `/api/records/${currentTestBed.id}/stage-approvals`)
  if (!isStillCurrent()) return
  const row = document.getElementById('tb-stage-approval-row')
  if (!approvalsResult.ok) {
    row.innerHTML = '<p class="empty-state">Failed to load approvals for this stage.</p>'
    markStagePanelFailed(row)
    return
  } else {
    const stageEntry = approvalsResult.data.find(s => s.stage_name === stageName)
    // Round 9 Phase 6.2: CONFIRMED BEFORE CHANGING, and left alone.
    // buildStageTracks (records.js) derives this list from the stage's own
    // approval_obtained rules, not from approval_tracks, so the panel was
    // already scoped correctly: Qualification returns Technical and
    // Commercial, Pre-Site Assessment returns Commercial and Legal, Site
    // Assessment returns three, Closed returns none. Nothing to fix.
    //
    // What DID change is the surrounding markup. The panel used to carry a
    // Stage / Exit criteria / Approvers header, which made sense on
    // Opportunity's all-stages table and made none here, where the panel
    // shows exactly one stage and sits next to a dedicated Exit Criteria
    // panel repeating the same text. The tracks are rendered directly.
    row.innerHTML = stageEntry
      ? buildStageTrackListHtml(currentTestBed.id, stageEntry)
      : '<p class="empty-state">Unknown stage.</p>'
  }
  markStagePanelSettled(row, stageName)
}


// stageName/docsContainerId/refContainerId (Round 5 Phase 7, 2026-08-17):
// generalized from a fixed-tab, current-stage-only renderer to one that
// can show any named stage's own Documents into any container - the one
// call site is now loadTbStageDetailTab, one shared panel reused per
// stage-* tab, not 8 static ones. ?stage=stageName threads through to
// the now-parameterized GET /test-beds/:id/document-requirements
// (test-beds.js) - defaults to the record's own current stage
// server-side if omitted, but this caller always passes it explicitly.
// isStillCurrent (optional): a real race found by testing, not assumed
// safe - fast tab switches leave two of these calls in flight at once,
// and without this check the OLDER response can resolve after the newer
// one and silently overwrite the shared panel with the wrong stage's
// documents, confirmed live. Checked immediately after the fetch, before
// any DOM write, not just by the caller afterward - by the time this
// function would otherwise write, the write itself is already stale.
async function renderTestBedDocuments(bed, stageName, docsContainerId, isStillCurrent = () => true) {
  const section = document.getElementById(docsContainerId)
  if (!section) return

  const result = await api('GET', `/api/test-beds/${bed.id}/document-requirements?stage=${encodeURIComponent(stageName)}`)
  if (!isStillCurrent()) return

  if (!result.ok) {
    section.innerHTML = '<p class="empty-state">Could not load documents.</p>'
    markStagePanelFailed(section)
    return
  }

  // Round 9 Phase 6.1: ONE panel, built from BOTH endpoint keys, which is
  // what merging the two panels actually means.
  //
  // The document LIST comes from reference_docs (stage_reference_docs),
  // the stage's configured catalogue and the authoritative answer to
  // "what documents belong to this stage". The per-document STATE -
  // status, stored URL, and whether a gate rule makes it confirmable -
  // comes from completable_documents, derived from stage_gate_rules.
  //
  // Unioned by name rather than intersected, deliberately. The two tables
  // hold document names as independent free strings with nothing aligning
  // them, a gap recorded in DESIGN_PRINCIPLES.md and only closed by the
  // Phase 7.4 invariant. Intersecting would make a mismatch INVISIBLE -
  // the document would silently vanish from the panel. A union shows it,
  // and a document listed with no Confirm control is a legible symptom of
  // exactly that misalignment.
  const refDocs = result.data.reference_docs ?? []
  const gated = result.data.completable_documents ?? []
  const gatedByName = new Map(gated.map(d => [d.document, d]))

  const names = [...refDocs.map(d => d.document_name)]
  for (const d of gated) if (!names.includes(d.document)) names.push(d.document)

  if (!names.length) {
    section.innerHTML = '<p class="empty-state">No documents configured for this stage.</p>'
    markStagePanelSettled(section, stageName)
    return
  }

  section.innerHTML = names.map(name => {
    const req = gatedByName.get(name)
    const key = tbDocKey(name)
    const isApproved = req?.current_status === 'approved'
    const statusLabel = isApproved ? 'Approved' : (req?.current_status ? 'Started' : 'Not started')
    const statusClass = isApproved ? 'doc-status--approved' : (req?.current_status ? 'doc-status--started' : 'doc-status--notstarted')
    // A document with no gate rule is catalogue-only: listed because the
    // stage owns it, but nothing about it releases a transition, so it
    // gets no Confirm control.
    const confirmHtml = !req
      ? '<span class="tb-doc-nogate">Not gated</span>'
      : isApproved
        ? ''
        : `<button class="btn-sm" onclick="confirmStageDocument('${escHtml(bed.id)}','${escHtml(name)}')">Confirm</button>`

    return `
    <div class="tb-doc-row" id="doc-row-${key}">
      <div class="tb-doc-head">
        <span class="tb-doc-name">${escHtml(name)}</span>
        <span class="doc-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="tb-doc-actions">
        <input type="text" class="tb-doc-url" id="doc-loc-${key}"
               placeholder="Document URL"
               value="${escHtml(req?.document_location ?? '')}"
               onchange="saveStageDocumentUrl('${escHtml(bed.id)}','${escHtml(name)}')">
        ${confirmHtml}
      </div>
      <div class="tb-doc-feedback" id="doc-fb-${key}"></div>
    </div>`
  }).join('')
  // Which stage this panel is currently SHOWING, not which was last
  // requested. Verification waits on this rather than on a fixed delay:
  // a fixed delay reported a working popup as broken in Round 7 Phase 9,
  // and here it would report the previous tab's contents as this tab's.
  markStagePanelSettled(section, stageName)
}

// Round 10 Phase 7 (2026-08-19): the Closed tab's single read-only panel.
//
// READ-ONLY IS STRUCTURAL, NOT COSMETIC. There is no Confirm control and no
// editable URL because the endpoint returns nothing either could act on -
// no gate rule, no required_status. A closed Test Bed's documents ARE the
// record, and altering them after closure undermines the audit trail; the
// backward transition path from Round 9 Phase 4A is how something changes,
// and it records the move as a regression.
//
// Grouped by stage in LIFECYCLE order, from stage_definitions.sort_order,
// because a flat list of nine documents loses the shape of what happened.
// A stage that produced no documents is omitted rather than shown empty.
async function renderTbClosedPanel(recordId, isStillCurrent = () => true) {
  const groupsEl = document.getElementById('tb-closed-groups')
  const subEl = document.getElementById('tb-closed-sub')
  if (!groupsEl) return
  groupsEl.dataset.pending = 'true'
  delete groupsEl.dataset.record
  groupsEl.innerHTML = '<p class="empty-state">Loading the completed record...</p>'

  const result = await api('GET', `/api/test-beds/${recordId}/lifecycle-documents`)
  if (!isStillCurrent()) return
  delete groupsEl.dataset.pending
  if (!result.ok) {
    groupsEl.innerHTML = '<p class="empty-state">Could not load the lifecycle documents.</p>'
    if (subEl) subEl.textContent = ''
    return
  }

  const { groups, total, produced } = result.data
  // Degrades honestly. A Test Bed can reach Closed with documents missing
  // via the backward transition path, so the count is stated rather than
  // implied, and a document never produced says so instead of rendering a
  // blank row that reads like a missing URL.
  if (subEl) {
    subEl.textContent = produced === total
      ? `All ${total} documents produced across the lifecycle.`
      : `${produced} of ${total} documents produced. ${total - produced} were never recorded.`
  }
  if (!groups.length) {
    groupsEl.innerHTML = '<p class="empty-state">No documents are configured for this record type.</p>'
    groupsEl.dataset.record = recordId
    return
  }

  groupsEl.innerHTML = groups.map(g => `
    <div class="tb-closed-group" data-stage="${escHtml(g.stage)}">
      <p class="tb-closed-stage">${escHtml(g.stage)}</p>
      ${g.documents.map(d => `
        <div class="tb-closed-doc${d.produced ? '' : ' tb-closed-doc-missing'}" data-document="${escHtml(d.document)}">
          <span class="tb-closed-doc-name">${escHtml(d.document)}</span>
          <span class="doc-status ${d.status === 'approved' ? 'doc-status--approved' : (d.status ? 'doc-status--started' : 'doc-status--notstarted')}">${
            d.status ? escHtml(d.status === 'approved' ? 'Approved' : d.status) : 'Not produced'}</span>
          <span class="tb-closed-doc-url">${d.document_location ? escHtml(d.document_location) : (d.produced ? 'No document URL recorded' : '')}</span>
        </div>`).join('')}
    </div>`).join('')
  groupsEl.dataset.record = recordId
}

function tbDocKey(name) { return name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '') }

async function refreshTbStagePanels() {
  if (!currentTestBed || !currentTbStageTab) return
  await renderTestBedDocuments(currentTestBed, currentTbStageTab, 'tb-stage-documents-section')
  await renderTbStageExitCriteria(currentTbStageTab, () => true, currentTestBed?.id)
}

// Round 9 Phase 6.1: saving a URL must NOT approve the document. This
// endpoint hardcoded status='approved' until this phase, so storing a
// working-copy link would have satisfied the gate - the exact failure a
// document gate exists to prevent. approve:false is why this is a
// separate call from confirmStageDocument below.
window.saveStageDocumentUrl = async (bedId, documentType) => {
  const key = tbDocKey(documentType)
  const input = document.getElementById(`doc-loc-${key}`)
  const fb = document.getElementById(`doc-fb-${key}`)
  if (!input) return
  const result = await api('POST', `/api/test-beds/${bedId}/complete-document`, {
    document_type: documentType,
    document_location: input.value.trim(),
    approve: false
  })
  if (fb) {
    fb.textContent = result.ok ? 'URL saved.' : `Could not save URL: ${result.data?.error ?? 'unknown error'}`
    fb.className = result.ok ? 'tb-doc-feedback ok' : 'tb-doc-feedback err'
  }
  if (result.ok) await refreshTbStagePanels()
}

// Confirm carries whatever is in the URL box, so an operator who pastes a
// link and confirms in one go does not lose it.
window.confirmStageDocument = async (bedId, documentType) => {
  const key = tbDocKey(documentType)
  const input = document.getElementById(`doc-loc-${key}`)
  const fb = document.getElementById(`doc-fb-${key}`)
  const body = { document_type: documentType }
  if (input && input.value.trim()) body.document_location = input.value.trim()
  const result = await api('POST', `/api/test-beds/${bedId}/complete-document`, body)
  if (!result.ok) {
    if (fb) {
      fb.textContent = `Could not confirm: ${result.data?.error ?? 'unknown error'}`
      fb.className = 'tb-doc-feedback err'
    }
    return
  }
  await refreshTbStagePanels()
  refreshTbNextStageButton()
}

// openDocumentForm / cancelDocumentForm / submitDocumentForm and the
// module-level openDocForm were removed in Round 9 Phase 6.1. They drove
// the old inline "Send for Approval" form, a second table row that
// expanded under the document. The merged panel has a permanently visible
// URL field instead, so the form, its toggle state and its three handlers
// have no markup left to act on. Their only caller was the panel that was
// replaced, confirmed by search before deleting.

// Old renderTestBedApprovals()/grantSeniorApproval() (Milestone 4,
// removed 2026-08-15): hardcoded to the 'Decommissioning' stage name,
// never checked whether an approval was already granted, and never
// reused GET /records/:id/stage-approvals at all - real stage check, but
// none of the generic display mechanism. Replaced by loadTbStageApprovals(),
// the same real pattern Opportunity's Approvals tab already used - and
// that in turn is now itself superseded (Round 5 Phase 7, 2026-08-17,
// removed): the fixed Approvals tab it targeted is gone, replaced by
// loadTbStageDetailTab()'s per-stage single-row rendering, reusing the
// same GET /records/:id/stage-approvals data and the same
// buildStageApprovalRowHtml() markup, just one row at a time instead of
// the whole list.

// Convert to Opportunity: relocated to the detail-head, top-right
// (2026-08-15 fix, see index.html) - the trigger/submit/cancel buttons
// are now static markup (not regenerated per Test Bed), wired once like
// every other static control in this file, using currentTestBed.id at
// click time instead of baking the id into inline onclick handlers.
function resetTestBedConvertForm() {
  document.getElementById('tb-convert-form-wrap').classList.add('hidden')
  document.getElementById('tb-convert-feedback').innerHTML = ''
  document.getElementById('tb-opp-name').value = ''
}

let testBedConvertWired = false
function wireTestBedConvertOnce() {
  if (testBedConvertWired) return
  testBedConvertWired = true
  document.getElementById('tb-convert-trigger').addEventListener('click', () => {
    document.getElementById('tb-convert-form-wrap').classList.remove('hidden')
  })
  document.getElementById('tb-convert-cancel').addEventListener('click', resetTestBedConvertForm)
  document.getElementById('tb-convert-submit').addEventListener('click', () => window.convertTestBed(currentTestBed.id))
}

window.convertTestBed = async (id) => {
  const opportunity_name = document.getElementById('tb-opp-name').value.trim()
  const feedback = document.getElementById('tb-convert-feedback')
  feedback.innerHTML = ''

  if (!opportunity_name) {
    feedback.innerHTML = '<p class="msg-error">Opportunity name is required.</p>'
    return
  }

  const result = await api('POST', `/api/test-beds/${id}/convert`, { opportunity_name })
  if (!result.ok) {
    feedback.innerHTML = `<p class="msg-error">${escHtml(result.data.error ?? 'Conversion failed.')}</p>`
    return
  }

  const opp = result.data
  feedback.innerHTML = `<p class="msg-success">Opportunity created. <button class="btn-text" onclick="navigate('opportunity-detail', '${opp.id}')" style="color:var(--green)">View it</button></p>`
  document.getElementById('tb-convert-form-wrap').classList.add('hidden')
}

// ── Opportunities ──────────────────────────────────────────────────────────────
let oppsCache = []
let oppsMineOnly = false

async function loadOpportunities() {
  const result = await api('GET', '/api/opportunities')
  if (!result.ok) {
    document.getElementById('opps-rows').innerHTML =
      '<p class="empty-state">Failed to load opportunities.</p>'
    return
  }
  oppsCache = result.data
  renderOpps()
}

function renderOpps() {
  const opps = filterMine(oppsCache, oppsMineOnly)
  renderOppList(opps)
  renderOppCards(opps)
}

document.getElementById('opps-mine-toggle').addEventListener('click', () => {
  oppsMineOnly = !oppsMineOnly
  document.getElementById('opps-mine-toggle').textContent = `Mine: ${oppsMineOnly ? 'On' : 'Off'}`
  renderOpps()
})

function renderOppList(opps) {
  const container = document.getElementById('opps-rows')
  if (!opps.length) {
    container.innerHTML = `<p class="empty-state">${oppsMineOnly ? 'No opportunities owned by you.' : 'No opportunities yet.'}</p>`
    return
  }

  container.innerHTML = opps.map(o => {
    const p = o.payload ?? {}
    const det = o.opportunity_details ?? {}
    const prob = det.probability_pct != null ? `${det.probability_pct}%` : '--'
    const close = det.forecast_close_date ? formatDate(det.forecast_close_date) : '--'
    return `
    <div class="record-grid-row" onclick="navigate('opportunity-detail', '${o.id}')">
      <div class="rg-name">
        <div class="rg-title">${escHtml(p.name ?? '--')}</div>
        <div class="rg-meta">${escHtml(p.company_name ?? '--')}</div>
      </div>
      <span class="tag rg-stage">${escHtml(o.status)}</span>
      <span class="rg-combined">${prob} · ${daysAgo(o.created_at)} · ${close}</span>
    </div>`
  }).join('')
}

function renderOppCards(opps) {
  const grid = document.getElementById('opp-grid')
  if (!opps.length) {
    grid.innerHTML = `<p class="empty-state">${oppsMineOnly ? 'No opportunities owned by you.' : 'No opportunities yet.'}</p>`
    return
  }

  grid.innerHTML = opps.map(o => {
    const p = o.payload ?? {}
    const det = o.opportunity_details ?? {}
    const prob = det.probability_pct != null ? `${det.probability_pct}%` : '--'
    return `
    <div class="card" onclick="navigate('opportunity-detail', '${o.id}')">
      <span class="card-name">${escHtml(p.name ?? '--')}</span>
      <div class="card-row">
        <span class="tag">${escHtml(o.status)}</span>
        <span class="card-meta">${prob}</span>
      </div>
      <div class="card-row">
        <span class="card-meta">${escHtml(p.company_name ?? '--')}</span>
        <span class="card-meta">${daysAgo(o.created_at)}</span>
      </div>
    </div>`
  }).join('')
}

document.getElementById('opp-btn-list').addEventListener('click', () => {
  document.getElementById('opp-list').classList.remove('hidden')
  document.getElementById('opp-grid').classList.add('hidden')
  document.getElementById('opp-btn-list').classList.add('active')
  document.getElementById('opp-btn-grid').classList.remove('active')
})
document.getElementById('opp-btn-grid').addEventListener('click', () => {
  document.getElementById('opp-list').classList.add('hidden')
  document.getElementById('opp-grid').classList.remove('hidden')
  document.getElementById('opp-btn-grid').classList.add('active')
  document.getElementById('opp-btn-list').classList.remove('active')
})

// ── Opportunity detail ────────────────────────────────────────────────────────
async function loadOpportunityDetail(id) {
  const result = await api('GET', `/api/opportunities/${id}`)
  if (!result.ok) {
    // ref-display-name (Round 3 Phase 3, 2026-08-17) - renamed from
    // detail-name when the header's Name became click-to-edit, now owned
    // by opportunity-reference.js's renderReferenceTab for the real render
    // path; this not-found path never reaches that, so it's set directly
    // here, same as before.
    document.getElementById('ref-display-name').textContent = 'Not found'
    return
  }
  await renderOppDetail(result.data)
}

async function renderOppDetail(opp) {
  const p = opp.payload ?? {}
  const det = opp.opportunity_details ?? {}

  // ref-display-name is set below by opportunity-reference.js's
  // renderReferenceTab (Round 3 Phase 3, 2026-08-17) - it's now the
  // click-to-edit header field, owned there like every other field, not
  // set redundantly here too.
  document.getElementById('detail-company').textContent = p.company_name ?? ''
  document.getElementById('detail-probability').textContent =
    det.probability_pct != null ? `${det.probability_pct}%` : '--'
  document.getElementById('detail-close-date').textContent = det.forecast_close_date ?? '--'
  document.getElementById('detail-testbed-cost').textContent = formatCost(det.test_bed_cost)
  document.getElementById('detail-age').textContent = daysAgo(opp.created_at)

  // Show origin tag if converted from a Test Bed
  const originTag = document.getElementById('detail-origin-tag')
  if (det.converted_from_test_bed_id) {
    originTag.innerHTML = `<span class="tag" style="cursor:pointer" onclick="navigate('test-bed-detail', '${det.converted_from_test_bed_id}')">From Test Bed</span>`
  } else {
    originTag.innerHTML = ''
  }

  const stages = await fetchStages('opportunity')
  renderChevronStrip('opp-chevron-strip', opp.status, stages)

  await loadTerminusStaffIfNeeded()

  // opportunity-deal.js (ES module, loaded after this script) owns the
  // Commercials tab — deal-calculator.js live preview + save/submit.
  window.initOpportunityDealPanel?.(opp)

  // opportunity-reference.js owns the Reference tab — click-to-edit fields,
  // Executive Summary, Notes.
  window.initOpportunityReferencePanel?.(opp)

  // The stage tabs are generated per record, from that record's own stage
  // list, BEFORE the default-to-Reference below. Generating them after would
  // mean the strip briefly shows the previous record's stages.
  // Round 21 Phase 9: assigned HERE, not in renderTransitionSection.
  //
  // Phase 3 set these inside that function, which was correct while it ran on
  // every render. Phase 5 removed its last caller together with the Stage and
  // Approvals tab and did not move the assignments, so currentOppDetailId
  // stayed null and the tick handler's guard
  //   currentOppDetailId === recordId
  // was false for every tick. The PATCH still succeeded and the database
  // still updated; only the panel never re-rendered, so a tick looked like it
  // had done nothing.
  //
  // Nothing between Phase 5 and Phase 9 ticked a criterion through the
  // browser, which is why four phases passed over a live regression. The full
  // walk is what found it.
  currentOppDetailId = opp.id
  currentOppStage = opp.status
  currentOppStages = stages ?? []
  renderOppStageTabs(stages, opp.status)
  // The record's own stage panel is filled eagerly, so the tab carrying the
  // green dot is never a blank card if the user goes straight to it.
  loadOppStageTab(opp.id, opp.status, opp.status, stages)

  // Round 22 Phase 2: read and cleared here, at the top of the landing
  // decision, mirroring where renderTestBedDetail reads its own.
  //
  // Cleared BEFORE it is acted on, so a one-shot really is one shot: if the
  // switch below throws, the next render starts from no intent rather than
  // landing again on a stage the record has since left.
  const landing = oppLandOnStageAfterLoad
  oppLandOnStageAfterLoad = null

  if (landing) {
    // A transition lands on the stage just entered, and this OUTRANKS the
    // guard rather than clearing it. oppUserPickedTab is not written anywhere
    // in this phase, which is what makes the Round 21 Phase 1 race unaffected
    // by construction: an early click during an in-flight load still sets the
    // guard, and the branch below still honours it, exactly as before.
    //
    // Terminal stages need no special case. Closed Won is an ordinary tab
    // with an ordinary key and a one-card panel, so this addresses it like
    // any other. Round 10 Phase 7 removed Test Bed's equivalent exception for
    // the same reason.
    //
    // focusTab moves focus onto the tab just landed on. Test Bed does not
    // need this: its Next Stage control lives in the tab row and survives the
    // re-render, so focus stays put. Opportunity's advance control lives
    // INSIDE the stage panel, and renderOppStageTabs destroys and rebuilds
    // every panel, so the button the user just clicked no longer exists and
    // focus falls to <body>. Measured, not assumed: document.activeElement
    // read BODY after a real click. Landing focus on the tab puts it where
    // the user now is, and that element exists synchronously at switch time
    // whereas the new advance control does not.
    switchOppTab(oppStageTabKey(landing), { focusTab: true })
  } else if (!oppUserPickedTab) {
    // Land back on Reference when opening or switching opportunities, the
    // same convention as other modules resetting their sub-view on entry,
    // UNLESS the user already picked a tab while this load was still in
    // flight.
    switchOppTab('reference')
  }
}

// ── Documents tab: deliberately just a caption + flat template-link list,
// no status tracking. There is no document-template data source anywhere
// in this app yet (Test Bed's document mechanism is stage_gate_rules +
// document_details, a different, per-stage-requirement thing, not a
// static template library) - so this renders an honest empty state
// rather than fabricated entries.
// ── Stage & Approvals tab ───────────────────────────────────────────────────
// containerId (2026-08-15, Milestone 4): generalized from Opportunity's
// original hardcoded 'opp-stage-approvals-rows' so Test Bed's Approvals
// tab can reuse this instead of forking its own copy (DESIGN_PRINCIPLES.md
// rule 5, "new modules extend, they don't fork") - this is the same real
// mechanism the brief asks Test Bed's Approvals tab to use, not a
// second, parallel implementation of it.
const stageApprovalsContainerByRecord = {}

async function loadStageApprovals(id, containerId = 'opp-stage-approvals-rows') {
  stageApprovalsContainerByRecord[id] = containerId
  const container = document.getElementById(containerId)
  // Round 21 Phase 5: the default names Opportunity's all-stages table,
  // which this round replaced with per-stage cards and removed. The default
  // is now unreachable from any live caller, and a caller that fell through
  // to it would have thrown on a null container rather than doing nothing.
  // Test Bed passes its own container and is unaffected.
  if (!container) return
  container.innerHTML = '<p class="empty-state">Loading...</p>'
  const result = await api('GET', `/api/records/${id}/stage-approvals`)
  if (!result.ok) {
    container.innerHTML = '<p class="empty-state">Failed to load stage approvals.</p>'
    return
  }
  renderStageApprovalsRows(id, result.data, containerId)
}

// Round 5 Phase 7 (2026-08-17): the single-stage row markup extracted
// into its own function, buildStageApprovalRowHtml, so Test Bed's new
// per-stage tabs (loadTbStageDetailTab below) can render exactly one
// stage's row without a second, independently-maintained copy of this
// markup - "reuse the existing Approvals mechanism," not a rebuild of
// it. renderStageApprovalsRows (the all-stages-at-once view, still used
// by Opportunity's own Stage & Approvals tab, untouched by this phase)
// now just maps this same builder over every stage.
//
// Every stage shown, not just the current one, when called from the
// all-stages view. Ring radios are real (stage_gate_rules requirements +
// approvals decisions), but there is no approval-role check anywhere in
// this app to gate WHO specifically may click one - restricted to the
// current stage only, a UX judgment call on real data (record.status),
// not a fabricated permission system.
function buildStageApprovalRowHtml(recordId, st) {
  const dotColor = st.state === 'current' ? 'var(--green)' : st.state === 'completed' ? 'var(--muted)' : 'var(--muted-2)'
  const rowOpacity = st.state === 'upcoming' ? '0.55' : '1'

  const criteriaHtml = st.criteria.length
    ? st.criteria.map(c => `<div>- ${escHtml(c)}</div>`).join('')
    : '<span class="sa-empty">--</span>'

  const approversHtml = st.tracks.length
    ? st.tracks.map(t => {
        const clickable = st.state === 'current' && !t.approved
        const rowClass = `sa-approval-row${t.approved ? ' approved' : ''}${clickable ? ' clickable' : ''}`
        const onclick = clickable ? `onclick="submitStageApproval('${recordId}','${escHtml(t.track)}')"` : ''
        const meta = t.approved
          ? `Approved ${formatDate(t.decided_at)}`
          : (st.state === 'current' ? 'Click to approve' : '')
        return `
        <div class="${rowClass}" ${onclick}>
          <span class="ring-radio-ring"><span class="ring-radio-dot"></span></span>
          <div>
            <div class="sa-approval-role">${escHtml(t.track)}</div>
            <div class="sa-approval-meta">${meta}</div>
          </div>
        </div>`
      }).join('')
    : '<span class="sa-empty">No approvals required</span>'

  return `
  <div class="sa-row" style="opacity:${rowOpacity}">
    <div class="sa-stage">
      <span class="sa-dot" style="background:${dotColor}"></span>
      <span class="sa-stage-name">${escHtml(st.stage_name)}</span>
    </div>
    <div class="sa-criteria">${criteriaHtml}</div>
    <div class="sa-approvers">${approversHtml}</div>
  </div>`
}

// Round 9 Phase 6.2: the Test Bed stage tab's own Approvals rendering.
// Deliberately a sibling of buildStageApprovalRowHtml rather than a
// change to it: that function is shared with Opportunity's all-stages
// table, which still needs its Stage and Exit criteria columns, and
// editing it to suit one caller is how two callers drift apart.
// Both still read the same GET /records/:id/stage-approvals data and the
// same clickable rule - a track is only tickable at the record's real
// current stage.
function buildStageTrackListHtml(recordId, st) {
  if (!st.tracks.length) return '<p class="empty-state">No approvals required for this stage.</p>'
  return st.tracks.map(t => {
    const clickable = st.state === 'current' && !t.approved
    const onclick = clickable ? `onclick="submitStageApproval('${recordId}','${escHtml(t.track)}')"` : ''
    const meta = t.approved
      ? `Approved ${formatDate(t.decided_at)}`
      : (st.state === 'current' ? 'Click to approve' : 'Not yet at this stage')
    return `
    <div class="sa-approval-row${t.approved ? ' approved' : ''}${clickable ? ' clickable' : ''}" ${onclick}>
      <span class="ring-radio-ring"><span class="ring-radio-dot"></span></span>
      <div>
        <div class="sa-approval-role">${escHtml(t.track)}</div>
        <div class="sa-approval-meta">${meta}</div>
      </div>
    </div>`
  }).join('')
}

function renderStageApprovalsRows(recordId, stages, containerId = 'opp-stage-approvals-rows') {
  const container = document.getElementById(containerId)
  if (!container) return
  if (!stages.length) {
    container.innerHTML = '<p class="empty-state">No stages configured for this record type.</p>'
    return
  }

  container.innerHTML = stages.map(st => buildStageApprovalRowHtml(recordId, st)).join('')
}

// Round 5 Phase 7 (2026-08-17): a real bug caught before it shipped, not
// found live - buildStageApprovalRowHtml's onclick is the one shared
// markup builder for both Opportunity's all-stages view and Test Bed's
// new single-stage view (loadTbStageDetailTab), but the refresh-on-
// success path below only ever knew about the former
// (stageApprovalsContainerByRecord, populated only by loadStageApprovals,
// which Test Bed's own path never calls). Approving from inside a Test
// Bed's stage tab would have looked up an unset containerId, defaulted
// to 'opp-stage-approvals-rows', and silently written the refreshed row
// into whatever Opportunity happened to be showing on screen instead -
// confirmed by tracing the exact default-parameter fallback, not
// guessed. Fixed by checking which view this recordId actually belongs
// to before deciding how to refresh.
// Round 10 Phase 5B (2026-08-19): an approval no longer triggers a full
// stage-tab reload.
//
// It called loadTbStageDetailTab, which re-fetches documents, approvals and
// criteria AND increments tbStageTabLoadToken as its first act - so ticking
// a second approval while the first was still reloading INVALIDATED the
// first, which then returned early and never rendered. That is Round 9
// Phase 8's "each approval triggers its own re-render while the previous
// request is still in flight", and it is why a red criteria row could sit
// beside an enabled Next Stage button.
//
// An approval can change the approvals panel and the exit criteria it may
// now satisfy. It cannot change the stage's DOCUMENTS, so that fetch is
// dropped entirely. And nothing here touches the tab load token, so a
// genuine tab switch in flight is no longer cancelled by an approval, nor
// an approval by another approval.
//
// A failed write returns without altering the row, and says so, rather
// than leaving a control that looks approved when nothing was recorded.
// Reflects one approval the server has already confirmed. Deliberately
// narrow: it marks the single track that was just recorded and touches
// nothing else, so it can never claim a state the response did not carry.
function applyConfirmedApproval(track, decidedAt) {
  const rows = [...document.querySelectorAll('#tb-stage-approval-row .sa-approval-row')]
  const row = rows.find(r => r.querySelector('.sa-approval-role')?.textContent.trim() === track)
  if (!row) return
  row.classList.add('approved')
  row.classList.remove('clickable')
  row.removeAttribute('onclick')
  const meta = row.querySelector('.sa-approval-meta')
  if (meta) meta.textContent = decidedAt ? `Approved ${formatDate(decidedAt)}` : 'Approved'
}

window.submitStageApproval = async (recordId, track) => {
  const result = await api('POST', `/api/records/${recordId}/approvals`, { track, decision: 'approved' })

  // Round 21 Phase 4: this function was written for Test Bed and every
  // branch below tests currentTestBed. Opportunity's all-stages table has
  // called it since Round 9, so an Opportunity approval POSTed successfully
  // and then matched no branch: no refresh, no error, nothing on screen.
  // Architecture rule 8, and the Opportunity stage panels would have
  // inherited it. The Opportunity path is handled first and returns.
  if (recordId === currentOppDetailId) {
    if (!result.ok) {
      const el = document.getElementById(`opp-stage-approvals-${oppStageTabKey(currentOppStageTab ?? '')}`)
      if (el) {
        let fb = el.querySelector('.opp-approval-feedback')
        if (!fb) { fb = document.createElement('div'); fb.className = 'opp-approval-feedback'; el.appendChild(fb) }
        fb.textContent = `Could not record the ${track} approval: ${result.data?.error ?? 'unknown error'}`
        fb.className = 'tb-doc-feedback opp-approval-feedback err'
      }
      return
    }
    const stage = currentOppStageTab
    if (!stage) return
    const token = ++oppStageTabLoadToken
    // Both panels: an approval can satisfy an approval_obtained criterion,
    // so the Exit Criteria card beside it is stale the moment this lands.
    await Promise.all([
      renderOppStageApprovals(recordId, stage, () => token === oppStageTabLoadToken),
      renderOppExitCriteria(`opp-stage-criteria-${oppStageTabKey(stage)}`, recordId, stage,
        nextStageAfter(currentOppStages, stage), () => token === oppStageTabLoadToken),
    ])
    return
  }

  if (!result.ok) {
    const row = document.getElementById('tb-stage-approval-row')
    if (recordId === currentTestBed?.id && row) {
      let fb = document.getElementById('tb-approval-feedback')
      if (!fb) {
        fb = document.createElement('div')
        fb.id = 'tb-approval-feedback'
        row.appendChild(fb)
      }
      fb.textContent = `Could not record the ${track} approval: ${result.data?.error ?? 'unknown error'}`
      fb.className = 'tb-doc-feedback err'
    }
    return
  }
  if (recordId === currentTestBed?.id && currentTbStageTab) {
    const stage = currentTbStageTab
    // Server-confirmed, not optimistic: POST /approvals returns the created
    // row (201) including its real decided_at, so this reflects exactly what
    // was stored rather than what was hoped for. The refresh below still
    // runs; it just no longer gates the tick.
    applyConfirmedApproval(track, result.data?.decided_at)
    await Promise.all([
      renderTbStageApprovals(stage, () => currentTbStageTab === stage),
      renderTbStageExitCriteria(stage, () => currentTbStageTab === stage, recordId),
    ])
    refreshTbNextStageButton()
  } else {
    await loadStageApprovals(recordId, stageApprovalsContainerByRecord[recordId])
  }
}

// ── Click-to-edit: reveal AND open, in one click (Round 10 Phase 0A) ─────────
//
// The defect this closes, measured in Round 10 Phase 0 rather than inferred:
// a closed click-to-edit field is a <div class="ref-field-display"> and its
// control lives in a SIBLING <div class="ref-field-edit hidden">. The open*
// handlers hide the div, unhide the sibling and call focus(). The click that
// reveals the control is therefore consumed by a DIFFERENT element, so it can
// never also open it - after the first click the <select> was revealed,
// focused, and sitting directly under the pointer having received ZERO
// pointer events. A second click was needed to open the list. Reported
// against Commercial Authority; Round 8 Phase 1 could not reproduce it, most
// likely because there is no defect in the dropdown to find.
//
// Eight controls were affected across Test Bed's Reference tab alone (5
// <select>, 2 <input type="date">), and the same four-file pattern exists on
// Opportunity, Contact and Account detail. This is ONE shared helper rather
// than four copies precisely because of the standing rule that a fix built
// for the surfaces that existed at the time is not a fix for the ones added
// after it - that shape has produced a shipped defect three separate times.
//
// showPicker() is the purpose-built API for this and requires transient user
// activation, which is why openFrom must be a genuine gesture and why the
// programmatic restore path deliberately does not pass one - restoring an
// edit after a save must not pop a picker open in the user's face.
//
// Text, number and textarea controls are left alone on purpose: focus alone
// already makes them usable, so one click genuinely works there today and a
// change would be a regression, not a fix.
// ── Shared reason-for-change dialogue (Round 11 Phase 3, 2026-08-19) ─────
//
// Lives in app.js for the same reason window.revealFieldControl does: this
// file loads first, so a helper defined here reaches every detail screen,
// and it is attached to `window` rather than declared as a top-level const
// per the recorded name-collision rule.
//
// WHAT IS SHARED IS THE INTERACTION, NOT THE STORAGE, and that split is the
// whole point of the phase. Round 3 Phase 3 built this behaviour for
// Opportunity's Est. Close Date and proved the load-bearing property
// empirically: cancelling the dialogue does NOT discard an unrelated dirty
// field edited in the same batch. That property is what is worth reusing.
// Where the reason ends up is not: Est. Close Date writes it into
// payload.notes as prose, and a score revision writes it onto the score
// entry itself. Each caller supplies its own onConfirm and this helper never
// touches storage at all.
//
// CANCEL DELIBERATELY DOES NOTHING TO THE CALLER'S STATE. It closes the
// dialogue and returns focus, and that is all. The caller's edit bar is
// still showing exactly what it showed before Save was pressed, so the user
// can correct the value, retry, or discard that one field through its own
// control. Discarding the pending change here would be the destructive
// reading of Cancel and would take unrelated edits with it.
let changeReasonState = null
let changeReasonKeydownHandler = null

// Backdrop-click cancels, wired once and permanently, the same pattern
// discard-confirm-modal and linked-records-modal already use: it only fires
// when the backdrop itself, not a child, is the click target. Escape is NOT
// wired here - it is owned by the per-open handler above, so there is exactly
// one Escape owner rather than two competing ones.
document.getElementById('change-reason-form').addEventListener('click', (e) => {
  if (e.target.id === 'change-reason-form') window.cancelChangeReason()
})

window.requestChangeReason = function (opts) {
  changeReasonState = opts

  document.getElementById('change-reason-heading').textContent = opts.heading
  document.getElementById('change-reason-context-label').textContent = opts.contextLabel
  document.getElementById('change-reason-context-value').textContent = opts.contextValue ?? '--'
  document.getElementById('change-reason-prompt').textContent = opts.promptLabel
  document.getElementById('change-reason-confirm').textContent = opts.confirmLabel
  const input = document.getElementById('change-reason-input')
  input.value = ''

  // Round 21 Phase 7: an optional PICKLIST above the free text.
  //
  // Added to this dialogue rather than built as a second one. It already
  // owns the focus trap, the Escape handling and the stays-open-on-failure
  // behaviour that INTERACTION_STANDARDS.md Section 4 requires, and a second
  // modal would be a second place for those to drift. Callers that pass no
  // choices are byte for byte unaffected: the group stays hidden and the
  // free text stays mandatory.
  //
  // When choices ARE passed the roles swap: the choice is mandatory and the
  // free text becomes optional colour alongside it.
  const choiceGroup = document.getElementById('change-reason-choice-group')
  const choiceSel = document.getElementById('change-reason-choice')
  if (opts.choices?.length) {
    document.getElementById('change-reason-choice-label').textContent = opts.choiceLabel ?? 'Reason'
    choiceSel.innerHTML = '<option value="">--</option>' +
      opts.choices.map(c => `<option value="${escHtml(c.value)}">${escHtml(c.label)}</option>`).join('')
    choiceSel.value = ''
    choiceGroup.classList.remove('hidden')
  } else {
    choiceGroup.classList.add('hidden')
    choiceSel.innerHTML = ''
  }

  // An optional line for an action that cannot be undone. Empty for the two
  // callers that predate it, so nothing appears where nothing appeared.
  const warnEl = document.getElementById('change-reason-warning')
  if (opts.warning) { warnEl.textContent = opts.warning; warnEl.classList.remove('hidden') }
  else { warnEl.textContent = ''; warnEl.classList.add('hidden') }

  document.getElementById('change-reason-error').classList.add('hidden')
  document.getElementById('change-reason-form').classList.remove('hidden')
  if (opts.choices?.length) choiceSel.focus()
  else input.focus()

  // Direct port of Park's own handler, per INTERACTION_STANDARDS.md Section
  // 4: attached on open and removed on close rather than left permanently
  // attached, since this node persists across in-app navigation. Round 3's
  // first version had two overlapping Escape owners, which was a real bug in
  // its own right; one owner, one attach, one detach.
  changeReasonKeydownHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); window.cancelChangeReason(); return }
    if (e.key !== 'Tab') return
    // The picklist joins the trap only while it is showing. Filtered rather
      // than left in as a null, because a null becomes focusable[0] and
      // Shift+Tab would call .focus() on it: a regression for the two
      // callers that pass no choices at all.
      const focusable = [
        document.getElementById('change-reason-choice-group').classList.contains('hidden')
          ? null
          : document.getElementById('change-reason-choice'),
        document.getElementById('change-reason-input'),
        document.getElementById('change-reason-cancel'),
        document.getElementById('change-reason-confirm'),
      ].filter(Boolean)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  document.addEventListener('keydown', changeReasonKeydownHandler)
}

function closeChangeReasonDialog() {
  document.getElementById('change-reason-form').classList.add('hidden')
  if (changeReasonKeydownHandler) {
    document.removeEventListener('keydown', changeReasonKeydownHandler)
    changeReasonKeydownHandler = null
  }
  const returnTo = changeReasonState?.returnFocusTo
  changeReasonState = null
  if (returnTo) document.getElementById(returnTo)?.focus()
}

window.cancelChangeReason = function () {
  const onCancel = changeReasonState?.onCancel
  closeChangeReasonDialog()
  if (onCancel) onCancel()
}

window.confirmChangeReason = async function () {
  const state = changeReasonState
  if (!state) return
  const reason = document.getElementById('change-reason-input').value.trim()
  const errEl = document.getElementById('change-reason-error')
  errEl.classList.add('hidden')

  // With a picklist the CHOICE is what is mandatory and the free text is
  // optional. Without one, the free text is mandatory exactly as before.
  const choice = state.choices?.length
    ? document.getElementById('change-reason-choice').value
    : null

  if (state.choices?.length ? !choice : !reason) {
    errEl.textContent = state.emptyReasonError ?? 'A reason is required.'
    errEl.classList.remove('hidden')
    return
  }

  const result = await state.onConfirm(reason, choice)
  if (!result?.ok) {
    // The dialogue STAYS OPEN on failure, with the typed reason intact.
    // Closing it would discard what the user wrote for a failure that is
    // very likely retryable.
    errEl.textContent = result?.error ?? 'Failed to save.'
    errEl.classList.remove('hidden')
    return
  }
  closeChangeReasonDialog()
  if (state.onDone) await state.onDone()
}

// Round 15 Phase 2: the keyboard path onto a click-to-edit field.
//
// The display element is a button in all but name: tabindex 0, Enter and Space
// activate it. What it did NOT do was take a printable character, so a user
// tabbing through a form and typing lost the character and had to notice the
// field had not opened, press Enter, and type it again.
//
// PRINTABLE IS `key.length === 1` WITH NO Ctrl/Meta/Alt. That is the whole
// test, and it is a test of what the key IS rather than a list of what to
// exclude: Tab, Escape, Home, End, PageUp, F1 and every arrow have multi
// character names, so a deny-list would have to be maintained forever and a
// missed entry would open a field on a navigation key. Opening on Tab would
// make it impossible to move through a form without editing everything on the
// way, which is why this is expressed as an allow-test.
//
// Space stays an ACTIVATION key rather than becoming printable input, even
// though it passes the length test. It is the button convention, it is what
// this element already did, and a leading space is not a first character
// anybody means to type.
window.fieldDisplayKeydown = function (event, open) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    open()
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key.length !== 1) return
  event.preventDefault()
  open(event.key)
}

window.revealFieldControl = function (input, fromUserGesture, seedChar) {
  if (!input) return
  input.focus()
  // SEEDED HERE rather than in each of the four callers, for the same reason
  // this helper exists at all: Round 10 Phase 0A found the reveal duplicated
  // four ways and collapsed it, and a second thing done four ways would drift
  // the same way the first did.
  //
  // Only a free-text control can take a character. A date input and a select
  // cannot hold an arbitrary first character, and a number input silently
  // discards anything non-numeric, which is the seam Phase 3 sits on: change
  // the type and the accepted characters change with it.
  //
  // TEXTAREA is included deliberately. Summary is a textarea on Test Bed,
  // Opportunity and Contact, and the first version of this test read
  // `tagName === 'INPUT'`, which excluded the single field on each of those
  // screens that a person is most likely to tab to and start typing into.
  //
  // The assignment is checked rather than assumed. A number input given a
  // non-numeric character does not keep the old value and does not keep the
  // character: it goes EMPTY. Seeding "a" onto a duration of 12 therefore
  // blanked the field and dispatched an input event carrying "", which
  // registers an empty draft that Save would then persist. The character is
  // kept only when the control actually took it, and the original value is
  // put back otherwise, with no input event dispatched at all.
  if (seedChar) {
    const takesText = input.tagName === 'TEXTAREA'
      || (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number'))
    if (takesText) {
      const original = input.value
      input.value = seedChar
      if (input.value === seedChar) {
        input.dispatchEvent(new Event('input', { bubbles: true }))
        // Number inputs throw on setSelectionRange, so the caret is best-effort.
        try { input.setSelectionRange(input.value.length, input.value.length) } catch { /* not a text-selectable input */ }
      } else {
        input.value = original
      }
    }
  }
  if (!fromUserGesture) return
  const isPopupControl = input.tagName === 'SELECT'
    || (input.tagName === 'INPUT' && input.type === 'date')
  if (!isPopupControl) return
  if (typeof input.showPicker !== 'function') return
  try {
    input.showPicker()
  } catch {
    // NotAllowedError (no user activation) or InvalidStateError (detached).
    // Focus is already set, so the pre-0A behaviour is the floor: the field
    // still opens and is still usable, it just needs the second click again.
    // Never rethrow - a browser without showPicker must not break editing.
  }
}

// Expose navigate globally for inline onclick handlers
window.navigate = navigate
