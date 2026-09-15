// ── THE COST BREAKDOWN: ITS TYPE, AND THE FOUR CARDS' ROWS ───────────────
//
// L1. The breakdown has been COMPUTED on every keystroke since the migration
// and thrown away: `POST /api/test-beds/calculate` answers, `setPreview` holds
// it, and nothing ever read it again. `TestBedHost` typed it `unknown` twice.
// The container rendered two words.
//
// This file is the render half, and it is PURE - no DOM, no fetch - so the
// card contents are testable without a browser, the same split `headerStats.ts`
// takes.
//
// ── NOTHING HERE IS COMPUTED ─────────────────────────────────────────────
//
// Every figure is read straight off the engine's own output.
// `calculateTestBedCost` already returns `hardwareGroup.rawTotalCost`,
// `installGroup.rawTotalCost` and `hostingTermCost`, and its `totalCost` is the
// sum of exactly those three. Re-adding the itemized lines here would be a
// second computation path that agrees today and drifts later.
//
// ── *Cost ONLY, NEVER *Price ─────────────────────────────────────────────
//
// `buildCostGroup` computes `rawPrice` and `rawTotalPrice` as an unavoidable
// side effect of being shared unchanged with the PRICED Opportunity path. A
// Test Bed has no price or margin concept anywhere on this tab. The type below
// names the price fields because the wire carries them; nothing in this file
// reads one, and `cost-breakdown.test.ts` asserts that no rendered row does.
//
// ── NO WARRANTY ──────────────────────────────────────────────────────────
//
// Ruled by the business 2026-09-15: "warranty doesn't matter in a test bed,
// not a calculation required." The vanilla rendered a conditional warranty row.
// It is DROPPED rather than ported.
//
// The brief proposed porting it as a branch that can never fire, because
// `buildTestBedCostBreakdown` passes `warrantyPct: 0` and `warrantyUnits` is
// therefore always 0. The business's answer is stronger and better: the concept
// is irrelevant to a Test Bed rather than merely always-zero, and dead UI
// carrying a live-looking conditional is Architecture 9's fourth variant - the
// next reader finds the branch and reasons from it.
//
// THE DELETION IS BOUNDED TO WHAT IS RENDERED. `calculateHardwareAndWarranty`
// and the `hwWarranty` row the shared group still returns are untouched: that
// engine is shared with Opportunity and `warrantyPct: 0` is how a Test Bed
// neutralises warranty BY DATA rather than by a divergent code path. This round
// changes what is shown, not what is computed.
import { money } from './money'

export interface CostGroupRow {
  key: string
  rawCost: number
  /** Present on the wire, never read here. See the header. */
  rawPrice: number
}

export interface CostGroup {
  rows: CostGroupRow[]
  rawTotalCost: number
  /** Present on the wire, never read here. See the header. */
  rawTotalPrice: number
}

/**
 * `calculateTestBedCost`'s return, as `POST /api/test-beds/calculate` sends it
 * and as `GET /api/test-beds/:id` carries it on `costBreakdown`.
 *
 * Read from the source rather than guessed: `src/lib/deal-calculator.js:376`
 * and `src/routes/test-beds.js:24`.
 */
export interface TestBedCostBreakdown {
  hardware: {
    totalUnits: number
    hardwareCost: number
    /** Always 0 for a Test Bed, and never rendered. See the header. */
    warrantyUnits: number
    /** Always 0 for a Test Bed, and never rendered. See the header. */
    warrantyCost: number
    avgHwCost: number
  }
  groups: {
    hardwareGroup: CostGroup
    installGroup: CostGroup
    hostingGroup: CostGroup
  }
  hostingMonthCost: number
  hostingTermCost: number
  months: number
  totalCost: number
}

/**
 * How a row is weighted. The vanilla's FOUR helpers, as data, and the
 * summary/subtotal split is not cosmetic - it is recorded at the vanilla's own
 * site. `subtotal()` carries a border-top because it closes a list of itemized
 * rows and divides itself from them. `summaryRow()` does NOT, because in the
 * Cost summary card EVERY row is already a total and there is nothing to
 * divide it from.
 *
 * A first pass here collapsed the two, which would have drawn three rules
 * across a card whose own comment says it must not have them.
 */
export type RowWeight = 'item' | 'summary' | 'subtotal' | 'total'

export interface BreakdownRow {
  label: string
  value: number
  weight: RowWeight
}

export interface BreakdownCard {
  title: string
  testId: string
  rows: BreakdownRow[]
}

/**
 * A value is a breakdown when it carries the three things every card reads.
 * Narrows the `unknown` the preview arrives as, without trusting it.
 */
