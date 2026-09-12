// ── THE CARD'S ACTIONS ───────────────────────────────────────────────────
//
// R2: Qualify, Nurture, Follow-up task, Address details, on the card that is
// now the primary working surface.
//
// ── QUALIFY IS A THREE-STEP FLOW AND ONE WRITE ───────────────────────────
//
//   idle -> (press Qualify) -> ask the SERVER what is missing
//        -> incomplete: the completion popup, naming the server's own list
//        -> complete:   the account step, which is LinkAccountPanel (R7)
//        -> resolving the account step calls POST /contacts/:id/qualify,
//           which runs qualify_contact: ONE atomic transaction.
//
// NOTHING IS WRITTEN UNTIL THAT LAST CALL. R8: cancel at any step calls
// nothing at all, so there is no mid-qualification state to roll back - which
// is why there is none to persist.
//
// THE MISSING-FIELD LIST IS NOT COMPUTED HERE. It comes from
// GET /records/:id/exit-criteria, which is computeBlocking - the same
// evaluator the qualify route refuses on. A client-side copy would be
// Verification 43: a display beside a correct rule, agreeing today.
import { useState } from 'react'
import { useShell } from '../ShellContext'
import { LinkAccountPanel } from '../contact/LinkAccountPanel'

type Blocking = { field?: string, label?: string, message?: string }
type AccountOption = { id: string, name: string }
type Step = 'idle' | 'checking' | 'incomplete' | 'account'

export function LeadCardActions({
  leadId, status, accounts, onQualified, onNurture, onToggleAddress, addressOpen,
}: {
  leadId: string
  status: string | null
  accounts: AccountOption[]
  onQualified: () => void
  onNurture: () => void
  onToggleAddress: () => void
  addressOpen: boolean
}) {
  const shell = useShell()
  const [step, setStep] = useState<Step>('idle')
  const [blocking, setBlocking] = useState<Blocking[]>([])
  const [error, setError] = useState<string | null>(null)

  const alreadyQualified = status === 'Qualified'

  const pressQualify = async () => {
    setError(null)
    setStep('checking')
    const r = await shell.api<{ blocking?: Blocking[] }>(
      'GET', `/api/records/${leadId}/exit-criteria`)
    if (!r.ok) {
      setError('Could not check this lead. Try again.')
      setStep('idle')
      return
    }
    const missing = r.data?.blocking ?? []
    setBlocking(missing)
    setStep(missing.length ? 'incomplete' : 'account')
  }

  // R8: every cancel path is this. It calls nothing.
  const cancel = () => { setStep('idle'); setBlocking([]); setError(null) }

  return (
    <div
      className="lead-card-actions"
      data-testid={`lead-actions-${leadId}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="lead-action-row">
        <button
          type="button"
          className="btn-primary"
          data-testid={`lead-qualify-${leadId}`}
          disabled={alreadyQualified || step === 'checking'}
          onClick={() => { void pressQualify() }}>
          {step === 'checking' ? 'Checking...' : 'Qualify'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          data-testid={`lead-nurture-${leadId}`}
          onClick={onNurture}>
          Nurture
        </button>
        <button
          type="button"
          className="btn-ghost"
          data-testid={`lead-followup-btn-${leadId}`}
          onClick={() => {
            // The inline follow-up STAYS as the LEADS round built it, per the
            // brief. This button brings it into view and focuses its date
            // input rather than duplicating the control, so there is one
            // follow-up editor on the card, not two.
            const el = document.querySelector<HTMLInputElement>(
              `[data-testid="lead-followup-${leadId}"] input`)
            el?.scrollIntoView({ block: 'nearest' })
            el?.focus()
          }}>
          Follow-up task
        </button>
        <button
          type="button"
          className="btn-ghost"
          data-testid={`lead-address-${leadId}`}
          aria-expanded={addressOpen}
          aria-controls={`lead-address-panel-${leadId}`}
          onClick={onToggleAddress}>
          Address details
        </button>
      </div>

      {error
        ? <p className="msg-error" data-testid={`lead-action-error-${leadId}`}>{error}</p>
        : null}

      {/* ── THE COMPLETION POPUP ────────────────────────────────────────
          Names the SERVER'S list. Every line here came from
          computeBlocking through exit-criteria. */}
      {step === 'incomplete'
        ? (
          <div className="lead-qualify-step" data-testid={`lead-incomplete-${leadId}`}>
            <p className="eyebrow">Not ready to qualify</p>
            <p className="sub">
              This lead needs {blocking.length} more {blocking.length === 1 ? 'field' : 'fields'}
              {' '}before it can be qualified. Open the lead to fill them in.
            </p>
            <ul data-testid={`lead-missing-${leadId}`}>
              {blocking.map((b, i) => (
                <li key={b.field ?? i} data-testid={`lead-missing-${leadId}-${b.field ?? i}`}>
                  {/* The SERVER'S own sentence. `message` is what
                      computeBlocking builds - "Requires address to be set" -
                      and the first build rendered `field`, so the popup listed
                      raw keys: jobRole, linkedin. Found by opening the
                      screenshot, which is the only instrument that could: the
                      list was the right length, from the right source, and
                      every assertion about it passed. */}
                  {b.message ?? b.label ?? b.field}
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost"
              data-testid={`lead-incomplete-close-${leadId}`}
              onClick={cancel}>Close</button>
          </div>
        )
        : null}

      {/* ── THE ACCOUNT STEP ────────────────────────────────────────────
          R7: LinkAccountPanel, not a second picker. Its submitPath is the
          qualify route, so resolving it is ONE atomic call rather than
          link-account's three. */}
      {step === 'account'
        ? (
          <div className="lead-qualify-step" data-testid={`lead-account-step-${leadId}`}>
            <p className="eyebrow">Qualify: choose the account</p>
            <LinkAccountPanel
              contactId={leadId}
              accounts={accounts}
              hasDirtyEdits={false}
              onConfirmDiscard={(proceed) => { proceed() }}
              submitPath={`/api/contacts/${leadId}/qualify`}
              startOpen
              onCancel={cancel}
              onLinked={() => { setStep('idle'); onQualified() }} />
          </div>
        )
        : null}
    </div>
  )
}
