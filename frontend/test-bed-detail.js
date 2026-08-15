// Test Bed detail: Reference and Site Details tabs. Click-to-edit fields
// via PATCH /api/test-beds/:id (payload merge, same pattern as
// opportunity-reference.js's PATCH /api/opportunities/:id), plus Sensors
// (honest-generated, no fabricated device status), Use Cases (add/remove
// list), Install Notes (append-only log), and Client Buyer linking
// (record_contacts-backed, Milestone 3's save-time-validated endpoint,
// not a plain text field).
//
// Classic script (not a module) - reuses api()/escHtml()/formatDate()/
// currentSession from app.js, loaded immediately before this file.

let tbDetailId = null
let tbPayload = {}
let tbBed = {}
let tbEdits = {} // key -> { draft, orig }, same "only present entries are open" convention as opportunity-reference.js

const TB_REFERENCE_FIELDS = [
  { key: 'terminusLead', label: 'Terminus Lead' },
  { key: 'commercialAuthority', label: 'Commercial Authority' },
  { key: 'technicalAuthority', label: 'Technical Authority' },
  { key: 'region', label: 'Region' },
  { key: 'country', label: 'Country' },
]
// Matches VALID_SITE_OWNERSHIP in src/routes/test-beds.js exactly (no
// frontend-reachable picklist-admin endpoint exists for this yet, same
// gap already noted there - hardcoded here the same way, not a second,
// independent decision).
const SITE_OWNERSHIP_OPTIONS = ['Local Authority', 'Port Authority', 'National Highways', 'Central Government', 'Private', 'Other']

const TB_SITE_FIELDS = [
  { key: 'siteOwnership', label: 'Site Ownership', options: SITE_OWNERSHIP_OPTIONS },
  { key: 'installationEnvironment', label: 'Installation Environment' },
  { key: 'siteAddress', label: 'Site Address' },
  { key: 'safesightCameras', label: 'No. of SafeSight Cameras' },
  { key: 'airQualitySensors', label: 'No. of Air Quality Sensors' },
  { key: 'hemirSensors', label: 'No. of HEMIR Sensors' },
  { key: 'estCostPerUnit', label: 'Estimated Cost per Unit' },
  { key: 'indicativeCost', label: 'Indicative Cost' },
]
const TB_DATE_FIELDS = [
  { key: 'estimatedInstallationDate', label: 'Estimated Installation Date' },
  { key: 'estGoLiveDate', label: 'Est. Go Live' },
  { key: 'testBedDuration', label: 'Test Bed Duration' },
]
const TB_INSTALL_FIELDS = [
  { key: 'installer', label: 'Installer' },
  { key: 'techTeam', label: 'Test Bed Tech Team' },
]
const TB_OWNER_FIELDS = [
  { key: 'terminusCommercialOwner', label: 'Terminus Commercial Owner' },
  { key: 'terminusTechnicalOwner', label: 'Terminus Technical Owner' },
  { key: 'terminusLegalOwner', label: 'Terminus Legal Owner' },
  { key: 'initialLead', label: 'Initial Lead' },
]
const TB_ALL_EDITABLE_FIELDS = [...TB_REFERENCE_FIELDS, ...TB_SITE_FIELDS, ...TB_DATE_FIELDS, ...TB_INSTALL_FIELDS, ...TB_OWNER_FIELDS]

const CLIENT_BUYER_ROLES = ['Client Commercial Buyer', 'Client Technical Buyer', 'Client Legal Buyer']

function tbFieldLabel(key) {
  return TB_ALL_EDITABLE_FIELDS.find(f => f.key === key)?.label ?? key
}

function tbFieldRow(key, label, value, opts = {}) {
  const v = value ?? ''
  let inputTag
  if (opts.options) {
    inputTag = `<select id="tb-input-${key}">` +
      `<option value="">--</option>` +
      opts.options.map(o => `<option value="${escHtml(o)}"${o === v ? ' selected' : ''}>${escHtml(o)}</option>`).join('') +
      `</select>`
  } else if (opts.number) {
    inputTag = `<input type="number" id="tb-input-${key}" value="${escHtml(v)}">`
  } else {
    inputTag = `<input type="text" id="tb-input-${key}" value="${escHtml(v)}">`
  }
  const display = opts.number && v !== '' ? (opts.cost ? formatCost(v) : String(v)) : (escHtml(v) || '--')
  return `
  <div class="ref-field" data-key="${key}">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display" id="tb-display-${key}" onclick="openTbField('${key}')">${display}</div>
    <div class="ref-field-edit hidden" id="tb-edit-${key}">
      ${inputTag}
      <span class="ref-field-discard" onclick="discardTbField('${key}')">&times;</span>
    </div>
  </div>`
}

