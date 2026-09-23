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
  // ── G2 and G3, John's walk 2026-09-23 ─────────────────────────────────
  //
  // Renamed "Duration and Margin", and Contract duration becomes the FIRST
  // row: the card's name now says what it holds in the order it holds it,
  // and duration is the term everything else on the card is a rate against.
  //
  // The title is asserted in `reference-surface` and `deal-section4`'s card
  // enumerations, which move with it rather than being loosened.
  { title: 'Duration and Margin', achieved: true,
    fields: ['deal-duration', 'deal-targetMargin', 'deal-warrantyPct'] },
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
    // ── WALK 11 D2, SUPERSEDING WALK 8 ITEM 1 ─────────────────────────────
    //
    // Walk 8 made the Tax Adjustments card SPAN the track list, because the
    // tax line needed 455px and a standard card offers 430px. The span bought
    // the line at 1440 and bought nothing at 1240, where `.terms-cards` has
    // one column and a span is a span of one.
    //
    // John ruled the other way: shorten the LABEL instead, and let the card be
    // an ordinary card beside Currency. `Withholding Tax %` was 155px against
    // its own 90px box, so the label was setting the width; `WHT %` returns
    // the item to the box.
    //
    // The superseded reasoning is left above rather than deleted, per
    // Verification 29: a premise failed - that the line could not be made
    // narrower - and the decision was re-taken rather than re-weighed.
    <div className="terms-cards">
      {CARDS.map((card) => (
        <div className="pg-card" key={card.title}>
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
          {/* ── G6, John's walk 2026-09-23: TWO LINES EXACTLY ─────────────
              "WHT % [value] [Gross up toggle]" then "GST % [value]".

              THIS SUPERSEDES THE ONE-LINE-FOR-THREE RULING, and the earlier
              reasoning is left in the comments above rather than deleted: it
              was right that the three belong together and wrong that they
              belong on one line. Verification 29 - a premise failed, so the
              decision is re-taken rather than re-weighed, and the superseded
              reasoning stays visible so a reader can tell which happened.

              The gross-up toggle stays ON the WHT line, because whether tax
              is grossed up is a fact ABOUT the withholding rate. GST is a
              pass-through and gets its own line. */}
          {card.title === 'Tax Adjustments'
            ? (
              <>
                <div className="terms-field-row terms-wht-pair">
                  {renderField('deal-whtPct')}
                  {grossUpToggle}
                </div>
                <div className="terms-field-row">
                  {renderField('deal-gstPct')}
                </div>
              </>)
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
