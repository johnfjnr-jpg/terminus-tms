/**
 * Scoring levels: the one place the default scale is defined.
 *
 * Round 24 Phase 3, 2026-08-23. Extracted because Phase 2 left the same
 * default in two places: DEFAULT_LEVELS in src/routes/scoring.js for the read
 * path, and a bare `[1, 2, 3, 4, 5]` in src/routes/test-beds.js for the write
 * path. Two definitions of one thing agree today and disagree later, which is
 * Architecture rule 3, and this phase would have added a third by putting the
 * reason-required flags beside each of them.
 *
 * The default is what a criterion with no scale is scored against: the legacy
 * 1 to 5, with the level number as its own label. It is deliberately NOT a row
 * set in the database, because null scale_id has to mean this for a criterion
 * created long after any migration ran, not only for the five that existed
 * when one did.
 *
 * reason_required reproduces the rule it replaces exactly. That rule was
 * `score <= 2`, written inline in the write path, and its stated purpose is
 * that a low score is the one that has to be actionable: without a reason the
 * framework records an opinion nobody can act on.
 */

export const DEFAULT_LEVELS = [
  { value: 1, label: '1', reason_required: true },
  { value: 2, label: '2', reason_required: true },
  { value: 3, label: '3', reason_required: false },
  { value: 4, label: '4', reason_required: false },
  { value: 5, label: '5', reason_required: false },
]

/**
 * The levels a criterion is scored against.
 *
 * Returns { levels } on success or { error } on a failed read. A scale with no
 * level rows is returned as an EMPTY array rather than silently falling back to
 * the default: an empty scale is a misconfiguration, and defaulting it would
 * accept scores the panel cannot display. Callers decide what to do with that,
 * because the read path wants to render nothing and the write path wants to
 * refuse.
 */
export async function resolveLevels(db, scaleId) {
  if (!scaleId) return { levels: DEFAULT_LEVELS }

  const { data, error } = await db
    .from('scoring_scale_levels')
    .select('value, label, reason_required')
    .eq('scale_id', scaleId)
    .order('value', { ascending: true })

  if (error) return { error }
  return { levels: (data ?? []).map(l => ({ value: l.value, label: l.label, reason_required: l.reason_required })) }
}
