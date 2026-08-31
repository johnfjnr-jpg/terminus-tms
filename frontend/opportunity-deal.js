// Opportunity Commercials tab: live client-side deal preview + save.
//
// Imports the exact same deal-calculator.js the server uses (served at
// /lib/deal-calculator.js from src/lib/deal-calculator.js via the static
// mount in server.js) so preview math can never drift from the server's
// authoritative recompute — same file on disk, not a copy.
//
// This module only ever previews and saves the working payload (PATCH).
// Submit Deal (POST /api/deals/submit, the authoritative recompute-and-
// snapshot step) was removed from this tab (Round 3 Phase 4, 2026-08-17)
// - confirmed safe first: nothing else in the app reads its audit_log
// action ('deal_submitted'), no stage_gate_rules row references
// record_type='deal', and the button's own click handler did nothing
// beyond calling this endpoint, no stage transition, no approval routing.
// The backend endpoint itself (src/routes/deals.js) is untouched, "for
// now" per the brief - unreachable from the UI, not deleted, since it
// already implements the real recompute-integrity principle
// DESIGN_PRINCIPLES.md Section 5 describes as needed once a genuine
// submit/approval workflow for the Deal Sheet is designed.
import { calculateDeal } from '/lib/deal-calculator.js'
import { catalogToRates } from '/lib/base-costs.js'
import { stalenessBand, ageInDays } from '/lib/cost-basis.js'
import { toNumberOrNull, numericOrDefault, NUMERIC_DEFAULTS, WRITABLE_NUMERIC_KEYS } from '/lib/numeric-payload.js'
import { changedKeys } from '/lib/payload-diff.js'
// Round 38: the ONE translation, shared with the submit route and the
// approval page. It reads catalog rates as ordinary payload keys, which is
// exactly what readPayload() puts there.
import { buildDealInputs, gstPresentation, whtPresentation, durationPresentation, marginPresentation, closingCashPresentation, perMonthFigure } from '/lib/deal-inputs.js'
import { LATCH_PANELS, panelSignal, signalSentence } from '/lib/latches.js'
import { reasonPromptFor } from '/lib/version-reason.js'
import { scheduleReconciliation, refusalStatement } from '/lib/milestone-schedule.js'
import { resolveRates, frozenRates } from '/lib/rate-resolution.js'

let opportunityId = null
let wired = false
// Contract Duration is the same field as the Reference tab's own "Contract
// Duration (months)", two edit surfaces for one value. From Round 38 the
// protection against one overwriting the other is the record-level precondition
// below, not a per-field flag: the whole save is conditional on the record
// still being at the revision this screen loaded.
// The revision this screen loaded, and the precondition every save carries.
// Updated after a successful save, because that save IS the new revision.
// Save Changes activation (Round 3 Phase 4, 2026-08-17) - btn-save-deal
// was previously always enabled regardless of whether anything on this
// tab had actually changed, confirmed by direct inspection, not
// scoped to one specific field's own freshness-check needs, not a
// general "has this tab changed" signal.
// Milestone 5: opportunity_details.test_bed_cost, not part of
// record_revisions.payload - set once at conversion, read-only here,
// carried into buildDealInputs() so live preview matches the server's
// own loadDealInputsFromOpportunity() in deals.js exactly (same file
// import already guarantees the calculation itself can't drift; this is
// the one input source deals.js reads that payload alone doesn't cover).
let testBedCost = 0

// ── Base Cost Data, Round 36 Phase 2 ──────────────────────────────────────
//
// The rates the Commercials tab prices from. Until this round they were read
// from the Opportunity's own payload, where nothing ever wrote them: Phase 0
// found all four live Opportunities carrying zero rate keys, the ten keys
// refused by SALESPERSON_WRITABLE_KEYS since the allowlist was created, and
// every figure on this tab computing correctly from inputs that did not exist.
//
// Held here rather than merged into the payload on load. The rates must not
// become payload keys again: pickSalespersonWritable() strips them at save and
// the server refuses them anyway, but the reason is not the allowlist. A rate
// in the payload is a per-deal cost basis, which is the divergence this round
// exists to end, and Test Bed still shows what it looks like - ten of 39
// hand-typed values disagreeing with the catalog.
//
// catalogMissing carries the products the catalog did not supply. An absent
// rate is NOT zero: a zero unit cost and a missing one produce the same $0 on
// screen, and telling them apart is the whole finding of Phase 0.
let catalogRates = {}
let catalogBatches = {}
let catalogMissing = []
let catalogLoaded = false
let catalogAsOf = null
let catalogError = null

// UI-only state not captured by a plain input/select element.
const uiState = {
  installResp: 'Client Own Installation Team',
  structure: 'twoPhase',
  invoicing: 'annual',
  grossUp: false,
  factoringEnabled: false,
  factoringMethod: 'straight',
}

const MARGIN_KEYS = ['hwSs', 'hwAqm', 'hwHemir', 'hwWarranty', 'inSsEx', 'inSsNew', 'inAqm', 'inHemir', 'hoSs', 'hoAqm', 'hoHemir']

// ── THE PER-LINE MARGIN MODEL IS SUPERSEDED. Round 40 Phase 1 ──────────────
//
// Round 36 gave every priced line its own margin cell, eleven of them. The
// business has now decided the better model: TARGET MARGIN IS THE DEFAULT FOR
// EVERY COMPONENT, viewable and editable on request rather than always on
// screen. Recorded as a supersession, not as drift: the per-line model was
// stated explicitly two rounds ago and a better one has been stated since.
//
// MEASURED BEFORE REMOVING, and the data settles the argument the reasoning
// only asserted. Of 488 opportunities, 33 carry any per-line override and NONE
// of the four live ones do. Of 129 Deal Sheet versions, 31 carry one and NONE
// is issued. Per key: hwSs 32, hwAqm 7, hoAqm 1, and the other eight zero.
//
// hwWarranty is one of the eight zeroes. "A margin on the warranty line was
// never a real decision" is therefore measured rather than asserted: in 488
// opportunities nobody has ever set one.
//
// The eleven CONTROLS are gone. The payload key is not: three consumers read it
// and keep working, all from the payload rather than the screen -
// buildDealInputs's marginFor() fallback, the approval page's buildTarget
// "below target" list, and the server's validator.
//
// A CONSEQUENCE STATED RATHER THAN DISCOVERED, and it is the business's own
// note: between this phase and Phase 3 there is NO per-line margin adjustment
// anywhere. Acceptable here because no live deal uses one and target margin
// covers every component, and if a deal needs one in that window the answer is
// the payload, not the screen.
let loadedMarginOverrides = {}
const MILESTONE_ROWS = 5

// A blank box is NULL, not 0. Round 38, before the Phase 2 reshape.
//
// This returned 0 for a blank input since the file's first commit, which made a
// deal with no target margin indistinguishable from a deal priced at cost, and
// wrote that 0 into the record. Three separate defects on this tab have now had
// that coercion underneath them.
//
// num() is kept for the values that are genuinely counts of things on screen
// and where a blank truly is none. Everything the record stores goes through
// numOrNull().
function num(id) {
  const v = parseFloat(document.getElementById(id)?.value)
  return Number.isFinite(v) ? v : 0
}

// The read boundary, shared with the server through /lib/numeric-payload.js.
// Accepts a number, a numeric string (which the Reference tab wrote for
// duration until this change), null or ''. Returns a number or null.
// A select's unchosen state is the empty string, which is not absence to
// anything downstream: `'' ?? x` is `''`, and `'bidCurrency' in payload` is
// true. Null is the absence the rest of the module already understands.
function emptyToNull(id) {
  const v = document.getElementById(id)?.value
  return v === '' || v === undefined ? null : v
}

// Sets a select from a stored value, leaving it on the empty option when there
// is none. `el.value = undefined` would silently select nothing in some engines
// and the first option in others, so the absent case is written out.
function setCurrencySelect(id, stored) {
  const el = document.getElementById(id)
  if (!el) return
  el.value = (stored === undefined || stored === null) ? '' : stored
}

function numOrNull(id) {
  return toNumberOrNull(document.getElementById(id)?.value)
}

function numOrUndefined(id) {
  const raw = document.getElementById(id)?.value
  if (raw === '' || raw == null) return undefined
  const v = parseFloat(raw)
  return Number.isFinite(v) ? v : undefined
}

function setVal(id, v) {
  const el = document.getElementById(id)
  if (el) el.value = v ?? ''
}

function money(v) {
  return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function moneySigned(v) {
  const n = Math.round(v || 0)
  return n < 0 ? `-$${money(Math.abs(n))}` : `$${money(n)}`
}

// ── Reading the form into the same payload shape record_revisions.payload
// stores — see loadDealInputsFromOpportunity() in src/routes/deals.js,
// this must stay in sync with that function's field names. ───────────────
function readPayload() {
  // ── READ FROM THE BOXES AGAIN, BECAUSE THE BOXES ARE BACK ────────────
  //
  // Round 40 Phase 3. Phase 1 removed the eleven inputs and this read the
  // loaded object through unchanged, because marginOverrides is in
  // COMMERCIALS_OWNED_KEYS and is sent on EVERY save: rebuilding it from a
  // screen with no controls would have sent {} and DELETED the overrides on 33
  // opportunities at their first save.
  //
  // The controls are back, on request, in the detail panel and beside the
  // installation lines. So the screen is the source again, and the round trip
  // is what has to hold: populateForm fills these boxes from the record, an
  // untouched box is blank, and a blank box is no override rather than a zero.
  //
  // THE SAME DANGER FROM THE OTHER SIDE, and it is why this is not simply the
  // pre-Phase-1 code restored: if a box did not exist, numOrUndefined returns
  // undefined and the key is dropped, which is deletion. The count is asserted
  // in the suite so an input lost in a future rearrangement is a failing test
  // rather than a quiet loss of somebody's pricing.
  const marginOverrides = {}
  MARGIN_KEYS.forEach(key => {
    const v = numOrUndefined(`deal-margin-${key}`)
    if (v !== undefined) marginOverrides[key] = v
  })

  return {
    ssExisting: numOrNull('deal-ssExisting'),
    ssNew: numOrNull('deal-ssNew'),
    aqm: numOrNull('deal-aqm'),
    hemir: numOrNull('deal-hemir'),

    // Rates come from the catalog, never from the form. The hidden inputs are
    // still populated (populateForm) so the note lines under each row can show
    // "N units x $rate", but they are no longer the source: a readonly input
    // is a display of a rate, not a record of one.
    ssUnitCost: catalogRates.ssUnitCost ?? 0,
    aqUnitCost: catalogRates.aqUnitCost ?? 0,
    hemirUnitCost: catalogRates.hemirUnitCost ?? 0,

    installResp: uiState.installResp,
    lumpSumCost: numOrNull('deal-lumpCost'),
    // Round 37 Phase 1: from the catalog, like the unit and hosting rates
    // above. These read the form until this phase, and the form was fed from a
    // payload nothing has ever written, so per-unit installation priced at $0
    // on every deal. Measured at two mixes before the fix: $0 against $96,500
    // and $0 against $295,000.
    // ── THE OVERRIDE, NEVER THE CATALOG FIGURE ───────────────────────
    //
    // THE RISK OF THIS WHOLE PHASE, and it is the mirror of the Phase 1 fault.
    // These four are now salesperson-writable. If readPayload kept copying the
    // catalog rate onto them, EVERY SAVE WOULD RECORD A PER-DEAL OVERRIDE OF
    // THE CATALOG ON EVERY DEAL, silently, on all four keys, for deals nobody
    // meant to override. The strip in pickSalespersonWritable used to be what
    // stopped that, and making the keys writable removes exactly that
    // protection.
    //
    // So they are read from the BOX, and an empty box is null: no override, use
    // the catalog. The screen shows the catalog figure as a placeholder rather
    // than as a value, the same shape as gstPct and duration.
    inSsExisting: numOrNull('deal-inSsExisting'),
    inSsNew: numOrNull('deal-inSsNew'),
    inAqm: numOrNull('deal-inAqm'),
    inHemir: numOrNull('deal-inHemir'),

    hoSafesight: catalogRates.hoSafesight ?? 0,
    hoAqm: catalogRates.hoAqm ?? 0,
    hoHemir: catalogRates.hoHemir ?? 0,

    targetMargin: numOrNull('deal-targetMargin'),
    marginOverrides,

    warrantyPct: numOrNull('deal-warrantyPct'),
    whtPct: numOrNull('deal-whtPct'),
    gstPct: numOrNull('deal-gstPct'),
    grossUp: uiState.grossUp,

    // Currency (Round 3 Phase 6, 2026-08-17): data entry only, confirmed
    // scope - captured and saved, never read by buildDealInputs() below
    // or by calculateDeal(), same as this section's own comment states.
    // '' is not a currency. An unchosen select sends null, so the record keeps
    // its absence rather than acquiring an empty string that reads as a value
    // to every ?? and every `key in payload` check downstream.
    bidCurrency: emptyToNull('deal-bidCurrency'),
    proposalCurrency: emptyToNull('deal-proposalCurrency'),
    fxContingency: numOrNull('deal-fxContingency'),

    duration: numOrNull('deal-duration'),
    structure: uiState.structure,
    recoveryMonths: numOrNull('deal-recoveryMonths'),
    invoicing: uiState.invoicing,
    milestones: readMilestones(),

    contractorMilestones: readContractorMilestones(),

    factoring: {
      enabled: uiState.factoringEnabled,
      ratePct: num('deal-factoring-ratePct'),
      termMonths: num('deal-factoring-termMonths'),
      method: uiState.factoringMethod,
    },
  }
}

function readMilestones() {
  const rows = []
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const month = num(`deal-ms-${i}-month`)
    const label = document.getElementById(`deal-ms-${i}-label`)?.value ?? ''
    const usd = num(`deal-ms-${i}-usd`)
    if (month > 0 && usd > 0) rows.push({ month, label, usd, pct: 0 })
  }
  return rows
}

