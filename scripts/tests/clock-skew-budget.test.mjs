// The clock-skew retry budget. Round 38.
// Runs under `npm run test:db`, LAST, so it sees the whole run's count.
//
// The retry was added as a mitigation and described as "announcing itself" on
// stderr. That was true of the code and false of the system: CI runs the pure
// suite only and never this one, so nothing read the announcement. A mitigation
// nobody measures becomes invisible infrastructure, and the frequency is the
// thing worth watching - a platform that skews once a week is a different fact
// from one that skews every run.
//
// So the count is asserted. A run inside budget passes quietly; a run that needs
// more than the budget FAILS, which is the only way the number reaches anyone
// given the database suite is not in CI.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { clockSkew } from '../verify-harness.mjs'

// One retry in a run is the observed rate: twice in three rounds, never twice in
// one run. Two is the budget, so a single skew never fails a run and a pattern
// of them does. Raise this only from a measurement, never to make a red go away.
const BUDGET = 2

test('clock-skew retries stayed within budget', () => {
  assert.ok(clockSkew.retries <= BUDGET,
    `${clockSkew.retries} clock-skew retries this run (budget ${BUDGET}): ${clockSkew.labels.join(', ')}.\n` +
    'That is a platform signal, not a flake to re-run past. Record the rate before raising the budget.')
})

after(() => {
  // Printed on every run, pass or fail, so the number is visible rather than
  // only appearing when it breaches.
  process.stderr.write(`  [clock skew] retries this run: ${clockSkew.retries}\n`)
})
