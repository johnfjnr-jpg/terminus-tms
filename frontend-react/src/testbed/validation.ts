// ── V: VALIDATION, THE HALF THAT SAYS NO ────────────────────────────────
//
// Round 7 Phase 2b session 2. The keystroke guard (`acceptsValue`, keyed on
// inputMode) already existed. This is the refusal and its words.
//
// V3, and it is why this is not a nicety: the React keystroke pattern is
// /^-?\d*$/, so a MINUS CAN BE TYPED. A guard with no message is the
// silent-refusal shape - the value is admitted and nothing says it is wrong.
export interface NumericField { key: string, label: string, integer?: boolean }

/**
 * V2. An EMPTY field is not a problem: not-set is a legitimate state, and a
 * default written into it would be Architecture 11's fallback.
 */
export function validateNumeric(raw: string, f: NumericField): string | null {
  if (String(raw ?? '').trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return 'must be a number'
  if (n < 0) return 'cannot be negative'
  if (f.integer && !Number.isInteger(n)) return 'must be a whole number'
  return null
}

/** V4: ONE line for every invalid field, `<label> <problem>`, joined with `. `. */
export function validationMessage(invalid: ReadonlyMap<string, string>): string | null {
  if (!invalid.size) return null
  return [...invalid.values()].join('. ') + '.'
}

/**
 * V5: OWNERSHIP IS MARKED, NOT INFERRED FROM THE CLASS.
 *
 * Confirmed live in the vanilla before it was changed: a server save error
 * carries the same error class, so identifying "its own" by class meant one
 * valid keystroke in another field ERASED THE SERVER'S REASON. Both halves of
 * that defect come from having no record of who put the message there.
 */
export const VALIDATION_OWNER = 'validation'

/** V6 and V7 in one answer: what the field shows, and whether the bar may save. */
export function validityOf(
  drafts: Readonly<Record<string, string>>, fields: readonly NumericField[],
): Map<string, string> {
  const out = new Map<string, string>()
  for (const f of fields) {
    if (!(f.key in drafts)) continue
    const problem = validateNumeric(drafts[f.key], f)
    if (problem) out.set(f.key, `${f.label} ${problem}`)
  }
  return out
}
