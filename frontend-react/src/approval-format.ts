// ── FORMATTING ONLY. NO ARITHMETIC. ──────────────────────────────────────
//
// Brief Phase 2 point 1: nothing is computed client-side, and any arithmetic
// beyond formatting is a defect. The line between the two is drawn here and it
// is narrow on purpose:
//
//   ALLOWED   toLocaleString, toFixed, sign of a number the server computed,
//             Math.abs to split a sign from its magnitude for display,
//             slice(0, 10) on an ISO date, a label lookup.
//   FORBIDDEN adding, subtracting, comparing two figures to derive a third,
//             or deciding a state the server has already decided.
//
// Math.abs is the only one that looks like arithmetic. It is not: the server
// sends -4200 and the page prints "-$4,200", so the sign and the magnitude are
// two display pieces of one server-computed number. Nothing here produces a
// value the server did not send.

export const money = (n: number | null | undefined): string =>
  (n == null ? '--' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }))

export const pts = (n: number): string => `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)} pts`

const KEY_LABELS: Record<string, string> = {
  ssExisting: 'SafeSight, existing infrastructure', ssNew: 'SafeSight, new infrastructure',
  aqm: 'Air Quality units', hemir: 'HEMIR units', duration: 'Contract duration',
  recoveryMonths: 'Recovery months', invoicing: 'Invoicing', structure: 'Payment structure',
  milestones: 'Milestones', targetMargin: 'Target margin', marginOverrides: 'Per-line margins',
  installResp: 'Installation responsibility', lumpSumCost: 'Lump sum cost',
  warrantyPct: 'Warranty %', whtPct: 'Withholding tax %', gstPct: 'GST %',
  grossUp: 'Gross up', fxContingency: 'FX contingency', factoring: 'PO factoring',
  contractorMilestones: 'Contractor milestones', factoringRatePct: 'Factoring rate',
  ssUnitCost: 'SafeSight unit cost', aqUnitCost: 'Air Quality unit cost',
  hemirUnitCost: 'HEMIR unit cost', hoSafesight: 'SafeSight hosting', hoAqm: 'Air Quality hosting',
  hoHemir: 'HEMIR hosting', inSsExisting: 'SafeSight install, existing', inSsNew: 'SafeSight install, new',
  inAqm: 'Air Quality install', inHemir: 'HEMIR install',
  // The per-line margin keys. Without these the "below target" rows read
  // "hwSs 22%", which names an internal key at an approver.
  hwSs: 'SafeSight hardware', hwAqm: 'Air Quality hardware', hwHemir: 'HEMIR hardware',
  hwWarranty: 'Warranty', inLump: 'Installation, lump sum', inSsEx: 'SafeSight install, existing',
  inNone: 'Installation', hoSs: 'SafeSight hosting',
}
export const label = (k: string): string => KEY_LABELS[k] ?? k

// Catalog product identifiers are database values. An approver reads
// "SafeSight", not "safesight".
const PRODUCT_LABELS: Record<string, string> = {
  safesight: 'SafeSight', air_quality: 'Air Quality', hemir: 'HEMIR',
}
export const productLabel = (k: string): string => PRODUCT_LABELS[k] ?? k

export function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'not set'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ISO date to its date part. `String(x ?? '').slice(0, 10)` in the vanilla, and
// the empty-string fallback matters: an absent date must not print "undefined".
export const isoDate = (v: unknown): string => String(v ?? '').slice(0, 10)

// A signed money figure split into its display pieces. The server decided the
// sign; this only chooses where to print it.
export const signedMoney = (n: number): string => `${n < 0 ? '-' : ''}$${money(Math.abs(n))}`
export const plusMoney = (n: number): string => `${n >= 0 ? '+' : '-'}$${money(Math.abs(n))}`

// The characters the vanilla emitted as HTML entities. React escapes text, so
// they are written as the code points they stood for and render identically.
export const NBSP = ' '
export const MIDDOT = '·'
export const ARROW = '→'
