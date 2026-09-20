// ── N1 TO N9: THE NOTES HISTORY ──────────────────────────────────────────
import { useRef, useState } from 'react'
import type { Note } from './notes'
// R7: the one formatter. This site is the raw ISO Phase 0 photographed on
// the lead card, and it reaches the card, Lead Detail and the Test Bed from
// this single line - which is why R2 ruled the fix through the frozen surface.
import { formatTimestamp } from '../../../src/lib/format-dates.js'
import { Panel } from '../ui/Panel'

/** P3, ruled: the list opens showing the latest two. */
export const DEFAULT_SHOWN = 2
/** The middle rung. `Infinity` is All, and renders every note. */
export const EXPANDED_SHOWN = 10

/** N1: when, who, what - and an empty state that says so. */
export function NotesHistory({ notes, onAdd, hasDirtyEdits, onConfirmDiscard, resetKey, actionsInHeader = false, title }: {
  notes: readonly Note[]
  /** Resolves false when the write was refused, so the text can stay put. */
  onAdd: (text: string) => Promise<boolean>
  /**
   * V4: OPTIONAL, and the Contact no longer passes them. A surface supplies
   * these only when its own note write genuinely loses open drafts - which the
   * Contact's does not, measured live.
   */
  hasDirtyEdits?: boolean
  onConfirmDiscard?: (proceed: () => void) => void
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
    // ── V4: A SAVE NEVER THREATENS A DISCARD ──────────────────────────
    //
    // This read: `if (hasDirtyEdits) { onConfirmDiscard(...) }`, on N7's
    // premise that "the add ends in a reload, which would discard another open
    // field."
    //
    // THE PREMISE IS FALSE, measured rather than reasoned. `useFieldRows` drops
    // drafts only when the SUBJECT changes, and a reload of the same record
    // does not change it. Driven live with a field genuinely dirty: accepting
    // the dialogue and letting the note save leaves the edit ON SCREEN and
    // still counted. The dialogue asked a person to accept a loss that does not
    // happen, and named the button that proceeds "Discard".
    //
    // Reproduced first, four ways, so the condition is known rather than
    // guessed: a fresh record, a field opened but not typed in, a field typed
    // in then Escaped, and a second note all raise NOTHING. Only a genuinely
    // dirty field did.
    //
    // Verification 29: the premise failed, so the decision is re-taken rather
    // than re-weighed, and the superseded reasoning is left above.
    //
    // THE PROPS STAY AND BECOME OPTIONAL, because the question they answer
    // belongs to the HOST rather than to this component: whether a write loses
    // drafts is a property of the surface doing the writing. The Contact stops
    // passing them; the Test Bed keeps them, because its own write path has not
    // been measured and removing a guard on an unmeasured path is how a real
    // loss ships.
    if (hasDirtyEdits && onConfirmDiscard) { onConfirmDiscard(() => { void submit() }); return }
    void submit()
  }

  // The two header controls, lifted out so ONE definition serves both the
  // shell path and the original one. Two copies would be Verification 20 in
  // the file that this round exists to stop repeating.
  // A1: THE EXPAND RUNGS BELONG ON THE HEADER LINE, beside Add note. They were
  // below the input, which put the note controls on two lines and left the
  // header saying only "Latest first". S1/S2 is the standard and this is where
  // it was unapplied.
  //
  // Rendered only when there is something to expand TO - unchanged, and the
  // reason is unchanged: a lead with two notes has nothing behind the fold,
  // and a control that changes nothing is worse than none.
  const rungs = notes.length > DEFAULT_SHOWN
    ? (
      // ── THESE THREE DECLARE THEMSELVES AS A VIEW SELECTOR ──────────────
      //
      // `role="tablist"` and `role="tab"`, added by the Opportunity round
      // 2026-09-19, and the reason is a RED GATE rather than tidiness.
      //
      // They are READ affordances: they change how much of one list is shown
      // and they write nothing. A door that neutralises them on somebody
      // else's record does not protect the record, it stops a person reading
      // it, which is the one thing the door must never do.
      //
      // The estate's shared control classifier decides what a door may kill,
      // and it exempts a control that DECLARES itself navigation, by
      // `role="tab"`. These carried only `aria-controls`, which the classifier
      // does not read, so the moment this card reached the Opportunity the
      // read-only probe reported "3 controls are still typeable on another
      // user's record" and the round gate went RED. The controls were right
      // and their declaration was incomplete.
      //
      // DECLARED RATHER THAN EXEMPTED, which is the choice worth recording.
      // The alternative was to teach the shared classifier that
      // `aria-controls` means read-only. Measured on the failing view, 22
      // controls carry that attribute and not one is a write, so it would have
      // worked today; it also widens a SECURITY classifier six instruments
      // share, on the strength of a census taken once. A group of mutually
      // exclusive views over one region IS a tablist, so saying so costs
      // nothing and changes no guard.
      <span className="cd-notes-expand" data-testid="cd-notes-expand" role="tablist">
        <button type="button" role="tab" className="btn-sm" data-testid="cd-notes-show-2"
          aria-controls={notesListId} aria-selected={shown === DEFAULT_SHOWN}
          disabled={shown === DEFAULT_SHOWN}
          onClick={() => setShown(DEFAULT_SHOWN)}>2</button>
        <button type="button" role="tab" className="btn-sm" data-testid="cd-notes-show-10"
          aria-controls={notesListId} aria-selected={shown === EXPANDED_SHOWN}
          disabled={shown === EXPANDED_SHOWN}
          onClick={() => setShown(EXPANDED_SHOWN)}>10</button>
        <button type="button" role="tab" className="btn-sm" data-testid="cd-notes-show-all"
          aria-controls={notesListId} aria-selected={shown === Infinity}
          disabled={shown === Infinity}
          onClick={() => setShown(Infinity)}>All</button>
      </span>
    )
    : null

  // ── R-W1: THE COUNT JOINS THE TOP LINE ────────────────────────────────
  //
  // Ruled by John 2026-09-20. It read `Showing 2 of 3` on its own line below
  // the header; it now reads `2 of 3` beside the controls. "Showing" is
  // dropped because the line has no room for a word that says nothing the
  // figures do not.
  //
  // MEASURED FIRST, AND THE RULING IS WHAT MADE IT FIT. Phase 0 measured the
  // requested line at 533px against 385px at 1440 and 311px at 1240 - over by
  // 148 and 222. Removing the secondary and shortening the rungs is what
  // bought the room back; the count alone would not have.
  const countLine = notes.length > DEFAULT_SHOWN
    // NOT `.sub`, AND THE REASON IS MEASURED. `.sub` is a page subtitle -
    // 14px with `margin: 0 0 32px` - which was harmless while the count sat on
    // its own line under the list, because the margin just separated it. On a
    // flex line with `align-items: center` the MARGIN BOX is what gets
    // centred, so a 32px bottom margin lifts the text exactly 16px above its
    // neighbours. Measured: centres spread 16px on all three surfaces, at both
    // widths, with the row reading 53px where one line is 30.
    //
    // The role changed when the count moved onto the line, and a class carries
    // a role. This one is its own.
    ? <span className="cd-notes-count" data-testid="cd-notes-shown">
        {`${Math.min(shown, notes.length)} of ${notes.length}`}
      </span>
    : null

  const actions = (
    <>
      {countLine}
      {rungs}
      {/* A2: ONE CONTROL, TWO ACTIONS, and the label now says which one it is
          about to do. `onClick` already opened when closed and COMMITTED when
          open - measured before changing anything - so this is the label
          catching up with the behaviour, not a new behaviour. The save path is
          untouched. */}
      {!open || actionsInHeader
        ? <button type="button" className="btn-sm" data-testid="cd-add-note-btn"
            disabled={open && !text.trim()} onClick={onClick}>{open ? 'Save' : 'Add note'}</button>
        : null}
      {actionsInHeader && open
        ? <button type="button" className="btn-sm" data-testid="cd-note-discard"
            onClick={() => { setOpen(false); setText('') }}>Discard</button>
        : null}
    </>
  )

  const body = (
    <>

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
                    disabled={!text.trim()} onClick={onClick}>Save</button>
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


      {/* A1: the COUNT stays, just not on the header line. It was the widest
          item there - `.panel-head` is a fixed-height flex row with no wrap,
          so with the rungs beside it the header overflowed its third of the
          card and sat on top of the next column. Measured: `elementFromPoint`
          over Add note returned the FOLLOW-UP card's title.

          R-O2, 2026-09-20: DROPPING THE SECONDARY WAS NOT ENOUGH ON ITS OWN,
          and A1 could not have known because it measured one width. With the
          secondary already gone the collapsed row still ran 34px past the card
          at 1240 on the Opportunity and 47px on the lead card, with ADD NOTE
          clipped against the neighbour in the screenshot. `.panel-head` now
          wraps for this one header, scoped on `data-panel-header`, so the row
          is one line where it fits and two where it does not. A1's drop stays:
          remeasured at R-O2, the secondary needs 436px against a 372px lead
          card, so it still does not fit. */}
      {/* R-W1: THE COUNT HAS MOVED ONTO THE HEADER LINE and is rendered once,
          in `countLine` above. A2's note about it staying "just not on the
          header line" is superseded by John's ruling of 2026-09-20: the
          header now has room for it, because the secondary is gone and the
          rungs are shorter. Rendering it in both places would be two elements
          answering to one testid, which is how a probe comes to measure the
          wrong one. */}

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
    </>
  )

  // ── THE SHELL, TAKEN THROUGH AN OPTIONAL PROP ─────────────────────────
  //
  // CORRECTED AT R-O2, 2026-09-20, AND THE SUPERSEDED COUNT IS LEFT VISIBLE
  // BECAUSE IT WAS TRUE WHEN WRITTEN AND THIS ROUND IS WHAT FALSIFIED IT.
  // It read:
  //
  //   "THREE CONSUMERS: the lead card, ContactHost (FROZEN Lead Detail) and
  //    TestBedHost. Only the card passes `title`, so only the card routes
  //    through `Panel`."
  //
  // FOUR CONSUMERS, and TWO route through `Panel`. R-O2 gave the Opportunity's
  // notes the same collapsed header, so `ReferenceHost` now passes `title` and
  // `actionsInHeader` as the lead card does; `OpportunityBand` places the
  // element `ReferenceHost` builds rather than building its own.
  //
  // A COUNT IN A COMMENT IS A CLAIM WITH A SHELF LIFE (Architecture 9's fourth
  // variant): nothing derives it, so nothing can falsify it, and it sat one
  // consumer out of date the moment a second caller passed `title`. It is kept
  // as a count anyway because the SET is the useful part - which surfaces wear
  // this header is what the next person needs - and it is written next to the
  // prop that decides it.
  //
  // ContactHost and TestBedHost render the markup they always did, which is
  // what "structurally untouched" has to mean - not "changed carefully".
  //
  // The header keeps its existing testid, so the tests that already assert
  // against this panel go on asserting against the same thing.
  if (title) {
    // A1: "Latest first" gives way to the rungs when there are rungs. The
    // column is a third of a card and cannot hold NOTES + Latest first + three
    // rungs + Add note: measured, the secondary wrapped to two lines and Add
    // note was clipped at the column edge.
    //
    // ── SUPERSEDED BY R-W1, 2026-09-20, AND A1'S OWN TEXT IS KEPT ABOVE ──
    //
    // A1 read on: "The rungs say 'Latest 2' and 'Last 10', so the ordering is
    // still stated - by the controls rather than beside them. With no rungs
    // the secondary returns." Both halves are now false and both were
    // falsified deliberately: the rungs read '2' and '10', and the secondary
    // never returns because John removed it estate-wide.
    //
    // The premise did not fail - A1 was right that the line could not hold it.
    // The DECISION changed: the ordering is carried by each row's own date, so
    // the line was spending 88px to say what the content already says.
    return (
      <Panel name="notes" title={title} actions={actions}
        testid="cd-notes" headerTestid="cd-notes-header-row">
        {body}
      </Panel>
    )
  }

  return (
    <div data-testid="cd-notes">
      <div className="cd-notes-header-row" data-testid="cd-notes-header-row">
        {/* R-W1: 'Latest first' REMOVED here too, which is what "estate-wide"
            means. This path has no panel title, so the row is the controls
            alone. The ordering is unchanged; each row carries its own date. */}
        {actions}
      </div>
      {body}
    </div>
  )
}
