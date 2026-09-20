# Opportunity walk round (walk 5): the brief

Branch `opp-walk5`, off `main` at `85ad44c`, which was confirmed equal to
`origin/main` before the branch was cut - and `git ls-remote` confirmed the
remote genuinely holds it, rather than trusting the local tracking ref.

Rule 18 governs throughout: **this round ends "ready for John's push"** and
nothing is pushed from the session.

---

## The findings, verbatim

> **W1:** "Showing 2 of 3" moves onto the Notes header top line with NOTES,
> LATEST FIRST and the range buttons.
>
> **W2:** the Opportunity type field moves INTO Terminus Details, directly
> below Terminus reference; its standalone card is removed.
>
> **W3 (behaviour):** Key customer contacts selects from the CONTACTS OF THE
> LINKED ACCOUNT rather than a free list.
>
> **W4:** Withholding tax is a 2-digit integer %: field sized so, Gross-up
> enabled selector on the SAME line, and the WHT pair ordered ABOVE GST (GST is
> a pass-through).
>
> **W5:** installation fields sized to the data they hold.
>
> **W6-W9 (one fix, the walk-4 O5/O6 shape):** the INSTALLATION milestone grid
> gains column labels ABOVE each column (Month, Milestone, %, Amount), Month
> and % sized to 2-digit integers, the milestone dropdown sized to its longest
> option, the amount sized to its data and right-justified.
>
> **W10:** "Lump sum contractor price" and its figures align with the money
> totals column, not the left edge.
>
> **W12 (prototype check):** the payment-terms Project Milestone column against
> the prototype: it was a DROPDOWN there. Report what the prototype's dropdown
> selected from, what exists today, and whether named milestones were lost in
> migration.
>
> **W13:** payment terms grid: breathing space after the % column, numbers
> right-justified, the monthly hosting panel moved left to close the dead space.
>
> **W11 is context:** the panel reads as confusing; W12 and W13 are its
> concrete halves, and Phase 0 may name more.

---

## What each finding is

| | What it is | Disposition |
|---|---|---|
| **W1** | Layout, and **it collides with a standing ruling.** See the flag below | Phase 0 MEASURES the collision before anything is built |
| **W2** | Layout and structure: a field moves and a card is removed | Releases on the Phase 0 report |
| **W3** | **BEHAVIOUR, and the only finding that changes what the system does.** Scoping a picker to a relationship | **John's ruling input.** Phase 0 measures, nothing is built |
| **W4** | Layout, plus an ORDER change that has an owner | Releases on the report unless Phase 0 finds the order is data-driven |
| **W5** | Layout, sizing | Releases on the report |
| **W6-W9** | Layout, one fix, explicitly the shape walk 4's O5/O6 took | Releases on the report |
| **W10** | Layout, alignment | Releases on the report |
| **W12** | **A QUESTION, not an instruction.** A prototype comparison and a migration-loss check | **John's ruling input.** Report only |
| **W13** | Layout, spacing and justification | Releases on the report |
| **W11** | Context for W12 and W13. Phase 0 may name more | Not a build item in itself |

---

## THE FLAG ON W1, RAISED BEFORE ANY WORK BEGINS

**W1 asks for MORE on a line that a standing ruling deliberately cleared, and
walk 4 remeasured that ruling nine days ago.** This is Verification 23's shape -
two correct decisions about the same question, taken in different rounds - and
the rule says to search for an existing decision **before** deciding, not after.

The existing decision is **A1**, recorded in `NotesHistory.tsx`:

> "Latest first" gives way to the rungs when there are rungs. The column is a
> third of a card and cannot hold NOTES + Latest first + three rungs + Add
> note: measured, the secondary wrapped to two lines and Add note was clipped
> at the column edge.

**And walk 4 remeasured it rather than inheriting it.** R-O2's probe reported
that adding "Latest first" back needs **436px against a 372px lead card**, so
the secondary still does not fit beside the rungs. Walk 4 also found that even
with the secondary ALREADY GONE the collapsed row overran its card by 34px at
1240 and clipped ADD NOTE against the neighbouring card, which is why
`.panel-head` now wraps for that one header.

**W1 asks for NOTES + LATEST FIRST + the range buttons + "Showing 2 of 3" on one
line**, which is A1's rejected set plus one more item.

**This is not a refusal and nothing is being declined.** It is a measurement
that has to happen before the build rather than after it, because the two
readings lead to materially different work:

- if it FITS at the widths that matter, A1 is superseded on a measurement and
  W1 is an ordinary layout change;
- if it does not, W1 needs a ruling on what gives way, and the honest options
  are a wider column, a smaller type size, or dropping a different item.

**Phase 0 measures it at 1440 and 1240 on every surface that renders the
header, and reports the number.** Per Verification 29 the superseded reasoning
stays visible either way, so a later reader can tell a failed premise from a
changed preference.

---

## Phase 0: measure before build

Instructed measurements, verbatim from the round's own instruction:

- Each layout finding's mechanism: the grids' current templates, the WHT/GST
  order's owner, the Opportunity type card's contents and callers.
- **W3**: where Key customer contacts sources its list today, what the
  account-contact relationship looks like in the data, and what scoping the
  picker to the linked account touches - routes, validation, and **existing
  rows that reference contacts outside the account**.
- **W12**: the prototype's milestone dropdown, verbatim.

And one added by the flag above:

- **W1**: the measured width of the requested header line, against the
  available column width, on every surface that renders it, at 1440 and 1240.

**STOP after Phase 0.** W3's scoping answer and W12's prototype answer are
John's ruling inputs. The layout set releases on the report unless Phase 0
finds a scope change.

---

## Standing method

- Every measurement is taken on the LIVE surface, never inferred from source,
  and the retired `#deal-form-vanilla`, `#deal-version-vanilla` and
  `#ref-vanilla` blocks are excluded by name: they render nothing and answer
  `querySelector` exactly as the live markup does.
- Layout claims are stated as a RELATIONSHIP between two elements, never as a
  CSS property. `display: grid` is true of a grid laid out wrongly.
- Every screenshot is opened and read, and the element being claimed is
  confirmed to be inside the captured region before the image is treated as
  evidence.
- Every new guard is calibrated in both directions before it counts, and a
  silent injection is explained rather than ignored.
- Commits at every phase boundary; nothing pushed.

---

## Exit gate

| Point | To answer at the close |
|---|---|
| Every finding built, ruled or recorded | |
| Rulings appended at the phase they launch | |
| Every new guard calibrated both directions | |
| Live proof at 1440 and 1240 | |
| Read back from the database where a write is involved | |
| Screenshots opened and read | |
| Fixtures torn down, re-queried by tag | |
| `CURRENT_STATE.md` regenerated and reconciled | |
| Full gate with `--round-close` | |
| Merged or pushed | **No push from the session** |
