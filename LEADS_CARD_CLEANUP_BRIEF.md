# The LEADS CARD CLEANUP round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill, and
**`INTERACTION_STANDARDS.md`**. **The conformance gate applies.**

Prior work this builds on: `LEADS_DETAILS_CONSOLIDATION_PHASE_0_REPORT.md`,
whose measurements this round confirms rather than repeats.

## Standing verification

- **Live DOM plus screenshot** after a rebuild, `check-dist-fresh.mjs`
  first, at **1240 / 1920 / 3440**.
- **ASSERT RELATIONSHIPS BETWEEN ELEMENTS, NEVER A PROPERTY OF ONE.**
- The **hook runs all suites.**

## Context: this is the SPLIT

The consolidation round's Phase 0 found that `#view-contact-detail` is the
**Contact** detail screen, serving 10 live Qualified contacts the Leads
card never shows. **That work is now ROUND B**, its own next round:

> **ROUND B - THE RECORD-SURFACE CONSOLIDATION**: replace the messy
> contact-detail with the shared surface plus an account section, wire the
> Contacts list to it, and retire the bespoke screen. **The create-Test-Bed
> and create-Opportunity actions STAY on the Contacts list.**

**This round is the CARD CLEANUP. Do NOT touch `contact-detail` or the
Contacts list.**

## Rulings of record (John)

**R1 - CHROME AUTOFILL HIGHLIGHT. Cause CONFIRMED by John**: the "popup
lists" are **Chrome's own autofill suggestions**, and the white highlight
is Chrome's **`:autofill` pseudo-class, not app state.**

**Fix**: a CSS override neutralising the `:autofill` background on the
card's inputs, so an autofilled field renders like every other field on
the dark theme.

> **HONEST VERIFICATION LIMIT, ruled explicitly: headless Chrome cannot
> trigger autofill, so the probe CANNOT reproduce white-before and
> normal-after.**
>
> **The provable half**: the rule exists, it targets `:autofill` on those
> inputs, and **no non-autofilled field's treatment changes.**
>
> **The visual confirmation is John's**, next time autofill fires.
> **State this limit in the report. Do NOT assert a reproduction the probe
> cannot do.**

**R2 - THE NEW LEAD GRID BECOMES A PROPER TABLE.** Measured: it **is** a
`<table>`; the cells have **no border** while the header (0.12) and the
inputs (0.22) differ; inputs **crop at 110px for 370px of content**; and
there is **no scrollbar because `flex: 1` grows the container to 88vh**.

**Fix**: consistent cell borders and treatment; cells sized so data is
readable; **a HEIGHT CAP so it SCROLLS with a scrollbar**; **scroll
position RESETS on reopen** (testable once the cap lands); and **on SAVE
the modal CLOSES and returns to the list.**

**R3 - THE SUMMARY ASTERISK.** Drop the *"Summary is required. Complete it
in the Summary panel below."* block; put an **asterisk on the Summary
PANEL's title**. **Build it as the SURFACE's own logic, not a card-only
patch, so it carries into Round B.**

**R4 - THE GATE HOLE**, from the prior Phase 0: `QualifyCompletion` builds
its own headers and **the conformance gate PASSED it, because the gate's
shell test is a NAME LIST** - Verification 19 inside the gate built to
enforce Verification 19.

**Fix**: widen the gate to **enumerate structurally**, route
`QualifyCompletion` through `Panel` and `PanelHeader`, and **calibrate the
gate to FAIL on a self-headered panel.** **Do it now: Round B makes this
surface load-bearing.**

## Phase 0: targeted confirmation, read-only

**A prior Phase 0 exists. Confirm the specific items; do not re-measure
wholesale.**

1. **R2**: confirm the table, crop and scroll measurements still hold.
2. **R3**: confirm the block's location and the panel title's.
3. **R4**: the gate's name-list blind spot, and **what routing
   `QualifyCompletion` through `Panel` touches** - the three-consumer
   constraint **stands**, because `contact-detail` is **not** retired this
   round.
4. **R1 needs no live reproduction.** The cause is confirmed by John.

## Phase 1: the build

R1 (CSS, with the stated verification limit), R2, R3, R4.

**Prove**: R2 scrolls with data, resets on reopen, closes on save; R3's
asterisk is on the panel, the block is gone, and the logic is
surface-owned; R4's gate **catches a self-headered panel, calibrated to
fail.** **Screenshot every state.**

Stop for sign-off at each phase. **Nothing pushes.**
