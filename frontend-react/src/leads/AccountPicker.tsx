// ── R1: THE ACCOUNT PICKER, AS A TYPE-AHEAD ──────────────────────────────
//
// Replaces the button-spray: a row of match boxes that grows with the data,
// with Create at the end of it dressed exactly like a real account. Phase 0
// photographed `CREATE "A"` sitting fourth in a row of three accounts.
//
// ── CARD-LOCAL, AND THAT IS THE RULING ───────────────────────────────────
//
// R1: built cleanly but NOT generalised. Region is a fixed geographic list
// with no search, and the Names picker is a managed admin list that does not
// exist yet - three different selection types, and extracting a shared
// type-ahead waits until Names is a real second consumer. Premature
// abstraction is this round's named risk.
//
// WHAT IS SHARED IS THE MATCH DEFINITION, NOT THE COMPONENT.
// `findAccountMatches` is imported from LinkAccountPanel, so this picker and
// frozen Lead Detail's cannot disagree about what "matches" means -
// Verification 20's remedy, one definition imported - while LinkAccountPanel
// itself is untouched and its three optional props keep serving Detail.
//
// ── THE DOOR CONSTRAINT, MEASURED BEFORE BUILDING ────────────────────────
//
// `NON_ACTION_SELECTOR` exempts `[aria-expanded]` and `[aria-controls]`, and
// the door skips any element that `closest()`-matches an exemption. A
// combobox normally carries both attributes - so putting them on a WRAPPER
// would exempt every option and the Create button inside it, leaving live
// write controls on a lead somebody else owns.
//
// SO THE COMBOBOX ATTRIBUTES LIVE ON THE INPUT AND NOWHERE ELSE. The input is
// disabled by the door's first loop regardless of any exemption, and the
// listbox is a SIBLING of the input rather than a descendant, so nothing
// inside it inherits the exemption. Asserted both ways in the card probe.
import { useId, useRef, useState } from 'react'
import { useShell } from '../ShellContext'
import { findAccountMatches, type AccountOption } from '../contact/LinkAccountPanel'

export function AccountPicker({
  leadId, accounts, submitPath, onLinked, onCancel,
}: {
  leadId: string
  accounts: AccountOption[]
  /** The qualify route: its three writes happen in one transaction. */
  submitPath: string
  onLinked: () => void
  onCancel: () => void
}) {
  const shell = useShell()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // A REF, not state: two clicks in one tick both read the same stale `false`
  // from their own closure. Round 4 removed a guard of exactly that shape.
  const inFlight = useRef(false)
  const listId = useId()

  const matches = findAccountMatches(query, accounts)
  const q = query.trim()
  // The list opens only when there is something in it. A dropdown that opens
  // to say "no matches" is the empty-state sentence R4 removes, in a smaller
  // box: not opening IS the signal, and Create sits beside the input as the
  // way forward.
  const open = matches.length > 0

  const submit = async (body: Record<string, unknown>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const r = await shell.api<{ error?: string }>('POST', submitPath, body)
      if (!r.ok) { setError(r.data?.error ?? 'Failed to link account.'); return }
      onLinked()
    } finally { inFlight.current = false; setBusy(false) }
  }

  const choose = (a: AccountOption) => { void submit({ account_id: a.id }) }
  const create = () => { if (q) void submit({ new_account_name: q }) }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % matches.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? matches.length : i) - 1) }
    else if (e.key === 'Enter') {
      // Enter picks only what is HIGHLIGHTED. With nothing highlighted it does
      // nothing, rather than linking the first match somebody never looked at:
      // this writes an Account onto a lead and then qualifies it.
      if (active >= 0 && active < matches.length) { e.preventDefault(); choose(matches[active]) }
    }
  }

  return (
    <div className="acct-picker" data-testid={`acct-picker-${leadId}`}>
      {/* R6 convention: CREATE SITS TO THE RIGHT OF THE INPUT IT CREATES
          FROM, on the same line. It is never below the results and never
          inside them, because a control that makes a new thing must not be
          dressed as one of the existing things. */}
      <div className="acct-picker-row">
        <input
          className="acct-picker-input"
          data-testid={`acct-search-${leadId}`}
          value={query}
          placeholder="Search accounts"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && matches[active] ? `${listId}-${active}` : undefined}
          onChange={(e) => { setQuery(e.target.value); setActive(-1) }}
          onKeyDown={onKeyDown} />
        <button type="button" className="btn-primary acct-picker-create"
          data-testid={`acct-create-${leadId}`}
          disabled={busy || !q}
          title={q ? `Create a new account named ${q}` : 'Type a name to create an account'}
          onClick={create}>
          {q ? `Create "${q}"` : 'Create'}
        </button>

        {/* INSIDE THE ROW, which is the positioned element, so the list hangs
            directly off the input. As a sibling of the row it had NO
            positioned ancestor and laid itself out against the viewport -
            730px below the card. Every assertion passed on that: "position is
            absolute" and "the step does not grow" are both true of a list
            parked anywhere at all. The screenshot is what showed it.

            STILL NOT A WRAPPER AROUND THE INPUT: the row carries no exemption
            attribute, so the door reaches every option inside it. The aria
            lives on the input alone. */}
        {open
        ? (
          <ul className="acct-picker-list" id={listId} role="listbox"
            data-testid={`acct-list-${leadId}`}>
            {matches.map((a, i) => (
              <li key={a.id} role="presentation">
                <button type="button" role="option" id={`${listId}-${i}`}
                  aria-selected={i === active}
                  className={`acct-picker-option${i === active ? ' is-active' : ''}`}
                  data-testid={`acct-option-${a.id}`}
                  disabled={busy}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(a)}>{a.name}</button>
              </li>
            ))}
          </ul>
        )
        : null}
      </div>

      {error ? <div className="msg-error" data-testid={`acct-error-${leadId}`}>{error}</div> : null}
      <button type="button" className="btn-ghost acct-picker-cancel"
        data-testid={`acct-cancel-${leadId}`}
        onClick={() => { setError(null); onCancel() }}>Cancel</button>
    </div>
  )
}
