import type { CFRow } from './cashflow'
import type { YearSchedule } from './schedule'
import type { ReconciliationView, MilestoneOption } from './milestones'
import type { InstallVisibility, StructureVisibility, ToggleState } from './installation'
import { money } from './rows'
// The SAME reader the vanilla paints the accent from. Verification 20.
import { marginPresentation } from '../../../src/lib/deal-inputs.js'

// ── THE RENDER HALVES OF THE SESSION C MODELS ────────────────────────────
//
// Each of these draws a model and decides nothing. The rulings live in the
// models, which is why they were testable before any of this existed; what is
// left here is the visual half of those same facts - a dash instead of a zero,
// a colour on a negative, a signpost appearing with its rows.

export function CashFlowGrid({ months, rows, scrollRef }: {
  months: number[]
  rows: CFRow[]
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!months.length) return null

  return (
    <>
      {/* The scroll container is the element the scrollable mark is applied to,
          so the ref and the class live on the same node. */}
      <div className="cf-grid cashflow-scroll" id="deal-cashflow-grid" data-testid="cashflow-grid" ref={scrollRef}>
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
    // ── R-O5/O6: THE ROWS SHARE THE HEADER'S GRID ─────────────────────────
    //
    // This rendered its OWN `<table>` and was placed inside another table's
    // `<tbody>` by `section5.tsx`. Two tables, two independent sets of column
    // widths, and the headers ended up 372 to 400px from their fields.
    //
    // `.ms-grid-row` is the SAME track list as `.ms-grid-head`, declared once
    // in the stylesheet, so the header and the fields cannot drift: there is
    // one definition of the columns and three users of it, which is the shape
    // the prototype has.
    <div data-testid="milestone-grid">
      {rows.map((r) => (
        <div className="ms-grid-row" key={r.row}>
          <input id={r.month} data-testid={r.month} inputMode="numeric" maxLength={2}
            value={values[r.month] ?? ''} onChange={(e) => onChange(r.month, e.target.value)} />
          <input id={r.label} data-testid={r.label}
            value={values[r.label] ?? ''} onChange={(e) => onChange(r.label, e.target.value)} />
          <input id={r.pct} data-testid={r.pct} inputMode="decimal"
            value={values[r.pct] ?? ''} onChange={(e) => onChange(r.pct, e.target.value)} />
          {/* L6: THE USD IS COMPUTED and shown read-only, so the two readings
              of this schedule cannot disagree about what it is a percentage of. */}
          <input id={r.usd} data-testid={r.usd} className="is-computed"
            readOnly tabIndex={-1} value={usdFor(r.row)} />
        </div>
      ))}
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
      {/* ── W6-W9: ONE GRID WITH LABELLED COLUMNS, NOT A BARE TABLE ───────
          It was a `<table>` with no `<thead>` at all: four equal columns and
          nothing saying which was which, so Month and % were as wide as the
          milestone name. This is the shape walk 4 gave the CUSTOMER grid and
          it comes from the same place - the prototype's `44px 195px 44px
          64px` at gap 4px, declared once and used by the header and every
          row, which is why the labels sit over the fields they name.
          The numeric columns are right-aligned, per the prototype. */}
      <div className="cm-grid-head" data-testid="cm-grid-head">
        <span>Month</span><span>Milestone</span><span>%</span><span>Amount</span>
      </div>
      {rows.map((r) => (
        <div className="cm-grid-row" key={r.row}>
          <input id={r.month} data-testid={r.month} inputMode="numeric" maxLength={2}
            className="int-only"
            value={values[r.month] ?? ''} onChange={(e) => onTyped(r.row, 'pct', r.month, e.target.value)} />
          {/* THE STORED-UNKNOWN BEHAVIOUR IS UNTOUCHED: `options` still keeps
              a value outside the list as its own option rather than
              discarding what somebody entered. */}
          <select id={r.label} data-testid={r.label} value={values[r.label] ?? ''}
            onChange={(e) => onTyped(r.row, 'pct', r.label, e.target.value)}>
            {options(r.row).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* BOTH SIDES ARE WRITABLE: whichever the person types on decides
              which one follows. That is the round trip, not a convenience. */}
          <input id={r.pct} data-testid={r.pct} inputMode="decimal"
            value={values[r.pct] ?? ''} onChange={(e) => onTyped(r.row, 'pct', r.pct, e.target.value)} />
          <input id={r.usd} data-testid={r.usd} inputMode="decimal"
            value={values[r.usd] ?? ''} onChange={(e) => onTyped(r.row, 'usd', r.usd, e.target.value)} />
        </div>
      ))}
      {/* ── W10: THE FIGURES SIT IN THE MONEY COLUMN ─────────────────────
          These were three left-aligned paragraphs: a sentence with the price
          inside it, then the two totals, none of them lined up with the
          Amount column they are totals OF. They take the grid's own template
          now, so each figure falls under the column it belongs to and the
          eye can add the column up. */}
      <div className="cm-grid-row cm-grid-total" data-testid="contractor-base-row">
        <span />
        <span className="cm-total-label" data-testid="contractor-base">{view.baseLabel}</span>
        <span />
        <span className="cm-total-figure" data-testid="contractor-base-figure">{view.baseFigure}</span>
      </div>
      <div className="cm-grid-row cm-grid-total" data-testid="contractor-total-row">
        <span />
        <span className="cm-total-label">Total</span>
        <span className="cm-total-figure" data-testid="contractor-total-pct">{view.totalPct}</span>
        <span className="cm-total-figure" data-testid="contractor-total-usd">{view.totalUsd}</span>
      </div>
      {view.statement
        ? <p data-testid="contractor-diff" className={view.off ? 'deal-schedule-off' : ''}>{view.statement}</p>
        : null}
      {view.warning ? <p className="msg-warning" data-testid="contractor-warn">{view.warning}</p> : null}
    </div>
  )
}


