# TP_MANUAL close-out

Ready for John's push: `main` at the commit carrying this file, a fast-forward from `943a938`.

## 1. Not done

- **The push.** It is John's (rule 18). `git push` was not run.
- **No walk yet.** The card has not been used by a person. Everything below is probes and tests.
- **Carried from TP_BANDS, still open:**
  - **The admin band save.** `VOLUME_BANDS_BY_PRODUCT` still carries its seed timestamp (`2026-10-12T02:35:08`), so no admin save has landed. This was TP_BANDS's walk step (ruling 0.1).
  - **The `20261012000002` ledger row.** The migration itself is applied: `CURRENT_STATE.md` reads 9 settings rows and no `VOLUME_BANDS`. Its ledger row is not readable from here (`supabase_migrations` is not exposed through PostgREST).
- **Two claims are owned by the engine, not the probe.**
  - "vs {ANCHOR_TERM} months" when the anchor is not 36: the probe runs at 36, so a hard-coded 36 cannot differ on screen.
  - Calculated at one camera when the quote's units are not 1: the probe's units are 1.

  Engine injections Z7 and Z1 own these two, and both fired.
- **No migration, no route, no setting.** None was in scope (PURPOSE). None was written.

## 2. The rulings, against what is built

| ruling | built |
|---|---|
| M-1 | SafeSight, one camera, first band, Base, no CPI. Cost = HW_COST + HOSTING x T from the live catalog |
| M-2, C5 | Prices are held in the view and stamped with the `navToken` they were typed in, so a tab switch keeps them and a return to the screen clears them. Nothing else on the screen changed behaviour; the units still survive a return |
| M-3 | No admin gate. Probed as john+test, a non-admin |
| M-4, C7 | The card sits below the term ladder in its column, above the breakdown, measured as a relationship. It renders whenever the settings price, with no units needed. Fill from calculated and Clear |
| M-5, C4, C6 | Term, Your price / mo, Calculated, 1 camera, Difference, vs {ANCHOR_TERM} months, Margin, Profit / camera, Client total, Check |
| M-6, C2 | Floor (exact), client total, profit, each against the previous PRICED row, in that order, one flag per line. Flagged rows in the one amber |
| M-6, C3 | Summary chips in the ruled wording. The floor figure is read from `MARGIN_FLOOR`; a test at 60% and 7.5% proves it is not 25 |
| M-7, C9 | Blank skips the row. Anything not above 0 with at most 2 decimals gets "Enter a monthly price above 0, to the cent.", `aria-invalid`, and is blank to the checks. Commas are ignored by the engine |
| M-8, C1 | `manualLadder({ product, prices }, params)` in the engine. Calculated is `termLadder` at one unit, not a new formula |
| M-9, C10 | Percentages to one decimal half-up, with "+" and U+2212. Money to cents |
| C8 | The note's hardware, hosting and first-band discount come from `manualLadder` |
| C11 | No chips until a price is entered. Every row shows Calculated, and nothing else |

## 3. EXIT, point by point

| point | evidence |
|---|---|
| preconditions | `ls-remote` read `943a938`. The brief and mockup are the first commit (`77422cb`) |
| Phase 0 | `c4cabff`, then stopped. Rulings appended verbatim at `ff0c86e` |
| spec v1.9 first | `295f455`: section 4.6 and 11.5, MG-4 as corrected by C2 |
| tests fail first | 13 new tests failed against the v1.8 engine (`manualLadder is not a function`) and 142 existing passed. Then 155/155; one more (the floor at 60% and 7.5%) makes 156 |
| engine calibration | Z1 to Z14 each FIRED on its named test, 118/118 behaved. Reverted 177/177, files byte-identical |
| goldens unchanged | `npm run goldens`: PASS 9 checks, 4734 figures exact. `probe-screen.mjs --spec`, every mode, gives the same counts as TP_BANDS (default 38, `--tabs` 134, `--tp2` 29, `--pc` 10, `--capex` 57). `probe-bands.mjs` ALL PASS in both modes |
| probes from the click | `probe-manual.mjs` ALL PASS, as a non-admin. It covers the empty state, MG-1 (every column, chips, amber rows, note), MG-2, MG-3, MG-4 (three flags measured on three lines), a refused price, Fill (every Difference 0.0%), Clear, tab switch keeps, return clears with units kept, and no write request. Captures at 1240, 1920 and 3440 opened and read |
| view calibration | M1 to M14 each FIRED. Reverted ALL PASS; view and bundle byte-identical |
| overlap sweep | 1240 to 1920 step 40: **6534 of 6534**. That is TP_BANDS's 6264 plus 270, which is 3 card states x 18 widths x 5 checks. Injections 3/3 FIRED on the card's states |
| label contrast | census 1328 text nodes; states ALL PASS |
| full gate | 26/26 on `3176e5c` (pure 885/885, database 105/105, react 1457/1457) |
| merge --no-ff | `4143db4`; tree identical to the gated branch |
| merged gate | `--round-close`, 26/26 on `4143db4`, after the watched server restarted from the merge (18:25:23) and answered 200 |
| ls-remote | `origin/main` is still `943a938`, an ancestor: a fast-forward |
| revert rehearsal | in a temporary index, reversing the merge gives exactly `943a938`'s tree. `git revert -m 1 4143db4` when wanted |

