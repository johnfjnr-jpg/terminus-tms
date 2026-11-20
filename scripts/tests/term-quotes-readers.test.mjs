// TERM_QUOTES: every reader that hands a version row to an engine or to
// pricingChanged, each with a term_quote row as the NEWEST row (P1), and the
// record's pricing keys (P2, P7). Pure. Written before the build, against the
// functions as they stand (tests fail first, John's SEQUENCE).
//
// The P1 hazard, named in Phase 0's census: every one of these takes "the
// newest row" with no kind filter. Correct for numbering, and wrong for any
// reader that then compares or prices that row as if it were Commercials.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pricingChanged } from '../../src/lib/version-pricing.js'
import { workingVersionOf, approvedVersionOf, wonHeadline } from '../../src/lib/opportunity-headline.js'
import { versionApprovalState } from '../../src/lib/version-approval.js'
import { issuedProposal } from '../../src/lib/transition-requests.js'
import * as PRICING_KEYS from '../../src/lib/pricing-keys.js'
import { buildApprovalPage, buildFrozenFigures, withFrozenFigures } from '../../src/lib/approval-page.js'
import { sendWriteError } from '../../src/lib/write-errors.js'
import { readCode } from '../lib/strip-comments.mjs'
import { tqParams, TQ1_INPUTS } from './fixtures/term-quote-params.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
// RED FIRST, AND VISIBLE (John's SEQUENCE: tests fail first in their own
// commit). The hook refuses a red pure suite and suite-names-resolve refuses an
// unrun test file, so the honest form is node:test's todo: every test RUNS, its
// failure prints as todo, and the engine commit deletes this marker.
const RED_FIRST = { todo: 'TERM_QUOTES red first: built in the engine commit' }

const TRACK = 'Commercial'
const COMM_INPUTS = { ssNew: 10, targetMargin: 30, duration: 36 }

// A record and its versions, built the way the system produces them: a term
// record carries pricingMethod and termQuote; a Commercials record carries
// neither (W: an absent pricingMethod reads as Commercials).
const termRecord = (termQuote = TQ1_INPUTS) => ({ pricingMethod: 'term_quote', termQuote, name: 'x' })
const commRecord = (over = {}) => ({ ...COMM_INPUTS, name: 'x', ...over })
const termVersion = (over = {}) => ({
  id: 'v-term', kind: 'term_quote', status: 'issued', major: 2, minor: 0, revision_number: 4,
  inputs: TQ1_INPUTS, rates: { params: tqParams() }, ...over,
})
const commVersion = (over = {}) => ({
  id: 'v-comm', kind: 'commercials', status: 'issued', major: 1, minor: 0, revision_number: 2,
  inputs: COMM_INPUTS, rates: { rates: { ssUnitCost: 1200 } }, ...over,
})
const approvedOn = (versionId) => ({ track: TRACK, decision: 'approved', version_id: versionId, decided_at: '2026-11-20T00:00:00Z', approver_id: 'a' })

// ── pricingChanged, across kinds (P7: "changed" whenever kinds differ) ────

test('pricingChanged: a term version against its own unchanged quote has not moved', RED_FIRST, () => {
  const m = pricingChanged(termVersion(), termRecord())
  assert.deepEqual([m.comparable, m.changed], [true, false])
})

test('pricingChanged: a term version against an edited quote has moved, and names the quote', RED_FIRST, () => {
  const m = pricingChanged(termVersion(), termRecord({ ...TQ1_INPUTS, termMonths: 60 }))
  assert.deepEqual([m.comparable, m.changed, m.keys], [true, true, ['termQuote']])
})

test('pricingChanged: a different kind is ALWAYS changed, before any key is compared', RED_FIRST, () => {
  const a = pricingChanged(commVersion(), termRecord())
  const b = pricingChanged(termVersion(), commRecord())
  for (const m of [a, b]) assert.deepEqual([m.comparable, m.changed, m.keys], [true, true, ['pricingMethod']])
})

test('pricingChanged: Commercials against Commercials is unchanged from before (a row with no kind is Commercials)', RED_FIRST, () => {
  assert.equal(pricingChanged(commVersion(), commRecord()).changed, false)
  assert.equal(pricingChanged(commVersion(), commRecord({ ssNew: 11 })).changed, true)
  const { kind, ...noKind } = commVersion()
  assert.equal(pricingChanged(noKind, commRecord()).changed, false, 'a legacy row without kind reads as Commercials')
  assert.equal(pricingChanged(noKind, termRecord()).changed, true)
})

// ── The latest-row readers, each with a term_quote row as the newest ──────

