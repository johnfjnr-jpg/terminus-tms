// Account detail (Round 5 Phase 10, 2026-08-17): genuinely new page - no
// Account list/detail screen existed anywhere before this round, Account
// was only ever reachable through pickers (confirmed in Round 4's own
// investigation). Click-to-edit-in-place, same mechanism as
// test-bed-detail.js's tbFieldRow/openTbField/discardTbField/batched Save
// bar - deliberately NOT a reuse of the Round 4 "Account Details" modal
// (contact-detail.js's openAccountDetailsModal), which is an all-at-once
// create/view form, not this app's established per-record detail-page
// pattern. Everything Round 4's modal could set is editable here:
// Account Number (readonly, server-generated), Terminus Lead, Website
// URL, Parent Account, Billing/Shipping Address.
//
// Classic script (not a module) - reuses api()/escHtml()/formatDate()/
// currentSession/accountsCache/terminusStaffCache/loadTerminusStaffIfNeeded()
// from app.js, which is loaded immediately before this file.

let acctDetailId = null
// Round 38: the revision this screen is looking at. Sent with every save, so a
// save against an Account that moved since the page loaded is refused rather
// than silently overwriting whoever moved it. Refreshed from the save's own
// response, otherwise the second save from one sitting would always conflict.
let acctLoadedRevision = null
let acctRecord = {}
let acctPayload = {}
let acctEdits = {} // key -> { draft, orig }, same convention as tbEdits/cdEdits
let acctParentId = null // parent_account_id - a real column, not a payload key; saved immediately on Link, not batched with acctEdits

const ACCT_REGION_OPTIONS = ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa']

const ACCT_DETAIL_FIELDS = [
  { key: 'terminusLead', label: 'Terminus Lead', staffField: true },
  { key: 'websiteUrl', label: 'Website URL' },
]
const ACCT_ADDRESS_SUFFIXES = [
  { suffix: 'Address', label: 'Address Line 1' },
  { suffix: 'Address2', label: 'Address Line 2' },
  { suffix: 'City', label: 'City' },
  { suffix: 'Postcode', label: 'Postcode / Zip' },
  { suffix: 'Country', label: 'Country' },
  { suffix: 'Region', label: 'Region', options: ACCT_REGION_OPTIONS },
]
const ACCT_BILLING_FIELDS = ACCT_ADDRESS_SUFFIXES.map(f => ({ key: `billing${f.suffix}`, label: f.label, options: f.options }))
const ACCT_SHIPPING_FIELDS = ACCT_ADDRESS_SUFFIXES.map(f => ({ key: `shipping${f.suffix}`, label: f.label, options: f.options }))
const ACCT_NAME_FIELD = { key: 'name', label: 'Account Name' }
const ACCT_ALL_EDITABLE_FIELDS = [ACCT_NAME_FIELD, ...ACCT_DETAIL_FIELDS, ...ACCT_BILLING_FIELDS, ...ACCT_SHIPPING_FIELDS]

function acctFieldRow(key, label, value, opts = {}) {
  const v = value ?? ''
  const inputTag = opts.options
    ? `<select id="acct-input-${key}"><option value="">--</option>` +
      opts.options.map(o => `<option value="${escHtml(o)}"${o === v ? ' selected' : ''}>${escHtml(o)}</option>`).join('') +
      `</select>`
    : `<input type="text" id="acct-input-${key}" value="${escHtml(v)}">`
  return `
  <div class="ref-field" data-key="${key}">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display" id="acct-display-${key}" tabindex="0" onclick="openAcctField('${key}',true)" onkeydown="fieldDisplayKeydown(event,c=>openAcctField('${key}',true,c))">${escHtml(v) || '--'}</div>
    <div class="ref-field-edit hidden" id="acct-edit-${key}">
      ${inputTag}
      <span class="ref-field-discard" tabindex="0" onclick="discardAcctField('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();discardAcctField('${key}')}">&times;</span>
    </div>
  </div>`
}

function acctReadonlyRow(label, value) {
  return `
  <div class="ref-field">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display readonly">${escHtml(value) || '--'}</div>
  </div>`
}

async function loadAccountDetail(id) {
  await loadTerminusStaffIfNeeded()
  const result = await api('GET', `/api/accounts/${id}`)
  // Round 41 item K: cleared on both paths, so a record that could not be
  // fetched shows whatever it shows rather than the loading line for ever.
  if (!result.ok) { window.detailLoaded('account-detail'); return }
  renderAccountDetail(result.data)
  window.detailLoaded('account-detail')
}

