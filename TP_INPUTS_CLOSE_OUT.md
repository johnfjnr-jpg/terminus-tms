# TP_INPUTS close-out

## 1. Not done

- **The push.** It is John's (rule 18): `git push` was never run.
- **Queued, not built:**
  1. **The engine's error message for an invalid SaaS rate** still reads "WHT on software as a
     service". It converges to "SaaS" in the next round that touches the engine (John,
     2026-10-03). The spec's section 8.1 also keeps the long form.
  2. **Carried from TERM_PRICING_2:**
     - the every-routed-screen overlap round;
     - the opportunity header wrapping at 1240;
     - the duplicate rule-10 paragraph (CLAUDE_MD_SPLIT);
     - the TERM_PRICING items.

## 2. The comparison screenshots, and the button-size ruling

- **Approved pictures:** `prototypes/term-pricing-inputs/inputs-1240-split-off.png`,
  `inputs-1240-split-on.png` and `inputs-1920-split-on.png`, byte for byte (sha256 in the brief).
- **Built:** `prototypes/term-pricing-inputs/built/built-<1240|1440|1600|1920>-split-<off|on>.png`,
  taken in the pictures' own state: 1 SafeSight, 36 months, CAPEX, GST 9; split off at WHT 0; split
  on at 5 and 10 with Gross up on.

**RULING (John, 2026-10-03), option (a): the current button size is kept. The mockup's button
dimensions were illustrative; the approved picture is the ARRANGEMENT, and that is what is built.**

The measurement behind it:

- The picture's buttons are larger than the live ones: "12" is 42px against 34px, and "OPEX
  monthly" 116px against 106px.
- At those sizes the deal-terms row would need 919px of the 849px available at 1240, and Payment
  structure would wrap, against I1. As built it needs 835px and stays one row.

What does match the picture, measured:

- the sections and their rules;
- the left-packed rows: 56px between the deal-term groups, 28px between the tax controls;
- the inputs: units 72px, escalator and start year 110px, GST and WHT 56px;
- the note's spacing.

## 3. Sign-offs counted against commits (build discipline 7)

| sign-off | commits |
|---|---|
| the brief, the base and the mockup file (John corrected the file's name before the copy) | `63de30e` |
| the build, I1 to I6 | `2b5e9c0`, STOP `493eb12` |
| the button-size ruling (appended at launch) | `79c2fe1`, CURRENT_STATE `79f9286`, merge `fe71210` |

The brief carries three appended sections (base and mockup file, the ruling). That matches the
rulings given, which are also three.

## 4. EXIT, point by point

| point | evidence |
|---|---|
| E1 no figure moves | term-pricing goldens 78 / 78; `npm run goldens` `PASS: 9 checks, 4734 figures exact.`; no file under `src/` or `docs/` changed |
| E2 overlap sweep | `probe-overlap.mjs`, 1240 to 1920 step 40, 16 states plus the OPEX card: 3096 / 3096, on the committed build. Zero overlaps; I1 rows one line; I2 widths under labels; I3 card height unchanged when Split WHT toggles, with the tax row still one line; I4 note text. Calibration: `i1-wrap` fired I1, `i3-height` fired I3 only |
| E3 from the click | `probe-screen.mjs --tp2`: 24 / 24. Split WHT off puts the single field in the hardware field's exact place, in the same row; on again, both fields return; T25 reads with "SaaS line" |
| E4 screenshots | section 2. The card is 385px tall in both split states at every width |
| E5 full gate | `npm run verify -- --round-close` with a browser on `79f9286`: all 26 stages passed (pure 794/794, database 105/105, React 1457/1457, readonly-view browser probe). NordVPN not running; resolver 192.168.18.1; Supabase resolves and TCP 443 connects |
| merge --no-ff | `fe71210`. Its tree `d972cb8` is identical to the gated branch tree |
| merged gate | round-close with a browser on `fe71210`: all 26 stages passed |
| ls-remote re-check | `origin/main` is still `e800b2d`, an ancestor of HEAD: a fast-forward |
| revert rehearsal | in a temporary index (rules 9 and 19). Reverse-applying the merge gives `e18a6d1`, exactly `e800b2d`'s tree, and the real index was untouched. The revert, when wanted, is `git revert -m 1 fe71210` |

`CURRENT_STATE.md` was regenerated at `79f9286`. Its diff is the bundle, tag distances and fixture
counts; live records are unchanged at 134, and there is no schema or route change.

This report is markdown only and rides the green merged gate on `fe71210` (rule 48a).

## 5. What surprised

1. **A taller row that does not wrap is invisible to a one-line check.** A bottom-aligned row grows
   and its children's bottoms still agree. Only the card-height assertion (I3) sees it, and an
   injection proved the two checks are not one.
2. **Source order again.** A bare `.tp-pct2` lost to a later `.tp-num`, the same fault the
   stylesheet already records for `.deal-toggle`'s padding. The sweep caught it at the first run.
3. **The white "on" border in two rounds of captures was the probe's own pointer** resting on the
   switch it had just clicked (`:hover`), not the product. Computed styles confirmed it.
