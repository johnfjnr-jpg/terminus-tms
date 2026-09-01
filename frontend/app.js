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
const ALL_VIEWS = ['leads', 'leads-legacy', 'contacts', 'contact-detail', 'accounts', 'account-detail', 'test-beds', 'test-bed-detail', 'opportunities', 'opportunity-detail', 'opportunity-approval', 'approvals']

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

// ── Round 28 Phase 7: the unsaved-assessment guard ──────────────────────
//
// INTERACTION_STANDARDS.md Section 5, which is marked specification only and
// not yet implemented. This is NOT the system-wide dirty-state registry it
// specifies. It is that document's rule applied to the one place this round
// built a registry, using the shared #discard-confirm-modal that already
// exists and is already used by New Lead and Park.
//
// IT READS THE SAME SOURCE PHASE 5 DERIVES, oppAssessDirtyKeys(), and declares
// no flag of its own. A dirty flag beside a dirty set is a second source of
// truth that agrees today, which is the whole reason Phase 5 has no oppEdits.
//
// WARNS ONLY WHERE SOMETHING IS ACTUALLY LOST, which is a departure from
// Section 5's letter and is stated as one. Section 5 lists a nav-bar click as
// real navigation, because it was written for a page-wide registry where
// leaving the page discards. Here it does not: Phase 1 clears the draft maps
// on a RECORD CHANGE, so going to the Opportunities list and back to the same
// record still has the drafts. The two events that genuinely lose work are
// arriving at a DIFFERENT record, and unloading the tab. Warning about a
// discard that will not happen would make the dialog's own words false, and
// teaches people to dismiss it.
function oppAssessNavigationDiscards(view, id) {
  if (!oppAssessDirtyKeys().length) return false
  // Same record is not a loss: Phase 1 clears only when the id changes.
  if (view === 'opportunity-detail' && id === currentOppDetailId) return false
  // Any other view leaves the drafts in place, invisible but intact.
  return view === 'opportunity-detail'
}

// The views that render ONE record and therefore carry its identity in their
// markup. A list view holds no record state, so revealing it early shows an old
// list rather than a wrong record, and re-rendering it is the load.
const DETAIL_VIEWS = new Set([
  'opportunity-detail', 'test-bed-detail', 'contact-detail', 'account-detail', 'opportunity-approval',
])

// Cleared by whichever loader finishes, and by a single helper so a view that
// gains a loader later cannot be left permanently hidden by a flag nobody
// removes. Called unconditionally at the end of every detail load, including
// the failure paths: a record that could not be fetched must still show its
// error rather than the loading line for ever.
window.detailLoaded = function (view) {
  document.getElementById(`view-${view}`)?.classList.remove('is-loading')
}

