import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { FieldDescriptor, FieldRowsController } from './types'

// ── THE KEYSTROKE GUARD, KEYED ON inputMode ──────────────────────────────
//
// The contract's closing section: the numeric guard is keyed on `inputmode`
// since Round 41's U1, and a React port MUST keep that keying, because the
// finding behind it was that a per-field guard is a to-do list that has to be
// completed again on every new field.
//
// So the guard is a property of what the field DECLARES, never a list of field
// names. A new numeric field inherits it by declaring `inputMode: 'numeric'`
// and nothing here changes.
//
// Field-specific EDITORS - dates, staff pickers, currency - remain out of
// scope per the contract. This is the shared constraint, not an editor.
const ALLOWED: Partial<Record<string, RegExp>> = {
  numeric: /^-?\d*$/,
  decimal: /^-?\d*\.?\d*$/,
}

export function acceptsValue(inputMode: string | undefined, value: string): boolean {
  const rule = inputMode ? ALLOWED[inputMode] : undefined
  return rule ? rule.test(value) : true
}

// A seed is a single printable character typed with no command modifier.
// Enter and Space open WITHOUT a seed: they are "open this", not "type this".
function seedFrom(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  return e.key.length === 1 ? e.key : null
}

export function FieldRow({ field, rows }: { field: FieldDescriptor; rows: FieldRowsController }) {
  const open = rows.isOpen(field.name)
  const dirty = rows.isDirty(field.name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus follows the door opening, so a keyboard user who typed into a closed
  // row is left with a caret in the input rather than a row they must find
  // again. Runs only on the open transition.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      inputRef.current?.focus()
      const n = inputRef.current?.value.length ?? 0
      inputRef.current?.setSelectionRange(n, n)
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

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryOpen(); return }
    // BEHAVIOUR 4: the seed character. preventDefault stops the browser also
    // delivering it somewhere, and the character is handed to the door so it
    // lands in the input rather than being lost between the two.
    const seed = seedFrom(e)
    if (seed && acceptsValue(field.inputMode, seed)) { e.preventDefault(); tryOpen(seed) }
  }

  return (
    <div className="field-row" data-field={field.name} data-dirty={dirty ? 'true' : 'false'}>
      <div className="field-row-label">{field.label}</div>

      {/* ── BEHAVIOUR 3: SWAP BY VISIBILITY, NEVER BY REMOVAL ──────────────
          Both halves are always in the document and `hidden` decides which is
          seen. A control that vanishes reads as "what did I just break".

          `hidden` rather than a class, and it is load-bearing twice over: a
          hidden element is not focusable, so the closed row's input cannot be
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
        <input
          ref={inputRef}
          data-testid={`input-${field.name}`}
          value={rows.valueOf(field.name)}
          inputMode={field.inputMode}
          onChange={(e) => {
            // The declared constraint is applied to the WHOLE candidate value,
            // not to the keystroke, so a paste is guarded the same as a typed
            // character and the rejection is a no-op rather than a mangling.
            if (acceptsValue(field.inputMode, e.target.value)) rows.setDraft(field.name, e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); rows.close(field.name) }
          }}
        />
        <button type="button" data-testid={`discard-${field.name}`}
          onClick={() => rows.discard(field.name)}>Discard</button>
      </div>
    </div>
  )
}
