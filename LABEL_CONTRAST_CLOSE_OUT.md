# LABEL_CONTRAST close-out

## 1. Not done

- **The push.** It is John's (rule 18): `git push` was never run.
- **Queued, not built:**
  1. **For the opportunity-header 1240 round:** the PO factoring card (219px, needs 243) and its
     toggle (185px, needs 209). Two of the four squeezes queued at Phase 1 are cleared by this
     round (section 4).
  2. **Carried:**
     - the every-routed-screen overlap round;
     - the opportunity header at 1240;
     - the engine's "WHT on software as a service" message;
     - the duplicate rule-10 paragraph (CLAUDE_MD_SPLIT);
     - the TERM_PRICING items.
  3. **Out of this label round's scope, recorded:**
     - Labels hard-coded at 9 to 11px on screens other than Term Pricing and the Commercials tab
       keep their sizes. 51 uppercase quiet rules were censused, and only those on the two
       reviewed screens were pointed at the token.
     - `thead th` (11px), the estate-wide generic table head, is unchanged.
     - The OPEX table heads and the installation grid heads keep their 9px (ruling B). They take
       the brighter colour.

## 2. What changed, against the rulings

| ruling | built | evidence |
|---|---|---|
| C1 `--muted` 0.75 | `style.css` `:root` | census on the build: **522 enabled quiet text nodes 7.69 to 9.40:1** (were 2.63 to 4.83). White figures 13.5 to 16.1:1. Only 4 disabled buttons read below 7, at 3.26:1, and they are dimmer by design (P1) |
| C2 inline `--muted-2` retired | 6 sites in `cashflow.ts` and `panelParts.tsx` | **G9 4** scans the React source and the vanilla scripts. **G9 5** calibrates the matcher. Restoring one old site turned G9 4 red, naming `panelParts.tsx`; the file was restored byte-identical. Pure suite 794 to 796 (two new tests in `label-contrast.test.mjs`, which runs under `npm test`) |
| S1 token 12px, S2 five rules on it | `--field-label-size: 12px`; `.label`, `.cf-row.head .cf-label`, `.ohl-label`, `.tp-chip`, `.tp-tag` | census |
| Units grid column for the 12px head | `useFieldWidth.tsx`: a head word's width now includes its letter-spacing | a canvas measure ignores tracking: 36px measured against 42 painted. The squeeze is gone |
| P1 disabled stays dimmer | (no change needed) | every disabled control is 2.67 to 2.94 times dimmer than enabled (floor 1.5). Screenshots `lc-p2-*` and `lc-p2before-*` |
| P2 active stays distinct | (no change needed) | nav, tabs and stage strip each keep a non-colour cue (background, underline, fill); colours 1.69 to 8.92 apart |
| Option (a), intake heading | `#deal-intake-head .deal-field { width: min-content }`, the band bottom-aligned, both controls on one declared height `--intake-control-h` (the select's own 35px) | at 1240 to 1920 step 40: the lump-sum input and the responsibility select share top and bottom edges within 1px; the shrink check over the section is clean. Screenshots `lc-installation-1240.png` and `lc-installation-1920.png` |

## 3. RECORDED AS RULED: the Phase 1 diagnosis was wrong

**Phase 1 attributed the 6px squeeze at 1240 to the units grid's "UNITS" head. That was wrong.**
With the units head fixed, the squeeze remained.

**The measured cause was the intake heading.** "LUMP SUM COST" at 12px widened its `max-content`
column from 123 to 138px, on a band that was already 379px in a 365px track before the round.

**The units-head fix stands on its own.** That head really was narrower than its own text (a
canvas measure ignores letter-spacing) and its squeeze is gone. It simply was not the cause of
this one.

**The edge assertion was seen red twice before it went green:**

1. 18px apart, with the wrapped label lowering the input;
2. 2px apart, after matching the input's padding and type to the select, because the mono and
   body faces have different "normal" line heights.

One declared height for both controls closed it.

## 4. Two of the four queued squeezes are cleared

| queued at Phase 1 | now |
|---|---|
| units grid head (32px, needs 37) | **cleared** by the tracking measurement |
| intake head track (365px, needs 379) | **cleared** by option (a) |
| PO factoring card (219px, needs 243) | queued |
| factoring toggle (185px, needs 209) | queued |

## 5. EXIT, point by point

| point | evidence |
|---|---|
| overlap sweep | `probe-overlap.mjs`, 1240 to 1920 step 40: Term Pricing (16 states), the OPEX card, and the units-and-installation section: **3186 / 3186** |
| goldens | term-pricing 78 / 78; `npm run goldens` `PASS: 9 checks, 4734 figures exact.` |
| full gate | `npm run verify -- --round-close` with a browser on `be5749e`: **all 26 stages passed**. NordVPN not running; resolver 192.168.18.1; Supabase resolves and TCP 443 connects |
| merge --no-ff | `1ef6e42`. Its tree `46e3f61` is identical to the gated branch tree |
| merged gate | round-close with a browser on `1ef6e42`: **all 26 stages passed** |
| ls-remote re-check | `origin/main` is still `8458f57`, an ancestor of HEAD: a fast-forward |
| revert rehearsal | in a temporary index (rules 9 and 19). Reverse-applying the merge gives `e6f6c2c`, exactly `8458f57`'s tree, and the real index was untouched. The revert, when wanted, is `git revert -m 1 1ef6e42` |

`CURRENT_STATE.md` was regenerated at `be5749e`. Its diff is the bundle and fixture counts; live
records are unchanged at 134, and there is no schema or route change.

This report is markdown only and rides the green merged gate on `1ef6e42` (rule 48a).

## 6. What surprised (instrument faults, all mine, all caught before a claim)

1. **Opacity is part of the paint.** Disabled buttons carry `opacity: 0.5` as well as a colour. The
   first P1 run ignored it and read a false STOP. The census had the same blind spot, so it was
   re-run once opacity was folded in.
2. **A preview re-captured its "before" state on every run** and overwrote the committed
   pre-change screenshots with the changed screen. The edit journal refused that commit; the
   files were restored to their committed bytes and the script fixed (Verification 44's time
   axis).
3. **A canvas width is not a painted width when the text is tracked.** That is the units-head
   root cause, and it may affect any other column sized the same way. Worth a census in a later
   round.
