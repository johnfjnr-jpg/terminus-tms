import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { FieldDescriptor, FieldRowsController } from './types'
import { acceptsValue, editorFor, editorTakesSeed } from './editors'

export { acceptsValue }

// A seed is a single printable character typed with no command modifier.
// Enter and Space open WITHOUT a seed: they are "open this", not "type this".
function seedFrom(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  return e.key.length === 1 ? e.key : null
}

// ── THE ROW OWNS STATE, THE DOOR, DIRTY AND KEYBOARD ─────────────────────
//
// Round 2 refactored the editor out into a slot (see editors.tsx). What did
// NOT move is everything the contract's seven behaviours make the row
// responsible for, and the 49 tests written against those behaviours pass
// unchanged through the refactor, which is how the move is shown to have been
// a move rather than a rewrite.
export function FieldRow({ field, rows }: { field: FieldDescriptor; rows: FieldRowsController }) {
  const open = rows.isOpen(field.name)
  const dirty = rows.isDirty(field.name)
  const focusRef = useRef<HTMLElement | null>(null)

  // Focus follows the door opening, so a keyboard user who typed into a closed
  // row is left with a caret in the editor rather than a row they must find
  // again. Runs only on the open transition.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      const el = focusRef.current
      el?.focus()
      if (el instanceof HTMLInputElement) {
        const n = el.value.length
        try { el.setSelectionRange(n, n) } catch { /* not a text-selectable input */ }
      }
    }
    wasOpen.current = open
  }, [open])

  // ── BEHAVIOUR 7: THE READ-ONLY VARIANT IS A DIFFERENT ROW ──────────────
  //
  // The same shape with NO door and NO tab stop. Not a disabled editable row:
  // the contract is explicit that reaching read-only by disabling gets the tab
  // order wrong, and a disabled input is still in the document.
  //
  // There is no `tabIndex` here at all and no edit half to disable, so the tab
  // order is correct BY CONSTRUCTION rather than by remembering to set -1.
  if (field.readOnly) {
    return (
      <div className="field-row" data-field={field.name} data-readonly="true">
        <div className="field-row-label">{field.label}</div>
        <div className="field-row-display" data-testid={`display-${field.name}`}>
          {field.value || <span className="field-row-placeholder">{field.placeholder ?? ''}</span>}
        </div>
      </div>
    )
  }

  const tryOpen = (seed?: string) => { rows.requestOpen(field.name, seed) }
  const Editor = editorFor(field)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryOpen(); return }
    const seed = seedFrom(e)
    if (!seed) return
    // ── WHETHER THE SEED REACHES THE EDITOR IS THE EDITOR'S PROPERTY ──────
    //
    // Measured from the vanilla: revealFieldControl seeds only a textarea or a
    // text/number input, so a select OPENS and FOCUSES and the character is
    // discarded, the browser's own type-ahead taking over from there. Ported
    // rather than improved, and recorded as a contract note.
    if (!editorTakesSeed(field)) { e.preventDefault(); tryOpen(); return }
    if (acceptsValue(field.inputMode, seed)) { e.preventDefault(); tryOpen(seed) }
  }

  return (
    <div className="field-row" data-field={field.name} data-dirty={dirty ? 'true' : 'false'}>
      <div className="field-row-label">{field.label}</div>

      {/* ── BEHAVIOUR 3: SWAP BY VISIBILITY, NEVER BY REMOVAL ──────────────
          Both halves are always in the document and `hidden` decides which is
          seen. A control that vanishes reads as "what did I just break".

          `hidden` rather than a class, and it is load-bearing twice over: a
          hidden element is not focusable, so the closed row's editor cannot be
          reached by keyboard. That is the second half of the very defect
          behaviour 2 exists for - an editor that refused the mouse and stayed
          operable by keyboard. */}
      <div
        className="field-row-display"
        data-testid={`display-${field.name}`}
        hidden={open}
        tabIndex={0}
        role="button"
        onClick={() => tryOpen()}
        onKeyDown={onKeyDown}
      >
        {rows.valueOf(field.name) || <span className="field-row-placeholder">{field.placeholder ?? ''}</span>}
      </div>

      <div className="field-row-edit" data-testid={`edit-${field.name}`} hidden={!open}>
        <Editor
          field={field}
          value={rows.valueOf(field.name)}
          testId={`input-${field.name}`}
          focusRef={focusRef}
          onRequestClose={() => rows.close(field.name)}
          // THE ROW APPLIES THE GUARD, NOT THE EDITOR. An editor proposes a
          // value; the declared constraint is enforced here, on the WHOLE
          // candidate, so a paste is guarded the same as a keystroke and a
          // rejection is a no-op rather than a mangling. An editor that wanted
          // to skip the guard has nowhere to do it.
          onChange={(next) => { if (acceptsValue(field.inputMode, next)) rows.setDraft(field.name, next) }}
        />
        <button type="button" data-testid={`discard-${field.name}`}
          onClick={() => rows.discard(field.name)}>Discard</button>
      </div>
    </div>
  )
}
