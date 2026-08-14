// Opportunity detail: Reference tab. Click-to-edit fields (Terminus
// Details / Customer Details / Key Dates), Executive Summary, Notes.
// Classic script (not a module) — reuses api()/escHtml()/formatDate()/
// currentSession from app.js, which is loaded immediately before this
// file, and is the exact reason this file must not redeclare any of
// those names at top level.
//
// Person/account fields are plain text, not contact dropdowns — there is
// no Contacts feature anywhere in this app to back a dropdown against
// (confirmed before building; deliberate, not deferred, see
// project_reference_fields_free_text in memory).

let refOpportunityId = null
let refPayload = {}
let refOppDetails = {}
let refStatus = ''
let refWired = false

// refEdits[key] = { draft, orig } — only present entries are "open".
// Every field row renders once (in renderReferenceTab); opening, typing,
// and discarding only ever toggle classes and touch that one field's own
// elements, never regenerate a card's innerHTML mid-edit. That's what lets
// any number of fields stay open at once, anywhere across the three cards,
// without one edit disturbing another (same discipline as the Commercials
// pricing cards in opportunity-deal.js).
let refEdits = {}

const TERMINUS_FIELDS = [
  { key: 'lead', label: 'Terminus Lead' },
  { key: 'commercial', label: 'Commercial Authority' },
  { key: 'technical', label: 'Technical Authority' },
  { key: 'legal', label: 'Legal Authority' },
]
const CUSTOMER_FIELDS = [
  { key: 'account', label: 'Account' },
  { key: 'customerLead', label: 'Customer Lead' },
  { key: 'techBuyer', label: 'Technical Buyer' },
  { key: 'commBuyer', label: 'Commercial Buyer' },
  { key: 'legalBuyer', label: 'Legal Buyer' },
  { key: 'itBuyer', label: 'IT / Security Buyer' },
  { key: 'commAddress', label: 'Commercial Address for Proposal' },
]
const DATE_FIELDS = [
  { key: 'actualClose', label: 'Actual Close Date' },
  { key: 'estGoLive', label: 'Est. Go Live' },
  { key: 'actualGoLive', label: 'Actual Go Live' },
  { key: 'duration', label: 'Contract Duration (months)' },
]
const OPPTYPE_FIELD = { key: 'oppType', label: 'Opportunity Type', options: ['Terminus Led', 'Tender'] }
const SUMMARY_FIELD = { key: 'summary', label: 'Executive Summary' }
const ALL_EDITABLE_FIELDS = [...TERMINUS_FIELDS, ...CUSTOMER_FIELDS, ...DATE_FIELDS, OPPTYPE_FIELD, SUMMARY_FIELD]

function refFieldLabel(key) {
  return ALL_EDITABLE_FIELDS.find(f => f.key === key)?.label ?? key
}

function refFieldRow(key, label, value, opts = {}) {
  const v = value ?? ''
  let inputTag
  if (opts.options) {
    inputTag = `<select id="ref-input-${key}">` +
      opts.options.map(o => `<option value="${escHtml(o)}"${o === v ? ' selected' : ''}>${escHtml(o)}</option>`).join('') +
      `</select>`
  } else if (opts.multiline) {
    inputTag = `<textarea id="ref-input-${key}" rows="2">${escHtml(v)}</textarea>`
  } else {
    inputTag = `<input type="text" id="ref-input-${key}" value="${escHtml(v)}">`
  }
  return `
  <div class="ref-field" data-key="${key}">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display" id="ref-display-${key}" onclick="openRefField('${key}')">${escHtml(v) || '--'}</div>
    <div class="ref-field-edit hidden" id="ref-edit-${key}">
      ${inputTag}
      <span class="ref-field-discard" onclick="discardRefField('${key}')">&times;</span>
    </div>
  </div>`
}

function refReadonlyRow(label, value) {
  return `
  <div class="ref-field">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display readonly">${escHtml(value) || '--'}</div>
  </div>`
}