export function isBreakdown(v: unknown): v is TestBedCostBreakdown {
  if (typeof v !== 'object' || v === null) return false
  const b = v as Record<string, unknown>
  if (typeof b.totalCost !== 'number') return false
  const g = b.groups as Record<string, unknown> | undefined
  if (typeof g !== 'object' || g === null) return false
  return ['hardwareGroup', 'installGroup', 'hostingGroup']
    .every((k) => typeof (g[k] as CostGroup | undefined)?.rawTotalCost === 'number')
}

const rowCost = (group: CostGroup, key: string): number =>
  group.rows.find((r) => r.key === key)?.rawCost ?? 0

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The four cards.
 *
 * `input` is the DRAFT-OR-STORED reader, the vanilla's `tbEffectiveValue`. The
 * hardware labels quote their own inputs, so while a preview is showing they
 * must quote the DRAFT ones: otherwise a row reads `SafeSight (12 × $4,200)`
 * beside a figure computed from 14, which is a row that contradicts itself.
 *
 * TOTAL COST IS FIRST, and that is not the conventional read. Measured by the
 * vanilla at 1240 and 1920: total-LAST costs 185px because the three category
 * rows push it down, total-FIRST costs 45px, which is exactly the card's own
 * chrome. Total-last put the one figure this tab exists to produce below the
 * fold at both widths.
 */
export function breakdownCards(
  b: TestBedCostBreakdown,
  input: (key: string) => string,
): BreakdownCard[] {
  const g = b.groups
  const unit = (count: string, rate: string) => `${Number(count) || 0} × ${money(Number(rate) || 0)}`

  return [
    {
      title: 'Cost summary',
      testId: 'tb-cost-card-summary',
      rows: [
        // The one row that IS a sum of the rows beneath it, so it outweighs
        // them. Round 15 Phase 4 shipped this card with its totals in the
        // DIMMED treatment meant for itemized rows, which made the three
        // category figures the least prominent numbers on the tab - the
        // instance CLAUDE.md Verification 4 is written from.
        { label: 'Total Cost', value: b.totalCost, weight: 'total' },
        { label: 'Hardware', value: g.hardwareGroup.rawTotalCost, weight: 'summary' },
        { label: 'Installation', value: g.installGroup.rawTotalCost, weight: 'summary' },
        { label: `Hosting × ${plural(b.months, 'month')}`, value: b.hostingTermCost, weight: 'summary' },
      ],
    },
    {
      title: 'Hardware',
      testId: 'tb-cost-card-hardware',
      rows: [
        { label: `SafeSight (${unit(input('safesightCameras'), input('ssUnitCost'))})`, value: rowCost(g.hardwareGroup, 'hwSs'), weight: 'item' },
        { label: `Air Quality (${unit(input('airQualitySensors'), input('aqUnitCost'))})`, value: rowCost(g.hardwareGroup, 'hwAqm'), weight: 'item' },
        { label: `HEMIR (${unit(input('hemirSensors'), input('hemirUnitCost'))})`, value: rowCost(g.hardwareGroup, 'hwHemir'), weight: 'item' },
        { label: 'Hardware subtotal', value: g.hardwareGroup.rawTotalCost, weight: 'subtotal' },
      ],
    },
    {
      title: 'Installation',
      testId: 'tb-cost-card-install',
      rows: [
        { label: 'SafeSight', value: rowCost(g.installGroup, 'inSs'), weight: 'item' },
        { label: 'Air Quality', value: rowCost(g.installGroup, 'inAqm'), weight: 'item' },
        { label: 'HEMIR', value: rowCost(g.installGroup, 'inHemir'), weight: 'item' },
        { label: 'Installation subtotal', value: g.installGroup.rawTotalCost, weight: 'subtotal' },
      ],
    },
    {
      // Per MONTH, and the term line is deliberately NOT in this card: it is a
      // whole-engagement figure rather than a per-month rate like the three
      // above it, and it lives with Total Cost as the step between monthly and
      // total.
      title: 'Hosting (per month)',
      testId: 'tb-cost-card-hosting',
      rows: [
        { label: 'SafeSight', value: rowCost(g.hostingGroup, 'hoSs'), weight: 'item' },
        { label: 'Air Quality', value: rowCost(g.hostingGroup, 'hoAqm'), weight: 'item' },
        { label: 'HEMIR', value: rowCost(g.hostingGroup, 'hoHemir'), weight: 'item' },
        { label: 'Hosting subtotal / month', value: b.hostingMonthCost, weight: 'subtotal' },
      ],
    },
  ]
}
