// ── R-OX2: THE OPEX TABLE ───────────────────────────────────────────────
//
// Rows SafeSight, AQ Sensor, HEMIR. Columns: # of Units, Monthly Fee, Margin %,
// Contract Total. "Monthly Fee" is the ruled heading: it is a CUSTOMER PRICE,
// not a cost, and the sheet's own drawers already say "cost" where they mean it.
//
// EVERY FIGURE COMES FROM `opexRows`, which is a caller of the deal's own
// derivation. This file lays out and edits; it computes nothing.
//
// R-OX4, the either-or: a typed Monthly Fee stores an absolute and the margin
// rederives; a typed Margin % stores a ratio and the fee rederives. Whichever
// is stored wears the effective-values treatment - bold, in the attention amber
// - and the other is left to the derivation.
//
// R-OX5: the units column writes the deal's OWN counts, the same store the
// Units Required card and the statement drawers edit. Not a copy.
import type { ReactNode } from 'react'
import { OPEX_FEE_KEYS } from '../../../src/lib/opex.js'
import { SizedInput } from './useFieldWidth'

export interface OpexRow {
  key: string
  label: string
  units: number
  monthlyFee: number | null
  marginPct: number | null
  contractTotal: number | null
}

/** The deal-wide count each row edits. SafeSight's is two boxes, so its units
 *  cell edits the EXISTING-infra count and the new-infra count stays where it
 *  is edited today. Stated rather than silent: a single box cannot own two
 *  numbers without deciding which one it moves. */
const COUNT_ID: Record<string, string> = {
  ss: 'deal-ssExisting', aq: 'deal-aqm', hemir: 'deal-hemir',
}

const money = (n: number | null) => (n === null || !Number.isFinite(n)
  ? 'not recorded'
  : `$${Math.round(n).toLocaleString('en-US')}`)
const fee = (n: number | null) => (n === null || !Number.isFinite(n)
  ? '' : String(Math.round(n * 100) / 100))
const pct = (n: number | null) => (n === null || !Number.isFinite(n)
  ? '' : String(Math.round(n * 10) / 10))

export function OpexTable({ rows, values, onValue }: {
  rows: OpexRow[]
  values: Record<string, string | undefined>
  onValue(id: string, v: string): void
}): ReactNode {
  const cell = (id: string, shown: string, stored: string) => {
    // THE SIGNAL IS THE ONE THE ESTATE ALREADY USES, and it needs something to
    // depart from: a box with no derivation behind it has nothing to override.
    const override = stored !== '' && shown !== ''
    return (
      <SizedInput type="text" data-testid={id} id={id} data-contract="numOrUndefined"
        className={`stmt-edit${override ? ' stmt-edit-override' : ''}`}
        data-override={override ? 'true' : 'false'}
        value={stored !== '' ? stored : shown}
        onChange={(e) => onValue(id, e.target.value)} />
    )
  }
  return (
    <table className="opex-table" id="deal-opex-table" data-testid="deal-opex-table">
      <thead>
        <tr>
          <th></th><th># of Units</th><th>Monthly Fee</th><th>Margin %</th><th>Contract Total</th>
        </tr>
      </thead>
      <tbody>
        {OPEX_FEE_KEYS.map((k) => {
          const r = rows.find((x) => x.key === k) ?? {
            key: k, label: k, units: 0, monthlyFee: null, marginPct: null, contractTotal: null,
          }
          return (
            <tr key={k}>
              <td>{r.label}</td>
              {/* ── R-OX5, AND THE ONE ROW IT CANNOT FULLY KEEP ──────────
                  AQ Sensor and HEMIR each have ONE stored count, so their cell
                  edits it directly and is the same store the Units Required
                  card and the statement drawers write.

                  SAFESIGHT HAS TWO - existing infra and new infra - and this
                  column has one box. It shows the row's TOTAL, because that is
                  what "# of Units" means here and what Contract Total is
                  computed on, and it is read-only rather than guessing which
                  of the two a typed number means. A box displaying 32 that set
                  the existing count to 32 would silently make the row 44.
                  Reported to John rather than decided quietly. */}
              <td>
                {k === 'ss' ? (
                  <span data-testid={`deal-opexunits-${k}`} className="opex-units-readonly"
                    title="SafeSight carries two counts, existing and new infrastructure. Edit them in Units required.">
                    {r.units}
                  </span>
                ) : (
                  <SizedInput type="text" data-testid={`deal-opexunits-${k}`} className="stmt-edit"
                    data-contract="numOrUndefined"
                    value={values[COUNT_ID[k]] ?? ''}
                    onChange={(e) => onValue(COUNT_ID[k], e.target.value)} />
                )}
              </td>
              <td>{cell(`deal-opexfee-${k}`, fee(r.monthlyFee), values[`deal-opexfee-${k}`] ?? '')}</td>
              <td>{cell(`deal-opexmargin-${k}`, pct(r.marginPct), values[`deal-opexmargin-${k}`] ?? '')}</td>
              <td data-testid={`deal-opextotal-${k}`}>{money(r.contractTotal)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
