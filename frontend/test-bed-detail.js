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

// Matches contact-detail.js's own region select exactly (2026-08-15 fix)
// - Region changed from free text to this fixed picklist, reusing
// Contact's existing definition rather than maintaining a second, since
// the two fields are now genuinely the same scale (they weren't at
// Milestone 4, which is why region was deliberately left uncarried at
// creation then - see contacts.js's create-test-bed for the reversal).
const REGION_OPTIONS = ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa']

// Reference tab, Phase 7 3-panel rebuild (2026-08-16): Terminus Details /
// Customer Details / Key Dates, matching Opportunity's layout exactly.
// Legal Authority reads from terminusLegalOwner - the only Legal-
// flavoured field that ever existed for Test Bed (the prototype's own
// spec has no Legal Authority for Test Bed at all, only Commercial/
// Technical - this goes beyond it deliberately, same as Opportunity's
// naming). terminusCommercialOwner/terminusTechnicalOwner were a dead,
// unused duplicate of commercialAuthority/technicalAuthority (confirmed
// empty on the only real Test Bed record, and absent from the
// prototype's field spec) - removed entirely, not renamed.
// Terminus Lead/Commercial/Technical/Legal Authority are staffField: true
// (2026-08-16) - a dropdown sourced from terminus_staff (app.js's
// terminusStaffCache), not free text. Any of the 7 can be selected for
// any of the 4 roles, no title-based restriction. Resolved to real
// options at render time (renderTbReference), not here - this array is a
// static const evaluated before terminusStaffCache is ever populated.
// Round 10 Phase 1 (2026-08-19): `name` becomes editable. It has been a
// writable key since Milestone 4 but had no control anywhere, which is
// exactly why Round 5 Phase 2 ruled out a creation-time name prompt - a
// badly-chosen name could not be corrected afterward. Adding the control
// here is what makes that reversal safe, so the two halves of Phase 1
// ship together rather than the prompt landing on its own.
//
// It uses the ordinary tbFieldRow click-to-edit shape, the same as every
// other field on this tab, and it saves through the same batched save bar.
// It is NOT a separate mechanism and must not become one.
const TB_NAME_FIELD = { key: 'name', label: 'Test Bed Name' }
// Round 10 Phase 3.1 (2026-08-19): labels shortened per the business's own
// table. DISPLAY ONLY - every `key` here is unchanged, so no payload key,
// endpoint key or column moves. The shortening pairs with Phase 2 item 4's
// narrowing of Customer Details, which ships in the same change.
const TB_TERMINUS_FIELDS = [
  { key: 'terminusLead', label: 'Terminus Lead', staffField: true },
  { key: 'commercialAuthority', label: 'Comm. Auth', staffField: true },
  { key: 'technicalAuthority', label: 'Tech. Auth', staffField: true },
  { key: 'terminusLegalOwner', label: 'Legal Auth', staffField: true },
  { key: 'region', label: 'Region', options: REGION_OPTIONS },
  { key: 'country', label: 'Country' },
]
// Client Lead is initialLead (Phase 1's origin-contact field) - labeled
// "Client Lead" here to match the brief's own Phase 6/7 naming, even
// though it was called "Initial Lead" in this field's old home (Site
// Details' now-removed Contacts card). Account is read-only display
// only (tbBed.account?.name) - Test Bed has no Link-to-Account UI,
// unlike Contact/Opportunity, and this phase doesn't add one.
const TB_CUSTOMER_FIELDS = [
  { key: 'initialLead', label: 'Client Lead' },
]
// Matches VALID_INSTALLATION_ENVIRONMENT in src/routes/test-beds.js exactly.
// Declared HERE, above TB_SITE_FIELDS, because that array references it in
// its own initialiser and `const` is not hoisted - declaring it further down
// threw "Cannot access before initialization" at load and took the entire
// file with it, leaving window.initTestBedDetailPanel undefined and the
// whole Test Bed detail panel dead. Same total-page-failure mode as the
// recorded top-level const collision, from a different cause.
const INSTALLATION_ENVIRONMENT_OPTIONS = ['Indoor', 'Outdoor', 'Both']

const TB_SUMMARY_FIELD = { key: 'summary', label: 'Summary' }
// Matches VALID_SITE_OWNERSHIP in src/routes/test-beds.js exactly (no
// frontend-reachable picklist-admin endpoint exists for this yet, same
// gap already noted there - hardcoded here the same way, not a second,
// independent decision).
const SITE_OWNERSHIP_OPTIONS = ['Local Authority', 'Port Authority', 'National Highways', 'Central Government', 'Private', 'Other']

const TB_SITE_FIELDS = [
  { key: 'siteOwnership', label: 'Site Ownership', options: SITE_OWNERSHIP_OPTIONS },
  // INST. ENV., not INT. ENV. - confirmed with the business: "Int." reads
  // as Internal or International, and "Inst." matches the existing
  // "Est. Inst Date" convention. Options follow the VALID_SITE_OWNERSHIP
  // hardcoded-array convention rather than a new picklist table; the
  // business has confirmed these move to an Admin-configured list later,
  // and a table built now would be a second home for the same decision.
  { key: 'installationEnvironment', label: 'Inst. Env.', options: INSTALLATION_ENVIRONMENT_OPTIONS },
  { key: 'siteAddress', label: 'Site Address' },
  { key: 'city', label: 'City' },
  { key: 'estCostPerUnit', label: 'Estimated Cost per Unit' },
  { key: 'indicativeCost', label: 'Indicative Cost' },
]
// Round 6 Phase 3 (2026-08-17): moved out of TB_SITE_FIELDS onto the
// Commercials tab, alongside the cost engine that already consumes
// these same tbPayload keys as its own inputs (renderTbCostBreakdown).
// The generated Sensors list itself (renderTbSensors) stays on Site
// Details - it's a read-only display of these counts, not the
// counts themselves.
// integer (Round 7 Phase 2.2, 2026-08-18): these are physical device
// counts - never negative, never fractional - and they multiply straight
// into the install and hosting cost lines. They had carried only
// `number: true`, so no integer treatment at all, and the render call
// site below passed only `{ number: f.number }`, dropping anything else
// anyway. Same integer treatment as testBedDuration, matched by a real
// server-side check added in the same phase (test-beds.js).
const TB_SENSOR_COUNT_FIELDS = [
  { key: 'safesightCameras', label: 'No. of SafeSight Cameras', number: true, integer: true },
  { key: 'airQualitySensors', label: 'No. of Air Quality Sensors', number: true, integer: true },
  { key: 'hemirSensors', label: 'No. of HEMIR Sensors', number: true, integer: true },
]
// noPast/integer (Round 5 Phase 4, 2026-08-17): mirrors Opportunity's
// identical Round 3 Phase 3 fix (opportunity-reference.js's DATE_FIELDS) -
// both estimatedInstallationDate and estGoLiveDate are estimates, a past
// "estimate" is nonsensical, and unlike Opportunity's Est. Close/Go Live
// pair, Test Bed has no "actual" counterpart date field to deliberately
// leave unrestricted, TB_DATE_FIELDS is only ever these two estimates
// plus Duration. testBedDuration gets the same integer treatment as
// Opportunity's Contract Duration - real months can't be negative or
// fractional.
const TB_DATE_FIELDS = [
  { key: 'estimatedInstallationDate', label: 'Estimated Installation Date', date: true, noPast: true },
  { key: 'estGoLiveDate', label: 'Est. Go Live', date: true, noPast: true },
  { key: 'testBedDuration', label: 'Test Bed Duration', number: true, integer: true, suffix: 'months' },
]
// Commercials tab (Round 5 Phase 6, 2026-08-17): Base Cost Data rate
// inputs, cost only - no price/margin field exists anywhere in this set,
// unlike Opportunity's own Commercials tab. integer: false (plain
// number, 2dp via server-side isValidNonNegativePercent) since these are
// dollar rates, not counts. warrantyPct genuinely is a percentage.
const TB_COST_FIELDS = [
  { key: 'ssUnitCost', label: 'SafeSight Unit Cost', number: true, cost: true },
  { key: 'aqUnitCost', label: 'Air Quality Unit Cost', number: true, cost: true },
  { key: 'hemirUnitCost', label: 'HEMIR Unit Cost', number: true, cost: true },
  { key: 'ssInstallCost', label: 'SafeSight Install Cost', number: true, cost: true },
  { key: 'aqInstallCost', label: 'Air Quality Install Cost', number: true, cost: true },
  { key: 'hemirInstallCost', label: 'HEMIR Install Cost', number: true, cost: true },
  { key: 'ssHostingCost', label: 'SafeSight Hosting Cost', number: true, cost: true },
  { key: 'aqHostingCost', label: 'Air Quality Hosting Cost', number: true, cost: true },
  { key: 'hemirHostingCost', label: 'HEMIR Hosting Cost', number: true, cost: true },
  // warrantyPct removed (Round 7 Phase 8): a Test Bed carries no customer
  // warranty commitment, so the input is not relevant. Removed from
  // TEST_BED_WRITABLE_KEYS server-side in the same change, so a direct
  // PATCH naming it is rejected rather than silently accepted with no UI.
]
// Round 11 Phase 5: `installer` and `techTeam` REMOVED from this array. They
// were free-text payload keys and are now real links - installer_account_id,
// a column, and a record_contacts row with role 'Test Bed Tech Team' - each
// with its own endpoint and its own validation. Leaving them here would have
// rendered a second, editable free-text copy of the same concept beside the
// real control, which is the duplicate-Summary shape from Round 10 Phase 2.
// Both keys are also removed from TEST_BED_WRITABLE_KEYS server-side, so a
// PATCH naming either is now rejected rather than writing dead data.
//
// The array is left in place because Install Notes still belongs to this
// panel; it is empty of field rows and renderTbInstallSection reflects that.
const TB_INSTALL_FIELDS = []
// Round 17A Phase 6: the live cost preview.
//
// THE BROWSER ADDS UP NOTHING. These are the keys the server's cost engine
// reads, sent as drafts to POST /api/test-beds/calculate, and whatever comes
// back is rendered. buildTestBedCostBreakdown is the single mapping point for
// a saved record too, so a preview and a save cannot disagree: it is the same
// function over the same values, not two implementations that match today.
//
// The list is duplicated in that route's body schema on purpose - one is the
// contract, one is the caller - and scripts/tests/cost-preview.test.mjs parses
// both files and asserts they are identical. Fastify strips body keys the
// schema does not name, silently, so a key misspelled here would not error: it
// would compute as zero and show a confident wrong total. That is Architecture
// rule 9's shape, and the assertion is what makes it loud.
const TB_COST_INPUT_KEYS = [
  'safesightCameras', 'airQualitySensors', 'hemirSensors',
  'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
  'ssInstallCost', 'aqInstallCost', 'hemirInstallCost',
  'ssHostingCost', 'aqHostingCost', 'hemirHostingCost',
  'testBedDuration',
]

// Non-null while the figures on screen come from unsaved drafts. Cleared the
// moment nothing that feeds the cost is dirty any more.
let tbCostPreview = null
let tbCostPreviewTimer = null

function tbCostFieldsDirty() {
  return TB_COST_INPUT_KEYS.some(k => tbEdits[k] && tbEdits[k].draft !== tbEdits[k].orig)
}

// THE TRIGGER: debounced on input, 400ms after the last keystroke, and
// immediately on a discard.
//
// Not per keystroke, which would be a round trip per character in a field
// where four digits is normal, and a different defect from the one being
// fixed. Not on blur either, though that was the other candidate: the
// complaint is that the summary reads zero WHILE values sit on screen, and a
// blur trigger leaves it stale for exactly as long as the user is looking at
// the number they just typed. 400ms is long enough that ordinary typing
// produces one call per field rather than one per digit, and short enough
// that the figure has settled before attention moves.
function scheduleTbCostPreview() {
  clearTimeout(tbCostPreviewTimer)
  tbCostPreviewTimer = setTimeout(runTbCostPreview, 400)
}

async function runTbCostPreview() {
  if (!tbCostFieldsDirty()) {
    // Back to the stored values, so the stored breakdown is the truth again.
    tbCostPreview = null
    renderTbCostBreakdown()
    return
  }
  const body = {}
  for (const k of TB_COST_INPUT_KEYS) body[k] = tbEffectiveValue(k)
  const result = await api('POST', '/api/test-beds/calculate', body)
  // A failed preview must not leave a wrong number on screen wearing the
  // unsaved marker. Fall back to the stored breakdown, which is at least true
  // about something.
  tbCostPreview = result.ok ? result.data : null
  renderTbCostBreakdown()
}

// Round 17A Phase 4. The value a field currently HAS from the user's point of
// view: the open draft if one exists, otherwise what is stored. A bound
// computed from tbPayload alone describes the last save rather than the
// screen, which is exactly how the date bound went stale.
function tbEffectiveValue(key) {
  return tbEdits[key]?.draft || tbPayload?.[key] || ''
}

// Recomputes the native min/max on BOTH date inputs from their effective
// values. The inputs are rendered once and then only shown and hidden, so the
// attributes have to be updated in place: re-rendering the row would throw
// away an open edit.
function refreshTbDateBounds() {
  const today = new Date().toISOString().slice(0, 10)
  const install = tbEffectiveValue('estimatedInstallationDate')
  const goLive = tbEffectiveValue('estGoLiveDate')

  const goLiveInput = document.getElementById('tb-input-estGoLiveDate')
  if (goLiveInput) {
    const floor = install && install > today ? install : today
    goLiveInput.min = floor
  }
  const installInput = document.getElementById('tb-input-estimatedInstallationDate')
  if (installInput) {
    installInput.min = today
    if (goLive) installInput.max = goLive
    else installInput.removeAttribute('max')
  }
}

const TB_ALL_EDITABLE_FIELDS = [TB_NAME_FIELD, ...TB_TERMINUS_FIELDS, ...TB_CUSTOMER_FIELDS, ...TB_SITE_FIELDS, ...TB_SENSOR_COUNT_FIELDS, ...TB_DATE_FIELDS, ...TB_INSTALL_FIELDS, ...TB_COST_FIELDS, TB_SUMMARY_FIELD]

