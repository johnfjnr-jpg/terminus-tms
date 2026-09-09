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
