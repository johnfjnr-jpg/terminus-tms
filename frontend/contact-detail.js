// Contact detail: click-to-edit-in-place fields (same mechanism as
// opportunity-reference.js's Reference tab - several fields can be open
// at once, one Save writes one timestamped note per changed field to a
// real, append-only Notes History), plus Qualify/Park/Unqualified as
// direct actions replacing the old 3-chip Manage picker. Classic script
// (not a module) - reuses api()/escHtml()/formatDate()/currentSession/
// accountsCache/industriesCache/loadContactsData() from app.js, which is
// loaded immediately before this file.

let cdContactId = null
let cdContact = null
let cdPayload = {}
let cdReturnView = 'leads'
let cdEdits = {} // same shape as opportunity-reference.js's refEdits
let cdWired = false

// industry is a real records column (industry_id), not a payload key -
// same RECORD_COLUMN_FIELDS distinction transitions.js already makes. It
// still goes through the same click-to-edit-in-place UI and the same
// PATCH call, just as top-level industry_id rather than inside payload,
// and its note text uses the looked-up name, not the raw id.
//
// company is plain free text (2026-08-13 correction) - a normal payload
// field like Job Role, edited the same way as everything else in
// CD_CONTACT_FIELDS. It is NOT the real Account link - that's
// parent_record_id, resolved separately via the Account card's "Link to
// Account" action below, and never overwrites this field.
const CD_COLUMN_FIELDS = [
  { key: 'industry', label: 'Industry' },
]
const CD_CONTACT_FIELDS = [
  { key: 'company', label: 'Company' },
  { key: 'jobRole', label: 'Job Role' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'source', label: 'Source', options: ['Web', 'Email Inquiry', 'Referral', 'Direct Outreach', 'Marketing Campaign'] },
]
const CD_ADDRESS_FIELDS = [
  { key: 'address', label: 'Address Line 1' },
  { key: 'address2', label: 'Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode / Zip' },
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region', options: ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa'] },
]
const CD_SUMMARY_FIELD = { key: 'summary', label: 'Summary' }
const CD_ALL_FIELDS = [...CD_COLUMN_FIELDS, ...CD_CONTACT_FIELDS, ...CD_ADDRESS_FIELDS, CD_SUMMARY_FIELD]

function cdFieldLabel(key) {
  return CD_ALL_FIELDS.find(f => f.key === key)?.label ?? key
}

function cdNoteFor(key, fromValue, toValue) {
  return {
    text: `${cdFieldLabel(key)} changed from ${fromValue || '--'} to ${toValue || '--'}.`,
    at: new Date().toISOString(),
    by: currentSession?.user?.email ?? '',
  }
}

function cdAccountName(id) {
  return accountsCache.find(a => a.id === id)?.payload?.name ?? ''
}
function cdIndustryName(id) {
  return industriesCache.find(i => i.id === id)?.name ?? ''
}

// ── Account card: the real Account link (parent_record_id), resolved
// here via "Link to Account" - deliberately separate from the free-text
// Company field above, which this never touches. ───────────────────────
function renderCdAccountCard() {
  const name = cdAccountName(cdContact.parent_record_id)
  document.getElementById('cd-account-status').textContent = name ? `Linked to: ${name}` : 'Not linked yet.'
  document.getElementById('cd-link-account-panel').classList.add('hidden')
  document.getElementById('cd-link-error').classList.add('hidden')
}

window.openCdLinkAccountPanel = function () {
  document.getElementById('cd-link-account-panel').classList.remove('hidden')
  document.getElementById('cd-link-error').classList.add('hidden')
  const searchInput = document.getElementById('cd-link-search')
  // Pre-filled with the contact's own as-typed company text - the
  // natural starting query for reconciling it against real Accounts.
  searchInput.value = cdPayload.company ?? ''
  renderCdLinkResults(searchInput.value)
  searchInput.focus()
}

