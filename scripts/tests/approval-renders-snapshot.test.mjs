// ── R-C4: THE APPROVAL PAGE RENDERS THE VERSION, NOT THE RECORD ──────────
//
// John's finding, 2026-09-25: on TT-SGP-MANUFI-004 every money figure read
// ZERO while Units 26 and Term 60 populated.
//
// PHASE 0 MEASURED THE ORIGIN, and it is one dropped key. The route builds
//
//     catalog: { batches: catalog.batches, missing: catalog.missing, asOf: catalog.asOf }
//
// and `buildApprovalPage` opens with `resolveRates(payload, catalog.rates ?? {})`.
// `currentRates` returns `rates` and the object literal does not carry it, so
// the derivation runs against an EMPTY rate table. Unit costs are catalog
// values and are deliberately NOT stored on a deal (R-C2a), so every hardware
// and hosting figure collapses to zero while the counts, which live on the
// record, survive. Measured live: the page's zeros reproduce exactly when the
// same derivation is run with `{}`.
//
// NO UNIT TEST COULD HAVE CAUGHT IT. The fixture below carries `rates` inside
// its catalog - added by an earlier round whose comment records the page
// pricing a deal at -6% margin unnoticed - so the tests fed the page something
// the route never sends. Verification 47 exactly: a fixture shaped by the
// reader rather than by the route.
//
// THE RULING: the page reports the VERSION. Its figures come from the single
// derivation run over the FROZEN snapshot, its inputs AND its frozen rates,
// never the live catalog.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApprovalPage } from '../../src/lib/approval-page.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'

const RATES = {
  ssUnitCost: 1200, aqUnitCost: 800, hemirUnitCost: 100000,
  hoSafesight: 200, hoAqm: 100, hoHemir: 500,
  inSsExisting: 2000, inSsNew: 20000, inAqm: 500, inHemir: 5000,
}
// The frozen table a version carries, which is `frozenRates()`'s shape: the
// rate map sits UNDER `rates`, beside the batches and the terms.
const FROZEN = { as_of: '2026-09-01', rates: { ...RATES, ssUnitCost: 8000 }, terms: {}, batches: {}, missing: [] }

const RECORD_PAYLOAD = {
  ssExisting: 10, ssNew: 10, aqm: 4, hemir: 2, duration: 60,
  targetMargin: 30, warrantyPct: 2, whtPct: 15, grossUp: true,
  installResp: 'Terminus Contractor - Per Unit',
}
// The snapshot differs from the record on purpose, so "it priced the version"
// and "it priced the record" cannot both be true of one number.
const SNAPSHOT = { ...RECORD_PAYLOAD, ssExisting: 20, aqm: 1 }
const CATALOG = { batches: {}, missing: [], asOf: '2026-09-25', rates: RATES }
const VERSION = {
  major: 1, minor: 0, status: 'issued', revision_number: 22,
  reason: 'test reason 2', created_by_email: 'a@b.invalid', created_at: '2026-09-24T00:00:00Z',
  inputs: SNAPSHOT, rates: FROZEN,
}
const priced = (p, r) => calculateDeal(buildDealInputs(p, { rates: resolveRates(p, r).rates, testBedCost: 0 }))
const page = (over = {}) => buildApprovalPage({
  payload: RECORD_PAYLOAD, testBedCost: 0, version: VERSION, catalog: CATALOG,
  record: { reference_code: 'TT-SG-001' }, ...over,
})

test('R1: the headline figures are the SNAPSHOT priced at its FROZEN rates', () => {
  const want = priced(SNAPSHOT, FROZEN.rates)
  const p = page()
  assert.equal(p.ask.contractNet, want.totals.contractNet)
  assert.equal(p.ask.totalCost, want.totalDealCostAll)
  assert.equal(p.ask.achievedMargin, want.achievedMargin)
  // Non-zero, or this passes on the very defect it is about.
  assert.ok(want.totals.contractNet > 0, 'the fixture must price above zero to be evidence')
})

test('R2: and NOT the record priced at the live catalog', () => {
  const recordFigures = priced(RECORD_PAYLOAD, RATES)
  const p = page()
  assert.notEqual(p.ask.contractNet, recordFigures.totals.contractNet,
    'the page is reporting the record, so a version and the deal it froze are indistinguishable')
})

