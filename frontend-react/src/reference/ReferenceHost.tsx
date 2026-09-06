// ── ROUND 5 PHASE 2: THE REFERENCE PANEL'S DATA AND SAVE ────────────────
//
// What the panel does not do: fetch, save, or know about routes. This holds
// those, the same split the version card uses.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReferencePanel } from './ReferencePanel'
import { SAME_AS_ACCOUNT } from './descriptors'
import type { ReferenceSource } from './descriptors'
import type { KcLink } from './KeyContacts'
import { useShell } from '../ShellContext'

interface OppLike {
  id: string
  payload?: Record<string, unknown>
  opportunity_details?: Record<string, unknown>
  account?: (Record<string, unknown> & { id?: string, name?: string }) | null
  reference_code?: string | null
  status?: string | null
  created_at?: string | null
}

declare global {
  interface Window {
    oppPatch?: (id: string, body: unknown) => Promise<{ ok: boolean, status?: number, data?: unknown }>
    staleWriteHtml?: () => string
    loadOpportunityDetail?: (id: string) => void
  }
}

/** Which keys the surface owns. Only these are ever sent. */
const NUMERIC_KEYS = new Set(['duration'])

export function ReferenceHost({ opp, registerReload }: {
  opp: OppLike
  registerReload?: (reload: () => void) => void
}) {
  const shell = useShell()
  const [record, setRecord] = useState<OppLike>(opp)
  const [links, setLinks] = useState<KcLink[]>([])
  const [staff, setStaff] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{ text: string, ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const [r, kc] = await Promise.all([
      shell.api<OppLike>('GET', `/api/opportunities/${opp.id}`),
      shell.api<KcLink[]>('GET', `/api/opportunities/${opp.id}/key-contacts`),
    ])
    if (r.ok && r.data) setRecord(r.data)
    if (kc.ok && Array.isArray(kc.data)) setLinks(kc.data)
  }, [shell, opp.id])

  useEffect(() => { void load() }, [load])
  useEffect(() => { registerReload?.(() => { void load() }) }, [registerReload, load])
  useEffect(() => {
    let live = true
    void (async () => {
      const r = await shell.api<{ name: string }[]>('GET', '/api/terminus-staff')
      if (live && r.ok && Array.isArray(r.data)) setStaff(r.data.map((x) => x.name))
    })()
    return () => { live = false }
  }, [shell])

  // STABLE IDENTITY, and it is load-bearing rather than an optimisation: a
  // fresh object here rebuilds every descriptor on every render, which
  // re-assigns the open editor's value mid-keystroke and resets its caret.
  const source: ReferenceSource = useMemo(() => ({
    payload: record.payload ?? {},
    details: record.opportunity_details ?? {},
    account: record.account ?? null,
    staff,
    reference: record.reference_code ?? null,
    status: record.status ?? null,
    createdAt: record.created_at ?? null,
  }), [record, staff])

  // ── THE BATCHED SAVE: ONLY WHAT MOVED ───────────────────────────────────
  //
  // `changes` is already only-dirty, computed by comparison in useFieldRows.
  // The 409 is the record-level precondition the whole app shares, and its
  // SENTENCE comes from the shell's own renderer rather than being restated
  // here - Verification 20, one event described one way.
  const onSave = async (changes: Record<string, string>) => {
    setFeedback(null)
    const payloadUpdate: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(changes)) {
      if (k === SAME_AS_ACCOUNT) { payloadUpdate[k] = v === 'true'; continue }
      if (k === 'estClose') continue // A5: its own route, not this payload.
      payloadUpdate[k] = NUMERIC_KEYS.has(k) ? (v === '' ? null : Number(v)) : v
    }
    if (!Object.keys(payloadUpdate).length) return
    const r = await window.oppPatch!(opp.id, { payload: payloadUpdate })
    if (!r.ok) {
      setFeedback({
        text: r.status === 409
          ? 'This Opportunity changed since the screen loaded. Reload before saving.'
          : 'The changes could not be saved.',
        ok: false,
      })
      return
    }
    setFeedback({ text: 'Saved.', ok: true })
    window.loadOpportunityDetail?.(opp.id)
  }

  return (
    <div data-testid="reference-host">
      <ReferencePanel
        source={source}
        links={links}
        closeMoves={source.payload.closeMoves}
        oppId={opp.id}
        onSave={(c) => { void onSave(c) }}
        onChanged={() => { void load() }} />
      <p data-testid="ref-save-feedback"
        className={feedback ? (feedback.ok ? 'msg-success' : 'msg-error') : 'hidden'}>
        {feedback?.text ?? ''}
      </p>
    </div>
  )
}
