// ── R1: THE COMPLETION POPUP IS ACTIONABLE ───────────────────────────────
//
// Phase 0 measured the defect precisely: the popup listed NINE missing fields,
// the server said nine, the two matched exactly - and the popup held ZERO
// inputs and one Close button, with its own message telling the user to open
// the lead. Five of the nine were the address group.
//
// So nothing about WHERE THE LIST COMES FROM changes. It was already the
// server's own `computeBlocking` through exit-criteria, and Phase 2 proved
// that by comparing the rendered lines against the endpoint's output. What
// this adds is the ability to ACT on it.
//
// ── THE FIELDS COME FROM THE SHARED DEFINITION ───────────────────────────
//
// R1 merged with R6: the seven fields the grid was missing are the same seven
// this popup needs. `leadFields.ts` is the single definition and both render
// it, so a field added there reaches both surfaces with neither edited.
//
// The popup shows EXACTLY the keys the server named as blocking. It does not
// decide what is missing, and it cannot drift from the gate, because it is the
// gate's own answer rendered as inputs.
import { useMemo, useRef, useState } from 'react'
import { useShell } from '../ShellContext'
import { fieldFor } from './leadFields'
import { LeadFieldInput } from './LeadFieldInput'

type Blocking = { field?: string, label?: string, message?: string }

export function QualifyCompletion({
  leadId, blocking, current, industries, sources, onComplete, onCancel,
}: {
  leadId: string
  blocking: Blocking[]
  current: Record<string, unknown>
  industries: Array<{ id: string, name: string }>
  sources: string[]
  /** Saved and nothing is blocking any more: the flow moves on by itself. */
  onComplete: () => void
  onCancel: () => void
}) {
  const shell = useShell()
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  // The blocking keys the shared definition knows how to render. A key it does
  // not know is SHOWN, not silently dropped - an unenterable requirement the
  // user cannot see is worse than one they can.
  const entries = useMemo(() => blocking.map((b) => ({
    key: b.field ?? '',
    message: b.message ?? b.label ?? b.field ?? '',
    field: fieldFor(b.field ?? ''),
  })), [blocking])
  const unknown = entries.filter((e) => !e.field)

  const dirty = Object.values(values).some((v) => v.trim())

  const save = async () => {
    if (inFlight.current || !dirty) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      // industry_id is a REAL COLUMN on `records`, not a payload key, and the
      // PATCH route takes it at the top level. Sending it inside `payload`
      // would write a key the gate never reads - the same distinction that
      // cost a Phase 1b probe an hour.
      const payload: Record<string, string> = {}
      let industryId: string | undefined
      for (const [k, v] of Object.entries(values)) {
        if (!v.trim()) continue
        if (k === 'industry_id') industryId = v
        else payload[k] = v.trim()
      }
      const body: Record<string, unknown> = {}
      if (Object.keys(payload).length) body.payload = payload
      if (industryId) body.industry_id = industryId

      const r = await shell.api<{ error?: string }>('PATCH', `/api/contacts/${leadId}`, body)
      if (!r.ok) { setError(r.data?.error ?? 'Could not save.'); return }

      // ASK THE SERVER AGAIN rather than deciding here whether it is now
      // complete. The gate is the only thing that knows.
      const again = await shell.api<{ blocking?: Blocking[] }>(
        'GET', `/api/records/${leadId}/exit-criteria`)
      if (!again.ok) { setError('Saved, but could not re-check. Press Qualify again.'); return }
      const left = again.data?.blocking ?? []
      if (left.length) {
        setError(`Saved. ${left.length} still to complete.`)
        setValues({})
        return
      }
      onComplete()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="lead-qualify-step" data-testid={`lead-incomplete-${leadId}`}>
      <p className="eyebrow">Please complete missing data</p>
      <div className="lead-complete-grid" data-testid={`lead-missing-${leadId}`}>
        {entries.filter((e) => e.field).map((e) => (
          <div className="lead-complete-cell" key={e.key}>
            <label htmlFor={`lead-fix-${e.key}-${leadId}`}>{e.field!.label}</label>
            <LeadFieldInput
              field={e.field!}
              value={values[e.key] ?? String(current[e.key] ?? '')}
              onChange={(v) => setValues((p) => ({ ...p, [e.key]: v }))}
              industries={industries}
              sources={sources}
              testid={`lead-fix-${e.key}-${leadId}`} />
          </div>
        ))}
      </div>
      {unknown.length
        ? (
          <p className="msg-error" data-testid={`lead-unknown-${leadId}`}>
            {unknown.length} requirement{unknown.length === 1 ? '' : 's'} cannot be
            entered here: {unknown.map((u) => u.message).join('; ')}
          </p>
        )
        : null}
      {error ? <p className="msg-error" data-testid={`lead-fix-error-${leadId}`}>{error}</p> : null}
      <div className="lead-complete-actions">
        <button type="button" className="btn-primary"
          data-testid={`lead-fix-save-${leadId}`}
          disabled={busy || !dirty}
          onClick={() => { void save() }}>
          {busy ? 'Saving...' : 'Save and continue'}
        </button>
        <button type="button" className="btn-ghost"
          data-testid={`lead-incomplete-close-${leadId}`}
          onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
