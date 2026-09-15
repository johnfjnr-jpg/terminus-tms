// ── SENSOR COUNTS AND COSTS, ON THE COMMERCIALS TAB ──────────────────────
//
// TEST BED STATE, R1 part 2. Both cards were at the bottom of the Reference
// tab, below eight others, while the tab named Commercials rendered `null`.
//
// WHY THIS IS A COMPONENT AND NOT A PORTAL. The cards edit the record, so they
// need the draft store - and the obvious move, portalling them out of
// TestBedPanel, cannot work: `StageTabs` unmounts the Reference pane when
// Commercials is active (`StageTabs.tsx:210`), and a portal dies with the tree
// that renders it, not with the container it lands in. Lifting the store in
// part 1 is what makes the honest version possible: the HOST holds the
// controller, so the host can render these cards straight into the Commercials
// slot and both tabs write into the same store.
//
// THE TESTIDS AND TITLES ARE UNCHANGED. `tb-card-sensors` and
// `tb-card-commercials` are cited by existing assertions; a move is not a
// licence to rename them (Verification 32). This is a MOVE, which is two
// claims - the cards appear on Commercials, and they are GONE from Reference -
// and the second one has its own assertion (Verification 7).
import type { useFieldRows } from '../field-row/useFieldRows'
import type { FieldDescriptor } from '../field-row/types'
import { FieldRow } from '../field-row/FieldRow'
import { Card } from './TestBedPanel'

const SENSORS = ['safesightCameras', 'airQualitySensors', 'hemirSensors']
const COSTS = [
  'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
  'ssInstallCost', 'aqInstallCost', 'hemirInstallCost',
  'ssHostingCost', 'aqHostingCost', 'hemirHostingCost',
]

export function CommercialsCards({ rows, fields, costBreakdown }: {
  rows: ReturnType<typeof useFieldRows>
  fields: FieldDescriptor[]
  costBreakdown?: React.ReactNode
}) {
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
    // `.ref-cards` IS THE ESTATE'S CARD GROUP, and it is the frame rather than
    // a bare div for a reason found by opening the screenshot: `.pg-card`
    // carries a border and NO margin, so two of them in a plain container sit
    // flush and their borders merge into one box with two sections. Every
    // other card pair on this record gets its 16px from this class, and
    // borrowing it keeps the Commercials tab in the same rhythm as Reference
    // instead of inventing a second set of metrics (Verification 20).
    <div className="ref-cards" data-testid="tb-commercials-cards">
      <Card title="Sensor Counts" testId="tb-card-sensors">
        {SENSORS.map(row)}
      </Card>
      <Card title="Commercials" testId="tb-card-commercials">
        {COSTS.map(row)}
        {costBreakdown}
      </Card>
    </div>
  )
}
