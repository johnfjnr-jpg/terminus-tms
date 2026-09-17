// ── C: THE SCORING CAPABILITY ───────────────────────────────────────────
//
// Round 7 Phase 1b, from the C enumeration. The reason rules live in
// scoreReason.ts; this is the state around them.
import { reasonRequired, type Level, type ScoreEntry } from './scoreReason'

/**
 * A scoring criterion, typed from GET /api/scoring-criteria (src/routes/scoring.js)
 * as captured in `__tests__/fixtures/scoring-live.json`. Every field beyond the
 * key is optional because the panel must render a criterion the route returns
 * with less, rather than a fixture shaped to what the panel wants.
 */
export interface Criterion {
  criterion_key: string
  name?: string
  asks?: string | null
  sort_order?: number
  levels?: Level[]
  /** The stages this criterion is shown and scoreable at, from scoring_criterion_stages. */
  stages?: Array<{ stage: string, required?: boolean }>
  /** Anchor wording by VERSION then LEVEL. Versions arrive as object keys, so strings. */
  anchors?: Record<string, Record<string, string>>
  current_version?: number | null
}

/**
 * 2.1: WHICH CRITERIA A STAGE TAB SHOWS, from the criterion's OWN stage rows.
 *
 * The vanilla's Round 24 Phase 5 rule: visibility comes from
 * `criterion.stages`, not from whether a gate rule at that stage names the
 * criterion, because display and requirement are different facts. The order is
 * the route's (it sorts by sort_order), kept rather than re-sorted here.
 *
 * This replaces the host's `scoring` state, which nothing ever set, so every
 * stage offered no criteria at all (audit B2, reproduced live as P0.2).
 */
