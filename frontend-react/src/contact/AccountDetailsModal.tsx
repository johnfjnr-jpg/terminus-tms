// ── A1 TO A6: THE ACCOUNT-DETAILS MODAL ──────────────────────────────────
//
// A1: two modes, one modal. `new` creates; `view` shows a linked Account
// read-only. One component rather than two, because they are the same fields
// and a second would be a second place for them to drift.
import { useEffect, useRef, useState } from 'react'
import { findAccountMatches, type AccountOption } from './LinkAccountPanel'

export type AccountDetailsMode = 'new' | 'view' | null

// ── THE IDS ARE NOT THE VANILLA'S, AND THE DETECTOR IS WHY ───────────────
//
// Round 6 Phase 2b. Every other Contact component reproduces the vanilla's ids
// deliberately, because they render inside the container createRoot clears. THIS
// ONE DOES NOT: the vanilla's #account-details-modal markup lives at
// index.html:2849, OUTSIDE #view-contact-detail, so it survives the mount and
// both copies would be in the document at once - the same arrangement that sent
// the Reference tab's focus to the wrong button.
//
// Caught by no-duplicate-ids.test.mjs before it shipped, which is the second
// time that instrument has paid for itself.
export function AccountDetailsModal({ mode, prefillName, viewing, accounts, onClose, onCreate, error }: {
  mode: AccountDetailsMode
  prefillName?: string
  /** In `view` mode, the linked Account being shown. */
  viewing?: { name: string, reference_code?: string | null, created_at?: string | null } | null
  accounts: AccountOption[]
  onClose: () => void
  onCreate: (name: string, parentId: string | null) => void
  error: string | null
}) {
  const [name, setName] = useState('')
  const [parentQuery, setParentQuery] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [own, setOwn] = useState<string | null>(null)
  const first = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!mode) return
    setName(mode === 'new' ? (prefillName ?? '') : (viewing?.name ?? ''))
    setParentQuery(''); setParentId(null); setOwn(null)
    first.current?.focus()
  }, [mode, prefillName, viewing?.name])

  useEffect(() => {
    if (!mode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [mode, onClose])

  if (!mode) return null
  const viewingMode = mode === 'view'

  const save = () => {
    // A3: the name is required.
    if (!name.trim()) { setOwn('A name is required.'); return }
    setOwn(null)
    onCreate(name.trim(), parentId)
  }

  return (
    <div className="modal-backdrop" data-testid="account-details-modal"
      // A6: backdrop click closes.
      onClick={(e) => {
        if ((e.target as HTMLElement).dataset.testid === 'account-details-modal') onClose()
      }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2 data-testid="account-details-heading">{viewingMode ? 'Account' : 'New Account'}</h2>

        <label htmlFor="cd-account-details-name">Name</label>
        <input id="cd-account-details-name" data-testid="cd-account-details-name" ref={first}
          value={name} readOnly={viewingMode}
          onChange={(e) => setName(e.target.value)} />

        {/* A4: the reference number is not invented before the Account is. */}
        <div data-testid="account-details-number">
          {viewingMode ? (viewing?.reference_code ?? '--') : 'Not yet generated'}
        </div>
        <div data-testid="account-details-created">
          {viewingMode ? (viewing?.created_at ?? '--') : '--'}
        </div>

        {/* A5: a parent, searched by the SAME substring rule the link panel
            uses - imported rather than restated, so the two cannot disagree
            about what "matches" means. */}
        {!viewingMode
          ? <div data-testid="account-details-parent">
              <label htmlFor="cd-account-details-parent-search">Parent account</label>
              <input id="cd-account-details-parent-search" data-testid="cd-account-details-parent-search"
                value={parentQuery} onChange={(e) => { setParentQuery(e.target.value); setParentId(null) }} />
              <div data-testid="account-details-parent-results">
                {findAccountMatches(parentQuery, accounts).map((a) => (
                  <button key={a.id} type="button" data-testid={`account-details-parent-${a.id}`}
                    className={parentId === a.id ? 'is-selected' : undefined}
                    onClick={() => { setParentId(a.id); setParentQuery(a.name) }}>{a.name}</button>))}
              </div>
            </div>
          : null}

        {own || error
          ? <div className="msg-error" data-testid="account-details-error">{own ?? error}</div>
          : null}

        <div className="form-actions">
          <button type="button" data-testid="account-details-cancel" onClick={onClose}>
            {viewingMode ? 'Close' : 'Cancel'}
          </button>
          {!viewingMode
            ? <button type="button" data-testid="account-details-save" onClick={save}>
                Create Account
              </button>
            : null}
        </div>
      </div>
    </div>
  )
}
