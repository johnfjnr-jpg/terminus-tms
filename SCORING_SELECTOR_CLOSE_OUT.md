# Scoring selector round (V9): close-out

Branch `scoring-selector`, off merged `main` at `8e985b2`, which is also
`origin/main`. **Nothing merged, nothing pushed.**

---

## 1. The rulings, and where each landed

| | Ruling | Landed |
|---|---|---|
| **R1** | Five inline buttons, 2 and 4 bare | Step 3b |
| **R2** | Option B: the anchor renders through the shared floating popup; the Test Bed is a **caller** | Step 3a (the module) and 3b (the caller) |
| **R3** | Keyboard per the R-K standard, the popup following focus | Step 3b, proven live |
| **R4** | Show definitions removed; data and route untouched | Step 3b |
| **R5** | Measurability and awaiting-reason untouched | Asserted, and Phase 0 measured why it needed saying |
| **R6** | The popup dismisses on selection; at most one renders | Its own commit, proven on the Opportunity first |
| **R7** | The Budget figure only at a figure-bearing level | Its own commit, its own live proof |
| **F-COM** | Rides the round; closes B2 | Its own commit |
| **F-TOP** | Does not ride; opens the next round | Recorded in the brief |
| **Step 0** | `walk-3` deleted; the park nag becomes a warning | Its own commit |

---

## 2. What Phase 0 changed about the round

**R2 was ruled on a measurement, not a preference.** A reserved in-row region
sized for the longest anchor (302 characters) costs **120px per row at 1240**
against a row head of 77px — roughly 600px across five criteria, empty until
hovered. The Opportunity had already measured the in-row cost at 36px and chosen
to float. Phase 0 surfaced that as a Verification 23 conflict and stopped rather
than building either.

**Three other measurements shaped the build:** scores 2 and 4 have **zero**
anchor rows, so "bare numbers" is grounded in the data; the select set a **draft**
rather than writing, so "commits" means the draft; and ArrowDown on the select
changed nothing, so R3's arrows were free to take.

---

## 3. The superseded-control disposition list

Replacing a control is finished when every caller has a disposition
(Verification 41). **66 call sites across 14 files.**

| Where | Disposition |
|---|---|
| `stage-panels-walk2`, `stage-panels`, `testbed-scoring`, `testbed-stage-surface` | **Re-pointed**, through one shared helper rather than 40 rewrites |
| `scoring-buttons.test.tsx` | **New**, the control's own guards |
| `scripts/scoring/probe-p0.mjs`, `probe-step3-live.mjs` | **Current**, this round's own |
| `probe-walk2`, `probe-p2-score`, `probe-p3-addenda`, `probe-w34`, `probe-pilot`, `probe-w5-pairs`, `probe-v8`, `testbed-core/probe-p0` | **STALE, and left so deliberately.** All eight are UNWIRED and none is in the gate: they are round-specific probes that proved a claim once and will not run again. Re-pointing code nothing executes would be an unverifiable edit to eight files. **Named here so the next reader does not mistake them for coverage** |

**That last row is the honest half.** Those eight cannot be run to prove the
re-point worked, so editing them would be a change whose correctness nothing
could check.

---

## 4. Guards that caught the round

Three, all working exactly as written, all catching me:

- **The attention completeness list** went red at 19 bindings against 18: the
  shared popup's level label is a new `--attention` site and I had not told the
  list. The pre-commit hook refused the commit.
- **The seam ledger** refused three services it had no record of. Each now says
  why it crosses and what the alternative was.
- **`git branch -d`** would have refused an unmerged `walk-3`; it was also
  checked with `merge-base --is-ancestor` first.

---

## 5. What the screenshots found that assertions could not

**Twice, a probe passed while the screen was wrong.**

- Step 3's live probe reported **34/34** with the score buttons rendering as
  **white browser defaults** and the anchor popup **587px above** the number it
  explains.
- The assertions asked whether the popup was shown, clamped and dismissed —
  every one of which is **true of a box parked anywhere in the document**.

**This is a shape `CLAUDE.md` already records**, about a type-ahead dropdown that
asserted `position: absolute` and an unchanged height. I wrote it again knowing
it. The replacement guard states the claim as **two elements and a relation** and
reported `-587px` before, `0px` after.

---

## 6. Carried

1. **`Record scores` is a white browser default.** Predates this round, outside
   F-COM's Commercials scope.
2. **F-TOP**, split as measured: summary and notes as a third caller of the
   shared components; the follow-up task as a designed feature with data and
   routes to build.
3. **The `--red` hygiene item**, joining that round.
4. **Eight stale unwired probes**, section 3.

---

## 7. Exit gate

| Point | Answer |
|---|---|
| Every ruling built or recorded | Yes, section 1 |
| Rulings appended at the phase they launched | Yes |
| Every new guard calibrated both directions | Red-first on each: 14/15, 2/6, 3/8, 4/6 |
| Live proof at both widths | 38/38 at 1440 and 1240 |
| Read back from the database | Yes, entries 0 → 1, revision 1 → 2 |
| Screenshots opened and read | Yes, and they found two defects |
| Superseded control's callers dispositioned | Yes, section 3 |
| Fixtures torn down | Yes, re-queried by tag, zero remaining |
| `CURRENT_STATE.md` regenerated | Section 8 |
| Full gate | Section 8 |
| Merged or pushed | **No** |