// These strings are NOT labels. Each is a real role value written to
// record_contacts, validated by VALID_CLIENT_BUYER_ROLES in test-beds.js,
// and named by three live `contact_role_linked` gate rules on the
// Qualification exit. Renaming any of them would break those gates.
// Round 10 Phase 3.1 shortens what is DISPLAYED and leaves the values
// alone - the exact distinction the standing display-rename rule exists
// for, and the reason the shortened text lives in its own map.
const CLIENT_BUYER_ROLES = ['Client Commercial Buyer', 'Client Technical Buyer', 'Client Legal Buyer']
const CLIENT_BUYER_ROLE_LABELS = {
  'Client Commercial Buyer': 'Comm. Buyer',
  'Client Technical Buyer': 'Tech. Buyer',
  'Client Legal Buyer': 'Legal Buyer',
}


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
  } else if (opts.date) {
    // Native <input type="date"> (2026-08-15 fix): forces a genuinely
    // valid date at the browser level, the same discipline as opts.number
    // below already gave the numeric fields. Only ever renders correctly
    // pre-filled when the stored value is already ISO YYYY-MM-DD - older
    // free-text-entered dates (e.g. "12/11/26") won't populate the picker
    // until re-saved through it, a known, disclosed consequence of this
    // fix, not silent data loss, the raw string is untouched until then.
    // noPast (Round 5 Phase 4): a native min attribute, same "browser-
    // level constraint, not just server-side rejection after the fact"
    // discipline as the date type itself, mirroring opportunity-
    // reference.js's refFieldRow exactly.
    const today = new Date().toISOString().slice(0, 10)
    // Round 15 Phase 1: the cross-field bound, expressed as native min/max
    // rather than as a second validation mechanism. This is the same
    // browser-level-plus-server split noPast already uses: the browser stops
    // most of it at the point of choosing, and src/routes/test-beds.js rejects
    // it independently for any caller.
    //
    // Est. Go Live cannot be earlier than the installation date, so its floor
    // is the LATER of today and that date. The installation date cannot be
    // later than an existing go-live date, which is the same rule approached
    // from the other end and is the case a one-sided bound would miss.
    //
    // Round 17A Phase 4: both read the EFFECTIVE value, which is the open
    // draft if there is one and the stored value otherwise.
    //
    // They used to read tbPayload alone, and the comment that stood here said
    // so plainly: a user editing both dates in one batch got no client bound
    // for the pair. That is the defect the business reported as "the calendar
    // allows a go-live before the installation date". The bound was not wrong,
    // it was STALE: written into the input once at render and never revisited
    // when the other date moved in the same session.
    //
    // The server half is unchanged and was confirmed still refusing in all
    // three directions before this was touched, so no invalid pair could ever
    // reach the database. This is an affordance, and it is now an accurate
    // one: the picker stops offering dates the save will refuse.
    const otherInstall = tbEffectiveValue('estimatedInstallationDate')
    const otherGoLive = tbEffectiveValue('estGoLiveDate')
    let floor = opts.noPast ? today : ''
    let ceiling = ''
    if (key === 'estGoLiveDate' && otherInstall) {
      floor = floor && floor > otherInstall ? floor : otherInstall
    }
    if (key === 'estimatedInstallationDate' && otherGoLive) {
      ceiling = otherGoLive
    }
    const min = floor ? ` min="${floor}"` : ''
    const max = ceiling ? ` max="${ceiling}"` : ''
    inputTag = `<input type="date" id="tb-input-${key}" value="${escHtml(v)}"${min}${max}>`
  } else if (opts.number) {
    // Round 5 Phase 4 gave integer fields min=0/step=1 as the
    // native-constraint half of a browser-plus-server split, with
    // .no-spinner hiding the arrows. All three are gone with type="number",
    // which is what provided them and is also what let the arrow keys
    // change a value without anyone typing.
    //
    // The server half is untouched. tbValidateNumeric already rejected
    // negative and fractional entry and now genuinely runs: the browser
    // used to make those two branches unreachable from the UI.
    //
    // inputmode keeps the numeric keypad on mobile. "numeric" is digits
    // only; a cost rate carries real decimal precision and needs "decimal",
    // or iOS offers no decimal separator and the value cannot be typed.
    const mode = opts.integer ? 'numeric' : 'decimal'
    inputTag = `<input type="text" inputmode="${mode}" id="tb-input-${key}" value="${escHtml(v)}">` +
      (opts.suffix ? `<span class="field-suffix">${escHtml(opts.suffix)}</span>` : '')
  } else {
    inputTag = `<input type="text" id="tb-input-${key}" value="${escHtml(v)}">`
  }
  const display = opts.number && v !== ''
    ? (opts.cost ? formatCost(v) : String(v) + (opts.suffix ? ` ${opts.suffix}` : ''))
    : (escHtml(v) || '--')
  // tabindex + keydown (2026-08-15 fix): confirmed nowhere in this app
  // uses tabindex at all - .ref-field-display was never in the tab
  // order, only its own <input>/<select> was, once opened. With every
  // OTHER closed field also unreachable by keyboard, Tab from one open
  // field skipped straight past the rest of this tab to whatever
  // visible, natively-focusable element came next in the DOM (a bare
  // <div onclick> isn't natively tabbable) - confirmed as the actual
  // cause of "Tab from Terminus Lead jumps to Convert to Opportunity".
  // Same fix applied to the discard control for full keyboard parity.
  return `
  <div class="ref-field" data-key="${key}">
    <div class="ref-field-label"><span>${label}</span></div>
    <div class="ref-field-display" id="tb-display-${key}" tabindex="0" onclick="openTbField('${key}',true)" onkeydown="fieldDisplayKeydown(event,c=>openTbField('${key}',true,c))">${display}</div>
    <div class="ref-field-edit hidden" id="tb-edit-${key}">
      ${inputTag}
      <span class="ref-field-discard" tabindex="0" onclick="discardTbField('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();discardTbField('${key}')}">&times;</span>
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

// 3-panel rebuild (2026-08-16, Phase 7): Terminus Details / Customer
// Details / Key Dates, matching Opportunity's Reference tab layout
// exactly (opportunity-reference.js's renderReferenceTab, same
// tbReadonlyRow/tbFieldRow shared shape as before). Terminus Reference
// listed first in the Terminus Details panel, matching the prototype's
// own referenceRows order (Terminus Ops.dc.html:744).
function renderTbReference() {
  document.getElementById('tb-terminus-rows').innerHTML =
    // Name first: it is the record's own identity, and it is the value the
    // page header renders. Terminus Reference stays immediately beneath it.
    tbFieldRow(TB_NAME_FIELD.key, TB_NAME_FIELD.label, tbPayload[TB_NAME_FIELD.key], {})
    + tbReadonlyRow('Terminus Reference', tbBed.reference_code)
    + TB_TERMINUS_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key], { options: f.staffField ? terminusStaffCache.map(s => s.name) : f.options })).join('')
    + tbReadonlyRow('Industry', tbBed.industry?.name)
    + tbReadonlyRow('Stage', tbBed.status)

  // Account is read-only display only (tbBed.account?.name) - Test Bed
  // has no Link-to-Account UI, unlike Contact/Opportunity, and this
  // phase doesn't add one.
  document.getElementById('tb-customer-rows').innerHTML =
    tbReadonlyRow('Account', tbBed.account?.name)
    + TB_CUSTOMER_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key])).join('')

  // Client Buyers: relocated here from Site Details' now-removed
  // Contacts card (2026-08-16) - same renderTbBuyerRows() mechanism
  // (record_contacts-backed, dropdown of the linked Account's real
  // Contacts), just called from the Reference tab now, not Site Details.
  renderTbBuyerRows()

  document.getElementById('tb-display-summary').textContent = tbPayload.summary || 'No summary captured yet.'
  document.getElementById('tb-input-summary').value = tbPayload.summary ?? ''
  document.getElementById('tb-edit-summary').classList.add('hidden')
  document.getElementById('tb-display-summary').classList.remove('hidden')

  // Round 6 Phase 3 (2026-08-17): repositioned to sit with Summary,
  // no longer its own separate .ref-cards grid panel - same render
  // function, unchanged, just called from here now instead of
  // renderTbSiteDetails.
  // Round 16 Phase 2: the sub-tab strip is mounted BEFORE the three content
  // renders below, because mounting moves their container blocks into panes
  // and a render into a detached node would paint nothing visible.
  mountTbReferenceSubTabs()

  renderTbUseCases()

  // Round 12 Phase 2: renderTbScores() no longer runs here. The panel lives on
  // the stage tabs and is driven by renderTbStageScoring, from that tab's own
  // gate rules. What Reference keeps is the read-only summary below.
  renderTbScoreSummary()

  renderTbCustomerDocuments()

  renderTbNotes()

  // Key Dates. Round 7 Phase 5: Age relocates here from the removed header
  // strip. It needs no storage - it is `today` minus `created_at` computed
  // at display time, exactly as DESIGN_PRINCIPLES.md Section 2 already
  // states for Opportunity age - so it reuses the existing daysAgo()
  // helper rather than a second date-difference function.
  //
  // tbReadonlyRow, NOT tbFieldRow, deliberately. Every other row in this
  // panel is click-to-edit, so the default path would render a computed
  // value that looks editable, and clicking it would open an input backed
  // by no payload key. Same read-only treatment already used one line
  // above for Date Created, which is the identical case.
  document.getElementById('tb-dates-rows').innerHTML =
    tbReadonlyRow('Date Created', formatDate(tbBed.created_at))
    + tbReadonlyRow('Age', daysAgo(tbBed.created_at))
    + TB_DATE_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key], { date: f.date, noPast: f.noPast, number: f.number, integer: f.integer, suffix: f.suffix })).join('')
}

// Round 10 Phase 2 (2026-08-19): Notes moved here from the header and
// gained the two-most-recent default plus expansion to the genuine full
// history, per the brief's "retaining" requirement.
//
// A REAL DEFECT WAS FOUND WHILE MOVING IT, and is fixed here rather than
// carried across. The header version computed its default as
// `notes.slice(-2).reverse()`, which assumes the array is oldest-first.
// It is not: addTbNote() below PREPENDS (`[newNote, ...existing]`), so the
// array is newest-first and slice(-2) takes the two OLDEST notes. The
// header therefore showed the two oldest under the label "Latest notes",
// and "Show all" listed the whole history oldest-first. Demonstrated on a
// real record with three notes before this change: stored THIRD/SECOND/
// FIRST, header showed FIRST and SECOND. It had never been visible in
// production because no live Test Bed had more than one note.
//
// Ordering is now derived from the notes' own timestamps rather than from
// an assumption about array order, so a payload written by any future
// path sorts correctly regardless of which end it appends to.
let tbNotesExpanded = false

window.toggleTbNotes = function () {
  tbNotesExpanded = !tbNotesExpanded
  renderTbNotes()
}

function renderTbNotes() {
  const notes = Array.isArray(tbPayload.notes) ? tbPayload.notes : []
  const el = document.getElementById('tb-notes-list')
  const title = document.getElementById('tb-notes-title')
  if (!notes.length) {
    if (title) title.textContent = 'Notes'
    el.innerHTML = '<p class="empty-state">No notes yet.</p>'
    return
  }

  const byNewest = [...notes].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
  const shown = tbNotesExpanded ? byNewest : byNewest.slice(0, 2)
  if (title) title.textContent = tbNotesExpanded || notes.length <= 2 ? 'Notes' : 'Latest notes'

  // Rule 10: timestamp, then author, then text, via the shared
  // .ref-notes-row markup - unchanged, not a bottom-of-page variant.
  const rows = shown.map(n => `
    <div class="ref-notes-row">
      <span class="ref-notes-when">${formatDate(n.at)}</span><span class="ref-notes-author">${escHtml(n.by ?? '')}</span><span class="ref-notes-text">${escHtml(n.text)}</span>
    </div>`).join('')

  const toggle = notes.length > 2
    ? `<button class="btn-text tb-header-notes-toggle" id="tb-notes-toggle" onclick="toggleTbNotes()">${
        tbNotesExpanded ? 'Show fewer' : `Show all ${notes.length} notes`}</button>`
    : ''

  el.innerHTML = rows + toggle
}

window.addTbNote = async function () {
  const input = document.getElementById('tb-note-input')
  const text = input.value.trim()
  if (!text) return
  const existing = Array.isArray(tbPayload.notes) ? tbPayload.notes : []
  const notes = [{ text, at: new Date().toISOString(), by: currentSession?.user?.email ?? '' }, ...existing]
  const result = await api('PATCH', `/api/test-beds/${tbDetailId}`, { payload: { notes } })
  if (result.ok) {
    input.value = ''
    await loadTestBedDetail(tbDetailId)
  }
}

// Round 5 Phase 5 (2026-08-17): folded onto the Reference tab's own
// .ref-cards row (index.html), no longer a separate Site Details tab -
// same underlying field/render logic, just relocated, confirmed nothing
// here needed to change beyond that. estCostPerUnit/indicativeCost
// deliberately dropped from this panel, per this round's own confirmed
// plan: Phase 6 replaces them with real, itemized calculated totals from
// the shared cost engine, not separate, manually-implied numbers - kept
// as writable payload keys server-side (TEST_BED_WRITABLE_KEYS,
// test-beds.js) since Phase 6 is the very next phase in this round, not
// dropped from the schema, just no longer rendered as a plain typed
// field here ahead of their real replacement landing.
// Round 10 Phase 3 (2026-08-19): this used to hardcode each label and each
// opts object at the call site instead of reading TB_SITE_FIELDS, so
// changing a field definition changed nothing on screen. Phase 3.1's
// "Inst. Env." rename and Phase 3.2's picklist were both applied to the
// definition and both silently had NO effect until this was found in the
// browser. Exactly the gap Round 5 Phase 4 recorded on TB_DATE_FIELDS,
// where the render call site "explicitly constructed its own opts object
// rather than spreading the field definition" and would have dropped
// noPast/integer. Same file, same shape, fixed the general way this time:
// the definitions are now the single source for label AND options.
// The four keys this panel actually renders, named explicitly. NOT the whole
// of TB_SITE_FIELDS: that array still carries estCostPerUnit and
// indicativeCost, which Round 5 Phase 6 made server-computed and removed
// from TEST_BED_WRITABLE_KEYS, so rendering them here would put two
// editable fields on screen whose every save the server rejects. The array
// stays their home because it is still the batched-save field list.
const TB_SITE_PANEL_KEYS = ['siteOwnership', 'installationEnvironment', 'siteAddress', 'city']

// Round 16 Phase 2. Mounted once per RECORD, not once per render.
//
// renderTestBedDetail runs again after every save, and rebuilding the strip
// on each run would snap the open pane back to Use Cases while someone was
// working in Customer Documents. Keyed on the record id so it still resets
// between records, which is the persistence decision Phase 1 recorded: which
// pane is open is a position inside one record's content, not a preference
// that should follow the user to a record whose third pane is empty.
function mountTbReferenceSubTabs() {
  const mount = document.getElementById('tb-ref-subtabs')
  if (!mount) return
  if (mount.dataset.builtFor === String(tbDetailId)) return
  window.createSubTabs({
    mount,
    label: 'Reference detail',
    tabs: [
      { key: 'useCases', label: 'Use cases' },
      { key: 'customerDocuments', label: 'Customer documents' },
      { key: 'history', label: 'History' },
    ],
    adopt: {
      useCases: 'tb-usecases-block',
      customerDocuments: 'tb-custdocs-block',
      history: 'tb-history-block',
    },
    // Round 18 Phase 4: loaded when its tab is opened, not on every record
    // load. Uses the onSelect hook Phase 2 added to this same component, which
    // is what makes a lazy pane possible at all: before it, nothing outside
    // the strip could learn that the open tab had changed.
    onSelect: key => { if (key === 'history') renderTbHistory() },
  })
  mount.dataset.builtFor = String(tbDetailId)
}

// Round 18 Phase 4: the history pane. Deferred eight times, shipped raw.
//
// WHAT IT IS: this record's own audit_log entries, newest first, exactly as
// stored. Actions render as whatever the column carries and actors as the uuid
// that identifies them, because deciding what each action should SAY to a
// person is the expensive judgement and it is better made looking at real
// entries than guessed at beforehand.
//
// OBVIOUSLY PROVISIONAL, and the mechanism is wording rather than colour.
// Open item 37 records that this palette has one accent and it is already
// every card title, so there is nothing to signal "unfinished" with. The line
// at the top says so in words instead, and says which decisions are still
// open rather than merely apologising.
//
// READ-ONLY, STRUCTURALLY. Every cell is a span inside a table. There is no
// button, no input, no link, no contenteditable and no tabindex anywhere in
// what this writes, and audit_log itself has no UPDATE or DELETE policy, so
// there is nothing to write to even if something tried.
async function renderTbHistory() {
  const host = document.getElementById('tb-history-block')
  if (!host || !tbDetailId) return
  host.innerHTML = '<p class="sub">Loading history.</p>'

  const result = await api('GET', `/api/records/${tbDetailId}/history`)
  if (!result.ok) {
    host.innerHTML = '<p class="empty-state">Unable to load history.</p>'
    return
  }
  const entries = result.data?.entries ?? []
  const notice = `<p class="sub" style="margin-bottom:12px">Raw audit entries, unedited. What each action should say, how entries should be grouped, and which of them belong here at all are not decided yet.</p>`
  if (!entries.length) {
    host.innerHTML = notice + '<p class="empty-state">No history recorded for this record.</p>'
    return
  }
  const cell = v => `<span>${escHtml(v)}</span>`
  const rows = entries.map(e => `
    <tr>
      <td>${cell(String(e.timestamp ?? '').slice(0, 16).replace('T', ' '))}</td>
      <td>${cell(e.action ?? '')}</td>
      <td>${cell(String(e.actor_id ?? '').slice(0, 8))}</td>
      <td class="tb-history-detail">${cell(e.detail && Object.keys(e.detail).length ? JSON.stringify(e.detail) : '')}</td>
    </tr>`).join('')
  host.innerHTML = notice + `
    <p class="sub" style="margin-bottom:10px">${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.</p>
    <table class="tb-units-table tb-history-table">
      <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

function renderTbSiteDetails() {
  // Round 16 Phase 3: these four now render INSIDE the Customer Details card.
  // The keys moved out of a panel, not out of TB_SITE_FIELDS: that array also
  // holds estCostPerUnit and indicativeCost, which have no rendered input at
  // all, and TB_ALL_EDITABLE_FIELDS spreads it, so it is still the home of the
  // batched-save field list, the label lookup and the input wiring. Deleting
  // it to remove the panel would have taken those two definitions and the
  // save path with it.
  document.getElementById('tb-site-rows').innerHTML = TB_SITE_PANEL_KEYS.map(key => {
    const f = TB_SITE_FIELDS.find(x => x.key === key)
    return tbFieldRow(f.key, f.label, tbPayload[f.key], { options: f.options })
  }).join('')

  // No Sensors render here. Round 16 Phase 2 moved that block into a sub-tab
  // pane and Round 17 Phase 2 removed it outright, real unit records having
  // replaced the generated strings.
}

// Round 6 Phase 3 (2026-08-17): Installer/Test Bed Tech Team/Install
// Notes, relocated from Site Details to the Installation and
// Commissioning stage tab specifically. Rendered once here, same as
// every other Reference-adjacent field, into the (initially hidden)
// #tb-stage-install-section - loadTbStageDetailTab (app.js) only
// toggles that section's visibility per stage, it never re-renders
// these fields, so there's no risk of losing an in-progress edit by
// switching to a different stage tab and back, the same "rendered once,
// shown/hidden, not torn down and rebuilt" pattern the Reference/
// Commercials tabs themselves already use.
function renderTbInstallSection() {
  document.getElementById('tb-install-rows').innerHTML =
    TB_INSTALL_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key])).join('')
  renderTbInstallerRow()
  renderTbTechTeamRow()
  renderTbInstallNotes()
}

let tbInstallerSearching = false
let tbInstallerContacts = []

// Customer Documents, Round 11 Phase 6 (2026-08-19). Client-supplied
// reference material, distinguished from Terminus's own stage documents by
// records.document_kind rather than by having a name no gate rule mentions.
//
// Rendered from the row id, never from the name: two client files genuinely
// called "Site drawings" are two documents, so nothing here keys by variant.
let tbCustomerDocs = []

function tbCustDocFeedback(text, kind) {
  const el = document.getElementById('tb-custdocs-feedback')
  if (!el) return
  el.textContent = text ?? ''
  el.className = text ? `tb-doc-feedback${kind ? ' ' + kind : ''}` : 'tb-doc-feedback'
}

async function renderTbCustomerDocuments() {
  const el = document.getElementById('tb-custdocs-list')
  if (!el) return
  const result = await api('GET', `/api/test-beds/${tbDetailId}/customer-documents`)
  tbCustomerDocs = result.ok ? (result.data ?? []) : []

  if (!tbCustomerDocs.length) {
    el.innerHTML = '<p class="empty-state">No client documents yet.</p>'
    return
  }
  el.innerHTML = tbCustomerDocs.map(d => `
    <div class="tb-custdoc-row" data-doc-id="${escHtml(d.id)}">
      <div style="flex:1;min-width:0">
        <div class="tb-custdoc-name">${escHtml(d.name)}</div>
        <a class="tb-custdoc-url" href="${escHtml(d.url ?? '')}" target="_blank" rel="noopener noreferrer">${escHtml(d.url ?? '')}</a>
      </div>
      <button class="btn-text" onclick="removeTbCustomerDocument('${escHtml(d.id)}')">Remove</button>
    </div>`).join('')
}

