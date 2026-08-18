// ── Bootstrap ─────────────────────────────────────────────────────────────────
let supabaseClient = null
let currentSession = null

async function init() {
  const { supabaseUrl, supabaseAnonKey } = await fetch('/api/config').then(r => r.json())
  supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey)

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentSession = session
    window.currentSession = session
    if (session) showApp(session)
    else showAuth()
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
document.querySelectorAll('#tb-detail-tabs .detail-tab').forEach(btn => {
  btn.addEventListener('click', () => { tbUserPickedTab = true; switchTbTab(btn.dataset.tbTab) })
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

function switchTbTab(tab) {
  document.querySelectorAll('#tb-detail-tabs .detail-tab').forEach(b => b.classList.toggle('active', b.dataset.tbTab === tab))
  document.querySelectorAll('#view-test-bed-detail .detail-tab-panel').forEach(p => p.classList.add('hidden'))
  if (tab.startsWith('stage-')) {
    document.getElementById('tb-tab-stage-detail').classList.remove('hidden')
    loadTbStageDetailTab(tab.slice('stage-'.length))
  } else {
    document.getElementById(`tb-tab-${tab}`).classList.remove('hidden')
  }
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
      onProceed: () => performCreateFromContact(id, type),
    })
    return
  }

  performCreateFromContact(id, type)
}

