# TP_TABS close-out

Ready for John's push: `main` at the commit carrying this file, a fast-forward from `206a377`.

## 1. Not done

- **The push.** It is John's (rule 18). `git push` was not run.
- **`probe-screen.mjs --flow` was not run.** It needs `probe-live.mjs --hold`, which writes the live
  settings, and this round changes no live data. Its claims (the price at ANCHOR_MARGIN 80%, read-only
  settings for a non-admin) are re-pointed to the Pricing tab and unproven since.
- **The "live margins" sweep was not a second population.** John's account set SafeSight's live
  `ANCHOR_MARGIN` from 50 to 90 on 2026-10-10 at 12:51:53 UTC, after TP_CAPEX's close. So the live
  run measured the same margins as the spec run.
  - Read from the row: `updated_by` is `john@terminustechnologies.io`.
  - This session never holds that account. Its probes sign in as john+test, a non-admin the route
    refuses for writes.
  - `CURRENT_STATE.md` now records 90. TP_CAPEX's close-out said 50, which was true when written.
- **The settings draft surviving a switch of tab is untested.** Only an admin can type into the
  settings, and the probe account is not one. The draft is held in the view, like every other
  input, but no check has watched it survive.
- **Departures, measured and recorded:**
  - **The mockup** is five PNGs plus five zip exports, not the single HTML the brief and the addendum
    name. The exports are the text reference. Against the PNGs they agree on every word and figure
    (macOS Vision OCR, calibrated with a planted figure and a planted label), so the addendum's stop
    did not fire.
  - **The screen's 1240px cap is lifted to 1600px**, as Contact detail lifts it, because the
    mockup's two columns need the room. When the view is too narrow for both, the summary goes
    above the work and Next below it, so the price is never off screen. This is decided by a
    container query on the view, not the viewport.
  - **Visual treatment.** C13 was not ruled. Position, as TP_CAPEX's C-13: content, order, labels
    and behaviour binding; type and colour are the estate's tokens. The Next buttons use the
    estate's outline primary, not the mockup's filled green.
  - **Section notes.** Under CAPEX the mockup drops some section notes. The screen keeps the notes
    where they apply in both bases, and follows the mockup's CAPEX-only lines ("Applies to the
    subscription only.").

## 2. The rulings, against what is built

| ruling | built |
|---|---|
| T-1 | Three tabs. A header strip on every tab shows Base TCV and Payment basis. A finished tab shows a tick; Quote is never ticked. Next ends Pricing and Payment terms; Quote has none (C6). Every input lives in the view, so it survives a switch of tab |
| T-2, N1, N2, N3, N7 | **Pricing:** the units strip; the ladder with all six columns, where a row is chosen by click, Enter or Space; the breakdown with no List fee column; the price card with the floor status. Settings at the bottom, collapsed, admin edits and everyone reads. Margins shown to everyone |
| T-3, C3 to C11 | **Payment terms**, in the order ruled. CAPEX sections are absent from the DOM under OPEX. "Payment basis"; Monthly instalments / Milestones; Spread over 6, 12, 18, 24, 36 (picks above the term disabled) plus a months field; the subscription and its formula; the breakdown is the Base schedule (C4) with milestone names; WHT None / Single rate / Split, with Gross up whenever it is not None. "What the client pays" and the readiness card. Defaults unchanged (C9, C10) |
| T-4, C5 | `capexAllocation` beside `priceQuote`. Amounts show on the first keystroke of a share. Allocated, Still to allocate and Not yet scheduled rows, in amber; the breakdown ties to Base TCV to the cent; the quote is NOT READY, with Next and the Quote tab blocked and the reason given. Over 100%, the refusal names the excess in the engine's words |
| T-5, N4 to N6, N8 | **Quote:** tiles; a four-column schedule at the standard size (three under OPEX), with Show tax detail adding today's columns. The fitted size applies to the detail view only, which takes the full width. Profit card: Product, Base TCV, Gross profit, Margin; the deal's gross profit; WHT borne and gross profit after WHT with its margin; the CPI uplift. The D4 treatment title is the schedule's subtitle |
| T-6 | Final TCV and the deal-value tag appear on Quote only, and only with a CPI. The old price card and Deal value card are retired |
| T-7 | Every v1.6 golden unchanged (engine suite); `npm run goldens` reads `PASS: 9 checks, 4734 figures exact.` Commercials untouched. "One payment-terms pattern for TMS" is queued in `DESIGN_PRINCIPLES.md` |
| C1, C2 | Spec v1.7: per-band Base TCV, cost, gross profit and margin from the engine; the ladder shows every column whatever the basis. C-10's text is struck, left visible |
| N10 | The Rules card is retired. The Split WHT sentence shows under Tax when Split is chosen |
| label-contrast P1 | Fixed. TP_CAPEX had broken it at `0fe1a18`. The fixed check passes (2.94:1), and HEAD's version, run on the same screen, dies on the missing select |
| photograph scripts | The four are retired. Their outputs stay as the record |

