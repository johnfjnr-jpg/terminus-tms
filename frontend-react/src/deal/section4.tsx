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

type Row = { key: string, rawCost: number, rawPrice: number }
type Group = { rows?: Row[], rawTotalCost: number, rawTotalPrice: number }
export type PricingResult = {
  groups: { hardwareGroup: Group, hostingGroup: Group }
  hardware: { totalUnits: number, warrantyUnits: number }
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
      const { totalUnits, warrantyUnits } = result.hardware
      const pct = numericOrDefault(payload, 'warrantyPct')
      return `${pct}% of ${totalUnits} units = ${warrantyUnits} unit${warrantyUnits === 1 ? '' : 's'}`
    }
    case 'hoSs': return per(ssUnits, payload.hoSafesight)
    case 'hoAqm': return per(aqUnits, payload.hoAqm)
    case 'hoHemir': return per(hemirUnits, payload.hoHemir)
    default: return ''
  }
}

function PricingCards({ result, payload, values, onMargin }: {
  result: PricingResult
  payload: Record<string, unknown>
  values: Record<string, string | undefined>
  onMargin(id: string, v: string): void
}) {
  const target = numericOrDefault(payload, 'targetMargin')
  return (
    <div className="pg-cards">
      {CARDS.map((card) => {
        const group = result?.groups?.[card.group]
        const find = (k: string) => group?.rows?.find((r) => r.key === k)
        const fig = (n: number | undefined) => n === undefined ? '--' : card.period(`$${money(n)}`)
        return (
          <div className="pg-card" key={card.title}>
            <p className="pg-card-title">{card.title}</p>
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
            <div className="pg-row pg-total">
              <div className="pg-item-name">Total</div>
              <div className="pg-cost" id={card.totalCostId}
                data-testid={card.totalCostId}>{fig(group?.rawTotalCost)}</div>
              <div />
              <div className="pg-price" id={card.totalPriceId}
                data-testid={card.totalPriceId}>{fig(group?.rawTotalPrice)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DealSummarySection({ result, payload, values, onMargin, matrix, notices, install, basis }: {
  result: PricingResult
  payload: Record<string, unknown>
  values: Record<string, string | undefined>
  onMargin(id: string, v: string): void
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
          <PricingCards result={result} payload={payload} values={values} onMargin={onMargin} />
          <p className={`field-note${install.signpost ? '' : ' hidden'}`} id="deal-detail-signpost"
            data-testid="deal-detail-signpost">The four installation lines are priced in the Installation section above.</p>
        </aside>
      </div>
    </section>
  )
}
