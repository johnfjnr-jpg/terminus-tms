# TP_MANUAL Phase 0 report

Branch `tp-manual` off `origin/main` at `943a938` (ls-remote confirmed). First commit `77422cb`: the brief verbatim and the mockup. Its hook suites passed: pure, react, typecheck and database.

**Mockup path departure.** The mockup was at `prototypes/term-pricing-manual-ladder.html`, not in the subdirectory the brief names. I moved it to the brief's path, byte-identical (sha1 `ad40467` before and after).

Nothing else is built. No spec, test or engine change.

## 1. The one-camera, first-band calculated fee: it exists

**Function:** `termLadder({ units: { safesight: 1 }, perCameraProduct: 'safesight' }, params)`. Each row's `perCameraCents` is the per-camera fee.

- This is T31's basis (spec 4.5) with one camera. It divides the SafeSight line's year-1 monthly by its units, rounded half-up to cents.
- With one camera, the only unit sits in band 1. So this is the first band's fee by construction.

**Measured, not inferred.** A scratch script ran on the brief's spec settings (anchor 90%, PROFIT_STEP 0, seed bands).

| term | 12 | 24 | 36 | 48 | 60 | 72 | 84 | 96 | 108 | 120 |
|---|---|---|---|---|---|---|---|---|---|---|
| `perCameraCents` | 8,666.67 | 5,333.33 | 4,222.22 | 3,216.67 | 2,613.33 | 2,211.11 | 1,923.81 | 1,708.33 | 1,540.74 | 1,406.67 |

- All ten equal MG-1's Calculated column.
- They also equal `unitEconomics(...).bands[0].feeCents` at all 10 of 10 terms.
- A second band set (first band at 7.5%) also agreed 10 of 10. So agreement does not depend on a 0% first band.

**Position:** `manualLadder` calls `termLadder` for Calculated. It does not call `unitEconomics` or a new formula (M-8).

## 2. Proposed signature and return shape

```js
manualLadder(input, params)
// input  = { product: 'safesight', prices: { 12: '2500.00', 24: '', ... } }
//          a price is a string; '' or missing is BLANK; commas are stripped by the view first
// returns {
//   product, anchorTerm, floor,                    // floor: MARGIN_FLOOR as a ratio
//   hwCostCents, hostingMonthlyCents, firstBandDiscountPct,   // for the card's note (derived, not typed)
//   rows: [{                                       // one per live TERMS entry, in order
//     termMonths,
//     calculatedCents,                             // termLadder's perCameraCents, one camera
//     status: 'blank' | 'invalid' | 'priced',
//     message,                                     // 'invalid' only: the field error
//     priceCents, totalCents, costCents, profitCents,   // 'priced' only, BigInt cents
//     difference,                                  // price / calculated - 1, exact ratio
//     vsAnchor,                                    // ratio | 'list' | null (anchor price blank or invalid)
//     margin,                                      // profit / total, exact ratio
//     flags: [ { kind: 'floor' } | { kind: 'total', against: T } | { kind: 'profit', against: T } ],
//   }],
//   summary: { priced, floor: { ok, terms }, total: { ok, terms }, profit: { ok, terms } },
// }
```

**The arithmetic, all exact fractions:**
- total = price × T;
- cost = HW_COST + HOSTING × T;
- profit = total − cost;
- margin = profit / total.

**The checks:**
- The floor check is `cmp(margin, floor) < 0`.
- A fall is strictly less than the previous non-blank priced row, so equal is not a fall (MG-1 at 108).
- Difference divides by `calculatedCents`, the figure on screen and the one Fill copies, so a filled row reads exactly 0.0%.
- A price must match `^\d+(\.\d{1,2})?$` and be above zero. Otherwise the row is `invalid`. An invalid row is treated as blank for every check and for vs 36.

## 3. Conflicts and gaps, each with the position I recommend