function navigate(view, id) {
  // The guard runs BEFORE anything is hidden or loaded, so Keep editing
  // returns to a screen that never moved.
  if (oppAssessNavigationDiscards(view, id)) {
    openDiscardConfirm(() => {
      for (const k of oppAssessDirtyKeys()) {
        delete oppAssessDraft[k]; delete oppAssessReason[k]; delete oppAssessAnswer[k]
      }
      navigate(view, id)
    })
    return
  }
  ALL_VIEWS.forEach(v => document.getElementById(`view-${v}`)?.classList.add('hidden'))
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'))

  // ── NO STALE RECORD ON SCREEN WHILE THE NEXT ONE LOADS. Round 41 item K ─
  //
  // Selecting a record from the list revealed the detail view immediately, still
  // holding the PREVIOUS record's rendered content, and the loader then
  // overwrote it a fetch later. What a person saw was the last record's stage,
  // name and figures under the new record's heading, for as long as the request
  // took.
  //
  // It is not a race the loader can win. The reveal is synchronous and the data
  // is not, so the only correct state between them is "nothing yet".
  //
  // MARKED, NOT WIPED. Emptying the containers would destroy the elements every
  // renderer holds ids to, and rebuilding them is the load itself. `is-loading`
  // hides the stale body in CSS and shows one line saying so; the loaders clear
  // it when the record they fetched is the record on screen.
  //
  // ONE PLACE, in navigate, because arriving is the only moment stale content
  // can be revealed. A save refreshing the record you are already looking at
  // does not come through here, and must not flash.
  const target = document.getElementById(`view-${view}`)
  if (target && DETAIL_VIEWS.has(view)) target.classList.add('is-loading')

  target?.classList.remove('hidden')
  document.querySelector(`.nav-link[data-view="${view}"]`)?.classList.add('active')

  if (view === 'approvals') loadApprovalsQueue()
  else if (view === 'leads') loadContactsData()
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
  else if (view === 'opportunity-approval' && id) window.loadApprovalPage?.(id)
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

  // ── current() SURVIVES HAVING NO SELECTION. Round 41 walk item D ────────
  //
  // It read `keyOf(buttons().find(...))`, and keyOf is `btn => btn.dataset[k]`,
  // so with no active button it threw a TypeError on `undefined.dataset`.
  //
  // Architecture 8, and an unusually clean instance: correct for every caller
  // that existed, because all of them asked while a tab was selected. Item D's
  // fix is the first caller to ask "is anything selected" - the one question the
  // function could not answer, because the state it reports is the state it
  // crashed in.
  //
  // Fixed here rather than in keyOf: keyOf's other callers pass a real button
  // and making it tolerant would hide a genuinely missing one.
  return {
    select,
    adopt: wireButtons,
    current: () => { const b = buttons().find(x => x.classList.contains('active')); return b ? keyOf(b) : undefined },
  }
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
  // Round 29 Phase 3. The advance control is gated on the OPEN TAB now, and
  // the tab changes with no re-render, so it is refreshed here. Test Bed does
  // the same from its own activate (app.js:969).
  //
  // THE DEFAULT REVEAL IS REPRODUCED, NOT DROPPED. createTabStrip runs
  // activate(key) INSTEAD of its own reveal, not before it, so a consumer that
  // forgets this hides every pane and shows none. That warning is written at
  // app.js:339 and this is the second consumer to meet it.
  activate: key => {
    const pane = document.getElementById(`opp-tab-${key}`)
    if (pane) pane.classList.remove('hidden')
    refreshOppNextStageButton()
  },
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

  // ── CAPTURED BEFORE THE REBUILD, AND THE POSITION IS THE FIX ────────────
  //
  // Round 41, X1. This line must sit ABOVE the two removals below, and the
  // first attempt at this correction put it at the BOTTOM of the function -
  // after the rebuild it exists to survive. It read undefined every time and
  // behaved identically to the version it was replacing.
  //
  // Caught by the widened probe still failing all four cases with the "fix"
  // applied, which is the argument for writing the probe first: an unchanged
  // failure after a change that looks correct is evidence the change never
  // reached the code path. Architecture 9's diagnostic signature, and it fired
  // against the person who wrote that sentence into this file.
  const selectedBeforeRebuild = oppTabStrip.current()

  const stageTabs = (stages ?? []).filter(s => !s.reachable_from_any_stage)

  // Remove the previous record's generated tabs and panels before adding
  // this record's. Without this, switching between records with different
  // stage lists would accumulate tabs from both.
  strip.querySelectorAll('.detail-tab[data-opp-stage-tab]').forEach(b => b.remove())
  host.querySelectorAll('.detail-tab-panel[data-opp-stage-panel]').forEach(p => p.remove())
  // Round 29 Phase 3: the action container is static markup, and the stage
  // tabs below are appended, so without this it would sit before them. Moved
  // rather than rebuilt, so its buttons keep their identity and their wiring.
  const tabActions = document.getElementById('opp-tab-actions')

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
    // Round 21 described this as "a 2-up grid at 1240 and 1920". Measured in
    // Round 31 Phase 1 it is two columns at 1240, THREE at 1920 and seven at
    // 3440, because .ref-cards is repeat(auto-fit, minmax(280px, 1fr)) and
    // nothing declares a column count. The reading-order reasoning below still
    // holds; the number in it did not.
    //
    // Reordering the blocks is what orders them, because DOM position is the
    // only thing that does: there is no `order:` declaration anywhere in the
    // stylesheet. Each card addresses its own container by id, so moving the
    // blocks cannot disturb which container a loader fills.
    //
    // ── Round 31 Phase 1: THE ASSESSMENTS CARD IS GONE ──────────────────────
    //
    // It was never wired. `opp-stage-assessments-<key>` appeared exactly once
    // in the repository, at its own creation here, and nothing ever called
    // getElementById on it. Round 21 Phase 5 built it as a slot and it stayed
    // one for ten rounds.
    //
    // Its sentence said "No assessments configured for this stage." That was
    // TRUE when it was written and Round 25 Phase 2 made it false by
    // configuring assessCommBudgetConfirmed at Qualification. The business
    // read it and reported the assessments as lost. Nothing was lost.
    //
    // REMOVED RATHER THAN WIRED, which is the business's decision and the
    // reason is the one this project has recorded more often than any other:
    // the Assessment tab already holds the instrument, measured at 461px over
    // the seven criteria configured at the time, across four lens sub-tabs, and
    // a second surface showing the same criteria is a second thing to drift.
    //
    // Round 41 added an eighth criterion. The number above is left as the
    // measurement it was rather than re-stated, per CLAUDE.md Architecture 9's
    // fourth variant: a migration can falsify a string, so a count in prose is
    // pinned to when it was taken.
    //
    // TERMINUS DOCUMENTS STAYS. It is the same shape, an unwired placeholder
    // carrying its own text, and it is deliberately kept: it is a slot for
    // something that will exist, where Assessments duplicated a tab that
    // already works. Removing both because they look alike would be treating
    // the shape as the fault rather than the duplication.
    panel.innerHTML = `
      <div class="ref-cards">
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
  if (tabActions) strip.appendChild(tabActions)
  wireOppNextStageButton(currentStage, stages)
  markOppCurrentStageTab(currentStage)



  // ── A RE-RENDER MUST LEAVE A TAB SELECTED. Round 41 walk item D ─────────
  //
  // THE MEASUREMENT. Before a transition: six panels, one visible. After a
  // SUCCESSFUL one: six panels, ZERO visible. No throw, every call 200, the
  // record correctly moved. The view as a whole even GREW, 27,955 characters to
  // 54,722 - what emptied was the region the person was reading.
  //
  // The cause is three lines above: this function removes every generated tab
  // and panel and rebuilds them, so whatever was selected is gone. On a first
  // load the caller selects a tab afterwards; on a RE-RENDER nothing did, and
  // the strip came back with nothing active and all six panels hidden.
  //
  // ONE PLACE, NOT PER CALLER, and that is the business's ruling and the right
  // shape besides. Four paths re-render after a stage change -
  // requestTransition, decideRequest, withdrawRequest and submitStageApproval's
  // Opportunity branch - and a fix in each is four readers of one rule, three of
  // which would be correct until somebody adds a fifth path. This runs wherever
  // the strip is rebuilt, which is the only moment a selection can be lost.
  //
  // THE NEW STAGE'S TAB, THEN REFERENCE. Ruled by the business. A person who
  // moved a record wants the stage they moved it to; a record whose current
  // stage has no tab - a terminal stage reached from elsewhere, or a stage list
  // that changed - still lands somewhere real rather than nowhere.
  //
  // GUARDED ON current(), so it never overrides a selection a caller has
  // already made. It restores a lost one; it does not impose one.
  //
  // THREE OUTCOMES, IN ORDER OF WHOSE INTENT THEY HONOUR:
  //
  //   the tab the person had open, if it still exists after the rebuild
  //   the record's current stage, when nothing was open or the tab is gone
  //   Reference, when even that has no tab (a stage list that changed)
  //
  // The middle case is what a stage list changing under a person produces: the
  // tab they were on no longer exists, so there is nothing to preserve and the
  // record's own stage is the only defensible landing place.
  const stillExists = (key) => !!key && !!document.querySelector(`[data-opp-tab="${key}"]`)
  if (stillExists(selectedBeforeRebuild)) {
    // Re-selected even though a static tab may still carry .active from before
    // the rebuild: select() is idempotent, and re-running it re-reveals the
    // pane, which a generated tab needs because its panel was just recreated
    // hidden.
    oppTabStrip.select(selectedBeforeRebuild)
  } else {
    const stageKey = oppStageTabKey(currentStage)
    oppTabStrip.select(stillExists(stageKey) ? stageKey : 'reference')
  }
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
    () => myToken === oppStageTabLoadToken,
    // Round 27 Phase 1: this call site already HAD the record's stage and
    // was not passing it on, which is why the renderer could not make the
    // decision at all.
    currentStage)
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
    ? buildStageTrackListHtml(recordId, entry, 'opportunity')
    : '<p class="empty-state">Unknown stage.</p>'
}

function nextStageAfter(stages, stageName) {
  const list = stages ?? []
  const i = list.findIndex(s => s.stage_name === stageName)
  if (i < 0) return null
  if (list[i]?.is_terminal) return null
  return list[i + 1]?.stage_name ?? null
}

// Round 27 Phase 1: is `stageName` STRICTLY AHEAD of the record's own stage.
//
// Strictly ahead, not `!== current`, and the difference is the whole point.
// Test Bed's approval rows use `st.state === 'current'` because an approval
// on a past stage already exists and shows its date. This criterion is not
// like that: its rule is `entry_stage_at_or_after`, so an entry written now
// and dated at the record's current stage SATISFIES an earlier stage's rule.
// A past stage is genuinely tickable and clicking it genuinely works.
// Copying the approval discriminator would have disabled the row on stages
// where it still does something.
//
// Fails OPEN. An unknown stage on either side leaves the row exactly as it
// renders today rather than disabling it, because this is a display guard
// over a write the server already handles safely, and a guard that gets it
// wrong should not be the thing that stops legitimate work.
function oppStageIsAhead(stages, stageName, recordStage) {
  const list = stages ?? []
  const here = list.findIndex(s => s.stage_name === stageName)
  const at = list.findIndex(s => s.stage_name === recordStage)
  if (here < 0 || at < 0) return false
  return here > at
}

// ── Round 29 Phase 3: the record-level controls, on the tab line ────────
//
// SECTION 10's FINDING IS THE DECISION INSIDE THIS PHASE. Test Bed and
// Opportunity have always enforced the same business rule, stage progression
// happens from inside the stage itself, by OPPOSITE mechanisms: Test Bed
// disables its control off the record's current stage tab, Opportunity cleared
// the slot so the control did not exist there. Moving the control to the tab
// line means adopting Test Bed's mechanism, so the disabling rule comes with
// it or the rule is lost.
//
// Cached because the button's enabled-ness depends on the OPEN TAB, which
// changes with no re-render. Test Bed's tbNextStageState (app.js:4217) for the
// same reason.
let oppNextStageState = null

function wireOppNextStageButton(currentStage, stages) {
  const row = (stages ?? []).find(s => s.stage_name === currentStage)
  oppNextStageState = {
    recordId: currentOppDetailId,
    currentStage,
    nextStage: nextStageAfter(stages, currentStage),
    isTerminal: !!row?.is_terminal,
  }
  const fb = document.getElementById('opp-next-stage-feedback')
  if (fb) fb.innerHTML = ''
  refreshOppNextStageButton()
}

// TWO CONDITIONS FOR ADVANCE, ONE FOR CLOSED LOST, and the difference is the
// part that is a decision rather than a copy.
//
// ADVANCE is stage-scoped. It moves the record from its own stage to the next,
// and the rule says review that stage's criteria and approvals first, so it
// carries both of Test Bed's conditions: final stage, and not on the record's
// current stage tab.
//
// MARK CLOSED LOST IS RECORD-SCOPED AND DOES NOT CARRY THE SECOND. The
// close-lost route says so itself (src/routes/opportunities.js:598): Closed
// Lost carries zero gate rules, and it is reached through
// reachable_from_any_stage, so there is no adjacency to satisfy and no
// criteria to review from any particular tab. Disabling it off the current
// stage tab would disable a control that would have worked, which is exactly
// the fault Round 27 recorded when a two-state discriminator was borrowed onto
// a three-state control. The discriminator encodes why the rule exists, and
// this rule does not exist for losing a deal.
//
// It IS disabled on a terminal record, because you cannot lose a deal that is
// already closed. Disabled rather than hidden, so the pair keeps its shape and
// reads as one group whatever the record's state.
function refreshOppNextStageButton() {
  const btn = document.getElementById('opp-next-stage-btn')
  const lost = document.getElementById('opp-close-lost-btn')
  if (!btn || !oppNextStageState) return
  const { recordId, currentStage, nextStage, isTerminal } = oppNextStageState

  if (lost) {
    lost.disabled = isTerminal
    lost.onclick = isTerminal ? null : () => openCloseLostPrompt(recordId, currentStage)
  }

  // No next stage. Two reasons produce it and they are told apart by the
  // label, following Test Bed: "Final stage" is terminal and nothing the user
  // does will change it. Opportunity's terminals are Closed Won and Closed
  // Lost, and Closed Lost is reachable_from_any_stage so it has no tab at all,
  // which means a lost record can never satisfy the current-stage condition
  // below. Handling the no-next-stage case first is what stops that reading as
  // "open the right tab" when there is no right tab to open.
  if (!nextStage) {
    btn.disabled = true
    btn.textContent = isTerminal ? 'Final stage' : 'No further stage'
    btn.onclick = null
    return
  }

  // ── THE VERB CHANGED, AND SO DID THE OUTCOME. Round 41 ─────────────────
  //
  // "Move to X" moved the record. "Request X" raises a transition request and
  // FREEZES the record until every required track has decided. Same position,
  // different act, so the label has to say which.
  // ── Round 41 ruling I: "Request next stage", on every stage ─────────────
  //
  // It read `Request ${nextStage}` - "Request Solution Alignment", "Request
  // Proposal" - so the label changed on every stage and the button was a
  // different-looking control each time. The business ruled one wording: the
  // panel already names the target, so the button does not have to.
  //
  // The destination is not lost, it moves to the title attribute, which is where
  // a confirmation belongs rather than in the label a person scans for.
  btn.textContent = 'Request next stage'
  btn.title = `Raise a request to move this record to ${nextStage}`
  // Compared on data-opp-stage-tab, which carries the RAW stage name, rather
  // than on data-opp-tab, which carries the sanitised key. Both are set on a
  // stage tab (app.js:521-522); the raw name needs no round trip through
  // oppStageTabKey to compare, and it is undefined on Reference, Commercials
  // and Assessment, so those correctly fail the test rather than accidentally
  // matching a key.
  const activeStage = document.querySelector('#opp-detail-tabs .detail-tab.active')?.dataset.oppStageTab
  if (activeStage !== currentStage) {
    btn.disabled = true
    btn.onclick = null
    return
  }
  // A record with a request open cannot have another raised on it, and the
  // button says so rather than being silently inert.
  if (oppOpenRequest) {
    btn.textContent = 'Awaiting approval'
    btn.disabled = true
    btn.onclick = null
    return
  }
  btn.disabled = false
  btn.onclick = () => requestTransition(recordId, nextStage)
}

// ── THE STAGE APPROVALS WORKFLOW, CLIENT SIDE. Round 41 ────────────────────
//
// ONE LOADED VALUE, read by everything. Verification 20: a second reader of the
// same value always drifts, and eleven controls depend on this one fact.
let oppOpenRequest = null

async function loadOppOpenRequest(recordId) {
  oppOpenRequest = null
  const r = await api('GET', `/api/records/${recordId}/transition-requests`)
  if (!r.ok) return
  oppOpenRequest = (r.data ?? []).find(x => x.status === 'open' && x.kind === 'transition') ?? null
}

window.requestTransition = async (recordId, toStage) => {
  const fb = document.getElementById('opp-next-stage-feedback')
  if (fb) fb.innerHTML = ''
  const r = await api('POST', `/api/records/${recordId}/transition-requests`, { to_stage: toStage })
  if (!r.ok) {
    // THE BLOCKERS ARE THE ANSWER, not a sentence about them. The request is the
    // gate's front door, so a refusal has to say what is unmet.
    const list = (r.data?.blocking ?? []).map(b =>
      `<li>${escHtml(b.label ?? b.field ?? b.requirement_detail?.track ?? b.requirement_type)}</li>`).join('')
    if (fb) {
      fb.innerHTML = `<p class="msg-error">${escHtml(r.data?.error ?? 'The request could not be raised.')}</p>`
        + (list ? `<ul class="msg-error" style="margin-top:6px;padding-left:18px">${list}</ul>` : '')
    }
    return
  }
  await loadOpportunityDetail(recordId)
}

window.withdrawRequest = async (requestId, recordId) => {
  // Item C: the same in-page dialogue as the rejection, and the write happens
  // inside it so a refusal keeps the typed reason.
  const { confirmed } = await decisionDialogue({
    heading: 'Withdraw this request',
    contextLabel: 'Request', contextValue: 'Awaiting approval',
    promptLabel: 'Why are you withdrawing it (required)',
    confirmLabel: 'Withdraw the request',
    emptyReasonError: 'A reason is required to withdraw a request.',
    warning: 'Withdrawing releases the record so it can be edited again. Any decisions already '
      + 'made on this request stay as a record and a new request starts from nothing.',
    returnFocusTo: 'opp-freeze-banner',
    action: async (reason) => {
      const r = await api('POST', `/api/transition-requests/${requestId}/withdraw`, { reason })
      return { ok: r.ok, error: r.data?.error ?? 'It could not be withdrawn.' }
    },
  })
  if (!confirmed) return
  await loadOpportunityDetail(recordId)
}

// ── NO NATIVE DIALOGUES ON THE RECORD SURFACE. Round 41 walk item C ───────
//
// Three survived: the reject reason and the withdraw reason on window.prompt,
// and the key-contact removal on a bare confirm(). All three render as
// "localhost:3000 says", carry none of the product's type or spacing, cannot
// validate anything, and are the one control on the screen a person cannot tell
// from a browser warning.
//
// REUSED, NOT REBUILT. window.requestChangeReason already owns the focus trap,
// the single Escape owner, the focus return and the stays-open-on-failure
// behaviour INTERACTION_STANDARDS.md Section 4 requires, and it is the
// save-with-reason discipline the ruling names. A second modal would be a second
// place for all four of those to drift.
//
// THE WRAPPER PRESERVES THE PROPERTY THAT MATTERS. requestChangeReason is
// callback-shaped because the WRITE happens inside onConfirm: a failed write
// leaves the dialogue open with the typed reason intact, rather than closing and
// losing it. A naive promise wrapper that resolved with the text and closed
// would throw that away, so `action` runs inside onConfirm and its {ok, error}
// decides whether the dialogue closes.
window.decisionDialogue = decisionDialogue
function decisionDialogue({ heading, contextLabel, contextValue, promptLabel, confirmLabel,
  emptyReasonError, warning, returnFocusTo, action }) {
  return new Promise((resolve) => {
    let settled = false
    window.requestChangeReason({
      heading, contextLabel, contextValue, promptLabel, confirmLabel, emptyReasonError,
      ...(warning ? { warning } : {}),
      ...(returnFocusTo ? { returnFocusTo } : {}),
      onConfirm: async (reason) => { const r = await action(reason); if (r.ok) settled = true; return r },
      onDone: () => resolve({ confirmed: true }),
      onCancel: () => { if (!settled) resolve({ confirmed: false }) },
    })
  })
}

// ── A DECISION IN FLIGHT CANNOT BE MADE TWICE. Round 41 walk item A2 ──────
//
// The walk hit "an approval decision from you already exists" and then a raw
// 409 on a request that had already completed. Diagnosed: the write is correct
// and the 409 is decide_transition_request refusing a request that is no longer
// open. What made it reachable is that the buttons stayed live while the
// decision was in flight, and item D meant the screen said nothing afterwards -
// so there was no signal that the first click had landed.
//
// THE CONTROLS GO BEFORE THE AWAIT, not after it. A guard that clears them once
// the reload finishes leaves them clickable for the whole round trip, which is
// exactly the window a person clicks in when nothing has visibly happened.
window.decideRequest = async (requestId, track, decision, recordId) => {
  // THE CONTROLS GO BEFORE ANYTHING AWAITS. A guard applied after the round trip
  // leaves them clickable for its whole duration, which is exactly the window a
  // person clicks in when nothing has visibly happened.
  //
  // ── DISABLED, NOT REMOVED. Round 41, sixth walk V6 ─────────────────────
  //
  // The first version REMOVED every button in the banner. It closed the
  // double-click window and opened a worse one: clicking Approve on Commercial
  // made the Technical and Legal controls VANISH until the write returned, so
  // the screen answered a click by deleting three unrelated controls.
  //
  // Ruled: disable with a pending state, never remove and restore. Disabled is
  // the honest state - the control still exists, still says what it does, and
  // says it cannot be used yet - and it is what a person can reason about. The
  // "re-enabling is a second thing to get right" argument was real and is
  // answered by the reload rebuilding the banner on BOTH paths, which was
  // already true when it was used to justify removal.
  //
  // THE ONE CLICKED SAYS WHAT IT IS DOING. The others say nothing new: they are
  // dimmed and inert, which is a state a person reads as "wait", where a
  // disappearance is one they read as "what did I just break".
  const banner = document.getElementById('opp-freeze-banner')
  const fb = document.getElementById('opp-request-feedback')
  if (fb) fb.innerHTML = ''
  const buttons = [...(banner?.querySelectorAll('button') ?? [])]
  const clicked = buttons.find((b) => (b.getAttribute('onclick') ?? '')
    .includes(`'${track}','${decision}'`))
  for (const b of buttons) {
    b.disabled = true
    b.classList.add('is-pending')
  }
  const pending = (text) => {
    if (clicked) { clicked.dataset.label = clicked.textContent; clicked.textContent = text }
  }

  const send = async (reason) => {
    pending(decision === 'approved' ? 'Approving...' : 'Rejecting...')
    const r = await api('POST', `/api/transition-requests/${requestId}/approvals`,
      { track, decision, ...(reason ? { reason } : {}) })
    return { ok: r.ok, error: r.data?.error }
  }

  const done = async (failure) => {
    // THE RELOAD RUNS ON FAILURE TOO. Without it the banner stays stripped of
    // its controls and the person is left with a message and no way to act on
    // it, which is the same dead end from the other direction.
    await loadOpportunityDetail(recordId)
    if (!failure) return
    const el = document.getElementById('opp-request-feedback')
    if (el) el.innerHTML = `<p class="msg-error">${escHtml(failure)}</p>`
  }

  if (decision === 'rejected') {
    // The write happens INSIDE the dialogue, so a refusal leaves it open with
    // the typed reason intact. Item C.
    const { confirmed } = await decisionDialogue({
      heading: `Reject on the ${track} track`,
      contextLabel: 'Track', contextValue: track,
      promptLabel: 'Why are you rejecting (required)',
      confirmLabel: 'Record the rejection',
      emptyReasonError: 'A reason is required to reject a transition request.',
      warning: 'A rejection closes the request. The other tracks keep their decisions as a record, '
        + 'and a new request has to be raised to move the deal.',
      returnFocusTo: 'opp-freeze-banner',
      action: send,
    })
    if (!confirmed) { await loadOpportunityDetail(recordId); return }
    await done(null)
    return
  }

  const r = await send(null)
  await done(r.ok ? null : (r.error ?? 'The decision could not be recorded.'))
}

// ── THE OPEN REQUEST, AND WHAT IT IS WAITING FOR. Round 41 ───────────────
//
// THE CRITERIA STATE IS NEVER ABSENT, and it is the resolution of the raise-path
// residual: a request raised by calling the function directly looks entirely
// normal to an approver, so the banner says what the gate says about it RIGHT
// NOW rather than leaving the approver to assume.
//
// RENDERED AT THE TOP OF THE RECORD. The first version put it inside the stage
// panel, and the capture showed why that is wrong: somebody landing on Reference
// saw an ordinary record with every field greyed and nothing saying why.
// ── Round 41 W1: one statement, at the top, saying why nothing can be changed ──
//
// THE SAME SENTENCE THE SERVER SENDS. src/lib/write-errors.js OWNERSHIP_REFUSAL
// is the wording of every refusal this screen would have produced, so a person
// who sees the banner and a person who sees a 403 read the same words. Kept as a
// literal here because the client cannot import from src/, and named as a
// deliberate second copy rather than left to look like a coincidence: if one
// changes the other has to, and commercials-wiring asserts they match.
const OWNERSHIP_REFUSAL_TEXT =
  'This record belongs to another user. You can view it, but only its owner can change it.'

function renderOppReadOnlyBanner(notMine) {
  const el = document.getElementById('opp-readonly-banner')
  if (!el) return
  if (!notMine) { el.innerHTML = ''; return }
  el.innerHTML = `
    <div class="freeze-banner">
      <p class="label" style="margin-bottom:6px">Read only &middot; another user's record</p>
      <p style="font-size:14px;margin:0">${escHtml(OWNERSHIP_REFUSAL_TEXT)}</p>
    </div>`
}

function renderOppFreezeBanner(recordId) {
  const el = document.getElementById('opp-freeze-banner')
  if (!el) return
  if (!oppOpenRequest) { el.innerHTML = ''; return }
  const req = oppOpenRequest
  const decided = new Map((req.decisions ?? []).map(d => [d.track, d]))
  // ── DECISION CONTROLS ONLY WHERE A DECISION IS POSSIBLE. Round 41 item B ─
  //
  // The walk saw Approve and Reject rendered for the REQUESTER, who can never
  // decide their own request. The refusal was correct and it arrived after the
  // click, which is the same shape as W1 one screen along.
  //
  // ONE LOADED VALUE, and it is the server's. `may_decide` is computed by the
  // route with mayDecide - the SAME function the decide route enforces with - so
  // a track offered here is a track that route will accept, and a track hidden
  // here is one it would have refused. The client tests nothing: fetching
  // track_approvers and re-deriving the rule would be two readers of it, and the
  // screen's copy is the one nobody exercises against a real refusal.
  const mayDecide = new Set(req.may_decide ?? [])
  const rows = (req.required ?? []).map((t) => {
    const d = decided.get(t)
    const state = d ? (d.decision === 'approved' ? 'Approved' : 'Rejected') : 'Waiting'
    const buttons = d || !mayDecide.has(t) ? '' : `
      <button class="btn-sm btn-primary btn-accept" onclick="decideRequest('${req.id}','${escHtml(t)}','approved','${recordId}')">Approve</button>
      <button class="btn-sm btn-ghost" onclick="decideRequest('${req.id}','${escHtml(t)}','rejected','${recordId}')">Reject</button>`
    // A WAITING TRACK YOU CANNOT DECIDE STILL SAYS SO, rather than showing a
    // bare "Waiting" beside three tracks that have buttons. Silence there reads
    // as a screen that has not loaded.
    const why = d || mayDecide.has(t) ? ''
      : `<span class="sa-approval-meta">${escHtml(req.requested_by_is_me ? 'You raised this request' : 'Not yours to decide')}</span>`
    return `<div class="data-row"><span>${escHtml(t)}</span><span class="sa-approval-meta">${state}</span>${why}${buttons}</div>`
  }).join('')
  const met = req.criteria === 'met'
  el.innerHTML = `
    <div class="freeze-banner">
      <p class="label" style="margin-bottom:6px">Frozen &middot; awaiting approval</p>
      <p style="font-size:14px;margin:0 0 10px">A move to <strong>${escHtml(req.to_stage)}</strong> is
        waiting on approvals. Nothing on this record can be edited until every track has approved,
        someone rejects, or the request is withdrawn.</p>
      <p class="${met ? 'msg-success' : 'msg-error'}" style="margin:0 0 10px">
        ${met ? 'Exit criteria met.' : 'Exit criteria NOT EVALUATED.'}
        ${escHtml(req.criteria_note ?? '')}</p>
      ${(req.criteria_blockers ?? []).length
        ? `<ul class="msg-error" style="margin:0 0 10px;padding-left:18px">${
          req.criteria_blockers.map(b => `<li>${escHtml(b.label ?? b.field ?? b.requirement_type)}</li>`).join('')}</ul>`
        : ''}
      ${rows}
      <div id="opp-request-feedback" style="margin-top:10px"></div>
      <button class="btn-sm btn-ghost" style="margin-top:10px"
        onclick="withdrawRequest('${req.id}','${recordId}')">Withdraw request</button>
    </div>`
}

function renderOppAdvanceControl(el, recordId, currentStage, stages) {
  // The banner is at the top of the record; the stage panel points at it rather
  // than rendering a second copy, which would be two readers of one request.
  if (oppOpenRequest) {
    const req = oppOpenRequest
    el.innerHTML = `
      <p class="muted" style="font-size:14px">This record is frozen while a move to
        <strong>${escHtml(req.to_stage)}</strong> is decided. The request, its exit-criteria state
        and the approve controls are at the top of this record.</p>`
    return
  }

  const next = nextStageAfter(stages, currentStage)
  if (!next) {
    const row = (stages ?? []).find(s => s.stage_name === currentStage)
    el.innerHTML = row?.is_terminal
      ? `<p class="muted" style="font-size:14px">${escHtml(currentStage)} is a closed state. Nothing further to move toward.</p>`
      : '<p class="muted" style="font-size:14px">This record has reached the final stage.</p>'
    return
  }
  // Round 29 Phase 3: BOTH CONTROLS HAVE MOVED to the tab line. What remains
  // here is the sentence telling the reader where the record can go, which is
  // information about this stage and belongs in this stage's panel.
  //
  // A STALE MEASUREMENT IS CORRECTED RATHER THAN INHERITED. This block
  // previously carried "Phase 2 measured the eight-tab strip at 876px in 876px,
  // zero margin, so a ninth control there would overflow it at 1240px", and
  // that is why Mark Closed Lost was put here in the first place. Round 29
  // Phase 0 measured the strip again: nine tabs total 832px in 876px, leaving
  // 683px free at 1240 and 564px at 1920, and Test Bed already carries three
  // controls in a strip with 33px free. The number that decided this placement
  // was wrong, and leaving it written here would have the next round re-derive
  // the same conclusion from it.
  el.innerHTML = `
    <p class="muted" style="font-size:14px;margin-bottom:16px">Request <strong>${escHtml(next)}</strong> from the control on the tab row. The record freezes until every track has decided.</p>`
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
    // Round 29 Phase 3: repointed. This wrote to #transition-feedback, which
    // lived inside the stage panel and no longer exists now the control is on
    // the tab row. The `if (fb)` guard meant it would not have thrown; it
    // would have reported a failure to nothing, which is the worse half of
    // that pair.
    const fb = document.getElementById('opp-next-stage-feedback')
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
    // Round 22 Phase 3: the real id of the control that opened this. It was
    // 'opp-stage-transition', which matches nothing: the generated ids all
    // carry the stage key, as `opp-stage-transition-${key}`. getElementById
    // returned null and the `?.focus()` swallowed it, so cancelling this
    // dialogue dropped focus silently. Same family as Round 21 Phase 7's
    // element ids built from a stage name: an id that resolves in the mind
    // and not in the document.
    //
    // It points at the button rather than that container, because the
    // container is a <div> with no tabindex and .focus() on one is a no-op:
    // fixing the id alone would have replaced a silent failure with a
    // quieter one.
    // Round 29 Phase 3: the id lost its stage suffix when the button moved to
    // the tab row, where there is one button rather than one per stage. Round
    // 22 Phase 3 fixed this exact line once already, for the same reason: an
    // id that resolves in the mind and not in the document, whose failure is
    // swallowed by an optional call. Moving a control renames it, and every
    // reference to the old name is a silent failure waiting.
    returnFocusTo: 'opp-close-lost-btn',
    onConfirm: async (note, reasonId) => {
      const result = await api('POST', `/api/opportunities/${recordId}/close-lost`, { reason_id: reasonId, note })
      return { ok: result.ok, error: result.data?.error }
    },
    // Round 22 Phase 3: a lost deal lands on Reference, carried through the
    // SAME one-shot an advance uses rather than a second switch call here.
    //
    // Reference because a lost deal is not a stage you work in, which is the
    // same reasoning that keeps Closed Lost out of the tab strip, and because
    // Reference is where you look to see what happened. Landing on the stage
    // it died at would show exit criteria for a transition that will never
    // happen.
    //
    // Set BEFORE the reload, since the reload is what consumes it.
    onDone: async () => {
      oppLandOnTabAfterLoad = 'reference'
      await loadOpportunityDetail(recordId)
    },
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
  // ── THE REVISION HANDSHAKE, IN ONE PLACE. Round 41, walk finding 1 ──────
  //
  // Every response that carries a new revision updates the number the client
  // sends with its next write. HERE rather than at each call site, and that is
  // the whole fix: oppPatch did it correctly and nineteen other call sites did
  // not, so the record advanced under the user's own hand while the Commercials
  // tab kept a number from before and refused its own save.
  //
  // A PER-CALL-SITE RULE IS ONE A NEW ROUTE CAN BE ADDED WITHOUT. This cannot
  // be forgotten by the next route, because the next route does not have to
  // remember anything.
  if (res.ok) noteRevisionFromResponse(path, data)
  return { ok: res.ok, status: res.status, data }
}

// Scoped to the opportunity currently on screen, because that is the only
// record whose revision this client tracks. A response about another record is
// not this record's revision, and matching on the path is what tells them apart.
function noteRevisionFromResponse(path, data) {
  // ── THE APPROVAL PAGE JOINS THE HANDSHAKE. Round 41 walk item F ─────────
  //
  // It reports the revision under `meta.revisionNumber` rather than
  // `revision_number`, so every response it ever returned fell out of the guard
  // below and the one loaded revision this app keeps was never told. The walk
  // saw 26 against a record at 54.
  //
  // The ROUTE is not stale: it reads the latest revision at request time. What
  // was stale is a page rendered once and never told the record had moved, and
  // the mechanism for being told already existed and did not cover this shape.
  //
  // Normalised HERE, in the one function that already owns "what revision are we
  // at", rather than by giving the approval page its own tracker. Verification
  // 20: a second reader of the loaded revision is the thing this function exists
  // to prevent.
  // ── THE THIRD KEY. Round 41, fourth walk X3 ─────────────────────────────
  //
  // `latest_revision_number` is what every GET carries, and this function read
  // neither it nor meta.revisionNumber. So the holder was written ONCE at record
  // load and thereafter only by this session's own writes: a record advanced by
  // anybody else left it frozen, and issuing a version was refused against a
  // number 18 revisions old. Record at 24, version would have recorded 6.
  //
  // The version path was never a second reader. It sends
  // window.getOppLoadedRevision() like every other write. The gap was that a
  // READ could not update the one holder, which is why the fix is one line in
  // one reader rather than another route added to a list.
  //
  // THREE SPELLINGS OF ONE FACT, and naming all three here is the point: a write
  // answers `revision_number`, the approval page answers `meta.revisionNumber`,
  // and a read answers `latest_revision_number`. Each was correct in its own
  // route and none of them agreed.
  const rev = data?.revision_number ?? data?.meta?.revisionNumber ?? data?.latest_revision_number
  if (!Number.isInteger(rev)) return
  if (!currentOppDetailId) return
  // The response may name its own record. When it does, trust that; when it
  // does not, the path has to mention the record we are tracking.
  const named = data?.record_id
  if (named ? named !== currentOppDetailId : !String(path).includes(currentOppDetailId)) return
  // 'read' when the response carries no revision_number of its own: that is a
  // GET reporting where the record actually is, which is the case that must
  // warn. A write's own response is this session catching up with itself.
  window.setOppLoadedRevision(rev, { source: data?.revision_number === undefined ? 'read' : 'write' })
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
// { recordType: 'test_bed' | 'opportunity', recordId, accountId, role,
//   roleId?, roleOther? }
//
// role is the DISPLAY label in both cases and is what the error messages
// name. roleId/roleOther are the Opportunity shape only, added Round 35
// Phase 5 when the four fixed slots retired: Test Bed still links by one of
// three hardcoded strings, Opportunity links by a catalog uuid or by text
// typed on the deal, and step 4 below sends whichever its record type takes.
let ibcContext = null
let ibcKeydownHandler = null

window.openInlineBuyerContactModal = async function (recordType, recordId, accountId, role, roleId, roleOther) {
  ibcContext = { recordType, recordId, accountId, role, roleId, roleOther }
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

    // Step 4: link in this specific role, the same endpoint the ordinary
    // (already-qualified-Contact) dropdown flow already uses.
    //
    // TWO SHAPES, ONE STEP. Round 35 Phase 5. Test Bed links by one of three
    // hardcoded role strings; Opportunity's four fixed slots were retired for
    // Key Customer Contacts, so it links by a catalog role_id or by a
    // role_other typed on the deal. Branching here rather than building a
    // second modal keeps the four proven endpoints this orchestrates as one
    // sequence, which is the whole reason this function exists.
    const path = ibcContext.recordType === 'test_bed'
      ? `/api/test-beds/${ibcContext.recordId}/buyer-contacts`
      : `/api/opportunities/${ibcContext.recordId}/key-contacts`
    const body = ibcContext.recordType === 'test_bed'
      ? { role: ibcContext.role, contact_id: contactId }
      : { contact_id: contactId,
          ...(ibcContext.roleId ? { role_id: ibcContext.roleId } : { role_other: ibcContext.roleOther }) }
    const roleLinked = await api('POST', path, body)
    if (!roleLinked.ok) {
      errEl.innerHTML = `Contact created, linked to the Account, and qualified, but linking as ${escHtml(ibcContext.role)} failed: ${escHtml(roleLinked.data?.error ?? 'unknown error')}. It can be linked directly from the role dropdown now that it's qualified.`
      errEl.classList.remove('hidden')
      return
    }

    // Full success - return to the original screen, per the brief, with
    // the new Contact now selectable and correctly linked (the reload below
    // picks it up via the record's own buyer_contacts on Test Bed, or
    // key_contacts on Opportunity, already written by step 4).
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

