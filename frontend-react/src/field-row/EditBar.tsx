import type { FieldRowsController } from './types'

// ── BEHAVIOUR 6: THE BAR IS A PROPERTY OF THE SURFACE ────────────────────
//
// It takes the controller, which holds every draft on the surface, and the
// count it shows is computed across all of them. A row cannot own this: a bar
// per row could only ever count one field.
//
// It is a separate component from FieldRow for the same reason, so that
// "the row cannot own the bar" is true structurally rather than by convention.
// ── saveId, Round 6 Phase 0 ──────────────────────────────────────────────
//
// The shell's reason dialogue returns focus by ELEMENT ID, so a surface that
// opens one from Save has to be able to name its own Save control. It is a
// prop rather than a constant because the bar is shared and a fixed id would
// be a duplicate the moment two surfaces render at once - which is behaviour
// 6 read the right way round: the bar belongs to the surface, so the surface
// names it.
export function EditBar({ rows, onSave, saveId }: {
  rows: FieldRowsController
  onSave: (changes: Record<string, string>) => void
  saveId?: string
}) {
  const n = rows.dirtyCount
  return (
    <div className="field-edit-bar" data-testid="edit-bar" hidden={n === 0}>
      <span data-testid="dirty-count">{n === 1 ? '1 change' : `${n} changes`}</span>
      <button type="button" id={saveId} data-testid="save-all" onClick={() => onSave(rows.changes)}>
        Save changes
      </button>
      <button type="button" data-testid="discard-all" onClick={() => rows.discardAll()}>
        Discard all
      </button>
    </div>
  )
}