function renderAccountDetail(account) {
  wireAcctOnce()
  acctDetailId = account.id
  acctLoadedRevision = Number.isInteger(account.latest_revision_number) ? account.latest_revision_number : null
  acctRecord = account
  acctPayload = account.payload ?? {}
  acctEdits = {}
  acctParentId = account.parent_account_id ?? null

  document.getElementById('acct-detail-name').textContent = acctPayload.name || '--'
  document.getElementById('acct-input-name').value = acctPayload.name ?? ''
  document.getElementById('acct-edit-name').classList.add('hidden')
  document.getElementById('acct-edit-name').classList.remove('dirty')
  document.getElementById('acct-detail-name').classList.remove('hidden')
  document.querySelector('#view-account-detail [data-key="name"]').classList.remove('field-editing')
  document.getElementById('acct-detail-number').textContent = account.reference_code || 'Not yet generated'

  document.getElementById('acct-detail-rows').innerHTML =
    ACCT_DETAIL_FIELDS.map(f => acctFieldRow(f.key, f.label, acctPayload[f.key], { options: f.staffField ? terminusStaffCache.map(s => s.name) : f.options })).join('')
    + acctReadonlyRow('Date Created', formatDate(account.created_at))

  document.getElementById('acct-billing-rows').innerHTML =
    ACCT_BILLING_FIELDS.map(f => acctFieldRow(f.key, f.label, acctPayload[f.key], { options: f.options })).join('')
  document.getElementById('acct-shipping-rows').innerHTML =
    ACCT_SHIPPING_FIELDS.map(f => acctFieldRow(f.key, f.label, acctPayload[f.key], { options: f.options })).join('')

  renderAcctParentRow()
  renderAcctLinkedContacts(account.contacts ?? [])

  updateAcctSaveBar()
  wireAcctFieldInputs()
}

// Parent Account: search-and-link over accountsCache, same case-
// insensitive substring match contact-detail.js's own Link-to-Account
// panel uses (findAccountMatches-equivalent), self-exclusion added since
// - unlike a brand-new Contact-linked Account - this Account already has
// a real id an operator could mistakenly try to link to itself.
// Round 6 Phase 4 (2026-08-17): real, confirmed CSS bug fixed here - this
// row used to put the readonly value and its action button as two
// separate direct children of .ref-field, a flex row .ref-field's own
// CSS only ever accounted for 2 children (label + one value column), not
// 3. .ref-field-display's own flex:1 stretched to fill the row, leaving
// the button competing for whatever narrow space remained at this card's
// minimum width (280px) - confirmed live, the button wrapped across 2-3
// lines with "None" sitting directly against it. Fixed by wrapping the
// value and button together in one column (matching the label+one-value
// shape .ref-field's CSS actually expects), stacked vertically rather
// than side-by-side - same "readonly status text above its own action
// button" shape contact-detail.js's Account card already uses
// (cd-account-status above cd-btn-link-account), not a new pattern.
function renderAcctParentRow() {
  const el = document.getElementById('acct-parent-row')
  const currentName = acctParentId ? (accountsCache.find(a => a.id === acctParentId)?.payload?.name ?? '--') : null

  if (currentName) {
    el.innerHTML = `
    <div class="ref-field" data-key="parentAccount">
      <div class="ref-field-label"><span>Parent Account</span></div>
      <div style="flex:1;min-width:0">
        <div class="ref-field-display readonly">${escHtml(currentName)}</div>
        <button class="btn-text" style="margin-top:8px" onclick="openAcctParentSearch()">Change</button>
      </div>
    </div>
    <div id="acct-parent-search-panel" class="hidden" style="margin-top:8px"></div>`
    return
  }

  el.innerHTML = `
  <div class="ref-field" data-key="parentAccount">
    <div class="ref-field-label"><span>Parent Account</span></div>
    <div style="flex:1;min-width:0">
      <div class="ref-field-display readonly">None</div>
      <button class="btn-text" style="margin-top:8px" onclick="openAcctParentSearch()">Link Parent Account</button>
    </div>
  </div>
  <div id="acct-parent-search-panel" class="hidden" style="margin-top:8px"></div>`
}

window.openAcctParentSearch = function () {
  const panel = document.getElementById('acct-parent-search-panel')
  panel.classList.remove('hidden')
  panel.innerHTML = `
    <input type="text" id="acct-parent-search-input" placeholder="Search accounts..." oninput="renderAcctParentResults(this.value)">
    <div id="acct-parent-results" style="margin-top:6px"></div>
    <p class="msg-error hidden" id="acct-parent-error" style="margin-top:6px"></p>`
  document.getElementById('acct-parent-search-input').focus()
}

window.renderAcctParentResults = function (query) {
  const q = query.trim().toLowerCase()
  const results = document.getElementById('acct-parent-results')
  if (!q) {
    results.innerHTML = ''
    return
  }
  const matches = accountsCache
    .filter(a => a.id !== acctDetailId && (a.payload?.name ?? '').toLowerCase().includes(q))
    .slice(0, 10)
  results.innerHTML = matches.length
    ? matches.map(a => `<div style="padding:8px 10px;cursor:pointer" data-account-id="${a.id}" onclick="linkAcctParent(this.dataset.accountId)">${escHtml(a.payload?.name ?? '--')}</div>`).join('')
    : '<p class="empty-state" style="padding:8px 10px">No matches.</p>'
}