// Round 29 Phase 5: ONE hover mechanism for both record types, parameterised,
// rather than a second implementation of it.
//
// The four properties below are precisely the ones that look incidental and
// would be re-derived wrongly by anyone copying the visible behaviour: the
// debounce, the load token, mouseleave on the wrapper, and no click handler
// ever. A shared function is the only arrangement in which they CANNOT drift
// apart. renderChevronStrip is already shared between the two strips for the
// same reason, so this follows an established pairing rather than inventing
// one.
//
// Distinct from Round 9 Phase 6.2's decision to keep two approval builders as
// siblings: those two callers genuinely need different columns. These two need
// identical behaviour against the identical endpoint, and the only thing that
// differs is which element ids to read.
let chevronPopupId = 'tb-chevron-popup'

function hideChevronPopup() {
  clearTimeout(tbChevronHoverTimer)
  // Bump the token so any in-flight response is stale and cannot paint
  // after the pointer has already left.
  tbChevronLoadToken++
  const popup = document.getElementById(chevronPopupId)
  if (popup) popup.classList.add('hidden')
}

// Centre on the chevron, then clamp inside the wrapper. This is what
// stops the leftmost and rightmost popups being clipped at the viewport
// edge - the strip runs the full page width, so Closed sits hard against
// it and a centred popup would overflow.
function positionChevronPopup(item, popup, wrap) {
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
function wireChevronHover({ wrapId, popupId, recordId }) {
  const wrap = document.getElementById(wrapId)
  const popup = document.getElementById(popupId)
  if (!wrap || !popup) return
  // Which popup hideChevronPopup should hide. Set before any early return, so
  // a pointer leaving one record type's strip cannot hide the other's.
  chevronPopupId = popupId

  // Updated on EVERY load, before the wiring guard below.
  wrap.dataset.recordId = recordId
  // A popup still open from the previous record describes a record the user
  // has left. Drop it and its cache key rather than letting a stale answer
  // survive the switch.
  hideChevronPopup()
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
      positionChevronPopup(item, popup, wrap)
    }, TB_CHEVRON_HOVER_DELAY_MS)
  })

  // On the WRAPPER, so moving the pointer from a chevron into the popup is
  // not a leave. The chevron itself stays non-clickable - confirmed by
  // history in Round 5 Phases 7 and 8 that it has never had a click
  // handler, and adding hover must not add click.
  wrap.addEventListener('mouseleave', hideChevronPopup)
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

// Round 25 Phase 5: the lens vocabulary, fetched ONCE for the page rather than
// per record. Lenses are global reference data, so a per-record fetch would
// re-ask the same question on every opportunity opened.
//
// Caching it here is what keeps the sub-tab mount cheap enough to run on
// record load: the first opportunity pays one small request and every one
// after it mounts synchronously. Round 22 measured a one-second window where a
// stage panel was on screen with its control not yet rendered, and this avoids
// the same shape by not putting a fetch between the tab and its strip.
let oppLenses = null
let oppLensesPromise = null

async function ensureOppLenses() {
  if (oppLenses) return oppLenses
  if (!oppLensesPromise) {
    oppLensesPromise = api('GET', '/api/scoring-lenses').then(r => {
      oppLensesPromise = null
      if (!r.ok) return null
      oppLenses = r.data
      return oppLenses
    })
  }
  return oppLensesPromise
}

// The four lens sub-tabs inside the Assessment tab.
//
// createSubTabs is a five-key destructuring allowlist: mount, tabs, label,
// adopt, onSelect. A sixth key is discarded with no error, so this passes only
// keys the function reads. Read from the definition rather than from its two
// existing consumers, which pass different subsets between them.
//
// KEYS ARE SANITISED even though the four lens names have no spaces today.
// createSubTabs builds its pane ids as `${mount.id}-pane-${key}` from the RAW
// key, so a lens renamed to two words would produce an id that getElementById
// resolves and every CSS selector misses. That is Round 21 Phase 7 exactly,
// and it costs one replace to make impossible rather than to remember.
function oppLensKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
}

// Round 25 Phase 6: the Opportunity assessment panel.
//
// THE SHAPE IS TAKEN FROM renderTbScores AND THE FUNCTION IS NOT. That function
// is 187 lines bound to eleven module-level variables in test-bed-detail.js
// plus six references to measurabilityConfirmed, so it is Test Bed's panel
// rather than a panel. What is taken: current value from the newest entry,
// a select of levels, the anchor block on demand, a reason box whose
// obligation comes from the level, and history behind a count. What is left:
// every one of those module variables, the measurability special case, the
// tbEdits integration, and the shared save bar.
//
// CRITERIA ARE CACHED PER PAGE, not per record. They are reference data for
// the record type, and the record's own scores travel in opp.payload, which
// GET /api/opportunities/:id already returns. So after the first opportunity
// there is no fetch at all between opening the tab and seeing the panel.
let oppCriteria = null
let oppCriteriaPromise = null
const oppAssessDraft = {}
const oppAssessReason = {}
const oppAssessOpen = {}
// Round 28 Phase 6 added oppAssessHistoryOpen here, as record state that had to
// join the list cleared on a record change. Round 30 Phase 4 retires it with
// the second control: one control has one state, and the clearing list loses
// the entry in the same edit that removes the map rather than keeping a name
// nothing writes.
const oppAssessAnswer = {}   // criterion_key -> { amount, currency }

async function ensureOppCriteria() {
  if (oppCriteria) return oppCriteria
  if (!oppCriteriaPromise) {
    oppCriteriaPromise = api('GET', '/api/scoring-criteria?record_type=opportunity').then(r => {
      oppCriteriaPromise = null
      if (!r.ok) return null
      oppCriteria = r.data
      return oppCriteria
    })
  }
  return oppCriteriaPromise
}

function oppAssessSeries(key) {
  const v = currentOppPayload?.[key]
  return Array.isArray(v) ? [...v].sort((a, b) => String(a?.at).localeCompare(String(b?.at))) : []
}

// Round 30 Phase 2: the record's own current answer for a criterion, and the
// reason that was given for it.
//
// These exist because the reason field is now PRESENT AT REST and PREFILLED.
// Before this phase the field was emitted only for a criterion with a pending
// draft, so reaching one reason took three steps and the level was necessarily
// restated; and the field it produced was empty, so "go back and correct one
// field" meant retyping 192 characters that were already on the screen.
function oppAssessCurrent(key) {
  const s = oppAssessSeries(key)
  return s.length ? s[s.length - 1] : null
}
function oppAssessStoredReason(key) {
  return String(oppAssessCurrent(key)?.reason ?? '')
}
// The field always holds text, so "has a reason" can no longer mean dirty.
// Dirty means the text DIFFERS from what the record already says.
function oppAssessReasonEdited(key) {
  return oppAssessReason[key] !== undefined
    && String(oppAssessReason[key]) !== oppAssessStoredReason(key)
}
// The level this save would record: the drafted one, or the record's own when
// only the reason was corrected. Undefined means the criterion has never been
// assessed and a reason alone cannot be recorded against it.
function oppAssessEffectiveLevel(key) {
  if (oppAssessDraft[key] !== undefined) return oppAssessDraft[key]
  const cur = oppAssessCurrent(key)
  return cur ? cur.value : undefined
}

// THE VOCABULARY, decided here because this is the first Opportunity screen to
// need it and it therefore sets the precedent.
//
// Round A Phase 4 found two in use: the score path prompts "Score..." and
// reads "Not scored"; the hardcoded measurabilityConfirmed block prompts
// "Confirm..." and reads "Not confirmed". Neither fits.
//
// "Score" implies a number, and these levels are named states: a select
// prompting "Score..." above Not applicable, Unknown, Our hypothesis, Buyer
// confirmed, Verified reads as though a number were being asked for.
// "Confirm" implies two outcomes and is wrong for five ordered ones.
//
// Chosen: "Assess..." and "Not assessed", after the instrument the business
// calls it. It fits five-level and binary alike, so when measurabilityConfirmed
// migrates it has a target that covers it rather than one that covers half the
// treatments. THIS IS DELIBERATELY A THIRD STRING and the reconciliation is
// still owed: it is the one to converge on, not one more to choose between.
//
// Round 30 Phase 3: OPP_ASSESS_PROMPT is gone with the select it was the
// placeholder for. Five visible segments have nothing to prompt: an empty
// group reads as nothing chosen without being told so.
//
// OPP_ASSESS_NONE STAYS AND KEEPS A JOB. Deleting it would retire the
// vocabulary note above along with it, and that note records a reconciliation
// this project still owes: three strings are in use for one idea, and this is
// the one to converge on rather than one more to choose between.
//
// Round 30 Phase 4 moved the job. It was on the under-row, which no longer
// exists; it now answers the "This assessment" section for a criterion nobody
// has assessed. Same string, and a better place for it: the five empty
// segments already say a criterion is unassessed, but they say it by silence,
// and a section that reads as blank looks like a failed render.
const OPP_ASSESS_NONE = 'Not assessed'

