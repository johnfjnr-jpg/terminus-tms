// ── ONE MONEY FORMATTER FOR THE TEST BED ─────────────────────────────────
//
// Q2, ruled 2026-09-15. The estate had THREE formatters agreeing on a format
// (`headerStats.ts`, `deal/rows.ts`, `approval-format.ts`) and the retired
// vanilla was a FOURTH that disagreed: `USD 4,200.00`, en-GB, two decimals.
//
// Restoring the cost breakdown puts its Total Cost on the same screen as the
// header strip's Total cost, and they are the same figure. Two formats for one
// number is Verification 20 arriving in the stylesheet, so this is the one
// definition and `headerStats.ts` imports it rather than keeping its own.
//
// en-US, no decimals, `$` prefix: the estate standard, not the vanilla's.
export function money(n: unknown): string {
  const v = Number(n)
  if (!Number.isFinite(v) || n === null || n === undefined || n === '') return '--'
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
