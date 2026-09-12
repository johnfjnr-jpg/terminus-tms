# The UI STANDARDS round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill, and
`DESIGN_PRINCIPLES.md`'s **card and panel conventions, set 2026-09-12**
(C1 to C6), which this round supersedes by promoting them from six
conventions to an enforced standard. Drafted 2026-09-13; re-verify
premises against the tree you are on. This brief's R-series is its own.

## Why this round exists

**The app has no UI standard, so every panel was built to its own
convention.** One lead card currently shows **three different
save-control placements**: Summary below the field, Notes on the header
line, follow-up beside the field.

**This is a foundational gap.** Consistency should have been enforced by
shared components from the start and was not.

**The round is REMEDIAL.** Define the standard as code AND as a written
contract, then retrofit the lead card to it, so future work - Contacts
next - builds against the standard instead of re-inventing per panel.

> **The failure mode to END is: locally-correct panels, a globally
> inconsistent app, caught only by walking.**

## Standing verification

- **Live DOM plus screenshot** after a rebuild, `check-dist-fresh.mjs`
  first, at **1240 / 1920 / 3440**.
- **The door both ways** for any write.
- The **pre-commit hook runs all suites**.
- **The vanilla-asserting suites are not evidence about these screens.**
- **ASSERT RELATIONSHIPS BETWEEN ELEMENTS, NEVER A PROPERTY OF ONE.**
  Verification 4 as extended at the last close: a CSS mechanism is not a
  layout outcome. `position: absolute` and "the container did not grow"
  were both true of a dropdown rendering 730px below its card.

## THE STANDARD (John-ruled, design of record)

**The session BUILDS to this. It does not redecide it.**

- **S1 - SAVE/ACTION CONTROLS on the header line, right-aligned** (the
  Notes pattern). **Never below the field, never beside it.**
- **S2 - PANEL HEADER**: title left, secondary label beside it (for
  example `LATEST FIRST`), action controls right-aligned, **all ONE
  line**.
- **S3 - INPUT ALIGNS to the header's column**: left edges line up.
- **S4 - SAVE disabled until dirty, enables on change; DISCARD reverts
  the unsaved edit. Same everywhere.**
- **S5 - EVERY control carries an estate class; NO browser defaults; ONE
  button treatment across panels.** This retires the **F3** class,
  including `--red` and `--amber` being undefined in `style.css` -
  **define them**.

## Scope (John-ruled)

- **Define the standard FULLY**: code and written contract.
- **Retrofit the LEAD CARD completely** to S1 to S5.
- **Other surfaces are NOT retrofitted this round.** They conform as
  later rounds touch them, and the written contract governs them then.
- **FROZEN surfaces are NOT unfrozen to retrofit.** Lead Detail and the
  follow-up panel conform when next worked: the follow-up panel in the
  entity round, Lead Detail at retirement if it survives the walk.
- **Shared components get the standard via OPTIONAL PROPS** so the frozen
  consumers are structurally untouched. **The same three-consumer
  constraint as before**: the card, Lead Detail, and the Test Bed.

## Phase 0: measurement only, read-only

1. **Enumerate EVERY panel on the lead card** and its current pattern
   against S1 to S5: where its save control sits, its header layout, its
   input alignment, its dirty/save behaviour, its control classing.
   **This is the inconsistency inventory - the evidence for what the
   retrofit changes.**
2. **The shared components.** Do a Panel, a header and a save-control
   exist, or is each panel bespoke? What would a shared `PanelHeader` and
   save-control need? **This decides whether the standard is enforced by
   NEW shared components or by conforming existing ones.**
3. **The three-consumer constraint**: which lead-card panels use
   components shared with frozen Lead Detail or the Test Bed, so the
   retrofit uses optional props and leaves frozen structure untouched.
4. **S5 and F3**: every unclassed control and every undefined CSS var on
   the lead card - the full inventory to retire.
5. **What a WRITTEN CONTRACT should contain** so Contacts and later
   rounds build against it.

Stop with the Phase 0 report: the per-panel inconsistency inventory,
whether the standard needs new shared components or conforming existing
ones, the three-consumer constraint, the full F3 and undefined-var
inventory, and the decisions Phase 1 needs. **Nothing pushes.**
