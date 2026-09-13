# Probe inventory: close-out

**CLOSED at Phase 0 sign-off** as a measurement round - no product change,
nothing fixed. **PUSHED** to `origin/main` at `26e9dd3`, together with the
two rounds its own findings launched.

## What it measured

**Q1 - wiring. 162 of 244 detectors are run by nothing**, 82 of them browser
probes. Calibrated both ways and spot-checked beyond the calibration.
`check-state-fresh.mjs` is among them: the staleness check the method
requires at every close is enforced by nobody.

**Q2 - rot. 140 raw dead identifiers became 4 real**, through three
false-positive classes each found by reading the output rather than trusting
the count - template-generated ids, a detector's own fixtures, and suffix
templates. All four sit in unwired walks; **zero in gate stages**.
`cd-notes-empty` asserts the presence of a thing a later round deliberately
deleted. Calls to non-existent routes: **0**.

**Q2c - the run-based rot rate is UNMEASURED and says so.** Nearly every
unwired probe builds fixtures, and R1 ruled the round read-only.

**Q3 - blind, bounded by ruling and not exhaustive.** 13
attribute-vs-visibility detectors, **nine of them gate stages**; 4
wrong-axis; 0 property-vs-outcome. The scrollbar-blind cross-cut is 4 files
in one directory - **a smaller exposure than "every headless scrollbar
reading has been blind" sounded.**

## THE FINDING THAT ARRIVED UNINVITED, AND OUTRANKED THE INVENTORY

The round's first commit was refused by the pre-commit hook on INVARIANT 2,
with **zero orphaned rows on disk**. The gate was racing against itself.
**It was found by accident, not by any sweep here** - it broke a commit
while the round about broken detectors was being committed.

That launched GATE RACE FIX, which launched F5 TIMEOUT FIX.

## Carried, in priority order

1. **R10** - the scanner-window blind spot.
2. **P2** - the 13 attribute-vs-visibility detectors, folding into R1.
3. **P3** - wire `check-state-fresh.mjs` into a gate stage.
4. **P4** - the 4 rotted assertions.
5. **P5** (162 unwired) and **P6** (4 wrong-axis), standing.
