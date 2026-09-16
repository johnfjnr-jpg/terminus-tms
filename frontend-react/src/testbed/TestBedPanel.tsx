// ── ROUND 7 PHASE 1a: THE TEST BED FIELD SURFACE ────────────────────────
//
// Behind the line: nothing registers this and the vanilla stays live.
import { useEffect, type ReactNode } from 'react'

import { FieldRow } from '../field-row/FieldRow'

import type { useFieldRows } from '../field-row/useFieldRows'
import { testBedDescriptors, buyerDescriptor, CLIENT_BUYER_ROLES, type TestBedSource } from './descriptors'
import { dateBounds } from './dateBounds'
import { SubTabs } from './SubTabs'
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

export function TestBedPanel({ source, rows, contacts, buyers, onDirtyChange, controls, useCases, customerDocs, history, score, refPanes, refPane, onRefPaneChange }: {
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
  // ── `notes` AND `followUp` ARE GONE FROM THIS COMPONENT'S INTERFACE ────
  //
  // They moved to `TestBedBand`. Deleted rather than kept and ignored: a
  // destructuring parameter list is an allowlist that gives no feedback when
  // it excludes something, so a caller still passing `notes` to a panel that
  // no longer renders it would be silently discarded and look like a props
  // bug on the wrong component. Removing them makes that call a typecheck
  // failure instead (Architecture 9).


  /** installer, tech team - direct-write controls the host owns. */
  controls?: ReactNode
  /** The use-case list. Its writes are whole-list, so the host owns them. */
  useCases?: ReactNode
  /** Client-supplied documents. Their own resource, so the host owns them. */
  customerDocs?: ReactNode
  /** Raw audit entries. Read-only. */
  history?: ReactNode

  /** L2: the Qualification score card's rows. Display only. */
  score?: ReactNode
  /**
   * L4: whether to render the three panes as a strip. False while the host has
   * nothing to put in them, so an empty strip is never shown.
   */
  refPanes?: boolean
  /**
   * L4: the open pane, HELD BY THE HOST. This panel unmounts on every tab
   * switch, so state here would reset on Reference -> Commercials -> Reference.
   */
  refPane?: string
  onRefPaneChange?: (key: string) => void
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
  // ── `onDraftsChange` IS GONE FROM HERE, AND IT HAD TO BE ─────────────────
  //
  // It ran as an effect in THIS component, which is the Reference pane, and
  // `StageTabs` renders `active === 'reference' ? panel : null`. So it stopped
  // firing the moment the cost fields moved to the Commercials tab last round:
  // typing a sensor count there scheduled no preview at all.
  //
  // IT WAS INVISIBLE UNTIL L1 FILLED THE BREAKDOWN. With the container
  // rendering two words, a preview that never arrived looked exactly like a
  // preview that had - and once the four cards render, the LABELS still follow
  // the drafts, because they are read during render rather than from an
  // effect. That left `SafeSight (12 × $4,200)` beside `$0`: the
  // self-contradicting row the vanilla's own comment exists to prevent.
  //
  // Found by a live browser, not by a test. Reported as a Phase 1 finding, and
  // fixed here rather than carried, because this round is what made it visible
  // (build discipline 10's limit).
  //
  // The reporting now lives on the HOST, beside the store it reads. Same
  // reasoning as R1 lifting the store: the host outlives the tabs.

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
      {/* ── W4: THE NAME HEADER IS GONE FROM HERE ─────────────────────────
          It carried a "TEST BED" eyebrow and a row labelled "Test Bed Name",
          directly under a view header whose h2 is already the name. Three
          statements of one fact on one screen.

          THE ROW ITSELF IS NOT DELETED, IT IS MOVED into Terminus Details
          below, and that is John's ruling at the round open rather than an
          implementation choice. Measured before asking: `row('name')` here
          was the ONLY place a Test Bed's name could be edited after creation
          - the h2 is a plain heading and the New Test Bed modal sets the name
          once. Deleting the block would have removed a capability under the
          heading of removing a label, which is the light path's own limit. */}


      {/* ── THE SUMMARY / NOTES / FOLLOW-UP BAND IS NOT HERE ANY MORE ────
          It is `TestBedBand`, rendered by the host into `ViewHeader`'s own
          slot, directly under the title and above the stats strip.

          IT WAS NEVER RIGHT HERE, and the reason it looked right is worth
          keeping. Round `78a1195` was told to move it "to the header" and
          moved it to the top of THIS component - which is the Reference
          TAB's panel, not the record's header. Measured in a browser, the
          band rendered at 433px, below the stats strip, the chevron AND the
          tab strip, inside `tb-tab-reference`. The round's own checks all
          passed, because each asked whether the band was INTACT and none
          asked where it SAT.

          REMOVED rather than left, because a move is TWO claims - it appears
          in its new place AND it is gone from its old one - and this estate
          has shipped the duplicate that skipping the second one produces. */}


      <div className="ref-cards" data-testid="tb-cards">
        <Card title="Terminus Details" testId="tb-card-terminus">
          {/* W4: `name` LEADS THIS CARD. It keeps the descriptor's own label,
              "Test Bed Name", rather than being shortened here: `descriptors.ts`
              is the one label table this surface has, and the History panel
              renders each audit entry through the SAME `labelOf`. A second
              label minted at this call site would make the screen and the
              history name one field two different things (Verification 20). */}
          {['name', 'terminusLead', 'commercialAuthority', 'technicalAuthority',
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

        {/* ── L2: THE QUALIFICATION SCORE CARD ──────────────────────────
            `tb-score-summary` appeared ZERO times in the React tree. Restored
            into the same `.ref-cards` grid the vanilla put it in, so it wraps
            with its siblings rather than being positioned by hand.

            The sub-line is not decoration. This card carries NO control, and
            the sentence is what makes the route evident without one: it says
            where scoring happens instead of offering a second place to do it.

            Retitled by Round 15 Phase 5 from "Scores" to "Qualification
            score", sentence case. Two similarly named panels on different
            tabs is deliberate and was confirmed with the business. */}
        <Card title="Qualification score" testId="tb-card-score">
          <p className="sub" data-testid="tb-score-summary-sub">Recorded on the stage tabs.</p>
          {score}
        </Card>
      </div>

      {/* R1: Sensor Counts and Commercials MOVED to the Commercials tab, which
          rendered null while these two sat at the bottom of Reference below
          eight other cards. They are rendered by the host now - see
          CommercialsCards.tsx for why a portal could not do it. */}



      {/* ── L4: THE THREE PANES ARE A SUB-TAB STRIP AGAIN ────────────────
          They were stacked cards after the swap. The vanilla made them panes
          and recorded the business's reason: two large, mostly-empty panels
          for two lists that are usually short is a poor use of the tab's
          vertical space, and one pane at a time gives each list the full
          width AND removes the empty half.

          NO .pg-card AND NO TITLE INSIDE A PANE. The pane IS the container
          and the tab label IS the heading - a bordered card carrying the same
          word as the tab above it is the clutter the vanilla's own phase
          removed. That is why the three `tb-card-*` testids are gone rather
          than moved: there are no cards here now. None had a caller outside
          this file, checked before removing them.

          THE LABEL IS `Customer documents`, the vanilla's, not the React
          card's `Client Documents`. The two disagreed and the brief asked for
          one to be picked; the vanilla's is the one this round is restoring
          and the one the business has seen. */}
      {refPanes
        ? (
          <SubTabs idPrefix="tb-ref-subtabs" label="Reference detail"
            active={refPane ?? 'useCases'}
            onSelect={(k) => onRefPaneChange?.(k)}
            tabs={[
              { key: 'useCases', label: 'Use cases', content: useCases },
              { key: 'customerDocuments', label: 'Customer documents', content: customerDocs },
              { key: 'history', label: 'History', content: history },
            ]} />)
        : null}

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
