import type { ReactNode } from 'react'
import { Fragment } from 'react'
import { money } from './rows'
import type { InstallVisibility } from './installation'

// ── SECTIONS 1 AND 2, MERGED: ONE PER-PRODUCT GRID ───────────────────────
//
// R-SZ2, John's ruling 2026-09-26, option A. The Units card and the
// Installation per-unit table were two lists of the SAME FOUR PRODUCTS IN THE
// SAME ORDER, sitting in two columns of a two-column grid, and their rows did
// not line up: measured at 64, 49, 33 and 34 pixels apart at 1920, 80/81/66/82
// at 1440 and 127/128/129/145 at 1240.
//
// THE OFFSETS CONVERGE, WHICH IS WHAT SETTLED THE SHAPE. A constant offset
// would have been a spacing fault, fixable above the rows. Converging offsets
// mean the ROW HEIGHTS differ - the install labels wrap at one width and not
// another, giving pitches of 68 against 53 at 1920 - so no amount of work on
// the preambles could have levelled row 2 onwards. Two lists can only stay
// level if they share row tracks, and sharing row tracks means being one grid.
//
// SO THEY ARE ONE GRID, ONE ROW PER PRODUCT, and the alignment is not a
// measurement that has to hold: a row IS a row. The head cells share one head
// track for the same reason.
//
// THE PRODUCT IS NAMED ONCE. Both lists carried the product name, which was
// two readers of one label (Verification 20) and is now one cell.
//
// `UNIT_FIELDS` and `INSTALL_ROWS` are gone as separate lists for the same
// reason: they enumerated one population twice and agreed by inspection.

export const INSTALL_RESPONSIBILITIES = [
  'Client Own Installation Team',
  'Terminus Contractor - Per Unit',
  'Terminus Contractor - Lump Sum',
  'Terminus - Reseller Installation',
]

/* ── THE ONE PRODUCT LIST ────────────────────────────────────────────────
   The rate keys are the census's own, per M8: `CATALOG_DISPLAYS` already says
   which rate each product reads. Both SafeSight rows read the SafeSight rate,
   because existing and new infrastructure differ in INSTALLATION, not in the
   unit itself.

   `key` is the installation group's key and is what `deal-margin-*` and the
   cost and price cells are named for, so the ids the estate already asserts
   are unchanged by the merge. */
const PRODUCTS = [
  { key: 'inSsEx', label: 'SafeSight, existing infra',
    unitsId: 'deal-ssExisting', rateId: 'deal-inSsExisting', unit: 'ssUnitCost', hosting: 'hoSafesight' },
  { key: 'inSsNew', label: 'SafeSight, new infra',
    unitsId: 'deal-ssNew', rateId: 'deal-inSsNew', unit: 'ssUnitCost', hosting: 'hoSafesight' },
  { key: 'inAqm', label: 'AQ Sensor, existing infra',
    unitsId: 'deal-aqm', rateId: 'deal-inAqm', unit: 'aqUnitCost', hosting: 'hoAqm' },
  { key: 'inHemir', label: 'HEMIR, existing infra',
    unitsId: 'deal-hemir', rateId: 'deal-inHemir', unit: 'hemirUnitCost', hosting: 'hoHemir' },
] as const

/** Two decimals, grouped, or an em dash when the catalog has no rate. A blank
    cell and a zero say different things and neither says "not in the catalog". */
const rate = (rates: Record<string, number> | undefined, key: string) => {
  const v = rates?.[key]
  return typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}

type IRow = { key: string, rawCost: number, rawPrice: number }
export type InstallGroup = { rows?: IRow[], rawTotalCost: number, rawTotalPrice: number } | undefined

