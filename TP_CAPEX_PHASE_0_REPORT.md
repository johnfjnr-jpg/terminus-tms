# TP_CAPEX Phase 0: report (nothing built)

Branch `tp-capex` off `origin/main` at `54ab35b` (ls-remote confirmed). First commit `6b382b4`: the
brief verbatim and John's mockup `prototypes/term-pricing-capex.html`; the pre-commit suites passed.
An identical second copy of the mockup sits untracked at the repo root (`term-pricing-capex.html`,
byte-identical by `cmp`). I have left it alone; delete it when you like.

## Not done

- **Nothing was built**, as Phase 0 requires. No spec, engine, view or test changes.
- **No figures were derived.** Section 3 lists current figures from the spec and tests only.
  Section 5 confirms the brief's two demo inputs from the screen and the catalog, because the brief
  asked me to.
- **Rulings needed: 14 items (Q1 to Q14), in section 6.** Five of them block the spec v1.6 commit:
  Q1, Q2, Q3, Q5 and Q9.

## 1. The Commercials milestone list, its readers, and a proposed shared module

**The list:** `frontend-react/src/deal/milestones.ts:40`, `CONTRACTOR_MILESTONES`. It holds the six
names in the brief's order: Contract start, Hardware delivered to site, Installation complete,
Commissioning, Go live, Final acceptance. Its comment cites the prototype's `projectMilestone`
picklist (`Terminus Ops.dc.html:5592`). It also records a queued idea, not built: John's R-W12
proposal to turn the list into a vocabulary table.

**Every reader.** I grepped `src`, `frontend`, `frontend-react/src`, `supabase` and `scripts` for the
names as strings and for both identifiers.

| reader | how |
|---|---|
| `frontend-react/src/deal/milestones.ts:56` `milestoneOptions` | builds the dropdown; keeps an unrecognised stored label as its own option |
| `frontend-react/src/deal/DealPanel.tsx:564` | contractor grid, via `milestoneOptions` |
| `frontend-react/src/deal/DealPanel.tsx:673` | customer (hybrid) grid, via `milestoneOptions` |
| `frontend-react/src/__tests__/deal-surfaces.test.ts:167-180` | asserts length 6, first item, and the unknown-label option |
| `frontend-react/src/deal/panelParts.tsx:119, 158` | prose only; comments naming the list |

**Nothing on the server reads the names.**
- `src/` contains none of them.
- `src/lib/deal-calculator.js` and `src/lib/milestone-schedule.js` read month and percentage only;
  a grep for `label` finds no milestone use.
- So the Commercials goldens cannot depend on the list's location. G1 to G5 unchanged will
  confirm this, as C-11 asks.

**Proposed shared module:**
- **`src/lib/milestone-vocabulary.js`**, with a `.d.ts`, exporting `MILESTONE_NAMES` (names only, frozen).
- `milestones.ts` keeps exporting `CONTRACTOR_MILESTONES` as a re-export, so none of its readers move.
- `TermPricingView.tsx` imports `src/lib/milestone-vocabulary.js` directly.
- **Not `src/lib/milestone-schedule.js`**, the obvious neighbour. That file holds Commercials
  pricing logic (`milestoneUsd`, `scheduleReconciliation`), which C-11 excludes.
- **Not `frontend-react/src/deal/milestones.ts`.** Importing it would pull in
  `milestone-schedule.js` and `numeric-payload.js`.

## 2. The current escalator rule, verbatim

Spec v1.5, section 7:

```
factor(k)   = 1                                     for k < S
factor(k)   = (1 + escalator_pct)^(k − S + 1)       for k ≥ S
fee_year(k) = round_half_up( fee_year(1) × factor(k), 2 )     per band, k = 1 … ceil(T/12)
TCV (net)   = Σ months ( fee for that month's contract year )
```

> `S` is `escalator_start_year` (section 2), at least 2, default 2. With `S` = 2 this is the v1.2
> formula, `(1 + escalator_pct)^(k − 1)`, so T16 and T22 are unchanged. A 12-month term has no
> year 2, so the escalator has no effect on it; nor does it on any term whose last year is before
> `S`.

Section 2: "`escalator_start_year` ... At least 2; default 2. A year past the term's last year means
the escalator never applies within the term."

Section 6, CAPEX with an escalator (the rule C-5 replaces):

```
s                = (TCV − hardware_upfront) / (12 × Σ_{k=1..years} factor(k))
service_year(k)  = round_half_up( s × factor(k), 2 )
upfront          = TCV − Σ_k ( 12 × service_year(k) )          (carries any rounding residue)
```

