// ── THE VERSION CARD'S LOGIC, SEPARATE FROM ITS RENDER ───────────────────
//
// Round 4 Phase 1. Every function here answers one of the behaviours Phase 0
// enumerated from `renderVersionList`, so the tests can be derived from the
// enumeration rather than from the code that implements it.
//
// The wordings that are SHARED with the server or with another surface come
// from src/lib and are never restated: `reasonPromptFor` and `namedChangedKeys`
// are imported, not copied.
import { reasonPromptFor } from '../../../src/lib/version-reason.js'
import { namedChangedKeys } from '../../../src/lib/version-pricing.js'

export type VersionStatus = 'draft' | 'issued'
export type ApprovalState =
  | 'approved' | 'superseded' | 'unknown' | 'rejected' | 'none' | 'unapprovable' | 'inconsistent'

export interface VersionApproval {
  state?: ApprovalState
  revisionApproved?: number | null
  changedKeys?: string[]
  decidedAt?: string | null
}

export interface DealVersion {
  id: string
  major: number
  minor: number
  status: VersionStatus
  reason: string
  sections?: string[]
  created_at?: string
  issued_at?: string | null
  created_by_email?: string | null
  issued_by_email?: string | null
  approval?: VersionApproval
}

export interface PendingApproval {
  label?: string
  frozen_version_id?: string
  requested_at?: string | null
  required?: string[]
  decisions?: { track: string, decision: string }[]
}

/** W2's label. V0.n keeps its minor; a whole major drops it. */
export function versionLabel(v: Pick<DealVersion, 'major' | 'minor'>): string {
  if (v.major === 0) return `V0.${v.minor}`
  return v.minor === 0 ? `V${v.major}` : `V${v.major}.${v.minor}`
}

// ── R1 to R7: the range toggle and its note ──────────────────────────────
export const RANGE_FLOOR = 5

export interface RangeView {
  /** R1: nothing to range over at or below the floor. */
  toggleHidden: boolean
  /** R3: `all`, or the FIRST n of a newest-first list. */
  shown: DealVersion[]
  /** R4/R5/R6: empty means hidden. */
  note: string
  noteHidden: boolean
}

export function rangeView(all: DealVersion[], range: number | 'all'): RangeView {
  const total = all.length
  const shown = range === 'all' ? all : all.slice(0, Number(range))
  const hidden = total - shown.length
  // R4 pluralises on the HIDDEN count, not the total: "1 older version is",
  // "3 older versions are".
  const note = hidden > 0
    ? `Showing ${shown.length} of ${total} versions. ${hidden} older `
      + `${hidden === 1 ? 'version is' : 'versions are'} not listed.`
    // R5: the all-shown note appears only ABOVE the floor. At or below it there
    // is no toggle, so a note about ranging would describe a control nobody has.
    : (total > RANGE_FLOOR ? `Showing all ${total} versions.` : '')
  return { toggleHidden: total <= RANGE_FLOOR, shown, note, noteHidden: !note }
}

// ── W3/W4: who and when ──────────────────────────────────────────────────
export function versionAuthor(v: DealVersion): string {
  return (v.status === 'issued' ? v.issued_by_email : v.created_by_email) || 'unknown author'
}

export function versionWhen(v: DealVersion): string {
  return new Date(v.issued_at ?? v.created_at ?? '').toISOString().slice(0, 16).replace('T', ' ')
}

