# CONFIRM GOLDEN DEALS: BRIEF

Branch `confirm-goldens` off `main` at `44d70da`, confirmed equal to
`origin/main` by `ls-remote` before branching. Rule 18 governs. Ends "ready for
John's push".

**Smallest possible round.** No pricing, UI or schema changes. If a step appears
to require one, that is a STOP and a report, not an edit.

---

## WHAT HAPPENED, AND WHY THIS ROUND EXISTS

**John verified `GOLDEN_DEALS.md` by hand in Excel and confirms the figures,
2026-09-28.** This round runs 2026-09-29 and records his confirmation with his
own date, not today's.

The golden deals round closed with the acceptance suite deliberately
PROVISIONAL, on the reasoning that a green suite implying a confirmation nobody
gave is worse than no suite. That reasoning has now been satisfied in the only
way it could be: by John doing the checking.

---

## THE FIVE CHANGES

| | change |
|---|---|
| 1 | `expectations.json` status **PROVISIONAL to CONFIRMED**, with `confirmedBy` John Fryatt and `confirmedOn` 2026-09-28 |
| 2 | the gate stage renames **`golden deals (PROVISIONAL)` to `golden deals`** |
| 3 | the harness's green-run message states the figures are **John-confirmed**, and that pricing may not move without this suite going red and a re-confirmation |
| 4 | `DESIGN_PRINCIPLES.md` records the baseline of record |
| 5 | the flip is **calibrated**: the hand-flip refusal must still FIRE on a status lacking the name and date |

---

## THE DECISION TO RECORD

> **The four golden deals are the pricing acceptance baseline of record. Any
> intentional pricing change updates the goldens and requires John's
> re-confirmation by name and date.**

---

## WHY THE CALIBRATION IS THE POINT OF THE ROUND

The harness gained its name-and-date requirement BECAUSE a calibration found
that a bare hand-flip of the status left the suite green with the provisional
warning simply gone. **This round performs exactly that flip**, legitimately,
and the risk is that satisfying the guard is indistinguishable from disabling
it.

So the refusal is re-proved on the CONFIRMED status: a status carrying the name
and the date passes, and the same status with either field removed is still
red. Verification 9, on a guard whose one job is about to be exercised for the
first time in earnest.

---

## THE CLOSE

Both gates, CURRENT_STATE, close-out, `ls-remote` equality at merge, "ready for
John's push". Any red: STOP.

Reports per M6.
