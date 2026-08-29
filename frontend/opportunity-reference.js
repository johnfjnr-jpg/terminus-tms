// Opportunity detail: Reference tab. Click-to-edit fields (Terminus
// Details / Customer Details / Key Dates), Executive Summary, Notes.
// Classic script (not a module) — reuses api()/escHtml()/formatDate()/
// currentSession from app.js, which is loaded immediately before this
// file, and is the exact reason this file must not redeclare any of
// those names at top level.
//
// Person/account fields were originally all plain text - no Contacts
// feature existed anywhere in this app to back a dropdown against when
// this was first built (project_reference_fields_free_text in memory).
// Two exceptions now exist. Terminus Lead/Commercial/Technical/Legal
// Authority (2026-08-16): a dropdown sourced from terminus_staff (app.js's
// terminusStaffCache, same table/pattern as industries), not a Contact
// dropdown - these are internal Terminus people, not client-side
// contacts. Client-side buyers were four fixed slots from Round 3 Phase 3
// until Round 35 Phase 5 retired them for Key Customer Contacts, a list of
// people each carrying a role and a stance: see renderKeyContacts below.
// Customer Lead and Commercial Address for Proposal are the only remaining
// plain-text person/address fields.

let refOpportunityId = null
let refPayload = {}
// The revision this tab loaded, sent as the precondition on every save.
let refOppDetails = {}
let refStatus = ''
let refWired = false
// Buyer Roles (Round 3 Phase 3): Contacts already linked to this
// Opportunity's own Account, same tbAccountContacts cache/reset pattern
// as Test Bed's own buyer mechanism (test-bed-detail.js) - fetched once
// per opportunity load (reset in initOpportunityReferencePanel below),
// reused across re-renders within that same view.

// refEdits[key] = { draft, orig } — only present entries are "open".
// Every field row renders once (in renderReferenceTab); opening, typing,
// and discarding only ever toggle classes and touch that one field's own
// elements, never regenerate a card's innerHTML mid-edit. That's what lets
// any number of fields stay open at once, anywhere across the three cards,
// without one edit disturbing another (same discipline as the Commercials
// pricing cards in opportunity-deal.js).
let refEdits = {}

// Round 34 Phase 4: the labels converge on Test Bed's, and the KEYS DO NOT
// MOVE. Test Bed shortened these in Round 10 Phase 3.1 "per the business's own
// table", recording that the change was DISPLAY ONLY, and the same holds here:
// `lead`, `commercial`, `technical` and `legal` are the stored payload keys and
// none of them changes, so no endpoint, column or saved record is touched.
//
// That is what makes a vocabulary divergence cheap, and it is worth checking
// rather than assuming: a rename that reached a key would be a migration.
//
// REGION AND COUNTRY ARE NEW HERE. They are ordinary payload keys on Test Bed
// and were not writable on an Opportunity at all until this phase added them to
// the allowlist. Region takes the same fixed option list Test Bed uses, so the
// two record types cannot drift into different vocabularies for one field.
// COPIED VERBATIM, not written from the same idea. There are already four
// identical copies of this list: test-bed-detail.js:23, account-detail.js:23,
// contact-detail.js:61 inline, and app.js:4711 as TB_MATRIX_REGIONS. They have
// stayed consistent only because nobody had written a fifth from memory.
//
// This phase wrote one and it diverged on the first attempt, in two ways at
// once: "Asia Pacific" for APAC, and a different order. Nothing would have
// caught it. There is no server-side validation of region on either record
// type, so the wrong value would have saved, and an Opportunity would have
// carried a region string no Test Bed could match.
//
// Left as a fifth copy rather than extracted, because a shared constants module
// is a change to four working screens and belongs in the fork decision Phase 0
// recorded, not in a phase adding two fields. The duplication is now five and
// that is worth knowing.
const REF_REGION_OPTIONS = ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa']
const TERMINUS_FIELDS = [
  { key: 'lead', label: 'Terminus Lead', staffField: true },
  { key: 'commercial', label: 'Comm. Auth', staffField: true },
  { key: 'technical', label: 'Tech. Auth', staffField: true },
  { key: 'legal', label: 'Legal Auth', staffField: true },
  { key: 'region', label: 'Region', options: REF_REGION_OPTIONS },
  { key: 'country', label: 'Country' },
]
// 'account' deliberately absent - it's a real records.account_id link,
// not a free-text payload field, rendered as its own read-only row in
// renderReferenceTab below (2026-08-16: read-only and inherited from
// the source Contact at creation, no manual re-link, matching Test
// Bed's own Account field exactly - this used to be a real Link-to-
// Account picker, Milestone 6, removed entirely when that capability
// was deliberately taken away).
// techBuyer/commBuyer/legalBuyer/itBuyer removed from here (Round 3 Phase
// 3, 2026-08-17) - they became four fixed record_contacts links, and Round
// 35 Phase 5 retired those in turn for Key Customer Contacts, which IS the
// full mandatory-core/admin-catalog/escape-valve model the Round 3 comment
// recorded as not yet built.
// Round 34 Phase 5: Client Lead, and the proposal address as SIX fields.
//
// "Client Lead" matches Test Bed, and like every other rename this round it is
// DISPLAY ONLY: the stored key is still `customerLead`.
//
// SIX FIELDS IS A DELIBERATE EXCEPTION to this round's converge-on-Test-Bed
// principle, and it is recorded as one so a later reader does not repair it.
// Test Bed's Site Address is one line and a city because a test bed is one
// deployment at one place. An Opportunity's proposal address is a company's
// address, so it takes the Account's shape instead. The business overruled
// "consistent with Test Bed" here and the reasoning is theirs.
//
// The suffixes and their order match ACCT_ADDRESS_SUFFIXES in
// account-detail.js exactly, because the whole point is that one can stand in
// for the other. Region reuses the same option list.
//
// commAddress keeps its key and becomes line 1, so the one live record
// carrying a value keeps it.
const CUSTOMER_FIELDS = [
  { key: 'customerLead', label: 'Client Lead' },
]
const PROPOSAL_ADDRESS_FIELDS = [
  { key: 'commAddress', label: 'Address Line 1' },
  { key: 'commAddress2', label: 'Address Line 2' },
  { key: 'commCity', label: 'City' },
  { key: 'commPostcode', label: 'Postcode / Zip' },
  { key: 'commCountry', label: 'Country' },
  { key: 'commRegion', label: 'Region', options: REF_REGION_OPTIONS },
]
const SAME_AS_ACCOUNT_KEY = 'commAddressSameAsAccount'
// The account's six, in the order the six above expect them.
const ACCOUNT_SHIPPING_KEYS = ['shippingAddress', 'shippingAddress2', 'shippingCity',
  'shippingPostcode', 'shippingCountry', 'shippingRegion']
