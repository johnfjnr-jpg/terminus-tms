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
import { DealStatement, type EditSeam } from './DealStatement'
import type { Statement } from './statement'
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
  // D3: `installGroup` was always on the object the calculator returns; only
  // this type omitted it, which is why the card could not see the line.
  groups: { hardwareGroup: Group, installGroup?: Group, hostingGroup: Group }
  hardware: { totalUnits: number, warrantyUnits: number, warrantyBasisUnits: number }
} | null

const CARDS = [
  {
    title: 'Unit cost and warranty',
    period: (s: string) => s,
    // ── PERF ROUND STEP 0: THE IDS SAY WHAT THEY TOTAL ────────────────────
    //
    // They were `pg-total-cost-hw` and `pg-total-price-hw`, and walk 11 D3
    // added the installation line to this card - so the totals stopped being
    // hardware and the names went on saying they were. Verification 19: a
    // name asserting a property nobody re-measured.
    //
    // `oneoff` is the calculator's own word for it. `oneOffPrice` in
    // `calculateContractTotals` is hardware plus installation, which is
    // exactly what this card now shows and totals.
    //
    // BOTH MOVE, not only the price. The ruling named the price id, and
    // renaming one of a pair while its twin keeps the wrong word is the
    // half-fix that reads as a decision.
    totalCostId: 'pg-total-cost-oneoff',
    totalPriceId: 'pg-total-price-oneoff',
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

// ── D3: WHAT THE INSTALLATION LINE IS, IN ITS OWN NOTE ──────────────────
//
// Every other row in this card carries a note saying where its cost comes
// from. Installation's differs by PATH, and saying so is what stops the line
// reading as a fifth hardware item: on a lump sum it is one quoted price, on
// per-unit it is four lines priced in the section above, and on neither there
// is no installation at all.
//
// DERIVED from `installResp`, the same string `buildDealInputs` branches on,
// rather than from a flag beside it. `deal-inputs.js` records a separately
// stored boolean here that never matched the real picklist and was always
// false, which is what a second reader of this string costs.
function installNote(payload: Record<string, unknown>): string {
  const resp = String(payload.installResp ?? '')
  if (resp.includes('Lump Sum')) {
    return `lump sum, $${money(numericOrDefault(payload, 'lumpSumCost'))} quoted`
  }
  if (resp.includes('Per Unit')) return 'four per-unit lines, priced in Installation above'
  return 'no installation on this deal'
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
        // D3: the installation line joins THIS card, so the card's own total
        // has to total it too. A card whose rows do not add up to its total
        // is the reconciliation Verification 21 calls no reconciliation.
        const isHardware = card.group === 'hardwareGroup'
        const isLumpSum = String(payload.installResp ?? '').includes('Lump Sum')
        const ig = isHardware ? result?.groups?.installGroup : undefined
        const plus = (n: number | undefined, add: number | undefined) =>
          n === undefined ? undefined : n + (add ?? 0)
        const totalCost = plus(group?.rawTotalCost, ig?.rawTotalCost)
        const totalPrice = plus(group?.rawTotalPrice, ig?.rawTotalPrice)
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
            {/* ── WALK 11 D3: INSTALLATION IS A LINE HERE ────────────────
                One derivation, all readers (R-N1). The figures are
                `installGroup`'s own totals, the same object the summary
                matrix, the Deal Sheet's one-off price row and the cash flow
                read through `calculateContractTotals`. Nothing is recomputed.

                THE MARGIN CELL IS A BOX ON ONE PATH AND A READOUT ON THE
                OTHER, and that asymmetry is the point rather than an
                oversight:

                - LUMP SUM is one line, `inLump`, and nothing else on the
                  screen controls it. A box here is the only control it has
                  ever had.
                - PER UNIT is four lines, each with its own margin box in the
                  Installation section above. A single box here would write
                  four keys and then disagree with them the moment one was
                  edited: two writers of one value, which is what R-N1 and
                  Verification 20 forbid. So it READS the group's own margin,
                  derived from the cost and price already shown, and the
                  existing signpost points at the four controls.

                The readout is derived the way the hosting card's total is,
                from the group's own two figures, so it cannot disagree with
                the price beside it. */}
            {isHardware ? (() => {
              // `ig` IS THE CARD'S, NOT A SECOND ONE. This block declared its
              // own `const ig` reading the same group, and a calibration
              // injection aimed at the card's copy came back SILENT because
              // the row was reading the other one. Two readers of one value,
              // eight lines apart, in code written the same hour: Verification
              // 20, found by the injection rather than by reading it.
              const id = 'deal-margin-inLump'
              const raw = values[id] ?? ''
              const over = toNumberOrNull(raw)
              return (
                <div className="pg-row" key="inGroup">
                  <div>
                    <div className="pg-item-name">Installation</div>
                    <div className="pg-item-note" id="pg-note-inGroup"
                      data-testid="pg-note-inGroup">{installNote(payload)}</div>
                  </div>
                  <div className="pg-cost" id="pg-cost-inGroup"
                    data-testid="pg-cost-inGroup">{fig(ig?.rawTotalCost)}</div>
                  {isLumpSum ? (
                    <input type="text" id={id} data-testid={id} data-contract="numOrUndefined"
                      className={`pg-margin-input${over !== null ? ' pg-margin-override' : ''}`}
                      placeholder={String(target)} value={raw}
                      title={over === null
                        ? `Blank prices the lump sum at the target margin, ${target}%.`
                        : `Priced at ${over}% against a target of ${target}%.`}
                      onChange={(e) => onMargin(id, e.target.value)} />
                  ) : (
                    <div className="pg-price pg-margin-readout" id="pg-margin-inGroup"
                      data-testid="pg-margin-inGroup"
                      title="Each installation line carries its own margin in the Installation section above.">
                      {ig && ig.rawTotalPrice > 0
                        ? `${((1 - ig.rawTotalCost / ig.rawTotalPrice) * 100).toFixed(1)}%`
                        : '--'}
                    </div>
                  )}
                  <div className="pg-price" id="pg-price-inGroup"
                    data-testid="pg-price-inGroup">{fig(ig?.rawTotalPrice)}</div>
                </div>
              )
            })() : null}
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
                data-testid={card.totalCostId}>{fig(totalCost)}</div>
              <div />
              <div className="pg-price" id={card.totalPriceId}
                data-testid={card.totalPriceId}>{fig(totalPrice)}</div>
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
  hostingPriceMode, onHostingPriceMode, statement, seam, saved,
}: {
  /** C1: the read-only statement. Null while the deal has not computed. */
  statement: Statement | null
  /** C2: the form's own store. Absent leaves the statement read-only. */
  seam?: EditSeam
  /** C2: the values as the RECORD holds them, for Escape to revert to. */
  saved?: Record<string, string | undefined>
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

      {/* ── THE STATEMENT IS FULL WIDTH, ABOVE THE ROW ───────────────────
          It was inside `.deal-summary-col`, which is HALF the width once the
          detail disclosure is open. Measured there: the column is 628px, and
          18 + four 118px money columns + five 10px gaps leaves 88px for the
          label - so "One-off price, hardware and warranty" set one word per
          line and the sheet was unreadable at the exact moment somebody has
          the pricing cards open beside it.
          Found by opening the screenshot. Every assertion passed on it: the
          headers sat over their columns to the pixel, the strip agreed with
          the sheet, the drawers opened. None of them is about whether a label
          is legible, which is Verification 4's whole point. */}
      {statement ? <DealStatement statement={statement} seam={seam} saved={saved} /> : null}

      {/* B2: `detail-open` goes on the ROW. The row has to become two columns,
          and hiding the panel alone leaves a one-column grid with a gap. */}
      <div className={`deal-summary-row${open ? ' detail-open' : ''}`} id="deal-summary-row">
        <div className="deal-summary-col">
          <p className="label">Deal Sheet (USD) &middot; <span id="deal-sheet-units"
            data-testid="deal-sheet-units">{result?.hardware?.totalUnits ?? 0}</span> units</p>
          {/* ── C1: THE STATEMENT TAKES THE SUMMARY'S POSITION ────────────
              Option C, read-only. It renders from `buildDealStatement`, which
              reads the same expressions `buildDealRows` does, so the two
              cannot disagree - and a test asserts them EQUAL figure by figure
              rather than trusting the sentence.

              THE MATRIX IS NOT RETIRED, AND THAT IS DELIBERATE. Retiring it
              would retire its CONTRACT: eleven assertions in
              deal-panel.test.tsx are about the matrix's own presentation -
              full-width rows, memo rows, group cells - and the statement has
              no such concepts to re-point them onto. That is a decision about
              what the deal sheet IS, and it belongs to C2, after John has a
              verdict on this page. It sits in a CLOSED disclosure underneath,
              so the default view is the statement alone. */}
          <details className="stmt-legacy" data-testid="stmt-legacy">
            <summary>The existing deal sheet</summary>
            <div className="deal-panel" id="deal-panel">{matrix}</div>
          </details>
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

