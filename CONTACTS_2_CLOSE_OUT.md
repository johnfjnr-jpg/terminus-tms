# Contacts polish (walk 10): close-out

Branch `contacts-2`, off `main` at `ea0fa96`, confirmed equal to `origin/main`
by `git ls-remote` against the real remote rather than the local tracking ref.

Rule 18 governs: this round ends **"ready for John's push"** and nothing is
pushed from the session.

---

## Item 1: the alignment, and what it actually was

**The first measurement did not reproduce it.** Every header BOX and every
header GLYPH read drift 0 against its column, at 1440 and 1240, resting and
armed. Both axes, exact.

**The misalignment is one column DOWN, not across.** The base rule gives every
`select` `width: 100%` and a flex item shrinks by default, so each row's
stance select took whatever its own row had left - and Record is `hidden`
until a stance is changed.

| | armed row | the other three |
|---|---|---|
| stance select | 104px | **183px** |
| note starts at | x 665 | **x 744** |

A 79px step down the card, and no two rows agreeing.

**Fixed with stated sizes**: `flex: 0 0 auto` and a width on each control, so
a row's layout cannot depend on what else is in that row. All four rows now
read select 118px at x 555 and note 150px at x 679.

**And the mechanism is fixed where it was fragile.** K4 made the `<td>` itself
`display: flex`, which stops it being a table-cell: the row then carried four
real cells and an ANONYMOUS box, and whether the header columns still
corresponded was left to the engine. The flex row is a DIV inside the cell
now, so headers and rows are the same columns by construction. The guard
asserts every cell and every header computes `table-cell`.

**Walk 9 removed that select width as "not load-bearing"**, having measured
only the resting state. With three controls in the cell it is load-bearing. A
calibration that exercises one state of two can prove a rule dead and be wrong
about it.

---

## Item 2: the Add button

`btn-sm`, the estate's treatment for an add-row action and what
`tb-install-note-add` already carries. **Record takes it too**: styling one
and leaving its neighbour a white browser default is worse than the uniform
default it replaced.

---

## Item 3: the last duplicated ids

`FollowUpTask` renders on **four surfaces** - Contact, Test Bed, Lead card and
the Opportunity band - all resident in the DOM at once, because a view is
hidden rather than removed. One component, four instances, three ids each.

**Load-bearing for nothing**, measured before removal: no `getElementById`, no
`#id` selector, no stylesheet rule, and no `htmlFor` - these labels WRAP their
inputs, so the association is implicit and survives.

**Zero duplicated ids anywhere in the document**, at both widths.

---

## Exit gate

| Point | Answered |
|---|---|
| Item 1 fixed at the MECHANISM, not by padding | **Yes**, one table, one column system, asserted on computed `display` |
| Guard asserts label-to-column alignment on the live DOM | **Yes**, both the box and the glyph axes |
| Item 2 built | **Yes**, and its neighbour with it |
| Item 3 resolved, dependents re-pointed | **Yes**, and there were no id dependents - stated rather than implied |
| Red-first | **Yes**, calibrated 6/6 on named checks |
| Live proof at 1440 and 1240 | **Yes**, 34/34 |
| Screenshots opened and read | **Yes**, and the screenshot is what found the real defect |
| Fixtures torn down | no fixtures created; measured on a live record |
| `CURRENT_STATE.md` regenerated | see below |
| Full gate, branch and merged | see below |
| Pushed | **No push from the session** |
