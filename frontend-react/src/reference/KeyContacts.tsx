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
// R7: the one formatter, replacing a raw ISO render.
import { formatTimestamp } from '../../../src/lib/format-dates.js'

export interface KcVocabItem { id: string, name: string }

/**
 * What the two vocabulary routes actually answer. `/contact-roles` and
 * `/contact-stances` are tables of `{ id, label }`; neither carries a
 * top-level `name`. Typing them as `KcVocabItem` rendered every option on
 * this card BLANK while the fetches were returning the right rows.
 */
export interface KcVocabRow { id: string, label?: string | null }

/**
 * A key-contact row AS THE RECORD CARRIES IT. `GET /opportunities/:id`
 * already returns `key_contacts`, and its field names are not the ones this
 * component reads: `name` not `contact_name`, `stance` not `stance_id`,
 * `note` not `stance_note`.
 */
export interface KcLinkRow {
  id: string
  contact_id: string
  name?: string | null
  role?: string | null
  stance?: string | null
  note?: string | null
  linked_at?: string | null
}
export const linkRow = (k: KcLinkRow): KcLink => ({
  id: k.id,
  contact_id: k.contact_id,
  contact_name: k.name?.trim() || 'Unnamed contact',
  role: k.role ?? null,
  stance_id: k.stance ?? null,
  stance_note: k.note ?? null,
  linked_at: k.linked_at ?? null,
})
export const vocabOption = (v: KcVocabRow): KcVocabItem => ({
  id: v.id, name: v.label?.trim() || v.id,
})

/** What `GET /contacts` actually answers: a record row, name inside payload. */
export interface KcContactRow {
  id: string
  reference_code?: string | null
  payload?: { name?: string | null } | null
}

// AN ABSENT NAME IS SAID, NOT LEFT BLANK. The estate's recorded position, at
// `contacts.js:1021`: a silent fallback "made a missing name look like a
// supplied one, and nothing surfaced for eleven rounds". A blank option is
// exactly that fallback. All 17 live contacts carry a name and none carries a
// reference_code, so the last branch is defensive rather than expected.
export const contactOption = (c: KcContactRow): KcVocabItem => ({
  id: c.id,
  name: c.payload?.name?.trim() || c.reference_code || 'Unnamed contact',
})
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

export function KeyContacts({ oppId, accountId, links, onChanged }: {
  oppId: string
  /**
   * R-W3: THE OPPORTUNITY'S LINKED ACCOUNT, or null when it has none.
   *
   * The picker offered every live contact in the system. It now offers the
   * contacts OF THIS ACCOUNT, which is what a key customer contact is.
   * `null` is a real state and the screen says so rather than rendering an
   * empty list that looks like a loading failure.
   */
  accountId: string | null
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
      shell.api<KcVocabRow[]>('GET', KC_ROUTES.roles),
      shell.api<KcVocabRow[]>('GET', KC_ROUTES.stances),
      // R-W3: SCOPED TO THE ACCOUNT. `?account_id=` has existed on this route
      // since Round 11 and filters on `parent_record_id`, the column a
      // contact's account actually lives in, so this is a parameter rather
      // than a new query. With no account there is nothing to ask for, and
      // asking without the parameter would return every contact in the
      // system - which is the behaviour being removed.
      accountId
        ? shell.api<KcContactRow[]>('GET', `${KC_ROUTES.contacts}?account_id=${encodeURIComponent(accountId)}`)
        : Promise.resolve({ ok: true, data: [] as KcContactRow[] }),
    ])
    if (r.ok && Array.isArray(r.data)) setRoles(r.data.map(vocabOption))
    if (s.ok && Array.isArray(s.data)) setStances(s.data.map(vocabOption))
    // F1: MAPPED FROM THE ROUTE'S OWN SHAPE. `/contacts` answers whole record
    // rows and a contact's name lives in `payload.name`; roles and stances are
    // vocabulary tables that really do carry a top-level `name`. Typing all
    // three as one `KcVocabItem` made the contacts read `c.name`, which is
    // `undefined`, so every option rendered BLANK while the fetch was
    // returning exactly the right rows. Unchanged since `da207cf`, and not
    // R-W3's doing: R-W3 corrected WHICH contacts arrive, never their labels.
    if (c.ok && Array.isArray(c.data)) setContacts(c.data.map(contactOption))
  }, [shell, accountId])

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
      // THE ROUTE TAKES EXACTLY ONE OF `role_id` OR `role_other`, and refuses
      // with "supply exactly one of role_id or role_other". This sent `role`,
      // so every Add answered 400 and the card said "Could not add that
      // contact". Measured against the live route before it was changed.
      const typed = addOther.trim()
      const r = await shell.api('POST', KC_ROUTES.add(oppId), {
        contact_id: addContact,
        ...(addRole === 'Other' ? { role_other: typed } : { role_id: addRole }),
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
              <td>{formatTimestamp(l.linked_at) || '--'}</td>
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

      {/* ── R-W3: AN OPPORTUNITY WITH NO ACCOUNT SAYS SO ──────────────────
          The picker is scoped to the linked account's contacts, so without an
          account there is nothing to offer. An empty dropdown is indis-
          tinguishable from a list that failed to load, and this estate has
          spent whole rounds on exactly that ambiguity, so the absence is
          stated in a sentence rather than left to be inferred from a control
          with nothing in it. */}
      {!accountId ? (
        <p className="field-note" data-testid="kc-no-account">
          This opportunity has no linked account, so there are no contacts to
          choose from. Link an account on the Customer Details card first.
        </p>
      ) : null}

      <div className="kc-add">
        <select data-testid="kc-add-contact" value={addContact}
          disabled={!accountId}
          onChange={(e) => setAddContact(e.target.value)}>
          <option value="">Choose a contact</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select data-testid="kc-add-role" value={addRole}
          onChange={(e) => setAddRole(e.target.value)}>
          <option value="">Role</option>
          {/* THE VALUE IS THE ID, because the route takes `role_id`. It was
              the name, so even a correctly-labelled option posted the wrong
              thing. 'Other' stays a literal sentinel and is not an id. */}
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