// Contractor payment milestones - what Terminus pays the contractor for a
// Lump Sum job. Deliberately a separate reader from readMilestones() above
// (the customer-facing hardware milestones): same shape, different table,
// different IDs (deal-cm-* vs deal-ms-*), never merged.
function readContractorMilestones() {
  const rows = []
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const month = num(`deal-cm-${i}-month`)
    const label = document.getElementById(`deal-cm-${i}-label`)?.value ?? ''
    const usd = num(`deal-cm-${i}-usd`)
    // The percentage is stored alongside, because it is what was NEGOTIATED and
    // the dollars are what it computed. A version reading the schedule back
    // should see the term that was agreed, not only its arithmetic.
    const pct = toNumberOrNull(document.getElementById(`deal-cm-${i}-pct`)?.value)
    if (month > 0 && usd > 0) rows.push({ month, label, usd, pct })
  }
  return rows
}

// ── payload -> calculateDeal() input, mirrors loadDealInputsFromOpportunity()
// in src/routes/deals.js field for field. This mapping is glue code, not
// the shared calculation itself, so it's allowed to be duplicated - the
// preview it feeds is explicitly never trusted for the actual snapshot. ──
// Hw / Hosting Setup pricing cards: reads Cost/Price straight from
// result.groups.hardwareGroup / hostingGroup rows and totals - nothing
// here is recomputed fresh. Only touches read-only cells (note/cost/
// price/total spans), never the margin <input> elements themselves, so
// typing a margin override never loses focus mid-keystroke (those inputs
// stay static DOM nodes, wired once in wireOnce()).
function renderPricingCards(result, payload) {
  const { hardwareGroup, hostingGroup } = result.groups
  const ssUnits = numericOrDefault(payload, 'ssExisting') + numericOrDefault(payload, 'ssNew')
  const aqUnits = payload.aqm ?? 0
  const hemirUnits = numericOrDefault(payload, 'hemir')
  const { totalUnits, warrantyUnits } = result.hardware
  const warrantyPct = numericOrDefault(payload, 'warrantyPct')

  const setRow = (group, key, note, period = (s) => s) => {
    const row = group.rows.find(r => r.key === key)
    document.getElementById(`pg-cost-${key}`).textContent = period(`$${money(row.rawCost)}`)
    document.getElementById(`pg-price-${key}`).textContent = period(`$${money(row.rawPrice)}`)
    document.getElementById(`pg-note-${key}`).textContent = note
  }

  // ── A "MARGIN %" COLUMN MUST SHOW A MARGIN ──────────────────────────
  //
  // Phase 1 removed the inputs and the column headers still say Margin %. A
  // header naming a value the cells do not carry is the same fault as a class
  // with no rule: nothing fails, and the screen quietly stops meaning what it
  // says. So the cells now DISPLAY the effective margin, which is the layout's
  // own words - target margin is the default for every component, viewable.
  //
  // An overridden line says so, because a line priced away from target is a
  // decision and the whole point of removing the inputs was that the default
  // should be visible rather than typed eleven times.
  // Phase 3: the cells are inputs again. A blank box prices at target, so the
  // PLACEHOLDER carries the target rather than the box carrying a value nobody
  // entered - the same shape as gstPct, whtPct, duration and the install rates.
  // An empty box is not a zero, and it must not become one on save.
  const target = numericOrDefault(payload, 'targetMargin')
  MARGIN_KEYS.forEach((key) => {
    const el = document.getElementById(`deal-margin-${key}`)
    if (!el) return
    el.placeholder = String(target)
    const override = toNumberOrNull(el.value)
    el.classList.toggle('pg-margin-override', override !== null)
    el.title = override === null
      ? `Blank prices this line at the target margin, ${target}%.`
      : `Priced at ${override}% against a target of ${target}%.`
  })

  setRow(hardwareGroup, 'hwSs', `${ssUnits} units x $${money(payload.ssUnitCost ?? 0)}`)
  setRow(hardwareGroup, 'hwAqm', `${aqUnits} units x $${money(payload.aqUnitCost ?? 0)}`)
  setRow(hardwareGroup, 'hwHemir', `${hemirUnits} units x $${money(payload.hemirUnitCost ?? 0)}`)
  setRow(hardwareGroup, 'hwWarranty', `${warrantyPct}% of ${totalUnits} units = ${warrantyUnits} unit${warrantyUnits === 1 ? '' : 's'}`)
  document.getElementById('pg-total-cost-hw').textContent = `$${money(hardwareGroup.rawTotalCost)}`
  document.getElementById('pg-total-price-hw').textContent = `$${money(hardwareGroup.rawTotalPrice)}`

  // ── THE PERIOD TRAVELS WITH THE FIGURE. Round 41, ruled ─────────────────
  //
  // Five hosting figures, all per month, and until this the only thing saying
  // so was the card title. The merged panel three sections below prices the
  // same hosting OVER THE TERM, and the two are within one scroll of each
  // other: $5,400 and $194,400 are the same hosting cost and nothing on either
  // said which period it was in.
  //
  // perMonthFigure is the one wording rule, shared with the over-the-term
  // labels durationPresentation produces, so the two surfaces cannot drift into
  // two conventions.
  setRow(hostingGroup, 'hoSs', `${ssUnits} units x $${money(payload.hoSafesight ?? 0)}`, perMonthFigure)
  setRow(hostingGroup, 'hoAqm', `${aqUnits} units x $${money(payload.hoAqm ?? 0)}`, perMonthFigure)
  setRow(hostingGroup, 'hoHemir', `${hemirUnits} units x $${money(payload.hoHemir ?? 0)}`, perMonthFigure)
  document.getElementById('pg-total-cost-ho').textContent = perMonthFigure(`$${money(hostingGroup.rawTotalCost)}`)
  document.getElementById('pg-total-price-ho').textContent = perMonthFigure(`$${money(hostingGroup.rawTotalPrice)}`)
}

// Where the costs came from, and anything wrong with them. Round 36 Phase 2.
//
// Three conditions, and none of them may be silent. The first is provenance:
// a figure on this screen is now a claim about a specific batch on a specific
// date, and the screen should say which.
//
// The second is a product the catalog does not supply. Its cost renders as $0,
// and a genuine zero and a missing rate are indistinguishable in that cell -
// which is precisely the fault Phase 0 found across this entire tab. The cell
// cannot tell them apart, so the notice has to.
//
// The third is currency. bidCurrency is captured on Structural Terms, defaults
// to USD and is read by nothing: calculateDeal() has no currency handling at
// all. Before this round that was harmless, because every figure was $0 and
// zero is zero in any currency. It stops being harmless here, the moment real
// USD catalog costs render under a deal that says its bid currency is SGD.
//
// This notice does NOT convert and does not refuse the deal. Converting needs a
// rate source that does not exist, and refusing is a business decision about
// deals that can legitimately be quoted in another currency. Both belong to the
// phase that decides between them. What Phase 2 must not do is ship the third
// option, which is to show a number in the wrong currency and say nothing.
function renderCatalogNotice(payload) {
  const notice = document.getElementById('deal-catalog-notice')
  const warn = document.getElementById('deal-catalog-warn')
  if (!notice || !warn) return

  const labels = { safesight: 'SafeSight', air_quality: 'AQ Sensor', hemir: 'HEMIR' }
  const problems = []

  if (catalogError) {
    problems.push(`${catalogError} Every cost below is $0 because no rate could be read, not because anything is free.`)
  } else if (catalogMissing.length) {
    problems.push(
      `Base Cost Data has no current batch for ${catalogMissing.map(m => labels[m] ?? m).join(' and ')}. ` +
      `${catalogMissing.length === 1 ? 'That product\u2019s cost' : 'Those products\u2019 costs'} reads $0 because no rate exists, not because it is free.`)
  }

  const bid = payload.bidCurrency
  if (bid && bid !== 'USD') {
    problems.push(
      `Bid Currency is ${bid}, and Base Cost Data is held in USD. ` +
      `The costs below are USD figures and have not been converted.`)
  }

  if (problems.length) {
    warn.textContent = problems.join(' ')
    warn.classList.remove('hidden')
  } else {
    warn.textContent = ''
    warn.classList.add('hidden')
  }

  // Provenance, only when there is a batch to name. Every product currently
  // resolves to one batch, but the catalog allows them to differ, because a
  // manufacturing run is per product and runs arrive at different times.
  const batches = Object.values(catalogBatches)
  if (!batches.length) {
    notice.textContent = ''
    return
  }
  const dates = [...new Set(batches.map(b => b.effective_from))]
  const names = [...new Set(batches.map(b => b.batch_label))]
  const provenance = dates.length === 1 && names.length === 1
    ? `Rates from batch "${names[0]}", effective ${dates[0]}.`
    : `Rates from ${batches.length} current batches, effective ${dates.sort()[0]} to ${dates.sort()[dates.length - 1]}.`

  // ── STALENESS, SAME BANDS AND SAME WORDS AS THE APPROVAL PAGE ───────────
  //
  // Round 39. The business asked for this here rather than only there: the
  // salesperson sees these rates before any approver does and is the first
  // person who could act on an ageing basis. Same bands, same words, earlier.
  //
  // The bands and the sentences come from src/lib/cost-basis.js. This surface
  // does not write its own - Verification 20 - and it does not decide when a
  // basis is old either. It asks, and it prints what it is told.
  //
  // A date alone was necessary and not sufficient: the notice has named the
  // effective date since Round 36 and said nothing about whether that date is a
  // problem.
  const ages = batches
    .map((b) => ageInDays(b.effective_from, catalogAsOf))
    .filter((d) => Number.isFinite(d))
  const oldest = ages.length ? Math.max(...ages) : null
  const band = stalenessBand(oldest)
  notice.textContent = band.band === 'current'
    ? provenance
    : `${provenance} ${band.statement}`
  notice.classList.toggle('deal-catalog-stale', band.band === 'stale')
  notice.classList.toggle('deal-catalog-ageing', band.band === 'ageing')
}

// ── The four Deal Sheet summary cards are GONE, Round 39 ────────────────
//
// renderDealSheetTab built Margins, Base cost data per unit, Terms and Units
// required. All four restated values already on screen, which is the duplication
// the business reported when this round opened.
//
// "Base cost data, per unit" went with them, and that corrects a decision rather
// than executing one. Round 38 kept it on the grounds that it was "the only place
// a salesperson sees the rates they are pricing against, because those rates are
// read-only and absent from the input surface". Measured in Phase 2: the rates
// ARE on the input surface, as read-only inputs, six on Hw / Hosting Setup and
// four on Installation, and the batch and its effective date have been in
// renderCatalogNotice since Round 36.
//
// What was genuinely missing during entry was the STALENESS BAND, and that joined
// the existing notice instead of arriving as a second panel.