// Case-insensitive substring match against every real Account's name,
// live as the user types - client-side over the already-fetched
// accountsCache, no new search endpoint, same pattern as the Mine
// toggle. Deliberately not fuzzy/typo-tolerant: the "+ Create new
// Account" option is always shown alongside whatever matches, so
// reconciling a genuine typo or naming variation is a human judgment
// call made by scanning a short real candidate list, not something this
// tries to guess algorithmically.
function renderCdLinkResults(query) {
  const q = query.trim().toLowerCase()
  const matches = q ? accountsCache.filter(a => (a.payload?.name ?? '').toLowerCase().includes(q)) : accountsCache

  const matchRows = matches.slice(0, 20).map(a => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid var(--hairline-strong)">
      <span>${escHtml(a.payload?.name ?? '--')}</span>
      <button class="btn-sm btn-primary" onclick="linkCdAccount('${a.id}')">Link</button>
    </div>`).join('')

  const trimmed = query.trim()
  const createRow = trimmed ? `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px dashed var(--hairline-strong)">
      <span>+ Create new Account "${escHtml(trimmed)}"</span>
      <button class="btn-sm" onclick='linkCdAccount(null, ${JSON.stringify(trimmed)})'>Create &amp; link</button>
    </div>` : ''

  document.getElementById('cd-link-results').innerHTML = (matchRows + createRow) || '<p class="empty-state">Type to search.</p>'
}

window.linkCdAccount = async function (accountId, newAccountName) {
  const errEl = document.getElementById('cd-link-error')
  errEl.classList.add('hidden')

  const body = accountId ? { account_id: accountId } : { new_account_name: newAccountName }
  const result = await api('POST', `/api/contacts/${cdContactId}/link-account`, body)
  if (!result.ok) {
    errEl.textContent = result.data?.error ?? 'Failed to link account.'
    errEl.classList.remove('hidden')
    return
  }

  await loadContactsData()
  await loadContactDetail(cdContactId)
}

// Only Industry uses this now that Company/Account is its own card below.
function cdColumnFieldRow(field, currentId) {
  const options = industriesCache.map(row => ({ id: row.id, name: row.name }))
  return `
  <div class="ref-field" data-key="${field.key}">
    <div class="ref-field-label"><span>${field.label}</span></div>
    <div class="ref-field-display" id="cd-display-${field.key}" onclick="openCdField('${field.key}')">${escHtml(cdIndustryName(currentId)) || '--'}</div>
    <div class="ref-field-edit hidden" id="cd-edit-${field.key}">
      <select id="cd-input-${field.key}">
        <option value="">Select ${field.label.toLowerCase()}</option>
        ${options.map(o => `<option value="${o.id}"${o.id === currentId ? ' selected' : ''}>${escHtml(o.name ?? '--')}</option>`).join('')}
      </select>
      <span class="ref-field-discard" onclick="discardCdField('${field.key}')">&times;</span>
    </div>
  </div>`
}

function cdFieldRow(key, label, value, opts = {}) {
  const v = value ?? ''
  const inputTag = opts.options
    ? `<select id="cd-input-${key}">` + opts.options.map(o => `<option value="${escHtml(o)}"${o === v ? ' selected' : ''}>${escHtml(o)}</option>`).join('') + `</select>`
    : `<input type="text" id="cd-input-${key}" value="${escHtml(v)}">`
  return `
  <div class="ref-field" data-key="${key}">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display" id="cd-display-${key}" onclick="openCdField('${key}')">${escHtml(v) || '--'}</div>
    <div class="ref-field-edit hidden" id="cd-edit-${key}">
      ${inputTag}
      <span class="ref-field-discard" onclick="discardCdField('${key}')">&times;</span>
    </div>
  </div>`
}

async function loadContactDetail(id) {
  const result = await api('GET', '/api/contacts')
  if (!result.ok) return
  const contact = result.data.find(c => c.id === id)
  if (!contact) return

  if (!accountsCache.length) {
    const accResult = await api('GET', '/api/accounts')
    if (accResult.ok) accountsCache = accResult.data
  }
  if (!industriesCache.length) {
    const indResult = await api('GET', '/api/industries')
    if (indResult.ok) industriesCache = indResult.data
  }

  renderContactDetail(contact)
}

function renderContactDetail(contact) {
  cdContactId = contact.id
  cdContact = contact
  cdPayload = contact.payload ?? {}
  cdReturnView = contact.status === 'Qualified' ? 'contacts' : 'leads'
  cdEdits = {}

  // Once linked, the real Account's name is authoritative and takes over
  // display everywhere - the free-text company is the fallback until
  // then, never the other way round (confirmed, not assumed).
  const account = accountsCache.find(a => a.id === contact.parent_record_id)
  document.getElementById('cd-name').textContent = cdPayload.name ?? '--'
  document.getElementById('cd-company').textContent = account?.payload?.name ?? cdPayload.company ?? '--'
  document.getElementById('cd-status').textContent = contact.status

  renderCdAccountCard()

  document.getElementById('cd-contact-rows').innerHTML =
    CD_COLUMN_FIELDS.map(f => cdColumnFieldRow(f, cdCurrentValue(f.key))).join('') +
    CD_CONTACT_FIELDS.map(f => cdFieldRow(f.key, f.label, cdPayload[f.key], f)).join('')
  document.getElementById('cd-address-rows').innerHTML =
    CD_ADDRESS_FIELDS.map(f => cdFieldRow(f.key, f.label, cdPayload[f.key], f)).join('')

  document.getElementById('cd-display-summary').textContent = cdPayload.summary || 'No summary captured yet.'
  document.getElementById('cd-input-summary').value = cdPayload.summary ?? ''
  document.getElementById('cd-edit-summary').classList.add('hidden')
  document.getElementById('cd-display-summary').classList.remove('hidden')

  renderCdNotes(cdPayload.notes ?? [])
  updateCdEditBar()
  wireCdFieldInputs()

  renderCdActions()
  renderCdCreateDelete()

  document.getElementById('cd-park-form').classList.add('hidden')
  document.getElementById('cd-action-feedback').textContent = ''

  if (cdPendingQualifyBlocking) {
    showCdQualifyBanner(cdPendingQualifyBlocking)
    cdPendingQualifyBlocking = null
  } else {
    document.getElementById('cd-qualify-banner').classList.add('hidden')
  }

  if (cdPendingOpenPark) {
    cdPendingOpenPark = false
    openCdParkForm()
  }
}

function wireCdFieldInputs() {
  CD_ALL_FIELDS.forEach(f => {
    const input = document.getElementById(`cd-input-${f.key}`)
    if (!input) return
    input.addEventListener('input', () => onCdFieldInput(f.key))
    if (input.tagName === 'SELECT') input.addEventListener('change', () => onCdFieldInput(f.key))
  })
}

// industry lives on the record itself (industry_id), everything else
// (including company, plain free text) is a payload key - same
// distinction RECORD_COLUMN_FIELDS makes server-side in transitions.js.
function cdCurrentValue(key) {
  if (key === 'industry') return cdContact.industry_id ?? ''
  return cdPayload[key] ?? ''
}

window.openCdField = function (key) {
  if (cdEdits[key]) return
  const orig = String(cdCurrentValue(key) ?? '')
  cdEdits[key] = { draft: orig, orig }
  document.getElementById(`cd-display-${key}`).classList.add('hidden')
  document.getElementById(`cd-edit-${key}`).classList.remove('hidden')
  document.getElementById(`cd-input-${key}`).focus()
  updateCdEditBar()
}

window.discardCdField = function (key) {
  delete cdEdits[key]
  const editEl = document.getElementById(`cd-edit-${key}`)
  editEl.classList.add('hidden')
  editEl.classList.remove('dirty')
  document.getElementById(`cd-display-${key}`).classList.remove('hidden')
  const input = document.getElementById(`cd-input-${key}`)
  if (input) input.value = cdCurrentValue(key)
  updateCdEditBar()
}

function onCdFieldInput(key) {
  const edit = cdEdits[key]
  if (!edit) return
  edit.draft = document.getElementById(`cd-input-${key}`).value
  document.getElementById(`cd-edit-${key}`).classList.toggle('dirty', edit.draft !== edit.orig)
  updateCdEditBar()
}

function updateCdEditBar() {
  const bar = document.getElementById('cd-edit-bar')
  const keys = Object.keys(cdEdits)
  if (!keys.length) {
    bar.classList.add('hidden')
    return
  }
  bar.classList.remove('hidden')
  const dirtyCount = keys.filter(k => cdEdits[k].draft !== cdEdits[k].orig).length
  document.getElementById('cd-edit-count').textContent =
    `${keys.length} field${keys.length === 1 ? '' : 's'} open${dirtyCount ? `, ${dirtyCount} changed` : ''}`
  document.getElementById('cd-save-all').classList.toggle('hidden', dirtyCount === 0)
}

async function saveCdFields() {
  const feedback = document.getElementById('cd-save-feedback')
  feedback.textContent = ''
  feedback.className = ''

  const dirtyEntries = Object.entries(cdEdits).filter(([, e]) => e.draft !== e.orig)
  if (!dirtyEntries.length) return

  const body = {}
  const payloadUpdate = {}
  const newNotes = dirtyEntries.map(([key, e]) => {
    if (key === 'industry') {
      body.industry_id = e.draft || null
      return cdNoteFor(key, cdIndustryName(e.orig), cdIndustryName(e.draft))
    }
    payloadUpdate[key] = e.draft
    return cdNoteFor(key, e.orig, e.draft)
  })
  payloadUpdate.notes = [...newNotes, ...(cdPayload.notes ?? [])]
  body.payload = payloadUpdate

  const result = await api('PATCH', `/api/contacts/${cdContactId}`, body)
  if (!result.ok) {
    feedback.textContent = result.data?.error ?? 'Failed to save.'
    feedback.className = 'msg-error'
    return
  }
  cdEdits = {}
  await loadContactDetail(cdContactId)
  await loadContactsData()
}

// Append-only: always the full history, latest first, never truncated -
// "Notes History log" per the ask, distinct from Opportunity's Notes
// panel, which deliberately shows only the last 5.
function renderCdNotes(notes) {
  const container = document.getElementById('cd-notes-list')
  if (!notes.length) {
    container.innerHTML = '<p class="empty-state">No notes yet.</p>'
    return
  }
  container.innerHTML = notes.map(n => `
    <div class="ref-notes-row">
      <div class="ref-notes-when">${formatDate(n.at)}<span>${escHtml(n.by ?? '')}</span></div>
      <div class="ref-notes-text">${escHtml(n.text)}</div>
    </div>`).join('')
}

// ── Qualify / Park / Unqualified: direct actions, replacing the old
// 3-chip Manage picker. ─────────────────────────────────────────────────
function renderCdActions() {
  document.getElementById('cd-btn-qualify').classList.toggle('hidden', cdContact.status === 'Qualified')
  document.getElementById('cd-btn-park').classList.toggle('hidden', cdContact.status === 'Parked')
  document.getElementById('cd-btn-unqualify').classList.toggle('hidden', cdContact.status === 'Unqualified')
}

// The backend's blocking message is a generic "Requires X to be set"
// built from the raw field name - fine for most fields, but
// parent_record_id is a real records column, not something a user
// recognises. Display-only remap, the backend message itself is
// untouched.
const CD_BLOCKING_FIELD_LABELS = { parent_record_id: 'an Account to be linked' }

function showCdQualifyBanner(blocking) {
  document.getElementById('cd-qualify-banner').classList.remove('hidden')
  document.getElementById('cd-qualify-missing').innerHTML = blocking.map(b => {
    const friendly = CD_BLOCKING_FIELD_LABELS[b.field]
    const text = friendly ? `Requires ${friendly}.` : b.message
    return `<li>${escHtml(text)}</li>`
  }).join('')
}

window.attemptContactQualifyFromDetail = async function () {
  const feedback = document.getElementById('cd-action-feedback')
  feedback.textContent = ''
  const result = await api('POST', `/api/records/${cdContactId}/transition`, { to_stage: 'Qualified' })
  if (!result.ok) {
    if (result.status === 422 && result.data.blocking?.length) {
      showCdQualifyBanner(result.data.blocking)
    } else {
      feedback.textContent = result.data?.error ?? 'Failed to qualify.'
      feedback.className = 'msg-error'
    }
    return
  }
  document.getElementById('cd-qualify-banner').classList.add('hidden')
  await loadContactsData()
  await loadContactDetail(cdContactId)
}

window.attemptContactUnqualifyFromDetail = async function () {
  await api('POST', `/api/records/${cdContactId}/transition`, { to_stage: 'Unqualified' })
  await loadContactsData()
  await loadContactDetail(cdContactId)
}

function openCdParkForm() {
  document.getElementById('cd-park-form').classList.remove('hidden')
  document.getElementById('cd-park-date').value = cdPayload.followUpDate ?? ''
  document.getElementById('cd-park-reason').value = ''
  document.getElementById('cd-park-error').classList.add('hidden')
}

// Park's mandatory reason appends to the same real Notes History as
// field edits - "Contact parked. Follow up on <date>. <reason>" - written
// in the same PATCH that saves followUpDate (the Unqualified -> Parked
// payload_field_required gate needs that saved before the transition
// will succeed), then the transition itself is called separately, same
// two-step sequence the row-level park flow used before this rebuild.
async function saveCdParkForm() {
  const date = document.getElementById('cd-park-date').value
  const reason = document.getElementById('cd-park-reason').value.trim()
  const errEl = document.getElementById('cd-park-error')
  errEl.classList.add('hidden')

  if (!date) {
    errEl.textContent = 'Follow-up date is required.'
    errEl.classList.remove('hidden')
    return
  }
  if (!reason) {
    errEl.textContent = 'A reason for parking is required.'
    errEl.classList.remove('hidden')
    return
  }

  const note = {
    text: `Contact parked. Follow up on ${formatDate(date)}. ${reason}`,
    at: new Date().toISOString(),
    by: currentSession?.user?.email ?? '',
  }
  const patchResult = await api('PATCH', `/api/contacts/${cdContactId}`, {
    payload: { followUpDate: date, notes: [note, ...(cdPayload.notes ?? [])] }
  })
  if (!patchResult.ok) {
    errEl.textContent = patchResult.data?.error ?? 'Failed to save.'
    errEl.classList.remove('hidden')
    return
  }

  const transitionResult = await api('POST', `/api/records/${cdContactId}/transition`, { to_stage: 'Parked' })
  if (!transitionResult.ok) {
    errEl.textContent = transitionResult.data?.error ?? 'Failed to park.'
    errEl.classList.remove('hidden')
    return
  }

  document.getElementById('cd-park-form').classList.add('hidden')
  await loadContactsData()
  await loadContactDetail(cdContactId)
}

// ── + Create / Delete: unchanged from the list row's Manage panel,
// just rendered here too so the detail page is a complete place to work
// from a Qualified contact. ─────────────────────────────────────────────
function renderCdCreateDelete() {
  const createSection = document.getElementById('cd-create-section')
  if (cdContact.status === 'Qualified') {
    createSection.innerHTML = `
      <p class="label" style="margin-bottom:10px">+ Create</p>
      <div style="display:flex;gap:10px;align-items:center">
        <button class="btn-sm btn-primary" onclick="createFromContact('${cdContactId}', 'test-bed')">Test Bed</button>
        <button class="btn-sm btn-primary" onclick="createFromContact('${cdContactId}', 'opportunity')">Opportunity</button>
      </div>
      <div id="contact-create-feedback-${cdContactId}" style="margin-top:8px"></div>`
  } else {
    createSection.innerHTML = ''
  }

  document.getElementById('cd-delete-section').innerHTML =
    `<button class="btn-text" onclick="deleteContactFromDetail()">&times; Delete</button>`
}

window.deleteContactFromDetail = async function () {
  const result = await api('DELETE', `/api/contacts/${cdContactId}`)
  if (!result.ok) return
  await loadContactsData()
  navigate(cdReturnView)
}

function wireCdOnce() {
  if (cdWired) return
  cdWired = true
  document.getElementById('cd-cancel-all').addEventListener('click', () => {
    Object.keys(cdEdits).forEach(key => window.discardCdField(key))
  })
  document.getElementById('cd-save-all').addEventListener('click', saveCdFields)
  document.getElementById('cd-btn-qualify').addEventListener('click', window.attemptContactQualifyFromDetail)
  document.getElementById('cd-btn-park').addEventListener('click', openCdParkForm)
  document.getElementById('cd-btn-unqualify').addEventListener('click', window.attemptContactUnqualifyFromDetail)
  document.getElementById('cd-park-cancel').addEventListener('click', () => document.getElementById('cd-park-form').classList.add('hidden'))
  document.getElementById('cd-park-save').addEventListener('click', saveCdParkForm)
  document.getElementById('cd-btn-link-account').addEventListener('click', window.openCdLinkAccountPanel)
  document.getElementById('cd-link-cancel').addEventListener('click', () => document.getElementById('cd-link-account-panel').classList.add('hidden'))
  document.getElementById('cd-link-search').addEventListener('input', (e) => renderCdLinkResults(e.target.value))
}

wireCdOnce()
