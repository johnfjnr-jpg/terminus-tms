// Where a rate comes from. Round 40 Phase 1b. PURE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { readCode } from '../lib/strip-comments.mjs'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { buildDealInputs, ZERO_IS_NOT_A_VALUE, RAW_READERS, isSet } from '../../src/lib/deal-inputs.js'
import {
  resolveRates, frozenRates, frozenRatesAgree,
  OVERRIDABLE_RATE_KEYS, CATALOG_ONLY_RATE_KEYS, ALL_RATE_KEYS,
} from '../../src/lib/rate-resolution.js'

const CAT = {
  ssUnitCost: 8000, aqUnitCost: 2000, hemirUnitCost: 100000,
  hoSafesight: 200, hoAqm: 100, hoHemir: 500,
  inSsExisting: 2000, inSsNew: 20000, inAqm: 500, inHemir: 5000,
}

test('three outcomes, never two: overridden, catalog, or absent', () => {
  // THE FOURTH APPEARANCE of the confident-zero shape in this module, after
  // gstPct, whtPct and duration, and meant to be the last. buildDealInputs read
  // `payload.inSsExisting ?? 0`, so a rate nobody had set priced at zero and a
  // genuinely free installation looked identical to a missing one.
  const r = resolveRates({ inSsExisting: 3500 }, { ...CAT, inAqm: undefined })
  const by = Object.fromEntries(r.lines.map((l) => [l.key, l]))
  assert.equal(by.inSsExisting.source, 'overridden')
  assert.equal(by.ssUnitCost.source, 'catalog')
  assert.equal(by.inAqm.source, 'absent')
  assert.equal(by.inAqm.value, null, 'an absent rate must not become a number')
  assert.ok(!('inAqm' in r.rates), 'an absent rate is omitted, not zeroed')
})

test('a catalog-only rate in the payload cannot price anything', () => {
  // THE ENFORCEMENT, and it is stronger than the allowlist ever was. Even a
  // payload that somehow carries ssUnitCost prices at the catalog figure,
  // because the resolver refuses to look.
  const r = resolveRates({ ssUnitCost: 999999, hoSafesight: 1 }, CAT)
  assert.equal(r.rates.ssUnitCost, 8000)
  assert.equal(r.rates.hoSafesight, 200)
  assert.deepEqual(r.overridden.map((l) => l.key), [], 'no catalog-only key may be overridden')

  // Calibration: the same shape on an overridable key DOES take.
  assert.equal(resolveRates({ inAqm: 999 }, CAT).rates.inAqm, 999)
})

