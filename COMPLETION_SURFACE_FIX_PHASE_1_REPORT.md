# Phase 1: R1, R2, R3, R4, R5

Built to the rulings. Follow-up panel untouched, Lead Detail untouched.
Nothing pushed.

---

## 1. Evidence

| probe | result |
|---|---|
| `probe-completion-refresh.mjs` (R1, R4, R2, R5, all three paths) | **ALL CLAIMS HOLD** |
| `probe-polish.mjs` (carried) | **30/30** |
| `probe-card.mjs` (carried) | **14/14** |
| `probe-card-widths.mjs` (1240/1920/3440) | **21/21** |
| `probe-new-lead-grid.mjs` (carried) | **19/19** |

Suites **519/519**, **939/939**, **100/100**. Probe residue **0**. Bundle
freshness asserted before every live measurement.

---

## 2. R1 + R4: one save-then-refresh, and the order is the fix

### Before and after, same probe, same fixture

| | before (Phase 0) | after |
|---|---|---|
| markers after in-surface save | `[address, postcode, summary]` | **`[postcode, summary]`** |
| the server says | `[postcode, summary]` | `[postcode, summary]` |
| the filled field's box | **`""`** while the record held it | **`"12 Recompute Road"`** |
| the still-empty field | keeps its star | keeps its star |
| count | "2 still to complete" | "2 still to complete" |
| markers after the **address popup** | `[address, postcode, summary]` | **`[summary]`** |
| the server says | `[summary]` | `[summary]` |

### What changed, and why it was already available

The surface **already fetched** `exit-criteria` inside its save and used
**only its length**, for the message. **So the fresh answer was in hand
and thrown away** - which is exactly why the count was right while the
markers were wrong.

It now goes through the parent's one refresh, which **reloads the record
first** and then re-reads the blocking list. **Clearing the local drafts
afterwards is then safe**, because the fields fall back to a payload that
is fresh rather than to the open-time one that was empty.

**The value staleness had two causes and both needed fixing**:
`setValues({})` dropping the drafts, and the payload prop never being
reloaded on a partial save because `onSaved` was fire-and-forget. It is
awaited now.

---

## 3. R3: the parent owns it, two callers, one writer

`blocking` is state in `LeadCardActions` and `refreshAfterSave` is its
only writer. The completion surface calls it through a prop; the address
popup calls **the same function**, published to the card through a ref.

**No second copy in the child.** Phase 0 measured what a second reader
costs on this exact surface: three vintages of truth on one panel.

---

## 4. R2 and R5: one field, one editor, and it says where

| check | result |
|---|---|
| the completion surface edits Summary | **no** - the editor is gone |
| the card's Summary panel edits Summary | yes |
| the surface still MARKS Summary when required | yes, the star renders |
| the Summary-only surface names where to write it | **"Summary is required. Complete it in the Summary panel below."** |

Phase 0 measured **independent drafts** - typing into the surface left the
card's showing `""` - so whichever saved last won silently. That is gone
because the second editor is gone.

**R5's case is visible in `p1-only-summary.png`**: 14 filled inputs, one
star, and a sentence pointing at the panel that can satisfy it.

---

## 5. Calibration

**3/3, one injection per claim**, each reverted byte-identical:

| injection | fired |
|---|---|
| `setBlocking` removed from the refresh | both marker assertions, on both paths |
| the awaited reload removed | both value assertions, on both paths |
| the Summary editor restored | R2 |

**Final reverted run: ALL CLAIMS HOLD.**

The first injection is R1's original defect and the second is R4's, so
the calibration is the two reported faults put back one at a time.

---

## 6. This probe overwrote the evidence of the defect it fixes

`probe-completion-refresh.mjs` was **copied from the Phase 0 measurement
probe** and inherited its screenshot filenames. **Its first run replaced
the images the Phase 0 report cites** as evidence of the defect - so
`p0-after-save.png` briefly showed the FIXED surface under a report
describing the broken one.

**Verification 44 is about backups keyed on a basename.** The same fault
reaches **any artefact named after a run rather than after the run that
made it**, and a probe copied from another probe inherits its names by
construction.

Renamed to `p1-*`, recorded at the site, and both states now exist side
by side. **The Phase 0 images sent to John were sent before the overwrite
and showed the defect correctly**; the file on disk is what diverged.

---

## 7. Two carried assertions outlived the rulings

- **"the surface is three PANELS"** read 2. Correct: R2 renders the
  Summary group **only when Summary is required**, and that fixture is
  not missing one. Re-pointed to two-plus-Summary-when-required, with a
  new assertion that the surface never edits Summary.
- **A triple-click selection is now dropped by the refresh's re-render**,
  so the address edit read `"SingaporeJurong"`. The probe appends a
  distinctive suffix instead - the same remedy the Summary check already
  used, and it does not depend on a selection surviving a render.

---

## 8. What this phase does not establish

- **No walk.** Probes and screenshots.
- **No layout claim was made**, so the three widths were re-run as a
  carried check rather than as new evidence. Nothing moved: 21/21.
- **The door was not re-measured for a new write**, because R2 **removes**
  one and adds none. The carried door checks in `probe-polish` still pass.
- **The count was correct in every reading, before and after.** Nothing
  here proves it could be wrong; it was fresh already.
- **A lead missing nothing** does not reach this surface and was not
  measured.
