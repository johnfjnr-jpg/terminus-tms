# PRICING VERIFICATION STEP 1: GOLDEN DEALS. BRIEF

Branch `golden-deals` off `main` at `620b845`, confirmed equal to `origin/main`
by `ls-remote` before branching. Rule 18, build discipline 19 and
named-findings-only govern. Ends "ready for John's push".

**MEASUREMENT AND DOCUMENTATION ONLY. NO BEHAVIOUR CHANGES TO PRICING**, no UI
changes, no schema changes. If a deliverable appears to require one, that is a
STOP and a report, not an edit.

**Purpose.** John verifies the pricing engine by hand before v1.0. The
software's job here is to state its own rules in business English and to
compute four reference deals with the LIVE code, so every figure is
reproducible in Excel. Confirmed figures then become the committed acceptance
suite that guards pricing forever.

---

## PHASE 0: THE RULES, ENUMERATED FROM THE CODE

Read this session, in `src/lib/`, and listed here before anything is written
about them. Every rule below names the function and file that implements it.

### Pricing

| # | rule | implemented in |
|---|---|---|
| 1 | Price from cost by DIVISION: `price = cost / (1 - margin)`, rounded to whole units. Margin clamped to 0..99 | `priceFromCost`, deal-calculator.js:71 |
| 2 | A line may carry an absolute PRICE override instead of a margin; the margin then derives from that price | `buildCostGroup`, deal-calculator.js:161 |
| 3 | Only named keys may carry a price override; `hwWarranty` is deliberately absent | `PRICE_OVERRIDE_KEYS` / `priceOverrideFor`, deal-calculator.js:145 |
| 4 | Warranty COUNT is a percentage of SafeSight units only, rounded UP to a whole unit | `calculateHardwareAndWarranty`, deal-calculator.js:194 |
| 5 | Warranty VALUE is one SafeSight unit cost PLUS the existing-infrastructure install rate | same |
| 6 | The warranty carries NO margin: it reaches the customer at cost | `calculateDeal`, the hardcoded `marginPct: 0` |
| 7 | Contract net = hardware price + installation price + hosting price x months | `calculateContractTotals`, deal-calculator.js:243 |
| 8 | Rates resolve three ways, never two: overridden, catalog, or ABSENT | `resolveRates`, rate-resolution.js:71 |

### Structures and cash

| # | rule | implemented in |
|---|---|---|
| 9 | `single`: recovery spans the whole term | `buildCashFlowModel`, deal-calculator.js:344 |
| 10 | `twoPhase`: hardware price recovered evenly over the recovery period; absent recovery is null, not zero | same |
| 11 | `hybrid`: no recovery period at all; hardware arrives by milestone | same |
| 12 | A milestone's dollars DERIVE from its percentage of the one-off price | `milestoneUsd`, milestone-schedule.js:82 |
| 13 | Annual invoicing bills each 12-month block in its first month | `billed`, inside buildCashFlowModel |
| 14 | Factoring advances the COST principal in month 1 and repays on a schedule | buildCashFlowModel + `buildLoanSchedule`, deal-calculator.js:37 |
| 15 | Straight-line vs declining-balance repayment | `buildLoanSchedule` |
| 16 | An absent factoring term prices NOTHING: no schedule, no advance, `financeCost` null, `costIncomplete` true | buildCashFlowModel + calculateDeal |

### Tax and the bottom line

| # | rule | implemented in |
|---|---|---|
| 17 | Gross-up divides the invoice base up so the customer's deduction leaves contract net intact | `calculateTax`, deal-calculator.js:262 |
| 18 | WHT is BORNE by Terminus only when gross-up is off | same (`whtBorne`) |
| 19 | Total deal cost adds finance cost, borne WHT and the carried Test Bed cost on top of the priced groups | `calculateDeal` |
| 20 | Test Bed cost is a sunk cost added to COST only: it never touches contract net | `calculateDeal`, and its comment |

### OPEX

| # | rule | implemented in |
|---|---|---|
| 21 | OPEX states an all-in monthly fee per unit, covering hardware, warranty share, installation and hosting, amortised over the term | `opexRows`, opex.js |
| 22 | The OPEX margin shown is BLENDED, not any component's own | same |
| 23 | An OPEX target fee (or target margin) is met by an INVERSE allocation: every line's price is scaled so the type's contract total hits the target | `buildDealInputs`, deal-inputs.js:503 |
| 24 | The warranty is a FIXED component of that target and is not scaled | same |
| 25 | Under lump-sum installation the lump is allocated across types by the catalog's own per-unit install rates, falling back to unit count | `opexRows`, opex.js |

### Overrides

| # | rule | implemented in |
|---|---|---|
| 26 | R-REV: changing a fundamental input returns every ABSOLUTE override to the derivation. Margins are ratios and SURVIVE | `FUNDAMENTAL_VALUE_IDS`, payload.ts:72 |

