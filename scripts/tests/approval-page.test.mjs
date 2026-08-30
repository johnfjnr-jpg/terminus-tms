// The commercial approval page, blocks 1 to 5. Round 38.
// Runs under `npm test` - pure, no database, no DOM.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import {
  buildApprovalPage, buildBridge, buildExposures, buildTarget, buildCostBasis,
  buildNotRecorded, pricedKeys, checkReconciliation, stalenessBand, COST_BASIS_STALENESS,
  BRIDGE_STEPS, bridgeKeys,
} from '../../src/lib/approval-page.js'
import { buildDealInputs, isSet, RAW_READERS, PRODUCT_UNITS } from '../../src/lib/deal-inputs.js'
import { appliesToDeal } from '../../src/lib/approval-page.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { NUMERIC_DEFAULTS } from '../../src/lib/numeric-payload.js'

const RATES = {
  ssUnitCost: 1200, aqUnitCost: 800, hemirUnitCost: 5000,
  inSsExisting: 300, inSsNew: 450, inAqm: 200, inHemir: 900,
  hoSafesight: 25, hoAqm: 15, hoHemir: 60,
}
const APPROVED = {
  ...RATES, ssExisting: 40, ssNew: 10, aqm: 6, hemir: 2,
  targetMargin: 30, warrantyPct: 2, whtPct: 10, gstPct: 7, grossUp: true,
  duration: 36, recoveryMonths: 12, invoicing: 'annual', structure: 'twoPhase',
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 60000,
  milestones: [], contractorMilestones: [],
  factoring: { enabled: true, ratePct: 1.5, termMonths: 12, method: 'simple' },
  marginOverrides: {},
}
const NOW = {
  ...APPROVED,
  duration: 48,                                   // term
  ssUnitCost: 1380,                               // cost basis
  marginOverrides: { hwSs: 22 },                  // discount
}
const M = (p) => calculateDeal(buildDealInputs(p, { rates: resolveRates(p, RATES).rates, testBedCost: 25000 })).achievedMargin

// ─────────────────────────────────────────────────────────────
// Block 2: the bridge reconciles. This is the whole point of it.
// ─────────────────────────────────────────────────────────────

test('the bridge sums EXACTLY to the total movement', () => {
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  const summed = b.steps.reduce((s, r) => s + r.marginPoints, 0)
  assert.ok(Math.abs(b.total.marginPoints - summed) < 1e-9,
    `steps summed to ${summed}, total is ${b.total.marginPoints}`)
  assert.ok(Math.abs(b.unexplained) < 1e-9, `unexplained is ${b.unexplained}, must be zero`)
})

test('and the opening and closing are the real margins, not restatements', () => {
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  assert.equal(b.opening.marginPoints, M(APPROVED))
  assert.equal(b.closing.marginPoints, M(NOW))
})

test('every step appears, in the documented order', () => {
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  assert.deepEqual(b.steps.map((s) => s.step),
    ['units', 'term', 'cost basis', 'discount or override', 'risk terms'])
})

test('A STEP THAT DID NOT MOVE SAYS SO, it is not omitted', () => {
  // The no-baseline decision applied one level down. "Cost basis: no change" is
  // the answer to a question the approver cannot ask anywhere else - did the
  // catalog reprice underneath this deal - and omitting the row leaves it
  // unanswered rather than answered no.
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  const units = b.steps.find((s) => s.step === 'units')
  assert.equal(units.moved, false)
  assert.equal(units.marginPoints, 0)
  assert.deepEqual(units.keys, [])

  const term = b.steps.find((s) => s.step === 'term')
  assert.equal(term.moved, true)
  assert.notEqual(term.marginPoints, 0)
})

test('nothing changed means five unmoved steps and a zero total', () => {
  const b = buildBridge(APPROVED, { ...APPROVED }, { catalog: RATES, testBedCost: 25000 })
  assert.equal(b.steps.length, 5)
  assert.ok(b.steps.every((s) => s.moved === false))
  assert.equal(b.total.marginPoints, 0)
})

test('ORDER-DEPENDENCE IS REAL, and the total is not', () => {
  // The property the business accepted explicitly. Individual steps move when
  // the order changes; the total does not. If the steps were identical under
  // reversal, the sequential shape would be doing nothing and one-at-a-time
  // would have been the better choice after all.
  // baseRates differs from the catalog, so the CATALOG MOVED between approval
  // and now and the cost basis step carries a real figure. Without that the
  // step is legitimately zero for this fixture and the reversal proves nothing,
  // which is how this test caught the step going inert in the first place.
  const MOVED = { ...RATES, ssUnitCost: 1000 }
  const opts = { catalog: RATES, baseRates: MOVED, testBedCost: 25000 }
  const forward = buildBridge(APPROVED, NOW, opts)
  const originalOrder = BRIDGE_STEPS.slice()
  BRIDGE_STEPS.reverse()
  const backward = buildBridge(APPROVED, NOW, opts)
  BRIDGE_STEPS.length = 0
  BRIDGE_STEPS.push(...originalOrder)

  assert.ok(Math.abs(forward.total.marginPoints - backward.total.marginPoints) < 1e-9,
    'the total must be order-independent')
  const f = forward.steps.find((s) => s.step === 'cost basis').marginPoints
  const b = backward.steps.find((s) => s.step === 'cost basis').marginPoints
  assert.notEqual(f, b, 'a step must differ under reversal, or the order is decorative')
  assert.ok(Math.abs(backward.unexplained) < 1e-9, 'and it must still reconcile in either order')
})

