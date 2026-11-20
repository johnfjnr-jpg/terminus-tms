// TERM_QUOTES goldens TQ-1 to TQ-3: FIXTURE PARAMS ONLY, never the live
// settings (John's GOLDENS ruling). This is docs/pricing-spec.md section
// 11.7's fixture, the one section 11.8 names: SafeSight priced from the live
// SEED ladder (500.00 at 120 months), the seed bands (0% from 1, 5% from 10,
// 10% from 50, 15% from 200), SafeSight's spec costs (8,000.00 hardware,
// 200.00 a month hosting). The values are copied from the spec, not read from
// the database, so a change to live settings cannot move a golden.
export const SEED_BANDS = Object.freeze([
  { from: 1, discountPct: '0' },
  { from: 10, discountPct: '5' },
  { from: 50, discountPct: '10' },
  { from: 200, discountPct: '15' },
])

export const SAFESIGHT_SEED_LADDER = Object.freeze({
  12: '2500.00', 24: '1500.00', 36: '1080.00', 48: '875.00', 60: '750.00',
  72: '665.00', 84: '605.00', 96: '560.00', 108: '525.00', 120: '500.00',
})

/** Section 11.7's fixture as buildParams would return it. */
export function tqParams(ladder120 = '500.00') {
  return {
    TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120],
    COMPARE_TERM: 36,
    PRICE_LADDER_BY_PRODUCT: { safesight: { ...SAFESIGHT_SEED_LADDER, 120: ladder120 } },
    VOLUME_BANDS_BY_PRODUCT: { safesight: SEED_BANDS },
    HW_UPFRONT_MARGIN: '20',
    MARGIN_FLOOR: '25',
    CURRENCY: 'USD',
    costs: { safesight: { hwCost: '8000.00', hostingMonthly: '200.00' } },
  }
}

/** TQ-1's inputs: SafeSight 60 units, 120 months, OPEX, no CPI, no deal
 *  adjustment, no factoring. The engine's own input shape (spec 14.2). */
export const TQ1_INPUTS = Object.freeze({ units: { safesight: 60 }, termMonths: 120, paymentStructure: 'opex' })