window.addTbCustomerDocument = async function () {
  const nameEl = document.getElementById('tb-custdoc-name')
  const urlEl = document.getElementById('tb-custdoc-url')
  const name = nameEl.value.trim()
  const url = urlEl.value.trim()
  tbCustDocFeedback('')
  if (!name || !url) {
    tbCustDocFeedback('A name and a link are both required.', 'err')
    return
  }
  const result = await api('POST', `/api/test-beds/${tbDetailId}/customer-documents`, { name, url })
  if (!result.ok) {
    tbCustDocFeedback(result.data?.error ?? 'Could not add the document.', 'err')
    return
  }
  nameEl.value = ''
  urlEl.value = ''
  await renderTbCustomerDocuments()
}

window.removeTbCustomerDocument = async function (docId) {
  tbCustDocFeedback('')
  const result = await api('DELETE', `/api/test-beds/${tbDetailId}/customer-documents/${docId}`)
  if (!result.ok) {
    tbCustDocFeedback(result.data?.error ?? 'Could not remove the document.', 'err')
    return
  }
  await renderTbCustomerDocuments()
}

function tbInstallerFeedback(text, kind) {
  const el = document.getElementById('tb-installer-feedback')
  if (!el) return
  el.textContent = text ?? ''
  el.className = text ? `tb-doc-feedback${kind ? ' ' + kind : ''}` : 'tb-doc-feedback'
}

// INSTALLER: a link to an Account, so it renders as the same search-and-link
// shape Account detail's own Parent Account row uses, not as a picklist.
// Client-installed versus contractor-installed is shown as a derived fact
// rather than a stored label, because that is exactly what it is.
function renderTbInstallerRow() {
  const el = document.getElementById('tb-installer-row')
  if (!el) return
  const current = tbBed.installer

  if (current && !tbInstallerSearching) {
    el.innerHTML = `
    <div class="ref-field" data-key="installer">
      <div class="ref-field-label"><span>Installer</span></div>
      <div style="flex:1;min-width:0">
        <div class="ref-field-display readonly">${escHtml(current.name ?? '--')}</div>
        <p class="sub" style="margin-top:2px">${current.client_installed
          ? 'Client installs with their own staff'
          : 'Installed by a contractor'}</p>
        <button class="btn-sm" style="margin-top:6px" onclick="openTbInstallerSearch()">Change installer</button>
      </div>
    </div>`
    return
  }

  const matches = accountsCache
  el.innerHTML = `
    <div class="ref-field" data-key="installer">
      <div class="ref-field-label"><span>Installer</span></div>
      <div style="flex:1;min-width:0">
        <input type="text" id="tb-installer-search" placeholder="Search Accounts"
               oninput="renderTbInstallerResults(this.value)">
        <div id="tb-installer-results" class="tb-installer-results"></div>
        ${current ? `<button class="btn-sm" style="margin-top:6px" onclick="closeTbInstallerSearch()">Cancel</button>` : ''}
      </div>
    </div>`
  renderTbInstallerResults('')
}

window.openTbInstallerSearch = function () { tbInstallerSearching = true; renderTbInstallerRow() }
window.closeTbInstallerSearch = function () { tbInstallerSearching = false; renderTbInstallerRow() }

window.renderTbInstallerResults = function (term) {
  const el = document.getElementById('tb-installer-results')
  if (!el) return
  const t = String(term ?? '').trim().toLowerCase()
  // Same case-insensitive substring match every other Account search in this
  // app uses, over the already-fetched accountsCache - no new endpoint.
  const matches = accountsCache.filter(a => !t || String(a.payload?.name ?? '').toLowerCase().includes(t)).slice(0, 8)
  el.innerHTML = matches.length
    ? matches.map(a => `<div class="tb-installer-result" data-account-id="${a.id}" onclick="setTbInstaller(this.dataset.accountId)">${escHtml(a.payload?.name ?? '--')}${
        a.id === tbBed.account_id ? ' <span class="sub">(this Test Bed\'s own Account)</span>' : ''
      }</div>`).join('')
    : '<p class="empty-state" style="padding:8px 10px">No matches.</p>'
}

window.setTbInstaller = async function (accountId) {
  tbInstallerFeedback('')
  const result = await api('PATCH', `/api/test-beds/${tbDetailId}/installer`, { installer_account_id: accountId })
  if (!result.ok) {
    tbInstallerFeedback(result.data?.error ?? 'Could not set the Installer.', 'err')
    return
  }
  tbInstallerSearching = false
  // THE USER SEES THE TECH TEAM BEING CLEARED rather than discovering it.
  // Changing the Installer invalidates a Tech Team from the previous
  // Account, and the server reports which link it removed. Saying nothing
  // would leave a gate that was satisfied a moment ago silently blocking
  // again, with the row simply empty and no reason on screen.
  if (result.data?.cleared_tech_team) {
    tbInstallerFeedback('Installer changed. The previous Test Bed Tech Team belonged to the old Installer\'s Account and has been cleared, so choose a new one.', 'err')
  } else {
    tbInstallerFeedback('Installer set.')
  }
  await loadTestBedDetail(tbDetailId)
}

// TECH TEAM: a single Contact from the INSTALLER's Account, which is a
// different Account from the record's own. renderTbBuyerRows cannot be
// reused for this - it reads tbBed.account_id from module state and the
// endpoint behind it returns 422 for any Contact outside that Account.
async function renderTbTechTeamRow() {
  const el = document.getElementById('tb-techteam-row')
  if (!el) return
  const linked = (tbBed.buyer_contacts ?? []).find(c => c.role === 'Test Bed Tech Team')
  const installer = tbBed.installer

  // NO INSTALLER: say why, and render no control at all. The server already
  // refuses this order with a 422; an empty select here would look available
  // and produce that refusal only after the user had tried.
  if (!installer) {
    el.innerHTML = `
    <div class="ref-field" data-key="techTeam">
      <div class="ref-field-label"><span>Tech Team</span></div>
      <div style="flex:1;min-width:0">
        <p class="empty-state" style="text-align:left;padding:8px 0">Set the Installer first. The Tech Team is a person from the Installer's Account.</p>
      </div>
    </div>`
    return
  }

  if (linked) {
    el.innerHTML = `
    <div class="ref-field" data-key="techTeam">
      <div class="ref-field-label"><span>Tech Team</span></div>
      <div style="flex:1;min-width:0">
        <div class="ref-field-display readonly">${escHtml(linked.name ?? linked.contact_id)}</div>
        <p class="sub" style="margin-top:2px">From ${escHtml(installer.name ?? 'the Installer')}</p>
      </div>
    </div>`
    return
  }

  // Fetched with the Account as an explicit parameter. GET /api/contacts took
  // no query parameters before this phase, so this is a new capability rather
  // than an existing one being used.
  const result = await api('GET', `/api/contacts?account_id=${installer.id}`)
  tbInstallerContacts = result.ok ? (result.data ?? []) : []

  const options = tbInstallerContacts
    .map(c => `<option value="${c.id}">${escHtml(c.payload?.name ?? c.id)}</option>`).join('')
  el.innerHTML = `
    <div class="ref-field" data-key="techTeam">
      <div class="ref-field-label"><span>Tech Team</span></div>
      <div style="flex:1;min-width:0">
        <select id="tb-techteam-select" onchange="setTbTechTeam(this.value)">
          <option value="">${tbInstallerContacts.length
            ? 'Select a contact' : `No Contacts at ${escHtml(installer.name ?? 'the Installer')} yet`}</option>
          ${options}
        </select>
        <p class="sub" style="margin-top:2px">From ${escHtml(installer.name ?? 'the Installer')}</p>
      </div>
    </div>`
}

window.setTbTechTeam = async function (contactId) {
  if (!contactId) return
  tbInstallerFeedback('')
  const result = await api('POST', `/api/test-beds/${tbDetailId}/tech-team`, { contact_id: contactId })
  if (!result.ok) {
    tbInstallerFeedback(result.data?.error ?? 'Could not set the Tech Team.', 'err')
    return
  }
  await loadTestBedDetail(tbDetailId)
}

// Round 6 Phase 3 (2026-08-17): sensor counts, moved from Site Details.
// Same tbFieldRow/tbEdits mechanism as every other field on this page,
// TB_SENSOR_COUNT_FIELDS is already folded into TB_ALL_EDITABLE_FIELDS
// so wireTbFieldInputs() wires these for free, no separate wiring
// needed.
// Round 17 Phase 4. Populated by one GET per detail load, in app.js, and read
// by both tabs. Never written from here.
let tbUnitCounts = {}
window.loadTbUnitCounts = async function (id) {
  const result = await api('GET', `/api/test-beds/${id}/units`)
  tbUnitCounts = {}
  if (!result.ok) return
  for (const u of result.data ?? []) tbUnitCounts[u.type] = (tbUnitCounts[u.type] ?? 0) + 1
}

const COUNT_KEY_TO_UNIT_TYPE = {
  safesightCameras: 'SafeSight',
  airQualitySensors: 'Air Quality',
  hemirSensors: 'HEMIR',
}

// Derived from the map above rather than written out a second time: two
// literal maps of the same relationship are one edit away from disagreeing.
const COUNT_KEY_FOR_UNIT_TYPE = Object.fromEntries(
  Object.entries(COUNT_KEY_TO_UNIT_TYPE).map(([key, type]) => [type, key]))

// The locked count field is REPLACED by a line, not left present and inert.
//
// This is the fourth time this project has argued the same thing: Round 11
// Phase 5's Tech Team dropdown that could not be used until an Installer was
// set, Round 12 Phase 3's read-only scores card, Round 14 Phase 4's removed
// "Created. View it", and this. A control that is visible and refuses is a
// dead end the user keeps trying; a line naming what to do is a route.
//
// AND IT IS NOT A DEAD END HERE, which is the part worth getting right. Phase
// 3 built a real way through, so the line names it: the count is locked, this
// is why, and the correction lives on the Installation and Commissioning tab
// with the units it is about. A notice that said only "locked" would be the
// dead end this pattern exists to avoid.
//
// Nothing in it is operable: no input, no button, no handler, no tabindex.
// Asserted structurally rather than by eye, because "looks read-only" and "is
// read-only" are different claims.
//
// The wording is deliberately tight. The first version repeated the unit type
// and added "where the units are", and in a 420px card that wrapped to six
// lines and made each row three times its normal height, so three locked
// counts turned a 130px card into 480px. The row label already names the
// type, so the notice does not: it carries the number, the reason and the
// destination, and nothing else. Every check passed on the long version;
// only the screenshot showed it.
function tbLockedCountRow(f, deployed) {
  return `
    <div class="ref-field tb-count-locked">
      <span class="ref-field-label">${escHtml(f.label)}</span>
      <span class="tb-count-locked-value">
        <span class="tb-count-locked-number">${escHtml(String(tbPayload[f.key] ?? ''))}</span>
        <span class="tb-count-locked-note">Locked: ${deployed} unit${deployed === 1 ? '' : 's'} exist. Correct it on the Installation and Commissioning tab.</span>
      </span>
    </div>`
}

function renderTbSensorCounts() {
  document.getElementById('tb-sensor-count-rows').innerHTML =
    TB_SENSOR_COUNT_FIELDS.map(f => {
      const deployed = tbUnitCounts[COUNT_KEY_TO_UNIT_TYPE[f.key]] ?? 0
      return deployed
        ? tbLockedCountRow(f, deployed)
        : tbFieldRow(f.key, f.label, tbPayload[f.key], { number: f.number, integer: f.integer })
    }).join('')
}

// Round 17 Phase 2 (2026-08-21): tbSensorList, renderTbSensors,
// toggleTbSensors and tbSensorsExpanded are REMOVED, roughly 60 lines.
//
// They produced the Sensors list by looping the three counts and emitting
// strings, "SafeSight Camera 1" through "SafeSight Camera 12", with a
// standing note that nothing linked a Test Bed to a real device. Real unit
// records now exist, each carrying a serial, coordinates and a state, so
// every string this generated would be a worse version of a record that
// exists. Deleted rather than left unreferenced: dead code that still reads
// as a feature is the thing a later round mistakes for one.

// Commercials tab (Round 5 Phase 6, 2026-08-17). Rate inputs use the
// same tbFieldRow/click-to-edit mechanism as every other Test Bed field
// (TB_COST_FIELDS is folded into TB_ALL_EDITABLE_FIELDS, so
// wireTbFieldInputs() already wires these for free, no separate wiring
// needed). The itemized breakdown below is read-only, sourced entirely
// from tbBed.costBreakdown (GET /test-beds/:id, server-computed via
// calculateTestBedCost - test-beds.js) - reads only *Cost/rawCost/
// rawTotalCost fields, never rawPrice/rawTotalPrice, which
// buildCostGroup() still computes internally as an unavoidable side
// effect of being shared with the priced Opportunity path but this
// function never touches.
function renderTbCommercials() {
  renderTbSensorCounts()

  const fieldRow = (key) => {
    const f = TB_COST_FIELDS.find(x => x.key === key)
    return tbFieldRow(key, f.label, tbPayload[key], { number: f.number, cost: f.cost, suffix: f.suffix })
  }

  document.getElementById('tb-cost-hardware-rows').innerHTML =
    fieldRow('ssUnitCost') + fieldRow('aqUnitCost') + fieldRow('hemirUnitCost')
  document.getElementById('tb-cost-install-rows').innerHTML =
    fieldRow('ssInstallCost') + fieldRow('aqInstallCost') + fieldRow('hemirInstallCost')
  document.getElementById('tb-cost-hosting-rows').innerHTML =
    fieldRow('ssHostingCost') + fieldRow('aqHostingCost') + fieldRow('hemirHostingCost')
  // Round 7 Phase 8: the Warranty input panel is gone.

  renderTbCostBreakdown()
}

