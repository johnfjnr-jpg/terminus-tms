// ── B: THE EXIT-CRITERION TICK ──────────────────────────────────────────
//
// B1: a tick writes an ISO TIMESTAMP and an untick writes null. NEVER a
// boolean.
//
// B2, and it is why the rule exists rather than a style: the gate's
// `payload_field_required` blocks only on `undefined`, `null` and `''`, so a
// stored `false` reads as PRESENT and OPENS THE GATE. Storing a timestamp on
// tick and clearing the key on untick makes "present and non-empty"
// structurally equivalent to "ticked", rather than dependent on a truthiness
// detail in a branch that knows nothing about criteria.
export function exitTickPayload(
  field: string, currentlyMet: boolean, at: string,
): Record<string, string | null> {
  return { [field]: currentlyMet ? null : at }
}

/**
 * Whether a stored value counts as ticked, BY THE GATE'S OWN RULE.
 *
 * `false` returns TRUE here on purpose: that is what the gate sees, and a
 * helper that disagreed with the gate would be a second reader of one rule.
 * The point of B1 is that we never STORE a false, not that we reinterpret one.
 */
export function isTicked(value: unknown): boolean {
  return !(value === undefined || value === null || value === '')
}