function tbReadonlyRow(label, value) {
  return `
  <div class="ref-field">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display readonly">${escHtml(value) || '--'}</div>
  </div>`
}

function renderTbReference() {
  document.getElementById('tb-reference-rows').innerHTML =
    TB_REFERENCE_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key])).join('')
    + tbReadonlyRow('Industry', tbBed.industry?.name)
    + tbReadonlyRow('Stage', tbBed.status)
}

function renderTbSiteDetails() {
  const siteOwnershipField = TB_SITE_FIELDS.find(f => f.key === 'siteOwnership')
  document.getElementById('tb-site-rows').innerHTML =
    tbFieldRow('siteOwnership', 'Site Ownership', tbPayload.siteOwnership, { options: siteOwnershipField.options })
    + tbFieldRow('installationEnvironment', 'Installation Environment', tbPayload.installationEnvironment)
    + tbFieldRow('siteAddress', 'Site Address', tbPayload.siteAddress)
    + tbFieldRow('safesightCameras', 'No. of SafeSight Cameras', tbPayload.safesightCameras, { number: true })
    + tbFieldRow('airQualitySensors', 'No. of Air Quality Sensors', tbPayload.airQualitySensors, { number: true })
    + tbFieldRow('hemirSensors', 'No. of HEMIR Sensors', tbPayload.hemirSensors, { number: true })
    + tbFieldRow('estCostPerUnit', 'Estimated Cost per Unit', tbPayload.estCostPerUnit, { number: true, cost: true })
    + tbFieldRow('indicativeCost', 'Indicative Cost', tbPayload.indicativeCost, { number: true, cost: true })

  renderTbSensors()

  document.getElementById('tb-dates-rows').innerHTML =
    tbReadonlyRow('Date Created', formatDate(tbBed.created_at))
    + TB_DATE_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key])).join('')

  document.getElementById('tb-install-rows').innerHTML =
    TB_INSTALL_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key])).join('')
  renderTbInstallNotes()

  document.getElementById('tb-owner-rows').innerHTML =
    TB_OWNER_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key])).join('')
  renderTbBuyerRows()

  renderTbUseCases()
}

// Sensors list: "generated" per PROTOTYPE_SPECIFICATION.md Section 6, but
// the real Device-link mechanism that would back real status/lat-long/
// photo data is explicitly not connected to Test Bed in this build (its
// own "Known dependency" section - that's Asset Management's deferred
// work). Generating names from the real, typed counts is honest; a
// status/location/photo would not be, so those stay an explicit "Not
// yet linked" rather than invented.
function renderTbSensors() {
  const counts = [
    { prefix: 'SafeSight Camera', n: Number(tbPayload.safesightCameras) || 0 },
    { prefix: 'Air Quality Sensor', n: Number(tbPayload.airQualitySensors) || 0 },
    { prefix: 'HEMIR Sensor', n: Number(tbPayload.hemirSensors) || 0 },
  ]
  const rows = []
  for (const c of counts) {
    for (let i = 1; i <= c.n; i++) rows.push(`${c.prefix} ${i}`)
  }
  const el = document.getElementById('tb-sensors-list')
  if (!rows.length) {
    el.innerHTML = '<p class="empty-state">No sensor counts set yet.</p>'
    return
  }
  el.innerHTML = rows.map(name => `
    <div class="data-row">
      <span style="font-size:13px">${escHtml(name)}</span>
      <span class="data-row-label">Not yet linked to a real device</span>
    </div>`).join('')
}

function renderTbInstallNotes() {
  const notes = Array.isArray(tbPayload.installNotes) ? tbPayload.installNotes : []
  const el = document.getElementById('tb-install-notes-list')
  if (!notes.length) {
    el.innerHTML = '<p class="empty-state">No install notes yet.</p>'
    return
  }
  el.innerHTML = notes.map(n => `
    <div class="ref-notes-row">
      <span class="ref-notes-when">${formatDate(n.at)}</span><span class="ref-notes-author">${escHtml(n.by ?? '')}</span><span class="ref-notes-text">${escHtml(n.text)}</span>
    </div>`).join('')
}

