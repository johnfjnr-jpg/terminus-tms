// A payment schedule's parts must sum to the total it is a schedule of.
// PURE: no database, no network, no credentials.
//
// Every threshold below is exercised from BOTH sides, because a reconciliation
// that cannot fail is not a reconciliation (Verification 21) and the defect
// this closes was exactly a tolerance nobody had derived.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { readCode } from '../lib/strip-comments.mjs'
import {
  scheduleReconciliation, roundingAllowance, differenceStatement, refusalStatement,
} from '../../src/lib/milestone-schedule.js'

// ── R-N1: A ROW IS A PERCENTAGE NOW, AND THE CLAIMS ARE UNCHANGED ────────
//
// Ruled by John 2026-09-21: a milestone is a percentage of its base and the
// dollar figure is derived. These tests were written when the dollars were
// the input, and every one of them is a claim about DOLLAR arithmetic - a $20
// overrun on three rows, a tolerance that rounding can reach, a schedule
// $10,000 short.
//
// So the rows are expressed as the percentage that DERIVES to the dollar
// figure each test is about, rather than rewritten around new numbers. The
// claims, the tolerances and the expected statements are untouched; only the
// way a row is stated has changed, which is exactly what the ruling changed.
const atUsd = (usd, base) => ({ pct: base ? (usd / base) * 100 : 0 })

test('the real deal: $250,020 against $250,000 does not reconcile', () => {
  // The business entered this and it saved without a word.
  const rec = scheduleReconciliation([atUsd(100000, 250000), atUsd(100000, 250000), atUsd(50020, 250000)], 250000)
  assert.equal(rec.totalUsd, 250020)
  assert.equal(rec.diffUsd, 20)
  assert.equal(rec.exact, false)
  assert.equal(rec.reconciles, false, 'a $20 overrun on 3 rows is not rounding')
  assert.match(rec.statement, /Over by \$20/)
})

test('and the percentage may not round the discrepancy shut', () => {
  // 250020/250000 is 100.008%, which `.toFixed(1)` printed as "100.0%". The one
  // number whose job is to report the gap had been rounded until it closed it.
  const rec = scheduleReconciliation([atUsd(250020, 250000)], 250000)
  assert.equal(Number((100.008).toFixed(1)), 100, 'the old display rounded it shut')
  assert.ok(!/^Over by \$20, 0\.0 points/.test(rec.statement),
    `the statement must not print 0.0 points: ${rec.statement}`)
  assert.match(rec.statement, /0\.008/, 'the points figure must survive to a visible place')
})

test('the tolerance is derived from rounding, not picked', () => {
  // Whole-dollar rounding over N rows can move a total by at most N x 0.5.
  assert.equal(roundingAllowance(5), 2.5)
  assert.equal(roundingAllowance(3), 1.5)

  // Two dollars over three rows IS reachable by rounding, and reconciles while
  // still being stated. Three is not.
  const inside = scheduleReconciliation([atUsd(83334, 250000), atUsd(83333, 250000), atUsd(83334, 250000)], 250000)
  assert.equal(inside.diffUsd, 1)
  assert.equal(inside.exact, false, 'still not exact, so it is still stated')
  assert.equal(inside.reconciles, true, 'and still takeable as a version')

  const outside = scheduleReconciliation([atUsd(83335, 250000), atUsd(83335, 250000), atUsd(83334, 250000)], 250000)
  assert.equal(outside.diffUsd, 4)
  assert.equal(outside.reconciles, false)
})

test('the old tolerance would have let both of these through', () => {
  // 0.5% of the base, which is what the code used to allow.
  for (const [base, drift] of [[250000, 1250], [1000000, 5000]]) {
    const old = Math.abs(((base + drift) / base) * 100 - 100) <= 0.5
    assert.ok(old, 'the old check tolerated it')
    const now = scheduleReconciliation([atUsd(base + drift, base)], base)
    assert.equal(now.reconciles, false, `$${drift} on $${base} must not reconcile`)
  }
})

test('under counts as well as over', () => {
  const rec = scheduleReconciliation([atUsd(240000, 250000)], 250000)
  assert.equal(rec.diffUsd, -10000)
  assert.match(rec.statement, /^Under by \$10,000/)
  assert.equal(rec.reconciles, false)
})

