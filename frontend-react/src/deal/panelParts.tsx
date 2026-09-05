import type { CFRow } from './cashflow'
import type { YearSchedule } from './schedule'
import type { ReconciliationView, MilestoneOption } from './milestones'
import type { InstallVisibility, StructureVisibility, ToggleState } from './installation'
import { money } from './rows'

// ── THE RENDER HALVES OF THE SESSION C MODELS ────────────────────────────
//
// Each of these draws a model and decides nothing. The rulings live in the
// models, which is why they were testable before any of this existed; what is
// left here is the visual half of those same facts - a dash instead of a zero,
// a colour on a negative, a signpost appearing with its rows.

export function CashFlowGrid({ months, rows, closing, scrollRef }: {
  months: number[]
  rows: CFRow[]
  closing: string
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!months.length) {
    return (
      <>
        <p className="empty-state" data-testid="cashflow-empty">No cash flow to show yet.</p>
        <p data-testid="cashflow-closing">--</p>
      </>
    )
  }
  return (
    <>
      {/* The scroll container is the element the scrollable mark is applied to,
          so the ref and the class live on the same node. */}
      <div className="cf-grid" id="deal-cashflow-grid" data-testid="cashflow-grid" ref={scrollRef}>
        <div className="cf-row head">
          <div className="cf-label">Month</div>
          {months.map((m) => <div className="cf-cell" key={m}>{m}</div>)}
        </div>
        {rows.map((row, i) => {
          const labelBg = row.bg === 'transparent' ? 'var(--dark)' : row.bg
          return (
            <div key={`${row.label}-${i}`} data-testid={`cf-row-${i}`}
              className={`cf-row${row.total ? ' total' : ''}`} style={{ background: row.bg }}>
              <div className="cf-label"
                style={{ background: labelBg, color: row.labelColor, fontWeight: row.weight }}>{row.label}</div>
              {row.cells.map((c, j) => (
                <div className="cf-cell" key={j} style={{ color: c.color }}>{c.value}</div>
              ))}
            </div>
          )
        })}
      </div>
      <p data-testid="cashflow-closing">{closing}</p>
    </>
  )
}

export function YearScheduleView({ schedule }: { schedule: YearSchedule }) {
  if (schedule.kind === 'none') return <div data-testid="year-schedule" />
  if (schedule.kind === 'hybrid') {
    return (
      <div data-testid="hybrid-schedule">
        <p className="label" style={{ marginBottom: 10, color: 'var(--green)' }}>{schedule.label}</p>
        {schedule.years.map((y) => (
          <div className="ds-row" key={y.label}>
            <span className="ds-label">{y.label}</span>
            <span className="ds-value" style={{ color: 'var(--white)' }}>${money(schedule.valueOf(y))}</span>
          </div>
        ))}
        <div className="ds-row">
          <span className="ds-label" style={{ color: 'var(--muted-2)' }}>Total</span>
          <span className="ds-value" style={{ color: 'var(--green)' }}>${money(schedule.total)}</span>
        </div>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted-2)', marginTop: 10 }}>
          Hosting sits outside the milestones and applies every month of the term.
        </p>
      </div>
    )
  }
  // L4: THE YEARLY PAYMENTS READ DOWN, NOT ACROSS. Laid out across, the year
  // figures competed with the milestone table for the same horizontal space and
  // collided at 1240. Read down, each year is a labelled line.
  return (
    <div data-testid="year-schedule">
      <p className="label" style={{ marginBottom: 6, color: 'var(--green)' }}>{schedule.label} (USD)</p>
      <div className="ys-stack">
        {schedule.years.map((y) => (
          <div className="ys-line" key={y.label}>
            <span className="ys-year">{y.label}</span>
            <span className="ys-amount">${money(schedule.valueOf(y))}</span>
          </div>
        ))}
        <div className="ys-line ys-line--total">
          <span className="ys-year">Total (USD)</span>
          <span className="ys-amount">${money(schedule.total)}</span>
        </div>
      </div>
    </div>
  )
}

