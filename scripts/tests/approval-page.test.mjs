// The commercial approval page, blocks 1 to 5. Round 38.
// Runs under `npm test` - pure, no database, no DOM.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildApprovalPage, buildBridge, buildExposures, buildTarget, buildCostBasis,
  buildNotRecorded, pricedKeys, BRIDGE_STEPS, bridgeKeys,
} from '../../src/lib/approval-page.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
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
const M = (p) => calculateDeal(buildDealInputs(p, { testBedCost: 25000 })).achievedMargin

// ─────────────────────────────────────────────────────────────
// Block 2: the bridge reconciles. This is the whole point of it.
// ─────────────────────────────────────────────────────────────

test('the bridge sums EXACTLY to the total movement', () => {
  const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
  const summed = b.steps.reduce((s, r) => s + r.marginPoints, 0)
  assert.ok(Math.abs(b.total.marginPoints - summed) < 1e-9,
    `steps summed to ${summed}, total is ${b.total.marginPoints}`)
  assert.ok(Math.abs(b.unexplained) < 1e-9, `unexplained is ${b.unexplained}, must be zero`)
})

test('and the opening and closing are the real margins, not restatements', () => {
  const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
  assert.equal(b.opening.marginPoints, M(APPROVED))
  assert.equal(b.closing.marginPoints, M(NOW))
})

test('the steps come out in the documented order', () => {
  const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
  assert.deepEqual(b.steps.map((s) => s.step), ['term', 'cost basis', 'discount or override'])
})

test('a step that did not move is omitted, not shown as zero', () => {
  const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
  assert.ok(!b.steps.some((s) => s.step === 'units'), 'units did not move and must not appear')
})

test('nothing changed means no steps and a zero total', () => {
  const b = buildBridge(APPROVED, { ...APPROVED }, { testBedCost: 25000 })
  assert.deepEqual(b.steps, [])
  assert.equal(b.total.marginPoints, 0)
})

test('ORDER-DEPENDENCE IS REAL, and the total is not', () => {
  // The property the business accepted explicitly. Individual steps move when
  // the order changes; the total does not. If the steps were identical under
  // reversal, the sequential shape would be doing nothing and one-at-a-time
  // would have been the better choice after all.
  const forward = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
  const originalOrder = BRIDGE_STEPS.slice()
  BRIDGE_STEPS.reverse()
  const backward = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
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
    const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
    assert.deepEqual(b.unassignedKeys, ['duration'],
      'a priced key belonging to no step must be named')
  } finally {
    term.keys = original
  }
  assert.deepEqual(buildBridge(APPROVED, NOW, { testBedCost: 25000 }).unassignedKeys, [],
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
  const r = calculateDeal(buildDealInputs(NOW, { testBedCost: 25000 }))
  const t = buildTarget({ ...NOW, targetMargin: 35 }, r, { baselinePayload: APPROVED })
  assert.equal(t.target, 35)
  assert.equal(t.was, 30)
  assert.equal(t.moved, true)
})

test('a moved target gets its own sentence naming both figures', () => {
  const r = calculateDeal(buildDealInputs(NOW, { testBedCost: 25000 }))
  const t = buildTarget({ ...NOW, targetMargin: 35 }, r,
    { baselinePayload: APPROVED, changedAt: '4 August 2026' })
  assert.equal(t.movedSentence, 'Target 35% (was 30% at last approval, changed 4 August 2026).')
})

test('an unmoved target produces no sentence at all', () => {
  const r = calculateDeal(buildDealInputs(NOW, { testBedCost: 25000 }))
  assert.equal(buildTarget(NOW, r, { baselinePayload: APPROVED }).movedSentence, null)
})

test('per-line overrides below target are listed, worst gap first', () => {
  const p = { ...NOW, targetMargin: 30, marginOverrides: { hwSs: 22, hwAqm: 12, hwHemir: 35 } }
  const r = calculateDeal(buildDealInputs(p, { testBedCost: 25000 }))
  const t = buildTarget(p, r, {})
  assert.deepEqual(t.linesBelowTarget.map((l) => l.key), ['hwAqm', 'hwSs'],
    'above-target lines are not discounts and must not be listed')
  assert.equal(t.linesBelowTarget[0].gapPoints, 18)
})

test('an unset target uses the system default AND says so', () => {
  const p = { ...NOW }
  delete p.targetMargin
  const r = calculateDeal(buildDealInputs(p, { testBedCost: 25000 }))
  const t = buildTarget(p, r, {})
  assert.equal(t.target, NUMERIC_DEFAULTS.targetMargin)
  assert.equal(t.provenance.source, 'system default')
  assert.match(t.provenance.sentence, /^30% \(system default, set \d{4}-\d{2}-\d{2}\)$/)
})

