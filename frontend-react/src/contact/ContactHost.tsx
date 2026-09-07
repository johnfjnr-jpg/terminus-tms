// ── ROUND 6 PHASE 1: THE CONTACT SURFACE'S DATA AND WRITES ──────────────
//
// The panel does not fetch, save, or know about routes. This holds those, the
// same split the Reference tab and the version card use.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ContactPanel } from './ContactPanel'
import type { ContactSource } from './descriptors'
import { contactDescriptors } from './descriptors'
import { clearResolved, forRecord, unplaceable, type BlockingState, type Blocker } from './blocking'
import { useShell } from '../ShellContext'
import type { LookupOption } from '../field-row/types'

interface ContactLike {
  id: string
  payload?: Record<string, unknown>
  industry_id?: string | null
  parent_record_id?: string | null
  status?: string | null
  account?: { id?: string, name?: string } | null
  /** The revision handshake's own value, carried BY THE RECORD. */
  latest_revision_number?: number | null
}

/**
 * ── C1: THE RETURN VIEW IS OWNED HERE, AND THE SWAP ADAPTS THE SHELL ────
 *
 * `frontend/app.js:306` binds the back button to `cdReturnView`, a `let`
 * declared at the top level of `frontend/contact-detail.js`. Classic scripts
 * share one global lexical scope, so app.js can read it today. A BUNDLE CANNOT:
 * `let` never reaches `window`, which is Migration Round 2's rule - not a
 * coupling to carry over, a coupling that was never possible.
 *
 * THE PLAN, ruled for Phase 2 rather than taken now. The binding is registered
 * at LOAD, so the day contact-detail.js retires that line throws unless the
 * shell has been adapted in the same commit. The host owns the state from now
 * and publishes it through the seam; the swap commit repoints app.js:306 at the
 * seam and deletes the `let`. Doing the app.js half now would open a binding on
 * a surface nobody can see, which is the same reasoning that put the Reference
 * tab's door in its swap commit and not before.
 *
 * THE RULE ITSELF IS THE VANILLA'S and is derived, not stored: a Qualified
 * contact came from the contacts list, an unqualified one from leads.
 */
export function returnViewFor(status: string | null | undefined): 'contacts' | 'leads' {
  return status === 'Qualified' ? 'contacts' : 'leads'
}

/** Keys the surface owns. Only these are ever sent. */
const PAYLOAD_KEYS = new Set([
  'name', 'company', 'jobRole', 'email', 'mobile', 'linkedin', 'source',
  'address', 'address2', 'city', 'postcode', 'country', 'region', 'summary',
])

/**
 * `legalEntity` and `followUpDate` are writable by the route and are NOT on
 * this surface, so they are not in the set above and are never sent.
 *
 * legalEntity is rendered NOWHERE in the frontend - a writable key with no
 * editor, found by the Phase 0 census and recorded rather than acted on. A
 * MIGRATION ADDS NO RENDERS: giving it a row here would be inventing a field
 * the vanilla never had, on the round whose job is to move what exists.
 * followUpDate belongs to the Park form, which writes it on its own path.
 */
export const WRITABLE_ELSEWHERE = ['legalEntity', 'followUpDate'] as const