window.addTbInstallNote = async function () {
  const input = document.getElementById('tb-install-note-input')
  const text = input.value.trim()
  if (!text) return
  const existing = Array.isArray(tbPayload.installNotes) ? tbPayload.installNotes : []
  const installNotes = [{ text, at: new Date().toISOString(), by: currentSession?.user?.email ?? '' }, ...existing]
  const result = await api('PATCH', `/api/test-beds/${tbDetailId}`, { payload: { installNotes } })
  if (result.ok) {
    input.value = ''
    await loadTestBedDetail(tbDetailId)
  }
}

function renderTbUseCases() {
  const useCases = Array.isArray(tbPayload.useCases) ? tbPayload.useCases : []
  const el = document.getElementById('tb-usecases-list')
  if (!useCases.length) {
    el.innerHTML = '<p class="empty-state">No use cases yet.</p>'
    return
  }
  el.innerHTML = useCases.map((uc, i) => `
    <div class="data-row">
      <span style="font-size:13px">${escHtml(uc)}</span>
      <span class="btn-text" onclick="removeTbUseCase(${i})">&times; Remove</span>
    </div>`).join('')
}

window.addTbUseCase = async function () {
  const input = document.getElementById('tb-usecase-input')
  const text = input.value.trim()
  if (!text) return
  const useCases = [...(Array.isArray(tbPayload.useCases) ? tbPayload.useCases : []), text]
  const result = await api('PATCH', `/api/test-beds/${tbDetailId}`, { payload: { useCases } })
  if (result.ok) {
    input.value = ''
    await loadTestBedDetail(tbDetailId)
  }
}

window.removeTbUseCase = async function (idx) {
  const useCases = (Array.isArray(tbPayload.useCases) ? tbPayload.useCases : []).filter((_, i) => i !== idx)
  const result = await api('PATCH', `/api/test-beds/${tbDetailId}`, { payload: { useCases } })
  if (result.ok) await loadTestBedDetail(tbDetailId)
}

// Client Buyers: record_contacts-backed (Milestone 3), not a text field -
// only Contacts already linked to this Test Bed's own Account are
// selectable, so an invalid link can't even be submitted from here (the
// server's POST /test-beds/:id/buyer-contacts re-validates regardless).
let tbAccountContacts = []

async function renderTbBuyerRows() {
  const el = document.getElementById('tb-buyer-rows')
  if (!tbBed.account_id) {
    el.innerHTML = '<p class="empty-state">No linked Account.</p>'
    return
  }

  if (!tbAccountContacts.length) {
    const result = await api('GET', '/api/contacts')
    if (result.ok) {
      tbAccountContacts = result.data.filter(c => c.parent_record_id === tbBed.account_id)
    }
  }

  const linked = tbBed.buyer_contacts ?? []
  el.innerHTML = CLIENT_BUYER_ROLES.map(role => {
    const current = linked.find(l => l.role === role)
    if (current) {
      return `
      <div class="ref-field" data-key="buyer-${role}">
        <div class="ref-field-label"><span>${escHtml(role)}</span></div>
        <div class="ref-field-display readonly">${escHtml(current.name ?? current.contact_id)}</div>
      </div>`
    }
    const options = tbAccountContacts.map(c => `<option value="${c.id}">${escHtml(c.payload?.name ?? c.id)}</option>`).join('')
    return `
    <div class="ref-field" data-key="buyer-${role}">
      <div class="ref-field-label"><span>${escHtml(role)}</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="tb-buyer-select-${escHtml(role)}">
          <option value="">${tbAccountContacts.length ? 'Select a contact linked to this Account' : 'No Contacts linked to this Account yet'}</option>
          ${options}
        </select>
        <button class="btn-sm" onclick="linkTbBuyer('${escHtml(role)}')">Link</button>
      </div>
      <div id="tb-buyer-feedback-${escHtml(role)}"></div>
    </div>`
  }).join('')
}

