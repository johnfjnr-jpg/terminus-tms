// ── Bootstrap ─────────────────────────────────────────────────────────────────
let supabaseClient = null
let currentSession = null

async function init() {
  const { supabaseUrl, supabaseAnonKey } = await fetch('/api/config').then(r => r.json())
  supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey)

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentSession = session
    if (session) showApp(session)
    else showAuth()
  })

  const { data: { session: existing } } = await supabaseClient.auth.getSession()
  if (existing) {
    currentSession = existing
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
const ALL_VIEWS = ['leads', 'leads-legacy', 'contacts', 'contact-detail', 'test-beds', 'test-bed-detail', 'opportunities', 'opportunity-detail']

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
  else if (view === 'test-beds') loadTestBeds()
  else if (view === 'opportunities') loadOpportunities()
  else if (view === 'test-bed-detail' && id) loadTestBedDetail(id)
  else if (view === 'opportunity-detail' && id) loadOpportunityDetail(id)
}

document.querySelectorAll('.nav-link').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.view))
})
document.getElementById('btn-back-opps').addEventListener('click', () => navigate('opportunities'))
document.getElementById('btn-back-testbeds').addEventListener('click', () => navigate('test-beds'))
document.getElementById('btn-back-contact-detail').addEventListener('click', () => navigate(cdReturnView))

// Opportunity detail tabs (Commercials / Documents / Stage & Approvals) -
// wired once, the tab bar is static HTML present for the life of the page,
// not regenerated per opportunity, so this must not run again per-opportunity
// or listeners would stack.
document.querySelectorAll('#opp-detail-tabs .detail-tab').forEach(btn => {
  btn.addEventListener('click', () => switchOppTab(btn.dataset.oppTab))
})
function switchOppTab(tab) {
  document.querySelectorAll('#opp-detail-tabs .detail-tab').forEach(b => b.classList.toggle('active', b.dataset.oppTab === tab))
  document.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.add('hidden'))
  document.getElementById(`opp-tab-${tab}`).classList.remove('hidden')
}

// Test Bed detail tabs (Reference / Site Details / Documents / Approvals) -
// same static-tab-bar-wired-once pattern as Opportunity's above.
document.querySelectorAll('#tb-detail-tabs .detail-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTbTab(btn.dataset.tbTab))
})
function switchTbTab(tab) {
  document.querySelectorAll('#tb-detail-tabs .detail-tab').forEach(b => b.classList.toggle('active', b.dataset.tbTab === tab))
  document.querySelectorAll('#view-test-bed-detail .detail-tab-panel').forEach(p => p.classList.add('hidden'))
  document.getElementById(`tb-tab-${tab}`).classList.remove('hidden')
}

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  if (!currentSession) return { ok: false, data: { error: 'not authenticated' } }
  // Content-Type: application/json only set when there's a real body -
  // Fastify's JSON body parser rejects an empty body under that header
  // (FST_ERR_CTP_EMPTY_JSON_BODY), which silently broke every bodyless
  // POST (createFromContact's + Create was the one real call site).
  const headers = { Authorization: `Bearer ${currentSession.access_token}` }
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json()
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

