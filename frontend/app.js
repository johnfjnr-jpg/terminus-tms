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

function renderStageTracker(elementId, currentStage, stages) {
  const tracker = document.getElementById(elementId)
  if (!stages.length) { tracker.innerHTML = ''; return }

  const hasPhases = stages.some(s => s.phase)

  if (!hasPhases) {
    // Simple linear tracker (opportunities have no phases).
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
    return
  }

  // Grouped tracker: phase groups collapse to a single node; individual non-phased
  // stages each become their own node.
  const currentStageObj = stages.find(s => s.stage_name === currentStage)
  const currentIsPlanning = currentStageObj?.phase === 'Planning'

  const mainItems = []
  const seenPhases = new Set()
  for (const stage of stages) {
    if (stage.phase) {
      if (!seenPhases.has(stage.phase)) {
        seenPhases.add(stage.phase)
        mainItems.push({ label: stage.phase, isPhase: true })
      }
    } else {
      mainItems.push({ label: stage.stage_name, isPhase: false })
    }
  }

  const currentMainIdx = currentIsPlanning
    ? mainItems.findIndex(m => m.isPhase && m.label === currentStageObj.phase)
    : mainItems.findIndex(m => !m.isPhase && m.label === currentStage)

  tracker.innerHTML = mainItems.map((item, i) => {
    const cls = i < currentMainIdx ? 'done' : i === currentMainIdx ? 'current' : ''
    return `
    <div class="tstage ${cls}">
      <div class="tline"></div>
      <div class="tdot"></div>
      <div class="tlabel">${escHtml(item.label)}</div>
    </div>`
  }).join('')
}

function renderSubTracker(elementId, currentStage, stages) {
  const tracker = document.getElementById(elementId)
  if (!tracker) return

  const planningStages = stages.filter(s => s.phase === 'Planning')
  if (!planningStages.length) { tracker.innerHTML = ''; return }

  const currentIsPlanning = stages.find(s => s.stage_name === currentStage)?.phase === 'Planning'
  // If we are past Planning, all sub-stages render as done.
  const currentPlanningIdx = currentIsPlanning
    ? planningStages.findIndex(s => s.stage_name === currentStage)
    : planningStages.length

  tracker.innerHTML = planningStages.map((stage, i) => {
    const cls = i < currentPlanningIdx ? 'done' : i === currentPlanningIdx ? 'current' : ''
    return `
    <div class="tstage ${cls}">
      <div class="tline"></div>
      <div class="tdot"></div>
      <div class="tlabel">${escHtml(stage.stage_name)}</div>
    </div>`
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
    document.getElementById('leads-tbody').innerHTML =
      `<tr><td colspan="6" class="empty-state">Failed to load leads.</td></tr>`
    return
  }
  renderLeadsTable(result.data)
}

function renderLeadsTable(leads) {
  const tbody = document.getElementById('leads-tbody')
  if (!leads.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No leads yet.</td></tr>'
    return
  }

  tbody.innerHTML = leads.map(l => {
    const p = l.payload ?? {}
    const isConverted = l.status === 'converted'
    return `
    <tr>
      <td class="col-name">${escHtml(p.company_name ?? '--')}</td>
      <td>${escHtml(p.contact_name ?? '--')}</td>
      <td class="col-mono">${escHtml(p.source ?? '--')}</td>
      <td><span class="tag">${escHtml(l.status)}</span></td>
      <td class="col-mono">${daysAgo(l.created_at)}</td>
      <td>
        ${isConverted
          ? '<span class="muted" style="font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Converted</span>'
          : `<button class="btn-text" onclick="showLeadConvertForm('${l.id}')">Convert</button>`
        }
      </td>
    </tr>
    ${isConverted ? '' : `
    <tr id="lead-convert-row-${l.id}" class="hidden">
      <td colspan="6">
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
      </td>
    </tr>`}
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
  renderStageTracker('tb-stage-tracker', bed.status, stages)

  // Sub-tracker: always visible since Planning is always the starting phase.
  renderSubTracker('tb-sub-tracker', bed.status, stages)

  renderTransitionSection('tb-transition-section', 'tb-transition-feedback', bed.id, bed.status, stages)
  await renderTestBedDocuments(bed)
  renderTestBedApprovals(bed)
  renderTestBedConvertSection(bed)
}

async function renderTestBedDocuments(bed) {
  const section = document.getElementById('tb-documents-section')
  if (!section) return

  const result = await api('GET', `/api/test-beds/${bed.id}/document-requirements`)

  if (!result.ok) {
    section.innerHTML = '<p class="muted" style="font-size:14px">Could not load document requirements.</p>'
    return
  }

  if (!result.data.length) {
    section.innerHTML = '<p class="muted" style="font-size:14px">No document requirements for this stage transition.</p>'
    return
  }

  section.innerHTML = result.data.map(req => {
    const isDone = req.current_status === req.required_status
    return `
    <div class="data-row">
      <div>
        <span style="font-size:14px">${escHtml(req.document)}</span>
        <span class="data-row-label">Required: ${escHtml(req.required_status)}</span>
      </div>
      ${isDone
        ? '<span class="status-ok">Done</span>'
        : `<button class="btn-ghost" onclick="completeDocument('${escHtml(bed.id)}', '${escHtml(req.document)}', '${escHtml(req.required_status)}')">Mark as ${escHtml(req.required_status)}</button>`
      }
    </div>`
  }).join('')
}

window.completeDocument = async (bedId, documentType, status) => {
  const result = await api('POST', `/api/test-beds/${bedId}/complete-document`, {
    document_type: documentType,
    status
  })
  if (result.ok) {
    await loadTestBedDetail(bedId)
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
    document.getElementById('opps-tbody').innerHTML =
      `<tr><td colspan="5" class="empty-state">Failed to load opportunities.</td></tr>`
    return
  }
  renderOppTable(result.data)
  renderOppCards(result.data)
}

function renderOppTable(opps) {
  const tbody = document.getElementById('opps-tbody')
  if (!opps.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No opportunities yet.</td></tr>'
    return
  }

  tbody.innerHTML = opps.map(o => {
    const p = o.payload ?? {}
    const det = o.opportunity_details ?? {}
    const prob = det.probability_pct != null ? `${det.probability_pct}%` : '--'
    return `
    <tr onclick="navigate('opportunity-detail', '${o.id}')">
      <td class="col-name">${escHtml(p.name ?? '--')}</td>
      <td>${escHtml(p.company_name ?? '--')}</td>
      <td class="col-stage">${escHtml(o.status)}</td>
      <td class="col-mono">${prob}</td>
      <td class="col-mono">${daysAgo(o.created_at)}</td>
    </tr>`
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
}

// Expose navigate globally for inline onclick handlers
window.navigate = navigate
