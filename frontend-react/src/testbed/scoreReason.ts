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

const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()

/**
 * ── R4: MUST DIFFER, AND IT IS AN IMPROVEMENT RATHER THAN A PORT ────────
 *
 * MEASURED: neither the client nor `src/lib/score-entry.js` has ever compared a
 * reason to the one already recorded. The server refuses an EMPTY reason twice
 * - once for a `reason_required` level and once for a revision - and compares
 * it to nothing.
 *
 * The Phase 0b enumeration stated must-differ as a behaviour of this surface,
 * citing Round 30. That ruling is real and is in CLAUDE.md, but it was made
 * about the OPPORTUNITY assessment panel, and it was asserted here without
 * reading for it. Recorded as the enumeration's own error.
 *
 * The rule is worth applying. On a revision the box starts empty, so non-empty
 * is a real check - but a person can retype the same sentence, and a new level
 * is then recorded carrying the reasoning given for a DIFFERENT one.
 *
 * It compares against the MOST RECENT recorded reason: the series is latest
 * first, and what a person must not do is repeat the sentence they are
 * revising.
 */
export function reasonAccepted(
  reason: string, series: readonly ScoreEntry[],
): { ok: boolean, error?: string } {
  const given = norm(reason)
  if (!given) return { ok: false, error: 'A reason is required.' }
  const last = norm(series[0]?.reason)
  if (last && given === last) {
    return {
      ok: false,
      error: 'This reason is the same as the one already recorded. '
        + 'Say what has changed, or the new score carries the old reasoning.',
    }
  }
  return { ok: true }
}
