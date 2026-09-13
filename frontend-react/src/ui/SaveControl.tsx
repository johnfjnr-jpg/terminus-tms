// ── S4, IN ONE PLACE ─────────────────────────────────────────────────────
//
// > Save disabled until dirty, enables on change; Discard reverts the unsaved
// > edit. Same everywhere.
//
// Phase 0 measured four panels implementing "the same" four different ways,
// and only four of eight offering a Discard at all. A pair of buttons is not
// worth a component; ONE DEFINITION OF WHAT DIRTY MEANS TO A CONTROL is.
//
// ── ONE TREATMENT ACROSS PANELS, AND THE RECORD BAR KEEPS ITS OWN ────────
//
// S5 says "one button treatment ACROSS PANELS", and that is the scope taken
// here: panel-scoped actions are all `.btn-sm`. The record action bar keeps
// `btn-primary` against `btn-ghost`, because INTERACTION_STANDARDS Section 10
// records that distinction as deliberate - "there is one primary action on
// this panel" - and Verification 23 says to search for an existing decision
// before taking a new one. Flattening the bar would supersede that ruling
// without anybody deciding to.
export function SaveControl({
  dirty, busy, onSave, onDiscard, saveLabel, testidBase, saveTestid, discardTestid,
}: {
  dirty: boolean
  busy?: boolean
  onSave: () => void
  /** Reverts to the loaded value. S4 names it, and half the panels lacked it. */
  onDiscard: () => void
  saveLabel?: string
  testidBase: string
  /**
   * EXPLICIT TESTIDS, because a shared control must not rename its callers'
   * hooks. Deriving `${testidBase}-save` would have renamed the Summary
   * panel's Save from `lead-summary-save-<id>`, and SIX probe files across
   * four earlier rounds address it by that name. They would have failed as
   * TIMEOUTS, which read like product defects rather than a rename.
   *
   * Verification 41's disposition rule: every caller of a superseded name is
   * listed and given a disposition. The disposition here is KEPT, because a
   * rename buys nothing and costs six probes.
   */
  saveTestid?: string
  discardTestid?: string
}) {
  const saveId = saveTestid ?? `${testidBase}-save`
  const discardId = discardTestid ?? `${testidBase}-discard`
  return (
    <>
      {/* DISCARD FIRST IN THE DOM, so tab order reaches the reversible action
          before the committing one, and Save sits closest to the panel's
          right edge where S1 puts the primary. */}
      {dirty
        ? <button type="button" className="btn-sm" data-testid={discardId}
            onClick={onDiscard}>Discard</button>
        : null}
      <button type="button" className="btn-sm" data-testid={saveId}
        disabled={!dirty || !!busy} onClick={onSave}>
        {busy ? 'Saving...' : (saveLabel ?? 'Save')}
      </button>
    </>
  )
}