test('R3: the LIVE catalog cannot move a frozen figure', () => {
  // The calibration the ruling names: a version is priced at what it was
  // priced at, whatever the catalog does afterwards.
  const before = page().ask.contractNet
  const after = page({ catalog: { ...CATALOG, rates: { ...RATES, ssUnitCost: 999999 } } }).ask.contractNet
  assert.equal(after, before, 'a catalog change reached a frozen version')
})

test('R4: an EMPTY live catalog leaves the frozen figures standing', () => {
  // The defect's own condition. With the route dropping `rates`, this is
  // exactly what the page receives, and the frozen snapshot must carry it.
  const p = page({ catalog: { batches: {}, missing: [], asOf: '2026-09-25' } })
  assert.ok(p.ask.contractNet > 0, 'an absent catalog zeroed a version that carries its own rates')
  assert.equal(p.ask.contractNet, priced(SNAPSHOT, FROZEN.rates).totals.contractNet)
})

test('R5: a snapshot genuinely priced at zero still says zero', () => {
  // The other direction. The page reports the version, so a version with
  // nothing in it is reported as nothing rather than quietly substituted.
  const p = page({ version: { ...VERSION, inputs: {}, rates: { rates: {} } } })
  assert.equal(p.ask.contractNet, 0)
  assert.equal(p.ask.totalCost, 0)
})

test('R6: with NO version the page prices the record, and the catalog reaches it', () => {
  // The route's own bug at unit level: before this round the catalog's rates
  // never arrived, so even this path priced against an empty table.
  const p = page({ version: null })
  assert.equal(p.ask.contractNet, priced(RECORD_PAYLOAD, RATES).totals.contractNet)
  assert.ok(p.ask.contractNet > 0)
})

test('R7: the ask SENTENCE quotes the same figures it displays', () => {
  const p = page()
  const grouped = Math.round(p.ask.contractNet).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  assert.ok(p.ask.sentence.includes(`$${grouped}`),
    `the sentence and the row disagree: "${p.ask.sentence}" against ${p.ask.contractNet}`)
  assert.ok(p.ask.sentence.includes(`${p.ask.achievedMargin.toFixed(1)}%`))
})

test('R8: the exposures and the target read the SAME priced thing as the ask', () => {
  // Verification 20 inside one page: WHT is a percentage OF the contract, so an
  // exposure computed from the record beside a headline computed from the
  // snapshot is two readers of one deal.
  const p = page()
  const wht = p.exposures.find((e) => e.key === 'wht')
  const want = priced(SNAPSHOT, FROZEN.rates)
  assert.ok(wht, 'no withholding exposure')
  assert.equal(p.target.achieved, want.achievedMargin)
})

test('R9: for a version taken from the CURRENT state, the page equals the deal sheet', () => {
  // THE EQUALITY GUARD THE RULING NAMES. A version taken right now freezes what
  // the sheet is showing, so the two surfaces must agree figure by figure. They
  // are the same derivation; this is what stops the page becoming a second
  // pricing reader again.
  const takenNow = { ...VERSION, inputs: RECORD_PAYLOAD, rates: { rates: RATES } }
  const sheet = priced(RECORD_PAYLOAD, RATES)
  const p = page({ version: takenNow })
  assert.equal(p.ask.contractNet, sheet.totals.contractNet, 'contract net')
  assert.equal(p.ask.totalCost, sheet.totalDealCostAll, 'total cost')
  assert.equal(p.ask.achievedMargin, sheet.achievedMargin, 'achieved margin')
  assert.equal(p.ask.units, sheet.hardware.totalUnits, 'units')
  assert.ok(sheet.totals.contractNet > 0, 'the fixture must price above zero to be evidence')
})

test('R10: and the version it names is the one it priced', () => {
  // A page that priced one version while labelling another would satisfy every
  // figure assertion above.
  const p = page()
  assert.equal(p.ask.version.label, 'V1')
  assert.equal(p.ask.version.revisionNumber, 22)
  assert.equal(p.ask.version.reason, 'test reason 2')
})
