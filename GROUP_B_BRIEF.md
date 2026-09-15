# Group B: the remaining screens

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`. The conformance gate applies. Opened on `b390dc3`.

**Proportionate path** (`DESIGN_PRINCIPLES.md` section 4), **one round for
both items**, per the batching model Group A validated.

## The two items, John-ruled

- **B1 - ACCOUNTS.** Linked Contacts rendered as **the contact-details grid,
  full width, scrollable**. It is a bare list today. **Adds a grid to a screen,
  so MEDIUM.**
- **B2 - OPPORTUNITIES.** **Standard field display, no white highlight.**
  Pre-standard white inputs today. **Mostly the field-display swap, so
  LIGHTER.**

**Both are the same shape as R1**: point fields at the shared grid, no white
inputs.

## THE BLAST-RADIUS RULE APPLIES, and it is why this brief names it up front

Set at the Create-bug close and promoted under Verification 20:

> **A change to SHARED code - a selector, a class React and vanilla both use -
> needs its blast radius checked across every surface that shares it,
> regardless of which verification path the change is on.** Blast radius is a
> property of the code, not of the round.

The Create bug was exactly this: a screen that was changed worked, and a screen
that shared its classes died. **So Phase 0's first question for each item is
WHO ELSE USES WHAT I AM ABOUT TO TOUCH.**

## Phase 0 - measure, proportionately

1. **B1**: what Accounts renders for Linked Contacts today, and what the shared
   grid needs to render it instead.
2. **B2**: what Opportunities uses for its fields today, and where the white
   comes from.
3. **BLAST RADIUS, for both**: every surface sharing the classes, selectors or
   components either item would touch. **Named before anything is changed.**

## Phase 1 - build

Both items, then verify on the proportionate path: the affected suite, a
**screenshot of each changed screen at 1440**, and **the conformance gate**.
**Anything that turns out to change behaviour pulls that item onto the full
path and is flagged**, per the limit.

**ONE gate run for the batch.** Stop for sign-off. **Then John walks the batch
once. Nothing pushes.**