// Writes into contactCreateFeedback + a full re-render, not a direct DOM
// write (2026-08-16, Phase 5) - the old feedback div lived inside the
// click-toggled Manage popup, which stayed open until dismissed; the new
// + Create dropdown is hover-only and closes the moment the mouse leaves
// it (already closed by the time this async call resolves), so the
// result needs to persist in state and render as its own row under the
// contact, independent of hover state.
async function performCreateFromContact(id, type) {
  contactCreateFeedback[id] = null
  renderBothContactGrids()

  const path = type === 'opportunity' ? `/api/contacts/${id}/create-opportunity` : `/api/contacts/${id}/create-test-bed`
  const result = await api('POST', path)

  if (!result.ok) {
    contactCreateFeedback[id] = `<p class="msg-error">${escHtml(result.data.error ?? 'Failed to create record.')}</p>`
    renderBothContactGrids()
    return
  }

  // Round 3 Phase 2 (2026-08-17): Opportunity now navigates straight to
  // the new record's detail page rather than leaving the user on the
  // Contacts list with a manual "View it" link. Applies to both the path
  // that goes through the linked-records warning above and the plain
  // first-Opportunity path (they share this one function) - there's no
  // reason the same create action should behave differently depending on
  // whether a warning happened to fire first. Test Bed is untouched, the
  // brief scoped this to Opportunity only.
  if (type === 'opportunity') {
    navigate('opportunity-detail', result.data.id)
    return
  }

  contactCreateFeedback[id] = `<p class="msg-success">Created. <button class="btn-text" style="color:var(--green)" onclick="navigate('test-bed-detail', '${result.data.id}')">View it</button></p>`
  renderBothContactGrids()
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
  tbUserPickedTab = false // a genuinely fresh load - see the flag's own comment above
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
  markTbCurrentStageTab(bed.status)

  await loadTerminusStaffIfNeeded()
  // tbUserPickedTab: skip the default-to-Reference switch if the user
  // has already clicked a real tab since this load began - see the
  // flag's own declaration comment for the race this guards against.
  if (!tbUserPickedTab) switchTbTab('reference')
  window.initTestBedDetailPanel(bed)

  // Round 5 Phase 7 (2026-08-17): renderTestBedDocuments/loadTbStageApprovals
  // (the old, always-eager calls against the fixed Documents/Approvals
  // tabs) are gone - that content is now per-stage and loaded lazily,
  // only when a given stage-* tab is actually opened
  // (loadTbStageDetailTab, switchTbTab below), not for all 8 stages on
  // every page load. renderTransitionSection stays eager - it's now
  // page-level, always visible above the tabs, not nested in a tab that
  // might never be opened.
  renderTransitionSection('tb-transition-section', 'tb-transition-feedback', bed.id, bed.status, stages)
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
// alongside it. sectionId stays 'tb-transition-section' - required for
// attemptTransition's own success-path branch to reload as a Test Bed,
// not an Opportunity - but feedbackId is this button's own
// (tb-next-stage-feedback), so a blocking rejection triggered from up
// here is shown right here, not only in the section below, which could
// be scrolled out of view at the moment this button is clicked. Called
// on every render (not wired once) since the real next stage, and
// whether one exists at all, changes with the record's own status.
function wireTbNextStageButton(bed, stages) {
  const btn = document.getElementById('tb-next-stage-btn')
  const feedback = document.getElementById('tb-next-stage-feedback')
  feedback.innerHTML = ''
  const currentIdx = stages.findIndex(s => s.stage_name === bed.status)
  const nextStage = stages[currentIdx + 1]?.stage_name

  if (!nextStage) {
    btn.disabled = true
    btn.textContent = 'Final stage'
    btn.onclick = null
    return
  }
  btn.disabled = false
  btn.textContent = 'Next Stage'
  btn.onclick = () => attemptTransition(bed.id, nextStage, 'tb-next-stage-feedback', 'tb-transition-section', bed.status)
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

async function loadTbStageDetailTab(stageName) {
  if (!currentTestBed) return
  const myToken = ++tbStageTabLoadToken
  currentTbStageTab = stageName
  document.getElementById('tb-stage-detail-heading').textContent = stageName

  // Round 6 Phase 3 (2026-08-17): Installer/Test Bed Tech Team/Install
  // Notes only ever apply to the Installation and Commissioning stage -
  // a pure visibility toggle, not a re-render, the fields themselves are
  // rendered once at page load (renderTbInstallSection,
  // test-bed-detail.js) and stay mounted in the DOM the whole time, so
  // switching to a different stage tab and back can never silently lose
  // an in-progress edit here the way tearing down and rebuilding the
  // fields on every switch would.
  document.getElementById('tb-stage-install-section').classList.toggle('hidden', stageName !== 'Installation and Commissioning')

  await renderTestBedDocuments(currentTestBed, stageName, 'tb-stage-documents-section', 'tb-stage-reference-docs-section', () => myToken === tbStageTabLoadToken)
  if (myToken !== tbStageTabLoadToken) return // a newer stage-tab load has since started; drop this stale one

  const approvalsResult = await api('GET', `/api/records/${currentTestBed.id}/stage-approvals`)
  if (myToken !== tbStageTabLoadToken) return
  const row = document.getElementById('tb-stage-approval-row')
  if (!approvalsResult.ok) {
    row.innerHTML = '<p class="empty-state">Failed to load approvals for this stage.</p>'
  } else {
    const stageEntry = approvalsResult.data.find(s => s.stage_name === stageName)
    row.innerHTML = stageEntry
      ? buildStageApprovalRowHtml(currentTestBed.id, stageEntry)
      : '<p class="empty-state">Unknown stage.</p>'
  }

  // Round 6 Phase 3 (2026-08-17): each stage tab's own Exit Criteria,
  // relocated from the Reference tab - see renderTbStageExitCriteria's
  // own comment (test-bed-detail.js) for the ?stage= generalization.
  if (myToken !== tbStageTabLoadToken) return
  await renderTbStageExitCriteria(stageName)
}

let openDocForm = null

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
async function renderTestBedDocuments(bed, stageName, docsContainerId, refContainerId, isStillCurrent = () => true) {
  const section = document.getElementById(docsContainerId)
  if (!section) return

  const result = await api('GET', `/api/test-beds/${bed.id}/document-requirements?stage=${encodeURIComponent(stageName)}`)
  if (!isStillCurrent()) return

  const referenceSection = document.getElementById(refContainerId)

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
  renderTransitionSection('transition-section', 'transition-feedback', opp.id, opp.status, stages)

  await loadTerminusStaffIfNeeded()

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

function renderStageApprovalsRows(recordId, stages, containerId = 'opp-stage-approvals-rows') {
  const container = document.getElementById(containerId)
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
window.submitStageApproval = async (recordId, track) => {
  const result = await api('POST', `/api/records/${recordId}/approvals`, { track, decision: 'approved' })
  if (!result.ok) return
  if (recordId === currentTestBed?.id && currentTbStageTab) {
    await loadTbStageDetailTab(currentTbStageTab)
  } else {
    await loadStageApprovals(recordId, stageApprovalsContainerByRecord[recordId])
  }
}

// Expose navigate globally for inline onclick handlers
window.navigate = navigate