function renderTbCostBreakdown() {
  const el = document.getElementById('tb-cost-breakdown')
  // Round 17A Phase 6: the preview, when there is one, otherwise what was
  // saved. Both come from the same server function, so this is a choice of
  // INPUTS, not of arithmetic.
  const b = tbCostPreview ?? tbBed.costBreakdown
  const unsaved = !!tbCostPreview
  if (!b) {
    el.innerHTML = '<p class="empty-state">Unable to load cost breakdown.</p>'
    return
  }

  const g = b.groups
  const rowCost = (group, key) => group.rows.find(r => r.key === key)?.rawCost ?? 0
  // The itemized labels quote their own inputs, so while a preview is showing
  // they must quote the DRAFT inputs. Otherwise a card would read
  // "SafeSight (12 x USD 4,200.00)" beside a figure computed from 14, which is
  // a row that contradicts itself.
  const inp = key => (unsaved ? tbEffectiveValue(key) : tbPayload[key]) || 0
  const line = (label, cost) => `
    <div class="data-row">
      <span style="font-size:13px">${escHtml(label)}</span>
      <span class="data-row-label">${formatCost(cost)}</span>
    </div>`
  const subtotal = (label, cost) => `
    <div class="data-row" style="border-top:1px solid var(--hairline)">
      <span style="font-size:13px;color:var(--white)">${escHtml(label)}</span>
      <span style="font-size:13px;color:var(--white)">${formatCost(cost)}</span>
    </div>`

  // Round 8 Phase 3: the three sections sit side by side rather than
  // stacked, and Total Cost sits ABOVE them, directly under the heading.
  //
  // The defect this fixes is not the stacking itself, it is what the
  // stacking did to the one figure the tab exists to produce: measured
  // before the change, Total Cost sat at y=1788 / 1698 / 1464 against a
  // 1000px viewport at 1240 / 1920 / 3440, so the go/no-go number was
  // below the fold at every width while ~3000px of horizontal space sat
  // empty at 3440.
  //
  // Reuses .ref-cards with auto-fit, not a fixed three-column grid: it is
  // the established pattern everywhere else on this page, it already
  // carries the proven minmax(280px, 420px) cap under
  // #view-test-bed-detail, and it matches the brief's own "where space
  // allows" - three across when there is room, wrapping gracefully rather
  // than overflowing when there is not.
  //
  // The `Hosting x N months` term line is deliberately NOT inside the
  // Hosting card. It is a whole-engagement figure, not a per-month rate
  // like the three lines above it, and leaving it there made Hosting one
  // row taller than the other two for no reason a reader could see. It
  // stays with Total Cost as the step between monthly and total.
  //
  // Total ABOVE the detail, not beneath it, is a deliberate departure from
  // the conventional read. Side-by-side sections alone moved the total up
  // 377px but left it below the fold at 1920x1080 by 241px, because the
  // header, chevron, tab row and input-rate panels consume 907px before
  // this section starts. Putting the headline figure first is what
  // actually makes it visible without scrolling at 1920 and 3440. It does
  // NOT fix 1240x900, where the input panels alone already end past the
  // fold - see DESIGN_PRINCIPLES.md's page-density entry, which is a
  // whole-page problem and not solvable inside this panel.
  const section = (title, rows) => `
    <div class="pg-card">
      <p class="pg-card-title">${escHtml(title)}</p>
      ${rows}
    </div>`

  const warrantyLine = b.hardware.warrantyCost > 0
    ? line(`Warranty (${b.hardware.warrantyUnits} unit${b.hardware.warrantyUnits === 1 ? '' : 's'})`, rowCost(g.hardwareGroup, 'hwWarranty'))
    : ''

  // Round 15 Phase 4: a cost summary card, leftmost, so the totals read
  // before the breakdowns.
  //
  // NOTHING HERE IS COMPUTED. All three category figures are read straight
  // off the engine's own output: calculateTestBedCost already returns
  // hardwareGroup.rawTotalCost, installGroup.rawTotalCost and
  // hostingTermCost, and its own totalCost is the sum of exactly those
  // three. Re-adding the itemized lines here would be a second computation
  // path that agrees today and drifts later, which is the reason Round 9
  // made computeBlocking the single evaluator.
  //
  // The `Hosting x N months` line MOVES here from the total block above. It
  // is the Hosting category total, which is what this card is for, and it
  // was never a peer of Total Cost. It appears once: see the assertion on
  // the rendered instance count, not merely on its presence, after Round 10
  // Phase 2 moved Summary and shipped a duplicate.
  //
  // Round 17A Phase 5: TOTAL COST NOW LIVES IN THIS CARD, at the business's
  // request, and THE PARAGRAPH THAT STOOD HERE WAS RIGHT ABOUT THE COST.
  //
  // It said that pulling the total into the grid would push it back down
  // behind the rate panels. Measured at Round 15 Phase 4's own anchor, before
  // and after, that is exactly what happens. The merge cannot be done for
  // free, and the price depends entirely on where in the card the total sits:
  //
  //   1240x800   below the fold   290px  ->  335px  (total first)
  //                                      ->  475px  (total last)
  //   1920x950   below the fold    25px  ->   70px  (total first)
  //                                      ->  210px  (total last)
  //   3440x1440                   above the fold in every arrangement
  //
  // TOTAL FIRST, therefore, which is why this card's rows are ordered the way
  // they are and not in the conventional total-at-the-bottom form. Putting it
  // last costs 185px because the three category rows push it down; putting it
  // first costs 45px, and that 45px is precisely the card's own chrome:
  // 14px padding-top, a 26px title, 4px of title margin. A bare band has no
  // title, so no arrangement of a titled card can match it.
  //
  // What the business gains is one place to read the cost. What it costs is
  // 45px of fold at both widths, which is recorded rather than absorbed
  // silently, because the whole reason this figure sits where it does is a
  // carried item about it being below the fold.
  //
  // The total row's border-top and its 10px/10px of margin and padding go
  // with the moved line. They existed to divide two rows inside that block;
  // one row is left, so they were dividing Total Cost from the sub-heading
  // above it, which is not a division that means anything. Same reasoning as
  // the spinner CSS removed in Phase 3: a rule describing a state that can no
  // longer occur reads as intent and is just residue.
  //
  // Rendered at the weight of a subtotal, not of a line item. line() styles
  // its value with .data-row-label, which is the dimmed treatment for the
  // itemized rows a total is built from. Using it here made the three
  // category totals the least prominent figures on the tab, sitting beside
  // neighbouring cards whose own subtotals are full white, which is the
  // opposite of what a card called Cost summary is for. subtotal() carries
  // the right typography but also a border-top dividing it from the rows
  // above it, and in this card every row IS a total, so there is nothing to
  // divide it from.
  const summaryRow = (label, cost) => `
    <div class="data-row">
      <span style="font-size:13px;color:var(--white)">${escHtml(label)}</span>
      <span style="font-size:13px;color:var(--white)">${formatCost(cost)}</span>
    </div>`

  // The total is the one row in this card that IS a sum of the rows above it,
  // so unlike them it earns a divider, and it is the only figure on the tab
  // that should be read first. Round 15 Phase 4 shipped this card with its
  // totals in line()'s dimmed treatment, which made them the least prominent
  // numbers on screen; the lesson is that a summary row has to outweigh what
  // it summarises, so this outweighs the three rows above it in turn.
  const summaryTotalRow = (label, cost) => `
    <div class="data-row tb-cost-summary-total">
      <span>${escHtml(label)}</span>
      <span>${formatCost(cost)}</span>
    </div>`

  // Round 17A Phase 6: the card says so when its figures are a preview.
  //
  // A total the user cannot tell apart from a saved one makes the Save bar
  // advisory: they read the number, believe it is recorded, and move on. So
  // the marker sits in the card's own title, where the figures are, rather
  // than relying on the Save bar being noticed elsewhere on the page.
  //
  // Two words, deliberately. Round 17 Phase 4 put a full explanatory sentence
  // in a 420px card and it wrapped to six lines and tripled the row height;
  // the same card is 390px here. "Save to store them" is the instruction, and
  // the Save bar is already on screen saying it.
  const summaryTitle = unsaved
    ? `Cost summary <span class="tb-cost-unsaved">unsaved</span>`
    : escHtml('Cost summary')
  const summaryCard = `
    <div class="pg-card${unsaved ? ' tb-cost-card-unsaved' : ''}">
      <p class="pg-card-title">${summaryTitle}</p>
      ${[
        summaryTotalRow('Total Cost', b.totalCost),
        summaryRow('Hardware', g.hardwareGroup.rawTotalCost),
        summaryRow('Installation', g.installGroup.rawTotalCost),
        summaryRow(`Hosting x ${b.months} month${b.months === 1 ? '' : 's'}`, b.hostingTermCost),
      ].join('')}
    </div>`

  el.innerHTML = `
    <div class="ref-cards">
      ${summaryCard}

      ${section('Hardware', [
        line(`SafeSight (${inp('safesightCameras')} x ${formatCost(inp('ssUnitCost'))})`, rowCost(g.hardwareGroup, 'hwSs')),
        line(`Air Quality (${inp('airQualitySensors')} x ${formatCost(inp('aqUnitCost'))})`, rowCost(g.hardwareGroup, 'hwAqm')),
        line(`HEMIR (${inp('hemirSensors')} x ${formatCost(inp('hemirUnitCost'))})`, rowCost(g.hardwareGroup, 'hwHemir')),
        warrantyLine,
        subtotal('Hardware subtotal', g.hardwareGroup.rawTotalCost),
      ].join(''))}

      ${section('Installation', [
        line('SafeSight', rowCost(g.installGroup, 'inSs')),
        line('Air Quality', rowCost(g.installGroup, 'inAqm')),
        line('HEMIR', rowCost(g.installGroup, 'inHemir')),
        subtotal('Installation subtotal', g.installGroup.rawTotalCost),
      ].join(''))}

      ${section('Hosting (per month)', [
        line('SafeSight', rowCost(g.hostingGroup, 'hoSs')),
        line('Air Quality', rowCost(g.hostingGroup, 'hoAqm')),
        line('HEMIR', rowCost(g.hostingGroup, 'hoHemir')),
        subtotal('Hosting subtotal / month', b.hostingMonthCost),
      ].join(''))}
    </div>`
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
let tbScoringCriteria = []

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
        <div class="ref-field-label"><span>${escHtml(CLIENT_BUYER_ROLE_LABELS[role] ?? role)}</span></div>
        <div class="ref-field-display readonly">${escHtml(current.name ?? current.contact_id)}</div>
      </div>`
    }
    const options = tbAccountContacts.map(c => `<option value="${c.id}">${escHtml(c.payload?.name ?? c.id)}</option>`).join('')
    return `
    <div class="ref-field" data-key="buyer-${role}">
      <div class="ref-field-label"><span>${escHtml(CLIENT_BUYER_ROLE_LABELS[role] ?? role)}</span></div>
      <div class="tb-buyer-controls">
        <!-- Round 6 Phase 2 (2026-08-17): selecting a Contact saves
             directly, no separate "Link" confirm click - the standalone
             Link button (still present on Opportunity's own, unchanged,
             Buyer Role dropdown, out of this phase's scope) is removed
             here specifically. -->
        <select id="tb-buyer-select-${escHtml(role)}" onchange="linkTbBuyer('${escHtml(role)}')">
          <!-- "Select a contact", not "Select a contact linked to this
               Account". Measured: the long version needs ~268px to render
               without clipping and the narrowed card affords ~204px, so it
               was the single widest thing in the panel and it is a
               PLACEHOLDER, not data - real contact names are far shorter.
               Opportunity's identical control (opportunity-reference.js) is
               deliberately left alone: its panel is not narrowed, so it has
               no truncation to fix, and changing it would be an unrequested
               display change on a screen this phase does not cover. -->
          <option value="">${tbAccountContacts.length ? 'Select a contact' : 'No Contacts linked yet'}</option>
          ${options}
        </select>
        <!-- Round 5 Phase 9 (2026-08-17): the desired Contact may not
             exist yet at all - not just "not linked to this Account
             yet", genuinely doesn't exist as a Contact anywhere. Opens
             the shared inline-creation modal (app.js), same mechanism
             Opportunity's own Buyer Role dropdowns use. -->
        <button class="btn-sm btn-ghost" onclick="openInlineBuyerContactModal('test_bed', '${escHtml(tbDetailId)}', '${escHtml(tbBed.account_id)}', '${escHtml(role)}')">+ New</button>
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

// Exit Criteria (Round 5 Phase 5, 2026-08-17; generalized to a named
// stage, Round 6 Phase 3, 2026-08-17): a live list of what's still
// outstanding to exit a SPECIFIC stage, not necessarily the record's
// real current one - each of the 8 stage tabs now shows its own,
// called from loadTbStageDetailTab (app.js) with that tab's own
// stageName. Calls the read-only GET /records/:id/exit-criteria, now
// accepting an optional ?stage= override (defaults to the record's own
// current stage when omitted, reproducing the original behaviour for
// any caller that doesn't pass it), computed via transitions.js's own
// computeBlocking() - the exact same blocking[] a real transition
// attempt from that stage would return, not a second, separately-
// derived criteria list. Purely a read: never attempts the transition
// itself, so viewing this tab can never advance the stage as a side
// effect.
// isStillCurrent (Round 10 Phase 5A): required once the three stage-panel
// fetches run concurrently. This renderer previously had NO token guard and
// was safe only by running last; started alongside the others it can resolve
// after a newer tab's load and write the wrong stage into the panel. Same
// predicate and same shape as renderTestBedDocuments'.
// recordId (Round 10 Phase 5B): taken from the caller rather than read off
// this file's own tbDetailId, which is set by initTestBedDetailPanel AFTER
// renderTestBedDetail has already assigned currentTestBed and awaited two
// further network calls. Clicking a stage tab inside that window - the same
// real race tbUserPickedTab was added for in Round 5 Phase 7 - fetched
// /api/records/null/exit-criteria, 404'd, and left the panel reading
// "Unable to load exit criteria" until the user clicked away and back.
// The other two renderers never had this because they were already passed
// the record. Reproduced deliberately before fixing.
async function renderTbStageExitCriteria(stageName, isStillCurrent = () => true, recordId = null) {
  const el = document.getElementById('tb-stage-exit-criteria-list')
  if (!el) return
  const id = recordId ?? tbDetailId
  if (!id) { markStagePanelFailed(el); el.innerHTML = '<p class="empty-state">Unable to load exit criteria.</p>'; return }
  const result = await api('GET', `/api/records/${id}/exit-criteria?stage=${encodeURIComponent(stageName)}`)
  if (!isStillCurrent()) return
  if (!result.ok) {
    el.innerHTML = '<p class="empty-state">Unable to load exit criteria.</p>'
    markStagePanelFailed(el)
    renderTbStageScoring(stageName, [], isStillCurrent)
    return
  }
  const { to_stage, requirements } = result.data
  // The scoring panel derives from the SAME response, before any of the
  // early returns below, so a stage with no exit criteria at all still gets
  // its panel correctly hidden rather than left as the previous stage's.
  renderTbStageScoring(stageName, requirements ?? [], isStillCurrent)
  if (!to_stage) {
    el.innerHTML = '<p class="empty-state">This is the final stage - nothing further to exit toward.</p>'
    markStagePanelSettled(el, stageName)
    return
  }
  if (!requirements.length) {
    el.innerHTML = `<p class="empty-state">No exit criteria configured for ${escHtml(to_stage)}.</p>`
    markStagePanelSettled(el, stageName)
    return
  }

  // Round 9 Phase 6.2: the full TICK LIST, satisfied and unsatisfied
  // both, from Phase 3's `requirements` rather than the old `blocking`.
  // `blocking` still exists on the response and is still what the
  // transition endpoint decides on; this panel simply stopped discarding
  // the met ones.
  //
  // TICKABLE REQUIRES BOTH CONDITIONS, and this is load-bearing:
  //   1. the field is a member of TB_EXIT_CRITERION_KEYS, and
  //   2. it carries a label.
  //
  // Label presence alone must NOT be the test. `label` is additive and
  // ignored by the gate engine, so any payload_field_required rule may be
  // given one purely for display - and if this panel keyed on the label
  // alone, that rule would render as a tick box and ticking it would
  // write an ISO timestamp into an unrelated payload field. The key-set
  // membership is the half that makes the control safe; the label is only
  // the half that makes it readable. The same set is the server's PATCH
  // allowlist, so the panel can only ever offer a tick the server would
  // accept.
  // ── The exit criteria split, Round 12 Phase 5 (2026-08-20) ──────────────
  //
  // Confirmed with the business, and their reasoning decides future cases:
  // the tick is confirmation that a STEP WAS PERFORMED, and a step performed
  // is what you want visible in a process you are reinforcing. A date being
  // filled in is not a step, it is a field. So process requirements always
  // show with their tick, and data-entry requirements show only while unmet.
  //
  // THE CLASSIFICATION IS A PROPERTY OF THE REQUIREMENT, not a list of
  // fields kept in step by hand. document_status and approval_obtained are
  // process by their type; contact_role_linked is data entry by its type;
  // payload_field_required is the only untidy case, because a date and a
  // score key are the same requirement type.
  //
  // THE BRIEF'S ORIGINAL PREMISE WAS REFUTED AND IS RECORDED HERE BECAUSE
  // THE REFUTATION IS THE USEFUL PART. It asserted TB_EXIT_CRITERION_KEYS
  // already distinguishes the two. It does not: that set holds only the four
  // legacy tick keys, because Round 11 Phase 2 deliberately kept score keys
  // out of it and out of TEST_BED_WRITABLE_KEYS. Deriving from it alone
  // would have classified all six process requirements as data entry, which
  // is the exact opposite of the intent and would have hidden every score
  // the moment it was ticked.
  //
  // ONE CAVEAT, RECORDED AS A CAVEAT RATHER THAN RESOLVED. `min_length`
  // means "this field holds a series", which is not the same concept as
  // "this is a process step". It correlates exactly today only because the
  // only series-valued requirements happen to be the scored ones. It is a
  // proxy, and a proxy that is currently exact. A future data-entry field
  // holding a series would be misclassified and nothing would flag it.
  const isProcessRequirement = (r) => {
    if (r.requirement_type === 'document_status') return true
    if (r.requirement_type === 'approval_obtained') return true
    if (r.requirement_type === 'contact_role_linked') return false
    if (r.requirement_type === 'payload_field_required') {
      return r.min_length !== undefined || TB_EXIT_CRITERION_KEYS.has(r.field)
    }
    // An unrecognised type stays visible. Hiding a requirement nobody has
    // classified is the failure mode worth avoiding: a gate would block with
    // nothing on screen saying why.
    return true
  }
  const shown = requirements.filter(r => isProcessRequirement(r) || !r.met)

  const rows = shown.map(r => {
    const tickable = r.requirement_type === 'payload_field_required'
      && TB_EXIT_CRITERION_KEYS.has(r.field)
      && !!r.label
    const label = escHtml(r.label ?? r.message)
    const mark = r.met ? '<span class="tb-crit-box tb-crit-box--met">&#10003;</span>' : '<span class="tb-crit-box"></span>'

    // data-met is written from the SERVER's own `met`, and nothing else ever
    // writes it. It is what applyTbPendingMarks reads to decide a row is
    // untouchable, and what the verification asserts against a fresh API
    // call, so a confirmed tick cannot exist without a server round trip.
    if (tickable) {
      return `<div class="tb-crit-row tb-crit-row--tickable" data-field="${escHtml(r.field)}" data-met="${r.met ? 'true' : 'false'}" onclick="toggleExitCriterion('${escHtml(r.field)}', ${r.met ? 'true' : 'false'})" title="${r.met ? 'Tick to clear' : 'Tick to confirm'}">
        ${mark}<span class="tb-crit-text">${label}</span>
      </div>`
    }
    // Document and field requirements are computed, so they are read-only
    // rows. Presenting them as tick boxes would invite a click that
    // cannot do anything.
    return `<div class="tb-crit-row tb-crit-row--computed" data-field="${escHtml(r.field ?? '')}" data-met="${r.met ? 'true' : 'false'}">
      ${mark}<span class="tb-crit-text">${escHtml(r.message)}</span>
    </div>`
  }).join('')

  // Counted over ALL requirements, not over the displayed subset. This line
  // describes the GATE, not the list: every hidden row is a met one, so the
  // outstanding figure is unchanged by the split, and the denominator stays
  // the true number of requirements the transition is checked against.
  const outstanding = requirements.filter(r => !r.met).length
  const summary = outstanding === 0
    ? `<p class="sub" style="margin-bottom:10px">All criteria met - ready to move to ${escHtml(to_stage)}.</p>`
    : `<p class="sub" style="margin-bottom:10px">${outstanding} of ${requirements.length} outstanding to move to ${escHtml(to_stage)}:</p>`

  el.innerHTML = summary + rows
  // Every render rewrites the rows, so the pending marks are re-derived onto
  // the new nodes from the live draft state.
  applyTbPendingMarks()
  // Which stage this panel is SHOWING. See the same marker on the
  // documents panel for why verification waits on it.
  markStagePanelSettled(el, stageName)
  const fb = document.createElement('div')
  fb.id = 'tb-crit-feedback'
  fb.className = 'tb-doc-feedback'
  el.appendChild(fb)
}

// The five judgement-criterion payload keys, mirroring
// TB_EXIT_CRITERION_KEYS in src/routes/test-beds.js. Duplicated here
// deliberately and knowingly: the browser has no import path to a server
// module, and the alternative - trusting whatever `label` the rule
// happens to carry - is the unsafe test this list exists to avoid. The
// server validates the same set independently on every PATCH, so a drift
// between the two lists costs a rejected save, never a write to an
// unintended field.
const TB_EXIT_CRITERION_KEYS = new Set([
  'exitQualTechnicalCommercialValue',
  // exitQualDataAndUseCase RETIRED, Round 11 Phase 1 (2026-08-19), together
  // with its gate rule. The criterion ceases to exist rather than being
  // renamed: it splits into Clear Use Case Requirements and Metrics and
  // Data Rights, both scored rather than ticked, arriving in Phase 4.
  // Leaving it here would render a tick box for a criterion that no longer
  // exists, against a gate rule that no longer exists to satisfy.
  'exitQualPhysicalSuitability',
  'exitQualPartnerCommitment',
  'exitMonAllMeetingActionsCompleted',
])


// ── Qualification scoring (Round 11 Phase 2, 2026-08-19) ─────────────────
//
// A score series is an APPEND-ONLY array on the record's own payload, one
// per criterion, keyed by the criterion_key from scoring_criteria. Entries
// are written ONLY by POST /test-beds/:id/scores - the criterion keys are
// deliberately absent from TEST_BED_WRITABLE_KEYS, so there is no PATCH path
// that could rewrite or forge history.
//
// AN UNSCORED CRITERION IS AN ABSENT KEY, NEVER AN EMPTY ARRAY. That is the
// convention this codebase already uses: unticking an exit criterion sends
// null and the server DELETEs the key rather than storing a sentinel, and
// every notes reader normalises an absent key to [] at read time. Writing []
// would mean "scored, zero times", which is not a state that exists.
//
// The gate does NOT depend on that convention holding, and that separation is
// deliberate: payload_field_required treats [] as PRESENT, so an empty array
// arriving by any route - a future renderer, a migration, a bulk write -
// would open the gate. Phase 4.1.1's length clause is what makes the gate
// correct regardless of who writes what. Convention keeps the data clean;
// the clause keeps the gate honest. Relying on the convention alone is the
// discipline-not-a-property case the brief rejected.
let tbScoresExpanded = {}
// Round 14 Phase 1: one field, called Reason. Renamed from tbScoreComments
// deliberately rather than left alone: the field is called Reason and holding
// it in a map called comments is exactly the drift that costs someone an hour
// a year from now.
let tbScoreReasons = {}
// Which criteria have their anchors revealed. Kept across re-renders because
// renderTbScores rewrites innerHTML: without this the block would vanish the
// moment a draft change re-rendered the panel, one interaction after the user
// opened it.
let tbScoreAnchorsOpen = {}

// A score draft goes into tbEdits under the criterion key, so it is dirty in
// exactly the same sense every other field is: the save bar appears, Cancel
// discards it, and saveTbFields() sees it among dirtyEntries. That is what
// lets the interception be shared rather than reimplemented per field type.
// ── Pending tick state in exit criteria. Round 13 Phase 2 ────────────────
//
// The panel shows what the SERVER has recorded. The business wants to see
// requirements ticking off as scores are entered, before saving. A tick that
// means "recorded" one moment and "chosen but unsaved" the next is a screen
// that lies, and Round 11A's fault was exactly a screen state that did not
// match the server, so the pending treatment is a different mark rather than
// an early tick.
//
// DISTINGUISHABLE WITHOUT COLOUR, three ways over: a different glyph (a
// filled dot, not a check), a dashed rather than solid border, and the word
// "unsaved" appended to the row. A greyscale screenshot still answers it.
//
// APPLIED BY DIRECT DOM MUTATION, NEVER BY RE-RENDERING. Two panels are in
// play and both render by rewriting innerHTML: re-rendering the exit criteria
// panel is a network refetch, and re-rendering the scoring panel would eat
// the comment field Phase 1 just put the caret in. Marks are toggled on the
// existing nodes instead.
//
// A CONFIRMED ROW IS NEVER TOUCHED. The guard is structural rather than
// careful: this function returns early on any row whose data-met is 'true',
// and data-met is written only by the render, only from the server's own
// `met`. There is no path here that can produce a confirmed tick.
function applyTbPendingMarks() {
  const list = document.getElementById('tb-stage-exit-criteria-list')
  if (!list) return
  const keys = tbScoreKeys()
  for (const row of list.querySelectorAll('.tb-crit-row[data-field]')) {
    const field = row.dataset.field
    if (row.dataset.met === 'true') continue      // server-confirmed, untouchable
    const box = row.querySelector('.tb-crit-box')
    if (!box) continue
    const draft = tbEdits[field]?.draft
    const pending = keys.has(field) && draft !== undefined && draft !== ''
    box.classList.toggle('tb-crit-box--pending', pending)
    box.innerHTML = pending ? '&#9679;' : ''
    const existing = row.querySelector('.tb-crit-pending-tag')
    if (pending && !existing) {
      const tag = document.createElement('span')
      tag.className = 'tb-crit-pending-tag'
      tag.textContent = 'unsaved'
      row.appendChild(tag)
    } else if (!pending && existing) {
      existing.remove()
    }
  }
}

// ── Reason, required at entry. Round 13 Phase 1, one field from Round 14 ──
//
// The server has always refused a 1 or 2 with no comment. What made that
// expensive is Round 11A's partial-failure rule: the first refusal stops the
// run, so everything after it in the batch is never attempted. Measured in
// Phase 0 by driving the real shape rather than one score: three criteria
// entered, the 2 second, and a perfectly valid 5 entered third was NOT
// RECORDED because it followed the refusal. The user loses work they did
// correctly, and only finds out at save.
//
// THE SERVER CHECK IS UNTOUCHED. This is an addition, not a relocation:
// client-side validation is an affordance and the server rule is the
// guarantee. Round 11A's partial-failure behaviour must be identical.

// The one criterion holding up further entry, or null. Derived from the live
// draft and comment state rather than tracked in a flag, so it cannot drift.
// TWO CONDITIONS, ONE FIELD. A Reason is required when the score is 1 or 2 on
// any entry, or when the entry is a revision, meaning any entry after the
// first for that criterion. A revision down to 2 satisfies both with ONE
// Reason, which is the whole point of collapsing the two fields: they were
// always the same statement.
//
// The revision half is read from the STORED series rather than from a flag,
// so it cannot drift from what the server will decide with the same question.
function tbScoreReasonRequired(key) {
  const draft = Number(tbEdits[key]?.draft)
  if (!Number.isFinite(draft)) return false
  return draft <= 2 || tbScoreSeries(key).length > 0
}

function tbScoreAwaitingReason() {
  const keys = tbScoreKeys()
  for (const key of Object.keys(tbEdits)) {
    if (!keys.has(key)) continue
    if (!tbScoreReasonRequired(key)) continue
    if (!String(tbScoreReasons[key] ?? '').trim()) return key
  }
  return null
}

// APPLIED BY DIRECT DOM MUTATION, NEVER BY RE-RENDERING, and that is the
// whole reason this is not a call to renderTbScores. The panel renders by
// rewriting innerHTML, so re-rendering on comment input would destroy the
// textarea the user is typing into, on the first keystroke. Same lesson as
// Round 12's anchor reveal, arrived at from the other direction: there the
// re-render would have closed a dropdown, here it would eat the caret.
//
// Called at the END of renderTbScores as well, because every render rewrites
// the markup and the lock has to be restored onto the new nodes.
function applyTbScoreEntryLock() {
  const blocking = tbScoreAwaitingReason()
  const blockingName = blocking
    ? (tbScoringCriteria.find(c => c.criterion_key === blocking)?.name ?? blocking)
    : null

  for (const c of tbScoringCriteria) {
    const sel = document.getElementById(`tb-score-select-${c.criterion_key}`)
    // The blocking criterion keeps its OWN control enabled. Disabling it would
    // trap the user: changing the score to a 3 is a legitimate way out, and
    // taking that away leaves the comment as the only exit from a choice they
    // may simply want to undo.
    if (sel) sel.disabled = !!blocking && c.criterion_key !== blocking
    const box = document.querySelector(`.tb-score-row[data-criterion="${c.criterion_key}"] .tb-score-reason`)
    if (box) box.classList.toggle('tb-score-reason--needed', c.criterion_key === blocking)
    const lab = box?.querySelector('label')
    // NOT COLOUR ALONE: the label text itself changes, so the state survives
    // a greyscale screenshot and a colour-blind reader.
    if (lab) lab.textContent = c.criterion_key === blocking
      ? 'Reason required before scoring anything else'
      : (tbScoreReasonRequired(c.criterion_key) ? 'Reason (required)' : 'Reason (optional)')
  }

  const meas = document.getElementById('tb-measurability-select')
  if (meas) meas.disabled = !!blocking

  // A disabled control with no stated reason is a dead end the user keeps
  // clicking, which is the same objection Round 12 Phase 3 raised against a
  // row that silently does nothing. The note says which criterion and why.
  const note = document.getElementById('tb-score-lock-note')
  if (note) {
    note.textContent = blocking ? `Add the Reason for ${blockingName} before scoring anything else.` : ''
    note.classList.toggle('hidden', !blocking)
  }
}

window.setTbScoreDraft = async function (key, value) {
  // THE HANDLER REFUSES, not only the control. Disabling the other selects is
  // an affordance: it stops a person, and it stops nothing else. The probe
  // dispatched a change event at a disabled select and the draft was taken,
  // which is the same shape as Architecture rule 8, correct for every caller
  // that exists. Any future call site that sets a draft without consulting
  // `disabled` would have inherited that silently.
  const awaiting = tbScoreAwaitingReason()
  if (awaiting && awaiting !== key) {
    applyTbScoreEntryLock()
    return
  }
  const orig = ''
  if (value === '') delete tbEdits[key]
  else tbEdits[key] = { draft: value, orig }
  if (value === '') delete tbScoreReasons[key]
  clearTbSaveFeedback()
  updateTbSaveBar()
  // AWAITED, because the comment field does not exist until this render
  // produces it: the box is emitted only for a criterion with a pending
  // draft. Focusing before the await would focus nothing, silently.
  await renderTbScores()
  // The other panel, mutated in place rather than refetched.
  applyTbPendingMarks()
  // The SAME predicate the lock uses, not a second copy of half of it. The
  // first version of this line tested `Number(value) <= 2`, which is the old
  // one-condition rule and would have skipped the focus on a revision.
  if (value !== '' && tbScoreReasonRequired(key)) {
    const ta = document.getElementById(`tb-score-reason-${key}`)
    if (ta) {
      ta.focus()
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }
}


// The measurability confirmation saves immediately rather than joining the
// batched edit bar. It is a single yes or no with nothing to draft, and it is
// deliberately NOT a score - folding it into the score interception would put
// a reason dialogue in front of a question that has no scale to move along.
window.setTbMeasurability = async function (value) {
  if (value === '') return
  const result = await api('POST', `/api/test-beds/${tbDetailId}/measurability`, { confirmed: value === 'yes' })
  if (!result.ok) {
    const feedback = document.getElementById('tb-save-feedback')
    feedback.textContent = result.data?.error ?? 'Could not record the confirmation.'
    feedback.className = 'msg-error'
    return
  }
  await loadTestBedDetail(tbDetailId)
}

window.setTbScoreReason = function (key, value) {
  tbScoreReasons[key] = value
  // In place, on every keystroke. The lock lifts the moment the comment has
  // content and returns the moment it is emptied again.
  applyTbScoreEntryLock()
}

// Which tbEdits keys are scores rather than payload fields. Derived from the
// criteria table rather than hardcoded, so a criterion added as a row is
// picked up without a code change.
function tbScoreKeys() {
  return new Set(tbScoringCriteria.map(c => c.criterion_key))
}

// REVEALED WITHOUT RE-RENDERING, and that is the whole reason this is not a
// call to renderTbScores. The panel renders by rewriting innerHTML, so
// re-rendering on focus would destroy the very select the user just opened,
// closing its dropdown as they reached for it. The flag is set for later
// re-renders and the class is removed directly for this one.
window.showTbScoreAnchors = function (key) {
  tbScoreAnchorsOpen[key] = true
  document.getElementById(`tb-anchors-${key}`)?.classList.remove('hidden')
}

// The wording for a given version, or an empty set. Versions are jsonb object
// keys so they arrive as strings.
function tbAnchorSet(criterion, version) {
  return criterion?.anchors?.[String(version)] ?? {}
}

window.toggleTbScoreHistory = function (key) {
  tbScoresExpanded[key] = !tbScoresExpanded[key]
  renderTbScores()
}

// ORDERING IS DERIVED FROM `at`, NEVER FROM ARRAY POSITION. Round 10 Phase 2
// found the header notes digest showing the two OLDEST notes under the label
// "Latest notes", because it assumed oldest-first against an array that
// prepends. It survived two rounds of screenshots because no live record ever
// held more than one note, and with one entry every implementation of "the
// most recent" looks identical, including every wrong one. This series
// appends where notes prepend, so trusting position here would be the same
// bug with the sign flipped.
function tbScoreSeries(key) {
  const raw = Array.isArray(tbPayload[key]) ? tbPayload[key] : []
  return [...raw].sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')))
}

// Records one score. A FIRST score needs no reason and is written straight
// through; a REVISION opens the shared dialogue and writes the reason onto
// the entry. The server enforces both rules independently, so this is the
// affordance rather than the guarantee - a caller bypassing the browser gets
// the same 400.
// Records EVERY dirty score, one at a time, then saves whatever else was
// dirty in the same Save click.
//
// PARTIAL FAILURE IS A STATED BEHAVIOUR, not whatever falls out, because
// this operation genuinely cannot be atomic. Each score is its own append to
// its own revision, and record_revisions is immutable by design, so there is
// no rollback available: a score that has been recorded is recorded.
//
// The rule, in full:
//
//   * Scores are attempted in panel order.
//   * A recorded score STANDS. It is never retracted, because it cannot be.
//   * On the FIRST failure, everything stops. The remaining scores are not
//     attempted and the ordinary fields are NOT saved.
//   * Everything not recorded stays dirty in the edit bar, so the user can
//     correct the problem and press Save again.
//   * The message names what was recorded and what was not, by criterion.
//
// Stopping rather than continuing is the deliberate half. A failure here is
// far more likely to be systemic (auth expired, network gone) than specific
// to one criterion, and pressing on would turn one clear error into a list of
// them. Not saving the fields is the other half: leaving them dirty keeps the
// edit bar up, so what still needs doing is visible rather than silently
// half-applied.
async function recordTbScores(scoreEntries, otherDirtyEntries) {
  const feedback = document.getElementById('tb-save-feedback')
  const recorded = []

  for (const [key, entry] of scoreEntries) {
    const crit = tbScoringCriteria.find(c => c.criterion_key === key)
    const name = crit?.name ?? key
    const score = Number(entry.draft)
    const reasonText = String(tbScoreReasons[key] ?? '').trim()

    const post = async (reason) => {
      const body = { criterion: key, score }
      // ONE FIELD. `comment` is left in place on the server and simply never
      // written from here again, so historical entries keep what they carry
      // and new ones carry a reason.
      if (reason) body.reason = reason
      const result = await api('POST', `/api/test-beds/${tbDetailId}/scores`, body)
      return { ok: result.ok, error: result.data?.error }
    }

    // ONE PATH, because the Reason has already been collected at entry.
    //
    // The dialogue used to fire here for a revision. With the requirement
    // enforced at the point of entry it has nothing left to ask: by the time
    // Save runs, a revision cannot be dirty without a Reason, because the lock
    // refuses further scoring and Save refuses locally until one exists.
    // Asking again at save would ask the same question twice for one field.
    //
    // Round 14 Phase 2: window.requestChangeReason still exists and still has
    // ONE caller, Opportunity's Est. Close Date, which is where it started in
    // Round 3 Phase 3 before Round 11 Phase 3 generalised it to two. Returning
    // a helper to a single caller is not a regression; it is the second caller
    // going away because it had nothing left to ask.
    const result = await post(reasonText || null)

    if (!result.ok) {
      // The failing score stays DIRTY on purpose, so the edit bar still shows
      // it and Save can be pressed again once the cause is fixed.
      const done = recorded.length
        ? `Recorded ${recorded.join(', ')}. `
        : 'Nothing was recorded. '
      // The `cancelled` branch went with the dialogue. Only the dialogue's
      // onCancel ever set that flag, so keeping the branch would leave a
      // message no code path can produce, which reads to the next person as a
      // state the system can reach.
      const why = `${name} could not be recorded: ${result.error ?? 'unknown error'}`
      const rest = otherDirtyEntries.length
        ? ' Your other edits have not been saved and are still open.'
        : ''
      feedback.textContent = `${done}${why}${rest}`
      feedback.className = 'msg-error'
      // Recorded scores are cleared; everything else stays dirty for a retry.
      await loadTestBedDetail(tbDetailId)
      return
    }

    recorded.push(name)
    delete tbEdits[key]
    delete tbScoreReasons[key]
  }

  // Every score landed. Now whatever else was dirty in the same click, saved
  // through the identical path an ordinary save uses.
  if (otherDirtyEntries.length) await saveTbDirtyEntries(otherDirtyEntries)
  else await loadTestBedDetail(tbDetailId)
}

// Round 12: the read-only scores summary on Reference.
//
// STRUCTURALLY INERT, and that is the assertion this card is verified by:
// zero inputs, zero selects, zero buttons, zero click handlers, nothing
// focusable. It renders spans and nothing else.
//
// It deliberately does NOT reuse .tb-score-row. The two panels share the
// value styling and the 170px name column, so they read consistently, but the
// summary carries its own row class so "no scoring panel remains on
// Reference" stays a checkable claim rather than becoming ambiguous the
// moment a read-only summary reuses the same selector.
//
// EVERY criterion renders, including unscored ones. A criterion missing from
// the list is indistinguishable from a criterion that does not exist, and the
// unscored ones are the ones worth seeing on a record you are reading whole.
async function renderTbScoreSummary() {
  const el = document.getElementById('tb-score-summary')
  if (!el) return
  await ensureTbScoringCriteria()
  if (!tbScoringCriteria.length) {
    el.innerHTML = '<p class="empty-state">No scoring criteria configured.</p>'
    return
  }
  el.innerHTML = tbScoringCriteria.map(c => {
    const series = tbScoreSeries(c.criterion_key)
    const current = series.length ? series[series.length - 1] : null
    // The stage the CURRENT score was recorded at. This is the half that
    // makes the route evident without a control: it names the tab.
    const where = current?.stage ? `<span class="tb-score-sum-where">${escHtml(current.stage)}</span>` : ''
    return `
      <div class="tb-score-sum-row" data-criterion="${escHtml(c.criterion_key)}">
        <span class="tb-score-name">${escHtml(c.name)}</span>
        <span class="tb-score-value${current ? '' : ' tb-score-value--none'}">${
          current ? escHtml(String(current.value)) : 'Not scored'
        }</span>
        ${where}
      </div>`
  }).join('')
}

async function ensureTbScoringCriteria() {
  if (tbScoringCriteria.length) return
  const result = await api('GET', '/api/scoring-criteria?record_type=test_bed')
  if (result.ok) tbScoringCriteria = result.data ?? []
}

// WHICH CRITERIA THE OPEN STAGE TAB ASKS FOR. Set by renderTbStageScoring from
// that stage's own gate rules, read by renderTbScores. Holding it here is what
// lets the two in-panel re-renders (a draft change, a history toggle) stay
// argument-free rather than each having to rediscover the stage.
let tbScoreVisible = { keys: [], measurability: false }

// Round 12 Phase 2. Derives the panel from the requirements[] that
// renderTbStageExitCriteria has ALREADY fetched for this stage, rather than
// asking again or carrying a list.
//
// This follows loadTbStageDetailTab's `isTerminal`, which reads terminality
// from stage_definitions, and deliberately not the line eight below it, which
// decides the install section by `stageName !== 'Installation and
// Commissioning'`. Both are pure visibility toggles over statically mounted
// markup, so nothing here is duplicated per tab.
//
// The measurability confirmation is derived the same way and is NOT a member
// of scoring_criteria: it appears exactly where a gate rule names
// measurabilityConfirmed, which today is Qualification alone.
async function renderTbStageScoring(stageName, requirements, isStillCurrent = () => true) {
  const card = document.getElementById('tb-stage-scoring-card')
  const list = document.getElementById('tb-scores-list')
  if (!card || !list) return
  await ensureTbScoringCriteria()
  if (!isStillCurrent()) return

  const known = new Set(tbScoringCriteria.map(c => c.criterion_key))
  const fields = (requirements ?? [])
    .filter(r => r.requirement_type === 'payload_field_required')
    .map(r => r.field)
  tbScoreVisible = {
    keys: fields.filter(f => known.has(f)),
    measurability: fields.includes('measurabilityConfirmed'),
  }

  const anything = tbScoreVisible.keys.length > 0 || tbScoreVisible.measurability
  card.classList.toggle('hidden', !anything)
  // Paired with the delete in loadTbStageDetailTab's synchronous hide, exactly
  // as markStagePanelsPending/markStagePanelSettled are paired: the attribute
  // names the stage this card has actually derived, so "hidden" can never be
  // read as an answer while it is still the previous stage's hide.
  card.dataset.stage = stageName
  if (!anything) {
    // No panel means NO PANEL, not an empty card. The list is emptied as well
    // as hidden so a later reveal can never flash the previous stage's rows.
    list.innerHTML = ''
    return
  }
  await renderTbScores()
}

async function renderTbScores() {
  const el = document.getElementById('tb-scores-list')
  if (!el) return
  await ensureTbScoringCriteria()
  if (!tbScoringCriteria.length) {
    el.innerHTML = '<p class="empty-state">No scoring criteria configured.</p>'
    return
  }

  const mSeries = tbScoreSeries('measurabilityConfirmed')
  const mCurrent = mSeries.length ? mSeries[mSeries.length - 1] : null
  const measurability = !tbScoreVisible.measurability ? '' : `
    <div class="tb-score-row" data-criterion="measurabilityConfirmed" data-entries="${mSeries.length}">
      <div class="tb-score-head">
        <span class="tb-score-name">Can the proposed sensors capture what would be measured?</span>
        <span class="tb-score-value${mCurrent ? '' : ' tb-score-value--none'}">${
          mCurrent ? (mCurrent.value ? 'Yes' : 'No') : 'Not confirmed'
        }</span>
        <select class="tb-score-select" id="tb-measurability-select" aria-label="Measurability confirmation"
                onchange="setTbMeasurability(this.value)">
          <option value="">${mCurrent ? 'Change...' : 'Confirm...'}</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      ${mCurrent ? `<div class="ref-notes-row tb-score-entry"><span class="ref-notes-when">${formatDateTime(mCurrent.at)}</span><span class="ref-notes-author">${escHtml(mCurrent.by ?? '--')}</span><span class="ref-notes-text">${mCurrent.value ? 'Yes' : 'No'} at ${escHtml(mCurrent.stage ?? '')}</span></div>` : ''}
    </div>`

  const visible = tbScoringCriteria.filter(c => tbScoreVisible.keys.includes(c.criterion_key))
  const lockNote = '<p class="tb-score-lock hidden" id="tb-score-lock-note"></p>'
  el.innerHTML = lockNote + measurability + visible.map(c => {
    const series = tbScoreSeries(c.criterion_key)
    const current = series.length ? series[series.length - 1] : null
    const expanded = !!tbScoresExpanded[c.criterion_key]

    // The CURRENT value is the newest entry. History is everything, shown on
    // request - same default-plus-expansion shape as Notes, and the count is
    // rendered so "3 of 3" is visible rather than implied.
    // The pending draft, if this criterion is open in the edit bar. A score
    // registers in tbEdits exactly like any other field, which is what makes
    // saveTbFields() the single interception point rather than this panel
    // having its own save path.
    const pending = tbEdits[c.criterion_key]?.draft ?? ''
    const options = [1,2,3,4,5].map(n =>
      `<option value="${n}"${String(pending) === String(n) ? ' selected' : ''}>${n}</option>`).join('')

    const head = `
      <div class="tb-score-head">
        <span class="tb-score-name">${escHtml(c.name)}</span>
        <span class="tb-score-value${current ? '' : ' tb-score-value--none'}" data-criterion="${escHtml(c.criterion_key)}">${
          current ? escHtml(String(current.value)) : 'Not scored'
        }</span>
        <select class="tb-score-select" id="tb-score-select-${escHtml(c.criterion_key)}"
                aria-label="${escHtml(c.name)} score"
                onfocus="showTbScoreAnchors('${escHtml(c.criterion_key)}')"
                onmousedown="showTbScoreAnchors('${escHtml(c.criterion_key)}')"
                onchange="setTbScoreDraft('${escHtml(c.criterion_key)}', this.value)">
          <option value="">${current ? 'Revise...' : 'Score...'}</option>
          ${options}
        </select>
        ${series.length > 1
          ? `<button class="btn-text" onclick="toggleTbScoreHistory('${escHtml(c.criterion_key)}')">${
              expanded ? 'Hide history' : `Show history (${series.length})`
            }</button>`
          : ''}
      </div>`

    // Comment is mandatory at 1 or 2 and lives INLINE rather than in the
    // dialogue. The dialogue asks one question, "why did this change", and
    // stays single-purpose the way Est. Close Date's did; the comment is
    // part of the score itself, not part of the change.
    // THE ANCHORS, inline rather than on hover. Three reasons, recorded:
    // they run to two or three sentences and a tooltip cannot hold that;
    // hover does not exist on touch; and hiding the instrument behind a
    // gesture makes consulting it optional, when the design intent is that
    // scoring is a matching exercise rather than a recalled judgement.
    //
    // ALL FIVE VALUES ARE LISTED. 2 and 4 have no wording and are shown with
    // none rather than hidden or given invented text. That is the honest
    // rendering of what the data says, and it puts Round 11 Phase 8's
    // structural finding in front of the person scoring: every 5 is a
    // conjunction of three or four independent conditions, so an engagement
    // that satisfies most and fails one has nowhere to land, and 2 and 4
    // cannot carry a gap that is not one dimension.
    //
    // Informational, not a second control. The select remains the only way to
    // set a score, so there is one write path rather than two that must agree.
    // THE CURRENT ENTRY'S EXPLANATION, ALWAYS SHOWN. Round 14 Phase 1.
    //
    // The history control only appears once a criterion has more than one
    // entry, so a single-entry criterion displayed its explanation NOWHERE:
    // measured by searching the whole document, not the panel. That was
    // survivable while the field was optional and became a contradiction the
    // moment the rule required a Reason at a first score of 1 or 2, which is
    // the shape the new rule produces most of. The system insisted the user
    // write it and then never showed it back.
    //
    // Rejected: expansion-from-one, which makes the user click to see
    // something they were just required to write; and revision-only, which is
    // the same contradiction one entry later. The Reason explains the score
    // being displayed, so it sits with it, and the history control keeps its
    // existing job of showing what came BEFORE.
    //
    // A historical `comment` renders unlabelled, exactly as the history rows
    // render it. Labelling it "Reason" would be this build asserting that an
    // entry written under the old rule meant what the new field means, which
    // is a claim about a decision nobody made. An entry carrying both shows
    // both, because hiding either would lose text a person wrote.
    const currentExplanation = !current ? '' : [
      current.comment ? `<span class="tb-score-current-text">${escHtml(current.comment)}</span>` : '',
      current.reason ? `<span class="tb-score-current-text"><em>Reason:</em> ${escHtml(current.reason)}</span>` : '',
    ].filter(Boolean).join('')
    const currentBlock = currentExplanation ? `<div class="tb-score-current">${currentExplanation}</div>` : ''

    // THE QUESTION, raised out of the anchors block. Round 13 Phase 3.
    //
    // It used to render inside anchorsBlock, which means it existed only once
    // the score control had been opened: a scorer reading the panel saw five
    // criterion NAMES and no questions at all until they touched something.
    // The business reads it as the label for the whole criterion, and a label
    // that appears only on interaction is not a label.
    //
    // Rendered VERBATIM, with no punctuation added. These are stored values
    // and the round's scope is one row edit; appending a question mark in the
    // view would be this build inventing wording, which is the line the
    // anchors are on the other side of.
    const asksLine = c.asks ? `<p class="tb-score-asks">${escHtml(c.asks)}</p>` : ''

    const anchorSet = tbAnchorSet(c, c.current_version)
    const anchorsBlock = `
      <div class="tb-score-anchors${tbScoreAnchorsOpen[c.criterion_key] || pending !== '' ? '' : ' hidden'}"
           id="tb-anchors-${escHtml(c.criterion_key)}">
        ${[1,2,3,4,5].map(n => `
          <div class="tb-score-anchor${anchorSet[n] ? '' : ' tb-score-anchor--nowording'}">
            <span class="tb-score-anchor-n">${n}</span>
            <span class="tb-score-anchor-text">${anchorSet[n] ? escHtml(anchorSet[n]) : ''}</span>
          </div>`).join('')}
        <p class="sub tb-score-anchor-ver">Version ${escHtml(String(c.current_version))}</p>
      </div>`

    const commentBox = pending === '' ? '' : `
      <div class="tb-score-reason">
        <label for="tb-score-reason-${escHtml(c.criterion_key)}">Reason${tbScoreReasonRequired(c.criterion_key) ? ' (required)' : ' (optional)'}</label>
        <textarea id="tb-score-reason-${escHtml(c.criterion_key)}" rows="2"
                  oninput="setTbScoreReason('${escHtml(c.criterion_key)}', this.value)">${escHtml(tbScoreReasons[c.criterion_key] ?? '')}</textarea>
      </div>`

    if (!expanded) return `<div class="tb-score-row" data-criterion="${escHtml(c.criterion_key)}" data-entries="${series.length}">${head}${currentBlock}${asksLine}${anchorsBlock}${commentBox}</div>`

    // Newest first when reading history, which is how a person reads a
    // change log, while the stored series stays chronological.
    const rows = [...series].reverse().map(e => `
      <div class="ref-notes-row tb-score-entry">
        <span class="ref-notes-when">${formatDateTime(e.at)}</span>
        <span class="ref-notes-author">${escHtml(e.by ?? '--')}</span>
        <span class="ref-notes-text"><strong>${escHtml(String(e.value))}</strong>${
          e.stage ? ` at ${escHtml(e.stage)}` : ''
        } <span class="sub">v${escHtml(String(e.anchorVersion ?? '?'))}</span>${
          e.comment ? `<br>${escHtml(e.comment)}` : ''
        }${e.reason ? `<br><em>Reason: ${escHtml(e.reason)}</em>` : ''}${
          // THE ENTRY RESOLVES AGAINST ITS OWN VERSION, not the current one.
          // Printing "v1" beside a score is a label; showing the wording that
          // score was actually chosen against is the thing the version column
          // exists for. When the anchors are revised, an old entry keeps
          // meaning what it meant, and that is visible rather than asserted.
          tbAnchorSet(c, e.anchorVersion)[e.value]
            ? `<br><span class="tb-score-entry-anchor">${escHtml(tbAnchorSet(c, e.anchorVersion)[e.value])}</span>`
            : ''
        }</span>
      </div>`).join('')

    return `<div class="tb-score-row" data-criterion="${escHtml(c.criterion_key)}" data-entries="${series.length}">${head}${currentBlock}${asksLine}${anchorsBlock}${commentBox}<div class="tb-score-history">${rows}</div></div>`
  }).join('')

  // Every render rewrites the markup, so the lock has to be re-applied onto
  // the new nodes. Doing it here rather than at each call site is what stops
  // a future render path from silently shipping an unlocked panel.
  applyTbScoreEntryLock()
}

// Tick writes an ISO timestamp; untick sends null, which the server
// deletes the key for. Never a boolean: payload_field_required treats a
// stored `false` as PRESENT, so an unticked box would open the gate.
// Round 10 Phase 5B (2026-08-19).
//
// Measured after 5A's parallelising: click to visible tick was 1162ms, two
// SERIAL round trips - PATCH 305ms, then a full exit-criteria GET 838ms -
// with nothing at all changing on screen in between. The tick was waiting
// on a recomputation of every OTHER row before showing its own result.
//
// NOT OPTIMISTIC, deliberately, and this is the whole design. The row is
// updated only after its own PATCH has been CONFIRMED by the server, which
// is the point at which the value is genuinely stored. What it no longer
// waits for is the recomputation of everything derived from it. So the
// contract holds: nothing is displayed that the server has not confirmed,
// and a failed write leaves the control exactly as it was.
//
// Writes are SERIALISED per record. Two PATCHes in flight together each
// merge into whatever revision they read at the start, so an interleaved
// pair can silently drop the first tick - "tick two criteria in rapid
// succession and confirm both register" is precisely the case that breaks.
// A queue is the honest fix; a debounce would only make it less likely.
let tbCriterionQueue = Promise.resolve()

function applyConfirmedCriterionTick(field, met) {
  const row = document.querySelector(`#tb-stage-exit-criteria-list .tb-crit-row--tickable[data-field="${CSS.escape(field)}"]`)
  if (!row) return
  const box = row.querySelector('.tb-crit-box')
  if (box) box.className = met ? 'tb-crit-box tb-crit-box--met' : 'tb-crit-box'
  if (box) box.innerHTML = met ? '&#10003;' : ''
  row.setAttribute('title', met ? 'Tick to clear' : 'Tick to confirm')
  row.setAttribute('onclick', `toggleExitCriterion('${field}', ${met ? 'true' : 'false'})`)
}

window.toggleExitCriterion = (field, isMet) => {
  const run = async () => {
    const fb = document.getElementById('tb-crit-feedback')
    if (fb) { fb.textContent = ''; fb.className = '' }
    const stageAtClick = currentTbStageTab
    const recordId = tbDetailId
    const result = await api('PATCH', `/api/test-beds/${recordId}`, {
      payload: { [field]: isMet ? null : new Date().toISOString() }
    })
    if (!result.ok) {
      const el = document.getElementById('tb-crit-feedback')
      if (el) {
        el.textContent = `Could not update: ${result.data?.error ?? 'unknown error'}`
        el.className = 'tb-doc-feedback err'
      }
      return // control untouched - a failed write must not look like a success
    }
    // Server-confirmed. Reflect THIS row now, before the recomputation.
    if (currentTbStageTab === stageAtClick) applyConfirmedCriterionTick(field, !isMet)
    // Then bring the derived state up to date. Not awaited by the tick.
    await renderTbStageExitCriteria(stageAtClick, () => currentTbStageTab === stageAtClick, recordId)
    refreshTbNextStageButton()
  }
  tbCriterionQueue = tbCriterionQueue.then(run, run)
  return tbCriterionQueue
}

// ── Click-to-edit mechanics (fields only - Sensors/Use Cases/Install
// Notes/Buyers save immediately via their own actions above, not
// through this batched edit bar) ────────────────────────────────────
// Round 7 Phase 2.1 (2026-08-18, revised): validate on input, mark the
// field invalid, and block the save. Do NOT block keystrokes.
//
// The first attempt blocked '-' and '.' at keydown. That was withdrawn
// for two reasons. Keystroke blocking is the fragile half - paste,
// drag-drop, autofill, IME composition and most mobile keyboards all
// route around keydown entirely - and worse, when it did fire it
// silently produced a DIFFERENT VALID NUMBER: typing "2.5" into a count
// swallowed the '.' and left "25", which then saved happily. Refusing a
// value is safe; quietly rewriting it into another plausible one is not.
//
// So the input event is now the single detection path (it fires for
// paste, autofill and IME alike), and an invalid value is allowed to sit
// in the field, visibly marked, with the save blocked until it is fixed.
// The server check remains the authority either way.
const tbInvalidFields = new Map()

function tbValidateNumeric(input, f) {
  const raw = input.value
  // An empty field is "not set", which is a legitimate state here.
  //
  // This used to read "type=\"number\" reports '' for text it cannot parse".
  // That is no longer how unparseable text arrives: with type="text" the raw
  // string reaches this function intact, so "abc" is now caught by the
  // Number.isFinite branch below rather than being silently flattened to ''.
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return 'must be a number'
  if (n < 0) return 'cannot be negative'
  if (f.integer && !Number.isInteger(n)) return 'must be a whole number'
  return null
}

function tbMarkFieldValidity(key, input, problem, label) {
  if (problem) {
    tbInvalidFields.set(key, `${label} ${problem}`)
    input.classList.add('input-invalid')
    input.setAttribute('aria-invalid', 'true')
  } else {
    tbInvalidFields.delete(key)
    input.classList.remove('input-invalid')
    input.removeAttribute('aria-invalid')
  }
  renderTbValidationFeedback()
}

// Round 17A Phase 4.2: ownership is MARKED, not inferred from the class.
//
// This function always intended to clear only its own message - the comment
// that stood here said exactly that. It identified "its own" by
// `className === 'msg-error'`, and a server save error carries that same
// class, so the test could never tell them apart. Confirmed live before
// changing it: open two fields, make one save fail, type one valid digit into
// the other, and the server's reason vanished on the keystroke.
//
// That is the same defect as the reported stale banner wearing the opposite
// sign. One path would not clear a message when the thing it described had
// gone; this one cleared a message that was not its to clear. Both come from
// having no record of who put it there.
function renderTbValidationFeedback() {
  const feedback = document.getElementById('tb-save-feedback')
  if (!feedback) return
  if (tbInvalidFields.size) {
    feedback.textContent = [...tbInvalidFields.values()].join('. ') + '.'
    feedback.className = 'msg-error'
    feedback.dataset.owner = 'validation'
  } else if (feedback.dataset.owner === 'validation') {
    feedback.textContent = ''
    feedback.className = ''
    delete feedback.dataset.owner
  }
}

function guardNumericEntry(input, f) {
  input.addEventListener('input', () => {
    tbMarkFieldValidity(f.key, input, tbValidateNumeric(input, f), f.label)
    // Must update the bar here, not rely on onTbFieldInput: that handler
    // returns early when tbEdits[key] is absent, so the Save button would
    // keep its stale enabled state on any path that did not open the
    // field through openTbField().
    updateTbSaveBar()
  })
}

function wireTbFieldInputs() {
  TB_ALL_EDITABLE_FIELDS.forEach(f => {
    const input = document.getElementById(`tb-input-${f.key}`)
    if (!input) return
    // Registered BEFORE the onTbFieldInput listener below, deliberately:
    // listeners fire in registration order, so the value is sanitised
    // before the draft is read from it.
    if (f.number) guardNumericEntry(input, f)
    input.addEventListener('input', () => onTbFieldInput(f.key))
    if (input.tagName === 'SELECT') input.addEventListener('change', () => onTbFieldInput(f.key))
  })
}

// fromUserGesture (Round 10 Phase 0A): true only from the real click and
// keydown handlers on the display element. The restore path below passes
// nothing on purpose - see window.revealFieldControl in app.js.
window.openTbField = function (key, fromUserGesture, seedChar) {
  if (tbEdits[key]) return
  const orig = String(tbPayload[key] ?? '')
  tbEdits[key] = { draft: orig, orig }
  document.getElementById(`tb-display-${key}`).classList.add('hidden')
  document.getElementById(`tb-edit-${key}`).classList.remove('hidden')
  const input = document.getElementById(`tb-input-${key}`)
  // Clear a stale error from an earlier, unrelated failed save (2026-08-15
  // fix) - tb-save-feedback previously only got reset at the top of
  // saveTbFields(), so a real failure (e.g. Summary rejected by the
  // writable-keys check) stayed on screen indefinitely, reappearing the
  // instant any other field was opened next, since opening a field makes
  // the save bar visible again without ever touching this text.
  //
  // MUST run BEFORE revealFieldControl, not after (Round 15 Phase 3). The
  // seed character introduced in Phase 2 dispatches a real input event, so
  // guardNumericEntry validates it and writes its message here while the
  // field is being opened. Clearing afterwards wiped that message, leaving
  // the input flagged red and Save disabled with nothing on screen saying
  // why. Correct for every caller that existed when it was written, since
  // none of them produced feedback before this line ran.
  // Round 17A Phase 4.2: ONLY on a real user gesture.
  //
  // The clear below was added on 2026-08-15 so a stale error from an earlier
  // failed save did not reappear the instant any other field was opened. That
  // is right for a person opening a field, and wrong for restoreTbOpenEdits,
  // which re-opens the fields that were already open after a reload. Every
  // real entry point passes fromUserGesture true; the restore is the only
  // caller that does not, so the flag already separates exactly these two
  // cases.
  //
  // The damage it was doing is the reported defect's mirror image: a save
  // fails, the handler writes the reason and reloads, the reload re-opens the
  // very field the message is about, and the message is wiped by the reopen.
  // The user sees the value rejected and no reason why.
  //
  // Ordering with revealFieldControl is unchanged and still load-bearing
  // (Round 15 Phase 3): the seed character dispatches a real input event whose
  // validation message lands here, so clearing afterwards would wipe it.
  if (fromUserGesture) clearTbSaveFeedback()
  window.revealFieldControl(input, fromUserGesture, seedChar)
  updateTbSaveBar()
}

function clearTbSaveFeedback() {
  const feedback = document.getElementById('tb-save-feedback')
  feedback.textContent = ''
  feedback.className = ''
  // The marker goes with the message, or the next validation message would
  // inherit an ownership claim from a message that no longer exists.
  delete feedback.dataset.owner
}

window.discardTbField = function (key) {
  delete tbEdits[key]
  const editEl = document.getElementById(`tb-edit-${key}`)
  editEl.classList.add('hidden')
  editEl.classList.remove('dirty')
  document.getElementById(`tb-display-${key}`).classList.remove('hidden')
  const input = document.getElementById(`tb-input-${key}`)
  if (input) input.value = tbPayload[key] ?? ''
  // Discarding a date reverts the draft, so the pair's bound reverts with it.
  if (key === 'estimatedInstallationDate' || key === 'estGoLiveDate') refreshTbDateBounds()
  // Discarding a cost input reverts it too, and runTbCostPreview clears the
  // preview outright once nothing that feeds the cost is dirty any more.
  if (TB_COST_INPUT_KEYS.includes(key)) scheduleTbCostPreview()
  updateTbSaveBar()
}

function onTbFieldInput(key) {
  const edit = tbEdits[key]
  if (!edit) return
  edit.draft = document.getElementById(`tb-input-${key}`).value
  document.getElementById(`tb-edit-${key}`).classList.toggle('dirty', edit.draft !== edit.orig)
  // The pair's bound depends on both drafts, so moving either one moves the
  // other's limit. This is the line that stops the bound going stale.
  if (key === 'estimatedInstallationDate' || key === 'estGoLiveDate') refreshTbDateBounds()
  // Round 17A Phase 6: a cost input moving means the totals on screen are out
  // of date. Debounced, so this is one call per pause and not one per digit.
  if (TB_COST_INPUT_KEYS.includes(key)) scheduleTbCostPreview()
  updateTbSaveBar()
}

// Round 5 Phase 5 (2026-08-17): investigated first, per the brief, by
// reading this function as it stood before touching it - confirmed the
// bar (a fully clickable Save button included, unlike Opportunity's own
// equivalent, refFieldRow's updateRefEditBar, which at least hides ITS
// Save button until dirtyCount > 0) appeared the instant ANY field was
// opened, gated on keys.length, not on any real change. That's the
// opposite of "opening a field and leaving it unchanged should have zero
// visible effect" - confirmed live before this fix, not assumed. Fixed
// by gating the bar's own visibility on dirtyCount instead, and the "N
// fields open, M changed" text is gone entirely (the brief's own
// instruction for this consolidated page specifically, not applied to
// Opportunity's Reference tab, which keeps its existing, different
// behaviour unless a future round asks for it there too).
// Round 7 Phase 6: the save-bar banner is gone and Cancel / Save changes
// now live in the tab row, so this toggles the two buttons rather than a
// container. Both prior behaviours are preserved deliberately, not
// reverted:
//
//  - Dirty-gating (Round 5 Phase 5): visibility keys off dirtyCount, not
//    off whether any field is OPEN, so opening a field and leaving it
//    unchanged still has zero visible effect.
//  - Stay-visible-while-invalid (Round 7 Phase 2.1): an invalid field
//    keeps the controls on screen even at dirtyCount 0, because
//    tb-save-feedback sits alongside them and hiding the controls would
//    hide the message explaining the block.
function updateTbSaveBar() {
  const dirtyCount = Object.values(tbEdits).filter(e => e.draft !== e.orig).length
  const show = dirtyCount > 0 || tbInvalidFields.size > 0

  const saveBtn = document.getElementById('tb-save-all')
  const cancelBtn = document.getElementById('tb-cancel-all')
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !show)
  if (saveBtn) {
    saveBtn.classList.toggle('hidden', !show)
    // Round 7 Phase 2.1: an invalid numeric field disables Save outright,
    // rather than letting the value travel to the server to be refused.
    saveBtn.disabled = tbInvalidFields.size > 0
  }
}

async function saveTbFields() {
  clearTbSaveFeedback()
  const feedback = document.getElementById('tb-save-feedback')

  // Second half of the Phase 2.1 guard, and it must come BEFORE the
  // not-dirty early return below: saveTbFields() is reachable from the
  // keyboard handler, and clearTbSaveFeedback() above has already wiped
  // the screen, so returning first would leave an invalid field with no
  // visible reason why nothing happened.
  if (tbInvalidFields.size) {
    renderTbValidationFeedback()
    return
  }

  const dirtyEntries = Object.entries(tbEdits).filter(([, e]) => e.draft !== e.orig)
  if (!dirtyEntries.length) return

  // SCORES (Round 11 Phase 3, 2026-08-19). Detected here, automatically, the
  // moment Save is clicked with a score among the dirty fields - the exact
  // shape Round 3 Phase 3 built for Est. Close Date, and the reason this is
  // an interception rather than a separate "record score" button.
  //
  // Any other dirty fields from the same Save click are HELD until the scores
  // are recorded, then saved together in one action. That is Est. Close
  // Date's own behaviour, and it is what keeps Cancel honest: cancelling the
  // dialogue leaves every edit exactly where it was, including this one.
  //
  // ROUND 11A PHASE 1: `.filter()`, NOT `.find()`. The original took ONE score
  // and passed every other dirty entry to saveTbDirtyEntries, which PATCHes
  // them as ordinary payload fields - and the score keys are deliberately
  // absent from TEST_BED_WRITABLE_KEYS, which is what makes the series
  // append-only. So scoring N criteria and pressing Save once recorded the
  // first and rejected the rest with "payload contains fields that cannot be
  // set from this endpoint", taking any unrelated dirty field down with them.
  //
  // Found by the business in use. It was never exercised in Round 11 because
  // Phase 8's own driver scored one criterion and saved, then the next, which
  // is not how anyone uses it.
  // A DEPARTURE FROM THE BRIEF'S THREE REQUIREMENTS, stated rather than
  // slipped in. The brief asks that further SCORING be blocked. Without this
  // guard the fault is still reachable in one click: select a 2, press Save
  // immediately, and the batch is refused server-side exactly as before,
  // which is the outcome this phase exists to remove. Save stays ENABLED and
  // refuses with a reason rather than being disabled, because a dead control
  // with no explanation is the failure mode Round 12 Phase 3 argued against.
  // The server call is not made at all, so the server rule is untouched and
  // simply not reached.
  const awaiting = tbScoreAwaitingReason()
  if (awaiting) {
    const name = tbScoringCriteria.find(c => c.criterion_key === awaiting)?.name ?? awaiting
    const feedback = document.getElementById('tb-save-feedback')
    if (feedback) {
      // The message names WHICH condition applies, because the two read
      // differently to a user: a low score asks what is missing, a revision
      // asks what changed. One field, one requirement, two honest phrasings.
      const low = Number(tbEdits[awaiting]?.draft) <= 2
      feedback.textContent = low
        ? `A Reason is required at a score of 1 or 2. Add the Reason for ${name}, naming what is missing.`
        : `A Reason is required when revising a score. Add the Reason for ${name}, naming what changed.`
      feedback.className = 'msg-error'
    }
    const ta = document.getElementById(`tb-score-reason-${awaiting}`)
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
    return
  }

  const scoreKeys = tbScoreKeys()
  const scoreEntries = dirtyEntries.filter(([key]) => scoreKeys.has(key))
  if (scoreEntries.length) {
    await recordTbScores(scoreEntries,
      dirtyEntries.filter(([key]) => !scoreKeys.has(key)))
    return
  }

  await saveTbDirtyEntries(dirtyEntries)
}

// SPLIT OUT of saveTbFields, Round 11 Phase 3, so recordTbScore can reuse the
// exact same payload-merge and freshness-check logic for whatever else was
// dirty in the same Save click, once the reason is confirmed - not a second,
// drifting copy of it. Directly mirrors performGenericRefSave, which Round 3
// Phase 3 split out of saveRefFields for the identical reason.
async function saveTbDirtyEntries(dirtyEntries) {
  const feedback = document.getElementById('tb-save-feedback')
  if (!dirtyEntries.length) return

  // Origin-contact freshness check (Round 2 Phase 1, 2026-08-16) - same
  // pattern already proven for Opportunity's Duration field. Untouched is
  // already safe by construction: dirtyEntries only ever includes fields
  // actually opened and changed, initialLead is never resent unless the
  // user edited it themselves, so an unrelated save can't silently
  // revert it. This check only fires for a genuine edit to initialLead
  // specifically, confirming the server's current value still matches
  // what this tab loaded with before committing.
  const initialLeadEntry = dirtyEntries.find(([key]) => key === 'initialLead')
  if (initialLeadEntry) {
    const fresh = await api('GET', `/api/test-beds/${tbDetailId}`)
    if (!fresh.ok) {
      feedback.textContent = 'Could not verify the current Initial Lead value before saving.'
      feedback.className = 'msg-error'
      return
    }
    const serverValue = fresh.data.payload?.initialLead ?? ''
    if (serverValue !== initialLeadEntry[1].orig) {
      feedback.textContent = 'Initial Lead was changed elsewhere since this tab was loaded. Reload the page before saving.'
      feedback.className = 'msg-error'
      return
    }
  }

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
    clearTbSaveFeedback()
  })
  document.getElementById('tb-save-all').addEventListener('click', saveTbFields)
  document.getElementById('tb-usecase-add').addEventListener('click', () => window.addTbUseCase())
  document.getElementById('tb-install-note-add').addEventListener('click', () => window.addTbInstallNote())
  document.getElementById('tb-note-add').addEventListener('click', () => window.addTbNote())
}

