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

    isPerUnit: uiState.installResp === 'Terminus Installation Team',
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

    contractorMilestones: [],

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

  const installLineItems = payload.isPerUnit ? [
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
  const lumpSumDeal = (payload.installResp ?? '').includes('Lump Sum')

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
  }
}

// ── Recompute + render ────────────────────────────────────────────────────
function recompute() {
  const payload = readPayload()
  const dealInputs = buildDealInputs(payload)
  const result = calculateDeal(dealInputs)
  renderResults(result, payload)
  return result
}

function renderResults(result, payload) {
  document.getElementById('deal-contract-net').textContent = `$${money(result.totals.contractNet)}`
  document.getElementById('deal-achieved-margin').textContent = `${result.achievedMargin.toFixed(1)}%`
  document.getElementById('deal-total-cost').textContent = `$${money(result.totalDealCostAll)}`
  document.getElementById('deal-finance-cost').textContent = `$${money(result.financeCost)}`
  document.getElementById('deal-warranty-computed').textContent = `$${money(result.hardware.warrantyCost)}`

  const { hardwareGroup, installGroup, hostingGroup } = result.groups
  const hostingTermCost = hostingGroup.rawTotalCost * (payload.duration || 0)
  const hostingTermPrice = hostingGroup.rawTotalPrice * (payload.duration || 0)
  const marginPct = (price, cost) => (price ? (((price - cost) / price) * 100).toFixed(1) + '%' : '--')

  const rows = [
    ['Hardware', hardwareGroup.rawTotalCost, hardwareGroup.rawTotalPrice],
    ['Installation', installGroup.rawTotalCost, installGroup.rawTotalPrice],
    ['Hosting (per month)', hostingGroup.rawTotalCost, hostingGroup.rawTotalPrice],
    ['Hosting (contract term)', hostingTermCost, hostingTermPrice],
    ['Total contract', result.totals.totalDealCost, result.totals.contractNet],
  ]

  document.getElementById('deal-breakdown-tbody').innerHTML = rows.map(([label, cost, price]) => `
    <tr><td>${label}</td><td>$${money(cost)}</td><td>$${money(price)}</td><td>${marginPct(price, cost)}</td></tr>
  `).join('')

  const cashOk = document.getElementById('deal-cashflow-ok')
  const cashWarn = document.getElementById('deal-cashflow-warn')
  if (result.cashFlow.minCash >= 0) {
    cashOk.classList.remove('hidden')
    cashWarn.classList.add('hidden')
  } else {
    cashOk.classList.add('hidden')
    cashWarn.textContent = `Cash position falls short by $${money(Math.abs(result.cashFlow.minCash))} in month ${result.cashFlow.minCashMonth}.`
    cashWarn.classList.remove('hidden')
  }

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
  uiState.structure = p.structure || 'twoPhase'
  updateStructureButtons()
  setVal('deal-recoveryMonths', p.recoveryMonths ?? '')
  uiState.invoicing = p.invoicing || 'annual'
  updateInvoicingButtons()
  updateStructureVisibility()

  renderMilestoneRows(p.milestones ?? [])

  const factoring = p.factoring ?? {}
  uiState.factoringEnabled = !!factoring.enabled
  uiState.factoringMethod = factoring.method || 'straight'
  setVal('deal-factoring-ratePct', factoring.ratePct ?? 1.5)
  setVal('deal-factoring-termMonths', factoring.termMonths ?? '')
  updateFactoringButtons()
}

// ── Toggle-button helpers ──────────────────────────────────────────────
function updateInstallVisibility() {
  const isPerUnit = uiState.installResp === 'Terminus Installation Team'
  const isLumpSum = uiState.installResp === 'Lump Sum'
  document.getElementById('deal-install-table').classList.toggle('hidden', !isPerUnit)
  document.getElementById('deal-lumpCost-group').classList.toggle('hidden', !isLumpSum)
}

function updateGrossUpButton() {
  document.getElementById('deal-grossUp-toggle').textContent = `Gross up: ${uiState.grossUp ? 'On' : 'Off'}`
}

function updateStructureButtons() {
  document.querySelectorAll('#deal-structure-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.structure === uiState.structure)
  })
}

function updateStructureVisibility() {
  document.getElementById('deal-recovery-group').classList.toggle('hidden', uiState.structure === 'single')
  document.getElementById('deal-milestones-group').classList.toggle('hidden', uiState.structure !== 'hybrid')
}

function updateInvoicingButtons() {
  document.querySelectorAll('#deal-invoicing-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.invoicing === uiState.invoicing)
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

  document.querySelectorAll('#deal-structure-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      uiState.structure = btn.dataset.structure
      updateStructureButtons()
      updateStructureVisibility()
      recompute()
    })
  })

  document.querySelectorAll('#deal-invoicing-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      uiState.invoicing = btn.dataset.invoicing
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
  const result = await window.api('PATCH', `/api/opportunities/${opportunityId}`, { payload })

  if (!result.ok) {
    feedback.textContent = result.data?.error ?? 'Failed to save.'
    feedback.className = 'msg-error'
    return false
  }

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
  wireOnce()
  populateForm(opp.payload)
  recompute()
}
