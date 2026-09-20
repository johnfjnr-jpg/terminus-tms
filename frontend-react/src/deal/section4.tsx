import { useState } from 'react'
import { money } from './rows'

// The vanilla's own sign rule (opportunity-deal.js moneySigned): a negative
// cash position reads -$n, not $-n, because the minus belongs to the amount
// rather than to the currency.
const moneySigned = (v: number) => {
  const n = Math.round(v || 0)
  return n < 0 ? `-$${money(Math.abs(n))}` : `$${money(n)}`
}

export interface Notices { minCash: number | null, minCashMonth: number, milestoneWarning: string | null }

// CASH POSITION IS ONE STATEMENT IN TWO MOODS, not two independent lines: the
// trough sentence is the same either way and only the verdict changes, so a
// deal that goes negative says so in the same words it would have used to say
// it did not.
export function SummaryNotices({ n }: { n: Notices }) {
  const trough = n.minCash === null ? '' :
    `Lowest cash position: ${moneySigned(n.minCash)} in month ${n.minCashMonth || 1}.`
  const positive = n.minCash !== null && n.minCash >= 0
  return (
    <>
      <p className={`msg-success${positive ? '' : ' hidden'}`} id="deal-cashflow-ok"
        data-testid="deal-cashflow-ok">{positive ? `Cash position stays positive throughout the term. ${trough}` : ''}</p>
      <p className={`msg-error${n.minCash !== null && !positive ? '' : ' hidden'}`} id="deal-cashflow-warn"
        data-testid="deal-cashflow-warn">{n.minCash !== null && !positive ? `Cash position goes negative. ${trough}` : ''}</p>
      <p className={`msg-error${n.milestoneWarning ? '' : ' hidden'}`} id="deal-milestone-warn"
        data-testid="deal-milestone-warn">{n.milestoneWarning ?? ''}</p>
    </>
  )
}
import type { InstallVisibility } from './installation'
// THE SAME PRESENTERS THE VANILLA USES, never a second expression of the rule.
// perMonthFigure is the one wording rule and it is shared with the
// over-the-term labels durationPresentation produces, so the two surfaces
// cannot drift into two conventions (opportunity-deal.js:405).
import { perMonthFigure } from '../../../src/lib/deal-inputs.js'
import { numericOrDefault, toNumberOrNull } from '../../../src/lib/numeric-payload.js'

// R-O7 added the last two. `buildCostGroup` returns them on every row, so the
// display reads the margin the price was computed with rather than deriving a
// second one beside it.
type Row = {
  key: string, rawCost: number, rawPrice: number,
  overridden: boolean, impliedMarginPct: number | null,
}
type Group = { rows?: Row[], rawTotalCost: number, rawTotalPrice: number }
export type PricingResult = {
  groups: { hardwareGroup: Group, hostingGroup: Group }
  hardware: { totalUnits: number, warrantyUnits: number, warrantyBasisUnits: number }
} | null

const CARDS = [
  {
    title: 'Unit cost and warranty',
    period: (s: string) => s,
    totalCostId: 'pg-total-cost-hw',
    totalPriceId: 'pg-total-price-hw',
    group: 'hardwareGroup' as const,
    rows: [
      { key: 'hwSs', name: 'SafeSight' },
      { key: 'hwAqm', name: 'AQ Sensor' },
      { key: 'hwHemir', name: 'HEMIR' },
      { key: 'hwWarranty', name: 'Warranty provision' },
    ],
  },
  {
    title: 'Hosting (per month)',
    period: perMonthFigure as (s: string) => string,
    totalCostId: 'pg-total-cost-ho',
    totalPriceId: 'pg-total-price-ho',
    group: 'hostingGroup' as const,
    rows: [
      { key: 'hoSs', name: 'SafeSight' },
      { key: 'hoAqm', name: 'AQ Sensor' },
      { key: 'hoHemir', name: 'HEMIR' },
    ],
  },
]