// Round 8 Phase 1: restore fields left open across a re-render.
//
// initTestBedDetailPanel rebuilds all four panels' innerHTML and used to
// reset tbEdits to {} unconditionally. Six call sites in this file
// re-enter it mid-session (adding a note, saving fields, linking a buyer,
// completing a document, adding a use case, adding an install note), each
// via loadTestBedDetail(), whose own GET is a real network round trip. The
// old rows stay on screen and fully clickable for the whole of that trip,
// so a field opened during it was destroyed the instant the response
// landed: input element replaced, focus dropped to BODY, and anything
// typed silently discarded. The user sees a field that looked like it
// responded, refuses to accept typing, and works on a second click.
//
// That is the same "never silently discard real unsaved input" rule this
// build has applied to New Lead, Park, Est. Close Date and the four
// contact-detail side-effect reloads (INTERACTION_STANDARDS section 5) -
// this was the one path where a reload could still throw an edit away with
// no confirmation and no trace.
//
// The draft is preserved, not the whole edit record: `orig` is deliberately
// re-read from the FRESH payload, so dirty state is computed against what
// the server now holds rather than against what it held before the reload.
// If the reload brought the same value the user was typing, the field
// correctly becomes clean.
function captureTbOpenEdits() {
  const active = document.activeElement
  const focusedKey = active && active.id && active.id.startsWith('tb-input-')
    ? active.id.slice('tb-input-'.length)
    : null
  let selection = null
  if (focusedKey) {
    // setSelectionRange/selectionStart throw on some input types (number,
    // date) in some browsers - a caret position is a nicety, never a reason
    // to lose the edit itself.
    try { selection = { start: active.selectionStart, end: active.selectionEnd } } catch { selection = null }
  }
  return { edits: { ...tbEdits }, focusedKey, selection }
}