function escapeSheet(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// ── Deal Sheet versions (Round 37 Phase 3) ────────────────────────────────
//
// Saving is a deliberate act, so it is a button press and never a consequence
// of editing. Nothing on this tab autosaves.
let dealVersions = []

function versionLabel(v) {
  if (v.major === 0) return `V0.${v.minor}`
  return v.minor === 0 ? `V${v.major}` : `V${v.major}.${v.minor}`
}

async function loadVersions() {
  if (!opportunityId) return
  const r = await window.api('GET', `/api/opportunities/${opportunityId}/deal-sheet-versions`)
  dealVersions = r.ok && Array.isArray(r.data) ? r.data : []
  renderVersionList()
  // The prompt depends on whether any version exists, so it is set from the
  // same load that answers that, not guessed at wiring time.
  applyReasonPrompt()
}

function renderVersionList() {
  const list = document.getElementById('deal-version-list')
  if (!list) return

  if (!dealVersions.length) {
    list.innerHTML = '<p class="pg-item-note">No versions saved yet. V0.1 is the first.</p>'
  } else {
    // Number, status, reason, AUTHOR, timestamp and what the version carried.
    // "A version nobody can find is a version nobody can restore", and during a
    // bid review the question is usually who took it and what it covered rather
    // than which number it got.
    //
    // sections is shown as a COUNT with the names on hover rather than a list,
    // because eight names per row would bury the reason, which is the thing the
    // business said matters most. It is shown at all because a version taken
    // before a tab existed and one taken after it where the operator left that
    // tab blank are otherwise indistinguishable.
    list.innerHTML = dealVersions.map(v => {
      const when = new Date(v.issued_at ?? v.created_at)
      const who = (v.status === 'issued' ? v.issued_by_email : v.created_by_email) || 'unknown author'
      const sections = Array.isArray(v.sections) ? v.sections : []
      return `
      <div class="ds-row">
        <div style="min-width:0">
          <div class="ds-label">${escapeSheet(versionLabel(v))}
            <span class="pg-item-note" style="display:inline">${v.status === 'issued' ? 'issued' : 'draft'}</span>
          </div>
          <div class="pg-item-note">${escapeSheet(v.reason)}</div>
          <div class="pg-item-note">${escapeSheet(who)} &middot; ${escapeSheet(when.toISOString().slice(0, 16).replace('T', ' '))}</div>
          <div class="pg-item-note">${versionApprovalLine(v)}</div>
          <div class="pg-item-note" title="${escapeSheet(sections.join(', '))}">${sections.length} section${sections.length === 1 ? '' : 's'} recorded</div>
        </div>
        <div class="ds-value">
          <button class="btn-text" data-restore-version="${escapeSheet(v.id)}">Restore</button>
        </div>
      </div>`
    }).join('')
  }

  // Issue acts on the latest DRAFT. Disabled when there is none, rather than
  // offered and then refused, because a control that is always clickable and
  // sometimes errors teaches people to ignore its message.
  const draft = dealVersions.find(v => v.status === 'draft')
  const btn = document.getElementById('btn-issue-version')
  if (btn) {
    btn.disabled = !draft
    btn.textContent = draft ? `Issue ${versionLabel(draft)} as V${draft.major + 1}` : 'Issue latest draft'
  }
}

// The approval state, derived server-side and rendered as a sentence rather
// than a badge, because "approved at revision 12, superseded by 3 saves since"
// is the whole of what an approver needs and a coloured dot is not.
//
// APPROVED AND SUPERSEDED ARE DELIBERATELY NOT THE SAME SENTENCE. An approval
// that no longer describes the deal on screen is the one thing this display
// exists to stop being mistaken for control.
function versionApprovalLine(v) {
  const a = v.approval ?? {}
  const at = a.revisionApproved
  switch (a.state) {
    case 'approved':
      return `Approved at revision ${at}, and nothing has changed since.`
    case 'superseded':
      return `SUPERSEDED. Approved at revision ${at}, and the record has moved on `
        + `${a.revisionsSince} save${a.revisionsSince === 1 ? '' : 's'} since. `
        + `Take a new version and have it approved.`
    case 'rejected':
      return `Rejected at revision ${at}.`
    case 'none':
      return 'Not yet approved.'
    case 'unapprovable':
      return 'Taken before versions recorded their revision, so it cannot be approved.'
    case 'inconsistent':
      return `Names revision ${at}, which this record has not reached. Report this.`
    default:
      return ''
  }
}

// ── THE REASON ASKS A DIFFERENT QUESTION ON A FIRST VERSION ──────────────
//
// CLAUDE.md Verification 22. The reason is required and now has a reader: the
// approval page renders it as prose beside the bridge showing what moved. That
// is what makes requiring it honest.
//
// It is still one field asking one question, and on a first version that
// question has no answer. "What changed, and why" against a deal that has never
// been priced invites "initial pricing", and somebody who types that on V0.1
// types "update" on V0.10. A required field decays into ceremony the moment it
// has nothing to say.
//
// So the prompt changes by context. A first version asks what the price is
// BASED ON, which is a real question with a real answer an approver needs; every
// later one asks what changed and why, which is what block 2 is measuring.
function reasonPrompt() {
  return reasonPromptFor(dealVersions.length)
}

function applyReasonPrompt() {
  const prompt = reasonPrompt()
  const label = document.querySelector('label[for="deal-version-reason"]')
  const box = document.getElementById('deal-version-reason')
  if (label) label.textContent = prompt.label
  if (box) box.placeholder = prompt.placeholder
}

// ── FEEDBACK IS CLEARED ON LOAD AND ON THE NEXT ACTION. Round 41, finding 2 ─
//
// Neither element was ever cleared. "Saved (revision 24)." sat on screen for
// SEVEN HOURS AND THIRTY-EIGHT MINUTES through eight later writes, and the
// version error survived navigating away and back, because navigating in this
// application re-renders a panel's contents rather than rebuilding the DOM.
// Only a browser refresh cleared them, which is the one thing a person does not
// do when a message is telling them something.
//
// TWO MOMENTS, AND BOTH ARE NEEDED. On load, because a message about the last
// record is not about this one. Before the next action, because a message about
// the last attempt is not about this one either, and the second is what makes a
// failure legible: the screen goes quiet, then says what happened.
export function clearDealFeedback() {
  const fb = document.getElementById('deal-feedback')
  if (fb) { fb.textContent = ''; fb.className = '' }
  const vf = document.getElementById('deal-version-feedback')
  if (vf) { vf.textContent = ''; vf.className = 'hidden' }
}

function versionFeedback(msg, ok) {
  const el = document.getElementById('deal-version-feedback')
  if (!el) return
  el.textContent = msg || ''
  el.className = msg ? (ok ? 'msg-success' : 'msg-error') : 'hidden'
}

async function saveVersion() {
  clearDealFeedback()
  const reasonEl = document.getElementById('deal-version-reason')
  const reason = (reasonEl?.value ?? '').trim()

  // Required, and checked here so the user is told before a request is made.
  // The schema's NOT NULL and length CHECK are what make it true; this is what
  // makes it readable.
  if (!reason) {
    versionFeedback(reasonPrompt().refusal, false)
    reasonEl?.focus()
    return false
  }

  // ── A VERSION REFUSES A SCHEDULE THAT DOES NOT RECONCILE ─────────────
  //
  // Round 39, the business's split, and the two halves are deliberately
  // different because saving and versioning are different acts:
  //
  //   SAVE warns and does not block. A part-built schedule mid-drafting is
  //   legitimate and a save is not a commitment.
  //
  //   TAKING A VERSION REFUSES. A version is a commercial commitment and must
  //   not carry a payment schedule that does not match the contractor's price.
  //
  // Scoped to a schedule that EXISTS and does not sum: every installation type
  // except Lump Sum has no contractor schedule at all, and a refusal that fired
  // on those would fire on almost every deal.
  //
  // The server refuses this too. A client check tells somebody early; it is not
  // the control, because a control that only exists in a browser is not one.
  const contractorRec = scheduleReconciliation(readContractorMilestones(), num('deal-lumpCost'))
  if (contractorRec.hasSchedule && !contractorRec.reconciles) {
    versionFeedback(refusalStatement(contractorRec, 'The contractor payment schedule'), false)
    return false
  }

  // ── SAVE FIRST, THEN VERSION. Round 38 Phase 1, the business's decision. ──
  //
  // Round 38 Phase 0 measured that the Deal Sheet is already live: it renders
  // through recompute() from readPayload(), so it shows unsaved input, and a
  // version taken from it captured that unsaved input. Measured by intercepting
  // the POST: the body carried ssExisting 77 while the record had no ssExisting
  // at all and stood at revision 12.
  //
  // THAT MAKES A VERSION UNTRUSTWORTHY AS THE THING IT EXISTS TO BE. The
  // business asked for versions for "traceability of calculations used in
  // proposals", and a version citing figures the record never held is a
  // traceability record that cannot be checked against anything.
  //
  // So taking a version SAVES THE RECORD FIRST, and the two become one act. The
  // alternative considered and rejected was leaving them separate, which is
  // cleaner as code and permits exactly the disagreement versions exist to
  // prevent. The cost is one extra write.
  //
  // Only when there is something to save. A version taken with nothing dirty
  // needs no revision, because the record already holds what the screen shows,
  // and writing one anyway would put an empty revision in the history every
  // time somebody versioned twice.
  let alsoSaved = false
  if (isDealFormDirty()) {
    const saved = await saveDeal()
    if (!saved) {
      // saveDeal() has already written its own reason into #deal-feedback, which
      // is at the other end of the tab. This says what it means for the version,
      // which is the thing the user was actually trying to do, where they are
      // looking when they try it.
      versionFeedback('The pricing could not be saved, so no version was taken.', false)
      return false
    }
    alsoSaved = true
  }

  // The version carries what the tab currently reads, including the catalog
  // rates, which the server resolves again on its own rather than trusting
  // these. readPayload() is the same function the save path uses, so a version
  // and a save cannot disagree about what the inputs are.
  //
  // Round 38: it also names the REVISION it was taken from, which is what makes
  // approving a version the same act as approving a revision. The number comes
  // from the page's one shared holder, updated by the save immediately above,
  // so a version can only ever name the revision its own inputs came from.
  // The rates this screen priced against, so the server can confirm they still
  // agree with the catalog rather than freezing whatever it resolves a moment
  // later. A batch turning over mid-session is the case this catches.
  const pricedWith = frozenRates(resolveRates(readPayload(), catalogRates))
  const r = await window.api('POST', `/api/opportunities/${opportunityId}/deal-sheet-versions`,
    { inputs: readPayload(), reason, rates: pricedWith, expected_revision: window.getOppLoadedRevision() })

  if (!r.ok) {
    // The save and the version are two sequential writes, not one transaction.
    // If the version fails after the save succeeded, a revision exists and no
    // version does, and the user MUST be told both halves: the raw server error
    // alone reads as "nothing happened", and they would not know their pricing
    // is now saved. Observed by forcing this branch, not argued.
    const detail = r.data?.error ?? 'The version could not be saved.'
    versionFeedback(alsoSaved
      ? `Your pricing was saved, but the version was not taken: ${detail} Try taking the version again.`
      : detail, false)
    return false
  }
  reasonEl.value = ''
  await loadVersions()
  // Names both writes when both happened, because "Saved V0.1" alone would hide
  // a revision the user did not ask for and would be surprised to find later.
  versionFeedback(alsoSaved
    ? `Pricing saved, and ${versionLabel(r.data)} taken from it.`
    : `Saved ${versionLabel(r.data)}. The pricing was already saved.`, true)
  return true
}

function wireApprovalLink() {
  const btn = document.getElementById('btn-open-approval')
  if (!btn || btn.dataset.wired) return
  btn.dataset.wired = '1'
  btn.addEventListener('click', () => {
    if (opportunityId) window.navigate('opportunity-approval', opportunityId)
  })
}

async function issueLatestDraft() {
  const draft = dealVersions.find(v => v.status === 'draft')
  if (!draft) return
  const r = await window.api('POST', `/api/deal-sheet-versions/${draft.id}/issue`)
  if (!r.ok) {
    versionFeedback(r.data?.error ?? 'The version could not be issued.', false)
    await loadVersions()
    return
  }
  await loadVersions()
  versionFeedback(`Issued ${versionLabel(r.data)}. It cannot be changed now.`, true)
}

// RESTORE OVERWRITES THE CURRENT PRICING, which is what makes it useful during
// a negotiation and what makes unsaved work a real risk.
//
// It uses openDiscardConfirm, the dialogue Round 28 built for the assessment
// panel and Round 34 extended, rather than a third pattern. That dialogue's own
// words are "discard unsaved changes", which is exactly what restoring does to
// them, so restore REFUSES-OR-DISCARDS rather than forcing a save first.
// Forcing a save would also write a revision the user never asked for, at the
// moment they are trying to go back.
async function restoreVersion(versionId) {
  const go = async () => {
    const r = await window.api('POST', `/api/deal-sheet-versions/${versionId}/restore`)
    if (!r.ok) {
      versionFeedback(r.data?.error ?? 'The version could not be restored.', false)
      return
    }
    populateForm(r.data.inputs ?? {})
    recompute()
    updateDirtyState()
    versionFeedback(`Restored ${r.data.label}. Nothing is saved until you press Save Changes.`, true)
  }

  // MEASURED, NOT ASSUMED, because the residual on restore was whether it warns
  // at all: it does, through the same discard dialogue the assessment panel
  // uses, and it now asks the comparison rather than a cached flag.
  if (isDealFormDirty()) {
    window.openDiscardConfirm(go)
    return
  }
  await go()
}

// ── Recompute + render ────────────────────────────────────────────────────
function recompute() {
  const payload = readPayload()
  // The same resolution the server will perform, from the same catalog, so the
  // preview and the recompute cannot disagree about where a rate came from.
  const resolution = resolveRates(payload, catalogRates)
  const dealInputs = buildDealInputs(payload, { testBedCost, rates: resolution.rates })
  const result = calculateDeal(dealInputs)
  renderResults(result, payload)
  return result
}

// ── ONE PANEL, ONE ARITHMETIC STORY. Round 41 item 4, ruled by the business ─
//
// This replaces renderDealMatrix + computeDealMatrixCols + renderDealSheet. The
// Deal Summary matrix and the Result list showed revenue, total cost and margin
// twice, forty rows apart, and the merge is a merge rather than a relocation
// because each of those is now ONE row with a per-group split.
//
// THE RULING THAT SHAPES IT: UNFOLD. Finance cost, test bed carried and absorbed
// WHT are their own unsplit full-width rows, and Total cost is the VISIBLE SUM
// of the six cost rows directly above it. The old matrix folded all three into
// the Hardware column before computing Total and Margin, so the panel footed
// without an approver being able to follow it. The business's reason: on an
// approval surface a column an approver can sum and match beats a compact fold,
// and the census had named the cost of the alternative precisely, that somebody
// will add them up.
//
// WHAT THAT COSTS, and all three were named in the census before being spent:
// the WHT-absorbed apportionment across the three groups goes, because it was an
// apportionment computed for display rather than a measured allocation; finance
// and test bed stop sitting inside Hardware, which is not where either belongs;
// and the per-column margin CHANGES MEANING, so it changes label. Left called
// "Margin" it would name a different number from the one it named before the
// unfold, which is Architecture 9's fourth variant, a string that stopped being
// true when the thing under it moved.
//
// THE DEAD CELLS CEASE TO EXIST. The old financing row hardcoded '-' in its
// Hosting and Installation columns under every condition, so no deal state could
// fill them. Ruled not-facts: a dash because a value is zero is a fact about the
// deal, a dash because the code has no expression for it is a hole in a grid.
// PO factoring interest is a full-width row now and the holes are gone with it.
function renderDealPanel(result, payload) {
  const dur = durationPresentation(payload)
  const months = dur.months ?? 0
  const { hardwareGroup, installGroup, hostingGroup } = result.groups
  const wht = whtPresentation(payload)
  const whtPct = wht.pct ?? 0
  const gst = gstPresentation(payload)
  const grossUp = uiState.grossUp
  const { invoiceBase, whtAmount, gstAmount, whtBorne } = result.tax
  const { contractNet } = result.totals
  const { totalDealCostAll, financeCost } = result

  // THE THREE GROUPS, RAW. No folding: what each group prices and what it costs,
  // and hosting over the term rather than per month, which is the period this
  // panel works in and says so in every hosting label.
  const hwPrice = hardwareGroup.rawTotalPrice
  const hwCost = hardwareGroup.rawTotalCost
  const inPrice = installGroup.rawTotalPrice
  const inCost = installGroup.rawTotalCost
  const hoPrice = hostingGroup.rawTotalPrice * months
  const hoCost = hostingGroup.rawTotalCost * months

  const m = (v) => `$${money(v)}`
  const neg = (v) => `- $${money(v)}`
  const dash = (v) => (v ? m(v) : '-')
  const D = '-'
  // A row with figures in the three group columns and a total.
  const split = (label, h, ho, i, t, opts = {}) => ({ label, hardware: h, hosting: ho, installation: i, total: t, ...opts })
  // A row that is about the deal rather than about a product group. It carries
  // no group cells at all rather than three dashes, which is the ruling on dead
  // cells applied at the point a row is built.
  const full = (label, t, opts = {}) => ({ label, total: t, fullWidth: true, ...opts })

  const grossOf = (p) => (grossUp && whtPct < 100) ? Math.round(p / (1 - whtPct / 100)) : p

  const rows = [
    split('One-off price, hardware, warranty and installation', m(hwPrice), D, m(inPrice), m(hwPrice + inPrice)),
    split(dur.priceLabel, D, dur.recorded ? m(hoPrice) : dur.value, D, dur.recorded ? m(hoPrice) : dur.value),
    split('Revenue, contract value net', m(hwPrice), m(hoPrice), m(inPrice), m(contractNet), { emphasis: 'revenue' }),

    // ── THE SIX COST ROWS, CONTIGUOUS, SUMMING TO THE ROW BELOW THEM ───────
    split('Hardware and warranty cost', neg(hwCost), D, D, neg(hwCost)),
    split('Installation cost', D, D, neg(inCost), neg(inCost)),
    split(dur.costLabel, D, dur.recorded ? neg(hoCost) : dur.value, D, dur.recorded ? neg(hoCost) : dur.value),
    // A dash here means zero financing. "not recorded" means the facility is on
    // and nobody recorded its term, which is a different fact and must not
    // borrow the dash. All three surfaces branch on the one flag.
    full('PO factoring interest', result.costIncomplete ? 'not recorded' : (financeCost ? neg(financeCost) : '-')),
    full('Test Bed cost, carried from conversion', result.testBedCost ? neg(result.testBedCost) : '-'),
    full(grossUp ? 'Withholding tax, grossed up and recovered from the customer' : 'Withholding tax absorbed by Terminus',
      whtBorne ? neg(whtBorne) : '-'),
    full('Total cost', neg(totalDealCostAll), { emphasis: 'sum' }),

    full('Gross margin', m(contractNet - totalDealCostAll), { emphasis: 'margin' }),
    // RELABELLED, not deleted. Before the unfold this row was price minus a cost
    // that already contained the three rows above; after it, the only honest
    // name says which deductions it is before. Placed AFTER the total so it
    // cannot be read as part of the sum.
    split('Margin before financing, test bed and withholding',
      m(hwPrice - hwCost), m(hoPrice - hoCost), m(inPrice - inCost), m(contractNet - (hwCost + hoCost + inCost)),
      { memo: true }),

    // ── THE INVOICE WALK ──────────────────────────────────────────────────
    full('Invoice reconciliation, from revenue', m(contractNet), { memo: true }),
    full(grossUp ? wht.grossUpLabel : 'No gross up, WHT absorbed',
      grossUp ? `+ ${m(invoiceBase - contractNet)}` : '-'),
    full(gst.recorded ? `GST at ${gst.pct}%, passed through` : gst.rowLabel,
      gst.recorded ? (gstAmount ? `+ ${m(gstAmount)}` : '-') : 'not recorded'),
    full(`${gst.priceLabel}${grossUp ? ', grossed up for WHT' : ''}`, m(invoiceBase + gstAmount), { emphasis: 'price' }),
    // The one row in this block with a real per-group figure: each group's own
    // price times the rate, not an apportionment of a total.
    wht.recorded
      ? split(wht.deductedLabel,
        neg(Math.round(grossOf(hwPrice) * whtPct / 100)),
        neg(Math.round(grossOf(hoPrice) * whtPct / 100)),
        neg(Math.round(grossOf(inPrice) * whtPct / 100)),
        whtAmount ? neg(whtAmount) : '-')
      : full(wht.deductedLabel, wht.value),
    full('Net receipt after WHT', m(invoiceBase - whtAmount), { emphasis: 'receipt' }),
  ]

  document.getElementById('deal-sheet-units').textContent = result.hardware.totalUnits

  const headRow = `
    <div class="dm-row head">
      <div class="dm-label"></div>
      <div class="dm-cell">Hardware (USD)</div>
      <div class="dm-cell">Hosting (USD)</div>
      <div class="dm-cell">Installation (USD)</div>
      <div class="dm-cell">Total (USD)</div>
    </div>`

  const dataRows = rows.map((r) => {
    const cls = ['dm-row']
    if (r.fullWidth) cls.push('dm-row--full')
    if (r.memo) cls.push('dm-row--memo')
    if (r.emphasis === 'sum') cls.push('dm-row--sum')
    if (r.emphasis && r.emphasis !== 'sum') cls.push('dm-row--lead')
    const cells = r.fullWidth
      ? `<div class="dm-cell dm-cell--span">${r.total}</div>`
      : `<div class="dm-cell">${r.hardware}</div>
         <div class="dm-cell">${r.hosting}</div>
         <div class="dm-cell">${r.installation}</div>
         <div class="dm-cell dm-cell--total">${r.total}</div>`
    return `
    <div class="${cls.join(' ')}">
      <div class="dm-label">${r.label}</div>
      ${cells}
    </div>`
  }).join('')

  document.getElementById('deal-panel').innerHTML = headRow + dataRows
}

// ── THE LATCHES. Round 41 item 7 ───────────────────────────────────────────
//
// SESSION ONLY, IN MEMORY, GONE ON RELOAD. A Set in a module variable, and
// deliberately not localStorage: latching is a working instrument for reaching a
// defensible commercial position, not a display preference, and a preference
// that survives a reload is a state somebody INHERITS rather than one they made.
// Rule 1 says latching is a subtraction the user makes and never a state they
// inherit, and the storage choice is what makes that true rather than intended.
const latched = new Set()

function applyLatches(payload) {
  const catalogProblem = !document.getElementById('deal-catalog-warn')?.classList.contains('hidden')
  const marginOverrides = {}
  MARGIN_KEYS.forEach((k) => { marginOverrides[k] = document.getElementById(`deal-margin-${k}`)?.value })
  const rateValues = {}
  for (const [id, key] of [['deal-inSsExisting', 'inSsExisting'], ['deal-inSsNew', 'inSsNew'],
    ['deal-inAqm', 'inAqm'], ['deal-inHemir', 'inHemir']]) {
    rateValues[key] = document.getElementById(id)?.value
  }

  for (const panel of LATCH_PANELS) {
    const el = document.getElementById(panel.id)
    const btn = document.getElementById(`latch-${panel.id}`)
    if (!el || !btn) continue
    const off = latched.has(panel.id)
    el.classList.toggle('is-latched', off)
    btn.textContent = off ? 'Show' : 'Hide'
    btn.setAttribute('aria-expanded', String(!off))

    // RULE 3 IS ONLY ABOUT A LATCHED-OFF PANEL. An open panel shows its own
    // gaps, so a marker on its button would be noise competing with the thing
    // it is pointing at.
    const signal = off ? panelSignal(panel, payload, { marginOverrides, rateValues, catalogProblem }) : null
    btn.classList.toggle('is-signalled', !!signal?.signalled)
    btn.title = signal ? signalSentence(signal, panel) : `Hide ${panel.label}`
  }

  const all = document.getElementById('latch-all')
  if (all) {
    // Rule 4: it returns to EVERYTHING VISIBLE, never to a remembered set. With
    // anything hidden it offers the way back; only from all-shown does it hide.
    const anyHidden = latched.size > 0
    all.textContent = anyHidden ? 'Show all' : 'Hide all'
    all.classList.toggle('is-signalled', anyHidden && LATCH_PANELS.some((p) => latched.has(p.id)
      && panelSignal(p, payload, { marginOverrides, rateValues, catalogProblem }).signalled))
  }

  markDetailCatalogFlag()
}

// ── THE CATALOG FLAG. Round 41 item 7, the business's ruling 2 ─────────────
//
// It has no latch button to sit on: ruling 2 put it on section 4's latch, and
// ruling 1, in the same message, made section 4 never-latchable. Its CONCERN is
// unchanged and still live, so it rides `Show detail`, which ruling 1 names as
// that panel's only collapse mechanism. Latching is not what can hide the
// notice; closing the detail is. Reported at the phase boundary rather than
// resolved silently.
//
// THE SENTENCE IS THE NOTICE'S OWN. A fixed sentence here would name one of the
// three problems renderCatalogNotice can report - an unreadable catalog, a
// product with no current batch, or a bid currency the catalog is not held in -
// and be wrong about the other two. The first version said "a product is
// pricing against a rate that does not exist" and appeared over a CURRENCY
// mismatch, which is Architecture 9's fourth variant: a literal that cannot be
// falsified by anything.
//
// CALLED FROM THE TOGGLE AS WELL AS FROM THE RENDER, because opening the detail
// does not recompute anything. The first version read the panel's state inside
// applyLatches only, so the flag stayed lit with the detail open.
function markDetailCatalogFlag() {
  const btn = document.getElementById('btn-toggle-detail')
  const warn = document.getElementById('deal-catalog-warn')
  const panel = document.getElementById('deal-detail-panel')
  if (!btn || !warn || !panel) return
  const problem = !warn.classList.contains('hidden') && warn.textContent.trim() !== ''
  const hidden = panel.classList.contains('hidden')
  const lit = problem && hidden
  btn.classList.toggle('is-signalled', lit)
  if (lit) btn.title = `The detail is hidden and holds a problem: ${warn.textContent.trim()}`
  else btn.removeAttribute('title')
}

// ── FINDING 4: THE BOUNDARY HAS TO ANNOUNCE ITSELF ─────────────────────────
//
// Measured at 1240: 3,244px of grid in a 422px column, and the Cumulative cash
// position row ended "379,622  350,127  3". A figure sliced mid-glyph at a hard
// edge does not read as "there is more to the right", it reads as 350,127 and
// then a three.
//
// A RESIZE OBSERVER, NOT A CHECK AT RENDER TIME. The first version toggled the
// class immediately after the grid was built and it never fired: recompute()
// runs while the Commercials panel is still hidden, so clientWidth and
// scrollWidth are both 0 and 0 > 1 is false. Nothing re-renders when the tab is
// then shown, so the class was never applied on the one path a person takes.
//
// The observer fires when the element gets a width, which covers being revealed,
// the window being resized, and the detail panel opening beside it. Called once
// per render as well, for the case where the panel is already visible.
let cashFlowResizeObserver = null
function markCashFlowScrollable() {
  const el = document.getElementById('deal-cashflow-grid')
  if (!el) return
  const mark = () => el.classList.toggle('is-scrollable', el.scrollWidth > el.clientWidth + 1)
  mark()
  if (!cashFlowResizeObserver && typeof ResizeObserver !== 'undefined') {
    cashFlowResizeObserver = new ResizeObserver(mark)
    cashFlowResizeObserver.observe(el)
  }
}

// Sums the cash flow's already-computed monthly rows into 12-month
// buckets - the year-by-year schedule is a re-grouping of cashFlow.rows,
// never a fresh accrual/billing calculation. (The prototype's own
// `payment` object re-derives this independently via a separate
// monthlyAt() helper that duplicates financeModel's accrHw/accrHost
// logic - real drift risk in the source itself, not inherited here.)
function computeYearBuckets(cf, fieldFn) {
  const months = cf.rows.length
  const years = []
  for (let y = 0; y * 12 < months; y++) {
    const slice = cf.rows.slice(y * 12, Math.min((y + 1) * 12, months))
    const total = slice.reduce((s, r) => s + fieldFn(r), 0)
    years.push({ label: `Year ${y + 1}`, value: Math.round(total), monthly: slice.length ? Math.round(total / slice.length) : 0 })
  }
  return years
}

// Non-hybrid: a horizontal table, one column per year + a pinned Total
// column, no leading row-label column - the heading names the row.
// Hybrid: its own vertical list (hosting only, hardware is milestone-
// driven so it's excluded here), reusing the .ds-row shape from the Deal
// sheet since it's the same label/value-row layout.
function renderYearSchedule(result, payload) {
  const cf = result.cashFlow
  const structure = uiState.structure
  const invoicing = uiState.invoicing
  const scheduleLabel = (structure === 'hybrid' ? 'Hosting' : 'Invoiced fee') + (invoicing === 'annual' ? ', annual in advance' : ', monthly')
  const val = (y) => (invoicing === 'monthly' ? y.monthly : y.value)

  if (structure === 'single') {
    document.getElementById('deal-recovery-readonly-value').textContent =
      payload.duration ? `${payload.duration} months` : 'Contract duration not set'
  }

  const nonHybridEl = document.getElementById('deal-year-schedule')
  if (structure !== 'hybrid') {
    const years = computeYearBuckets(cf, r => r.hardwareIn + r.hostingIn)
    if (!years.length) {
      nonHybridEl.innerHTML = ''
    } else {
      const totalAll = years.reduce((s, y) => s + y.value, 0)
      nonHybridEl.innerHTML = `
        <p class="label" style="margin-bottom:6px;color:var(--green)">${scheduleLabel} (USD)</p>
        <div class="ys-row head">
          ${years.map(y => `<div class="ys-cell">${y.label}</div>`).join('')}
          <div class="ys-total">Total (USD)</div>
        </div>
        <div class="ys-row">
          ${years.map(y => `<div class="ys-cell">$${money(val(y))}</div>`).join('')}
          <div class="ys-total">$${money(totalAll)}</div>
        </div>`
    }
  } else {
    nonHybridEl.innerHTML = ''
  }

  const hybridEl = document.getElementById('deal-hybrid-schedule')
  if (structure === 'hybrid') {
    const years = computeYearBuckets(cf, r => r.hostingIn)
    const totalAll = years.reduce((s, y) => s + y.value, 0)
    const rows = years.map(y => `
      <div class="ds-row"><span class="ds-label">${y.label}</span><span class="ds-value" style="color:var(--white)">$${money(val(y))}</span></div>
    `).join('')
    hybridEl.innerHTML = `
      <p class="label" style="margin-bottom:10px;color:var(--green)">${scheduleLabel}</p>
      ${rows}
      <div class="ds-row"><span class="ds-label" style="color:var(--muted-2)">Total</span><span class="ds-value" style="color:var(--green)">$${money(totalAll)}</span></div>
      <p style="font-family:var(--mono);font-size:9px;color:var(--muted-2);margin-top:10px">Hosting sits outside the milestones and applies every month of the term.</p>`
  } else {
    hybridEl.innerHTML = ''
  }
}

function renderResults(result, payload) {
  document.getElementById('deal-contract-net').textContent = `$${money(result.totals.contractNet)}`
  // TWO RENDERINGS, ONE COMPUTATION. The strip above the sub-tabs serves the
  // always-visible read and task 3; the local figure inside the Margin card is
  // the prototype's line 1489, restored, so the loop reads the number where the
  // hand already is. Both are written from THIS `result`, and neither recomputes
  // anything: a second computation would be Verification 20, and
  // commercials-wiring.test.mjs asserts the two strings agree.
  // ── ONE VALUE, ONE RULE, TWO INSTANCES. Round 41 ───────────────────────
  //
  // The accent's meaning is marginPresentation's, not this file's. Round 39
  // wrote the rule inline here and toggled it on ONE of the two renderings, so
  // the strip showed a deal 22 points under target in the treatment of one on
  // target. Both instances now read the same object.
  const mp = marginPresentation(result.achievedMargin, payload)
  const paint = (el) => {
    if (!el) return
    el.textContent = mp.text
    el.classList.toggle('on-target', mp.state === 'on-target')
    el.classList.toggle('under-target', mp.state === 'under-target')
  }
  paint(document.getElementById('deal-achieved-margin'))
  paint(document.getElementById('deal-terms-achieved-margin'))
  const localNote = document.getElementById('deal-terms-achieved-note')
  if (localNote) localNote.textContent = mp.note

  // Closing cash position, the strip's second lead. Margin and cash recovery
  // are two different questions and the screen answered the first loudly and
  // the second in a footnote.
  const closing = document.getElementById('deal-closing-cash')
  if (closing) closing.textContent = closingCashPresentation(result.cashFlow).text
  document.getElementById('deal-total-cost').textContent = `$${money(result.totalDealCostAll)}`
  // money(null) is $NaN. The absence has a wording of its own, because the
  // figure it replaces is one somebody prices against.
  document.getElementById('deal-finance-cost').textContent =
    result.financeCost === null ? 'not recorded' : `$${money(result.financeCost)}`

  renderDealPanel(result, payload)
  renderYearSchedule(result, payload)
  renderPricingCards(result, payload)
  renderCatalogNotice(payload)
  renderInstallationTab(result, payload)

  const cf = result.cashFlow
  const cashOk = document.getElementById('deal-cashflow-ok')
  const cashWarn = document.getElementById('deal-cashflow-warn')
  const troughLine = `Lowest cash position: ${moneySigned(cf.minCash)} in month ${cf.minCashMonth || 1}.`
  if (cf.minCash >= 0) {
    cashOk.textContent = `Cash position stays positive throughout the term. ${troughLine}`
    cashOk.classList.remove('hidden')
    cashWarn.classList.add('hidden')
  } else {
    cashOk.classList.add('hidden')
    cashWarn.textContent = `Cash position goes negative. ${troughLine}`
    cashWarn.classList.remove('hidden')
  }

  renderCashFlowGrid(cf)
  markCashFlowScrollable()
  // After renderCatalogNotice, because the catalog flag reads its output.
  applyLatches(payload)

  const msWarn = document.getElementById('deal-milestone-warn')
  if (uiState.structure === 'hybrid') {
    // ── THE SAME EVALUATOR AS THE CONTRACTOR GRID ─────────────────────
    //
    // Round 39. The business asked whether the contractor grid was the only
    // place a set of parts must sum to a stated total. It was not: this grid
    // had the identical shape and the identical defect, a 0.5-percent-of-base
    // tolerance and a `.toFixed(1)` that rounds a discrepancy shut. At a
    // $1,000,000 one-off price that is $5,000 of silent drift.
    //
    // Build-discipline rule 6: a fix built for the surface that reported the
    // fault is not a fix for the one beside it. One evaluator, both grids.
    const msRec = scheduleReconciliation(payload.milestones, result.totals.oneOffPrice)
    if (msRec.hasSchedule && !msRec.exact) {
      msWarn.textContent = `Customer milestones total $${money(msRec.totalUsd)} against a `
        + `hardware and installation price of $${money(msRec.base)}. ${msRec.statement}`
      msWarn.classList.remove('hidden')
    } else {
      msWarn.classList.add('hidden')
    }
    renderMilestonePcts(result.totals.oneOffPrice)
  } else {
    msWarn.classList.add('hidden')
  }
}

// Month-by-month cash flow: months across as columns, categories down as
// rows. Row set, order, and cell colouring mirror the prototype's
// buildOppDetail() cashflow builder exactly (Terminus Ops.dc.html, the
// financeModel section) — only the token names differ, translated to this
// app's actual CSS variables.
function renderCashFlowGrid(cf) {
  const grid = document.getElementById('deal-cashflow-grid')
  const empty = document.getElementById('deal-cashflow-empty')
  const closingEl = document.getElementById('deal-cashflow-closing')

  if (!cf.rows.length) {
    grid.innerHTML = ''
    empty.classList.remove('hidden')
    closingEl.textContent = '--'
    return
  }
  empty.classList.add('hidden')

  // Zero renders as a dash rather than "0", matching the prototype. Cash-out
  // categories are stored as positive magnitudes, "neg" just controls the
  // display convention (leading minus, muted colour) for money leaving.
  const cellVal = (v, neg) => {
    const r = Math.round(v)
    if (!r) return { value: '-', color: 'var(--muted-2)' }
    return { value: neg ? `-${money(r)}` : money(r), color: neg ? 'var(--muted)' : 'var(--white)' }
  }
  const cells = (fn, neg) => cf.rows.map(r => cellVal(fn(r), neg))
  const blanks = () => cf.rows.map(() => ({ value: '', color: 'var(--muted-2)' }))

  const list = []
  const push = (label, rowCells, opts = {}) => list.push({
    label,
    cells: rowCells,
    labelColor: opts.section ? 'var(--muted-2)' : 'var(--white)',
    weight: opts.total ? '500' : '400',
    bg: opts.section ? 'rgba(242,242,240,0.04)' : 'transparent',
    total: !!opts.total,
  })

  push('Cash in', blanks(), { section: true })
  push(
    cf.structure === 'hybrid'
      ? 'Milestone hardware payment'
      : (cf.annualInvoicing ? 'Hardware recovery, annual' : 'Hardware recovery'),
    cells(r => r.hardwareIn)
  )
  push(cf.annualInvoicing ? 'Hosting fee, annual in advance' : 'Hosting fee', cells(r => r.hostingIn))
  if (cf.factoringEnabled) push('PO factoring advance', cells(r => r.advance))
  push('Total cash in', cells(r => r.cashIn), { total: true })

  push('Cash out', blanks(), { section: true })
  push(
    cf.contractorStaged ? 'Hardware and warranty' : 'Hardware, warranty and installation',
    cells(r => r.hwOut, true)
  )
  if (cf.contractorStaged) push('Contractor milestone payment', cells(r => r.contractorOut, true))
  push('Hosting cost', cells(r => r.hostOut, true))
  if (cf.factoringEnabled && cf.factoringTermMissing) {
    // THE THIRD SURFACE, and ruling 5 created this state too. With no term the
    // schedule is empty, so both rows would print a full run of zeros for a
    // facility that is switched on: a confident zero across the whole term,
    // which is what the ruling exists to remove. One row that says so instead.
    push('Factoring, term not recorded', cf.rows.map(() => ({ value: '', color: 'var(--muted-2)' })))
  } else if (cf.factoringEnabled) {
    push('Factoring principal repayment', cells(r => r.facP, true))
    push('Factoring interest', cells(r => r.facI, true))
  }
  push('Total cash out', cells(r => r.cashOut, true), { total: true })

  push('Net cash flow', cf.rows.map(r => ({
    value: money(Math.round(r.cashNet)), color: r.cashNet < 0 ? '#e0824a' : 'var(--white)',
  })), { total: true })
  push('Cumulative cash position', cf.rows.map(r => ({
    value: money(Math.round(r.cum)), color: r.cum < 0 ? '#e0824a' : 'var(--green)',
  })), { total: true })

  const headRow = `
    <div class="cf-row head">
      <div class="cf-label">Month</div>
      ${cf.rows.map(r => `<div class="cf-cell">${r.m}</div>`).join('')}
    </div>`

  const dataRows = list.map(row => {
    const labelBg = row.bg === 'transparent' ? 'var(--dark)' : row.bg
    return `
    <div class="cf-row${row.total ? ' total' : ''}" style="background:${row.bg}">
      <div class="cf-label" style="background:${labelBg};color:${row.labelColor};font-weight:${row.weight}">${row.label}</div>
      ${row.cells.map(c => `<div class="cf-cell" style="color:${c.color}">${c.value}</div>`).join('')}
    </div>`
  }).join('')

  grid.innerHTML = headRow + dataRows
  closingEl.textContent = money(Math.round(cf.rows[cf.rows.length - 1].cum))
}

function renderMilestonePcts(hardwarePriceAll) {
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const cell = document.getElementById(`deal-ms-${i}-pct`)
    if (!cell) continue
    const usd = num(`deal-ms-${i}-usd`)
    cell.textContent = hardwarePriceAll ? `${((usd / hardwarePriceAll) * 100).toFixed(1)}%` : '--'
  }
}