## 3. EXIT, point by point

| point | evidence |
|---|---|
| spec v1.7 first | `dcd47ce`. T4-G1 and B-1 to B-6 were checked against the rules as written; none disagreed |
| tests fail first | 11 of 115 red against the v1.6 engine, every one a v1.7 claim, then 115 of 115 green. The breakdown Total row: 0 of 1 red, then 116 of 116 |
| engine calibration | 80 of 80 behaved (X1 to X14 FIRED on their named tests). Reverted 121 of 121; files byte-identical |
| probes from the click (`--spec`) | `--tabs` 134 (the five mockup states, labels and figures from the HTML, cited by line; every tab under OPEX and CAPEX; a 3440 capture), default 38, `--tp2` 29, `--pc` 10, `--capex` 57 |
| view calibration | 20 of 20 FIRED (W1 to W4 re-pointed, T1 to T16 new). Reverted runs all pass; view and bundle byte-identical |
| overlap sweep | 1240 to 1920 step 40, every tab and state: **5832 of 5832** (spec margins; the live run is the same population, section 1); deal form 162 of 162. Injections: 8 of 9 FIRED; `floor-8` silent and explained (no state needs a size under 13px) |
| full gate | all 26 stages passed on `f117142` (pure 834/834, database 105/105, react 1457/1457). A first run was UNANSWERED (no browser path) and was not counted |
| merge --no-ff | `3e29f69`; tree identical to the gated branch |
| merged gate | all 26 stages passed on `3e29f69`, after the watched server restarted from the merge (21:20:51) and answered 200 |
| ls-remote | `origin/main` is still `206a377`, an ancestor: a fast-forward |
| revert rehearsal | in a temporary index, reversing the merge gives exactly `206a377`'s tree. `git revert -m 1 3e29f69` when wanted |

Live data was not changed. `CURRENT_STATE.md` was regenerated on a clean tree at `84c6fdc`. Its
diff:
- the bundle;
- tag distances;
- fixture counts;
- the settings row above.

Live records are unchanged at 134. No schema change.

**Commits, counted against the phases:**

| commit | what |
|---|---|
| `3c8f4bf` | brief and mockup images |
| `b77ad04` | Phase 0 report |
| `149b4c6` | the HTML exports |
| `1659976` | rulings and addendum appended |
| `dcd47ce` | spec v1.7 |
| `535c314`, `6ca5a8d` | engine and tests |
| `2e4d777` | engine calibration |
| `1a8d3b5` | view |
| `6e4979c` | probes |
| `23d6649` | view calibration and re-points |
| `84c6fdc` | sweep and its fixes |
| `f117142` | `CURRENT_STATE.md` |
| `3e29f69` | merge |

This close-out is markdown only and rides the green merged gate (rule 48a).

## 4. What surprised

1. **Screenshots found two defects after every check had passed.**
   - At 1240, the first two-column layout pushed the approved price 1,300px down the page.
   - The tax-detail schedule stacked but kept the two-column track, stopping 380px short.
   - Each now has a check that fires without its fix.
2. **The sweep's first run: 1,316 failures, and all 684 overprints were one hidden "(done)".** It was a
   visually-hidden span under a tick. The section-stacking rule then lost on source order, which
   was measured in the browser rather than guessed.
3. **Three sweep injections came back silent, and each named a real gap.**
   - Two were aimed at the single page's geometry.
   - The third showed the sweep had never reached a disabled start-year select at all.
4. **A probe died with no verdict, and the harness stopped instead of scoring it.** An injection
   removed state that a later step depended on. Probes now report a thrown run as a FAIL and still
   print their verdict.
