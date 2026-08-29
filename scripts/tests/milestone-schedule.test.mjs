// A payment schedule's parts must sum to the total it is a schedule of.
// PURE: no database, no network, no credentials.
//
// Every threshold below is exercised from BOTH sides, because a reconciliation
// that cannot fail is not a reconciliation (Verification 21) and the defect
// this closes was exactly a tolerance nobody had derived.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import {
  scheduleReconciliation, roundingAllowance, differenceStatement, refusalStatement,
} from '../../src/lib/milestone-schedule.js'

test('the real deal: $250,020 against $250,000 does not reconcile', () => {
  // The business entered this and it saved without a word.
  const rec = scheduleReconciliation([{ usd: 100000 }, { usd: 100000 }, { usd: 50020 }], 250000)
  assert.equal(rec.totalUsd, 250020)
  assert.equal(rec.diffUsd, 20)
  assert.equal(rec.exact, false)
  assert.equal(rec.reconciles, false, 'a $20 overrun on 3 rows is not rounding')
  assert.match(rec.statement, /Over by \$20/)
})

test('and the percentage may not round the discrepancy shut', () => {
  // 250020/250000 is 100.008%, which `.toFixed(1)` printed as "100.0%". The one
  // number whose job is to report the gap had been rounded until it closed it.
  const rec = scheduleReconciliation([{ usd: 250020 }], 250000)
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
  const inside = scheduleReconciliation([{ usd: 83334 }, { usd: 83333 }, { usd: 83334 }], 250000)
  assert.equal(inside.diffUsd, 1)
  assert.equal(inside.exact, false, 'still not exact, so it is still stated')
  assert.equal(inside.reconciles, true, 'and still takeable as a version')

  const outside = scheduleReconciliation([{ usd: 83335 }, { usd: 83335 }, { usd: 83334 }], 250000)
  assert.equal(outside.diffUsd, 4)
  assert.equal(outside.reconciles, false)
})

test('the old tolerance would have let both of these through', () => {
  // 0.5% of the base, which is what the code used to allow.
  for (const [base, drift] of [[250000, 1250], [1000000, 5000]]) {
    const old = Math.abs(((base + drift) / base) * 100 - 100) <= 0.5
    assert.ok(old, 'the old check tolerated it')
    const now = scheduleReconciliation([{ usd: base + drift }], base)
    assert.equal(now.reconciles, false, `$${drift} on $${base} must not reconcile`)
  }
})

test('under counts as well as over', () => {
  const rec = scheduleReconciliation([{ usd: 240000 }], 250000)
  assert.equal(rec.diffUsd, -10000)
  assert.match(rec.statement, /^Under by \$10,000/)
  assert.equal(rec.reconciles, false)
})

test('no schedule is not a discrepancy', () => {
  // Every installation type except Lump Sum has no contractor schedule, and a
  // refusal firing on those would fire on almost every deal.
  for (const [rows, base] of [[[], 250000], [[{ usd: 0 }], 250000], [[{ usd: 100 }], 0], [null, null]]) {
    const rec = scheduleReconciliation(rows, base)
    assert.equal(rec.reconciles, true, `${JSON.stringify(rows)} / ${base} must not refuse`)
    assert.equal(rec.statement, null)
  }
  assert.equal(scheduleReconciliation([], 250000).hasSchedule, false)
  assert.equal(scheduleReconciliation([{ usd: 1 }], 250000).hasSchedule, true)
})

test('an exact schedule says nothing at all', () => {
  const rec = scheduleReconciliation([{ usd: 125000 }, { usd: 125000 }], 250000)
  assert.equal(rec.exact, true)
  assert.equal(rec.statement, null)
  assert.equal(rec.reconciles, true)
})

test('the refusal names the numbers, not the rule', () => {
  const rec = scheduleReconciliation([{ usd: 250020 }], 250000)
  const s = refusalStatement(rec, 'The contractor payment schedule')
  assert.match(s, /250,020/)
  assert.match(s, /250,000/)
  assert.match(s, /Over by \$20/)
})

test('both grids and the server ask the same evaluator', () => {
  // Verification 20. Two implementations of "does this add up" would agree
  // today and diverge the first time one was corrected.
  const client = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../../src/routes/deal-sheet-versions.js', import.meta.url), 'utf8')

  assert.match(client, /import \{[^}]*scheduleReconciliation[^}]*\} from '\/lib\/milestone-schedule\.js'/)
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
  const client = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  const block = client.slice(client.indexOf('const CONTRACTOR_MILESTONES'), client.indexOf('function milestoneOptions'))
  for (const m of ['Contract start', 'Hardware delivered to site', 'Installation complete',
    'Commissioning', 'Go live', 'Final acceptance']) {
    assert.ok(block.includes(m), `missing milestone: ${m}`)
  }
  assert.match(client, /Select milestone/, 'the empty option must be a real option, not a placeholder')
  // The milestone is a dropdown, not free text.
  assert.match(client, /<select id="deal-cm-\$\{i\}-label">/)
  assert.ok(!/<input type="text" id="deal-cm-\$\{i\}-label"/.test(client), 'free text survives')
})

test('the percentage is an input and the dollars are computed from it', () => {
  const client = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  assert.match(client, /id="deal-cm-\$\{i\}-pct" style/, 'the percentage cell must be an input')
  assert.ok(!/<td class="col-mono" id="deal-cm-\$\{i\}-pct">/.test(client),
    'the percentage is still a read-only output cell')
  // One conversion, both directions.
  assert.match(client, /function pctToUsd/)
  assert.match(client, /function usdToPct/)
  assert.match(client, /function syncContractorRow/)
})
