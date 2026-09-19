# Walk 3: the build brief

Governing docs, read before anything: `CLAUDE.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, and the tms-round-method skill. Where this brief and
`CLAUDE.md` disagree, `CLAUDE.md` wins and the disagreement is a finding.

**Branch:** `walk-3`, off `main` at `35e6d8e`, which was `origin/main` and a
clean tree when the round opened.

**Evidence base:** `WALK_3_STEP_1_ARCHAEOLOGY.md`, the read-only pass that
answered the two questions this round could not build without.

---

## Method rulings (John, 2026-09-19)

M1 to M4 are in `CLAUDE.md` as build discipline 17, under their own labels
because rounds will cite them. M1 is built into
`scripts/pre-commit-suites.mjs` rather than left as prose.

---

## The findings, verbatim from John's walk log

- **V1 (Leads detail).** *"We could have the company, source and created after
  the qualified status, and move the qualify and nurture buttons to the right to
  accommodate it."*
  **Disposition:** the list row already shows company, source and created; the
  detail header gains the same, **after the status chip**. Cosmetic tier.
- **V2 (Contact).** *"There should be a slight gap in the border for the
  summary/notes/followup task and the personal details panel."*
  **Disposition:** cosmetic tier.
- **V3 (Contact).** *"When ALL is selected the only panel that requires to
  extend down is the notes panel. It doesn't make sense to extend summary and
  follow up task."*
  **Disposition:** cosmetic tier.
- **V4 (Contact).** The note save raising the discard modal.
  **Disposition:** FULL TREATMENT. Reproduce on a fresh record, name the
  mechanism, fix so a save never threatens a discard. Red-first, live-proven.
- **V5 (Commercials).** *"Entering new safesight cameras, and I cannot use down
  arrow to get to the next field in the panel."*
  **STOPPED**, pending John's keyboard ruling.
- **V6 (Commercials).** *"Enter after entering a value does not navigate to the
  next field."*
  **STOPPED**, pending the same ruling.
- **V7 (Test Bed).** The Cost Summary's unsaved green treatment.
  **STOPPED**, pending John's palette decision. The archaeology found it is
  working as designed and already logged as `DESIGN_PRINCIPLES.md` open item 37,
  whose recorded remedy is a palette decision reserved for the business.
- **V8 (Test Bed).** The reason line reserving space it is not using.
  **Disposition:** the line reserves no space when it does not render; the
  criterion rows sit tight and equal. Red-first on the gap.

**V5, V6 and V7 are not touched by this phase.** The archaeology established
that V5 and V6 are not a regression to restore: Enter-or-arrow field navigation
was never ruled, and the proposal conflicts with `INTERACTION_STANDARDS.md`
Section 2, which says Enter SUBMITS. Building either without a ruling would be
taking a decision that is John's.

---

## The released set

V4 and V8 at the full and specified tiers; V1, V2 and V3 at the cosmetic tier
per M2 - red-first guard, the affected suite, a screenshot opened and read, and
**no live injection harness unless a handler or a write is touched**.

Batched as one findings phase, per M3.