function formatCost(val) {
  if (val == null || val === '') return '--'
  return `GBP ${Number(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

// Dot-based linear tracker — used for Opportunities.
function renderStageTracker(elementId, currentStage, stages) {
  const tracker = document.getElementById(elementId)
  if (!tracker || !stages.length) { if (tracker) tracker.innerHTML = ''; return }

  const currentIdx = stages.findIndex(s => s.stage_name === currentStage)
  tracker.innerHTML = stages.map((stage, i) => {
    const cls = i < currentIdx ? 'done' : i === currentIdx ? 'current' : ''
    return `
    <div class="tstage ${cls}">
      <div class="tline"></div>
      <div class="tdot"></div>
      <div class="tlabel">${escHtml(stage.stage_name)}</div>
    </div>`
  }).join('')
}

// Chevron-style strip — used for Test Beds.
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
    return `<div class="chevron-item ${cls}" style="z-index:${zIndex}">${escHtml(item.label)}</div>`
  }).join('')
}

function renderTransitionSection(elementId, feedbackId, recordId, currentStage, stages) {
  const section = document.getElementById(elementId)
  const currentIdx = stages.findIndex(s => s.stage_name === currentStage)
  const nextStage = stages[currentIdx + 1]?.stage_name

  if (!nextStage) {
    section.innerHTML = '<p class="muted" style="font-size:14px">This record has reached the final stage.</p>'
    return
  }

  section.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <span style="font-size:14px">Advance to <strong>${escHtml(nextStage)}</strong></span>
      <button class="btn-primary" onclick="attemptTransition('${recordId}', '${escHtml(nextStage)}', '${feedbackId}', '${elementId}', '${currentStage}')">
        Move to ${escHtml(nextStage)}
      </button>
    </div>
    <div id="${feedbackId}"></div>
  `
}

