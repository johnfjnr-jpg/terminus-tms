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
let cdCurrentBlocking = [] // the real blocking[] from the last Qualify attempt, [] once resolved

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
// Name lives in the page header now (cd-display-name/cd-edit-name),
// click-to-edit the same as every other field, not repeated here
// (2026-08-13, confirmed): the header's Name and this panel's Name row
// were always the exact same value with no divergence, pure
// duplication, unlike Company below (kept in the panel - the header's
// own Company subtitle shows the resolved Account name once linked,
// cdPayload.company only as a fallback, so making the header itself
// the editable Company field would silently edit the wrong thing once
// an Account exists).
const CD_NAME_FIELD = { key: 'name', label: 'Name' }
// Company through LinkedIn, Industry and Source after (2026-08-13,
// confirmed order) - Industry renders separately via CD_COLUMN_FIELDS
// (a real records column, not a payload key), Source stays part of
// this array but rendered last, after Industry - see the render call
// in renderContactDetail below.
const CD_CONTACT_FIELDS = [
  { key: 'company', label: 'Company' },
  { key: 'jobRole', label: 'Job Role' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'linkedin', label: 'LinkedIn' },
]
const CD_SOURCE_FIELD = { key: 'source', label: 'Source', options: ['Web', 'Email Inquiry', 'Referral', 'Direct Outreach', 'Marketing Campaign'] }
const CD_ADDRESS_FIELDS = [
  { key: 'address', label: 'Address Line 1' },
  { key: 'address2', label: 'Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode / Zip' },
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region', options: ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa'] },
]
const CD_SUMMARY_FIELD = { key: 'summary', label: 'Summary' }
const CD_ALL_FIELDS = [CD_NAME_FIELD, ...CD_CONTACT_FIELDS, ...CD_COLUMN_FIELDS, CD_SOURCE_FIELD, ...CD_ADDRESS_FIELDS, CD_SUMMARY_FIELD]

function cdFieldLabel(key) {
  return CD_ALL_FIELDS.find(f => f.key === key)?.label ?? key
}