test('a PRICED key no step claims is REPORTED, not silently dropped', () => {
  // A bridge that reconciles is only trustworthy if nothing that prices the deal
  // can move outside it.
  //
  // Calibrated by taking a key OUT of its step on the live definitions, because
  // every priced key is claimed today and an invented key is - correctly - not
  // priced and so not reported. An invented key was in fact what this test used
  // first, and it stopped discriminating the moment the check was scoped.
  const term = BRIDGE_STEPS.find((s) => s.step === 'term')
  const original = term.keys.slice()
  term.keys = original.filter((k) => k !== 'duration')
  try {
    const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
    assert.deepEqual(b.unassignedKeys, ['duration'],
      'a priced key belonging to no step must be named')
  } finally {
    term.keys = original
  }
  assert.deepEqual(buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 }).unassignedKeys, [],
    'and restoring the step must clear it, or the check is stuck on')
})

test('every writable numeric key is claimed by exactly one step', () => {
  const seen = new Map()
  for (const s of BRIDGE_STEPS) {
    for (const k of s.keys) {
      assert.ok(!seen.has(k), `${k} is claimed by both ${seen.get(k)} and ${s.step}`)
      seen.set(k, s.step)
    }
  }
  for (const key of Object.keys(NUMERIC_DEFAULTS)) {
    if (key === 'factoringRatePct') continue   // lives inside the factoring object
    assert.ok(bridgeKeys().has(key), `${key} moves the margin and no bridge step claims it`)
  }
})

// ─────────────────────────────────────────────────────────────
// Block 2's target half: policy, not last time
// ─────────────────────────────────────────────────────────────

test('target is targetMargin as it stands NOW', () => {
  const r = calculateDeal(buildDealInputs(NOW, { rates: resolveRates(NOW, RATES).rates, testBedCost: 25000 }))
  const t = buildTarget({ ...NOW, targetMargin: 35 }, r, { baselinePayload: APPROVED })
  assert.equal(t.target, 35)
  assert.equal(t.was, 30)
  assert.equal(t.moved, true)
})

test('a moved target gets its own sentence naming both figures', () => {
  const r = calculateDeal(buildDealInputs(NOW, { rates: resolveRates(NOW, RATES).rates, testBedCost: 25000 }))
  const t = buildTarget({ ...NOW, targetMargin: 35 }, r,
    { baselinePayload: APPROVED, changedAt: '4 August 2026' })
  assert.equal(t.movedSentence, 'Target 35% (was 30% at last approval, changed 4 August 2026).')
})

test('an unmoved target produces no sentence at all', () => {
  const r = calculateDeal(buildDealInputs(NOW, { rates: resolveRates(NOW, RATES).rates, testBedCost: 25000 }))
  assert.equal(buildTarget(NOW, r, { baselinePayload: APPROVED }).movedSentence, null)
})

test('per-line overrides below target are listed, worst gap first', () => {
  const p = { ...NOW, targetMargin: 30, marginOverrides: { hwSs: 22, hwAqm: 12, hwHemir: 35 } }
  const r = calculateDeal(buildDealInputs(p, { rates: resolveRates(p, RATES).rates, testBedCost: 25000 }))
  const t = buildTarget(p, r, {})
  assert.deepEqual(t.linesBelowTarget.map((l) => l.key), ['hwAqm', 'hwSs'],
    'above-target lines are not discounts and must not be listed')
  assert.equal(t.linesBelowTarget[0].gapPoints, 18)
})

test('an unset target uses the system default AND says so', () => {
  const p = { ...NOW }
  delete p.targetMargin
  const r = calculateDeal(buildDealInputs(p, { rates: resolveRates(p, RATES).rates, testBedCost: 25000 }))
  const t = buildTarget(p, r, {})
  assert.equal(t.target, NUMERIC_DEFAULTS.targetMargin)
  assert.equal(t.provenance.source, 'system default')
  assert.match(t.provenance.sentence, /^30% \(system default, set \d{4}-\d{2}-\d{2}\)$/)
})

// ─────────────────────────────────────────────────────────────
// Block 3: exposures, not inputs
// ─────────────────────────────────────────────────────────────

test('exposures are money, and say who bears each', () => {
  const r = calculateDeal(buildDealInputs(NOW, { rates: resolveRates(NOW, RATES).rates, testBedCost: 25000 }))
  const ex = buildExposures(NOW, r)
  const by = Object.fromEntries(ex.map((e) => [e.key, e]))
  assert.equal(by.gst.bornByTerminus, false, 'GST is collected, not borne')
  assert.equal(by.warranty.bornByTerminus, true)
  assert.equal(by.testBed.amount, 25000)
  // Every exposure on THIS deal is a number. Not a general claim: finance is
  // null when the facility is on with no recorded term, which the test below
  // asserts, so the population here is the deal rather than the shape.
  assert.ok(NOW.factoring?.termMonths > 0, 'population check: NOW records a factoring term')
  for (const e of ex) assert.equal(typeof e.amount, 'number', `${e.key} must be an amount`)
})

test('a grossed-up deal shows zero borne AND the number if the client refuses', () => {
  // The exposure an input screen cannot show: grossUp makes whtBorne zero, which
  // reads as no risk, and the risk is that the client declines the gross-up.
  const r = calculateDeal(buildDealInputs(NOW, { rates: resolveRates(NOW, RATES).rates, testBedCost: 25000 }))
  const wht = buildExposures(NOW, r).find((e) => e.key === 'wht')
  assert.equal(wht.amount, 0)
  assert.equal(wht.bornByTerminus, false)
  assert.match(wht.note, /refuses the gross-up/)
  assert.ok(r.tax.whtAmount > 0, 'and there must be a real number behind that sentence')
})

