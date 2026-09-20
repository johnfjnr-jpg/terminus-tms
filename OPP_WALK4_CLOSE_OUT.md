# Opportunity walk round (walk 4): close-out

Branch `opp-walk4`, off `main` at `37a2196`, which was also `origin/main` when
the branch was cut. **Nothing merged, nothing pushed.**

---

## 1. The rulings, and where each landed

Counted against the rulings John gave on 2026-09-20, not against the brief's
own headings. Build discipline 7: the brief is not a reliable source for the
count, and a ruling that launches work is part of that work's record.

| | Ruling | Commit | Landed |
|---|---|---|---|
| **R-O5/O6** | One grid replaces two nested tables, the prototype's `44px 195px 44px 64px` adopted for header, data and total rows; header-field alignment guarded on the live DOM; the descendant border fragments die with the nested table | `9b89ee7` | Yes, and **corrected at R-O4**: the columns were taken and the gap was not. See section 3 |
| **R-O3** | The sections take the ruled order, WITH a new rendered-order guard on the live `DealPanel`; the three existing order assertions dispositioned | `05c4980` | Yes |
| **R-O2** | The Notes header collapses to one line per surface WHERE MEASURED TO FIT; the lead card's exception stands unless remeasurement shows otherwise; the beyond-two-notes behaviour guarded on all three surfaces | `516abc4` | Yes. A1's exception **remeasured and it stands** |
| **R-O4** | The hybrid rebuilds to the prototype: side-by-side grid per its own spec, `hybridSchedule` wired to `buildYearSchedule` | `4982fa9` | Yes |
| **R-O7** | The override at the existing per-product-type grain, flowing through `rawTotalPrice` | `d8649ef` | Yes |
| **R-O8** | Warranty OUT of the override entirely; display half only, `hwWarranty` as its own deal sheet line, warranty-inclusive recorded in the help text | `d8649ef` | Yes, with R-O7 as ruled |
| **O1** | **DEFERRED by John.** The band's position below the chevrons is recorded, awaiting feedback | - | Nothing built, nothing moved |

**Six rulings, five build commits**, R-O7 and R-O8 landing together because the
ruling grouped them: "R-O7 as the round's core with O8's display line."

---

## 2. What the verification changed before any build began

The rider asked for the scouting Phase 0 to be **verified rather than trusted**.
All five claims were re-measured independently and all five agreed, and the pass
found **two errors of my own** in the Phase 0 report (`9849321`):

- I claimed warranty needed a group-structure change. `hwWarranty` has been its
  own keyed row since the 2026-09-16 correction, so R-O8's display half was a
  presentation change and nothing else.
- I claimed the hybrid already had two panels. `hybridSchedule={null}` means
  panel two was radio buttons and nothing else, and **the evidence was in my own
  output** - `"InvoicingAnnual in advanceMonthly"` with no schedule after it.

Both corrections shrank the work rather than growing it, which is the argument
for the rider.

---

## 3. The correction to this round's own R-O5/O6

**Recorded rather than quietly adjusted.** R-O5/O6 ruled that the prototype's
grid is adopted for the header, data and total rows. Its **columns** were taken
and its **gap** was not: all three occurrences in `Terminus Ops.dc.html` (lines
1637, 1641, 1652) read `gap:4px`, and R-O5/O6 shipped `8px`.

**No guard could have seen it.** The header and the rows shared whatever number
was there, so alignment held either way. The departure was from the SPEC rather
than from internal consistency, and it was not recorded at the time because it
was not noticed. Corrected in `4982fa9`.

---

## 4. The guards that caught this round, none of them remembered

Five, all working as written, all catching me:

- **The approval-page invariant** went red naming `hostingPriceMode` and
  `hostingUnitFees` as priced keys no bridge step claimed. That is how they
  reached the bridge's discount-or-override step, which is exactly what R-O7
  asked for ("the approval version bridge inherit") and what I would otherwise
  have had to remember.
- **`deal-save-routes`** refused both keys as raising no section save. Its own
  comment records what that gap cost last time: eight of twenty-six keys raised
  no save button, and a walk found it because nothing in the suite could.
- **The deal-inputs golden** refused a `priceOverride: null` on every hosting
  line. The key is now attached only when a fee exists, so a deal without an
  override translates byte for byte as it always did and the golden goes on
  guarding what it was written to guard.
- **The journal guard** refused the R-O7 commit, because the payload-side tests
  were APPENDED with a heredoc rather than routed through `scripts/edit.mjs`.
  Re-applied through the tool and confirmed byte-identical to the file every
  suite had been run against.
- **The pre-commit hook** refused the R-O2 commit on a typecheck failure. My own
  typecheck had run BEFORE the last two edits to that test, so it was green on a
  tree that no longer existed.

---

## 5. What only a database read-back could see

**The round's real defect.** R-O7's client sent both new payload keys. The react
suite proved it sent them. The PATCH answered **200** and wrote a **new
revision**. `SALESPERSON_WRITABLE_KEYS` in `src/routes/opportunities.js` dropped
them, because a key outside that allowlist is **carried forward silently rather
than refused**.

So the card recalculated, every headline figure moved, the record did not
change, and **nothing on either side reported a failure**.

