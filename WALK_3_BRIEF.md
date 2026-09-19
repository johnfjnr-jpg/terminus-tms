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

---

## The stopped items, ruled (John, 2026-09-19)

### R-K: keyboard navigation inside a field panel

**Supersedes `INTERACTION_STANDARDS.md` Section 2 for multi-field entry panels
ONLY.** Section 2 stands for genuine forms. Verification 23 cited: two correct
decisions about one question produce a conflict nothing detects, and the fix is
one governing each context rather than both existing.

Within a field panel:

| key | effect |
|---|---|
| **Enter** | commits the open field, opens the NEXT field's editor |
| **ArrowDown** | commits and moves down |
| **ArrowUp** | commits and moves up |
| **Enter on the last field** | commits and closes, firing **no record-wide save** |
| **Escape** | reverts per A3, unchanged |

Tab order unbroken. **The supersession is recorded in Section 2 itself**, with a
pointer, rather than only here.

**The ArrowDown-is-not-a-seed test is re-pointed deliberately**: arrows now
navigate between fields; they still never seed text.

### R-V7: the palette gains one attention token

**Closes `DESIGN_PRINCIPLES.md` open item 37.** `--attention`, amber, for states
that are not errors but need the eye: unsaved, pending, stale.

- The value is **derived for WCAG contrast** against the dark background, for
  both text and border uses.
- Applied to the **unsaved cost treatment** (border and badge) in place of
  `--green`.
- **Screenshot at 1440 for John before any wider application.** Other states
  adopt the token as their surfaces are touched.

### R-P: the two unmeasured prompts

The **link-account** and **save-and-park** prompts are MEASURED, with the same
drive V4 used, and each classified **honest** (kept) or **false premise** (fixed
the same way). **No unmeasured change.**
