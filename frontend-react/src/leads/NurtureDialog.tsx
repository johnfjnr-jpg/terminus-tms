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

  return (
    <div className="modal-backdrop" data-testid="nurture-dialog">
      <div className="modal-panel" role="dialog" aria-modal="true"
        aria-labelledby="nurture-heading">
        <p className="eyebrow" id="nurture-heading">Move to Nurture</p>
        <p className="sub">
          A nurtured lead needs a date to come back to it, and a reason it is
          not being worked now.
        </p>
        <label htmlFor="nurture-date">Follow-up date</label>
        <input id="nurture-date" type="date" data-testid="nurture-date"
          value={date} onChange={(e) => setDate(e.target.value)} />
        <label htmlFor="nurture-reason">Reason</label>
        <textarea id="nurture-reason" data-testid="nurture-reason"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        {error ? <p className="msg-error" data-testid="nurture-error">{error}</p> : null}
        <div className="form-actions">
          <button type="button" className="btn-primary" data-testid="nurture-save"
            disabled={busy} onClick={() => { void save() }}>
            {busy ? 'Saving...' : 'Move to Nurture'}
          </button>
          <button type="button" className="btn-ghost" data-testid="nurture-cancel"
            onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
