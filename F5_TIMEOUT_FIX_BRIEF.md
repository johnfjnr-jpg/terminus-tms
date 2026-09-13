# The F5 statement-timeout fix round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill. Drafted 2026-09-13; re-verify every premise against the tree you are
on. This brief's R-series is its own.

**GATE RACE FIX IS COMMITTED LOCALLY, PROVEN AND NOT PUSHED.** Three gates,
zero invariants red, forced reproduction dead. It holds until the gate is
genuinely clean, which is now gated on F5. **Both push together when green**,
along with PROBE INVENTORY's two commits.

## Rulings of record (John, 2026-09-13)

R1. **NO THIRD REACTIVE STEP-DOWN.** F5 has been tightened reactively twice
    already - `TAG_CHUNK_SIZE` 25 -> 6 -> 3, the second on variance. The
    standing ruling is that the next time F5 is in scope, the **ceiling
    DERIVATION is reviewed**. This round honours that.
R2. **THE TREND IS MEASURED, NOT INHERITED.** The three gates of the
    race-fix close do NOT prove "the failing case climbs while the passing
    one stays flat": the failing run was the FASTEST at test level, because
    the test aborts at its first failing assertion. The comparable figure is
    the heaviest chunk at 1178ms, which passing gates do not report. **The
    trend is an earlier finding and Phase 0 re-measures it.**
R3. **IF THE COST DOES NOT GROW, F5 IS VARIANCE AND NOT A CLOCK**, and the
    fix differs. Measure before concluding.
R4. Prefer the STRUCTURAL fix if achievable: **flat cost as the table grows
    is the only fix that does not recur.**
R5. Method unchanged: phases stop for sign-off, nothing pushes without the
    word.

## What is known

`scripts/tests/teardown-scoping.test.mjs` times the heaviest chunk
`tearDown` will run and asserts it under a ceiling:

```
CEILING = 8000ms timeout / 6x cold / 1.5x margin = 889ms
gate 2:  1178ms warm over 9788 rows in 3 tags   -> RED
```

The statement is
`record_revisions.select('id, record_id').or(payload->>name.ilike.<tag>%, ...).range(0,999)`,
run once per chunk of `TAG_CHUNK_SIZE` tags.

It converted **1 of 3 gates** in the race-fix close to red, with zero
invariants red - so it is unrelated to the race and is now the thing
standing between this estate and a clean gate.

## Phase 0: measurement only

1. **MEASURE THE TREND the three gates could not.** Time the heaviest-chunk
   statement across several tag counts and against the table's row count.
   Establish BOTH claims the trend rests on:
   - does per-statement cost genuinely grow with the table?
   - is the passing case flat?
   **A hypothesis worth testing first, because it decides everything:**
   `payload->>name ilike '<tag>%'` is unlikely to be index-backed, in which
   case **every chunk scans the whole table regardless of tag count** - and
   `TAG_CHUNK_SIZE` is not the lever at all. If that holds, lowering it does
   MORE full scans, not less work, which would explain why two reactive
   step-downs did not hold.
2. **The ceiling derivation.** 889ms = 8000 / 6 / 1.5. Against the measured
   growth rate, is the margin real, or is the ceiling crossed by ordinary
   variance?
3. **Structural options, with reasoning and a recommendation:**
   - **(a) DERIVATION FIX** - re-derive with real margin over measured
     growth. Buys time; growth continues.
   - **(b) STRUCTURAL FIX** - bound the scan so per-statement work CANNOT
     grow with the table. The durable one, and teardown-integrity's original
     HARDEN intent.
   - **(c) A THIRD `TAG_CHUNK` STEP-DOWN** - **REJECTED** unless Phase 0
     measures the growth as genuinely bounded and a one-time step correct.

Stop for sign-off.

## Phase 1: the fix

Apply the recommended fix. **Load-bearing proof: the heaviest chunk's cost
is FLAT, or bounded with real margin, against the growth variable, and
PROJECTED FORWARD** - not merely passing at today's row count.

**And calibrate the other half**: the test must still FAIL if the scan
cannot complete its coverage. **The exact-count-of-rows-walked assertion
stays** - a scan that passes by examining fewer rows is worse than the
timeout it replaced. Stop for sign-off.

## Phase 2: gate and close

Gate **at least three times** - the same base-rate logic, since one green
proves little for a defect that is intermittent under growth.
`PUPPETEER_PATH` set and the precondition checked BEFORE launch; F6 must not
fire. Reconciliation by counting, revert rehearsed with the boundary stated,
`CURRENT_STATE` staleness both halves.

**Then PUSH ALL TOGETHER once the gate is genuinely clean across multiple
runs**: PROBE INVENTORY (2 commits), GATE RACE FIX (4), and this round.
Nothing pushes without the word.


## Rulings appended at Phase 1 (John, 2026-09-13)

R6. Fix approach ACCEPTED: a robust statistic over N samples plus a
    SEPARATE, looser cold-tail bound. The expression index is PARKED - it
    removes the 126ms small term and leaves the 3.7x binding one, and needs
    its own migration ruling.
R7. Both halves proven or it is not the fix: it must not fail on the jitter
    that failed gate 2, AND it must still fail on a real cost increase.
    Coverage stays proven (rows walked == exact count).
