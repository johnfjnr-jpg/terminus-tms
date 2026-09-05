import type { FieldRowsController } from './types'

// ── BEHAVIOUR 6: THE BAR IS A PROPERTY OF THE SURFACE ────────────────────
//
// It takes the controller, which holds every draft on the surface, and the
// count it shows is computed across all of them. A row cannot own this: a bar
// per row could only ever count one field.
//
// It is a separate component from FieldRow for the same reason, so that
// "the row cannot own the bar" is true structurally rather than by convention.
export function EditBar({ rows, onSave }: {
  rows: FieldRowsController
  onSave: (changes: Record<string, string>) => void
}) {
  const n = rows.dirtyCount
  return (
    <div className="field-edit-bar" data-testid="edit-bar" hidden={n === 0}>
      <span data-testid="dirty-count">{n === 1 ? '1 change' : `${n} changes`}</span>
      <button type="button" data-testid="save-all" onClick={() => onSave(rows.changes)}>
        Save changes
      </button>
      <button type="button" data-testid="discard-all" onClick={() => rows.discardAll()}>
        Discard all
      </button>
    </div>
  )
}