function renderOppAssessCriterion(c) {
  const series = oppAssessSeries(c.criterion_key)
  const current = series.length ? series[series.length - 1] : null
  const levels = Array.isArray(c.levels) ? c.levels : []
  const labelFor = v => levels.find(l => l.value === v)?.label ?? String(v)
  const anchorSet = c.anchors?.[c.current_version] ?? {}

  // Round 28 Phase 3: DISPLAY PRECEDENCE. A per-criterion anchor at this
  // criterion's current version wins; the scale's generic description is the
  // fallback. Every Commercial criterion carries anchors today, so this renders
  // exactly what it rendered before until an override is retired, and retiring
  // one is a decision the business has not yet taken.
  //
  // NO COUNT IN THIS SENTENCE, deliberately. It read "the seven Commercial
  // criteria" until Round 41 configured an eighth, at which point the sentence
  // was false about the count while still true about the claim that matters.
  // The claim is policed: INVARIANT 8 asserts anchors on any criterion a gate
  // rule names, and score-entry refuses a score against a criterion with none.
  //
  // ONLY FOR THE CURRENT DEFINITION BLOCK. Never for a historical entry: the
  // description is not versioned, so a later edit to it would silently restate
  // every past judgement in wording it was not made against, which is the one
  // thing anchor versioning exists to prevent.
  const wordingFor = l => anchorSet[l.value] ?? l.description ?? ''

  // AN UNANCHORED CRITERION, decided here.
  //
  // Round A Phase 4 found it renders as blank rows and the literal "Version
  // null". It is reachable: INVARIANT 8 covers only payload_field_required
  // rules, so a criterion pulled in by a rollup, or visible and ungated, can
  // carry no anchors at all.
  //
  // Decided: say so and REFUSE THE INTERACTION. The score endpoint answers 409
  // to a criterion with no anchors, so a select offered here is one that cannot
  // succeed, and an interaction guaranteed to fail is worse than a disabled one
  // that explains itself.
  const unanchored = c.current_version == null || !Object.keys(anchorSet).length

  // ── Round 30 Phase 3: THE FIVE LEVELS, VISIBLE ──────────────────────────
  //
  // The select is gone and so is the separate value cell, and they go together
  // because they were the same fact in two places: at rest one said "Buyer
  // confirmed" and the other said "Revise...", and the moment you drafted the
  // level it already held, both read "Buyer confirmed". 342px of a 876px row
  // to say one thing twice.
  //
  // ONE CLICK RATHER THAN TWO. A native select is one click to open and one to
  // choose, and it cannot be fewer, because the options do not exist until it
  // is open. Five segments are one click on the level you want, and the target
  // is visible before you reach for it, which is what "direct access to one
  // field without a sequence" asks for.
  //
  // Real radio inputs rather than buttons wearing role="radio", so arrow-key
  // navigation, the group semantics and the checked state are the platform's
  // rather than this file's.
  //
  // THE RECORDED LEVEL IS STILL LEGIBLE WHILE A DRAFT IS OPEN. The filled
  // segment is what the row now says; the one the record actually holds keeps
  // a marker underneath it, so a draft never hides what it is replacing. When
  // nothing is drafted they are the same segment and only the fill shows.
  const effective = oppAssessEffectiveLevel(c.criterion_key)
  const recordedValue = current ? current.value : undefined
  // Round 32 Phase 2: GENERALISED, on the business's decision, and the constant
  // that scoped it is retired.
  //
  // Round 31 Phase 3 prototyped the level definitions on one criterion and
  // Phase 6 measured what widening the gate would cost: six DOM nodes and no
  // layout change at all. The business had already approved the widening in
  // Round C's brief, and Round C has not started, so a round that left one row
  // hovering differently from the other six would have shipped the worse of the
  // two end states for no gain.
  //
  // WHAT REMAINS IS THE ANCHOR GUARD, and it is the real condition. A criterion
  // with no anchors at its current version has no wording to show, so hovering
  // its segments would open an empty box. That was always the substantive half
  // of this expression; the criterion key was the prototype's scaffolding.
  const hoverDefs = !unanchored

  const levelGroup = `
    <div class="opp-assess-levels" role="radiogroup" aria-label="${escHtml(c.name)}"${unanchored ? ' data-unanchored="1"' : ''}${
      // Round 32 Phase 1: the wrapper declares whether the LEVEL hover is wired
      // on this row. hideOppAssessDefn falls back to a focused segment, and now
      // that the popup exists on every row that fallback would have
      // generalised the level definitions to rows Round 31 Phase 6 deliberately
      // left without them. The gate has to be readable from the DOM because the
      // fallback runs from the element, not from this closure.
      hoverDefs ? ' data-level-hover="1"' : ''}${
      // MOUSELEAVE ON THE WRAPPER, not on each segment. Section 8's third
      // property, and the one that transfers unchanged: leaving one segment for
      // the next inside the same group is not a leave, and binding per segment
      // would hide and re-show the popup on every boundary crossed.
      hoverDefs ? ' onmouseleave="hideOppAssessDefn()"' : ''}>
      ${levels.map(l => {
        const id = `opp-assess-lv-${escHtml(c.criterion_key)}-${escHtml(String(l.value))}`
        const on = effective !== undefined && String(effective) === String(l.value)
        const wasRecorded = recordedValue !== undefined && String(recordedValue) === String(l.value)
        // Round 31 Phase 3: the criterion and the level ride ON THE ELEMENT.
        //
        // INTERACTION_STANDARDS section 8 records this as the lesson that cost
        // four rounds to learn: the chevron popup closed over its record and
        // keyed its cache on stage name alone, which is correct for the first
        // record opened in a page session and wrong for the second. A handler
        // reads what it is pointing at, never what it was built holding.
        //
        // The wording itself is NOT put in an attribute. It is already in the
        // client on oppCriteria, and duplicating it into the DOM would make the
        // markup a second copy to go stale against the anchors it came from.
        return `<input type="radio" class="opp-assess-level-input" name="opp-assess-lv-${escHtml(c.criterion_key)}"
                  id="${id}" value="${escHtml(String(l.value))}"${on ? ' checked' : ''}${unanchored ? ' disabled' : ''}
                  data-criterion="${escHtml(c.criterion_key)}" data-level="${escHtml(String(l.value))}"
                  onchange="setOppAssessDraft('${escHtml(c.criterion_key)}', this.value)"${hoverDefs ? `
                  onfocus="showOppLevelDefinition(this)" onblur="hideOppAssessDefn()"` : ''}>
                <label class="opp-assess-level${wasRecorded ? ' opp-assess-level--recorded' : ''}" for="${id}"
                  data-criterion="${escHtml(c.criterion_key)}" data-level="${escHtml(String(l.value))}"${hoverDefs ? `
                  onmouseover="showOppLevelDefinition(this)"` : ''}>${escHtml(String(l.label))}</label>`
      }).join('')}
    </div>`

  // Round 28 Phase 6: CLOSED UNLESS ASKED FOR, and back to two states.
  //
  // Phase 2 kept a default of "open while a draft is in progress", inherited
  // from a panel where each criterion saved on its own. Measured here with one
  // save for the panel: drafting all seven took the pane from 1849px to 4131px,
  // which hands back more than the close control ever bought.
  //
  // BOTH auto-open routes go, and the measurement is what showed the second one
  // mattered. The named suspect was the draft default, and it does fire: with
  // the state undecided and a draft present, seven blocks opened. But on the
  // path a person actually takes it never gets the chance, because focusing the
  // select to choose a level already opened the block. Removing the draft
  // default alone would have changed nothing a scorer would see.
  //
  // The reveal-on-focus existed because before Phase 2 there was no control at
  // all. There is one now, labelled, so opening a 200 to 400px block because
  // the cursor landed on a select is a surprise rather than a service.
  // Round 30 Phase 4: ONE open flag, because there is one control. Two states
  // for one control is a second source of truth waiting to disagree.
  const detailOpen = !!oppAssessOpen[c.criterion_key]
  // Round 28 Phase 6: the CURRENT assessment stays exactly where Round 26
  // Phase 1 put it, prominent and unconditional, reason and author and
  // timestamp. Only the earlier ones go behind a control. That distinction is
  // the whole of Round 26's finding: the reason is what a bid review
  // challenges, and the current one is precisely the one that gets challenged.

  // Round 30 Phase 4: the definitions are a SECTION now, not a control plus a
  // section. Their control has merged with the history's, and the merge is
  // forced by width rather than chosen for tidiness: see the criterion cell
  // below.
  const anchors = unanchored
    ? '<p class="opp-assess-note">No level definitions are recorded for this criterion yet, so it cannot be assessed.</p>'
    : `<p class="opp-assess-detail-h">Level definitions</p>
       <div class="opp-assess-anchors" id="opp-assess-anchors-${escHtml(c.criterion_key)}">
         ${levels.map(l => `
           <span class="opp-assess-anchor-n${wordingFor(l) ? '' : ' opp-assess-anchor--nowording'}">${escHtml(String(l.label))}</span>
           <span class="opp-assess-anchor-t">${escHtml(wordingFor(l))}</span>`).join('')}
         <p class="opp-assess-ver" style="grid-column:1/-1">Definition version ${escHtml(String(c.current_version))}</p>
       </div>`

  // Round 30 Phase 3, found while clearing up after Phase 2: THE "(REQUIRED)"
  // AFFORDANCE HAD GONE. It lived on the reason box's own <label>, and Phase 2
  // moved the reason on to the row and dropped the label with it, so the rule
  // was still enforced and no longer announced: the first a person heard of it
  // was the save refusing. mustGiveReason survived as a local nothing read,
  // which is what surfaced it.
  //
  // It reads from the DRAFTED level where there is one and the recorded level
  // otherwise, because a criterion already carrying an entry requires a reason
  // for its next one whatever is chosen.
  const effectiveForReason = oppAssessEffectiveLevel(c.criterion_key)
  const chosen = levels.find(l => String(l.value) === String(effectiveForReason))
  const mustGiveReason = !!chosen?.reason_required || series.length > 0
  // Round 26 Phase 3: the answer inputs, on the one criterion that carries one.
  //
  // Inside the draft area beside the reason, because the amount is part of the
  // same act as choosing the level and is recorded with it, not separately.
  const answerDraft = oppAssessAnswer[c.criterion_key] ?? {}
  // Round 31 Phase 4: DECLARED HERE, not further down where Round 30 Phase 2
  // left it. The inline value reads it, and a const declared after its first
  // reader is a temporal dead zone: renderOppAssessCriterion threw "Cannot
  // access 'dirty' before initialization" on the one criterion scoped into the
  // prototype, which is the only one whose branch reaches it.
  const dirty = oppAssessDraft[c.criterion_key] !== undefined || oppAssessReasonEdited(c.criterion_key)

  // ── Round 31 Phase 4: THE VALUE, INLINE, IN TWO STATES ──────────────────
  //
  // The brief treated the value as one thing. Measured it is two, and the
  // difference is 3x: as text it is 86px, as the two controls it is 260px, and
  // at 1920 the reason cell after it is 717px or 543px accordingly.
  //
  // TEXT AT REST, CONTROLS WHEN DRAFTING, and the reason is not that it is the
  // obvious shape. At rest the value is RECORDED DATA and reads like the level
  // beside it; while drafting it is an INPUT and needs room to type in. Giving
  // both states the wider treatment would take 174px from this row's reason at
  // all times to serve a state that exists only while somebody is editing. And
  // this criterion is the one that already carries the longest real reason in
  // the fixture, so it is the row that can least afford the permanent cost.
  //
  // The 260px does not fit the head line at 1240, where 137px remains after
  // the criterion cell and the segments. It wraps, which is what the row
  // already does with the reason at that width, and the wrapped line then
  // carries the controls and the reason together.
  const answerText = current?.answer
    ? `${escHtml(current.answer.currency)} ${escHtml(Number(current.answer.amount).toLocaleString('en-GB'))}`
    : ''
  const answerBox = c.criterion_key !== OPP_VALUE_CAPTURE_KEY ? '' : `
    <span class="opp-assess-answer">
      <input type="text" inputmode="decimal" id="opp-assess-amount-${escHtml(c.criterion_key)}"
        aria-label="Budget figure, optional"
        value="${escHtml(String(answerDraft.amount ?? current?.answer?.amount ?? ''))}" placeholder="Budget figure"
        oninput="setOppAssessAnswer('${escHtml(c.criterion_key)}', 'amount', this.value)">
      <select id="opp-assess-currency-${escHtml(c.criterion_key)}"
        aria-label="Currency"
        onchange="setOppAssessAnswer('${escHtml(c.criterion_key)}', 'currency', this.value)">
        ${CURRENCY_CODES.map(x => `<option value="${x}"${(answerDraft.currency ?? current?.answer?.currency ?? 'SGD') === x ? ' selected' : ''}>${x}</option>`).join('')}
      </select>
    </span>`

  // Round 31 Phase 7: GATED BY WHICH CRITERION CARRIES A VALUE, not by which
  // one the round prototyped on.
  //
  // Phase 4 scoped this with OPP_HOVER_DEFINITIONS_KEY so Phase 6 would decide
  // one thing rather than hunt for two, and Phase 6 found that reasoning was
  // the wrong way round: there is nothing here to generalise, because one
  // criterion of seven carries an answer and the other six render nothing in
  // this position in either state. The scope is permanent, and its reason is
  // the value rather than the prototype.
  //
  // Round 32 Phase 2: THE SECOND OF THOSE TWO CASES HAS NOW HAPPENED. Phase 7
  // wrote that this gate would stop agreeing with the hover's the moment a
  // round generalised the hover and retired OPP_HOVER_DEFINITIONS_KEY. That
  // round is this one, and because the gate had already been re-pointed the
  // retirement moved the hover to seven criteria and left the value on one,
  // which is the intended behaviour and would not have been the behaviour a
  // round earlier.
  //
  // OPP_VALUE_CAPTURE_KEY is what answerBox and the two save paths already
  // use, so this is one gate for one fact rather than a second that agrees.
  const valueInline = c.criterion_key !== OPP_VALUE_CAPTURE_KEY ? ''
    : dirty ? answerBox
    : (answerText ? `<span class="opp-assess-value-inline">${answerText}</span>` : '')

  // Round 30 Phase 2: only the amount inputs are conditional now. The reason
  // moved on to the row, and the Record and Cancel buttons went to the shared
  // bar in Round 28 Phase 5. The per-criterion FEEDBACK line stays: a batch
  // that partly fails has to say which criterion failed, beside that
  // criterion, and one line on the bar cannot do that for four of seven.
  // The amount controls are on the ROW now, so what is left below it is the
  // per-criterion failure message alone.
  const reasonBox = `
    <span class="opp-assess-feedback" id="opp-assess-feedback-${escHtml(c.criterion_key)}"></span>`

  // Round 26 Phase 1: THE CURRENT ENTRY GETS ITS OWN BLOCK.
  //
  // The defect the business reported as "displaying 1 save behind" was not a
  // stale render: the payload refreshes correctly and the value was always
  // right. It was that `series.slice(0, -1)` excludes the newest entry from
  // the history and nothing else rendered it, so the current assessment's
  // REASON, AUTHOR and TIMESTAMP were absent from the screen entirely. Only
  // its level showed. Reproduced with three saves carrying distinct reason
  // strings, because two entries can share a displayed minute and timestamps
  // could not have separated them.
  //
  // Not fixed by unhiding the newest history row. OPPORTUNITY_DESIGN.md is
  // explicit that the reason must be shown PROMINENTLY, because the reason is
  // what a bid review challenges and the number is not; the current one is
  // precisely the one that gets challenged. A row at the top of a collapsed
  // list is present, not prominent.
  //
  // So the reason sits directly under the criterion, in reading colour, with
  // its author and time beneath in a quieter treatment. History keeps its
  // meaning as what the assessment USED to say, which is why slice(0, -1)
  // stays: the newest entry is above it now, not missing.
  //
  // An entry with no reason is legitimate: Not applicable requires none. It
  // says so rather than rendering an empty quote, because a blank space reads
  // as a failed render.
  // Round 30 Phase 2: THE REASON PARAGRAPH IS GONE FROM HERE, because the
  // reason is now an editable cell on the row itself. Rendering the same
  // sentence twice, once as prose and once inside the box you must type into,
  // is not a design; and Round 26's requirement that the current reason be
  // PROMINENT is better served by the widest cell on the row than by a quote
  // beneath it.
  //
  // What remains is who and when, and the figure where one was recorded. The
  // ANSWER JOINS THEM rather than taking a column: one criterion of seven
  // carries a value, so a column for it is empty on six rows, and at 1240 the
  // 876px row cannot spare the width. It belongs beside the author and the
  // timestamp because it is the same kind of fact, a property of the entry
  // that recorded it, which is Round 26 Phase 3's own reasoning for why it is
  // not carried forward onto later entries.
  // Round 30 Phase 4 put the figure on this line, on Round 26 Phase 3's
  // reasoning that it belongs to the ENTRY rather than the criterion. That
  // reasoning is untouched and it is still the current entry's figure; what
  // changed is where the entry's figure is READ. Behind a disclosure it was a
  // recorded money figure nobody could see without opening something, and
  // Round 15 Phase 4 is this project's record of what happens when the thing
  // whose whole purpose is to be read is given the quiet treatment.
  //
  // It LEAVES here rather than appearing in both places. A move is two claims.
  const currentBlock = !current ? `<p class="opp-assess-current-meta opp-assess-current-meta--none">${OPP_ASSESS_NONE}</p>` : `
    <p class="opp-assess-current-meta">${escHtml(current.by ?? '--')} &middot; ${escHtml(formatDateTime(current.at))}</p>`

  const earlier = series.length - 1
  const history = series.length > 1 ? `
    <p class="opp-assess-detail-h">${earlier} earlier assessment${earlier === 1 ? '' : 's'}</p>
    <div class="opp-assess-history" id="opp-assess-history-${escHtml(c.criterion_key)}">
      ${series.slice(0, -1).reverse().map(e => `<div class="opp-assess-entry"><span>${escHtml(formatDateTime(e.at))}</span><span>${escHtml(labelFor(e.value))}</span>${
        e.answer ? `<span class="opp-assess-entry-answer">${escHtml(e.answer.currency)} ${escHtml(Number(e.answer.amount).toLocaleString('en-GB'))}</span>` : ''
      }<span>${escHtml(e.reason ?? '')}</span></div>`).join('')}
    </div>` : ''

  // ── Round 30 Phase 2: THE ROW ──────────────────────────────────────────
  //
  // Four columns, three of them fixed, so seven criteria read as a grid rather
  // than as seven differently-shaped blocks. The reason takes what is left,
  // which puts the widest and most variable thing where the empty space
  // actually is: 676px of the pane at 1920 and 2196px at 3440.
  //
  // THE QUESTION COMES OFF THE ROW, and this is a departure from the brief's
  // proposed shape, which asked for "name and question in the left column".
  // Measured, it cannot be: name plus question is 521px at its worst, and with
  // the level label and the select that is 848px of the 876px a 1240 pane has,
  // leaving 28px for the reason. The question is static reference text,
  // identical on every record forever, so it goes where the rest of this
  // criterion's reference text already lives, the definitions block, and stays
  // reachable on hover without opening anything.
  //
  // THE NAME IS A FIXED COLUMN, which is Round 12 Phase 2's decision on Test
  // Bed taken deliberately rather than by coincidence. Its comment says the
  // eye travel from a criterion to its own score must not be set by the panel
  // width, "and is also why it is not a width problem to be solved by capping
  // the panel". Opportunity gave the name flex: 1 1 auto and capped the panel
  // at 880px, which is the opposite of both halves, and received the complaint
  // Round 12 was avoiding. The number differs because the names differ: Test
  // Bed borrows .ref-field-label's 170px, and "Competition, including
  // do-nothing" alone measures 227px.
  return `
    <div class="opp-assess-criterion" data-criterion="${escHtml(c.criterion_key)}" data-entries="${series.length}"${dirty ? ' data-dirty="1"' : ''}>
      <div class="opp-assess-row">
        ${/* Round 32 Phase 1: ONE POPUP PER ROW, and it is no longer gated on the
             criterion Round 31 prototyped the level hover on.

             The element now carries two different strings for two different
             targets: the criterion's question, hovered on the name, on every
             row; and a level's definition, hovered on a segment, on the one
             criterion Round 31 Phase 6 left it scoped to. Sharing the element
             is what makes them mutually exclusive BY CONSTRUCTION rather than
             by a rule somebody has to keep. Two elements could both be open,
             which the brief correctly called a state nobody had designed. */''}
        <div class="opp-assess-defn hidden" id="opp-assess-defn-${escHtml(c.criterion_key)}" role="tooltip" aria-hidden="true"></div>
        ${/* Round 30 Phase 4: THE CONTROL LIVES IN THE CRITERION CELL, and the
             position is the whole reason the merge happens.

             Measured: the under-row is 27px plus a 6px gap, 231px across seven
             criteria, and a third of the row height at 1920. It only goes away
             if its controls move on to the row, and the row has no width to
             give: a control at the end costs 38px of the reason cell and drops
             two of the six reasons that read whole on one line. Widening the
             criterion cell from 240 to 250 costs 10px and drops none, because
             the widest name measures 227px and the cell had spare.

             So ONE control rather than two, and the reason is arithmetic
             rather than the brief's preference for one link over two. Two
             chevrons in 22px would be indistinguishable from each other
             anyway; two LABELLED controls need 237px the row does not have.

             The count stays on the outside, because it is the one thing the
             collapsed row should still say: definitions always exist and are
             not news, who and when is not news, but "this judgement has moved
             twice" is. */''}
        <span class="opp-assess-crit">
        ${/* Round 32 Phase 1: THE AFFORDANCE IS THE FIX, and the popup is how it
             pays off.

             The `title` that stood here was added by Round 30 Phase 2 and was
             never removed: measured in Phase 0, present on all seven names at
             both widths, carrying the right question. The business still could
             not find it, and "a title is too quiet" turned out to be the wrong
             diagnosis. Measured on the live element, the name reported
             `cursor: auto`, `tabIndex: -1` and no underline. NOTHING ON THE ROW
             SAID THE NAME WAS HOVERABLE, so finding the question required
             resting a pointer on a word that gave no reason to rest there.

             So the underline is not decoration, it is the whole repair. DOTTED
             rather than solid, because this stylesheet already spends a solid
             underline on things you click: `.doc-link` and `.anchors-toggle`
             both pair one with `cursor: pointer` and a colour change. A solid
             underline here would promise a navigation that does not exist.
             `cursor: help` is the other half and it is the conventional half.

             THE TITLE IS REMOVED, not superseded. Leaving it would ship both:
             the popup on hover and the OS tooltip about a second later, on top
             of it. That is Verification 7's move claim, and the second half of
             it gets its own assertion.

             REMOVING IT WOULD OTHERWISE COST SCREEN READERS THE QUESTION, since
             the name is not focusable and the popup only exists while hovered.
             `aria-describedby` against a visually hidden span puts the question
             back where a title had it, permanently rather than on an event, and
             adds no tab stop. Hover only is a decision this round took on
             measurement: seven spans made focusable would be seven new tab
             stops in a panel the business has already said gains nothing from
             the keyboard, and the disclosure carries the question one
             reachable chevron away. */''}
          <span class="opp-assess-name${c.asks ? ' opp-assess-name--asks' : ''}" data-criterion="${escHtml(c.criterion_key)}"${c.asks ? `
            aria-describedby="opp-assess-q-${escHtml(c.criterion_key)}"
            onmouseover="showOppCriterionQuestion(this)" onmouseleave="hideOppAssessDefn()"` : ''}>${escHtml(c.name)}</span>${
            c.asks ? `<span class="visually-hidden" id="opp-assess-q-${escHtml(c.criterion_key)}">${escHtml(c.asks)}</span>` : ''}
          <button type="button" class="opp-assess-more" id="opp-assess-more-${escHtml(c.criterion_key)}"
            aria-expanded="${detailOpen ? 'true' : 'false'}" aria-controls="opp-assess-detail-${escHtml(c.criterion_key)}"
            title="${detailOpen ? 'Hide' : 'Show'} definitions, history and who recorded this"
            onclick="toggleOppAssessDetail('${escHtml(c.criterion_key)}')"><span class="opp-assess-more-c" aria-hidden="true"></span>${
              series.length > 1 ? `<span class="opp-assess-more-n">${series.length - 1}</span>` : ''
            }<span class="visually-hidden">${detailOpen ? 'Hide' : 'Show'} details for ${escHtml(c.name)}</span></button>
        </span>
        ${levelGroup}
        ${valueInline}
        ${/* PRESENT AT REST AND PREFILLED. Zero of seven reason fields existed
             before this phase, so amending one reason cost three steps and
             restated the level; and the field, once reached, was empty while
             the text it was replacing sat on the screen above it. Both of
             those are this element. */''}
        <textarea class="opp-assess-reason-cell" id="opp-assess-reason-${escHtml(c.criterion_key)}" rows="1"
          aria-label="Reason for ${escHtml(c.name)}"${unanchored ? ' disabled' : ''}
          placeholder="${mustGiveReason ? 'Reason (required)' : 'Reason'}"
          onfocus="growOppAssessReason(this)" onblur="resetOppAssessReason(this)"
          oninput="setOppAssessReason('${escHtml(c.criterion_key)}', this.value); growOppAssessReason(this)">${escHtml(oppAssessReason[c.criterion_key] ?? oppAssessStoredReason(c.criterion_key))}</textarea>
      </div>
      ${/* OUTSIDE the collapsed region, both of them, and for the same reason:
           they are about what is happening right now rather than about the
           criterion's background. The amount inputs only exist while a draft
           is open, and a save that fails for one criterion has to say so
           beside that criterion; a message rendered inside a collapsed block
           would be a refusal nobody saw. The feedback span collapses to
           nothing when empty rather than holding a line open. */''}
      ${reasonBox}
      ${/* Round 30 Phase 4, after opening it and looking: THREE SECTIONS EACH
           NEED A HEADING, and the first cut gave two of them one. The
           provenance line floated at the top with nothing saying what it was,
           and the question sat between the definitions grid and its own
           version line, an orphan sentence in the middle of a block about
           something else.

           The question LEADS, because it is what the criterion asks and the
           rest of the region is the answer to it: what the levels mean, what
           this record says, and what it used to say. */''}
      <div class="opp-assess-detail${detailOpen ? '' : ' hidden'}" id="opp-assess-detail-${escHtml(c.criterion_key)}">
        ${c.asks ? `<p class="opp-assess-asks">${escHtml(c.asks)}</p>` : ''}
        ${/* The heading is UNCONDITIONAL, so the section always answers the same
             question and "nothing yet" is an answer to it rather than an
             absence. That is also what keeps OPP_ASSESS_NONE doing a job: the
             five empty segments already say a criterion is unassessed, but
             they say it by silence, and a section that reads as blank looks
             like a failed render. */''}
        <p class="opp-assess-detail-h">This assessment</p>
        ${currentBlock}
        ${anchors}
        ${history}
      </div>
    </div>`
}