function renderReferenceTab(opp) {
  refOpportunityId = opp.id
  refPayload = opp.payload ?? {}
  refOppDetails = opp.opportunity_details ?? {}
  refStatus = opp.status ?? ''
  refEdits = {}

  document.getElementById('ref-reference-code').textContent = 'Not yet generated'

  document.getElementById('ref-terminus-rows').innerHTML =
    TERMINUS_FIELDS.map(f => refFieldRow(f.key, f.label, refPayload[f.key])).join('')
    + refReadonlyRow('Status', refStatus)

  document.getElementById('ref-customer-rows').innerHTML =
    CUSTOMER_FIELDS.map(f => refFieldRow(f.key, f.label, refPayload[f.key])).join('')

  document.getElementById('ref-dates-rows').innerHTML =
    refReadonlyRow('Date Created', formatDate(opp.created_at))
    + `<div class="ref-field" data-key="estClose">
         <div class="ref-field-label">
           <span>Est. Close Date</span>
           <span class="btn-text" style="font-size:9px" onclick="openCloseDateEdit()">Edit</span>
         </div>
         <div class="ref-field-display readonly">${escHtml(refOppDetails.forecast_close_date) || '--'}</div>
       </div>`
    + refReadonlyRow('Est. Close Date Moves', String(refPayload.closeMoves ?? 0))
    + DATE_FIELDS.map(f => refFieldRow(f.key, f.label, refPayload[f.key])).join('')
  document.getElementById('ref-closedate-form').classList.add('hidden')

  // Opportunity Type sits with Executive Summary in the prototype; kept as
  // its own small field row directly above the summary text rather than
  // spliced into the heading text itself, which isn't worth the added
  // complexity for a two-value picklist.
  document.getElementById('ref-opptype-value').textContent = refPayload.oppType || 'Not set'
  document.getElementById('ref-opptype-row').innerHTML =
    refFieldRow(OPPTYPE_FIELD.key, OPPTYPE_FIELD.label, refPayload.oppType, { options: OPPTYPE_FIELD.options })

  document.getElementById('ref-display-summary').textContent = refPayload.summary || 'No summary captured yet.'
  document.getElementById('ref-input-summary').value = refPayload.summary ?? ''
  document.getElementById('ref-edit-summary').classList.add('hidden')
  document.getElementById('ref-display-summary').classList.remove('hidden')

  renderRefNotes(refPayload.notes ?? [])
  updateRefEditBar()
  wireRefFieldInputs()
}

function wireRefFieldInputs() {
  ALL_EDITABLE_FIELDS.forEach(f => {
    const input = document.getElementById(`ref-input-${f.key}`)
    if (!input) return
    input.addEventListener('input', () => onRefFieldInput(f.key))
    if (input.tagName === 'SELECT') input.addEventListener('change', () => onRefFieldInput(f.key))
  })
}

window.openRefField = function (key) {
  if (refEdits[key]) return
  const orig = String(refPayload[key] ?? '')
  refEdits[key] = { draft: orig, orig }
  document.getElementById(`ref-display-${key}`).classList.add('hidden')
  document.getElementById(`ref-edit-${key}`).classList.remove('hidden')
  const input = document.getElementById(`ref-input-${key}`)
  input.focus()
  updateRefEditBar()
}

window.discardRefField = function (key) {
  delete refEdits[key]
  const editEl = document.getElementById(`ref-edit-${key}`)
  editEl.classList.add('hidden')
  editEl.classList.remove('dirty')
  document.getElementById(`ref-display-${key}`).classList.remove('hidden')
  const input = document.getElementById(`ref-input-${key}`)
  if (input) input.value = refPayload[key] ?? ''
  updateRefEditBar()
}

function onRefFieldInput(key) {
  const edit = refEdits[key]
  if (!edit) return
  edit.draft = document.getElementById(`ref-input-${key}`).value
  document.getElementById(`ref-edit-${key}`).classList.toggle('dirty', edit.draft !== edit.orig)
  updateRefEditBar()
}

