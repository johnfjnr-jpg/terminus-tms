// ── FIXTURES PRODUCED BY THE SYSTEM, NOT WRITTEN DOWN ────────────────────
//
// Verification 47: a fixture shaped to the implementation tests the
// implementation. Every page object below comes out of the real
// `buildApprovalPage` in src/lib/approval-page.js, given inputs of the shape
// the application stores. Nothing here hand-writes a `moved` or a `costBasis`.
//
// The one deliberate exception is named at its own site, in shapes 3, 4 and 5,
// and it is not an exception to the rule so much as a statement of what the
// rule cannot reach: three branches are UNREACHABLE through buildApprovalPage
// on today's code. They are produced there through the system's own
// `checkReconciliation`, with the reason written beside them.
import { buildApprovalPage } from '../../../src/lib/approval-page.js'
import type { ApprovalPage } from '../approval-types'

// A catalog shaped the way the route hands one over: resolved batches, a
// missing list, an as-at date, and the rate map the resolver produces.
export const RATES = {
  ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200,
  hoSafesight: 10, hoAqm: 8, hoHemir: 12,
  inSsExisting: 100, inSsNew: 200, inAqm: 90, inHemir: 110,
}

export const BATCHES = [
  { product: 'safesight', label: 'SS batch 3', effective_from: '2026-06-01' },
  { product: 'air_quality', label: 'AQ batch 1', effective_from: '2025-02-01' },
]

export const catalog = (over: Record<string, unknown> = {}) => ({
  batches: BATCHES, missing: [], asOf: '2026-09-05', rates: RATES, ...over,
})

// A payload with every applicable field set, so a test that wants a field
// ABSENT removes it explicitly and the absence is the thing under test.
export const payload = (over: Record<string, unknown> = {}) => ({
  ssExisting: 10, ssNew: 0, aqm: 4, hemir: 0,
  duration: 24, targetMargin: 30,
  structure: 'twoPhase', recoveryMonths: 12, invoicing: 'monthly',
  installResp: 'terminus', warrantyPct: 5, whtPct: 10, gstPct: 9,
  ...over,
})

export const version = (over: Record<string, unknown> = {}) => ({
  major: 1, minor: 0, status: 'issued', revision_number: 5,
  reason: 'first price', created_by_email: 'pricer@terminus.test',
  created_at: '2026-08-01T00:00:00Z', ...over,
})

// A baseline the way the route reads one: a version row with its frozen inputs.
// CARRYING COST-BASIS KEYS is what makes a bridge comparable, so a baseline
// built WITHOUT them is the not-comparable shape rather than a broken fixture.
export const baseline = (inputs: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  inputs, major: 1, minor: 0, revision_number: 3,
  approval: { decidedAt: '2026-08-01T00:00:00Z' }, reason: 'the approved price', ...over,
})

export const record = { reference_code: 'TT-SGP-TEST-0001', name: 'Test deal', status: 'Proposal' }

// `meta` is added by the ROUTE, not by buildApprovalPage, and it is added here
// the same way: revisionNumber is the latest revision the route read. Typing
// this surfaced it - the lib's return has no meta at all, so a fixture that
// forgot it would have been a page shape the application never sends.
export function build(args: {
  payload: object
  version?: object | null
  baseline?: object | null
  testBedCost?: number
  targetChangedAt?: string | null
  catalog?: object
  record?: object
}, meta: Partial<ApprovalPage['meta']> = {}): ApprovalPage {
  const page = buildApprovalPage({
    testBedCost: 0, version: null, baseline: null, targetChangedAt: null,
    record, catalog: catalog(), ...args,
  })
  return {
    ...page,
    meta: {
      revisionNumber: 5, revisionsRead: 5,
      targetChangedAt: null, targetChangeNotFoundWithin: null, ...meta,
    },
  } as unknown as ApprovalPage
}
