# The Test Bed migration recovery round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`DESIGN_PRINCIPLES.md`, `INTERACTION_STANDARDS.md`, and the previous
round's `TESTBED_STATE_PHASE_1_REPORT.md`.

Branched from `round-testbed-state`, which is **complete, gated green and
awaiting the word**. That branch is the "new" side of every comparison in
this round: the inventory is taken against the Test Bed as it stands after
R1, R2 and R3, not against `main`.

## Why this round exists

The business reports that the React migration **dropped features that
existed in the previous HTML version** - *"we had this before, why have we
lost it AGAIN."*

## Rulings of record (John, 2026-09-15)

R1. **PHASE 0 IS A READ. Nothing is built.** The deliverable is a report
    of what the old version actually did, taken from the old HTML and the
    old JavaScript in git history, so that recovery rebuilds **what was
    there** rather than a fresh design.
R2. **DO NOT RE-DESIGN FROM SCRATCH.** Where the old code shows how a
    thing worked, that is the specification for rebuilding it.
R3. The commercials calculation is **a LOST FEATURE, not a layout item**,
    and is the big one: sensor counts in, costs out, from unit costs.
R4. **Use Cases** is wanted as an industry-vertical-driven dropdown from a
    taxonomy held in Admin, which John will provide. Phase 0 must say
    whether the old version had it as a selectable list, and therefore
    whether this is recovery or a new feature.
R5. The deliverable is a **full old-vs-new inventory** of the Test Bed
    screen, because the finding is that "lots of things went missing".
R6. Method unchanged: stop for sign-off on the Phase 0 inventory, the gate
    is the final act on the exact committed tree, nothing pushes without
    the word.

## Phase 0: read the old version (no build)

1. **The commercials calculation.** Find it in the old code: how it
   calculated, what the inputs were, the cost formula, and where the unit
   costs came from. Report the old logic so it can be rebuilt faithfully.
2. **Use Cases.** Did the old version have it as a selectable list? If so,
   how. If not, say plainly that the dropdown is a new feature.
3. **Everything else.** A full old-vs-new inventory of the Test Bed
   screen: what the migration dropped.

**Stop for sign-off.** The inventory decides the recovery round's real
scope.

## The fixes split, recorded and NOT built this phase

These are John's four buckets, written down at the phase that launched
them rather than discovered at the close.

### RECOVERY - real feature recovery, the old code shows how
- Rebuild the commercials calculation and its itemized display.
- Use Cases.

### LAYOUT
- Next Stage button convention.
- Current-stage `*` marker.
- Summary / Notes / Follow-up placement.
- Scroll-to-save.
- History as its own tab, far right.
- Convert to Opportunity as a top button.

### ACCOUNT DIALOGUE
- Account link becomes a dropdown with save and cancel.
- Add a Client-account-contact dropdown, listing contacts of the account.
- Drop the mobile number.

### WHITE BUTTONS
- `Add`, `Add document` and the white selects are still unstyled. They are
  **static markup, not `FieldRow`**, so the white-fields rollout has not
  reached them. Folded into whichever round touches those screens rather
  than given one of its own.

## What Phase 0 must not do

No source change, no schema change, no re-point of a test. A scope
discovery is the deliverable; measuring it precisely and stopping beats
delivering a fifth of the build.
