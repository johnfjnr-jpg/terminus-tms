// ── THE QUALIFY WORKFLOW'S blocking[] LIFECYCLE ──────────────────────────
//
// Round 6 Phase 1, built from the Phase 0 enumeration.
//
//   set             a 422 from POST /records/:id/transition carrying blocking[]
//   rendered        a tint on the row whose gate key matches, and on the
//                   Account card for parent_record_id
//   cleared, field  when the value is no longer absent, against the reloaded
//                   record - NEVER by re-attempting the transition, which would
//                   qualify the contact as a side effect of saving a field
//   cleared, whole  on a successful qualify, and when a different contact loads
//
// ── THE RULE IS THE SERVER'S OWN, IMPORTED ───────────────────────────────
//
// `gateFieldIsPresent` is what `computeBlocking` applies. The vanilla carried a
// copy with a comment saying it used "the exact same rule", which is the phrase
// CLAUDE.md names as marking an unproven equality. They did agree when
// measured; they are one definition now, so agreement is not something anybody
// has to keep checking.
import { gateFieldIsPresent, gateFieldValue } from '../../../src/lib/stage-gate-fields.js'
import { gateKeyFor, GATED_NOT_A_ROW } from './descriptors'

/** One entry as the transition endpoint returns it. */
export interface Blocker {
  field: string
  label?: string
  message?: string
}

/** What the screen holds while a qualify attempt is outstanding. */
export interface BlockingState {
  /** The record the list belongs to. A list outlives its record otherwise. */
  recordId: string
  blockers: Blocker[]
}

/**
 * The value a blocker's field currently holds.
 *
 * `gateFieldValue` is the server's own rule about WHICH SIDE to read - the
 * record row for a real column, the payload for everything else - imported
 * rather than restated. The vanilla hardcoded two of the three record columns,
 * which is correct for every contact rule that exists and wrong for the first
 * one that names the third. Architecture 8.
 */
export function blockerValue(
  field: string,
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): unknown {
  return gateFieldValue(field, record, payload)
}

/**
 * Drop every blocker whose field is now filled in.
 *
 * Deliberately client-side and deliberately NOT a re-attempt: re-attempting
 * would silently qualify the contact the instant every field happened to be
 * filled, as a side effect of saving one of them.
 */
export function clearResolved(
  state: BlockingState | null,
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): BlockingState | null {
  if (!state || !state.blockers.length) return state
  const blockers = state.blockers.filter((b) => !gateFieldIsPresent(blockerValue(b.field, record, payload)))
  return blockers.length === state.blockers.length ? state : { ...state, blockers }
}

/** A list belongs to the record it was raised against, and to no other. */
export function forRecord(state: BlockingState | null, recordId: string): BlockingState | null {
  return state && state.recordId === recordId ? state : null
}

/**
 * Which ROW each blocker tints.
 *
 * C2: the gate names `industry_id` and the row is called `industry`, so a
 * renderer matching the gate key against row names finds nothing. This maps in
 * the one direction that has an answer - row name to gate key - and inverts it,
 * so a row that stops declaring its gate key fails the reconciliation test
 * rather than silently losing its tint.
 */
export function tintedRows(state: BlockingState | null, fieldNames: string[]): Set<string> {
  const out = new Set<string>()
  if (!state) return out
  const byGateKey = new Map(fieldNames.map((n) => [gateKeyFor(n), n]))
  for (const b of state.blockers) {
    const row = byGateKey.get(b.field)
    if (row) out.add(row)
  }
  return out
}

/** True when the Account card itself is what a blocker points at. */
export function accountCardBlocked(state: BlockingState | null): boolean {
  return !!state?.blockers.some((b) => GATED_NOT_A_ROW.has(b.field))
}

/**
 * Every blocker the screen could not place. An empty list is the claim; a
 * non-empty one is a row that lost its declaration, and it is surfaced rather
 * than swallowed so the C2 defect cannot recur silently.
 */
export function unplaceable(state: BlockingState | null, fieldNames: string[]): Blocker[] {
  if (!state) return []
  const known = new Set(fieldNames.map(gateKeyFor))
  return state.blockers.filter((b) => !known.has(b.field) && !GATED_NOT_A_ROW.has(b.field))
}
