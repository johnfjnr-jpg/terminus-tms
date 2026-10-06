# QUOTE_PANEL: STOP, three places the approved pictures and the Q1 text disagree

## 1. Not done

**The gate is not run, and nothing is merged or pushed.** It waits on the four rulings in section 3:

- the full gate (E4);
- the merge and the merged gate;
- the ls-remote re-check.

## 2. Built and evidenced (branch `quote-panel`, from `b7310cb`)

| commit | what |
|---|---|
| `8f12f06` | the brief, verbatim with its amendments, and the two pictures byte for byte (sha256 in the brief) |
| `5b61e5b` | spec v1.4: per-product totals in section 4.3, WHT never per product, T29 and T30 |
| `0309b1a` | the engine: each line carries TCV, cost, gross profit and margin |
| `3ae4f40` | the one panel (Q1, Q2) |
| `62d6276` | the probes |

| exit point | evidence |
|---|---|
| **E1** goldens | **83 / 83**, T29 and T30 exact on the first run against your figures. G1 to G5: `PASS: 9 checks, 4734 figures exact.` Calibration J34 (a product ignores the escalator, so the sum breaks) and J35 (WHT allocated to a product) both FIRED: 41 / 41, reverted run byte-identical. One new test passed against the OLD engine (undefined against undefined, Verification 14) and was given a presence check before it counted |
| **E2** from the click | `probe-screen.mjs --qp`: **25 / 26**. Both pictures' states reproduce figure for figure (tiles, every band row, every product row, the WHT rows, every schedule row). The product rows sum to the deal tile and the Total row. Under OPEX the band table's total equals the schedule's year-1 net fee. **The one red is a pre-existing overflow (section 4).** The earlier runs still pass: default 29 / 29, `--tp2` 24 / 24 |
| **E3** overlap sweep | 1240 to 1920 step 40, **24 Term Pricing states** plus the OPEX card and the installation section: **4626 / 4626**, zero overlaps. The states are OPEX and CAPEX; WHT off, split with gross-up and an escalator, and borne; Settings open and closed; admin and non-admin. The panel was photographed at 1240 and 1920, OPEX and CAPEX (`prototypes/term-pricing-quote/built/`), beside the approved files |

**Under CAPEX the band table cannot equal the schedule's year-1 net fee, by construction.** The
table is the OPEX pricing basis (366,976.85); the CAPEX schedule's year 1 is the service fee
(342,647.69). The pictures show the same pair, so E2's tie is asserted under OPEX.

**Callers of the retired tables (Verification 41):** four checks in `probe-screen.mjs` read the old
Product lines and Profit tables, and all four are re-pointed to the panel. The old TERM_PRICING_2
mockup generator still draws the old layout. It is kept, because this round's pictures are the
mockup and regenerating the old one is not in the brief.

## 3. THE STOP: the pictures disagree with Q1's text, so I built the TEXT and photographed the difference

Verification 31 (decisions before artefacts) is why the text was built. Each is one line to switch.

| | picture | Q1 says | built |
|---|---|---|---|
| **D1** CAPEX tiles | no "Upfront" tile | "(a) the summary tiles, unchanged" | the Upfront tile **kept** (1,550,000.04) |
| **D2** schedule WHT column head, WHT borne | "WHT" | "rows and notes exactly as today" | "WHT borne" (today's) |
| **D3** CAPEX schedule note | "...the same TCV as OPEX. WHT is withheld per invoice, so it is shown for the whole deal, not per product." | "exactly as today" | today's: "...the same TCV as OPEX; the upfront carries any rounding residue." |
| **D4** title hint, WHT | ", WHT 10% borne" (borne shown) | silent | built for **borne**. With Gross up on, the title says nothing about WHT. The pictures do not show that state, so nothing was invented for it |

Compare `quote-panel-capex.png` with `built/built-capex-1920.png` for D1 to D3.

**Ruling needed:** for each of D1 to D3, picture or text; and D4 with Gross up, either nothing (as
built) or a wording.

## 4. Found, not built (Rule 10), with the measurement

**The payment schedule overflows at 1240 under CAPEX** with three products and WHT borne. The
table is 872px wide in an 849px content box, and the card's content is 890px in 885px, 5px past
its border.

**Measured identically on `main`'s tree:** `b7310cb` was checked out for one read-only
measurement, then the branch was restored with its tree hash confirmed. So it pre-dates this round;
the table only moved into the panel. The overlap detector cannot see it (it is not an overprint),
and `--qp`'s legibility check is left red on it rather than relaxed. **Proposed for the 1240
round.**

## 5. Environment

- **The session expired overnight** and was refreshed before the probes (not before any gate).
- **`/tmp/tms-probe` had been half-swept,** with `puppeteer` an empty directory (the case the gate's
  browser self-check records). It was reinstalled with the loader's own command, and the
  self-check reads PASS.
