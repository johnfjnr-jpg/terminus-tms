// ── TERM_FACTORING Phase 3: PO factoring and the cash flow, on Payment terms ──
//
// The approved mockup of record is prototypes/term-factoring-mockup.html: the
// PO factoring card, then the cash flow directly below it (R-TF1). Where the
// mockup's illustrative figures differ from the rulings, the rulings govern
// (Phase 1 sign-off): timing in month 1, the pass-through per unit per month,
// the last repayment carrying the rounding.
//
// THIS FILE IMPORTS NOTHING FROM THE ENGINE. Every figure arrives on the
// quote the view already priced, and `money` is passed in, so the isolation
// guard's importer allowlist (R-TP1) does not grow for a display file.
//
// THE SHARED DISPLAY (R-TF9, ruled at Phase 1): `DealToggle` for all three
// toggles, and Commercials' `CashFlowGrid` for the grid. The rows are built
// HERE, in the CFRow shape CashFlowGrid takes, because Commercials'
// `buildCashFlowRows` carries Commercials' labels and rounds to whole
// dollars, where spec 5 shows cents. That is a SECOND BUILDER OF ONE SHAPE,
// recorded as such (Verification 20): the shape is shared and imported as a
// type, the rows and their units are not the same rows.
import { useEffect, useRef } from 'react'
import { DealToggle } from '../deal/DealToggle'
import { CashFlowGrid } from '../deal/panelParts'
import type { CFRow, CFCell } from '../deal/cashflow'

type Money = (c: bigint) => string
interface Ratio { n: bigint; d: bigint }

/** One cash flow month, as the engine returns it (spec 9.5): signed cents. */
export interface TermCashFlowRow {
  month: number; procurementCents: bigint; advanceCents: bigint; clientCents: bigint; hostingCents: bigint
  principalCents: bigint; interestCents: bigint; netCents: bigint; balanceCents: bigint
}

// R-TF8's rows, and Phase 1 ruling 4: principal and interest are two rows.
export const CASH_FLOW_LABELS = {
  procurement: 'Hardware procurement',
  advance: 'Factoring advance',
  client: 'Client payments',
  hosting: 'Hosting and service costs',
  principal: 'Factoring principal',
  interest: 'Factoring interest',
  net: 'Net',
  balance: 'Running balance',
} as const

/** Signed cents as the mockup prints them: "−100,000.00" with U+2212. */
export const signedMoney = (money: Money, c: bigint) => (c < 0n ? `−${money(-c)}` : money(c))

/**
 * The cash flow rows for CashFlowGrid, in cents. Factoring off: no advance,
 * principal or interest rows, because a facility that does not exist has no
 * rows (Commercials' rule, cashflow.ts). A zero reads as a dash, as there.
 */
export function buildTermCashFlowRows(rows: TermCashFlowRow[], factoringOn: boolean, money: Money): CFRow[] {
  const cell = (c: bigint, color?: string): CFCell => (c === 0n
    ? { value: '-', color: 'var(--muted)' }
    : { value: signedMoney(money, c), color: color ?? (c < 0n ? 'var(--muted)' : 'var(--white)') })
  const row = (label: string, pick: (r: TermCashFlowRow) => bigint, total = false, color?: (c: bigint) => string): CFRow => ({
    label,
    cells: rows.map((r) => { const c = pick(r); return color ? { value: signedMoney(money, c), color: color(c) } : cell(c) }),
    labelColor: 'var(--white)', weight: total ? '500' : '400', bg: 'transparent', total,
  })
  const L = CASH_FLOW_LABELS
  return [
    row(L.procurement, (r) => r.procurementCents),
    ...(factoringOn ? [row(L.advance, (r) => r.advanceCents)] : []),
    row(L.client, (r) => r.clientCents),
    row(L.hosting, (r) => r.hostingCents),
    ...(factoringOn ? [row(L.principal, (r) => r.principalCents), row(L.interest, (r) => r.interestCents)] : []),
    row(L.net, (r) => r.netCents, true, (c) => (c < 0n ? '#e0824a' : 'var(--white)')),
    row(L.balance, (r) => r.balanceCents, true, (c) => (c < 0n ? '#e0824a' : 'var(--green)')),
  ]
}