// estClose (Round 3 Phase 3): folded into the generic click-to-edit
// mechanism and the batched Save flow - no longer its own permanently-
// present form behind a separate "Edit" link. Its value isn't a payload
// key though (forecast_close_date is a real opportunity_details column),
// so refFieldOrigValue() below special-cases it; saveRefFields()
// special-cases it again at save time to route through the existing
// close-date-move endpoint (mandatory reason, moves counter) instead of
// the generic PATCH, rather than treating it as an ordinary field.
// noPast on both this and estGoLive (Round 3 Phase 3): a past "estimate"
// is nonsensical, unlike actualClose/actualGoLive, which record things
// that already happened and must allow it.
const DATE_FIELDS = [
  { key: 'estClose', label: 'Est. Close Date', date: true, noPast: true },
  { key: 'actualClose', label: 'Actual Close Date', date: true },
  { key: 'estGoLive', label: 'Est. Go Live', date: true, noPast: true },
  { key: 'actualGoLive', label: 'Actual Go Live', date: true },
  { key: 'duration', label: 'Contract Duration (months)', number: true, integer: true, suffix: 'months' },
]
const OPPTYPE_FIELD = { key: 'oppType', label: 'Opportunity Type', options: ['Terminus Led', 'Tender'] }
const SUMMARY_FIELD = { key: 'summary', label: 'Executive Summary' }
// name (Round 3 Phase 3): the header's Opportunity Name, previously
// static text with no save path at all. Rendered with its own header
// markup (renderReferenceTab below), not via refFieldRow - reuses the
// exact same generic openRefField/discardRefField/onRefFieldInput
// mechanism as every card-row field, just a plain h1 instead of a
// labelled row, same pattern Contact detail's own header Name already
// uses (ref-display-name/ref-edit-name/ref-input-name IDs match
// openRefField's generic `ref-display-${key}` lookup with no changes to
// that function needed).
const NAME_FIELD = { key: 'name', label: 'Opportunity Name' }
const ALL_EDITABLE_FIELDS = [NAME_FIELD, ...TERMINUS_FIELDS, ...CUSTOMER_FIELDS,
  ...PROPOSAL_ADDRESS_FIELDS, ...DATE_FIELDS, OPPTYPE_FIELD, SUMMARY_FIELD]

// Round 34 Phase 4: held here rather than read from `opp` inside the render,
// because renderReferenceTab is the only place that has the record and the
// rows are built from module state everywhere else.
let refOppReference = null

// Round 34 Phase 5: the account, held for the proposal address.
let refAccount = null

// Does the linked account actually have a shipping address to stand in for?
function accountHasShipping() {
  return ACCOUNT_SHIPPING_KEYS.some(k => String(refAccount?.[k] ?? '').trim())
}

// A FLAG, NOT COPIED VALUES, and the business's own phrasing decided it.
//
// "Same as account" is a relationship, not a default. A copy fills the six
// fields once and then diverges silently the day the account moves, and nothing
// on either screen would say the deal is quoting an old address. A flag stays
// true, so the panel renders whatever the account says today.
//
// It costs nothing to read: GET /opportunities/:id already loaded the account's
// latest revision payload for its name, and now returns the shipping fields
// from the same read.
//
// WHEN THE ACCOUNT HAS NO ADDRESS, which is five of six live accounts, the tick
// is still allowed and the rows are replaced by a line saying so with a link to
// the account. The three options were: render six blanks, which is
// indistinguishable from a broken panel and is the shape Round 31 Phase 1 spent
// a phase removing; disable the tick, which stops somebody recording the
// intention before the account is filled in; or say it and point at the place
// to fix it. The business's own instruction settles the last part - the account
// address is edited on the account, not from here.
function renderProposalAddress() {
  const on = !!refEffective(SAME_AS_ACCOUNT_KEY)
  const tick = `
  <div class="ref-field" data-key="${SAME_AS_ACCOUNT_KEY}">
    <div class="ref-field-label"><span>Proposal Address</span></div>
    <label class="ref-same-as-account">
      <input type="checkbox" id="ref-input-${SAME_AS_ACCOUNT_KEY}"${on ? ' checked' : ''}
             onchange="toggleRefSameAsAccount(this.checked)">
      <span>Same as account</span>
    </label>
  </div>`
  if (!on) {
    return tick + PROPOSAL_ADDRESS_FIELDS
      .map(f => refFieldRow(f.key, f.label, refPayload[f.key], { options: f.options })).join('')
  }
  if (!accountHasShipping()) {
    return tick + `
  <div class="ref-field">
    <div class="ref-field-label"><span></span></div>
    <div class="ref-empty-inline">This account has no shipping address.
      <a href="#" onclick="navigate('account-detail','${escHtml(refAccount?.id ?? '')}');return false">Add it on the account</a>.</div>
  </div>`
  }
  return tick + PROPOSAL_ADDRESS_FIELDS
    .map((f, i) => refReadonlyRow(f.label, refAccount?.[ACCOUNT_SHIPPING_KEYS[i]] ?? null)).join('')
}

