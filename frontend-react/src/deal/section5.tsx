import type { ReactNode } from 'react'
import type { UiState } from './payload'
import { effectiveStructure } from './payload'
import type { StructureVisibility } from './installation'
import { factoringToggle } from './installation'
import { DealToggle } from './DealToggle'

// ── A RING RADIO ─────────────────────────────────────────────────────────
//
// Three elements, not one: the ring, the dot inside it, and the label. The
// stylesheet animates the dot inside the ring, so a flattened version would
// style as a plain bullet. `active` marks the choice, matching
// updateStructureButtons / updateInvoicingButtons (opportunity-deal.js:1686).
function RingRadio({ attr, value, label, note, active, onPick }: {
  attr: 'data-structure' | 'data-invoicing'
  value: string
  label: string
  /** R-PT2: the explanation, rendered beneath the label in the muted treatment. */
  note?: string
  active: boolean
  onPick(): void
}) {
  const props = { [attr]: value } as Record<string, string>
  return (
    <div className={`ring-radio${active ? ' active' : ''}${note ? ' ring-radio-stacked' : ''}`} {...props}
      role="radio" aria-checked={active} tabIndex={0} onClick={onPick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPick() }}>
      <span className="ring-radio-ring"><span className="ring-radio-dot" /></span>
      <span className="ring-radio-text">
        <span className="ring-radio-label">{label}</span>
        {note ? <span className="ring-radio-note">{note}</span> : null}
      </span>
    </div>
  )
}

// R-PT2: the label and its explanation are two things, so they are two strings.
// The parenthetical WAS the explanation all along; it becomes the secondary
// line rather than new copy, so nothing is invented and nothing is lost.
/* ── R-PT3: SINGLE PHASE IS NOT OFFERED FOR NEW PRICING ───────────────────
   John's ruling, 2026-09-26: CAPEX offers Two-phase and Hybrid. OPEX IS the
   single-phase mode, so the choice was always a duplicate of the mode switch
   sitting two rows above it.

   THE OPTION LEAVES THIS LIST. THE VALUE DOES NOT LEAVE THE SYSTEM, and the
   distinction is the whole of the ruling. `effectiveStructure` still returns
   `'single'` for every OPEX deal, `deal-calculator.js` still reads
   `structure === 'single' ? months`, and three issued versions carry
   `inputs.structure = 'single'` frozen inside them. The brief records what
   `single` means to the derivation, permanently, because the meaning has to
   outlive the control. */
const STRUCTURES = [
  { value: 'twoPhase', label: 'Two-phase', note: 'hardware recovery then hosting' },
  { value: 'hybrid', label: 'Hybrid', note: 'milestone + hosting' },
]
const INVOICING = [
  { value: 'annual', label: 'Annual in advance' },
  { value: 'monthly', label: 'Monthly' },
]

/* F4: `InvoicingGroup` is retired. It existed because there were TWO invoicing
   groups to keep identical - the top row's and Hybrid's - which is the shape a
   shared component is for. There is now one, in the rail, so the component has
   a single call site and the indirection buys nothing. */


