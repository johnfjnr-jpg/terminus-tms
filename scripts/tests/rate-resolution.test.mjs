// Where a rate comes from. Round 40 Phase 1b. PURE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
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
  const route = readFileSync(new URL('../../src/routes/opportunities.js', import.meta.url), 'utf8')
  const block = route.slice(route.indexOf('const SALESPERSON_WRITABLE_KEYS'), route.indexOf('])', route.indexOf('const SALESPERSON_WRITABLE_KEYS')))
  for (const k of OVERRIDABLE_RATE_KEYS) {
    assert.ok(block.includes(`'${k}'`), `${k} is overridable and the server must accept it`)
  }
  for (const k of CATALOG_ONLY_RATE_KEYS) {
    assert.ok(!block.includes(`'${k}'`), `${k} is a catalog fact and the server must refuse it`)
  }
  // And the client's owned list agrees with the server's.
  const client = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  const owned = client.slice(client.indexOf('const COMMERCIALS_OWNED_KEYS'), client.indexOf(']', client.indexOf('const COMMERCIALS_OWNED_KEYS')))
  for (const k of OVERRIDABLE_RATE_KEYS) assert.ok(owned.includes(`'${k}'`), `${k} missing from COMMERCIALS_OWNED_KEYS`)
  for (const k of CATALOG_ONLY_RATE_KEYS) assert.ok(!owned.includes(`'${k}'`), `${k} must not be client-owned`)
})

test('readPayload sends the box, never the catalog figure', () => {
  // THE RISK OF THE PHASE. These four are now writable, so a readPayload still
  // copying the catalog onto them would record a per-deal override of the
  // catalog on EVERY deal at every save, silently, on all four keys.
  const client = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
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
  const inputs = readFileSync(new URL('../../src/lib/deal-inputs.js', import.meta.url), 'utf8')
  assert.match(inputs, /if \(!rates\) \{/)
  assert.ok(!/payload\.(ssUnitCost|inSsExisting|hoSafesight)/.test(inputs),
    'a rate is still being read from the payload inside the calculator')
})
