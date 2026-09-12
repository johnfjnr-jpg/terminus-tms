// R4: the Summary is editable on the card.
//
// A WRITE, so the door reaches it like the other inline writes - it is a real
// textarea and a real button, which is what `applyReadOnlyControls` knows how
// to neutralise.
//
// Save enables only when the text DIFFERS from what was loaded, not when
// somebody has typed: typing a character and deleting it leaves the record
// unchanged and must leave the button disabled.
import { useEffect, useRef, useState } from 'react'

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

  const dirty = text !== value
  const save = async () => {
    if (inFlight.current || !dirty) return
    inFlight.current = true
    setBusy(true)
    try { await onSave(text.trim()) } finally { inFlight.current = false; setBusy(false) }
  }

  return (
    <div className="lead-summary-edit">
      <textarea
        data-testid={`lead-summary-input-${leadId}`}
        className="lead-summary-input"
        rows={2}
        placeholder="No summary captured yet."
        value={text}
        onChange={(e) => setText(e.target.value)} />
      <button
        type="button"
        className="btn-ghost lead-summary-save"
        data-testid={`lead-summary-save-${leadId}`}
        disabled={!dirty || busy}
        onClick={() => { void save() }}>
        {busy ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
