// ── A: THE STAGE TRACK LIST ─────────────────────────────────────────────
//
// SHARED. `buildStageTrackListHtml` serves the Opportunity as well as the Test
// Bed. This is consumed by the Test Bed host now; THE OPPORTUNITY'S
// CONSUMPTION IS A FOLLOW-ON RE-POINT, recorded rather than duplicated - a
// second implementation would agree today and drift later (Verification 20).
export interface Track {
  track: string
  approved?: boolean
  /** A7: read from the RULE THE GATE READS, never inferred from a stage name. */
  scope?: string
  decided_at?: string | null
  version_label?: string | null
  reason?: string | null
}
export interface StageEntry {
  stage_name: string
  state?: string
  tracks: Track[]
}

export const UNKNOWN_STAGE = 'Unknown stage.'
export const TRACK_EMPTY = 'No approvals required for this stage.'

export interface TrackRow {
  track: string
  approved: boolean
  clickable: boolean
  role: string
  meta: string
}

const formatDate = (d: string | null | undefined) => String(d ?? '').slice(0, 10)

export function trackRow(t: Track, st: StageEntry, superseded: boolean): TrackRow {
  const versionScoped = t.scope === 'version'
  // A5: all four conditions, and a version-scoped track is never clickable -
  // its sign-off is collected against an issued major version, and offering the
  // control would send somebody to a route that cannot record what they meant.
  const clickable = !superseded && st.state === 'current' && !t.approved && !versionScoped

  const meta = versionScoped
    ? (t.approved
      // A6: "approved" without naming what was approved is the claim this
      // model exists to make precise.
      ? `${t.version_label ?? 'Version'} · approved ${formatDate(t.decided_at)} · at ${st.stage_name}`
      : (t.reason ?? `${t.version_label ?? 'The current version'} is not approved for issue yet`))
    : t.approved
      ? `Approved ${formatDate(t.decided_at)}`
      : superseded ? 'Decided on the transition request'
        : (st.state === 'current' ? 'Click to approve' : 'Not yet at this stage')

  return {
    track: t.track,
    approved: !!t.approved,
    clickable,
    role: versionScoped ? `${t.track} · Proposal/Pricing approved for issue` : t.track,
    meta,
  }
}

export type TrackList =
  | { kind: 'unknown', text: string }
  | { kind: 'empty', text: string }
  | { kind: 'rows', rows: TrackRow[] }

/**
 * A4: `recordType` IS REQUIRED AND THROWS.
 *
 * It decides whether the pre-workflow approve control may be clicked, and a
 * DEFAULT WOULD HIDE A MISSED CALL SITE - the vanilla throws by hand for
 * exactly this reason, and Verification 24 is the general form.
 */
export function stageTracks(
  st: StageEntry | undefined, recordType: string, superseded: boolean,
): TrackList {
  if (recordType === undefined) {
    throw new Error('stageTracks: recordType is required. It decides whether the '
      + 'pre-workflow approve control may be clicked, and a default would hide a '
      + 'missed call site.')
  }
  // A2 and A3 are different answers: one stage is unknown, the other is known
  // and genuinely requires nothing.
  if (!st) return { kind: 'unknown', text: UNKNOWN_STAGE }
  if (!st.tracks.length) return { kind: 'empty', text: TRACK_EMPTY }
  return { kind: 'rows', rows: st.tracks.map((t) => trackRow(t, st, superseded)) }
}