function renderMilestoneRows(milestones) {
  const tbody = document.getElementById('deal-milestones-tbody')
  tbody.innerHTML = Array.from({ length: MILESTONE_ROWS }).map((_, i) => `
    <tr>
      <td><input type="text" inputmode="numeric" id="deal-ms-${i}-month" style="width:64px"></td>
      <td><input type="text" id="deal-ms-${i}-label" placeholder="e.g. Installation complete"></td>
      <td><input type="text" inputmode="decimal" id="deal-ms-${i}-usd"></td>
      <td class="col-mono" id="deal-ms-${i}-pct">--</td>
    </tr>
  `).join('')

  milestones.forEach((m, i) => {
    if (i >= MILESTONE_ROWS) return
    setVal(`deal-ms-${i}-month`, m.month)
    setVal(`deal-ms-${i}-label`, m.label)
    setVal(`deal-ms-${i}-usd`, m.usd)
  })

  tbody.querySelectorAll('input').forEach(el => el.addEventListener('input', recompute))
}

// Contractor milestones - deliberately its own render function, own tbody
// (deal-contractor-tbody vs deal-milestones-tbody), never merged with the
// customer-facing hardware milestones above.
// ── THE MILESTONE IS A LIST, NOT A SENTENCE ────────────────────────────
//
// Free text meant every deal named the same six events differently, so nothing
// could ever group or compare them, and a schedule could not be read across
// deals at all. The list is the business's, in the order the events happen.
//
// "Select milestone" is a real option with an empty value rather than a
// placeholder attribute, so an unfilled row reads as unfilled rather than as
// the first milestone.
const CONTRACTOR_MILESTONES = [
  'Contract start',
  'Hardware delivered to site',
  'Installation complete',
  'Commissioning',
  'Go live',
  'Final acceptance',
]