test('recovery period is two-phase only, and hybrid is otherwise unchanged', () => {
  // Round 41 ruling 1. A REMOVAL, so it carries two claims: the thing is gone,
  // and everything that still works is shown still working.
  const CAT = { ssUnitCost: 8000, aqUnitCost: 2000, hemirUnitCost: 100000,
    hoSafesight: 200, hoAqm: 100, hoHemir: 500,
    inSsExisting: 2000, inSsNew: 20000, inAqm: 500, inHemir: 5000 }
  const base = { ssExisting: 12, ssNew: 3, aqm: 5, hemir: 2, duration: 36,
    targetMargin: 30, warrantyPct: 2, invoicing: 'annual',
    installResp: 'Client Own Installation Team',
    milestones: [{ month: 1, usd: 200000, pct: 0 }, { month: 6, usd: 292858, pct: 0 }] }
  const cf = (structure, recoveryMonths, extra = {}) => {
    const p = { ...base, structure, ...extra, ...(recoveryMonths === undefined ? {} : { recoveryMonths }) }
    return calculateDeal(buildDealInputs(p, { rates: resolveRates(p, CAT).rates }))
  }

  // GONE: hybrid computes no recovery period, at any input.
  for (const rm of [undefined, 0, 12, 36]) {
    assert.equal(cf('hybrid', rm).cashFlow.recov, null,
      `hybrid must not compute a recovery period, saw one at recoveryMonths=${rm}`)
  }
  // null and not 0, because 0 would say "recovers over zero months", which is
  // the confident zero this round is removing everywhere else.
  assert.notEqual(cf('hybrid', 12).cashFlow.recov, 0)

  // STILL WORKING: hybrid's own figures are untouched by the removal.
  const h = cf('hybrid', 12).cashFlow
  assert.equal(Math.round(h.rows.reduce((s, x) => s + x.hardwareIn, 0)), 492858,
    'hybrid still recovers hardware through its milestone schedule')
  assert.equal(Math.round(h.rows.at(-1).cum), 217302)

  // SUPERSEDED BY RULING 5, and left visible rather than deleted, because the
  // superseded reasoning is what tells a later reader that a premise changed
  // rather than a preference (Verification 29).
  //
  // This assertion read `financeCost === 33638` with the comment "hybrid
  // factoring still prices at its 12-month default term". That was TRUE and it
  // was the thing ruling 5 then removed: the 12 was a business number written
  // into a calculator, and pricing a facility whose term nobody recorded is
  // the fallback Architecture 11 forbids.
  const noTerm = cf('hybrid', 12, { factoring: { enabled: true, ratePct: 1.5, termMonths: null, method: 'straight' } })
  assert.equal(noTerm.financeCost, null,
    'a factoring facility with no recorded term must not be priced at an invented one')
  assert.equal(noTerm.costIncomplete, true,
    'and the total that omits it must say so, or the margin reads as achieved')
  assert.equal(noTerm.cashFlow.rows[0].advance, 0,
    'nothing is advanced on a facility that has no term to repay it over')

  // AND THE TERM IS STILL READ WHEN IT IS THERE, which is the other half: a
  // change that removes a substitution has to show the real value arriving.
  const withTerm = cf('hybrid', 12, { factoring: { enabled: true, ratePct: 1.5, termMonths: 12, method: 'straight' } })
  assert.equal(withTerm.financeCost, 33638, 'a recorded 12-month term prices exactly as the old default did')
  assert.equal(withTerm.costIncomplete, false)
  assert.equal(cf('hybrid', 12, { factoring: { enabled: true, ratePct: 1.5, termMonths: 24, method: 'straight' } }).financeCost,
    64688, 'and a different term prices differently, so the parameter is read rather than decorative')

  // STILL WORKING: the two structures that DO have a recovery period.
  assert.equal(cf('twoPhase', 12).cashFlow.recov, 12)
  assert.equal(cf('single', undefined).cashFlow.recov, 36, 'single recovers over the full term')
  assert.equal(cf('twoPhase', undefined).cashFlow.recov, null,
    'a blank recovery period is an absence, not a deal that recovers over zero months')
  assert.equal(Math.round(cf('twoPhase', undefined).cashFlow.rows.at(-1).cum), -275556,
    'the arithmetic is unchanged by that: null and 0 bill the same nothing, and finding 1 '
    + 'is closed by the default being written into the record, not by the calculator guessing')
})

