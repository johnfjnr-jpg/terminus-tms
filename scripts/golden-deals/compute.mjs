#!/usr/bin/env node
// ── THE RUN THAT PRODUCED THE FIGURES ────────────────────────────────────
//
// Committed so it can be re-run, which is the brief's own requirement: every
// figure in GOLDEN_DEALS.md is EXECUTED here by the live engine and none is
// paraphrased, retyped or rounded by hand on its way into the document.
//
// It writes two artefacts from ONE pricing run each:
//
//   GOLDEN_DEALS.md                        for John, to reproduce in Excel
//   scripts/golden-deals/expectations.json for the acceptance harness
//
// ONE RUN, TWO ARTEFACTS, so the document and the suite cannot disagree about
// what the engine said (Verification 20). The harness never reads the markdown
// and the markdown is never hand-corrected: a figure that looks wrong is fixed
// by fixing the engine or the fixture and re-running this.
//
//   node scripts/golden-deals/compute.mjs
import { writeFileSync } from 'node:fs'
import { GOLDEN_DEALS, GOLDEN_CATALOG } from './deals.mjs'
import { priceGoldenDeal, flatten } from './engine.mjs'

const N = (v) => {
  if (v === null || v === undefined) return 'not recorded'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v !== 'number') return String(v)
  return Number.isInteger(v) ? String(v) : String(v)
}
const money = (v) => (v === null || v === undefined ? 'not recorded'
  : v.toLocaleString('en-US', { maximumFractionDigits: 2 }))
const pct = (v) => (v === null || v === undefined ? 'not recorded' : `${v}%`)

const LINE_LABELS = {
  hwSs: 'SafeSight hardware', hwAqm: 'AQ Sensor hardware', hwHemir: 'HEMIR hardware',
  hwWarranty: 'Warranty provision',
  inSsEx: 'Install, SafeSight on existing infrastructure',
  inSsNew: 'Install, SafeSight on new infrastructure',
  inAqm: 'Install, AQ Sensor', inHemir: 'Install, HEMIR',
  inLump: 'Installation, lump sum', inNone: 'Installation, none',
  hoSs: 'Hosting, SafeSight', hoAqm: 'Hosting, AQ Sensor', hoHemir: 'Hosting, HEMIR',
}

const RATE_LABELS = {
  ssUnitCost: 'SafeSight unit cost', aqUnitCost: 'AQ Sensor unit cost',
  hemirUnitCost: 'HEMIR unit cost',
  hoSafesight: 'Hosting per SafeSight unit per month',
  hoAqm: 'Hosting per AQ Sensor per month', hoHemir: 'Hosting per HEMIR per month',
  inSsExisting: 'Install per SafeSight on existing infrastructure',
  inSsNew: 'Install per SafeSight on new infrastructure',
  inAqm: 'Install per AQ Sensor', inHemir: 'Install per HEMIR',
}

const groupSection = (title, group, perMonth = false) => {
  const out = [`**${title}**${perMonth ? ' (per month)' : ''}`, '',
    '| line | cost | margin used | price | implied margin | priced from |',
    '|---|---|---|---|---|---|']
  for (const r of group.rows) {
    const from = r.overridden ? 'an absolute price override' : 'cost / (1 - margin)'
    out.push(`| ${LINE_LABELS[r.key] ?? r.key} | ${money(r.rawCost)} | ${
      r.overridden ? 'n/a' : ''} | ${money(r.rawPrice)} | ${
      r.impliedMarginPct === null ? 'no price, so none' : `${r.impliedMarginPct}%`} | ${from} |`)
  }
  out.push(`| **total** | **${money(group.rawTotalCost)}** | | **${money(group.rawTotalPrice)}** | | |`, '')
  return out.join('\n')
}

