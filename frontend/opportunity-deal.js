// Opportunity Commercials tab: live client-side deal preview + save/submit.
//
// Imports the exact same deal-calculator.js the server uses (served at
// /lib/deal-calculator.js from src/lib/deal-calculator.js via the static
// mount in server.js) so preview math can never drift from the server's
// authoritative recompute — same file on disk, not a copy.
//
// This module only ever previews. POST /api/deals/submit is the sole
// source of truth for an approved snapshot: it recomputes entirely
// server-side from record_revisions.payload, ignoring whatever this
// module displays. Submitting here always saves first (PATCH), so the
// server recompute is against the figures actually on screen.
import { calculateDeal } from '/lib/deal-calculator.js'

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
// Milestone 5: opportunity_details.test_bed_cost, not part of
// record_revisions.payload - set once at conversion, read-only here,
// carried into buildDealInputs() so live preview matches the server's
// own loadDealInputsFromOpportunity() in deals.js exactly (same file
// import already guarantees the calculation itself can't drift; this is
// the one input source deals.js reads that payload alone doesn't cover).
let testBedCost = 0

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

function num(id) {
  const v = parseFloat(document.getElementById(id)?.value)
  return Number.isFinite(v) ? v : 0
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
    ssExisting: num('deal-ssExisting'),
    ssNew: num('deal-ssNew'),
    aqm: num('deal-aqm'),
    hemir: num('deal-hemir'),

    ssUnitCost: num('deal-ssUnitCost'),
    aqUnitCost: num('deal-aqUnitCost'),
    hemirUnitCost: num('deal-hemirUnitCost'),

    installResp: uiState.installResp,
    lumpSumCost: num('deal-lumpCost'),
    inSsExisting: num('deal-inSsExisting'),
    inSsNew: num('deal-inSsNew'),
    inAqm: num('deal-inAqm'),
    inHemir: num('deal-inHemir'),

    hoSafesight: num('deal-hoSafesight'),
    hoAqm: num('deal-hoAqm'),
    hoHemir: num('deal-hoHemir'),

    targetMargin: num('deal-targetMargin'),
    marginOverrides,

    warrantyPct: num('deal-warrantyPct'),
    whtPct: num('deal-whtPct'),
    gstPct: num('deal-gstPct'),
    grossUp: uiState.grossUp,

    duration: num('deal-duration'),
    structure: uiState.structure,
    recoveryMonths: num('deal-recoveryMonths'),
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
  const targetMargin = payload.targetMargin ?? 30
  const overrides = payload.marginOverrides ?? {}
  const marginFor = (key) => overrides[key] ?? targetMargin

  const ssExisting = payload.ssExisting ?? 0
  const ssNew = payload.ssNew ?? 0
  const aqmUnits = payload.aqm ?? 0
  const hemirUnits = payload.hemir ?? 0

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
    { key: 'inLump', cost: payload.lumpSumCost ?? 0, marginPct: marginFor('inLump') },
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
    warrantyPct: payload.warrantyPct ?? 2,
    installLineItems,
    hostingLineItems,
    hardwareMargins: {
      hwSs: marginFor('hwSs'),
      hwAqm: marginFor('hwAqm'),
      hwHemir: marginFor('hwHemir'),
      hwWarranty: marginFor('hwWarranty'),
    },
    months: payload.duration ?? 0,
    structure: payload.structure ?? 'twoPhase',
    recoveryMonths: payload.recoveryMonths,
    annualInvoicing: (payload.invoicing ?? 'annual') === 'annual',
    milestones: payload.milestones ?? [],
    lumpSumDeal,
    lumpCost: payload.lumpSumCost ?? 0,
    contractorMilestones: payload.contractorMilestones ?? [],
    factoringEnabled: factoring.enabled ?? false,
    factoringRatePct: factoring.ratePct ?? 1.5,
    factoringTermMonths: factoring.termMonths,
    factoringMethod: factoring.method ?? 'straight',
    whtPct: payload.whtPct ?? 0,
    gstPct: payload.gstPct ?? 0,
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
  const ssUnits = (payload.ssExisting ?? 0) + (payload.ssNew ?? 0)
  const aqUnits = payload.aqm ?? 0
  const hemirUnits = payload.hemir ?? 0
  const { totalUnits, warrantyUnits } = result.hardware
  const warrantyPct = payload.warrantyPct ?? 2

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
      <td><input type="number" id="deal-ms-${i}-month" min="0" style="width:64px"></td>
      <td><input type="text" id="deal-ms-${i}-label" placeholder="e.g. Installation complete"></td>
      <td><input type="number" id="deal-ms-${i}-usd" min="0"></td>
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
      <td><input type="number" id="deal-cm-${i}-month" min="0" style="width:64px"></td>
      <td><input type="text" id="deal-cm-${i}-label" placeholder="e.g. Site handover"></td>
      <td><input type="number" id="deal-cm-${i}-usd" min="0"></td>
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

  document.getElementById('deal-install-units-inSsEx').textContent = payload.ssExisting ?? 0
  document.getElementById('deal-install-units-inSsNew').textContent = payload.ssNew ?? 0
  document.getElementById('deal-install-units-inAqm').textContent = payload.aqm ?? 0
  document.getElementById('deal-install-units-inHemir').textContent = payload.hemir ?? 0

  renderContractorMilestoneTotals(payload.lumpSumCost ?? 0)
}