`CURRENT_STATE.md` was regenerated at `c6c20c6`. Its staleness check passes: an ancestor of HEAD, with 0 configuration sources changed since. Its diff has no TP_MANUAL change, as expected with no schema and no route. It does have:
- the settings table at 9 rows (John's apply of `20261012000002`);
- tag distances;
- fixture counts.

Live records are unchanged at 134.

**Commits, counted against the phases:**

| commit | what |
|---|---|
| `77422cb` | brief and mockup |
| `c4cabff` | Phase 0 report |
| `ff0c86e` | rulings appended |
| `295f455` | spec v1.9 |
| `9a0ca05` | engine and tests, red first |
| `1431312` | engine calibration |
| `dafe14f` | the card and its probe |
| `c6c20c6` | view calibration, sweep, decisions |
| `3176e5c` | `CURRENT_STATE.md` |
| `4143db4` | merge |

This close-out is markdown only and rides the green merged gate (rule 48a).

## 4. Departures from the mockup, each with its reason

- **The card sits in the main column, not across the page.** The ruling places it "in the ladder's place in the order" (C7). At 1240 its table needed the schedule's tighter cell padding to fit: 876px of table against 838px of card, measured.
- **The Check column wraps on narrow widths.** At 1240 a flag takes two lines rather than pushing the table past its card. The mockup shows one line.
- **A typed price is shown in money format when the field is left.** M-5 asks for money format, and the estate's numeric guard strips a typed comma (section 5). So a valid price is re-shown as the engine's cents, for example "2,500.00".
- **A zero Difference reads "0.0%", unsigned.** A sign would claim a direction. This extends C10; it is a position, and you can revisit it.
- **The note shows cents.** "8,000.00 hardware + 200.00 a month hosting", where the mockup has "8,000" and "200". The figures go through the screen's one money formatter.

## 5. What surprised

1. **A typed comma never reaches the field.** The estate's numeric guard (`app.js`, `NUMERIC_INPUT_SELECTOR`) strips every character but digits and the first point from any decimal input. The probe found it, typing "2,500.00" and reading "2500.00". So C9's "commas accepted" holds for values set as values (Fill, and the money format), and a typed comma is stripped rather than refused. This is recorded in `DESIGN_PRINCIPLES.md`. The guard is the estate's and was not changed.
2. **The probe found the 1240 overflow.** The Check column ran past the card. Two fixes landed in the same commit: the tighter padding and the wrapping Check cell.
3. **R-V7 refused the commit.** The `--attention` completeness guard read 33 bindings against 29 listed. The four new sites are now listed, and the two translucent ones (the warn chip's border and the flagged row's wash) are named, so the mix count cannot be met by a mix elsewhere.
4. **A consequence of C2 the brief did not print.** With 120 at 300.00, the profit chip reads "Profit falls at 3 terms (84, 96, 120)", because 120's profit falls too. It is tested and probed.
5. **The revert rehearsal's first attempt failed on its own tooling.** The patch lacked `--binary --full-index`, so the PNGs could not be reversed. It ran in a temporary index, so nothing was touched. It was rerun with both flags, and the tree matched.
