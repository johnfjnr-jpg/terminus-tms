# TP_TABS Phase 0: investigation report

Branch `tp-tabs` off `origin/main` at `206a377`. The first commit is `3c8f4bf`: the brief verbatim
and the mockup. Nothing else has been built. This report is all of Phase 0; I have stopped and am
waiting for rulings.

## 0. Not done, and one departure

- **Nothing is built.** That is by design, since Phase 0 only reports.
- **The mockup is five states, each an image plus an HTML export, not one HTML file.**
  - The brief names `prototypes/term-pricing-tabs.html`. You supplied five PNGs first, then five
    zips of HTML exports (2026-10-11). Everything is in `prototypes/term-pricing-tabs/`, which
    follows the other mockups' convention (`term-pricing-quote/`, `term-pricing-tiles/`).
  - The images and the zips are committed unchanged, under your file names.
  - Each zip holds one `.dc.html` artboard, a README, and the design tool's runtime
    (`support.js` and two React vendor files, identical across all five zips).
  - **The artboards and READMEs are also extracted to `html/<state>/` so they can be cited by
    line.** Each was compared byte for byte with its zip entry. The runtime is left inside the
    zips: it is "not part of the design" (the README's words), and loose vendor JavaScript under
    `prototypes/` would be read by the source scans that walk that folder.
  - **The HTML adds no state the images lack.** It is static markup with hard-coded figures (the
    logic class is empty). So sections 1 to 5 stand as written from the images.
  - **HTML against PNG, measured, not read:**
    - each state's text tokens (every figure and every word of three letters or more) were
      compared with an OCR of its PNG (macOS Vision, `scratchpad/ocr.swift`);
    - **all words agree in both directions in all five states;**
    - the only number residues are OCR artefacts, which the same comparison of a Chrome render of
      the HTML reproduces exactly:
      - two figures split in two by OCR (`310,` `318.28`; `21,734,` `127.25`);
      - single digits inside the tab circles and inputs that OCR skips;
    - **calibrated:** a copy of state 2b with one figure changed (350,310.18 to 350,310.19) and one
      label changed (Allocated to Assigned) was reported on both counts;
    - a pixel diff was tried first and abandoned. It differs on every row from small vertical
      offsets alone, so it cannot tell a changed label from a shifted one. Labels are cited to the HTML from here on, for example
    T-2's ladder head at `html/1/Main.dc.html:58` and T-4's amber rows at
    `html/2b/Payment_CAPEX.dc.html:25-26` and `:41`.

## 1. The mockup's figures, against today's engine

Every figure in the five images was recomputed by the engine at `206a377`. The engine ran on the
spec's settings and the demo deal (120 SafeSight, 40 AQ, 2 HEMIR, 60 months). The script was
`scratchpad/mock-check.mjs`, and its output was captured to a file.

| image | figures checked | result |
|---|---|---|
| 1 Pricing | all 10 ladder rows (fee, per camera, vs 36, Base TCV, margin); every band's fee and monthly figure; the product subtotals; the Deal row; the price card | **all agree** |
| 2b CAPEX milestones | Custom 1,000,000.00; subscription 350,310.18 / 350,310.38; hardware cost 1,240,000.00; "funds 240,000.00" | **agree**; these also match T4-G1 |
| 2c CAPEX monthly instalments | 129,166.67 ×11, month 12 129,166.63; subscription 341,143.52 / 341,143.32; the four breakdown rows; totals 1,550,000.00 / 20,468,611.00 / 22,018,611.00 | **agree**; this is G-C3 |
| 3 Quote, Locked 3% | all 7 schedule rows; Final TCV 23,284,127.25; CPI uplift 1,265,516.25; cash in year 1 5,643,722.24; OPEX comparison 4,403,722.20; profit card | **agree**; this is T30 |

**Two figure types in image 1 have no source in the engine** (item C1 below):
- each band row's **Base TCV**;
- each band row's **Margin**.

Recomputed by hand from engine fields, both agree with the image. For example, SafeSight 1 to 9 is
9 × 2,613.33 × 60 = 1,411,198.20, at a 20,000.00 unit cost, giving 87.2%. But the engine does not
produce either figure, so the screen would have to calculate them.

**T4-G1, checked against spec v1.6 as written:**

| figure | check |
|---|---|
| rows 500,000.00 and 300,000.00 | 1,000,000.00 × 50% and × 30%, both exact |
| subscription 350,310.18 and 350,310.38 | the engine gives these with the same CAPEX fully allocated, since the subscription doesn't depend on how CAPEX is split |
| m4 invoice 650,310.18 | 300,000.00 + 350,310.18 |
| allocated 80% / 800,000.00 and unallocated 20% / 200,000.00 | sum correctly |

No issued figure disagrees with the spec text.

## 2. Item 1: today's screen, mapped to the tabs

- **Source:** `frontend-react/src/term-pricing/TermPricingView.tsx`, read in full (1,013 lines).
- **Abbreviations in the "goes to" column:** **P** is Pricing, **PT** is Payment terms, **Q** is
  Quote, and **retired** means retired by T-6 or replaced.

### 2.1 Has a home in the mockup

| today (line) | goes to |
|---|---|
| Page head "Term Pricing" (376) | header on every tab, with the Base TCV / Payment basis strip (T-1) |
| Units per product, three inputs (390-399) | P (a), the units strip |
| Term ladder, row click selects (646-683) | P (b), with the T-2 columns at every basis (see C2) |
| Pricing by product and band (735-755) | P (c), Price breakdown, with the T-2 columns (see C1, N3) |
| Pricing basis OPEX / CAPEX (416-420) | PT, **"Payment basis"** |
| CAPEX amount Hardware / Custom, amount field (538-552) | PT, CAPEX amount; Hardware shows its value on the button |
| Paid as Two-phase / Hybrid (553-564) | PT, "How CAPEX is paid": **Monthly instalments / Milestones** |
| Milestone table: name, month, share, amount, remove, add (566-605) | PT, milestone editor, with T-4's Allocated and Still to allocate rows replacing today's Total row |
| Recovery period (607-617) | PT, Spread over: quick picks plus months input, with the instalment line beneath |
| Funds warning (620-622) | PT, under CAPEX amount (amber, as image 2b) |
| Subscription line (624-631) | PT, Monthly subscription, figure plus formula line |
| Hosting warning (632-634) | PT, under Monthly subscription (position; the images don't show it) |
| Annual increase None / Published / Locked, rate, from year (425-459) | PT, Annual increase |
| GST, WHT, Split, Gross up (464-493) | PT, Tax: GST; WHT **None / Single rate / Split**; Gross up beside it when WHT is not None |
| Engine refusal card (638-640) | PT readiness card (payment refusals); P (unit refusals) |
| Tiles row (694-730) | Q tiles, T-5's set |
| Payment schedule, CAPEX nine columns (797-842) | Q schedule; four columns by default, "Show tax detail" adds the rest |
| Payment schedule, OPEX (843-871) | Q schedule (see C3) |
| Profit by product (768-795) | Q profit card: Product, Base TCV, Margin, Deal, gross profit, CPI uplift |
| Term buttons (403-409) | **retired**: the ladder row is the selector (see N1) |
| Price card "Price, set by OPEX", lock chip (501-530) | **retired by T-6**. Base TCV goes to the P price card and the header strip; Final TCV and Deal value go to the Q tiles |

### 2.2 No home in the mockup (listed rather than dropped)

| # | today | proposed home (my recommendation) |
|---|---|---|
| N1 | **Keyboard access to the term.** The term buttons are today's only keyboard path; ladder rows take a click only | ladder rows become focusable, selected with Enter or Space. Not a visual change |
| N2 | **Settings card** (admin edits, everyone reads; 892, 945-1012) | bottom of Pricing, collapsed as today. The ladder is computed from it |
| N3 | **List fee / unit column** in the breakdown | drop it: Discount and Fee / unit carry the price; the list fee is the 0% band's fee |
| N4 | **Profit table:** Units, Hardware and hosting cost, Gross profit per product | the Q profit card shows Base TCV and Margin only, as the image does. Recommend dropping the three columns, with the deal's gross profit kept as in the image |
| N5 | **WHT borne and Gross profit after WHT** rows, and the **margin-after-WHT** line on the margin tile (T20, T30) | Q profit card, under gross profit, only when WHT is borne. **These are approval-relevant figures**, so I recommend keeping them |
| N6 | **Tiles GST, TCV incl. GST and WHT gross-up** (L1: TCV + gross-up + GST = incl. GST) | the tax detail view's Total row, which already carries invoiced, GST and incl. GST. L1 is then asserted on that row instead of the tiles |
| N7 | **Margin tile and its floor chip** | the floor status moves to the P price card (T-2 names it); the margin goes on the Base TCV tile (T-5) |
| N8 | **Quote title with the WHT and CPI treatment** (D4, John 2026-10-06) | Q schedule card subtitle, e.g. "60 months, CAPEX, CPI locked 3% from year 2, WHT 10% borne" |
| N9 | **Explanatory notes:** intro line, CPI note, tax note, both schedule notes, the CAPEX ladder note, "no year 2" | each moves to the one-line sub-label of its section, in the mockup's words where the images give them. "No year 2" stays under Annual increase |
| N10 | **"Tax on these invoices" and "Rules on this screen" card** (877-890) | retire. The Split WHT sentence moves under Tax when Split is chosen. Rules 1 and 2 are now carried by the APPROVAL and DEAL VALUE tags, and rules 3 to 5 by the section sub-labels and formula lines |
| N11 | **Escalator note under the breakdown** ("fees above are year 1's", Q1(b)) | P breakdown head reads "year 1" when a CPI applies |
| N12 | **Subtitle "Demo deal"** in the images | the calculator has no deal, so the subtitle reads "USD before tax", with the currency from settings |

## 3. Item 2: what addresses today's layout, and how each re-points

| script | addresses today | re-point |
|---|---|---|
| `probe-screen.mjs` default (T1, T6, T15, T23, T16) | term buttons, the single page | term chosen by ladder row on P; inputs on PT; figures read on Q |
| `--flow` (E3) | the price after a settings change | same flow, read on P |
| `--tp2` (T24 to T28) | term buttons, the CPI section | ladder rows; CPI on PT |
| `--qp` (QUOTE_PANEL's two states) | the one-panel quote | **superseded** by the five new states; its figures (T29, T30) move to the new mode |
| `--pc` (T31 per camera; C-10 CAPEX ladder head) | the CAPEX ladder head "OPEX / cam / mo" only | **flips**: the P ladder is basis-independent (C2) |
| `--capex` (TP_CAPEX's four mockup states, G-C1 to G-C6) | the CAPEX card, nine-column schedule | G-C1 to G-C6 kept from the click on PT and Q; the four old states are superseded by the five new ones |
| **new `--tabs`** | none | the five mockup states, plus every tab under OPEX and CAPEX, T4-G1 from the click, tab state surviving a switch, blocked Quote |
| `probe-overlap.mjs` (OPEX/CAPEX × settings × admin) | one page | every tab × every state, 1240 to 1920 step 40. Injections: `per-tile-size` on Q tiles; `percam-over-fee` on the P ladder; `capex-schedule-wide` on the tax detail view only; `floor-8` unchanged |
| `calibrate-view.mjs` W1 to W4 | `--capex` claims | re-pointed, plus one injection per new claim (T-1 ticks and blocking, T-3 DOM absence under OPEX, T-4 rows, T-5 default columns, T-6 Final/Deal only on Q) |
| `photograph-inputs/ladder/quote/tiles.mjs` | the Inputs card, ladder card, Quote panel, tile row | **retire all four.** Each photographs a card that no longer exists; their outputs stay as the record of what was approved then. One new `photograph-tabs.mjs` captures the five states beside your images |
| `label-contrast/states.mjs` P1 | the start-year select | **already broken, found here:** the select is absent when the CPI mode is None, which became the default in TP_CAPEX, so this probe has measured nothing since `0fe1a18`. Found by reading only, not run. TP_CAPEX caused it, so I fix it here: choose Published on PT first |
| `label-contrast/census.mjs`, `preview.mjs` | Split WHT and Gross up switches | WHT "Split" on PT. With Gross up shown only when WHT is not None, it is clicked after Split |
| `calibrate.mjs` (engine) | engine | add injections for the T-4 preview |
| `probe-live.mjs` | HTTP and RLS, no layout | unchanged |
| `attention-token.test.mjs` | registers `.tp-warn` | Still to allocate, Not yet scheduled and the readiness card are amber. They reuse `.tp-warn`'s token or are registered; the guard fires otherwise |

None of the term pricing probes is a gate stage. Each is recorded as unwired with its reason, and
that stays true.

## 4. Item 3: the engine API for T-4

**Proposal: `priceQuote` is unchanged, and a new export, `capexAllocation(input, params)`, sits
beside it.** Its input has the same shape as `priceQuote`'s. It returns:

```
{
  status: 'complete' | 'incomplete' | 'over',
  capexCents,
  rows: [{ key, month, cents | null }],     // null: share not yet typed
  allocated:   { share, cents },            // share as a ratio
  unallocated: { share, cents },            // 'incomplete' only; zero otherwise
  excess:      { share, cents } | null,     // 'over' only
  baseFeeCents, lastBaseFeeCents,           // the subscription: independent of the split
  breakdown: [{ fromMonth, toMonth, key, capexCents, subscriptionCents, netCents }],
  unscheduledCents,                         // the "Not yet scheduled" row
  warnings,
  quote,                                    // priceQuote's result when complete, else null
}
```

**The rules it follows:**
- **Complete (shares total exactly 100%):** the function calls `priceQuote` and returns its CAPEX
  plan unchanged. **Every v1.6 refusal therefore holds for a complete allocation by
  construction.** That covers `CAPEX_RANGE`, `CAPEX_CUSTOM`, `MILESTONE_COUNT`, `MILESTONE_KEY`,
  `DUPLICATE_MILESTONE`, `MILESTONE_MONTH`, `MILESTONE_ORDER`, `MILESTONE_SHARE` and
  `NEGATIVE_LAST_ITEM`. One test per code asserts it, written to fail first. The last-row rounding
  applies only here, as T-4 says.
- **Incomplete (below 100%):**
  - each row's amount is `round_half_up(CAPEX × share, 2)`, with no last-row carry;
  - `unallocated.cents` = CAPEX − Σ rows, so the breakdown's Total ties to Base TCV to the cent,
    which is T-4's requirement;
  - this can differ by one cent from `round_half_up(CAPEX × unallocated share)`. Spec v1.7 states
    which one is used. T4-G1's figures are the same either way;
  - every per-row refusal still applies. Only `SHARES_TOTAL` below 100% is lifted, and
    `NEGATIVE_LAST_ITEM` cannot arise without a last-row carry;
  - `quote` is null, so the Quote tab is blocked.
- **Over 100%:**
  - `priceQuote` refuses with `SHARES_TOTAL` as today;
  - the preview keeps the row amounts visible and names the excess, so the person can see which
    row to cut;
  - the breakdown is not built, because it could not tie.
- **A row whose share is blank** (just added with "+ Add milestone"):
  - its amount is null, it counts 0%, and the status is incomplete;
  - without this, adding a row would wipe every amount on screen, because today's engine refuses
    a blank share;
  - a share that is non-numeric, 0, or above 100 is still refused.
- **The engine still imports nothing (R-TP1),** and milestone keys stay opaque.

## 5. Item 4: conflicts

| # | between | the conflict | recommendation |
|---|---|---|---|
| C1 | brief "LAYOUT ONLY" vs image 1 | Band rows carry **Base TCV and Margin**, which the engine doesn't compute (section 1). The screen would have to do arithmetic on money, which R-TP1 and the view's own header forbid | **(a) add per-band Base TCV, cost and margin to the engine in v1.7.** No existing figure moves. (b) Otherwise, leave those cells blank on band rows and fill them on product subtotal rows only |
| C2 | T-2 vs spec 4.5 (C-10) | 4.5 says that under CAPEX the ladder shows Term and the per-camera fee only. T-2's Pricing ladder has every column whatever the basis | v1.7 amends 4.5 too, with the C-10 text left visible: display only, no figure moves. Brief says v1.7 is "T-4 only", so this needs your word |
| C3 | T-5 vs image 3 | the default schedule is "Months, CAPEX, Subscription, Invoice". Under OPEX there is no CAPEX or subscription, and the images show no OPEX Quote | under OPEX: Months, Monthly fee, Invoice. Tax detail adds today's columns |
| C4 | T-3 "Total ties to Base TCV" vs a CPI | with a CPI, the invoiced (Final) schedule does not tie to Base | the PT breakdown is the **Base** schedule, as the images show it ("Equals Base TCV: no annual increase applied"). With a CPI, one line says the invoiced figures, with the CPI, are on Quote |
| C5 | T-4 "refused as today, with the excess named" | today's message names the total ("The milestone shares total 120%. They must total exactly 100%.") and not the excess | add the excess: "The milestone shares total 120%, 20% (200,000.00) over. They must total exactly 100%." Refusal wording only |
| C6 | T-1 "each tab ends with a Next button" vs image 3 | the Quote tab has no Next, and there is nothing after it | no Next on Quote |
| C7 | T-1 "a finished tab shows a tick" | the brief doesn't define "finished" | Pricing is ticked when the units price; Payment terms is ticked when the quote is ready and the tab has been opened once; Quote is never ticked. Images 2a and 3 agree |
| C8 | brief sweep 1240 to 1920 vs Verification 10 (1240, 1920 **and 3440**) | the brief omits 3440 | sweep as briefed, plus a 3440 capture of the five states, opened and read |
| C9 | image defaults vs today | the images show GST 0, 60 months and 120/40/2 units. Today's defaults are GST 9, 36 months and 1/0/0 | keep today's defaults: the images are a demo state, and nothing rules a change |
| C10 | images vs spec 6.2 on the default payment | image 2c shows Monthly instalments selected. Spec 6.2 makes Hybrid (Milestones) the default | Milestones stays the default; 2c is a state |
| C11 | quick picks vs a short term | 18, 24 and 36 exceed T at 12 months | picks above T are disabled. The months input says "(1 to T)" |
| C12 | CLAUDE.md "no hard-coded parameters" | the picks 6, 12, 18, 24 and 36 are screen shortcuts, not pricing parameters; the default 12 is the spec's | no conflict, recorded for the reviewer |
| C13 | the export README vs TP_CAPEX's C-13 precedent | each README says to "replicate faithfully" the inline colours, font sizes, spacing and radii. The artboards use IBM Plex Sans and Mono and their own hex colours (for example green `#86d19a`, amber `#e9c46a`, a 380px right column). The estate uses Satoshi and JetBrains Mono (`frontend/style.css:130-131`) and its own tokens, including the single `--attention` amber the attention census enforces. For TP_CAPEX you ruled "content and behaviour binding, the visual language this screen's own". The README is the design tool's export text, not a ruling | **as C-13: content, structure, order, labels and behaviour binding; type and colour from the estate's tokens.** Copying the hex values would add a second amber and a second green beside the tokens. No guard would stop that: `attention-token.test.mjs` refuses only the one retired literal (`R-V7 12`), so this is a judgement, not an enforced rule |

**`DESIGN_PRINCIPLES.md`** records no term pricing layout decisions (searched for "term pricing",
TILE_FIT, QUOTE_PANEL, TP_INPUTS and TP_CAPEX). Those rulings live in the briefs and in the
view's comments. T-1 to T-6 supersede three of them, so each superseded comment is quoted, not
deleted:
- QUOTE_PANEL's "one panel";
- TP_INPUTS' "deal terms first, tax below";
- TP_CAPEX's C-13 card layout.

## 6. Questions needing your word (the rest are positions)

1. **C1:** add band-level Base TCV and Margin to the engine in v1.7 (recommended), or leave them
   off the band rows?
2. **C2:** may v1.7 also amend spec 4.5's CAPEX ladder sentence?
3. **N4 and N5:**
   - drop per-product cost and gross profit from the Quote profit card (recommended);
   - keep the WHT-borne and after-WHT rows (recommended).
4. **N10:** retire the Rules card (recommended)?
5. **C13:** is the visual treatment the estate's own, as under C-13 (recommended), or the
   artboards' exact values?

Everything else above is a position under the standing delegation, and each can be changed in one
line. On your rulings: I append them to the brief, then spec v1.7, then the tests (which must fail
first), then the rest of the round method.