---

## TWO OPEN JUDGEMENT CALLS, ALREADY CARRIED TO JOHN IN THE CODE

Phase 0's stop-rule is for a rule that is ambiguous or contradicts a ruling of
record. **Neither of these is either**: both are positions the code records as
taken and reversible, so they are documented as positions rather than as
settled rules, and surfaced again here.

1. **The OPEX lump-sum allocation** (rule 25). opex.js says in terms: "This is
   a position, reported to John rather than buried, and it is his to
   overturn."
2. **`lumpSumCost` is absent from R-REV** (rule 26). payload.ts calls it
   "the one judgement call in this list", because it is an absolute the
   derivation does not multiply by a quantity.

---

## ONE THING THE ENUMERATION CHANGED

The brief anticipated "the single-phase interpreter retained for old records".
**Measured, that understates it.** `effectiveStructure` returns `'single'` for
**every OPEX deal today** (payload.ts:126), so `single` is not only a legacy
reading: it is the live meaning of OPEX. R-PT3 removed the single-phase
*option* from the structure control and deliberately left the *value* in the
system. G1 is therefore a current shape, not a historical one.

---

## DELIVERABLES

1. **`PRICING_LOGIC.md`** at repo root, for a commercial reader who does not
   read code: every rule above in business English with a worked example, each
   citing its function and file, plus a SURPRISES section. Nothing described
   that the code does not do.
2. **`GOLDEN_DEALS.md`**: four deals computed by the LIVE engine, every input
   and every intermediate figure, enough for line-by-line Excel reproduction.
   G1 OPEX single-phase; G2 CAPEX two-phase; G3 hybrid with factoring and WHT;
   G4 CAPEX two-phase with an absolute price override and a margin override.
   Figures come from EXECUTING the engine. The run is scripted and committed.
3. **`scripts/golden-deals-check`**: runs the four deals and compares every
   figure against the committed expectations, exact match. Calibrated by
   perturbing one rate and watching it name the figure. **Until John confirms
   the figures the suite reports PROVISIONAL**, and the close-out says so.

Inputs are chosen round enough to check by hand but not so round that errors
cancel: no 0% margins, and no zero-unit lines except where a case needs one.

---

## THE PHASE 0 STOP, AND JOHN'S RULING. Appended 2026-09-28

Phase 0 stopped on a finding: the cash flow read contractor milestone dollars
from a `usd` field nothing writes and the route refuses, so the schedule reached
no arithmetic. Full measurement in `GOLDEN_DEALS_PHASE0_FINDING.md`.

**RULED BY JOHN: OPTION (a).** The contractor milestone cash flow derives
dollars from `pct` exactly as customer milestones do, and R-N1's sentence
becomes true. **Rule 12 is resolved in favour of the derivation.**

**ALL EXISTING RECORDS ARE TEST DATA**, so no census, no blast-radius report and
no migration. **The stored `pct` payloads are already the correct shape and are
not touched.**

Five additions to this brief, each launched by that ruling:

| | addition |
|---|---|
| A1 | **The fix.** `contractorMs` maps through `milestoneUsd(pct, lumpCost)` as `due` already does. **Red-first**: a MODEL-LEVEL test executes the staged branch through `buildCashFlowModel` with a payload shape the route accepts (`pct` only), asserts staged cash timing, FAILS on the current engine and passes after. **The first test in the estate to execute that branch, and its comment says so.** |
| A2 | **The sub-key census wires into the gate as a permanent stage**, now that `usd` is read nowhere and written nowhere. The route's 400 stays. |
| A3 | **`deal-render.test.tsx:125`'s false comment corrected** ("exercised at model level in Session C" - it was not). |
| A4 | **The pairwise property becomes a permanent assertion on G2**: contract net, one-off price and achieved margin SAME; only cash TIMING moves. |
| A5 | Then compute all four goldens **on the fixed engine**, write `PRICING_LOGIC.md` with the contractor staging rule stated plainly **and the month-1 default named for schedule-less lump sums**, build the PROVISIONAL harness, calibrate, close. G1 carries `structure: 'single'` per the Phase 0 correction. |

**AND IT LANDS IN THE DECISIONS DOC AS R-N1 EXTENDED:** every milestone reader,
customer and contractor, derives dollars from `pct` through the one function;
no stored dollar field on milestones.

Round mechanics unchanged: calibration both directions, live proof, close-out,
CURRENT_STATE, `ls-remote` equality at merge expecting `620b845`, both gates,
"ready for John's push".

---

## THE STOP RULE

Any red: STOP. Any pricing rule that turns out ambiguous or contradicted by a
ruling of record: STOP and report rather than document a guess. No behaviour
change to pricing for any reason.

Reports per M6.