// The notes, in the vanilla's own words. A note is `N units x $cost` except
// the warranty provision, which is a PROVISION rather than a purchase and says
// what it is a percentage of (opportunity-deal.js:398-401).
function noteFor(key: string, payload: Record<string, unknown>, result: PricingResult): string {
  const ssUnits = numericOrDefault(payload, 'ssExisting') + numericOrDefault(payload, 'ssNew')
  const aqUnits = Number(payload.aqm ?? 0)
  const hemirUnits = numericOrDefault(payload, 'hemir')
  const per = (units: number, cost: unknown) => `${units} units x $${money(cost ?? 0)}`
  switch (key) {
    case 'hwSs': return per(ssUnits, payload.ssUnitCost)
    case 'hwAqm': return per(aqUnits, payload.aqUnitCost)
    case 'hwHemir': return per(hemirUnits, payload.hemirUnitCost)
    case 'hwWarranty': {
      if (!result) return ''
      // THE BASIS IS SAFESIGHT UNITS, NOT THE MIX. John's rule, 2026-09-16.
      // This read `totalUnits` and was correct while the count was taken over
      // every product. It is a sentence describing a calculation, so changing
      // the calculation and leaving it would have printed a true-looking figure
      // against the wrong denominator, which nothing could have failed on.
      const { warrantyBasisUnits, warrantyUnits } = result.hardware
      const pct = numericOrDefault(payload, 'warrantyPct')
      return `${pct}% of ${warrantyBasisUnits} SafeSight unit${warrantyBasisUnits === 1 ? '' : 's'}`
        + ` = ${warrantyUnits} unit${warrantyUnits === 1 ? '' : 's'}, at cost`
    }
    case 'hoSs': return per(ssUnits, payload.hoSafesight)
    case 'hoAqm': return per(aqUnits, payload.hoAqm)
    case 'hoHemir': return per(hemirUnits, payload.hoHemir)
    default: return ''
  }
}

// THE RULING'S OWN THREE ROWS, in its own words: Safesight, Air Quality,
// HEMIR. The keys are the calculator's, so the table and the pricing cannot
// drift apart by naming a type two ways.
const HOSTING_FEE_ROWS = [
  { key: 'hoSs', name: 'Safesight' },
  { key: 'hoAqm', name: 'Air Quality' },
  { key: 'hoHemir', name: 'HEMIR' },
] as const

// ── R-O7: THE HOSTING CARD PRICES ONE OF TWO WAYS ────────────────────────
//
// MARGIN, the way it always has: a percentage per line, the price following
// from the cost. Or PER UNIT: a monthly fee for ONE unit of a type, the
// percentage following from the price. They are the same decision said in
// opposite directions, which is why this is a switch on one card rather than a
// second card or a second screen.
//
// THE TABLE IS THE RULING'S: Unit, Monthly fee, % Margin. The Cost column goes
// while the switch is on, because the question being answered has changed - the
// margin IS the readout of the fee against the cost, so it says what the cost
// column was there to let somebody work out.
//
// THE PERCENTAGE IS NOT RECOMPUTED HERE. `buildCostGroup` returns
// `impliedMarginPct` beside the price it priced, so the number on screen is
// derived from the same two figures the price was and cannot disagree with it
// (Verification 20). A display that did its own `1 - cost/price` would be the
// second reader.
function HostingFeeRows({ group, values, onFee, target }: {
  group: { rows?: Row[] } | undefined
  values: Record<string, string | undefined>
  onFee(id: string, v: string): void
  target: number
}) {
  const find = (k: string) => group?.rows?.find((r) => r.key === k)
  return (
    <>
      <div className="pg-head pg-head--fee" data-testid="pg-head-fee">
        <span>Unit</span><span>Monthly fee</span><span>% Margin</span>
      </div>
      {HOSTING_FEE_ROWS.map((row) => {
        const r = find(row.key)
        const id = `deal-hofee-${row.key}`
        const raw = values[id] ?? ''
        const pct = r?.impliedMarginPct
        return (
          <div className="pg-row pg-row--fee" key={row.key}>
            <div className="pg-item-name">{row.name}</div>
            <input type="text" id={id} data-testid={id} data-contract="numOrUndefined"
              className={`pg-margin-input${r?.overridden ? ' pg-margin-override' : ''}`}
              placeholder="per unit" value={raw}
              title={r?.overridden
                ? 'The monthly fee for one unit of this type. The margin beside it is what this fee earns against that unit\'s cost.'
                : `Blank leaves this type priced at its margin, ${target}%.`}
              onChange={(e) => onFee(id, e.target.value)} />
            {/* NOT RECORDED IS SAID, NOT SHOWN AS A ZERO. A line with no fee is
                still priced, from its margin, and the percentage is that
                margin. A price of zero has no margin at all, and `null` is how
                `buildCostGroup` says so. */}
            <div className="pg-price" id={`pg-fee-margin-${row.key}`}
              data-testid={`pg-fee-margin-${row.key}`}>
              {pct === null || pct === undefined ? '--' : `${pct.toFixed(1)}%`}
            </div>
          </div>
        )
      })}
    </>
  )
}

