// ── ROUND 6 PHASE 1: THE CONTACT SURFACE ────────────────────────────────
//
// Behind the line: nothing registers this and the vanilla stays live.
//
// Built from the Phase 0 census and its live second instrument. The vanilla's
// CD_* constants are `const` in a classic script and unreadable from a bundle,
// so the descriptors are derived rather than imported - Round 2's rule.
import { useEffect, useState, type ReactNode } from 'react'
import { FieldRow } from '../field-row/FieldRow'
import { useFieldRows } from '../field-row/useFieldRows'
import { contactDescriptors, type ContactSource } from './descriptors'
import { tintedRows, accountCardBlocked, type BlockingState } from './blocking'

/**
 * A titled card.
 *
 * DEFINED AT MODULE SCOPE, and that is load-bearing rather than style. Round 5
 * declared one inside a component body, which gives it a new component type on
 * every render: React cannot reconcile two different types, so it unmounted and
 * remounted the whole subtree on every keystroke and a textarea's caret reset
 * to 0 each time. Typing `abcd` produced `dcba`.
 */
/**
 * P3: A CARD THAT CAN COLLAPSE.
 *
 * Contact Details and Address are COLLAPSED BY DEFAULT per the ruled layout.
 * The toggle is a real `<button>` rather than a div, so the door treats it as
 * what it is: a DISCLOSURE, which stays alive on an unowned lead. A person who
 * may not edit a lead must still be able to read it, and a collapsed panel
 * they cannot open is a panel they cannot read.
 *
 * `blocked` is unchanged and still tints the card. A collapsed card that is
 * blocking Qualify still shows its tint on the HEAD, or the hint would name a
 * field behind a fold with nothing pointing at it.
 */
function Collapsible({ title, testId, blocked, blockedCount, children }: {
  title: string, testId: string, blocked?: boolean, blockedCount?: number, children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`pg-card${blocked ? ' field-blocked' : ''}`} data-testid={testId}>
      <button
        type="button"
        className="pg-card-title cd-collapse-head"
        data-testid={`${testId}-toggle`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        {blockedCount
          ? <span className="tag" data-testid={`${testId}-blocked-count`}>{blockedCount}</span>
          : null}
        <span className="cd-collapse-caret" aria-hidden="true">{open ? '\u2212' : '+'}</span>
      </button>
      <div data-testid={`${testId}-body`} hidden={!open}>{children}</div>
    </div>
  )
}

function Card({ title, testId, blocked, children }: {
  title: string, testId: string, blocked?: boolean, children: ReactNode
}) {
  return (
    // ── THE CLASSES ARE THE APPLICATION'S OWN, ADOPTED NOT INVENTED ──────
    //
    // `.pg-card` and `.pg-card-title` already carry the hairline border and the
    // mono uppercase title every other card on this app uses, and `.ref-cards`
    // is the responsive grid the Reference tab and the vanilla Contact view
    // both sit in. Writing a `.cd-card` beside them would be a second
    // definition of one look - Verification 20 in a stylesheet - and the Round
    // 5 finding was that a migrated surface with NO adopted classes reads as
    // plain text stacked down the page.
    <div className={`pg-card${blocked ? ' field-blocked' : ''}`} data-testid={testId}>
      <div className="pg-card-title">{title}</div>
      {children}
    </div>
  )
}

// P3's ruled field groups. `jobRole` IS INCLUDED AND THE LAYOUT DID NOT LIST
// IT - see the P3 report. It is one of the 15 fields gated at Qualify, so a
// screen without it can never satisfy the gate it also renders a hint for.
// P3's ruled Contact Details list is: Company, Email, Mobile, LinkedIn,
// Industry, Source. TWO FIELDS ARE ADDED HERE AND BOTH ARE REPORTED, because
// each is GATED AT QUALIFY and a screen that renders the Qualify hint while
// giving a person no way to satisfy it is worse than one that renders neither:
//
//   jobRole   gated, and absent from the ruled list entirely
//   name      gated, and now the 18pt HEADING rather than a row - the heading
//             displays it, so without a row it became uneditable
//
// The heading stays exactly as ruled; `name` is a row as well, which is how
// the look and the capability both survive.
const CONTACT_FIELDS = ['name', 'company', 'jobRole', 'email', 'mobile', 'linkedin', 'industry', 'source']
const ADDRESS_FIELDS = ['address', 'address2', 'city', 'postcode', 'country', 'region']

