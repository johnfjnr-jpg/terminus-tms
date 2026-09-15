// ── L1: THE ITEMIZED COST SECTION ────────────────────────────────────────
//
// Q4, ruled 2026-09-15: the breakdown returns to the vanilla's home, its OWN
// section below the rate grid, rather than nested inside the Commercials card
// where the empty container had ended up.
//
// The renderer is dumb on purpose: every decision about which rows exist, in
// what order and at what weight lives in `costBreakdown.ts`, which is pure and
// tested without a browser.
import { money } from './money'
import { breakdownCards, type TestBedCostBreakdown, type BreakdownRow, type RowWeight } from './costBreakdown'

/**
 * `.data-row` and the three weights are the vanilla's own treatments, kept by
 * name rather than re-invented. Verification 7: a replacement control carries
 * the replaced control's class, and where the estate has a named treatment for
 * the role that name IS the contract.
 */
const ROW_CLASS: Record<RowWeight, string> = {
  item: 'data-row',
  summary: 'data-row',
  subtotal: 'data-row tb-cost-subtotal',
  total: 'data-row tb-cost-summary-total',
}

function Row({ label, value, weight }: BreakdownRow) {
  // `.tb-cost-summary-total` styles its own spans, so the total must NOT also
  // carry `.tb-cost-strong`: that would set 13px over the 15px the total's own
  // rule gives it, and the row this card exists to make read first would come
  // out the same size as the three beneath it.
  const span = weight === 'item' ? 'tb-cost-item-label'
    : weight === 'total' ? undefined : 'tb-cost-strong'
  const val = weight === 'item' ? 'data-row-label'
    : weight === 'total' ? undefined : 'tb-cost-strong'
  return (
    <div className={ROW_CLASS[weight]}
      data-testid={`tb-cost-row-${weight}`} data-row-label={label}>
      <span className={span}>{label}</span>
      <span className={val}>{money(value)}</span>
    </div>
  )
}

export function CostBreakdownCards({ breakdown, input, unsaved }: {
  breakdown: TestBedCostBreakdown
  /** Draft-or-stored, so the hardware labels quote what is on screen. */
  input: (key: string) => string
  /** True while the figures come from unsaved drafts rather than the record. */
  unsaved: boolean
}) {
  const cards = breakdownCards(breakdown, input)
  return (
    <div className="ref-cards" data-testid="tb-cost-cards">
      {cards.map((c) => (
        <div key={c.testId}
          className={unsaved && c.testId === 'tb-cost-card-summary'
            ? 'pg-card tb-cost-card-unsaved' : 'pg-card'}
          data-testid={c.testId}>
          <p className="pg-card-title">
            {c.title}
            {/* ── THE MARKER SITS IN THE CARD'S OWN TITLE ───────────────
                Not in the save bar. A total a person cannot tell apart from a
                saved one makes the save bar advisory: they read the number,
                believe it is recorded, and move on.

                Q1-A, ruled 2026-09-15: BOTH totals show and BOTH are labelled.
                The header strip's Total cost is the SAVED figure and says so;
                this one is the draft and says so. The two differing during an
                edit is correct behaviour, and what was wrong before was that
                neither said which it was. */}
            {unsaved && c.testId === 'tb-cost-card-summary'
              ? <span className="tb-cost-unsaved" data-testid="tb-cost-preview-marker">unsaved</span>
              : null}
          </p>
          {c.rows.map((r) => <Row key={r.label} {...r} />)}
        </div>))}
    </div>
  )
}
