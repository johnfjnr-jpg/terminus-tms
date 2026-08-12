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
const ALL_VIEWS = ['leads', 'test-beds', 'test-bed-detail', 'opportunities', 'opportunity-detail']

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

  if (view === 'leads') loadLeads()
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

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  if (!currentSession) return { ok: false, data: { error: 'not authenticated' } }
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentSession.access_token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
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

// ── Leads ─────────────────────────────────────────────────────────────────────
async function loadLeads() {
  const result = await api('GET', '/api/leads')
  if (!result.ok) {
    document.getElementById('leads-rows').innerHTML =
      '<p class="empty-state">Failed to load leads.</p>'
    return
  }
  renderLeadsList(result.data)
}

function renderLeadsList(leads) {
  const container = document.getElementById('leads-rows')
  if (!leads.length) {
    container.innerHTML = '<p class="empty-state">No leads yet.</p>'
    return
  }

  container.innerHTML = leads.map(l => {
    const p = l.payload ?? {}
    const isConverted = l.status === 'converted'
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
        ${isConverted
          ? '<span class="record-card-stat">Converted</span>'
          : `<button class="btn-text" onclick="showLeadConvertForm('${l.id}')">Convert</button>`
        }
      </div>
    </div>
    ${isConverted ? '' : `
    <div id="lead-convert-row-${l.id}" class="hidden">
      <div class="convert-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="lead-convert-name-${l.id}" placeholder="e.g. Acme Phase 1">
        </div>
        <button class="btn-primary" onclick="convertLeadToOpportunity('${l.id}')">To Opportunity</button>
        <button class="btn-ghost" onclick="convertLeadToTestBed('${l.id}')">To Test Bed</button>
        <button class="btn-ghost" onclick="hideLeadConvertForm('${l.id}')">Cancel</button>
      </div>
      <span class="msg-error hidden" id="lead-convert-error-${l.id}"></span>
    </div>`}
  `}).join('')
}

document.getElementById('btn-new-lead').addEventListener('click', () => {
  document.getElementById('new-lead-form').classList.remove('hidden')
  document.getElementById('btn-new-lead').classList.add('hidden')
  document.getElementById('lead-company').focus()
})
document.getElementById('btn-cancel-lead').addEventListener('click', () => {
  document.getElementById('new-lead-form').classList.add('hidden')
  document.getElementById('btn-new-lead').classList.remove('hidden')
  clearLeadForm()
})
document.getElementById('btn-save-lead').addEventListener('click', saveLead)

async function saveLead() {
  const company_name = document.getElementById('lead-company').value.trim()
  const errEl = document.getElementById('lead-form-error')
  errEl.classList.add('hidden')

  if (!company_name) {
    errEl.textContent = 'Company name is required.'
    errEl.classList.remove('hidden')
    return
  }

  const result = await api('POST', '/api/leads', {
    company_name,
    contact_name: document.getElementById('lead-contact').value.trim(),
    source: document.getElementById('lead-source').value,
    notes: document.getElementById('lead-notes').value.trim()
  })

  if (!result.ok) {
    errEl.textContent = result.data.error ?? 'Failed to save lead.'
    errEl.classList.remove('hidden')
    return
  }

  document.getElementById('new-lead-form').classList.add('hidden')
  document.getElementById('btn-new-lead').classList.remove('hidden')
  clearLeadForm()
  loadLeads()
}

function clearLeadForm() {
  ;['lead-company', 'lead-contact', 'lead-notes'].forEach(id => (document.getElementById(id).value = ''))
  document.getElementById('lead-source').value = ''
  const errEl = document.getElementById('lead-form-error')
  errEl.textContent = ''
  errEl.classList.add('hidden')
}

window.showLeadConvertForm = id => document.getElementById(`lead-convert-row-${id}`).classList.remove('hidden')
window.hideLeadConvertForm = id => document.getElementById(`lead-convert-row-${id}`).classList.add('hidden')

window.convertLeadToOpportunity = async (id) => {
  const name = document.getElementById(`lead-convert-name-${id}`).value.trim()
  const errEl = document.getElementById(`lead-convert-error-${id}`)
  errEl.classList.add('hidden')

  if (!name) {
    errEl.textContent = 'Name is required.'
    errEl.classList.remove('hidden')
    return
  }

  const result = await api('POST', `/api/leads/${id}/convert`, { name })
  if (!result.ok) {
    errEl.textContent = result.data.error ?? 'Conversion failed.'
    errEl.classList.remove('hidden')
    return
  }

  loadLeads()
}

window.convertLeadToTestBed = async (id) => {
  const name = document.getElementById(`lead-convert-name-${id}`).value.trim()
  const errEl = document.getElementById(`lead-convert-error-${id}`)
  errEl.classList.add('hidden')

  if (!name) {
    errEl.textContent = 'Name is required.'
    errEl.classList.remove('hidden')
    return
  }

  const result = await api('POST', `/api/leads/${id}/convert-to-test-bed`, { name })
  if (!result.ok) {
    errEl.textContent = result.data.error ?? 'Conversion failed.'
    errEl.classList.remove('hidden')
    return
  }

  loadLeads()
}

// ── Test Beds ─────────────────────────────────────────────────────────────────
async function loadTestBeds() {
  const result = await api('GET', '/api/test-beds')
  if (!result.ok) {
    document.getElementById('testbeds-tbody').innerHTML =
      `<tr><td colspan="6" class="empty-state">Failed to load test beds.</td></tr>`
    return
  }
  renderTestBedsTable(result.data)
}

function renderTestBedsTable(beds) {
  const tbody = document.getElementById('testbeds-tbody')
  if (!beds.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No test beds yet.</td></tr>'
    return
  }

  tbody.innerHTML = beds.map(b => {
    const p = b.payload ?? {}
    return `
    <tr onclick="navigate('test-bed-detail', '${b.id}')">
      <td class="col-name">${escHtml(p.name ?? '--')}</td>
      <td>${escHtml(p.client_organisation ?? '--')}</td>
      <td class="col-stage">${escHtml(b.status)}</td>
      <td class="col-mono">${formatCost(p.accumulated_cost)}</td>
      <td class="col-mono">${daysAgo(b.created_at)}</td>
      <td></td>
    </tr>`
  }).join('')
}

document.getElementById('btn-new-testbed').addEventListener('click', () => {
  document.getElementById('new-testbed-form').classList.remove('hidden')
  document.getElementById('btn-new-testbed').classList.add('hidden')
  document.getElementById('tb-name').focus()
})
document.getElementById('btn-cancel-testbed').addEventListener('click', () => {
  document.getElementById('new-testbed-form').classList.add('hidden')
  document.getElementById('btn-new-testbed').classList.remove('hidden')
  clearTestBedForm()
})
document.getElementById('btn-save-testbed').addEventListener('click', saveTestBed)

async function saveTestBed() {
  const name = document.getElementById('tb-name').value.trim()
  const errEl = document.getElementById('testbed-form-error')
  errEl.classList.add('hidden')

  if (!name) {
    errEl.textContent = 'Name is required.'
    errEl.classList.remove('hidden')
    return
  }

  const costRaw = document.getElementById('tb-cost').value.trim()
  const accumulated_cost = costRaw ? Number(costRaw) : 0

  const result = await api('POST', '/api/test-beds', {
    name,
    client_organisation: document.getElementById('tb-client').value.trim(),
    notes: document.getElementById('tb-notes').value.trim(),
    accumulated_cost
  })

  if (!result.ok) {
    errEl.textContent = result.data.error ?? 'Failed to save test bed.'
    errEl.classList.remove('hidden')
    return
  }

  document.getElementById('new-testbed-form').classList.add('hidden')
  document.getElementById('btn-new-testbed').classList.remove('hidden')
  clearTestBedForm()
  loadTestBeds()
}

function clearTestBedForm() {
  ;['tb-name', 'tb-client', 'tb-cost', 'tb-notes'].forEach(id => (document.getElementById(id).value = ''))
  const errEl = document.getElementById('testbed-form-error')
  errEl.textContent = ''
  errEl.classList.add('hidden')
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
  document.getElementById('tb-detail-notes').textContent = p.notes ?? '--'

  const stages = await fetchStages('test_bed')
  renderChevronStrip('tb-chevron-strip', bed.status, stages)

  await renderTestBedDocuments(bed)
  renderTransitionSection('tb-transition-section', 'tb-transition-feedback', bed.id, bed.status, stages)
  renderTestBedApprovals(bed)
  renderTestBedConvertSection(bed)
}

let openDocForm = null

async function renderTestBedDocuments(bed) {
  const section = document.getElementById('tb-documents-section')
  if (!section) return

  const result = await api('GET', `/api/test-beds/${bed.id}/document-requirements`)

  if (!result.ok) {
    section.innerHTML = '<p class="muted" style="font-size:14px">Could not load document requirements.</p>'
    return
  }

  if (!result.data.length) {
    section.innerHTML = '<p class="muted" style="font-size:14px">No document requirements for this stage.</p>'
    return
  }

  const docs = result.data
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

function renderTestBedApprovals(bed) {
  const section = document.getElementById('tb-approvals-section')

  // Only show Senior approval control when at Decommissioning (the gated final transition)
  if (bed.status !== 'Decommissioning') {
    section.innerHTML = '<p class="muted" style="font-size:14px">Approvals are required for the final Decommissioning to Closed transition.</p>'
    return
  }

  section.innerHTML = `
    <div class="data-row">
      <div>
        <span style="font-size:14px">Senior sign-off</span>
        <span class="data-row-label">Required before Decommissioning to Closed transition.</span>
      </div>
      <button class="btn-primary" onclick="grantSeniorApproval('${bed.id}')">
        Grant Senior approval
      </button>
    </div>
    <div id="approval-feedback"></div>
  `
}

window.grantSeniorApproval = async (id) => {
  const feedback = document.getElementById('approval-feedback')
  feedback.innerHTML = ''

  const result = await api('POST', `/api/records/${id}/approvals`, {
    track: 'Senior',
    decision: 'approved',
    comment: 'Senior sign-off for Test Bed closure'
  })

  if (result.ok) {
    feedback.innerHTML = '<p class="msg-success">Senior approval granted.</p>'
    await loadTestBedDetail(id)
    return
  }

  feedback.innerHTML = `<p class="msg-error">${escHtml(result.data.error ?? 'Failed to grant approval.')}</p>`
}

function renderTestBedConvertSection(bed) {
  const section = document.getElementById('tb-convert-section')
  section.innerHTML = `
    <div class="data-row">
      <div>
        <span style="font-size:14px">Create Opportunity from this Test Bed</span>
        <span class="data-row-label">A new Opportunity is created. This Test Bed continues its own lifecycle unchanged.</span>
      </div>
      <button class="btn-ghost" onclick="showTestBedConvertForm('${bed.id}')">Convert to Opportunity</button>
    </div>
    <div id="tb-convert-form-wrap" class="hidden" style="margin-top:12px">
      <div class="convert-form">
        <div class="form-group">
          <label>Opportunity name</label>
          <input type="text" id="tb-opp-name" placeholder="e.g. Acme Commercial Rollout">
        </div>
        <button class="btn-primary" onclick="convertTestBed('${bed.id}')">Create Opportunity</button>
        <button class="btn-ghost" onclick="hideTestBedConvertForm()">Cancel</button>
      </div>
      <div id="tb-convert-feedback"></div>
    </div>
  `
}

window.showTestBedConvertForm = () => {
  document.getElementById('tb-convert-form-wrap').classList.remove('hidden')
}
window.hideTestBedConvertForm = () => {
  document.getElementById('tb-convert-form-wrap').classList.add('hidden')
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
async function loadOpportunities() {
  const result = await api('GET', '/api/opportunities')
  if (!result.ok) {
    document.getElementById('opps-rows').innerHTML =
      '<p class="empty-state">Failed to load opportunities.</p>'
    return
  }
  renderOppList(result.data)
  renderOppCards(result.data)
}

function renderOppList(opps) {
  const container = document.getElementById('opps-rows')
  if (!opps.length) {
    container.innerHTML = '<p class="empty-state">No opportunities yet.</p>'
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
    grid.innerHTML = '<p class="empty-state">No opportunities yet.</p>'
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
async function loadStageApprovals(id) {
  const container = document.getElementById('opp-stage-approvals-rows')
  container.innerHTML = '<p class="empty-state">Loading...</p>'
  const result = await api('GET', `/api/records/${id}/stage-approvals`)
  if (!result.ok) {
    container.innerHTML = '<p class="empty-state">Failed to load stage approvals.</p>'
    return
  }
  renderStageApprovalsRows(id, result.data)
}

// Every stage shown, not just the current one. Ring radios are real
// (stage_gate_rules requirements + approvals decisions), but there is no
// approval-role check anywhere in this app to gate WHO specifically may
// click one - restricted to the current stage only, a UX judgment call on
// real data (record.status), not a fabricated permission system.
function renderStageApprovalsRows(recordId, stages) {
  const container = document.getElementById('opp-stage-approvals-rows')
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
    await loadStageApprovals(recordId)
  }
}

// Expose navigate globally for inline onclick handlers
window.navigate = navigate
