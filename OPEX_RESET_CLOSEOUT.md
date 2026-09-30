# OPEX_RESET: CLOSE-OUT

Branch `opex-reset` off `main` at `518c591`.

---

## 1. WHAT WAS BUILT

**R-RS1 to R-RS4**, the Reset to target margin control on the OPEX table, and
**W-LC1**, one word for one absence on the two version fields.

**P-RS1 (John, 2026-09-30)**: the fee table and the control share
`.opex-fee-block`, which takes the table's grid placement, so the control
follows the table's last row.

---

## 2. THE BRIEF'S COPY, CORRECTED

**R-RS3 as briefed** read:

> No confirmation dialog: the form goes dirty and the sticky Save/Discard bar
> governs; Discard restores the overrides.

**R-RS3 as amended by John, 2026-09-30. The Discard clause is STRUCK:**

> No confirmation dialog. The reset writes nothing until Save, and reopening
> the record restores the overrides.

**Why the original was wrong, measured rather than reasoned.** The Commercials
surface has no Discard control. Enumerated across the estate, every Discard is
`SaveControl` (leads Summary), `NotesHistory` (two), `ContactPanel`, and
`#discard-confirm-discard`, which is the navigate-away MODAL. That modal does
not fire for this form either: `navigate()`'s guard (`frontend/app.js:359`) is
`oppAssessNavigationDiscards`, assessment drafts only.

**Proved over HTTP instead**, which is a stronger claim than a button press:
after the click the server still holds `{"ss":700}` and `{"aq":41}`, and
reopening the record brings both back.

**The same sentence had been copied into three places** - a `DealPanel.tsx`
comment, the test file's header, and a test's inline note - before it was
measured. All three are corrected at their sites. A sentence typed into a
comment is derived from nothing and cannot be falsified, which is the fault
this estate records repeatedly and which I committed here.

---

## 3. EVIDENCE

### P-RS1 (1): the rows have not moved

**Baseline taken on `main` at `518c591` BEFORE candidate B existed** and
committed as `scripts/baselines/opex-row-levels-main.json`. A baseline
regenerated beside the change would agree with the change by construction.

    4/4 states BYTE-IDENTICAL to main
    overrides-present@1920  overrides-present@1240
    no-overrides@1920       no-overrides@1240

The comparison is over the WHOLE measurement - every fee row and invoicing row
top, left, right and height, the table's box, the grid width - not the levels
alone, because a change moving the table and the invoicing block together
would leave the levels identical and the screen different. Levels `[0, -2, -4]`
at both widths, in both states, on both trees.

**CALIBRATED IN BOTH DIRECTIONS.** Injecting a break in the re-pointed
`margin-top` rule:

    healthy    4/4 byte-identical                       exit 0
    injected   4 of 4 MOVED, levels [0,-2,-4] -> [4,2,0]  exit 1
               table top 42 -> 46, the 4px stagger returning
    restored   byte-identical to the snapshot
    reverted   4/4 byte-identical                       exit 0

### P-RS1 (2) and (3): where the control sits

    within 40px below the table     26px
    inside the table's column       yes
    right edge vs the table's       0px, AT 1920

**The 1240 right-edge check is out of scope**, per the ruling, and the reason is
stated at the assertion site rather than left implicit. At 1240 the invoicing
column collides with the fee table (Q1), so the table's measured right edge runs
under it and reads 77px wide of the control - **identically in both placement
candidates**, which is how it was established to be the overprint and not this
control. When Q1 lands, the assertion extends to 1240 and the exclusion goes.

### The rest

    E1  goldens        4,734 figures exact across G1 to G5, 9 checks
    E2  live probe     42/42 from the click, on three deals the route saved
    E3  label          30% and 41.5% on two deals
    E4  suites         pure 706, react 1457, typecheck clean, database green
    E5  W-LC1          16/16, both widths, with a real counterfactual (V2.0)

---

## 4. THE DEFECT THIS ROUND CAUSED, AND THE ONE IT ALMOST SHIPPED

**The control first rendered ABOVE the table**, and five assertions passed on it:
present, labelled, carrying the deal's target, wearing `.btn-sm`, carrying its
icon. Every one is a property OF THE CONTROL; the claim is its position RELATIVE
TO THE TABLE. Found by opening the screenshot. Cause: `.opex-tables` places every
child by hand, so an unplaced child is auto-placed into row 1 column 1.

**Then, while re-pointing the rules for candidate B, a comment edit left prose as
RAW TEXT in the stylesheet**, which swallowed the `margin-top: 0` rule and moved
the rows by 4px. **The comment delimiters stayed balanced at 564 each**, so a
count would have reported the file healthy - which is why the round measured the
pairing and the brace structure rather than the totals, and why assertion (1) is
a byte comparison against a committed baseline rather than a tolerance.

---

## 5. QUEUED, NOT BUILT (John's order, 2026-09-30)

| | item | tier |
|---|---|---|
| **Q1** | OPEX card overprint at 1240. Fix, and FIRST establish why the ink guard missed it | |
| **Q2** | Unsaved-changes guard on the deal form: navigate-away warning plus in-place Discard | behaviour; mockup first |
| **Q3** | Golden status per deal: demote only a deal whose pinned figures move | |
| **Q4** | Header TCV "as saved" caption | pending ruling |
| **Q5** | `useCatalogRates` `staleTime: Infinity`: a panel open across a catalog change prices from the old batch | report only |

**Goldens: nothing stamped in this round.** G1 and G5 await John's Excel check;
G2 to G4 re-stamping awaits his ruling. The status reads PROVISIONAL because
`compute.mjs:308` returns it there on any re-run, which R-TL1 triggered in
TEST_LOG_1.

---

## 6. PROBES ADDED

| probe | claim | wiring |
|---|---|---|
| `probe-e2-opex-reset.mjs` | R-RS1 to R-RS4 and P-RS1 (2)(3) from the click | unwired: browser, server, session |
| `probe-opex-row-levels.mjs` | P-RS1 (1) against the committed baseline | unwired: browser, server, session |
| `probe-wlc1-version-fields.mjs` | W-LC1 at both widths, with counterfactual | unwired: browser, server, session |
| `photograph-reset-placement.mjs` | the two placement candidates, measured | unwired: browser, server, session |

---

## 7. MY OWN INSTRUMENT FAULTS

1. A document-wide `[role="dialog"]` answered for the shell, not the click, and
   went red on a healthy product. Now counts VISIBLE dialogs before and after,
   with a calibration that reveals a modal and watches the counter reach one.
2. A wait the previous record already satisfied: the W-LC1 counterfactual read
   "None" for a record the route says holds V2.0. Reloads first now.
3. Two probes run concurrently, timing one out at a real 25s wait, against the
   rule that a run is the final act with nothing else running.
4. The crashed run skipped teardown. Swept: `remaining: 0` on all five tags.
5. A stale assertion re-pointed in `opportunity-headline.test.mjs:117`.
