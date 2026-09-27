# MINOR ADJUSTMENTS ROUND: BRIEF

Six findings from John's walk 2026-09-27, screenshots on record. John's spec is
the approved reference per the mockup rule.

Branch `adjustments` off `main` at `7abb209`, confirmed equal to `origin/main`
by `ls-remote` before branching. Rule 18, build discipline 19 and
named-findings-only govern. The round ends "ready for John's push".

**This brief is the round's first commit, per the method rule: a round with no
committed brief has no stop-rule referent.**

---

## THE SIX FINDINGS, AS RULED

### P1: the column-heading underline sits below the whole head band

The Units panel's column-heading underline renders **BELOW the whole head band
including wrapped heading lines**. No rule strikes through "Cost/Mth" or any
wrapped heading.

**AND THE GUARD GAINS BORDERS.** The ink and overprint guard (W2's
no-intersection family) currently measures an element's box and its TEXT rects.
A painted border is ink a reader sees and the guard cannot. **An element's ink
includes its painted borders**, which closes a limit the guard itself recorded.

Calibrated by regrowing the strike-through.

### P2: the Installation panel widens per John's spec, NOT full width

- Under Lump Sum, the lump sum field sits to the **RIGHT of the Responsibility
  dropdown, on one line**.
- The milestone **% and amount columns take proper spacing per the S1
  registry**. The % header currently crowds its input.
- The width is measured **from the content**, per the estate standard. Not full
  width, and not a literal.

Containment (R-US4), adjacency (A1, A4) and sizing (S1) guards hold throughout.

### P3: the carried-into sentence becomes hover help

The sentence "Lump sum cost $X, priced at $X, carried into the Deal Summary,
Deal Sheet and Cash Flow" moves into **the estate's established hover-help
mechanism**, the `?` affordance already used on the factoring rate and term.

A `?` beside the Lump Sum Cost label carries the sentence; the inline prose
leaves the panel. **Same pattern, same dress**, asserted present with its text.

### P4: autofill neutralised estate-wide

**A permanent rule in `DESIGN_PRINCIPLES.md`.** Chrome's `-webkit-autofill`
background and text colour are overridden to the estate's input tokens on
**every** input. The white boxes in John's screenshot (lump sum, milestone %)
render estate-dark when autofilled.

**THE MECHANISM, NAMED HERE AS THE RULING REQUIRES.** Chrome does not let a
stylesheet set `background-color` on an autofilled control: the UA paints it
above the author background. Three declarations are needed and each does a
different job:

1. `box-shadow: 0 0 0 1000px <input background token> inset` paints over the UA
   background, because a large inset shadow IS drawable where the background is
   not.
2. `-webkit-text-fill-color: <input text token>` sets the glyph colour, because
   `color` is likewise overridden on an autofilled control.
3. `caret-color: <input text token>`, so the caret stays visible against the
   repainted box.

Applied through `:-webkit-autofill` and its hover, focus and active states, and
through the standard `:autofill` beside it so the rule survives the prefix
being retired.

**PROVEN AT THE MECHANISM.** The autofill state is forced and the computed
background read back: through Chrome's DevTools protocol where it can drive the
pseudo-class, and otherwise through an injected class carrying the identical
declarations. **The report records honestly what the proof can and cannot
simulate**, because a pseudo-class a probe cannot enter is a claim a probe
cannot make.

**THE HISTORY, RECORDED SO THIS IS NOT READ AS A RECURRENCE.** White default
buttons and token collapse were separate mechanisms, each already fixed.
**Autofill is a third, never previously addressed**, and it is invisible until
a browser has a saved value to offer.

### P5: "Proposal Version" renames "Approved Version"

**Phase 0 measures what the field displays TODAY** and the rename preserves
those semantics. A display rename stays a display rename (Architecture 6): no
schema, endpoint or payload change. Occurrences and assertions re-pointed, each
with its reasoning at the site.

### P6: a "Working Version" field joins it

John's grammar verbatim, driven by the **existing supersession machinery**
(`pricingChanged` / revision-past-version), with labels from the **ONE**
version-label source rather than a second formatter:

```
latest version issued, record edited since, no draft saved
    <label> - Under Edit - Not saved
draft saved, unchanged since
    <label>
draft saved, edited since
    <label> - Under Edit
```

All three states **driven live and read back**. The field updates on save and
on edit **without reload**, wherever the estate already re-renders.

---

## PHASES

### Phase 0: measurement before any build

Six findings, six things to establish before touching them, because five of the
six rest on a claim about what exists today:

- **P1** the underline's mechanism and which element paints it.
- **P2** the Installation panel's current widths, the milestone grid's tracks
  and what the `%` header actually crowds.
- **P3** the `?` affordance's real pattern and dress on factoring rate and term,
  read from the markup rather than from memory.
- **P4** whether any autofill rule exists anywhere today, and what the estate's
  input background and text tokens are by name.
- **P5** what "Proposal Version" displays today, which is the semantics the
  rename must preserve, and every occurrence of the string.
- **P6** the supersession machinery and the ONE version-label source.

Nothing is built in Phase 0. It reports.

### Phase 1: P1, the underline and the border-aware ink guard

Red first: the guard extended to see borders must FIRE on the strike-through
before the strike-through is removed.

### Phase 2: P2, the Installation panel's width and the milestone columns

### Phase 3: P3, the sentence into hover help

### Phase 4: P4, autofill neutralised estate-wide, and the permanent rule

### Phase 5: P5 and P6, the two version fields

P5 and P6 are one phase because they are one field group and P6's grammar reads
against P5's renamed neighbour.

### Phase 6: the close

Live proof at 1920/1440/1240 across responsibility, mode and structure states,
**including one autofilled input photographed**. Screenshots opened and read.
Close-out, CURRENT_STATE, `ls-remote` equality re-check at merge, branch gate
`--round-close`, merge `--no-ff`, merged-tree gate.

---

## THE STOP RULE

**Any red: STOP.** A finding the brief does not cover, or a build blocked by a
constraint it does not name, stops and photographs the options rather than
shipping a demotion.

**No guard is weakened to make a phase pass.** Where a guard's bound changes,
the change is a ruling, not an adjustment.

Reports per M6: `REPORT_FOR_CHAT.md`, the clipboard, and the dated file in the
OneDrive notes folder, each confirmed by reading back.
