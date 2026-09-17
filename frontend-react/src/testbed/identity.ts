// ── L9: THE SIX READ-ONLY IDENTITY ROWS ─────────────────────────────────
//
// Round A Phase 4.3, from the vanilla's `renderTbReference`
// (54001c5^:frontend/test-bed-detail.js:433-495), which R11 makes the
// authority. Six values the record carries and nobody edits here:
//   Terminus Reference (under the name) and Industry and Stage (at the end of
//   Terminus Details); Account (first in Customer Details); Date Created and
//   Age (first in Key Dates). They rendered nowhere in the React tree.
import { formatDate } from '../../../src/lib/format-dates.js'

/** What GET /api/test-beds/:id carries for the six, as captured. */
export interface IdentitySource {
  reference_code?: string | null
  status?: string | null
  created_at?: string | null
  industry?: { name?: string | null } | null
  account?: { name?: string | null } | null
}

export interface IdentityRows {
  reference: string
  industry: string
  stage: string
  account: string
  created: string
  age: string
}

/**
 * AGE, COMPUTED AT DISPLAY TIME, never stored: the vanilla's `daysAgo`,
 * ported rather than reinvented. Whole days since `created_at`, floored;
 * "Today" at zero, "1 day" at one, "N days" beyond. `now` is passed in so the
 * rule is testable at a boundary rather than at whatever the clock says.
 *
 * ONE DEPARTURE, stated: the vanilla printed "NaN days" for a missing or
 * unreadable date. This returns '' so the row reads as not recorded.
 */
export function ageFrom(createdAt: string | null | undefined, nowMs: number): string {
  if (!createdAt) return ''
  const t = new Date(createdAt).getTime()
  if (Number.isNaN(t)) return ''
  const days = Math.floor((nowMs - t) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

/**
 * The six values as displayed. DATE CREATED goes through the estate's one
 * shared formatter (DD/MM/YY), not the vanilla's own `toLocaleDateString`:
 * the date-format round deleted second implementations, and R11 is about the
 * capabilities document, not about re-opening that ruling.
 */
export function identityRows(bed: IdentitySource, nowMs: number): IdentityRows {
  return {
    reference: bed.reference_code ?? '',
    industry: bed.industry?.name ?? '',
    stage: bed.status ?? '',
    account: bed.account?.name ?? '',
    created: formatDate(bed.created_at ?? ''),
    age: ageFrom(bed.created_at, nowMs),
  }
}