function cdChangeSentence(key, fromValue, toValue) {
  return `${cdFieldLabel(key)} changed from ${fromValue || '--'} to ${toValue || '--'}.`
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
  const linked = !!cdContact.parent_record_id
  const name = cdAccountName(cdContact.parent_record_id)
  document.getElementById('cd-account-status').textContent = name ? `Linked to: ${name}` : 'Not linked yet.'
  // Round 5 Phase 3 (2026-08-17): label describes the action about to
  // happen, not a fixed string - "Link to Account" only reads correctly
  // while nothing is linked yet; once something is, the real action this
  // button performs is changing it, not linking for the first time.
  document.getElementById('cd-btn-link-account').textContent = linked ? 'Change Account' : 'Link to Account'
  // Show Account Details is only meaningful once there's a real Account
  // to show - hidden while unlinked, same reasoning as the label switch.
  document.getElementById('cd-btn-show-account-details').classList.toggle('hidden', !linked)
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
//
// Shared with the automatic qualification-time decision (Round 4 Phase
// 4, attemptContactQualifyFromDetail below) - one definition of "does
// this Company text match an existing Account", not two independently
// maintained ones. An empty query intentionally returns every Account
// (this function's original browse-all behaviour for the manual search
// panel); the qualification caller never invokes it with an empty
// query, since Company is mandatory at Lead creation.
function findAccountMatches(query) {
  const q = query.trim().toLowerCase()
  return q ? accountsCache.filter(a => (a.payload?.name ?? '').toLowerCase().includes(q)) : accountsCache
}

function renderCdLinkResults(query) {
  const matches = findAccountMatches(query)

  const matchRows = matches.slice(0, 20).map(a => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid var(--hairline-strong)">
      <span>${escHtml(a.payload?.name ?? '--')}</span>
      <button class="btn-sm btn-primary" onclick="linkCdAccount(this, '${a.id}')">Link</button>
    </div>`).join('')

  const trimmed = query.trim()
  // The input is pre-filled with the search text as a convenient default,
  // but is a real editable field - the search text is what you were
  // looking for, not necessarily the name you want to create (2026-08-16
  // fix: this used to send the search box text verbatim, with no way to
  // correct it before creating).
  // Round 4 Phase 3 (2026-08-17): opens the full Account Details panel
  // instead of creating a bare, name-only Account directly - the text
  // input here still lets the name be corrected before opening it, same
  // as before.
  const createRow = trimmed ? `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:1px dashed var(--hairline-strong)">
      <span style="flex-shrink:0">+ Create new Account</span>
      <input type="text" id="cd-create-account-name" value="${escHtml(trimmed)}" style="flex:1;min-width:0">
      <button class="btn-sm" onclick="openAccountDetailsModal(document.getElementById('cd-create-account-name').value.trim())">Create new Account...</button>
    </div>` : ''

  document.getElementById('cd-link-results').innerHTML = (matchRows + createRow) || '<p class="empty-state">Type to search.</p>'
}

// Guards against duplicate submissions from a slow response or repeated
// clicks: cdLinkInFlight blocks a second real request from ever firing,
// and every button in the results list is disabled the moment one is
// clicked (not just the clicked one - clicking a different result while
// the first is still in flight would be just as much a duplicate).
let cdLinkInFlight = false

// accountDetails (Round 4 Phase 3, 2026-08-17): the full Account Details
// panel's field set, optional - undefined for the existing search-and-
// link path (accountId set) and for a plain name-only create (neither
// used by this file anymore, but the server still accepts it), present
// when the new panel submits. btn/allButtons below come from
// #cd-link-results normally, but the Account Details panel's own Save
// button isn't part of that list - accountDetails callers pass their own
// button and skip the #cd-link-results query, see saveAccountDetails.
window.linkCdAccount = async function (btn, accountId, newAccountName, accountDetails) {
  if (cdLinkInFlight) return
  // Same shared discard-confirmation dialog as Park's Cancel/close
  // (2026-08-15 fix) - "Keep editing" just closes the dialog, returning
  // control so the user can click the already-visible Save button
  // themselves before retrying; "Discard" proceeds with the link,
  // accepting the loss the same way Park's own Discard accepts losing
  // its form.
  if (cdHasDirtyEdits()) {
    openDiscardConfirm(() => performLinkCdAccount(btn, accountId, newAccountName, accountDetails))
    return
  }
  await performLinkCdAccount(btn, accountId, newAccountName, accountDetails)
}

async function performLinkCdAccount(btn, accountId, newAccountName, accountDetails) {
  cdLinkInFlight = true

  const allButtons = accountDetails ? [btn] : document.querySelectorAll('#cd-link-results button')
  allButtons.forEach(b => { b.disabled = true })
  const originalText = btn.textContent
  btn.textContent = accountId ? 'Linking...' : 'Creating...'

  const errEl = accountDetails ? document.getElementById('account-details-error') : document.getElementById('cd-link-error')
  errEl.classList.add('hidden')

  const body = accountId ? { account_id: accountId } : { new_account_name: newAccountName, ...(accountDetails ? { account_details: accountDetails } : {}) }
  const result = await api('POST', `/api/contacts/${cdContactId}/link-account`, body)
  cdLinkInFlight = false

  if (!result.ok) {
    errEl.textContent = result.data?.error ?? 'Failed to link account.'
    errEl.classList.remove('hidden')
    allButtons.forEach(b => { b.disabled = false })
    btn.textContent = originalText
    return
  }

  if (accountDetails) closeAccountDetailsModal()

  await loadContactsData()
  await loadContactDetail(cdContactId)
}

// ── Account Details panel (Round 4 Phase 3, 2026-08-17) ────────────────
// Full creation form for a new Account, replacing the bare name-only
// create path. Billing/Shipping Address pre-fill from this Contact's own
// address at open time (a one-time copy, per the brief - never kept in
// sync afterward, each is a fully independent set of inputs from the
// moment the panel opens).
let accountDetailsKeydownHandler = null
let accountDetailsParentId = null
let accountDetailsOpenerId = null // Round 5 Phase 3: whichever button opened this modal, so Escape/Close return focus to the right place, matching INTERACTION_STANDARDS.md Section 4 rather than always assuming the create-flow's own trigger.

// Round 5 Phase 3 (2026-08-17): toggles the panel between its original
// create-a-new-Account mode (Round 4, editable, Save writes a real
// record) and a new view-only mode (Show Account Details - real,
// already-saved values, nothing editable, no Save). Both modes render
// through the exact same DOM/fields rather than a second template, so
// the two can never structurally drift apart - only this one switch
// governs what's interactive.
function setAccountDetailsMode(mode) {
  const viewing = mode === 'view'
  const fieldIds = [
    'account-details-name', 'account-details-terminus-lead', 'account-details-website',
    'account-details-billing-address', 'account-details-billing-address2', 'account-details-billing-city',
    'account-details-billing-postcode', 'account-details-billing-country', 'account-details-billing-region',
    'account-details-shipping-address', 'account-details-shipping-address2', 'account-details-shipping-city',
    'account-details-shipping-postcode', 'account-details-shipping-country', 'account-details-shipping-region',
  ]
  fieldIds.forEach(id => { document.getElementById(id).disabled = viewing })
  document.getElementById('account-details-parent-search').classList.toggle('hidden', viewing)
  document.getElementById('account-details-save').classList.toggle('hidden', viewing)
  document.getElementById('account-details-cancel').textContent = viewing ? 'Close' : 'Cancel'
  document.getElementById('account-details-subtitle').textContent = viewing
    ? 'Viewing this Account\'s details.'
    : 'Only Account Name is required - everything else can be filled in later.'
}

window.openAccountDetailsModal = async function (prefillName) {
  setAccountDetailsMode('create')
  accountDetailsOpenerId = 'cd-create-account-name' // the create-new row's own trigger context; not itself focusable after close, closeAccountDetailsModal already falls back sanely below.
  document.getElementById('account-details-heading').textContent = 'New Account'
  document.getElementById('account-details-name').value = prefillName ?? ''
  document.getElementById('account-details-number').textContent = 'Not yet generated'
  document.getElementById('account-details-created').textContent = '--'
  document.getElementById('account-details-website').value = ''
  document.getElementById('account-details-error').classList.add('hidden')
  accountDetailsParentId = null
  document.getElementById('account-details-parent-search').value = ''
  document.getElementById('account-details-parent-selected').classList.add('hidden')
  document.getElementById('account-details-parent-results').classList.add('hidden')

  // Terminus Lead dropdown, same terminusStaffCache/loadTerminusStaffIfNeeded
  // already used for Test Bed/Opportunity's own Terminus Lead fields
  // (app.js) - a distinct payload key here (Account-level), same source
  // list and same "leading blank option" fix already proven necessary
  // there (an unset field must not silently pre-select the alphabetically
  // first name).
  await loadTerminusStaffIfNeeded()
  const leadSelect = document.getElementById('account-details-terminus-lead')
  leadSelect.innerHTML = '<option value="">--</option>' +
    terminusStaffCache.map(s => `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`).join('')

  // Pre-fill both Billing and Shipping from this Contact's own address -
  // identical starting values, but two independent sets of inputs from
  // here on, confirmed by real test (editing one never touches the
  // other, see the round's own test evidence).
  for (const scope of ['billing', 'shipping']) {
    setVal(`account-details-${scope}-address`, cdPayload.address ?? '')
    setVal(`account-details-${scope}-address2`, cdPayload.address2 ?? '')
    setVal(`account-details-${scope}-city`, cdPayload.city ?? '')
    setVal(`account-details-${scope}-postcode`, cdPayload.postcode ?? '')
    setVal(`account-details-${scope}-country`, cdPayload.country ?? '')
    document.getElementById(`account-details-${scope}-region`).value = cdPayload.region ?? ''
  }

  const modal = document.getElementById('account-details-modal')
  modal.classList.remove('hidden')
  document.getElementById('account-details-name').focus()

  // Full focus trap, matching Park (INTERACTION_STANDARDS.md Section 4) -
  // collected generically via querySelectorAll rather than a hardcoded
  // list, since this panel has far more fields than Park or Est. Close
  // Date's own dialogues ever did.
  accountDetailsKeydownHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeAccountDetailsModal()
      return
    }
    if (e.key !== 'Tab') return
    // !el.disabled (Round 5 Phase 3): view mode disables every field, and
    // a disabled element can't actually receive .focus() at all - without
    // this filter, the wraparound could silently target a disabled input
    // and leave focus stuck wherever it already was.
    const focusable = [...modal.querySelectorAll('input, select, button')].filter(el => el.offsetParent !== null && !el.disabled)
    if (!focusable.length) return
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
  document.addEventListener('keydown', accountDetailsKeydownHandler)
}

function setVal(id, v) {
  const el = document.getElementById(id)
  if (el) el.value = v ?? ''
}

window.closeAccountDetailsModal = function () {
  document.getElementById('account-details-modal').classList.add('hidden')
  if (accountDetailsKeydownHandler) {
    document.removeEventListener('keydown', accountDetailsKeydownHandler)
    accountDetailsKeydownHandler = null
  }
  // Round 5 Phase 3: return focus to whichever real, still-visible
  // control actually opened this - Show Account Details when viewing,
  // falling back to the Account card's own primary button otherwise
  // (the create-flow's own trigger, cd-create-account-name, lives inside
  // the search results panel and isn't reliably still there to focus
  // back to once this closes).
  const opener = accountDetailsOpenerId && document.getElementById(accountDetailsOpenerId)
  if (opener && opener.offsetParent !== null) {
    opener.focus()
  } else {
    document.getElementById('cd-btn-link-account')?.focus()
  }
  accountDetailsOpenerId = null
}

// Round 5 Phase 3 (2026-08-17): "Show Account Details" - opens the same
// panel Round 4 built for creation, this time populated with the real,
// currently-saved values of whichever Account this Contact is actually
// linked to (GET /accounts/:id, not the Contact's own cached
// accountsCache entry, which only carries the name - every other field
// needs a real, current fetch), and switched into view-only mode via
// setAccountDetailsMode. Distinct from Change Account, which reopens the
// search-and-link panel to pick a different Account entirely.
window.showAccountDetailsView = async function () {
  const accountId = cdContact.parent_record_id
  if (!accountId) return
  const result = await api('GET', `/api/accounts/${accountId}`)
  if (!result.ok) {
    console.error('Failed to load Account details for view:', result.data?.error)
    return
  }
  await openAccountDetailsViewModal(result.data)
}

async function openAccountDetailsViewModal(account) {
  const p = account.payload ?? {}
  setAccountDetailsMode('view')
  accountDetailsOpenerId = 'cd-btn-show-account-details'
  document.getElementById('account-details-heading').textContent = p.name || 'Account'
  document.getElementById('account-details-name').value = p.name ?? ''
  document.getElementById('account-details-number').textContent = account.reference_code || 'Not yet generated'
  document.getElementById('account-details-created').textContent = account.created_at ? formatDate(account.created_at) : '--'
  document.getElementById('account-details-website').value = p.websiteUrl ?? ''
  document.getElementById('account-details-error').classList.add('hidden')

  // Parent Account, resolved server-side already (GET /accounts/:id
  // returns { parent: { id, name } | null }) - view mode never searches,
  // it just shows the real, current fact, distinguishing "genuinely no
  // Parent Account" from "not shown" rather than leaving it blank.
  accountDetailsParentId = account.parent?.id ?? null
  document.getElementById('account-details-parent-search').value = ''
  document.getElementById('account-details-parent-results').classList.add('hidden')
  const selected = document.getElementById('account-details-parent-selected')
  selected.textContent = account.parent?.name ? `Parent Account: ${account.parent.name}` : 'Parent Account: none'
  selected.classList.remove('hidden')

  await loadTerminusStaffIfNeeded()
  const leadSelect = document.getElementById('account-details-terminus-lead')
  leadSelect.innerHTML = '<option value="">--</option>' +
    terminusStaffCache.map(s => `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`).join('')
  leadSelect.value = p.terminusLead ?? ''

  for (const scope of ['billing', 'shipping']) {
    setVal(`account-details-${scope}-address`, p[`${scope}Address`])
    setVal(`account-details-${scope}-address2`, p[`${scope}Address2`])
    setVal(`account-details-${scope}-city`, p[`${scope}City`])
    setVal(`account-details-${scope}-postcode`, p[`${scope}Postcode`])
    setVal(`account-details-${scope}-country`, p[`${scope}Country`])
    document.getElementById(`account-details-${scope}-region`).value = p[`${scope}Region`] ?? ''
  }

  const modal = document.getElementById('account-details-modal')
  modal.classList.remove('hidden')
  document.getElementById('account-details-cancel').focus()

  accountDetailsKeydownHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeAccountDetailsModal()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = [...modal.querySelectorAll('input, select, button')].filter(el => el.offsetParent !== null && !el.disabled)
    if (!focusable.length) return
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
  document.addEventListener('keydown', accountDetailsKeydownHandler)
}

// Same case-insensitive substring search over accountsCache as the
// existing Link-to-Account search (renderCdLinkResults) - no new search
// endpoint, no self-exclusion needed since this is always a brand new
// Account with no id yet, so it can't appear in its own results anyway.
window.renderAccountDetailsParentResults = function (query) {
  const q = query.trim().toLowerCase()
  const results = document.getElementById('account-details-parent-results')
  if (!q) {
    results.classList.add('hidden')
    results.innerHTML = ''
    return
  }
  // data-* attributes + this.dataset in the click handler, not the
  // account name embedded directly inside the onclick string - escHtml
  // only escapes HTML entities, not single quotes, and a real Account
  // name containing an apostrophe (the brief's own "O'Brien's Ltd"
  // example) would break out of a single-quoted inline JS argument,
  // confirmed as a real risk before it ever shipped, not just a
  // theoretical one. escHtml alone is sufficient for a double-quoted
  // HTML attribute value (data-account-name="..."), which is all this
  // needs.
  const matches = accountsCache.filter(a => (a.payload?.name ?? '').toLowerCase().includes(q)).slice(0, 10)
  results.innerHTML = matches.length
    ? matches.map(a => `<div style="padding:8px 10px;cursor:pointer" data-account-id="${a.id}" data-account-name="${escHtml(a.payload?.name ?? '')}" onclick="selectAccountDetailsParent(this.dataset.accountId, this.dataset.accountName)">${escHtml(a.payload?.name ?? '--')}</div>`).join('')
    : '<p class="empty-state" style="padding:8px 10px">No matches.</p>'
  results.classList.remove('hidden')
}

window.selectAccountDetailsParent = function (id, name) {
  accountDetailsParentId = id
  document.getElementById('account-details-parent-search').value = ''
  document.getElementById('account-details-parent-results').classList.add('hidden')
  const selected = document.getElementById('account-details-parent-selected')
  selected.textContent = `Parent Account: ${name}`
  selected.classList.remove('hidden')
}

window.saveAccountDetails = async function (btn) {
  const name = document.getElementById('account-details-name').value.trim()
  const errEl = document.getElementById('account-details-error')
  errEl.classList.add('hidden')

  if (!name) {
    errEl.textContent = 'Account Name is required.'
    errEl.classList.remove('hidden')
    return
  }

  const readScope = (scope) => ({
    address: document.getElementById(`account-details-${scope}-address`).value.trim() || null,
    address2: document.getElementById(`account-details-${scope}-address2`).value.trim() || null,
    city: document.getElementById(`account-details-${scope}-city`).value.trim() || null,
    postcode: document.getElementById(`account-details-${scope}-postcode`).value.trim() || null,
    country: document.getElementById(`account-details-${scope}-country`).value.trim() || null,
    region: document.getElementById(`account-details-${scope}-region`).value || null,
  })

  const accountDetails = {
    terminusLead: document.getElementById('account-details-terminus-lead').value || null,
    websiteUrl: document.getElementById('account-details-website').value.trim() || null,
    parentAccountId: accountDetailsParentId,
    billing: readScope('billing'),
    shipping: readScope('shipping'),
  }

  await linkCdAccount(btn, null, name, accountDetails)
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
  // A genuinely different contact than whatever was last shown here -
  // any blocking state belongs to that other record, not this one.
  if (cdContactId !== contact.id) cdCurrentBlocking = []

  cdContactId = contact.id
  cdContact = contact
  cdPayload = contact.payload ?? {}
  cdReturnView = contact.status === 'Qualified' ? 'contacts' : 'leads'
  cdEdits = {}

  // Once linked, the real Account's name is authoritative and takes over
  // display everywhere - the free-text company is the fallback until
  // then, never the other way round (confirmed, not assumed).
  const account = accountsCache.find(a => a.id === contact.parent_record_id)
  document.getElementById('cd-eyebrow').textContent = contact.status === 'Qualified' ? 'Contact' : 'Lead'
  document.getElementById('cd-display-name').textContent = cdPayload.name || '--'
  // Unlike the panel's other fields (cd-contact-rows' innerHTML is
  // fully regenerated every render, so a fresh cdFieldRow() always
  // bakes in the current value and starts display-visible/edit-hidden
  // with no leftover classes), the header's Name markup is static -
  // it survives across renders, so its input value and editing-UI
  // state must be reset explicitly here, or a stale draft/open editor/
  // field-editing highlight from a previous edit session would persist.
  document.getElementById('cd-input-name').value = cdPayload.name ?? ''
  document.getElementById('cd-edit-name').classList.add('hidden')
  document.getElementById('cd-edit-name').classList.remove('dirty')
  document.getElementById('cd-display-name').classList.remove('hidden')
  document.querySelector('[data-key="name"]').classList.remove('field-editing')
  document.getElementById('cd-company').textContent = account?.payload?.name ?? cdPayload.company ?? '--'
  // Redundant once Qualified - the eyebrow already reads "Contact" and
  // the whole screen's context implies it. Still shown for
  // Unqualified/Parked, where it's real information, not implied.
  document.getElementById('cd-status').textContent = contact.status === 'Qualified' ? '' : contact.status
  document.getElementById('cd-status').classList.toggle('hidden', contact.status === 'Qualified')

  renderCdAccountCard()

  document.getElementById('cd-contact-rows').innerHTML =
    CD_CONTACT_FIELDS.map(f => cdFieldRow(f.key, f.label, cdPayload[f.key], f)).join('') +
    CD_COLUMN_FIELDS.map(f => cdColumnFieldRow(f, cdCurrentValue(f.key))).join('') +
    cdFieldRow(CD_SOURCE_FIELD.key, CD_SOURCE_FIELD.label, cdPayload[CD_SOURCE_FIELD.key], CD_SOURCE_FIELD)
  document.getElementById('cd-address-rows').innerHTML =
    CD_ADDRESS_FIELDS.map(f => cdFieldRow(f.key, f.label, cdPayload[f.key], f)).join('')

  document.getElementById('cd-display-summary').textContent = cdPayload.summary || 'No summary captured yet.'
  document.getElementById('cd-input-summary').value = cdPayload.summary ?? ''
  document.getElementById('cd-edit-summary').classList.add('hidden')
  document.getElementById('cd-display-summary').classList.remove('hidden')

  renderCdNotes(cdPayload.notes ?? [])
  resetCdNoteInput()
  updateCdEditBar()
  wireCdFieldInputs()

  renderCdActions()
  renderCdCreateDelete()

  document.getElementById('cd-park-form').classList.add('hidden')
  document.getElementById('cd-action-feedback').textContent = ''

  // Fields are freshly rendered above on every call, so highlighting is
  // (re-)applied after, from whatever blocking list is already known,
  // filtered against the fresh cdPayload/cdContact just set above so a
  // field that's now filled in stops being highlighted without needing
  // another real Qualify click.
  refreshCdBlockedFields()
  renderCdBlockedFields(cdCurrentBlocking)

  syncCdBelowGridWidth()
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
  document.querySelector(`[data-key="${key}"]`)?.classList.remove('field-editing')
  document.getElementById(`cd-display-${key}`).classList.remove('hidden')
  const input = document.getElementById(`cd-input-${key}`)
  if (input) input.value = cdCurrentValue(key)
  updateCdEditBar()
}

function onCdFieldInput(key) {
  const edit = cdEdits[key]
  if (!edit) return
  edit.draft = document.getElementById(`cd-input-${key}`).value
  const isDirty = edit.draft !== edit.orig
  document.getElementById(`cd-edit-${key}`).classList.toggle('dirty', isDirty)
  // Amber = edited, not yet saved - distinct from .field-blocked (red,
  // invalid/missing). Toggled on the same .ref-field wrapper.
  document.querySelector(`[data-key="${key}"]`)?.classList.toggle('field-editing', isDirty)
  updateCdEditBar()
}

// Cancel/Save live on the Qualify/Park/Unqualify row now (2026-08-14),
// not a separate "N fields open, M changed" banner - that messaging is
// redundant once each changed field carries its own highlight (see
// .field-editing in style.css). Cancel shows the moment a field opens;
// Save only once something has actually changed.
//
// Qualify is disabled for the same dirtyCount, not just visually
// (2026-08-14): the transition endpoint evaluates the record's saved
// payload, with no visibility into cdEdits' local drafts, so an active
// Qualify while a field is dirty would invite acting on data that isn't
// what's on screen. Re-enabled the moment Save (or Cancel/discard)
// clears dirtyCount back to 0 - Save is deliberately the only green,
// active button while dirty.
function updateCdEditBar() {
  const keys = Object.keys(cdEdits)
  const dirtyCount = keys.filter(k => cdEdits[k].draft !== cdEdits[k].orig).length
  document.getElementById('cd-cancel-all').classList.toggle('hidden', keys.length === 0)
  document.getElementById('cd-save-all').classList.toggle('hidden', dirtyCount === 0)
  document.getElementById('cd-btn-qualify').disabled = dirtyCount > 0
}

// Same dirtyCount definition as updateCdEditBar above - a field merely
// open-for-edit but untouched (draft === orig) isn't actually at risk,
// only a real, unsaved change is. Found live (2026-08-15): linkCdAccount
// and attemptContactUnqualifyFromDetail both end in an unconditional
// loadContactDetail(), which resets cdEdits = {} on every fresh render -
// any field genuinely dirty at that moment is silently discarded, no
// warning. Reproduced for real (LinkedIn typed but not saved, then Link
// to Account clicked) and confirmed via direct database query: the
// field was never persisted anywhere, backend behaved correctly given
// what it received, this was purely a client-side gap.
function cdHasDirtyEdits() {
  return Object.keys(cdEdits).some(k => cdEdits[k].draft !== cdEdits[k].orig)
}

// Genuinely comprehensive (2026-08-14): if the Add Note input is open
// and dirty when this fires, its text rides along in this same write,
// not a second PATCH. The server does a shallow merge of payload onto
// the latest revision (src/routes/contacts.js) - whatever notes array
// the client sends wins outright, it doesn't append server-side. Two
// sequential calls would be a real bug, not just inelegant: the second
// call's existingNotes snapshot would predate the first call's write,
// so sending it would silently overwrite payload.notes back to a
// version missing whatever the first call just added. One combined
// write, built from the one cdPayload.notes snapshot this whole
// function already has, is the only safe way to do this.
async function saveCdFields() {
  const feedback = document.getElementById('cd-save-feedback')
  feedback.textContent = ''
  feedback.className = ''

  const dirtyEntries = Object.entries(cdEdits).filter(([, e]) => e.draft !== e.orig)
  const noteInput = document.getElementById('cd-new-note-input')
  const manualNoteText = cdNoteOpen ? noteInput.value.trim() : ''
  if (!dirtyEntries.length && !manualNoteText) return

  const body = {}
  const payloadUpdate = {}
  const newNotes = []

  if (manualNoteText) {
    newNotes.push({
      text: manualNoteText,
      at: new Date().toISOString(),
      by: currentSession?.user?.email ?? '',
    })
  }

  if (dirtyEntries.length) {
    // One note per save session, not one per changed field (2026-08-13,
    // confirmed) - every dirty field's own change sentence joined into a
    // single Notes History entry, same wording as before, just combined.
    const sentences = dirtyEntries.map(([key, e]) => {
      if (key === 'industry') {
        body.industry_id = e.draft || null
        return cdChangeSentence(key, cdIndustryName(e.orig), cdIndustryName(e.draft))
      }
      payloadUpdate[key] = e.draft
      return cdChangeSentence(key, e.orig, e.draft)
    })
    newNotes.push({
      text: sentences.join(' '),
      at: new Date().toISOString(),
      by: currentSession?.user?.email ?? '',
    })
  }

  payloadUpdate.notes = [...newNotes, ...(cdPayload.notes ?? [])]
  body.payload = payloadUpdate

  const result = await api('PATCH', `/api/contacts/${cdContactId}`, body)
  if (!result.ok) {
    feedback.textContent = result.data?.error ?? 'Failed to save.'
    feedback.className = 'msg-error'
    return
  }
  cdEdits = {}
  resetCdNoteInput()
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
      <span class="ref-notes-when">${formatDateTime(n.at)}</span><span class="ref-notes-author">${escHtml(n.by ?? '--')}</span><span class="ref-notes-text">${escHtml(n.text)}</span>
    </div>`).join('')
}

// Manual entry into the same real Notes History as field-edit/Park notes -
// available at every stage (Unqualified/Parked/Qualified alike), unlike
// the field-edit notes which only fire on Save. The actual write is the
// shared addContactNote() core (app.js, 2026-08-14) - also used by the
// Leads list card's own separate, unchanged always-visible mechanism -
// this page's own presentation is click-to-edit-in-place instead
// (2026-08-14, redesigned), matching every other field: cd-new-note-input
// starts hidden, cdNoteOpen tracks whether it's currently open. One
// button does double duty rather than two elements - onCdAddNoteClick
// opens it when idle, submits when it's dirty (disabled buttons never
// fire clicks, so the empty-open state can't reach the submit branch).
let cdNoteOpen = false

window.onCdAddNoteClick = async function () {
  const input = document.getElementById('cd-new-note-input')
  if (!cdNoteOpen) {
    cdNoteOpen = true
    const wrap = document.getElementById('cd-note-input-wrap')
    wrap.classList.remove('hidden')
    // Button relocates into the input's own row when active (2026-08-16,
    // Round 2 Phase 2 - superseding the earlier same-row "moves right"
    // fix, confirmed against a precise report that the two-row structure,
    // button staying in the header row throughout, was the actual
    // complaint). Physically moved via insertBefore, not a second
    // element - one #cd-add-note-btn, one onclick wiring, no ID
    // duplication. Idle state (resetCdNoteInput) moves it back.
    wrap.insertBefore(document.getElementById('cd-add-note-btn'), document.getElementById('cd-note-discard'))
    input.focus()
    const btn = document.getElementById('cd-add-note-btn')
    btn.disabled = true
    return
  }

  const text = input.value.trim()
  if (!text) return

  // Same fix and same shared modal as linkCdAccount/
  // attemptContactUnqualifyFromDetail (2026-08-15) - this is a separate
  // input from cdEdits, but its own submit still ends in an unconditional
  // loadContactDetail(), which would silently discard any OTHER field
  // left open and dirty elsewhere on the page.
  if (cdHasDirtyEdits()) {
    openDiscardConfirm(() => performCdAddNote(text))
    return
  }
  await performCdAddNote(text)
}

async function performCdAddNote(text) {
  const result = await addContactNote(cdContactId, text, cdPayload.notes)
  if (!result.ok) return

  resetCdNoteInput()
  await loadContactDetail(cdContactId)
}

window.discardCdNote = function () {
  resetCdNoteInput()
}

// Reused both to close an open input (discard, or after a successful
// save) and to reset the static markup on every fresh render - this
// input lives outside cd-notes-list's regenerated innerHTML, so like
// the header's Name field it survives across renders and must have its
// open/dirty state cleared explicitly, or a stale open input would
// persist onto whatever contact loads next.
function resetCdNoteInput() {
  cdNoteOpen = false
  const input = document.getElementById('cd-new-note-input')
  input.value = ''
  const wrap = document.getElementById('cd-note-input-wrap')
  wrap.classList.add('hidden')
  wrap.classList.remove('dirty')
  // Moves the button back to the header row (idle position) - runs on
  // every fresh render too (see call sites above), so a page load always
  // self-corrects the button's position regardless of whatever state a
  // prior interaction left it in, not just on an explicit discard/save.
  document.getElementById('cd-notes-header-row').appendChild(document.getElementById('cd-add-note-btn'))
  const btn = document.getElementById('cd-add-note-btn')
  btn.disabled = false
  btn.classList.remove('btn-primary')
}

// Label stays "Add Note" in every state (2026-08-14, corrected - it
// previously relabeled to "Save", confusable with the page-level Save
// button next to it, especially now that a real click there can also
// commit this same note). Only the color changes, same green =
// ready-to-commit convention as everywhere else - clicking it still
// commits just this note immediately, unchanged. The .dirty toggle on
// cd-note-input-wrap reuses .ref-field-edit.dirty's existing green
// underline (style.css) - the same visual Summary's own input already
// gets, not a new rule.
document.getElementById('cd-new-note-input').addEventListener('input', () => {
  const text = document.getElementById('cd-new-note-input').value.trim()
  const btn = document.getElementById('cd-add-note-btn')
  btn.disabled = !text
  btn.classList.toggle('btn-primary', !!text)
  document.getElementById('cd-note-input-wrap').classList.toggle('dirty', !!text)
})

// ── Qualify / Park / Unqualified: direct actions, replacing the old
// 3-chip Manage picker. ─────────────────────────────────────────────────
function renderCdActions() {
  document.getElementById('cd-btn-qualify').classList.toggle('hidden', cdContact.status === 'Qualified')
  document.getElementById('cd-btn-park').classList.toggle('hidden', cdContact.status === 'Parked')
  document.getElementById('cd-btn-unqualify').classList.toggle('hidden', cdContact.status === 'Unqualified')
}

// Same field lookup transitions.js's RECORD_COLUMN_FIELDS makes -
// parent_record_id/industry_id read off the record row, everything else
// off the payload.
function cdBlockingFieldValue(field) {
  if (field === 'parent_record_id') return cdContact.parent_record_id
  if (field === 'industry_id') return cdContact.industry_id
  return cdPayload[field]
}

// Drops any entry from cdCurrentBlocking whose field is now genuinely
// filled in, using the exact same "undefined | null | ''" rule
// transitions.js's payload_field_required check uses - client-side,
// against the freshly-reloaded cdPayload/cdContact, not by re-attempting
// the real transition. Re-attempting would silently qualify the contact
// the instant every field happens to be filled in, as a side effect of
// saving a field rather than an explicit Qualify click - not something
// asked for, and not something to introduce as a side effect of "clear
// the box when it's fixed."
function refreshCdBlockedFields() {
  if (!cdCurrentBlocking.length) return
  cdCurrentBlocking = cdCurrentBlocking.filter(b => {
    const value = cdBlockingFieldValue(b.field)
    return value === undefined || value === null || value === ''
  })
}

// Replaces the old single banner+list entirely (2026-08-13, confirmed
// full replacement, Contact-detail-scoped only - Opportunity/Test Bed's
// own transition-blocking banner is untouched): a subtle tint directly on
// each real blocked field ([data-key], matched against the real
// blocking[].field from the transition endpoint - not scoped to
// .ref-field specifically, so it also covers the header's Name field,
// which isn't a .ref-field row), clearing the moment it's resolved.
// parent_record_id isn't a field row at all - it's the separate
// Account card, tinted the same way.
function renderCdBlockedFields(blocking) {
  document.getElementById('cd-account-card').classList.remove('field-blocked')
  document.querySelectorAll('[data-key].field-blocked').forEach(el => el.classList.remove('field-blocked'))

  for (const b of blocking) {
    if (b.field === 'parent_record_id') {
      document.getElementById('cd-account-card').classList.add('field-blocked')
      continue
    }
    document.querySelector(`[data-key="${b.field}"]`)?.classList.add('field-blocked')
  }
}

window.attemptContactQualifyFromDetail = async function () {
  const feedback = document.getElementById('cd-action-feedback')
  feedback.textContent = ''
  const result = await api('POST', `/api/records/${cdContactId}/transition`, { to_stage: 'Qualified' })
  if (!result.ok) {
    if (result.status === 422 && result.data.blocking?.length) {
      cdCurrentBlocking = result.data.blocking
      renderCdBlockedFields(cdCurrentBlocking)
      // Round 3 Phase 1 (2026-08-17): Account is no longer just a red
      // tint the user has to notice and separately go resolve - if it's
      // one of the blocking fields, the same reconciliation panel
      // Account's own "Link to Account" button already opens is
      // triggered automatically here too, pre-filled from Company the
      // same way. Purely additive: every other blocked field keeps its
      // existing .field-blocked highlight untouched, this only adds an
      // automatic open on top of the existing manual one.
      //
      // Round 4 Phase 4 (2026-08-17): extends the above - when the
      // Company text doesn't match any real Account (findAccountMatches,
      // the exact same substring definition the manual search panel
      // already uses, not a second one invented here), go straight to
      // the full Account Details panel (Phase 3) instead of the bare
      // search-and-link panel, since there's nothing real to reconcile
      // against and the search step would just be an empty list plus a
      // "Create new Account" row the user has to click anyway. When it
      // does match, behaviour is unchanged from Round 3 Phase 1 - the
      // lightweight link panel, since something already fully specified
      // doesn't need the full creation form.
      if (cdCurrentBlocking.some(b => b.field === 'parent_record_id')) {
        const company = (cdPayload.company ?? '').trim()
        const hasMatch = company && findAccountMatches(company).length > 0
        if (hasMatch) {
          window.openCdLinkAccountPanel()
        } else {
          window.openAccountDetailsModal(company)
        }
      }
    } else {
      feedback.textContent = result.data?.error ?? 'Failed to qualify.'
      feedback.className = 'msg-error'
    }
    return
  }
  cdCurrentBlocking = []
  await loadContactsData()
  navigate('contacts')
}

window.attemptContactUnqualifyFromDetail = async function () {
  // Same fix and same shared modal as linkCdAccount above (2026-08-15).
  if (cdHasDirtyEdits()) {
    openDiscardConfirm(performContactUnqualify)
    return
  }
  await performContactUnqualify()
}

async function performContactUnqualify() {
  await api('POST', `/api/records/${cdContactId}/transition`, { to_stage: 'Unqualified' })
  await loadContactsData()
  await loadContactDetail(cdContactId)
}

// Park as a popup overlay: focus-trapped per INTERACTION_STANDARDS.md
// Section 4 (Park is that document's own worked example). Focus moves
// to the first field on open; Tab/Shift+Tab cycle within the popup's
// own four focusable elements only; Escape closes it the same as
// Cancel. cdParkKeydownHandler is tracked so it can be removed on
// close - the popup's DOM node persists across page reloads (wired
// once via cdWired), so a handler left attached would stack a new one
// on every open otherwise.
let cdParkKeydownHandler = null

// Neither backdrop-click nor Cancel/Escape may silently discard unsaved
// data (2026-08-13, retrofitted from New Lead's identical
// implementation, not a second pattern): a delegated input/change
// listener on the panel tracks whether the date or reason field has
// changed since opening. The two guards are deliberately different:
// backdrop-click is an accidental dismissal, refused outright
// (highlight + warning, stays open). Cancel/Escape are intentional
// leave actions, so they get a real choice instead, via the shared
// discard-confirmation dialog (app.js, loaded before this file, same
// global scope) - Discard (closes for real) or Keep editing (returns
// here, nothing lost).
let cdParkDirty = false
document.querySelector('#cd-park-form .modal-panel').addEventListener('input', () => { cdParkDirty = true })
document.querySelector('#cd-park-form .modal-panel').addEventListener('change', () => { cdParkDirty = true })

function clearCdParkUnsavedWarning() {
  document.getElementById('cd-park-save').classList.remove('btn-attention')
  document.getElementById('cd-park-unsaved-warning').classList.add('hidden')
}

function openCdParkForm() {
  cdParkDirty = false
  document.getElementById('cd-park-form').classList.remove('hidden')
  document.getElementById('cd-park-date').value = cdPayload.followUpDate ?? ''
  document.getElementById('cd-park-reason').value = ''
  document.getElementById('cd-park-error').classList.add('hidden')
  clearCdParkUnsavedWarning()
  document.getElementById('cd-park-date').focus()

  cdParkKeydownHandler = (e) => {
    // Inert while the discard-confirmation dialog is stacked on top -
    // its own keydown handler owns Tab/Escape until it closes, or a
    // single Escape press could fire both handlers in the same tick.
    if (discardConfirmIsOpen()) return
    if (e.key === 'Escape') {
      e.preventDefault()
      requestCloseCdParkForm()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = [
      document.getElementById('cd-park-date'),
      document.getElementById('cd-park-reason'),
      document.getElementById('cd-park-cancel'),
      document.getElementById('cd-park-save'),
    ]
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
  document.addEventListener('keydown', cdParkKeydownHandler)
}

// Cancel/Escape both route through here: a real choice when dirty (the
// shared discard-confirmation dialog), immediate close when clean,
// unchanged from before.
function requestCloseCdParkForm() {
  if (cdParkDirty) {
    openDiscardConfirm(closeCdParkForm)
    return
  }
  closeCdParkForm()
}

function closeCdParkForm() {
  document.getElementById('cd-park-form').classList.add('hidden')
  if (cdParkKeydownHandler) {
    document.removeEventListener('keydown', cdParkKeydownHandler)
    cdParkKeydownHandler = null
  }
  cdParkDirty = false
  clearCdParkUnsavedWarning()
  document.getElementById('cd-btn-park')?.focus()
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
  // Clicking Save & park is acting on the unsaved-changes warning,
  // whether the save itself goes on to succeed or fail - if it fails,
  // the red validation error above is the relevant message now.
  clearCdParkUnsavedWarning()

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

  // Same fix and same shared modal as the other 3 sites (2026-08-15).
  // Checked only after Park's own validation passes - showing the
  // unrelated-field warning before the user even has a valid date/reason
  // would be confusing ordering; cd-btn-park has no dirty-disable guard
  // the way Qualify does, so this is the only point that actually blocks
  // the loadContactDetail() at the end from silently discarding some
  // other field left open elsewhere on the page.
  //
  // Real bug found testing this (2026-08-15): the Park form is a
  // position:fixed full-screen popup. Leaving it open while showing the
  // discard-confirm modal on top of it (confirmed via elementFromPoint:
  // the popup intercepts the click) meant choosing "Keep editing" left
  // the user stuck - unable to reach the main Save button to actually
  // save the field they'd supposedly gone back to save, since the popup
  // still covered it. Closing the Park form first, before the confirm
  // modal opens, is what actually makes "Keep editing" reachable in
  // both branches - Discard already closes it anyway as part of a
  // successful park (performSaveCdParkForm's own closeCdParkForm() call
  // at the end), so this doesn't change that path, only makes Keep
  // editing symmetrical with it. The date/reason just typed is lost
  // either way, same as Park's own existing Cancel-while-dirty behaviour
  // (its own discard-confirm usage), not new data loss - nothing here
  // was ever submitted.
  if (cdHasDirtyEdits()) {
    closeCdParkForm()
    openDiscardConfirm(() => performSaveCdParkForm(date, reason))
    return
  }
  await performSaveCdParkForm(date, reason)
}

async function performSaveCdParkForm(date, reason) {
  const errEl = document.getElementById('cd-park-error')

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

  closeCdParkForm()
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
  document.getElementById('cd-park-cancel').addEventListener('click', requestCloseCdParkForm)
  document.getElementById('cd-park-save').addEventListener('click', saveCdParkForm)
  document.getElementById('cd-park-form').addEventListener('click', (e) => {
    if (e.target.id !== 'cd-park-form') return
    if (cdParkDirty) {
      document.getElementById('cd-park-save').classList.add('btn-attention')
      document.getElementById('cd-park-unsaved-warning').classList.remove('hidden')
      // Same as New Lead's identical guard - guarantees Save & park and
      // the warning are actually visible, not just "shown" off-screen.
      document.querySelector('#cd-park-form .form-actions').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    closeCdParkForm()
  })
  document.getElementById('cd-btn-link-account').addEventListener('click', window.openCdLinkAccountPanel)
  document.getElementById('cd-btn-show-account-details').addEventListener('click', window.showAccountDetailsView)
  document.getElementById('cd-link-cancel').addEventListener('click', () => document.getElementById('cd-link-account-panel').classList.add('hidden'))
  document.getElementById('cd-link-search').addEventListener('input', (e) => renderCdLinkResults(e.target.value))

  // Account Details panel (Round 4 Phase 3) - Escape is handled by
  // accountDetailsKeydownHandler (attached/detached per open cycle in
  // openAccountDetailsModal, same as Park), backdrop-click is wired once
  // here, same pattern as every other modal-backdrop in this app.
  document.getElementById('account-details-close').addEventListener('click', window.closeAccountDetailsModal)
  document.getElementById('account-details-cancel').addEventListener('click', window.closeAccountDetailsModal)
  document.getElementById('account-details-save').addEventListener('click', (e) => window.saveAccountDetails(e.target))
  document.getElementById('account-details-modal').addEventListener('click', (e) => {
    if (e.target.id === 'account-details-modal') window.closeAccountDetailsModal()
  })
  document.getElementById('account-details-parent-search').addEventListener('input', (e) => window.renderAccountDetailsParentResults(e.target.value))

  // Keeps cd-below-grid's width matching the card row above it across a
  // live resize, not just at initial render (2026-08-16) - #view-contact-
  // detail has max-width:none, so without this the relocated Summary/
  // Notes block would only be correct at whatever width it happened to
  // render at, then drift out of alignment the moment the window is
  // resized. No debounce: syncCdBelowGridWidth is two getBoundingClientRect
  // reads and a style write, cheap enough to run on every resize event
  // without one.
  window.addEventListener('resize', syncCdBelowGridWidth)
}

// Sets cd-below-grid's width to exactly match cd-account-card's own right
// edge (2026-08-16) - that card is always last in the row above, so its
// right edge is the row's, whether the row reaches the container's outer
// edge at the current viewport or not. Deliberately measured in JS, not
// expressed in CSS: .ref-cards uses repeat(auto-fit, minmax(280px,420px))
// with a variable, wrapping-dependent number of real cards per row - there
// is no portable CSS expression for "match this auto-fit grid's actual
// rendered content width," and the wrong-but-plausible alternatives (100%
// width, matching .ref-cards' own bounding box) were rejected:
// #view-contact-detail's own max-width:none means a plain 100% block
// would run the full browser width at 1920/3440px, and .ref-cards' own
// box is full-width regardless of
// justify-content:start (only its child tracks are left-anchored, not the
// grid container itself), so neither gives the actual card-row boundary.
function syncCdBelowGridWidth() {
  const card = document.getElementById('cd-account-card')
  const block = document.getElementById('cd-below-grid')
  if (!card || !block) return
  const cardRect = card.getBoundingClientRect()
  const blockRect = block.getBoundingClientRect()
  const width = cardRect.right - blockRect.left
  if (width > 0) block.style.width = `${width}px`
}

wireCdOnce()
