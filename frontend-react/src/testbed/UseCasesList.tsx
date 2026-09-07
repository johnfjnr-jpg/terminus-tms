// ── U: THE USE-CASE LIST ────────────────────────────────────────────────
//
// Round 7 Phase 2b. The rendering surface for the U capability's logic.
//
// It lives on the Reference tab, where the vanilla renders it from
// initTestBedDetailPanel - not on a stage tab.
import { useState } from 'react'
import { addUseCase, removeUseCase } from './useCases'

export function UseCasesList({ useCases, onWrite }: {
  useCases: readonly string[] | undefined
  /** U2: the WHOLE list, because that is what the record holds. */
  onWrite: (next: string[]) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const list = Array.isArray(useCases) ? useCases : []

  const run = async (next: string[] | null) => {
    if (!next || busy) return
    setBusy(true)
    try { if (await onWrite(next)) setText('') } finally { setBusy(false) }
  }

  return (
    <div data-testid="tb-usecases">
      <p className="label">Use cases</p>
      <div data-testid="tb-usecases-list">
        {list.length
          ? list.map((uc, i) => (
            // U4's limit is live here: remove-by-index is correct only against
            // the list this render was built from. The record PATCH's revision
            // precondition catches the RECORD having moved; it does not make
            // the index right. Recorded at the site rather than fixed, because
            // fixing it means identifying a use case by something other than
            // its position, which is a data change.
            <div className="data-row" key={`${i}-${uc}`} data-testid={`tb-usecase-${i}`}>
              <span>{uc}</span>
              <button type="button" className="btn-text" disabled={busy}
                data-testid={`tb-usecase-remove-${i}`}
                onClick={() => { void run(removeUseCase(useCases, i)) }}>Remove</button>
            </div>))
          : <p className="empty-state" data-testid="tb-usecases-empty">No use cases yet.</p>}
      </div>
      <input value={text} disabled={busy}
        data-testid="tb-usecase-input"
        onChange={(e) => setText(e.target.value)} />
      <button type="button" data-testid="tb-usecase-add" disabled={busy}
        onClick={() => { void run(addUseCase(useCases, text)) }}>Add</button>
    </div>
  )
}