function milestoneOptions(selected) {
  const chosen = selected ?? ''
  // An unrecognised stored value keeps its own option rather than being
  // silently reset to blank: existing deals hold free text, and a dropdown that
  // quietly discarded it would lose what somebody entered.
  const known = CONTRACTOR_MILESTONES.includes(chosen)
  const extra = chosen && !known ? [chosen] : []
  return [`<option value="">Select milestone</option>`]
    .concat(CONTRACTOR_MILESTONES.concat(extra).map((m) =>
      `<option value="${escapeSheet(m)}"${m === chosen ? ' selected' : ''}>${escapeSheet(m)}${extra.includes(m) ? ' (not in the list)' : ''}</option>`))
    .join('')
}

function renderContractorMilestoneRows(contractorMilestones) {
  const tbody = document.getElementById('deal-contractor-tbody')
  tbody.innerHTML = Array.from({ length: MILESTONE_ROWS }).map((_, i) => `
    <tr>
      <td><input type="text" inputmode="numeric" id="deal-cm-${i}-month" style="width:64px"></td>
      <td><select id="deal-cm-${i}-label">${milestoneOptions(contractorMilestones[i]?.label)}</select></td>
      <td><input type="text" inputmode="decimal" id="deal-cm-${i}-pct" style="width:80px"></td>
      <td><input type="text" inputmode="decimal" id="deal-cm-${i}-usd"></td>
    </tr>
  `).join('')

  contractorMilestones.forEach((m, i) => {
    if (i >= MILESTONE_ROWS) return
    setVal(`deal-cm-${i}-month`, m.month)
    setVal(`deal-cm-${i}-usd`, m.usd)
  })

  // ── BIDIRECTIONAL, AND ONE COMPUTATION ───────────────────────────────
  //
  // Type a percentage and the dollars follow; adjust the dollars and the
  // percentage recalculates. Verification 20 applies: there is ONE conversion,
  // `pctToUsd`, and the other direction is its inverse in the same function.
  // Two independent formulas would agree today and drift the first time
  // rounding changed.
  //
  // The field being typed in is never rewritten while it has focus, or a
  // half-typed "1" becomes "1" -> $2,500 -> "1.0" and the caret jumps.
  tbody.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', () => {
      const m = el.id.match(/^deal-cm-(\d+)-(pct|usd)$/)
      if (m) syncContractorRow(Number(m[1]), m[2])
      recompute()
    })
  })
}