test('a factoring facility with no recorded term is not priced at an invented one', () => {
  // Round 41 ruling 5. The calculator stopped substituting a term, so the
  // approval page has to say what the approver is looking at: a total cost and
  // an achieved margin that are both missing an amount nobody has computed.
  const p = { ...NOW, factoring: { enabled: true, ratePct: 1.5, method: 'straight' } }
  const r = calculateDeal(buildDealInputs(p, { rates: resolveRates(p, RATES).rates, testBedCost: 25000 }))
  assert.equal(r.financeCost, null, 'a term nobody recorded must not produce a figure')
  assert.equal(r.costIncomplete, true)

  const fin = buildExposures(p, r).find((e) => e.key === 'finance')
  assert.equal(fin.amount, null, 'null, not 0: zero would say the facility costs nothing')
  assert.match(fin.basis, /over a term nobody has recorded/)
  assert.match(fin.note, /Total cost and achieved margin are both missing this amount/)

  // AND THE SAME DEAL WITH A TERM, so the absence is shown to be about the
  // term rather than about the facility. Verification 24's shape: the second
  // value is what proves the first was read.
  const q = { ...NOW, factoring: { enabled: true, ratePct: 1.5, method: 'straight', termMonths: 12 } }
  const rq = calculateDeal(buildDealInputs(q, { rates: resolveRates(q, RATES).rates, testBedCost: 25000 }))
  const finq = buildExposures(q, rq).find((e) => e.key === 'finance')
  assert.ok(finq.amount > 0)
  assert.equal(rq.costIncomplete, false)
  assert.match(finq.basis, /for 12 months/)
  assert.ok(rq.totalDealCostAll > r.totalDealCostAll,
    'the recorded term adds a real cost, which is exactly what the absent one omits')
})

test('not grossed up, the withholding is borne and shown as borne', () => {
  const p = { ...NOW, grossUp: false }
  const r = calculateDeal(buildDealInputs(p, { rates: resolveRates(p, RATES).rates, testBedCost: 25000 }))
  const wht = buildExposures(p, r).find((e) => e.key === 'wht')
  assert.ok(wht.amount > 0)
  assert.equal(wht.bornByTerminus, true)
})

// ─────────────────────────────────────────────────────────────
// Block 4: cost basis and its age
// ─────────────────────────────────────────────────────────────

test('cost basis ages every product and leads with the stalest', () => {
  const cb = buildCostBasis({
    safesight: { batch_label: 'Q1', effective_from: '2026-03-12' },
    air_quality: { batch_label: 'Q3', effective_from: '2026-08-01' },
  }, [], '2026-08-29')
  assert.equal(cb.products[0].product, 'safesight')
  assert.equal(cb.products[0].ageDays, 170)
  assert.equal(cb.oldest.effectiveFrom, '2026-03-12',
    'a deal is only as current as its stalest input')
})

test('a product with no batch is named, not omitted', () => {
  const cb = buildCostBasis({}, ['hemir'], '2026-08-29')
  assert.deepEqual(cb.missing, ['hemir'])
})

// ─────────────────────────────────────────────────────────────
// Block 5, and the surface rule
// ─────────────────────────────────────────────────────────────

test('a default is a VALUE WITH PROVENANCE, never a blank', () => {
  const p = { ...NOW }
  delete p.warrantyPct
  const rows = buildNotRecorded(p, { versionReason: 'x' })
  const w = rows.find((r) => r.key === 'warrantyPct')
  assert.equal(w.kind, 'default')
  assert.equal(w.value, NUMERIC_DEFAULTS.warrantyPct)
  assert.equal(w.source, 'system default')
  assert.match(w.sentence, /\(system default, set \d{4}-\d{2}-\d{2}\)/)
  assert.notEqual(w.value, null, 'never an absence on a read-only surface')
})

test('a field the person DID set does not appear as an assumption', () => {
  const rows = buildNotRecorded(NOW, { versionReason: 'x' })
  assert.ok(!rows.some((r) => r.key === 'warrantyPct'),
    'warrantyPct is set on this payload and is not an assumption being approved')
})

test('captured-but-never-applied fields are called out', () => {
  // fxContingency is recorded and read by nothing. An approver seeing 3% on the
  // input screen would reasonably believe it is priced in.
  const rows = buildNotRecorded({ ...NOW, fxContingency: 3 }, { versionReason: 'x' })
  const fx = rows.find((r) => r.key === 'fxContingency')
  assert.equal(fx.kind, 'captured, not applied')
  assert.match(fx.note, /does NOT affect any figure/)
})

test('and a zero contingency is not called out, because it changes nothing anyway', () => {
  const rows = buildNotRecorded({ ...NOW, fxContingency: 0 }, { versionReason: 'x' })
  assert.ok(!rows.some((r) => r.key === 'fxContingency' && r.kind === 'captured, not applied'))
})

// ─────────────────────────────────────────────────────────────
// The whole page
// ─────────────────────────────────────────────────────────────

const CATALOG = {
  batches: { safesight: { batch_label: 'Q1', effective_from: '2026-03-12' } },
  missing: [], asOf: '2026-08-29',
  // Round 40 Phase 1b: the page resolves rates rather than reading them out of
  // the payload, so the fixture catalog has to carry them. Before this the
  // rates were in the payload and the page priced a deal at -6% margin without
  // any test noticing, because every figure was internally consistent and
  // wrong together.
  rates: RATES,
}
const VERSION = {
  major: 0, minor: 3, status: 'draft', revision_number: 12,
  reason: 'Extended term at client request', created_by_email: 'a@b.invalid',
  created_at: '2026-08-29T09:00:00Z',
}