test('workingVersionOf: a term draft under its unchanged quote is not "under edit"; an edited quote is', RED_FIRST, () => {
  const draft = termVersion({ status: 'draft', major: 1, minor: 2 })
  const quiet = workingVersionOf(draft, termRecord())
  const moved = workingVersionOf(draft, termRecord({ ...TQ1_INPUTS, units: { safesight: 61 } }))
  assert.notEqual(quiet, moved, 'the label must differ between an unedited and an edited quote')
  assert.doesNotMatch(String(quiet), /edit/i)
  assert.match(String(moved), /edit/i)
})

test('versionApprovalState: an approved term version stays approved under its unchanged quote, and is superseded by a method switch', RED_FIRST, () => {
  const v = termVersion()
  assert.equal(versionApprovalState(v, [approvedOn(v.id)], 4, TRACK, termRecord()).state, 'approved')
  assert.equal(versionApprovalState(v, [approvedOn(v.id)], 5, TRACK, commRecord()).state, 'superseded')
})

test('approvedVersionOf: the newest version is a term quote, approved, and it is the approved version', RED_FIRST, () => {
  const versions = [commVersion(), termVersion()]
  const got = approvedVersionOf({ versions, approvals: [approvedOn('v-comm'), approvedOn('v-term')], latestRevision: 4, tracks: [TRACK], payload: termRecord() })
  assert.equal(got?.id, 'v-term')
})

test('issuedProposal: a submitted term version whose quote is unchanged lets the transition proceed', RED_FIRST, () => {
  const r = issuedProposal([commVersion(), termVersion()], termRecord(), 'Proposal')
  assert.equal(r.ok, true, r.reason)
})

test('issuedProposal: the newest submitted version is a term quote and the record switched back to Commercials: refused as moved', RED_FIRST, () => {
  const r = issuedProposal([commVersion(), termVersion()], commRecord(), 'Proposal')
  assert.equal(r.ok, false)
})

// ── The won headline and the approval page, for a term version ───────────

test('wonHeadline: a won term version reads its own frozen Base TCV (TQ-3, at Closed Won)', RED_FIRST, () => {
  const v = termVersion()
  const frozen = buildFrozenFigures({ payload: termRecord(), version: v, record: { status: 'Proposal' }, termParams: tqParams() }, 'engine-x')
  const head = wonHeadline({ status: 'Closed Won', wonVersion: { ...v, frozen_figures: frozen }, liveTcv: 1 })
  assert.equal(head.tcv, 3414000)
  assert.equal(head.source, 'won-version')
})

test('approval page, term version: the ask is Base TCV and margin, priced on the version\'s own settings', RED_FIRST, () => {
  const page = buildApprovalPage({ payload: termRecord(), version: termVersion(), record: {}, termParams: tqParams('510.00') })
  assert.equal(page.ask.kind, 'term_quote')
  assert.equal(page.ask.baseTcv, 3414000, 'an issued term version prices on its stored settings, not today\'s (TQ-3)')
  assert.equal(page.ask.monthly, 28450)
  assert.equal(page.ask.margin, '43.8')
})

test('approval page, term version: the R-TQ3 signals sit in the ask, in the screen\'s words', RED_FIRST, () => {
  const discounted = termVersion({ inputs: { ...TQ1_INPUTS, dealAdjustment: { discountPct: '7.5' } } })
  const p = buildApprovalPage({ payload: termRecord(discounted.inputs), version: discounted, record: {}, termParams: tqParams() })
  assert.match(p.ask.signals.dealDiscount ?? '', /^Approval signal: 7\.5% below list$/)
  assert.equal(p.ask.signals.belowFloor, null, '43.8% is above the 25% floor')
  const plain = buildApprovalPage({ payload: termRecord(), version: termVersion(), record: {}, termParams: tqParams() })
  assert.equal(plain.ask.signals.dealDiscount, null)
})

test('approval page: a method change shows no bridge, both figures, and the ruled sentence (0-7)', RED_FIRST, () => {
  const baseline = { ...commVersion(), approval: { decidedAt: '2026-11-19T00:00:00Z' } }
  const p = buildApprovalPage({ payload: termRecord(), version: termVersion(), baseline, record: {}, termParams: tqParams() })
  assert.equal(p.moved.bridge, null)
  assert.equal(p.moved.methodChanged?.sentence, 'Pricing method changed: the previous approval does not carry over.')
  assert.equal(p.moved.methodChanged.underReview.figure, 3414000)
  assert.equal(p.moved.methodChanged.underReview.method, 'Term quote')
  assert.equal(p.moved.methodChanged.lastApproved.method, 'Commercials')
  assert.ok('figure' in p.moved.methodChanged.lastApproved)
})