It is calibrated as the pair, which is the part worth keeping: with the keys
removed from the route again, the database check fires **while CONTRACT NET
still moves on screen**. A screen-only probe passes on the defect.

---

## 6. What the screenshots found that assertions could not

**Three times**, and each was invisible to every check that had been written:

- **R-O2.** The probe reported the header as WRAPPED on a header that was
  plainly one line: equal-tops is the wrong test once the items on a line have
  different heights. Then the opposite - once the row test was right, the
  screenshot showed **ADD NOTE clipped against the follow-up card** at 1240,
  while `elementFromPoint` at the button's centre still returned the button.
- **R-O4.** The first capture was of the record band, the hybrid group being at
  y=2147. Every assertion passed on an image containing none of the claim.
- **R-O7.** In fee mode the Total row kept the margin table's **four** columns,
  so the total price sat under the heading `% Margin`. Present, correct to the
  dollar, right ids, wrong column.

---

## 7. Calibration, in both directions

| What | Result |
|---|---|
| R-O2 containment guard | **5/5**. Silent healthy; fires on the Opportunity AND the lead card when the scoped rules are pointed at nothing; an unrelated behaviour check stays green; returns |
| R1c, widened not relaxed | **2/2**. Red when `data-panel-title` goes, red when the section loses its name |
| R-O4, two claims | **6/6**, injected SEPARATELY because built into one run they mask each other: with the schedule gone there is nothing in the right panel for a side-by-side measurement to be about |
| R-O7 pure | **9/9**, including one **expected silence**, explained rather than ignored: the cost-only Test Bed path drops `priceOverride`, and no caller passes one today, so the guard is Architecture 8 rather than a live fix |
| R-O7/R-O8 screen and record | **7/7**, including the screen-versus-record pair above |

---

## 8. Findings raised and QUEUED, not built

Build discipline 10: a control finding goes on the list unless it is destroying
live data.

1. **The milestone USD has two readers.** `MilestoneGrid`'s USD column derives
   from `pct x oneOffPrice`; `customerScheduleWarning` and `readMilestones` read
   the **stored** `usd` from the payload. `onMilestoneTyped` only writes the
   derived figure when a **pct is typed**, so changing the UNITS after setting
   milestones leaves the screen showing one number and the save writing another.
   **Reasoned from source, NOT measured** - it was visible in the R-O4
   screenshot, where the fixture's own inconsistency made the grid read
   `189489.60` while the amber warning totalled `$100,000`. It needs its own
   round and a measurement pass.
2. `#ref-vanilla`'s eleven ids (carried from the Opportunity round).
3. `ref-save-feedback`'s dual naming (carried).
4. The orphaned `.tab-action-idle` rule (carried).
5. `input.input-invalid` with no applier (carried).
6. **O1**, deferred by John and awaiting feedback.

---

## 9. The position taken where the ruling was silent

**R-O7's "monthly fee per unit type" is read as the fee for ONE UNIT**, so a
type's hosting price is `fee x that type's unit count`. The switch is named
**Price/Unit**, which is the reading that name carries, and the derived margin
is identical under either reading because margin is scale-invariant. **What
differs is the total price**, so this is stated rather than buried: recorded
here, revisitable, and asserted in `deal-inputs.test.mjs` so a change of mind
is one test away from visible.

**The Cost column is dropped while the override is on**, because the ruling
names three columns - Unit, Monthly fee, % Margin - and the margin IS the
readout of the fee against the cost.

---

## 10. Exit gate

| Point | Answer |
|---|---|
| Every ruling built or recorded | Yes, section 1 |
| Rulings appended at the phase they launched | Yes, `b75a805` |
| Every new guard calibrated both directions | Yes, section 7 |
| Live proof at both widths | Yes: R-O2 26/26, R-O4 24/24, R-O7 28/28, all at 1440 and 1240 |
| Read back from the database | Yes: R-O4's hybrid structure, R-O7's mode and fee |
| Screenshots opened and read | Yes, and they found three defects, section 6 |
| Fixtures torn down | Yes, re-queried: **zero live records owned by the probe account** |
| `CURRENT_STATE.md` regenerated and reconciled | Section 11 |
| Full gate | Section 11 |
| Merged or pushed | **No.** Rule 18: this round ends "ready for John's push" |

---

## 11. `CURRENT_STATE.md` and the gate

### Regenerated and reconciled

Regenerated at `d8649ef` with a clean tree, so the file carries no
`(working tree dirty)` marker. The diff is 27 lines changed and **every one is
a row count**:

- **live counts are unchanged in every row**, which agrees with the residue
  query above: no fixture survived the round;
- soft-deleted rows grew, which is what a soft delete leaves behind;
- the two tag distances moved by this branch's commit count;
- and **`SALESPERSON_WRITABLE_KEYS` now records `hostingPriceMode` and
  `hostingUnitFees`**, which is R-O7 reaching the generated file.

No configuration row changed: no stage gate rule, no record type, no schema.
This round changed code, tests and one route allowlist, and the diff says so.

### The full gate

Recorded verbatim in section 12 once run, as the final act on the final
committed tree with nothing else running.
