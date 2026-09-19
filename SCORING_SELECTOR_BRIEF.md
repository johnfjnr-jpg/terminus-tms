# Scoring selector round (V9)

**The score control becomes a five-button row with the anchor at the point of
use.**

Branch `scoring-selector`, off merged `main` at `8e985b2`. Nothing pushes. One
stop at the end.

**A note on the precondition, recorded rather than passed over.** The parked
block said this round re-opens after walk-3 is "closed, merged to main, **and
pushed**". Walk-3 is closed and merged; it is **not pushed**, because that word
has not been given. John named `8e985b2` explicitly when un-parking, which
supersedes the clause. Said here so the record does not read as the precondition
having been met.

---

## Step 0 (amendment, John 2026-09-19)

- **`walk-3` deleted**, after confirming it is fully merged.
- **The park form's dismissal refusal moves from `msg-error` to `msg-warning`**,
  the attention amber. **Wording unchanged.** Cosmetic tier: red-first guard on
  the error-class binding, screenshot opened and read.

Both landed in `837c8ed`.

---

## The rulings (John), verbatim

### R1. Five inline buttons replace the dropdown

The score dropdown is replaced by **five inline buttons, 1 to 5, in the criterion
row**. Hover or keyboard focus on a number shows **that number's anchor
sentence** in the row's spare width to its right; clicking (or Enter) commits
that score **through the existing write path unchanged**.

**2 and 4 render as bare numbers with no invented text**; their anchor area stays
empty.

### R2. The anchor display area is RESERVED

**One stable region**, sized for the **longest anchor at 1440 and 1240**, so the
row never jiggles as text changes.

**Measure the longest anchor first and size from the measurement.**

### R3. Keyboard per the R-K standard

Arrows move across the numbers **with the anchor following**. Enter commits.
Escape reverts per A3. **Tab order unbroken.**

### R4. Show definitions is REMOVED from the criterion row

The anchors at the point of use replace it. **History entries keep showing anchor
text as today.** The definitions **data and route are untouched**; only the
toggle goes.

### R5. What does NOT change

The current score **stays visible as today** (the number and state left of the
buttons). The **awaiting-reason mechanism**, the **reason field placement** and
the **measurability control** are **UNCHANGED**.

---

## Step 2 — Phase 0, measure before build

Four measurements, each of which the build depends on:

1. **The longest anchor per score per criterion** — drives R2's sizing.
2. **Which component owns the score select, and what shares it.** Qualification
   and every R4-derived stage card must get the same control: **one mechanism**.
3. **The write path the buttons must call unchanged.**
4. **Current keyboard and tab behaviour of the select**, for the R3 guards.

---

## Step 3 — Build as one mechanism, full treatment

**This is the control that writes scores**, so it gets the full treatment rather
than the cosmetic tier.

- **Red-first guards.** The select being present is the failing claim; **a button
  click writing through the same path as the old select is the positive
  control.**
- **Both directions live at 1440 AND 1240**, on an owned fixture:
  - score by mouse, **with the anchor read before the click**;
  - score by keyboard alone per R3;
  - an **Escape revert**;
  - **a 2 committed from its bare number**;
  - the **awaiting-reason flow intact end to end**;
  - all **read back from the database**.
- **Screenshots at both widths**, opened and read, delivered to OneDrive per M6.

---

## Step 4 — Close

Close-out, `CURRENT_STATE.md` regenerated, **full gate on the branch**. No merge,
no push. **STOP for John's word.**