export interface FactoringFigures {
  costCents: bigint
  treatment: 'absorb' | 'pass_through'
  advanceAboveHardwareCost: boolean
  hardwareCostCents: bigint
  without: { monthlyTotalCents: bigint; grossProfitCents: bigint; grossMargin: Ratio }
}

export function FactoringCard(props: {
  money: Money; pct(r: Ratio): string
  on: boolean; onToggle(): void
  advance: string; advancePlaceholder: string; onAdvance(v: string): void; hardwareNote: string
  rate: string; onRate(v: string): void
  term: string; onTerm(v: string): void
  method: 'straight' | 'declining'; onMethod(): void
  treatment: 'absorb' | 'pass_through'; onTreatment(): void
  error: string | null
  figures: FactoringFigures | null
  monthlyCents: bigint | null; grossProfitCents: bigint | null; grossMargin: Ratio | null
}) {
  const { money, pct, on, figures: f } = props
  const pass = props.treatment === 'pass_through'
  return (
    <section className="tp-card tp-fx" aria-label="PO factoring" data-testid="tp-factoring">
      <div className="tp-fx-head">
        <div>
          <h2 className="tp-h2 tp-fx-title">PO factoring</h2>
          <div className="tp-small tp-muted">Advances cash against the client PO to fund hardware procurement. Internal only: never shown on the client figures.</div>
        </div>
        <DealToggle id="tp-factoring-toggle" testid="tp-factoring-toggle" on={on}
          label={on ? 'Factoring enabled' : 'Factoring disabled'}
          title={on ? 'Factoring is on. Click to turn it off.' : 'Factoring is off. Click to turn it on.'}
          onClick={props.onToggle} />
      </div>
      {/* M11, Commercials' rule: off means ABSENT, not hidden. A control that
          is merely hidden still says a choice exists. */}
      {on && (
        <div data-testid="tp-factoring-fields">
          <div className="tp-fx-grid">
            <label className="tp-fx-field">
              <span className="tp-label">Advance amount</span>
              <input className="tp-num tp-money" inputMode="decimal" data-testid="tp-fx-advance" aria-label="Advance amount, USD"
                value={props.advance} placeholder={props.advancePlaceholder} onChange={(e) => props.onAdvance(e.target.value)} />
              <span className="tp-small tp-muted" data-testid="tp-fx-hardware">{props.hardwareNote}</span>
            </label>
            <label className="tp-fx-field">
              <span className="tp-label">Rate (% per month)</span>
              <input className="tp-num tp-pct2" inputMode="decimal" data-testid="tp-fx-rate" aria-label="Factoring rate, percent per month"
                value={props.rate} onChange={(e) => props.onRate(e.target.value)} />
            </label>
            <label className="tp-fx-field">
              <span className="tp-label">Term (months)</span>
              <input className="tp-num tp-pct2" inputMode="numeric" data-testid="tp-fx-term" aria-label="Factoring term, months"
                value={props.term} onChange={(e) => props.onTerm(e.target.value)} />
            </label>
            <div className="tp-fx-field">
              <span className="tp-label">Repayment</span>
              <DealToggle id="tp-fx-method" testid="tp-fx-method" on={props.method === 'declining'}
                title={props.method === 'declining'
                  ? 'Interest is charged on the declining balance. Click for straight-line.'
                  : 'Interest is charged straight-line. Click for declining balance.'}
                flank={{ left: 'Straight-line', right: 'Declining balance', testidLeft: 'tp-fx-method-straight', testidRight: 'tp-fx-method-declining' }}
                onClick={props.onMethod} />
            </div>
          </div>
          {f?.advanceAboveHardwareCost && (
            <div className="tp-warn" role="note" data-testid="tp-fx-above">The advance is above the hardware cost of {money(f.hardwareCostCents)}. The quote is allowed.</div>
          )}
          {props.error && <p className="tp-error" role="alert" data-testid="tp-fx-error">{props.error}</p>}
          <div className="tp-fx-foot">
            <div className="tp-fx-treatment">
              <span className="tp-label">Factoring cost</span>
              <DealToggle id="tp-fx-treatment" testid="tp-fx-treatment" on={pass}
                title={pass ? 'The cost is passed through to the price at cost. Click to absorb it.' : 'The cost comes out of profit. Click to pass it through at cost.'}
                flank={{ left: 'Absorb', right: 'Pass through', testidLeft: 'tp-fx-treatment-absorb', testidRight: 'tp-fx-treatment-pass' }}
                onClick={props.onTreatment} />
              <span className="tp-small tp-muted tp-fx-note" data-testid="tp-fx-treatment-note">{pass
                ? 'Factoring cost added to the price at cost, with no markup. Profit unchanged. The client sees a slightly higher fee, never a factoring line.'
                : 'Price unchanged. The factoring cost comes out of profit.'}</span>
            </div>
            {f && props.monthlyCents !== null && props.grossProfitCents !== null && props.grossMargin && (
              <div className="tp-fx-figs" data-testid="tp-fx-figs">
                <div><span className="tp-label">Factoring cost</span><span className="tp-v" data-testid="tp-fx-cost">{money(f.costCents)}</span></div>
                <div><span className="tp-label">Monthly fee (yr 1)</span><span className="tp-v" data-testid="tp-fx-fee">{pass
                  ? `${money(f.without.monthlyTotalCents)} → ${money(props.monthlyCents)}` : money(props.monthlyCents)}</span></div>
                <div><span className="tp-label">Margin</span><span className="tp-v" data-testid="tp-fx-margin">{pct(f.without.grossMargin)} → {pct(props.grossMargin)}</span></div>
                <div><span className="tp-label">Profit</span><span className="tp-v" data-testid="tp-fx-profit">{pass
                  ? `${money(props.grossProfitCents)} (unchanged)` : `${money(f.without.grossProfitCents)} → ${money(props.grossProfitCents)}`}</span></div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export interface CashFlowHeadline { lowest: { balanceCents: bigint; month: number }; paybackMonth: number | null }

export function CashFlowCard({ money, rows, factoringOn, headline, without }: {
  money: Money; rows: TermCashFlowRow[] | null; factoringOn: boolean
  headline: CashFlowHeadline | null; without: CashFlowHeadline | null
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Ported from DealPanel's markCashFlowScrollable: the fade says whether the
  // grid actually overflows, kept up by a ResizeObserver.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const mark = () => el.classList.toggle('is-scrollable', el.scrollWidth > el.clientWidth + 1)
    mark()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(mark)
    ro.observe(el)
    return () => ro.disconnect()
  })
  const at = (h: CashFlowHeadline) => `${signedMoney(money, h.lowest.balanceCents)} at M${h.lowest.month}`
  const payback = (h: CashFlowHeadline) => (h.paybackMonth === null ? 'none within the term' : `M${h.paybackMonth}`)
  return (
    <section className="tp-card tp-cashflow" aria-label="Cash flow" data-testid="tp-cashflow">
      <div className="tp-card-head">
        <h2 className="tp-h2">Cash flow</h2>
        {headline && (
          <div className="tp-cf-headline" data-testid="tp-cf-headline">
            <span><span className="tp-label">{factoringOn ? 'Lowest balance with factoring ' : 'Lowest balance '}</span>
              <span className="tp-v" data-testid="tp-cf-lowest">{at(headline)}</span></span>
            {factoringOn && without && (
              <span className={without.lowest.balanceCents < 0n ? 'tp-cf-attention' : undefined}><span className="tp-label">Without factoring </span>
                <span className="tp-v" data-testid="tp-cf-lowest-without">{at(without)}</span></span>
            )}
            <span><span className="tp-label">Payback </span><span className="tp-v" data-testid="tp-cf-payback">{payback(headline)}</span>
              {factoringOn && without && <span className="tp-small tp-muted" data-testid="tp-cf-payback-without"> (without factoring {payback(without)})</span>}</span>
          </div>
        )}
      </div>
      {rows ? (
        <CashFlowGrid months={rows.map((r) => r.month)} rows={buildTermCashFlowRows(rows, factoringOn, money)} scrollRef={scrollRef} />
      ) : (
        <p className="tp-small tp-muted" data-testid="tp-cf-empty">The cash flow shows once the quote prices.</p>
      )}
      <p className="tp-small tp-muted" data-testid="tp-cf-note">Client payments are what Terminus receives: after WHT, excluding GST. Hardware procurement{factoringOn ? ' and the factoring advance are' : ' is'} in month 1{factoringOn ? '; repayments run from month 2' : ''}.</p>
    </section>
  )
}
