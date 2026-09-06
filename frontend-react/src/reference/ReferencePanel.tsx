// ── ROUND 5 PHASE 1 ITEM 2: THE REFERENCE SURFACE ───────────────────────
//
// Behind the line: nothing registers this and the vanilla stays live.
import { useMemo, useState } from 'react'
import { FieldRow } from '../field-row/FieldRow'
import { EditBar } from '../field-row/EditBar'
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
              onChange={onSet} />}
        <span>Same as account</span>
      </label>
    </div>
  )
}

export function ReferencePanel({ source, links, closeMoves, oppId, onSave, onChanged }: {
  source: ReferenceSource
  links: KcLink[]
  closeMoves: unknown
  oppId: string
  onSave: (changes: Record<string, string>) => void
  onChanged: () => void
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

  const Card = ({ title, testId, children }: {
    title: string, testId: string, children: React.ReactNode
  }) => (
    <section className="pg-card" data-testid={testId}>
      <p className="pg-card-title">{title}</p>
      {children}
    </section>
  )

  return (
    <div className="ref-panel" data-testid="reference-panel">
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

      <Card title="Executive Summary" testId="ref-summary">
        {row('oppType')}
        {row('summary')}
      </Card>

      <EditBar rows={rows} onSave={onSave} />
    </div>
  )
}