export function criteriaForStage(all: readonly Criterion[], stage: string): Criterion[] {
  return all.filter((c) => (c.stages ?? []).some((s) => s.stage === stage))
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

// ── C6 "LOCKED ONCE RECORDED" IS REMOVED, Round A Phase 2.3 ─────────────
//
// A CONTRACT FINDING, not a preference. The Phase 0b enumeration's C6 reads
// `applyTbScoreEntryLock` as "locks entry once recorded", and the React card
// built that: a recorded criterion's select stayed disabled for the session.
// The vanilla function is the AWAITING-REASON lock (brief 2.5) - it disables the
// OTHER selects while one criterion's reason is outstanding - and after a
// record the vanilla reloads and offers "Revise...". A permanent lock would also
// defeat 2.3's retry: a partial failure leaves the unrecorded drafts open
// precisely so they can be sent again.

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

// ── C9 / 2.2: `summarise` IS REMOVED ─────────────────────────────────────
//
// It called `series[0]` the latest entry, which is true of nothing this app
// stores: the payload series APPENDS, so index 0 is the OLDEST. It survived
// because its only input was `seriesByKey`, which only a POST response filled
// and B1 meant no POST ever succeeded. The one reducer is now `orderedSeries`
// in QualificationScore.tsx, which both renderers take (C9).

/**
 * C2: A SCORE IS A DRAFT UNTIL RECORDED, and its reason travels with it.
 *
 * Held above both stage panels (StageTabs), because 2.6's pending marks on the
 * exit-criteria panel render from the same drafts the scoring card edits.
 */
export interface ScoreDrafts {
  drafts: Readonly<Record<string, string>>
  reasons: Readonly<Record<string, string>>
}
export const NO_DRAFTS: ScoreDrafts = { drafts: {}, reasons: {} }

/**
 * Set or clear one draft. CLEARING drops its reason too (the vanilla's
 * `setTbScoreDraft`), so an abandoned score cannot leave a reason behind to be
 * sent with the next one.
 *
 * THE HANDLER REFUSES, not only the control (2.5): while another criterion is
 * awaiting its reason, a draft for this one is not taken, whatever disabled the
 * select or failed to. The vanilla's note: a change event dispatched at a
 * disabled select was taken, which is the handler trusting the control.
 */
export function applyDraft(s: ScoreDrafts, key: string, value: string, awaiting: string | null): ScoreDrafts {
  if (awaiting && awaiting !== key) return s
  const drafts = { ...s.drafts }
  const reasons = { ...s.reasons }
  if (value === '') { delete drafts[key]; delete reasons[key] } else drafts[key] = value
  return { drafts, reasons }
}

export function applyReason(s: ScoreDrafts, key: string, value: string): ScoreDrafts {
  return { drafts: s.drafts, reasons: { ...s.reasons, [key]: value } }
}

/** A recorded score stops being a draft; everything not recorded stays for a retry. */
export function clearRecorded(s: ScoreDrafts, keys: readonly string[]): ScoreDrafts {
  const drafts = { ...s.drafts }
  const reasons = { ...s.reasons }
  for (const k of keys) { delete drafts[k]; delete reasons[k] }
  return { drafts, reasons }
}

export interface RecordOutcome {
  /** Criterion keys the server accepted, in the order they were sent. */
  recorded: string[]
  /** The first refusal, which stopped the run. */
  failed: { key: string, error: string } | null
  /** True when the door refused before anything was sent. */
  refused: boolean
}

/**
 * 2.3: THE CONTRACT, CLIENT-SIDE. One POST per criterion, the flat body the
 * server reads (`src/lib/score-entry.js`), in PANEL ORDER, one at a time.
 *
 * The client sent `{ entries: [{ criterion_key, ... }] }` and the server reads
 * `{ criterion, score, reason }`, so every attempt was refused (audit B1,
 * reproduced live as P0.1).
 *
 * THE VANILLA'S STATED PARTIAL-FAILURE SEMANTICS, because this cannot be atomic:
 * each score is its own append to its own revision, and revisions are immutable.
 *   - attempted in panel order;
 *   - a recorded score STANDS, it cannot be retracted;
 *   - the FIRST failure stops the run, and nothing after it is attempted (a
 *     failure here is far likelier to be systemic than specific to one score);
 *   - everything not recorded stays drafted, for a retry.
 *
 * Only the criteria the open stage SHOWS are sent: a draft made on another
 * stage's tab waits there. A reason is sent only when it has content.
 */
export async function recordScoresInOrder(
  deps: {
    canEdit: () => boolean
    post: (body: { criterion: string, score: number, reason?: string }) => Promise<{ ok: boolean, error?: string | null }>
  },
  criteria: readonly Criterion[],
  s: ScoreDrafts,
): Promise<RecordOutcome> {
  if (!deps.canEdit()) return { recorded: [], failed: null, refused: true }
  const recorded: string[] = []
  for (const c of criteria) {
    const draft = s.drafts[c.criterion_key]
    if (draft === undefined || draft === '') continue
    const body: { criterion: string, score: number, reason?: string } = { criterion: c.criterion_key, score: Number(draft) }
    const reason = String(s.reasons[c.criterion_key] ?? '').trim()
    if (reason) body.reason = reason
    const r = await deps.post(body)
    if (!r.ok) return { recorded, failed: { key: c.criterion_key, error: r.error ?? 'unknown error' }, refused: false }
    recorded.push(c.criterion_key)
  }
  return { recorded, failed: null, refused: false }
}

/** The vanilla's message: what was recorded, and what was not and why, by criterion NAME. */
export function recordOutcomeMessage(o: RecordOutcome, criteria: readonly Criterion[]): string | null {
  if (!o.failed) return null
  const nameOf = (k: string) => criteria.find((c) => c.criterion_key === k)?.name ?? k
  const done = o.recorded.length ? `Recorded ${o.recorded.map(nameOf).join(', ')}. ` : 'Nothing was recorded. '
  return `${done}${nameOf(o.failed.key)} could not be recorded: ${o.failed.error}`
}
