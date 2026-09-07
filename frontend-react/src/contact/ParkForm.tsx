// ── P1 TO P9: THE PARK FORM ──────────────────────────────────────────────
//
// A popup with a focus trap, per INTERACTION_STANDARDS section 4 - which uses
// Park as its own worked example.
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

export function ParkForm({ open, onCancel, onSave, hasDirtyEdits, onConfirmDiscard, error }: {
  open: boolean
  onCancel: () => void
  onSave: (date: string, reason: string) => void
  hasDirtyEdits: boolean
  onConfirmDiscard: (proceed: () => void) => void
  /** P5: a failed transition reports here, and the form stays open. */
  error: string | null
}) {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [own, setOwn] = useState<string | null>(null)
  const [nagging, setNagging] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const first = useRef<HTMLInputElement | null>(null)

  // P7: dirtiness is tracked from the FIELDS, not from having opened the form.
  const dirty = date !== '' || reason !== ''

  useEffect(() => {
    if (!open) { setDate(''); setReason(''); setOwn(null); setNagging(false); return }
    first.current?.focus()
  }, [open])

  // P9: Tab cycles inside the form, Escape leaves the way Cancel does.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); leave(); return }
      if (e.key !== 'Tab') return
      const focusable = ref.current?.querySelectorAll<HTMLElement>(
        'input, textarea, button, [href], select, [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return
      const list = [...focusable]
      const i = list.indexOf(document.activeElement as HTMLElement)
      e.preventDefault()
      const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i === list.length - 1 ? 0 : i + 1)
      list[next].focus()
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  })

  if (!open) return null

  // P6, FIRST HALF: Cancel and Escape are INTENTIONAL leave actions, so they
  // get a real choice rather than a refusal.
  const leave = () => {
    if (!dirty) { onCancel(); return }
    onConfirmDiscard(() => { onCancel() })
  }

  // P6, SECOND HALF: a backdrop click is an ACCIDENTAL dismissal and is
  // refused outright - highlighted Save, a warning, and the form stays open.
  const onBackdrop = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.testid !== 'cd-park-form') return
    if (dirty) { setNagging(true); return }
    onCancel()
  }

  const save = () => {
    // P1: both fields, each with its own sentence.
    if (!date) { setOwn('Follow-up date is required.'); return }
    if (!reason.trim()) { setOwn('A reason for parking is required.'); return }
    setOwn(null)
    // P8: THE FORM CLOSES BEFORE THE DIALOGUE OPENS. It is a fixed
    // full-screen popup, so leaving it open under the confirm modal left
    // "Keep editing" pointing at a Save button the person could not reach.
    // Checked only AFTER Park's own validation passes: warning about an
    // unrelated field before the date and reason are even valid is confusing
    // ordering.
    if (hasDirtyEdits) {
      // flushSync, AND IT IS THE WHOLE OF P8 IN REACT. The vanilla closes the
      // popup with a direct DOM write, so by the time it opens the dialogue the
      // screen is already clear. Calling onCancel() here only SCHEDULES that,
      // and React batches it - so the dialogue opened with the fixed
      // full-screen popup still covering everything, which is exactly the
      // defect P8 exists to prevent, reproduced by the framework rather than by
      // forgetting.
      //
      // Measured: the test reads whether the form is still in the DOM at the
      // moment the dialogue is asked, and without this it is.
      flushSync(() => { onCancel() })
      onConfirmDiscard(() => { onSave(date, reason.trim()) })
      return
    }
    onSave(date, reason.trim())
  }

  return (
    <div className="modal-backdrop" data-testid="cd-park-form" onClick={onBackdrop}>
      <div className="modal" ref={ref} role="dialog" aria-modal="true"
        aria-labelledby="cd-park-heading">
        <h2 id="cd-park-heading" data-testid="cd-park-heading">Park this contact</h2>
        <label htmlFor="cd-park-date">Follow-up date</label>
        <input id="cd-park-date" data-testid="cd-park-date" type="date" ref={first}
          value={date} onChange={(e) => setDate(e.target.value)} />
        <label htmlFor="cd-park-reason">Reason</label>
        <textarea id="cd-park-reason" data-testid="cd-park-reason"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        {own || error
          ? <div className="msg-error" data-testid="cd-park-error">{own ?? error}</div>
          : null}
        {nagging
          ? <div className="msg-error" data-testid="cd-park-unsaved-warning">
              There is unsaved work here. Save and park, or cancel.
            </div>
          : null}
        <div className="form-actions">
          <button type="button" data-testid="cd-park-cancel" onClick={leave}>Cancel</button>
          <button type="button" data-testid="cd-park-save"
            className={nagging ? 'btn-attention' : undefined}
            onClick={save}>Save &amp; park</button>
        </div>
      </div>
    </div>
  )
}
