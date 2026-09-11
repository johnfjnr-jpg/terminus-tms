// ── THE CONTACT VIEW ─────────────────────────────────────────────────────
//
// Round 6 Phase 2. A WHOLE-VIEW migration on the Account pattern: React owns
// #view-contact-detail, which main.tsx createRoot()s, so the static markup
// inside it is cleared on first render and cannot collide with what React puts
// back. That is the disposition no-duplicate-ids.test.mjs recorded in Phase 1,
// and this file is what makes it true.
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useShell } from '../ShellContext'
import { ContactHost } from './ContactHost'
import { returnViewFor } from './ContactHost'

const VIEW = 'contact-detail'

interface ContactRecord {
  id: string
  payload?: Record<string, unknown>
  industry_id?: string | null
  parent_record_id?: string | null
  status?: string | null
  account?: { id?: string, name?: string } | null
  latest_revision_number?: number | null
}

export function ContactView({ contactId, navToken }: { contactId: string, navToken?: number }) {
  const shell = useShell()

  const contact = useQuery({
    queryKey: ['contact', contactId],
    queryFn: async (): Promise<ContactRecord> => {
      const r = await shell.api<ContactRecord[]>('GET', '/api/contacts')
      if (!r.ok || !Array.isArray(r.data)) throw new Error('The Contact could not be loaded.')
      const found = r.data.find((c) => c.id === contactId)
      if (!found) throw new Error('That Contact no longer exists.')
      return found
    },
  })

  // ── EVERY NAVIGATION RE-READS THE RECORD ──────────────────────────────
  //
  // The vanilla did, and parity needs it: navigating back to a contact whose
  // status changed elsewhere - or whose status THIS SCREEN changed by
  // qualifying it - must not serve the cached row. Measured by the walk: after
  // a successful qualify the record read "Unqualified" on the next visit, and
  // the back button therefore went to leads instead of contacts.
  //
  // Keyed on navToken rather than on mount, because root.render() re-renders
  // this instance instead of remounting it, so useQuery sees no new observer
  // and refetchOnMount never fires.
  const refetch = contact.refetch
  useEffect(() => { if (navToken !== undefined) void refetch() }, [navToken, refetch])

  // ── C1: THE RETURN VIEW IS PUBLISHED FROM HERE ─────────────────────────
  //
  // app.js bound its back button to `cdReturnView`, a `let` in the vanilla.
  // Classic scripts share one lexical scope so that worked; a bundle cannot
  // reach the name at all. The shell now asks through a guarded accessor and
  // this is what answers it.
  //
  // Published as an EFFECT rather than during render, so there is one moment
  // where it changes and it is the record arriving.
  const status = contact.data?.status ?? null
  useEffect(() => {
    shell.setContactReturnView(returnViewFor(status))
  }, [shell, status])

  // ── detailLoaded ON EVERY NAVIGATION, NOT EVERY STATE CHANGE ──────────
  //
  // Round 41 item K, and NO DEPENDENCY ARRAY, which is the whole fix.
  //
  // Written as `useEffect(..., [settled, shell])` this fires when `settled`
  // CHANGES. Navigating to a record whose query is already cached leaves
  // `settled` true from the first render, so the dependency never changes, the
  // effect never re-runs, and `detailLoaded` is never called for that
  // navigation - while app.js has just set `is-loading` on the view expecting
  // it to be cleared.
  //
  // MEASURED BY THE LIVE WALK: re-opening the same contact left the view at
  // `class="wrap is-loading"` with the panel fully rendered underneath it,
  // permanently. Item K's own failure - an exit that forgets the flag - through
  // a memoised effect rather than an early return.
  //
  // Running on every render is right and cheap: detailLoaded removes a class,
  // and "the view has painted and is not pending" is a per-render fact rather
  // than a per-transition one.
  const settled = !contact.isPending
  useEffect(() => { if (settled) shell.detailLoaded(VIEW) })

  if (contact.isPending) {
    return <p className="pg-item-note" data-testid="contact-loading">Loading the Contact…</p>
  }
  if (contact.isError) {
    return (
      <p className="msg-error" data-testid="contact-error">
        {contact.error instanceof Error ? contact.error.message : 'The Contact could not be loaded.'}
      </p>
    )
  }

  // A4: navToken travels to the host so the edit surface can key its drafts on
  // the VISIT, not just on the record. Navigating away and back to the SAME
  // lead must drop unsaved edits too - which keying on the id alone does not
  // do, measured on the live screen after the unit test was already green.
  return <ContactHost contact={contact.data} navToken={navToken} />
}