test('withFrozenFigures, term version: the stored Base TCV stands and today\'s differing figure is carried beside it', RED_FIRST, () => {
  const v = termVersion()
  const frozen = buildFrozenFigures({ payload: termRecord(), version: v, record: {}, termParams: tqParams() }, 'engine-x')
  // Today's page for the same version, with the stored settings tampered, so
  // "today" genuinely prices differently and the overlay has something to say.
  const today = buildApprovalPage({ payload: termRecord(), version: { ...v, rates: { params: tqParams('510.00') } }, record: {}, termParams: tqParams('510.00') })
  const shown = withFrozenFigures(today, { ...v, frozen_figures: frozen })
  assert.equal(shown.ask.baseTcv, 3414000)
  assert.equal(shown.frozen.today['ask.baseTcv'], 3482280)
})

// ── The record's pricing keys (P2, P7) ───────────────────────────────────

test('COMMERCIALS_OWNED_KEYS is renamed PRICING_OWNED_KEYS, and carries termQuote and pricingMethod', RED_FIRST, () => {
  assert.ok(!('COMMERCIALS_OWNED_KEYS' in PRICING_KEYS), 'the old name is gone, not aliased')
  const keys = PRICING_KEYS.PRICING_OWNED_KEYS
  assert.ok(Array.isArray(keys) && keys.includes('termQuote') && keys.includes('pricingMethod'))
  assert.ok(keys.includes('ssNew'), 'and still every Commercials key')
})

test('Closed Won refuses a change to termQuote or pricingMethod, and nothing else new', RED_FIRST, () => {
  const won = 'Closed Won'
  const was = termRecord()
  assert.equal(PRICING_KEYS.closedWonPricingRefusal(won, was, { termQuote: { ...TQ1_INPUTS, termMonths: 60 } }), PRICING_KEYS.CLOSED_WON_PRICING_REFUSAL)
  assert.equal(PRICING_KEYS.closedWonPricingRefusal(won, was, { pricingMethod: 'commercials' }), PRICING_KEYS.CLOSED_WON_PRICING_REFUSAL)
  assert.equal(PRICING_KEYS.closedWonPricingRefusal(won, was, { termQuote: TQ1_INPUTS }), null, 'resent unchanged is not an edit')
  assert.equal(PRICING_KEYS.closedWonPricingRefusal('Proposal', was, { pricingMethod: 'commercials' }), null)
})

test('the PATCH allowlist carries termQuote and pricingMethod', RED_FIRST, () => {
  const src = readCode(`${ROOT}src/routes/opportunities.js`)
  const set = src.match(/const SALESPERSON_WRITABLE_KEYS = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(set, 'the allowlist literal was not found, so this test measures nothing')
  for (const k of ['termQuote', 'pricingMethod']) assert.match(set[1], new RegExp(`'${k}'`), `${k} is not writable`)
})

// ── The 409 mapping (P7) ─────────────────────────────────────────────────

test('PT423 from the database is a 409 in the Closed Won wording', RED_FIRST, () => {
  const sent = {}
  const reply = { code(c) { sent.code = c; return this }, send(b) { sent.body = b; return this } }
  sendWriteError(reply, { code: 'PT423', message: 'anything the database said' })
  assert.equal(sent.code, 409)
  assert.equal(sent.body?.error, PRICING_KEYS.CLOSED_WON_PRICING_REFUSAL)
  assert.ok(!sent.body?.stale, 'not the stale-reload answer PT409 gives')
})

// ── The class, not the instances: every version read that carries inputs
//    also carries kind (build discipline 8). A reader handed inputs without
//    kind cannot branch, so it silently reads every row as Commercials. ────

test('every deal_sheet_versions select that reads inputs also reads kind', RED_FIRST, () => {
  const files = ['src/lib/opportunity-headline.js', 'src/routes/deal-sheet-versions.js', 'src/routes/opportunities.js',
    'src/routes/transitions.js', 'src/routes/transition-requests.js']
  const bad = []
  let seen = 0
  for (const f of files) {
    const src = readCode(`${ROOT}${f}`)
    for (const m of src.matchAll(/from\('deal_sheet_versions'\)\s*\.select\('([^']*)'\)/g)) {
      const cols = m[1].split(',').map((c) => c.trim())
      if (cols.includes('*')) continue
      if (cols.includes('inputs')) { seen++; if (!cols.includes('kind')) bad.push(`${f}: ${m[1]}`) }
    }
  }
  assert.ok(seen >= 6, `only ${seen} version reads carrying inputs were found, so the scan is not seeing them`)
  assert.deepEqual(bad, [])
})

test('both creation routes stamp the pricing method at creation (R-TQ1)', RED_FIRST, () => {
  for (const f of ['src/routes/contacts.js', 'src/routes/test-beds.js']) {
    const src = readCode(`${ROOT}${f}`)
    const call = src.match(/rpc\('(?:create_opportunity_from_contact|convert_test_bed)'[\s\S]*?p_payload: \{([\s\S]*?)\n {6}\}/)
    assert.ok(call, `${f}: the creation call was not found`)
    assert.match(call[1], /pricingMethod/, `${f}: the new opportunity's payload carries no pricingMethod`)
  }
})