// ─────────────────────────────────────────────────────────────
// Block 3: exposures, not inputs
// ─────────────────────────────────────────────────────────────

test('exposures are money, and say who bears each', () => {
  const r = calculateDeal(buildDealInputs(NOW, { testBedCost: 25000 }))
  const ex = buildExposures(NOW, r)
  const by = Object.fromEntries(ex.map((e) => [e.key, e]))
  assert.equal(by.gst.bornByTerminus, false, 'GST is collected, not borne')
  assert.equal(by.warranty.bornByTerminus, true)
  assert.equal(by.testBed.amount, 25000)
  for (const e of ex) assert.equal(typeof e.amount, 'number', `${e.key} must be an amount`)
})

test('a grossed-up deal shows zero borne AND the number if the client refuses', () => {
  // The exposure an input screen cannot show: grossUp makes whtBorne zero, which
  // reads as no risk, and the risk is that the client declines the gross-up.
  const r = calculateDeal(buildDealInputs(NOW, { testBedCost: 25000 }))
  const wht = buildExposures(NOW, r).find((e) => e.key === 'wht')
  assert.equal(wht.amount, 0)
  assert.equal(wht.bornByTerminus, false)
  assert.match(wht.note, /refuses the gross-up/)
  assert.ok(r.tax.whtAmount > 0, 'and there must be a real number behind that sentence')
})

test('not grossed up, the withholding is borne and shown as borne', () => {
  const p = { ...NOW, grossUp: false }
  const r = calculateDeal(buildDealInputs(p, { testBedCost: 25000 }))
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
  const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
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
  const r = calculateDeal(buildDealInputs(p, { testBedCost: 25000 }))
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
  for (const k of ['inSsExisting', 'inSsNew', 'inAqm', 'inHemir']) {
    assert.ok(keys.has(k), `${k} is only read on the per-unit branch and must still be derived`)
  }
  for (const k of ['ssUnitCost', 'targetMargin', 'duration', 'factoring', 'grossUp']) {
    assert.ok(keys.has(k), `${k} prices the deal and must be derived`)
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
  const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
  assert.deepEqual(b.unassignedKeys, [], 'the real key set is fully assigned today')
  const everyPriced = [...pricedKeys()]
  const unclaimed = everyPriced.filter((k) => !bridgeKeys().has(k))
  assert.deepEqual(unclaimed, [],
    'every key the calculation reads must belong to a bridge step: ' + unclaimed.join(', '))
})

// ─────────────────────────────────────────────────────────────
// Found by reading the rendered page
// ─────────────────────────────────────────────────────────────

test('a default that lives NESTED is read where it lives', () => {
  // factoringRatePct is payload.factoring.ratePct. Reading it flat meant the
  // page told every approver "nobody entered a value" for a deal that had set
  // it - a false statement on a page whose job is to show what is being
  // accepted.
  const set = buildNotRecorded({ ...NOW, factoring: { enabled: true, ratePct: 2.5 } }, { versionReason: 'x' })
  assert.ok(!set.some((r) => r.key === 'factoringRatePct'),
    'a deal that sets its factoring rate is not running on the default')

  const unset = buildNotRecorded({ ...NOW, factoring: { enabled: false } }, { versionReason: 'x' })
  assert.ok(unset.some((r) => r.key === 'factoringRatePct'),
    'and a deal that does not set it still is')
})

test('the bridge reconciles AS DISPLAYED, or names the rounding', () => {
  // Exact arithmetic is not the claim the page makes. It shows two decimals, and
  // an approver adding up what they can see must arrive at the closing figure.
  const b = buildBridge(APPROVED, NOW, { testBedCost: 25000 })
  const at = (n) => Number(n.toFixed(2))
  const shown = b.steps.reduce((s, r) => s + at(r.marginPoints), 0) + b.displayRounding
  assert.equal(Number(shown.toFixed(2)), Number((at(b.closing.marginPoints) - at(b.opening.marginPoints)).toFixed(2)),
    'displayed steps plus the rounding line must equal the displayed movement')
})

test('and the rounding line is absent when it is not needed', () => {
  const b = buildBridge(APPROVED, { ...APPROVED }, { testBedCost: 25000 })
  assert.equal(b.displayRounding, 0, 'nothing moved, so there is nothing to round')
})
