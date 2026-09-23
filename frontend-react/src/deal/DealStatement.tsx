// ── THE DEAL SHEET STATEMENT, C1: READ-ONLY ─────────────────────────────
//
// Option C rendered. MONEY IN, MONEY OUT, RESULT, read top to bottom, each
// line's drivers in a drawer underneath it, and a reconciling strip pinned
// while the tab scrolls.
//
// READ-ONLY IS THE WHOLE OF C1. The mockup's drawers carry margin INPUTS;
// these carry the same figures as text. Editing is C2 and does not begin
// without John's verdict on this page, so a control that looks editable here
// would be the page making a promise the round has not built.
//
// EVERY FIGURE COMES FROM `buildDealStatement`, which reads the same
// expressions `buildDealRows` reads. This file formats and lays out; it
// computes nothing. The one thing it decides is which rows are open.
import { useState } from 'react'
import type { Statement, StatementLine, Drawer } from './statement'

// FOUR COLUMNS, NOT THE MOCKUP'S THREE. The mockup folds installation into
// the hardware column and shows HARDWARE | HOSTING | TOTAL. The data has four
// figures and the existing matrix shows four, so folding would either drop
// the installation figure or compute a sum here - and this file computes
// nothing. Reported in the brief as a departure from the mockup.
const COLS = ['HARDWARE', 'HOSTING', 'INSTALLATION', 'TOTAL']

function DrawerBody({ drawer }: { drawer: Drawer }) {
  if (drawer.kind === 'note') return <p className="stmt-note">{drawer.note}</p>
  return (
    <>
      <table className="stmt-drawer-table">
        <thead><tr>{drawer.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {drawer.rows.map((r, i) => (
            <tr key={i} className={r.sum ? 'stmt-sum' : undefined}>
              {r.cells.map((c, j) => (
                <td key={j} className={j === 1 && r.costReadOnly ? 'stmt-catalog' : undefined}>
                  {c}
                  {/* R-C2a: the basis sits under the COST it explains, not in
                      a legend somewhere else. A reader asking "why is this
                      number what it is" is looking at the number. */}
                  {j === 1 && r.basis ? <small data-testid="stmt-basis">{r.basis}</small> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {drawer.second ? (
        <table className="stmt-drawer-table stmt-drawer-second">
          <thead><tr>{drawer.second.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {drawer.second.rows.map((r, i) => (
              <tr key={i}>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {drawer.note ? <p className="stmt-note">{drawer.note}</p> : null}
    </>
  )
}

function Line({ line, open, onToggle, variant }: {
  line: StatementLine
  open: boolean
  onToggle(): void
  variant?: 'total' | 'grand'
}) {
  const has = !!line.drawer
  const cells = [line.hardware, line.hosting, line.installation, line.total]
  return (
    <div className={`stmt-row${has ? ' stmt-has-drawer' : ''}${open ? ' stmt-open' : ''}${variant ? ' stmt-' + variant : ''}`}
      data-testid={`stmt-row-${line.key}`}>
      {/* THE ROW IS A BUTTON ONLY WHEN IT OPENS SOMETHING. A role of button on
          a line that does nothing is a promise to a screen reader that the
          page does not keep. */}
      <div className="stmt-row-line"
        {...(has ? {
          role: 'button', tabIndex: 0, 'aria-expanded': open ? 'true' : 'false',
          'aria-controls': `stmt-drawer-${line.key}`,
          onClick: onToggle,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() }
          },
        } : {})}>
        <span className="stmt-tw" aria-hidden="true">{has ? '›' : ''}</span>
        <span className="stmt-lbl">
          {line.label}
          {line.sub ? <small>{line.sub}</small> : null}
        </span>
        {cells.map((c, i) => (
          <span key={i}
            className={`stmt-num${c === '-' ? ' stmt-dash' : ''}${line.negative && c !== '-' && c !== '' ? ' stmt-neg' : ''}`}
            data-testid={`stmt-${line.key}-${COLS[i].toLowerCase()}`}>{c}</span>
        ))}
      </div>
      {has ? (
        <div className="stmt-drawer" id={`stmt-drawer-${line.key}`} hidden={!open}
          data-testid={`stmt-drawer-${line.key}`}>
          <DrawerBody drawer={line.drawer!} />
        </div>
      ) : null}
    </div>
  )
}

export function DealStatement({ statement }: { statement: Statement }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const openable = [...statement.moneyIn, ...statement.moneyOut]
    .filter((l) => l.drawer).map((l) => l.key)
  const allOpen = openable.length > 0 && openable.every((k) => open[k])
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  const line = (l: StatementLine, variant?: 'total' | 'grand') => (
    <Line key={l.key} line={l} open={!!open[l.key]} variant={variant}
      onToggle={() => toggle(l.key)} />
  )

  return (
    <div className="stmt" data-testid="deal-statement">
      {/* THE STRIP IS STICKY SO THE RECONCILIATION STAYS WHILE THE SHEET
          SCROLLS. Round 39 measured 578px between a margin control and the
          figure it moves; this is the same problem answered by pinning the
          figure rather than by shortening the distance. */}
      <div className="stmt-strip" data-testid="stmt-strip">
        <div><div className="stmt-k">REVENUE</div>
          <div className="stmt-v" data-testid="stmt-strip-revenue">{statement.strip.revenue}</div></div>
        <div><div className="stmt-k">TOTAL COST</div>
          <div className="stmt-v" data-testid="stmt-strip-cost">{statement.strip.cost}</div></div>
        <div><div className="stmt-k">PROFIT</div>
          <div className="stmt-v" data-testid="stmt-strip-profit">{statement.strip.profit}</div></div>
        <div><div className="stmt-k">ACHIEVED MARGIN</div>
          <div className={`stmt-v ${statement.strip.state}`} data-testid="stmt-strip-margin">{statement.strip.margin}</div>
          <div className="stmt-sub" data-testid="stmt-strip-target">{statement.strip.target}</div></div>
      </div>

      <div className="stmt-sheet">
        <div className="stmt-colhead">
          <span /><span className="stmt-colhead-line">LINE</span>
          {COLS.map((c) => <span key={c}>{c}</span>)}
        </div>

        <div className="stmt-sec">
          <span>MONEY IN</span>
          <button type="button" className="btn-text" data-testid="stmt-expand-all"
            aria-expanded={allOpen ? 'true' : 'false'}
            onClick={() => setOpen(allOpen ? {} : Object.fromEntries(openable.map((k) => [k, true])))}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        {statement.moneyIn.map((l) => line(l))}
        {line(statement.revenue, 'grand')}

        <div className="stmt-sec stmt-mid"><span>MONEY OUT</span></div>
        {statement.moneyOut.map((l) => line(l))}
        {line(statement.totalCost, 'total')}

        <div className="stmt-sec stmt-mid"><span>RESULT</span></div>
        <div className="stmt-row stmt-total stmt-result" data-testid="stmt-row-profit">
          <div className="stmt-row-line">
            <span className="stmt-tw" aria-hidden="true" />
            <span className="stmt-lbl">Profit</span>
            <span className="stmt-num" data-testid="stmt-profit">{statement.profit}</span>
          </div>
        </div>
        <div className="stmt-row stmt-total stmt-result stmt-last" data-testid="stmt-row-margin">
          <div className="stmt-row-line">
            <span className="stmt-tw" aria-hidden="true" />
            <span className="stmt-lbl">Achieved margin
              <small data-testid="stmt-margin-note">{statement.margin.note}</small></span>
            <span className={`stmt-margin-final ${statement.margin.state}`}
              data-testid="stmt-margin">{statement.margin.text}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