test('block 1 states the ask in one sentence', () => {
  const page = buildApprovalPage({ payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG, record: { reference_code: 'TT-SG-001' } })
  assert.match(page.ask.sentence, /^Approve V0\.3 at [\d.]+% margin on a contract net of \$[\d,]+\.$/)
  assert.match(page.ask.sentence, /\$\d{1,3}(,\d{3})+\./,
    'the headline figure is the first thing read and must be grouped, not a raw integer')
  assert.equal(page.ask.version.reason, 'Extended term at client request')
  assert.equal(page.ask.version.revisionNumber, 12)
})

test('NO BASELINE STATES THE ABSENCE, it does not leave a gap', () => {
  // The business's decision: no delta against V0.1, because that is internal
  // drafting churn. And a blank block reads as a rendering failure, so the
  // absence is written out instead.
  const page = buildApprovalPage({ payload: NOW, testBedCost: 25000, version: VERSION, baseline: null, catalog: CATALOG })
  assert.equal(page.moved.bridge, null)
  assert.equal(page.moved.baseline, null)
  assert.match(page.moved.absence,
    /^First approval\. No prior approved version\. Priced against target 30% and cost basis dated 2026-03-12\.$/)
})

test('the absence sentence names the DEFAULT provenance when target is unset', () => {
  const p = { ...NOW }; delete p.targetMargin
  const page = buildApprovalPage({ payload: p, testBedCost: 25000, version: VERSION, baseline: null, catalog: CATALOG })
  assert.match(page.moved.absence, /target 30% \(system default, set \d{4}-\d{2}-\d{2}\) and cost basis dated 2026-03-12/)
})

test('with a baseline, the page carries the bridge and its printed order', () => {
  const page = buildApprovalPage({
    payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG,
    baseline: { major: 0, minor: 1, revision_number: 8, inputs: APPROVED, reason: 'first', approval: { decidedAt: '2026-08-20T00:00:00Z' } },
  })
  assert.equal(page.moved.absence, null)
  assert.equal(page.moved.baseline.label, 'V0.1')
  assert.match(page.moved.order, /^Units, then term, then cost basis/)
  assert.ok(Math.abs(page.moved.bridge.unexplained) < 1e-9)
})

test('all five blocks are present on every page', () => {
  const page = buildApprovalPage({ payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG })
  for (const block of ['ask', 'moved', 'target', 'exposures', 'costBasis', 'notRecorded']) {
    assert.ok(page[block] !== undefined, `${block} is missing`)
  }
  assert.ok(page.exposures.length >= 6)
})

test('no version taken says so rather than pretending', () => {
  const page = buildApprovalPage({ payload: NOW, testBedCost: 25000, version: null, catalog: CATALOG })
  assert.equal(page.ask.version, null)
  assert.match(page.ask.sentence, /nothing to approve/)
})

// ─────────────────────────────────────────────────────────────
// A baseline that cannot be compared says so
// ─────────────────────────────────────────────────────────────

test('a baseline with NO cost basis is flagged as not comparable', () => {
  // Found by driving the page end to end, not by reasoning: a version whose
  // inputs carry no rate keys prices every line at zero, and the cost-basis step
  // then reported the entire value of the deal as though the catalog had moved.
  const noRates = { ...APPROVED }
  for (const k of Object.keys(RATES)) delete noRates[k]
  const b = buildBridge(noRates, NOW, { testBedCost: 25000 })
  assert.equal(b.comparable, false)
  assert.equal(b.baselineHasCostBasis, false)
})

test('and a baseline WITH a cost basis is comparable', () => {
  // The calibration. Without it the flag could be false for any reason at all.
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  assert.equal(b.comparable, true)
})

test('the page turns that into a sentence telling the approver what to do', () => {
  const noRates = { ...APPROVED }
  for (const k of Object.keys(RATES)) delete noRates[k]
  const page = buildApprovalPage({
    payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG,
    baseline: { major: 0, minor: 1, revision_number: 8, inputs: noRates, approval: {} },
  })
  assert.match(page.moved.caveat, /carries no cost basis/)
  assert.match(page.moved.caveat, /must not be read as one/)
})

test('a comparable baseline carries no caveat', () => {
  const page = buildApprovalPage({
    payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG,
    baseline: { major: 0, minor: 1, revision_number: 8, inputs: APPROVED, approval: {} },
  })
  assert.equal(page.moved.caveat, null)
})

test('a self-funding deal reports no cash exposure rather than a worst month', () => {
  const p = { ...NOW, factoring: { enabled: false } }
  const r = calculateDeal(buildDealInputs(p, { rates: resolveRates(p, RATES).rates, testBedCost: 25000 }))
  const cash = buildExposures(p, r).find((e) => e.key === 'cash')
  if (cash.amount === 0) {
    assert.equal(cash.basis, 'No month goes cash negative')
    assert.equal(cash.bornByTerminus, false, 'nothing to fund is not an exposure')
  } else {
    assert.match(cash.basis, /^Worst month is month \d+$/)
    assert.equal(cash.bornByTerminus, true)
  }
})

// ─────────────────────────────────────────────────────────────
// The unassigned-key check is scoped to what actually prices
// ─────────────────────────────────────────────────────────────