// Which criteria a lens shows: those visible AT THE RECORD'S CURRENT STAGE.
//
// Round A settled that visibility marks the stages a criterion can be answered
// at, and the Assessment tab is not a stage tab, so it needs a stage to mean
// anything. The record's own is the only defensible one: a criterion
// introduced at Proposal is not answerable on a record still in Qualification.
function renderOppAssessLens(pane, lensId) {
  const forLens = (oppCriteria ?? [])
    .filter(c => c.lens_id === lensId)
    .filter(c => (c.stages ?? []).some(st => st.stage === currentOppStage))
  if (!forLens.length) {
    pane.innerHTML = `<p class="empty-state">No criteria are configured for this lens at ${escHtml(currentOppStage ?? 'this stage')}.</p>`
    return
  }
  pane.innerHTML = forLens.map(renderOppAssessCriterion).join('')
}

window.setOppAssessDraft = function (key, value) {
  // Round 30 Phase 3: CHOOSING THE LEVEL THE RECORD ALREADY HOLDS IS NOT A
  // CHANGE. With a select this could not arise cleanly, because the control's
  // resting state was a "Revise..." placeholder rather than the current level;
  // with five visible segments the current one is right there to click, and
  // clicking it used to open a draft asserting what the record already said.
  // That is also where the duplicate reading came from in Phase 0: value cell
  // and control showing the same words, because the draft equalled the record.
  const cur = oppAssessCurrent(key)
  if (value === '' || (cur && String(cur.value) === String(value))) delete oppAssessDraft[key]
  else oppAssessDraft[key] = value

  // The lens re-renders, which replaces the radio that was just operated, so
  // keyboard focus would land back on the document and arrow-key navigation
  // through the group would stop after one step. The id is stable across the
  // render, so it is re-resolved rather than held: the same reasoning as the
  // save bar's feedback node in Round 28 Phase 7.
  const focused = document.activeElement?.id
  rerenderOppAssessLens()
  if (focused) document.getElementById(focused)?.focus()
}
// ── Round 31 Phase 3: the level definitions, on hover and on focus ────────
//
// NO FETCH, SO NO DEBOUNCE AND NO LOAD TOKEN. Section 8's first two properties
// exist because the chevron popup fetches: eight requests for one sweep, and
// responses arriving out of order. The wording here is already on oppCriteria,
// arriving with the criteria themselves, so there is no request to coalesce and
// no stale response that could paint. Copying them because the pattern has them
// would be carrying a remedy without its illness.
//
// The two that DO transfer are the identity read from the element, above, and
// the clamping below.
function oppLevelWording(criterionKey, levelValue) {
  const c = (oppCriteria ?? []).find(x => x.criterion_key === criterionKey)
  if (!c) return null
  const set = c.anchors?.[c.current_version] ?? {}
  const level = (c.levels ?? []).find(l => String(l.value) === String(levelValue))
  // The same precedence the definitions block uses, and for the same reason:
  // a per-criterion anchor at the CURRENT version wins, the scale's generic
  // description is the fallback. One resolution path, not two that agree today.
  const wording = set[levelValue] ?? set[Number(levelValue)] ?? level?.description ?? ''
  return wording ? { label: level?.label ?? String(levelValue), wording, version: c.current_version } : null
}

window.showOppLevelDefinition = function (el) {
  // READ FROM THE ELEMENT, never from anything this function was built holding.
  const key = el?.dataset?.criterion
  const value = el?.dataset?.level
  if (!key || value === undefined) return
  const box = document.getElementById(`opp-assess-defn-${key}`)
  if (!box) return
  const found = oppLevelWording(key, value)
  if (!found) return hideOppAssessDefn()

  box.innerHTML = `<span class="opp-assess-defn-l">${escHtml(found.label)}</span>${escHtml(found.wording)}`
  box.classList.remove('opp-assess-defn--asks')
  box.classList.remove('hidden')
  box.setAttribute('aria-hidden', 'false')

  // CENTRED THEN CLAMPED, section 8's positioning rule, which transfers because
  // the geometry is the same: measured at 1240 a left-aligned box on the
  // rightmost segment overhangs the pane by 62px. Clamped to the row, because
  // the row is the width the panel actually has.
  const row = box.parentElement
  const rr = row.getBoundingClientRect()
  const er = el.getBoundingClientRect()
  const bw = box.getBoundingClientRect().width
  const centred = (er.left - rr.left) + (er.width / 2) - (bw / 2)
  box.style.left = `${Math.max(0, Math.min(centred, rr.width - bw))}px`
  // Round 32 Phase 1: `top` IS SET HERE TOO, and it has to be. The element is
  // now shared with the question, which anchors to the name, so leaving this
  // path to the stylesheet would let the question's inline `top` leak into the
  // level definitions the next time one is shown.
  //
  // Having to set it fixed the same 1240 fault this popup already had: `top:
  // 100%` dropped it below the wrapped reason cell rather than under the
  // segments it explains. That was Round 31's, it predates this phase, and it
  // is repaired here because sharing the element made touching it unavoidable.
  const gr = el.closest('.opp-assess-levels').getBoundingClientRect()
  box.style.top = `${gr.bottom - rr.top}px`
}

// ── Round 32 Phase 1: the criterion's question, on the same element ───────
//
// SECTION 8 RE-DERIVED RATHER THAN COPIED, for the second time, and a copy
// would have been wrong twice.
//
// Floating rather than in-row TRANSFERS, and for the reason Round 31 gave:
// measured here at all three widths, an in-row question costs 36px on the row
// and moves every row below it down by 36px, under the pointer that asked for
// it.
//
// Identity read from the element TRANSFERS. The panel re-renders on every
// draft change, so anything this function was built holding can be stale by
// the time somebody hovers.
//
// CENTRING INVERTS. Round 31 centred and clamped because its target was a
// segment near the row's right edge, overhanging by 62px at 1240. A criterion
// name is the row's LEFTMOST element, and centring the box on it would start
// it 38px outside the pane at every width. Left aligned on the name is what
// the geometry asks for.
//
// AND THE CLAMP DOES NOT COME WITH IT, which this phase found by trying to
// prove the clamp could fire and failing. The comment that stood here said the
// clamp was kept because a long enough question would reach the right edge and
// Round C is about to add sixteen more questions. That was wrong, and it was
// wrong in the shape Round 31 Phase 0 recorded: a sentence typed into the code,
// derived from nothing, that nothing would have contradicted.
//
// Injected with a 400-character question, the box does not overhang. It wraps,
// because `.opp-assess-defn` is capped at `max-width: 420px` and the narrowest
// row measures 876px. The name is the row's first element, so the offset cannot
// be negative either. Both halves of `Math.max(0, Math.min(...))` were
// unreachable, and an unreachable guard reads as protection while providing
// none.
//
// THE CAP IS WHAT DOES THE WORK, and it is therefore load bearing. A round that
// raises or removes `max-width` on that rule puts the clamp back in scope.
// A SHOW DELAY, WHICH ROUND 31 REFUSED AND THIS PHASE MEASURED BACK IN.
//
// Phase 0 predicted the refusal would not transfer and this is the measurement.
// Round 31 refused a delay because it swept five ADJACENT SEGMENTS in 667ms and
// counted five shows on ONE box: the content changed in place, nothing hid
// between, and a delay would have been protecting against a flicker that did
// not exist.
//
// The same sweep down the name column reads 7 to 8 shows across SEVEN DISTINCT
// BOXES in 681ms, each shown and then hidden as the pointer left it. That is
// not one popup rewriting itself, it is seven popups opening and closing down
// the panel in under a second, and a pointer on its way to the save bar travels
// exactly that path.
//
// So the property does not merely fail to transfer, it inverts, which is the
// third of section 8's four to do so this round.
//
// 140ms, from the same measurement rather than from convention. The sweep
// crosses each name in about 97ms, so 140 suppresses all seven; a native title
// waits five to ten times longer, and that delay is part of what Phase 0
// diagnosed. HIDING IS NOT DELAYED. A tooltip that lingers after the pointer
// has left is a tooltip in the way.
let oppQuestionTimer = null
window.showOppCriterionQuestion = function (el) {
  // READ FROM THE ELEMENT, never from anything this function was built holding.
  // Read HERE and not inside the timer: the panel re-renders on every draft
  // change, so an element captured now can be detached 140ms from now, and the
  // key is what the timer actually needs.
  const key = el?.dataset?.criterion
  clearTimeout(oppQuestionTimer)
  if (!key) return
  oppQuestionTimer = setTimeout(() => oppShowCriterionQuestionNow(key), 140)
}

function oppShowCriterionQuestionNow (key) {
  const box = document.getElementById(`opp-assess-defn-${key}`)
  if (!box) return
  const asks = (oppCriteria ?? []).find(x => x.criterion_key === key)?.asks
  if (!asks) return hideOppAssessDefn()
  // RE-FOUND FROM THE DOM RATHER THAN CARRIED THROUGH THE TIMER, for the reason
  // above: a re-render between the hover and the fire would leave the captured
  // span detached, and a detached element measures 0 by 0 at the origin.
  const el = box.parentElement?.querySelector('.opp-assess-name')
  if (!el) return

  box.innerHTML = escHtml(asks)
  // THE QUESTION IS CONTENT, NOT SUPPORTING DETAIL, and the shared element
  // defaults to the treatment for supporting detail.
  //
  // Measured with the alpha composited: the box inherits `--muted` at alpha
  // 0.5, which puts the question at 4.83:1 against the popup's own background,
  // where the criterion name six pixels above it reads at 15.29:1. That clears
  // AA by a third of a point, at 12px, for the one sentence this phase exists
  // to make findable. It is Round 15 Phase 4's fault exactly: right place,
  // right words, and the least prominent treatment on the panel.
  //
  // The level definitions KEEP the muted treatment, because five of them are
  // read comparatively against each other and are genuinely supporting. Same
  // element, two roles, so the role is a modifier rather than a new box.
  box.classList.add('opp-assess-defn--asks')
  box.classList.remove('hidden')
  box.setAttribute('aria-hidden', 'false')

  // ANCHORED TO THE NAME, NOT TO THE ROW, which only looking at 1240 revealed.
  //
  // The CSS said `top: 100%`, and at 1920 the row is one line tall so the popup
  // landed six pixels under the name and was right. At 1240 the reason cell
  // wraps to its own line, the row is 110px tall, and `top: 100%` put the
  // question BELOW the reason and hard against the next criterion's name. It
  // read as labelling the row underneath it.
  //
  // Every programmatic check passed on that: shown, correct text, correct
  // identity, left aligned, no overhang. Position relative to the thing it
  // explains is not a property any of them named.
  const rr = box.parentElement.getBoundingClientRect()
  const er = el.getBoundingClientRect()
  box.style.left = `${er.left - rr.left}px`
  box.style.top = `${er.bottom - rr.top}px`
}

window.hideOppAssessDefn = function () {
  // Round 32 Phase 1: a PENDING show is cancelled here too. Without this a
  // pointer that crossed a name and left would still open its popup 140ms
  // later, over whatever the pointer had moved on to, which is the flicker the
  // delay exists to prevent arriving late instead of early.
  clearTimeout(oppQuestionTimer)
  for (const box of document.querySelectorAll('.opp-assess-defn')) {
    // A FOCUSED SEGMENT OUTLIVES A HOVERED ONE, which is the difference between
    // the two triggers and the reason this is not just classList.add('hidden').
    //
    // A pointer passing over the group while somebody is arrow-keying through
    // it would otherwise take their wording away and not give it back: the
    // mouseleave fires, the focus is still there, and nothing re-shows it. So
    // leaving falls back to whatever is focused, and only hides when nothing is.
    // Round 32 Phase 1: SCOPED TO A ROW THAT WIRES THE LEVEL HOVER. The popup
    // now exists on all seven rows, so an unscoped fallback would show level
    // definitions on the six Round 31 Phase 6 left without them, reached by a
    // path nobody wired, which is exactly the generalisation that phase
    // declined to make.
    const focused = box.parentElement?.querySelector('.opp-assess-levels[data-level-hover] .opp-assess-level-input:focus')
    // Round 34 Phase 1: `continue`, NOT `return`. This loop hides EVERY popup,
    // and the fallback is about one of them.
    //
    // `return` exits the function, so the first row carrying a focused segment
    // ended the sweep and every popup after it in document order was never
    // hidden. The business photographed five open at once, and five is what
    // eight rows leave behind when the third is focused.
    //
    // THE FALLBACK ITSELF IS RIGHT and is unchanged. A focused segment outlives
    // a hovered one, because a pointer crossing the group while somebody is
    // arrow-keying through it would otherwise take their wording away and never
    // give it back. That is a statement about ONE box; it was written with a
    // keyword that made it a statement about all of them.
    //
    // WHY NOBODY CAUGHT IT: it needs a focused segment, which a person acquires
    // by clicking a level and moving on, and which a deliberate hover test
    // never has. Round 32 Phase 1 verified this popup by hovering and its
    // verification was correct.
    //
    // ROW EXCLUSIVITY IS NOT NEEDED AND IS NOT ADDED. Round 32 made the
    // question and level popups exclusive WITHIN a row by sharing one element,
    // and left rows able to open independently. With the loop completing, every
    // hide sweeps every box, so a second row's popup can only survive through
    // this fallback, which is deliberate. Adding cross-row exclusivity would
    // suppress the one popup this fallback exists to protect.
    if (focused) { showOppLevelDefinition(focused); continue }
    box.classList.add('hidden')
    box.setAttribute('aria-hidden', 'true')
  }
}

// ── Round 31 Phase 5: the reason grows to its content ─────────────────────
//
// The cap is four lines, which is what Round 30 Phase 2 made the height. Its
// arithmetic holds and is reused: the visible band is padding-top plus whole
// lines, because `overflow` clips at the PADDING box and a bottom padding would
// show a slice of the next line. clientHeight runs two pixels under the
// declared height on this control, measured rather than derived, so the height
// set here is the content plus that two.
const OPP_REASON_MAX_H = 90   // 8 of padding + 4 lines of 20 + the 2

