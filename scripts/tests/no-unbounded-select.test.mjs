// THE GUARD: no NEW unbounded select in code the gate runs.
//
// R7, teardown integrity round. The page cap has now produced three findings in
// this estate - teardown's tag branch reading 1,000 of 23,210 rows, a residue
// sweep script printing 1,000 counters where there are 3,735, and a Round 20
// residue count of zero taken from 1,000 of 8,237 rows. Measuring the instances
// one at a time has not stopped the fourth arriving.
//
// So this guard is about the CLASS, not the instances. The 41 that exist today
// are recorded in a shrink-only allowlist; what this test buys is that number
// 42 is a red test rather than a finding somebody makes in six months.
//
// THE DEFINITION IS IMPORTED, NOT RESTATED. Verification 20: two instruments
// disagreeing about a definition report a gap that does not exist, which is
// exactly what the door census and the door's own rule did.
import test from 'node:test'
import assert from 'node:assert/strict'
import { findUnboundedSelects, gateRunFiles } from '../lib/unbounded-selects.mjs'
import { ALLOWED, CEILING } from '../lib/unbounded-select-allowlist.mjs'

const allowed = new Set(ALLOWED)

test('the scanner can see the gate\'s own files, so a zero would be a measurement', () => {
  // Verification 12 and 13: an empty result from an instrument never shown
  // reaching a non-empty one is not a measurement. If the walk stops finding
  // files - a renamed directory, a changed package.json shape - every
  // assertion below passes vacuously.
  const files = gateRunFiles()
  assert.ok(files.length > 20, `only ${files.length} gate-run files found; the walk is broken`)
  assert.ok(findUnboundedSelects(files).length > 0,
    'the scanner found no unbounded select at all, which it must while the allowlist is non-empty')
})

test('no unbounded select outside the measured allowlist', () => {
  const found = findUnboundedSelects()
  const strangers = found.filter((f) => !allowed.has(f.key))
  assert.deepEqual(strangers.map((f) => f.key), [],
    'a select in code the gate runs takes PostgREST\'s first 1,000 rows and says nothing ' +
    'about it. Bound it with .range/.limit/.single, or measure that it cannot exceed the ' +
    'cap and add it to the allowlist - which requires raising CEILING, deliberately.')
})

test('the allowlist does not drift from the tree: no stale entries', () => {
  // The other direction, and the one that makes it shrink. When an instance is
  // bounded, its key must LEAVE the list; a list that keeps entries for code
  // that no longer exists stops describing anything.
  const keys = new Set(findUnboundedSelects().map((f) => f.key))
  const stale = ALLOWED.filter((k) => !keys.has(k))
  assert.deepEqual(stale, [],
    'these keys are allowlisted but no longer found - the select was bounded or moved. ' +
    'Remove them and lower CEILING.')
})

test('SHRINK-ONLY: the allowlist has not grown', () => {
  assert.ok(ALLOWED.length <= CEILING,
    `the allowlist holds ${ALLOWED.length} entries against a ceiling of ${CEILING}. ` +
    'The ceiling may only ever be lowered.')
  assert.equal(new Set(ALLOWED).size, ALLOWED.length, 'the allowlist has duplicate keys')
})