export function PaymentTermsSection({
  ui, setUi, vis, duration, renderField, milestoneGrid, yearSchedule, scheduleHead,
  opex,
}: {
  ui: UiState
  setUi(p: Partial<UiState>): void
  vis: StructureVisibility
  duration: unknown
  renderField(id: string): ReactNode
  milestoneGrid: ReactNode
  yearSchedule: ReactNode

  /** R-SZ2: the schedule's own head text, rendered by the SLOT so it can be a
      grid item in the slot's shared head track. Built once where the schedule
      is built, so it is a move rather than a second reader. */
  scheduleHead: ReactNode

  /** R-OX2: the OPEX table, built by the panel so this file lays out only. */
  opex: ReactNode
}) {
  const fx = factoringToggle(ui)
  const opexOn = ui.paymentMode === 'opex'
  // ONE expression, read by the content column and by the Hybrid grid, so the
  // two slots cannot disagree about who renders the schedule. The double render
  // F3 exists to remove came from gating one on the MODE and the other on the
  // STRUCTURE (Verification 20: a second reader of one value always drifts).
  const hybridOn = effectiveStructure(ui) === 'hybrid'
  const mode = {
    label: opexOn ? 'OPEX' : 'CAPEX',
    title: opexOn
      ? 'The deal is priced as an all-in monthly fee per unit. Click to return to CAPEX.'
      : 'The deal is priced as hardware, installation and hosting. Click to price it as OPEX.',
  }
  return (
    <div className="deal-payment-region">
      <div className="deal-payment-col payment-terms-panel">
        <div className="payment-card">
          {/* ── R-PT2: A LEFT CONTROL RAIL, AND THE MONEY BESIDE IT ────────
              Sized from its OWN content: Phase 0 built the three labels and
              their secondary lines offscreen with the real fonts and measured
              178px with nothing wrapping. At 1240 that leaves 401px of content
              against a 453px table, so the rail narrows there and the secondary
              lines wrap - which shrinks no type and clips no money. */}
          {/* ── M1: THE MODE CONTROL, CAPEX | toggle | OPEX ─────────────────
              John's ruling, 2026-09-26, and it is the third on this control in
              four rounds, so the history is in the round brief rather than
              here. What matters at the site:

              `on` MEANS OPEX, AND OPEX IS THE RIGHT-HAND LABEL. That is the
              whole reason no CSS inversion is needed. `.deal-toggle` travels
              right when `is-on`; the slider-direction round had to invert it
              only because L1 had put the active label on the LEFT. Order and
              travel now agree by construction rather than by a rule. */}
          <div className="pt-mode" id="deal-payment-mode-field">
            <DealToggle id="deal-payment-mode-toggle" testid="deal-payment-mode-toggle"
              on={opexOn} title={mode.title}
              flank={{ left: 'CAPEX', right: 'OPEX',
                testidLeft: 'deal-mode-label-capex', testidRight: 'deal-mode-label-opex' }}
              onClick={() => setUi({
                paymentMode: opexOn ? 'capex' : 'opex',
                // R-OX1: OPEX locks the structure to single phase. Set HERE
                // rather than only in the radios, because the structure is what
                // prices the deal and a screen showing `twoPhase` while the
                // record holds `single` is two readers of one value.
                //
                // ── AND THE RETURN PATH, WHICH R-PT3 BROKE AND THIS FIXES ──
                // Before R-PT3 this set `single` on the way IN and nothing on
                // the way OUT, which was harmless while `single` was still a
                // CAPEX radio: the control came back showing Single phase.
                // R-PT3 removed that radio, so coming back to CAPEX left the
                // record holding a structure NO RADIO MATCHES and the group
                // rendering with nothing selected. Mine, from the previous
                // round, so it is part of this change rather than a carried
                // finding.
                //
                // Coming back lands on the DEFAULT, not on a choice:
                // `structureChosen: false` is what keeps M5 (the radio renders
                // selected) and M6 (the recovery period stays hidden) both true.
                ...(opexOn
                  ? { structure: 'twoPhase', structureChosen: false }
                  : { structure: 'single', structureChosen: true }),
              })} />
          </div>

          {/* ── M4: THE RECOVERY RADIOS ARE HORIZONTAL AGAIN ────────────────
              One row, at the panel top under the mode control. R-PT2 made them
              a vertical column in a rail and F4 gave that rail three more
              groups; John's ruling retires the rail, so the column treatment
              goes with it and `.ring-radio-group` is the horizontal row it
              always was.

              L2 STANDS: under OPEX the radios are ABSENT, not disabled and not
              hidden. A disabled radio still answers a query and still says a
              choice exists. */}
          {opexOn ? null : (
            <div className="ring-radio-group" id="deal-structure-toggle" role="radiogroup">
              {STRUCTURES.map((o) => (
                <RingRadio key={o.value} attr="data-structure" value={o.value}
                  label={o.label} note={o.note}
                  active={effectiveStructure(ui) === o.value}
                  onPick={() => setUi({ structure: o.value, structureChosen: true })} />
              ))}
            </div>
          )}

          {/* ── M6: THE RECOVERY PERIOD, BELOW THE RADIOS, ONLY WHEN CHOSEN ──
              Two-phase AND actually selected. A DEFAULTED Two-phase renders its
              radio selected (M5) and keeps this hidden, which is why
              `structureChosen` exists: `structure` alone cannot tell a default
              from a choice, because `uiFromPayload` collapses the absence. */}
          <div className={`form-group${vis.recoveryGroup ? '' : ' hidden'}`} id="deal-recovery-group">
            {renderField('deal-recoveryMonths')}
          </div>

          {/* ── M3: UNDER OPEX, THE CONTRACT DURATION ───────────────────────
              Read-only and informational, reading the SAME stored field
              Structural Terms writes. There is no second store and no second
              control: this surface only displays `deal-duration`.

              IT WAS LABELLED "Recovery period" AND THAT HAD STOPPED BEING TRUE.
              Single phase recovers over the whole term, so the figure was
              always the contract duration; the label described the field's
              origin rather than what it shows. A blank duration says so rather
              than printing a bare number. */}
          <div id="deal-contract-duration" data-testid="deal-contract-duration"
            className={vis.contractDuration ? '' : 'hidden'}>
            <span className="label">Contract Duration</span>
            <div id="deal-contract-duration-value" data-testid="deal-contract-duration-value">
              {duration ? `${duration} months` : 'Contract duration not set'}
            </div>
          </div>

          {/* ── N6: THE INVOICING RADIOS RENDER ABOVE THE MONEY ─────────────
              John's ruling 2026-09-26, superseding M7, which put them beneath.

              M7'S REASONING IS LEFT HERE BECAUSE IT WAS RIGHT ABOUT THE HARD
              PART: "beneath the fee table under Two-phase and beneath the
              hosting schedule under Hybrid" is ONE placement, not two, once the
              rail is gone, because the fee table and the Hybrid grid are
              siblings in this flow. That still holds with the polarity
              reversed: a group BEFORE both of them precedes whichever one
              renders, so this is still one group and not two.

              And it is still one group for the reason F4 established: two
              groups writing one choice is the defect, not the layout. */}
          <div className="ring-radio-group" id="deal-invoicing-toggle">
            <span className="label">Invoicing</span>
            {INVOICING.map((o) => (
              <RingRadio key={o.value} attr="data-invoicing" value={o.value} label={o.label}
                active={ui.invoicing === o.value} onPick={() => setUi({ invoicing: o.value })} />
            ))}
          </div>

          {/* ── THE MONEY ────────────────────────────────────────────────────
              F5/F3 OPTION A stands: ONE `yearSchedule`, rendered here unless
              the Hybrid grid below is going to render it. Both gate on the SAME
              `hybridOn` expression, so they cannot drift apart.

              The false claim R-PT2 wrote here - "THE YEARLY TABLE IS RENDERED
              EXACTLY ONCE, in whichever slot the mode calls for" - was corrected
              in the completion round and is not restored: it was false from the
              moment it was written, because this slot was gated on the MODE and
              the Hybrid slot on the STRUCTURE. */}
          {/* ── R-SZ2 / N7: THE OPEX PAIR SHARES A HEAD TRACK ──────────────
              Two tables sharing a row, so their first figure rows are level.
              Measured before: the per-unit rows started 12px ABOVE the yearly
              rows at every width, because the table's `<thead>` is 20px and
              the yearly head stack was 32.25px - a `.label` contributing its
              own 10.5px top margin, 15.75px of line and a 6px bottom margin.

              THE DEFECT WAS INVISIBLE UNTIL THIS ROUND. The probe looked for
              `.ys-row`, which nothing renders, so the yearly row was reported
              "not found" and the comparison silently never ran.

              A REAL `<table>` CANNOT PARTICIPATE IN A PARENT'S ROW TRACKS, so
              the two heads consume ONE declared height instead, `--opex-head-h`
              on `.opex-tables`, read by the table's `th` and by the head
              below. One token, two consumers: the bodies then start at the
              same offset by construction rather than by matching numbers,
              which is N5's own lesson from this round. */}
          <div className={`opex-tables${opexOn ? '' : ' hidden'}`} id="deal-opex-tables">
            {opexOn ? opex : null}
            {opexOn ? <p className="label opex-year-head" data-testid="opex-year-head">{scheduleHead}</p> : null}
            {opexOn ? <div id="deal-opex-year-slot">{yearSchedule}</div> : null}
          </div>
          {opexOn || hybridOn ? null : (
            <>
              <p className="label capex-year-head" data-testid="capex-year-head">{scheduleHead}</p>
              <div id="deal-capex-year-slot">{yearSchedule}</div>
            </>
          )}


          {/* ── F4: `#deal-top-schedule-row` IS RETIRED ─────────────────────
              It held three slots: invoicing, recovery, and the yearly table.
              R-PT2 moved the table to the content column and left the container
              standing, "because the schedule row's own layout is built around
              its three slots". F4 takes the other two into the rail, so the row
              is now three empty slots.

              A retirement is two claims (Verification 7): the row is GONE, and
              nothing still points at it. The second is why this is a deletion
              rather than an empty div left in place - an empty container is
              exactly what Architecture 9's fourth variant warns about, a thing
              that reads as a slot and is a leftover. */}


          {/* ── R-SZ2 / N7: THE TWO COLUMNS SHARE ROW TRACKS ───────────────
              The milestones column carried a heading, a field note and a grid
              head above its rows; the hosting column carried a label. Measured
              at 67px apart at all three widths, and constant, because the
              difference is structural rather than a wrap.

              THE TWO WRAPPER DIVS ARE GONE so every part is a direct child of
              this grid and can be placed in a named row track. The milestone
              head and the hosting head share track 3, so track 4 begins after
              the TALLER of the two, whatever either contains, and both bodies
              start there. Nothing is measured against anything.

              `display: contents` on the wrappers was the cheaper route and is
              NOT taken: N6 measures `[data-testid="hybrid-schedule"]` as a box
              against the invoicing group, and an element with no box measures
              as zero. */}
          <div id="deal-hybrid-group" className={vis.hybridGroup ? '' : 'hidden'}>
            <p className="label hg-title">Customer payment milestones (hardware)</p>
            <p className="field-note hg-note">When the customer pays us. Later payments increase the working capital we fund.</p>
            {/* ── R-O5/O6: ONE GRID, NOT TWO NESTED TABLES ───────────────
                  The table is gone. It carried a `<thead>` of four `<th>` and
                  put the whole of `MilestoneGrid`, WHICH RENDERS ITS OWN
                  TABLE, inside its single `<tbody>`. Two tables with
                  independent column widths laid out the headers and the
                  fields, so the outer table's first column absorbed the entire
                  inner table (512px) and the other three headers were pushed
                  to the right of it.

                  MEASURED before the fix, on the live DOM, by asserting
                  parentage rather than reading the source: the field table was
                  nested inside the header table's tbody, and three of the four
                  headers sat 372 to 400px from the fields they name.

                  THE GRID IS THE PROTOTYPE'S OWN, not a number chosen today.
                  `Terminus Ops.dc.html` uses `44px 195px 44px 64px` THREE
                  times in this block: the header row, the data rows and the
                  total row. One grid with three users is why it aligns.

                  AND THE BORDER FRAGMENTS DIE WITH THE TABLE. The partial
                  outlines were table cells each carrying their own edge; with
                  one grid there are no cell walls to render. */}
            <div className="ms-grid-head hg-colhead" data-testid="ms-grid-head">
              <div>Month</div><div>Project milestone</div><div>%</div><div>USD</div>
            </div>
            <div id="deal-milestones-tbody" className="hg-body">{milestoneGrid}</div>
            {/* F4: the hybrid invoicing group is gone. One control in the
                rail writes the choice for every structure. */}
            {/* F5/F3 OPTION A: the ONE render, collapsed into the Hybrid
                grid, beside the milestones at full card width. */}
            <p className="label hg-colhead hg-colhead--right">{scheduleHead}</p>
            <div id="deal-hybrid-schedule" className="hg-body">{hybridOn ? yearSchedule : null}</div>
          </div>

        </div>
      </div>

      <aside className="po-factoring-panel" id="deal-po-factoring">
        <p className="label">PO factoring</p>
        <div className="po-field">
          {/* F1: the same component the mode control wears. The switch SAYS ITS
              STATE and what a click will do, because a toggle that only shows a
              state leaves the reader guessing which way it goes. */}
          <DealToggle id="deal-factoring-toggle" testid="deal-factoring-toggle"
            on={fx.on} label={fx.label} title={fx.title}
            onClick={() => setUi({ factoringEnabled: !ui.factoringEnabled })} />
        </div>
        {/* ── M11: DISABLED MEANS ABSENT, NOT HIDDEN ─────────────────────
            The block carried `hidden`, so the rate, the term and the method
            were in the DOM and answering queries on a deal with no factoring.
            Absence is the claim John's ruling makes, and it is the same
            reasoning L2 used for the structure radios under OPEX: a control
            that is merely hidden still says a choice exists. */}
        {fx.on ? (
          <div className="po-field" id="deal-factoring-fields">
            {renderField('deal-factoring-ratePct')}
            {renderField('deal-factoring-termMonths')}
            <label>Repayment method</label>
            {/* ── M10: THE SAME TWO-SIDED CONTROL M1 USES ─────────────────
                It was two stacked full-width buttons, which is a different
                shape for the same question the mode control asks. One
                component, and `on` is the RIGHT label, which is the contract
                `DealToggle` states: declining balance sits right of
                straight-line, so the knob travels toward the method in force.

                THE STORED VALUE IS UNCHANGED. `factoringMethod` is still
                'straight' or 'declining'; only the control that writes it
                moved. */}
            <div id="deal-factoring-method-toggle">
              <DealToggle id="deal-method-toggle" testid="deal-method-toggle"
                on={ui.factoringMethod === 'declining'}
                title={ui.factoringMethod === 'declining'
                  ? 'Interest is charged on the declining balance. Click for straight-line.'
                  : 'Interest is charged straight-line. Click for declining balance.'}
                flank={{ left: 'STRAIGHT-LINE', right: 'DECLINING BALANCE',
                  testidLeft: 'deal-method-label-straight', testidRight: 'deal-method-label-declining' }}
                onClick={() => setUi({
                  factoringMethod: ui.factoringMethod === 'declining' ? 'straight' : 'declining',
                })} />
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