window.attemptTransition = async (id, toStage, feedbackId, sectionId, currentStage) => {
  const feedback = document.getElementById(feedbackId)
  if (feedback) feedback.innerHTML = ''

  const result = await api('POST', `/api/records/${id}/transition`, { to_stage: toStage })

  if (result.ok) {
    if (sectionId === 'tb-transition-section') {
      await loadTestBedDetail(id)
    } else {
      await loadOpportunityDetail(id)
    }
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
let expandedContactId = null
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
      <span>${escHtml(companyDisplay)}</span>
      <span>${escHtml(industry?.name ?? '--')}</span>
      <span>${escHtml(p.jobRole ?? '--')}</span>
      <span>${escHtml(p.email ?? '--')}</span>
      <span>${escHtml(p.source ?? '--')}</span>
      <div class="contact-row-actions">${renderContactRowActions(c)}</div>
    </div>
    `
  }).join('')
}

// Qualify/Park/Unqualified moved to the detail page only (2026-08-14) -
// this list is for tracking and note-taking now, not stage actions.
// renderContactRowActions is Contacts-only (Leads has its own
// renderLeadsCards above), so c.status is always 'Qualified' here -
// "Manage" survives only for + Create (Qualified only) and Delete.
//
// Real popup menu (2026-08-15 fix), not the old inline-expanding panel
// that pushed rows below it down the page - see .contact-row-menu in
// style.css for the positioning mechanism. The trigger stops
// propagation so opening/closing it never also fires the row's own
// onclick (whole-row-navigates, added in the same fix below).
function renderContactRowActions(c) {
  const isExpanded = expandedContactId === c.id
  return `
  <button class="btn-text" onclick="event.stopPropagation();toggleContactRowMenu('${c.id}')">${isExpanded ? 'Close' : 'Manage'}</button>
  ${isExpanded ? renderContactRowMenu(c) : ''}
  `
}

function renderContactRowMenu(c) {
  const isQualified = c.status === 'Qualified'

  // Stops propagation once, on the wrapper, rather than on every button
  // inside it - anything clicked in here (Create, Delete, the feedback
  // link) is caught before it can bubble to the row's own navigate.
  return `
  <div class="contact-row-menu" id="contact-manage-${c.id}" onclick="event.stopPropagation()">
    ${isQualified ? `
    <div class="contact-manage-create">
      <span class="cm-label">+ Create</span>
      <button class="btn-sm btn-primary" onclick="createFromContact('${c.id}', 'test-bed')">Test Bed</button>
      <button class="btn-sm btn-primary" onclick="createFromContact('${c.id}', 'opportunity')">Opportunity</button>
    </div>
    <div id="contact-create-feedback-${c.id}"></div>` : ''}
    <div class="contact-manage-delete">
      <button class="btn-text" onclick="deleteContact('${c.id}')">✕ Delete</button>
    </div>
  </div>`
}

window.toggleContactRowMenu = (id) => {
  expandedContactId = expandedContactId === id ? null : id
  renderBothContactGrids()
}

// Click-outside-to-close: every interactive element inside the open
// menu (and its own trigger) stops propagation, so any click that
// reaches document is by definition outside both - no closest()
// checks needed. Escape mirrors this app's other overlays.
document.addEventListener('click', () => {
  if (!expandedContactId) return
  expandedContactId = null
  renderBothContactGrids()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && expandedContactId) {
    expandedContactId = null
    renderBothContactGrids()
  }
})

window.createFromContact = async (id, type) => {
  const feedback = document.getElementById(`contact-create-feedback-${id}`)
  feedback.innerHTML = ''

  const path = type === 'opportunity' ? `/api/contacts/${id}/create-opportunity` : `/api/contacts/${id}/create-test-bed`
  const result = await api('POST', path)

  if (!result.ok) {
    feedback.innerHTML = `<p class="msg-error">${escHtml(result.data.error ?? 'Failed to create record.')}</p>`
    return
  }

  const view = type === 'opportunity' ? 'opportunity-detail' : 'test-bed-detail'
  feedback.innerHTML = `<p class="msg-success">Created. <button class="btn-text" style="color:var(--green)" onclick="navigate('${view}', '${result.data.id}')">View it</button></p>`
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
    expandedContactId = null
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
async function populateContactFormPickers() {
  if (!industriesCache.length) {
    const indResult = await api('GET', '/api/industries')
    if (indResult.ok) industriesCache = indResult.data
  }

  document.getElementById('contact-industry').innerHTML = '<option value="">Select industry</option>' +
    industriesCache.map(i => `<option value="${i.id}">${escHtml(i.name)}</option>`).join('')
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

async function loadTestBeds() {
  const result = await api('GET', '/api/test-beds')
  if (!result.ok) {
    document.getElementById('testbeds-tbody').innerHTML =
      `<tr><td colspan="7" class="empty-state">Failed to load test beds.</td></tr>`
    return
  }
  testBedsCache = result.data
  renderTestBedsTable(filterMine(testBedsCache, testBedsMineOnly))
}

document.getElementById('testbeds-mine-toggle').addEventListener('click', () => {
  testBedsMineOnly = !testBedsMineOnly
  document.getElementById('testbeds-mine-toggle').textContent = `Mine: ${testBedsMineOnly ? 'On' : 'Off'}`
  renderTestBedsTable(filterMine(testBedsCache, testBedsMineOnly))
})

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
    case 'name': return (p.name ?? '').toLowerCase()
    case 'account_name': return (b.account_name ?? '').toLowerCase()
    case 'region': return (p.region ?? '').toLowerCase()
    case 'industry_name': return (b.industry_name ?? '').toLowerCase()
    case 'status': return (b.status ?? '').toLowerCase()
    case 'indicative_cost': return Number(p.indicativeCost ?? 0)
    case 'created_at': return b.created_at
    default: return ''
  }
}

function renderTestBedsTable(beds) {
  document.querySelectorAll('#view-test-beds th[data-tb-sort]').forEach(th => {
    th.classList.toggle('sort-active', th.dataset.tbSort === tbSortKey)
    const base = th.textContent.replace(/ [▲▼]$/, '')
    th.textContent = th.dataset.tbSort === tbSortKey ? `${base} ${tbSortDir === 'asc' ? '▲' : '▼'}` : base
  })

  const tbody = document.getElementById('testbeds-tbody')
  if (!beds.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${testBedsMineOnly ? 'No test beds owned by you.' : 'No test beds yet.'}</td></tr>`
    return
  }

  const sorted = [...beds].sort((a, b) => {
    const av = tbSortValue(a, tbSortKey)
    const bv = tbSortValue(b, tbSortKey)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return tbSortDir === 'asc' ? cmp : -cmp
  })

  tbody.innerHTML = sorted.map(b => {
    const p = b.payload ?? {}
    return `
    <tr onclick="navigate('test-bed-detail', '${b.id}')">
      <td class="col-name">${escHtml(p.name ?? '--')}</td>
      <td>${escHtml(b.account_name ?? '--')}</td>
      <td>${escHtml(p.region ?? '--')}</td>
      <td>${escHtml(b.industry_name ?? '--')}</td>
      <td class="col-stage">${escHtml(b.status)}</td>
      <td class="col-mono">${formatCost(p.indicativeCost)}</td>
      <td class="col-mono">${formatDate(b.created_at)}</td>
    </tr>`
  }).join('')
}