function restoreTbOpenEdits(captured) {
  if (!captured) return []
  const restored = []
  for (const [key, edit] of Object.entries(captured.edits)) {
    // A field can legitimately vanish across a re-render (a stage-scoped
    // panel, a row removed by the reload). Skip it rather than throwing.
    if (!document.getElementById(`tb-display-${key}`) || !document.getElementById(`tb-input-${key}`)) continue
    window.openTbField(key)
    const live = tbEdits[key]
    if (!live) continue
    const input = document.getElementById(`tb-input-${key}`)
    input.value = edit.draft
    live.draft = edit.draft
    document.getElementById(`tb-edit-${key}`).classList.toggle('dirty', live.draft !== live.orig)
    restored.push(key)
  }

  if (captured.focusedKey && restored.includes(captured.focusedKey)) {
    const input = document.getElementById(`tb-input-${captured.focusedKey}`)
    if (input) {
      input.focus()
      if (captured.selection) {
        try { input.setSelectionRange(captured.selection.start, captured.selection.end) } catch { /* not supported on this input type */ }
      }
    }
  }
  if (restored.length) updateTbSaveBar()
  return restored
}

// ── Entry point, called by app.js's renderTestBedDetail() ─────────────────
window.initTestBedDetailPanel = function (bed) {
  wireTbOnce()
  // Captured BEFORE tbEdits is reset and before any panel is rebuilt.
  const carried = captureTbOpenEdits()

  tbDetailId = bed.id
  tbBed = bed
  tbPayload = bed.payload ?? {}
  tbEdits = {}
  tbAccountContacts = []

  // Round 17A Phase 6: BEFORE renderTbCommercials, not after it.
  //
  // A load means the stored figures are current, so any preview from before it
  // is discarded. Clearing this after the render left the just-saved card
  // still wearing the "unsaved" marker, because renderTbCostBreakdown had
  // already read the old preview and nothing rendered again afterwards. The
  // order is the whole fix. If the reload restored open cost edits, the line
  // after restoreTbOpenEdits puts the preview back.
  tbCostPreview = null

  renderTbReference()
  renderTbSiteDetails()
  renderTbInstallSection()
  renderTbCommercials()
  updateTbSaveBar()
  wireTbFieldInputs()
  refreshTbDateBounds()

  // After wireTbFieldInputs, so restored inputs carry the same listeners
  // (including the Round 7 Phase 2.1 numeric validity guard) as any other.
  restoreTbOpenEdits(carried)
  // Round 17A Phase 6: a reload that restored dirty cost fields has drafts on
  // screen again, so the preview belongs back with them.
  if (tbCostFieldsDirty()) scheduleTbCostPreview()
}