test('no schedule is not a discrepancy', () => {
  // Every installation type except Lump Sum has no contractor schedule, and a
  // refusal firing on those would fire on almost every deal.
  for (const [rows, base] of [[[], 250000], [[{ pct: 0 }], 250000], [[{ pct: 50 }], 0], [null, null]]) {
    const rec = scheduleReconciliation(rows, base)
    assert.equal(rec.reconciles, true, `${JSON.stringify(rows)} / ${base} must not refuse`)
    assert.equal(rec.statement, null)
  }
  assert.equal(scheduleReconciliation([], 250000).hasSchedule, false)
  assert.equal(scheduleReconciliation([atUsd(1, 250000)], 250000).hasSchedule, true)
})

test('an exact schedule says nothing at all', () => {
  const rec = scheduleReconciliation([atUsd(125000, 250000), atUsd(125000, 250000)], 250000)
  assert.equal(rec.exact, true)
  assert.equal(rec.statement, null)
  assert.equal(rec.reconciles, true)
})

test('the refusal names the numbers, not the rule', () => {
  const rec = scheduleReconciliation([atUsd(250020, 250000)], 250000)
  const s = refusalStatement(rec, 'The contractor payment schedule')
  assert.match(s, /250,020/)
  assert.match(s, /250,000/)
  assert.match(s, /Over by \$20/)
})

test('both grids and the server ask the same evaluator', () => {
  // Verification 20. Two implementations of "does this add up" would agree
  // today and diverge the first time one was corrected.
  // RE-POINTED, Round 6 Phase R. Verification 20 is unchanged: two
  // implementations of "does this add up" would agree today and diverge the
  // first time one was corrected. The client is the React tree now, and it
  // imports the same shared evaluator by a bundler path rather than a URL.
  const client = [
    'frontend-react/src/deal/milestones.ts',
    'frontend-react/src/versions/VersionCardHost.tsx',
  ].map((f) => readCode(new URL('../../' + f, import.meta.url))).join('\n')
  const route = readCode(new URL('../../src/routes/deal-sheet-versions.js', import.meta.url))

  assert.match(client, /import \{[^}]*scheduleReconciliation[^}]*\} from/)
  assert.match(route, /import \{[^}]*scheduleReconciliation[^}]*\} from '\.\.\/lib\/milestone-schedule\.js'/)

  // Contractor grid, hardware grid, and the version refusal: three call sites.
  const calls = (client.match(/scheduleReconciliation\(/g) ?? []).length
  assert.ok(calls >= 3, `expected the client to ask it at least 3 times, saw ${calls}`)

  // And nothing computes the old hand-rolled tolerance any more.
  assert.ok(!/Math\.abs\(\s*(totalPct|pctOfHw)\s*-\s*100\s*\)\s*>\s*0\.5/.test(client),
    'a 0.5-percent-of-base tolerance survives somewhere')
  // Calibration: the scan can see one. Verification 17.
  assert.ok(/Math\.abs\(\s*totalPct\s*-\s*100\s*\)\s*>\s*0\.5/.test('if (Math.abs(totalPct - 100) > 0.5) {'),
    'the scan cannot detect the thing it is scanning for')
})

test('the milestone list is the one the business gave', () => {
  // RE-POINTED, Round 6 Phase R. The list is the business's, wherever it is
  // declared; only the file moved.
  const block = readCode(new URL('../../frontend-react/src/deal/milestones.ts', import.meta.url))
  for (const m of ['Contract start', 'Hardware delivered to site', 'Installation complete',
    'Commissioning', 'Go live', 'Final acceptance']) {
    assert.ok(block.includes(m), `missing milestone: ${m}`)
  }
  assert.match(block, /label: 'Select milestone'/,
    'the empty option must be a real option carrying words, not a bare placeholder')
  const rows = readCode(new URL('../../frontend-react/src/deal/panelParts.tsx', import.meta.url))
  assert.match(rows, /<select/, 'the milestone control is a dropdown')
  assert.ok(!/<input[^>]*type="text"[^>]*milestone/i.test(rows), 'free text survives')
})

// ── RETIRED, Round 6 Phase R: 'the percentage is an input and the dollars are
// computed from it'.
//
// COVERED, and by a better instrument. This matched four source shapes - an
// id template, the absence of a read-only cell, and the names of three
// functions - which together assert that a particular implementation was
// typed. The claim underneath is a ROUND TRIP, and deal-render.test.tsx
// asserts it as one: typing a contractor percentage fills its dollars, typing
// dollars fills the percentage, and the customer USD cell is read-only and
// computed from the percentage. Behaviour in both directions, where this
// asserted the existence of pctToUsd and usdToPct by name.