/** The one conversion. Both directions, so neither can drift from the other. */
function pctToUsd(pct, base) { return Math.round((pct / 100) * base) }
function usdToPct(usd, base) { return base ? (usd / base) * 100 : null }

// Which side of the row the person is typing on decides which side follows.
function syncContractorRow(i, typed) {
  const base = num('deal-lumpCost')
  if (!base) return
  if (typed === 'pct') {
    const pct = toNumberOrNull(document.getElementById(`deal-cm-${i}-pct`)?.value)
    setVal(`deal-cm-${i}-usd`, pct === null ? '' : pctToUsd(pct, base))
  } else {
    const usd = toNumberOrNull(document.getElementById(`deal-cm-${i}-usd`)?.value)
    const pct = usd === null ? null : usdToPct(usd, base)
    // Enough places that 100.008% cannot print as 100.0%. Trailing zeroes
    // trimmed so an exact 25% reads as "25" rather than "25.0000".
    setVal(`deal-cm-${i}-pct`, pct === null ? '' : String(Number(pct.toFixed(4))))
  }
}

// Contractor milestone totals: %/USD sum and the "should total 100%"
// check are not a calculateDeal() output - it doesn't compute this at
// all, same as the existing hardware-milestone total check above. Base
// is the raw lumpCost input, since a contractor milestone table only
// ever appears for a Lump Sum deal.
function renderContractorMilestoneTotals(lumpCost) {
  const rec = scheduleReconciliation(readContractorMilestones(), lumpCost)

  document.getElementById('deal-contractor-base').textContent = `Lump sum contractor price, $${money(lumpCost)}`
  document.getElementById('deal-contractor-total-usd').textContent = `$${money(rec.totalUsd)}`

  // ── THE TOTAL PERCENTAGE MAY NOT ROUND ITSELF INTO AGREEMENT ─────────
  //
  // `.toFixed(1)` printed 100.008% as "100.0%". The one number whose job is to
  // say the schedule does not add up had been rounded until it said it did, and
  // a $20 overrun saved without a word. Verification 21.
  const totalPct = rec.base ? (rec.totalUsd / rec.base) * 100 : 0
  document.getElementById('deal-contractor-total-pct').textContent =
    rec.exact ? '100%' : `${Number(totalPct.toFixed(4))}%`

  // The difference is STATED whenever it is not exactly 100%, over or under,
  // in dollars first, because dollars cannot be rounded into agreement.
  const diff = document.getElementById('deal-contractor-diff')
  if (diff) {
    diff.textContent = rec.statement ?? ''
    diff.classList.toggle('hidden', !rec.statement)
    diff.classList.toggle('deal-schedule-off', !rec.reconciles)
  }

  const warn = document.getElementById('deal-contractor-warn')
  if (rec.hasSchedule && !rec.reconciles) {
    warn.textContent = `${rec.statement} A version cannot be taken until the schedule matches the contractor price.`
    warn.classList.remove('hidden')
  } else {
    warn.classList.add('hidden')
  }
}

// Installation tab: the responsibility select's second cell (Lump Sum
// summary note), the per-unit table's Units column, and the contractor
// milestone totals - all read straight from result.groups.installGroup
// or the raw unit-count inputs, nothing recomputed fresh.
function renderInstallationTab(result, payload) {
  document.getElementById('deal-lump-summary').textContent =
    `Lump sum cost $${money(payload.lumpSumCost ?? 0)}, priced at $${money(result.groups.installGroup.rawTotalPrice)}, carried into the Deal Summary, Deal sheet and Cash flow.`

  document.getElementById('deal-install-units-inSsEx').textContent = numericOrDefault(payload, 'ssExisting')
  document.getElementById('deal-install-units-inSsNew').textContent = numericOrDefault(payload, 'ssNew')
  document.getElementById('deal-install-units-inAqm').textContent = numericOrDefault(payload, 'aqm')
  document.getElementById('deal-install-units-inHemir').textContent = numericOrDefault(payload, 'hemir')

  // Cost/Price columns (Round 3 Phase 5, 2026-08-17) - reads straight from
  // result.groups.installGroup.rows, the same buildCostGroup() output
  // already used for this group's totals elsewhere on this tab (Deal
  // Summary matrix, Deal Sheet), just never rendered per-row until now.
  // Only present when the Per Unit table is actually shown (installGroup
  // has rows inSsEx/inSsNew/inAqm/inHemir only in that branch - see
  // updateInstallVisibility) - the find() below quietly no-ops via the
  // optional chaining for the Lump Sum/Client Own branches, where these
  // cells are hidden anyway.
  const setInstallRow = (key) => {
    const row = result.groups.installGroup.rows.find(r => r.key === key)
    if (!row) return
    document.getElementById(`deal-install-cost-${key}`).textContent = `$${money(row.rawCost)}`
    document.getElementById(`deal-install-price-${key}`).textContent = `$${money(row.rawPrice)}`
  }
  setInstallRow('inSsEx')
  setInstallRow('inSsNew')
  setInstallRow('inAqm')
  setInstallRow('inHemir')
  // Round 37 Phase 1: name the basis and the batch, for the same reason the
  // Hw/Hosting cards carry a provenance line. An installation figure is now a
  // claim about a specific batch, and the two products whose new-infrastructure
  // figure has no row should say so where the number is read, not only in a
  // migration comment nobody opens while pricing a deal.
  const basis = document.getElementById('deal-install-basis')
  if (basis) {
    const b = Object.values(catalogBatches)[0]
    basis.textContent = b
      ? `Rates from batch "${b.batch_label}", effective ${b.effective_from}. AQ Sensor and HEMIR use the existing-infrastructure figure; their new-infrastructure rates are held in the catalog and have no row on this tab.`
      : ''
  }
  document.getElementById('deal-install-total-cost').textContent = `$${money(result.groups.installGroup.rawTotalCost)}`
  document.getElementById('deal-install-total-price').textContent = `$${money(result.groups.installGroup.rawTotalPrice)}`

  renderContractorMilestoneTotals(payload.lumpSumCost ?? 0)
}

// ── Populate form from a saved payload ────────────────────────────────────
function populateForm(payload) {
  // ON LOAD. A message about the last record is not about this one, and
  // populateForm is the one thing that runs for every record that opens.
  clearDealFeedback()
  const p = payload ?? {}

  setVal('deal-ssExisting', p.ssExisting ?? 0)
  setVal('deal-ssNew', p.ssNew ?? 0)
  setVal('deal-aqm', p.aqm ?? 0)
  setVal('deal-hemir', p.hemir ?? 0)

  // From the catalog, not from `p`. The index.html comment above these inputs
  // said "rates are fixed at Opportunity creation"; Round 36 Phase 0 found
  // creation writes {name, company_name, customerLead} and nothing else, so
  // they were never fixed at creation or anywhere. That comment is corrected in
  // the markup in this same change rather than left to rot beside working code.
  setVal('deal-ssUnitCost', catalogRates.ssUnitCost ?? '')
  setVal('deal-aqUnitCost', catalogRates.aqUnitCost ?? '')
  setVal('deal-hemirUnitCost', catalogRates.hemirUnitCost ?? '')

  setVal('deal-hoSafesight', catalogRates.hoSafesight ?? '')
  setVal('deal-hoAqm', catalogRates.hoAqm ?? '')
  setVal('deal-hoHemir', catalogRates.hoHemir ?? '')

  // Held for the round trip AND written into the boxes, which are the source of
  // truth again from Phase 3. A key the record does not carry leaves its box
  // blank, which is "price at target" rather than "price at zero".
  loadedMarginOverrides = p.marginOverrides ?? {}
  MARGIN_KEYS.forEach(key => setVal(`deal-margin-${key}`, loadedMarginOverrides[key] ?? ''))

  uiState.installResp = p.installResp || 'Client Own Installation Team'
  document.getElementById('deal-installResp').value = uiState.installResp
  setVal('deal-lumpCost', p.lumpSumCost ?? '')
  // From the catalog, not from `p`, same correction the unit and hosting rates
  // took in Round 36 Phase 2. `p` never carried these: they are refused by
  // SALESPERSON_WRITABLE_KEYS and no writer has ever existed.
  // Absent means the catalog default, present means this job's quoted rate, and
  // the box says which: a value is an override, a placeholder is the catalog.
  for (const [id, key] of [['deal-inSsExisting', 'inSsExisting'], ['deal-inSsNew', 'inSsNew'],
    ['deal-inAqm', 'inAqm'], ['deal-inHemir', 'inHemir']]) {
    const el = document.getElementById(id)
    if (!el) continue
    setVal(id, toNumberOrNull(p[key]) ?? '')
    el.placeholder = catalogRates[key] === undefined ? 'no catalog rate' : String(catalogRates[key])
    el.title = toNumberOrNull(p[key]) === null
      ? 'From Base Cost Data. Enter a figure to record this job\'s quoted rate.'
      : `Quoted for this job. Base Cost Data says ${catalogRates[key] ?? 'nothing'}.`
  }
  updateInstallVisibility()

  // A blank box stays blank rather than being filled with the default, because
  // filling it would write the default into the record on the next save and
  // make "the user chose 30" indistinguishable from "nobody set one".
  //
  // The default is shown as a PLACEHOLDER instead, which is the convention the
  // per-line margin inputs on this tab already use ("target"). So an empty box
  // reads as the default it is actually pricing at, rather than as zero or as
  // nothing.
  setVal('deal-targetMargin', toNumberOrNull(p.targetMargin) ?? '')
  setVal('deal-warrantyPct', toNumberOrNull(p.warrantyPct) ?? '')
  const marginBox = document.getElementById('deal-targetMargin')
  const warrantyBox = document.getElementById('deal-warrantyPct')
  if (marginBox) marginBox.placeholder = String(NUMERIC_DEFAULTS.targetMargin)
  if (warrantyBox) warrantyBox.placeholder = String(NUMERIC_DEFAULTS.warrantyPct)
  // ?? '' AND A PLACEHOLDER, the same as gstPct below and targetMargin above.
  // A prefilled 0 records a rate nobody entered on the first save, which is the
  // writer half of read-and-write-must-agree-about-absence.
  setVal('deal-whtPct', toNumberOrNull(p.whtPct) ?? '')
  const whtBox = document.getElementById('deal-whtPct')
  if (whtBox) whtBox.placeholder = String(NUMERIC_DEFAULTS.whtPct)
  // ?? '' AND A PLACEHOLDER, matching targetMargin and warrantyPct three lines
  // up. `?? 0` filled the box with a rate nobody had entered, so the first save
  // of any of the 406 deals with no GST rate would have RECORDED one, destroying
  // the absence the rows above now report. The default is still 0; the
  // placeholder says so without claiming somebody chose it.
  setVal('deal-gstPct', toNumberOrNull(p.gstPct) ?? '')
  const gstBox = document.getElementById('deal-gstPct')
  if (gstBox) gstBox.placeholder = String(NUMERIC_DEFAULTS.gstPct)
  uiState.grossUp = !!p.grossUp
  updateGrossUpButton()

  // Currency (Round 3 Phase 6, 2026-08-17): data entry only, confirmed
  // scope - deliberately not read anywhere in buildDealInputs() below,
  // not wired into the calculation. Defaults match the prototype's own
  // (Terminus Ops.dc.html:6800-6801, both 'USD').
  // ── THE || 'USD' LOAD FALLBACK IS GONE. Round 41 item 3 ──────────────────
  //
  // It filled the control with USD when the record held nothing, and the next
  // save then WROTE 'USD' — a currency nobody chose, recorded because a screen
  // needed something to show. Architecture 11: a default is an initial value in
  // the record, not a fallback in the read.
  //
  // Measured: bidCurrency and proposalCurrency are absent on 561 of 570
  // opportunities. Those stay absent and render as absent. USD is written at
  // CREATION for new records, and the next save of an old one writes nothing.
  //
  // The empty option is a real option, so a <select> with no stored value lands
  // on it rather than on the first currency in the list, which is the same
  // reason "Select milestone" is an option rather than a placeholder.
  setCurrencySelect('deal-bidCurrency', p.bidCurrency)
  setCurrencySelect('deal-proposalCurrency', p.proposalCurrency)
  setVal('deal-fxContingency', toNumberOrNull(p.fxContingency) ?? '')
  const fxBox = document.getElementById('deal-fxContingency')
  if (fxBox) fxBox.placeholder = String(NUMERIC_DEFAULTS.fxContingency)

  // Zero contract months is not a deal, it is an unset field, and a prefilled 0
  // both erases the absence and prices the deal, because hosting revenue over a
  // zero term is zero. See ZERO_IS_NOT_A_VALUE in deal-inputs.js.
  setVal('deal-duration', toNumberOrNull(p.duration) ?? '')
  uiState.structure = p.structure || 'twoPhase'
  updateStructureButtons()
  setVal('deal-recoveryMonths', p.recoveryMonths ?? '')
  uiState.invoicing = p.invoicing || 'annual'
  updateInvoicingButtons()
  updateStructureVisibility()

  renderMilestoneRows(p.milestones ?? [])
  renderContractorMilestoneRows(p.contractorMilestones ?? [])

  const factoring = p.factoring ?? {}
  uiState.factoringEnabled = !!factoring.enabled
  uiState.factoringMethod = factoring.method || 'straight'
  // 2, not 1.5 (Round 3 Phase 4, 2026-08-17): this is what actually
  // populates the visible <input>, unlike the 1.5 fallback in
  // buildDealInputs() below and deals.js's own loadDealInputsFromOpportunity
  // - those are pure calculation defaults, only used when payload.factoring
  // is genuinely absent, deliberately left unchanged. This one gets read
  // back by readPayload() and saved verbatim on every Save click whether
  // or not the user ever touches Factoring, same as every other untouched-
  // but-populated field on this tab already does (e.g. warrantyPct's own
  // default of 2) - a real 1.5 default broke every save on this tab
  // outright once ratePct became integer-only, confirmed live (a save
  // with nothing else wrong still failed with "factoring.ratePct must be
  // a non-negative whole number") before this fix. Confirmed safe: no
  // live Opportunity has ever saved Commercials data at all, so there is
  // no real 1.5% value anywhere to reconcile.
  setVal('deal-factoring-ratePct', factoring.ratePct ?? 2)
  setVal('deal-factoring-termMonths', factoring.termMonths ?? '')
  updateFactoringButtons()

  applyCommercialNumericInputModes()
  captureSavedBaseline()
}