// ── Test Bed detail ───────────────────────────────────────────────────────────
let currentTestBed = null

async function loadTestBedDetail(id) {
  const result = await api('GET', `/api/test-beds/${id}`)
  if (!result.ok) {
    document.getElementById('tb-detail-name').textContent = 'Not found'
    return
  }
  currentTestBed = result.data
  await renderTestBedDetail(currentTestBed)
}

async function renderTestBedDetail(bed) {
  const p = bed.payload ?? {}

  document.getElementById('tb-detail-name').textContent = p.name ?? '--'
  document.getElementById('tb-detail-client').textContent = p.client_organisation ?? ''
  document.getElementById('tb-detail-stage').textContent = bed.status
  document.getElementById('tb-detail-cost').textContent = formatCost(p.accumulated_cost)
  document.getElementById('tb-detail-age').textContent = daysAgo(bed.created_at)
  document.getElementById('tb-detail-refcode').textContent = bed.reference_code ?? 'Not yet generated'

  const stages = await fetchStages('test_bed')
  renderChevronStrip('tb-chevron-strip', bed.status, stages)

  switchTbTab('reference')
  window.initTestBedDetailPanel(bed)

  await renderTestBedDocuments(bed)
  renderTransitionSection('tb-transition-section', 'tb-transition-feedback', bed.id, bed.status, stages)
  await loadTbStageApprovals(bed.id)
  wireTestBedConvertOnce()
  resetTestBedConvertForm()
}

let openDocForm = null

