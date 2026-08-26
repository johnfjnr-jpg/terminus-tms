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
// contacts. Technical/Commercial/Legal/IT-Security Buyer (Round 3 Phase
// 3, 2026-08-17, see BUYER_ROLES/renderRefBuyerRows below): a real
// record_contacts link, filtered to Contacts already linked to this
// Opportunity's own Account, direct port of Test Bed's existing Client
// Buyer mechanism. Customer Lead and Commercial Address for Proposal are
// the only remaining plain-text person/address fields.

let refOpportunityId = null
let refPayload = {}
let refOppDetails = {}
let refStatus = ''
let refWired = false
// Buyer Roles (Round 3 Phase 3): Contacts already linked to this
// Opportunity's own Account, same tbAccountContacts cache/reset pattern
// as Test Bed's own buyer mechanism (test-bed-detail.js) - fetched once
// per opportunity load (reset in initOpportunityReferencePanel below),
// reused across re-renders within that same view.
let refAccountContacts = []

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
// 3, 2026-08-17) - no longer free text, see BUYER_ROLES below and
// renderRefBuyerRows, a real record_contacts link filtered to Contacts
// already linked to this Opportunity's Account, direct port of Test
// Bed's existing Client Buyer mechanism (test-bed-detail.js), not the
// full mandatory-core/admin-catalog/escape-valve model.
const CUSTOMER_FIELDS = [
  { key: 'customerLead', label: 'Customer Lead' },
  { key: 'commAddress', label: 'Commercial Address for Proposal' },
]
// Role strings match this endpoint's own VALID_OPPORTUNITY_BUYER_ROLES
// (src/routes/opportunities.js) exactly, and the field labels these
// replaced, so nothing else about the panel's layout changes.
const BUYER_ROLES = ['Technical Buyer', 'Commercial Buyer', 'Legal Buyer', 'IT / Security Buyer']
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
const ALL_EDITABLE_FIELDS = [NAME_FIELD, ...TERMINUS_FIELDS, ...CUSTOMER_FIELDS, ...DATE_FIELDS, OPPTYPE_FIELD, SUMMARY_FIELD]

// Round 34 Phase 4: held here rather than read from `opp` inside the render,
// because renderReferenceTab is the only place that has the record and the
// rows are built from module state everywhere else.
let refOppReference = null

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

// Buyer Roles (Round 3 Phase 3): direct port of Test Bed's
// renderTbBuyerRows/linkTbBuyer (test-bed-detail.js) - a role already
// linked renders read-only, an unlinked role gets a select (Contacts
// already linked to this Opportunity's own Account) plus a Link button.
// The server (POST /opportunities/:id/buyer-contacts) re-validates the
// Account match regardless of this client-side filtering.
async function renderRefBuyerRows(opp) {
  const el = document.getElementById('ref-buyer-rows')
  if (!el) return
  if (!opp.account_id) {
    el.innerHTML = '<p class="empty-state">No linked Account.</p>'
    return
  }

  if (!refAccountContacts.length) {
    const result = await api('GET', '/api/contacts')
    if (result.ok) {
      refAccountContacts = result.data.filter(c => c.parent_record_id === opp.account_id)
    }
  }

  const linked = opp.buyer_contacts ?? []
  el.innerHTML = BUYER_ROLES.map(role => {
    const current = linked.find(l => l.role === role)
    if (current) {
      return `
      <div class="ref-field" data-key="buyer-${role}">
        <div class="ref-field-label"><span>${escHtml(role)}</span></div>
        <div class="ref-field-display readonly">${escHtml(current.name ?? current.contact_id)}</div>
      </div>`
    }
    const options = refAccountContacts.map(c => `<option value="${c.id}">${escHtml(c.payload?.name ?? c.id)}</option>`).join('')
    return `
    <div class="ref-field" data-key="buyer-${role}">
      <div class="ref-field-label"><span>${escHtml(role)}</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="ref-buyer-select-${escHtml(role)}">
          <option value="">${refAccountContacts.length ? 'Select a contact linked to this Account' : 'No Contacts linked to this Account yet'}</option>
          ${options}
        </select>
        <button class="btn-sm" onclick="linkRefBuyer('${escHtml(role)}')">Link</button>
        <!-- Round 5 Phase 9 (2026-08-17): direct port of Test Bed's own
             "+ New" trigger (test-bed-detail.js) - one shared modal
             (app.js's openInlineBuyerContactModal), not a second
             implementation. -->
        <button class="btn-sm btn-ghost" onclick="openInlineBuyerContactModal('opportunity', '${escHtml(refOpportunityId)}', '${escHtml(opp.account_id)}', '${escHtml(role)}')">+ New</button>
      </div>
      <div id="ref-buyer-feedback-${escHtml(role)}"></div>
    </div>`
  }).join('')
}

window.linkRefBuyer = async function (role) {
  const select = document.getElementById(`ref-buyer-select-${role}`)
  const contact_id = select.value
  const feedback = document.getElementById(`ref-buyer-feedback-${role}`)
  if (!contact_id) return
  const result = await api('POST', `/api/opportunities/${refOpportunityId}/buyer-contacts`, { role, contact_id })
  if (!result.ok) {
    feedback.innerHTML = `<p class="msg-error">${escHtml(result.data.error ?? 'Failed to link contact.')}</p>`
    return
  }
  await loadOpportunityDetail(refOpportunityId)
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
  document.getElementById('ref-customer-rows').innerHTML =
    refReadonlyRow('Account', opp.account?.name || 'Not linked')
    + CUSTOMER_FIELDS.map(f => refFieldRow(f.key, f.label, refPayload[f.key])).join('')

  // Buyer Roles (Round 3 Phase 3): record_contacts-backed, not part of
  // the generic refPayload rows above - own render pass, same reasoning
  // and same async-fetch-then-render shape as Test Bed's
  // renderTbBuyerRows (test-bed-detail.js).
  renderRefBuyerRows(opp)

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
async function performGenericRefSave(dirtyEntries) {
  const feedback = document.getElementById('ref-save-feedback')
  if (!dirtyEntries.length) return

  // Origin-contact freshness check (Round 2 Phase 1, 2026-08-16) - same
  // pattern as Test Bed's own initialLead fix (test-bed-detail.js) and
  // the same mechanism already proven for Duration (opportunity-deal.js).
  // Untouched is already safe by construction here too, dirtyEntries only
  // ever includes fields the user actually opened and changed. This only
  // fires for a genuine edit to customerLead specifically.
  const customerLeadEntry = dirtyEntries.find(([key]) => key === 'customerLead')
  if (customerLeadEntry) {
    const fresh = await api('GET', `/api/opportunities/${refOpportunityId}`)
    if (!fresh.ok) {
      feedback.textContent = 'Could not verify the current Customer Lead value before saving.'
      feedback.className = 'msg-error'
      return
    }
    const serverValue = fresh.data.payload?.customerLead ?? ''
    if (serverValue !== customerLeadEntry[1].orig) {
      feedback.textContent = 'Customer Lead was changed elsewhere since this tab was loaded. Reload the page before saving.'
      feedback.className = 'msg-error'
      return
    }
  }

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
  refAccountContacts = []
  renderReferenceTab(opp)
}
