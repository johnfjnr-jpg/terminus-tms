// ── ROUND 5 PHASE 1 ITEM 2: THE REFERENCE SURFACE ───────────────────────
//
// Behind the line: nothing registers this and the vanilla stays live.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { FieldRow } from '../field-row/FieldRow'
import { EditBar } from '../field-row/EditBar'
import { createPortal } from 'react-dom'
import { OpportunityBand } from '../opportunity/OpportunityBand'
import { useFieldRows } from '../field-row/useFieldRows'
import { CheckboxEditor } from '../field-row/editors'
import { useRef } from 'react'
import {
  referenceFields, referenceReadOnly, accountHasShipping, SAME_AS_ACCOUNT,
} from './descriptors'
import type { ReferenceSource } from './descriptors'
import { KeyContacts, type KcLink } from './KeyContacts'
import { useShell } from '../ShellContext'

/**
 * A7: the same-as-account flag is a DIRECT INPUT, not a row.
 *
 * No display half, no door, no seed, no discard. What it SHARES with the rows
 * is the draft store and the bar, because behaviour 2 puts drafts at the
 * surface and behaviour 6 makes the bar a property of the surface - so the
 * flag rides the same batched save as every field, which is what the vanilla
 * does and what item 5's B2 measured.
 *
 * Its dirty is by COMPARISON like everything else: setting it back to its
 * original clears the draft rather than leaving a "touched" flag, which item
 * 5's B3 measured on the live surface.
 */
function SameAsAccountToggle({ rows, disabled, value, onSet }: {
  rows: ReturnType<typeof useFieldRows>, disabled: boolean
  value: string, onSet: (next: string) => void
}) {
  const focusRef = useRef<HTMLElement | null>(null)
  const field = rows.fields.find((f) => f.name === SAME_AS_ACCOUNT)
  if (!field) return null
  return (
    <div className="ref-field" data-field={SAME_AS_ACCOUNT}>
      <div className="field-row-label">Proposal Address</div>
      <label className="ref-same-as-account">
        {disabled
          ? <input type="checkbox" data-testid={`input-${SAME_AS_ACCOUNT}`}
              checked={value === 'true'} disabled readOnly />
          : <CheckboxEditor
              field={field}
              value={value}
              testId={`input-${SAME_AS_ACCOUNT}`}
              focusRef={focusRef}
              onRequestClose={() => {}}
              // R-K: A7's DIRECT INPUT IS NOT A ROW, SO IT HAS NO NEXT FIELD.
              // This checkbox sits on the surface rather than inside a
              // `.field-row`, so there is no position in the panel's order to
              // move from. Answered explicitly rather than left to a default:
              // a required prop is what made both direct-mount sites declare
              // themselves instead of silently inheriting somebody's guess
              // (CLAUDE.md Architecture 9).
              onRequestMove={() => {}}
              onChange={onSet} />}
        <span>Same as account</span>
      </label>
    </div>
  )
}

/**
 * A titled card.
 *
 * DEFINED AT MODULE SCOPE, and that is load-bearing rather than style. It was
 * declared INSIDE ReferencePanel's body, which gives it a NEW COMPONENT TYPE
 * on every render - React cannot reconcile two different types, so it
 * unmounted and remounted the whole card subtree on every keystroke.
 *
 * MEASURED, typing "abcd" into the Executive Summary:
 *
 *   value  caret  sameDOMnode  editorMounts  editorUnmounts
 *   a      0      false        1             1
 *   ba     0      false        2             2
 *   cba    0      false        3             3
 *   dcba   0      false        4             4
 *
 * A fresh DOM node starts with its caret at 0, so every character landed in
 * front of the last and the text came out reversed.
 *
 * AN <input> HID IT COMPLETELY. FieldRow's focus effect restores the caret to
 * the end for an HTMLInputElement and not for a textarea, so text rows looked
 * perfect while being remounted just as hard. The textarea did not hide it,
 * which is the only reason this was found at all.
 */
function Card({ title, testId, children }: {
  title: string, testId: string, children: React.ReactNode
}) {
  return (
    <section className="pg-card" data-testid={testId}>
      <p className="pg-card-title">{title}</p>
      {children}
    </section>
  )
}

