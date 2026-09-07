// ── ROUND 7 PHASE 1a: THE TEST BED SURFACE'S DATA AND WRITES ────────────
//
// The panel does not fetch, save, or know about routes. This holds those.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TestBedPanel } from './TestBedPanel'
import { PAYLOAD_ONLY_KEYS, CLIENT_BUYER_ROLES, type TestBedSource } from './descriptors'
import { createPreviewRunner } from './costPreview'
import { useShell } from '../ShellContext'
import type { LookupOption } from '../field-row/types'
import { NotesHistory } from '../contact/NotesHistory'
import { note, prepend, type Note } from '../contact/notes'

interface BedLike {
  id: string
  payload?: Record<string, unknown>
  buyer_contacts?: Array<{ role?: string, contact_id?: string, name?: string }>
  account?: { id?: string } | null
  latest_revision_number?: number | null
  costBreakdown?: unknown
}

/**
 * ── THE SAVE, PER THE FIXED VANILLA SHAPE ───────────────────────────────
 *
 * Only-dirty, through one PATCH, carrying the revision as a precondition. This
 * is the construction Round 38 deleted by accident and Phase 0b restored: for
 * three rounds `payloadUpdate` was referenced and declared nowhere, so every
 * save threw and wrote nothing.
 *
 * `estCostPerUnit` and `indicativeCost` are payload keys and NOT rows, so they
 * can never be dirty and never appear here - which is the point of separating
 * the render list from the save list.
 */
export function buildPayload(changes: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(changes)) {
    if (k.startsWith('buyer-')) continue // its own route, not this payload
    if ((PAYLOAD_ONLY_KEYS as readonly string[]).includes(k)) continue
    out[k] = v
  }
  return out
}

export function TestBedHost({ bed }: { bed: BedLike }) {
  const shell = useShell()
  const [record, setRecord] = useState<BedLike>(bed)
  const [staff, setStaff] = useState<string[]>([])
  const [contacts, setContacts] = useState<LookupOption[]>([])
  const [preview, setPreview] = useState<unknown | null>(null)
  const [feedback, setFeedback] = useState<{ text: string | null, html?: string | null, ok: boolean } | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setRecord(bed) }, [bed])

  // The surface fetches its own staff: `terminusStaffCache` is a module-scope
  // `let` in app.js that no bundle can read. Round 5's ruling, applied again.
  useEffect(() => {
    let live = true
    void shell.api<Array<{ name: string }>>('GET', '/api/terminus-staff').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) setStaff(r.data.map((s) => s.name))
    })
    return () => { live = false }
  }, [shell])

  useEffect(() => {
    let live = true
    const accountId = record.account?.id
    if (!accountId) return
    void shell.api<Array<{ id: string, payload?: { name?: string } }>>(
      'GET', `/api/accounts/${accountId}/contacts`).then((r) => {
      if (live && r.ok && Array.isArray(r.data)) {
        setContacts(r.data.map((c) => ({ id: c.id, name: c.payload?.name ?? c.id })))
      }
    })
    return () => { live = false }
  }, [shell, record.account?.id])

  const source: TestBedSource = useMemo(() => ({
    payload: record.payload ?? {}, staff,
  }), [record, staff])

  const buyers = useMemo(() => {
    const out: Record<string, string> = {}
    for (const role of CLIENT_BUYER_ROLES) {
      out[role] = (record.buyer_contacts ?? []).find((c) => c.role === role)?.contact_id ?? ''
    }
    return out
  }, [record])

  const load = useCallback(async () => {
    const r = await shell.api<BedLike>('GET', `/api/test-beds/${bed.id}`)
    if (r.ok && r.data) setRecord(r.data)
  }, [shell, bed.id])

  // ── THE COST PREVIEW, with its ordering guard. C1-C9 ─────────────────
  const runner = useRef(createPreviewRunner(
    async (body) => shell.api('POST', '/api/test-beds/calculate', body),
    (data) => setPreview(data),
  ))

  const onDraftsChange = useCallback((drafts: Record<string, string>) => {
    runner.current.schedule(drafts, record.payload ?? {})
  }, [record.payload])

  useEffect(() => () => { runner.current.cancel() }, [])

  const onSave = async (changes: Record<string, string>) => {
    setFeedback(null)
    const payload = buildPayload(changes)
    if (!Object.keys(payload).length) return
    const r = await shell.api<{ error?: string, revision_number?: number }>(
      'PATCH', `/api/test-beds/${bed.id}`, {
        payload,
        expected_revision: Number.isInteger(record.latest_revision_number)
          ? record.latest_revision_number : null,
      })
    if (!r.ok) {
      // ONE RENDERER for the stale sentence, and the shell owns it: a surface
      // wording its own drops the reload control the shell's carries.
      const html = r.status === 409 ? shell.staleWriteHtml(bed.id) : null
      setFeedback({
        text: html ? null : (r.data?.error
          ?? (r.status === 409
            ? 'This Test Bed changed since the screen loaded. Reload before saving.'
            : 'Failed to save.')),
        html, ok: false,
      })
      return
    }
    setFeedback({ text: 'Saved.', html: null, ok: true })
    await load()
  }

  const notes = (record.payload?.notes as Note[] | undefined) ?? []

  return (
    <div data-testid="testbed-host">
      <TestBedPanel
        source={source}
        contacts={contacts}
        buyers={buyers}
        onSave={(c) => { void onSave(c) }}
        onDirtyChange={setDirty}
        onDraftsChange={onDraftsChange}
        costBreakdown={
          <div data-testid="tb-cost-breakdown"
            className={preview ? 'tb-cost-unsaved' : undefined}>
            {/* C4: the marker says these figures come from UNSAVED drafts. A
                preview is not a save, and the screen must be able to say so. */}
            {preview ? <span data-testid="tb-cost-preview-marker">Unsaved figures</span> : null}
          </div>}
        notes={
          <NotesHistory
            notes={notes}
            hasDirtyEdits={dirty}
            onConfirmDiscard={(proceed) => { shell.confirmDiscard(proceed) }}
            resetKey={bed.id}
            onAdd={async (text) => {
              const r = await shell.api<{ error?: string }>('PATCH', `/api/test-beds/${bed.id}`, {
                payload: {
                  notes: prepend(note(text, shell.currentUserEmail(), new Date().toISOString()), notes),
                },
                expected_revision: Number.isInteger(record.latest_revision_number)
                  ? record.latest_revision_number : null,
              })
              if (!r.ok) { if (r.status === 409) await load(); return false }
              await load()
              return true
            }} />} />
      {feedback
        ? (feedback.html
          ? <div data-testid="tb-save-feedback" className="msg-error"
              dangerouslySetInnerHTML={{ __html: feedback.html }} />
          : <div data-testid="tb-save-feedback" className={feedback.ok ? 'msg-ok' : 'msg-error'}>
              {feedback.text}
            </div>)
        : null}
    </div>
  )
}
