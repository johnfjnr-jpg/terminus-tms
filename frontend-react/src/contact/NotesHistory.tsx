// ── N1 TO N9: THE NOTES HISTORY ──────────────────────────────────────────
import { useRef, useState } from 'react'
import type { Note } from './notes'

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
  const [lastReset, setLastReset] = useState(resetKey)
  const inFlight = useRef(false)

  // N9. The input lives outside the rendered list, so like the vanilla's it
  // survives a re-render and must be cleared explicitly - or a half-typed note
  // follows the person onto the next contact.
  if (resetKey !== lastReset) {
    setLastReset(resetKey)
    if (open || text) { setOpen(false); setText('') }
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

      <div className="cd-notes-list" data-testid="cd-notes-list">
        {notes.length === 0
          ? <p className="empty-state" data-testid="cd-notes-empty">No notes yet.</p>
          : notes.map((n, i) => (
            <div className="ref-notes-row" data-testid={`cd-note-${i}`} key={`${n.at}-${i}`}>
              <span className="ref-notes-when">{n.at}</span>
              <span className="ref-notes-author">{n.by || '--'}</span>
              <span className="ref-notes-text">{n.text}</span>
            </div>))}
      </div>
    </div>
  )
}
