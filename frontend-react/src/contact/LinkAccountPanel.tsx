// ── THE LINK-ACCOUNT PANEL ───────────────────────────────────────────────
//
// Round 6 Phase 1, on the Account surface's parent-link precedent: a search
// box, a result list, and a write that lands IMMEDIATELY rather than joining
// the batched save.
//
// ── WHY IT IS NOT A FIELD ────────────────────────────────────────────────
//
// Linking is its own business event: it may CREATE an Account, it always
// writes a Notes History entry, and the route refuses `account_id` on the
// ordinary PATCH for exactly that reason. A row on the edit bar would make it
// look like a field edit that could be discarded with everything else.
import { useRef, useState } from 'react'
import { useShell } from '../ShellContext'

export interface AccountOption { id: string, name: string }

/**
 * The SAME substring definition the search list uses, so the automatic open on
 * a blocked qualify and the manual search cannot disagree about what "matches"
 * means. The vanilla makes the same point in a comment; here it is one
 * function with two callers.
 */
export function findAccountMatches(query: string, accounts: AccountOption[]): AccountOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return accounts.filter((a) => a.name.toLowerCase().includes(q))
}

export function LinkAccountPanel({
  contactId, accounts, hasDirtyEdits, onConfirmDiscard, onLinked,
  submitPath, openLabel, startOpen = false, onCancel,
}: {
  contactId: string
  accounts: AccountOption[]
  hasDirtyEdits: boolean
  /** Asks the shared discard dialogue, then runs the link if it is accepted. */
  onConfirmDiscard: (proceed: () => void) => void
  onLinked: () => void
  /**
   * R7: REUSED AS QUALIFY'S ACCOUNT STEP, and this is the whole of the change.
   *
   * The panel builds exactly the two bodies the qualify route accepts -
   * `{account_id}` or `{new_account_name, account_details}` - so the account
   * step needed no second picker, only a different place to send them.
   *
   * Defaults to link-account, so LEAD DETAIL'S BEHAVIOUR IS UNTOUCHED (R4).
   * The card passes the qualify route, whose three writes happen inside one
   * transaction instead of this route's three separate calls.
   */
  submitPath?: string
  /** The card's step is already open and says "Qualify", not "Link to Account". */
  openLabel?: string
  startOpen?: boolean
  /**
   * When the panel is the card's account step it is already open, so its own
   * Cancel must cancel the STEP rather than collapse to a button nobody asked
   * for. Given, it replaces the default; omitted, Lead Detail behaves exactly
   * as before (R4).
   *
   * This is why the card does not render a Cancel of its own: the first build
   * did, and the screenshot showed TWO Cancel buttons side by side, one of
   * them an unstyled browser default.
   */
  onCancel?: () => void
}) {
  const shell = useShell()
  const [open, setOpen] = useState(startOpen)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  // ── A REF, NOT STATE. Round 4's finding, applied rather than repeated ──
  //
  // `if (inFlight) return` against a state variable cannot fire: two clicks in
  // one tick both read the same stale `false` from their own closure, and any
  // later click is already refused by the disabled attribute. A ref is read at
  // call time, so the guard is real. Round 4 removed a guard of exactly that
  // shape after calibration showed the only assertion that could fail was the
  // one asserting the guard existed.
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)

  const matches = findAccountMatches(query, accounts)

  const doLink = async (body: Record<string, unknown>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const r = await shell.api<{ error?: string }>(
        'POST', submitPath ?? `/api/contacts/${contactId}/link-account`, body)
      if (!r.ok) { setError(r.data?.error ?? 'Failed to link account.'); return }
      setOpen(false)
      setQuery('')
      onLinked()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // THE DIRTY PATH GUARDS TOO, and the vanilla's does not. Its check returns
  // BEFORE the flag is set, so two rapid clicks while dirty both open the
  // dialogue. Named in Phase 0 as C6 and closed here rather than reproduced.
  const start = (body: Record<string, unknown>) => {
    if (inFlight.current) return
    if (hasDirtyEdits) { onConfirmDiscard(() => { void doLink(body) }); return }
    void doLink(body)
  }

  if (!open) {
    return (
      <button type="button" data-testid="cd-btn-link-account"
        onClick={() => { setOpen(true); setError(null) }}>{openLabel ?? 'Link to Account'}</button>
    )
  }

  return (
    <div data-testid="cd-link-account-panel">
      <input
        data-testid="cd-link-search"
        value={query}
        placeholder="Search Accounts"
        onChange={(e) => setQuery(e.target.value)} />
      <div data-testid="cd-link-results">
        {matches.map((a) => (
          <button key={a.id} type="button" data-testid={`cd-link-${a.id}`}
            disabled={busy}
            onClick={() => start({ account_id: a.id })}>{a.name}</button>
        ))}
        {/* CREATING IS THE SAME WRITE, not a second path: the route takes
            either an id or a name, and a contact whose company matches no
            real Account has nothing to reconcile against. */}
        {query.trim() && !matches.length
          ? <button type="button" data-testid="cd-link-create" disabled={busy}
              onClick={() => start({ new_account_name: query.trim() })}>
              Create "{query.trim()}"
            </button>
          : null}
      </div>
      {error ? <div className="msg-error" data-testid="cd-link-error">{error}</div> : null}
      <button type="button" data-testid="cd-link-cancel"
        onClick={() => {
          setError(null)
          if (onCancel) { onCancel(); return }
          setOpen(false)
        }}>Cancel</button>
    </div>
  )
}
