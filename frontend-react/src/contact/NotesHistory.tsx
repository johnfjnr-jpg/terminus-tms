// ── N1 TO N9: THE NOTES HISTORY ──────────────────────────────────────────
import { useRef, useState } from 'react'
import type { Note } from './notes'
// R7: the one formatter. This site is the raw ISO Phase 0 photographed on
// the lead card, and it reaches the card, Lead Detail and the Test Bed from
// this single line - which is why R2 ruled the fix through the frozen surface.
import { formatTimestamp } from '../../../src/lib/format-dates.js'

/** P3, ruled: the list opens showing the latest two. */
export const DEFAULT_SHOWN = 2
/** The middle rung. `Infinity` is All, and renders every note. */
export const EXPANDED_SHOWN = 10

/** N1: when, who, what - and an empty state that says so. */
export function NotesHistory({ notes, onAdd, hasDirtyEdits, onConfirmDiscard, resetKey, actionsInHeader = false, title }: {
  notes: readonly Note[]
  /** Resolves false when the write was refused, so the text can stay put. */
  onAdd: (text: string) => Promise<boolean>
  hasDirtyEdits: boolean
  onConfirmDiscard: (proceed: () => void) => void
  /** N9: changes per navigation, so a stale open input cannot persist. */
  resetKey?: unknown
  /**
   * R5: ADD NOTE AND DISCARD ON THE HEADER LINE.
   *
   * The card wants both controls on the NOTES header row; Lead Detail keeps
   * them where they are, under the editor. Optional and defaulting to the
   * existing layout, so the FROZEN surface is untouched - the same pattern
   * LinkAccountPanel has now carried three times.
   *
   * The Discard is a cancel-THIS-NOTE, which is what it already does
   * (`setOpen(false); setText('')`). Only its placement moves.
   */
  actionsInHeader?: boolean
  /**
   * R3: THE TITLE ON THE HEADER LINE.
   *
   * The card used to render `<div class="lead-card-col-title">Notes</div>` as
   * a SIBLING above this component, so the column read title / then a row of
   * controls / then the input - and the input sat 36px below the Summary
   * column's field beside it. John's word for it was "slapdash".
   *
   * Given, the title becomes the first item on the header row and the row
   * carries `card-col-head`, the shared header-line class, so the field below
   * starts at the same y as every other column's. Omitted, nothing changes -
   * which is what keeps FROZEN Lead Detail and the Test Bed untouched.
   *
   * THREE CONSUMERS, NOT TWO: LeadCard, ContactHost and TestBedHost. R8 names
   * the constraint and this prop is how it is met.
   */
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  // P3: HOW MANY ARE SHOWN. Ruled: latest first, DEFAULT LAST 2, expandable to
  // 10 and to All. P1 measured both gaps - `notes.map(...)` had no slice, so
  // every note rendered and no expand control existed.
  //
  // A NUMBER, NOT A BOOLEAN, because there are three states and a pair of
  // booleans would admit a fourth that means nothing.
  const [shown, setShown] = useState<number>(DEFAULT_SHOWN)
  const [lastReset, setLastReset] = useState(resetKey)
  const inFlight = useRef(false)
  // A stable id for the region the expand rungs control. The list renders many
  // cards at once, so it is keyed on the reset key rather than a constant -
  // duplicate ids across cards would make aria-controls point at the wrong
  // notes and would trip no-duplicate-ids.test.mjs.
  const notesListId = `cd-notes-list-${String(resetKey ?? 'x')}`

  // N9. The input lives outside the rendered list, so like the vanilla's it
  // survives a re-render and must be cleared explicitly - or a half-typed note
  // follows the person onto the next contact.
  if (resetKey !== lastReset) {
    setLastReset(resetKey)
    if (open || text) { setOpen(false); setText('') }
    // The expansion is per-visit too: arriving at a lead shows the latest two,
    // whatever the last lead was left expanded to.
    setShown(DEFAULT_SHOWN)
  }

  const submit = async () => {
    const t = text.trim()
    if (!t || inFlight.current) return
    inFlight.current = true
    try {
      // N6: the text stays put on a refusal. Only a success clears it.
      if (await onAdd(t)) { setText(''); setOpen(false) }
    } finally { inFlight.current = false }
  }

  // N2: ONE control, two jobs. Idle it opens; open and non-empty it submits;
  // open and EMPTY it is disabled, so the empty state cannot reach the submit
  // branch at all. That is what makes one button safe rather than two.
  const onClick = () => {
    if (!open) { setOpen(true); return }
    // N7: the add ends in a reload, which would discard another open field.
    if (hasDirtyEdits) { onConfirmDiscard(() => { void submit() }); return }
    void submit()
  }

  return (
    <div data-testid="cd-notes">
      <div className={`cd-notes-header-row${title ? ' card-col-head' : ''}`}
        data-testid="cd-notes-header-row">
        {title
          ? <span className="lead-card-col-title" data-testid="cd-notes-title">{title}</span>
          : null}
        {/* The panel's own title now says NOTES (P3), so this says only what
            the title cannot: the order. "Notes history · latest first" under a
            heading reading NOTES was the same word twice. */}
        <span className="label">Latest first</span>
        {/* R8: CLASSED. These shipped unclassed, so they rendered as white
            browser defaults on a dark screen - F3's instances on this card,
            found by opening a screenshot and invisible to every assertion the
            estate writes. Their height is also what sets the alignment: a
            bare button is 21px and `.btn-sm` is a known height, so the header
            line and the Summary column's can be equal by construction.
            Classing reaches all three consumers, which is a treatment fix
            rather than a structural change and is stated in the report. */}
        {!open || actionsInHeader
          ? <button type="button" className="btn-sm" data-testid="cd-add-note-btn"
              disabled={open && !text.trim()} onClick={onClick}>Add note</button>
          : null}
        {actionsInHeader && open
          ? <button type="button" className="btn-sm" data-testid="cd-note-discard"
              onClick={() => { setOpen(false); setText('') }}>Discard</button>
          : null}
      </div>

      {open
        ? <div className="cd-note-input-wrap" data-testid="cd-note-input-wrap">
            <textarea
              className="cd-note-input"
              data-testid="cd-new-note-input"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)} />
            {/* R5: with the actions in the header these would be a SECOND
                Add note and a second Discard on the same card - the exact
                duplicate-control fault a screenshot caught in the Qualify
                account step last round. */}
            {actionsInHeader
              ? null
              : (
                <>
                  <button type="button" className="btn-sm" data-testid="cd-add-note-btn"
                    disabled={!text.trim()} onClick={onClick}>Add note</button>
                  <button type="button" className="btn-sm" data-testid="cd-note-discard"
                    onClick={() => { setOpen(false); setText('') }}>Discard</button>
                </>
              )}
          </div>
        : null}

      {/* P3: the expand controls. Rendered only when there is something to
          expand TO - a lead with two notes has nothing behind the fold, and a
          control that changes nothing is worse than none. The count is stated
          so a person knows what they are not seeing. */}
      {/* `aria-controls` on each rung, pointing at the list it changes. It is
          true - these buttons control that region - and it is what the door
          reads to know they are READ AFFORDANCES rather than writes.
          P4: on an unowned lead the door disabled all three, so a person who
          may not edit a lead could not expand its notes to READ them. The same
          shape as P3's collapse toggle, on the list this time. */}
      {notes.length > DEFAULT_SHOWN
        ? <div className="cd-notes-expand" data-testid="cd-notes-expand">
            <span className="sub" data-testid="cd-notes-shown">
              {`Showing ${Math.min(shown, notes.length)} of ${notes.length}`}
            </span>
            <button type="button" className="btn-sm" data-testid="cd-notes-show-2" aria-controls={notesListId}
              disabled={shown === DEFAULT_SHOWN}
              onClick={() => setShown(DEFAULT_SHOWN)}>Latest 2</button>
            <button type="button" className="btn-sm" data-testid="cd-notes-show-10" aria-controls={notesListId}
              disabled={shown === EXPANDED_SHOWN}
              onClick={() => setShown(EXPANDED_SHOWN)}>Last 10</button>
            <button type="button" className="btn-sm" data-testid="cd-notes-show-all" aria-controls={notesListId}
              disabled={shown === Infinity}
              onClick={() => setShown(Infinity)}>All</button>
          </div>
        : null}

      <div className="cd-notes-list" id={notesListId} data-testid="cd-notes-list">
        {/* R4: "No notes yet." REMOVED. It was `.empty-state`, a PAGE-level
            style - `padding: 40px 0`, centred - used inside a 12px card
            column, measured at 101px. The empty area already says there are
            no notes, and at 1920 and 3440 that sentence was what drove the
            card's height, so removing it is also R5 (measured: 57px). */}
        {notes.slice(0, shown).map((n, i) => (
            <div className="ref-notes-row" data-testid={`cd-note-${i}`} key={`${n.at}-${i}`}>
              <span className="ref-notes-when">{formatTimestamp(n.at)}</span>
              <span className="ref-notes-author">{n.by || '--'}</span>
              <span className="ref-notes-text">{n.text}</span>
            </div>))}
      </div>
    </div>
  )
}