export function ReferencePanel({ source, links, closeMoves, oppId, onSave, onChanged, notes, followUp }: {
  source: ReferenceSource
  links: KcLink[]
  closeMoves: unknown
  oppId: string
  onSave: (changes: Record<string, string>) => void
  onChanged: () => void
  /** The band's two host-owned cards. Built by the host, composed here. */
  notes?: ReactNode
  followUp?: ReactNode
}) {
  const shell = useShell()
  const [now] = useState(() => new Date())

  // The flag's own draft decides the SHAPE of the six address rows, so it has
  // to be read before the descriptors are built. It lives in the same store as
  // everything else, which is why it is threaded rather than held separately.
  const [flagDraft, setFlagDraft] = useState<string | null>(null)
  const flagOrig = source.payload[SAME_AS_ACCOUNT] ? 'true' : ''
  const flagOn = (flagDraft ?? flagOrig) === 'true'

  // Only `source`, the branch and the flag's ORIGINAL change the shape. The
  // flag's DRAFT must not be in here: it changes on every tick of the toggle
  // and would rebuild all 21 descriptors with it.
  const fields = useMemo(() => [
    ...referenceFields(source, flagOn, now),
    { name: SAME_AS_ACCOUNT, label: 'Same as account', value: flagOrig, editor: 'checkbox' as const },
  ], [source, flagOn, now, flagOrig])

  const rows = useFieldRows(fields)

  // THE BAND'S CONTAINER, read on every render rather than once. `app.js`
  // rebuilds nothing here, but reading it during render keeps the lookup and
  // the portal in the same pass: an effect would set it one render later, and
  // the band would be missing from the first paint of every record.
  const bandHost = typeof document === 'undefined'
    ? null : document.getElementById('opp-band-root')

  // ── ONE WRITE, TWO STORES, AND WHY IT IS NOT setState-DURING-RENDER ────
  //
  // The flag decides the SHAPE of the six address rows, so it must be known
  // BEFORE the descriptors are built - which makes it circular with the
  // controller that holds it. Deriving it back out during render (`if (a !== b)
  // setState`) works and is fragile: it depends on a render-phase update, and
  // Verification 20 is exactly about two readers of one value drifting.
  //
  // Instead the toggle writes both explicitly in one handler, so there is one
  // moment where they change and it is a user action rather than a render.
  const setFlag = (next: string) => {
    setFlagDraft(next)
    rows.setDraft(SAME_AS_ACCOUNT, next)
  }

  const readOnly = referenceReadOnly(source, closeMoves)
  const byName = (n: string) => rows.fields.find((f) => f.name === n)!
  const row = (n: string) => <FieldRow key={n} field={byName(n)} rows={rows} />
  const ro = (label: string) => {
    const f = readOnly.find((r) => r.label === label)!
    return <FieldRow key={f.name} field={f} rows={rows} />
  }
  const canEdit = shell.canEditFields()

  return (
    // R-K, walk 3: the whole reference panel, so the name row above the cards
    // is in the same order as the rows inside them.
    <div className="ref-panel" data-field-panel="reference" data-testid="reference-panel">
      {row('name')}

      <div className="ref-cards">
      <Card title="Terminus Details" testId="ref-terminus">
        {ro('Terminus Reference')}
        {['lead', 'commercial', 'technical', 'legal', 'region', 'country'].map(row)}
        {ro('Stage')}
      </Card>

      <Card title="Customer Details" testId="ref-customer">
        {ro('Account')}
        {row('customerLead')}
        <SameAsAccountToggle rows={rows} disabled={!canEdit}
          value={flagDraft ?? flagOrig} onSet={setFlag} />
        {/* B6: with the flag on and no account address to stand in for, the
            vanilla renders a note and a link instead of six empty rows. */}
        {flagOn && !accountHasShipping(source.account)
          ? (
            <div className="ref-empty-inline" data-testid="ref-no-account-address">
              This account has no shipping address.{' '}
              <a href="#" onClick={(e) => {
                e.preventDefault()
                shell.navigate('account-detail', String(source.account?.id ?? ''))
              }}>Add it on the account</a>.
            </div>
          )
          : ['commAddress', 'commAddress2', 'commCity', 'commPostcode',
             'commCountry', 'commRegion'].map(row)}
      </Card>

      <Card title="Key Dates" testId="ref-dates">
        {ro('Date Created')}
        {row('estClose')}
        {ro('Est. Close Date Moves')}
        {['actualClose', 'estGoLive', 'actualGoLive', 'duration'].map(row)}
      </Card>
      </div>

      <Card title="Key Customer Contacts" testId="ref-key-contacts">
        <KeyContacts oppId={oppId} links={links} onChanged={onChanged} />
      </Card>

      {/* ── SUMMARY HAS MOVED TO THE RECORD BAND, and this card keeps what is
          left. The row is not duplicated: it is the SAME element, from the
          SAME draft store, rendered through a portal into the band's own
          container at the top of the record. Two summary editors would be two
          writers of one value, which is the drift Verification 20 is about.

          THE TITLE FOLLOWED THE CONTENT. A card headed "Executive Summary"
          over nothing but an opportunity-type row is the stale-literal shape
          Architecture 9 records: a sentence that was true when typed and is
          not derived from anything, so nothing can falsify it. The testId
          moved with it for the same reason, and it is asserted nowhere else -
          measured across the repository before renaming. */}
      <Card title="Opportunity type" testId="ref-opptype">
        {row('oppType')}
      </Card>

      {/* ── THE ID IS NOT THE VANILLA'S, AND MEASUREMENT IS WHY ───────────
          Round 6 Phase 1. This said `ref-save-all`, matching the vanilla it
          replaces. Measured live: TWO elements then carry that id, because the
          vanilla's tab-action buttons sit in #opp-tab-actions, OUTSIDE the
          #ref-vanilla block the swap hides. getElementById returns the first in
          document order, which is the vanilla one - so the reason dialogue
          returned focus to a button in a different container.
          A migrated surface names its own controls. */}
      <EditBar rows={rows} onSave={onSave} saveId="ref-react-save-all" />

      {/* ── THE RECORD BAND, RENDERED INTO THE TOP REGION ─────────────────
          A PORTAL rather than a second React root, and the reason is the
          draft store. The band's Summary row has to be the SAME row, in the
          SAME store, saved by the SAME EditBar as every other field on this
          surface. A separate root would need its own store and its own save
          path, which is two writers of one value.

          So the element is a child of this component in the React tree, and a
          child of `#opp-band-root` in the DOM. It inherits this panel's
          context and its store, and it renders at the top of the record where
          a record-level band belongs.

          THE CONTAINER IS VANILLA MARKUP and may legitimately be absent - the
          view is built by `app.js`, and a portal into a missing node throws.
          A null check is the whole guard. */}
      {bandHost ? createPortal(
        <OpportunityBand
          summaryField={byName('summary')}
          rows={rows}
          notes={notes}
          followUp={followUp} />,
        bandHost) : null}
    </div>
  )
}