test('pricedKeys is DERIVED and covers every branch of the translation', () => {
  // One pass with installResp undefined takes the zero-cost install branch and
  // never touches the four per-unit install rates. Measured before fixing: 25
  // keys from one pass, 29 from the union.
  const keys = pricedKeys()
  // The four OVERRIDABLE install rates are payload keys and price the deal, so
  // they stay derived. Round 40 Phase 1b moved them out of buildDealInputs and
  // into resolveRates, and pricedKeys covers every payload key that reaches a
  // figure whichever function reads it.
  for (const k of ['inSsExisting', 'inSsNew', 'inAqm', 'inHemir']) {
    assert.ok(keys.has(k), `${k} is an override on the record and must still be derived`)
  }
  for (const k of ['targetMargin', 'duration', 'factoring', 'grossUp']) {
    assert.ok(keys.has(k), `${k} prices the deal and must be derived`)
  }
  // AND THE SIX CATALOG-ONLY RATES LEAVE THE SET, which is the contract change
  // rather than a gap: a payload carrying ssUnitCost cannot price anything,
  // because the resolver refuses to read it. Asserted, so a later round cannot
  // quietly put them back in the payload and have nothing notice.
  for (const k of ['ssUnitCost', 'aqUnitCost', 'hemirUnitCost', 'hoSafesight', 'hoAqm', 'hoHemir']) {
    assert.ok(!keys.has(k), `${k} is a catalog fact and must not be a priced payload key`)
  }
  assert.ok(!keys.has('name'), 'a Reference tab field is not a priced key')
  assert.ok(!keys.has('bidCurrency'), 'captured-but-unread fields do not price anything')
})

test('a Reference tab field changing is NOT flagged as unaccounted for', () => {
  // Found by looking at the real page: one payload carries every tab's fields,
  // and the first real deal reported name, company_name and customerLead as keys
  // the bridge could not explain. They cannot move a margin.
  const b = buildBridge(
    { ...APPROVED, name: 'Old name', customerLead: 'A' },
    { ...NOW, name: 'New name', customerLead: 'B' },
    { testBedCost: 25000 })
  assert.deepEqual(b.unassignedKeys, [])
})

test('but a PRICED key no step claims still is', () => {
  // The calibration. If the filter were simply dropping everything, the test
  // above would pass for the wrong reason.
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  assert.deepEqual(b.unassignedKeys, [], 'the real key set is fully assigned today')
  const everyPriced = [...pricedKeys()]
  const unclaimed = everyPriced.filter((k) => !bridgeKeys().has(k))
  assert.deepEqual(unclaimed, [],
    'every key the calculation reads must belong to a bridge step: ' + unclaimed.join(', '))
})

// ─────────────────────────────────────────────────────────────
// Found by reading the rendered page
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Applicability: a disclosure fires only where the field applies
// ─────────────────────────────────────────────────────────────

// The four conditional keys, their governing input, and a payload fragment that
// makes each APPLY and NOT APPLY. Driven from one table so a key added to
// APPLICABILITY without tests is visible as a missing row rather than absent.
const CONDITIONAL = [
  { key: 'recoveryMonths', input: 'structure',
    applies: { structure: 'twoPhase' }, doesNot: { structure: 'hybrid' }, absent: {} },
  { key: 'lumpSumCost', input: 'installResp',
    applies: { installResp: 'Terminus Contractor - Lump Sum' },
    doesNot: { installResp: 'Client Own Installation Team' }, absent: {} },
  { key: 'factoringRatePct', input: 'factoring.enabled',
    applies: { factoring: { enabled: true } }, doesNot: { factoring: { enabled: false } }, absent: {} },
]

// A payload with none of the conditional keys set, so every row below turns on
// applicability alone rather than on whether the value happens to be present.
const BARE = { ssExisting: 10, duration: 36, targetMargin: 30, warrantyPct: 2,
  whtPct: 5, gstPct: 9, fxContingency: 0 }
const fired = (p) => buildNotRecorded(p, { versionReason: 'x' })
  .filter((r) => r.kind === 'default').map((r) => r.key)

test('a conditional disclosure fires when the field applies', () => {
  for (const c of CONDITIONAL) {
    assert.ok(fired({ ...BARE, ...c.applies }).includes(c.key),
      `${c.key} must be disclosed when ${c.input} says it applies`)
  }
})

test('and does NOT fire when the field cannot apply to this deal', () => {
  // The half that was wrong before Round 41: the page told an approver "nobody
  // entered a value" for lumpSumCost on three installation types where the
  // field cannot exist, and for factoringRatePct on every deal with factoring
  // off. A disclosure that fires where the field could never exist teaches the
  // approver to skim the block that matters most.
  for (const c of CONDITIONAL) {
    assert.ok(!fired({ ...BARE, ...c.doesNot }).includes(c.key),
      `${c.key} must NOT be disclosed when ${c.input} says it does not apply`)
  }
})

test('AN ABSENT GOVERNING INPUT FAILS LOUD: the disclosure fires', () => {
  // Amendment 1, and it is the common case rather than an edge. Measured:
  // `structure` is absent on 502 of 562 opportunities. A rule reading an absent
  // structure as "not two-phase, so recovery does not apply" would suppress the
  // recovery disclosure on almost every deal in the system, which is finding 1
  // arriving through the applicability rule instead of through `|| 0`.
  for (const c of CONDITIONAL) {
    const keys = fired({ ...BARE, ...c.absent })
    assert.ok(keys.includes(c.key),
      `${c.key} must be disclosed when ${c.input} is absent, not silently suppressed`)
  }
  // Explicit null is the same as absent: a field somebody cleared has not told
  // us the deal's shape either.
  assert.ok(fired({ ...BARE, structure: null }).includes('recoveryMonths'))
  assert.ok(fired({ ...BARE, installResp: '' }).includes('lumpSumCost'))
  assert.ok(fired({ ...BARE, factoring: { enabled: null } }).includes('factoringRatePct'))
})

