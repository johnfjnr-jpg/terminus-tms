// ── THE OPPORTUNITY'S RECORD BAND: SUMMARY, NOTES, FOLLOW-UP ─────────────
//
// THE THIRD CALLER of the row the Contact and the Test Bed already share.
// `FollowUpTask` and `NotesHistory` live in `contact/` and the Test Bed
// imports them from there; this takes the same two components rather than
// rendering the same idea a third way (Verification 20).
//
// ── WHY THE OPPORTUNITY GETS ONE, AND WHAT IT RESTORES ───────────────────
//
// Notes is not a new feature here. `opportunity-reference.js` wrote
// `ref-notes-list`, and when that file was retired its markup went with the
// `#ref-vanilla` block while NO React card replaced it: `ReferencePanel`
// renders five cards and none is Notes. MEASURED at the time of building:
// **89 note entries across 11 of 18 live opportunities**, written by the
// business and rendered by nothing since the retirement. The Contact and the
// Test Bed are the calibration for that count, because both still render a
// Notes History and both read non-zero.
//
// A census of what a surface RENDERS could not have found it, because what
// renders is correct. The capability was the thing that died.
//
// ── IT IS A RECORD-LEVEL BAND, WHICH IS WHY IT SITS WHERE IT DOES ────────
//
// Summary, Notes and the follow-up describe the RECORD, exactly as the
// headline strip and the stage chevron do, so they are stated where the
// record is named rather than inside one tab. That is the same reasoning
// `TestBedBand` records, and the same mistake it exists to correct: a round
// told to put the band "in the header" put it at the top of the Reference
// TAB's panel, 433px down the page, and every assertion passed because they
// asked whether the band was INTACT rather than where it SAT.
//
// A SECOND REASON, and it is structural rather than aesthetic: the Reference
// panel unmounts when the tab changes. In the band the three cards outlive
// the tabs, so an open Summary edit survives a tab switch.
import type { ReactNode } from 'react'

import { FieldRow } from '../field-row/FieldRow'
import type { useFieldRows } from '../field-row/useFieldRows'
import { Card } from '../shared/Card'
import type { FieldDescriptor } from '../field-row/types'

export function OpportunityBand({ summaryField, rows, notes, followUp }: {
  /** The `summary` descriptor, from the ONE label table the panel reads. */
  summaryField?: FieldDescriptor
  /** The panel's own draft store, the same one every other row writes into. */
  rows: ReturnType<typeof useFieldRows>
  notes?: ReactNode
  followUp?: ReactNode
}) {
  return (
    <div className="lead-card-body tb-top-row" data-testid="opp-top-row">
      <Card title="Summary" testId="opp-card-summary">
        {/* A ROW WHOSE CARD ALREADY NAMES IT DOES NOT NAME ITSELF, and it must
            not keep the label's 170px column either. `.cd-row-nolabel` is the
            Contact surface's own fix for the same defect on the same card,
            taken rather than re-minted. */}
        {summaryField
          ? (
            <div data-key="summary" className="cd-row-nolabel">
              <FieldRow field={{ ...summaryField, label: '' }} rows={rows} />
            </div>)
          : null}
      </Card>
      {/* ── R-O2: NOTES BRINGS ITS OWN HEADER ─────────────────────────────
          It used to sit inside a Card, so the card drew the title and
          `NotesHistory` drew a second row under it for "Latest first" and the
          range buttons, and "Add note" wrapped onto a third. Measured: three
          distinct tops, 575, 605 and 641.

          The shared component already has the collapsed mode and the lead
          card already uses it; this surface simply never asked for it. Passing
          `title` and `actionsInHeader` puts the name, the range controls and
          the action on ONE row, so the outer Card would be a second frame
          around a panel that now draws its own.

          WHETHER IT FITS IS MEASURED PER SURFACE AND PER WIDTH, not assumed:
          `probe-notes-header.mjs` reads the distinct tops on all three
          surfaces at 1440 and 1240. */}
      {notes}
      {/* A bare grid cell, exactly as the Contact and Test Bed surfaces do it:
          FollowUpTask draws its own card, so wrapping it in another would give
          the Opportunity a frame its sibling surfaces do not have. */}
      {followUp}
    </div>
  )
}