export function MilestoneGrid({ rows, values, usdFor, onChange, warning }: {
  rows: { row: number; month: string; label: string; usd: string; pct: string }[]
  values: Record<string, string | undefined>
  usdFor(i: number): string
  onChange(id: string, v: string): void
  warning: string | null
}) {
  return (
    <div data-testid="milestone-grid">
      <table><tbody>
        {rows.map((r) => (
          <tr key={r.row}>
            <td><input id={r.month} data-testid={r.month} inputMode="numeric" maxLength={2}
              value={values[r.month] ?? ''} onChange={(e) => onChange(r.month, e.target.value)} /></td>
            <td><input id={r.label} data-testid={r.label}
              value={values[r.label] ?? ''} onChange={(e) => onChange(r.label, e.target.value)} /></td>
            <td><input id={r.pct} data-testid={r.pct} inputMode="decimal"
              value={values[r.pct] ?? ''} onChange={(e) => onChange(r.pct, e.target.value)} /></td>
            {/* L6: THE USD IS COMPUTED and shown read-only, so the two readings
                of this schedule cannot disagree about what it is a percentage of. */}
            <td><input id={r.usd} data-testid={r.usd} readOnly value={usdFor(r.row)} /></td>
          </tr>
        ))}
      </tbody></table>
      {warning ? <p className="msg-warning" data-testid="milestone-warning">{warning}</p> : null}
    </div>
  )
}

export function ContractorGrid({ rows, values, options, onTyped, view }: {
  rows: { row: number; month: string; label: string; usd: string; pct: string }[]
  values: Record<string, string | undefined>
  options(i: number): MilestoneOption[]
  onTyped(i: number, side: 'pct' | 'usd', id: string, v: string): void
  view: ReconciliationView
}) {
  return (
    <div data-testid="contractor-grid">
      <table><tbody>
        {rows.map((r) => (
          <tr key={r.row}>
            <td><input id={r.month} data-testid={r.month} inputMode="numeric" maxLength={2}
              value={values[r.month] ?? ''} onChange={(e) => onTyped(r.row, 'pct', r.month, e.target.value)} /></td>
            <td>
              <select id={r.label} data-testid={r.label} value={values[r.label] ?? ''}
                onChange={(e) => onTyped(r.row, 'pct', r.label, e.target.value)}>
                {options(r.row).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </td>
            {/* BOTH SIDES ARE WRITABLE: whichever the person types on decides
                which one follows. That is the round trip, not a convenience. */}
            <td><input id={r.pct} data-testid={r.pct} inputMode="decimal"
              value={values[r.pct] ?? ''} onChange={(e) => onTyped(r.row, 'pct', r.pct, e.target.value)} /></td>
            <td><input id={r.usd} data-testid={r.usd} inputMode="decimal"
              value={values[r.usd] ?? ''} onChange={(e) => onTyped(r.row, 'usd', r.usd, e.target.value)} /></td>
          </tr>
        ))}
      </tbody></table>
      <p data-testid="contractor-base">{view.baseLine}</p>
      <p data-testid="contractor-total-usd">{view.totalUsd}</p>
      <p data-testid="contractor-total-pct">{view.totalPct}</p>
      {view.statement
        ? <p data-testid="contractor-diff" className={view.off ? 'deal-schedule-off' : ''}>{view.statement}</p>
        : null}
      {view.warning ? <p className="msg-warning" data-testid="contractor-warn">{view.warning}</p> : null}
    </div>
  )
}

export function InstallationTab({ vis, children }: { vis: InstallVisibility; children?: React.ReactNode }) {
  return (
    <div data-testid="installation-tab">
      <div data-testid="install-table" hidden={!vis.table}>{children}</div>
      {/* The signpost appears EXACTLY when the rows it points at do. */}
      <p data-testid="install-signpost" hidden={!vis.signpost}>The per-unit rows are in the detail panel.</p>
      <p data-testid="install-seetable" hidden={!vis.seeTable}>See the installation table</p>
      <div data-testid="install-lumpCost-group" hidden={!vis.lumpCostGroup} />
      <div data-testid="install-contractor-group" hidden={!vis.contractorGroup} />
      <p data-testid="install-notapplicable" hidden={!vis.notApplicable}>
        Installation is not priced by Terminus for this deal.
      </p>
    </div>
  )
}

export function SwitchButton({ id, state, onToggle }: {
  id: string; state: ToggleState; onToggle(): void
}) {
  return (
    <button type="button" id={id} data-testid={id} role="switch"
      aria-checked={state.ariaChecked} title={state.title}
      className={state.on ? 'is-on' : ''} onClick={onToggle}>
      {state.label}
    </button>
  )
}

export function StructureVisibilityRegions({ vis }: { vis: StructureVisibility }) {
  return (
    <>
      <div data-testid="top-schedule-row" hidden={!vis.topScheduleRow} />
      <div data-testid="invoicing-toggle-region" hidden={!vis.invoicingToggle} />
      <div data-testid="recovery-group" hidden={!vis.recoveryGroup} />
      <div data-testid="recovery-readonly" hidden={!vis.recoveryReadonly} />
      <div data-testid="hybrid-group" hidden={!vis.hybridGroup} />
    </>
  )
}