test('the predicate matches the exact enumerated value, not a substring', () => {
  // Amendment 3. buildDealInputs uses .includes('Lump Sum') for PRICING; a rule
  // governing whether an approver is TOLD something is not the place for a
  // loose match.
  assert.equal(appliesToDeal('lumpSumCost', { installResp: 'Terminus Contractor - Lump Sum' }), true)
  assert.equal(appliesToDeal('lumpSumCost', { installResp: 'Some Other Lump Sum Arrangement' }), false,
    'a substring match would wrongly make this applicable')
})

test('a NUMERIC_DEFAULTS key with no APPLICABILITY entry is applicable', () => {
  // PINNING AN EXISTING PROPERTY, on the business's instruction, so a future key
  // fails toward OVER-DISCLOSURE and never toward silence.
  //
  // The property is `APPLICABILITY[key] ?? (() => true)`. It is one `??` and it
  // would survive any careless edit that replaced it with a lookup returning
  // undefined, which is falsy, which would silently hide every unruled key.
  // Nothing else in the suite would notice: the ruled keys would still behave,
  // and only keys nobody had thought about would go quiet.
  //
  // Driven from NUMERIC_DEFAULTS itself rather than a list here, so a key added
  // to the constant is covered without anybody remembering.
  const src = readCode(new URL('../../src/lib/approval-page.js', import.meta.url))
  const block = src.slice(src.indexOf('const APPLICABILITY = {'), src.indexOf('};', src.indexOf('const APPLICABILITY = {')))
  const ruled = new Set([...block.matchAll(/^\s{2}([A-Za-z]+):/gm)].map((m) => m[1]))

  const unruled = Object.keys(NUMERIC_DEFAULTS).filter((k) => !ruled.has(k))
  assert.ok(unruled.length >= 1, 'the pin measures nothing if every key is ruled')
  for (const key of unruled) {
    // The empty payload is the hardest case: no governing input is present, so
    // a rule that read absence as "does not apply" would hide it.
    assert.equal(appliesToDeal(key, {}), true,
      `${key} has no applicability rule and must therefore be applicable`)
    assert.equal(appliesToDeal(key, { structure: 'hybrid', installResp: 'Client Own Installation Team', factoring: { enabled: false } }), true,
      `${key} must stay applicable whatever the governing inputs say, since none of them govern it`)
  }

  // And a key that exists nowhere at all is applicable, which is what makes the
  // fallback a policy rather than an accident of the constant's contents.
  assert.equal(appliesToDeal('aKeyNobodyHasEverDefined', {}), true)
})

test('an unlisted key is unconditional, which is the safe direction', () => {
  // A key nobody has ruled on DISCLOSES rather than hides. The dangerous
  // default would be the other way round.
  assert.equal(appliesToDeal('gstPct', {}), true)
  assert.equal(appliesToDeal('targetMargin', { structure: 'hybrid', factoring: { enabled: false } }), true)
  // fxContingency is unconditional by ruling, not by omission: the conditional
  // reading would need bidCurrency !== proposalCurrency, a fourth governing
  // input, and widening that list is a decision rather than a side effect.
  assert.equal(appliesToDeal('fxContingency', { bidCurrency: 'USD', proposalCurrency: 'USD' }), true)
})

test('every conditional key in APPLICABILITY has tests here', () => {
  // Verification 19: the CONDITIONAL table above is a claim about coverage.
  // Measured against the module's own rules rather than trusted.
  const src = readCode(new URL('../../src/lib/approval-page.js', import.meta.url))
  const block = src.slice(src.indexOf('const APPLICABILITY = {'), src.indexOf('};', src.indexOf('const APPLICABILITY = {')))
  const declared = [...block.matchAll(/^\s{2}([A-Za-z]+):/gm)].map((m) => m[1]).sort()
  const tested = CONDITIONAL.map((c) => c.key).concat('factoringTermMonths').sort()
  assert.deepEqual(declared, tested,
    'a conditional key exists with no test, or a test names a key that is not conditional')
})

test('a default that lives NESTED is read where it lives', () => {
  // factoringRatePct is payload.factoring.ratePct. Reading it flat meant the
  // page told every approver "nobody entered a value" for a deal that had set
  // it - a false statement on a page whose job is to show what is being
  // accepted.
  const set = buildNotRecorded({ ...NOW, factoring: { enabled: true, ratePct: 2.5 } }, { versionReason: 'x' })
  assert.ok(!set.some((r) => r.key === 'factoringRatePct'),
    'a deal that sets its factoring rate is not running on the default')

  // ENABLED, not disabled. Round 41 made the disclosure applicability-aware, so
  // a rate on a facility nobody is using is no longer a missing value. This
  // test's purpose is the NESTED READ, not the applicability rule, so the
  // fixture moves to the case where the field applies and the purpose survives
  // intact.
  const unset = buildNotRecorded({ ...NOW, factoring: { enabled: true } }, { versionReason: 'x' })
  assert.ok(unset.some((r) => r.key === 'factoringRatePct'),
    'and a deal that does not set it still is')
})

test('the bridge reconciles AS DISPLAYED, or names the rounding', () => {
  // Exact arithmetic is not the claim the page makes. It shows two decimals, and
  // an approver adding up what they can see must arrive at the closing figure.
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  const at = (n) => Number(n.toFixed(2))
  const shown = b.steps.reduce((s, r) => s + at(r.marginPoints), 0) + b.displayRounding
  assert.equal(Number(shown.toFixed(2)), Number((at(b.closing.marginPoints) - at(b.opening.marginPoints)).toFixed(2)),
    'displayed steps plus the rounding line must equal the displayed movement')
})

