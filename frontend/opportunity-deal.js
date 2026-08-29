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
import { toNumberOrNull, numericOrDefault, NUMERIC_DEFAULTS, WRITABLE_NUMERIC_KEYS } from '/lib/numeric-payload.js'
import { changedKeys } from '/lib/payload-diff.js'

let opportunityId = null
let wired = false
// 'duration' bug fix (2026-08-15): payload.duration is the same field as
// the Reference tab's own "Contract Duration (months)" (Key Dates card),
// two independent edit surfaces for one value - see
// DESIGN_PRINCIPLES.md's Deferred scope. This tab's save has always sent
// the WHOLE form as one snapshot (readPayload()), including whatever
// #deal-duration currently shows, even when the user never touched it -
// silently reverting a more recent Reference-tab edit made in another
// tab without a reload. dealDurationDirty/dealDurationOrig let saveDeal()
// omit the field entirely unless this tab's own input was genuinely
// edited, and verify nothing changed it elsewhere since load before
// overwriting when it was.
let dealDurationDirty = false
let dealDurationOrig = 0
// Save Changes activation (Round 3 Phase 4, 2026-08-17) - btn-save-deal
// was previously always enabled regardless of whether anything on this
// tab had actually changed, confirmed by direct inspection, not
// assumed. Tracked separately from dealDurationDirty above, which is
// scoped to one specific field's own freshness-check needs, not a
// general "has this tab changed" signal.
let dealFormDirty = false
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
    inSsExisting: catalogRates.inSsExisting ?? 0,
    inSsNew: catalogRates.inSsNew ?? 0,
    inAqm: catalogRates.inAqm ?? 0,
    inHemir: catalogRates.inHemir ?? 0,

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
    bidCurrency: document.getElementById('deal-bidCurrency').value,
    proposalCurrency: document.getElementById('deal-proposalCurrency').value,
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
    if (month > 0 && usd > 0) rows.push({ month, label, usd })
  }
  return rows
}