function PricingCards({ result, payload, values, onMargin, hostingPriceMode, onHostingPriceMode }: {
  result: PricingResult
  payload: Record<string, unknown>
  values: Record<string, string | undefined>
  onMargin(id: string, v: string): void
  hostingPriceMode: string
  onHostingPriceMode(mode: string): void
}) {
  const target = numericOrDefault(payload, 'targetMargin')
  const perUnit = hostingPriceMode === 'perUnit'
  return (
    <div className="pg-cards">
      {CARDS.map((card) => {
        const group = result?.groups?.[card.group]
        const find = (k: string) => group?.rows?.find((r) => r.key === k)
        const fig = (n: number | undefined) => n === undefined ? '--' : card.period(`$${money(n)}`)
        const isHosting = card.group === 'hostingGroup'
        return (
          <div className="pg-card" key={card.title}>
            <div className="pg-card-head">
              <p className="pg-card-title">{card.title}</p>
              {isHosting ? (
                <button type="button" role="switch" aria-checked={perUnit}
                  id="deal-hosting-price-mode" data-testid="deal-hosting-price-mode"
                  className={`btn-ghost deal-toggle${perUnit ? ' is-on' : ''}`}
                  title="Override the calculated Margin Price"
                  onClick={() => onHostingPriceMode(perUnit ? 'margin' : 'perUnit')}>
                  Price/Unit
                </button>
              ) : null}
            </div>
            {isHosting && perUnit ? (
              <HostingFeeRows group={group} values={values} onFee={onMargin} target={target} />
            ) : (<>
            <div className="pg-head">
              <span>Item</span><span>Cost (USD)</span><span>Margin %</span><span>Price (USD)</span>
            </div>
            {card.rows.map((row) => {
              const r = find(row.key)
              const id = `deal-margin-${row.key}`
              const raw = values[id] ?? ''
              // B8/B9: a BLANK box prices at target, so the placeholder carries
              // the target rather than the box carrying a value nobody entered.
              // An overridden line says so, because a line priced away from
              // target is a decision (opportunity-deal.js:379-385).
              const override = toNumberOrNull(raw)
              return (
                <div className="pg-row" key={row.key}>
                  <div>
                    <div className="pg-item-name">{row.name}</div>
                    <div className="pg-item-note" id={`pg-note-${row.key}`}
                      data-testid={`pg-note-${row.key}`}>{noteFor(row.key, payload, result)}</div>
                  </div>
                  <div className="pg-cost" id={`pg-cost-${row.key}`}
                    data-testid={`pg-cost-${row.key}`}>{fig(r?.rawCost)}</div>
                  <input type="text" id={id} data-testid={id} data-contract="numOrUndefined"
                    className={`pg-margin-input${override !== null ? ' pg-margin-override' : ''}`}
                    placeholder={String(target)} value={raw}
                    title={override === null
                      ? `Blank prices this line at the target margin, ${target}%.`
                      : `Priced at ${override}% against a target of ${target}%.`}
                    onChange={(e) => onMargin(id, e.target.value)} />
                  <div className="pg-price" id={`pg-price-${row.key}`}
                    data-testid={`pg-price-${row.key}`}>{fig(r?.rawPrice)}</div>
                </div>
              )
            })}
            </>)}
            {/* ── R-O8: WHAT AN OVERRIDDEN PRICE INCLUDES, SAID ON THE PANEL ──
                Ruled by John, 2026-09-20: warranty is OUT of the pricing
                override entirely. There is no Warranty % column here, no
                monthly-including-warranty column and no price-side warranty
                field, because an overridden monthly price is WARRANTY-INCLUSIVE
                BY DEFINITION. `warrantyPct` keeps its spare-units cost meaning
                untouched and the 2026-09-16 correction stands.

                The sentence is the whole of the change: a person setting a fee
                has to know whether they are also covering the warranty, and the
                answer cannot live only in a ruling nobody reading this screen
                has seen. */}
            {isHosting && perUnit ? (
              <p className="pg-item-note" data-testid="deal-hosting-fee-help">
                A monthly fee entered here is warranty-inclusive: it replaces the
                calculated margin price for that unit type, and the warranty
                provision is already carried in the hardware cost.
              </p>
            ) : null}
            {/* ── THE TOTAL ROW TAKES THE SHAPE OF THE TABLE ABOVE IT ───────
                FOUND BY OPENING THE SCREENSHOT, and no assertion could have
                seen it: the row rendered, carried the right figures to the
                dollar, and read them out of the right ids. It was the FOURTH
                column that was wrong - the fee table is three columns and this
                row stayed four, so the total PRICE sat under the heading
                `% Margin`. A total price presented as a percentage is the kind
                of wrongness that is only visible to somebody looking at it.

                In fee mode the three cells answer the three headings: the type
                becomes Total, the fee column becomes the monthly hosting price
                those fees add up to, and the margin column becomes the margin
                that whole card earns. The overall margin is derived the same
                way a row's is, from the group's own cost and price, so it
                cannot disagree with the rows above it. */}
            {isHosting && perUnit ? (
              <div className="pg-row pg-total pg-row--fee">
                <div className="pg-item-name">Total</div>
                <div className="pg-price" id={card.totalPriceId}
                  data-testid={card.totalPriceId}>{fig(group?.rawTotalPrice)}</div>
                <div className="pg-price" id="pg-fee-margin-total"
                  data-testid="pg-fee-margin-total">
                  {group && group.rawTotalPrice > 0
                    ? `${((1 - group.rawTotalCost / group.rawTotalPrice) * 100).toFixed(1)}%`
                    : '--'}
                </div>
              </div>
            ) : (
            <div className="pg-row pg-total">
              <div className="pg-item-name">Total</div>
              <div className="pg-cost" id={card.totalCostId}
                data-testid={card.totalCostId}>{fig(group?.rawTotalCost)}</div>
              <div />
              <div className="pg-price" id={card.totalPriceId}
                data-testid={card.totalPriceId}>{fig(group?.rawTotalPrice)}</div>
            </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DealSummarySection({
  result, payload, values, onMargin, matrix, notices, install, basis,
  hostingPriceMode, onHostingPriceMode,
}: {
  result: PricingResult
  payload: Record<string, unknown>
  values: Record<string, string | undefined>
  onMargin(id: string, v: string): void
  /** R-O7: 'margin' or 'perUnit', owned by the form and written to the payload. */
  hostingPriceMode: string
  onHostingPriceMode(mode: string): void
  matrix: React.ReactNode
  notices: React.ReactNode
  install: InstallVisibility
  basis: { text: string, absent: boolean, age: string, ageBand: string, warning: string }
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="deal-section" id="deal-section-4" data-testid="deal-section-4">
      <div className="section-title-row">
        <p className="section-title">Deal Sheet Summary</p>
        {/* B1: the label is its own SPAN. Writing the button's textContent
            would delete the chevron the CSS rotates, so the indicator would
            work exactly once (opportunity-deal.js:1939). */}
        <button type="button" id="btn-toggle-detail" className="btn-text disclose"
          data-testid="btn-toggle-detail" aria-controls="deal-detail-panel"
          aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen((o) => !o)}>
          <span className="disclose-chevron">&rsaquo;</span>
          <span id="btn-toggle-detail-text">{open ? 'Hide detail' : 'Show detail'}</span>
        </button>
      </div>

      {/* B2: `detail-open` goes on the ROW. The row has to become two columns,
          and hiding the panel alone leaves a one-column grid with a gap. */}
      <div className={`deal-summary-row${open ? ' detail-open' : ''}`} id="deal-summary-row">
        <div className="deal-summary-col">
          <p className="label">Deal Sheet (USD) &middot; <span id="deal-sheet-units"
            data-testid="deal-sheet-units">{result?.hardware?.totalUnits ?? 0}</span> units</p>
          <div className="deal-panel" id="deal-panel">{matrix}</div>
          <span className="field-note">Contract prices are quoted exclusive of GST. GST is added to the invoice and passed straight through, so the rate never touches margin.</span>
          {notices}
        </div>

        <aside className={`deal-detail-col${open ? '' : ' hidden'}`} id="deal-detail-panel"
          aria-labelledby="deal-detail-heading">
          <p className="section-title" id="deal-detail-heading">Detail, per line</p>
          <p className="label">Computed pricing (USD) &middot; costs mirrored from Base Cost Data</p>
          <p className="deal-basis" id="deal-catalog-notice">
            <span className="deal-basis-label">Cost basis</span>
            {/* THE VALUE READS AT FULL WEIGHT AND THE AGE DOES NOT: the basis is
                a fact about this deal, the age is a warning that only sometimes
                applies. */}
            <span className={`deal-basis-value${basis.absent ? ' deal-basis-absent' : ''}`}
              id="deal-catalog-basis" data-testid="deal-catalog-basis">{basis.text}</span>
            <span className={`deal-basis-age${basis.ageBand ? ' ' + basis.ageBand : ''}`}
              id="deal-catalog-age" data-testid="deal-catalog-age">{basis.age}</span>
          </p>
          <p className={`msg-error${basis.warning ? '' : ' hidden'}`} id="deal-catalog-warn">{basis.warning}</p>
          <PricingCards result={result} payload={payload} values={values} onMargin={onMargin}
            hostingPriceMode={hostingPriceMode} onHostingPriceMode={onHostingPriceMode} />
          <p className={`field-note${install.signpost ? '' : ' hidden'}`} id="deal-detail-signpost"
            data-testid="deal-detail-signpost">The four installation lines are priced in the Installation section above.</p>
        </aside>
      </div>
    </section>
  )
}
