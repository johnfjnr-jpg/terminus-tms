import { changedKeys } from '../../../src/lib/payload-diff.js'
import { pickSalespersonWritable } from './payload'
import { CENSUS, MILESTONE_INPUTS, CONTRACTOR_INPUTS } from './census'

// ── THE FORM'S DIRTY MODEL: A SECOND MODEL, REPRODUCED NOT UNIFIED ───────
//
// The brief is explicit that this must not be merged with the field-row draft
// model without a ruling, and the two are genuinely different:
//
//   FIELD ROW   per-field draft against per-field original, and the row owns it.
//   THIS FORM   THE WHOLE PAYLOAD against a snapshot taken at the last save.
//
// B1 to B7 below are the Phase 0 enumeration, and each is a behaviour rather
// than an implementation detail.

/** B1. Dirty is a COMPARISON against a baseline. Computed, never a flag. */
export function dealDirtyKeys(
  payload: Record<string, unknown>, lastSavedPayload: Record<string, unknown> | null,
): string[] {
  // B3. The baseline is the SALESPERSON-WRITABLE PROJECTION, not the raw
  // payload, so a latched field moving does not make the form dirty.
  // The cast is a TS inference limit again, not a shape disagreement:
  // changedKeys opens with `const b = baseline ?? {}`, so null is its
  // documented "nothing saved yet" case. src/lib moves untouched.
  return changedKeys(
    pickSalespersonWritable(payload), lastSavedPayload as object) as string[]
}

/**
 * B2. NO CACHED FLAG. `dealFormDirty` was a cached boolean kept in step with
 * the comparison; Round 38 deleted it as Verification 20, a second reader of
 * one value, and restore was reading the cache. This asks the comparison.
 *
 * It is a plain function of its arguments on purpose: a memo keyed on anything
 * less than the whole payload would be the same defect wearing a hook.
 */
export function isDealFormDirty(
  payload: Record<string, unknown>, lastSavedPayload: Record<string, unknown> | null,
): boolean {
  return dealDirtyKeys(payload, lastSavedPayload).length > 0
}

// B4. A key maps to its section by the ID CONVENTION, with a PREFIX FALLBACK.
// `deal-<key>` where the key has one input; otherwise any input whose id STARTS
// WITH `deal-<key>`, which is what lets a milestone list or a nested group
// resolve to a section at all.
//
// Built from the census rather than from the DOM: the React panel knows its own
// inputs, and a DOM query would be a second source of the same fact.
const SECTION_BY_ID = new Map<string, string>([
  ...CENSUS.map((c) => [c.id, c.section] as const),
  ...MILESTONE_INPUTS.flatMap((m) => [m.month, m.label, m.usd, m.pct].map((id) => [id, 'milestones'] as const)),
  ...CONTRACTOR_INPUTS.flatMap((m) => [m.month, m.label, m.usd, m.pct].map((id) => [id, 'contractor'] as const)),
])

export function sectionOfKey(key: string): string | null {
  const exact = SECTION_BY_ID.get(`deal-${key}`)
  if (exact) return exact
  // The prefix fallback, in the census's own order so the answer is stable.
  for (const [id, section] of SECTION_BY_ID) if (id.startsWith(`deal-${key}`)) return section
  return null
}

/** B4, applied: the set of sections holding at least one dirty key. */
export function dirtySections(
  payload: Record<string, unknown>, lastSavedPayload: Record<string, unknown> | null,
): Set<string> {
  const out = new Set<string>()
  for (const key of dealDirtyKeys(payload, lastSavedPayload)) {
    const sec = sectionOfKey(key)
    if (sec) out.add(sec)
  }
  return out
}

/**
 * B7. The ONLY thing that clears dirty. It re-snapshots the salesperson-writable
 * projection, which is what makes the comparison read clean afterwards.
 */
export function captureSavedBaseline(payload: Record<string, unknown>): Record<string, unknown> {
  return pickSalespersonWritable(payload)
}

// B5 and B6 are rendering facts and live with the component:
//   B5. A section save is created and destroyed BY NEED - present exactly when
//       that section is in dirtySections().
//   B6. A section save saves the WHOLE deal sheet. It is a scroll affordance,
//       not a partial write, and the vanilla's own title says so.
export const SECTION_SAVE_TITLE =
  'Saves the whole deal sheet, from here, so you do not have to scroll to the bottom'