function updateRefEditBar() {
  const bar = document.getElementById('ref-edit-bar')
  const keys = Object.keys(refEdits)
  if (!keys.length) {
    bar.classList.add('hidden')
    return
  }
  bar.classList.remove('hidden')
  const dirtyCount = keys.filter(k => refEdits[k].draft !== refEdits[k].orig).length
  document.getElementById('ref-edit-count').textContent =
    `${keys.length} field${keys.length === 1 ? '' : 's'} open${dirtyCount ? `, ${dirtyCount} changed` : ''}`
  document.getElementById('ref-save-all').classList.toggle('hidden', dirtyCount === 0)
}

async function saveRefFields() {
  const feedback = document.getElementById('ref-save-feedback')
  feedback.textContent = ''
  feedback.className = ''

  const dirtyEntries = Object.entries(refEdits).filter(([, e]) => e.draft !== e.orig)
  if (!dirtyEntries.length) return

  const payloadUpdate = {}
  const newNotes = dirtyEntries.map(([key, e]) => {
    payloadUpdate[key] = e.draft
    return {
      text: `${refFieldLabel(key)} changed from ${e.orig || '--'} to ${e.draft || '--'}.`,
      at: new Date().toISOString(),
      by: currentSession?.user?.email ?? '',
    }
  })
  payloadUpdate.notes = [...newNotes, ...(refPayload.notes ?? [])]

  const result = await api('PATCH', `/api/opportunities/${refOpportunityId}`, { payload: payloadUpdate })
  if (!result.ok) {
    feedback.textContent = result.data?.error ?? 'Failed to save.'
    feedback.className = 'msg-error'
    return
  }
  refEdits = {}
  await loadOpportunityDetail(refOpportunityId)
}

function renderRefNotes(notes) {
  const container = document.getElementById('ref-notes-list')
  const shown = (notes ?? []).slice(0, 5)
  if (!shown.length) {
    container.innerHTML = '<p class="empty-state">No notes yet.</p>'
    return
  }
  container.innerHTML = shown.map(n => `
    <div class="ref-notes-row">
      <span class="ref-notes-when">${formatDate(n.at)}</span><span class="ref-notes-author">${escHtml(n.by ?? '')}</span><span class="ref-notes-text">${escHtml(n.text)}</span>
    </div>`).join('')
}

// ── Est. Close Date: its own dedicated form, not the generic click-to-edit
// flow above — moving it is a business event (mandatory reason, writes a
// note, bumps a counter, updates opportunity_details), not a plain value
// change, matching how the extraction spec singles it out. ─────────────────
window.openCloseDateEdit = function () {
  document.getElementById('ref-closedate-form').classList.remove('hidden')
  document.getElementById('ref-closedate-date').value = refOppDetails.forecast_close_date ?? ''
  document.getElementById('ref-closedate-reason').value = ''
  document.getElementById('ref-closedate-error').classList.add('hidden')
}

window.cancelCloseDateEdit = function () {
  document.getElementById('ref-closedate-form').classList.add('hidden')
}

window.saveCloseDateMove = async function () {
  const date = document.getElementById('ref-closedate-date').value
  const reason = document.getElementById('ref-closedate-reason').value.trim()
  const errEl = document.getElementById('ref-closedate-error')
  errEl.classList.add('hidden')

  if (!date) {
    errEl.textContent = 'Date is required.'
    errEl.classList.remove('hidden')
    return
  }
  if (!reason) {
    errEl.textContent = 'A reason for the move is required.'
    errEl.classList.remove('hidden')
    return
  }

  const result = await api('POST', `/api/opportunities/${refOpportunityId}/close-date-move`, { date, reason })
  if (!result.ok) {
    errEl.textContent = result.data?.error ?? 'Failed to save.'
    errEl.classList.remove('hidden')
    return
  }
  document.getElementById('ref-closedate-form').classList.add('hidden')
  await loadOpportunityDetail(refOpportunityId)
}

function wireRefOnce() {
  if (refWired) return
  refWired = true
  document.getElementById('ref-cancel-all').addEventListener('click', () => {
    Object.keys(refEdits).forEach(key => window.discardRefField(key))
  })
  document.getElementById('ref-save-all').addEventListener('click', saveRefFields)
}

// ── Entry point, called by app.js's renderOppDetail() ─────────────────────
window.initOpportunityReferencePanel = function (opp) {
  wireRefOnce()
  renderReferenceTab(opp)
}
