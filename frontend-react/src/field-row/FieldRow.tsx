import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { FieldDescriptor, FieldRowsController } from './types'
import { acceptsValue, displayValueFor, editorFor, editorTakesSeed } from './editors'

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
// The display half of an EMPTY row must still have height, or the row cannot
// be clicked. The vanilla renders this for every empty field; a row whose
// descriptor declares its own placeholder overrides it.
const EMPTY_DISPLAY = '--'

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
          {displayValueFor(field)
            ? <>{displayValueFor(field)}{field.suffix ? <span className="field-row-suffix"> {field.suffix}</span> : null}</>
            : <span className="field-row-placeholder">{field.placeholder ?? EMPTY_DISPLAY}</span>}
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
      {/* ── A12: A REFUSED ROW DROPS ITS TAB STOP ───────────────────────
          Behaviour 7's own logic, for the second cause of the same condition:
          a stop that cannot be acted on is a stop that lies. The read-only
          variant above has no tabIndex at all; here the row still RENDERS and
          still reads, it simply stops being a stop.

          Measured on the vanilla in Phase 0b: its door was PRESENTATIONAL -
          the mouse was blocked and the keyboard was not, so a refused row took
          focus and then refused. This refuses on both paths, and now does not
          invite the keyboard either. */}
      <div
        className="field-row-display"
        data-testid={`display-${field.name}`}
        hidden={open}
        tabIndex={rows.canEdit ? 0 : undefined}
        role="button"
        onClick={() => tryOpen()}
        onKeyDown={onKeyDown}
      >
        {/* A9: THE DRAFT, RESOLVED. This path renders rows.valueOf rather
            than field.value, so it needs the same resolution - and it is the
            path every real surface uses. Passing the live value through the
            descriptor is what makes a lookup re-read as its new NAME the
            moment the choice changes, rather than after a save and reload. */}
        {displayValueFor({ ...field, value: rows.valueOf(field.name) })
          ? <>
              {displayValueFor({ ...field, value: rows.valueOf(field.name) })}
              {/* A3: DISPLAY ONLY. It is appended here and never by an editor,
                  because a suffix that reached the value would make
                  `draft !== orig` wrong on the first save. */}
              {field.suffix ? <span className="field-row-suffix"> {field.suffix}</span> : null}
            </>
          : <span className="field-row-placeholder">{field.placeholder ?? EMPTY_DISPLAY}</span>}
      </div>

      {/* A2, Leads round: THE OPEN EDITOR CLOSES WHEN FOCUS LEAVES THE ROW.
          MEASURED FIRST, not assumed. The brief calls this a "focus highlight"
          that persists after moving to another field. There is no CSS focus
          rule on this row - measured live, what persists is the OPEN EDITOR:
          open `company`, then open `jobRole`, and company reads `open: true`
          with focus on `input-jobRole`. The editor is the highlight.

          IT CLOSES, IT DOES NOT REVERT. `rows.close` and not the Escape path:
          the draft lives in a different map and survives, so tabbing from one
          field to the next keeps both edits and the bar counts two. Wiring
          blur to the Escape path would revert on every field change and make
          multi-field editing impossible.

          `relatedTarget` is what keeps this from firing on its own controls: a
          blur INTO the same row - a select's option list, the row's own
          editor - is not leaving the row. A blur to nothing (relatedTarget
          null, as when the window loses focus) deliberately does NOT close
          either, because the person has not moved anywhere. */}
      <div
        className="field-row-edit"
        data-testid={`edit-${field.name}`}
        hidden={!open}
        onBlur={(e) => {
          if (!open) return
          const to = e.relatedTarget as Node | null
          if (!to) return
          if (e.currentTarget.contains(to)) return
          rows.close(field.name)
        }}
      >
        <Editor
          field={field}
          value={rows.valueOf(field.name)}
          testId={`input-${field.name}`}
          focusRef={focusRef}
          // A3, Leads round: ESCAPE REVERTS, THEN CLOSES. One site, all four
          // surfaces, per R3 - John ruled it knowing it reaches Test Bed,
          // Reference and Account as well as Lead.
          //
          // The order matters and is not arbitrary: discard first, so the row
          // closes onto the RESTORED value rather than closing and then
          // reverting something no longer on screen. Both are independent
          // setState calls - drafts and open are different maps - so React
          // batching them is harmless.
          //
          // SUPERSEDES the contract's "the row closes; it does NOT discard",
          // superseded in writing at MIGRATION_FIELD_ROW_CONTRACT.md rather
          // than left standing beside this.
          onRequestClose={() => { rows.discard(field.name); rows.close(field.name) }}
          // THE ROW APPLIES THE GUARD, NOT THE EDITOR. An editor proposes a
          // value; the declared constraint is enforced here, on the WHOLE
          // candidate, so a paste is guarded the same as a keystroke and a
          // rejection is a no-op rather than a mangling. An editor that wanted
          // to skip the guard has nowhere to do it.
          onChange={(next) => { if (acceptsValue(field.inputMode, next)) rows.setDraft(field.name, next) }}
        />
        {/* A1, Leads round: THE PER-FIELD DISCARD IS GONE, on all four
            surfaces at once. John ruled the blast radius knowingly - Contact,
            Test Bed, Reference and Account lose it together rather than the
            row being forked, per Architecture 1.

            `rows.discard(name)` SURVIVES and is not dead code: it is the
            revert-to-last-saved semantic, and A3 rebinds it to Escape. What
            goes is the button, not the behaviour.

            MEASURED AGAINST THE VANILLA, because the brief calls these
            regressions: the vanilla had this control too, as a `×` at
            contact-detail.js:520. So this is a NEW design rather than a
            recovery, and the vanilla is not its reference. */}
      </div>
    </div>
  )
}