**How the residue month escalates: the spec has no answer, because it has no residue month.**
- **OPEX:** every month is a band fee, rounded per band before multiplying by months, so no month
  carries a residue.
- **CAPEX:** the residue goes into the upfront payment, which never escalates.
- **What C-5 introduces:** a residue month T, and a subscription that is a single deal-level figure
  rather than a sum of band fees. Neither existing formula covers it. This is Q2.
- **What the mockup implies:**
  - State 4 is consistent with `round_half_up(base_fee × factor(k), 2)` each month, with month 60's
    own base (341,143.32) escalated by year 5's factor (383,959.81 shown).
  - The mockup notes that "the exact escalator rounding is set in spec v1.6; these figures may move
    by cents".
  - This is an observation about the mockup, not a derivation.

## 3. Existing tests and figures touching CAPEX, hardware upfront or the escalated TCV

These figures are copied from `scripts/tests/term-pricing.test.mjs` and the spec. I have not
derived any of them.

**T14 does not touch CAPEX.** It is T6 + T13 under OPEX (TCV 18,523,968.60), and nothing in C-1 to
C-13 reaches it. The brief listed it; I have recorded it as not affected.

**Spec section 11 cases (all SafeSight 120 unless stated; T30 is the demo deal on catalog costs):**

| test | inputs | current expected figures |
|---|---|---|
| T15 | T6 (120, 60) as `capex` | upfront 1,200,000.00 + 269,818.77 × 60 = 17,389,126.20; schedule `upfront 0-0 1,200,000.00`, `monthly 1-60 269,818.77` |
| T22 | T6 as `capex`, escalator 3% (S 2) | TCV 18,464,248.32 (= OPEX TCV); upfront 1,200,000.00; service by year 270,983.34 / 279,112.84 / 287,486.23 / 296,110.81 / 304,994.14 |
| T24 | T6 as `capex`, split WHT 5% hw / 10% SaaS, gross-up OFF | WHT on upfront 60,000.00, receives 1,140,000.00; per service invoice WHT 26,981.88, receives 242,836.89; total WHT borne 1,678,912.80 |
| T28 | T6 as `capex`, escalator 3% from year 3 | TCV 18,027,745.92; upfront 1,200,000.00; service by year 270,527.21 / 270,527.21 / 278,643.03 / 287,002.32 / 295,612.39 |
| T30 | demo deal on catalog costs, 60, `capex`, escalator 3% from year 2, WHT 10% borne | SafeSight 18,464,248.32, 87.0%; AQ 2,384,313.00, 86.6%; HEMIR 2,531,396.40, 89.7%; deal TCV 23,379,957.72; gross profit 20,399,957.72, 87.3%; upfront 1,550,000.04; service by year 342,647.69 / 352,927.12 / 363,514.94 / 374,420.39 / 385,653.00; WHT borne 2,337,995.72; after WHT 18,061,962.00, 77.3% |

**Spec section 11 cases the brief did not list, which C-1 or C-2 also reach.** Each prices on the
escalated TCV, and C-1 moves margin, approval and the profit table onto Base TCV:

| test | inputs | current expected figures |
|---|---|---|
| T16 | 1 unit, 60, escalator 3% | year fees 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 / 2,941.33; TCV 166,494.36; margin 88.0% |
| T27 | 1 unit, 60, escalator 3% from year 3 | TCV 162,558.36; margin 87.7% |

**Engine position tests in the same file:**

| test | inputs | current expected figures |
|---|---|---|
| flow `HW_UPFRONT_MARGIN 0` | T6 as `capex` | upfront 960,000.00; service 273,818.77 |
| A1 ladder | 120, `capex`, escalator 3% | each ladder row equals the CAPEX quote; the 60 row reads 1,200,000.00 and 270,983.34; vs 36 compares the service fee. **C-10 removes these columns** |
| B6 | T22 with S 2 | TCV 18,464,248.32 |
| B4 POSITION | `capex` split at one rate | equals the unsplit CAPEX quote |
| B4 POSITION | `opex` split 5 / 10, escalator 3% | hardware line 20,000.00 flat each year; service line = fee − hardware |
| B4 POSITION | 1 unit, 12, `HW_UPFRONT_MARGIN 99`, split | refused `NEGATIVE_SERVICE_LINE` |
| L1 split capture | 1 unit, 60, escalator 3% from year 3, split 5 / 10, gross-up ON, GST 9% | TCV 162,558.36; gross-up 17,477.04; GST 16,203.36; incl 196,238.76 |
| L1 foot | `opex` and `capex` × six WHT states × with and without escalator | TCV (net) + gross-up + GST = TCV incl. GST |
| v1.4 | demo deal, 12 / 36 / 60 / 120, `capex` and escalator states | products sum to the deal exactly |
| v1.4 | demo deal, escalator 3% | **a product TCV is the same under OPEX and CAPEX.** It holds for Base TCV, and does not hold for Final TCV once C-2 escalates the subscription only |
| v1.5 | per camera under `capex` | `null`. **C-10 flips this:** the OPEX per-camera column shows under CAPEX |

