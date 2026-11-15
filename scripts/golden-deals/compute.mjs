#!/usr/bin/env node
// ── THE RUN THAT PRODUCED THE FIGURES ────────────────────────────────────
//
// Committed so it can be re-run, which is the brief's own requirement: every
// figure in GOLDEN_DEALS.md is EXECUTED here by the live engine and none is
// paraphrased, retyped or rounded by hand on its way into the document.
//
// It writes two artefacts from ONE pricing run each, for EVERY deal in
// `GOLDEN_DEALS` (five since 2026-09-30):
//
//   GOLDEN_DEALS.md                        for John, to reproduce in Excel
//   scripts/golden-deals/expectations.json for the acceptance harness
//
// ONE RUN, TWO ARTEFACTS, so the document and the suite cannot disagree about
// what the engine said (Verification 20). The harness never reads the markdown
// and the markdown is never hand-corrected: a figure that looks wrong is fixed
// by fixing the engine or the fixture and re-running this.
//
// AND ONE THING IT DOES NOT WRITE: A CONFIRMATION. Each deal carries its own
// status (R-GS1, John 2026-11-15). This script carries a deal's status forward
// ONLY when that deal's figures are byte-identical to the file it is replacing,
// and otherwise writes PROVISIONAL. It never writes CONFIRMED from nothing; that
// word enters the file only by a hand stamp naming who and when. See the EMIT
// section at the foot of this file.
//
//   node scripts/golden-deals/compute.mjs
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
  S.push(`Test Bed cost    + ${money(result.testBedCost)}   (no golden deal came from a conversion)`)
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
head.push('# THE GOLDEN DEALS', '')
// NO STATUS IN THIS DOCUMENT, ruled 2026-11-15 (GOLDEN_STATUS Phase 1). The
// header used to hard-code "PROVISIONAL until John confirms", and said it even
// at the confirmed commit 6550b09: it was never a reader of the status, only a
// wrong copy of it. A hand stamp in expectations.json would leave any status
// here stale, so this document says where the status LIVES instead.
head.push('**This document carries no confirmation status.** Status is recorded per',
  'deal, in one place: the `status`, `confirmedBy`, `confirmedOn` and',
  '`confirmedFiguresSha256` fields of each deal in',
  '`scripts/golden-deals/expectations.json`. `node scripts/golden-deals-check`',
  'prints them as a table on every run, and the merge gate echoes that table.', '')
head.push('Every figure below was EXECUTED by the live pricing engine, not paraphrased',
  'from it. The run is `scripts/golden-deals/compute.mjs`, committed, and it writes',
  'this file and the harness\'s expectations from one pricing run each, so the',
  'document and the suite cannot disagree.', '')
head.push('The pipeline, exactly as the application runs it:', '',
  '```', 'resolveRates(payload, catalog)  ->  buildDealInputs  ->  calculateDeal',
  '                                                     (+ opexRows on OPEX)', '```', '')
head.push('## The rate card every golden deal prices against', '')
head.push('**Declared in the fixture, NOT read from the database**, so a golden deal',
  'means the same thing next year. The live catalog is a batch with an effective',
  'date and it moves; a suite pinned to it would go red the first time somebody',
  'published a price change, and the red would say nothing about the engine.',
  '**These are the numbers to put in Excel.**', '')
head.push('| rate | value |', '|---|---|')
for (const [k, v] of Object.entries(GOLDEN_CATALOG)) head.push(`| ${RATE_LABELS[k]} | ${money(v)} |`)
head.push('')
head.push(`## The ${GOLDEN_DEALS.length} deals, and what each one is for`, '')
head.push('| deal | shape | what it exercises |', '|---|---|---|')
// Keyed by deal, and a deal with no row REFUSES the run. The table was a
// hand-written list of four rows and G5 never got one (found 2026-11-15): a
// list beside a population has to fail on the unrecorded member.
const PURPOSE = {
  G1: '| G1 | OPEX, single phase | the all-in monthly fee, the inverse allocation, the blended margin |',
  G2: '| G2 | CAPEX, two-phase | the recovery period, and contractor payment milestones |',
  G3: '| G3 | hybrid | PO factoring, withholding tax borne by Terminus, and one zero-unit line |',
  G4: '| G4 | CAPEX, two-phase | an absolute price override, a margin override, a rate override, gross-up |',
  G5: '| G5 | OPEX, single phase, lump sum installation | a type\'s share of a lump sum inside its all-in fee, an exact stored fee, a margin override on a different row |',
}
for (const d of GOLDEN_DEALS) {
  if (!PURPOSE[d.id]) throw new Error(`${d.id} has no row in the GOLDEN_DEALS.md purpose table. Add one to PURPOSE.`)
  head.push(PURPOSE[d.id])
}
head.push('')
head.push('---', '')

const body = priced.map((p) => dealSection(p)).join('\n---\n\n')
writeFileSync('GOLDEN_DEALS.md', `${head.join('\n')}${body}`)

