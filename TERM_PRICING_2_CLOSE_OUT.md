# TERM_PRICING_2 close-out

## 1. Not done

- **The push.** It is John's (rule 18): `git push` was never run.
- **The live TERMS setting** is unchanged at nine terms, as ruled. John changes it as admin after
  the push.
- **Queued, not built** (Rule 10 and the rulings):
  1. **The every-routed-screen overlap sweep, as its own round** (A3 ruling R1). The 11 views not
     yet covered: leads, leads-legacy, contacts, contact-detail, accounts, account-detail,
     test-beds, test-bed-detail, opportunities, opportunity-approval, approvals. The opportunity
     detail view is covered only on its Commercials OPEX card.
  2. **The opportunity header at 1240** (layout approval): the stat tiles wrap, with a grey filler
     block after "Working Version", and the stage tab row wraps to two lines.
  3. **The duplicate build-discipline-10 paragraph** in `CLAUDE.md` rides CLAUDE_MD_SPLIT (A3
     ruling).
  4. **Carried from TERM_PRICING:**
     - a `term_pricing_settings` history;
     - a `head: true` count reads a missing table as present;
     - `CURRENT_STATE.md` does not record `system_roles` or `term_pricing_settings`;
     - Phase 4, cash flow.
  5. **The settings migration still seeds the nine-term TERMS.** That is correct, because it is
     applied and the brief says do not migrate it. It now differs from spec v1.3's default.

## 2. Sign-offs counted against commits (build discipline 7)

The ruling count and the brief's appended sections agree: both are 4.

| sign-off | commits |
|---|---|
| the brief (round start) | `a1c3e18` |
| A3 investigation, STOP | `7ac79aa` |
| A3 rulings R1, Q1 fix, B6 (appended at launch) | `3f90cd7`, then Part A `46765ff`, spec `7539583`, engine `081db2c`, screen `e9a3142`, LAYOUT STOP `b9fadbc` |
| layout approval L1 to L3 (appended at launch) | `671a9f9`, then L1 to L3 and the mockup `1a933f7`, proofs from the click `76831f7`, CURRENT_STATE `0db4409` |
| EXIT | this report, the gate, the merge, the merged gate |

## 3. EXIT, point by point

| point | evidence |
|---|---|
| term-pricing goldens, T24 to T28 exact | `node --test scripts/tests/term-pricing.test.mjs`: 78 pass, 0 fail. T24 to T28, the 108 rows of 10.1 and 10.2, and L1's ruling figures, all copied from the spec and the rulings; the new claims were red before the change |
| G1 to G5 unchanged | `npm run goldens`: `PASS: 9 checks, 4734 figures exact.` |
| overlap zero across the sweep | `probe-overlap.mjs`, 1240 to 1920 step 40, 16 Term Pricing states and the OPEX card: 2232 / 2232 |
| guard red on the defect, green after | 82 fails before the fixes, exactly the two defects; 648 / 648 after; injections `label-input`, `shrink`, `lost-root`, `six-a-row`, `l2-borderless` and `l3-push` each fired on its own check only |
| proofs from the click | `probe-screen.mjs --tp2`: 21 / 21 (T24, T25, T26 at 108 with TERMS passed in test, T27, T28, L1). The default run is still 29 / 29 |
| engine calibration | 39 / 39 injections as expected; the reverted run is byte-identical |
| full gate | `npm run verify -- --round-close` with a browser on `0db4409`: **all 26 stages passed**. Pure 794/794, database 105/105, React 1457/1457, every HTTP probe, the readonly-view browser probe. NordVPN not running; resolver 192.168.18.1; Supabase resolves and TCP 443 connects. A first run without `PUPPETEER_PATH` skipped the required browser stage and reported itself UNANSWERED; it was not counted |
| merge --no-ff | MERGE |
| merged gate | GATE_MERGED |
| ls-remote re-check | LSREMOTE |

## 4. Revert rehearsal

REHEARSAL

## 5. What surprised

1. **A detector's reassuring verdict needed its own injection** (build discipline 3). Testing
   containment on the parent element would have passed an input printed over its own label: 0
   hits, against the node test's 1.
2. **A table cannot shrink, so it overflows its track.** The box check passed the very table that
   was overprinting; the track had to be measured.
3. **The first `label-input` injection was silent** because it moved the input sideways under
   clear space. It was measured before the silence was read as a gap.
4. **The A3 finding about the server was mine and wrong.** A `--watch` child shows the full node
   path and looks like an unwatched server. Parent PID settles it.
5. **The regenerated mockup passed every check and was illegible at 1240.** Figures broke
   mid-number and the schedule overflowed. Found by opening the capture (Verification 4).
6. **With Split WHT off, an OPEX month must stay one line.** Two lines at the same rate round
   twice and move T20 by a cent.