// ── WHAT EACH LINE ACTUALLY PRICED FROM ──────────────────────────────────
//
// IT READS THE EFFECTIVE OVERRIDES, NOT THE PAYLOAD'S, and the first run of
// this script is why. It read `payload.priceOverrides` and reported every G1
// line as pricing at the deal's 32% target margin. **Eight of G1's eleven lines
// do not.** Under OPEX, `buildDealInputs` meets the all-in monthly fee by an
// INVERSE ALLOCATION that writes a price override onto every scalable line, so
// the effective set is `inputs.priceOverrides` plus each line item's own
// `priceOverride`, and the payload's copy is only the ones a PERSON entered.
//
// The table below therefore distinguishes them, because they are two different
// facts about a deal: somebody quoted this line at a figure, versus this line
// was scaled to hit a fee quoted for the whole type. Reporting the second as
// the first would have described a decision nobody took.
const marginsUsed = (priced) => {
  const m = priced.inputs.hardwareMargins
  const lines = ['| line | prices from | the figure, and where it came from |', '|---|---|---|']
  const deal = priced.deal.payload.targetMargin
  const ov = priced.deal.payload.marginOverrides ?? {}
  const entered = priced.deal.payload.priceOverrides ?? {}
  const effective = priced.inputs.priceOverrides ?? {}

  const say = (key, value, lineOverride) => {
    const label = LINE_LABELS[key] ?? key
    const price = lineOverride !== undefined ? lineOverride : effective[key]
    if (price !== undefined && price !== null) {
      return entered[key] !== undefined
        ? `| ${label} | an absolute PRICE | ${money(price)}, entered for this line. The margin is not used |`
        : `| ${label} | an absolute PRICE | ${money(price)}, from the OPEX all-in fee allocation. The margin is not used |`
    }
    if (key === 'hwWarranty') return `| ${label} | nothing. It goes at COST | the warranty reaches the customer at cost, by rule |`
    return ov[key] !== undefined
      ? `| ${label} | a MARGIN | ${pct(value)}, overridden for this line |`
      : `| ${label} | a MARGIN | ${pct(value)}, the deal's target margin |`
  }

  for (const k of ['hwSs', 'hwAqm', 'hwHemir']) lines.push(say(k, m[k]))
  lines.push(say('hwWarranty', 0))
  for (const li of priced.inputs.installLineItems) lines.push(say(li.key, li.marginPct, li.priceOverride))
  for (const li of priced.inputs.hostingLineItems) lines.push(say(li.key, li.marginPct, li.priceOverride))
  void deal
  return lines.join('\n')
}