window.linkAcctParent = async function (parentId) {
  const errEl = document.getElementById('acct-parent-error')
  const result = await api('PATCH', `/api/accounts/${acctDetailId}`, { parent_account_id: parentId })
  if (!result.ok) {
    errEl.textContent = result.data?.error ?? 'Failed to link Parent Account.'
    errEl.classList.remove('hidden')
    return
  }
  await loadAccountDetail(acctDetailId)
}

function renderAcctLinkedContacts(contacts) {
  const el = document.getElementById('acct-contacts-list')
  if (!contacts.length) {
    el.innerHTML = '<p class="empty-state">No Contacts linked to this Account yet.</p>'
    return
  }
  el.innerHTML = contacts.map(c => `
    <div class="data-row" style="cursor:pointer" onclick="navigate('contact-detail', '${c.id}')">
      <span style="font-size:13px">${escHtml(c.payload?.name ?? '--')}</span>
      <span class="data-row-label">${escHtml(c.status ?? '')}</span>
    </div>`).join('')
}

// ── Click-to-edit mechanics (plain fields only - Parent Account links
// immediately via its own action above, not through this batched bar) ──
function wireAcctFieldInputs() {
  ACCT_ALL_EDITABLE_FIELDS.forEach(f => {
    const input = document.getElementById(`acct-input-${f.key}`)
    if (!input) return
    input.addEventListener('input', () => onAcctFieldInput(f.key))
    if (input.tagName === 'SELECT') input.addEventListener('change', () => onAcctFieldInput(f.key))
  })
}

// fromUserGesture (Round 10 Phase 0A): see window.revealFieldControl in app.js.
window.openAcctField = function (key, fromUserGesture, seedChar) {
  if (acctEdits[key]) return
  const orig = String(acctPayload[key] ?? '')
  acctEdits[key] = { draft: orig, orig }
  document.getElementById(`acct-display-${key}`).classList.add('hidden')
  document.getElementById(`acct-edit-${key}`).classList.remove('hidden')
  window.revealFieldControl(document.getElementById(`acct-input-${key}`), fromUserGesture, seedChar)
  clearAcctSaveFeedback()
  updateAcctSaveBar()
}

function clearAcctSaveFeedback() {
  const feedback = document.getElementById('acct-save-feedback')
  feedback.textContent = ''
  feedback.className = ''
}

window.discardAcctField = function (key) {
  delete acctEdits[key]
  const editEl = document.getElementById(`acct-edit-${key}`)
  editEl.classList.add('hidden')
  editEl.classList.remove('dirty')
  document.getElementById(`acct-display-${key}`).classList.remove('hidden')
  document.querySelector(`#view-account-detail [data-key="${key}"]`)?.classList.remove('field-editing')
  const input = document.getElementById(`acct-input-${key}`)
  if (input) input.value = acctPayload[key] ?? ''
  updateAcctSaveBar()
}

function onAcctFieldInput(key) {
  const edit = acctEdits[key]
  if (!edit) return
  edit.draft = document.getElementById(`acct-input-${key}`).value
  const isDirty = edit.draft !== edit.orig
  document.getElementById(`acct-edit-${key}`).classList.toggle('dirty', isDirty)
  document.querySelector(`#view-account-detail [data-key="${key}"]`)?.classList.toggle('field-editing', isDirty)
  updateAcctSaveBar()
}

function updateAcctSaveBar() {
  const bar = document.getElementById('acct-save-bar')
  const dirtyCount = Object.values(acctEdits).filter(e => e.draft !== e.orig).length
  bar.classList.toggle('hidden', dirtyCount === 0)
}

async function saveAcctFields() {
  clearAcctSaveFeedback()
  const feedback = document.getElementById('acct-save-feedback')

  const dirtyEntries = Object.entries(acctEdits).filter(([, e]) => e.draft !== e.orig)
  if (!dirtyEntries.length) return

  if (dirtyEntries.some(([key]) => key === 'name') && !dirtyEntries.find(([key]) => key === 'name')[1].draft.trim()) {
    feedback.textContent = 'Account Name is required.'
    feedback.className = 'msg-error'
    return
  }

  const payloadUpdate = {}
  for (const [key, e] of dirtyEntries) payloadUpdate[key] = e.draft

  const result = await api('PATCH', `/api/accounts/${acctDetailId}`,
    { payload: payloadUpdate, expected_revision: acctLoadedRevision })
  if (!result.ok) {
    feedback.textContent = result.status === 409
      ? (result.data?.error ?? 'This Account changed since the screen loaded. Reload before saving.')
      : (result.data?.error ?? 'Failed to save.')
    feedback.className = 'msg-error'
    return
  }
  if (Number.isInteger(result.data?.revision_number)) acctLoadedRevision = result.data.revision_number
  acctEdits = {}
  await loadAccountDetail(acctDetailId)
  await loadAccountsList()
}

let acctWired = false
function wireAcctOnce() {
  if (acctWired) return
  acctWired = true
  document.getElementById('acct-cancel-all').addEventListener('click', () => {
    Object.keys(acctEdits).forEach(key => window.discardAcctField(key))
    clearAcctSaveFeedback()
  })
  document.getElementById('acct-save-all').addEventListener('click', saveAcctFields)
}
