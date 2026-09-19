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

---

## Step 4 rulings (John, 2026-09-19), appended at the phase they launch

Build discipline 7's own remedy: a ruling given in conversation is appended to
the brief at the phase it launches, not discovered at the close.

### The amber is approved

**`--attention: #EDB45A` is APPROVED as shown at 1440. R-V7 stands.**

### P1 to P4 are rulings of record

The four positions taken where R-K was silent are endorsed and are now rulings
rather than documented assumptions.

| | Ruling |
|---|---|
| **P1** | A move with no target **commits and closes**. One rule covers both boundaries - Enter or ArrowDown at the last field, ArrowUp at the first - and no keystroke does nothing at all. |
| **P2** | The order is the **panel's DOM order**, never the descriptor array's. "The next field" is the next one the PERSON sees. |
| **P3** | A panel **declares itself** with `data-field-panel`. The move is scoped to the row's own panel, so a document-wide reach is impossible rather than merely unexercised, and a surface that has not opted in is **unchanged**. |
| **P4** | A key the editor itself uses is **not taken from it**. Enter in a textarea is a newline; arrows in a select choose the option and in a date input step the segment. Declared per editor kind in one table, so a new editor joins the table rather than being named in a condition. |

### The ten `--amber` sites adopt `--attention`

**Cosmetic tier** (build discipline 17, M2). Closes the Verification 23 conflict
R-V7 reported rather than carrying it.

- a **guard red** on any site still binding `--amber`;
- a **screenshot spot-check of three representative sites**, opened and read;
- **`--amber` retired or aliased**, so one token owns the family;
- the **V23 closure recorded in `DESIGN_PRINCIPLES.md`**.

### R-K gets a second live surface

**One live keyboard pass on the CONTACT panel**, the same probe as Commercials,
read back from the database. Commercials was the only surface driven live; the
mechanism is shared and a live pass is still a live pass.

---

## Final rulings (John, 2026-09-19), appended at the phase they launch

### The promotion is CONFIRMED

> **A WARNING IS A CLAIM, AND NEEDS THE SAME EVIDENCE AS ONE. Before shipping a
> dialogue that says an action will lose something, DRIVE THE ACTION AND MEASURE
> WHETHER THE LOSS OCCURS.**

Applied to `CLAUDE.md` **on `main`**, as a docs-only commit, rather than on this
branch.

### Contact FieldRow routing is ruled OUT for now

Personal Details and Address Details **stay as they are**. Routing them through
`FieldRow` is a **design question on the list**, not a consequence of R-K.

The measurement stands and so does its guard: the Contact panel has exactly one
`FieldRow` row, the assertion says so, and the day that changes the test goes red
and the surface earns a real keyboard pass.

### The third amber adopts the token

`.btn-attention` and its neighbours **bind `--attention`** in place of the
hardcoded `rgba(224,130,74,...)`. Cosmetic tier. The completeness guard extends
to cover them, with calibration for the new assertions and a screenshot of one
representative button opened and read.

### The hardcoded `--red` shapes are a HYGIENE ITEM

Named, not fixed. `var(--red, #e06c6c)` fallbacks and bare
`rgba(242,100,100,0.9)` literals sit at several sites and have exactly the shape
the amber sweep just closed: a token reachable only through a literal is
invisible to the palette **and** to the invariant that checks the palette.

**On the list. Not this round**, because a second colour family is a sweep of its
own and this round has already had one.
