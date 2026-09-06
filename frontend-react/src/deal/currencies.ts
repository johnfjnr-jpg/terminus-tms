// ── THE CURRENCY LIST, AND WHY IT IS DUPLICATED ──────────────────────────
//
// `app.js` holds `const CURRENCY_CODES = [...]` at module scope. A `const` in a
// classic script does NOT reach `window`, so a bundle cannot read it - the same
// trap Round 2 recorded for `terminusStaffCache` and `accountsCache`. There is
// no accessor to add: the name is lexical and no separate script can see it.
//
// So this is a SECOND READER, which Verification 20 says always drifts. It is
// not asserted equal by a comment: `scripts/tests/currency-codes.test.mjs`
// extracts the array from app.js's source and PROVES the two agree, so a code
// added to one and not the other fails.
export const CURRENCY_CODES = ['USD', 'GBP', 'EUR', 'AED', 'SAR', 'SGD', 'AUD', 'CAD', 'JPY', 'INR']

/** The absence, first, because a currency nobody recorded is not USD. */
export const CURRENCY_OPTIONS: readonly { value: string, label: string }[] = [
  { value: '', label: 'Not recorded' },
  ...CURRENCY_CODES.map((c) => ({ value: c, label: c })),
]
