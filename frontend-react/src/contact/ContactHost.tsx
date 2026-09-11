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
import { LinkAccountPanel, type AccountOption } from './LinkAccountPanel'
import { NotesHistory } from './NotesHistory'
import { ParkForm } from './ParkForm'
import { StageActions } from './StageActions'
import { AccountDetailsModal, type AccountDetailsMode } from './AccountDetailsModal'
import { note, prepend, parkNoteText, type Note } from './notes'
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

export function ContactHost({ contact, registerReload, navToken }: {
  contact: ContactLike
  registerReload?: (reload: () => void) => void
  /** A4: increments on every navigation to this view. Part of the draft key. */
  navToken?: number
}) {
  const shell = useShell()
  // ── THE PROP IS THE SOURCE, AND useState ONLY TAKES ITS FIRST VALUE ────
  //
  // `useState(contact)` seeds once and ignores every later prop. The view
  // refetches on each navigation (main.tsx's navToken), so without this sync
  // the host goes on holding the record it was FIRST given - and the walk
  // measured exactly that: after qualifying, Back still went to leads because
  // `record.status` was the pre-qualify value while the view had the new one.
  //
  // Two readers of one record, and the stale one was making the decision.
  const [record, setRecord] = useState<ContactLike>(contact)
  useEffect(() => { setRecord(contact) }, [contact])
  const [industries, setIndustries] = useState<LookupOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [dirty, setDirty] = useState(false)
  const [parkOpen, setParkOpen] = useState(false)
  const [parkError, setParkError] = useState<string | null>(null)
  const [modal, setModal] = useState<AccountDetailsMode>(null)
  const [modalPrefill, setModalPrefill] = useState('')
  const [modalError, setModalError] = useState<string | null>(null)
  const [blocking, setBlocking] = useState<BlockingState | null>(null)
  const [feedback, setFeedback] = useState<{ text: string | null, html?: string | null, ok: boolean } | null>(null)

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

  // The Accounts the link panel searches. Fetched here for the same reason as
  // the industries: app.js's accountsCache is a module-scope `let`, and Round
  // 2's inventory measured it as unreachable from a bundle.
  useEffect(() => {
    let live = true
    void shell.api<Array<{ id: string, payload?: { name?: string }, name?: string }>>(
      'GET', '/api/accounts').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) {
        setAccounts(r.data.map((a) => ({ id: a.id, name: a.payload?.name ?? a.name ?? '--' })))
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
    // sentence joined into a single Notes History entry, prepended through the
    // shared writer - N4, one list and three authors.
    body.payload = {
      ...payloadUpdate,
      notes: prepend(note(sentences.join(' '), shell.currentUserEmail(), new Date().toISOString()),
        record.payload?.notes as Note[] | undefined),
    }

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
      // ── C5: ONE RENDERER, AND THE SHELL OWNS IT ────────────────────────
      //
      // The vanilla words its own 409 sentence, which is Verification 20 in a
      // string: two descriptions of one event and only one of them ever
      // updated. The shell's renderer also carries a RELOAD CONTROL, so a
      // surface writing its own sentence silently tells the person to reload
      // and gives them no way to.
      //
      // The plain sentence stays as the fallback for a shell with no renderer,
      // because showing nothing would be worse than showing a sentence.
      const html = r.status === 409 ? shell.staleWriteHtml(contact.id) : null
      setFeedback({
        text: html ? null : (r.status === 409
          ? 'This Contact changed since the screen loaded. Reload before saving.'
          : (r.data?.error ?? 'Failed to save.')),
        html,
        ok: false,
      })
      return
    }
    setFeedback({ text: 'Saved.', ok: true })
    await load()
  }

  const notes = (record.payload?.notes as Note[] | undefined) ?? []

  /** N4 to N7: a manual note, on the same list and the same handshake. */
  const addNote = async (text: string): Promise<boolean> => {
    const r = await shell.api<{ error?: string }>('PATCH', `/api/contacts/${contact.id}`, {
      payload: { notes: prepend(note(text, shell.currentUserEmail(), new Date().toISOString()), notes) },
      expected_revision: Number.isInteger(record.latest_revision_number)
        ? record.latest_revision_number : undefined,
    })
    if (!r.ok) {
      // N6: a 409 RELOADS and keeps the typed text. The reload shows the note
      // that beat this one and re-arms the screen with a current revision, so
      // a second click lands. Losing what the person typed at that moment
      // would be the worst possible answer to a race.
      if (r.status === 409) await load()
      else setFeedback({ text: r.data?.error ?? 'The note could not be saved.', ok: false })
      return false
    }
    await load()
    return true
  }

  /** P2: TWO writes in order, and the note goes FIRST. */
  const park = async (date: string, reason: string) => {
    setParkError(null)
    const r = await shell.api<{ error?: string }>('PATCH', `/api/contacts/${contact.id}`, {
      payload: {
        followUpDate: date,
        notes: prepend(note(parkNoteText(date, reason), shell.currentUserEmail(),
          new Date().toISOString()), notes),
      },
      expected_revision: Number.isInteger(record.latest_revision_number)
        ? record.latest_revision_number : undefined,
    })
    if (!r.ok) {
      setParkError(r.status === 409
        ? 'This Contact changed since the screen loaded. Reload before parking.'
        : (r.data?.error ?? 'Failed to save.'))
      return
    }
    const t = await shell.api<{ error?: string }>(
      'POST', `/api/records/${contact.id}/transition`, { to_stage: 'Nurture' })
    // P5: a failed transition reports IN THE FORM, which stays open - and the
    // reason is already recorded, which is why the note is written first.
    if (!t.ok) { setParkError(t.data?.error ?? 'Failed to park.'); return }
    setParkOpen(false)
    await load()
  }

  /** U1 and U2. */
  const unqualify = async () => {
    const go = async () => {
      await shell.api('POST', `/api/records/${contact.id}/transition`, { to_stage: 'Unqualified' })
      await load()
    }
    if (dirty) { shell.confirmDiscard(() => { void go() }); return }
    await go()
  }

  /** D1: delete, then back to the RETURN VIEW - a lead to leads, a contact
   * to contacts. D2 is recorded rather than improved: a failed delete does
   * nothing and says nothing, which is what the vanilla does. */
  const remove = async () => {
    const r = await shell.api('DELETE', `/api/contacts/${contact.id}`)
    if (!r.ok) return
    shell.navigate(returnViewFor(record.status ?? null))
  }

  /** A2's other half: creating the Account IS the link, one write. */
  const createAccount = async (name: string, parentId: string | null) => {
    setModalError(null)
    const r = await shell.api<{ error?: string }>(
      'POST', `/api/contacts/${contact.id}/link-account`,
      { new_account_name: name, ...(parentId ? { account_details: { parent_account_id: parentId } } : {}) })
    if (!r.ok) { setModalError(r.data?.error ?? 'Failed to create the Account.'); return }
    setModal(null)
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
      // A2: when the Account blocks and the company matches no existing
      // Account there is nothing to reconcile against, so the full creation
      // form opens rather than a search that would return an empty list plus a
      // "create" row the person has to click anyway. When it DOES match, the
      // lighter link panel is the right one and is left to the person.
      if (next.blockers.some((b) => b.field === 'parent_record_id')) {
        const company = String(record.payload?.company ?? '').trim()
        if (company && !accounts.some((a) => a.name.toLowerCase().includes(company.toLowerCase()))) {
          setModalPrefill(company)
          setModal('new')
        }
      }
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
        // A4: when this changes, the panel drops every unsaved draft. The host
        // holds the record, so the host names the subject.
        // A4: THE VISIT, NOT THE RECORD. Keying on contact.id alone passed the
        // unit test and left the bug on the screen - the probe navigates away
        // and back to the SAME lead, so the id never changed. navToken
        // increments per navigation, so returning to the same record is a new
        // subject and the drafts go.
        subject={`${contact.id}:${navToken ?? 0}`}
        blocking={blocking}
        accountName={record.account?.name ?? null}
        onSave={(c) => { void onSave(c) }}
        onDirtyChange={setDirty}
        // THE SAME RULE THE SEAM PUBLISHES, read from the same place, so the
        // button and the shell's accessor cannot disagree about where Back
        // goes. Verification 20: one definition, two consumers.
        // A4: NAVIGATING AWAY FROM A DIRTY FORM WARNS, and on confirm the
        // edits are DROPPED. Back was the one path in this file that did not
        // ask - unqualify, park and link-account all guard the same way, and
        // this was the gap. The drop itself is `subject` above: the panel
        // clears its drafts when the record changes, so coming back finds the
        // owner's saved data rather than yesterday's typing.
        onBack={() => {
          const go = () => { shell.navigate(returnViewFor(record.status ?? null)) }
          if (dirty) { shell.confirmDiscard(go); return }
          go()
        }}
        status={record.status ?? null}
        notes={
          <NotesHistory
            notes={notes}
            onAdd={addNote}
            hasDirtyEdits={dirty}
            onConfirmDiscard={(proceed) => { shell.confirmDiscard(proceed) }}
            resetKey={contact.id} />}
        linkPanel={
          <LinkAccountPanel
            contactId={contact.id}
            accounts={accounts}
            hasDirtyEdits={dirty}
            // THE SHARED DISCARD DIALOGUE, through the seam. Linking may lose
            // unsaved edits, and the vanilla asks first - so this does too,
            // and asks with the same modal rather than a second one.
            onConfirmDiscard={(proceed) => { shell.confirmDiscard(proceed) }}
            onLinked={() => { void load() }} />}
        actions={
          <StageActions
            status={record.status ?? null}
            onQualify={() => { void onQualify() }}
            onPark={() => { setParkError(null); setParkOpen(true) }}
            onUnqualify={() => { void unqualify() }}
            onDelete={() => { void remove() }}
            onCreate={(kind) => { shell.navigate(kind === 'test-bed' ? 'test-beds' : 'opportunities') }} />} />
      <ParkForm
        open={parkOpen}
        error={parkError}
        hasDirtyEdits={dirty}
        onConfirmDiscard={(proceed) => { shell.confirmDiscard(proceed) }}
        onCancel={() => { setParkOpen(false); setParkError(null) }}
        onSave={(d, r) => { void park(d, r) }} />
      <AccountDetailsModal
        mode={modal}
        prefillName={modalPrefill}
        viewing={record.account?.name ? { name: record.account.name } : null}
        accounts={accounts}
        error={modalError}
        onClose={() => { setModal(null); setModalError(null) }}
        onCreate={(n, pid) => { void createAccount(n, pid) }} />
      {feedback
        ? (feedback.html
          ? <div data-testid="cd-save-feedback" className="msg-error"
              dangerouslySetInnerHTML={{ __html: feedback.html }} />
          : <div data-testid="cd-save-feedback" className={feedback.ok ? 'msg-ok' : 'msg-error'}>
              {feedback.text}
            </div>)
        : null}
    </div>
  )
}
