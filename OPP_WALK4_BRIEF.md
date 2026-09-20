# Opportunity walk round (walk 4): John's findings on the new surface

Branch `opp-walk4`, off `main` at `37a2196`, which was confirmed equal to
`origin/main` and to `git ls-remote origin main` before the branch was cut.

**NOTHING PUSHES.** Build discipline 18 governs every commit. The round ends
"ready for John's push" with the SHA.

**One stop, after Phase 0.**

---

## The findings, verbatim

These are John's words from the walk, recorded before anything is measured or
built, so a later phase cannot quietly reshape what was asked.

> **O1 DEFERRED by John:** the band's position below the chevrons is recorded
> as awaiting his feedback; nothing built, nothing moved.
>
> **O2:** the Notes card header collapses to one line: NOTES, LATEST FIRST and
> the range buttons together. The buttons-appear-beyond-two-notes behaviour is
> KEPT and becomes a guarded claim wherever the shared panel renders (all three
> surfaces).
>
> **O3:** the Opportunity Commercials tab sections reorder to: Structural
> Terms, Units/Installation, Payment Terms, Cash Flow, Deal Sheet, Versions.
>
> **O4:** Hybrid payment terms REBUILD to the initial prototype's shape: two
> panels, milestone payments and monthly hosting.
>
> **O5:** the Month field sizes to its two-character content.
>
> **O6:** the milestone grid's labels align to their fields (headers currently
> offset far right; partial input borders).
>
> **O7/O8 DESIGN-FIRST, build nothing:** the deal sheet pricing override panel
> per John's spec (Price/Unit switch with hover "Override the calculated Margin
> Price"; Value Pricing switch with hover "Selects the options to have units
> value priced based on use cases"; table Unit, Monthly fee, Warranty %,
> Monthly including Warranty, recalculated % Margin, rows Safesight, Safesight
> Value Priced, Air Quality, HEMIR; warranty entered as % of hardware cost per
> unit; warranty a separate deal sheet line item).

---

## What each finding is

| | Disposition |
|---|---|
| **O1** | **DEFERRED.** Recorded, awaiting John's feedback. Nothing built, nothing moved |
| **O2** | Build, and the kept behaviour becomes a GUARDED claim on all three surfaces |
| **O3** | Build, a reorder |
| **O4** | Build, a REBUILD to a prototype shape Phase 0 must first establish |
| **O5** | Build, sizing |
| **O6** | Build, alignment |
| **O7/O8** | **DESIGN FIRST. Build nothing.** Phase 0 maps the blast radius; John rules |

**O2, O3, O5 and O6 release for build on the Phase 0 report** unless Phase 0
finds a scope change in them. O4 and O7/O8 wait for John's ruling.

---

## Phase 0: measure before build

Builds nothing. Answers five questions and stops.

1. **The Commercials tab's current section order**, and what renders each, so
   O3's reorder cost is known rather than assumed.
2. **Hybrid payment terms: the current shape against the initial prototype's.**
   The prototype's definition is dug from the repository history, the deal
   sheet tool's spec, or wherever it is recorded. The report says what "as per
   the prototype" CONCRETELY means, **or reports that no record exists and it
   needs John's restatement.** A guess presented as a finding is the failure
   mode here.
3. **The Month field and the milestone grid:** the misalignment MECHANISM and
   the white border fragments, measured rather than described.
4. **For O7, the current pricing calculation end to end:** where the per-unit
   price is derived, what consumes it (deal sheet lines, contract value, cash
   flow, milestones), and what an override at the unit level would touch. **No
   design decisions. The map of the blast radius.**
5. **The Notes header row's current structure**, for O2's collapse.

**STOP after Phase 0 with the report.** O4's prototype answer and O7's
blast-radius map are John's ruling inputs.

---

## Standing method

- Every number describing a run is emitted by that run.
- Every new check calibrated both directions and scored on **which named
  assertion** failed, never on the exit code alone.
- A claim of absence names the instrument that could have seen the thing, and
  the scan is calibrated on a known-present case before its silence is read.
  This bites hardest on question 2: "no record of the prototype exists" is an
  absence, and an absence needs an instrument.
- Screenshots are opened and read. Layout claims state a **relationship between
  two elements**, never a CSS property one of them happens to use.
- Probes scope their selectors to the thing under test. This app keeps every
  screen resident, so a document-wide query answers for whatever is in the DOM.
- A defect this round's own change creates is part of the change; everything
  else is recorded and queued.

## Exit gate

Answered point by point at the close: every ruling built or recorded, rulings
appended at the phase that launched them, every new guard calibrated both ways,
live proof at both widths, read back from the database where written,
screenshots opened, fixtures torn down and re-queried by tag,
`CURRENT_STATE.md` regenerated and reconciled, the full gate run as the final
act on the final committed tree with nothing else running, and **merged or
pushed: no**.
