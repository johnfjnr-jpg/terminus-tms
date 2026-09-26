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
  ui, setUi, vis, duration, renderField, milestoneGrid, yearSchedule,
  opex,
}: {
  ui: UiState
  setUi(p: Partial<UiState>): void
  vis: StructureVisibility
  duration: unknown
  renderField(id: string): ReactNode
  milestoneGrid: ReactNode
  yearSchedule: ReactNode

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
          <div className="pt-row">
            <div className="pt-rail" id="deal-payment-rail" data-testid="deal-payment-rail">
              {/* ── F1: THE SHARED TOGGLE, AND WHAT IT SUPERSEDES ──────────
                  R-OX1 built this as "the same dress and interaction as the
                  factoring toggle", which was true of the wiring and false of
                  the markup: two buttons carrying one class string is not one
                  component. L1 then moved the labels OUT either side of a bare
                  42px track, which made the two controls different sizes.

                  John's walk, 2026-09-25: it IS the factoring toggle. One
                  component, one dress, one size, the state named inside the
                  button. `DealToggle` carries the reasoning and the L1
                  supersession in full. */}
              <div className="pt-mode" id="deal-payment-mode-field">
                <DealToggle id="deal-payment-mode-toggle" testid="deal-payment-mode-toggle"
                  on={opexOn} label={mode.label} title={mode.title}
                  ariaLabel={`Payment mode, currently ${mode.label}`}
                  onClick={() => setUi({
                    paymentMode: opexOn ? 'capex' : 'opex',
                    // R-OX1: OPEX locks recovery to single phase. Set HERE rather
                    // than only disabling the radios, because the structure is what
                    // prices the deal and a screen showing `single` while the record
                    // holds `twoPhase` is two readers of one value. It matters more
                    // now: L2 removes the radios, so this is the only writer left.
                    ...(opexOn ? {} : { structure: 'single' }),
                  })} />
              </div>
              {/* ── L2 IN THE RAIL: UNDER OPEX THE RADIOS ARE ABSENT ───────
                  Amended by John mid-round: nothing stands in their place
                  either. Absence rather than a disabled control, because a
                  disabled radio still answers a query and still says a choice
                  exists.

                  R-PT2 makes them a VERTICAL column in the rail, each a label
                  with its explanation beneath. */}
              {opexOn ? null : (
                <div className="ring-radio-group ring-radio-column" id="deal-structure-toggle" role="radiogroup">
                  {STRUCTURES.map((o) => (
                    <RingRadio key={o.value} attr="data-structure" value={o.value}
                      label={o.label} note={o.note}
                      active={effectiveStructure(ui) === o.value}
                      onPick={() => setUi({ structure: o.value })} />
                  ))}
                </div>
              )}
              {/* ── F4: THE INVOICING RADIOS JOIN THE RAIL ─────────────────
                  John's walk, 2026-09-25: "beneath the recovery radios, same
                  gutter, same alignment. Recovery period stays with them."

                  So the recovery field and its single-phase readout come too.
                  They used to sit in `#deal-top-schedule-row`, a three-slot row
                  whose third slot R-PT2 had already emptied; with these two gone
                  the row has nothing left and is retired rather than left
                  standing as an empty container for somebody to find.

                  AND THE HYBRID COPY GOES WITH IT. Hybrid carried its own
                  invoicing group, so the choice had two controls writing it and
                  two groups reading it. One control in the rail serves every
                  structure, which is Verification 20's remedy rather than its
                  symptom. */}
              <div className="ring-radio-group ring-radio-column" id="deal-invoicing-toggle">
                <span className="label">Invoicing</span>
                {INVOICING.map((o) => (
                  <RingRadio key={o.value} attr="data-invoicing" value={o.value} label={o.label}
                    active={ui.invoicing === o.value} onPick={() => setUi({ invoicing: o.value })} />
                ))}
              </div>
              <div className={`form-group${vis.recoveryGroup ? '' : ' hidden'}`} id="deal-recovery-group">
                {renderField('deal-recoveryMonths')}
              </div>
              {/* SINGLE PHASE HAS NO SEPARATE RECOVERY: it recovers over the whole
                  term, so the figure is a READOUT of the duration rather than an
                  input. A blank duration is not zero months and says so. */}
              <div id="deal-recovery-readonly" className={vis.recoveryReadonly ? '' : 'hidden'}>
                <span className="label">Recovery period</span>
                <div id="deal-recovery-readonly-value" data-testid="deal-recovery-readonly-value">
                  {duration ? `${duration} months` : 'Contract duration not set'}
                </div>
              </div>
            </div>
            <div className="pt-content" id="deal-payment-content" data-testid="deal-payment-content">
          {/* ── R-PT2: THE CONTENT COLUMN ───────────────────────────────
              The money starts at the top of the panel in BOTH modes, which is
              the whole point of the rail: the CAPEX tables used to begin below
              a block of radios and the OPEX ones did not.

              ── THE CLAIM THAT FOLLOWED WAS FALSE AND IS CORRECTED HERE ──
              R-PT2 wrote: "THE YEARLY TABLE IS RENDERED EXACTLY ONCE, in
              whichever slot the mode calls for. Two mounts of one schedule
              would be two readers of one derivation and would satisfy every
              assertion about where it is."

              THE SECOND SENTENCE WAS RIGHT AND THE FIRST WAS FALSE FROM THE
              MOMENT IT WAS WRITTEN. `DealPanel` passed the same
              `<YearScheduleView>` twice, as `yearSchedule` and as
              `hybridSchedule`, and this slot was gated on the MODE while the
              Hybrid slot was gated on the STRUCTURE. Under Hybrid both
              rendered and both were VISIBLE, measured live at y=2443 beside
              the rail and y=2841 in the Hybrid grid.

              A hardcoded claim about configuration has a shelf life and cannot
              be falsified by anything (Architecture 9's fourth variant). This
              one survived a round because it described an intention.

              F5/F3 RULED, OPTION A, 2026-09-26: ONE `yearSchedule` prop, and
              this slot renders it only when the Hybrid grid is not going to.
              The gating is on the SAME expression in both places, so the two
              cannot disagree again. */}
          <div className={`opex-tables${opexOn ? '' : ' hidden'}`} id="deal-opex-tables">
            {opexOn ? opex : null}
            {opexOn ? <div id="deal-opex-year-slot">{yearSchedule}</div> : null}
          </div>
              {opexOn || hybridOn ? null : <div id="deal-capex-year-slot">{yearSchedule}</div>}
            </div>
          </div>


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


          <div id="deal-hybrid-group" className={vis.hybridGroup ? '' : 'hidden'}>
            <div>
              <p className="label">Customer payment milestones (hardware)</p>
              <p className="field-note">When the customer pays us. Later payments increase the working capital we fund.</p>
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
              <div className="ms-grid-head" data-testid="ms-grid-head">
                <div>Month</div><div>Project milestone</div><div>%</div><div>USD</div>
              </div>
              <div id="deal-milestones-tbody">{milestoneGrid}</div>
            </div>
            <div>
              {/* F4: the hybrid invoicing group is gone. One control in the
                  rail writes the choice for every structure. */}
              {/* F5/F3 OPTION A: the ONE render, collapsed into the Hybrid
                  grid, beside the milestones at full card width. */}
              <div id="deal-hybrid-schedule">{hybridOn ? yearSchedule : null}</div>
            </div>
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
        <div className={`po-field${fx.on ? '' : ' hidden'}`} id="deal-factoring-fields">
          {renderField('deal-factoring-ratePct')}
          {renderField('deal-factoring-termMonths')}
          <label>Repayment method</label>
          <div className="view-toggle view-toggle--stacked" id="deal-factoring-method-toggle">
            {[{ m: 'straight', l: 'Straight-line' }, { m: 'declining', l: 'Declining balance' }].map((o) => (
              <button key={o.m} type="button" data-method={o.m}
                className={ui.factoringMethod === o.m ? 'active' : ''}
                onClick={() => setUi({ factoringMethod: o.m })}>{o.l}</button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

