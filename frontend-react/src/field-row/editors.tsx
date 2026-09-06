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

// ── A2, 2026-09-06: showPicker, PORTED ──────────────────────────────────
//
// `window.revealFieldControl` calls `input.showPicker()` for a select or a
// date input when the open came from a user gesture. It appears nowhere in the
// React tree, so the select editor has been diverging silently since Round 2
// and a date editor would have inherited that.
//
// Never rethrow: NotAllowedError (no user activation) or InvalidStateError
// (detached) must leave the field open and usable, which is the vanilla's own
// recorded floor. Focus is already set by the row.
function offerPicker(el: HTMLElement | null): void {
  const withPicker = el as (HTMLElement & { showPicker?: () => void }) | null
  if (typeof withPicker?.showPicker !== 'function') return
  try { withPicker.showPicker() } catch { /* the field is open and usable */ }
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
      onFocus={(e) => offerPicker(e.currentTarget)}
    >
      <option value="">--</option>
      {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── THE DATE EDITOR ─────────────────────────────────────────────────────
//
// `min` comes from the descriptor (A4). The vanilla's own split is kept: the
// native attribute catches most, and `isNotPastIsoDate` on the server is what
// actually rejects. Nothing here is authoritative.
export function DateEditor({ field, value, onChange, onRequestClose, focusRef, testId }: FieldEditorProps) {
  return (
    <input
      type="date"
      ref={focusRef as RefObject<HTMLInputElement | null>}
      data-testid={testId}
      value={value}
      min={field.min}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => offerPicker(e.currentTarget)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onRequestClose() } }}
    />
  )
}

// ── THE TEXTAREA EDITOR ─────────────────────────────────────────────────
// A6: it CAN hold a seed. revealFieldControl includes TEXTAREA explicitly,
// and its comment says why - the summary is the field a person is most likely
// to tab to and start typing into.
export function TextareaEditor({ field, value, onChange, onRequestClose, focusRef, testId }: FieldEditorProps) {
  return (
    <textarea
      ref={focusRef as RefObject<HTMLTextAreaElement | null>}
      data-testid={testId}
      rows={field.rows ?? 3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onRequestClose() } }}
    />
  )
}

// ── THE CHECKBOX EDITOR ─────────────────────────────────────────────────
//
// A7: used as a DIRECT INPUT on the surface rather than inside a row, but it
// is an editor because it reports a candidate the same way and the surface
// stores its draft in the same place.
//
// THE VALUE IS A STRING, and that is finding 1 rather than a style choice.
// Behaviour 1 compares `draft !== orig` strictly, so a boolean draft against a
// string original would read dirty forever. 'true' and '' are the two states,
// and '' is chosen for false because it is what an unset field already carries
// everywhere else on the surface.
export function CheckboxEditor({ value, onChange, onRequestClose, focusRef, testId }: FieldEditorProps) {
  return (
    <input
      type="checkbox"
      ref={focusRef as RefObject<HTMLInputElement | null>}
      data-testid={testId}
      checked={value === 'true'}
      onChange={(e) => onChange(e.target.checked ? 'true' : '')}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onRequestClose() } }}
    />
  )
}

// The descriptor selects the editor. `options` present means a select unless
// the descriptor says otherwise, so a caller declares data rather than wiring.
const BY_KIND: Record<string, FieldEditor> = {
  text: TextEditor,
  select: SelectEditor,
  date: DateEditor,
  textarea: TextareaEditor,
  checkbox: CheckboxEditor,
}

export function editorFor(field: FieldDescriptor): FieldEditor {
  if (field.editor) return BY_KIND[field.editor] ?? TextEditor
  // Round 2's rule, untouched: declaring `options` declares a select, so a
  // caller states DATA rather than wiring.
  return field.options ? SelectEditor : TextEditor
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
// ── A1, 2026-09-06: GENERALISED OFF SelectEditor's NAME ─────────────────
//
// This read `editorFor(field) !== SelectEditor`, which polices ONE MECHANISM
// rather than the effect (CLAUDE.md Verification 37). The vanilla's rule is
// `revealFieldControl`'s `takesText`, which excludes a date input as well as a
// select, and says so in its own comment: "A date input and a select cannot
// hold an arbitrary first character."
//
// A date editor added under the old condition would have opened its row on a
// character the input then discarded - FINDING 6's original defect, arriving
// through a new editor rather than a new field.
//
// So the PROPERTY is declared per editor kind, and a new editor answers the
// question by joining this table rather than by being named in a condition.
const TAKES_SEED: Record<string, boolean> = {
  text: true,       // an <input type="text"> keeps the character
  textarea: true,   // A6, and revealFieldControl includes TEXTAREA explicitly
  select: false,    // the browser's own type-ahead takes it once focused
  date: false,      // a date input cannot hold an arbitrary first character
  checkbox: false,  // it has no text to hold
}

export function editorTakesSeed(field: FieldDescriptor): boolean {
  const kind = field.editor ?? (field.options ? 'select' : 'text')
  return TAKES_SEED[kind] ?? true
}
