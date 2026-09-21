import type { ReactNode } from 'react'
import { marginPresentation } from '../../../src/lib/deal-inputs.js'

// ── SECTION 3: STRUCTURAL TERMS ──────────────────────────────────────────
//
// A card of field rows with the ACHIEVED MARGIN sitting among them rather than
// at the end. Round 39 measured 578px between the margin controls and the
// figure they move; the row is here so the number is beside the hand.
//
// The accent is marginPresentation's, the same object the strip reads. Round 39
// wrote the rule inline and toggled it on one of the two renderings, so a deal
// 22 points under target displayed in the treatment of one on target.
// THE CARDS AND THE HEADINGS, in the vanilla's own words. THE NOTES HAVE
// MOVED: R2d put the eight field explanations into DealPanel's HELP map, so
// they render through the existing help-dot pattern instead of as a visible
// row under each field. This sentence named them until that change, which is
// the rotting-claim shape: a comment describing content it no longer has. The
// swapped screen rendered the fields and dropped all three headings and all
// eight notes: the controls were there and the explanation of what they do was
// not, which is what the comparison against the vanilla found.
const CARDS = [
  { title: 'Margin and Warranty', achieved: true,
    fields: ['deal-targetMargin', 'deal-warrantyPct', 'deal-duration'] },
  { title: 'Currency', achieved: false,
    fields: ['deal-bidCurrency', 'deal-proposalCurrency', 'deal-fxContingency'] },
  // W4, ruled 2026-09-20: this card places its own fields, so the list is
  // empty and the body below renders them in the ruled order. WHT and the
  // gross-up selector are ONE PAIR on ONE line, and GST follows the pair
  // rather than splitting it: GST is a pass-through and belongs after the
  // decision that is not.
  { title: 'Tax Adjustments', achieved: false, fields: [] },
]

export function StructuralTermsSection({ renderField, achievedMargin, payload, grossUpToggle }: {
  renderField(id: string): ReactNode
  achievedMargin: number | undefined
  payload: Record<string, unknown>
  grossUpToggle: ReactNode
}) {
  const mp = (achievedMargin === undefined
    ? { text: '--', state: '', note: '' }
    : marginPresentation(achievedMargin, payload)) as { text: string, state: string, note: string }

  const row = (id: string) => (
    <div className="terms-field-row" key={id}>
      {renderField(id)}
    </div>
  )

  return (
    // WALK 8 ITEM 1, ruled by John: the Tax Adjustments card SPANS the track
    // list, so the tax line has room to be ONE line. `pg-card--wide` carries
    // `grid-column: 1 / -1` rather than `span 2`, deliberately: `.terms-cards`
    // is `auto-fit`, so the used track list is two columns at 1440 and ONE at
    // 1240, and `span 2` against a one-column grid creates an implicit second
    // column and pushes half the card outside the grid.
    <div className="terms-cards">
      {CARDS.map((card) => (
        <div className={`pg-card${card.title === 'Tax Adjustments' ? ' pg-card--wide' : ''}`}
          key={card.title}>
          <p className="pg-card-title">{card.title}</p>
          {card.fields.map(row)}
          {/* W4: THE WHT PAIR, ON ONE LINE, ABOVE GST. It rendered WHT, then
              GST, then the gross-up toggle on a third line - so the two halves
              of one decision were split by a pass-through that has nothing to
              do with either. Whether tax is grossed up is a fact ABOUT the
              withholding rate and reads as one thing beside it. */}
          {/* LEDGER 8, 2026-09-21: ONE LINE, in this order - the withholding
              rate, the gross-up selector, then GST. W4 had already put the
              first two together, for the reason above; this brings GST onto
              the same line so the whole tax position reads across rather than
              down. Both rates are two-digit fields and the selector is short,
              so the line holds all three at both widths. */}
          {card.title === 'Tax Adjustments'
            ? (
              <div className="terms-field-row terms-wht-pair">
                {renderField('deal-whtPct')}
                {grossUpToggle}
                {renderField('deal-gstPct')}
              </div>)
            : null}
          {/* THE ACHIEVED MARGIN SITS AMONG THE CONTROLS THAT MOVE IT. Round 39
              measured 578px between the margin controls and the figure they
              change; the row is here so the number is beside the hand. The
              accent is marginPresentation's, the same object the strip reads. */}
          {card.achieved ? (
            <div className="terms-field-row terms-achieved">
              <div>
                <div className="pg-item-name">Achieved margin</div>
                <div className="pg-item-note" id="deal-terms-achieved-note"
                  data-testid="deal-terms-achieved-note">{mp.note}</div>
              </div>
              <div className={`stat-value${mp.state ? ' ' + mp.state : ''}`}
                id="deal-terms-achieved-margin"
                data-testid="deal-terms-achieved-margin">{mp.text}</div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── SECTION 6: CASH FLOW ─────────────────────────────────────────────────
//
// THE EMPTY STATE IS A REAL STATE and names the act that fixes it: without a
// contract duration there is nothing to model, and "no rows" would leave the
// reader looking for a fault.
export function CashFlowSection({ grid, closing, hasFlow }: {
  grid: ReactNode
  closing: string
  hasFlow: boolean
}) {
  return (
    <div className="deal-cashflow-col">
      {/* The GRID owns #deal-cashflow-grid and the scroll ref: the scrollable
          mark is applied to the element that actually scrolls, so the ref and
          the class have to sit on the same node. */}
      {grid}
      <p className={`empty-state${hasFlow ? ' hidden' : ''}`} id="deal-cashflow-empty"
        data-testid="deal-cashflow-empty">Set the Contract Duration to model the monthly cash flow.</p>
      <div>
        <span className="label">Closing position over contract</span>
        <span className="stat-value" id="deal-cashflow-closing"
          data-testid="deal-cashflow-closing">{closing}</span>
      </div>
    </div>
  )
}