// Round 3 Phase 4 (2026-08-17), corrected twice the same day: min=0 on
// every numeric entry field on this tab, one blanket pass rather than
// adding the attribute to each <input> tag individually ("not
// field-by-field", per the brief) - covers milestone/contractor-
// milestone rows too, even though those are only (re)created here via
// renderMilestoneRows/renderContractorMilestoneRows just above, since
// this runs after both. step is no longer uniformly '1' - margin/rate/
// percentage AND dollar-amount fields get '0.01' (2 decimal places,
// matches isValidNonNegativePercent server-side - it's the same
// non-negative/up-to-2dp rule for currency as for an actual percentage,
// see that validator's own comment), genuine counts keep '1'.
// PERCENT_FIELD_IDS names the flat fields explicitly (including
// deal-lumpCost, moved onto this list in the second correction - a real
// dollar cost needs cents same as a margin needs fractional percent);
// the 11 margin-override inputs share one id prefix (deal-margin-*,
// MARGIN_KEYS in readPayload/populateForm), and the milestone/
// contractor-milestone usd fields (deal-ms-*-usd/deal-cm-*-usd) share
// one id suffix - both checked structurally rather than listing every
// generated id. The actual rejection of a negative, too-precise, or
// fractional-when-it-shouldn't-be value is server-side
// (isValidNonNegativeInteger/isValidNonNegativePercent,
// src/routes/opportunities.js) - these attributes are the same
// client-side hint every other field in this codebase gets, never
// trusted alone.
const PERCENT_FIELD_IDS = new Set(['deal-targetMargin', 'deal-warrantyPct', 'deal-whtPct', 'deal-gstPct', 'deal-factoring-ratePct', 'deal-lumpCost', 'deal-fxContingency'])
function applyCommercialNumericInputModes() {
  document.querySelectorAll('#opp-tab-commercial input[inputmode]').forEach(el => {
    // deal-margin-* is gone as of Round 40 Phase 1. The clause went with it
    // rather than being left as a branch nothing can reach, which is how a
    // reader comes to believe those inputs still exist.
    const isPercent = PERCENT_FIELD_IDS.has(el.id) || el.id.endsWith('-usd')
    el.inputMode = isPercent ? 'decimal' : 'numeric'
  })
}

// ── Toggle-button helpers ──────────────────────────────────────────────
// Three mutually exclusive states for the responsibility select's second
// cell: Lump Sum (editable price + summary), per-unit (see table below),
// anything else (not applicable) - matches the prototype's
// installPriceEditable / installPerUnitNote / installPriceReadOnly.
// What each installation option does to the number. Written by the business,
// one line each, saying what the choice costs rather than what it is called.
//
// KEYED BY THE PICKLIST VALUE, and the value is the display text, so a renamed
// option loses its note rather than silently showing the wrong one. That is the
// direction to fail in: a missing sentence is visible, a wrong one is not.
//
// All four options carry a line, written by the business. The reseller line was
// pending for one phase and is now here; it was left blank rather than invented,
// because a plausible sentence nobody can falsify is the shape this project keeps
// removing.
const INSTALL_RESP_NOTES = {
  'Client Own Installation Team':
    'No installation cost to us. We keep hardware and hosting margin and carry the schedule risk if their team is slow.',
  'Terminus Contractor - Per Unit':
    'Installation cost rises with every unit. Use when the unit count may still move.',
  'Terminus Contractor - Lump Sum':
    'Installation cost is fixed whatever the unit count. Better on large deployments, worse on small ones.',
  'Terminus - Reseller Installation':
    'We discount the hardware and the reseller installs. No installation cost to us, and the discount comes off hardware margin.',
}

function updateInstallRespNote() {
  const el = document.getElementById('deal-installResp-note')
  if (!el) return
  el.textContent = INSTALL_RESP_NOTES[uiState.installResp] ?? ''
}

function updateInstallVisibility() {
  updateInstallRespNote()
  const isPerUnit = uiState.installResp.includes('Per Unit')
  const isLumpSum = uiState.installResp.includes('Lump Sum')
  document.getElementById('deal-install-table').classList.toggle('hidden', !isPerUnit)
  // The signpost appears exactly when the rows it points at do. One condition,
  // read once, rather than a second test that could drift from this one.
  document.getElementById('deal-detail-signpost')?.classList.toggle('hidden', !isPerUnit)
  document.getElementById('deal-install-seetable').classList.toggle('hidden', !isPerUnit)
  document.getElementById('deal-lumpCost-group').classList.toggle('hidden', !isLumpSum)
  document.getElementById('deal-contractor-group').classList.toggle('hidden', !isLumpSum)
  document.getElementById('deal-install-notapplicable').classList.toggle('hidden', isPerUnit || isLumpSum)
}

function updateGrossUpButton() {
  document.getElementById('deal-grossUp-toggle').textContent = `Gross up: ${uiState.grossUp ? 'On' : 'Off'}`
}

function updateStructureButtons() {
  document.querySelectorAll('#deal-structure-toggle .ring-radio').forEach(el => {
    el.classList.toggle('active', el.dataset.structure === uiState.structure)
  })
}

// Recovery/schedule row and the invoicing radios are shown for single/
// two-phase; hybrid replaces all of it with its own milestone table +
// hosting-only schedule (deal-hybrid-group) - matches showRecoveryInput /
// isSingle / showTopSchedule / showTopInvoicing all being false for
// hybrid in the prototype (Terminus Ops.dc.html lines 1544-1613).
function updateStructureVisibility() {
  const s = uiState.structure
  document.getElementById('deal-top-schedule-row').classList.toggle('hidden', s === 'hybrid')
  document.getElementById('deal-invoicing-toggle').classList.toggle('hidden', s === 'hybrid')
  document.getElementById('deal-recovery-group').classList.toggle('hidden', s !== 'twoPhase')
  document.getElementById('deal-recovery-readonly').classList.toggle('hidden', s !== 'single')
  document.getElementById('deal-hybrid-group').classList.toggle('hidden', s !== 'hybrid')
}

function updateInvoicingButtons() {
  document.querySelectorAll('#deal-invoicing-toggle .ring-radio, #deal-hybrid-invoicing-toggle .ring-radio').forEach(el => {
    el.classList.toggle('active', el.dataset.invoicing === uiState.invoicing)
  })
}

function updateFactoringButtons() {
  document.getElementById('deal-factoring-toggle').textContent = `Factoring: ${uiState.factoringEnabled ? 'On' : 'Off'}`
  document.getElementById('deal-factoring-fields').classList.toggle('hidden', !uiState.factoringEnabled)
  document.querySelectorAll('#deal-factoring-method-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === uiState.factoringMethod)
  })
}

// ── DIRTY BY COMPARISON, NOT BY EVENT. Round 38. ─────────────────────────
//
// A boolean `dealFormDirty` used to be set by an 'input'/'change' listener on
// the whole panel, which gave it two properties that were defects rather than details:
// every control inside the panel marked the tab dirty whether or not it changed
// the deal, and each exception needed its own guard PER EVENT TYPE. The version
// reason box needed such a guard, the guard covered 'input' and not 'change',
// and a textarea fires change on blur - so the click that used the reason
// dirtied the tab a moment before the flag was read.
//
// Now the flag is derived: the form's writable payload against the payload as
// it was when last saved. A control that does not change the payload cannot
// make it differ, whatever events it fires, so Phase 2 can add controls to this
// panel without teaching each one not to lie.
//
// The baseline is taken from the FORM immediately after populateForm rather
// than from the record, which sidesteps every representation difference between
// the two: a record holding duration "36" renders a box holding 36, and the
// baseline is what the box holds.
let lastSavedPayload = {}

function captureSavedBaseline() {
  lastSavedPayload = pickSalespersonWritable(readPayload())
  updateDirtyState()
}

// Named rather than boolean so a wrong answer is debuggable: "dirty" says
// nothing, "dirty because gstPct" says where to look.
function dealDirtyKeys() {
  return changedKeys(pickSalespersonWritable(readPayload()), lastSavedPayload)
}

// Round 38, Verification 20: `dealFormDirty` was a cached boolean that
// updateDirtyState() kept in step with dealDirtyKeys(). It was correct today and
// it was a second reader of the same value, and the two can only agree for as
// long as every path that changes the form remembers to refresh the cache.
// Restore read the cache. Everything now asks the comparison.
function isDealFormDirty() {
  return dealDirtyKeys().length > 0
}

function updateDirtyState() {
  const btn = document.getElementById('btn-save-deal')
  if (btn) btn.disabled = !isDealFormDirty()
}