test('and the rounding line is absent when it is not needed', () => {
  const b = buildBridge(APPROVED, { ...APPROVED }, { catalog: RATES, testBedCost: 25000 })
  assert.equal(b.displayRounding, 0, 'nothing moved, so there is nothing to round')
})

// ─────────────────────────────────────────────────────────────
// Block 5's higher bar, checked over EVERY key rather than a sample
// ─────────────────────────────────────────────────────────────

test('EVERY default: set it and it is not reported, unset it and it is', () => {
  // A wrong "not recorded" is a false statement to the person accepting the
  // risk, and it reads as authoritative. Hand-picked cases would have missed
  // factoringRatePct exactly as the original code did, so this drives the whole
  // key set through the calculator's own reader and checks both directions.
  const distinct = 7.25
  for (const key of Object.keys(NUMERIC_DEFAULTS)) {
    // Set it where it actually lives, which RAW_READERS is the authority on.
    const set = key === 'factoringRatePct'
      ? { ...NOW, factoring: { enabled: true, ratePct: distinct } }
      : { ...NOW, [key]: distinct }
    assert.equal(RAW_READERS[key](set), distinct, `${key}: the reader must see a value set at its real location`)
    // Scoped to kind 'default', which is the claim that can be FALSE. A set
    // fxContingency is still reported, as 'captured, not applied', and that is a
    // different and true statement: it is recorded and no figure reads it.
    assert.ok(!buildNotRecorded(set, { versionReason: 'x' })
      .some((r) => r.key === key && r.kind === 'default'),
      `${key} IS set and must not be reported as an assumption nobody made`)

    const unset = key === 'factoringRatePct'
      ? { ...NOW, factoring: { enabled: true } }
      : { ...NOW }
    if (key !== 'factoringRatePct') delete unset[key]
    assert.ok(buildNotRecorded(unset, { versionReason: 'x' })
      .some((r) => r.key === key && r.kind === 'default'),
      `${key} is NOT set and must be reported as running on a default`)
  }
})

test('a key with no reader is a loud failure, not a silent flat read', () => {
  // The trap that produced the false claim was that reading a missing key
  // returns undefined and looks exactly like an unset value.
  assert.throws(() => isSet({}, 'somethingNobodyMapped'), /no reader for/)
})

test('every default has a reader, so none can be read flat by accident', () => {
  for (const key of Object.keys(NUMERIC_DEFAULTS)) {
    assert.ok(RAW_READERS[key], `${key} has a default and no reader, so block 5 would guess where it lives`)
  }
})

// ─────────────────────────────────────────────────────────────
// The rounding line must be able to fail
// ─────────────────────────────────────────────────────────────

test('a leftover within two-decimal rounding reconciles', () => {
  const r = checkReconciliation(15.7449, 17.5352, [0.4712, 1.3241, 0.0001])
  assert.equal(r.rounding, 0.01)
  assert.equal(r.reconciles, true)
  assert.ok(r.tolerance >= 0.02 && r.tolerance <= 0.03, `tolerance ${r.tolerance}`)
})

test('AND A LEFTOVER THAT IS NOT ROUNDING REFUSES TO RECONCILE', () => {
  // The calibration that makes the line above evidence. Computed as a plug, this
  // would print "+1.50 pts rounding" and the column would still balance.
  const r = checkReconciliation(15.00, 17.00, [0.50])
  assert.equal(r.rounding, 1.5)
  assert.equal(r.reconciles, false,
    'a plug that cannot fail is how a reconciliation lies')
})

test('the tolerance grows with the number of steps, and only that far', () => {
  // Each displayed figure can be half a unit out: opening, closing, and one per
  // step. More steps means more legitimate rounding and nothing else.
  assert.equal(checkReconciliation(0, 0, []).tolerance, 0.01)
  assert.equal(checkReconciliation(0, 0, [0, 0, 0]).tolerance, 0.025)
  assert.equal(checkReconciliation(0, 0, [0, 0, 0, 0, 0, 0, 0, 0]).tolerance, 0.05)
})

test('a real bridge reconciles and says so', () => {
  const b = buildBridge(APPROVED, NOW, { catalog: RATES, testBedCost: 25000 })
  assert.equal(b.reconciliation.reconciles, true)
  assert.ok(Math.abs(b.displayRounding) <= b.reconciliation.tolerance)
})

// ─────────────────────────────────────────────────────────────
// A product with no current cost basis
// ─────────────────────────────────────────────────────────────

test('base_cost_batches has no end date, so a batch never expires', () => {
  // Measured before designing against it. A batch is current from effective_from
  // until a later one starts; the endpoint takes the latest at or before today.
  // "Expired" does not exist. What exists is a product with NO current batch:
  // none entered, or every batch for it dated in the future.
  const cb = buildCostBasis({ safesight: { batch_label: 'Q1', effective_from: '2020-01-01' } }, [], '2026-08-29')
  assert.equal(cb.products[0].ageDays > 2000, true,
    'a six-year-old batch is still the current one, and the page dates it rather than voiding it')
})

