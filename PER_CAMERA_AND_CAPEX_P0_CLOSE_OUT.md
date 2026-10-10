# PER_CAMERA_AND_CAPEX_P0 close-out

## 1. Not done

- **The push.** It is John's (rule 18): `git push` was never run. Ready at `2ff3c72` plus this
  close-out commit.
- **Part B is a report only, as briefed.** Its rulings (B-1 to B-5, below) are for the next round.
  B-3 waits on a mockup approved by John before any build.
- **Queued, not built (John, 2026-10-10):**
  - **FB1, a pricing defect:** a deal-sheet recovery period longer than the contract silently
    under-collects hardware.
  - **FB2 and FB3** alongside it.
- **A gap named, not closed.** `CURRENT_STATE.md` does not dump `term_pricing_settings`, so the live
  SafeSight anchor margin of 50% (R1) appears in no generated document. A reader of
  `CURRENT_STATE.md` would assume the spec's 90%.
- **Carried from earlier rounds:**
  - the PO factoring card and toggle at 1240;
  - the every-routed-screen overlap round;
  - the opportunity header at 1240;
  - the engine's "WHT on software as a service" message;
  - the duplicate rule-10 paragraph;
  - the TERM_PRICING items.

## 2. The rulings, against what is built

| ruling | built or recorded |
|---|---|
| A1 per camera, OPEX | "Per camera / mo" directly after "Monthly fee (year 1)" under OPEX. It is the SafeSight line's year-1 monthly total over SafeSight units, half-up. It reads "-" with 0 SafeSight units and is not shown under CAPEX. The engine names no product: the screen passes `perCameraProduct` |
| A2 spec first | spec v1.5 in its own commit (`d2debc0`): section 4.5, T31, and a section 13 line for the CAPEX columns |
| A3 | screenshots at 1240, 1600 and 1920 for spec and live margins, approved by John 2026-10-10 |
| R1 | the live 50% is left as set. `probe-screen.mjs --spec` and the overlap sweep pass the spec's 90% margins in the browser's copy of the settings only. `--live-margins` measures the live setting |
| R2 | the wrapped heading at 1240 is accepted as built |
| B-1 to B-5 | recorded in the brief (`3d992e4`) and in `PER_CAMERA_AND_CAPEX_P0_PART_B.md` for the next round. Nothing is built |

## 3. EXIT, point by point

| point | evidence |
|---|---|
| goldens including T31 | term-pricing tests **88/88**, T31 exact. They failed first, 83 pass and 5 fail, before the engine change. Five engine injections each FIRED on their own test. The reverted run was byte-identical |
| G1 to G5 unchanged | `npm run goldens`: `PASS: 9 checks, 4734 figures exact.` |
| from the click | `probe-screen.mjs --spec`: default 30/30, `--tp2` 24/24, `--qp` 33/33, `--pc` 7/7. Three view injections each FIRED on their own check. The reverted run was byte-identical, view and bundle |
| overlap sweep zero | 1240 to 1920, step 40, all states: **6354 pass, 0 fail** on the spec's margins, and **6354 / 6354 on the live margins**. **Calibration:** `percam-over-fee` FIRED in all 216 OPEX states and in no CAPEX state. A first 70px version came back SILENT. Measured, the ink gap is 94 to 128px, so the injection had never produced an overlap. It was widened to 160px rather than read as coverage |
| full gate | `npm run verify -- --round-close` with a browser, on `7534e3e`: **all 26 stages passed** (pure 806/806, database 105/105, react 1457/1457). It also passed on `0b7635e` before `CURRENT_STATE.md` was regenerated; that file is read by a gate stage, so it was re-gated. NordVPN not running; resolver 192.168.18.1; Supabase TCP 443 connects |
| merge --no-ff | `2ff3c72`. Its tree is identical to the gated branch tree |
| merged gate | **all 26 stages passed** on `2ff3c72`. Started after the watched server had restarted from the merge (11:10:45) and answered 200 |
| ls-remote re-check | `origin/main` is still `fbf0cfe`, an ancestor of HEAD: a fast-forward |
| revert rehearsal | in a temporary index. Reverse-applying the merge (`--binary`, for the PNGs) gives exactly `fbf0cfe`'s tree, and the real index tree hash was unchanged. The revert, when wanted, is `git revert -m 1 2ff3c72` |

`CURRENT_STATE.md` was regenerated at `0b7635e`. Its diff is soft-deleted fixture counts and tag
distances. Live records are unchanged at 134, and there is no schema or route change.

**Commits against what was done, counted.** The round ran in two stretches: the build, up to the
A3 stop, and the exit after John's approval. Every piece of work has a commit:

| commit | what |
|---|---|
| `b50a66a` | brief |
| `d2debc0` | spec |
| `c7e19aa` | engine |
| `4bad1e7` | column, probes and screenshots |
| `3efe2ff` | Part B report |
| `3d992e4` | rulings |
| `7861c66` | sweep |
| `0b7635e` | captures |
| `7534e3e` | `CURRENT_STATE.md` |
| `2ff3c72` | merge |

This close-out is markdown only and rides the green merged gate (rule 48a).

## 4. What surprised

1. **The live settings had moved under the probes.** John's 7 Oct change to the SafeSight anchor
   margin made every spec-figure probe fail at once (default 14/30, `--qp` 16/33). That was a
   fact about the data, not the code, and it was found by reading the settings route before
   reading any failure as a defect.
2. **The 1240 heading wrap was the new column's own doing.** It matches the CAPEX ladder's
   existing six-column wrap. Forcing one line would have overflowed the card under both
   structures.
3. **A silent calibration was the injection, not the sweep** (Verification 51's caveat). The
   number that settled it was the measured ink gap.
4. **The journal guard refused a hand append to the brief**, as it should. The brief was restored
   from `HEAD` by an explicit ref and the append routed through `scripts/edit.mjs`.