window.growOppAssessReason = function (el) {
  if (!el) return
  // 'auto' first, so scrollHeight reports the CONTENT rather than the box it is
  // already in. Without it a box that has grown can never shrink back as text
  // is deleted, because scrollHeight would keep returning the larger of the two.
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + 2, OPP_REASON_MAX_H)}px`
}
window.resetOppAssessReason = function (el) {
  // The inline height is REMOVED rather than set back to a number, so the rest
  // state stays the stylesheet's one line and there is one place that decides
  // what that is.
  if (el) el.style.height = ''
}

window.setOppAssessReason = function (key, value) {
  oppAssessReason[key] = value
  // Round 30 Phase 2: the bar is updated, the pane is NOT re-rendered. A
  // corrected reason is now a change on its own, so the bar has to count it;
  // and rerenderOppAssessLens rewrites the pane's innerHTML, which would
  // destroy the very textarea this keystroke came from. renderOppAssessSaveBar
  // mutates the bar in place, which is why it was written that way.
  const row = document.querySelector(`.opp-assess-criterion[data-criterion="${key}"]`)
  if (row) row.toggleAttribute('data-dirty', oppAssessDraft[key] !== undefined || oppAssessReasonEdited(key))
  renderOppAssessSaveBar()
}
// Held without re-rendering, like the reason: re-rendering on every keystroke
// would destroy the input the person is typing into.
window.setOppAssessAnswer = function (key, field, value) {
  oppAssessAnswer[key] = { ...(oppAssessAnswer[key] ?? {}), [field]: value }
}
window.cancelOppAssess = function (key) {
  delete oppAssessDraft[key]
  delete oppAssessReason[key]
  delete oppAssessAnswer[key]
  rerenderOppAssessLens()
}
// Round 28 Phase 6: revealOppAssessAnchors is GONE, along with the onfocus that
// called it. It existed to compensate for there being no visible control, and
// Phase 2 added one.

// The explicit control. DIRECT DOM MUTATION, NEVER A RE-RENDER, following
// showTbScoreAnchors' reasoning rather than this file's own previous habit:
// rerenderOppAssessLens rewrites the pane's innerHTML, which would destroy a
// reason textarea mid-sentence and drop the caret. The flag is set for later
// re-renders and this render is updated in place.
//
// Round 30 Phase 4: toggleOppAssessAnchorsOpen and toggleOppAssessHistory are
// one function, because they are one control. The direct DOM mutation is the
// part worth keeping and the reason is unchanged.
window.toggleOppAssessDetail = function (key) {
  const block = document.getElementById(`opp-assess-detail-${key}`)
  if (!block) return
  const open = block.classList.contains('hidden')
  oppAssessOpen[key] = open
  block.classList.toggle('hidden', !open)
  const btn = document.getElementById(`opp-assess-more-${key}`)
  if (btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    btn.setAttribute('title', `${open ? 'Hide' : 'Show'} definitions, history and who recorded this`)
    const sr = btn.querySelector('.visually-hidden')
    if (sr) sr.textContent = `${open ? 'Hide' : 'Show'} details for ${btn.closest('.opp-assess-criterion')?.querySelector('.opp-assess-name')?.textContent ?? 'this criterion'}`
  }
}

// ── Round 28 Phase 5: one save for the panel ────────────────────────────
//
// ASSESSMENT SCOPED, NOT RECORD WIDE, and the reasoning is recorded because
// the obvious precedent points the other way. Test Bed's equivalent is record
// wide: a score draft lands in tbEdits, the same dirty map every other Test
// Bed field uses, and #tb-save-all saves the lot. Opportunity has no such bar
// for scoring to join, and building one would mean unifying with
// opportunity-reference.js's own edit mechanism, which works. Unifying a
// working path with a new one is how working paths break. It would also be a
// half step toward the system-wide registry INTERACTION_STANDARDS.md Section 5
// specifies and that is explicitly not this round's, so it would be re-done
// rather than extended.
//
// THE REGISTRY IS DERIVED, NOT DECLARED. There is no oppEdits. The dirty set
// is read from oppAssessDraft, which already exists and already holds exactly
// this. A parallel map would be a second source of truth that agrees today,
// which is Architecture rule 3, and it would also need its own clearing on a
// record change. Because this is derived, Round 28 Phase 1's clearing of the
// three draft maps covers it for free.
function oppAssessDirtyKeys() {
  // Ordered by the criteria list rather than by insertion, so messages and
  // saves run in the order the panel displays.
  //
  // Round 30 Phase 2: a corrected reason is a change on its own. Before this
  // the only way to be dirty was to have chosen a level, which is why amending
  // a reason forced the level to be restated.
  return (oppCriteria ?? [])
    .map(c => c.criterion_key)
    .filter(k => oppAssessDraft[k] !== undefined || oppAssessReasonEdited(k))
}

function oppAssessNameFor(key) {
  return (oppCriteria ?? []).find(c => c.criterion_key === key)?.name ?? key
}

// Which dirty criteria still owe a reason. Pre-flight, and deliberately NOT
// the same thing as a partial failure: this refuses the batch before anything
// is written, because a reason is a rule the panel already knows, and firing
// seven requests to have some refused is worse than not firing them.
function oppAssessMissingReasons() {
  return oppAssessDirtyKeys().filter(k => {
    const c = (oppCriteria ?? []).find(x => x.criterion_key === k)
    const chosen = (c?.levels ?? []).find(l => String(l.value) === String(oppAssessDraft[k]))
    const mustGive = !!chosen?.reason_required || oppAssessSeries(k).length > 0
    if (!mustGive) return false
    const text = oppAssessReason[k] !== undefined ? String(oppAssessReason[k]) : oppAssessStoredReason(k)
    if (!text.trim()) return true

    // Round 30 Phase 2, and this is a guard the prefill would otherwise have
    // removed in silence. The check used to be "is the box non-empty", which
    // was correct for every caller it had, because the box started empty on
    // every revision. Prefilling makes that test pass by construction.
    //
    // So a CHANGE OF LEVEL on an already-assessed criterion now requires the
    // reason to differ from the one already recorded. Carrying the previous
    // reason forward onto a new level would record a judgement justified by
    // the reasoning for a different judgement, which is the one thing the
    // reason requirement exists to prevent. Correcting a reason on its own is
    // untouched: there is no new level to justify.
    const levelChanged = oppAssessDraft[k] !== undefined
      && String(oppAssessDraft[k]) !== String(oppAssessCurrent(k)?.value ?? '')
    return levelChanged && !oppAssessReasonEdited(k)
  })
}

// The mirror of the above, reachable only now that a reason can be typed
// against a criterion carrying no assessment at all: there is no level to
// record it against, and the endpoint would answer 400 seven times over.
// Refused before anything is written, like the missing reasons.
function oppAssessMissingLevels() {
  return oppAssessDirtyKeys().filter(k => oppAssessEffectiveLevel(k) === undefined)
}

// The bar is mutated in place, never re-rendered from a template that would
// replace the pane, because the pane holds a reason textarea the person may be
// typing into.
function renderOppAssessSaveBar() {
  const bar = document.getElementById('opp-assess-savebar')
  if (!bar) return
  const dirty = oppAssessDirtyKeys()
  bar.classList.toggle('hidden', dirty.length === 0)
  const count = document.getElementById('opp-assess-savebar-count')
  if (count) {
    count.textContent = dirty.length === 1
      ? '1 assessment ready to record'
      : `${dirty.length} assessments ready to record`
  }
}

window.cancelAllOppAssess = function () {
  for (const k of oppAssessDirtyKeys()) {
    delete oppAssessDraft[k]
    delete oppAssessReason[k]
    delete oppAssessAnswer[k]
  }
  // Synchronous, so this one was never at risk, but it resolves the node the
  // same way rather than leaving two habits in one file.
  const fb = document.getElementById('opp-assess-savebar-feedback')
  if (fb) { fb.textContent = ''; fb.className = 'opp-assess-savebar-feedback' }
  rerenderOppAssessLens()
}

// THE BATCH. Round 11A is the precedent and it is exact: .find() where
// .filter() was meant, so scoring five things and pressing Save once kept one
// and lost four, silently. The loop below runs over the WHOLE dirty array and
// its result is reported per key.
//
// SEQUENTIAL, NOT Promise.all. Every score appends a record revision through
// append_record_revision, which serialises writers for one record on an
// advisory lock, so parallel requests would queue there anyway. Sequential
// buys deterministic attribution: the nth failure belongs to the nth
// criterion, with no ambiguity about which request the server refused.
//
// A PARTIAL SAVE IS WORSE THAN A FAILED ONE. A criterion that failed stays
// dirty with its reason intact so it can be retried, the ones that succeeded
// are cleared, and the bar reports the failures by name rather than reporting
// success for the batch.
window.saveAllOppAssess = async function () {
  // Round 28 Phase 7: RESOLVED AT WRITE TIME, never captured once.
  //
  // This held `const fb = getElementById(...)` across the whole batch, and a
  // record load that overlapped the save replaced the bar underneath it:
  // mountOppAssessmentLenses rebuilds the bar because createSubTabs rewrites
  // the mount, so the node captured at the start was detached by the end.
  // Measured rather than reasoned about, by wrapping the handler and comparing
  // node identity across the call: sameNode false, beforeStillConnected false,
  // and the captured node holding "Recorded 1 of 1." while the live one was
  // empty. The writes had all succeeded; only the confirmation was posted to a
  // node nobody could see.
  //
  // A held DOM node is a second reference to something the app rebuilds, which
  // is the same shape as a declared dirty flag beside a derived one. Hold the
  // id, resolve the node.
  const setFb = (text, cls) => {
    const fb = document.getElementById('opp-assess-savebar-feedback')
    if (fb) { fb.textContent = text; fb.className = `opp-assess-savebar-feedback ${cls}` }
  }
  const keys = oppAssessDirtyKeys()
  if (!keys.length) return

  // Round 30 Phase 2: a reason typed against a criterion that has never been
  // assessed has no level to be recorded against. Refused here, before
  // anything is written, for the same reason the missing reasons are: firing
  // seven requests to have some answered 400 is worse than not firing them.
  const noLevel = oppAssessMissingLevels()
  if (noLevel.length) {
    setFb(`Choose a level for ${noLevel.map(oppAssessNameFor).join(', ')} before recording a reason. Nothing was recorded.`, 'msg-error')
    return
  }

  const missing = oppAssessMissingReasons()
  if (missing.length) {
    setFb(`A reason is required for ${missing.map(oppAssessNameFor).join(', ')}, and it must say something the recorded one does not. Nothing was recorded.`, 'msg-error')
    return
  }

  const btn = document.getElementById('opp-assess-savebar-record')
  if (btn) btn.disabled = true
  setFb(`Recording ${keys.length}...`, '')

  const failed = []
  let saved = 0
  for (const key of keys) {
    const a = oppAssessAnswer[key] ?? {}
    const sendAnswer = key === OPP_VALUE_CAPTURE_KEY && String(a.amount ?? '').trim() !== ''
    // Round 30 Phase 2: the field always holds text now, so an unedited reason
    // reads from the record rather than from the draft map, and a criterion
    // dirty only because its reason changed records the level the record
    // already carries instead of Number(undefined).
    const reason = String(oppAssessReason[key] ?? oppAssessStoredReason(key)).trim()
    const result = await api('POST', `/api/opportunities/${currentOppDetailId}/scores`, {
      criterion: key, score: Number(oppAssessEffectiveLevel(key)),
      ...(reason ? { reason } : {}),
      ...(sendAnswer ? { answer: { amount: Number(a.amount), currency: a.currency ?? 'SGD' } } : {}),
    })
    if (result.ok) {
      saved++
      delete oppAssessDraft[key]
      delete oppAssessReason[key]
      delete oppAssessAnswer[key]
    } else {
      // Left dirty ON PURPOSE, with the typed reason intact. Every refusal
      // this endpoint gives is correctable, and discarding the draft would
      // make the person retype to find that out.
      failed.push({ key, error: result.data?.error ?? 'unknown error' })
    }
  }

  // The server owns the series, so the panel re-reads it rather than guessing.
  const fresh = await api('GET', `/api/opportunities/${currentOppDetailId}`)
  if (fresh.ok) currentOppPayload = fresh.data.payload ?? {}
  rerenderOppAssessLens()
  if (btn) btn.disabled = false

  if (!failed.length) {
    setFb(`Recorded ${saved} of ${keys.length}.`, 'msg-ok')
  } else {
    setFb(`Recorded ${saved} of ${keys.length}. Not recorded: ${failed.map(f => oppAssessNameFor(f.key)).join(', ')}.`, 'msg-error')
    for (const f of failed) {
      const cell = document.getElementById(`opp-assess-feedback-${f.key}`)
      if (cell) { cell.textContent = f.error; cell.className = 'opp-assess-feedback msg-error' }
    }
  }
}

window.commitOppAssess = async function (key) {
  const value = Number(oppAssessDraft[key])
  const reason = String(oppAssessReason[key] ?? '').trim()
  const fb = document.getElementById(`opp-assess-feedback-${key}`)
  // The answer travels only for the criterion that carries one, and only when
  // an amount was actually typed: a blank input is not an answer of zero.
  const a = oppAssessAnswer[key] ?? {}
  const sendAnswer = key === OPP_VALUE_CAPTURE_KEY && String(a.amount ?? '').trim() !== ''
  const result = await api('POST', `/api/opportunities/${currentOppDetailId}/scores`, {
    criterion: key, score: value,
    ...(reason ? { reason } : {}),
    ...(sendAnswer ? { answer: { amount: Number(a.amount), currency: a.currency ?? 'SGD' } } : {}),
  })
  if (!result.ok) {
    // The control is left exactly as it was, with the typed reason intact: the
    // refusals this endpoint gives are all correctable, and discarding the
    // draft would make the user retype to find that out.
    if (fb) { fb.textContent = result.data?.error ?? 'Could not record the assessment.'; fb.className = 'opp-assess-feedback msg-error' }
    return
  }
  delete oppAssessDraft[key]
  delete oppAssessReason[key]
  delete oppAssessAnswer[key]
  // The server owns the series, so the panel re-reads it rather than guessing.
  const fresh = await api('GET', `/api/opportunities/${currentOppDetailId}`)
  if (fresh.ok) currentOppPayload = fresh.data.payload ?? {}
  rerenderOppAssessLens()
}

function rerenderOppAssessLens() {
  const key = oppAssessCurrentLens
  const pane = key && document.getElementById(`opp-assessment-mount-pane-${key}`)
  const lens = (oppLenses ?? []).find(l => oppLensKey(l.name) === key)
  if (pane && lens) renderOppAssessLens(pane, lens.id)
  // ONE entry point, so the bar cannot fall out of step with the panel. Round
  // 28 Phase 5.
  renderOppAssessSaveBar()
}

let oppAssessCurrentLens = null
let currentOppPayload = {}

async function mountOppAssessmentLenses() {
  const mount = document.getElementById('opp-assessment-mount')
  if (!mount) return
  const lenses = await ensureOppLenses()
  if (!lenses?.length) {
    // Distinct from an empty LENS. This is the vocabulary itself being absent
    // or unreadable, a configuration fault rather than an empty section, so it
    // does not borrow the empty-lens wording.
    mount.innerHTML = '<p class="empty-state">The assessment lenses are not configured.</p>'
    return
  }

  await ensureOppCriteria()

  // onSelect FIRES ON CONSTRUCTION. createSubTabs ends with
  // strip.select(tabs[0].key), so this callback runs once for Commercial
  // before any user has chosen anything. Round 25 Phase 5 read that from the
  // definition rather than meeting it as a symptom: a consumer treating
  // onSelect as "the user chose" and fetching here would fire a request at
  // mount and look like a race. It is used only to record which pane is open
  // and to render from data already in hand.
  const built = window.createSubTabs({
    mount,
    label: 'Assessment lenses',
    tabs: lenses.map(l => ({ key: oppLensKey(l.name), label: l.name })),
    onSelect: key => {
      oppAssessCurrentLens = key
      const lens = lenses.find(l => oppLensKey(l.name) === key)
      const pane = document.getElementById(`opp-assessment-mount-pane-${key}`)
      if (pane && lens) renderOppAssessLens(pane, lens.id)
    },
  })
  if (!built) return

  // Round 28 Phase 5: the shared save bar, mounted OUTSIDE the lens panes.
  //
  // Drafts are keyed by criterion across every lens, so a person who assesses
  // two Commercial criteria and then opens Technical still has two pending.
  // A bar inside a pane would disappear with the pane and take the count with
  // it. Mounted here it also survives renderOppAssessLens, which rewrites only
  // a pane's innerHTML.
  //
  // Built once per record load, and then MUTATED rather than rebuilt, so it
  // never destroys a reason textarea mid-sentence.
  let bar = document.getElementById('opp-assess-savebar')
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'opp-assess-savebar'
    bar.className = 'opp-assess-savebar hidden'
    bar.innerHTML = `
      <span id="opp-assess-savebar-count" class="opp-assess-savebar-count"></span>
      <button type="button" class="btn-primary" id="opp-assess-savebar-record"
              onclick="saveAllOppAssess()">Record</button>
      <button type="button" class="btn-ghost" id="opp-assess-savebar-cancel"
              onclick="cancelAllOppAssess()">Cancel</button>
      <span id="opp-assess-savebar-feedback" class="opp-assess-savebar-feedback"></span>`
    mount.appendChild(bar)
  }

  // Every pane is rendered up front, not only the open one. Four lenses over
  // criteria already in memory is cheap, and it means switching a sub-tab
  // never shows an empty pane that fills a moment later.
  for (const l of lenses) {
    const pane = built.panes[oppLensKey(l.name)]
    if (pane) renderOppAssessLens(pane, l.id)
  }
  renderOppAssessSaveBar()
}

// oppLandOnTabAfterLoad, Round 22 Phase 2, widened in Phase 3. The
// Opportunity twin of tbLandOnStageAfterLoad, ported rather than invented.
//
// Phase 3: this holds a TAB KEY, not a stage name, which is the one place it
// deliberately diverges from Test Bed's twin. Losing a deal has to land on
// Reference, and Reference is not a stage, so a variable holding a stage name
// could not carry it. Converting at the two points that set it keeps ONE
// value type and ONE place that decides the tab, which is the whole reason
// option A was chosen over a second switch call after the reload. Adding a
// separate path for the lose case would have undone that in the next phase.
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
let oppLandOnTabAfterLoad = null

// Round 26 Phase 3: ONE currency list.
//
// These ten codes were written twice as static <option> markup, on
// deal-bidCurrency and deal-proposalCurrency. The assessment panel needs the
// same ten, and adding a third copy is a third thing to keep in step, so the
// two static lists are gone and all three selects are filled from here.
//
// Safe to generate: opportunity-deal.js only reads and writes `.value`, and it
// defaults explicitly to 'USD' rather than relying on option order.
const CURRENCY_CODES = ['USD', 'GBP', 'EUR', 'AED', 'SAR', 'SGD', 'AUD', 'CAD', 'JPY', 'INR']

function fillCurrencySelect(el) {
  if (!el || el.options.length) return
  // ── AN EMPTY OPTION, FIRST. Round 41 item 3 ──────────────────────────────
  //
  // Without one, a select whose record holds no currency lands on the first
  // code in the list, and the next save writes that code. The screen would be
  // choosing a currency because a control has to show something, which is the
  // fallback-in-the-read shape Architecture 11 forbids.
  //
  // A real option rather than a placeholder attribute, so "no currency chosen"
  // is a state the control can hold and report, the same reason "Select
  // milestone" is an option.
  el.innerHTML = '<option value="">Not recorded</option>'
    + CURRENCY_CODES.map(c => `<option value="${c}">${c}</option>`).join('')
}

// The two static selects are markup that exists for the life of the page, so
// they are filled once rather than per record.
document.addEventListener('DOMContentLoaded', () => {
  fillCurrencySelect(document.getElementById('deal-bidCurrency'))
  fillCurrencySelect(document.getElementById('deal-proposalCurrency'))
})

// Round 26 Phase 3: the one criterion that captures a value beside its score.
//
// A LITERAL, deliberately. The business chose Budget confirmed alone precisely
// to learn whether a value belongs beside a score before committing to a
// shape, and a per-criterion type declaration is the shape that decision was
// meant to defer. Naming the criterion here makes the narrowness visible; when
// types are decided this constant is what they replace.
const OPP_VALUE_CAPTURE_KEY = 'assessCommBudgetConfirmed'

// OPP_HOVER_DEFINITIONS_KEY stood here and was retired in Round 32 Phase 2,
// when the level definitions generalised to all seven criteria.
//
// It is worth recording what it bought, because it looked redundant the whole
// time it existed. It held the same string as OPP_VALUE_CAPTURE_KEY, one line
// below it, for two unrelated reasons: Budget confirmed is the criterion that
// captures a money figure, and it was also the one chosen to prototype the
// hover on. Round 31 Phase 7 separated the value's gate from it precisely so
// this retirement would not drag the value along, and the value stays on
// OPP_VALUE_CAPTURE_KEY, which is now the only one of the two left.
//
// Two constants holding one string for two reasons is what made one of them
// removable without reading every call site.

const OPP_EXIT_CRITERION_KEYS = new Set([
  'exitQualBudget', 'exitQualTimeline', 'exitQualCommitment',
  'exitSolTechnicalSolution', 'exitSolBuyersKnown', 'exitSolKeyStakeholders', 'exitSolTermsReviewed',
  // exitPropPricingApproved REMOVED, Round 38 (20260829000006). It was a
  // self-administered tick labelled "Pricing approved" on the transition the
  // business calls Proposal Submitted, referencing no approval, beside a
  // Commercial approval_obtained rule that does the real check. Leaving the key
  // here after deleting the rule would keep a tickable control that gates
  // nothing, which is worse than either.
  'exitPropContractTerms', 'exitPropImplSchedule', 'exitPropDocumentation',
  'exitEvalClarificationsResponded', 'exitEvalRevisedPricing', 'exitEvalTechnicalClarifications',
  'exitNegScopeAgreed', 'exitNegPricingAgreed', 'exitNegLegalResolved',
  'exitNegCommercialsApproved', 'exitNegContractExecuted',
])

// The tick list, following the Test Bed panel that is already built and in
// use. The busiest Opportunity transition carries 5 criteria and 3
// approvals; Test Bed's Qualification exit already renders 9 criteria, 2
// approvals and 3 further requirements on one panel, so the pattern carries
// this count with room to spare. Measured in Phase 6 rather than assumed.
// Round 27 Phase 1: `recordStage` is new, and it is read in exactly ONE
// place, the review branch below. Nothing else this function decides looks
// at it: not the load-token drop, not the error or empty branches, not the
// generic `tickable` test, not the computed rows, and not the `outstanding`
// count. An unreached review row still counts as outstanding, deliberately,
// because the criterion IS outstanding for that transition; the count
// describes the gate, and this parameter describes only whether a person
// can act on the row from where the record currently stands.
//
// Defaulted to the global rather than left undefined. A future call site
// that forgets to pass it gets the right answer instead of `undefined`,
// which would make every row fail open and quietly restore the defect.
// ── Round 32 Phase 2: the four lens rollups ───────────────────────────────
//
// The levels that CLOSE a question. Not applicable (1), Buyer confirmed (4)
// and Verified (5). Unknown (2) is plainly a gap, and Our hypothesis (3) is a
// real answer that is not yet confirmed, which will read as a gap: that is a
// judgement the business took rather than arithmetic, and a lens full of
// hypotheses is not a lens to be confident in.
//
// Numeric rather than by label, because a label is display text and a rename
// would silently move a level in or out of this set. The probe asserts that 1,
// 4 and 5 are still Not applicable, Buyer confirmed and Verified, so a scale
// change is loud rather than silent.
const OPP_LENS_SATISFYING_LEVELS = new Set([1, 4, 5])

// STAGE SCOPED, not lens wide, settled with the business in Phase 0.
//
// Criterion visibility marks the stages a criterion can be ANSWERED at, and
// Commercial holds one criterion at Qualification and seven at Proposal. Read
// lens wide, the rollup would ask a record at Qualification to satisfy six
// criteria that Qualification does not render, and no action taken at that
// stage could change the answer. That is unactionable rather than strict.
//
// The consequence is real and is handled below: the same lens can be satisfied
// at one stage and not at the next, on the same record at the same moment.
//
// THREE STATES AT THE RULE, not two with a rendering rule over them. `every()`
// on an empty array returns true, so a lens with nothing configured computes
// SATISFIED, on no evidence, and three of the four lenses are empty until
// Round C. Returning early on an empty set is what makes "satisfied" and
// "nothing to satisfy" different values rather than the same value rendered
// twice. Third instance of that trap in this project, and the first designed
// in rather than inherited.
function oppLensRollup(lens, stage, criteria) {
  const mine = (criteria ?? []).filter(c => c.lens_id === lens.id
    && (c.stages ?? []).some(st => st.stage === stage))
  if (!mine.length) return { name: lens.name, state: 'none', met: 0, total: 0 }
  const met = mine.filter(c => {
    const series = oppAssessSeries(c.criterion_key)
    if (!series.length) return false
    return OPP_LENS_SATISFYING_LEVELS.has(Number(series[series.length - 1].value))
  }).length
  return { name: lens.name, state: met === mine.length ? 'satisfied' : 'unsatisfied', met, total: mine.length }
}

// A FRACTION, NOT A TICK, and the two constraints resolve to the same answer.
//
// Every other row in this card is a tick box against a label, and the rollups
// are a display while the rest of the card gates. A rollup rendered as a tick
// row would be claiming to be a requirement. So: no box, a name and a count.
//
// The same choice solves the problem the business raised about advancing a
// stage. Commercial is 1 of 1 at Qualification and 7 criteria at Proposal, so
// a satisfied lens becomes unsatisfied on advancing, correctly, and A TICK
// DISAPPEARING SAYS NOTHING ABOUT WHY. "1 of 1" becoming "6 of 7" says exactly
// what happened: the stage brought six more criteria into view. The count is
// not decoration on the state, it is what makes the state legible.
//
// "None at this stage" rather than "0 of 0", because a zero fraction reads as
// a measurement of nothing rather than as nothing to measure.
function renderOppLensRollupsHtml(stage, criteria, lenses) {
  if (!criteria || !lenses) {
    // SAID, not omitted. An empty block and a block that failed to load are
    // the same 60px of heading, which is the ambiguity Round 31 Phase 1 found
    // on the Assessments placeholder.
    return `<div class="opp-lens-rollups"><p class="opp-lens-rollups-h">Assessment by lens</p>
      <p class="opp-lens-rollup-fail">Could not load the assessment.</p></div>`
  }
  const rows = (lenses ?? []).map(l => {
    const r = oppLensRollup(l, stage, criteria)
    const value = r.state === 'none' ? 'None at this stage' : `${r.met} of ${r.total}`
    return `<div class="opp-lens-rollup" data-lens="${escHtml(l.name)}" data-state="${r.state}" data-met="${r.met}" data-total="${r.total}">
      <span class="opp-lens-rollup-n">${escHtml(l.name)}</span><span class="opp-lens-rollup-v">${escHtml(value)}</span>
    </div>`
  }).join('')
  return `<div class="opp-lens-rollups"><p class="opp-lens-rollups-h">Assessment by lens</p>${rows}</div>`
}

async function renderOppExitCriteria(containerId, recordId, fromStage, toStage, isStillCurrent = () => true, recordStage = currentOppStage) {
  const el = document.getElementById(containerId)
  if (!el) return
  // ASKED FOR HERE, NOT INHERITED. Phase 0 measured both of these already
  // populated by the time any stage panel renders, because
  // mountOppAssessmentLenses runs from renderOppDetail rather than from the
  // Assessment tab. That is true for every caller that exists and is exactly
  // Architecture rule 8: the day the Assessment panel is mounted lazily per
  // tab, the rollups would read "None at this stage" for every lens and
  // nothing would fail. Both helpers cache, so asking costs nothing when the
  // answer is already there.
  //
  // Started before the await, not after, so the three requests overlap.
  const criteriaPromise = ensureOppCriteria()
  const lensesPromise = ensureOppLenses()
  const result = await api('GET', `/api/records/${recordId}/exit-criteria?stage=${encodeURIComponent(fromStage)}`)
  // Dropped rather than painted if a newer load has started. Without this a
  // slower response for an earlier tab lands last and shows that stage's
  // criteria under this one's heading.
  if (!isStillCurrent()) return
  if (!result.ok) {
    el.innerHTML = '<p class="empty-state">Unable to load exit criteria.</p>'
    return
  }
  // ── APPROVAL TRACKS ARE NOT EXIT CRITERIA. Round 41 walk item E ─────────
  //
  // The walk found three rows reading "Requires an approved decision on the open
  // transition request", rendered as exit-criteria checkboxes beside the
  // Approvals panel showing the same three tracks. Two surfaces for one fact,
  // and the criteria one is a checkbox nobody can tick: an approval is earned in
  // the Approvals panel and this list is what a person completes themselves.
  //
  // Ruled by the business: approval-track requirements live only in the
  // Approvals panel. Filtered HERE rather than in the route, because the route's
  // requirement list is the gate's own answer and three callers read it - the
  // transition endpoint's blocking list among them, where an approval
  // requirement absolutely belongs. This is a rendering decision about one
  // panel, so it is made in that panel.
  const all = result.data?.requirements ?? []
  const requirements = all.filter((r) => r.requirement_type !== 'approval_obtained')
  if (!requirements.length) {
    el.innerHTML = all.length
      // Not "none configured" when three were filtered out: that sentence would
      // be false, and Architecture 9's fourth variant is what a false sentence
      // in an empty state becomes.
      ? `<p class="muted" style="font-size:14px">Nothing to complete here. Moving to ${escHtml(toStage)} needs approvals, which are in the Approvals panel.</p>`
      : `<p class="muted" style="font-size:14px">No exit criteria configured for ${escHtml(toStage)}.</p>`
    return
  }

  const rows = requirements.map(r => {
    // Round 26 Phase 2: assessmentReviewed is tickable but NOT through the
    // generic path. That path PATCHes a single ISO timestamp and toggles; this
    // key holds an append-only series of {at, by, stage}, because one timestamp
    // cannot say which stages have been reviewed and the four rules each name
    // their own stage through entry_stage_at_or_after.
    //
    // It is also one-way. A met row is not clickable, because "I read the
    // assessment at this stage" is an event and un-saying it is not a thing a
    // person does.
    const isReview = r.requirement_type === 'payload_field_required' && r.field === 'assessmentReviewed'
    if (isReview) {
      const box = r.met
        ? '<span class="tb-crit-box tb-crit-box--met">&#10003;</span>'
        : '<span class="tb-crit-box"></span>'
      // Round 27 Phase 1. The row rendered on stages the record has not
      // reached, and clicking it there wrote a real entry dated at the
      // record's OWN stage, so it changed nothing on screen and left the
      // person believing they had reviewed a stage they had not. Ninth
      // instance of Architecture rule 8: a path correct for every caller it
      // had, and wrong the moment a panel could be open for a stage the
      // record is not in.
      //
      // Borrows Test Bed's approval treatment (buildStageTrackListHtml):
      // visible, no clickable class so no pointer cursor, no onclick, and a
      // meta line saying why. Not hidden. A criterion that vanishes on some
      // tabs reads as a configuration gap rather than as a sequence.
      const ahead = !r.met && oppStageIsAhead(currentOppStages, fromStage, recordStage)
      const cls = r.met
        ? 'tb-crit-row'
        : (ahead ? 'tb-crit-row opp-crit-row--unreached' : 'tb-crit-row tb-crit-row--tickable')
      const click = (r.met || ahead)
        ? ''
        : ` onclick="recordOppAssessmentReview('${escHtml(recordId)}', '${escHtml(fromStage)}')"`
      const title = r.met
        ? 'Reviewed at this stage'
        : (ahead ? 'Not yet at this stage' : 'Confirm you have read the assessment')
      // The meta line needs a second line, and .tb-crit-row is a flex row
      // with no meta slot. The text and the meta are stacked inside one
      // child so the row itself is untouched: .tb-crit-row is shared with
      // Test Bed's own criteria panel and nothing here may reach it.
      const text = ahead
        ? `<span class="opp-crit-stack"><span class="tb-crit-text">${escHtml(r.label ?? 'Assessment reviewed')}</span><span class="sa-approval-meta">Not yet at this stage</span></span>`
        : `<span class="tb-crit-text">${escHtml(r.label ?? 'Assessment reviewed')}</span>`
      return `<div class="${cls}" data-field="${escHtml(r.field)}" data-stage="${escHtml(fromStage)}" data-met="${r.met ? 'true' : 'false'}" data-unreached="${ahead ? 'true' : 'false'}"${click} title="${title}">
        ${box}${text}
      </div>`
    }
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
  // ── "READY TO MOVE" MUST NOT LIE NOW THAT APPROVALS ARE FILTERED OUT ────
  //
  // Item E removes the approval rows from this list, so `outstanding === 0`
  // stopped meaning "the gate is open" and started meaning "the part of the gate
  // this panel shows is done". The old sentence would have said "ready to move"
  // over three unmet approvals.
  //
  // Architecture 9's fourth variant caught in the act rather than a round later:
  // the sentence was true when written and this change is what falsifies it. It
  // is corrected in the same edit that causes it, which is rule 10's limit.
  const unmetApprovals = all.filter((r) => r.requirement_type === 'approval_obtained' && !r.met).length
  const summary = outstanding === 0
    ? (unmetApprovals === 0
      ? `<p class="sub" style="margin-bottom:10px">All criteria met - ready to move to ${escHtml(toStage)}.</p>`
      : `<p class="sub" style="margin-bottom:10px">All criteria met. ${unmetApprovals} approval${unmetApprovals === 1 ? '' : 's'} still outstanding, in the Approvals panel.</p>`)
    : `<p class="sub" style="margin-bottom:10px">${outstanding} of ${requirements.length} outstanding to move to ${escHtml(toStage)}:</p>`
  const [criteria, lenses] = await Promise.all([criteriaPromise, lensesPromise])
  // RE-CHECKED AFTER THE SECOND AWAIT. The guard above covered the only await
  // this function had; parallelising gave it two, and the same slow-response
  // fault Round 31 hit on renderTbStageExitCriteria applies to the later one.
  if (!isStillCurrent()) return
  el.innerHTML = summary + rows + renderOppLensRollupsHtml(fromStage, criteria, lenses)
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
// Round 26 Phase 2. Serialised through the same queue the criterion ticks use,
// so a review and a tick cannot land two overlapping revisions on one record.
//
// One way: there is no clear. "I read the assessment at this stage" is an
// event, and the row stops being clickable once met.
window.recordOppAssessmentReview = (recordId, stageName) => {
  // Round 27 Phase 1. Defence in depth, not the correction. The correction
  // is that the row no longer emits an onclick on a stage ahead of the
  // record, and the server needs no change either: the endpoint takes no
  // stage, always writes at `record.status`, and a repeat is a 200 no-op,
  // so there is no request it could refuse. This exists because the handler
  // is on `window` and had no guard of ANY kind, which made a stale row, a
  // console call or a future call site enough to write an entry the person
  // would then believe belonged to the stage they were looking at.
  if (oppStageIsAhead(currentOppStages, stageName, currentOppStage)) return oppCriterionQueue
  const run = async () => {
    const key = oppStageTabKey(stageName)
    const fb = document.getElementById(`opp-stage-criteria-${key}`)?.querySelector('.opp-crit-feedback')
    if (fb) { fb.textContent = ''; fb.className = 'tb-doc-feedback opp-crit-feedback' }

    const result = await api('POST', `/api/opportunities/${recordId}/assessment-reviewed`)
    if (!result.ok) {
      const el = document.getElementById(`opp-stage-criteria-${key}`)?.querySelector('.opp-crit-feedback')
      if (el) {
        el.textContent = `Could not record the review: ${result.data?.error ?? 'unknown error'}`
        el.className = 'tb-doc-feedback opp-crit-feedback err'
      }
      return
    }
    // Re-rendered from the server rather than marked optimistically. Whether
    // the row is met depends on entry_stage_at_or_after, which is the
    // evaluator's judgement and not something this side should predict.
    if (currentOppDetailId === recordId && document.getElementById(`opp-stage-criteria-${key}`)) {
      const token = ++oppStageTabLoadToken
      await renderOppExitCriteria(`opp-stage-criteria-${key}`, recordId, stageName,
        nextStageAfter(currentOppStages, stageName), () => token === oppStageTabLoadToken,
        currentOppStage)
    }
  }
  oppCriterionQueue = oppCriterionQueue.then(run, run)
  return oppCriterionQueue
}

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

    const result = await window.oppPatch(recordId, {
      payload: { [field]: isMet ? null : new Date().toISOString() },
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
        nextStageAfter(currentOppStages, stageAtClick), () => token === oppStageTabLoadToken,
        currentOppStage)
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
    // Converted to a tab key here, at the one point a transition sets it.
    land: stage => { oppLandOnTabAfterLoad = oppStageTabKey(stage) },
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
//
// Round 38: THE THIRD ARGUMENT IS THE RECORD THE NOTES WERE READ FROM, not the
// notes. A note is added by prepending to the whole array and writing the whole
// array back, which is a read-modify-write performed in the browser: two people
// adding a note at the same moment both prepend to the array they read, and the
// second write keeps only its own note. The revision the array was read at is
// what makes that refusable, so it travels WITH the array rather than as a
// fourth positional argument a caller can quietly omit.
async function addContactNote(contactId, text, source) {
  const note = {
    text,
    at: new Date().toISOString(),
    by: currentSession?.user?.email ?? '',
  }
  return api('PATCH', `/api/contacts/${contactId}`, {
    payload: { notes: [note, ...(source?.notes ?? [])] },
    expected_revision: source?.expectedRevision ?? null,
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
  const result = await addContactNote(contactId, text, {
    notes: contact?.payload?.notes,
    expectedRevision: contact?.latest_revision_number ?? null,
  })
  if (!result.ok) {
    // A stale write means somebody else wrote to this Contact between this card
    // being rendered and Add Note being clicked. Reloading makes their change
    // visible and re-renders this card against a current revision, so clicking
    // Add Note again lands. The typed text is deliberately left in the box.
    //
    // LIMITATION, STATED RATHER THAN HIDDEN: a list card has no notice surface,
    // so this is a silent refusal followed by a visible refresh. Every other
    // failure on this path was already silent before this change; a 409 is the
    // first one where the person needs to know why nothing happened.
    if (result.status === 409) await loadContactsData()
    return
  }

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
    // The flag is cleared on the FAILURE path too, or a record that could not be
    // fetched shows the loading line for ever instead of its error.
    window.detailLoaded('test-bed-detail')
    document.getElementById('tb-detail-name').textContent = 'Not found'
    return
  }
  currentTestBed = result.data

  // ── ANOTHER USER'S TEST BED IS READ ONLY. Round 41 ruling G ─────────────
  //
  // The walk found the split: a non-owner could edit some Reference fields and
  // not others. Ruled by the business: fully read-only, the SAME W1 mechanism as
  // the Opportunity, not a Test-Bed-specific answer.
  //
  // Same one value, same class, same stylesheet rule. The only thing that is
  // per-view is the banner element, because the banners sit in different
  // documents; the behaviour is shared by construction rather than by matching.
  //
  // NOT A SECURITY BOUNDARY here either. RLS is the boundary, and the split the
  // walk found was the database refusing the writes it should and permitting the
  // ones it was configured to. This stops a person doing work that will be
  // refused; it does not stop anybody who means to.
  {
    const notMine = !!currentTestBed.owner_id && !!currentSession?.user?.id
      && currentTestBed.owner_id !== currentSession.user.id
    document.getElementById('view-test-bed-detail')?.classList.toggle('is-not-mine', notMine)
    const b = document.getElementById('tb-readonly-banner')
    if (b) {
      b.innerHTML = notMine ? `
        <div class="freeze-banner">
          <p class="label" style="margin-bottom:6px">Read only &middot; another user's record</p>
          <p style="font-size:14px;margin:0">${escHtml(OWNERSHIP_REFUSAL_TEXT)}</p>
        </div>` : ''
    }
  }
  // Round 17 Phase 4: unit counts are loaded once per detail load and used by
  // both tabs, Commercials to know which counts are locked and the units view
  // to render them. A READ, deliberately: the derive control is the only
  // thing that writes.
  if (typeof window.loadTbUnitCounts === 'function') await window.loadTbUnitCounts(id)
  await renderTestBedDetail(currentTestBed)
  window.detailLoaded('test-bed-detail')
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
  wireChevronHover({ wrapId: 'tb-chevron-wrap', popupId: 'tb-chevron-popup', recordId: bed.id })
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
      ? buildStageTrackListHtml(currentTestBed.id, stageEntry, 'test_bed')
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
// ─────────────────────────────────────────────────────────────
// The Opportunity's revision, held ONCE for the whole detail page
// ─────────────────────────────────────────────────────────────
//
// Round 38. Three modules write to one Opportunity record: this file (exit
// criterion ticks), opportunity-reference.js (the Reference tab's fields) and
// opportunity-deal.js (Commercials). Each held its own copy of the revision it
// had loaded, and two of them refreshed that copy only after their OWN save. A
// tick from this file therefore left the Commercials tab holding a number the
// record had already left, and the next save from Commercials would have been
// refused as stale when nothing was wrong.
//
// One holder rather than three, and it is not a weakening: loadOpportunityDetail
// performs ONE GET and renderOppDetail hands the same `opp` object to all three,
// so the three copies were always the same number written down three times.
// Measured before relying on it, not assumed.
let oppLoadedRevision = null

// ── ADOPT AND WARN, NEVER SILENT-ADOPT. Round 41, X3, ruled ──────────────
//
// A read that finds the record has MOVED updates the holder, so the next write
// is not refused against a number 18 revisions old. But adopting silently is
// the worse half: the inputs on screen are still the ones loaded at the old
// revision, and a version taken then would record a revision the screen was
// never showing.
//
// So the holder moves AND the screen says so. Same shape as the approval page's
// "the record has since moved, reload before deciding", and the same reasoning:
// a number with no claim about currency is one somebody assumes is current.
//
// FORWARD ONLY. A lower number is a response that raced a newer one, not the
// record going backwards, and adopting it would re-introduce the staleness this
// exists to remove.
window.setOppLoadedRevision = function (n, { source = 'load' } = {}) {
  const next = Number.isInteger(n) ? n : null
  const moved = source === 'read' && Number.isInteger(oppLoadedRevision)
    && Number.isInteger(next) && next > oppLoadedRevision
  if (source === 'read' && Number.isInteger(oppLoadedRevision) && Number.isInteger(next) && next < oppLoadedRevision) {
    return
  }
  oppLoadedRevision = next
  if (moved) renderOppMovedNotice(next)
}

// The notice, and it is deliberately NOT a modal. Nothing is blocked: the
// person may still read the record, and the only act it affects is taking a
// version, which the server refuses on its own. This says why before they hit
// that refusal rather than after.
function renderOppMovedNotice(rev) {
  const el = document.getElementById('opp-moved-banner')
  if (!el) return
  el.innerHTML = `
    <div class="freeze-banner">
      <p class="label" style="margin-bottom:6px">This record has moved on</p>
      <p style="font-size:14px;margin:0">Somebody else has saved changes since this screen loaded.
      It is now at revision ${escHtml(String(rev))}. Reload before taking a version, or the version
      would record a price this screen is not showing.</p>
    </div>`
}

// Read by the version writer, which is not a PATCH and so cannot go through
// oppPatch, but must name the same revision every save on this page names.
window.getOppLoadedRevision = function () {
  return oppLoadedRevision
}

// Every PATCH of an Opportunity payload goes through here, for the same reason
// tbPatch exists on Test Bed: sending the revision and re-reading it from the
// response are two halves of one rule, and a call site doing only the first
// would refuse its own second save.
window.oppPatch = async function (recordId, body) {
  const result = await api('PATCH', `/api/opportunities/${recordId}`,
    { ...body, expected_revision: oppLoadedRevision })
  if (result.ok && Number.isInteger(result.data?.revision_number)) {
    oppLoadedRevision = result.data.revision_number
  }
  return result
}

async function loadOpportunityDetail(id) {
  const result = await api('GET', `/api/opportunities/${id}`)
  if (!result.ok) {
    // ref-display-name (Round 3 Phase 3, 2026-08-17) - renamed from
    // detail-name when the header's Name became click-to-edit, now owned
    // by opportunity-reference.js's renderReferenceTab for the real render
    // path; this not-found path never reaches that, so it's set directly
    // here, same as before.
    window.detailLoaded('opportunity-detail')
    document.getElementById('ref-display-name').textContent = 'Not found'
    return
  }
  await renderOppDetail(result.data)
  window.detailLoaded('opportunity-detail')
}

async function renderOppDetail(opp) {
  const p = opp.payload ?? {}
  const det = opp.opportunity_details ?? {}

  // Set here, before any tab renders, so all three writers share one number.
  // source 'load': a full record render is the screen catching up, not the
  // record moving under it, so it must not raise the moved notice against
  // itself. The notice is cleared here for the same reason.
  window.setOppLoadedRevision(opp.latest_revision_number, { source: 'load' })
  const movedEl = document.getElementById('opp-moved-banner')
  if (movedEl) movedEl.innerHTML = ''
  // Loaded ONCE per record load, and read by every control whose enabled state
  // depends on it. A control that fetched its own copy would be the second
  // reader Verification 20 is about.
  await loadOppOpenRequest(opp.id)
  // THE FREEZE, ON THE WHOLE VIEW, FROM ONE VALUE. Not eleven controls each
  // testing for themselves: that is the second-reader shape, and a control that
  // forgot to ask would be an editable field on a frozen record.
  //
  // The banner is exempted in CSS rather than by markup, because the controls
  // that end the freeze live inside it.
  document.getElementById('view-opportunity-detail')?.classList.toggle('is-frozen', !!oppOpenRequest)
  renderOppFreezeBanner(opp.id)

  // ── NOT YOURS, ON THE WHOLE VIEW, FROM ONE VALUE. Round 41 W1 ───────────
  //
  // Ownership is known HERE, at load, from the record the GET already returned.
  // It was known before this change too, and nothing on the screen used it: a
  // non-owner could select seven assessment scores and type seven reasons, and
  // find out per row, at Record, seven times, after the work.
  //
  // Deliberately the same mechanism as the freeze one line above rather than a
  // parallel one. One value, one class on the view, CSS does the rest. Eleven
  // controls each testing for themselves is the second-reader shape, and the
  // control that forgot to ask is the editable field on a record you do not own.
  //
  // NOT A SECURITY BOUNDARY, and the comment on filterMine says the same thing
  // about the Mine toggle. RLS is the boundary and it held: every one of those
  // seven refusals came from the database. This stops a person doing work the
  // database will refuse; it does not stop anybody who means to.
  //
  // `owner_id` is on the record. currentSession is the same object filterMine
  // reads for the Mine toggle, so there is one answer to "who am I" on this
  // client rather than two.
  const notMine = !!opp.owner_id && !!currentSession?.user?.id
    && opp.owner_id !== currentSession.user.id
  document.getElementById('view-opportunity-detail')?.classList.toggle('is-not-mine', notMine)
  renderOppReadOnlyBanner(notMine)

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
  // Round 29 Phase 5. Wired on EVERY record load, before the wiring guard
  // inside, for the reason Round 18 Phase 1 recorded on Test Bed: the wrapper
  // is static markup, so its dataset.wired survives every navigation, and a
  // listener that closed over the record id would keep the FIRST record's id
  // for the whole page session. Opportunity's strip is static markup too, so
  // it has the identical exposure rather than a different lifecycle. The fix
  // is the same one, which is now the same code.
  wireChevronHover({ wrapId: 'opp-chevron-wrap', popupId: 'opp-chevron-popup', recordId: opp.id })

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
  // Round 28 Phase 1. The assessment panel's draft state is module-level and
  // keyed by criterion, so before this it outlived the record it belonged to.
  // Navigating from Opportunity A to Opportunity B rendered B's panel with A's
  // unsaved level pre-selected in the select and A's reason text in the box,
  // with Record live. ONE CLICK WOULD HAVE WRITTEN A'S JUDGEMENT ONTO B, with
  // A's stated reason, and it would read as entirely deliberate in the history.
  //
  // ON A RECORD CHANGE, NOT ON EVERY LOAD, and the distinction is the whole
  // design. loadOpportunityDetail also runs for same-record reloads after a
  // transition or an approval, and clearing there would discard a draft the
  // person is still working on: a new data-loss path opened while closing a
  // bleed. The counterfactual is the giveaway, because "B is clean" passes
  // under the clear-everything version too.
  //
  // ALL FOUR MAPS, not the three the probe happened to name. The class is
  // assessment state keyed by criterion that outlives its record, and
  // oppAssessOpen is in it: leaving that one behind means a fresh record opens
  // with the previous record's anchor blocks already revealed. Build
  // discipline rule 8. oppLenses and oppCriteria are deliberately NOT cleared:
  // they cache configuration, which is record-type scoped and genuinely
  // outlives any one record.
  if (currentOppDetailId !== opp.id) {
    for (const m of [oppAssessDraft, oppAssessReason, oppAssessAnswer, oppAssessOpen]) {
      for (const k of Object.keys(m)) delete m[k]
    }
  }
  currentOppDetailId = opp.id
  currentOppStage = opp.status
  currentOppStages = stages ?? []
  // Round 25 Phase 6: the record's own scores travel in the payload this
  // response already carries, so the panel needs no fetch of its own.
  currentOppPayload = opp.payload ?? {}
  renderOppStageTabs(stages, opp.status)
  // Round 25 Phase 5: mounted here, beside the stage tabs, for the same reason
  // they are. The Assessment tab's contents belong to THIS record, and mounting
  // on record load means the strip is already there when the tab is opened
  // rather than appearing a beat afterwards.
  mountOppAssessmentLenses()
  // The record's own stage panel is filled eagerly, so the tab carrying the
  // green dot is never a blank card if the user goes straight to it.
  loadOppStageTab(opp.id, opp.status, opp.status, stages)

  // Round 22 Phase 2: read and cleared here, at the top of the landing
  // decision, mirroring where renderTestBedDetail reads its own.
  //
  // Cleared BEFORE it is acted on, so a one-shot really is one shot: if the
  // switch below throws, the next render starts from no intent rather than
  // landing again on a stage the record has since left.
  const landing = oppLandOnTabAfterLoad
  oppLandOnTabAfterLoad = null

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
    switchOppTab(landing, { focusTab: true })
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

async function loadStageApprovals(id, containerId = 'opp-stage-approvals-rows', recordType = 'test_bed') {
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
  renderStageApprovalsRows(id, result.data, containerId, recordType)
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
// The all-stages table's row. Round 41 item A: it takes recordType for the same
// reason buildStageTrackListHtml does, and required for the same reason. This
// one reaches Test Bed today through loadStageApprovals; if a workflow record
// type ever routes here, the control must be inert rather than inherited.
function buildStageApprovalRowHtml(recordId, st, recordType) {
  if (recordType === undefined) {
    throw new Error('buildStageApprovalRowHtml: recordType is required, for the same reason '
      + 'buildStageTrackListHtml requires it.')
  }
  const superseded = window.usesWorkflow(recordType)
  const dotColor = st.state === 'current' ? 'var(--green)' : st.state === 'completed' ? 'var(--muted)' : 'var(--muted-2)'
  const rowOpacity = st.state === 'upcoming' ? '0.55' : '1'

  const criteriaHtml = st.criteria.length
    ? st.criteria.map(c => `<div>- ${escHtml(c)}</div>`).join('')
    : '<span class="sa-empty">--</span>'

  const approversHtml = st.tracks.length
    ? st.tracks.map(t => {
        const clickable = !superseded && st.state === 'current' && !t.approved
        const rowClass = `sa-approval-row${t.approved ? ' approved' : ''}${clickable ? ' clickable' : ''}`
        const onclick = clickable ? `onclick="submitStageApproval('${recordId}','${escHtml(t.track)}')"` : ''
        const meta = t.approved
          ? `Approved ${formatDate(t.decided_at)}`
          : superseded ? 'Decided on the transition request'
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
// ── THE PRE-WORKFLOW APPROVE CONTROL, Round 41 item A ─────────────────────
//
// `recordType` is a required parameter now, and it is required rather than
// defaulted deliberately. This control posts to POST /records/:id/approvals,
// which the stage approvals workflow SUPERSEDED for Opportunity, and the third
// walk found it still live: an approve click returned "An approval decision from
// you already exists for this revision and track", which is that route's 23505
// message refusing a duplicate of its own earlier row.
//
// Every row it wrote on an Opportunity satisfied NO gate, because
// approvalSatisfiesRule reads requestApprovals for a workflow record type and
// never reaches the stage or revision branches. And it had no identity check, so
// the record's owner approved their own transitions through it five times.
//
// A DEFAULT WOULD HAVE HIDDEN THE INCOMPLETE CHANGE. Verification 24: with
// `recordType = 'test_bed'` as a default, a caller that forgot to pass it would
// keep the clickable control on an Opportunity and nothing would say so.
function buildStageTrackListHtml(recordId, st, recordType) {
  if (recordType === undefined) {
    throw new Error('buildStageTrackListHtml: recordType is required. It decides whether the '
      + 'pre-workflow approve control may be clicked, and a default would hide a missed call site.')
  }
  if (!st.tracks.length) return '<p class="empty-state">No approvals required for this stage.</p>'
  const superseded = window.usesWorkflow(recordType)
  return st.tracks.map(t => {
    const clickable = !superseded && st.state === 'current' && !t.approved
    const onclick = clickable ? `onclick="submitStageApproval('${recordId}','${escHtml(t.track)}')"` : ''
    // WHAT IT SAYS INSTEAD OF "Click to approve". Not a blank: a row that reads
    // approved-or-nothing on a record whose approvals live somewhere else is the
    // shape that sent a person clicking in the first place.
    const meta = t.approved
      ? `Approved ${formatDate(t.decided_at)}`
      : superseded ? 'Decided on the transition request'
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

function renderStageApprovalsRows(recordId, stages, containerId = 'opp-stage-approvals-rows', recordType = 'test_bed') {
  const container = document.getElementById(containerId)
  if (!container) return
  if (!stages.length) {
    container.innerHTML = '<p class="empty-state">No stages configured for this record type.</p>'
    return
  }

  container.innerHTML = stages.map(st => buildStageApprovalRowHtml(recordId, st, recordType)).join('')
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
        nextStageAfter(currentOppStages, stage), () => token === oppStageTabLoadToken,
        currentOppStage),
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
// Leaving the page IS a loss, and nothing in this app warned about one before.
// Reads oppAssessDirtyKeys() for the same reason the navigation guard does.
//
// NEVER FIRES AFTER A SUCCESSFUL SAVE, and not by inferring anything:
// saveAllOppAssess deletes each draft the moment its write is confirmed, so by
// the time any redirect or unload happens the set is already empty. That is
// exactly the mechanism Section 5 prescribes, clear the flag when the save
// succeeds rather than try to tell an app-initiated navigation from a real one
// afterwards, and Phase 5's derived registry gets it for free.
window.addEventListener('beforeunload', e => {
  if (!oppAssessDirtyKeys().length) return
  e.preventDefault()
  // Assigning returnValue is what actually triggers the browser's own prompt
  // in Chrome. The string is never displayed; browsers show their own wording.
  e.returnValue = ''
})

// ── THE APPROVER QUEUE. Round 41 ──────────────────────────────────────────
//
// Every open request with what it is WAITING FOR and what the gate says about
// it. The criteria state is the same field the freeze banner reads, from the
// same route, so the queue and the record cannot disagree about whether a
// request was ever evaluated.
//
// NO DECIDE CONTROLS HERE, deliberately. They live on the record, and one
// implementation is the point twice over: a second set would be two readers of
// one request, and an approver deciding from a list is deciding without the
// deal in front of them.
async function loadApprovalsQueue() {
  const el = document.getElementById('approvals-queue')
  if (!el) return
  el.innerHTML = '<p class="empty-state">Loading…</p>'
  const r = await api('GET', '/api/transition-requests?status=open')
  if (!r.ok) {
    el.innerHTML = '<p class="msg-error">The approval queue could not be loaded.</p>'
    return
  }
  const rows = r.data ?? []
  if (!rows.length) {
    el.innerHTML = '<p class="empty-state">Nothing is waiting on a decision.</p>'
    return
  }

  // Reference codes come from the records the requests point at. One fetch,
  // not one per row.
  const recs = await api('GET', '/api/records?record_type=opportunity')
  const byId = new Map((recs.ok ? recs.data ?? [] : []).map(x => [x.id, x]))

  el.innerHTML = rows.map((req) => {
    const rec = byId.get(req.record_id)
    const decided = new Map((req.decisions ?? []).map(d => [d.track, d]))
    const tracks = (req.required ?? []).map((t) => {
      const d = decided.get(t)
      const state = d ? (d.decision === 'approved' ? 'approved' : 'rejected') : 'waiting'
      return `<span class="queue-track queue-track--${state}">${escHtml(t)} ${state}</span>`
    }).join(' ')
    const met = req.criteria === 'met'
    const criteria = req.kind === 'review'
      ? '<span class="queue-kind">Review only, nothing is blocked</span>'
      : `<span class="${met ? 'queue-ok' : 'queue-warn'}">${met ? 'Exit criteria met' : 'Exit criteria NOT EVALUATED'}</span>`
    return `
      <div class="queue-row">
        <div style="min-width:0">
          <div class="queue-title">${escHtml(rec?.reference_code ?? req.record_id.slice(0, 8))}
            &middot; ${escHtml(req.from_stage)} &rarr; ${escHtml(req.to_stage)}</div>
          <div class="sa-approval-meta">Raised ${formatDate(req.requested_at)}</div>
          <div style="margin-top:8px">${criteria}</div>
          <div style="margin-top:8px">${tracks}</div>
        </div>
        <button class="btn-sm btn-secondary" onclick="navigate('opportunity-detail','${req.record_id}')">Open the record</button>
      </div>`
  }).join('')
}