window.linkTbBuyer = async function (role) {
  const select = document.getElementById(`tb-buyer-select-${role}`)
  const contact_id = select.value
  const feedback = document.getElementById(`tb-buyer-feedback-${role}`)
  if (!contact_id) return
  const result = await api('POST', `/api/test-beds/${tbDetailId}/buyer-contacts`, { role, contact_id })
  if (!result.ok) {
    feedback.innerHTML = `<p class="msg-error">${escHtml(result.data.error ?? 'Failed to link contact.')}</p>`
    return
  }
  await loadTestBedDetail(tbDetailId)
}

// ── Click-to-edit mechanics (fields only - Sensors/Use Cases/Install
// Notes/Buyers save immediately via their own actions above, not
// through this batched edit bar) ────────────────────────────────────
function wireTbFieldInputs() {
  TB_ALL_EDITABLE_FIELDS.forEach(f => {
    const input = document.getElementById(`tb-input-${f.key}`)
    if (!input) return
    input.addEventListener('input', () => onTbFieldInput(f.key))
    if (input.tagName === 'SELECT') input.addEventListener('change', () => onTbFieldInput(f.key))
  })
}

window.openTbField = function (key) {
  if (tbEdits[key]) return
  const orig = String(tbPayload[key] ?? '')
  tbEdits[key] = { draft: orig, orig }
  document.getElementById(`tb-display-${key}`).classList.add('hidden')
  document.getElementById(`tb-edit-${key}`).classList.remove('hidden')
  const input = document.getElementById(`tb-input-${key}`)
  input.focus()
  updateTbSaveBar()
}

window.discardTbField = function (key) {
  delete tbEdits[key]
  const editEl = document.getElementById(`tb-edit-${key}`)
  editEl.classList.add('hidden')
  editEl.classList.remove('dirty')
  document.getElementById(`tb-display-${key}`).classList.remove('hidden')
  const input = document.getElementById(`tb-input-${key}`)
  if (input) input.value = tbPayload[key] ?? ''
  updateTbSaveBar()
}

function onTbFieldInput(key) {
  const edit = tbEdits[key]
  if (!edit) return
  edit.draft = document.getElementById(`tb-input-${key}`).value
  document.getElementById(`tb-edit-${key}`).classList.toggle('dirty', edit.draft !== edit.orig)
  updateTbSaveBar()
}

function updateTbSaveBar() {
  const bar = document.getElementById('tb-save-bar')
  const keys = Object.keys(tbEdits)
  if (!keys.length) {
    bar.classList.add('hidden')
    return
  }
  bar.classList.remove('hidden')
  const dirtyCount = keys.filter(k => tbEdits[k].draft !== tbEdits[k].orig).length
  document.getElementById('tb-save-count').textContent =
    `${keys.length} field${keys.length === 1 ? '' : 's'} open${dirtyCount ? `, ${dirtyCount} changed` : ''}`
}

async function saveTbFields() {
  const feedback = document.getElementById('tb-save-feedback')
  feedback.textContent = ''
  feedback.className = ''

  const dirtyEntries = Object.entries(tbEdits).filter(([, e]) => e.draft !== e.orig)
  if (!dirtyEntries.length) return

  const payloadUpdate = {}
  for (const [key, e] of dirtyEntries) payloadUpdate[key] = e.draft

  const result = await api('PATCH', `/api/test-beds/${tbDetailId}`, { payload: payloadUpdate })
  if (!result.ok) {
    feedback.textContent = result.data?.error ?? 'Failed to save.'
    feedback.className = 'msg-error'
    return
  }
  tbEdits = {}
  await loadTestBedDetail(tbDetailId)
}

let tbWired = false
function wireTbOnce() {
  if (tbWired) return
  tbWired = true
  document.getElementById('tb-cancel-all').addEventListener('click', () => {
    Object.keys(tbEdits).forEach(key => window.discardTbField(key))
  })
  document.getElementById('tb-save-all').addEventListener('click', saveTbFields)
  document.getElementById('tb-usecase-add').addEventListener('click', () => window.addTbUseCase())
  document.getElementById('tb-install-note-add').addEventListener('click', () => window.addTbInstallNote())
}

// ── Entry point, called by app.js's renderTestBedDetail() ─────────────────
window.initTestBedDetailPanel = function (bed) {
  wireTbOnce()
  tbDetailId = bed.id
  tbBed = bed
  tbPayload = bed.payload ?? {}
  tbEdits = {}
  tbAccountContacts = []

  renderTbReference()
  renderTbSiteDetails()
  updateTbSaveBar()
  wireTbFieldInputs()
}