// ── Units (Round 17 Phase 2) ──────────────────────────────────────────────
//
// Three sub-tab panes by TYPE, with each type's units as a LIST inside its
// pane. createSubTabs' second consumer, per Round 16 Phase 1, which built it
// for exactly this and argued that a standalone strip would make three
// implementations. One tab per unit was refused: see the markup comment.
//
// A TABLE rather than a stack of cards, because this renders 1 unit as often
// as 24 and a card per unit is unreadable at the top of that range. Columns
// are fixed and narrow so a row scans horizontally in one pass.
const UNIT_TYPES = ['SafeSight', 'Air Quality', 'HEMIR']

// The sub-tab key is the type with its spaces stripped, which is what the
// strip is built with. Derived from UNIT_TYPES so the strip and this lookup
// cannot disagree about what a key means.
//
// Declared HERE, after UNIT_TYPES. It was first placed beside
// COUNT_KEY_FOR_UNIT_TYPE 1800 lines earlier, where UNIT_TYPES is still in its
// temporal dead zone, and the ReferenceError killed the whole script at load:
// every Test Bed screen went blank, not just this control.
const UNIT_TYPE_FOR_TAB_KEY = Object.fromEntries(
  UNIT_TYPES.map(t => [t.replace(/\s+/g, ''), t]))
