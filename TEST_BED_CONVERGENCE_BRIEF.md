# The Test Bed convergence round: brief

Runs after UI_HYGIENE_BRIEF_V2.md closes. Purpose: bring the Test
Bed detail experience up to the Opportunity standard, which John has
judged the stronger surface, and fold in look-and-feel items, with
the door treatment applied once to the converged screens rather than
patched onto screens about to change. Governing docs: CLAUDE.md, the
tms-round-method skill, the hygiene round's close-out. This brief's
R-series is its own; John's target-state ruling after Phase 0 is the
round's centre of gravity.

## Rulings of record (John, 2026-09-08)

R1. Direction: Opportunity is the reference standard. Test Bed
    converges toward it. Where the audit finds something Test Bed
    does BETTER, that is surfaced for ruling, not silently
    flattened.
R2. The door treatment for Test Bed surfaces lands in THIS round,
    on the converged screens, to the standard the hygiene round
    establishes on Opportunity: controls dead under is-not-mine,
    alive without, keyboard included, named exceptions recorded.
R3. Look-and-feel items John has raised or raises before Phase 0
    closes are folded into the audit's inventory; items arriving
    later queue for a follow-up pass rather than reopening ruled
    phases.
R4. Method unchanged: rulings appended at the phase they launch,
    phases stop for sign-off, final-act gate on the exact tree,
    the word follows the stated gate result, nothing pushes
    without it.

## Phase 0: the divergence audit (read-only)

Screen by screen, tab by tab, a measured comparison of the Test
Bed detail experience against the Opportunity detail experience:

1. Structure: header, stat strip, tab set, section layout, action
   placement — what Opportunity has that Test Bed lacks, and the
   reverse.
2. Patterns: which React components Opportunity uses that Test Bed
   predates (strips, panels, save flows, field help, refusal
   surfacing), and which Test Bed surfaces remain vanilla.
3. Behaviour: save and refusal handling, door behaviour, keyboard
   reachability, loading and empty states.
4. Look and feel: typography, spacing, contrast, control styling —
   against the brand references named in the project's
   ways-of-working, with John's raised items itemised.
5. Data: fields shown on one surface and not the other, with
   whether the API already carries them.
Deliverable: a divergence table — area, Opportunity state, Test
Bed state, proposed target, size — with anything Test Bed does
better flagged per R1. Every claim measured against the running
app, not read from source alone. No code changes. Stop for John's
target-state ruling, which fixes the scope of the build phases.

## Phase 1..n: the build

Phased by John's ruling on the table, largest structural moves
first, each phase a coherent surface (not a slice), each with:
tests derived from the brief, both-directions calibration where
behaviour changes, the door treatment per R2 landing with the
screen it guards, and a live walk of the finished surface as owner
AND as non-owner. Vanilla code stranded by each conversion retires
with the two claims. Stop for sign-off per phase.

## Final phase: gate and close

Final-act gate on the exact committed tree. Revert rehearsed from
an explicit ref, tree hash verified. Reconcile by counting.
Close-out states the converged state, anything deliberately left
divergent (with the ruling that left it), and carried items.
Nothing pushes without the word, and the word follows the stated
gate result.