const cashFlowTable = (cf) => {
  const out = ['| month | hardware in | hosting in | advance | CASH IN | hardware out | contractor out | hosting out | factoring principal | factoring interest | CASH OUT | net | cumulative |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
  for (const r of cf.rows) {
    out.push(`| ${r.m} | ${money(r.hardwareIn)} | ${money(r.hostingIn)} | ${money(r.advance)} | ${money(r.cashIn)} | ${money(r.hwOut)} | ${money(r.contractorOut)} | ${money(r.hostOut)} | ${money(r.facP)} | ${money(r.facI)} | ${money(r.cashOut)} | ${money(r.cashNet)} | ${money(r.cum)} |`)
  }
  return out.join('\n')
}

const dealSection = (priced) => {
  const { deal, resolution, inputs, result, opex } = priced
  const p = deal.payload
  const S = []
  S.push(`# ${deal.id}. ${deal.title}`, '')

  // ── EVERY INPUT ────────────────────────────────────────────────────────
  S.push('## The inputs, in full', '')
  S.push('| input | value |', '|---|---|')
  const show = [
    ['Payment mode', p.paymentMode], ['Structure', p.structure ?? '(absent, so twoPhase)'],
    ['SafeSight units on existing infrastructure', p.ssExisting],
    ['SafeSight units on new infrastructure', p.ssNew],
    ['AQ Sensor units', p.aqm], ['HEMIR units', p.hemir],
    ['Contract duration, months', p.duration],
    ['Recovery period, months', p.recoveryMonths ?? 'not recorded'],
    ['Target margin', pct(p.targetMargin)], ['Warranty', pct(p.warrantyPct)],
    ['Installation responsibility', p.installResp],
    ['Lump sum cost', p.lumpSumCost === undefined ? 'n/a' : money(p.lumpSumCost)],
    ['Invoicing', p.invoicing], ['Withholding tax', pct(p.whtPct)],
    ['GST', pct(p.gstPct)], ['Grossed up for WHT', p.grossUp ? 'yes' : 'no'],
  ]
  for (const [k, v] of show) S.push(`| ${k} | ${N(v)} |`)
  if (p.marginOverrides) for (const [k, v] of Object.entries(p.marginOverrides)) S.push(`| MARGIN OVERRIDE, ${LINE_LABELS[k] ?? k} | ${pct(v)} |`)
  if (p.priceOverrides) for (const [k, v] of Object.entries(p.priceOverrides)) S.push(`| PRICE OVERRIDE, ${LINE_LABELS[k] ?? k} | ${money(v)} |`)
  if (p.opexUnitFees) for (const [k, v] of Object.entries(p.opexUnitFees)) S.push(`| OPEX all-in monthly fee per unit, ${k} | ${money(v)} |`)
  if (p.opexUnitMargins) for (const [k, v] of Object.entries(p.opexUnitMargins)) S.push(`| OPEX target margin, ${k} | ${pct(v)} |`)
  if (p.factoring?.enabled) {
    S.push(`| PO factoring | on, ${p.factoring.ratePct}% per month, ${p.factoring.termMonths} months, ${p.factoring.method} |`)
  }
  for (const k of ['inSsExisting', 'inSsNew', 'inAqm', 'inHemir']) {
    if (p[k] !== undefined) S.push(`| RATE OVERRIDE, ${RATE_LABELS[k]} | ${money(p[k])} |`)
  }
  if (p.milestones?.length) {
    S.push('', '**Customer payment milestones** (a percentage of the one-off PRICE)', '',
      '| month | milestone | % |', '|---|---|---|')
    for (const m of p.milestones) S.push(`| ${m.month} | ${m.label} | ${m.pct}% |`)
  }
  if (p.contractorMilestones?.length) {
    S.push('', '**Contractor payment milestones** (a percentage of the lump sum COST)', '',
      '| month | milestone | % |', '|---|---|---|')
    for (const m of p.contractorMilestones) S.push(`| ${m.month} | ${m.label} | ${m.pct}% |`)
  }
  S.push('')

  // ── RATES ──────────────────────────────────────────────────────────────
  S.push('## The rates this deal priced against, and where each came from', '')
  S.push('| rate | value | source |', '|---|---|---|')
  for (const l of resolution.lines) {
    S.push(`| ${RATE_LABELS[l.key]} | ${l.value === null ? 'ABSENT' : money(l.value)} | ${
      l.source === 'overridden' ? `quoted for this job (catalog says ${money(l.catalogRate)})` : l.source} |`)
  }
  S.push('')

  // ── STEP 1 ─────────────────────────────────────────────────────────────
  const hw = result.hardware
  S.push('## Step 1. Hardware cost, and the warranty provision', '')
  S.push('```')
  S.push(`hardware cost = ${money(GOLDEN_CATALOG.ssUnitCost)} x ${inputs.ssUnits}  +  ${money(GOLDEN_CATALOG.aqUnitCost)} x ${inputs.aqUnits}  +  ${money(GOLDEN_CATALOG.hemirUnitCost)} x ${inputs.hemirUnits}`)
  S.push(`              = ${money(hw.hardwareCost)}`)
  S.push('')
  S.push(`warranty COUNT = ceiling( ${hw.warrantyBasisUnits} SafeSight units x ${p.warrantyPct}% ) = ${hw.warrantyUnits} unit(s)`)
  S.push(`   the basis is SAFESIGHT UNITS ONLY, and it rounds UP`)
  S.push(`warranty UNIT VALUE = ${money(inputs.ssUnitCost)} unit cost + ${money(inputs.ssInstallExistingCost)} existing-infrastructure install = ${money(hw.warrantyUnitCost)}`)
  S.push(`warranty COST = ${hw.warrantyUnits} x ${money(hw.warrantyUnitCost)} = ${money(hw.warrantyCost)}`)
  S.push('```', '')

  // ── STEP 2 ─────────────────────────────────────────────────────────────
  S.push('## Step 2. The margin each line prices at', '')
  S.push(marginsUsed(priced), '')
  S.push('## Step 3. The three priced groups', '')
  S.push('Price is `cost / (1 - margin)`, rounded to whole dollars. It is a DIVISION,', 'not a markup: a 30% margin on $100 of cost is $142.86, not $130.', '')
  S.push(groupSection('Hardware', result.groups.hardwareGroup))
  S.push(groupSection('Installation', result.groups.installGroup))
  S.push(groupSection('Hosting', result.groups.hostingGroup, true))

  // ── STEP 4 ─────────────────────────────────────────────────────────────
  const t = result.totals
  S.push('## Step 4. Contract totals', '')
  S.push('```')
  S.push(`one-off price      = hardware ${money(result.groups.hardwareGroup.rawTotalPrice)} + installation ${money(result.groups.installGroup.rawTotalPrice)} = ${money(t.oneOffPrice)}`)
  S.push(`hosting per month  = ${money(t.hostingMonthPrice)}`)
  S.push(`hosting over term  = ${money(t.hostingMonthPrice)} x ${inputs.months} = ${money(t.hostingTermPrice)}`)
  S.push(`CONTRACT NET       = ${money(t.oneOffPrice)} + ${money(t.hostingTermPrice)} = ${money(t.contractNet)}`)
  S.push('')
  S.push(`total deal cost    = ${money(result.groups.hardwareGroup.rawTotalCost)} + ${money(result.groups.installGroup.rawTotalCost)} + ${money(result.groups.hostingGroup.rawTotalCost)} x ${inputs.months} = ${money(t.totalDealCost)}`)
  S.push(`margin before finance = (${money(t.contractNet)} - ${money(t.totalDealCost)}) / ${money(t.contractNet)} = ${t.achievedMarginPreFinance}%`)
  S.push('```', '')

  // ── STEP 5 ─────────────────────────────────────────────────────────────
  const tax = result.tax
  S.push('## Step 5. Withholding tax and GST', '')
  S.push('```')
  if (p.grossUp) {
    S.push(`GROSSED UP, so the invoice base is raised until the customer's deduction`)
    S.push(`leaves contract net intact:`)
    S.push(`  invoice base = ${money(t.contractNet)} / (1 - ${p.whtPct}%) = ${money(tax.invoiceBase)}`)
  } else {
    S.push(`NOT grossed up, so the invoice base IS contract net = ${money(tax.invoiceBase)}`)
  }
  S.push(`  WHT deducted by the customer = ${money(tax.invoiceBase)} x ${p.whtPct}% = ${money(tax.whtAmount)}`)
  S.push(`  GST                          = ${money(tax.invoiceBase)} x ${p.gstPct}% = ${money(tax.gstAmount)}`)
  S.push(`  WHT BORNE BY TERMINUS        = ${money(tax.whtBorne)}   ${p.grossUp
    ? '(zero, because the gross-up passes it to the customer)'
    : '(the full amount, because there is no gross-up)'}`)
  S.push('```', '')

  // ── STEP 6 ─────────────────────────────────────────────────────────────
  const cf = result.cashFlow
  S.push('## Step 6. The bottom line', '')
  S.push('```')
  S.push(`priced cost        ${money(t.totalDealCost)}`)
  S.push(`finance cost     + ${money(result.financeCost)}${cf.factoringTermMissing ? '   NOT RECORDED: the facility has no term' : ''}`)
  S.push(`WHT borne        + ${money(tax.whtBorne)}`)
  S.push(`Test Bed cost    + ${money(result.testBedCost)}   (none of these four came from a conversion)`)
  S.push(`TOTAL DEAL COST  = ${money(result.totalDealCostAll)}`)
  S.push('')
  S.push(`ACHIEVED MARGIN  = (${money(t.contractNet)} - ${money(result.totalDealCostAll)}) / ${money(t.contractNet)} = ${result.achievedMargin}%`)
  S.push('```', '')

  // ── OPEX ───────────────────────────────────────────────────────────────
  if (opex) {
    S.push('## Step 7. The OPEX table: what the customer is quoted per unit per month', '')
    S.push('| type | units | all-in monthly fee per unit | blended margin | contract total |', '|---|---|---|---|---|')
    for (const r of opex) {
      S.push(`| ${r.label} | ${r.units} | ${r.monthlyFee === null ? 'not stated' : money(r.monthlyFee)} | ${
        r.marginPct === null ? 'not stated' : `${r.marginPct}%`} | ${r.contractTotal === null ? 'not stated' : money(r.contractTotal)} |`)
    }
    S.push('', 'The margin here is BLENDED across hardware, warranty, installation and',
      'hosting, so it sits below the margin the hardware line itself prices at:',
      'the warranty inside it reaches the customer at cost.', '')
  }

  // ── CASH FLOW ──────────────────────────────────────────────────────────
  S.push(`## Step ${opex ? 8 : 7}. Cash flow, month by month`, '')
  S.push('```')
  S.push(`structure          ${cf.structure}`)
  S.push(`recovery period    ${cf.recov === null ? 'none (this structure has no recovery period)' : `${cf.recov} months`}`)
  S.push(`invoicing          ${cf.annualInvoicing ? 'annual in advance, so each 12-month block bills in its first month' : 'monthly'}`)
  S.push(`contractor staged  ${cf.contractorStaged ? 'yes, from the schedule above' : 'no, so the whole contractor cost leaves in month 1'}`)
  if (cf.factoringEnabled) {
    S.push(`factoring          ${money(cf.principal)} advanced in month 1, repaid over ${cf.facTerm} months, ${cf.factoringMethod}`)
    S.push(`factoring interest ${money(cf.facInterest)} in total`)
  }
  S.push('')
  S.push(`total revenue      ${money(cf.totRev)}`)
  S.push(`total cost         ${money(cf.totCost)}`)
  S.push(`MINIMUM CASH       ${money(cf.minCash)} at month ${cf.minCashMonth}`)
  S.push('```', '')
  S.push(cashFlowTable(cf), '')
  return S.join('\n')
}

// ── EMIT ──────────────────────────────────────────────────────────────────
const priced = GOLDEN_DEALS.map((d) => priceGoldenDeal(d))

const head = []
head.push('# THE FOUR GOLDEN DEALS', '')
head.push('**PROVISIONAL until John confirms these figures.** Until then the acceptance',
  'harness says so in its own output.', '')
head.push('Every figure below was EXECUTED by the live pricing engine, not paraphrased',
  'from it. The run is `scripts/golden-deals/compute.mjs`, committed, and it writes',
  'this file and the harness\'s expectations from one pricing run each, so the',
  'document and the suite cannot disagree.', '')
head.push('The pipeline, exactly as the application runs it:', '',
  '```', 'resolveRates(payload, catalog)  ->  buildDealInputs  ->  calculateDeal',
  '                                                     (+ opexRows on OPEX)', '```', '')
head.push('## The rate card all four price against', '')
head.push('**Declared in the fixture, NOT read from the database**, so a golden deal',
  'means the same thing next year. The live catalog is a batch with an effective',
  'date and it moves; a suite pinned to it would go red the first time somebody',
  'published a price change, and the red would say nothing about the engine.',
  '**These are the numbers to put in Excel.**', '')
head.push('| rate | value |', '|---|---|')
for (const [k, v] of Object.entries(GOLDEN_CATALOG)) head.push(`| ${RATE_LABELS[k]} | ${money(v)} |`)
head.push('')
head.push('## The four, and what each one is for', '')
head.push('| deal | shape | what it exercises |', '|---|---|---|')
head.push('| G1 | OPEX, single phase | the all-in monthly fee, the inverse allocation, the blended margin |')
head.push('| G2 | CAPEX, two-phase | the recovery period, and contractor payment milestones |')
head.push('| G3 | hybrid | PO factoring, withholding tax borne by Terminus, and one zero-unit line |')
head.push('| G4 | CAPEX, two-phase | an absolute price override, a margin override, a rate override, gross-up |')
head.push('')
head.push('---', '')

const body = priced.map((p) => dealSection(p)).join('\n---\n\n')
writeFileSync('GOLDEN_DEALS.md', `${head.join('\n')}${body}`)

const expectations = {
  note: 'Written by scripts/golden-deals/compute.mjs. PROVISIONAL until John confirms. Never hand-edited: re-run the script.',
  status: 'PROVISIONAL',
  catalog: GOLDEN_CATALOG,
  deals: Object.fromEntries(priced.map((p) => [p.deal.id, {
    title: p.deal.title,
    figures: flatten(p),
  }])),
}
writeFileSync('scripts/golden-deals/expectations.json', `${JSON.stringify(expectations, null, 2)}\n`)

const counts = priced.map((p) => `${p.deal.id} ${Object.keys(flatten(p)).length}`).join(', ')
console.log(`Wrote GOLDEN_DEALS.md and scripts/golden-deals/expectations.json`)
console.log(`Figures pinned per deal: ${counts}`)