**Probe figures** (`scripts/term-pricing/probe-screen.mjs`, all from the click):
- **default:** T15 at 1240 and at 1920 (upfront 1,200,000.00, service 269,818.77, TCV
  17,389,126.20, a two-row schedule).
- **`--tp2`:**
  - T28: TCV 18,027,745.92, upfront 1,200,000.00, the service-by-year row.
  - T24: the upfront and service WHT rows, and WHT borne −1,678,912.80.
- **`--qp` CAPEX picture**, which is T30 plus:
  - GST 2,104,196.16 and TCV incl. GST 25,484,153.88;
  - the schedule's net / WHT / receives rows: 1,550,000.04 / 155,000.00 / 1,395,000.04, then
    each year;
  - the escalator note, which reads "under CAPEX the client pays hardware upfront and a monthly
    service fee instead".
- **`--pc`:** "no per-camera column under CAPEX". C-10 reverses this.

**Other scripts that drive CAPEX:**
- `calibrate.mjs`: injections J6 and others, anchored on the T15, T22 and T24 test names.
- `photograph-inputs.mjs`, `photograph-quote.mjs`, `photograph-tiles.mjs`.
- `probe-overlap.mjs`, whose sweep covers both structures.
- `prototypes/term-pricing/build-mockup.mjs`, an allowed engine importer that renders the old CAPEX
  ladder. It is not a gate stage, so an engine API change breaks it silently. I will re-point it or
  record it as retired.

## 4. WHT rates the probes use

| where | rates |
|---|---|
| split WHT, everywhere (T24, T25, B4 positions, L1 capture; `probe-screen --tp2` twice; `photograph-inputs`; `photograph-tiles`) | **hardware 5%, SaaS 10%** |
| single WHT (T20, T21, T30; `probe-screen` `--qp`; `photograph-quote`) | **10%** |
| GST typed by `probe-screen` | 0 (T25) and 9 (L1) |

On the demo deal's Hardware CAPEX (1,550,000.00), CAPEX equals the hardware value. So no payment
straddles the C-8 boundary unless the golden uses a Custom amount above 1,550,000.00 (see Q8).

## 5. The demo deal reproduces both brief figures

| figure | brief | measured | how |
|---|---|---|---|
| Base TCV | 22,018,611.00 | **22,018,611.00** | from the click: the Term Pricing screen with 120 SafeSight, 40 AQ, 2 HEMIR, OPEX, 60 months, and the spec's 90% margins injected into the browser's copy of the settings (the live `ANCHOR_MARGIN.safesight` read back as `"50"`) |
| hardware cost | 1,240,000.00 | **1,240,000.00** | Σ units × `HW_COST` over the live catalog, read through the route's own `resolveCurrentBatches` and `costsFromCatalog`: SafeSight 8,000.00, AQ 2,000.00, HEMIR 100,000.00 |

**Also measured, for later rulings, not as goldens:**
- the demo deal's monthly hosting cost is 29,000.00 (the C-9b comparison);
- live `HW_UPFRONT_MARGIN` is 20;
- today's screen shows a CAPEX upfront of 1,549,999.80 for this deal without an escalator. That is
  the v1.5 rule putting the residue in the upfront. Under C-4 the CAPEX amount becomes exactly
  1,550,000.00 and the residue moves to month 60.

## 6. Conflicts and open points (rulings needed)

### Blocking the spec v1.6 commit

**Q1. The OPEX side of C-1 and C-2.**
- Today an escalated OPEX quote's TCV, margin and per-product table are all on the escalated
  figures (T16 margin 88.0%, T27 87.7%, T30).
- C-1 moves margin, approval and the profit table to Base TCV under OPEX as well. So T16, T27 and
  the L1 capture are re-issued along with T22, T28 and T30, not only the four the brief names.
- Please confirm, and say whether T16 and T27 keep their escalated TCV as Final TCV.

**Q2. The escalation rule for the CAPEX subscription (section 2 above).** Neither existing formula
applies: section 7 is per band fee, and section 6's puts the residue into the upfront, which C-5
forbids. The rule needs stating, including whether month T's residue escalates by its own factor,
as the mockup shows.

