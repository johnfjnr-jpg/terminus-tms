// ── ROUND 5 PHASE 1 ITEM 4: KEY CONTACTS, ITS OWN COMPONENT ─────────────
//
// Phase 0 item 4's decision, and its reasoning, because the reasoning is what
// a later reader needs:
//
//   1. It is a COLLECTION over a join table with CRUD, not named fields on one
//      record's payload. There is no payload key for "the third key contact's
//      stance", so there is no FieldDescriptor to write.
//   2. IT DOES NOT RIDE THE BATCHED SAVE, and that is decisive. Every write
//      here lands immediately. The surface's drafts and its shared bar never
//      see them, so contract behaviour 6 would be actively WRONG applied here.
//   3. Its dirty is ARMED, not compared: a row reveals its record button when
//      touched. Behaviour 1 does not describe it.
//   4. Round 3's precedent: the milestone grids were built as their own
//      component for the same reasons.
//
// Measured on the live vanilla: ZERO `.ref-field-display` elements inside the
// panel, so it shares no markup with the row mechanism either.
import { useCallback, useEffect, useState } from 'react'
import { useShell } from '../ShellContext'

export interface KcVocabItem { id: string, name: string }
export interface KcLink {
  id: string
  contact_id: string
  contact_name: string
  role: string | null
  stance_id: string | null
  stance_note: string | null
  linked_at: string | null
}

/** The six routes Phase 0 enumerated, in one place so a reader can see them. */
export const KC_ROUTES = {
  roles: '/api/contact-roles',
  stances: '/api/contact-stances',
  contacts: '/api/contacts',
  add: (oppId: string) => `/api/opportunities/${oppId}/key-contacts`,
  stance: (oppId: string, linkId: string) =>
    `/api/opportunities/${oppId}/key-contacts/${linkId}/stance`,
  remove: (oppId: string, linkId: string) =>
    `/api/opportunities/${oppId}/key-contacts/${linkId}`,
} as const

export function KeyContacts({ oppId, links, onChanged }: {
  oppId: string
  links: KcLink[]
  /** The panel reloads the record. This component never batches. */
  onChanged: () => void
}) {
  const shell = useShell()
  const [roles, setRoles] = useState<KcVocabItem[]>([])
  const [stances, setStances] = useState<KcVocabItem[]>([])
  const [contacts, setContacts] = useState<KcVocabItem[]>([])
  const [armed, setArmed] = useState<Record<string, boolean>>({})
  const [draftStance, setDraftStance] = useState<Record<string, string>>({})
  const [draftNote, setDraftNote] = useState<Record<string, string>>({})
  const [addContact, setAddContact] = useState('')
  const [addRole, setAddRole] = useState('')
  const [addOther, setAddOther] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadVocabularies = useCallback(async () => {
    const [r, s, c] = await Promise.all([
      shell.api<KcVocabItem[]>('GET', KC_ROUTES.roles),
      shell.api<KcVocabItem[]>('GET', KC_ROUTES.stances),
      shell.api<KcVocabItem[]>('GET', KC_ROUTES.contacts),
    ])
    if (r.ok && Array.isArray(r.data)) setRoles(r.data)
    if (s.ok && Array.isArray(s.data)) setStances(s.data)
    if (c.ok && Array.isArray(c.data)) setContacts(c.data)
  }, [shell])

  useEffect(() => { void loadVocabularies() }, [loadVocabularies])

  // ── EVERY WRITE LANDS IMMEDIATELY ──────────────────────────────────────
  // Each of the three is its own round trip followed by a reload. Nothing
  // here is collected for a later Save, and a test asserts it.
  const record = async (linkId: string) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await shell.api('POST', KC_ROUTES.stance(oppId, linkId), {
        stance_id: draftStance[linkId] || null,
        note: draftNote[linkId] || null,
      })
      setFeedback(r.ok ? 'Recorded.' : 'Could not record that.')
      if (r.ok) { setArmed((a) => ({ ...a, [linkId]: false })); onChanged() }
    } finally { setBusy(false) }
  }

  const remove = async (linkId: string) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await shell.api('DELETE', KC_ROUTES.remove(oppId, linkId))
      setFeedback(r.ok ? 'Removed.' : 'Could not remove that.')
      if (r.ok) onChanged()
    } finally { setBusy(false) }
  }

  const add = async () => {
    if (busy) return
    if (!addContact) { setFeedback('Choose a contact to add.'); return }
    setBusy(true)
    try {
      const r = await shell.api('POST', KC_ROUTES.add(oppId), {
        contact_id: addContact,
        role: addRole === 'Other' ? addOther : addRole,
      })
      setFeedback(r.ok ? 'Added.' : 'Could not add that contact.')
      if (r.ok) { setAddContact(''); setAddRole(''); setAddOther(''); onChanged() }
    } finally { setBusy(false) }
  }

  return (
    <div className="kc-panel" data-testid="key-contacts">
      <table className="kc-table">
        <thead>
          <tr><th>Contact</th><th>Role</th><th>Stance</th><th>Linked</th><th /></tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.id} data-testid={`kc-row-${l.id}`}>
              <td>
                <span className="kc-name" role="link" tabIndex={0}
                  data-testid={`kc-name-${l.id}`}
                  onClick={() => shell.navigate('contact-detail', l.contact_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault(); shell.navigate('contact-detail', l.contact_id)
                    }
                  }}>{l.contact_name}</span>
              </td>
              <td>{l.role ?? '--'}</td>
              <td>
                <select data-testid={`kc-stance-${l.id}`}
                  value={draftStance[l.id] ?? l.stance_id ?? ''}
                  onChange={(e) => {
                    setDraftStance((d) => ({ ...d, [l.id]: e.target.value }))
                    setArmed((a) => ({ ...a, [l.id]: true }))
                  }}>
                  <option value="">--</option>
                  {stances.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input data-testid={`kc-note-${l.id}`} type="text"
                  value={draftNote[l.id] ?? l.stance_note ?? ''}
                  onChange={(e) => {
                    setDraftNote((d) => ({ ...d, [l.id]: e.target.value }))
                    setArmed((a) => ({ ...a, [l.id]: true }))
                  }} />
                {/* ARMED, not dirty-by-comparison. Behaviour 1 is not this. */}
                <button type="button" data-testid={`kc-record-${l.id}`}
                  hidden={!armed[l.id]} disabled={busy}
                  onClick={() => { void record(l.id) }}>Record</button>
              </td>
              <td>{l.linked_at ?? '--'}</td>
              <td>
                <span className="kc-remove" role="button" tabIndex={0}
                  data-testid={`kc-remove-${l.id}`}
                  onClick={() => { void remove(l.id) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void remove(l.id) }
                  }}>&times;</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="kc-add">
        <select data-testid="kc-add-contact" value={addContact}
          onChange={(e) => setAddContact(e.target.value)}>
          <option value="">Choose a contact</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select data-testid="kc-add-role" value={addRole}
          onChange={(e) => setAddRole(e.target.value)}>
          <option value="">Role</option>
          {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
          <option value="Other">Other</option>
        </select>
        {addRole === 'Other' && (
          <input data-testid="kc-add-other" type="text" value={addOther}
            onChange={(e) => setAddOther(e.target.value)} placeholder="Role" />
        )}
        <button type="button" data-testid="kc-add" disabled={busy}
          onClick={() => { void add() }}>Add</button>
      </div>

      <p data-testid="kc-feedback" className="kc-feedback">{feedback ?? ''}</p>
    </div>
  )
}
