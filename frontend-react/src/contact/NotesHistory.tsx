// ── N1 TO N9: THE NOTES HISTORY ──────────────────────────────────────────
import { useRef, useState } from 'react'
import type { Note } from './notes'

/** P3, ruled: the list opens showing the latest two. */
export const DEFAULT_SHOWN = 2
/** The middle rung. `Infinity` is All, and renders every note. */
export const EXPANDED_SHOWN = 10

/** N1: when, who, what - and an empty state that says so. */
export function NotesHistory({ notes, onAdd, hasDirtyEdits, onConfirmDiscard, resetKey }: {
  notes: readonly Note[]
  /** Resolves false when the write was refused, so the text can stay put. */
  onAdd: (text: string) => Promise<boolean>
  hasDirtyEdits: boolean
  onConfirmDiscard: (proceed: () => void) => void
  /** N9: changes per navigation, so a stale open input cannot persist. */
  resetKey?: unknown
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
      <div className="cd-notes-header-row" data-testid="cd-notes-header-row">
        <span className="label">Notes history · latest first</span>
        {!open
          ? <button type="button" data-testid="cd-add-note-btn" onClick={onClick}>Add note</button>
          : null}
      </div>

      {open
        ? <div className="cd-note-input-wrap" data-testid="cd-note-input-wrap">
            <textarea
              data-testid="cd-new-note-input"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)} />
            <button type="button" data-testid="cd-add-note-btn"
              disabled={!text.trim()} onClick={onClick}>Add note</button>
            <button type="button" data-testid="cd-note-discard"
              onClick={() => { setOpen(false); setText('') }}>Discard</button>
          </div>
        : null}

      {/* P3: the expand controls. Rendered only when there is something to
          expand TO - a lead with two notes has nothing behind the fold, and a
          control that changes nothing is worse than none. The count is stated
          so a person knows what they are not seeing. */}
      {notes.length > DEFAULT_SHOWN
        ? <div className="cd-notes-expand" data-testid="cd-notes-expand">
            <span className="sub" data-testid="cd-notes-shown">
              {`Showing ${Math.min(shown, notes.length)} of ${notes.length}`}
            </span>
            <button type="button" data-testid="cd-notes-show-2"
              disabled={shown === DEFAULT_SHOWN}
              onClick={() => setShown(DEFAULT_SHOWN)}>Latest 2</button>
            <button type="button" data-testid="cd-notes-show-10"
              disabled={shown === EXPANDED_SHOWN}
              onClick={() => setShown(EXPANDED_SHOWN)}>Last 10</button>
            <button type="button" data-testid="cd-notes-show-all"
              disabled={shown === Infinity}
              onClick={() => setShown(Infinity)}>All</button>
          </div>
        : null}

      <div className="cd-notes-list" data-testid="cd-notes-list">
        {notes.length === 0
          ? <p className="empty-state" data-testid="cd-notes-empty">No notes yet.</p>
          : notes.slice(0, shown).map((n, i) => (
            <div className="ref-notes-row" data-testid={`cd-note-${i}`} key={`${n.at}-${i}`}>
              <span className="ref-notes-when">{n.at}</span>
              <span className="ref-notes-author">{n.by || '--'}</span>
              <span className="ref-notes-text">{n.text}</span>
            </div>))}
      </div>
    </div>
  )
}
