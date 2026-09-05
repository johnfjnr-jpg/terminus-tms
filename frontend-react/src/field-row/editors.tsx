import type { RefObject } from 'react'
import type { FieldDescriptor } from './types'

// ── THE EDITOR SLOT ──────────────────────────────────────────────────────
//
// Migration Round 2, ruled at the Phase 0 close as route 3. This is the
// IMPLEMENTATION of the contract's own sentence rather than a departure from
// it:
//
//   "Field-specific editors. Dates, staff pickers, currency and the numeric
//    guard are per-field concerns LAYERED ON the row, not part of it."
//
// THE ROW KEEPS EVERYTHING THE CONTRACT MADE IT RESPONSIBLE FOR: draft state,
// the ownership door, dirty, the tab stop, the keydown opener, the seed
// character, discard, and the visibility swap. An editor receives a value and
// a way to report a new one, and that is all it can reach.
//
// WHAT AN EDITOR STRUCTURALLY CANNOT DO, and each is asserted:
//   - bypass the door. It is only ever mounted inside the row's edit half, and
//     the row opens that half through requestOpen. An editor has no reference
//     to the controller and cannot open anything.
//   - own dirty. It gets `value` and `onChange`. It cannot read `orig`, cannot
//     see other fields, and cannot compute or set a dirty flag.
//   - be operated while the row is closed. The edit half carries `hidden`, and
//     a hidden subtree is out of the tab order by specification.
//
// Text and select are the first two. Dates and currency arrive in Round 3
// without another refactor, which is why this cost less than a sibling
// component even though it is more work today.
export interface FieldEditorProps {
  field: FieldDescriptor
  /** The draft if there is one, else the original. The row decides which. */
  value: string
  /** Report a candidate value. The row applies its own guard before storing. */
  onChange(next: string): void
  /** Escape. The row closes; it does NOT discard. */
  onRequestClose(): void
  /** The row focuses this on the open transition. */
  focusRef: RefObject<HTMLElement | null>
  testId: string
}

export type FieldEditor = (props: FieldEditorProps) => React.ReactElement

// ── THE KEYSTROKE GUARD, KEYED ON inputMode ──────────────────────────────
//
// Unchanged from Round 1 and deliberately still keyed on what the field
// DECLARES rather than on a list of field names: the finding behind it was
// that a per-field guard is a to-do list to be completed again on every new
// field.
const ALLOWED: Partial<Record<string, RegExp>> = {
  numeric: /^-?\d*$/,
  decimal: /^-?\d*\.?\d*$/,
}

export function acceptsValue(inputMode: string | undefined, value: string): boolean {
  const rule = inputMode ? ALLOWED[inputMode] : undefined
  return rule ? rule.test(value) : true
}

export function TextEditor({ field, value, onChange, onRequestClose, focusRef, testId }: FieldEditorProps) {
  return (
    <input
      ref={focusRef as RefObject<HTMLInputElement | null>}
      data-testid={testId}
      value={value}
      inputMode={field.inputMode}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onRequestClose() } }}
    />
  )
}

export function SelectEditor({ field, value, onChange, onRequestClose, focusRef, testId }: FieldEditorProps) {
  // The empty option is what lets a set field be CLEARED. Without it a select
  // is a one-way door: once a value is chosen there is no way back to unset,
  // and "not recorded" stops being reachable from the screen.
  return (
    <select
      ref={focusRef as RefObject<HTMLSelectElement | null>}
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onRequestClose() } }}
    >
      <option value="">--</option>
      {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// The descriptor selects the editor. `options` present means a select unless
// the descriptor says otherwise, so a caller declares data rather than wiring.
export function editorFor(field: FieldDescriptor): FieldEditor {
  if (field.editor === 'select' || (!field.editor && field.options)) return SelectEditor
  return TextEditor
}

// ── DOES A SEED CHARACTER REACH THIS EDITOR? ─────────────────────────────
//
// MEASURED FROM THE VANILLA, not decided here. `window.revealFieldControl` in
// frontend/app.js computes:
//
//   const takesText = input.tagName === 'TEXTAREA'
//     || (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number'))
//
// A <select> is NOT in that set, and the function's own comment says why:
// "Only a free-text control can take a character. A date input and a select
// cannot hold an arbitrary first character."
//
// So on the vanilla Account surface today, typing a character at a closed
// select row OPENS the row and FOCUSES the select, and the character is
// DISCARDED. That is the behaviour ported here, and it is recorded as a
// contract note rather than improved: the browser's own type-ahead takes over
// once the select has focus, so the keystroke is not wasted, it is handed to
// the control that knows what to do with it.
export function editorTakesSeed(field: FieldDescriptor): boolean {
  return editorFor(field) !== SelectEditor
}
