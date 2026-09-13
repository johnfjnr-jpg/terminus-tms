# The probe inventory round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill. Drafted 2026-09-13 against `origin/main` at `e9575f7`; re-verify
every premise against the tree you are on. This brief's R-series is its own.

**THIS IS A MEASUREMENT ROUND. It produces an inventory and findings, NOT
product changes. Nothing found is fixed here.**

## Rulings of record (John, 2026-09-13)

R1. Scope: measurement only, read-only. Findings are **recorded and
    prioritised for later rounds**, never fixed in passing.
R2. **THE SWEEP IS CALIBRATED BEFORE IT IS TRUSTED, both directions, on
    KNOWN cases**, per question. A sweep hunting blind instruments that is
    itself blind produces a clean inventory of nothing. If it cannot tell a
    rotted probe from a healthy one on cases whose answer is already known,
    it is fixed before it is run on the population.
R3. **Q3 CANNOT BE EXHAUSTIVE AND MUST NOT CLAIM TO BE.** It is scoped to a
    NAMED, MEASURED sample plus the known families, and the report says so
    in those words.
R4. Method unchanged: Phase 0 stops for sign-off, nothing pushes without
    the word, rulings appended at the phase they launch.

## Why this round exists

Three consecutive rounds found probes that measure nothing, the wrong
thing, or are not wired to run at all:

- **Round B.** `probe-gated-fields-reachable.mjs` had been dead for two
  rounds, dying on its first call. **It is not a gate stage, so nothing ran
  it**, and the estate went on counting it as coverage.
- **NEW LEAD GRID WIDTH.** Four blind instruments, three of them
  scrollbar-blind, and the measured conclusion that **every scrollbar
  reading this estate has ever taken headless has been blind**. The fourth
  was in that round's own probe and destroyed the measurement it was taking.
- **Round A (LEADS CARD CLEANUP).** A probe that was correct, calibrated
  AND non-vacuous, read `scrollTop` while 3500px of content scrolled
  horizontally, and **passed on a visibly broken screen**.

This is the estate's own "unenforced things rot" pattern arriving **inside
the test suite**. Verification 9's newest clause names it: a detector
nothing schedules rots, and every other clause in that rule begins by
executing the thing, so none of them can see it.

**Before R1's surface swap, the feature rounds, or the Sections 6-11 walk
lean on probes, we need to know which probes can be trusted.**

## The three questions

**Q1 - WIRING.** Which probes and tests are NOT wired to any gate stage, so
nothing runs them? Enumerate `scripts/**` and the test files against what
`package.json` and `scripts/verify-all.mjs` actually execute. **Unwired
means it can rot silently.**

**Q2 - RUNNING BUT ROTTED.** Of the wired ones, which are currently
failing, skipped, or asserting on markup and identifiers that no longer
exist? A test that runs and has silently broken.

**Q3 - BLIND.** Which probes measure a property that a broken state also
satisfies? Prioritised on the families this estate has already PROVEN:

| family | the shape | proven in |
|---|---|---|
| headless-blind | scrollbar and geometry reads headless | NEW LEAD GRID WIDTH |
| attribute vs visibility | `el.hidden` where the cascade decides | UI STANDARDS - LEADS |
| property vs outcome | "scrollable" instead of columns-visible | Round A |
| wrong axis | `scrollTop` where content scrolls `scrollLeft` | Round A |

**Judgment-heavy, and bounded by R3.**

## Phase 0: measurement, read-only

1. **The population.** Enumerate `scripts/**`, the test files, and what
   `package.json` and `verify-all.mjs` actually run.
2. **Q1, the unwired set**, calibrated. Count and list.
3. **Q2, the rotted set**, calibrated. Count and list, each with what is
   broken.
4. **Q3, the blind set**: the known families measured against the
   population, plus a named sample audited by hand. Calibrated, and
   explicitly not exhaustive.
5. **The cross-cut**: how many of the estate's probes touch scrollbars or
   geometry headless - the proven-blind family - as a bounded, real number.

**THE CALIBRATION, WHICH GATES ALL OF THE ABOVE:**

- **Q1**: a probe KNOWN to be unwired must appear; a probe KNOWN to be a
  gate stage must NOT appear as unwired.
- **Q2**: a probe KNOWN to be broken must appear as rotted; a passing one
  must not.
- **Q3**: a KNOWN-blind probe (a headless scrollbar read) must be flagged;
  a known-discriminating one must not.

**The calibration result is stated per question, and a question whose sweep
cannot discriminate reports that instead of a number.**

Deliverable: the three inventories with their calibration results, the
count in each, the scrollbar-blind cross-cut, and a **PRIORITISED findings
list** - which rotted or blind probes matter most, weighted toward those
guarding live-record behaviour and those about to be leaned on by R1, the
feature rounds, or the Sections 6-11 walk.

**Nothing is fixed. Nothing pushes.** Stop for sign-off.
