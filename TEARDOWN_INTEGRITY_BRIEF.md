# The teardown integrity round: brief

Governing docs, read before anything: `CLAUDE.md` and the `tms-round-method`
skill. **The carried list at `TESTBED_HEADER_CLOSE_OUT.md` section 9 is this
round's source of record**, in John's order. Drafted from measurement taken at
the Test Bed round's close; re-verify premises against the tree you are on.
This brief's R-series is its own and shares no range with any other document.

## Rulings of record (John, 2026-09-10)

R1. **Opening act A1, before anything else: the blind tag query.** Carried
    item 1, ruled first. `tearDown`'s tag branch reads at most **1,000 of
    23,066 rows** - no range, no order, PostgREST's page cap. Fix by
    paginating or filtering the query so the candidate set is the full
    population.

R2. **A1's calibration requirements, NON-NEGOTIABLE.** Each clause exists
    because a weaker version of it has already produced a false green in this
    estate:
    - Run against a population **LARGER than the page cap**. A page-sized
      population goes green while proving nothing, and **that shape is what
      produced the finding.**
    - Shown reaching a record placed **beyond row 1,000**, in **both
      directions**: swept when tagged, untouched when not.
    - **The count instrument itself must be exact, not paged.** The Test Bed
      close-out's sweep script hit the same cap one screen below its own
      documentation. **Any count in this round's evidence states how it was
      taken.**
    - Harness discipline in full: `fixtures.mjs` byte-identical after
      injections, and the existing five-injection suite still firing.

R3. **On completion the 96%-blind asterisk LIFTS from teardown claims, and the
    phase report says so explicitly.** Until then it stands.

R4. **Phase 0 is measurement only, after A1.** Three items, below. No
    conversions, no retirements.

R5. **Carried items 4 and 5 are NOT in scope** - the 19 routes unexercised as
    a non-owner and concurrency; the `complete-document` disagreement. They
    stay carried. **If Phase 0 findings force either in, FLAG IT** rather than
    absorbing it.

R6. Method unchanged: phases stop for sign-off, data changes proposed before
    applied, the final-act gate on the exact tree, nothing pushes without the
    word, and the word follows the stated gate result.

## Why this round exists

Teardown is the estate's only defence against fixture residue reaching the
business's own list views, and it has now been wrong twice in ways nothing
could see. The owner-scoped sweep destroyed 66 evidence records mid-gate; the
tag-scoped sweep that replaced it silently reads 4% of its population.

**The second failure is quieter than the first and that is the point.** A
destructive sweep announces itself. A blind one leaves records behind, reports
success, and the residue is found rounds later by somebody counting.

## Opening act A1: the blind tag query

Per R1 and R2. The deliverable is the fix plus its calibration evidence, and
the evidence is what the phase report is judged on rather than the diff.

**The page cap is not the only hazard in that query and the fix should say so
if it finds others.** A `.or()` string grows with the tag ledger; an `.in()`
list grows with the candidate set; and range paging without a stable `ORDER BY`
can duplicate or skip rows, which is a correctness fault the page cap was
hiding rather than a second opinion about it.

## Phase 0: measurement only

1. **The 13 remaining raw-handover call sites** (carried item 2). Classify each
   as **historical** (will never run again) or **live**, BY EVIDENCE: last
   invocation, referenced by any suite or gate stage, or reachable from a
   current probe. **No conversions yet** - the split decides Phase 1's scope.

2. **The page-cap audit.** Every other unranged select in `scripts/` and in the
   gate's suites, measured against the cap. **The pattern has now appeared
   three times.** Measure how many more instances exist before they surface one
   at a time.

3. **The vanilla retirement class** (carried item 3). Measure what retiring the
   three `-vanilla` blocks requires: what references them, what the tripwires
   currently guard, and what breaks on removal. **Findings only** - the
   retirement is its own scoped change.

**Stop with the Phase 0 report:** A1's calibration evidence, the 13-site
classification, the page-cap audit count, the retirement measurement, and the
decisions Phase 1 needs from John. Nothing pushes.