export function ContactHost({ contact, registerReload }: {
  contact: ContactLike
  registerReload?: (reload: () => void) => void
}) {
  const shell = useShell()
  const [record, setRecord] = useState<ContactLike>(contact)
  const [industries, setIndustries] = useState<LookupOption[]>([])
  const [blocking, setBlocking] = useState<BlockingState | null>(null)
  const [feedback, setFeedback] = useState<{ text: string, ok: boolean } | null>(null)

  // A11: the surface fetches its own options. `industriesCache` is a `let` in
  // app.js, so a bundle cannot read it - Round 5's terminusStaffCache ruling.
  useEffect(() => {
    let live = true
    void shell.api<Array<{ id: string, name: string }>>('GET', '/api/industries').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) {
        setIndustries(r.data.map((i) => ({ id: i.id, name: i.name })))
      }
    })
    return () => { live = false }
  }, [shell])

  const load = useCallback(async () => {
    const r = await shell.api<ContactLike[]>('GET', '/api/contacts')
    if (!r.ok || !Array.isArray(r.data)) return
    const fresh = r.data.find((c) => c.id === contact.id)
    if (fresh) setRecord(fresh)
  }, [shell, contact.id])

  useEffect(() => { registerReload?.(() => { void load() }) }, [registerReload, load])

  // A BLOCKING LIST BELONGS TO ITS OWN RECORD. Carrying one onto a different
  // contact would tint fields for a failure that happened somewhere else.
  useEffect(() => { setBlocking((b) => forRecord(b, contact.id)) }, [contact.id])

  const source: ContactSource = useMemo(() => ({
    payload: record.payload ?? {},
    industryId: record.industry_id ?? null,
    industries,
  }), [record, industries])

  // RESOLUTION CLEARS THE TINT, against the reloaded record and never by
  // re-attempting the transition: a re-attempt would qualify the contact the
  // instant every field happened to be filled, as a side effect of saving one.
  useEffect(() => {
    setBlocking((b) => clearResolved(b, record as unknown as Record<string, unknown>, source.payload))
  }, [record, source.payload])

  const onSave = async (changes: Record<string, string>) => {
    setFeedback(null)
    const body: Record<string, unknown> = {}
    const payloadUpdate: Record<string, unknown> = {}
    const sentences: string[] = []
    const labelOf = (k: string) =>
      contactDescriptors(source).find((f) => f.name === k)?.label ?? k
    const shownFor = (k: string, v: string) =>
      k === 'industry' ? ((industries.find((i) => i.id === v)?.name ?? v) || 'nothing') : (v || 'nothing')

    for (const [k, v] of Object.entries(changes)) {
      const was = k === 'industry'
        ? shownFor(k, record.industry_id ?? '')
        : shownFor(k, String(record.payload?.[k] ?? ''))
      sentences.push(`${labelOf(k)} changed from ${was} to ${shownFor(k, v)}.`)
      // industry is a REAL COLUMN, lifted to the top level rather than sent as
      // a payload key. The route rejects any payload key it does not own.
      if (k === 'industry') { body.industry_id = v || null; continue }
      if (PAYLOAD_KEYS.has(k)) payloadUpdate[k] = v
    }
    if (!sentences.length) return

    // ONE NOTE PER SAVE SESSION, not one per changed field: every change
    // sentence joined into a single Notes History entry, prepended.
    const notes = [
      { text: sentences.join(' '), at: new Date().toISOString(), by: shell.currentUserEmail() },
      ...((record.payload?.notes as unknown[]) ?? []),
    ]
    body.payload = { ...payloadUpdate, notes }

    const r = await shell.api<{ error?: string }>('PATCH', `/api/contacts/${contact.id}`, {
      ...body,
      // THE HANDSHAKE READS THE RECORD, not a shell global. The vanilla keeps
      // it in `cdLoadedRevision`, a `let` no bundle could read - and it does
      // not need to, because the value arrives ON the record as
      // latest_revision_number. One fewer coupling rather than one more.
      expected_revision: Number.isInteger(record.latest_revision_number)
        ? record.latest_revision_number : undefined,
    })
    if (!r.ok) {
      setFeedback({
        text: r.status === 409
          ? 'This Contact changed since the screen loaded. Reload before saving.'
          : (r.data?.error ?? 'Failed to save.'),
        ok: false,
      })
      return
    }
    setFeedback({ text: 'Saved.', ok: true })
    await load()
  }

  const onQualify = async () => {
    setFeedback(null)
    const r = await shell.api<{ error?: string, blocking?: Blocker[] }>(
      'POST', `/api/records/${contact.id}/transition`, { to_stage: 'Qualified' })
    if (r.ok) {
      setBlocking(null)
      shell.navigate('contacts')
      return
    }
    if (r.status === 422 && r.data?.blocking?.length) {
      const next: BlockingState = { recordId: contact.id, blockers: r.data.blocking }
      setBlocking(next)
      // C2's guard, live rather than in a test: a blocker the screen cannot
      // place would otherwise tint nothing and say nothing, which is exactly
      // what a person blocked on Industry got.
      const lost = unplaceable(next, contactDescriptors(source).map((f) => f.name))
      if (lost.length) {
        setFeedback({
          text: `Qualification is blocked by ${lost.map((b) => b.label ?? b.field).join(', ')}, `
            + 'which this screen cannot show. Report this.',
          ok: false,
        })
      }
      return
    }
    setFeedback({ text: r.data?.error ?? 'Failed to qualify.', ok: false })
  }

  return (
    <div data-testid="contact-host">
      <ContactPanel
        source={source}
        blocking={blocking}
        accountName={record.account?.name ?? null}
        onSave={(c) => { void onSave(c) }}
        actions={
          <div className="cd-actions" data-testid="cd-actions">
            <button type="button" id="cd-btn-qualify" data-testid="cd-btn-qualify"
              onClick={() => { void onQualify() }}>Qualify</button>
          </div>} />
      {feedback
        ? <div data-testid="cd-save-feedback" className={feedback.ok ? 'msg-ok' : 'msg-error'}>
            {feedback.text}
          </div>
        : null}
    </div>
  )
}
