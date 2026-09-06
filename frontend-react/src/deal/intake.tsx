import type { ReactNode } from 'react'
import { money } from './rows'
import type { InstallVisibility } from './installation'
import { numericOrDefault } from '../../../src/lib/numeric-payload.js'

// ── SECTIONS 1 AND 2: UNITS REQUIRED AND INSTALLATION ────────────────────
//
// Built from the vanilla's structure and renderInstallationTab (:1383). The
// per-unit rows carry the RATE and MARGIN inputs inside the table, which is
// where the vanilla puts them: loose in the section they would have no column
// header to name them and no row to tie them to a product.

// UI STATE, not a census key: the responsibility drives which pricing branch
// the calculator takes and is not itself a priced value.
export const INSTALL_RESPONSIBILITIES = [
  'Client Own Installation Team',
  'Terminus Contractor - Per Unit',
  'Terminus Contractor - Lump Sum',
  'Terminus - Reseller Installation',
]

const UNIT_FIELDS = ['deal-ssExisting', 'deal-ssNew', 'deal-aqm', 'deal-hemir']

export function UnitCards({ renderField }: { renderField(id: string): ReactNode }) {
  return (
    <div className="unit-cards">
      {UNIT_FIELDS.map((id) => (
        <div className="unit-card" key={id}>{renderField(id)}</div>
      ))}
    </div>
  )
}

const INSTALL_ROWS = [
  { key: 'inSsEx', label: 'SafeSight, existing infra', units: 'ssExisting', rate: 'deal-inSsExisting' },
  { key: 'inSsNew', label: 'SafeSight, new infra', units: 'ssNew', rate: 'deal-inSsNew' },
  { key: 'inAqm', label: 'AQ Sensor, existing infra', units: 'aqm', rate: 'deal-inAqm' },
  { key: 'inHemir', label: 'HEMIR, existing infra', units: 'hemir', rate: 'deal-inHemir' },
]

type IRow = { key: string, rawCost: number, rawPrice: number }
export type InstallGroup = { rows?: IRow[], rawTotalCost: number, rawTotalPrice: number } | undefined

export function InstallationSection({
  vis, group, payload, renderField, contractorGrid, installResp, onInstallResp,
}: {
  vis: InstallVisibility
  installResp: string
  onInstallResp(v: string): void
  group: InstallGroup
  payload: Record<string, unknown>
  renderField(id: string, bare?: boolean): ReactNode
  contractorGrid: ReactNode
}) {
  const find = (k: string) => group?.rows?.find((r) => r.key === k)
  const fig = (n: number | undefined) => n === undefined ? '$0' : `$${money(n)}`
  return (
    <section className="deal-intake-col" id="deal-section-2">
      <p className="section-title">Installation</p>
      <div className="form-grid">
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

      <table className={`doc-table${vis.table ? '' : ' hidden'}`} id="deal-install-table"
        data-testid="deal-install-table">
        <thead>
          <tr>
            <th>Installation (per unit)</th><th>Units</th>
            <th>Rate (USD, from Base Cost Data)</th><th>Cost (USD)</th>
            <th>Margin %</th><th>Price (USD)</th>
          </tr>
        </thead>
        <tbody>
          {INSTALL_ROWS.map((r) => {
            const row = find(r.key)
            return (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="col-mono" id={`deal-install-units-${r.key}`}
                  data-testid={`deal-install-units-${r.key}`}>{numericOrDefault(payload, r.units)}</td>
                <td>{renderField(r.rate, true)}</td>
                <td className="col-mono" id={`deal-install-cost-${r.key}`}>{fig(row?.rawCost)}</td>
                <td>{renderField(`deal-margin-${r.key}`, true)}</td>
                <td className="col-mono" id={`deal-install-price-${r.key}`}>{fig(row?.rawPrice)}</td>
              </tr>
            )
          })}
          <tr>
            <td /><td /><td />
            <td className="col-mono" id="deal-install-total-cost"
              data-testid="deal-install-total-cost">{fig(group?.rawTotalCost)}</td>
            <td />
            <td className="col-mono" id="deal-install-total-price"
              data-testid="deal-install-total-price">{fig(group?.rawTotalPrice)}</td>
          </tr>
        </tbody>
      </table>

      <div className={vis.contractorGroup ? '' : 'hidden'} id="deal-contractor-group"
        data-testid="deal-contractor-group">
        {contractorGrid}
      </div>
    </section>
  )
}
