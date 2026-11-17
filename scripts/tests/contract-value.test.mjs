// CONTRACT_VALUE: one unpriced test for every contract value (ruling 2), and
// the rider: every pricing key carries a label. Pure: no database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contractValueOf, UNPRICED } from '../../src/lib/contract-value.js'
import { totalContractValue, wonHeadline } from '../../src/lib/opportunity-headline.js'
import { COMMERCIALS_OWNED_KEYS } from '../../src/lib/pricing-keys.js'
import { PRICING_KEY_LABELS, pricingKeyLabel, UNLABELLED_PRICING_FIELD } from '../../src/lib/version-pricing.js'
import { readCode } from '../lib/strip-comments.mjs'

const RATES = { hoAqm: 100, inAqm: 500, hoHemir: 500, inHemir: 5000, inSsNew: 20000, aqUnitCost: 2000,
  ssUnitCost: 8000, hoSafesight: 200, inSsExisting: 2000, hemirUnitCost: 100000 }

test('the definition: zero and non-numbers are unpriced; anything else is the value', () => {
  assert.equal(contractValueOf(0), null)
  assert.equal(contractValueOf(NaN), null)
  assert.equal(contractValueOf(undefined), null)
  assert.equal(contractValueOf(null), null)
  assert.equal(contractValueOf(227138), 227138)
  assert.equal(contractValueOf(-5), -5, 'a negative net is a priced deal, not an absence')
  assert.equal(UNPRICED, '--')
})

test('the headline reads unpriced through it: an empty payload is null, a priced one is its value', () => {
  assert.equal(totalContractValue({ duration: 36, targetMargin: 30 }, RATES, 0), null)
  const v = totalContractValue({ ssNew: 10, duration: 36, targetMargin: 30 }, RATES, 0)
  assert.ok(Number.isFinite(v) && v > 0)
})

test('the won headline reads unpriced through it too', () => {
  const v = { major: 1, minor: 0, status: 'issued', frozen_figures: { result: { totals: { contractNet: 0 } } } }
  assert.equal(wonHeadline({ status: 'Closed Won', wonVersion: v, liveTcv: 5 }).tcv, null)
})

test('ONE definition: every surface that decides "unpriced" imports it, and none restates it', () => {
  const sites = ['src/lib/opportunity-headline.js', 'frontend-react/src/deal/panelParts.tsx', 'frontend-react/src/deal/statement.ts']
  for (const f of sites) {
    const code = readCode(new URL(`../../${f}`, import.meta.url))
    assert.match(code, /contract-value\.js'/, `${f} does not import the shared definition`)
    assert.match(code, /contractValueOf\(/, `${f} does not call it`)
  }
  // THE EFFECT, NOT A SPELLING (Verification 37). The first version forbade the
  // two old spellings (`net === 0`, `!== 0 ? n : null`) and the calibration's
  // restatement, written a third way, passed it. So: no site compares anything
  // with zero except a collection's `.length`. Calibrated: the restatement fires.
  for (const f of sites) {
    const zeroTests = readCode(new URL(`../../${f}`, import.meta.url)).split('\n')
      .filter((l) => /[!=]==?\s*0\b(?!\.)/.test(l) && !/\.length\s*[!=]==?\s*0\b/.test(l))
    assert.deepEqual(zeroTests.map((l) => l.trim()), [], `${f} tests a value against zero itself instead of calling contractValueOf`)
  }
})

test('RIDER: every pricing key in pricing-keys.js has a label, so none reads as "an unlabelled pricing field"', () => {
  assert.ok(COMMERCIALS_OWNED_KEYS.length >= 32, `the list itself is short: ${COMMERCIALS_OWNED_KEYS.length}`)
  const missing = COMMERCIALS_OWNED_KEYS.filter((k) => !(k in PRICING_KEY_LABELS))
  assert.deepEqual(missing, [], `pricing keys with no label: ${missing.join(', ')}`)
  for (const k of COMMERCIALS_OWNED_KEYS) assert.notEqual(pricingKeyLabel(k), UNLABELLED_PRICING_FIELD, k)
})

test('RIDER: the six this round named, by key (a label for a key that is not pricing would be a second list)', () => {
  for (const k of ['paymentMode', 'priceOverrides', 'hostingPriceMode', 'hostingUnitFees', 'opexUnitFees', 'opexUnitMargins']) {
    assert.ok(typeof PRICING_KEY_LABELS[k] === 'string' && PRICING_KEY_LABELS[k].length > 3, k)
  }
  const stray = Object.keys(PRICING_KEY_LABELS).filter((k) => !COMMERCIALS_OWNED_KEYS.includes(k))
  assert.deepEqual(stray, [], `labels for keys that are not pricing keys: ${stray.join(', ')}`)
})
