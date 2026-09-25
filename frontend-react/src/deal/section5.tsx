import type { ReactNode } from 'react'
import type { UiState } from './payload'
import { effectiveStructure } from './payload'
import type { StructureVisibility } from './installation'
import { factoringToggle } from './installation'

// ── A RING RADIO ─────────────────────────────────────────────────────────
//
// Three elements, not one: the ring, the dot inside it, and the label. The
// stylesheet animates the dot inside the ring, so a flattened version would
// style as a plain bullet. `active` marks the choice, matching
// updateStructureButtons / updateInvoicingButtons (opportunity-deal.js:1686).
function RingRadio({ attr, value, label, active, onPick }: {
  attr: 'data-structure' | 'data-invoicing'
  value: string
  label: string
  active: boolean
  onPick(): void
}) {
  const props = { [attr]: value } as Record<string, string>
  return (
    <div className={`ring-radio${active ? ' active' : ''}`} {...props}
      role="radio" aria-checked={active} tabIndex={0} onClick={onPick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPick() }}>
      <span className="ring-radio-ring"><span className="ring-radio-dot" /></span>
      <span className="ring-radio-label">{label}</span>
    </div>
  )
}

const STRUCTURES = [
  { value: 'single', label: 'Single phase (recovery over full term)' },
  { value: 'twoPhase', label: 'Two-phase (hardware recovery then hosting)' },
  { value: 'hybrid', label: 'Hybrid (milestone + hosting)' },
]
const INVOICING = [
  { value: 'annual', label: 'Annual in advance' },
  { value: 'monthly', label: 'Monthly' },
]

function InvoicingGroup({ id, ui, setUi, hidden = false }: {
  id: string, ui: UiState, setUi(p: Partial<UiState>): void, hidden?: boolean
}) {
  return (
    <div className={`ring-radio-group${hidden ? ' hidden' : ''}`} id={id}>
      <span className="label">Invoicing</span>
      {INVOICING.map((o) => (
        <RingRadio key={o.value} attr="data-invoicing" value={o.value} label={o.label}
          active={ui.invoicing === o.value} onPick={() => setUi({ invoicing: o.value })} />
      ))}
    </div>
  )
}

export function PaymentTermsSection({
  ui, setUi, vis, duration, renderField, milestoneGrid, yearSchedule, hybridSchedule,
  opex,
}: {
  ui: UiState
  setUi(p: Partial<UiState>): void
  vis: StructureVisibility
  duration: unknown
  renderField(id: string): ReactNode
  milestoneGrid: ReactNode
  yearSchedule: ReactNode
  hybridSchedule: ReactNode
  /** R-OX2: the OPEX table, built by the panel so this file lays out only. */
  opex: ReactNode
}) {
  const fx = factoringToggle(ui)
  const opexOn = ui.paymentMode === 'opex'
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
          {/* ── R-OX1: THE MODE SWITCH ──────────────────────────────────
              The same dress and interaction as the factoring toggle a panel
              away: a `role="switch"` carrying its own state and a title saying
              what a click will do. */}
          {/* ── L1: A LABELLED SLIDER, THE ACTIVE SIDE IN THE ESTATE GREEN ──
              OPEX, the slider, CAPEX, in that order in the document, which is
              what "between them" means to a reader and to the keyboard alike.
              The labels carry `data-active` and the STYLESHEET colours them, so
              the marking is one fact with one writer.

              The control keeps `role="switch"` and gains an `aria-label`,
              because its visible text now sits beside it rather than inside
              it: a switch whose label moved out has no accessible name left. */}
          <div className="opex-switch" id="deal-payment-mode-field">
            <span className="opex-switch-label" data-testid="deal-mode-label-opex"
              data-active={opexOn ? 'true' : 'false'}>OPEX</span>
            <button type="button" id="deal-payment-mode-toggle"
              data-testid="deal-payment-mode-toggle"
              className={`btn-ghost deal-toggle opex-slider${opexOn ? ' is-on' : ''}`}
              role="switch" aria-checked={opexOn ? 'true' : 'false'} title={mode.title}
              aria-label={`Payment mode, currently ${opexOn ? 'OPEX' : 'CAPEX'}`}
              onClick={() => setUi({
                paymentMode: opexOn ? 'capex' : 'opex',
                // R-OX1: OPEX locks recovery to single phase. Set HERE rather
                // than only disabling the radios, because the structure is what
                // prices the deal and a screen showing `single` while the record
                // holds `twoPhase` is two readers of one value. It matters more
                // now: L2 removes the radios, so this is the only writer left.
                ...(opexOn ? {} : { structure: 'single' }),
              })} />
            <span className="opex-switch-label" data-testid="deal-mode-label-capex"
              data-active={opexOn ? 'false' : 'true'}>CAPEX</span>
          </div>
          {/* ── L3: THE TWO TABLES SHARE A ROW, TOP-ALIGNED ─────────────── */}
          <div className={`opex-tables${opexOn ? '' : ' hidden'}`} id="deal-opex-tables">
            {opexOn ? opex : null}
            {/* L3: the yearly table moves UP beside the monthly one. It is
                rendered HERE under OPEX and left out of the schedule row below,
                so it exists once: two mounts of one schedule would be two
                readers of one derivation. */}
            {opexOn ? <div id="deal-opex-year-slot">{yearSchedule}</div> : null}
          </div>
          {/* ── L2: UNDER OPEX THE RADIOS ARE ABSENT, NOT DISABLED ─────────
              Amended by John mid-round: nothing stands in their place either.
              Absence rather than a disabled control, because a disabled radio
              still answers a query and still says a choice exists. */}
          {opexOn ? null : (
            <div className="ring-radio-group" id="deal-structure-toggle" role="radiogroup">
              {STRUCTURES.map((o) => (
                <RingRadio key={o.value} attr="data-structure" value={o.value} label={o.label}
                  active={effectiveStructure(ui) === o.value}
                  onPick={() => setUi({ structure: o.value })} />
              ))}
            </div>
          )}

          {/* Hybrid brings its own schedule and its own invoicing radios, so the
              top row goes rather than sitting empty beside them. */}
          <div id="deal-top-schedule-row" className={vis.topScheduleRow ? '' : 'hidden'}>
            <InvoicingGroup id="deal-invoicing-toggle" ui={ui} setUi={setUi}
              hidden={!vis.invoicingToggle} />
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
            <div id="deal-year-schedule">{opexOn ? null : yearSchedule}</div>
          </div>

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
              <InvoicingGroup id="deal-hybrid-invoicing-toggle" ui={ui} setUi={setUi} />
              <div id="deal-hybrid-schedule">{hybridSchedule}</div>
            </div>
          </div>
        </div>
      </div>

      <aside className="po-factoring-panel" id="deal-po-factoring">
        <p className="label">PO factoring</p>
        <div className="po-field">
          {/* The switch SAYS ITS STATE and what a click will do, because a
              toggle that only shows a state leaves the reader guessing which
              way it goes. */}
          <button type="button" id="deal-factoring-toggle" data-testid="deal-factoring-toggle"
            className={`btn-ghost deal-toggle${fx.on ? ' is-on' : ''}`}
            role="switch" aria-checked={fx.ariaChecked} title={fx.title}
            onClick={() => setUi({ factoringEnabled: !ui.factoringEnabled })}>{fx.label}</button>
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
