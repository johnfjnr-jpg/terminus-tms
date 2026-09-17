// ── R: THE SCORE REASON ─────────────────────────────────────────────────
//
// R1: the LEVEL says whether a reason is required, read from the level's own
// `reason_required` rather than a hardcoded list. Architecture 9's fourth
// variant is recorded against exactly this field: a message that named "what is
// missing" stopped being true when a confirmation scale gained a required
// reason, and no line of code changed.
//
// R2: any REVISION requires one too, whatever the level says.
export interface Level {
  value: number
  label?: string
  reason_required?: boolean
  /** A scale's generic wording for the level, the fallback when a criterion has no anchor at it. */
  description?: string | null
}
/**
 * ── Q5, WIDENED 2026-09-15: WHAT IS ACTUALLY STORED ─────────────────────
 *
 * This named ONE field, `reason`, because `reasonRequired` is the only thing
 * that had ever read an entry and the only thing it needs is the series
 * LENGTH. That was correct for every caller it had, and it is Architecture 8
 * exactly: an unchanged type meeting a new demand.
 *
 * The Qualification score card (L2) needs the CURRENT value and the STAGE it
 * was recorded at, so the type now names what `src/lib/score-entry.js:177`
 * actually writes. Every field stays optional: these entries come off a
 * record payload written by any version of the app that ever ran, and a
 * required field here would be a fixture shaped to the reader rather than to
 * the writer (Verification 47).
 */
export interface ScoreEntry {
  /** ISO timestamp. The series is ordered by this. */
  at?: string
  /** The recorder's email. */
  by?: string
  /**
   * The level recorded. A MEASURABILITY entry stores a boolean here, written by
   * POST /test-beds/:id/measurability, and it shares this type because it
   * shares the payload-series shape and the one reducer.
   */
  value?: number | boolean
  /** The pre-Round-14 free-text field. Old entries carry it; new ones carry `reason`. */
  comment?: string | null
  /** The record's stage AT THE MOMENT the score was recorded. */
  stage?: string
  anchorVersion?: number | null
  reason?: string | null
}

export function reasonRequired(
  score: number, levels: readonly Level[], series: readonly ScoreEntry[],
): boolean {
  if (!Number.isFinite(score)) return false
  const level = levels.find((l) => l.value === score)
  return !!level?.reason_required || series.length > 0
}

/**
 * ── R4: MUST-DIFFER IS STRIPPED, BY RULING, 2026-09-07 ──────────────────
 *
 * THE CLAIM CHANGED BY RULING, AND THE REASONING IS KEPT HERE RATHER THAN
 * DELETED, so a later reader can tell a superseded decision from a preference
 * (Verification 29).
 *
 * WHAT WAS MEASURED, and it stands. Neither the client nor
 * `src/lib/score-entry.js` has ever compared a reason to the one already
 * recorded. The server refuses an EMPTY reason twice - once for a
 * `reason_required` level (line 129) and once for a revision (line 158) - and
 * compares it to nothing. Phase 1b built the comparison anyway, having
 * enumerated it as a port on the strength of Round 30, whose ruling was made
 * about the OPPORTUNITY assessment panel and was asserted here without reading
 * for it.
 *
 * WHY IT IS OUT. Round 7 is a MIGRATION. A rule the vanilla does not have is a
 * behaviour change arriving inside a swap, so a walk comparing the two surfaces
 * would find the React one refusing a save the vanilla accepts, and the person
 * walking it could not tell an improvement from a regression. The strip lands
 * BEFORE the swap for exactly that reason.
 *
 * WHAT SURVIVES: the empty-reason refusal, which IS the vanilla's behaviour at
 * both sites, and R1 and R2 above, which are ports.
 *
 * QUEUED, NOT ABANDONED. The argument for must-differ is unchanged and is
 * recorded as a queued enhancement in MIGRATION_TEST_BED_CAPABILITIES.md,
 * pending a business ruling: on a revision the box starts empty, so non-empty
 * is a real check, but a person can retype the same sentence and the new level
 * is then recorded carrying the reasoning given for a different one. That is a
 * PRODUCT decision about what a scorer is asked, not a migration decision, and
 * it belongs to whoever owns the question rather than to the round that
 * happened to notice it.
 */
export function reasonAccepted(
  reason: string, _series: readonly ScoreEntry[],
): { ok: boolean, error?: string } {
  if (!String(reason ?? '').trim()) return { ok: false, error: 'A reason is required.' }
  return { ok: true }
}
