// ── THE APPROVAL-LINE FIXTURE BUILDER ────────────────────────────────────
//
// Round 4 Phase 1, item 3. SIX of the ten version states cannot be produced by
// a walk, and Phase 0 measured why: a pricing approval needs decisions on the
// required tracks, and `decide_transition_request` reads `auth.uid()` and
// refuses the requester approving their own request (migration
// 20260831000004). One account cannot reach approved, and every state built on
// approved inherits that.
//
// ONE BUILDER FOR ALL SIX, because they are one family: they differ only in the
// approval object hanging off a version, and building them six ways would be
// six chances to build one wrongly.
//
// The four WALKABLE states - draft, issued, restored-from and none - are
// deliberately NOT built here. They get walk coverage in Phase 2 and 3, and a
// fixture that duplicated them would be a second definition of a thing the walk
// already proves.
import type { DealVersion, ApprovalState, PendingApproval } from '../versions/model'

let seq = 0
/** Deterministic ids: a test that names a row must be able to name it again. */
const nextId = () => `ver-${++seq}`
export const resetVersionIds = () => { seq = 0 }

export interface VersionSpec {
  major?: number
  minor?: number
  status?: 'draft' | 'issued'
  reason?: string
  sections?: string[]
  /** Absent means no approval object at all, which is not the same as 'none'. */
  approval?: ApprovalState
  revisionApproved?: number
  changedKeys?: string[]
  author?: string
  at?: string
}

/**
 * A version in any state, including the six a walk cannot reach.
 *
 * NON-ZERO BY DEFAULT: every field a behaviour reads is given a distinct,
 * non-empty value, so a render that drops one or reads its neighbour fails
 * rather than passing on a shared blank.
 */
export function aVersion(spec: VersionSpec = {}): DealVersion {
  const major = spec.major ?? 0
  const minor = spec.minor ?? 1
  const status = spec.status ?? 'draft'
  const at = spec.at ?? '2026-03-04T09:30:00.000Z'
  const author = spec.author ?? (status === 'issued' ? 'issuer@example.invalid' : 'author@example.invalid')
  return {
    id: nextId(),
    major,
    minor,
    status,
    reason: spec.reason ?? `reason for V${major}.${minor}`,
    sections: spec.sections ?? ['Units Required', 'Payment Terms'],
    created_at: at,
    issued_at: status === 'issued' ? at : null,
    created_by_email: status === 'issued' ? 'author@example.invalid' : author,
    issued_by_email: status === 'issued' ? author : null,
    approval: spec.approval === undefined ? undefined : {
      state: spec.approval,
      // A revision number that is NOT the default anything else uses, so a
      // line reading the wrong field cannot match by luck.
      revisionApproved: spec.revisionApproved ?? 37,
      changedKeys: spec.changedKeys ?? ['targetMargin', 'duration'],
      decidedAt: '2026-03-05T11:00:00.000Z',
    },
  }
}

/** The six a walk cannot produce, each named with why. */
export const FIXTURE_ONLY_STATES: { state: ApprovalState, why: string }[] = [
  { state: 'approved', why: 'needs a decision from somebody who is not the requester' },
  { state: 'rejected', why: 'same rule, opposite decision' },
  { state: 'superseded', why: 'approved, then the pricing moved: it inherits approved\'s blocker' },
  { state: 'unknown', why: 'an approved version whose comparison is not comparable' },
  { state: 'unapprovable', why: 'taken before versions recorded their revision; no live path makes one' },
  { state: 'inconsistent', why: 'documented in the evaluator as unreachable by construction' },
]

/** One version in each of the six, for the state-rendering tests. */
export function allFixtureOnlyVersions(): DealVersion[] {
  return FIXTURE_ONLY_STATES.map((s, i) =>
    aVersion({ major: i + 1, minor: 0, status: 'issued', approval: s.state }))
}

export function aPendingApproval(over: Partial<PendingApproval> = {}): PendingApproval {
  return {
    label: 'V1',
    frozen_version_id: 'ver-1',
    requested_at: '2026-03-06T14:15:00.000Z',
    required: ['Commercial', 'Technical', 'Legal'],
    decisions: [{ track: 'Commercial', decision: 'approved' }],
    ...over,
  }
}
