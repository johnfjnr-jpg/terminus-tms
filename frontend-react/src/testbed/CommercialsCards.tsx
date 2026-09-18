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
// ── L3, 2026-09-15: THE RATE CARDS ARE THREE AGAIN, AND THEY SAY THEIR UNITS
//
// The migration flattened the vanilla's four cards into two: `Sensor Counts`,
// then ONE `Commercials` card holding all nine cost rows whose labels stated
// NEITHER unit. A hosting rate and a hardware rate read identically on that
// card, and one of them is per month.
//
// The vanilla's titles carried the unit and that is what is restored:
// `($ / unit)` on hardware and installation, `($ / unit / month)` on hosting.
// The nine keys were already grouped three by three in the descriptor source;
// nothing about the data changed, only which card each row sits in.
//
// ── THE TESTID DISPOSITION, Verification 41 ──────────────────────────────
//
// `tb-card-sensors` is RETAINED, unchanged, on Sensor Counts.
//
// `tb-card-commercials` is RETIRED. It named one card holding nine rows and
// there is no such card now, so keeping the name on any one of the three would
// be a label asserting a scope it does not have (Verification 19). Its four
// call sites are re-pointed to `tb-card-rates-hardware`, which is the card that
// directly succeeds it - it holds the first three of the nine rows, including
// the `display-ssUnitCost` row those call sites already measure:
//
//   frontend-react/src/__tests__/testbed-draft-survival.test.tsx  :162 :170
//   scripts/testbed-layout/probe-moves.mjs                        :43
//   scripts/testbed-state/probe-r1-live.mjs                       (5 uses)
//
// Every one of those assertions is about LOCATION and COUNT - the group is on
// Commercials and gone from Reference - and re-pointing preserves each claim
// exactly rather than weakening it.
//
// ── L1/Q4: THE BREAKDOWN IS NO LONGER NESTED HERE ────────────────────────
//
// It used to be a child of the Commercials card, which was defensible while it
// rendered two words. Ruled 2026-09-15: it returns to the vanilla's own home,
// an `Itemized Cost` section BELOW this grid. The host renders it.
import type { useFieldRows } from '../field-row/useFieldRows'
import type { FieldDescriptor } from '../field-row/types'
import { FieldRow } from '../field-row/FieldRow'
import { Card } from './TestBedPanel'
import { countIsLocked, type Unit } from './units'

const SENSORS = ['safesightCameras', 'airQualitySensors', 'hemirSensors']

/** The vanilla's three rate cards, with the units back in the titles. */
const RATE_CARDS = [
  {
    title: 'Hardware Cost Rates ($ / unit)',
    testId: 'tb-card-rates-hardware',
    keys: ['ssUnitCost', 'aqUnitCost', 'hemirUnitCost'],
  },
  {
    title: 'Installation Cost Rates ($ / unit)',
    testId: 'tb-card-rates-install',
    keys: ['ssInstallCost', 'aqInstallCost', 'hemirInstallCost'],
  },
  {
    title: 'Hosting Cost Rates ($ / unit / month)',
    testId: 'tb-card-rates-hosting',
    keys: ['ssHostingCost', 'aqHostingCost', 'hemirHostingCost'],
  },
] as const

export function CommercialsCards({ rows, fields, units = [] }: {
  rows: ReturnType<typeof useFieldRows>
  fields: FieldDescriptor[]
  /** L3: the units decide whether a count is still a plan or already a record. */
  units?: readonly Unit[]
}) {
  // ── L3: A LOCKED COUNT SAYS SO WHERE IT IS EDITED ──────────────────────
  //
  // The server refuses a count change once units exist unless a reason comes
  // with it (src/routes/test-beds.js:723-736), and this tab offered the field as
  // though it were free: the person typed, saved, and met a 400. The vanilla
  // REPLACED the field with a line naming the value, the fact and where to
  // correct it (test-bed-detail.js:1025-1046), and its own comment records why a
  // control that cannot be used is worse than one that is not there.
  //
  // ── W3 RULING, John 2026-09-18, SUPERSEDING THE ABOVE ──────────────────
  //
  // The sentence is REMOVED. The lock stays and must be VISIBLE, and the
  // Installation tab's own summary line ("2 counts locked: units exist...") is
  // now the one place on screen naming the destination. The server's 400 with
  // its full sentence is untouched and remains the backstop.
  //
  // THE ROW IS THE ESTATE'S ROW, not a shape of its own. It rendered as
  // `.ref-field` with a block value while every neighbour on this card is a
  // `.field-row` from FieldRow, so the value sat BELOW its label while every
  // other value sat beside one: W3's alignment finding, and it is a
  // consequence of two row shapes in one card rather than of a spacing value.
  //
  // `data-readonly="true"` is the estate's declared treatment for a row that is
  // not editable - it dims the value and removes the pointer affordance - and
  // the absent tab stop follows from there being no edit half at all, which is
  // the field-row contract's own reasoning about not reaching read-only by
  // disabling an input.
  const lockedRow = (name: string, f: FieldDescriptor) => (
    <div key={name} data-key={name} className="field-row" data-readonly="true"
      data-field={name} data-testid={`tb-count-locked-${name}`}>
      <div className="field-row-label">{f.label}</div>
      <div className="field-row-display">{String(f.value ?? '')}</div>
    </div>
  )
  const row = (name: string) => {
    const f = fields.find((x) => x.name === name)
    if (!f) return null
    if (SENSORS.includes(name) && countIsLocked(name, units)) return lockedRow(name, f)
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
      {RATE_CARDS.map((c) => (
        <Card key={c.testId} title={c.title} testId={c.testId}>
          {c.keys.map(row)}
        </Card>))}
    </div>
  )
}