// ── Populate form from a saved payload ────────────────────────────────────
function populateForm(payload) {
  const p = payload ?? {}

  setVal('deal-ssExisting', p.ssExisting ?? 0)
  setVal('deal-ssNew', p.ssNew ?? 0)
  setVal('deal-aqm', p.aqm ?? 0)
  setVal('deal-hemir', p.hemir ?? 0)

  setVal('deal-ssUnitCost', p.ssUnitCost ?? '')
  setVal('deal-aqUnitCost', p.aqUnitCost ?? '')
  setVal('deal-hemirUnitCost', p.hemirUnitCost ?? '')

  setVal('deal-hoSafesight', p.hoSafesight ?? '')
  setVal('deal-hoAqm', p.hoAqm ?? '')
  setVal('deal-hoHemir', p.hoHemir ?? '')

  const overrides = p.marginOverrides ?? {}
  MARGIN_KEYS.forEach(key => setVal(`deal-margin-${key}`, overrides[key] ?? ''))

  uiState.installResp = p.installResp || 'Client Own Installation Team'
  document.getElementById('deal-installResp').value = uiState.installResp
  setVal('deal-lumpCost', p.lumpSumCost ?? '')
  setVal('deal-inSsExisting', p.inSsExisting ?? '')
  setVal('deal-inSsNew', p.inSsNew ?? '')
  setVal('deal-inAqm', p.inAqm ?? '')
  setVal('deal-inHemir', p.inHemir ?? '')
  updateInstallVisibility()

  setVal('deal-targetMargin', p.targetMargin ?? 30)
  setVal('deal-warrantyPct', p.warrantyPct ?? 2)
  setVal('deal-whtPct', p.whtPct ?? 0)
  setVal('deal-gstPct', p.gstPct ?? 0)
  uiState.grossUp = !!p.grossUp
  updateGrossUpButton()

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
  setVal('deal-factoring-ratePct', factoring.ratePct ?? 1.5)
  setVal('deal-factoring-termMonths', factoring.termMonths ?? '')
  updateFactoringButtons()
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

// ── Wiring (once per page load) ───────────────────────────────────────────
function wireOnce() {
  if (wired) return
  wired = true

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
    recompute()
  })

  document.querySelectorAll('#deal-structure-toggle .ring-radio').forEach(el => {
    el.addEventListener('click', () => {
      uiState.structure = el.dataset.structure
      updateStructureButtons()
      updateStructureVisibility()
      recompute()
    })
  })

  document.querySelectorAll('#deal-invoicing-toggle .ring-radio, #deal-hybrid-invoicing-toggle .ring-radio').forEach(el => {
    el.addEventListener('click', () => {
      uiState.invoicing = el.dataset.invoicing
      updateInvoicingButtons()
      recompute()
    })
  })

  document.getElementById('deal-factoring-toggle').addEventListener('click', () => {
    uiState.factoringEnabled = !uiState.factoringEnabled
    updateFactoringButtons()
    recompute()
  })

  document.querySelectorAll('#deal-factoring-method-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      uiState.factoringMethod = btn.dataset.method
      updateFactoringButtons()
      recompute()
    })
  })

  document.getElementById('btn-save-deal').addEventListener('click', saveDeal)
  document.getElementById('btn-submit-deal').addEventListener('click', submitDeal)
}

// Mirrors SALESPERSON_WRITABLE_KEYS in src/routes/opportunities.js's PATCH
// handler, which rejects any other key outright. Rate fields (ssUnitCost,
// aqUnitCost, hemirUnitCost, install/hosting rates) are excluded here -
// they're read-only after Opportunity creation, a deliberate stopgap until
// a real Base Cost Data table exists (see that route's comment block).
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

  feedback.textContent = `Saved (revision ${result.data.revision_number}).`
  feedback.className = 'msg-success'
  return true
}

async function submitDeal() {
  const feedback = document.getElementById('deal-feedback')
  feedback.textContent = 'Saving...'
  feedback.className = ''

  const saved = await saveDeal()
  if (!saved) return

  const result = recompute()
  const submitResult = await window.api('POST', '/api/deals/submit', {
    opportunityId,
    clientReportedTotals: {
      contractNet: result.totals.contractNet,
      achievedMargin: result.achievedMargin,
    },
  })

  if (!submitResult.ok) {
    feedback.textContent = submitResult.data?.error ?? submitResult.data?.message ?? 'Submit failed.'
    feedback.className = 'msg-error'
    return
  }

  feedback.textContent = `Submitted (revision ${submitResult.data.revision_number}).`
  feedback.className = 'msg-success'
}

// ── Entry point, called by app.js's renderOppDetail() ─────────────────────
window.initOpportunityDealPanel = function (opp) {
  opportunityId = opp.id
  testBedCost = opp.opportunity_details?.test_bed_cost ?? 0
  wireOnce()
  populateForm(opp.payload)
  recompute()
}
