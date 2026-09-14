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
import {
  contactDescriptors, contactGridFields, gateKeyFor,
  SOURCE_OPTIONS, REGION_OPTIONS, type ContactSource,
} from './descriptors'
import { FieldGrid } from '../leads/FieldGrid'
import { tintedRows, accountCardBlocked, type BlockingState } from './blocking'
import { AccountSection, type AccountRef } from '../leads/AccountSection'

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
  source, subject, blocking, account, parentRecordId, onSave, onDirtyChange, onBack, actions,
  linkPanel, notes, status, leadName, followUp, nurturePanel, qualifyBlockers,
}: {
  source: ContactSource
  /** A4: the record being edited. Changing it drops every unsaved draft. */
  subject?: string | null
  blocking: BlockingState | null
  /**
   * R6: the account as the ROUTE resolved it, which is the same derivation
   * `GET /contacts` uses. This screen used to take a bare `accountName`
   * read from `record.account?.name` - a key no route returned - so all ten
   * live Qualified contacts were told they had no account.
   */
  account: AccountRef | null
  /** What separates "no account" from "an account that would not resolve". */
  parentRecordId?: string | null
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
  // THE MODE SIGNAL, and it is the estate's existing one rather than a new
  // one: `returnViewFor` and `StageActions` both already branch on exactly
  // this. `record_type` cannot tell them apart - leads and contacts are both
  // `record_type: 'contact'` - so status is the only signal there is.
  const qualified = status === 'Qualified'
  const fields = contactDescriptors(source)
  // R8: the same descriptors in the shared grid's shape. The KEY is unchanged,
  // so `industry` stays `industry` all the way into `rows.changes` and
  // `ContactHost.onSave` keeps its existing contract.
  const gridFields = contactGridFields(source)
  // C23: THE SERVER GOVERNS THE MARKS. `qualifyBlockers` is the server's own
  // derivation (GET /records/:id/exit-criteria), which is the same list the
  // hint above renders - so the asterisk and the sentence cannot disagree
  // (Verification 43). Mapped through `gateKeyFor` because the gate calls
  // Industry `industry_id` and this surface calls it `industry`.
  const outstandingKeys = new Set((qualifyBlockers ?? []).map((b) => b.field))
  const outstanding = new Set(
    fields.map((f) => f.name).filter((n) => outstandingKeys.has(gateKeyFor(n))))
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

        {/* R1: THE TITLE IS MODE-AWARE. "Lead details" was a hardcoded literal
            - Architecture 9's fourth variant - true when it was typed and
            false from the moment this surface began serving contacts. Sentence
            case, per the estate's output convention and the string it
            replaces. */}
        <div className="cd-title" data-testid="cd-title">
          {qualified ? 'Contact details' : 'Lead details'}
        </div>

        {/* ── 3: THE HEADER ACTION ROW ──────────────────────────────────
            Status badge, Qualify, Nurture on the left; the dirty indicator,
            Save and Discard pushed right. The lead NAME shares this row at
            18pt, which is what "same row as the lead name" means. */}
        <div className="cd-header-row" data-testid="cd-header-row">
          <h2 className="cd-lead-name" data-testid="cd-lead-name">
            {leadName || '--'}
          </h2>

          {/* R2: the chip is a LEAD affordance. On a contact it says
              "QUALIFIED" on the screen you can only reach by being qualified,
              so it is implied by where you are. A lead still shows its own. */}
          {status && !qualified
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

      {/* ── 6: CONTACT DETAILS and ADDRESS, as the SHARED DENSE GRID ─────
          R8, direction (c). These two cards were COLLAPSED BY DEFAULT, so at
          1440 this screen showed ZERO of the record's fifteen fields on load,
          measured against the completion surface's fourteen. That is the
          finding the ruling came from.

          THE RENDERING IS ALL THAT CHANGED. The nine layout slots around it
          are untouched, and so is everything underneath: `rows` is the same
          `FieldRowsController`, so `rows.changes`, `rows.dirtyCount`,
          `rows.discardAll()` and the header's Save mean exactly what they
          meant, and `ContactHost.onSave` - which writes the change-note audit
          trail - never learns that the display moved. Round B measured what a
          naive swap does to that trail: it goes silently, and no test on the
          replacement can notice, because the replacement never had it.

          THE DOOR ARRIVES DIFFERENTLY AND IS THE SAME RULE. A display/edit row
          enforces ownership by refusing to OPEN; an always-open input has no
          such moment, so `canEdit` is passed as `disabled`. One rule, two
          renderings, not a second door. */}
      {/* FULL WIDTH, STACKED, rather than the half-width `ref-cards` pair.
          `.lead-complete-grid` is `repeat(auto-fit, minmax(190px, 1fr))`, so
          its density is a function of the width it is GIVEN: inside a
          half-width card it resolves to ONE column, which is the shape the
          first owner screenshot showed. The ruling asked for the dense grid,
          and the grid cannot be dense in 380px. The testid is kept because
          `probe-p3-layout.mjs` measures this container's top. */}
      <div data-testid="cd-cards">
        <FieldGrid
          name="contact-details" title="Contact Details" testid="cd-card-contact"
          className="lead-complete-group pg-card"
          fields={gridFields.filter((f) => CONTACT_FIELDS.includes(f.key))}
          valueOf={(k) => rows.valueOf(k)}
          onChange={(k, v) => rows.setDraft(k, v)}
          missing={outstanding}
          tinted={tinted}
          industries={source.industries}
          sources={[...SOURCE_OPTIONS]}
          regions={[...REGION_OPTIONS]}
          disabled={!rows.canEdit}
          inputTestid={(k) => `input-${k}`}
          missingTestid={(k) => `cd-needs-${k}`} />

        <FieldGrid
          name="address-details" title="Address Details" testid="cd-card-address"
          className="lead-complete-group pg-card"
          fields={gridFields.filter((f) => ADDRESS_FIELDS.includes(f.key))}
          valueOf={(k) => rows.valueOf(k)}
          onChange={(k, v) => rows.setDraft(k, v)}
          missing={outstanding}
          tinted={tinted}
          industries={source.industries}
          sources={[...SOURCE_OPTIONS]}
          regions={[...REGION_OPTIONS]}
          disabled={!rows.canEdit}
          inputTestid={(k) => `input-${k}`}
          missingTestid={(k) => `cd-needs-${k}`} />
      </div>

      {/* ── 7: ACCOUNT. Its empty state is one of the things keeping
          Qualify disabled, which is why it is not inside a collapsed card.

          R2/R6: the SHARED section, not a card local to this screen. Both
          testids survive by name - five callers address them, and
          `probe-gated-fields-reachable.mjs` treats `cd-card-account` as
          `parent_record_id`'s own container. */}
      <AccountSection
        account={account}
        parentRecordId={parentRecordId}
        blocked={accountCardBlocked(blocking)}
        framed
        testid="cd-card-account"
        statusTestid="cd-account-status">
        {linkPanel}
      </AccountSection>

      {/* ── 8: THE FOLLOW-UP TASK ─────────────────────────────────────── */}
      {followUp}

      {/* The shared EditBar is NOT rendered here any more: A1 moved Save and
          Discard into the header row above, and rendering both would put two
          Save controls on one surface. The import stays used by the other
          three surfaces, which are unchanged. */}
    </div>
  )
}
