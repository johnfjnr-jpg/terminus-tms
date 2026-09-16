// ── THE RECORD BAND: SUMMARY, NOTES, FOLLOW-UP ──────────────────────────
//
// WHY THIS IS ITS OWN FILE, AND THE MISTAKE IT EXISTS TO CORRECT.
//
// Round `78a1195` was instructed to put Summary and Notes "in the header".
// It put them at the top of `TestBedPanel`, which is the REFERENCE TAB'S
// panel, and its close-out recorded the item as delivered. Measured in a
// browser afterwards, the band rendered at 433px - BELOW the stats strip at
// 159px, below the chevron at 250px, and below the tab strip at 330px,
// inside `tb-tab-reference`.
//
// THE WORD "HEADER" NAMED TWO DIFFERENT THINGS ON ONE SURFACE. `ViewHeader`
// is the record's header: title, stats, chevron, above the tabs. And
// `TestBedPanel` carried its own `<div className="cd-header">` at the top of
// the Reference tab. A round told to use "the header" had two of them to
// choose from and nothing in the delivery could tell it had chosen wrong,
// because every assertion asked whether the band was INTACT rather than
// where it SAT. Verification 19's shape: a name asserting a property nobody
// measured.
//
// So the band is a component with ONE home, rendered by the host into the
// header's own slot. It cannot drift back into a tab panel without somebody
// deleting a slot, which is a visible edit rather than a silent one.
//
// AND IT IS A RECORD-LEVEL BAND, which is the reason the position is right
// rather than merely requested: Summary, Notes and the follow-up describe
// the RECORD, exactly as the stats strip and the chevron do. A figure that
// describes the record is stated where the record is named, which is the
// same reasoning already written at the Opportunity's headline and at its
// freeze banner.
//
// A SECOND BENEFIT, MEASURED RATHER THAN CLAIMED AS A BONUS: `StageTabs`
// renders each panel as `active === 'x' ? panel : null`, so the Reference
// panel UNMOUNTS on every tab switch. In the header the band outlives the
// tabs, so an open Summary edit survives a switch - and the draft store it
// writes into already lives on the host for that same reason.
import type { ReactNode } from 'react'

import { FieldRow } from '../field-row/FieldRow'
import type { useFieldRows } from '../field-row/useFieldRows'
import { Card } from './TestBedPanel'
import { testBedDescriptors, type TestBedSource } from './descriptors'

export function TestBedBand({ source, rows, notes, followUp }: {
  source: TestBedSource
  /** The host's draft store, the same one every other row writes into. */
  rows: ReturnType<typeof useFieldRows>
  notes?: ReactNode
  followUp?: ReactNode
}) {
  // THE DESCRIPTOR COMES FROM THE ONE LABEL TABLE, not from a literal here.
  // `descriptors.ts` is what the History panel reads to name a changed field,
  // so a summary row built from its own hand-written descriptor would let the
  // screen and the history disagree about one key (Verification 20).
  const summary = testBedDescriptors(source).find((f) => f.name === 'summary')

  return (
    <div className="lead-card-body tb-top-row" data-testid="tb-top-row">
      <Card title="Summary" testId="tb-card-summary">
        {/* A ROW WHOSE CARD ALREADY NAMES IT DOES NOT NAME ITSELF, and it
            must not keep the label's 170px column either. `.cd-row-nolabel`
            is the Contact surface's own fix for the same defect on the same
            card, taken rather than re-minted. */}
        {summary
          ? (
            <div data-key="summary" className="cd-row-nolabel">
              <FieldRow field={{ ...summary, label: '' }} rows={rows} />
            </div>)
          : null}
      </Card>
      <Card title="Notes" testId="tb-card-notes">
        {notes}
      </Card>
      {/* A bare grid cell, exactly as the Contact surface does it: FollowUpTask
          draws its own card, so wrapping it in another would give the Test Bed
          a frame its sibling surfaces do not have. */}
      {followUp}
    </div>
  )
}