/** T4's formatter. A missing date says so rather than rendering `Invalid Date`. */
export function formatDealDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'an unknown time'
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}, `
    + `${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

// ── The approval line, all seven states ──────────────────────────────────
export function approvalLine(v: DealVersion): string {
  const a = v.approval ?? {}
  const at = a.revisionApproved
  switch (a.state) {
    case 'approved':
      return `Approved at revision ${at}, and the pricing has not changed since.`
    case 'superseded':
      return `SUPERSEDED. Approved at revision ${at}, and the pricing has changed since: `
        + `${namedChangedKeys(a.changedKeys ?? [])}. `
        + 'Take a new version and have it approved.'
    case 'unknown':
      return `Approved at revision ${at}, but whether the pricing has moved since could `
        + 'not be determined. Report this rather than reading it as approved.'
    case 'rejected':
      return `Rejected at revision ${at}.`
    case 'none':
      return 'Not yet approved.'
    case 'unapprovable':
      return 'Taken before versions recorded their revision, so it cannot be approved.'
    case 'inconsistent':
      return `Names revision ${at}, which this record has not reached. Report this.`
    default:
      return ''
  }
}

// ── T1 to T4: the track line ─────────────────────────────────────────────
export function trackLine(v: DealVersion, pending: PendingApproval | null): string {
  // T1: only the version the OPEN request froze. Every other row gets nothing,
  // because the tracks describe that request and not this version.
  if (!pending || pending.frozen_version_id !== v.id) return ''
  const decided = new Map((pending.decisions ?? []).map((d) => [d.track, d]))
  const parts = (pending.required ?? []).map((t) => {
    const d = decided.get(t)
    // T2: a rejection is SHOUTED and the other two are not.
    const state = d ? (d.decision === 'approved' ? 'approved' : 'REJECTED') : 'waiting'
    return `${t} ${state}`
  })
  // T3: no required tracks renders nothing at all, rather than a bare prefix.
  if (!parts.length) return ''
  return `Under approval since ${formatDealDateTime(pending.requested_at)} · ${parts.join(' · ')}`
}

// ── I1 to I5: the issue control ──────────────────────────────────────────
export interface IssueView {
  target: DealVersion | null
  disabled: boolean
  label: string
  title: string
  nextMajor: number
  highestIssued: number
}

export function issueView(all: DealVersion[]): IssueView {
  const issued = all.find((v) => v.status === 'issued') ?? null
  const highestIssued = issued?.major ?? 0
  // I1: THE NEWEST DRAFT, not the latest. A stranded draft is still the latest
  // once every newer one has been issued, and issuing it would offer
  // "Issue V2.1 as V6" on a record whose pricing is nowhere near V2.1.
  const target = all.find((v) => v.status === 'draft' && v.major === highestIssued) ?? null
  const nextMajor = highestIssued + 1
  return {
    target,
    disabled: !target,
    label: target ? `Issue ${versionLabel(target)} as V${nextMajor}` : 'Save a new version to issue',
    title: target
      ? `Issues ${versionLabel(target)} as V${nextMajor}. Earlier drafts can be restored, not issued.`
      : issued
        ? `V${highestIssued} is issued and there is no newer draft. Save the current pricing as a version, `
          + 'then issue it. Saving the record alone does not create a version.'
        : 'Save a version first. Saving the record alone does not create one.',
    nextMajor,
    highestIssued,
  }
}

// ── The pricing-approval control ─────────────────────────────────────────
export interface AskView {
  hidden: boolean
  disabled: boolean
  label: string
  title: string
  state: string
  /** The version an ask would be against, or null when asking is not offered. */
  askFor: DealVersion | null
}

export function askView(
  all: DealVersion[], pending: PendingApproval | null, gateApplies: boolean,
): AskView {
  const { target: draft, highestIssued } = issueView(all)
  const issued = all.find((v) => v.status === 'issued') ?? null
  const base = { hidden: !gateApplies, label: `Request approval of V${highestIssued}`, askFor: null }
  if (!gateApplies) return { ...base, disabled: true, title: '', state: '' }
  if (pending) {
    return { ...base, disabled: true,
      title: 'A pricing approval is already open on this Opportunity.',
      state: `${pending.label ?? 'A version'} is awaiting approval.` }
  }
  if (!issued) {
    return { ...base, disabled: true,
      title: 'Issue a major version first: an approval is held against an issued version.',
      state: 'Issue a version before requesting approval.' }
  }
  if (issued.approval?.state === 'approved') {
    return { ...base, disabled: true,
      title: `V${highestIssued} is already approved. Issue a new major version if the price has changed.`,
      state: `V${highestIssued} is already approved.` }
  }
  if (draft) {
    return { ...base, disabled: true,
      title: `${versionLabel(draft)} is a draft newer than V${highestIssued}. `
        + 'Issue it, then ask for approval of the version people will be looking at.',
      state: `${versionLabel(draft)} is a draft. Issue it before requesting approval, `
        + `or the approval would be of V${highestIssued} and not of the price on screen.` }
  }
  return { ...base, disabled: false, askFor: issued,
    title: `Ask Commercial, Technical and Legal to approve V${highestIssued} for issue.`,
    state: '' }
}

// ── N1/N2: the reason box, through the shared prompt ─────────────────────
export interface ReasonPrompt { label: string, placeholder: string, refusal: string }
export function reasonPrompt(versionCount: number): ReasonPrompt {
  return reasonPromptFor(versionCount) as ReasonPrompt
}

// ── E1: the empty state names the act AND what it produces ───────────────
export const EMPTY_STATE = 'No versions saved yet. V0.1 is the first.'