export function SwitchButton({ id, state, onToggle }: {
  id: string; state: ToggleState; onToggle(): void
}) {
  return (
    <button type="button" id={id} data-testid={id} role="switch"
      aria-checked={state.ariaChecked} title={state.title}
      className={`btn-ghost deal-toggle${state.on ? ' is-on' : ''}`} onClick={onToggle}>
      {state.label}
    </button>
  )
}


// ── THE STRIP ABOVE THE SECTIONS ─────────────────────────────────────────
//
// D2d identity adoption. Four always-visible figures, and the accent on the
// margin is NOT this component's rule: it reads `marginPresentation`, the same
// function the vanilla paints from, because Round 41 recorded the cost of
// having two. Round 39 wrote the rule inline and toggled it on ONE of the two
// renderings, so the strip showed a deal 22 points under target in the
// treatment of one on target.
//
// The ids are carried even though nothing outside the form reads them: they
// are what the vanilla's own agreement test names, and a figure with no
// identity cannot be pointed at when the next disagreement appears.
export function StatsStrip({ result, payload }: {
  result: { totals?: { contractNet?: number }, totalDealCostAll?: number,
    financeCost?: number | null, achievedMargin?: number } | null
  payload: Record<string, unknown>
}) {
  const mp = result
    ? (marginPresentation(result.achievedMargin ?? 0, payload) as { text: string, state: string })
    : { text: '--', state: '' }
  const cell = (label: string, id: string, text: string, lead = false, state = '') => (
    <div>
      <span className="label">{label}</span>
      <div id={id} data-testid={id}
        className={['stat-value', lead ? 'stat-value--lead' : '', state].filter(Boolean).join(' ')}>{text}</div>
    </div>
  )
  const money0 = (n: number | null | undefined) =>
    n === null || n === undefined ? '--' : `$${money(n)}`
  return (
    <div className="stats-grid stats-grid--deal" data-testid="deal-stats-strip">
      {cell('Achieved margin', 'deal-achieved-margin', mp.text, true, mp.state)}
      {cell('Contract net', 'deal-contract-net', money0(result?.totals?.contractNet))}
      {cell('Total deal cost', 'deal-total-cost', money0(result?.totalDealCostAll))}
      {/* money(null) is $NaN, and the absence has a wording of its own because
          the figure it replaces is one somebody prices against. */}
      {cell('Finance cost', 'deal-finance-cost',
        result && result.financeCost === null ? 'not recorded' : money0(result?.financeCost))}
    </div>
  )
}