// ── payload -> calculateDeal() input, mirrors loadDealInputsFromOpportunity()
// in src/routes/deals.js field for field. This mapping is glue code, not
// the shared calculation itself, so it's allowed to be duplicated - the
// preview it feeds is explicitly never trusted for the actual snapshot. ──
function buildDealInputs(payload) {
  const targetMargin = numericOrDefault(payload, 'targetMargin')
  const overrides = payload.marginOverrides ?? {}
  const marginFor = (key) => overrides[key] ?? targetMargin

  const ssExisting = numericOrDefault(payload, 'ssExisting')
  const ssNew = numericOrDefault(payload, 'ssNew')
  const aqmUnits = numericOrDefault(payload, 'aqm')
  const hemirUnits = numericOrDefault(payload, 'hemir')

  const lumpSumDeal = (payload.installResp ?? '').includes('Lump Sum')

  // isPerUnit used to be a separately-stored boolean, computed once via
  // uiState.installResp === 'Terminus Installation Team' - an invented
  // string that never matched the real 4-option picklist (Terminus
  // Ops.dc.html:5569-5570/5703: Client Own Installation Team / Terminus
  // Contractor - Per Unit / Terminus Contractor - Lump Sum / Terminus -
  // Reseller Installation), so it was always false and Reseller
  // Installation had no option at all. Derived fresh from installResp
  // here instead, same substring-match mechanism as lumpSumDeal above,
  // so there's no separate flag left to drift out of sync with the
  // string it's meant to describe.
  const isPerUnit = (payload.installResp ?? '').includes('Per Unit')

  // Lump Sum must be its own branch, not folded into the isPerUnit check -
  // it was previously falling through to the zero-cost 'inNone' line,
  // meaning installGroup (and everything downstream: the Deal Summary
  // matrix's Installation column, the Deal sheet's installation cost
  // line) silently priced Lump Sum installation at $0.
  const installLineItems = lumpSumDeal ? [
    { key: 'inLump', cost: numericOrDefault(payload, 'lumpSumCost'), marginPct: marginFor('inLump') },
  ] : isPerUnit ? [
    { key: 'inSsEx', cost: (payload.inSsExisting ?? 0) * ssExisting, marginPct: marginFor('inSsEx') },
    { key: 'inSsNew', cost: (payload.inSsNew ?? 0) * ssNew, marginPct: marginFor('inSsNew') },
    { key: 'inAqm', cost: (payload.inAqm ?? 0) * aqmUnits, marginPct: marginFor('inAqm') },
    { key: 'inHemir', cost: (payload.inHemir ?? 0) * hemirUnits, marginPct: marginFor('inHemir') },
  ] : [
    { key: 'inNone', cost: 0, marginPct: marginFor('inNone') },
  ]

  const hostingLineItems = [
    { key: 'hoSs', cost: (payload.hoSafesight ?? 0) * (ssExisting + ssNew), marginPct: marginFor('hoSs') },
    { key: 'hoAqm', cost: (payload.hoAqm ?? 0) * aqmUnits, marginPct: marginFor('hoAqm') },
    { key: 'hoHemir', cost: (payload.hoHemir ?? 0) * hemirUnits, marginPct: marginFor('hoHemir') },
  ]

  const factoring = payload.factoring ?? {}

  return {
    ssUnitCost: payload.ssUnitCost ?? 0,
    ssUnits: ssExisting + ssNew,
    aqUnitCost: payload.aqUnitCost ?? 0,
    aqUnits: aqmUnits,
    hemirUnitCost: payload.hemirUnitCost ?? 0,
    hemirUnits,
    warrantyPct: numericOrDefault(payload, 'warrantyPct'),
    installLineItems,
    hostingLineItems,
    hardwareMargins: {
      hwSs: marginFor('hwSs'),
      hwAqm: marginFor('hwAqm'),
      hwHemir: marginFor('hwHemir'),
      hwWarranty: marginFor('hwWarranty'),
    },
    months: numericOrDefault(payload, 'duration'),
    structure: payload.structure ?? 'twoPhase',
    recoveryMonths: numericOrDefault(payload, 'recoveryMonths'),
    annualInvoicing: (payload.invoicing ?? 'annual') === 'annual',
    milestones: payload.milestones ?? [],
    lumpSumDeal,
    lumpCost: numericOrDefault(payload, 'lumpSumCost'),
    contractorMilestones: payload.contractorMilestones ?? [],
    factoringEnabled: factoring.enabled ?? false,
    factoringRatePct: factoring.ratePct ?? 1.5,
    factoringTermMonths: factoring.termMonths,
    factoringMethod: factoring.method ?? 'straight',
    whtPct: numericOrDefault(payload, 'whtPct'),
    gstPct: numericOrDefault(payload, 'gstPct'),
    grossUp: payload.grossUp ?? false,
    testBedCost,
  }
}

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

  const setRow = (group, key, note) => {
    const row = group.rows.find(r => r.key === key)
    document.getElementById(`pg-cost-${key}`).textContent = `$${money(row.rawCost)}`
    document.getElementById(`pg-price-${key}`).textContent = `$${money(row.rawPrice)}`
    document.getElementById(`pg-note-${key}`).textContent = note
  }

  setRow(hardwareGroup, 'hwSs', `${ssUnits} units x $${money(payload.ssUnitCost ?? 0)}`)
  setRow(hardwareGroup, 'hwAqm', `${aqUnits} units x $${money(payload.aqUnitCost ?? 0)}`)
  setRow(hardwareGroup, 'hwHemir', `${hemirUnits} units x $${money(payload.hemirUnitCost ?? 0)}`)
  setRow(hardwareGroup, 'hwWarranty', `${warrantyPct}% of ${totalUnits} units = ${warrantyUnits} unit${warrantyUnits === 1 ? '' : 's'}`)
  document.getElementById('pg-total-cost-hw').textContent = `$${money(hardwareGroup.rawTotalCost)}`
  document.getElementById('pg-total-price-hw').textContent = `$${money(hardwareGroup.rawTotalPrice)}`

  setRow(hostingGroup, 'hoSs', `${ssUnits} units x $${money(payload.hoSafesight ?? 0)}`)
  setRow(hostingGroup, 'hoAqm', `${aqUnits} units x $${money(payload.hoAqm ?? 0)}`)
  setRow(hostingGroup, 'hoHemir', `${hemirUnits} units x $${money(payload.hoHemir ?? 0)}`)
  document.getElementById('pg-total-cost-ho').textContent = `$${money(hostingGroup.rawTotalCost)}`
  document.getElementById('pg-total-price-ho').textContent = `$${money(hostingGroup.rawTotalPrice)}`
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
  notice.textContent = dates.length === 1 && names.length === 1
    ? `Rates from batch "${names[0]}", effective ${dates[0]}.`
    : `Rates from ${batches.length} current batches, effective ${dates.sort()[0]} to ${dates.sort()[dates.length - 1]}.`
}