const UNIT_STATES = ['Planned', 'Installed', 'Faulty', 'Removed']
let tbUnits = []

function tbUnitRow(u) {
  const opt = s => `<option value="${s}"${u.state === s ? ' selected' : ''}>${s}</option>`
  return `
    <tr data-unit-id="${u.id}">
      <td class="tb-unit-index">${escHtml(String(u.index ?? ''))}</td>
      <td><input type="text" class="tb-unit-field" data-field="serialNumber"
                 value="${escHtml(u.serialNumber ?? '')}" placeholder="Not recorded"></td>
      <td><input type="text" inputmode="decimal" class="tb-unit-field" data-field="latitude"
                 value="${escHtml(u.latitude ?? '')}" placeholder="Latitude"></td>
      <td><input type="text" inputmode="decimal" class="tb-unit-field" data-field="longitude"
                 value="${escHtml(u.longitude ?? '')}" placeholder="Longitude"></td>
      <td><select class="tb-unit-field" data-field="state">${UNIT_STATES.map(opt).join('')}</select></td>
      <td class="tb-unit-feedback"></td>
    </tr>`
}

function renderTbUnitPane(pane, type) {
  const rows = tbUnits.filter(u => u.type === type)
  if (!rows.length) {
    pane.innerHTML = `<p class="empty-state">No ${escHtml(type)} slots. They derive from the count on Commercials.</p>`
    return
  }
  pane.innerHTML = `
    <table class="tb-units-table">
      <thead><tr><th>#</th><th>Serial</th><th>Latitude</th><th>Longitude</th><th>State</th><th></th></tr></thead>
      <tbody>${rows.map(tbUnitRow).join('')}</tbody>
    </table>`
}

// Saved per field on change, not through the page's batched save bar. Same
// reasoning as Installer and Tech Team directly above: each unit is its own
// record with its own endpoint, so a page-level Save would be collecting
// edits across records that do not share a save.
//
// SAVE-ON-BLUR IS DELIBERATELY UNCHANGED HERE. The business has flagged the
// inconsistency with the rest of the app's batched Save bar as something to
// discuss, and a discussion is not a decision. Round 17A Phase 2 fixes the
// write path's safety and touches the interaction pattern not at all.
//
// ONE WRITE AT A TIME PER ROW (Round 17A Phase 2, 2026-08-21).
//
// Phase 1 made overlapping writes atomic, so two PATCHes carrying DIFFERENT
// keys now both land. That is not the whole problem. Two PATCHes carrying the
// SAME key resolve last-writer-wins by arrival, not by intent, and atomicity
// cannot address that: both writes are individually correct and one of them
// is simply stale. Measured before this guard existed, at 12 trials per
// spacing, the older value won 1 time in 60 - rare, silent, and a wrong
// serial number on an installed device.
//
// The queue is per unit id, so two rows never wait on each other, and a
// 24-row table still saves 24 rows concurrently. Within one row the writes
// run in the order the user made them, which is what makes the last edit the
// one that survives.
//
// The value is captured HERE, at the change event, not read inside the queued
// task. Reading it later would take whatever the input happened to hold when
// the task ran, which is the same stale-read shape Phase 1 removed from the
// server.
//
// Nothing is dropped or coalesced. A user cannot outrun this guard; they can
// only lengthen the queue, and the cost of lengthening it is latency rather
// than a lost write. See the drain reporting below.
const tbUnitWriteQueues = new Map()

function tbUnitWriteQueue(unitId) {
  let q = tbUnitWriteQueues.get(unitId)
  if (!q) {
    // failures is keyed BY FIELD and deliberately outlives the burst. See
    // tbUnitSettleRow for why a burst-scoped failure flag is not enough.
    q = { chain: Promise.resolve(), pending: 0, failures: new Map() }
    tbUnitWriteQueues.set(unitId, q)
  }
  return q
}

// The status cell is SHARED BY EVERY FIELD IN THE ROW, so one cell has to
// describe up to four fields, and the naive rule - each write sets it as it
// finishes - lets a later success erase an earlier refusal. Phase 0 caught
// the concurrent form of that: two of three PATCHes refused and the row
// reading "Saved", because the one that succeeded finished last.
//
// A BURST-SCOPED FLAG IS NOT ENOUGH, measured rather than assumed. Settling
// once per drain fixes the concurrent case and leaves the sequential one,
// which is the commoner one: an invalid latitude is refused in about 40ms,
// well before the operator has finished typing the longitude, so the two
// writes never overlap. The row showed the error, then the longitude's write
// drained separately and replaced it with "Saved" while the latitude sat
// unsaved on screen.
//
// So failures are tracked PER FIELD and cleared only by a later successful
// write to that same field. The row says "Saved" when every field's most
// recent write succeeded, and otherwise names what is still wrong. A refusal
// stays visible until it is actually resolved.
function tbUnitSettleRow(unitId, q) {
  const cell = document.querySelector(`#tb-units tr[data-unit-id="${unitId}"] .tb-unit-feedback`)
  if (!cell) return
  if (q.failures.size) {
    // The first unresolved failure, not the most recent: the earliest thing
    // that went wrong is the one to fix first, and the messages already name
    // their own field.
    cell.textContent = [...q.failures.values()][0]
    cell.className = 'tb-unit-feedback msg-error'
  } else {
    cell.textContent = 'Saved'
    cell.className = 'tb-unit-feedback'
  }
}

function onTbUnitFieldChange(e) {
  const input = e.target.closest('.tb-unit-field')
  if (!input) return
  const tr = input.closest('tr')
  const unitId = tr.dataset.unitId
  const field = input.dataset.field
  const value = input.value
  const cell = tr.querySelector('.tb-unit-feedback')

  const q = tbUnitWriteQueue(unitId)
  q.pending += 1
  cell.textContent = 'Saving'
  cell.className = 'tb-unit-feedback'

  q.chain = q.chain.then(async () => {
    const result = await api('PATCH', `/api/test-beds/${tbDetailId}/units/${unitId}`, { [field]: value })
    if (!result.ok) {
      q.failures.set(field, result.data?.error ?? 'Save failed')
      return
    }
    // This field is good again, so its outstanding refusal is resolved.
    q.failures.delete(field)
    const i = tbUnits.findIndex(u => u.id === unitId)
    if (i !== -1) tbUnits[i] = result.data
  }).catch(() => {
    // api() catches network faults and returns !ok, so reaching here means
    // something else threw. The queue must not break: a rejected link would
    // silently stop every later write for this row.
    q.failures.set(field, 'Save failed')
  }).then(() => {
    q.pending -= 1
    if (q.pending === 0) tbUnitSettleRow(unitId, q)
  })
}

// Round 17A Phase 3: how many slots each count implies, and how many of them
// do not exist yet. Shared by the create control and the reconcile line so
// the two can never disagree about what "missing" means.
function tbUnitShortfall() {
  const planned = [
    { type: 'SafeSight', n: Number(tbPayload.safesightCameras) || 0 },
    { type: 'Air Quality', n: Number(tbPayload.airQualitySensors) || 0 },
    { type: 'HEMIR', n: Number(tbPayload.hemirSensors) || 0 },
  ]
  const total = planned.reduce((t, p) => t + p.n, 0)
  const missing = planned.reduce(
    (t, p) => t + Math.max(0, p.n - tbUnits.filter(u => u.type === p.type).length), 0)
  return { planned, total, missing }
}

window.renderTbUnits = async function () {
  const mount = document.getElementById('tb-units')
  if (!mount || !tbDetailId) return
  const sub = document.getElementById('tb-units-sub')

  // READ ONLY on render. Round 17 Phase 3: this used to POST derive here, so
  // opening this tab created records, and once the count lock existed that
  // meant opening a tab locked a field on a DIFFERENT tab. Someone at Site
  // Assessment looking at what installation involves would have locked the
  // Commercials counts by looking. A write must not be the consequence of a
  // read.
  const listed = await api('GET', `/api/test-beds/${tbDetailId}/units`)
  if (!listed.ok) {
    mount.innerHTML = `<p class="empty-state">Unable to load units.</p>`
    if (sub) sub.textContent = ''
    return
  }
  tbUnits = listed.data ?? []

  // Nothing derived yet: show the counts and the control that creates the
  // slots. Pressing it is the act that locks the counts, so the lock is
  // attributable to a person and a moment rather than to a page view.
  if (!tbUnits.length) {
    const { planned, total } = tbUnitShortfall()
    delete mount.dataset.builtFor
    if (sub) sub.textContent = ''
    if (!total) {
      mount.innerHTML = '<p class="empty-state">No sensor counts are set on Commercials, so there are no unit slots to create.</p>'
      return
    }
    mount.innerHTML = `
      <p class="sub" style="margin-bottom:10px">${planned.filter(p => p.n).map(p => `${p.n} ${escHtml(p.type)}`).join(', ')}, from the counts on Commercials.</p>
      <p class="sub" style="margin-bottom:12px">Creating the unit slots locks these counts. Correcting one afterwards needs a reason.</p>
      <button class="btn-sm" id="tb-units-derive">Create ${total} unit slot${total === 1 ? '' : 's'}</button>
      <p id="tb-units-derive-feedback" class="tb-doc-feedback"></p>`
    document.getElementById('tb-units-derive').onclick = async () => {
      const btn = document.getElementById('tb-units-derive')
      const fb = document.getElementById('tb-units-derive-feedback')
      btn.disabled = true
      fb.textContent = 'Creating'
      const made = await api('POST', `/api/test-beds/${tbDetailId}/units/derive`)
      if (!made.ok) {
        btn.disabled = false
        fb.textContent = made.data?.error ?? 'Could not create the unit slots.'
        fb.className = 'tb-doc-feedback msg-error'
        return
      }
      await window.renderTbUnits()
    }
    return
  }

  // Round 17A Phase 3: the reconcile line.
  //
  // Raising a count now creates its slots server-side, in the same request as
  // the correction, so counts and slots normally cannot drift. They still can
  // if that derivation fails partway: the count is already written when it
  // runs, so a failure leaves the count raised and the slots short, and the
  // create control is gated on there being NO units at all, which is exactly
  // the state a partly-derived Test Bed is not in.
  //
  // That was the reachability defect this phase is named for, in its general
  // form: the only caller of a working idempotent endpoint disappeared the
  // moment it became useful. So the affordance is gated on there being work
  // to do rather than on there being nothing there, and it says how much.
  const { missing } = tbUnitShortfall()
  if (sub) {
    const n = tbUnits.length
    const base = `${n} unit${n === 1 ? '' : 's'}. These counts are locked on Commercials; correcting one needs a reason.`
    if (missing > 0) {
      sub.innerHTML = `${escHtml(base)} <span class="msg-error">${missing} slot${missing === 1 ? '' : 's'} named by the counts ${missing === 1 ? 'does' : 'do'} not exist yet.</span> <button class="btn-sm" id="tb-units-reconcile">Create ${missing} missing slot${missing === 1 ? '' : 's'}</button>`
      document.getElementById('tb-units-reconcile').onclick = async () => {
        const btn = document.getElementById('tb-units-reconcile')
        btn.disabled = true
        btn.textContent = 'Creating'
        const made = await api('POST', `/api/test-beds/${tbDetailId}/units/derive`)
        if (!made.ok) {
          btn.disabled = false
          btn.textContent = 'Could not create them. Try again'
          return
        }
        await window.renderTbUnits()
      }
    } else {
      sub.textContent = base
    }
  }

  // Rebuilt only when the mount is empty or the record changed, so a re-render
  // after a save does not snap the open type back to SafeSight.
  if (mount.dataset.builtFor !== String(tbDetailId)) {
    const built = window.createSubTabs({
      mount, label: 'Unit types',
      tabs: UNIT_TYPES.map(t => ({ key: t.replace(/\s+/g, ''), label: t })),
      // Round 18 Phase 2: the correction control is rebuilt for whichever type
      // the strip now shows, so the two can never name different types.
      onSelect: key => renderTbCountCorrection(UNIT_TYPE_FOR_TAB_KEY[key]),
    })
    mount.dataset.builtFor = String(tbDetailId)
    mount._panes = built.panes
    mount._strip = built.strip
    mount.addEventListener('change', onTbUnitFieldChange)
  }
  for (const t of UNIT_TYPES) renderTbUnitPane(mount._panes[t.replace(/\s+/g, '')], t)
  // On a REBUILD the strip's own construction selects the first tab and fires
  // onSelect, so the control is already correct. On a re-render of an existing
  // strip nothing fires, so the currently open tab is read back and used.
  // strip.current() is the API createTabStrip has exposed all along.
  renderTbCountCorrection(UNIT_TYPE_FOR_TAB_KEY[mount._strip?.current()] ?? UNIT_TYPES[0])
}


// The way out of the lock (Round 17 Phase 3).
//
// Not an unlock that silently discards units, and not a permanent lock: if
// ten of twelve are installed and the twelfth never arrives, the count is
// wrong and locked, and there has to be a way to say so.
//
// It lives HERE rather than on Commercials because this is where the units
// are: a person correcting a count is looking at what actually arrived.
// Phase 4 replaces the Commercials field with a line pointing here.
//
// THE REASON IS ENFORCED AT ENTRY, not at save, per Round 14 Phase 1: the
// Apply control stays disabled until a reason is typed, so the refusal is
// visible before the attempt rather than after it. The server refuses the
// same thing independently, since a client-only lock is an affordance.
// Round 18 Phase 2: the correction control acts on the type the TAB shows.
//
// The reported defect: Air Quality selected, the table correctly showing Air
// Quality rows, and this control reading "SafeSight (1 now)". Someone
// adjusting Air Quality corrects SafeSight without noticing, and because a
// correction carries a mandatory reason and writes an audit row, that is a
// recorded wrong decision rather than a slip.
//
// THE TYPE SELECTOR IS GONE, and that is the decision rather than a
// simplification. Syncing the dropdown to the tab would fix the reported case
// and leave the class: two controls selecting one concept can always be put
// into disagreement, and the next person to do it would be a user rather than
// a bug. The tab already selects the type and the table already follows it, so
// the tab is the selector and this control states which type it is acting on.
//
// What it costs, stated because it is a real cost: correcting a count for a
// type you are not looking at now takes one click on that type's tab first.
// That is the same click the table needs anyway to show what the correction
// is about, and correcting a count you cannot see is the hazard this removes.
function renderTbCountCorrection(type) {
  const host = document.getElementById('tb-units-correction')
  if (!host) return
  const rows = tbUnits.filter(u => u.type === type)
  // A type with no slots has no count to correct: the count is not locked, so
  // it is still an ordinary editable field on Commercials.
  if (!rows.length) { host.innerHTML = ''; return }
  host.innerHTML = `
    <p class="label" style="margin:20px 0 8px">Correct the ${escHtml(type)} count</p>
    <p class="sub" style="margin-bottom:10px">${rows.length} ${escHtml(type)} unit${rows.length === 1 ? '' : 's'} now. The count is a plan before installation and a record after it. Correcting one is recorded with your reason.</p>
    <div class="tb-count-correct">
      <input type="text" inputmode="numeric" id="tb-cc-count" placeholder="New count">
      <input type="text" id="tb-cc-reason" placeholder="Why is the count wrong?">
      <button class="btn-sm" id="tb-cc-apply" disabled>Apply</button>
    </div>
    <p id="tb-cc-feedback" class="tb-doc-feedback"></p>`
  const reason = document.getElementById('tb-cc-reason')
  const count = document.getElementById('tb-cc-count')
  const apply = document.getElementById('tb-cc-apply')
  const refresh = () => { apply.disabled = !reason.value.trim() || !count.value.trim() }
  reason.addEventListener('input', refresh)
  count.addEventListener('input', refresh)
  apply.onclick = async () => {
    const fb = document.getElementById('tb-cc-feedback')
    // `type` comes from the closure, which is the tab that was open when this
    // control was rendered, and the control is re-rendered on every switch.
    const key = COUNT_KEY_FOR_UNIT_TYPE[type]
    apply.disabled = true
    fb.className = 'tb-doc-feedback'
    fb.textContent = 'Applying'
    const result = await api('PATCH', `/api/test-beds/${tbDetailId}`,
      { payload: { [key]: count.value.trim() }, countCorrectionReason: reason.value.trim() })
    if (!result.ok) {
      fb.textContent = result.data?.error ?? 'Could not apply the correction.'
      fb.className = 'tb-doc-feedback msg-error'
      apply.disabled = false
      return
    }
    await loadTestBedDetail(tbDetailId)
  }
}
