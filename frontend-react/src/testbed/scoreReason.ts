// ── R: THE SCORE REASON ─────────────────────────────────────────────────
//
// R1: the LEVEL says whether a reason is required, read from the level's own
// `reason_required` rather than a hardcoded list. Architecture 9's fourth
// variant is recorded against exactly this field: a message that named "what is
// missing" stopped being true when a confirmation scale gained a required
// reason, and no line of code changed.
//
// R2: any REVISION requires one too, whatever the level says.
export interface Level { value: number, label?: string, reason_required?: boolean }
export interface ScoreEntry { reason?: string | null }

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