// ── Deal Sheet sub-tab (Round 37 Phase 2), read-only ──────────────────────
//
// The artefact reviewed before a proposal is issued: every input needed to
// reproduce the price, presented rather than edited. Phase 3 gives it versions.
//
// WHAT IT CAN CARRY TODAY is what the four editing sub-tabs produce, which
// Round 37 Phase 0 measured as more than the brief expected: the unit counts,
// the per-line margins, the warranty percentage, both currencies, the
// contingency, the term, the installation responsibility, the milestones, the
// tax adjustments and the payment structure are all captured and writable. The
// one input that exists nowhere is the separate-or-rolled-up warranty setting.
//
// Rates are shown WITH THEIR BATCH, because a price is only reproducible if you
// know which costs it was taken against, and that is the pointer a version will
// freeze.
function renderDealSheetTab(result, payload) {
  const mount = document.getElementById('deal-sheet-inputs')
  if (!mount) return

  const ssUnits = numericOrDefault(payload, 'ssExisting') + numericOrDefault(payload, 'ssNew')
  const dash = (v) => (v === undefined || v === null || v === '') ? '--' : v
  const pct = (v) => (v === undefined || v === null || v === '') ? '--' : `${v}%`

  // A margin row per line, showing whether it is the target or an override.
  // Reading "target" tells a reviewer the line was never touched, which is a
  // different fact from a line deliberately set to the same number.
  const overrides = payload.marginOverrides ?? {}
  const target = numericOrDefault(payload, 'targetMargin')
  const MARGIN_LABELS = {
    hwSs: 'SafeSight hardware', hwAqm: 'AQ Sensor hardware', hwHemir: 'HEMIR hardware',
    hwWarranty: 'Warranty provision',
    inSsEx: 'Install, SafeSight existing', inSsNew: 'Install, SafeSight new',
    inAqm: 'Install, AQ Sensor', inHemir: 'Install, HEMIR',
    hoSs: 'Hosting, SafeSight', hoAqm: 'Hosting, AQ Sensor', hoHemir: 'Hosting, HEMIR',
  }

  const card = (title, rows) => `
    <div class="pg-card">
      <p class="pg-card-title">${escapeSheet(title)}</p>
      ${rows.map(([l, v, note]) => `
        <div class="ds-row">
          <div>
            <div class="ds-label">${escapeSheet(l)}</div>
            ${note ? `<div class="pg-item-note">${escapeSheet(note)}</div>` : ''}
          </div>
          <div class="ds-value">${escapeSheet(String(v))}</div>
        </div>`).join('')}
    </div>`

  const rate = (k) => catalogRates[k] === undefined ? '--' : `$${money(catalogRates[k])}`

  mount.innerHTML = [
    card('Margins', [
      ['Target margin', pct(target), 'applies to any line without its own'],
      ...Object.entries(MARGIN_LABELS).map(([k, l]) =>
        [l, overrides[k] === undefined ? `${target}%` : `${overrides[k]}%`,
            overrides[k] === undefined ? 'target' : 'override']),
    ]),
    card('Base cost data, per unit', [
      ['SafeSight', rate('ssUnitCost'), 'hardware'],
      ['AQ Sensor', rate('aqUnitCost'), 'hardware'],
      ['HEMIR', rate('hemirUnitCost'), 'hardware'],
      ['SafeSight, existing infra', rate('inSsExisting'), 'installation'],
      ['SafeSight, new infra', rate('inSsNew'), 'installation'],
      ['AQ Sensor, existing infra', rate('inAqm'), 'installation'],
      ['HEMIR, existing infra', rate('inHemir'), 'installation'],
      ['SafeSight', rate('hoSafesight'), 'hosting, per month'],
      ['AQ Sensor', rate('hoAqm'), 'hosting, per month'],
      ['HEMIR', rate('hoHemir'), 'hosting, per month'],
    ]),
    card('Terms', [
      ['Contract duration', payload.duration ? `${payload.duration} months` : '--'],
      ['Installation responsibility', dash(payload.installResp)],
      ['Warranty provision', pct(payload.warrantyPct ?? 2),
       `${result.hardware.warrantyUnits} unit${result.hardware.warrantyUnits === 1 ? '' : 's'} at the mix average`],
      ['Separate or rolled into hardware', 'not recorded', 'no field exists for this yet'],
      ['Bid currency', dash(payload.bidCurrency), 'the currency Base Cost Data is held in'],
      ['Proposal currency', dash(payload.proposalCurrency), 'quoted and invoiced to the customer'],
      ['FX contingency', pct(payload.fxContingency)],
      ['Withholding tax', pct(payload.whtPct), payload.grossUp ? 'grossed up' : 'absorbed'],
      ['GST', pct(payload.gstPct), 'passed through'],
    ]),
    card('Units required', [
      ['SafeSight, existing infra', numericOrDefault(payload, 'ssExisting')],
      ['SafeSight, new infra', numericOrDefault(payload, 'ssNew')],
      ['AQ Sensor', numericOrDefault(payload, 'aqm')],
      ['HEMIR', numericOrDefault(payload, 'hemir')],
      ['Total units', result.hardware.totalUnits],
    ]),
  ].join('')

  const b = Object.values(catalogBatches)[0]
  const prov = document.getElementById('deal-sheet-provenance')
  if (prov) {
    prov.textContent = b
      ? `Read-only. Every figure below is an input to the price, priced against batch "${b.batch_label}", effective ${b.effective_from}. Edit on the other sub-tabs.`
      : 'Read-only. Every figure below is an input to the price. Edit on the other sub-tabs.'
  }
  // ssUnits is read above for the same reason the note lines read it: a
  // reviewer checking SafeSight against the two entries needs the sum.
  void ssUnits
}

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