// The tick rides the same batched save as every other field: it writes into
// refEdits, so the tab-row controls appear and Save sends it with the rest.
window.toggleRefSameAsAccount = function (checked) {
  const orig = !!refPayload[SAME_AS_ACCOUNT_KEY]
  if (checked === orig) delete refEdits[SAME_AS_ACCOUNT_KEY]
  else refEdits[SAME_AS_ACCOUNT_KEY] = { draft: checked, orig }
  // Re-render only this card: the rows it shows depend on the flag.
  document.getElementById('ref-customer-rows').innerHTML =
    refReadonlyRow('Account', refAccount?.name || 'Not linked')
    + CUSTOMER_FIELDS.map(f => refFieldRow(f.key, f.label, refPayload[f.key])).join('')
    + renderProposalAddress()
  updateRefEditBar()
}

// The drafted value where there is one, the stored value otherwise.
function refEffective(key) {
  return key in refEdits ? refEdits[key].draft : refPayload[key]
}

function refFieldLabel(key) {
  return ALL_EDITABLE_FIELDS.find(f => f.key === key)?.label ?? key
}

function refFieldRow(key, label, value, opts = {}) {
  const v = value ?? ''
  let inputTag
  if (opts.options) {
    // Leading blank option (2026-08-16, added for the new staffField
    // dropdowns - Terminus Lead/Commercial/Technical/Legal Authority can
    // legitimately be unset) - matches tbFieldRow's own options branch
    // exactly. Without it, an empty v matched no <option>, and the
    // browser's own default-to-first-option behavior would have silently
    // pre-selected the alphabetically-first name in edit mode for a
    // field that's actually unset - a real risk, not cosmetic: clicking
    // Save without touching it could have assigned that name by accident.
    inputTag = `<select id="ref-input-${key}">` +
      `<option value="">--</option>` +
      opts.options.map(o => `<option value="${escHtml(o)}"${o === v ? ' selected' : ''}>${escHtml(o)}</option>`).join('') +
      `</select>`
  } else if (opts.multiline) {
    inputTag = `<textarea id="ref-input-${key}" rows="2">${escHtml(v)}</textarea>`
  } else if (opts.date) {
    // Native <input type="date"> (2026-08-15 fix, same as Test Bed's
    // Reference tab) - forces a genuinely valid date at the browser
    // level. Pre-existing free-text dates (e.g. "01/01/27") won't
    // populate the picker until re-saved through it - the raw string is
    // untouched until then, not silently lost.
    // noPast (Round 3 Phase 3): a native min attribute, same "browser
    // catches most, server is authoritative" split as isValidIsoDate -
    // isNotPastIsoDate on the server rejects the same thing independently.
    const min = opts.noPast ? ` min="${new Date().toISOString().slice(0, 10)}"` : ''
    inputTag = `<input type="date" id="ref-input-${key}" value="${escHtml(v)}"${min}>`
  } else if (opts.number) {
    // Round 3 Phase 3 (Contract Duration) gave integer fields min=0/step=1
    // as the same native-constraint split as noPast above, with .no-spinner
    // hiding the arrows. All three are gone with type="number".
    //
    // They were native-UI hints only: nothing in this codebase ever read
    // min or step, and no native validity check was ever run against them.
    // isValidNonNegativeInteger on the server is what actually rejects a
    // negative or fractional value, and it is unchanged.
    //
    // inputmode keeps the numeric keypad on mobile. "numeric" is digits
    // only; a field that carries real decimal precision needs "decimal",
    // or iOS offers no decimal separator and the value cannot be typed.
    const mode = opts.integer ? 'numeric' : 'decimal'
    inputTag = `<input type="text" inputmode="${mode}" id="ref-input-${key}" value="${escHtml(v)}">` +
      (opts.suffix ? `<span class="field-suffix">${escHtml(opts.suffix)}</span>` : '')
  } else {
    inputTag = `<input type="text" id="ref-input-${key}" value="${escHtml(v)}">`
  }
  // tabindex + keydown (2026-08-15 fix, same mechanism as Test Bed's
  // Reference tab): .ref-field-display was never in the tab order, only
  // its own <input>/<select> was once opened - with every OTHER closed
  // field also unreachable by keyboard, Tab from one open field skipped
  // straight past the rest of this tab to whatever visible, natively-
  // focusable element came next in the DOM (a bare <div onclick> isn't
  // natively tabbable), confirmed live as Tab from Terminus Lead jumping
  // to the Account card's "Link to Account" button. Same fix applied to
  // the discard control for full keyboard parity.
  return `
  <div class="ref-field" data-key="${key}">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display" id="ref-display-${key}" tabindex="0" onclick="openRefField('${key}',true)" onkeydown="fieldDisplayKeydown(event,c=>openRefField('${key}',true,c))">${v !== '' ? escHtml(v) + (opts.number && opts.suffix ? ` ${opts.suffix}` : '') : '--'}</div>
    <div class="ref-field-edit hidden" id="ref-edit-${key}">
      ${inputTag}
      <span class="ref-field-discard" tabindex="0" onclick="discardRefField('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();discardRefField('${key}')}">&times;</span>
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

// ── Key Customer Contacts (Round 35, Phases 3 and 4) ─────────────────
// Phase 3 built this read only. Phase 4 adds linking, removing, and an
// append-only stance carrying an optional note.
//
// SHOWING EVERY ROW IS THE POINT, not a side effect of not having built the
// filter yet. The four fixed slots filter record_contacts to four title-cased
// strings, so all four live opportunities carry a lowercase "commercial
// buyer" link that has never appeared on screen. Nothing looked broken, so
// nothing was reported, and Phase 2 measured what that cost: 2 of 4 distinct
// roles are already split across more than one spelling.
//
// THE ROLE IS NOT UPPERCASED, a deliberate departure from .tag, which every
// other pill in this app uses. text-transform:uppercase would render
// "commercial buyer" and "Commercial Buyer" identically, which erases the
// exact difference this panel exists to show.
//
// A TYPED ROLE IS NOT A LESSER FACT ABOUT THE DEAL. Same size, colour and
// weight as a catalog role; only the border differs. It is the record of a
// role the catalog does not yet carry, which is what tells admin what to add.
//
// ONE ENTRY PER ACTION, AND THE ROW READS THE NEWEST. Stance and note are
// appended together because an entry is one observation about this person on
// this deal: where they stand, optionally what they want, at a time, by
// someone. Changing either arms that row's Record button; clicking it writes
// one entry. Two controls writing two entries would make "the note changed"
// and "the stance changed" separate history when they were one reading.
//
// REMOVE IS A SEPARATE CONTROL AND A SEPARATE ENDPOINT. It deletes the link;
// Record appends a stance. Nothing here can do one while meaning the other.
let kcRoles = []
let kcStances = []
let kcAccountContacts = []
let kcContext = { oppId: null, accountId: null }

async function renderKeyContacts(opp) {
  const el = document.getElementById('ref-key-contacts')
  if (!el) return
  kcContext = { oppId: opp.id, accountId: opp.account_id ?? null }

  const contacts = opp.key_contacts ?? []
  const rows = contacts.map(c => `
    <div class="kc-row" data-link-id="${escHtml(c.id)}" data-contact-id="${escHtml(c.contact_id)}" data-in-catalog="${c.in_catalog}">
      <span class="kc-name" tabindex="0" onclick="navigate('contact-detail','${escHtml(c.contact_id)}')"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate('contact-detail','${escHtml(c.contact_id)}')}"
        >${escHtml(c.name ?? c.contact_id)}</span>
      <span class="kc-role"><span class="kc-role-tag${c.in_catalog ? '' : ' kc-role-tag--typed'}">${escHtml(c.role ?? '')}</span></span>
      <span class="kc-stance">
        <select id="kc-stance-${escHtml(c.id)}" onchange="kcArm('${escHtml(c.id)}')">
          ${kcStanceOptions(c.stance)}
        </select>
      </span>
      <span class="kc-act">
        <button class="btn-sm kc-record hidden" id="kc-record-${escHtml(c.id)}"
                onclick="kcRecord('${escHtml(c.id)}')">Record</button>
        ${(c.stance_history?.length ?? 0) > 1
          ? `<span class="kc-hist" title="${escHtml(kcHistoryTitle(c))}">${c.stance_history.length} readings</span>`
          : ''}
      </span>
      <span class="kc-when">${escHtml(formatDate(c.linked_at))}</span>
      <span class="kc-remove" tabindex="0" title="Remove from this Opportunity"
            onclick="kcRemove('${escHtml(c.id)}','${escHtml(c.name ?? '')}')"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();kcRemove('${escHtml(c.id)}','${escHtml(c.name ?? '')}')}">&times;</span>
      <span class="kc-note">
        <input type="text" id="kc-note-${escHtml(c.id)}" value="${escHtml(c.note ?? '')}"
               placeholder="What do they want?" oninput="kcArm('${escHtml(c.id)}')"
               onkeydown="if(event.key==='Enter'){event.preventDefault();kcRecord('${escHtml(c.id)}')}">
      </span>
    </div>`).join('')

  // Derived from the rows rather than always present: with nothing typed
  // there is no convention to explain, and a legend for an absent treatment
  // is a claim with a shelf life.
  const typed = contacts.filter(c => !c.in_catalog).length
  const legend = typed
    ? `<p class="kc-legend">${typed} role${typed === 1 ? '' : 's'} here ${typed === 1 ? 'is' : 'are'} typed on this deal and not yet in the role catalog.</p>`
    : ''

  el.innerHTML = contacts.length
    ? `<div class="kc-head"><span>Contact</span><span>Role</span><span>Stance</span><span></span><span>Linked</span><span></span><span></span></div>
       ${rows}
       ${legend}
       <div id="kc-add"></div>`
    : `<p class="empty-state">No contacts linked to this Opportunity yet.</p>
       <div id="kc-add"></div>`

  await renderKcAddRow()
}

function kcStanceOptions(current) {
  // Grouped by axis, because axis says which values compete. A flat list
  // would offer Pain Owner alongside Blocker as though picking one ruled out
  // the other, and "owns the problem and blocks the fix" is the case the
  // vocabulary exists for.
  const axes = [...new Set(kcStances.map(s => s.axis))]
  return axes.map(ax => `<optgroup label="${escHtml(ax)}">` +
    kcStances.filter(s => s.axis === ax).map(s =>
      `<option value="${s.id}"${s.label === current ? ' selected' : ''}>${escHtml(s.label)}</option>`).join('') +
    '</optgroup>').join('')
}

// SHOWN ONLY WHEN THERE IS MORE THAN ONE READING, which is the only case
// where it says anything. A "1" beside every row is noise: every link opens
// at Unknown, so one reading is the floor rather than a fact. A count that
// appears exactly when a stance has moved is a signal, and the full history
// hangs off it as a tooltip rather than taking a column that most rows would
// leave empty. Where the history lives is a second question from what the row
// reads, and the row reads the current stance because that is what someone
// scanning a buying committee needs.
function kcHistoryTitle(c) {
  const h = c.stance_history ?? []
  if (!h.length) return 'No readings recorded'
  return h.map(e => `${formatDate(e.at)}  ${e.stance ?? '?'}${e.note ? ' - ' + e.note : ''}`).join('\n')
}

window.kcArm = function (linkId) {
  document.getElementById(`kc-record-${linkId}`)?.classList.remove('hidden')
}

window.kcRecord = async function (linkId) {
  const stance_id = document.getElementById(`kc-stance-${linkId}`)?.value
  const note = document.getElementById(`kc-note-${linkId}`)?.value ?? ''
  const btn = document.getElementById(`kc-record-${linkId}`)
  if (btn) { btn.disabled = true; btn.textContent = 'Recording...' }
  const result = await api('POST', `/api/opportunities/${kcContext.oppId}/key-contacts/${linkId}/stance`, { stance_id, note })
  if (!result.ok) {
    kcFeedback(result.data?.error ?? 'Failed to record.')
    if (btn) { btn.disabled = false; btn.textContent = 'Record' }
    return
  }
  await loadOpportunityDetail(kcContext.oppId)
}

window.kcRemove = async function (linkId, name) {
  if (!confirm(`Remove ${name || 'this contact'} from this Opportunity? Their stance history is kept in the audit log.`)) return
  const result = await api('DELETE', `/api/opportunities/${kcContext.oppId}/key-contacts/${linkId}`)
  if (!result.ok) { kcFeedback(result.data?.error ?? 'Failed to remove.'); return }
  await loadOpportunityDetail(kcContext.oppId)
}

function kcFeedback(msg) {
  const el = document.getElementById('kc-feedback')
  if (el) el.innerHTML = `<p class="msg-error">${escHtml(msg)}</p>`
}

async function renderKcAddRow() {
  const el = document.getElementById('kc-add')
  if (!el) return
  if (!kcContext.accountId) { el.innerHTML = '<p class="empty-state">No linked Account, so no Contacts to add.</p>'; return }

  // FETCHED PER ACCOUNT, NOT ONCE PER PAGE LOAD, and the difference is why
  // this is keyed on the account rather than guarded by `if (!length)`.
  // renderRefBuyerRows did the latter, so after opening one Opportunity every
  // later one offered the FIRST one's account contacts. Demonstrated live in
  // Phase 3 on two records with disjoint contact lists, and left alone there
  // because Phase 5 was going to delete it, which it did.
  if (kcAccountContacts.accountId !== kcContext.accountId) {
    const result = await api('GET', '/api/contacts')
    kcAccountContacts = result.ok
      ? result.data.filter(c => c.parent_record_id === kcContext.accountId)
      : []
    kcAccountContacts.accountId = kcContext.accountId
  }

  const people = kcAccountContacts.map(c =>
    `<option value="${c.id}">${escHtml(c.payload?.name ?? c.id)}</option>`).join('')
  const roleOpts = kcRoles.map(r => `<option value="${r.id}">${escHtml(r.label)}</option>`).join('')

  el.innerHTML = `
    <div class="kc-add-row">
      <select id="kc-add-contact">
        <option value="">${kcAccountContacts.length ? 'Select a contact linked to this Account' : 'No Contacts linked to this Account yet'}</option>
        ${people}
      </select>
      <select id="kc-add-role" onchange="kcAddRoleChanged()">
        <option value="">Select a role</option>
        ${roleOpts}
        <option value="__other">Not listed, type it</option>
      </select>
      <input type="text" id="kc-add-other" class="hidden" placeholder="Role as they describe it">
      <button class="btn-sm" onclick="kcAdd()">Add</button>
      <!-- "+ New" survives the retirement of the four slots. It was their
           one real capability beyond the select: create a qualified Contact
           without leaving the deal. Removing the slots without it would have
           taken that away silently, which is not what "retire the slots"
           asked for. Same shared modal (app.js's
           openInlineBuyerContactModal), now passed the role's uuid or the
           typed text rather than one of four hardcoded strings. -->
      <button class="btn-sm btn-ghost" onclick="kcNewContact()">+ New</button>
    </div>
    <div id="kc-feedback"></div>`
}

window.kcAddRoleChanged = function () {
  const other = document.getElementById('kc-add-other')
  const chosen = document.getElementById('kc-add-role')?.value
  other?.classList.toggle('hidden', chosen !== '__other')
  if (chosen === '__other') other?.focus()
}

window.kcNewContact = function () {
  const roleSel = document.getElementById('kc-add-role')?.value
  const typed = document.getElementById('kc-add-other')?.value?.trim() ?? ''
  // The role is chosen BEFORE the Contact is created, because step 4 of the
  // modal links in that role and has nowhere to ask for one.
  if (!roleSel) { kcFeedback('Pick a role first, so the new contact can be linked in it.'); return }
  if (roleSel === '__other' && !typed) { kcFeedback('Type the role first, so the new contact can be linked in it.'); return }
  const label = roleSel === '__other' ? typed : (kcRoles.find(r => r.id === roleSel)?.label ?? '')
  openInlineBuyerContactModal('opportunity', kcContext.oppId, kcContext.accountId, label,
    roleSel === '__other' ? null : roleSel,
    roleSel === '__other' ? typed : null)
}

window.kcAdd = async function () {
  const contact_id = document.getElementById('kc-add-contact')?.value
  const roleSel = document.getElementById('kc-add-role')?.value
  const typed = document.getElementById('kc-add-other')?.value?.trim() ?? ''
  if (!contact_id) { kcFeedback('Pick a contact first.'); return }
  if (!roleSel) { kcFeedback('Pick a role, or choose "Not listed, type it".'); return }
  if (roleSel === '__other' && !typed) { kcFeedback('Type the role, or pick one from the list.'); return }
  const body = roleSel === '__other' ? { contact_id, role_other: typed } : { contact_id, role_id: roleSel }
  const result = await api('POST', `/api/opportunities/${kcContext.oppId}/key-contacts`, body)
  if (!result.ok) { kcFeedback(result.data?.error ?? 'Failed to add.'); return }
  await loadOpportunityDetail(kcContext.oppId)
}

// Fetched once per session, same lazy pattern as industriesCache and
// terminusStaffCache. These are configuration, not per-record data, so unlike
// the account contacts above there is nothing for a cache to get wrong.
async function ensureKcVocabularies() {
  if (!kcRoles.length) {
    const r = await api('GET', '/api/contact-roles')
    if (r.ok) kcRoles = r.data
  }
  if (!kcStances.length) {
    const r = await api('GET', '/api/contact-stances')
    if (r.ok) kcStances = r.data
  }
}

function renderReferenceTab(opp) {
  refOpportunityId = opp.id
  refPayload = opp.payload ?? {}
  refOppDetails = opp.opportunity_details ?? {}
  refStatus = opp.status ?? ''
  refEdits = {}

  // Milestone 6: this was hardcoded to always show "Not yet generated"
  // regardless of the record's real reference_code - found while wiring
  // create-opportunity to issueReferenceNumber, since a generated code
  // would otherwise have had nowhere real to display.
  document.getElementById('ref-reference-code').textContent = opp.reference_code || 'Not yet generated'

  // Opportunity Name (Round 3 Phase 3, 2026-08-17): same generic
  // openRefField/discardRefField mechanism as every card-row field below,
  // just rendered as the page's own h1 instead of a labelled row - same
  // display/edit/input trio of element IDs (ref-display-name/
  // ref-edit-name/ref-input-name), no changes needed to either function.
  refOppReference = opp.reference_code ?? null
  document.getElementById('ref-display-name').textContent = refPayload.name || '--'
  document.getElementById('ref-input-name').value = refPayload.name ?? ''
  document.getElementById('ref-edit-name').classList.add('hidden')
  document.getElementById('ref-display-name').classList.remove('hidden')

  // Round 34 Phase 4: Terminus Reference joins the panel, and Status becomes
  // Stage.
  //
  // TEST BED'S ORDER, which its own comment explains: the reference sits
  // immediately beneath the name because the name is the record's identity and
  // is what the page header renders. Opportunity's header renders the name too,
  // so the same reasoning gives the same order here.
  //
  // NOTHING LEAVES THE HEADER. The brief asks what moves out of it, and the
  // answer is nothing: Opportunity's header carries the name and the company
  // name, and has never shown the reference at all. This adds a row rather than
  // relocating one.
  //
  // READ ONLY, because reference_code is issued by the numbering service and
  // Status is the stage machine's. Test Bed renders both the same way.
  //
  // "Stage" rather than "Status" is DISPLAY ONLY: refStatus still reads the
  // record's own status and no key, column or endpoint moves. Round 20 recorded
  // four column names for this one idea across the database, and this changes
  // none of them.
  //
  // INDUSTRY IS DELIBERATELY NOT ADDED, and that is a finding rather than an
  // omission. Test Bed renders it from tbBed.industry?.name, resolved
  // server-side. An Opportunity has an industry_id column, but nothing in
  // opportunities.js reads or writes it, the endpoint returns no industry
  // object, and zero of the four live opportunities carry a value. A row here
  // would read '--' on every record and could never do otherwise, which is the
  // container-written-and-never-read shape Round 31 Phase 1 spent a phase on.
  document.getElementById('ref-terminus-rows').innerHTML =
    refReadonlyRow('Terminus Reference', refOppReference)
    + TERMINUS_FIELDS.map(f => refFieldRow(f.key, f.label, refPayload[f.key], { options: f.staffField ? terminusStaffCache.map(s => s.name) : f.options })).join('')
    + refReadonlyRow('Stage', refStatus)

  // Account: read-only and inherited (2026-08-16), same
  // tbReadonlyRow('Account', ...) shape Test Bed already uses - no
  // Link-to-Account UI, no manual re-link or override, a pure
  // reflection of whatever account_id was auto-populated from the
  // source Contact at creation. The search-existing/create-new panel
  // this used to be (refAccountName/renderRefAccountCard/
  // openRefLinkAccountPanel/renderRefLinkResults/linkRefAccount, plus
  // today's two fixes to it - the dirty-edit guard and the
  // row-click-to-commit simplification) is removed entirely, not hidden
  // - both fixes were protecting/simplifying an action that no longer
  // exists. opp.account is server-resolved now (GET /opportunities/:id,
  // matching Test Bed's own GET /test-beds/:id), not looked up from
  // accountsCache - that cache is only reliably populated after
  // visiting Contacts/Leads first, which this read-only row can no
  // longer guarantee once the on-open refresh that used to backstop it
  // is gone. "Not linked" for the unset case (a legacy Opportunity
  // created before auto-population existed) - honest placeholder, never
  // an error.
  refAccount = opp.account ?? null
  document.getElementById('ref-customer-rows').innerHTML =
    refReadonlyRow('Account', opp.account?.name || 'Not linked')
    + CUSTOMER_FIELDS.map(f => refFieldRow(f.key, f.label, refPayload[f.key])).join('')
    + renderProposalAddress()

  // Key Customer Contacts (Round 35 Phases 3 and 4). The vocabularies are
  // needed before the row's stance select can be built, so this is the one
  // render pass here that awaits something.
  ensureKcVocabularies().then(() => renderKeyContacts(opp))

  // estClose now renders through the same refFieldRow mechanism as every
  // other date field below (Round 3 Phase 3), just pulled out of
  // DATE_FIELDS' own map so "Est. Close Date Moves" can keep sitting
  // directly under it, same visual order as before this phase -
  // refFieldOrigValue() supplies its real value
  // (opportunity_details.forecast_close_date, not a payload key) to
  // openRefField/discardRefField, and the value passed to refFieldRow
  // here does the same for this initial render.
  const estCloseField = DATE_FIELDS.find(f => f.key === 'estClose')
  document.getElementById('ref-dates-rows').innerHTML =
    refReadonlyRow('Date Created', formatDate(opp.created_at))
    + refFieldRow(estCloseField.key, estCloseField.label, refOppDetails.forecast_close_date, { date: true, noPast: true })
    + refReadonlyRow('Est. Close Date Moves', String(refPayload.closeMoves ?? 0))
    + DATE_FIELDS.filter(f => f.key !== 'estClose').map(f => refFieldRow(
        f.key, f.label, refPayload[f.key],
        { date: f.date, number: f.number, integer: f.integer, suffix: f.suffix }
      )).join('')

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

// estClose (Round 3 Phase 3): the one field in ALL_EDITABLE_FIELDS whose
// real value isn't a payload key - forecast_close_date lives on
// opportunity_details, not refPayload. Every other field is untouched,
// still a plain refPayload[key] lookup.
function refFieldOrigValue(key) {
  if (key === 'estClose') return refOppDetails.forecast_close_date ?? ''
  return refPayload[key] ?? ''
}

// fromUserGesture (Round 10 Phase 0A): see window.revealFieldControl in app.js.
window.openRefField = function (key, fromUserGesture, seedChar) {
  if (refEdits[key]) return
  const orig = String(refFieldOrigValue(key))
  refEdits[key] = { draft: orig, orig }
  document.getElementById(`ref-display-${key}`).classList.add('hidden')
  document.getElementById(`ref-edit-${key}`).classList.remove('hidden')
  const input = document.getElementById(`ref-input-${key}`)
  window.revealFieldControl(input, fromUserGesture, seedChar)
  updateRefEditBar()
}

window.discardRefField = function (key) {
  delete refEdits[key]
  const editEl = document.getElementById(`ref-edit-${key}`)
  editEl.classList.add('hidden')
  editEl.classList.remove('dirty')
  document.getElementById(`ref-display-${key}`).classList.remove('hidden')
  const input = document.getElementById(`ref-input-${key}`)
  if (input) input.value = refFieldOrigValue(key)
  updateRefEditBar()
}

function onRefFieldInput(key) {
  const edit = refEdits[key]
  if (!edit) return
  edit.draft = document.getElementById(`ref-input-${key}`).value
  document.getElementById(`ref-edit-${key}`).classList.toggle('dirty', edit.draft !== edit.orig)
  updateRefEditBar()
}

// Round 34 Phase 3: two buttons in the tab row, gated on DIRTY.
//
// This toggled a banner that sat above the cards and appeared the moment any
// field was OPENED, which moved the panel 76px under the pointer that had just
// clicked it. Both halves of that are now gone: the banner is deleted, and the
// gate is dirtyCount rather than keys.length.
//
// Round 5 Phase 5 stated the principle on Test Bed and this adopts it verbatim:
// opening a field and leaving it unchanged should have zero visible effect.
//
// "N fields open, M changed" goes with the banner. It was a count of a state
// that is now invisible by design, and Test Bed dropped the same text for the
// same reason.
//
// A field opened and left alone is still cancellable through its own discard
// control, which is what makes hiding both buttons safe.
function updateRefEditBar() {
  const dirtyCount = Object.values(refEdits).filter(e => e.draft !== e.orig).length
  const show = dirtyCount > 0
  // `tab-action-idle` rather than `hidden`: see the note on it in style.css.
  // `hidden` is display:none, which takes the buttons out of the flex flow and
  // lets the strip re-wrap around their absence.
  for (const id of ['ref-cancel-all', 'ref-save-all']) {
    document.getElementById(id)?.classList.toggle('tab-action-idle', !show)
  }
}

async function saveRefFields() {
  const feedback = document.getElementById('ref-save-feedback')
  feedback.textContent = ''
  feedback.className = ''

  const dirtyEntries = Object.entries(refEdits).filter(([, e]) => e.draft !== e.orig)
  if (!dirtyEntries.length) return

  // Est. Close Date (Round 3 Phase 3, 2026-08-17): moving it is a business
  // event (mandatory reason, writes a note, bumps the moves counter,
  // updates opportunity_details), not a plain payload edit - detected
  // here, automatically, the moment Save is clicked with it among the
  // dirty fields, rather than needing its own separate "Edit" entry
  // point. Any other dirty fields from the same Save click are held
  // until the reason is confirmed (confirmCloseDateMove below), then
  // saved together in one action - a real change to this one field is
  // what triggers the dialogue, not a change to anything else.
  const estCloseEntry = dirtyEntries.find(([key]) => key === 'estClose')
  if (estCloseEntry) {
    openCloseDateMovePrompt(estCloseEntry[1].draft, dirtyEntries.filter(([key]) => key !== 'estClose'))
    return
  }

  await performGenericRefSave(dirtyEntries)
}

// Split out of saveRefFields (Round 3 Phase 3) so confirmCloseDateMove
// below can reuse the exact same payload-merge/freshness-check logic for
// whatever else was dirty in the same Save click, once the reason is
// confirmed - not a second, drifting copy of this logic.
// Which Reference tab fields are numeric, DERIVED from the field definitions
// rather than kept as a second list beside them. A field gains `number: true`
// where it is declared, and this follows it; a hand-kept copy would be one
// edit away from disagreeing with the declaration it describes.
//
// Intersected with WRITABLE_NUMERIC_KEYS so the two screens cannot disagree
// about what a numeric payload key is: duration is the only field in both
// today, and a future numeric field is covered the moment it is declared.
function refKeyIsNumeric(key) {
  const declared = [...TERMINUS_FIELDS, ...CUSTOMER_FIELDS, ...DATE_FIELDS]
    .some(f => f.key === key && f.number === true)
  const shared = (window.WRITABLE_NUMERIC_KEYS ?? []).includes(key)
  return declared || shared
}

async function performGenericRefSave(dirtyEntries) {
  const feedback = document.getElementById('ref-save-feedback')
  if (!dirtyEntries.length) return

  // THE PER-FIELD CUSTOMER LEAD CHECK IS GONE. Round 38.
  //
  // It GET the record, compared one field against its value at page load, and
  // refused the save if it had moved. Two concurrency mechanisms of different
  // shapes on one screen is worse than either alone, and this one was the
  // weaker: read-then-write rather than compare-and-swap, and one key wide
  // while every other field on this tab merged unchecked.
  //
  // Replaced by the record-level precondition below, which this tab now sends.

  const payloadUpdate = {}
  const newNotes = dirtyEntries.map(([key, e]) => {
    // NUMBER-ISED BEFORE IT IS WRITTEN. Round 38, before the Phase 2 reshape.
    //
    // e.draft is an input's raw .value, always a string, and this assigned it
    // straight into the payload. Contract Duration is a numeric key shared with
    // the Commercials tab, so every save from this tab wrote duration as "36"
    // while the other tab wrote 36. Measured across all 17,618 revisions:
    // 49 string durations, and this was the live path still producing them.
    //
    // '' is accepted at this input boundary and normalised to null, because
    // null is the stored representation of "not set": (payload->>'k')::numeric
    // returns NULL for a JSON null and ERRORS on an empty string, and the
    // forecast reporting this build is heading toward will cast in SQL.
    payloadUpdate[key] = refKeyIsNumeric(key) ? window.toNumberOrNull(e.draft) : e.draft
    return {
      text: `${refFieldLabel(key)} changed from ${e.orig || '--'} to ${e.draft || '--'}.`,
      at: new Date().toISOString(),
      by: currentSession?.user?.email ?? '',
    }
  })
  payloadUpdate.notes = [...newNotes, ...(refPayload.notes ?? [])]

  const result = await window.oppPatch(refOpportunityId, { payload: payloadUpdate })
  if (!result.ok) {
    feedback.textContent = result.status === 409
      ? (result.data?.error ?? 'This Opportunity changed since the screen loaded. Reload before saving.')
      : (result.data?.error ?? 'Failed to save.')
    feedback.className = 'msg-error'
    return
  }
  // loadOpportunityDetail below re-renders the whole tab (renderReferenceTab
  // resets refEdits to {} unconditionally), so no manual clearing needed
  // here - same as before this function was split out of saveRefFields.
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

// ── Est. Close Date: mandatory-reason dialogue (Round 3 Phase 3,
// 2026-08-17) ───────────────────────────────────────────────────────────
// No longer its own permanently-present form behind a separate "Edit"
// link (the brief's own framing) - Est. Close Date is now a plain field
// in the generic click-to-edit flow above like every other Key Dates row,
// and this dialogue is triggered automatically by saveRefFields the
// moment it's among the dirty fields at Save. Moving it is still a real
// business event under the hood (mandatory reason, writes a note, bumps
// the moves counter, updates opportunity_details via the same dedicated
// close-date-move endpoint), just reached differently now.
let refPendingRemainingEntries = []

// REWIRED to the shared dialogue, Round 11 Phase 3 (2026-08-19). The
// mechanism Round 3 Phase 3 built here is now window.requestChangeReason in
// app.js, used by this caller and by Test Bed's score revision.
//
// THE STORAGE IS DELIBERATELY UNCHANGED. This still POSTs to
// /opportunities/:id/close-date-move, which writes the reason into
// payload.notes as prose and bumps closeMoves, exactly as before. Round 11's
// brief requires a score's reason to live on the score entry rather than in
// a note, which is why the storage could not be shared - but rewriting a
// working mechanism to match a new one is scope this round was not given,
// and the note is correct for what it records.
//
// What moved out of this file: the dialogue's own DOM handling, its focus
// trap, its single Escape owner and its focus return. What stayed: which
// field triggers it, what the reason means, and where it is written.
//
// The Round 3 property this must not lose - cancelling does not discard an
// unrelated dirty field - is now a property of the shared helper, which
// touches no caller state on cancel. Re-verified on BOTH callers after the
// rewire rather than assumed to have survived it.
function openCloseDateMovePrompt(newDate, remainingDirtyEntries) {
  refPendingRemainingEntries = remainingDirtyEntries
  window.requestChangeReason({
    heading: 'Move Est. Close Date',
    contextLabel: 'New Est. Close Date',
    contextValue: newDate || '--',
    promptLabel: 'Reason for moving (required)',
    confirmLabel: 'Save move',
    emptyReasonError: 'A reason for the move is required.',
    // Opens from Save rather than a dedicated named button, so Save is the
    // control focus returns to (INTERACTION_STANDARDS.md Section 4).
    returnFocusTo: 'ref-save-all',
    onConfirm: async (reason) => {
      const result = await api('POST', `/api/opportunities/${refOpportunityId}/close-date-move`, { date: newDate, reason })
      return { ok: result.ok, error: result.data?.error }
    },
    onDone: async () => {
      const remaining = refPendingRemainingEntries
      refPendingRemainingEntries = []
      delete refEdits.estClose
      // Whatever else was dirty in the same Save click is saved together
      // here, in one action, rather than needing a second Save.
      if (remaining.length) await performGenericRefSave(remaining)
      else await loadOpportunityDetail(refOpportunityId)
    },
    onCancel: () => { refPendingRemainingEntries = [] },
  })
}

function wireRefOnce() {
  if (refWired) return
  refWired = true
  document.getElementById('ref-cancel-all').addEventListener('click', () => {
    Object.keys(refEdits).forEach(key => window.discardRefField(key))
  })
  document.getElementById('ref-save-all').addEventListener('click', saveRefFields)
  // Backdrop-click and Escape are both owned by the shared dialogue in
  // app.js now (Round 11 Phase 3), attached on open and removed on close,
  // so there is still exactly one Escape owner rather than two competing
  // handlers - the property the 2026-08-17 follow-up established, now held
  // in one place for both callers instead of once per caller.
  // Round 34 Phase 3: the resize listener went with the banner. It existed to
  // match the bar's right edge to the rightmost card's, because the bar spanned
  // an uncapped container while .ref-cards caps its columns at 420px. A control
  // in the tab row has no width to sync, so the listener has nothing left to do
  // and syncRefEditBarWidth is deleted rather than left pointing at an element
  // that no longer exists.
}

// ── Entry point, called by app.js's renderOppDetail() ─────────────────────
window.initOpportunityReferencePanel = function (opp) {
  wireRefOnce()
  // kcAccountContacts is reset by the account it was fetched for rather than
  // here, so navigating between two Opportunities on the SAME account keeps
  // the fetch and navigating to a different one discards it. The array this
  // line used to clear, refAccountContacts, is gone with the four slots
  // (Round 35 Phase 5).
  renderReferenceTab(opp)
}