**Q3. Which CPI mode today's escalator tests become.** T16, T22, T27, T28 and T30 have one
escalator. Under C-3 each must be Published CPI (Final TCV is a projection, deal value Base) or
Locked rate (Final TCV is the deal value).

**Q5. Taxes against Base or Final.**
- GST, the WHT gross-up and WHT borne are computed per invoice, so they follow Final (invoiced)
  amounts.
- Margin after WHT would then be Base profit minus WHT on Final invoices: a mixed basis.
- The L1 foot (TCV net + gross-up + GST = incl) needs to say which TCV it foots against.

**Q9. Split WHT under OPEX.**
- C-8 defines split WHT for CAPEX payments. It is silent on OPEX.
- Today OPEX split WHT is two lines: a hardware line of `round_half_up(hardware_upfront / T)` at the
  hardware rate, and the rest at SaaS (T25, two B4 positions).
- Does that stay, or does OPEX go all-SaaS because there is no CAPEX payment?

### Needed before the build, not blocking the spec

**Q4. R-TP1 is not in `CLAUDE.md`.**
- `CLAUDE.md` carries only Architecture 14 ("follows `docs/pricing-spec.md` exactly").
- R-TP1 lives in `TERM_PRICING_BRIEF.md` and `scripts/tests/term-pricing-isolation.test.mjs`.
- **Proposed:** the engine never sees milestone names. It validates structure only: shares, months,
  duplicates, count. The screen supplies the dropdown from the shared module.
  - The engine then still imports nothing, and R-TP1 part 1 needs no exception.
  - The amendment is recorded in the isolation test's header, and in `CLAUDE.md` Architecture 14 if
    you want it in that file.
- If you want the engine to refuse names outside the list, it must import the vocabulary. That is
  the exception you worded, and the test's import guard would gain one allowed specifier.

**Q6. Approval value under Locked rate.**
- C-1 and the mockup's rule 1 say Base TCV drives approval.
- The mockup's Deal value card is subtitled "Pipeline and approval value", and under Locked it
  becomes Final TCV.
- Which figure does the approval tag follow when CPI is locked?

**Q7. What the mockup does not show under CAPEX.**
- The mockup shows the price card, the CAPEX card, the tiles, a four-column schedule and the ladder.
- It does not show the GST and WHT tiles, the profit-by-product table, the settings panel, or the
  schedule's WHT / GST / receives columns. C-8 defines WHT for these invoices, and C-1 names the
  profit table.
- **Proposed:** every existing section the mockup omits stays as built. The schedule's four columns
  become the leading columns, with today's tax columns after them.
- If the four columns are meant to be the whole schedule, say so.

**Q8. A CAPEX payment that straddles the hardware value under split WHT** (Custom amount above
hardware). **Proposed:** that payment's invoice carries two lines (hardware up to the boundary, SaaS
above it), each rounded per spec 8.1.

**Q10. "Cash in year 1" is not defined in the brief.** G-C1 to G-C3 agree with "net invoices,
months 0 to 12, before GST and WHT", and I would write that into v1.6 unless you rule otherwise.

**Q11. The mockup's margin banner.** "Mockup figures use the spec's 90% anchor margins. The live
SafeSight setting is 50% ..." reads as a note about the mockup. **Proposed:** not built on the
screen.

**Q12. C-10's "remove the CAPEX per-camera columns": there are none in the code.** Spec section 13
recorded them as not shown. What C-10 changes in the build:
- The CAPEX ladder drops all of its current columns (Upfront, Monthly service fee (year 1), vs 36,
  TCV, margin) for Term and OPEX / cam / mo, per the mockup.
- Spec section 13's row closes.

**Q13. PO factoring in the spec.** Spec section 6 ends "PO factoring stays in the cash flow
(section 9)", and section 9 describes factoring. C-12 says factoring is not carried into term
pricing. v1.6 would strike both lines. Please confirm.

**Q14. Escalator start year default.**
- C-3 says each mode "takes a rate and a start year S (existing control)".
- **Proposed:** the existing select (default 2), shown for both Published and Locked, and hidden
  under None.

### No conflict found

- C-4's hardware figure matches spec section 6 at `HW_UPFRONT_MARGIN` 20%; v1.6 adds only the
  once-at-deal-level rounding.
- C-6's limits and refusals, C-7, C-9 and C-11 to C-13 do not conflict with the code.
- Goldens G-C1 to G-C4 are recorded as issued. I have not computed or checked them with any code.

STOP. Waiting for rulings Q1 to Q14 and the remaining goldens (CPI on G-C1, re-issued T15 / T22 /
T24 / T28 / T30 and, per Q1, T16 / T27 / L1, and the split-WHT golden).