export function ContactPanel({
  source, subject, blocking, accountName, onSave, onDirtyChange, onBack, actions,
  linkPanel, notes, status, leadName, followUp, nurturePanel, qualifyBlockers,
}: {
  source: ContactSource
  /** A4: the record being edited. Changing it drops every unsaved draft. */
  subject?: string | null
  blocking: BlockingState | null
  accountName: string | null
  onSave: (changes: Record<string, string>) => void
  /** The link panel needs to know, because linking may lose unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void
  /** Where Back goes. Owned here, because React owns this container. */
  onBack?: () => void
  /** The notes history, owned by the host because its write is its own. */
  notes?: ReactNode
  /** The status tag the vanilla shows beside the name. */
  status?: string | null
  /** The stage actions, owned by the host: Qualify, Park, Unqualify, Delete. */
  actions?: ReactNode
  /** The link-account panel, owned by the host because linking is its own write. */
  linkPanel?: ReactNode
  /** P3: the lead's own name, rendered at 18pt in the header. */
  leadName?: string
  /** P3: the follow-up task panel, owned by the host because its write is its own. */
  followUp?: ReactNode
  /** P3: the inline Nurture panel, shown under the header when open. */
  nurturePanel?: ReactNode
  /**
   * P3: what Qualify is still waiting for, READ FROM THE SERVER'S OWN
   * DERIVATION (GET /records/:id/exit-criteria), never from a second list.
   * Empty means nothing is blocking and Qualify is enabled.
   */
  qualifyBlockers?: Array<{ field: string, message?: string }>
}) {
  const fields = contactDescriptors(source)
  // A4: the record being edited. When it changes, every draft is dropped -
  // edits live only until saved or discarded, and navigating away is neither.
  const rows = useFieldRows(fields, subject)
  const tinted = tintedRows(blocking, fields.map((f) => f.name))
  const dirty = rows.dirtyCount > 0
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  // THE TINT IS A PROPERTY OF THE ROW, applied by wrapping rather than by
  // reaching into FieldRow. The row component is shared across four surfaces
  // and blocking is one surface's concern.
  const row = (name: string) => {
    const f = fields.find((x) => x.name === name)
    if (!f) return null
    return (
      <div key={name} data-key={name}
        className={tinted.has(name) ? 'field-blocked' : undefined}>
        <FieldRow field={f} rows={rows} />
      </div>
    )
  }

  return (
    <div className="cd-panel" data-testid="contact-panel">
      {/* THE NAME HEADER. In the vanilla this is static markup populated by id,
          which is what hid summary's editor kind from the source census. Here
          it is an ordinary row that happens to sit in the header, so it has a
          door, a discard and a draft like every other field. */}
      {/* ── THE BACK BUTTON IS REPRODUCED, NOT INHERITED ─────────────────
          createRoot CLEARS this container on first render, so the static
          #btn-back-contact-detail is destroyed and app.js's load-time listener
          is left bound to an element that no longer exists. MEASURED by the
          walk: the button was simply gone.

          Both migrated views before this one solve it the same way - render
          the button with the same id and own the handler - and app.js:5258
          still binds a dead listener to the Account one for the same reason.
          The shell's own binding stays because it is the REVERT path: restore
          the vanilla tag and the static markup is what runs again. */}
      {/* ── 1 and 2: BACK, then the title and the lead name ──────────────
          The shell binds a load-time listener to #btn-back-contact-detail, so
          the id is kept and the handler is owned here - both migrated views
          before this one solve it the same way. */}
      <div className="cd-header" data-testid="cd-header">
        <button className="btn-text" id="btn-back-contact-detail" type="button"
          data-testid="cd-back" onClick={() => onBack?.()}>Back</button>

        <div className="cd-title" data-testid="cd-title">Lead details</div>

        {/* ── 3: THE HEADER ACTION ROW ──────────────────────────────────
            Status badge, Qualify, Nurture on the left; the dirty indicator,
            Save and Discard pushed right. The lead NAME shares this row at
            18pt, which is what "same row as the lead name" means. */}
        <div className="cd-header-row" data-testid="cd-header-row">
          <h2 className="cd-lead-name" data-testid="cd-lead-name">
            {leadName || '--'}
          </h2>

          {status
            ? <span className="tag" data-testid="cd-status">{status.toUpperCase()}</span>
            : null}

          {actions}

          <div className="cd-header-right" data-testid="cd-header-right">
            {/* THE DIRTY INDICATOR CARRIES THE UNSAVED STATE, and it is here
                because of a P2 consequence rather than a preference: Escape
                reverts and is the only revert, so a COLLAPSED panel can never
                show a pending edit. With Contact Details and Address collapsed
                by default, this count is the only thing on screen that knows
                an edit exists. It is not decoration. */}
            <span className="cd-dirty" data-testid="cd-dirty-indicator"
              hidden={rows.dirtyCount === 0}>
              {rows.dirtyCount === 1 ? '1 unsaved change' : `${rows.dirtyCount} unsaved changes`}
            </span>
            <button type="button" id="cd-save-all" data-testid="save-all"
              disabled={rows.dirtyCount === 0}
              onClick={() => onSave(rows.changes)}>Save</button>
            <button type="button" data-testid="discard-all"
              disabled={rows.dirtyCount === 0}
              onClick={() => rows.discardAll()}>Discard</button>
          </div>
        </div>

        {/* THE QUALIFY HINT, naming what is missing. The server is the
            enforcement; this is the surface, and it reads the server's OWN
            derivation so the two cannot drift (Verification 43). */}
        {qualifyBlockers && qualifyBlockers.length
          ? <div className="cd-qualify-hint" data-testid="cd-qualify-hint">
              {`Qualify needs ${qualifyBlockers.length} more: `}
              <span data-testid="cd-qualify-hint-fields">
                {qualifyBlockers.map((b) => b.field).join(', ')}
              </span>
            </div>
          : null}

        {nurturePanel}
      </div>

      {/* ── 4: SUMMARY ────────────────────────────────────────────────── */}
      <Card title="Summary" testId="cd-card-summary">
        {row('summary')}
      </Card>

      {/* ── 5: NOTES, as a PANEL ──────────────────────────────────────
          It was bare text between two cards until the screenshot was opened:
          every assertion passed, and Summary sat in a panel while Notes did
          not. Verification 4 - presence is not legibility, and no assertion
          can tell them apart. */}
      <Card title="Notes" testId="cd-card-notes">
        {notes}
      </Card>

      {/* ── 6: CONTACT DETAILS and ADDRESS, side by side, COLLAPSED ───── */}
      <div className="ref-cards" data-testid="cd-cards">
        <Collapsible title="Contact Details" testId="cd-card-contact"
          blocked={CONTACT_FIELDS.some((n) => tinted.has(n))}
          blockedCount={CONTACT_FIELDS.filter((n) => tinted.has(n)).length}>
          {CONTACT_FIELDS.map(row)}
        </Collapsible>

        <Collapsible title="Address Details" testId="cd-card-address"
          blocked={ADDRESS_FIELDS.some((n) => tinted.has(n))}
          blockedCount={ADDRESS_FIELDS.filter((n) => tinted.has(n)).length}>
          {ADDRESS_FIELDS.map(row)}
        </Collapsible>
      </div>

      {/* ── 7: ACCOUNT. Its empty state is one of the things keeping
          Qualify disabled, which is why it is not inside a collapsed card. */}
      <Card title="Account" testId="cd-card-account" blocked={accountCardBlocked(blocking)}>
        <div data-testid="cd-account-status">
          {accountName ? accountName : 'Not linked'}
        </div>
        {linkPanel}
      </Card>

      {/* ── 8: THE FOLLOW-UP TASK ─────────────────────────────────────── */}
      {followUp}

      {/* The shared EditBar is NOT rendered here any more: A1 moved Save and
          Discard into the header row above, and rendering both would put two
          Save controls on one surface. The import stays used by the other
          three surfaces, which are unchanged. */}
    </div>
  )
}
