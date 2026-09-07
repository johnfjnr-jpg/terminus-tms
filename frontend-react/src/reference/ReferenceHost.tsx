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
// THE PREDICATE IS THE ROUTE'S OWN, imported from the shared module rather
// than restated here or read off a window bridge. src/lib is served at /lib
// and this is the same file the route imports, so the screen and the server
// cannot hold different opinions about when a reason is required.
// Verification 20, and one better than the vanilla: no bridge in between.
import { closeDateNeedsReason } from '../../../src/lib/opportunity-dates.js'

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
    staleWriteHtml?: (recordId: string) => string
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
  const [feedback, setFeedback] = useState<
    { text: string | null, html?: string | null, ok: boolean } | null>(null)

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
  // ── THE PAYLOAD HALF ────────────────────────────────────────────────────
  //
  // estClose is not here and never was: A5, it is a real indexed column on
  // opportunity_details and moves only through its own route. What CHANGED in
  // Round 6 Phase 0 is that it is now handled before this runs rather than
  // dropped - see saveEstClose below. The `continue` that used to sit in this
  // loop discarded what a person had typed, silently, on a row that looked
  // fully editable.
  //
  // `reloadOnly` is what the close-date path needs when nothing else was
  // dirty: the date is already written, so the surface must refresh even
  // though this half has nothing to send.
  const savePayload = async (changes: Record<string, string>, reloadOnly = false) => {
    const payloadUpdate: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(changes)) {
      if (k === SAME_AS_ACCOUNT) { payloadUpdate[k] = v === 'true'; continue }
      payloadUpdate[k] = NUMERIC_KEYS.has(k) ? (v === '' ? null : Number(v)) : v
    }
    if (!Object.keys(payloadUpdate).length) {
      if (reloadOnly) {
        setFeedback({ text: 'Saved.', html: null, ok: true })
        window.loadOpportunityDetail?.(opp.id)
      }
      return
    }
    const r = await window.oppPatch!(opp.id, { payload: payloadUpdate })
    if (!r.ok) {
      // ONE RENDERER, and the shell owns it. Wording the refusal here would be
      // Verification 20 in a string: two descriptions of one event, only one
      // of them ever updated. staleWriteHtml also carries the reload control,
      // so a surface that wrote its own sentence would silently drop that too.
      setFeedback({
        text: r.status === 409 ? null : 'The changes could not be saved.',
        html: r.status === 409 ? (window.staleWriteHtml?.(opp.id) ?? null) : null,
        ok: false,
      })
      return
    }
    setFeedback({ text: 'Saved.', html: null, ok: true })
    window.loadOpportunityDetail?.(opp.id)
  }

  // ── THE EST. CLOSE DATE WRITE PATH ──────────────────────────────────────
  //
  // Round 6 Phase 0. Built from the route's measured contract, not from the
  // vanilla's shape: POST /api/opportunities/:id/close-date-move with
  // {date, reason?}, which is the ONLY writer of forecast_close_date. A second
  // write path would be the fork Architecture 1 forbids.
  //
  // The route refuses seven ways - date required, not a real date, in the
  // past, no such record, go-live conflict, unchanged, and reason required -
  // and every one of them has to land somewhere a person can see. A move shows
  // them inside the dialogue, which stays open; a first recording has no
  // dialogue, so they go to the surface feedback.
  const postCloseDate = (date: string, reason?: string) =>
    shell.api<{ error?: string }>('POST', `/api/opportunities/${opp.id}/close-date-move`,
      reason === undefined ? { date } : { date, reason })

  const saveEstClose = async (date: string, rest: Record<string, string>) => {
    // THE STORED VALUE COMES FROM THE SAME OBJECT THE FIELD RENDERS FROM, so
    // "what is on the record" has one answer on this screen too.
    const stored = (record.opportunity_details?.forecast_close_date as string | null | undefined) ?? null

    if (!closeDateNeedsReason(stored, date)) {
      // A FIRST RECORDING ASKS NOTHING. There is no reason for a first value,
      // and demanding one produces the shape Verification 22 names: the walk
      // that met this typed "First Recording", which is what a person writes
      // when a form insists on answering a question that has none.
      const r = await postCloseDate(date)
      if (!r.ok) {
        setFeedback({ text: r.data?.error ?? 'The date could not be saved.', html: null, ok: false })
        return
      }
      await savePayload(rest, true)
      return
    }

    shell.requestChangeReason({
      heading: 'Move Est. Close Date',
      contextLabel: 'New Est. Close Date',
      contextValue: date || '--',
      promptLabel: 'Reason for moving (required)',
      confirmLabel: 'Save move',
      emptyReasonError: 'A reason for the move is required.',
      // Opens from Save rather than a named button, so Save is what focus
      // returns to. INTERACTION_STANDARDS section 4.
      returnFocusTo: 'ref-react-save-all',
      onConfirm: async (reason: string) => {
        const r = await postCloseDate(date, reason)
        return { ok: r.ok, error: r.data?.error }
      },
      // WHATEVER ELSE WAS DIRTY GOES IN THE SAME ACTION. A person pressed Save
      // once and must not have to press it again for the fields that were not
      // the date.
      onDone: async () => { await savePayload(rest, true) },
      // CANCEL TOUCHES NOTHING. The edit bar still shows what it showed before
      // Save was pressed, so the person can correct the date, retry, or
      // discard that one field through its own control. Discarding here would
      // take unrelated edits with it.
      onCancel: () => {},
    })
  }

  // ── THE BATCHED SAVE, WITH THE DATE TAKEN OUT FIRST ─────────────────────
  const onSave = async (changes: Record<string, string>) => {
    setFeedback(null)
    const rest = { ...changes }
    const estClose = Object.prototype.hasOwnProperty.call(rest, 'estClose') ? rest.estClose : undefined
    delete rest.estClose
    if (estClose !== undefined) { await saveEstClose(estClose, rest); return }
    await savePayload(rest)
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
      {/* The shell's renderer returns HTML because the sentence carries a
          control. A surface that could only render text would have to invent
          its own, which is the duplication this avoids. */}
      {feedback?.html
        ? <p data-testid="ref-save-feedback" className="msg-error"
            dangerouslySetInnerHTML={{ __html: feedback.html }} />
        : <p data-testid="ref-save-feedback"
            className={feedback ? (feedback.ok ? 'msg-success' : 'msg-error') : 'hidden'}>
            {feedback?.text ?? ''}
          </p>}
    </div>
  )
}
