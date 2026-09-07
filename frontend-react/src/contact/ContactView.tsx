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

export function ContactView({ contactId }: { contactId: string }) {
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

  // detailLoaded on EVERY exit path, Round 41 item K: an early return that
  // forgets it hides the view permanently.
  const settled = !contact.isPending
  useEffect(() => { if (settled) shell.detailLoaded(VIEW) }, [settled, shell])

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

  return <ContactHost contact={contact.data} />
}
