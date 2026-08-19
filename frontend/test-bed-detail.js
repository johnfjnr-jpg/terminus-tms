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
// `number: true`, so no min/step and no .no-spinner, and the render call
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
const TB_INSTALL_FIELDS = [
  { key: 'installer', label: 'Installer' },
  { key: 'techTeam', label: 'Test Bed Tech Team' },
]
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
    const min = opts.noPast ? ` min="${new Date().toISOString().slice(0, 10)}"` : ''
    inputTag = `<input type="date" id="tb-input-${key}" value="${escHtml(v)}"${min}>`
  } else if (opts.number) {
    // integer (Round 5 Phase 4): min=0/step=1 are the native-constraint
    // half, .no-spinner (style.css, already shared with Opportunity's
    // Contract Duration) removes the up/down arrows that invite clicking
    // into a negative value one step at a time - same split as noPast
    // above, browser-level plus server-side, neither alone is trusted.
    const intAttrs = opts.integer ? ' min="0" step="1" class="no-spinner"' : ''
    inputTag = `<input type="number" id="tb-input-${key}" value="${escHtml(v)}"${intAttrs}>` +
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
    <div class="ref-field-display" id="tb-display-${key}" tabindex="0" onclick="openTbField('${key}',true)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTbField('${key}',true)}">${display}</div>
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
  renderTbUseCases()

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

function renderTbSiteDetails() {
  document.getElementById('tb-site-rows').innerHTML = TB_SITE_PANEL_KEYS.map(key => {
    const f = TB_SITE_FIELDS.find(x => x.key === key)
    return tbFieldRow(f.key, f.label, tbPayload[f.key], { options: f.options })
  }).join('')

  // Sensor count fields themselves are edited on the Commercials tab now
  // (renderTbSensorCounts) - this list is still read directly off the
  // same tbPayload keys regardless of which tab edits them.
  renderTbSensors()
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
  renderTbInstallNotes()
}

// Round 6 Phase 3 (2026-08-17): sensor counts, moved from Site Details.
// Same tbFieldRow/tbEdits mechanism as every other field on this page,
// TB_SENSOR_COUNT_FIELDS is already folded into TB_ALL_EDITABLE_FIELDS
// so wireTbFieldInputs() wires these for free, no separate wiring
// needed.
function renderTbSensorCounts() {
  document.getElementById('tb-sensor-count-rows').innerHTML =
    TB_SENSOR_COUNT_FIELDS.map(f => tbFieldRow(f.key, f.label, tbPayload[f.key], { number: f.number, integer: f.integer })).join('')
}

// Sensors list: "generated" per PROTOTYPE_SPECIFICATION.md Section 6, but
// the real Device-link mechanism that would back real status/lat-long/
// photo data is explicitly not connected to Test Bed in this build (its
// own "Known dependency" section - that's Asset Management's deferred
// work). Generating names from the real, typed counts is honest; a
// status/location/photo would not be, so those stay an explicit "Not
// yet linked" rather than invented.
// Round 10 Phase 8 (2026-08-19): a Show Sensors toggle, and one panel per
// sensor instead of a flat list.
//
// CONTENTS ARE DELIBERATELY MINIMAL AND NOTHING IS INVENTED. Each panel
// carries the sensor's identity and the "not yet linked to a real device"
// state that was already there, and that is the complete set of what this
// system knows about an individual sensor. The counts are plain typed
// numbers on the Test Bed's payload; no device record exists to join to, so
// there is no serial, no location, no status and no install date to show.
// The panel says it has room for detail rather than filling it with
// plausible-looking blanks - an empty field labelled "Serial" would imply a
// serial exists and has not been entered, which is false.
//
// This is the visible surface of a real gap, not a layout change. See
// DESIGN_PRINCIPLES: the linkage mechanism already exists in the prototype
// (applyDeviceLink/linkTargetOptions) and belongs to Asset Management.
let tbSensorsExpanded = false

window.toggleTbSensors = function () {
  tbSensorsExpanded = !tbSensorsExpanded
  renderTbSensors()
}

function tbSensorList() {
  const counts = [
    { prefix: 'SafeSight Camera', n: Number(tbPayload.safesightCameras) || 0 },
    { prefix: 'Air Quality Sensor', n: Number(tbPayload.airQualitySensors) || 0 },
    { prefix: 'HEMIR Sensor', n: Number(tbPayload.hemirSensors) || 0 },
  ]
  const rows = []
  for (const c of counts) {
    for (let i = 1; i <= c.n; i++) rows.push(`${c.prefix} ${i}`)
  }
  return rows
}

function renderTbSensors() {
  const rows = tbSensorList()
  const el = document.getElementById('tb-sensors-list')
  const toggle = document.getElementById('tb-sensors-toggle')
  if (!el) return

  if (!rows.length) {
    if (toggle) { toggle.textContent = ''; toggle.classList.add('hidden') }
    el.innerHTML = '<p class="empty-state">No sensor counts set yet.</p>'
    el.dataset.sensors = '0'
    return
  }

  if (toggle) {
    toggle.classList.remove('hidden')
    toggle.textContent = tbSensorsExpanded ? 'Hide sensors' : `Show sensors (${rows.length})`
    toggle.onclick = () => window.toggleTbSensors()
  }
  el.dataset.sensors = String(rows.length)
  el.dataset.expanded = tbSensorsExpanded ? 'true' : 'false'

  if (!tbSensorsExpanded) {
    el.innerHTML = ''
    return
  }

  el.innerHTML = `<div class="tb-sensor-grid">` + rows.map(name => `
    <div class="tb-sensor-panel" data-sensor="${escHtml(name)}">
      <p class="tb-sensor-name">${escHtml(name)}</p>
      <p class="tb-sensor-state">Not linked to a device</p>
    </div>`).join('') + `</div>
    <p class="tb-sensor-note">Per-sensor detail is not held anywhere yet. These panels carry the sensor's identity only, and gain real content when Asset Management links each one to a device record.</p>`
}

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
  const b = tbBed.costBreakdown
  if (!b) {
    el.innerHTML = '<p class="empty-state">Unable to load cost breakdown.</p>'
    return
  }

  const g = b.groups
  const rowCost = (group, key) => group.rows.find(r => r.key === key)?.rawCost ?? 0
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

  el.innerHTML = `
    <div class="tb-cost-total">
      ${line(`Hosting x ${b.months} month${b.months === 1 ? '' : 's'}`, b.hostingTermCost)}
      <div class="data-row" style="border-top:1px solid var(--hairline-strong);margin-top:10px;padding-top:10px">
        <span style="font-size:15px;font-weight:500;color:var(--white)">Total Cost</span>
        <span style="font-size:15px;font-weight:500;color:var(--white)">${formatCost(b.totalCost)}</span>
      </div>
    </div>

    <div class="ref-cards">
      ${section('Hardware', [
        line(`SafeSight (${tbPayload.safesightCameras || 0} x ${formatCost(tbPayload.ssUnitCost || 0)})`, rowCost(g.hardwareGroup, 'hwSs')),
        line(`Air Quality (${tbPayload.airQualitySensors || 0} x ${formatCost(tbPayload.aqUnitCost || 0)})`, rowCost(g.hardwareGroup, 'hwAqm')),
        line(`HEMIR (${tbPayload.hemirSensors || 0} x ${formatCost(tbPayload.hemirUnitCost || 0)})`, rowCost(g.hardwareGroup, 'hwHemir')),
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
    return
  }
  const { to_stage, requirements } = result.data
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
  const rows = requirements.map(r => {
    const tickable = r.requirement_type === 'payload_field_required'
      && TB_EXIT_CRITERION_KEYS.has(r.field)
      && !!r.label
    const label = escHtml(r.label ?? r.message)
    const mark = r.met ? '<span class="tb-crit-box tb-crit-box--met">&#10003;</span>' : '<span class="tb-crit-box"></span>'

    if (tickable) {
      return `<div class="tb-crit-row tb-crit-row--tickable" data-field="${escHtml(r.field)}" onclick="toggleExitCriterion('${escHtml(r.field)}', ${r.met ? 'true' : 'false'})" title="${r.met ? 'Tick to clear' : 'Tick to confirm'}">
        ${mark}<span class="tb-crit-text">${label}</span>
      </div>`
    }
    // Document and field requirements are computed, so they are read-only
    // rows. Presenting them as tick boxes would invite a click that
    // cannot do anything.
    return `<div class="tb-crit-row tb-crit-row--computed">
      ${mark}<span class="tb-crit-text">${escHtml(r.message)}</span>
    </div>`
  }).join('')

  const outstanding = requirements.filter(r => !r.met).length
  const summary = outstanding === 0
    ? `<p class="sub" style="margin-bottom:10px">All criteria met - ready to move to ${escHtml(to_stage)}.</p>`
    : `<p class="sub" style="margin-bottom:10px">${outstanding} of ${requirements.length} outstanding to move to ${escHtml(to_stage)}:</p>`

  el.innerHTML = summary + rows
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
  'exitQualDataAndUseCase',
  'exitQualPhysicalSuitability',
  'exitQualPartnerCommitment',
  'exitMonAllMeetingActionsCompleted',
])

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
  // <input type="number"> reports '' for text it cannot parse at all.
  // An empty field is "not set", which is a legitimate state here.
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

function renderTbValidationFeedback() {
  const feedback = document.getElementById('tb-save-feedback')
  if (!feedback) return
  if (tbInvalidFields.size) {
    feedback.textContent = [...tbInvalidFields.values()].join('. ') + '.'
    feedback.className = 'msg-error'
  } else if (feedback.className === 'msg-error') {
    // Only clear feedback this function itself put there, so a real
    // save error from the server is not wiped by an unrelated keystroke.
    feedback.textContent = ''
    feedback.className = ''
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
window.openTbField = function (key, fromUserGesture) {
  if (tbEdits[key]) return
  const orig = String(tbPayload[key] ?? '')
  tbEdits[key] = { draft: orig, orig }
  document.getElementById(`tb-display-${key}`).classList.add('hidden')
  document.getElementById(`tb-edit-${key}`).classList.remove('hidden')
  const input = document.getElementById(`tb-input-${key}`)
  window.revealFieldControl(input, fromUserGesture)
  // Clear a stale error from an earlier, unrelated failed save (2026-08-15
  // fix) - tb-save-feedback previously only got reset at the top of
  // saveTbFields(), so a real failure (e.g. Summary rejected by the
  // writable-keys check) stayed on screen indefinitely, reappearing the
  // instant any other field was opened next, since opening a field makes
  // the save bar visible again without ever touching this text.
  clearTbSaveFeedback()
  updateTbSaveBar()
}

function clearTbSaveFeedback() {
  const feedback = document.getElementById('tb-save-feedback')
  feedback.textContent = ''
  feedback.className = ''
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

  renderTbReference()
  renderTbSiteDetails()
  renderTbInstallSection()
  renderTbCommercials()
  updateTbSaveBar()
  wireTbFieldInputs()

  // After wireTbFieldInputs, so restored inputs carry the same listeners
  // (including the Round 7 Phase 2.1 numeric validity guard) as any other.
  restoreTbOpenEdits(carried)
}
