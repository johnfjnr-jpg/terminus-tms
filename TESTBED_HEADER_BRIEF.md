# The Test Bed header and cost carry-forward round: brief

Governing docs: CLAUDE.md, the tms-round-method skill,
UI_HYGIENE_CLOSE_OUT.md and its carried items. Drafted from John's
design 2026-09-09; re-verify premises against the tree you are on.
This brief's R-series is its own.

## Opening acts, before Phase 0

A1. THE PHANTOM SUITE ENTRY, first act, one commit.
    `package.json` names `scripts/tests/vanilla-coupling.test.mjs`
    in the pure suite. The file was deleted in `a763653` in Round
    6 and never removed from the list. Alone `node --test` exits
    1; ALONGSIDE A REAL FILE IT IS SILENTLY IGNORED, so the suite
    has reported green over a name resolving to nothing since
    then.
    Calibrated: the gate reconciles suite names against disk,
    shown FIRING on an injected phantom name and SILENT on the
    healthy tree.
A2. Nothing else. The vanilla retirement class stays CARRIED.

## Workstream 1: the Test Bed detail header

John's design, verbatim:

- Test Bed title in large font, Summary field displayed to its
  right.
- Below that, a stats strip: Total Cost, Duration, Hardware
  Numbers, Est Start Date, Proj End Date. HARDWARE NUMBERS IS ONE
  CELL showing three counts labelled SS / AQ / HM (SafeSight, Air
  Quality Sensor, HEMIR); name labels above numbers is an
  acceptable alternative - pick by what fits the strip style and
  RECORD THE CHOICE.
- Below the strip, a stage chevron in the same style as the
  Opportunity chevron BUT running the Test Bed's stages.
- Order top to bottom: title+summary, stats strip, chevron.

## Workstream 2: cost carry-forward

John's sentence, verbatim: when an Opportunity is created from a
Test Bed, the Test Bed's costs carry forward into the
opportunity's costs for consideration.

DATA FLOW, NOT DISPLAY. Phase 0 establishes the MECHANISM. No
design is assumed beyond that sentence, and no shape is proposed:
the shape is John's call.

### ANSWERED AT THE CLOSE, 2026-09-10. W2 IS CONFIRMED AS BUILT.

Ruled by John. **One snapshot number - `accumulated_cost` into
`test_bed_cost` at conversion, feeding TCV - is the DESIGN OF
RECORD.** No live link, no line items.

> If a future requirement wants the figure to track
> post-conversion cost changes, that is a NEW DESIGN ITEM, not a
> defect in this one.

**That clause is the reason this is recorded in the brief rather
than only in the close-out.** A snapshot that does not follow its
source reads as a bug to anybody meeting it without the ruling,
and the next person to notice it will look here first. It was
decided, it was not overlooked.

Phase 0 measured the mechanism rather than assuming it:
`src/routes/test-beds.js:1536` passes
`bedPayload.accumulated_cost` into `p_test_bed_cost`, and six
live bed/opportunity pairs agree exactly. Nothing was built for
W2 this round because nothing needed to be.

Verification 23 applies to whoever revisits this: the decision
exists, so search for it before taking a new one.

## Rulings of record (John, 2026-09-09, on the Phase 0 report)

R1. TOTAL COST IS TWO THINGS, NOT ONE: the first cost is an
    ESTIMATE, and ACTUALS must be monitored alongside it for
    comparison.

    **AND THE DISTINCTION DOES NOT EXIST IN THE DATA TODAY.**
    Measured after the ruling: 434 Test Beds carry both
    `indicativeCost` and `accumulated_cost`, and they are
    IDENTICAL in all 434 - zero divergence. `test-beds.js:915`
    writes both to the same value in one statement:

        { ...payload, accumulated_cost: costBreakdown.totalCost,
                      indicativeCost:   costBreakdown.totalCost }

    Both are a persisted mirror of `costBreakdown.totalCost`,
    computed from unit counts and rates. There is ONE cost number
    stored twice under two names, and NEITHER is an actual: there
    is nowhere in the record to enter what was really spent.

    So estimate-versus-actual is NEW WORK - a field, a write path
    and a place to enter it - not a display of something that
    exists. Phase 0's own report said the two fields were "two
    fields, one concept, which one the strip reads is a
    decision". That was right about the data and wrong about the
    intent, and the ruling has corrected it.

R2. HM IS HEMIR, and a Test Bed can include all hardware types.
    WHERE NONE IS SELECTED, DISPLAY 0 - not `--`, not hidden.

R3. NAMES ABOVE NUMBERS in the Hardware Numbers cell, rather
    than SS / AQ / HM labels.

