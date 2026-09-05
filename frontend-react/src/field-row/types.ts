// ── THE FIELD ROW'S INTERFACE ────────────────────────────────────────────
//
// Derived from MIGRATION_FIELD_ROW_CONTRACT.md and nothing else. The five
// vanilla implementations were deliberately NOT read while writing this:
// Verification 47 at the component level, since a component shaped to an
// implementation tests the implementation. Every place the contract was silent
// is a numbered finding in MIGRATION_ROUND_1_PHASE_4_REPORT.md with the
// position taken.

/**
 * What a field declares about itself. The contract's closing section requires
 * that `inputmode` keying survive the port, because the finding behind it was
 * that a per-field guard is a to-do list to be completed again on every new
 * field. A descriptor declares what it takes and inherits the constraint.
 */
export interface FieldDescriptor {
  /** Stable key. The draft store is keyed by it, as the contract's `refEdits` is. */
  name: string
  label: string
  /**
   * The ORIGINAL, always a string.
   *
   * FINDING 1's position. The contract says dirty is `draft !== orig`, strictly.
   * An <input> yields a string, so a numeric `orig` would make every numeric
   * field permanently dirty under strict comparison - and behaviour 1 exists
   * precisely so that typing a value and typing it back reads clean. Numeric
   * fields declare `inputMode` and still carry their value as text.
   */
  value: string
  /**
   * Honoured on the input, and it drives the keystroke guard. The contract
   * requires the KEYING to survive, not a list of guarded fields.
   */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search' | 'none'
  /**
   * The options a select offers. Round 2: three of the Account surface's
   * fourteen rows are selects, and DECLARING the options is what selects the
   * editor - a caller states data, never wiring.
   *
   * The editor renders an empty option ahead of these so a set field can be
   * CLEARED. Without it a select is a one-way door and "not recorded" stops
   * being reachable from the screen.
   */
  options?: string[]
  /**
   * Explicit editor choice, for the case where the descriptor's shape does not
   * imply it. Omitted, `options` present means select and its absence means
   * text. Round 3's dates and currency add members here without touching the
   * row.
   */
  editor?: 'text' | 'select'
  /**
   * Behaviour 7. A read-only row is the same row WITHOUT a door and WITHOUT a
   * tab stop. It is not an editable row that has been disabled, because that
   * gets the tab order wrong.
   */
  readOnly?: boolean
  /** Shown in the display half when the value is empty. Never written anywhere. */
  placeholder?: string
}

/**
 * The surface-level controller. Behaviour 6: the bar aggregates across all
 * drafts on the surface, so the DRAFTS cannot live in a row. A row that owned
 * its own draft could not be counted by anything above it.
 */
export interface FieldRowsController {
  fields: FieldDescriptor[]
  /** Fields whose draft differs from their original. Computed, never flagged. */
  dirtyNames: string[]
  dirtyCount: number
  /** What a save would send: only what actually moved. */
  changes: Record<string, string>
  isOpen(name: string): boolean
  isDirty(name: string): boolean
  /** The value the input shows: the draft if there is one, else the original. */
  valueOf(name: string): string
  /**
   * THE ONE DOOR. Behaviour 2. Every entry attempt on every row goes through
   * this, click and keyboard alike, and it consults the injected guard EVERY
   * TIME rather than a value captured at render, because the contract's own
   * note is that the door has no timing dependency.
   *
   * Returns whether the row opened, so a caller can tell refusal from success.
   */
  requestOpen(name: string, seedChar?: string): boolean
  close(name: string): void
  setDraft(name: string, value: string): void
  /** Behaviour 5. Restores the original into the input. NOT a close. */
  discard(name: string): void
  discardAll(): void
}
