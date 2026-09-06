import type { ReactNode } from 'react'
import type { UiState } from './payload'
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
}: {
  ui: UiState
  setUi(p: Partial<UiState>): void
  vis: StructureVisibility
  duration: unknown
  renderField(id: string): ReactNode
  milestoneGrid: ReactNode
  yearSchedule: ReactNode
  hybridSchedule: ReactNode
}) {
  const fx = factoringToggle(ui)
  return (
    <div className="deal-payment-region">
      <div className="deal-payment-col payment-terms-panel">
        <div className="payment-card">
          <div className="ring-radio-group" id="deal-structure-toggle" role="radiogroup">
            {STRUCTURES.map((o) => (
              <RingRadio key={o.value} attr="data-structure" value={o.value} label={o.label}
                active={ui.structure === o.value} onPick={() => setUi({ structure: o.value })} />
            ))}
          </div>

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
            <div id="deal-year-schedule">{yearSchedule}</div>
          </div>

          <div id="deal-hybrid-group" className={vis.hybridGroup ? '' : 'hidden'}>
            <div>
              <p className="label">Customer payment milestones (hardware)</p>
              <p className="field-note">When the customer pays us. Later payments increase the working capital we fund.</p>
              <table className="doc-table">
                <thead><tr><th>Month</th><th>Milestone</th><th>% of hardware</th><th>USD</th></tr></thead>
                <tbody id="deal-milestones-tbody">{milestoneGrid}</tbody>
              </table>
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
