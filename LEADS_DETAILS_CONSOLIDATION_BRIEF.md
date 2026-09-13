# The LEADS - DETAILS CONSOLIDATION round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill, and
**`INTERACTION_STANDARDS.md`, read first**. **This round's new surfaces
conform to it, and the conformance gate applies** - Section 12 is now
enforced, and `INTERACTION_STANDARDS.md` is itself read by a gate stage.

Prior rounds this builds on: `UI_STANDARDS_LEADS_*`, `LEAD_CARD_UI_FIXES_*`,
`LEADS_CARD_POLISH_*`.

## Standing verification

- **Live DOM plus screenshot** after a rebuild, `check-dist-fresh.mjs`
  first, at **1240 / 1920 / 3440**.
- **ASSERT RELATIONSHIPS BETWEEN ELEMENTS, NEVER A PROPERTY OF ONE** (V4).
- **The door both ways.** The **hook runs all suites.**

## Context

**John walked the card again. The standard is holding.** These are the
next items, and **item 4 is the payoff of the whole sequence**: it
retires Lead Detail by absorbing its job into the in-card surface.

## Rulings of record (John, from the walk)

**R1 - AFTER-SAVE HIGHLIGHT CONSISTENCY.** *(Not highlighting-for-missing;
that is parked as a future idea.)* Fields completed via the popup lists
are left **white-highlighted after save**, drawing the eye to **COMPLETED**
fields instead of missing ones. **Fix: completed fields return to normal
treatment after save - no leftover highlight.** Consistency only this
round. Likely the stale-state-after-save family; **Phase 0 confirms the
cause, does not assume.**

**R2 - THE NEW LEAD GRID BECOMES A PROPER TABLE.** It uses panel underline
styling - field underline, dropdown underline and row line all differ -
fields are cropped so entered data cannot be fully read, there is no
scroll bar, and the modal is too narrow. **Rebuild as a simple table:
visible cell structure, consistent cell styling, wider, cells sized so
data is readable, A SCROLL BAR.** Plus: **scroll position RESETS on
reopen** (it persists today), and **on SAVE the modal CLOSES and returns
to the list** (it stays open showing "N leads created").

**R3 - THE SUMMARY ASTERISK.** Drop the *"Summary is required. Complete it
in the Summary panel below."* block from the completion surface. **Put an
asterisk on the existing Summary PANEL's title instead.** One asterisk on
the real panel, no redundant instruction. **This refines the earlier
pointer-to-panel decision: do not point, just mark.**

**R4 - CONSOLIDATE TO ONE RECORD SURFACE, AND RETIRE LEAD DETAIL.** The
in-card full-record surface - the one Qualify opens when data is missing -
**IS the detail view.** So:

- **Rename "Address Details" to "DETAILS".**
- **Details opens that SAME surface in a VIEW/EDIT mode**: all fields
  editable, **no "please complete missing data" framing, no missing
  markers when nothing is missing.** Qualify still opens it in
  **COMPLETE-THE-MISSING** mode. **Same surface, two entry modes.**
- **REMOVE the address popup entirely.** The completion surface already
  edits address; the popup was a duplicate.
- **RETIRE the Lead Detail screen.** Its job is absorbed. **This ends its
  multi-round freeze: it is not revived, it is retired, because the card
  now does what it did.**
- **Retiring Detail DISSOLVES the frozen-consumer constraints** on
  `NotesHistory`, `FollowUpTask` and `LeadFieldInput` - they no longer
  have a frozen Detail consumer to protect. This unblocks `FollowUpTask`'s
  deferred S5 classing, **though that stays in the follow-up-entity round
  unless trivial here.**

## Phase 0: measurement only, read-only

1. **R1**: reproduce the after-save highlight **live**; find where the
   highlight is applied and why completed fields keep it after save.
   **Name the instrument.** Confirm stale-state versus something else.
2. **R2**: the grid's current structure and styling - what makes it
   underlines rather than a table, why cells crop, why there is no
   scroll, the scroll-position-persists cause, and the save-does-not-close
   cause.
3. **R3**: where the "Summary is required..." block renders, and where the
   Summary panel's title is, for the asterisk.
4. **R4 - the load-bearing measurement:**
   - **(a)** Can the in-card surface **already** render in a
     no-missing-data state, or must the view/edit mode be built?
   - **(b)** The address popup: confirm it is card-local, and what
     removing it touches.
   - **(c)** **LEAD DETAIL RETIREMENT**: what points at it - routing,
     links, other screens, the view id, any probe, gate or test.
     **Everything that must change for it to be removed cleanly. This is
     the inventory that makes the retirement safe.**
   - **(d)** The three shared components' frozen-Detail constraints -
     confirm they dissolve when Detail retires, with **no other frozen
     consumer**.

Stop with the Phase 0 report: **R1's cause, R2's grid deltas, R3's
locations, and R4's full retirement inventory** - (a) is build-or-not and
**(c) is the safety-critical list**. **Nothing pushes.**
