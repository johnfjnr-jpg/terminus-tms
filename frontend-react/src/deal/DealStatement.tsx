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

/** C2: the deal form's own store, handed down so an edit here IS an edit there. */
export type EditSeam = {
  values: Record<string, string | undefined>
  onValue(id: string, v: string): void
  dirty: boolean
  onSave(): void
  onReset(): void
}

// ── R-K: THE KEYBOARD, INSIDE A PANEL RATHER THAN A FORM ─────────────────
//
// The statement is a FIELD PANEL - each box is its own editor and there is no
// form to submit - so R-K governs rather than the Enter-submits standard:
// Enter and ArrowDown commit and move to the NEXT editor, ArrowUp moves back,
// Enter on the last commits and closes, firing NO record-wide save. Escape
// reverts the box to what the record holds.
//
// "COMMITS" MEANS THE DRAFT, NOT THE RECORD. The value is already in the form
// store as it is typed; moving on does not write anything. The record-wide
// Save is the bar's, pressed deliberately - a key that saved a record would
// make Enter a write, which is exactly what R-K does not want in a panel
// where somebody is filling in eight numbers.
function onEditorKey(e: React.KeyboardEvent<HTMLInputElement>, revert: () => void) {
  const move = (dir: 1 | -1) => {
    const all = [...document.querySelectorAll<HTMLInputElement>('.stmt-edit')]
      .filter((el) => !el.disabled)
    const i = all.indexOf(e.currentTarget)
    if (i === -1) return
    const next = all[i + dir]
    if (next) { next.focus(); next.select() } else e.currentTarget.blur()
  }
  if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  else if (e.key === 'Escape') { e.preventDefault(); revert() }
}

function Editor({ id, seam, saved, derived }: {
  id: string, seam: EditSeam, saved: string, derived: string,
}) {
  // ── R-EV1: THE BOX SHOWS THE EFFECTIVE VALUE, AND R-EV2: IT SAYS WHICH ──
  //
  // `stored` is the form store's draft. An unset override hydrates as `''`,
  // not `undefined`, so OVERRIDE IS EMPTINESS and the fallback is not `??`.
  //
  // `editing` is what makes CLEARING possible at all. Without it a box
  // rendering the derivation can never be emptied: the first backspace stores
  // `''`, the fallback fires on the same render, and the number reappears
  // under the caret. While the box has focus it shows the draft exactly as it
  // is, so an empty box is an empty box; on blur an empty draft falls back and
  // "clearing returns to the derived display, never blank" becomes true.
  //
  // The derived figure is the PLACEHOLDER while editing, so a focused empty
  // box still states what leaving it blank will produce. That is the same
  // sentence R-EV3 makes the old cards tell, said by the same formatter.
  const [editing, setEditing] = useState(false)
  const stored = seam.values[id] ?? ''
  // ── THE SIGNAL NEEDS SOMETHING TO DEPART FROM ──────────────────────────
  //
  // FOUND BY OPENING THE SCREENSHOT, and every assertion had passed. The unit
  // COUNT boxes - 20, 12, 4, 3 - are editors with a stored value and NO
  // derivation, so a rule of "stored means overridden" painted all four amber
  // and bold. A unit count is always somebody's decision; there is no
  // calculated count it could be departing from.
  //
  // A signal that is on permanently says nothing, which is the same fault as a
  // warning that is always wrong: it spends the one mark this panel has for a
  // priced line that left the derivation.
  //
  // So an override is a stored value WHERE A DERIVATION EXISTS.
  //
  // AND THE TWO QUESTIONS ARE SEPARATE, which the first fix confused and the
  // guard caught within the minute: WHAT THE BOX SHOWS falls back to the
  // derivation whenever the store is empty, and WHETHER IT SIGNALS asks
  // further whether there was a derivation to depart from. Tying the display
  // to the signal blanked all four unit counts, which have a value and no
  // derivation.
  const override = stored !== '' && derived !== ''
  return (
    // ── NO `id`, AND THAT IS THE POINT ────────────────────────────────────
    //
    // The binding is React state, not the DOM, so this editor needs no id -
    // and giving it the old panel's id would put TWO elements on one
    // identity. `deal-identity.test.tsx` caught exactly that, and
    // `sections.ts` already warns why it matters: "rendering them in both
    // produces one id with two elements, and readPayload reads whichever the
    // DOM returns first". The test id is prefixed so a probe can address this
    // editor without colliding either.
    <input type="text" className={`stmt-edit${override ? ' stmt-edit-override' : ''}`}
      data-testid={`stmt-edit-${id}`}
      data-contract="numOrUndefined"
      data-override={override ? 'true' : 'false'}
      placeholder={derived}
      value={editing ? stored : (stored !== '' ? stored : derived)}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onChange={(e) => seam.onValue(id, e.target.value)}
      onKeyDown={(e) => onEditorKey(e, () => seam.onValue(id, saved))} />
  )
}

