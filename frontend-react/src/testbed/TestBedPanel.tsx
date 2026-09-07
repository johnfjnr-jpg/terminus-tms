// ── ROUND 7 PHASE 1a: THE TEST BED FIELD SURFACE ────────────────────────
//
// Behind the line: nothing registers this and the vanilla stays live.
import { useEffect, type ReactNode } from 'react'
import { FieldRow } from '../field-row/FieldRow'
import { EditBar } from '../field-row/EditBar'
import { useFieldRows } from '../field-row/useFieldRows'
import { testBedDescriptors, buyerDescriptor, CLIENT_BUYER_ROLES, type TestBedSource } from './descriptors'
import { dateBounds } from './dateBounds'
import type { LookupOption } from '../field-row/types'

/**
 * A titled card, at MODULE SCOPE.
 *
 * Round 5 declared one inside a component body, which gives it a new type on
 * every render: React cannot reconcile two different types, so it remounted the
 * whole subtree on every keystroke and a textarea's caret reset to 0. Typing
 * `abcd` produced `dcba`.
 */
function Card({ title, testId, children }: { title: string, testId: string, children: ReactNode }) {
  return (
    <div className="pg-card" data-testid={testId}>
      <div className="pg-card-title">{title}</div>
      {children}
    </div>
  )
}

export function TestBedPanel({ source, contacts, buyers, onSave, onDirtyChange, onDraftsChange, notes, costBreakdown, controls, useCases }: {
  source: TestBedSource
  /** The Account's contacts, for the buyer lookups. */
  contacts: LookupOption[]
  /** role -> linked contact id. */
  buyers: Record<string, string>
  onSave: (changes: Record<string, string>) => void
  onDirtyChange?: (dirty: boolean) => void
  /** The cost preview needs the live drafts, and a preview is not a save. */
  onDraftsChange?: (drafts: Record<string, string>) => void
  notes?: ReactNode
  costBreakdown?: ReactNode
  /** installer, tech team - direct-write controls the host owns. */
  controls?: ReactNode
  /** The use-case list. Its writes are whole-list, so the host owns them. */
  useCases?: ReactNode
}) {
  const base = testBedDescriptors(source)

  // ── THE DATE BOUNDS ARE DERIVED FROM THE LIVE DRAFTS ─────────────────
  //
  // The vanilla mutates min/max on the inputs IN PLACE, because re-rendering a
  // row would throw away an open edit. Here the row keeps its draft in the
  // controller, so the descriptor can simply carry the bound - A4 as data, with
  // the value now depending on a sibling's draft rather than a constant.
  const rows0 = useFieldRows(base)
  const bounds = dateBounds(
    rows0.valueOf('estimatedInstallationDate'),
    rows0.valueOf('estGoLiveDate'),
  )
  const fields = base.map((f) =>
    f.name === 'estimatedInstallationDate' || f.name === 'estGoLiveDate'
      ? { ...f, ...bounds[f.name as 'estimatedInstallationDate' | 'estGoLiveDate'] }
      : f)
  const rows = rows0

  const dirty = rows.dirtyCount > 0
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onDraftsChange?.(rows.changes) }, [rows.changes, onDraftsChange])

  const row = (name: string) => {
    const f = fields.find((x) => x.name === name)
    if (!f) return null
    return (
      <div key={name} data-key={name}>
        <FieldRow field={f} rows={rows} />
      </div>
    )
  }

  return (
    <div data-testid="testbed-panel">
      {/* THE NAME HEADER. An ordinary row that happens to sit in the header,
          the same departure the Reference and Contact surfaces took, so it has
          a door, a discard and a draft like every other field. */}
      <div className="cd-header" data-testid="tb-header">
        <div className="cd-eyebrow eyebrow" data-testid="tb-eyebrow">Test Bed</div>
        {row('name')}
      </div>

      <div className="ref-cards" data-testid="tb-cards">
        <Card title="Terminus Details" testId="tb-card-terminus">
          {['terminusLead', 'commercialAuthority', 'technicalAuthority',
            'terminusLegalOwner', 'region', 'country'].map(row)}
        </Card>

        <Card title="Customer Details" testId="tb-card-customer">
          {row('initialLead')}
          {/* The three buyer LOOKUPS: id-valued, name-labelled, and each saves
              immediately rather than joining the batch - so they are rendered
              here but written by the host. */}
          {CLIENT_BUYER_ROLES.map((role) => (
            <div key={role} data-key={`buyer-${role}`}>
              <FieldRow
                field={buyerDescriptor(role, buyers[role] ?? '', contacts)}
                rows={rows} />
            </div>))}
        </Card>

        <Card title="Site Details" testId="tb-card-site">
          {['siteOwnership', 'installationEnvironment', 'siteAddress', 'city'].map(row)}
        </Card>
      </div>

      <Card title="Sensor Counts" testId="tb-card-sensors">
        {['safesightCameras', 'airQualitySensors', 'hemirSensors'].map(row)}
      </Card>

      <Card title="Dates" testId="tb-card-dates">
        {['estimatedInstallationDate', 'estGoLiveDate', 'testBedDuration'].map(row)}
      </Card>

      <Card title="Commercials" testId="tb-card-commercials">
        {['ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
          'ssInstallCost', 'aqInstallCost', 'hemirInstallCost',
          'ssHostingCost', 'aqHostingCost', 'hemirHostingCost'].map(row)}
        {costBreakdown}
      </Card>

      <Card title="Summary" testId="tb-card-summary">
        {row('summary')}
      </Card>

      {useCases ? <Card title="Use Cases" testId="tb-card-usecases">{useCases}</Card> : null}

      {controls}
      {notes}

      <EditBar rows={rows} onSave={onSave} saveId="tb-react-save-all" />
    </div>
  )
}