| # | where | the conflict | recommended position |
|---|---|---|---|
| C1 | M-8 vs the engine | M-8 fixes the signature as `manualLadder(prices, params)`, which leaves SafeSight to be hard-coded in the engine. The engine names no product: `termLadder` takes `perCameraProduct` from the screen for exactly this reason. | `manualLadder({ product, prices }, params)`. The view passes `'safesight'` (M-1). |
| C2 | MG-4 vs M-6 | At 120 = 300.00, profit 4,000.00 is below 108's 26,560.00, so M-6 also raises "Profit below 108 months". MG-4 names only the floor and the client total flags. | All three flags. **Please confirm**, and rule the order. I recommend the chips' order (floor, client total, profit), one flag per line in Check. |
| C3 | mockup chips vs "equal is not a fall" | "Client total rises with every longer term" is false when two totals are equal, which M-6 does not flag. "Above the 25% floor" is false at exactly 25%, which the exact comparison does not flag. The mockup has no wording for the profit chip when it passes, or for any chip when it fails. | OK states: "At or above the 25% floor at every priced term", "Client total never falls with a longer term", "Profit never falls with a longer term". Failures: "Below the 25% floor at 1 term (120)", "Client total falls at 1 term (120)", "Profit falls at 2 terms (84, 96)". The 25% is read from settings. **Your wording to rule** (as with 0.2 last round). |
| C4 | M-5 "vs 36" vs Architecture 14 | 36 is ANCHOR_TERM, a setting. | Follow ANCHOR_TERM, with the header "vs {anchor} months" as the ladder above has. It reads "vs 36" today. |
| C5 | M-2 vs how the view lives | Term Pricing is **not remounted** on navigation (`main.tsx` `register` re-renders one root, and the view is not keyed by `navToken`). Leaving and returning keeps all its state today: units, term, CAPEX, band drafts. | Hold the prices in the view (so tab switches keep them, as T-1) and reset them when `navToken` changes. Everything else keeps its current behaviour; changing it is not this round's. |
| C6 | two per-camera figures on one screen | The ladder's "SafeSight / cam / mo" uses the quote's units: 4,222.22 at 36 for 1 camera, and 3,902.04 for T31's 120. The card's "Calculated" is always one camera, first band. They agree only while units are 1. | Keep it as ruled. The card's note says "One SafeSight camera, first volume band (x%)", derived. Flagged so it is your decision rather than a surprise on the walk. |
| C7 | M-4 placement vs when the ladder renders | The ladder card is absent while the units are invalid or zero. The manual card needs no units. | Render the card whenever the settings price, in the ladder's place in the order. |
| C8 | mockup note's literals | "8,000 hardware + 200 a month hosting" and "(0%)" are typed figures. Architecture 9 says a hard-coded claim goes stale when the data changes. | Derive all three from `manualLadder`'s return. |
| C9 | M-7 field error | The brief gives no sentence for it. | "Enter a monthly price above 0, to the cent." shown under the input with `aria-invalid`, as the band editor shows its errors. Commas are accepted, as the CAPEX custom amount accepts them. |
| C10 | signs | The mockup prints negatives with U+2212 "−"; the brief's goldens use "-". | Follow the mockup and the ladder above it: "−71.2%" and "+127.3%". "-" (hyphen) only for an absent vs 36, as the ladder prints an absent per-camera fee. |
| C11 | empty card | The brief and mockup do not show the state with no prices. | Every term row with an empty input and Calculated filled, the other cells blank, and no chips until one price is entered. |

**No conflict found:**
- With the spec: Calculated reuses T31's path, and every existing figure stays unchanged.
- With R-TP1: a new pure export, no imports.
- With CLAUDE.md: no migration, no write, and no admin gate (M-3).

## 4. What this does not establish

- The MG figures have not been tested yet. Section 1 confirmed only the Calculated column. The other MG-1 columns, MG-2 to MG-4 and the summary are for the red-first tests after spec v1.9.
- The live settings were not read. Phase 0 used the spec's settings, as the goldens do.

STOP: waiting for your rulings on C1 to C3 and sign-off on the rest.
