// ── X: THE CONVERT FORM ─────────────────────────────────────────────────
//
// X5: the vanilla wires this once behind a module flag because its controls are
// static markup. A component has no such problem, so there is no counterpart
// for the guard - the absence is the migration, not an omission.
import { useState } from 'react'
import { convertBody, convertFeedback, type ConvertFeedback } from './convert'

export function ConvertPanel({ onConvert, onOpen }: {
  onConvert: (body: { opportunity_name: string }) =>
    Promise<{ ok: boolean, data: { id?: string } | null, error: string | null }>
  onOpen: (opportunityId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState<ConvertFeedback | null>(null)
  const [busy, setBusy] = useState(false)

  // X4: cancel clears the name AND the feedback, so reopening does not show
  // the last attempt's error.
  const reset = () => { setOpen(false); setName(''); setFeedback(null) }

  return (
    <div data-testid="tb-convert">
      {!open
        ? <button type="button" data-testid="tb-convert-trigger"
            onClick={() => setOpen(true)}>Convert to Opportunity</button>
        : (
          <div data-testid="tb-convert-form-wrap">
            <input value={name} data-testid="tb-opp-name"
              placeholder="Opportunity name"
              onChange={(e) => setName(e.target.value)} />
            <button type="button" data-testid="tb-convert-submit" disabled={busy}
              onClick={async () => {
                const b = convertBody(name)
                if (!b.ok) {
                  setFeedback({ text: b.error, kind: 'err', opportunityId: null })
                  return
                }
                setBusy(true)
                try {
                  const r = await onConvert(b.body)
                  const f = convertFeedback(r.ok, r.data, r.error)
                  setFeedback(f)
                  // X2: success hides the form. A converted Test Bed cannot be
                  // converted again, so leaving it open invites a refusal.
                  if (f.kind === 'ok') setOpen(false)
                } finally { setBusy(false) }
              }}>Create Opportunity</button>
            <button type="button" data-testid="tb-convert-cancel"
              onClick={reset}>Cancel</button>
          </div>)}

      {feedback
        ? (
          <div data-testid="tb-convert-feedback"
            className={feedback.kind === 'ok' ? 'msg-success' : 'msg-error'}>
            {feedback.text}
            {/* X3: OFFERS navigation. The operator may want to stay. */}
            {feedback.opportunityId
              ? <button type="button" className="btn-text" data-testid="tb-convert-view"
                  onClick={() => onOpen(feedback.opportunityId as string)}>View it</button>
              : null}
          </div>)
        : null}
    </div>
  )
}
