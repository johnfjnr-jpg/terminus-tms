// ── C: THE SCORING CAPABILITY ───────────────────────────────────────────
//
// Round 7 Phase 1b, from the C enumeration. The reason rules live in
// scoreReason.ts; this is the state around them.
import { reasonRequired, type Level, type ScoreEntry } from './scoreReason'

export interface Criterion {
  criterion_key: string
  name?: string
  levels?: Level[]
}

/** C1: levels come from the criterion, and a criterion without them scores nothing. */
export function levelsFor(crit: Criterion | undefined): Level[] {
  return Array.isArray(crit?.levels) ? crit.levels : []
}

/**
 * C5: THE SAVE IS BLOCKED, not the score.
 *
 * Returns the first criterion key still awaiting a reason, so the surface can
 * refuse the whole Save and focus that box - the requirement is enforced at
 * ENTRY rather than asked again at save time, which would ask the same question
 * twice for one field.
 */
export function awaitingReason(
  drafts: Record<string, string>,
  reasons: Record<string, string>,
  criteria: readonly Criterion[],
  seriesFor: (key: string) => readonly ScoreEntry[],
): string | null {
  for (const key of Object.keys(drafts)) {
    const crit = criteria.find((c) => c.criterion_key === key)
    if (!crit) continue
    const score = Number(drafts[key])
    if (!reasonRequired(score, levelsFor(crit), seriesFor(key))) continue
    if (!String(reasons[key] ?? '').trim()) return key
  }
  return null
}

/**
 * C6: entry is LOCKED once a score is recorded in this session.
 *
 * The lock is what makes C5's "by the time Save runs, a revision cannot be
 * dirty without a reason" true: it refuses further scoring rather than
 * accumulating drafts behind an unmet requirement.
 */
export function entryLocked(recorded: ReadonlySet<string>, key: string): boolean {
  return recorded.has(key)
}

/**
 * C7: anchors and history are DISCLOSURE, not state.
 *
 * Opening one changes nothing about the record and survives no reload. Modelled
 * as a set of open keys so the surface cannot accidentally persist it.
 */
export function toggle(open: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(open)
  if (next.has(key)) next.delete(key); else next.add(key)
  return next
}

/**
 * C8: measurability is a SECOND WRITE beside the score, on its own route.
 *
 * Named here so a migration cannot fold it into the score body: the server has
 * two endpoints and they mean different things.
 */
export const SCORE_ROUTE = (id: string) => `/api/test-beds/${id}/scores`
export const MEASURABILITY_ROUTE = (id: string) => `/api/test-beds/${id}/measurability`

/**
 * C9: the summary and the detail are TWO RENDERERS OVER ONE SERIES.
 *
 * Verification 20 says a second reader drifts, so the series is reduced once
 * here and both renderers take the result rather than each reducing it.
 */
export interface ScoreSummary { latest: ScoreEntry | null, count: number }

export function summarise(series: readonly ScoreEntry[]): ScoreSummary {
  return { latest: series[0] ?? null, count: series.length }
}

/**
 * C2: A SCORE IS A DRAFT UNTIL RECORDED.
 *
 * Two separate stores, because they answer different questions: `drafts` is
 * what the box currently holds, `recorded` is what the record has been told.
 * The draft is cleared on record so the box stops offering a value the record
 * already holds - which is what makes C6's lock a lock rather than a second
 * copy of the same number.
 */
export interface ScoreDraftState {
  drafts: Record<string, string>
  recorded: ReadonlySet<string>
}

export function setScoreDraft(
  state: ScoreDraftState, key: string, value: string,
): ScoreDraftState {
  return { drafts: { ...state.drafts, [key]: value }, recorded: state.recorded }
}

export function recordScore(
  state: ScoreDraftState, keys: readonly string[],
): ScoreDraftState {
  const drafts = { ...state.drafts }
  const recorded = new Set(state.recorded)
  for (const key of keys) { delete drafts[key]; recorded.add(key) }
  return { drafts, recorded }
}
