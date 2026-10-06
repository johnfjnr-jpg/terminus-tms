# TILE_FIT close-out

## 1. Not done

- **The push.** It is John's (rule 18): `git push` was never run.
- **Two positions taken where the rulings were silent, both one-token changes if you want them
  otherwise:**
  1. **Cap at 18px.** F1 sets no upper bound. Read literally, a five-tile row at 1920 would grow
     past today's design size, so `--tp-fig-max` is 18px, today's largest standard size.
  2. **Lead ratio 22:18.** The brief says "22:17 today", but no measured state is 22:17: the
     browser computed **22:18 at 1600 and wider, and 16:14 below**. `--tp-fig-lead-ratio` is 22:18,
     the design's full-size proportion. Recorded, not resolved quietly.
- **Carried:**
  - the PO factoring card and toggle at 1240;
  - the every-routed-screen overlap round;
  - the opportunity header at 1240;
  - the engine's "WHT on software as a service" message;
  - the duplicate rule-10 paragraph;
  - the TERM_PRICING items.

## 2. The rulings, against what is built

| ruling | built |
|---|---|
| F1 one shared size | `useFittedFigures` measures each figure's width per pixel of font size in its own face, and solves for the largest size at which the widest fits its tile, padding included. One size goes to every tile, recomputed on any change to the quote and on resize |
| F2 lead proportion | the lead is the shared size times the ratio token (22:18; see section 1) |
| F3 floor and wrap | never under 13px. Where the row cannot fit at 13px it wraps to two rows of equal tiles, and the hairlines follow the grid. The first wrapped capture showed lines doubling against the card's border; that was this round's own defect and is fixed |
| F4 | labels and the floor chip untouched |

**The tokens:** `--tp-fig-max`, `--tp-fig-min` and `--tp-fig-lead-ratio` are on `.tp-figures`.
`--tp-fig` and `--tp-fig-cols` are set inline by the hook and have stylesheet defaults: the pure
suite's invariant caught them undefined on the first commit attempt.

**Superseded and retired:** the fixed 18px and 22px sizes, and the media query's 14px and 16px
step-down below 1600.

## 3. Before and after (E3, `prototypes/term-pricing-tiles/`)

| state | 1240 | 1600 | 1920 |
|---|---|---|---|
| John's (CAPEX, 120 months, split WHT 5% / 10% grossed up, demo units, 7 tiles), before | 14px | 18px, figures into the borders | 18px, figures into the borders |
| John's, after | **wrapped, 4 + 3 tiles, 18px** | **15.75px, one row** | **15.5px, one row** |
| OPEX five tiles, before | 14px | 18px | 18px |
| OPEX five tiles, after | 18px | 18px | 18px |

The "before" set was taken on `main`'s tree (`ebc9698`, checked out read-only), and the "after"
set on the branch. 1920 comes out slightly smaller than 1600 because the page's maximum width makes
the card 16px narrower there.

## 4. EXIT, point by point

| point | evidence |
|---|---|
| **E1** no figure moves | term-pricing 83 / 83; `npm run goldens` `PASS: 9 checks, 4734 figures exact.` |
| **E2** sweep | 1240 to 1920 step 40, all 24 states at the demo deal's units, plus the OPEX card and the installation section: **6354 / 6354. The 44 seven-tile failures are 0**, with zero overlaps. Every figure is inside its tile, and each row has one shared size with the lead in proportion. **Calibration:** `per-tile-size` FIRED the shared-size check in 432 states, and only that check; `floor-8` FIRED F3 in the 4 states where 13px cannot fit one row, and only that check |
| screen proofs | default 29 / 29, `--tp2` 24 / 24, `--qp` 33 / 33 (legibility check unrelaxed) |
| **E3** screenshots | section 3 |
| **E4** full gate | `npm run verify -- --round-close` with a browser on `112dbc7`: **all 26 stages passed**. NordVPN not running; resolver 192.168.18.1; Supabase TCP 443 connects |
| merge --no-ff | `a18fd2b`. Its tree is identical to the gated branch tree |
| merged gate | **all 26 stages passed** on `a18fd2b`. It waited for the server to answer first, after last round's race with the restart |
| ls-remote re-check | `origin/main` is still `ebc9698`, an ancestor of HEAD: a fast-forward |
| revert rehearsal | in a temporary index. Reverse-applying the merge gives exactly `ebc9698`'s tree, and the real index was untouched. The revert, when wanted, is `git revert -m 1 a18fd2b` |

`CURRENT_STATE.md` was regenerated at `112dbc7`. Its diff is the bundle and fixture counts; live
records are unchanged at 134, and there is no schema or route change.

This report is markdown only and rides the green merged gate (rule 48a).
