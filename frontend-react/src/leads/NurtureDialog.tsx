// ── NURTURE, FROM THE CARD ───────────────────────────────────────────────
//
// R2: Nurture opens the follow-up dialogue - a date and a reason - and then
// moves the lead.
//
// TWO CALLS, AND THE ORDER IS DELIBERATE: the reason is RECORDED FIRST, then
// the transition. Lead Detail's own park flow records the same reasoning at
// its site: if the transition fails, the reason is already saved and the form
// stays open, so nobody retypes it.
//
// ── A DUPLICATE, DECLARED ────────────────────────────────────────────────
//
// ContactHost has this same two-call sequence. It is NOT refactored into a
// shared helper, because Lead Detail is FROZEN this round (R4) and extracting
// would edit it. So there are two writers of one flow, which is Verification
// 20's shape, and it is recorded rather than left to be discovered: when Lead
// Detail is retired after John walks the card, this becomes the only one.
// Until then, a change to the Nurture sequence has to land in both.
import { useState } from 'react'
import { useShell } from '../ShellContext'
import { Modal, ModalClose } from '../ui/Modal'

export function NurtureDialog({ leadId, onCancel, onDone }: {
  leadId: string
  onCancel: () => void
  onDone: () => void
}) {
  const shell = useShell()
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (busy) return
    setError(null)
    if (!date) { setError('A follow-up date is required to nurture a lead.'); return }
    if (!reason.trim()) { setError('A reason is required.'); return }
    setBusy(true)
    try {
      const r = await shell.api<{ error?: string }>('PATCH', `/api/contacts/${leadId}`, {
        payload: { followUpDate: date, followUpDescription: reason.trim() },
      })
      if (!r.ok) { setError(r.data?.error ?? 'Failed to save the follow-up.'); return }

      const t = await shell.api<{ error?: string }>(
        'POST', `/api/records/${leadId}/transition`, { to_stage: 'Nurture' })
      // The dialogue STAYS OPEN on a failed transition, and the reason is
      // already recorded, which is why it is written first.
      if (!t.ok) { setError(t.data?.error ?? 'Failed to move this lead to Nurture.'); return }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  // ── THE MODAL SHAPE (2026-09-13) ───────────────────────────────────
  //
  // Phase 0 measured this dialogue at 0 of 6 on Section 4 as well. Sections
  // 4 and 5 are in `Modal` now; this file describes a nurture decision.
  //
  // DIRTY IS "SOMETHING WAS TYPED". The two fields start empty and are
  // required, so anything entered is unsaved work worth protecting.
  const dirty = date.trim() !== '' || reason.trim() !== ''
  return (
    <Modal
      title="Move to Nurture"
      testid="nurture-dialog"
      regionId="nurture-dialog-region"
      dirty={dirty}
      onClose={onCancel}
      nudge="You have unsaved changes, save or cancel."
      footer={(requestClose) => (
        <>
          <button type="button" className="btn-sm" data-testid="nurture-save"
            disabled={busy} onClick={() => { void save() }}>
            {busy ? 'Saving...' : 'Move to Nurture'}
          </button>
          <ModalClose onRequestClose={requestClose} regionId="nurture-dialog-region"
            testid="nurture-cancel" label="Cancel" />
        </>
      )}>
      <p className="sub">
        A nurtured lead needs a date to come back to it, and a reason it is
        not being worked now.
      </p>
      <label htmlFor="nurture-date">Follow-up date</label>
      <input id="nurture-date" type="date" className="lead-field-input"
        data-testid="nurture-date"
        value={date} onChange={(e) => setDate(e.target.value)} />
      <label htmlFor="nurture-reason">Reason</label>
      <textarea id="nurture-reason" className="lead-field-input"
        data-testid="nurture-reason"
        value={reason} onChange={(e) => setReason(e.target.value)} />
      {error ? <p className="msg-error" data-testid="nurture-error">{error}</p> : null}
    </Modal>
  )
}