R4. THE CARRY-FORWARD USES `accumulated_cost`, the actual figure.
    That is what the mechanism already passes
    (`test-beds.js:1536`), so the wiring is correct as built -
    but see R1: `accumulated_cost` is not an actual today, so
    what carries forward is the estimate under an actual's name.

R5. The door sweep was explained and no ruling was taken.

R6. ACTUALS ARE DROPPED. R1's estimate-versus-actual approach is
    withdrawn; no actuals field is built.

R7. INSTEAD: AN END DATE THAT IS CALCULATED AT START AND
    MONITORED. When a Test Bed starts, an end date is calculated,
    and the surface HIGHLIGHTS WHEN THE CURRENT DATE IS PAST IT.

    **MEASURED BEFORE SCOPING, and the requirement is well
    founded.** Nothing derives the end date today. There are
    THREE INDEPENDENT FIELDS with no arithmetic relating them:

        estimatedInstallationDate   start, entered
        estGoLiveDate               end, ENTERED - not derived
        testBedDuration             months, stored separately

    `dateBounds` only CONSTRAINS the end (min = start or today)
    and the server only validates ordering (end >= start).
    Nothing computes end from start plus duration.

    **On all 9 live Test Beds, which all carry all three fields:**

        start + duration matches the end date   1 of 9
        already past their end date             4 of 9

    The disagreements are not marginal - one bed records a
    36-month duration against 0.9 months of elapsed dates, and
    one records an END BEFORE ITS START (2026-08-25 against
    2026-08-29) while sitting in Installation and Commissioning.
    That last one should be refused by the server's ordering
    check, which fires only when a PATCH carries those keys, so
    it arrived by a path that did not.

    **Four of nine beds are overdue today and nothing says so**,
    including live ones at Installation and Commissioning and at
    Review and Completion.

    DECISIONS THIS NEEDS FROM JOHN, recorded rather than assumed:
    a. WHAT IS "START"? The entered `estimatedInstallationDate`,
       or the actual moment the record enters a stage such as
       Installation and Commissioning?
    b. IF THE END DATE BECOMES DERIVED, eight of nine existing
       beds get a different end date from the one stored. Does
       the calculated value REPLACE the stored one, sit beside it,
       or apply only to new records?
    c. WHAT DOES "HIGHLIGHT" MEAN on the strip - a colour on the
       Proj End cell, a separate overdue badge, or both?

R8. THE GO LIVE DATE, ruled 2026-09-10, superseding R7's open
    question (a).

    - A Test Bed GOES LIVE when Installation and Commissioning is
      COMPLETED. That moment is the ACTUAL START DATE.
    - The CALCULATED END DATE is go-live plus `testBedDuration`.
    - When the current date passes it, the strip HIGHLIGHTS the
      end date in RED - a red border or red highlight on that
      cell.

    **MEASURED, and three things follow.**

    (i) THE TRANSITION PATH DOES NOT WRITE THE PAYLOAD TODAY.
    `transitions.js:947` READS the current revision for gate
    checks and nothing appends. Stamping go-live means ADDING A
    WRITE to that path, and CLAUDE.md Verification 46 applies
    directly: `records` carries `refuse_write_while_frozen` and
    the append advisory lock, so a new writer inherits both. The
    record-freshness work hit exactly this and answered it with a
    table of its own. Whether the stamp lives in the payload or
    beside it is a Phase 1 design question, not an assumption.

    (ii) THE HISTORIC GO-LIVE MOMENT IS RECOVERABLE FROM DATA,
    so a backfill need not guess. `audit_log` records every
    transition with `from`, `to` and a timestamp, and the row
    where `from = "Installation and Commissioning"` dates it:

        3e69041d  Review and Completion   2026-08-19
        01212278  Closed                  2026-08-19
        264010b1  Closed                  2026-08-19
        ee10a68b  Closed                  2026-08-20
        37594c21  Closed                  2026-08-21
        2865d25c  Closed                  2026-08-21

    All six that have LEFT the stage are datable. The seventh,
    `9673244b`, is still AT it and so has not gone live - there is
    correctly nothing to recover.

    (iii) THE STORED END DATE BECOMES A SECOND READER. R7's
    measurement stands: `estGoLiveDate` is entered, and on 8 of 9
    live beds it disagrees with start plus duration. Once the end
    date is CALCULATED from go-live plus duration, the entered
    field is either superseded, or kept as a contracted date that
    the calculated one is compared against. Verification 20: two
    readers of one value drift, and this would be two by
    construction.

    OPEN FOR PHASE 1: whether `estGoLiveDate` is retired,
    repurposed as the contracted end, or left alone beside the
    new calculated value.

