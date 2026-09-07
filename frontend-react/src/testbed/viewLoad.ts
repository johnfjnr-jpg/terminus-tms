// ── L/R: THE VIEW'S LOAD AND RENDER ─────────────────────────────────────
//
// Round 7 Phase 2d session 2, from the L and R enumeration.

/**
 * L1/L2/R5: THE ARRIVAL AND LANDING FLAGS.
 *
 * L2, and it is the reason this is a machine rather than two booleans on the
 * host: THE DEFAULT IS INVERTED. Twelve of the vanilla's thirteen load call
 * sites are in-app saves and only navigation is an arrival, so preserving the
 * tab is what happens unless something explicitly says otherwise. Making each
 * caller pass `do not reset` would leave the thirteenth, added in a future
 * round, inheriting the fault - four confirmed instances of that shape.
 *
 * L1: THE ARRIVAL FLAG IS SPENT AT THE TOP OF A LOAD, before the fetch can
 * fail. A flag cleared only by the renderer survives a failed load, and the
 * NEXT call - a save - then reads as an arrival and jumps to Reference. That is
 * the original fault reintroduced through its own fix.
 */
export interface ArrivalFlags {
  /** The only thing that says "this is a navigation". */
  markNavigation(): void
  /** Spend the arrival flag. Called once per load, at the top. */
  consume(): boolean
  /** A transition asks the next load to land on the stage just entered. */
  landOn(stage: string): void
  /** R5: read AND clear, so a later unrelated load cannot inherit it. */
  takeLanding(): string | null
}

export function createArrivalFlags(): ArrivalFlags {
  let freshNavigation = false
  let landing: string | null = null
  return {
    markNavigation() { freshNavigation = true },
    consume() {
      const was = freshNavigation
      freshNavigation = false
      return was
    },
    // R6: EVERY transition lands on the stage just entered, including the
    // last. Round 10 Phase 6 excepted the terminal one because Closed rendered
    // nothing; Round 10 Phase 7 gave Closed a real panel and removed the
    // exception it had only ever been deferring. There is no special case here
    // and there must not be one.
    landOn(stage: string) { landing = stage },
    takeLanding() {
      const was = landing
      landing = null
      return was
    },
  }
}

export const OWNERSHIP_REFUSAL_TEXT =
  'This record belongs to another user. You can view it, but only its owner can change it.'

/**
 * ── ONE DEFINITION, SHARED WITH THE SHELL. Round 8 Phase 1 ─────────────
 *
 * This file carried its own copy. The door now reads the record rather than a
 * class, and the door is exactly where two readers of one value must not
 * exist - so the derivation moved to `src/lib/ownership.js`, which app.js gets
 * through index.html's module block and this tree imports directly.
 *
 * Re-exported rather than re-implemented so every existing caller is unchanged
 * and there is still only one definition.
 */
export { notMine } from '../../../src/lib/ownership.js'

/** R1: the header is name and client organisation, and nothing else any more. */
export function headerOf(
  record: { payload?: { name?: string, client_organisation?: string } } | null | undefined,
): { name: string, client: string } {
  // L4: a load that failed reads Not found rather than a stale name or a
  // loading line that never goes away.
  if (!record) return { name: 'Not found', client: '' }
  return {
    name: record.payload?.name ?? '--',
    client: record.payload?.client_organisation ?? '',
  }
}
