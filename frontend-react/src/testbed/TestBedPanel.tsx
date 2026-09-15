// ── ROUND 7 PHASE 1a: THE TEST BED FIELD SURFACE ────────────────────────
//
// Behind the line: nothing registers this and the vanilla stays live.
import { useEffect, type ReactNode } from 'react'

import { FieldRow } from '../field-row/FieldRow'

import type { useFieldRows } from '../field-row/useFieldRows'
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
// R1: EXPORTED because the Commercials cards moved to their own file and a
// second copy of a four-line wrapper is still two definitions of one idea
// (Verification 20). It stays here rather than moving to ui/: this is the
// Test Bed's card, and ui/Panel is a different thing with a different contract.
export function Card({ title, testId, children }: { title: string, testId: string, children: ReactNode }) {
  return (
    <div className="pg-card" data-testid={testId}>
      <div className="pg-card-title">{title}</div>
      {children}
    </div>
  )
}

export function TestBedPanel({ source, rows, contacts, buyers, onDirtyChange, onDraftsChange, notes, followUp, controls, useCases, customerDocs, history }: {
  source: TestBedSource
  /** The Account's contacts, for the buyer lookups. */
  /**
   * R1: the draft store, owned by the HOST. This panel unmounts on every tab
   * switch and used to take the store with it, discarding unsaved edits.
   */
  rows: ReturnType<typeof useFieldRows>
  contacts: LookupOption[]

  /** role -> linked contact id. */
  buyers: Record<string, string>

  onDirtyChange?: (dirty: boolean) => void
  /** The cost preview needs the live drafts, and a preview is not a save. */
  onDraftsChange?: (drafts: Record<string, string>) => void
  notes?: ReactNode
  /** R2: the follow-up task, owned by the host because its write is its own. */
  followUp?: ReactNode

  /** installer, tech team - direct-write controls the host owns. */
  controls?: ReactNode
  /** The use-case list. Its writes are whole-list, so the host owns them. */
  useCases?: ReactNode
  /** Client-supplied documents. Their own resource, so the host owns them. */
  customerDocs?: ReactNode
  /** Raw audit entries. Read-only. */
  history?: ReactNode
}) {
  // R1: THE DRAFT STORE IS OWNED BY THE HOST NOW, not by this panel.
  //
  // `StageTabs` renders each panel as `active === 'x' ? panel : null`, so this
  // component UNMOUNTS on every tab switch - and took the store with it, which
  // discarded any unsaved edit silently. Measured, not inferred.
  //
  // The host outlives the tabs, so the store does too. Everything below is
  // unchanged: the same controller, read through a prop rather than a hook.
  const base = testBedDescriptors(source)

  // ── THE DATE BOUNDS ARE DERIVED FROM THE LIVE DRAFTS ─────────────────
  //
  // The vanilla mutates min/max on the inputs IN PLACE, because re-rendering a
  // row would throw away an open edit. Here the row keeps its draft in the
  // controller, so the descriptor can simply carry the bound - A4 as data, with
  // the value now depending on a sibling's draft rather than a constant.
  // R1: read from the HOST'S store, the same one the rows write into. A
  // calibration injection that gave this its own `useFieldRows` came back
  // SILENT - nothing asserted that the bound follows a live draft rather than
  // the saved value (Verification 51). The assertion now exists, below.
  const bounds = dateBounds(
    rows.valueOf('estimatedInstallationDate'),
    rows.valueOf('estGoLiveDate'),
  )
  const fields = base.map((f) =>
    f.name === 'estimatedInstallationDate' || f.name === 'estGoLiveDate'
      ? { ...f, ...bounds[f.name as 'estimatedInstallationDate' | 'estGoLiveDate'] }
      : f)


  const dirty = rows.dirtyCount > 0
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onDraftsChange?.(rows.changes) }, [rows.changes, onDraftsChange])

  // R2: A ROW WHOSE CARD ALREADY NAMES IT DOES NOT NAME ITSELF, and it must
  // not keep the label's 170px column either. Adding the follow-up as the
  // third cell took the top row from two columns to three, and the Summary
  // card's value went to 58px - four wrapped lines for "No summary captured
  // yet." Measured, not guessed.
  //
  // THIS IS THE CONTACT SURFACE'S OWN FIX, and the rule's comment in
  // style.css records the same defect on the same card at the same width.
  // Taking `.cd-row-nolabel` rather than minting a Test Bed equivalent is the
  // point: one definition, so the two cannot drift (Verification 20).
  const row = (name: string, labelOverride?: string) => {
    const base = fields.find((x) => x.name === name)
    if (!base) return null
    const f = labelOverride === undefined ? base : { ...base, label: labelOverride }
    return (
      <div key={name} data-key={name}
        className={labelOverride === '' ? 'cd-row-nolabel' : undefined}>
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

      {/* R1: SUMMARY AND NOTES ON ONE ROW AT THE TOP, matching leads and
          contacts. Both already existed at the BOTTOM of this screen and both
          were already editable - this is a move, not a rewire, and it does not
          touch Test Bed's notes/audit split, which was measured clean.

          `.lead-card-body` is the LEAD's layout CLASS, and this is its third
          consumer. THE CLASS IS NOT MODIFIED: adding a consumer cannot move
          leads or contacts, which is the whole reason the radius here is nil.

          R2: FOLLOW-UP IS NOW THE THIRD CELL, so the scoped two-column
          override `.tb-top-row` carried is gone and this row inherits the
          three-column grid leads and contacts use. The override existed only
          because a Test Bed had no follow-up: the route's allowlist refused
          the keys. It accepts them now, proven refused-then-written. */}
      <div className="lead-card-body tb-top-row" data-testid="tb-top-row">
        <Card title="Summary" testId="tb-card-summary">
          {row('summary', '')}
        </Card>
        <Card title="Notes" testId="tb-card-notes">
          {notes}
        </Card>
        {/* Rendered as a bare grid cell, exactly as the Contact surface does
            it: FollowUpTask draws its own card, so wrapping it in another
            would give the Test Bed a frame its sibling surfaces do not have. */}
        {followUp}
      </div>

      <div className="ref-cards" data-testid="tb-cards">
        <Card title="Terminus Details" testId="tb-card-terminus">
          {['terminusLead', 'commercialAuthority', 'technicalAuthority',
            'terminusLegalOwner', 'region', 'country'].map((n) => row(n))}
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
          {/* BOUND EXPLICITLY, not `.map(row)`: Array.map hands the INDEX in as
              the second argument, which `row` now reads as a label override, so
              every row in a mapped list would have been silently relabelled
              with a number. Caught by the typechecker. */}
          {['siteOwnership', 'installationEnvironment', 'siteAddress', 'city'].map((n) => row(n))}
        </Card>

        {/* R2: KEY DATES BESIDE SITE DETAILS. It was a section lower down; it
            is now a sibling in the same card row. */}
        <Card title="Key Dates" testId="tb-card-dates">
          {['estimatedInstallationDate', 'estGoLiveDate', 'testBedDuration'].map((n) => row(n))}
        </Card>
      </div>

      {/* R1: Sensor Counts and Commercials MOVED to the Commercials tab, which
          rendered null while these two sat at the bottom of Reference below
          eight other cards. They are rendered by the host now - see
          CommercialsCards.tsx for why a portal could not do it. */}



      {useCases ? <Card title="Use Cases" testId="tb-card-usecases">{useCases}</Card> : null}

      {/* Both live on the Reference tab in the vanilla, measured from the
          enclosing pane rather than assumed. */}
      {customerDocs
        ? <Card title="Client Documents" testId="tb-card-custdocs">{customerDocs}</Card>
        : null}
      {history ? <Card title="History" testId="tb-card-history">{history}</Card> : null}

      {controls}
      {/* R1: `{notes}` moved to the top row. Removed here rather than left,
          because a move is TWO claims - it appears in its new place AND is
          gone from its old one - and this estate has shipped the duplicate
          that skipping the second one produces. */}

      {/* R1: THE EDIT BAR MOVED TO THE HOST, with the store. It was the last
          child of this panel, which meant it existed only while Reference was
          the open tab - so once Sensor Counts and Commercials moved, a person
          could type a cost and have NO WAY TO SAVE IT. The contract already
          says the bar is a property of the SURFACE rather than of a row; the
          surface is now two tabs sharing one store, so the bar belongs where
          the store is. Its id is unchanged. */}
    </div>
  )
}
