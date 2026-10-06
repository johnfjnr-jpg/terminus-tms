# QUOTE_PANEL close-out

## 1. Not done

- **The push.** It is John's (rule 18): `git push` was never run.
- **Queued, not built:**
  1. **The seven-tile squeeze (pre-existing; the tiles are ruled unchanged).** Under CAPEX with
     split WHT and Gross up on there are seven summary tiles. With a real deal's figures they run
     to the next tile's border:
     - at 1240 and 1280, 121px tiles needing 130px;
     - from 1600 to 1920, 153px tiles needing 161px.

     It is not an overprint. It exists since TERM_PRICING_2's L1 tile, and it surfaced only now
     because the sweep now uses the demo deal's units. Photographed:
     `prototypes/term-pricing-quote/built/finding-seven-tiles-1600.png`. Proposed for the 1240
     round.
  2. **The old TERM_PRICING_2 mockup generator** still draws the pre-panel layout. This round's
     approved pictures are the mockup; regenerating the old one was not in the brief.
  3. **Carried:**
     - the PO factoring card and toggle at 1240;
     - the every-routed-screen overlap round;
     - the opportunity header at 1240;
     - the engine's "WHT on software as a service" message;
     - the duplicate rule-10 paragraph;
     - the TERM_PRICING items.

## 2. The rulings, against what is built

| ruling | built | evidence |
|---|---|---|
| Q1 one panel | tiles; "Pricing by product and band" (CAPEX: "Pricing basis (OPEX fees, year 1)") with product subtotals, indented bands and Total per month, plus the escalator note; "Profit by product"; "Payment schedule". The separate cards are gone | `--qp`: both pictures' states reproduce figure for figure |
| Q2 profit by product | the engine's per-product totals (spec v1.4); the WHT rows when borne; WHT never per product | T29 and T30 exact; J35 (WHT allocated to a product) FIRED |
| Q3 WHT rules | unchanged | no engine change to WHT |
| D1 | the CAPEX Upfront tile kept | pinned in `--qp` |
| D2 | "WHT borne" kept as the schedule head | pinned |
| D3 | the CAPEX note is today's sentence plus the picture's | pinned, exact text |
| D4 | the title states the WHT treatment: one rate borne or grossed up; split hardware / SaaS, borne or grossed up; nothing at 0 | every wording pinned |
| Overflow | the schedule's columns at 6px a side instead of 10. **Padding alone was enough, so the figure font is untouched** | the sweep's fit check (every Quote table inside the panel's content box, "Terminus receives" visible) was **red on the old padding**, up to 54px over under CAPEX at 1240 and 1280, and **green on the new** at every width in every state. `--qp`'s legibility check, unrelaxed, passes at 1240 |

## 3. EXIT, point by point

| point | evidence |
|---|---|
| **E1** goldens | term-pricing 83 / 83, T29 and T30 exact on the first run. `npm run goldens` `PASS: 9 checks, 4734 figures exact.` Calibration: J34 and J35 FIRED, 41 / 41, reverted run byte-identical |
| **E2** from the click | `probe-screen.mjs --qp` **33 / 33**: the ruled 26, plus D1 to D4 pinned. The product rows sum to the deal tile and the Total row; under OPEX the band total equals the schedule's year-1 net fee. Under CAPEX the band table is the OPEX basis and cannot equal the CAPEX service fee, by construction, as the pictures also show. Regression runs: default 29 / 29, `--tp2` 24 / 24 |
| **E3** sweep | 1240 to 1920 step 40, 24 Term Pricing states (OPEX and CAPEX; WHT off, split with gross-up and an escalator, borne; Settings open and closed; admin and non-admin) at the demo deal's units, plus the OPEX card and the installation section: **5014 pass, 0 overprints. The 44 failures are all the queued seven-tile squeeze**, in its one state. Screenshots: `prototypes/term-pricing-quote/built/` |
| **E4** full gate | `npm run verify -- --round-close` with a browser on `118ae2e`: **all 26 stages passed**. NordVPN not running; resolver 192.168.18.1; Supabase resolves and TCP 443 connects |
| merge --no-ff | `1b68602`. Its tree `8951341` is identical to the gated branch tree |
| merged gate | **all 26 stages passed** on `1b68602`. A first run was UNANSWERED, not red: the server was restarting from the merge's own `src/` change at the second the gate began. That was measured (its child started at 16:02:23, the gate's start), it was re-run, and the session was untouched |
| ls-remote re-check | `origin/main` is still `b7310cb`, an ancestor of HEAD: a fast-forward |
| revert rehearsal | in a temporary index. Reverse-applying the merge gives exactly `b7310cb`'s tree, and the real index was untouched. The revert, when wanted, is `git revert -m 1 1b68602` |

`CURRENT_STATE.md` was regenerated at `118ae2e`. Its diff is the bundle and fixture counts; live
records are unchanged at 134, and there is no schema or route change.

This report is markdown only and rides the green merged gate (rule 48a).

## 4. What surprised

1. **A sweep at one unit cannot see a width problem.** Both the schedule overflow and the
   seven-tile squeeze need real-deal figures, so the sweep now uses them.
2. **Four checks in the screen probe were still reading the retired tables** (Verification 41).
   They were re-pointed, not deleted.
3. **The live TERMS has carried ten terms since your admin change on 2026-10-03.** The default
   probe's table 10.1 was updated from spec v1.3.
4. **The merge itself restarts the watched server,** so a gate run straight after a merge can
   meet a server mid-restart. Worth a wait-for-server step in the gate (not built).
