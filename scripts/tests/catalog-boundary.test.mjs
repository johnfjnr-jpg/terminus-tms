// ── R-C2a: THE CATALOG BOUNDARY, ASSERTED SO IT CANNOT BE CROSSED QUIETLY ─
//
// C2's Phase 0 stopped on it: unit costs are the CATALOG's, one row per
// product in `base_cost_batches`, shared by every deal. Editing one from
// inside a deal would reprice the estate.
//
// John ruled the boundary STANDS, and that the enforcement be asserted rather
// than left as two lists nobody compares. It is enforced in TWO places today
// and that duplication is the point: the save allowlist decides what reaches
// the record, and the resolver decides what can price a deal. Either alone
// would be a single point of failure.
//
// WITHOUT THIS TEST THE FAILURE IS SILENT IN THE WORST DIRECTION: adding
// `ssUnitCost` to the writable allowlist would make an edit control appear to
// work - the key would save - while `resolveRates` went on ignoring it, so
// the price would never move and nothing would say why.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'
import {
  CATALOG_ONLY_RATE_KEYS, OVERRIDABLE_RATE_KEYS, ALL_RATE_KEYS, resolveRates,
} from '../../src/lib/rate-resolution.js'
import { PRODUCT_RATE_KEYS } from '../../src/lib/base-costs.js'

// READ FROM SOURCE, comments stripped: `payload.ts` is TypeScript and the
// pure runner is plain node, so a dynamic import is a syntax error. Stripped
// because a comment naming a key would otherwise satisfy the match -
// Verification 39, and this file is exactly the shape that fault likes.
const payloadSrc = readCode(new URL('../../frontend-react/src/deal/payload.ts', import.meta.url))
const ownedBlock = payloadSrc.match(/export const COMMERCIALS_OWNED_KEYS = \[([\s\S]*?)\]/)
const OWNED = ownedBlock ? [...ownedBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : null

test('R-C2a 1: the writable allowlist was found at all', () => {
  // Or every assertion below passes over an empty list, which is
  // Verification 14 arriving as a silent skip.
  assert.ok(OWNED, 'COMMERCIALS_OWNED_KEYS is gone from payload.ts')
  assert.ok(OWNED.length > 10, `only ${OWNED.length} owned keys found; the match is wrong`)
})

test('R-C2a 2: no catalog-only rate is in the writable allowlist', () => {
  assert.ok(CATALOG_ONLY_RATE_KEYS.length > 0, 'the catalog-only list is empty')
  const crossed = CATALOG_ONLY_RATE_KEYS.filter((k) => OWNED.includes(k))
  assert.deepEqual(crossed, [],
    `these catalog rates are writable from a deal, so one deal can reprice the estate: ${crossed.join(', ')}`)
})

test('R-C2a 3: the resolver IGNORES a catalog rate carried in the payload', () => {
  // The second enforcement, and the one that makes an edit control useless
  // rather than dangerous. Driven, not read: a payload that carries the key
  // must not change the price.
  const catalog = Object.fromEntries(ALL_RATE_KEYS.map((k) => [k, 100]))
  const clean = resolveRates({}, catalog)
  const tampered = resolveRates(
    Object.fromEntries(CATALOG_ONLY_RATE_KEYS.map((k) => [k, 999])), catalog)
  for (const k of CATALOG_ONLY_RATE_KEYS) {
    assert.equal(tampered.rates[k], clean.rates[k],
      `${k} was read from the payload; the catalog boundary is gone`)
    assert.equal(tampered.rates[k], 100, `${k} should still be the catalog's 100`)
  }
  // AND THE POSITIVE CASE, or "it ignored it" is indistinguishable from a
  // resolver that ignores everything (Verification 13).
  const overridden = resolveRates(
    Object.fromEntries(OVERRIDABLE_RATE_KEYS.map((k) => [k, 999])), catalog)
  for (const k of OVERRIDABLE_RATE_KEYS) {
    assert.equal(overridden.rates[k], 999,
      `${k} is meant to be overridable per deal and was not read`)
  }
})

test('R-C2a 4: every catalog rate belongs to a product the catalog knows', () => {
  const known = new Set(Object.values(PRODUCT_RATE_KEYS).flatMap((v) => Object.values(v)))
  const orphans = CATALOG_ONLY_RATE_KEYS.filter((k) => !known.has(k))
  assert.deepEqual(orphans, [],
    `these catalog rates map to no product, so no batch or effective date can be shown: ${orphans.join(', ')}`)
})

test('R-C2a 5: the statement names the products the catalog uses', () => {
  // The drawer's basis line needs a product per line key. A list used as an
  // enumeration fails by SILENT OMISSION (Verification 19), so a product
  // renamed in the catalog turns this red rather than dropping a basis note.
  const stmt = readCode(new URL('../../frontend-react/src/deal/statement.ts', import.meta.url))
  const block = stmt.match(/export const LINE_PRODUCT[^=]*= \{([\s\S]*?)\}/)
  assert.ok(block, 'LINE_PRODUCT is gone from statement.ts, so no basis can be shown')
  const products = [...block[1].matchAll(/'([a-z_]+)'\s*,?\s*$/gm)].map((m) => m[1])
  const named = [...new Set([...block[1].matchAll(/:\s*'([a-z_]+)'/g)].map((m) => m[1]))]
  assert.ok(named.length >= 3, `only ${named.length} products named: ${named.join(', ')}`)
  const unknown = named.filter((p) => !(p in PRODUCT_RATE_KEYS))
  assert.deepEqual(unknown, [],
    `the statement names products the catalog does not have: ${unknown.join(', ')}`)
  void products
})
