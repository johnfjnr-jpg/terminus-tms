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

// ── THE BASE-COST CATALOG, IN THE SHAPE THE SERVER ACTUALLY RETURNS ──────
//
// D2d/E finding. `useCatalogRates` read `data.rates`, which the route does not
// return: GET /api/base-costs answers `{ as_of, products }` and the vanilla
// runs those products through `catalogToRates`. Every React test supplied
// `{ rates: {...} }`, so the panel passed everywhere and would have priced
// every line at $0 the moment it went live - the indistinguishable zero the
// vanilla's own comments say this round exists to remove.
//
// Verification 47: a fixture shaped to the implementation tests the
// implementation. This one is shaped the way the SERVER produces the state, so
// it goes through the same `catalogToRates` the vanilla uses.
//
// ONE definition, imported by every test, so the five copies cannot drift.
export const CATALOG_PRODUCTS = [
  {
    product: 'safesight', batch_id: 'b-ss', batch_label: '2026 H1', effective_from: '2026-01-01',
    unit_cost: 1000, hosting_cost_month: 10, install_cost_existing: 100, install_cost_new: 200,
  },
  {
    product: 'air_quality', batch_id: 'b-aq', batch_label: '2026 H1', effective_from: '2026-01-01',
    unit_cost: 800, hosting_cost_month: 8, install_cost_existing: 90, install_cost_new: null,
  },
  {
    product: 'hemir', batch_id: 'b-he', batch_label: '2026 H1', effective_from: '2026-01-01',
    unit_cost: 1200, hosting_cost_month: 12, install_cost_existing: 110, install_cost_new: null,
  },
]

export const BASE_COSTS_RESPONSE = { as_of: '2026-01-01', products: CATALOG_PRODUCTS }

/** The api() stub every deal test uses: the real response shape, nothing else. */
export const catalogApi = (products: unknown[] = CATALOG_PRODUCTS) =>
  async (_m: string, path: string) => path === '/api/base-costs'
    ? { ok: true, data: { as_of: '2026-01-01', products } }
    : { ok: false, status: 404, data: {} }

/**
 * ── ONE SHELL FIXTURE, BUILT FROM THE CONTRACT ──────────────────────────
 *
 * Round 7 Phase 2d. Nine test files each hand-built a `ShellServices` literal,
 * so adding a service to the seam broke all nine at once and the obvious fix
 * was to paste two more lines into each. Verification 47: a fixture for a shape
 * is built from what the CONTRACT declares, once, in one shared place - five
 * copies of a wrong shape agree with each other perfectly.
 *
 * Every member gets a harmless default. Override the ones a test is about.
 */
export function shellServices(
  over: Partial<import('../shell-services').ShellServices> = {},
): import('../shell-services').ShellServices {
  return {
    api: (async () => ({ ok: true, status: 200, data: null })) as
      import('../shell-services').ShellServices['api'],
    navigate: () => {},
    detailLoaded: () => {},
    getOppLoadedRevision: () => 1,
    canEditFields: () => true,
    requestChangeReason: () => {},
    currentUserEmail: () => 'test@example.com',
    currentUserId: () => 'user-1',
    takeTestBedLanding: () => null,
    setViewOwner: () => {},
    staleWriteHtml: () => null,
    usesWorkflow: () => false,
    attemptTransition: () => {},
    setContactReturnView: () => {},
    confirmDiscard: (proceed: () => void) => { proceed() },
    ...over,
  }
}