// ── Wiring (once per page load) ───────────────────────────────────────────
function wireOnce() {
  if (wired) return
  wired = true

  // Dirty-tracking for Save Changes, delegated at the panel level rather
  // than attached per-input (2026-08-17) - 'input'/'change' both bubble,
  // so this catches every text/number/select field on the tab in one
  // listener, including milestone/contractor-milestone rows created
  // later by renderMilestoneRows/renderContractorMilestoneRows, with no
  // need to re-wire after they're regenerated (unlike the recompute
  // listener below, which attaches directly per-element and does need
  // that). The ring-radio/toggle-button controls (structure, invoicing,
  // gross-up, factoring) use click, not input/change, so those mark
  // dirty explicitly in their own handlers further down.
  document.getElementById('opp-tab-commercial').addEventListener('input', updateDirtyState)

  // ── THE LATCH BUTTONS. Round 41 item 7 ────────────────────────────────
  //
  // Delegated, so a latch button is wired whether or not its panel has been
  // rendered yet, and so adding a sixth panel needs no second wiring site.
  document.getElementById('opp-tab-commercial').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-latch]')
    if (btn) {
      const id = btn.dataset.latch
      if (latched.has(id)) latched.delete(id); else latched.add(id)
      applyLatches(readPayload())
      return
    }
    if (e.target.closest('#latch-all')) {
      // RULE 4: it returns to EVERYTHING VISIBLE, never to a remembered set.
      // Clearing rather than restoring is what makes that structural: there is
      // no remembered set in the code to return to by mistake.
      if (latched.size > 0) latched.clear()
      else for (const p of LATCH_PANELS) latched.add(p.id)
      applyLatches(readPayload())
    }
  })
  document.getElementById('opp-tab-commercial').addEventListener('change', updateDirtyState)

  // ── THE SUB-TAB WIRING IS GONE WITH THE SUB-TABS. Round 40 Phase 2 ────
  //
  // Four panels shown one at a time became five sections on one scrolling
  // screen, which is the layout the business decided and Round 39 read past.

  // ── THE DETAIL PANEL, ON REQUEST. Round 40 Phase 3 ───────────────────
  //
  // Closed by default: the layout says the detail opens IF THE USER WANTS TO
  // SEE IT, so absent is the resting state and the summary keeps the width.
  //
  // The class goes on the ROW, not on the panel, because it is the row that has
  // to become two columns. Hiding the panel alone would leave a one-column grid
  // with a gap in it.
  const detailBtn = document.getElementById('btn-toggle-detail')
  if (detailBtn) {
    detailBtn.addEventListener('click', () => {
      const row = document.getElementById('deal-summary-row')
      const panel = document.getElementById('deal-detail-panel')
      const open = panel.classList.toggle('hidden') === false
      row.classList.toggle('detail-open', open)
      detailBtn.setAttribute('aria-expanded', String(open))
      detailBtn.textContent = open ? 'Hide detail' : 'Show detail'
      // Opening the detail does not recompute anything, so the catalog flag has
      // to be re-read here or it stays lit over an open panel.
      markDetailCatalogFlag()
    })
  }

  // Live recompute on every change, no debounce - it's a local function call.
  //
  // ONE SELECTOR OVER THE WHOLE TAB, not four panel-scoped ones. The old list
  // named #deal-tab-hw, #deal-tab-install and #deal-tab-terms and then had to
  // name four Payment Terms fields individually, because that panel was not in
  // the list: an input added to Payment Terms without being named here would
  // silently not recompute. Scoping to the tab removes the class of fault
  // rather than renaming its members.
  document.querySelectorAll('#opp-tab-commercial input').forEach(el => el.addEventListener('input', recompute))

  // The currency selects, Round 36 Phase 2. The selector above matches the
  // <input> TAG, so it never matched these two <select> elements, and 'input'
  // is not the event a select fires on choice anyway.
  //
  // FOUND BY EXERCISING THE BRANCH, not by reading. Changing Bid Currency has
  // never triggered a recompute, and until this round that was harmless because
  // nothing downstream read the value: bidCurrency is captured, saved, and
  // ignored by calculateDeal(). Phase 2 gives it a reader, the catalog currency
  // notice, so the unwired select became a notice that could not appear for the
  // condition it exists to report. Architecture rule 8 exactly: an unchanged
  // path meeting a new demand, with no regression and no failing test, because
  // nothing was broken until the new use arrived.
  document.querySelectorAll('#deal-bidCurrency, #deal-proposalCurrency')
    .forEach(el => el.addEventListener('change', recompute))

  // Separate from the recompute listener above - tracks a genuine edit to
  // this one field specifically, so saveDeal() can tell "user changed
  // Duration on this tab" apart from "this tab just still has whatever
  // value it loaded with".

  document.getElementById('deal-installResp').addEventListener('change', (e) => {
    uiState.installResp = e.target.value
    updateInstallVisibility()
    recompute()
  })

  document.getElementById('deal-grossUp-toggle').addEventListener('click', () => {
    uiState.grossUp = !uiState.grossUp
    updateGrossUpButton()
    updateDirtyState()
    recompute()
  })

  document.querySelectorAll('#deal-structure-toggle .ring-radio').forEach(el => {
    el.addEventListener('click', () => {
      uiState.structure = el.dataset.structure
      updateStructureButtons()
      updateStructureVisibility()
      updateDirtyState()
      recompute()
    })
  })

  document.querySelectorAll('#deal-invoicing-toggle .ring-radio, #deal-hybrid-invoicing-toggle .ring-radio').forEach(el => {
    el.addEventListener('click', () => {
      uiState.invoicing = el.dataset.invoicing
      updateInvoicingButtons()
      updateDirtyState()
      recompute()
    })
  })

  document.getElementById('deal-factoring-toggle').addEventListener('click', () => {
    uiState.factoringEnabled = !uiState.factoringEnabled
    updateFactoringButtons()
    updateDirtyState()
    recompute()
  })

  document.querySelectorAll('#deal-factoring-method-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      uiState.factoringMethod = btn.dataset.method
      updateFactoringButtons()
      updateDirtyState()
      recompute()
    })
  })

  document.getElementById('btn-save-deal').addEventListener('click', saveDeal)

  // Versions (Round 37 Phase 3). Restore is delegated at the list level, since
  // the rows are regenerated on every load and per-row listeners would need
  // re-attaching each time - the same reason wireOnce delegates dirty-tracking
  // at the panel rather than per input.
  document.getElementById('btn-save-version').addEventListener('click', saveVersion)
  document.getElementById('btn-issue-version').addEventListener('click', issueLatestDraft)
  document.getElementById('deal-version-list').addEventListener('click', (e) => {
    const id = e.target?.dataset?.restoreVersion
    if (id) restoreVersion(id)
  })

  // THE REASON BOX NEEDS NO GUARD ANY MORE, and that is the proof the cause is
  // gone rather than the symptom. It is not part of the payload, so no event it
  // fires can make the comparison differ. Round 37 gave it a stopPropagation on
  // 'input'; Round 38 Phase 1 had to add a second for 'change' after the blur
  // case; both are deleted here rather than a third being added.
}

// ── PER-TAB FIELD OWNERSHIP. Round 38, condition 5a. ─────────────────────
//
// This was an EXCLUSION list: take everything readPayload() produced and strip
// the ten rate keys. An exclusion list is silent about anything new - a key
// added to readPayload() is owned by this tab by default and reaches the record
// unless somebody remembers to exclude it, which is the same
// everything-is-included-until-guarded shape the dirty flag had.
//
// It is now an OWNERSHIP list, and the two rules are:
//
//   OWNED FIELDS ARE ALWAYS PRESENT, null when blank. Always present, so a
//   cleared box actually clears the stored value rather than leaving the
//   previous one behind through the merge. null rather than 0, because a blank
//   box is not a zero.
//
//   UNOWNED FIELDS ARE NEVER IN THE PAYLOAD, edited or not. The Commercials tab
//   does not own Contract Duration's neighbours on the Reference tab, the exit
//   criteria, the notes or the addresses, and it must not send them even if a
//   future readPayload() happens to produce one.
//
// The rate keys are unowned for the older reason: they come from Base Cost Data
// and the server refuses them.
const COMMERCIALS_OWNED_KEYS = [
  'ssExisting', 'ssNew', 'aqm', 'hemir',
  'installResp', 'lumpSumCost',
  'targetMargin', 'marginOverrides',
  // Round 40 Phase 1b: the FOUR installation per-unit rates, and only those
  // four. An installation price is quoted for this job; a camera costs what it
  // costs everywhere. The other six rate keys stay out and the resolver refuses
  // to read them even if a payload carries one.
  'inSsExisting', 'inSsNew', 'inAqm', 'inHemir',
  'warrantyPct', 'whtPct', 'gstPct', 'grossUp',
  'bidCurrency', 'proposalCurrency', 'fxContingency',
  'duration', 'structure', 'recoveryMonths', 'invoicing',
  'milestones', 'contractorMilestones', 'factoring',
]

function pickSalespersonWritable(payload) {
  const owned = {}
  for (const key of COMMERCIALS_OWNED_KEYS) {
    // Always present. A key readPayload() did not produce is a bug in this
    // list, not a reason to omit it, so it lands as null rather than silently
    // vanishing from the write.
    owned[key] = payload[key] === undefined ? null : payload[key]
  }
  return owned
}

// ── Save / submit ──────────────────────────────────────────────────────
async function saveDeal() {
  clearDealFeedback()
  const feedback = document.getElementById('deal-feedback')
  feedback.textContent = ''
  feedback.className = ''

  const payload = pickSalespersonWritable(readPayload())

  // ── THE DURATION SPECIAL CASE IS GONE. Round 38, conditions 5a and 6a. ──
  //
  // duration used to be deleted from the payload unless this tab had edited it,
  // and a genuine edit triggered a GET-and-compare against the value at load,
  // because Contract Duration is also editable on the Reference tab. That was
  // the only protection against a cross-tab clobber on this screen, and it
  // covered ONE key while every other key merged last-writer-wins unchecked.
  //
  // It is replaced, not merely removed, and in the same change: duration is now
  // an owned field sent on every save like the other twenty-one, and the whole
  // write is conditional on the record still being at the revision this screen
  // loaded. That is wider (every key, not one) and stronger (a compare-and-swap
  // inside the advisory lock, not a read followed by a separate write).
  //
  // The notes entry the old path wrote for a duration change goes with it. It
  // recorded one field's history in a place nothing reads for that purpose,
  // and record_revisions already holds every value this field has ever had.

  // Round 38: through the shared writer, which holds the ONE revision this
  // page's three tabs share and refreshes it from the response. Holding a
  // private copy here meant an exit-criterion tick on another tab left this
  // one stale, and the next save from Commercials would have been refused
  // with nothing actually wrong.
  const result = await window.oppPatch(opportunityId, { payload })

  if (!result.ok) {
    // A stale write is answered 409 and says what to do about it. Shown, never
    // silently merged, which is the whole point of the precondition.
    feedback.textContent = result.data?.stale
      ? result.data.error
      : (result.data?.error ?? 'Failed to save.')
    feedback.className = 'msg-error'
    return false
  }
  captureSavedBaseline()

  // ── SAVE WARNS AND DOES NOT BLOCK ────────────────────────────────────
  //
  // The business's split: a part-built schedule mid-drafting is legitimate, so
  // a save must not refuse it. It must also not say "Saved" and nothing else,
  // which is what it did while a $250,020 schedule went into a $250,000 lump
  // sum. The difference is named in the same breath as the confirmation.
  const rec = scheduleReconciliation(readContractorMilestones(), num('deal-lumpCost'))
  const note = rec.hasSchedule && !rec.exact
    ? ` Contractor schedule does not total the lump sum: ${rec.statement}`
    : ''
  feedback.textContent = `Saved (revision ${result.data.revision_number}).${note}`
  // .msg-warning, not .msg-warn. The stylesheet has the former and no rule for
  // the latter, which is how .btn-secondary rendered as a native browser button
  // for a whole round: a class name asserting a style that does not exist
  // cannot be falsified by anything. Checked rather than assumed.
  feedback.className = note ? 'msg-warning' : 'msg-success'
  return true
}


// ── Entry point, called by app.js's renderOppDetail() ─────────────────────
// Fetched once per page, not per record: the catalog is system configuration,
// identical for every Opportunity, and re-fetching it on each record open would
// make the same request for the same answer on every navigation.
//
// The failure branch is exercised rather than assumed, per Architecture rule 8.
// window.api() returns {ok:false} on a network failure as well as an HTTP
// error - a catch was added around fetch() in Round 17A precisely because
// every caller's !ok branch was unreachable until something needed it.
async function loadCatalog() {
  if (catalogLoaded) return
  const result = await window.api('GET', '/api/base-costs')
  if (!result.ok) {
    catalogError = result.data?.error ?? 'Base Cost Data could not be loaded.'
    catalogRates = {}
    catalogMissing = Object.keys({ safesight: 1, air_quality: 1, hemir: 1 })
    catalogLoaded = true
    return
  }
  const { rates, missing, batches } = catalogToRates(result.data?.products ?? [])
  catalogRates = rates
  catalogBatches = batches
  catalogMissing = missing
  // Round 39: as_of was returned by the endpoint and thrown away. Staleness is
  // measured against it and not against today, because as_of is settable and
  // ageing against today would make every batch look stale inside a historical
  // read. One rule, in cost-basis.js, used here and by the approval page.
  catalogAsOf = result.data?.as_of ?? null
  catalogError = null
  catalogLoaded = true
}

window.initOpportunityDealPanel = async function (opp) {
  opportunityId = opp.id
  testBedCost = opp.opportunity_details?.test_bed_cost ?? 0
  wireOnce()

  // Awaited BEFORE populateForm and recompute, not raced alongside them. A
  // recompute that runs before the rates arrive renders a full set of $0
  // figures and then replaces them, which is the same indistinguishable zero
  // this round exists to remove, shown for however long the request takes.
  await loadCatalog()

  populateForm(opp.payload)
  recompute()
  // After the first render, so a slow list never delays the figures.
  loadVersions()
  wireApprovalLink()
}
