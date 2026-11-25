// ── "MODIFIED, NOT SAVED": ONE STRIP, BOTH PRICING TABS ──────────────────
//
// TQ_RESTORE ruling S (John, 2026-11-25): the Term quote tab REUSES the
// Commercials strip, its markup and classes. It was inline in DealStatement
// (C2); it is lifted here unchanged so the two tabs render one component and
// cannot drift. The words, the classes and the test ids are the Commercials
// strip's exactly.
//
// The caller renders it only when dirty: a bar that is always there stops
// being read (C2's own reasoning, kept with the CSS at .stmt-unsaved).
export function UnsavedStrip({ onReset, onSave, saving }: { onReset: () => void, onSave: () => void, saving?: boolean }) {
  return (
    <div className="stmt-unsaved" data-testid="stmt-unsaved" role="status">
      <span className="stmt-unsaved-text">Modified, not saved</span>
      <button type="button" className="btn-sm" data-testid="stmt-reset"
        onClick={onReset}>Reset</button>
      <button type="button" className="btn-sm btn-primary" data-testid="stmt-save"
        disabled={saving || undefined} onClick={onSave}>Save changes</button>
    </div>
  )
}
