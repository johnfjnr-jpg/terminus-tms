// ── B6: THE CLIENT BUYER ROWS ────────────────────────────────────────────
//
// Round A Phase 3. The vanilla's three shapes, read from `renderTbBuyerRows`:
//   - no linked Account: one line saying so;
//   - a LINKED role: read-only, the contact's name;
//   - an UNLINKED role: a select of the Account's contacts that saves on
//     choice, "+ New" beside it, and the refusal said under THAT role.
// A success says nothing: the record reloads and the role reads as linked.
import { useState } from 'react'
import type { LookupOption } from '../field-row/types'
import { CLIENT_BUYER_ROLES, CLIENT_BUYER_ROLE_LABELS, linkedFor, type BuyerLink } from './buyers'

export function BuyerLinks({ accountId, links, contacts, onLink, onNew }: {
  accountId: string | null
  links: readonly BuyerLink[] | undefined
  /** The contacts linked to this Test Bed's own Account. */
  contacts: readonly LookupOption[]
  /** Writes one link; resolves to the message to show under the role, or null. */
  onLink: (role: string, contactId: string) => Promise<string | null>
  /** Opens the shell's shared inline-creation modal for this role. */
  onNew: (role: string) => void
}) {
  const [choice, setChoice] = useState<Readonly<Record<string, string>>>({})
  const [errors, setErrors] = useState<Readonly<Record<string, string | null>>>({})
  const [busy, setBusy] = useState<Readonly<Record<string, boolean>>>({})

  if (!accountId) {
    return <p className="empty-state" data-testid="tb-buyers-no-account">No linked Account.</p>
  }

  return (
    <div data-testid="tb-buyer-rows">
      {CLIENT_BUYER_ROLES.map((role) => {
        const label = CLIENT_BUYER_ROLE_LABELS[role] ?? role
        const linked = linkedFor(links, role)
        if (linked) {
          return (
            <div key={role} className="field-row" data-field={`buyer-${role}`} data-readonly="true"
              data-testid={`tb-buyer-${role}`}>
              <div className="field-row-label">{label}</div>
              <div className="field-row-display" data-testid={`tb-buyer-linked-${role}`}>
                {linked.name ?? linked.contact_id}</div>
            </div>)
        }
        return (
          <div key={role} className="field-row" data-field={`buyer-${role}`} data-testid={`tb-buyer-${role}`}>
            <div className="field-row-label">{label}</div>
            {/* ONE SLOT, CONTROLS ABOVE THE MESSAGE. The message was a flex
                sibling of the controls inside the row, and a refusal squeezed
                the select to a few characters while wrapping its own words into
                a column (found by opening the screenshot, every assertion green). */}
            <div className="tb-buyer-slot">
            <div className="tb-buyer-controls">
              {/* SAVES ON CHOICE, with no separate Link click (the vanilla's
                  Round 6 Phase 2). Disabled while its own write is in flight:
                  the route accepts a second contact in a role, so a double
                  choice must not become two links. */}
              <select aria-label={`${label} contact`} data-testid={`tb-buyer-select-${role}`}
                value={choice[role] ?? ''} disabled={!!busy[role]}
                onChange={(e) => {
                  const contactId = e.target.value
                  setChoice((c) => ({ ...c, [role]: contactId }))
                  setErrors((x) => ({ ...x, [role]: null }))
                  if (!contactId) return
                  setBusy((b) => ({ ...b, [role]: true }))
                  void onLink(role, contactId).then((msg) => {
                    setErrors((x) => ({ ...x, [role]: msg }))
                    setBusy((b) => ({ ...b, [role]: false }))
                  })
                }}>
                <option value="">{contacts.length ? 'Select a contact' : 'No Contacts linked yet'}</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className="btn-sm btn-ghost" data-testid={`tb-buyer-new-${role}`}
                onClick={() => onNew(role)}>+ New</button>
            </div>
            {errors[role]
              ? <div data-testid={`tb-buyer-feedback-${role}`}><p className="msg-error">{errors[role]}</p></div>
              : null}
            </div>
          </div>)
      })}
    </div>
  )
}