test('the orphaned calculate route is gone and submit is not', () => {
  // Round 41 ruling 2. Two claims again. POST /calculate returned the WHOLE
  // calculateDeal result, so every internal crossed the wire, and it had no
  // caller anywhere in frontend/ or scripts/.
  const route = readCode(new URL('../../src/routes/deals.js', import.meta.url))
  assert.ok(!/app\.post\('\/calculate'/.test(route), 'the calculate route survives')
  // A comment MENTIONING reply.send(result) is prose, not a call. The first
  // version of this assertion fired on the comment recording the removal,
  // which is the same fault the fetch scan in api-client.test.mjs already
  // names: a source scan that cannot tell code from the note explaining it.
  const code = route.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.ok(!/reply\.send\(result\)/.test(code), 'the whole-result send survives')
  // Calibration: the filter keeps real code. Verification 17.
  assert.match(code, /return reply\.code\(|return reply\.send\(/)

  // STILL WORKING: /submit is dormant rather than orphaned, and stays.
  assert.match(route, /app\.post\('\/submit'/)
  // And the input shape stays documented, which is why the schema was kept.
  assert.match(route, /const dealInputSchema = \{/)
})

test('the two sets are disjoint and cover every rate key', () => {
  // Verification 19: a list asserting a property gets the property measured.
  assert.equal(OVERRIDABLE_RATE_KEYS.length, 4)
  assert.equal(CATALOG_ONLY_RATE_KEYS.length, 6)
  assert.equal(new Set(ALL_RATE_KEYS).size, 10)
  assert.deepEqual(OVERRIDABLE_RATE_KEYS.filter((k) => CATALOG_ONLY_RATE_KEYS.includes(k)), [])
  // The four are exactly the installation keys, which is the test the business
  // ruled on: quoted per job, not the same wherever the deal happens.
  assert.deepEqual([...OVERRIDABLE_RATE_KEYS].sort(), ['inAqm', 'inHemir', 'inSsExisting', 'inSsNew'])
})

test('the approval page distance is a by-product, not a second computation', () => {
  const r = resolveRates({ inSsExisting: 3500, inHemir: 4000 }, CAT)
  const by = Object.fromEntries(r.overridden.map((l) => [l.key, l]))
  assert.equal(by.inSsExisting.diff, 1500)
  assert.equal(by.inSsExisting.catalogRate, 2000)
  assert.equal(Math.round(by.inSsExisting.diffPct), 75)
  assert.equal(by.inHemir.diff, -1000, 'cheaper than the default is a distance too')
})

test('a version freezes the numbers AND which were overridden', () => {
  // The business's addition, and it is the half that survives a catalog move:
  // an approver reading an old version cannot otherwise tell whether $4,000 was
  // a quotation somebody obtained or the catalog figure of the day.
  const frozen = frozenRates(resolveRates({ inSsExisting: 3500 }, CAT))
  assert.equal(frozen.rates.inSsExisting, 3500)
  assert.equal(frozen.rates.ssUnitCost, 8000)
  assert.deepEqual(frozen.overridden.map((o) => o.key), ['inSsExisting'])
  assert.equal(frozen.overridden[0].catalogRate, 2000)
})

test('the honesty test: a version agrees with the resolver, or it does not', () => {
  const record = { inSsExisting: 3500 }
  const frozen = frozenRates(resolveRates(record, CAT))
  assert.equal(frozenRatesAgree(frozen, resolveRates(record, CAT)).agree, true)

  // The catalog moved under it.
  const moved = frozenRatesAgree(frozen, resolveRates(record, { ...CAT, ssUnitCost: 9000 }))
  assert.equal(moved.agree, false)
  assert.deepEqual(moved.differing, ['ssUnitCost'])

  // The DECISION changed under it: same numbers, different provenance. This is
  // the case the numbers alone cannot see, and it is why the version stores
  // which keys were overridden rather than only their values.
  const sameNumbers = frozenRates(resolveRates({ inSsExisting: 2000 }, CAT))
  const asIfCatalog = resolveRates({}, CAT)
  assert.equal(sameNumbers.rates.inSsExisting, asIfCatalog.rates.inSsExisting, 'identical figures')
  assert.equal(frozenRatesAgree(sameNumbers, asIfCatalog).agree, false,
    'a quoted 2000 and a catalog 2000 are different facts')
})

test('the server allowlist admits exactly the four, and refuses the six', () => {
  // "We only added four" is the claim Verification 19 catches, so it is
  // measured against the route's own list rather than read.
  const route = readCode(new URL('../../src/routes/opportunities.js', import.meta.url))
  const block = route.slice(route.indexOf('const SALESPERSON_WRITABLE_KEYS'), route.indexOf('])', route.indexOf('const SALESPERSON_WRITABLE_KEYS')))
  for (const k of OVERRIDABLE_RATE_KEYS) {
    assert.ok(block.includes(`'${k}'`), `${k} is overridable and the server must accept it`)
  }
  for (const k of CATALOG_ONLY_RATE_KEYS) {
    assert.ok(!block.includes(`'${k}'`), `${k} is a catalog fact and the server must refuse it`)
  }
  // And the client's owned list agrees with the server's.
  const client = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const owned = client.slice(client.indexOf('const COMMERCIALS_OWNED_KEYS'), client.indexOf(']', client.indexOf('const COMMERCIALS_OWNED_KEYS')))
  for (const k of OVERRIDABLE_RATE_KEYS) assert.ok(owned.includes(`'${k}'`), `${k} missing from COMMERCIALS_OWNED_KEYS`)
  for (const k of CATALOG_ONLY_RATE_KEYS) assert.ok(!owned.includes(`'${k}'`), `${k} must not be client-owned`)
})

test('readPayload sends the box, never the catalog figure', () => {
  // THE RISK OF THE PHASE. These four are now writable, so a readPayload still
  // copying the catalog onto them would record a per-deal override of the
  // catalog on EVERY deal at every save, silently, on all four keys.
  const client = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const fn = client.slice(client.indexOf('function readPayload()'), client.indexOf('function readMilestones'))
  for (const [key, id] of [['inSsExisting', 'deal-inSsExisting'], ['inSsNew', 'deal-inSsNew'],
    ['inAqm', 'deal-inAqm'], ['inHemir', 'deal-inHemir']]) {
    assert.match(fn, new RegExp(`${key}: numOrNull\\('${id}'\\)`), `${key} must be read from its box`)
  }
  assert.ok(!/catalogRates\.in(SsExisting|SsNew|Aqm|Hemir)/.test(fn),
    'readPayload still copies a catalog install rate into the payload')
})

test('the calculator refuses to price without resolved rates', () => {
  // Required rather than defaulted: a default would let a caller forget and
  // silently get the old behaviour, which is Verification 24 exactly.
  const inputs = readCode(new URL('../../src/lib/deal-inputs.js', import.meta.url))
  assert.match(inputs, /if \(!rates\) \{/)
  assert.ok(!/payload\.(ssUnitCost|inSsExisting|hoSafesight)/.test(inputs),
    'a rate is still being read from the payload inside the calculator')
})
