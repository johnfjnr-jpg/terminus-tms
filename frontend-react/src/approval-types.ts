// ── THE ENDPOINT'S SHAPE, TYPED FROM THE ENDPOINT ────────────────────────
//
// Derived from GET /api/opportunities/:id/approval-page as it actually
// responds, cross-read against src/lib/approval-page.js's `buildApprovalPage`
// return and the route's `meta` block. NOT from what the components below
// happen to read: Verification 47, a fixture (or a type) shaped to the
// implementation tests the implementation.
//
// Optional-vs-null follows the lib exactly. Where the lib writes `?? null` the
// field is `| null` and is always present; where a key can be absent it is `?`.
// That distinction is the whole reason this is typed rather than `any`: a
// `null` baseline is the stated-absence shape and an absent one is a bug.

export interface ApprovalRecord {
  reference: string | null
  name: string | null
  stage: string | null
}

export interface ApprovalVersion {
  label: string | null
  status: string | null
  revisionNumber: number | null
  reason: string | null
  author: string | null
  takenAt: string | null
  // Set by the route when an approval decision exists against the version.
  approval?: { state?: string | null } | null
}

export interface Ask {
  record: ApprovalRecord
  version: ApprovalVersion | null
  contractNet: number | null
  totalCost: number | null
  achievedMargin: number
  months: number
  units: number
  sentence: string
  // ── THREE FIELDS WITH NO READER. A PHASE 2 FINDING, NOT PHASE 2 WORK ────
  //
  // These are returned by the endpoint and rendered by NOBODY: not by the
  // vanilla view being migrated, and therefore not here either. They are typed
  // so the finding is visible at the type rather than living only in a report,
  // and they are NOT rendered because the brief's twelve-point list is the
  // scope and does not name them. Build discipline 10: recorded, scoped,
  // queued.
  staleBasisWarning: string | null
  ageingBasisNote: string | null
  unpricedWarning: string | null
}

export interface BridgeChange { key: string; from: unknown; to: unknown }
export interface BridgeStep {
  label: string
  marginPoints: number
  contractNet: number
  changes: BridgeChange[]
}
export interface Reconciliation { reconciles: boolean; rounding: number; tolerance: number }
export interface Bridge {
  opening: { marginPoints: number; contractNet: number }
  closing: { marginPoints: number; contractNet: number }
  total: { marginPoints: number; contractNet: number }
  steps: BridgeStep[]
  unexplained: number
  displayRounding: number
  reconciliation: Reconciliation
  unassignedKeys: string[]
  baselineHasCostBasis: boolean
  comparable: boolean
}
export interface Baseline {
  label: string
  revisionNumber: number | null
  approvedAt: string | null
  reason: string | null
}
export interface Moved {
  baseline: Baseline | null
  order: string | null
  bridge: Bridge | null
  absence: string | null
  // Set only when a bridge exists and is not comparable. The fourth honesty
  // state; it is neither "no bridge" nor "bridge does not reconcile".
  caveat?: string | null
}

export interface LineBelowTarget { key: string; pct: number; gapPoints: number }
export interface Target {
  target: number
  provenance: { sentence: string } | null
  achieved: number
  gapPoints: number
  moved: boolean
  was: number | null
  changedAt: string | null
  movedSentence: string | null
  linesBelowTarget: LineBelowTarget[]
}

export interface Exposure {
  key: string
  label: string
  amount: number
  basis: string
  note: string
  bornByTerminus: boolean
}

export interface CostBasisProduct {
  product: string
  band?: string | null
  ageDays: number | null
  batchLabel: string | null
  effectiveFrom: string | null
  bandMeaning: string | null
}
export interface MissingDetail { product: string; inUse: boolean; units: number }
export interface CostBasis {
  asOf: string
  asOfRule: string
  products: CostBasisProduct[]
  missingDetail: MissingDetail[]
}

export interface NotRecordedRow {
  kind: string
  key: string
  value: unknown
  source: string | null
  since: string | null
  sentence: string | null
  note: string
}

export interface ApprovalMeta {
  revisionNumber: number
  revisionsRead: number
  targetChangedAt: string | null
  targetChangeNotFoundWithin: number | null
}

export interface ApprovalPage {
  ask: Ask
  moved: Moved
  target: Target
  exposures: Exposure[]
  costBasis: CostBasis
  // Returned by the endpoint and rendered by nobody, the same as the three ask
  // fields above. src/lib/approval-page.js calls this "the frozen terms, AND
  // THIS IS THEIR READER" and cites Verification 22. There is no reader.
  frozenTerms: string[]
  notRecorded: NotRecordedRow[]
  meta: ApprovalMeta
}