function DrawerBody({ drawer, seam, saved }: {
  drawer: Drawer, seam?: EditSeam, saved: Record<string, string | undefined>,
}) {
  if (drawer.kind === 'note') return <p className="stmt-note">{drawer.note}</p>
  const cell = (r: { cells: string[], editIds?: (string | null)[], editDerived?: (string | null)[],
    costReadOnly?: boolean, basis?: string },
    c: string, j: number) => {
    const id = seam ? r.editIds?.[j] ?? null : null
    return (
      <td key={j} className={j === 1 && r.costReadOnly ? 'stmt-catalog' : undefined}>
        {id ? <Editor id={id} seam={seam!} saved={saved[id] ?? ''}
          derived={r.editDerived?.[j] ?? ''} /> : c}
        {/* R-C2a: the basis sits under the COST it explains, not in a legend
            somewhere else. A reader asking "why is this number what it is" is
            looking at the number. */}
        {j === 1 && r.basis ? <small data-testid="stmt-basis">{r.basis}</small> : null}
      </td>
    )
  }
  return (
    <>
      <table className="stmt-drawer-table">
        <thead><tr>{drawer.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {drawer.rows.map((r, i) => (
            <tr key={i} className={r.sum ? 'stmt-sum' : undefined}>
              {r.cells.map((c, j) => cell(r, c, j))}
            </tr>
          ))}
        </tbody>
      </table>
      {drawer.second ? (
        <table className="stmt-drawer-table stmt-drawer-second">
          <thead><tr>{drawer.second.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {drawer.second.rows.map((r, i) => (
              <tr key={i}>{r.cells.map((c, j) => cell(r, c, j))}</tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {drawer.note ? <p className="stmt-note">{drawer.note}</p> : null}
    </>
  )
}

function Line({ line, open, onToggle, variant, seam, saved }: {
  line: StatementLine
  open: boolean
  onToggle(): void
  variant?: 'total' | 'grand'
  seam?: EditSeam
  saved: Record<string, string | undefined>
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
          <DrawerBody drawer={line.drawer!} seam={seam} saved={saved} />
        </div>
      ) : null}
    </div>
  )
}

export function DealStatement({ statement, seam, saved = {} }: {
  statement: Statement
  /** C2: absent means READ-ONLY, which is what C1 shipped. */
  seam?: EditSeam
  /** The values as the RECORD holds them, for Escape to revert to. */
  saved?: Record<string, string | undefined>
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const openable = [...statement.moneyIn, ...statement.moneyOut]
    .filter((l) => l.drawer).map((l) => l.key)
  const allOpen = openable.length > 0 && openable.every((k) => open[k])
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  const line = (l: StatementLine, variant?: 'total' | 'grand') => (
    <Line key={l.key} line={l} open={!!open[l.key]} variant={variant}
      seam={seam} saved={saved} onToggle={() => toggle(l.key)} />
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

      {/* ── C2: MODIFIED, UNSAVED ────────────────────────────────────────
          It sits under the strip rather than at the foot of the sheet,
          because the strip is what a person is watching while they type and
          the one thing they must not have to scroll for is the fact that
          nothing is written yet.

          IT APPEARS ONLY WHEN DIRTY. A bar that is always there stops being
          read, and a Save that is always available says nothing about whether
          there is anything to save - which is the state the old panel's
          disabled button already carries and this must not contradict. */}
      {seam?.dirty ? (
        <div className="stmt-unsaved" data-testid="stmt-unsaved" role="status">
          <span className="stmt-unsaved-text">Modified, not saved</span>
          <button type="button" className="btn-sm" data-testid="stmt-reset"
            onClick={seam.onReset}>Reset</button>
          <button type="button" className="btn-sm btn-primary" data-testid="stmt-save"
            onClick={seam.onSave}>Save changes</button>
        </div>
      ) : null}

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