function versionFeedback(msg, ok) {
  const el = document.getElementById('deal-version-feedback')
  if (!el) return
  el.textContent = msg || ''
  el.className = msg ? (ok ? 'msg-success' : 'msg-error') : 'hidden'
}

async function saveVersion() {
  const reasonEl = document.getElementById('deal-version-reason')
  const reason = (reasonEl?.value ?? '').trim()

  // Required, and checked here so the user is told before a request is made.
  // The schema's NOT NULL and length CHECK are what make it true; this is what
  // makes it readable.
  if (!reason) {
    versionFeedback('A reason is required: what changed in this version, and why.', false)
    reasonEl?.focus()
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
  if (dealFormDirty) {
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
  const r = await window.api('POST', `/api/opportunities/${opportunityId}/deal-sheet-versions`,
    { inputs: readPayload(), reason })

  if (!r.ok) {
    versionFeedback(r.data?.error ?? 'The version could not be saved.', false)
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

  if (dealFormDirty) {
    window.openDiscardConfirm(go)
    return
  }
  await go()
}

// ── Recompute + render ────────────────────────────────────────────────────
function recompute() {
  const payload = readPayload()
  const dealInputs = buildDealInputs(payload)
  const result = calculateDeal(dealInputs)
  renderResults(result, payload)
  return result
}

// Deal Summary matrix: rows are line items, columns are Hardware / Hosting
// (over the contract term) / Installation / Total. Mirrors the prototype's
// dealMatrix builder exactly (Terminus Ops.dc.html lines 6946-6963): finance
// cost is folded into the Hardware column's cost, WHT-borne is apportioned
// pro-rata across all three columns by price share (remainder to the last
// column) BEFORE Total and Margin are computed — so the Total column's
// Margin cell is the same dollar figure achievedMargin is a percentage of,
// not a fresh recalculation that could drift from it (confirmed before
// building this).
function computeDealMatrixCols(result, payload) {
  const { hardwareGroup, installGroup, hostingGroup } = result.groups
  const months = payload.duration || 0
  const cols = [
    { cost: hardwareGroup.rawTotalCost, price: hardwareGroup.rawTotalPrice },
    { cost: hostingGroup.rawTotalCost * months, price: hostingGroup.rawTotalPrice * months },
    { cost: installGroup.rawTotalCost, price: installGroup.rawTotalPrice },
  ]
  cols[0].cost += result.financeCost
  // Milestone 5: same treatment as financeCost immediately above - folded
  // into Hardware rather than given its own column, so the matrix's own
  // Total/Margin cells stay the exact figure achievedMargin is a
  // percentage of (this function's own top comment). Without this, the
  // matrix's independently-computed total would silently disagree with
  // achievedMargin/the Deal Sheet's "Gross margin" row the moment
  // testBedCost is nonzero - found while wiring testBedCost in, not a
  // pre-existing bug.
  cols[0].cost += result.testBedCost || 0

  const whtBorne = result.tax.whtBorne
  const priceSum = cols.reduce((s, c) => s + c.price, 0)
  const whtShare = cols.map(c => (priceSum ? Math.round(whtBorne * c.price / priceSum) : 0))
  whtShare[whtShare.length - 1] += whtBorne - whtShare.reduce((s, v) => s + v, 0)
  cols.forEach((c, i) => { c.cost += whtShare[i] })

  const tot = { cost: cols.reduce((s, c) => s + c.cost, 0), price: cols.reduce((s, c) => s + c.price, 0) }
  return { cols, whtShare, all: cols.concat([tot]) }
}

function renderDealMatrix(result, payload) {
  const { whtShare, all } = computeDealMatrixCols(result, payload)
  const whtPct = payload.whtPct || 0
  const grossOf = (p) => (uiState.grossUp && whtPct < 100) ? Math.round(p / (1 - whtPct / 100)) : p
  const cells = (fn) => ({ hardware: `$${money(fn(all[0]))}`, hosting: `$${money(fn(all[1]))}`, installation: `$${money(fn(all[2]))}`, total: `$${money(fn(all[3]))}` })
  const dash = (v) => (v ? `$${money(v)}` : '-')

  const rows = [
    { label: 'Revenue', color: 'var(--white)', totalColor: 'var(--green)', ...cells(c => c.price) },
    { label: 'Cost', color: 'var(--muted)', totalColor: 'var(--white)', ...cells(c => c.cost) },
    {
      label: 'of which financing', color: 'var(--muted-2)', totalColor: 'var(--muted-2)',
      hardware: dash(result.financeCost), hosting: '-', installation: '-', total: dash(result.financeCost),
    },
    {
      label: 'of which WHT absorbed', color: 'var(--muted-2)', totalColor: 'var(--muted-2)',
      hardware: dash(whtShare[0]), hosting: dash(whtShare[1]), installation: dash(whtShare[2]), total: dash(result.tax.whtBorne),
    },
    { label: 'Margin', color: 'var(--muted)', totalColor: 'var(--green)', ...cells(c => c.price - c.cost) },
    { label: 'WHT', color: 'var(--muted)', totalColor: 'var(--muted)', ...cells(c => Math.round(grossOf(c.price) * whtPct / 100)) },
    {
      label: 'Price to customer', color: 'var(--white)', totalColor: 'var(--green)',
      hardware: '-', hosting: '-', installation: '-', total: `$${money(result.tax.invoiceBase + result.tax.gstAmount)}`,
    },
  ]

  const headRow = `
    <div class="dm-row head">
      <div class="dm-label"></div>
      <div class="dm-cell">Hardware (USD)</div>
      <div class="dm-cell">Hosting (USD)</div>
      <div class="dm-cell">Installation (USD)</div>
      <div class="dm-cell">Total (USD)</div>
    </div>`

  const dataRows = rows.map(r => `
    <div class="dm-row">
      <div class="dm-label" style="color:${r.color}">${r.label}</div>
      <div class="dm-cell" style="color:${r.color}">${r.hardware}</div>
      <div class="dm-cell" style="color:${r.color}">${r.hosting}</div>
      <div class="dm-cell" style="color:${r.color}">${r.installation}</div>
      <div class="dm-cell" style="color:${r.totalColor}">${r.total}</div>
    </div>`).join('')

  document.getElementById('deal-matrix').innerHTML = headRow + dataRows
}

// Deal sheet: the full P&L walk from revenue to net receipt after WHT, a
// flat 16-row label/value list, not a table. Mirrors the prototype's
// `deal.rows` exactly (Terminus Ops.dc.html lines 6971-6986) — including
// which rows dash out to '-' when zero/not applicable (PO factoring
// interest, WHT rows, GST) versus which always show a figure (the
// running totals). `rollup.rows` in the prototype is dead code (never
// rendered by its own template), so it isn't reproduced here.
function renderDealSheet(result, payload) {
  const months = payload.duration || 0
  const { hardwareGroup, installGroup, hostingGroup } = result.groups
  const hostingTermCost = hostingGroup.rawTotalCost * months
  const grossUp = uiState.grossUp
  const whtPct = payload.whtPct || 0
  const gstPct = payload.gstPct || 0
  const { invoiceBase, whtAmount, gstAmount, whtBorne } = result.tax
  const { contractNet, oneOffPrice, hostingTermPrice } = result.totals
  const { totalDealCostAll, financeCost } = result

  const rows = [
    { label: 'One-off price, hardware, warranty and installation', value: `$${money(oneOffPrice)}`, color: 'var(--muted)' },
    { label: months ? `Hosting price over ${months} months` : 'Hosting price over contract', value: months ? `$${money(hostingTermPrice)}` : '-', color: 'var(--muted)' },
    { label: 'Revenue, contract value net', value: `$${money(contractNet)}`, color: 'var(--green)' },
    { label: 'Hardware and warranty cost', value: `- $${money(hardwareGroup.rawTotalCost)}`, color: 'var(--muted)' },
    { label: 'Installation cost', value: `- $${money(installGroup.rawTotalCost)}`, color: 'var(--muted)' },
    { label: months ? `Hosting cost over ${months} months` : 'Hosting cost over contract', value: `- $${money(hostingTermCost)}`, color: 'var(--muted)' },
    { label: 'PO factoring interest', value: financeCost ? `- $${money(financeCost)}` : '-', color: 'var(--muted)' },
    {
      label: grossUp ? 'Withholding tax, grossed up and recovered from the customer' : 'Withholding tax absorbed by Terminus',
      value: whtBorne ? `- $${money(whtBorne)}` : '-', color: 'var(--muted)',
    },
    // Milestone 5: carried from the source Test Bed's accumulated_cost on
    // conversion (opportunity_details.test_bed_cost). A pure cost, not
    // priced to the customer - added straight to totalDealCostAll in
    // deal-calculator.js, so it reduces margin here without ever
    // touching contractNet (revenue, above, is unaffected).
    { label: 'Test Bed cost, carried from conversion', value: result.testBedCost ? `- $${money(result.testBedCost)}` : '-', color: 'var(--muted)' },
    { label: 'Total cost', value: `- $${money(totalDealCostAll)}`, color: 'var(--white)' },
    { label: 'Gross margin', value: `$${money(contractNet - totalDealCostAll)}`, color: 'var(--green)' },
    { label: 'Invoice reconciliation, from revenue', value: `$${money(contractNet)}`, color: 'var(--muted-2)' },
    {
      label: grossUp ? `Grossed up for WHT at ${whtPct}%` : 'No gross up, WHT absorbed',
      value: grossUp ? `+ $${money(invoiceBase - contractNet)}` : '-', color: 'var(--muted)',
    },
    { label: `GST at ${gstPct}%, passed through`, value: gstAmount ? `+ $${money(gstAmount)}` : '-', color: 'var(--muted)' },
    { label: `Price to customer${grossUp ? ', grossed up for WHT' : ''}`, value: `$${money(invoiceBase + gstAmount)}`, color: 'var(--green)' },
    { label: `Withholding tax at ${whtPct}%, deducted by the customer`, value: whtAmount ? `- $${money(whtAmount)}` : '-', color: 'var(--muted)' },
    { label: 'Net receipt after WHT', value: `$${money(invoiceBase - whtAmount)}`, color: 'var(--green)' },
  ]

  document.getElementById('deal-sheet-units').textContent = result.hardware.totalUnits

  document.getElementById('deal-sheet').innerHTML = rows.map(r => `
    <div class="ds-row">
      <span class="ds-label">${r.label}</span>
      <span class="ds-value" style="color:${r.color}">${r.value}</span>
    </div>`).join('')
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
  document.getElementById('deal-achieved-margin').textContent = `${result.achievedMargin.toFixed(1)}%`
  document.getElementById('deal-total-cost').textContent = `$${money(result.totalDealCostAll)}`
  document.getElementById('deal-finance-cost').textContent = `$${money(result.financeCost)}`

  renderDealMatrix(result, payload)
  renderDealSheet(result, payload)
  renderYearSchedule(result, payload)
  renderPricingCards(result, payload)
  renderCatalogNotice(payload)
  renderDealSheetTab(result, payload)
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

  const msWarn = document.getElementById('deal-milestone-warn')
  if (uiState.structure === 'hybrid') {
    const msUsdTotal = (payload.milestones ?? []).reduce((s, m) => s + (m.usd || 0), 0)
    const pctOfHw = result.totals.oneOffPrice ? (msUsdTotal / result.totals.oneOffPrice) * 100 : 0
    if (Math.abs(pctOfHw - 100) > 0.5) {
      msWarn.textContent = `Milestones total ${pctOfHw.toFixed(1)}% of hardware + install price (need 100%).`
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
  if (cf.factoringEnabled) {
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
function renderContractorMilestoneRows(contractorMilestones) {
  const tbody = document.getElementById('deal-contractor-tbody')
  tbody.innerHTML = Array.from({ length: MILESTONE_ROWS }).map((_, i) => `
    <tr>
      <td><input type="text" inputmode="numeric" id="deal-cm-${i}-month" style="width:64px"></td>
      <td><input type="text" id="deal-cm-${i}-label" placeholder="e.g. Site handover"></td>
      <td><input type="text" inputmode="decimal" id="deal-cm-${i}-usd"></td>
      <td class="col-mono" id="deal-cm-${i}-pct">--</td>
    </tr>
  `).join('')

  contractorMilestones.forEach((m, i) => {
    if (i >= MILESTONE_ROWS) return
    setVal(`deal-cm-${i}-month`, m.month)
    setVal(`deal-cm-${i}-label`, m.label)
    setVal(`deal-cm-${i}-usd`, m.usd)
  })

  tbody.querySelectorAll('input').forEach(el => el.addEventListener('input', recompute))
}

// Contractor milestone totals: %/USD sum and the "should total 100%"
// check are not a calculateDeal() output - it doesn't compute this at
// all, same as the existing hardware-milestone total check above. Base
// is the raw lumpCost input, since a contractor milestone table only
// ever appears for a Lump Sum deal.
function renderContractorMilestoneTotals(lumpCost) {
  let totalUsd = 0
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const cell = document.getElementById(`deal-cm-${i}-pct`)
    if (!cell) continue
    const usd = num(`deal-cm-${i}-usd`)
    totalUsd += usd
    cell.textContent = lumpCost ? `${((usd / lumpCost) * 100).toFixed(1)}%` : '--'
  }

  const totalPct = lumpCost ? (totalUsd / lumpCost) * 100 : 0
  document.getElementById('deal-contractor-base').textContent = `Lump sum contractor price, $${money(lumpCost)}`
  document.getElementById('deal-contractor-total-usd').textContent = `$${money(totalUsd)}`
  document.getElementById('deal-contractor-total-pct').textContent = `${totalPct.toFixed(1)}%`

  const warn = document.getElementById('deal-contractor-warn')
  if (totalUsd > 0 && Math.abs(totalPct - 100) > 0.5) {
    warn.textContent = `Contractor milestones total ${totalPct.toFixed(1)}% of the contractor price. They should total 100%.`
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

  const overrides = p.marginOverrides ?? {}
  MARGIN_KEYS.forEach(key => setVal(`deal-margin-${key}`, overrides[key] ?? ''))

  uiState.installResp = p.installResp || 'Client Own Installation Team'
  document.getElementById('deal-installResp').value = uiState.installResp
  setVal('deal-lumpCost', p.lumpSumCost ?? '')
  // From the catalog, not from `p`, same correction the unit and hosting rates
  // took in Round 36 Phase 2. `p` never carried these: they are refused by
  // SALESPERSON_WRITABLE_KEYS and no writer has ever existed.
  setVal('deal-inSsExisting', catalogRates.inSsExisting ?? '')
  setVal('deal-inSsNew', catalogRates.inSsNew ?? '')
  setVal('deal-inAqm', catalogRates.inAqm ?? '')
  setVal('deal-inHemir', catalogRates.inHemir ?? '')
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
  setVal('deal-whtPct', p.whtPct ?? 0)
  setVal('deal-gstPct', p.gstPct ?? 0)
  uiState.grossUp = !!p.grossUp
  updateGrossUpButton()

  // Currency (Round 3 Phase 6, 2026-08-17): data entry only, confirmed
  // scope - deliberately not read anywhere in buildDealInputs() below,
  // not wired into the calculation. Defaults match the prototype's own
  // (Terminus Ops.dc.html:6800-6801, both 'USD').
  document.getElementById('deal-bidCurrency').value = p.bidCurrency || 'USD'
  document.getElementById('deal-proposalCurrency').value = p.proposalCurrency || 'USD'
  setVal('deal-fxContingency', p.fxContingency ?? 0)

  setVal('deal-duration', p.duration ?? 0)
  dealDurationOrig = p.duration ?? 0
  dealDurationDirty = false
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
    const isPercent = PERCENT_FIELD_IDS.has(el.id) || el.id.startsWith('deal-margin-') || el.id.endsWith('-usd')
    el.inputMode = isPercent ? 'decimal' : 'numeric'
  })
}

// ── Toggle-button helpers ──────────────────────────────────────────────
// Three mutually exclusive states for the responsibility select's second
// cell: Lump Sum (editable price + summary), per-unit (see table below),
// anything else (not applicable) - matches the prototype's
// installPriceEditable / installPerUnitNote / installPriceReadOnly.
function updateInstallVisibility() {
  const isPerUnit = uiState.installResp.includes('Per Unit')
  const isLumpSum = uiState.installResp.includes('Lump Sum')
  document.getElementById('deal-install-table').classList.toggle('hidden', !isPerUnit)
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

// Round 3 Phase 4 (2026-08-17): see the dealFormDirty declaration above
// for why this is separate from dealDurationDirty.
// ── DIRTY BY COMPARISON, NOT BY EVENT. Round 38. ─────────────────────────
//
// dealFormDirty used to be set by an 'input'/'change' listener on the whole
// panel, which gave it two properties that were defects rather than details:
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

function updateDirtyState() {
  dealFormDirty = dealDirtyKeys().length > 0
  const btn = document.getElementById('btn-save-deal')
  if (btn) btn.disabled = !dealFormDirty
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
  document.getElementById('opp-tab-commercial').addEventListener('change', updateDirtyState)

  document.querySelectorAll('#deal-tab-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#deal-tab-toggle button').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      document.querySelectorAll('.deal-tab-panel').forEach(p => p.classList.add('hidden'))
      document.getElementById(`deal-tab-${btn.dataset.dealTab}`).classList.remove('hidden')
    })
  })

  // Live recompute on every change, no debounce - it's a local function call.
  document.querySelectorAll(
    '#deal-tab-hw input, #deal-tab-install input, #deal-tab-terms input, ' +
    '#deal-duration, #deal-recoveryMonths, #deal-factoring-ratePct, #deal-factoring-termMonths'
  ).forEach(el => el.addEventListener('input', recompute))

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
  document.getElementById('deal-duration').addEventListener('input', () => { dealDurationDirty = true })

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

// Mirrors SALESPERSON_WRITABLE_KEYS in src/routes/opportunities.js's PATCH
// handler, which rejects any other key outright. Rate fields (ssUnitCost,
// aqUnitCost, hemirUnitCost, install/hosting rates) are excluded here.
//
// Round 36 Phase 2: the stopgap this comment described is over. It said the
// rates were "read-only after Opportunity creation, a deliberate stopgap until
// a real Base Cost Data table exists". Phase 0 found nothing wrote them at
// creation either, and the table now exists, so readPayload() sources the unit
// and hosting rates from the catalog instead of from the form.
//
// THE STRIP STAYS, and it is doing more than before. readPayload() now puts
// live catalog figures on these keys, so without this they would be written
// into the Opportunity's payload on the next save - reintroducing the per-deal
// cost basis this round exists to remove, and doing it silently, with values
// that look right on the day they are saved and go stale the moment a new
// batch lands. The server's allowlist would refuse the whole PATCH anyway,
// which means the visible symptom would be every save on this tab failing.
// The install rates stay stripped for the older reason: they are still payload
// fields, and the Installation tab is next round's.
function pickSalespersonWritable(payload) {
  const {
    ssUnitCost, aqUnitCost, hemirUnitCost,
    inSsExisting, inSsNew, inAqm, inHemir,
    hoSafesight, hoAqm, hoHemir,
    ...writable
  } = payload
  return writable
}

// ── Save / submit ──────────────────────────────────────────────────────
async function saveDeal() {
  const feedback = document.getElementById('deal-feedback')
  feedback.textContent = ''
  feedback.className = ''

  const payload = pickSalespersonWritable(readPayload())

  if (!dealDurationDirty) {
    // Never touched on this tab this session - never resend it. Omitting
    // the key entirely (rather than sending whatever #deal-duration
    // still shows) means the server's merge leaves the current value
    // exactly as it is, however it got there, since this endpoint only
    // ever overwrites keys actually present in the payload.
    delete payload.duration
  } else {
    // Genuine edit on this tab: confirm nothing changed the field
    // elsewhere since this tab loaded before overwriting it, and log the
    // same kind of Notes History entry the Reference tab's own edit path
    // already writes for this field - one consistent audit trail
    // regardless of which screen made the change.
    const fresh = await window.api('GET', `/api/opportunities/${opportunityId}`)
    if (!fresh.ok) {
      feedback.textContent = 'Could not verify the current Duration value before saving.'
      feedback.className = 'msg-error'
      return false
    }
    const serverDuration = fresh.data.payload?.duration ?? 0
    if (String(serverDuration) !== String(dealDurationOrig)) {
      feedback.textContent = 'Duration was changed elsewhere since this tab was loaded. Reload the page before saving.'
      feedback.className = 'msg-error'
      return false
    }
    // Label text duplicated from opportunity-reference.js's own
    // DATE_FIELDS entry for 'duration' ("Contract Duration (months)"),
    // not imported - this file is a <script type="module">, its own
    // scope, opportunity-reference.js's classic-script globals aren't
    // reachable from here. Keep this string in sync with that label if
    // it ever changes.
    payload.notes = [
      {
        text: `Contract Duration (months) changed from ${dealDurationOrig || '--'} to ${payload.duration || '--'}.`,
        at: new Date().toISOString(),
        by: window.currentSession?.user?.email ?? '',
      },
      ...(fresh.data.payload?.notes ?? []),
    ]
  }

  const result = await window.api('PATCH', `/api/opportunities/${opportunityId}`, { payload })

  if (!result.ok) {
    feedback.textContent = result.data?.error ?? 'Failed to save.'
    feedback.className = 'msg-error'
    return false
  }

  dealDurationDirty = false
  dealDurationOrig = payload.duration ?? dealDurationOrig
  captureSavedBaseline()

  feedback.textContent = `Saved (revision ${result.data.revision_number}).`
  feedback.className = 'msg-success'
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
}