R9. `estGoLiveDate` IS REPURPOSED AS THE CONTRACTED END DATE.
    Existing records are test data: NO BACKFILL, and a record that
    trips the warning is a useful test rather than a problem.

    **THE READING THIS SETTLES, stated because two of the
    statements could otherwise be reconciled two ways.**

    "The calculated end date will be the go live date plus the
    duration, and when the current date goes beyond THAT date it
    should highlight it has gone beyond its CONTRACTED end date"
    could mean the red compares today against the CALCULATED
    date, or against a separately entered CONTRACTED one.

    "If it triggers the warning then great test" DECIDES IT.
    Existing beds carry no go-live stamp, so they have no
    calculated end; if the comparison were against a calculated
    value, no existing record could ever trip it and there would
    be nothing to test. Four of nine are already past their
    stored `estGoLiveDate`. So:

        estGoLiveDate   IS the contracted end date, one field
        at go-live      it is SET to go-live plus testBedDuration
        the highlight   today > estGoLiveDate  ->  red

    ONE field holds the contracted end. The calculation POPULATES
    it at go-live rather than competing with it, which also
    removes the two-readers problem R8(iii) raised: there is no
    second end date to drift.

    Records already carrying an entered value keep it untouched,
    and the four that are overdue exercise the warning on day one.

    IF THIS READING IS WRONG, the alternative is two fields and a
    calculated-versus-contracted comparison; say so at sign-off
    and Phase 1 takes that shape instead.

R10. THE READING IS CONFIRMED, and the write moment is precise.
    `estGoLiveDate` is ONE field, the contracted end.

    WRITE: once, INSIDE the existing stage-transition write, when
    a Test Bed transitions into its live stage:
    `estGoLiveDate = transition date + testBedDuration`. No new
    writer. No write on load.
    Phase 1 MEASURES, rather than assumes, that the transition
    write path can carry the payload key under
    `refuse_write_while_frozen` and the append advisory lock, and
    confirms existing live beds with manually entered dates need
    no backfill because the display check only READS.

    READ: the header computes `today > estGoLiveDate` at render
    and highlights red. Nothing stored, no flag.
    THE FOUR BEDS ALREADY PAST THEIR DATE ARE THE ACCEPTANCE
    TEST: they show red on first render.

R11. THE DOOR SWEEP IS EXTENDED TO THE TEST BED VIEW, in scope
    this round. Reuse the mechanism, the shared enumerator
    (`scripts/lib/enumerate-controls.mjs`) and the calibration
    harness as they stand. Calibrate on the Test Bed view BOTH
    WAYS: an unowned bed has its write controls neutralised with
    navigation and disclosure alive, an owned bed is untouched.
    THE NEW HEADER SHIPS ONTO A DOORED VIEW, NOT AN UNDOORED ONE.

R12. HM IS SUPPRESSED, SUPERSEDING R2. The Hardware Numbers cell
    shows SS and AQ; the HM slot renders ONLY when
    `hemirSensors` carries data. No zero is shown for an unused
    field.

    ~~R2: where none is selected, display 0.~~ Superseded. R2 was
    ruled before the measurement showed `hemirSensors` is carried
    by NO live bed, which would put a permanent 0 on every
    record for a field nobody uses.

## Phase 0: measurement only, read-only against product code after A1

1. Test Bed record fields: where Total Cost lives (stored or
   derived), whether Duration is stored or derived from the two
   dates, where Est Start and Proj End live, where the three
   hardware counts live (fields, line items, or derivable), and
   the Test Bed stage list FROM DATA.
2. The live Test Bed detail surface: React or vanilla, the mount,
   and whether any retired duplicate shadows it. THE ESTATE HAS
   THREE KNOWN `-vanilla` BLOCKS: measure, do not assume this
   screen is clean.
3. The Opportunity chevron: where its component lives and whether
   it takes stages AS DATA or hard-codes them. This decides reuse
   versus parameterise.
4. Create-from-test-bed: does the mechanism exist, where, and what
   it currently copies. IF IT DOES NOT EXIST, W2 IS BLOCKED ON
   DESIGN and Phase 0 says so rather than proposing one.
5. Where opportunity costs live, and what shape a carried-forward
   Test Bed cost would need - field, line item, or linked
   reference. REPORT THE OPTIONS WITH TRADE-OFFS AND TAKE NO
   POSITION.
6. Door check: the header is display-only, but confirm the new
   surface inherits the `is-not-mine` treatment and that the
   shared enumerator (`scripts/lib/enumerate-controls.mjs`, the
   structure of record under the previous round's R16) will see
   its controls if any are interactive.

Stop with the Phase 0 report: findings per item WITH THE
INSTRUMENT NAMED, W1 and W2 feasibility, and the decisions Phase 1
needs from John. Nothing pushes.
