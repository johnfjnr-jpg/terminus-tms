// The one payload-to-inputs translation reproduces what the two copies produced.
// Round 38, block 2's prerequisite (b). Runs under `npm test`.
//
// ─────────────────────────────────────────────────────────────
// WHY A GOLDEN FILE RATHER THAN RE-DERIVED EXPECTATIONS
// ─────────────────────────────────────────────────────────────
//
// buildDealInputs existed twice: on the Commercials tab and inline inside
// loadDealInputsFromOpportunity, whose comment claimed the two were "kept
// identical". Before merging them, both were extracted and run over the eight
// payload shapes below - every installResp branch, blanks-as-null, numeric
// strings and an empty payload. THEY AGREED ON ALL EIGHT, so the claim held and
// the merge was a simplification rather than a fix.
//
// deal-inputs-golden.json is that agreed output, captured from the code as it
// stood BEFORE the merge. Expectations written by hand afterwards would only
// prove the new function agrees with what I thought it should do; this proves it
// agrees with what shipped. It is data, so it cannot drift the way a second copy
// of the logic would.
//
// The one thing it cannot check is whether the OLD behaviour was right. That is
// what cost.test.mjs and cost-preview.test.mjs are for; this locks the refactor.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'

// JSON cannot carry undefined, and "present and undefined" is a different fact
// from "absent". factoringTermMonths IS undefined on a payload with no factoring
// block, so the fixture stores a sentinel and it is revived here rather than the
// comparison being loosened to stop noticing.
const UNDEF = '__undefined__'
function revive(value) {
  if (value === UNDEF) return undefined
  if (Array.isArray(value)) return value.map(revive)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]))
  }
  return value
}

const GOLDEN = JSON.parse(
  readFileSync(new URL('./fixtures/deal-inputs-golden.json', import.meta.url), 'utf8'))
  .map((c) => ({ ...c, expected: revive(c.expected) }))

test('the golden file covers every installResp branch and the empty payload', () => {
  // A golden file nobody checks the shape of is a file that can silently shrink.
  assert.equal(GOLDEN.length, 8)
  const labels = GOLDEN.map((c) => c.label)
  for (const needed of ['lump sum', 'per unit', 'client own', 'reseller', 'bare payload', 'blanks as null']) {
    assert.ok(labels.includes(needed), `the golden set must cover ${needed}`)
  }
  // Per unit is the branch Round 37 found priced at $0 for every deal, so its
  // install lines must actually carry cost in the recorded expectation.
  const perUnit = GOLDEN.find((c) => c.label === 'per unit')
  assert.ok(perUnit.expected.installLineItems.some((l) => l.cost > 0),
    'the per-unit golden must have non-zero install cost or it is locking the old bug')
})

for (const c of GOLDEN) {
  test(`the shared translation reproduces the old output: ${c.label}`, () => {
    const got = buildDealInputs(c.payload, { testBedCost: c.testBedCost })
    assert.deepEqual(got, c.expected)
  })
}

test('the sentinel survives the round trip, or the fixture is lying', () => {
  // Calibration on the sentinel itself. If revive() were broken, every golden
  // would silently expect the string '__undefined__' and deepEqual would fail
  // loudly - but if the ENCODER were broken the key would just be missing, which
  // is the quiet direction and the one worth asserting.
  const bare = GOLDEN.find((c) => c.label === 'bare payload')
  assert.ok('factoringTermMonths' in bare.expected,
    'the key must be PRESENT in the golden, not dropped by JSON')
  assert.equal(bare.expected.factoringTermMonths, undefined,
    'and it must revive to undefined, not to the sentinel string')
})

test('the golden test can SEE a drift', () => {
  // Calibration. deepEqual against a recorded object passes trivially if the
  // function returns the object it was given, so the check that matters is that
  // a changed input produces a changed output the golden would reject.
  const c = GOLDEN.find((c) => c.label === 'per unit')
  const drifted = buildDealInputs({ ...c.payload, duration: (c.payload.duration ?? 0) + 1 },
    { testBedCost: c.testBedCost })
  assert.notDeepEqual(drifted, c.expected,
    'if this passes, the comparison is not discriminating and the tests above prove nothing')
})

// ─────────────────────────────────────────────────────────────
// The property the third caller depends on
// ─────────────────────────────────────────────────────────────

test('rates come from the payload, so a historical version prices at its own rates', () => {
  // The approval page recomputes an approved version from version.inputs, which
  // carries the rates it was priced at. If this function reached for a catalog
  // instead, every historical recompute would silently reprice at today's costs
  // and block 2's "cost basis" step would always read zero.
  const then = { ssExisting: 10, ssNew: 0, aqm: 0, hemir: 0, ssUnitCost: 1000, duration: 12 }
  const now = { ...then, ssUnitCost: 1400 }
  assert.equal(buildDealInputs(then).ssUnitCost, 1000)
  assert.equal(buildDealInputs(now).ssUnitCost, 1400,
    'the same function must give a different answer for a different stored rate')
})

test('testBedCost is a parameter, not a payload key', () => {
  // It lives in opportunity_details. A payload carrying a testBedCost key must
  // not be able to set it, or a client could price its own sunk cost away.
  assert.equal(buildDealInputs({ testBedCost: 999999 }).testBedCost, 0)
  assert.equal(buildDealInputs({}, { testBedCost: 25000 }).testBedCost, 25000)
})