// ── SUPERSEDED 2026-11-15 BY R-GS1. The reasoning below is left standing ────
//
// It was right about a deal whose figures moved and wrong about a deal whose
// figures did not. The status was ONE flag for every deal, so R-TL1a's change
// to G1 (2026-09-30, ee177d8) re-ran this script and erased the confirmation of
// G2, G3 and G4 although their 2,745 figures were byte-identical to what John
// signed. The replacement follows this block.
//
// ── A RE-RUN RETURNS THE STATUS TO PROVISIONAL, AND THAT IS DELIBERATE ────
//
// The confirmation is the ONE hand-edited field in that file, because it
// records a judgement only John can make. Everything else is generated.
//
// Re-running this script writes PROVISIONAL and drops the name and date, which
// looks like losing a confirmation and is the safe reading: a re-run means
// somebody recomputed, a recompute means the figures may have moved, and a
// confirmation of figures that may have moved is not a confirmation. Preserving
// it across a re-run would be the dangerous convenience, because the one case it
// would help is the one case where it is wrong.
// ── THE STATUS IS PER DEAL, AND AN UNMOVED DEAL KEEPS ITS OWN. R-GS1, R-GS5 ──
//
// Ruled by John 2026-11-15. For each deal, read the file being replaced:
//
//   figures BYTE-IDENTICAL to the prior file's  ->  status, confirmedBy,
//       confirmedOn and confirmedFiguresSha256 are carried across verbatim
//   figures changed, deal new, or no usable prior file  ->  PROVISIONAL,
//       and none of the other three fields is written
//
// "Byte-identical" is the same serialisation as the bytes on disk, so it is
// exactly the property a confirmation rests on. A key reorder with identical
// values reads as CHANGED and resets: a false reset, in the safe direction, and
// `flatten` is deterministic so it does not occur today.
//
// THIS SCRIPT NEVER WRITES CONFIRMED FROM NOTHING. It can only carry one
// forward, and the harness then re-checks the carried hash against the figures,
// so a carried confirmation is still only as good as the stamp it came from.
// A prior file in the retired shape (one top-level status) carries nothing: a
// file-wide flag is not evidence about any one deal.
const EXPECT = 'scripts/golden-deals/expectations.json'
const serialise = (figures) => JSON.stringify(figures, null, 2)
const STATUS_FIELDS = ['status', 'confirmedBy', 'confirmedOn', 'confirmedFiguresSha256']

let prior = null
let priorProblem = null
if (!existsSync(EXPECT)) priorProblem = 'there is no prior expectations file'
else {
  try { prior = JSON.parse(readFileSync(EXPECT, 'utf8')) } catch (e) { priorProblem = `the prior expectations file does not parse (${e.message})` }
}
if (priorProblem) console.log(`RESET ALL: ${priorProblem}, so every deal is written PROVISIONAL.`)

const decisions = []
const deals = Object.fromEntries(priced.map((p) => {
  const figures = flatten(p)
  const before = prior?.deals?.[p.deal.id]
  let carry = null
  let why
  if (!prior) why = 'no usable prior file'
  else if (!before) why = 'new deal'
  else if (serialise(before.figures) !== serialise(figures)) why = 'figures changed'
  else if (typeof before.status !== 'string') why = 'figures byte-identical, but the prior file recorded no status for this deal'
  else { carry = before; why = 'figures byte-identical' }
  const status = carry
    ? Object.fromEntries(STATUS_FIELDS.filter((k) => k in carry).map((k) => [k, carry[k]]))
    : { status: 'PROVISIONAL' }
  decisions.push(`  ${p.deal.id}  ${carry ? 'KEPT ' : 'RESET'}  ${status.status.padEnd(11)}  ${why}`)
  return [p.deal.id, { title: p.deal.title, ...status, figures }]
}))

const expectations = {
  note: 'Figures written by scripts/golden-deals/compute.mjs and NEVER hand-edited: re-run the script. Each deal carries its own status. compute.mjs keeps a deal\'s status, confirmedBy, confirmedOn and confirmedFiguresSha256 only while that deal\'s figures are byte-identical, and otherwise writes PROVISIONAL. CONFIRMED is written only by a hand stamp naming who and when, with confirmedFiguresSha256 = SHA-256 of JSON.stringify(figures, null, 2).',
  catalog: GOLDEN_CATALOG,
  deals,
}
writeFileSync(EXPECT, `${JSON.stringify(expectations, null, 2)}\n`)
console.log('Status per deal:')
for (const d of decisions) console.log(d)
// The hash a stamp must record, printed so a stamp is copied from the run
// rather than computed by hand (Verification 20).
for (const [id, d] of Object.entries(deals)) {
  console.log(`  ${id}  figures sha256 ${createHash('sha256').update(serialise(d.figures)).digest('hex')}`)
}

const counts = priced.map((p) => `${p.deal.id} ${Object.keys(flatten(p)).length}`).join(', ')
console.log(`Wrote GOLDEN_DEALS.md and scripts/golden-deals/expectations.json`)
console.log(`Figures pinned per deal: ${counts}`)
