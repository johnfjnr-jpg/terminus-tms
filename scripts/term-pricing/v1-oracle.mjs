// ── TP_LADDER: THE FROZEN v1.10 ORACLE FOR THE MECHANICS GOLDENS ──────────
//
// John's ruling, Phase 1 (2026-11-17), recorded in TP_LADDER_BRIEF.md: the
// golden figures that move because the list fee moved are re-derived SPLIT.
// Price arithmetic comes from scripts/term-pricing/independent-price.mjs.
// Mechanics (CAPEX, WHT, CPI, factoring, cash flow) come from THIS: the v1.10
// engine exactly as it stood at e123cf6, read from git, with ONE behaviour
// swapped, the list fee is read from PRICE_LADDER_BY_PRODUCT instead of the
// section 4.1 formula, and the minimum around it so it accepts v2.0 params:
//
//   ANCHOR_TERM is read from COMPARE_TERM (it only ever set the comparison
//   once the formula is gone); PROFIT_STEP is 0 (read by nothing once the
//   formula is gone); the two margin presence checks go (likewise); the two
//   output names v2.0 renamed are renamed (savingVsAnchor, isAnchor).
//
// Every patch must match EXACTLY ONCE or the build refuses (an anchor that
// moved is how a patch silently does nothing). The mechanics code is not
// touched, which is the whole premise: v1.x's hand derivation is its proof,
// and figures from here are a REGRESSION SNAPSHOT on the new list fee, not
// hand-checked. UNWIRED: a derivation tool, run by derive-v2-goldens.mjs.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const ORACLE_COMMIT = 'e123cf654f3144398cf882b7801d699e1f087469'

const PATCHES = [
  [`  const anchorTerm = safeInt(params.ANCHOR_TERM, 'ANCHOR_TERM')`,
   `  const anchorTerm = safeInt(params.COMPARE_TERM, 'COMPARE_TERM')`],
  [`    profitStep: parseDecimal(params.PROFIT_STEP, 'PROFIT_STEP'),`,
   `    profitStep: ZERO,
    priceLadder: Object.fromEntries(Object.entries(params.PRICE_LADDER_BY_PRODUCT ?? {}).map(([k, l]) =>
      [k, Object.fromEntries(Object.entries(l).map(([t, v]) => [Number(t), parseDecimal(String(v).replace(/,/g, ''))]))])),`],
  [`  if (!am) throw new TermPricingError('NO_PARAM', \`No ANCHOR_MARGIN for \${product}\`)
  if (!sm) throw new TermPricingError('NO_PARAM', \`No SHORT_TERM_MARGIN for \${product}\`)
`, ``],
  [`const listFeeAt = (p, product, T) => div(priceAt(p, product, T), fromInt(T))`,
   `const listFeeAt = (p, product, T) => {
  const v = p.priceLadder?.[product]?.[T]
  if (!v) throw new TermPricingError('NO_PRICE_LADDER_PRICE', \`oracle: no price ladder price for \${product} at \${T}\`)
  return v
}`],
]

export function buildOracle(dir) {
  let src = execFileSync('git', ['show', `${ORACLE_COMMIT}:src/lib/term-pricing.js`], { encoding: 'utf8' })
  for (const [from, to] of PATCHES) {
    const n = src.split(from).length - 1
    if (n !== 1) throw new Error(`oracle patch matched ${n} times, not once: ${from.slice(0, 60)}`)
    src = src.replace(from, () => to)
  }
  src = src.replaceAll('savingVsAnchor', 'savingVsCompare').replaceAll('isAnchor', 'isCompare')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'term-pricing-v1-oracle.mjs')
  writeFileSync(path, src)
  return path
}
