# TP_CAPEX close-out

## 1. Not done

- **The push.** It is John's (rule 18): `git push` was never run.
- **One limit, reported rather than hidden.**
  - The CAPEX payment schedule has nine columns (the mockup's four, then the five tax columns, Q7).
    It is now fitted to its panel: padding first, then the figure font, which steps down to a 10px
    floor.
  - Every state the sweep covers fits at every width from 1240 to 1920.
  - A deal with figures large enough to need less than 10px at 1240 would still overflow, and the
    sweep would report it.
- **Positions taken where the rulings were silent.** Each is a one-line change if you want it
  otherwise:
  1. **CPI rate with no mode.** A non-zero CPI rate with no CPI mode is refused
     (`CPI_MODE_REQUIRED`) rather than defaulted, so an older caller cannot be priced as Published
     or Locked by accident.
  2. **Milestone shares.** A milestone share must be above 0% and at most 100%, with 1 to 5 rows
     and a milestone chosen on every row.
  3. **Negative last item.** A last instalment, milestone or subscription month that would be
     negative after rounding is refused (`NEGATIVE_LAST_ITEM`), the same as the OPEX split's
     negative service line. This is only reachable with degenerate amounts.
  4. **One line per rate.** Under split WHT an invoice carries at most one line per rate. A CAPEX
     payment above the hardware value and that month's subscription share one SaaS line.
  5. **Switching to Custom** fills the amount with the hardware value the first time, so Custom
     opens on a valid quote rather than a refusal.
  6. **The tiles.** C-13 names four CAPEX tiles. Mockup state 4 shows a CPI uplift tile in place of
     Cash in year 1. The screen shows all four, plus CPI uplift when a CPI applies, followed by the
     existing tax and margin tiles (Q7).
  7. **Labels.**
     - "Payment structure / OPEX monthly / CAPEX hardware upfront" now reads "Pricing basis / OPEX /
       CAPEX", the mockup's words. The old CAPEX label was no longer true.
     - The OPEX ladder's TCV column now reads "Base TCV" (C-1).
     - The CPI rate shows as typed ("+3%"), where the mockup prints "+3.0%".
  8. **Mockup text corrected by Q13.** The tax note says "Not carried over from Commercials:
     installation and annual invoicing". The mockup also listed PO factoring, which Q13 keeps.
- **Carried from earlier rounds:**
  - the PO factoring card and toggle at 1240;
  - the every-routed-screen overlap round;
  - the opportunity header at 1240;
  - the engine's "WHT on software as a service" message;
  - the duplicate rule-10 paragraph;
  - the TERM_PRICING items;
  - FB1 to FB3.

## 2. The rulings, against what is built

| ruling | built |
|---|---|
| C-1, Q1 | Base TCV (year-1 fees × T) carries margin, the floor, the profit table and approval, under OPEX and CAPEX |
| C-2, Q5 | Two schedules: Base (no CPI) feeds approval and margin after WHT; Final (with CPI) is invoiced, and holds GST, gross-up, WHT, TCV incl. GST and the schedule shown. The tax tie holds on each. With no CPI the two are one schedule |
| C-3, Q3, Q14 | CPI None / Published / Locked. Deal value is Final only under Locked. Rate and start year (default 2) are shown for Published and Locked and hidden under None |
| C-4 | CAPEX Hardware (hardware value rounded once at deal level) or Custom (kept exactly; more than 2 decimals is refused). Refused unless 0 < CAPEX < Base TCV |
| C-5, Q2 | Subscription: month T carries the rounding and escalates its own base. CAPEX never escalates. The old section 6 formula is struck and left visible |
| C-6, Q4 | Hybrid (default; up to 5 rows; milestones are opaque keys to the engine) and Two-phase (R 1 to T, default 12) |
| C-7 | Rounding goes on the last instalment, milestone and month |
| C-8, Q8, Q9 | Split WHT on CAPEX: hardware rate up to the hardware value in payment order, SaaS on the rest; a straddling payment becomes two lines. OPEX split is unchanged (hardware line = C-4 figure / T) |
| C-9 | Warnings, never refusals: "Terminus funds X of hardware"; subscription below monthly hosting |
| C-10, Q12 | Under CAPEX the ladder is Term and OPEX / cam / mo only (T31). Spec section 13's row is closed |
| C-11, Q4 | `src/lib/milestone-vocabulary.js` holds the six names. `milestones.ts` re-exports them, so no Commercials reader moved. R-TP1 part 1 has no exception, and the isolation test header records it. `CLAUDE.md` is untouched |
| C-12, Q13 | The CAPEX structures do not inherit installation or annual invoicing. PO factoring stays (spec 6 and 9 as written) |
| C-13, Q6, Q7, Q11 | Price card (APPROVAL on Base in every mode; Deal value subtitled "Pipeline value"), CAPEX payment card, CPI section, CAPEX tiles, schedule with the mockup's four columns leading. The margin banner is not built |
| Q10 | Cash in year 1 = net invoices, months 0 to 12, on the schedule displayed |
| Q12 | `prototypes/term-pricing/build-mockup.mjs` **retired**, not re-pointed. It rendered the TERM_PRICING_2 picture, whose CAPEX design v1.6 supersedes. Its last output, `index.html`, stays as the frozen record |
| R-1 | `CURRENT_STATE.md` dumps `term_pricing_settings`; the live SafeSight anchor margin of 50% is now in a generated document |

## 3. EXIT, point by point

| point | evidence |
|---|---|
| spec v1.6 first | `d9fe995`. Every issued figure was checked by hand against the v1.6 rules as written before the commit; none disagreed, so no stop |
| tests fail first | 27 of 100 red against the v1.5 engine, every one a v1.6 claim; 104 of 104 green after |
| engine calibration | `calibrate.mjs`: 66 of 66 behaved (65 FIRED on their named test, 1 negative SILENT); reverted run green, files byte-identical. 24 new injections, one per v1.6 claim |
| Commercials unmoved (C-11) | `npm run goldens`: `PASS: 9 checks, 4734 figures exact.` |
| probes from the click (`--spec`) | `--capex` 89 (the mockup's four states at 1240, 1600 and 1920; G-C1 to G-C6; refusals in words), default 34, `--tp2` 28, `--qp` 42 (T30 re-issued), `--pc` 10 (flipped for C-10) |
| view calibration | `calibrate-view.mjs`: W1 to W4 FIRED. Its first run read a dead probe as silence (W3) and found the CAPEX ladder head unasserted (W4); both closed |
| overlap sweep | 1240 to 1920, step 40, OPEX plus three CAPEX shapes: **12258 / 12258 on spec margins and 12258 / 12258 on live margins**. Injections: `capex-schedule-wide` FIRED 128 (CAPEX only), `floor-8` 132, `per-tile-size` 864, `percam-over-fee` 216 (OPEX only, correctly: there is no fee column under CAPEX) |
| full gate | `npm run verify -- --round-close` on `e99cc7d`: **all 26 stages passed** (pure 822/822, database 105/105, react 1457/1457). NordVPN not running; resolver 192.168.18.1; Supabase TCP 443 connects |
| merge --no-ff | `0deff3c`. Its tree is identical to the gated branch tree |
| merged gate | **all 26 stages passed** on `0deff3c`, started after the watched server restarted from the merge (20:09:29) and answered 200 |
| ls-remote re-check | `origin/main` is still `54ab35b`, an ancestor of HEAD: a fast-forward |
| revert rehearsal | in a temporary index: reverse-applying the merge gives exactly `54ab35b`'s tree; the real index is untouched. The revert, when wanted, is `git revert -m 1 0deff3c` |

Live data was not changed. `CURRENT_STATE.md` was regenerated on a clean tree at `3504755`. Its
diff is:
- the settings section;
- the bundle;
- fixture and tag counts.

Live records are unchanged at 134, and there is no schema or route change.

**Commits, counted:**

| commit | what |
|---|---|
| `6b382b4` | brief and mockup |
| `bd28ded` | Phase 0 report |
| `fb62d34` | rulings appended |
| `d9fe995` | spec v1.6 |
| `0fe1a18` | engine, tests, view, vocabulary |
| `f3fc7f5` | calibration |
| `65c5296` | probes, view calibration |
| `ec720ea` | sweep, fitting fixes |
| `3504755` | R-1 generator |
| `e99cc7d` | `CURRENT_STATE.md` |
| `0deff3c` | merge |

This close-out is markdown only and rides the green merged gate (rule 48a).

## 4. What surprised

1. **Every fixed breakpoint for the nine-column schedule was beaten by a case nobody had
   measured.**
   - My first font step was chosen by assuming the width scales with the font. Measured, it did
     not fit.
   - The next set was sized to the widest case I found by hand. The sweep then found two-phase +
     split + gross-up 26px over at 1360.
   - The fix changed shape rather than size: the table is fitted to its panel, as TILE_FIT fits the
     tiles.
2. **A first fix aimed at the wrong element.** Live margins put eight CAPEX tiles on one row at
   120px. I assumed the floor chip didn't fit. It was the label word "SUBSCRIPTION" (122px). The
   sweep's unchanged red said so, and naming the element by measurement settled it.
3. **The view calibration's first silence was the harness, not the screen.** A probe that died
   before printing a verdict read as "nothing failed" (Verification 48). The harness now stops on a
   run with no verdict.
4. **Screenshots found two things no check had.** Headers ran together at 1920 under padding meant
   only for narrow widths. The schedule note also called a Custom amount the Hardware default.