async function renderTestBedDocuments(bed) {
  const section = document.getElementById('tb-documents-section')
  if (!section) return

  const result = await api('GET', `/api/test-beds/${bed.id}/document-requirements`)

  const referenceSection = document.getElementById('tb-reference-docs-section')

  if (!result.ok) {
    section.innerHTML = '<p class="empty-state">Could not load document requirements.</p>'
    if (referenceSection) referenceSection.innerHTML = '<p class="empty-state">Could not load reference material.</p>'
    return
  }

  // reference_docs: unconditional, informational, never gates anything -
  // rendered regardless of whether completable_documents has anything.
  // Milestone 4 close-out fix, see test-beds.js's own comment on this
  // endpoint for why this is a separate array, not merged into the table
  // below.
  if (referenceSection) {
    const refDocs = result.data.reference_docs ?? []
    referenceSection.innerHTML = refDocs.length
      ? refDocs.map(d => `<div class="data-row"><span style="font-size:13px">${escHtml(d.document_name)}</span></div>`).join('')
      : '<p class="empty-state">No reference material listed for this stage.</p>'
  }

  const docs = result.data.completable_documents ?? []
  if (!docs.length) {
    section.innerHTML = '<p class="empty-state">No documents created for this stage yet.</p>'
    return
  }
  // DPIA and APD together trigger the CaDP group header row.
  const hasCaDP = docs.some(d => d.document === 'DPIA') && docs.some(d => d.document === 'APD')
  const cadpSet = new Set(['DPIA', 'APD'])
  const normalDocs = hasCaDP ? docs.filter(d => !cadpSet.has(d.document)) : docs
  const cadpDocs  = hasCaDP ? docs.filter(d =>  cadpSet.has(d.document)) : []

  function docKey(name) { return name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '') }

  function docRow(req, indented) {
    const key = docKey(req.document)
    const isApproved = req.current_status === 'approved'
    const statusLabel = isApproved ? 'Approved' : (req.current_status ? 'Started' : 'Not started')
    const statusClass = isApproved ? 'doc-status--approved' : (req.current_status ? 'doc-status--started' : 'doc-status--notstarted')
    const locationHtml = req.document_location
      ? `<a class="doc-link" href="${escHtml(req.document_location)}" target="_blank" rel="noopener">Open in Drive</a>`
      : '<span style="color:var(--muted-2);font-size:13px">--</span>'
    const actionHtml = isApproved
      ? ''
      : `<button class="btn-sm" onclick="openDocumentForm('${escHtml(bed.id)}','${escHtml(req.document)}')">Send for Approval</button>`
    const resultHtml = isApproved ? '<span class="status-ok">Approved</span>' : ''
    const indentStyle = indented ? ' style="padding-left:24px"' : ''

    return `
    <tr id="doc-row-${key}">
      <td${indentStyle}>${escHtml(req.document)}</td>
      <td><span class="doc-status ${statusClass}">${statusLabel}</span></td>
      <td>${locationHtml}</td>
      <td>${actionHtml}</td>
      <td>${resultHtml}</td>
    </tr>
    <tr class="doc-form-row hidden" id="doc-form-${key}">
      <td colspan="5">
        <div class="doc-inline-form">
          <div class="form-group">
            <label>Google Drive link (optional)</label>
            <input type="text" id="doc-loc-${key}" placeholder="https://drive.google.com/…">
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn-sm btn-primary" onclick="submitDocumentForm('${escHtml(bed.id)}','${escHtml(req.document)}')">Confirm</button>
            <button class="btn-sm btn-ghost" onclick="cancelDocumentForm('${escHtml(req.document)}')">Cancel</button>
          </div>
        </div>
      </td>
    </tr>`
  }

  let rows = normalDocs.map(d => docRow(d, false)).join('')

  if (hasCaDP) {
    rows += `
    <tr class="doc-group-header-row">
      <td colspan="5">
        <span class="doc-group-name">Compliance and Data Protection</span>
        <span class="doc-group-note">Both APD and DPIA required before leaving Planning — no order between them.</span>
      </td>
    </tr>`
    rows += cadpDocs.map(d => docRow(d, true)).join('')
  }

  section.innerHTML = `
  <table class="doc-table">
    <thead>
      <tr>
        <th>Document</th>
        <th>Status</th>
        <th>Location</th>
        <th>Action</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

window.openDocumentForm = (bedId, documentType) => {
  const key = documentType.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '')
  if (openDocForm && openDocForm !== key) {
    document.getElementById(`doc-form-${openDocForm}`)?.classList.add('hidden')
    document.getElementById(`doc-row-${openDocForm}`)?.classList.remove('hidden')
  }
  openDocForm = key
  document.getElementById(`doc-row-${key}`)?.classList.add('hidden')
  document.getElementById(`doc-form-${key}`)?.classList.remove('hidden')
  document.getElementById(`doc-loc-${key}`)?.focus()
}

window.cancelDocumentForm = (documentType) => {
  const key = documentType.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '')
  document.getElementById(`doc-form-${key}`)?.classList.add('hidden')
  document.getElementById(`doc-row-${key}`)?.classList.remove('hidden')
  openDocForm = null
}

window.submitDocumentForm = async (bedId, documentType) => {
  const key = documentType.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '')
  const document_location = document.getElementById(`doc-loc-${key}`)?.value.trim() || null

  const result = await api('POST', `/api/test-beds/${bedId}/complete-document`, {
    document_type: documentType,
    document_location
  })

  if (result.ok) {
    openDocForm = null
    await loadTestBedDetail(bedId)
    return
  }

  // Surface error inline below the form
  const formRow = document.getElementById(`doc-form-${key}`)
  if (formRow) {
    const existing = formRow.querySelector('.doc-form-error')
    if (existing) existing.remove()
    const err = document.createElement('p')
    err.className = 'msg-error doc-form-error'
    err.textContent = result.data?.error ?? 'Failed to mark document.'
    formRow.querySelector('.doc-inline-form')?.appendChild(err)
  }
}

// Old renderTestBedApprovals()/grantSeniorApproval() (Milestone 4,
// removed 2026-08-15): hardcoded to the 'Decommissioning' stage name,
// never checked whether an approval was already granted, and never
// reused GET /records/:id/stage-approvals at all - real stage check, but
// none of the generic display mechanism. Replaced by loadTbStageApprovals()
// above, the same real pattern Opportunity's Approvals tab already uses.

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
    document.getElementById('detail-name').textContent = 'Not found'
    return
  }
  await renderOppDetail(result.data)
}

async function renderOppDetail(opp) {
  const p = opp.payload ?? {}
  const det = opp.opportunity_details ?? {}

  document.getElementById('detail-name').textContent = p.name ?? '--'
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
  renderStageTracker('stage-tracker', opp.status, stages)
  renderTransitionSection('transition-section', 'transition-feedback', opp.id, opp.status, stages)

  // opportunity-deal.js (ES module, loaded after this script) owns the
  // Commercials tab — deal-calculator.js live preview + save/submit.
  window.initOpportunityDealPanel?.(opp)

  // opportunity-reference.js owns the Reference tab — click-to-edit fields,
  // Executive Summary, Notes.
  window.initOpportunityReferencePanel?.(opp)

  // Always land back on Reference when opening/switching opportunities,
  // same convention as other modules resetting their sub-view on entry.
  switchOppTab('reference')
  renderOppDocumentsList()
  await loadStageApprovals(opp.id)
}

// ── Documents tab: deliberately just a caption + flat template-link list,
// no status tracking. There is no document-template data source anywhere
// in this app yet (Test Bed's document mechanism is stage_gate_rules +
// document_details, a different, per-stage-requirement thing, not a
// static template library) - so this renders an honest empty state
// rather than fabricated entries.
function renderOppDocumentsList() {
  document.getElementById('opp-documents-list').innerHTML =
    '<p class="empty-state">No document templates configured yet.</p>'
}

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
  container.innerHTML = '<p class="empty-state">Loading...</p>'
  const result = await api('GET', `/api/records/${id}/stage-approvals`)
  if (!result.ok) {
    container.innerHTML = '<p class="empty-state">Failed to load stage approvals.</p>'
    return
  }
  renderStageApprovalsRows(id, result.data, containerId)
}

function loadTbStageApprovals(id) {
  return loadStageApprovals(id, 'tb-stage-approvals-rows')
}

// Every stage shown, not just the current one. Ring radios are real
// (stage_gate_rules requirements + approvals decisions), but there is no
// approval-role check anywhere in this app to gate WHO specifically may
// click one - restricted to the current stage only, a UX judgment call on
// real data (record.status), not a fabricated permission system.
function renderStageApprovalsRows(recordId, stages, containerId = 'opp-stage-approvals-rows') {
  const container = document.getElementById(containerId)
  if (!stages.length) {
    container.innerHTML = '<p class="empty-state">No stages configured for this record type.</p>'
    return
  }

  container.innerHTML = stages.map(st => {
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
  }).join('')
}

window.submitStageApproval = async (recordId, track) => {
  const result = await api('POST', `/api/records/${recordId}/approvals`, { track, decision: 'approved' })
  if (result.ok) {
    await loadStageApprovals(recordId, stageApprovalsContainerByRecord[recordId])
  }
}

// Expose navigate globally for inline onclick handlers
window.navigate = navigate