export function IntakeSection({
  vis, group, payload, renderField, contractorGrid, installResp, onInstallResp, rates, censusFields,
}: {
  vis: InstallVisibility
  installResp: string
  onInstallResp(v: string): void
  group: InstallGroup
  payload: Record<string, unknown>
  renderField(id: string, bare?: boolean): ReactNode
  contractorGrid: ReactNode
  rates?: Record<string, number>
  censusFields: ReactNode
}) {
  const find = (k: string) => group?.rows?.find((r) => r.key === k)
  const fig = (n: number | undefined) => n === undefined ? '$0' : `$${money(n)}`
  /* ── THE INSTALL HALF IS HIDDEN, NOT ABSENT, AND THE CENSUS GUARDS SAID SO
     The first version rendered the half only when `vis.table`, which read as
     tidier and removed EIGHT CENSUS INPUTS from the document: the census
     control guard went 72 to 64 and M11's "factoring off removes exactly the
     two factoring inputs, and nothing else" went red. Both were right. The
     retired table carried `hidden` and kept its inputs, so a responsibility
     that is not Per Unit has never meant those fields do not exist.

     `display: none` on the cells rather than a shorter render, so the four
     visible cells of each row auto-place into the four-column template and
     the rows stay rows. */
  const half = vis.table
  const ins = 'ig-cell ig-num ig-install'

  return (
    <section className="deal-intake-col" id="deal-section-1">
      {/* ── THE RESPONSIBILITY BLOCK, ABOVE THE MERGED COLUMNS ────────────
          R-SZ2 relocates it. It was between the Installation title and the
          Installation table, so its height - which CHANGES with the viewport,
          because it wraps - was most of what pushed one list below the other.
          Above the grid it pushes both halves equally, which is to say it
          pushes neither relative to the other. */}
      <div className="form-grid" id="deal-intake-head">
        <div className="form-group">
          <label htmlFor="deal-installResp">Installation responsibility</label>
          <select id="deal-installResp" data-testid="deal-installResp" value={installResp}
            onChange={(e) => onInstallResp(e.target.value)}>
            {INSTALL_RESPONSIBILITIES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className={`form-group${vis.lumpCostGroup ? '' : ' hidden'}`} id="deal-lumpCost-group">
          {renderField('deal-lumpCost')}
          {/* WHERE THE FIGURE GOES, not just what it is: the lump sum is priced
              once here and read in three other places, and the sentence says
              so rather than leaving the reader to find out. */}
          <p className="data-row-label" id="deal-lump-summary" data-testid="deal-lump-summary">
            {`Lump sum cost $${money(payload.lumpSumCost ?? 0)}, priced at ${fig(group?.rawTotalPrice)}`
              + ', carried into the Deal Summary, Deal sheet and Cash flow.'}
          </p>
        </div>
        <div className={`form-group${vis.seeTable ? '' : ' hidden'}`} id="deal-install-seetable">
          <label>Contractor pricing</label>
          <p className="data-row-label">See table below.</p>
        </div>
        <div className={`form-group${vis.notApplicable ? '' : ' hidden'}`} id="deal-install-notapplicable">
          <label>Contractor Price</label>
          <p className="data-row-label">Not applicable.</p>
        </div>
      </div>

      {/* ── THE MERGED GRID ───────────────────────────────────────────────
          Every cell is a DIRECT CHILD, so a product's cells share one row
          track by construction rather than by agreement. `deal-install-table`
          is retired as an element and its id lives on here as the install
          half's own marker, because callers ask "are the per-unit rows
          showing?" and that is still a real question. */}
      <div className={`product-grid${half ? ' product-grid--full' : ''}`}
        id="deal-product-grid" data-testid="deal-product-grid"
        data-install-half={half ? 'true' : 'false'}>
        <div className="ig-head">Product</div>
        <div className="ig-head ig-num">Units</div>
        <div className="ig-head ig-num">Unit cost</div>
        <div className="ig-head ig-num">Hosting cost/mth</div>
        <div className="ig-head ig-num ig-install">Rate (USD, from Base Cost Data)</div>
        <div className="ig-head ig-num ig-install">Cost (USD)</div>
        <div className="ig-head ig-num ig-install">Margin %</div>
        <div className="ig-head ig-num ig-install">Price (USD)</div>

        {PRODUCTS.map((p) => {
          const row = find(p.key)
          return (
            <Fragment key={p.key}>
              <div className="ig-cell ig-product" data-testid={`ig-product-${p.key}`}>{p.label}</div>
              <div className="ig-cell ig-num" data-testid={`ig-units-${p.key}`}>
                {renderField(p.unitsId, true)}</div>
              <div className="ig-cell ig-num ig-catalog" data-testid={`${p.unitsId}-unitCost`}>
                {rate(rates, p.unit)}</div>
              <div className="ig-cell ig-num ig-catalog" data-testid={`${p.unitsId}-hostingCost`}>
                {rate(rates, p.hosting)}</div>
              <div className={ins} data-testid={`ig-rate-${p.key}`}>{renderField(p.rateId, true)}</div>
              <div className={`${ins} col-mono`} id={`deal-install-cost-${p.key}`}>
                {fig(row?.rawCost)}</div>
              <div className={ins}>{renderField(`deal-margin-${p.key}`, true)}</div>
              <div className={`${ins} col-mono`} id={`deal-install-price-${p.key}`}>
                {fig(row?.rawPrice)}</div>
            </Fragment>
          )
        })}

        {/* The total row belongs to the install half and goes with it. Its
            first four cells are the units half's columns, blank, so the row
            reads as a rule under the figures rather than as a product. */}
        <div className="ig-cell ig-total ig-install" /><div className="ig-cell ig-total ig-install" />
        <div className="ig-cell ig-total ig-install" /><div className="ig-cell ig-total ig-install" />
        <div className="ig-cell ig-total ig-install" />
        <div className="ig-cell ig-num ig-total ig-install col-mono" id="deal-install-total-cost"
          data-testid="deal-install-total-cost">{fig(group?.rawTotalCost)}</div>
        <div className="ig-cell ig-total ig-install" />
        <div className="ig-cell ig-num ig-total ig-install col-mono" id="deal-install-total-price"
          data-testid="deal-install-total-price">{fig(group?.rawTotalPrice)}</div>
      </div>

      <p className="field-note" data-testid="unit-cards-basis">
        Unit and hosting costs are catalog values, read-only here and priced from the
        cost basis named in the Deal Summary.
      </p>

      <div className={vis.contractorGroup ? '' : 'hidden'} id="deal-contractor-group"
        data-testid="deal-contractor-group">
        {contractorGrid}
      </div>
      {censusFields}
    </section>
  )
}
