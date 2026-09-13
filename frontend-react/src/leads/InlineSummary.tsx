// ── THE SUMMARY PANEL, ROUTED THROUGH THE SHELL ──────────────────────────
//
// It used to render a textarea with a Save BELOW it, which Phase 0 measured
// as `save.top 573` against `field.bottom 567` and 314px from the panel's
// right edge. It was one of five save placements on one card.
//
// It now renders a `Panel`, and a Panel takes actions only through its
// header's slot - so this component could not put Save below the field
// again without deleting the shell.
//
// A WRITE, so the door reaches it: a real textarea and a real button, which
// is what `applyReadOnlyControls` knows how to neutralise.
import { useEffect, useRef, useState } from 'react'
import { Panel } from '../ui/Panel'
import { SaveControl } from '../ui/SaveControl'

export function InlineSummary({ value, leadId, onSave }: {
  value: string
  leadId: string
  onSave: (text: string) => Promise<boolean>
}) {
  const [text, setText] = useState(value)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  // The card re-renders from a refetch after any save on it, so the prop is
  // the truth whenever it changes underneath.
  useEffect(() => { setText(value) }, [value])

  // Save enables only when the text DIFFERS from what was loaded, not when
  // somebody has typed: typing a character and deleting it leaves the record
  // unchanged and must leave the button disabled.
  const dirty = text !== value
  const save = async () => {
    if (inFlight.current || !dirty) return
    inFlight.current = true
    setBusy(true)
    try { await onSave(text.trim()) } finally { inFlight.current = false; setBusy(false) }
  }

  return (
    <Panel
      name="summary"
      title="Summary"
      testid={`lead-summary-${leadId}`}
      className="lead-card-col"
      actions={
        <SaveControl
          dirty={dirty}
          busy={busy}
          testidBase={`lead-summary-${leadId}`}
          onSave={() => { void save() }}
          // S4: Discard REVERTS to the loaded value. The panel had no
          // Discard at all before this round; four of eight did not.
          onDiscard={() => setText(value)} />
      }>
      <textarea
        data-testid={`lead-summary-input-${leadId}`}
        className="lead-summary-input"
        rows={2}
        placeholder="No summary captured yet."
        value={text}
        onChange={(e) => setText(e.target.value)} />
    </Panel>
  )
}
