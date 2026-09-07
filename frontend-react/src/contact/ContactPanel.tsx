// ── ROUND 6 PHASE 1: THE CONTACT SURFACE ────────────────────────────────
//
// Behind the line: nothing registers this and the vanilla stays live.
//
// Built from the Phase 0 census and its live second instrument. The vanilla's
// CD_* constants are `const` in a classic script and unreadable from a bundle,
// so the descriptors are derived rather than imported - Round 2's rule.
import { useEffect, type ReactNode } from 'react'
import { FieldRow } from '../field-row/FieldRow'
import { EditBar } from '../field-row/EditBar'
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
function Card({ title, testId, blocked, children }: {
  title: string, testId: string, blocked?: boolean, children: ReactNode
}) {
  return (
    <div className={`cd-card${blocked ? ' field-blocked' : ''}`} data-testid={testId}>
      <div className="cd-card-title">{title}</div>
      {children}
    </div>
  )
}

export function ContactPanel({ source, blocking, accountName, onSave, onDirtyChange, onBack, actions, linkPanel }: {
  source: ContactSource
  blocking: BlockingState | null
  accountName: string | null
  onSave: (changes: Record<string, string>) => void
  /** The link panel needs to know, because linking may lose unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void
  /** Where Back goes. Owned here, because React owns this container. */
  onBack?: () => void
  /** The stage actions, owned by the host: Qualify, Park, Unqualify, Delete. */
  actions?: ReactNode
  /** The link-account panel, owned by the host because linking is its own write. */
  linkPanel?: ReactNode
}) {
  const fields = contactDescriptors(source)
  const rows = useFieldRows(fields)
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
    <div data-testid="contact-panel">
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
      <div className="cd-header" data-testid="cd-header">
        <button className="btn-text" id="btn-back-contact-detail" type="button"
          data-testid="cd-back" onClick={() => onBack?.()}>Back</button>
        <div className="cd-eyebrow" data-testid="cd-eyebrow">Contact</div>
        {row('name')}
        <div className="cd-company-subtitle" data-testid="cd-company">
          {accountName ?? source.payload.company as string ?? ''}
        </div>
      </div>

      <Card title="Contact Details" testId="cd-card-contact">
        {['company', 'jobRole', 'email', 'mobile', 'linkedin', 'industry', 'source'].map(row)}
      </Card>

      <Card title="Account" testId="cd-card-account" blocked={accountCardBlocked(blocking)}>
        <div data-testid="cd-account-status">
          {accountName ? accountName : 'Not linked'}
        </div>
        {linkPanel}
      </Card>

      <Card title="Address" testId="cd-card-address">
        {['address', 'address2', 'city', 'postcode', 'country', 'region'].map(row)}
      </Card>

      <Card title="Summary" testId="cd-card-summary">
        {row('summary')}
      </Card>

      {actions}

      <EditBar rows={rows} onSave={onSave} saveId="cd-save-all" />
    </div>
  )
}
