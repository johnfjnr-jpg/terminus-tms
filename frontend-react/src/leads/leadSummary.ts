// ── THE LEAD'S SUMMARY LINE, IN ONE PLACE ───────────────────────────────
//
// V1, John's walk 3: the detail header gains the company, source and created
// date the LIST ROW already shows. Two surfaces rendering one summary is
// exactly the shape that drifts (Verification 20), and the list's version was
// already carrying three fallbacks and a separator nobody would reproduce the
// same way by hand.
//
// So the derivation moves here and both read it. The list keeps its own
// `accountName ?? company` precedence, because the resolved Account name is
// what a person recognises and the typed company is the fallback.
import { formatDate } from '../../../src/lib/format-dates.js'

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/**
 * `Company · Source · Created`, with `--` for each part that is absent.
 *
 * ABSENCE IS PER PART, not per line: a lead with a company and no source still
 * says what it knows. The line is never empty, so a surface can render it
 * without asking whether it will be blank.
 */
export function leadSummaryLine(input: {
  accountName?: string | null
  payload?: Record<string, unknown> | null
  createdAt?: string | null
}): string {
  const p = input.payload ?? {}
  return [
    input.accountName || str(p.company) || '--',
    str(p.source) || '--',
    formatDate(input.createdAt ?? '') || '--',
  ].join(' · ')
}