test('a missing product the deal DOES use is escalated to the ask', () => {
  const page = buildApprovalPage({
    payload: NOW, testBedCost: 25000, version: VERSION,
    catalog: { batches: {}, missing: ['hemir'], asOf: '2026-08-29' },
  })
  assert.match(page.ask.unpricedWarning, /2 hemir/)
  assert.match(page.ask.unpricedWarning, /ZERO cost/)
  assert.match(page.ask.unpricedWarning, /higher than the deal will achieve/)
  assert.equal(page.costBasis.unpricedInUse.length, 1)
})

test('and one the deal does NOT use is reported without alarm', () => {
  // The zero-versus-missing discriminator. A missing HEMIR batch on a deal with
  // no HEMIR units changes nothing, and flagging it would be noise that trains
  // an approver to skip the block.
  const noHemir = { ...NOW, hemir: 0 }
  const page = buildApprovalPage({
    payload: noHemir, testBedCost: 25000, version: VERSION,
    catalog: { batches: {}, missing: ['hemir'], asOf: '2026-08-29' },
  })
  assert.equal(page.ask.unpricedWarning, null)
  assert.equal(page.costBasis.missingDetail[0].inUse, false)
  assert.equal(page.costBasis.missingDetail[0].units, 0)
})

test('the units come from the calculator mapping, not a second one', () => {
  // Verification 20. A private product-to-units map here would drift from the
  // one that prices the deal.
  assert.equal(PRODUCT_UNITS.safesight({ ssExisting: 40, ssNew: 10 }), 50)
  assert.equal(PRODUCT_UNITS.air_quality({ aqm: 6 }), 6)
  assert.equal(PRODUCT_UNITS.hemir({ hemir: 2 }), 2)
  const page = buildApprovalPage({
    payload: NOW, testBedCost: 25000, version: VERSION,
    catalog: { batches: {}, missing: ['safesight'], asOf: '2026-08-29' },
  })
  assert.match(page.ask.unpricedWarning, /50 safesight/,
    'ssExisting + ssNew, exactly as buildDealInputs sums them')
})

test('nothing missing produces no warning at all', () => {
  const page = buildApprovalPage({ payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG })
  assert.equal(page.ask.unpricedWarning, null)
  assert.deepEqual(page.costBasis.missingDetail, [])
})

// ─────────────────────────────────────────────────────────────
// Cost basis staleness, and what as_of means
// ─────────────────────────────────────────────────────────────

test('the staleness bands are the ones the business set', () => {
  // A threshold is a policy claim with a shelf life. The golden records every
  // (band, maxDays) with the date they were set, so moving one without moving
  // the date fails here rather than drifting silently.
  const golden = JSON.parse(readFileSync(
    new URL('./fixtures/staleness-golden.json', import.meta.url), 'utf8'))
  assert.equal(COST_BASIS_STALENESS.setOn, golden.setOn)
  assert.deepEqual(
    COST_BASIS_STALENESS.bands.map((b) => ({ band: b.band, maxDays: b.maxDays === Infinity ? 'Infinity' : b.maxDays })),
    golden.bands)
})

test('under six months is current, six to twelve ageing, over twelve stale', () => {
  assert.equal(stalenessBand(0).band, 'current')
  assert.equal(stalenessBand(182).band, 'current')
  assert.equal(stalenessBand(183).band, 'ageing')
  assert.equal(stalenessBand(365).band, 'ageing')
  assert.equal(stalenessBand(366).band, 'stale')
  assert.equal(stalenessBand(5000).band, 'stale')
})

test('an undated batch is its own answer, not quietly current', () => {
  // The zero-versus-missing shape again. A batch with no effective date must not
  // fall into the band that needs no action.
  assert.equal(stalenessBand(null).band, 'undated')
  assert.equal(stalenessBand(undefined).band, 'undated')
})

test('a stale basis is raised to the ask with the acknowledgement requirement', () => {
  const page = buildApprovalPage({
    payload: NOW, testBedCost: 25000, version: VERSION,
    catalog: {
      batches: { safesight: { batch_label: 'Old', effective_from: '2025-01-01' } },
      missing: [], asOf: '2026-08-29',
    },
  })
  assert.match(page.ask.staleBasisWarning, /over twelve months old/)
  assert.match(page.ask.staleBasisWarning, /explicit acknowledgement/)
  assert.equal(page.costBasis.stale.length, 1)
})

test('an ageing basis is noted, and does not claim to need acknowledgement', () => {
  // The discriminating half. If both bands produced the same sentence, the
  // three-band policy would be two bands wearing three names.
  const page = buildApprovalPage({
    payload: NOW, testBedCost: 25000, version: VERSION,
    catalog: {
      batches: { safesight: { batch_label: 'Q1', effective_from: '2026-02-01' } },
      missing: [], asOf: '2026-08-29',
    },
  })
  assert.equal(page.ask.staleBasisWarning, null)
  assert.match(page.ask.ageingBasisNote, /between six and/)
  assert.match(page.ask.ageingBasisNote, /assumption being accepted/)
})

test('a current basis raises nothing at all', () => {
  const page = buildApprovalPage({ payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG })
  assert.equal(page.ask.staleBasisWarning, null)
  assert.equal(page.ask.ageingBasisNote, null)
})

test('as_of has a stated rule and it is on the page', () => {
  // It is a parameter nobody was setting and nobody had written down. Measured
  // across the repository: GET /api/base-costs defaults it to today and no
  // caller passes it, so every path prices at today's catalog.
  const page = buildApprovalPage({ payload: NOW, testBedCost: 25000, version: VERSION, catalog: CATALOG })
  assert.match(page.costBasis.asOfRule, /defaults to today/)
  assert.match(page.costBasis.asOfRule, /nothing in the application sets it/)
  assert.equal(page.costBasis.asOf, CATALOG.asOf)
})
