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

---

## Phase 0's rulings (John, 2026-09-19), appended at the phase they launch

### R2 is ruled OPTION B: the Test Bed becomes a CALLER

The anchor renders through **the estate's floating popup**, not a reserved
region. The Test Bed becomes a **caller of the Opportunity's mechanism** - one
component or shared module - carrying over its **420px clamp** and its
**hover/focus behaviour**.

**The Verification 23 remedy, and it is the rule's own words.** Rule 23 says the
fix for two rulings on one question is **deletion, not reconciliation**: one of
them becomes a caller of the other. That is exactly what B does, and it is
recorded in **both briefs** - here and in `ASSESSMENT_PANEL_PHASE_0_BRIEF.md` -
so neither surface can drift back to believing it owns the mechanism.

**What Phase 0 measured, which is why B and not A:** a region sized for the
longest anchor (302 characters) costs **120px per row at 1240**, against a row
head of 77px - about 600px across the five criteria, empty until hovered. The
Opportunity had already measured the in-row cost at 36px and chosen to float.

### All other rulings stand, unchanged

R1 five buttons with **2 and 4 bare**; R3 keyboard per the R-K standard **with
the popup following focus**; R4 **Show definitions removed**; R5 measurability
and awaiting-reason **untouched** - and Phase 0's measured second select, the
measurability control sharing the `tb-score-select` class, **must not be caught**
by anything the build writes.

### R6. The shared popup DISMISSES ON SELECTION, and at most ONE renders

John's finding on the live Opportunity screen.

- **Selecting commits and clears the popup** until the pointer re-enters or
  focus returns.
- **Hover or focus moving elsewhere MOVES the popup, never accumulates.**
- **Fixed in the SHARED mechanism**, so both surfaces inherit it.

**Red-first: the current linger is the failing claim** - two popups parked after
selections, per John's screenshot - **proven on the Opportunity surface first**,
then inherited on the Test Bed build.

### R7. Budget figure and currency render only at a figure-bearing level

Opportunity surface. **Own commit, own live proof.**

- The Budget **figure and currency inputs render ONLY** when the selected level
  is **Our hypothesis, Buyer confirmed or Verified**.
- **Hidden** for **Not applicable** and **Unknown**.
- **A stored figure is PRESERVED when the level drops, never cleared**, and
  **shown again** when a figure-bearing level returns.
- **Reason field unchanged.**

**Live proof:** figure entered at Buyer confirmed, level dropped to Unknown,
input gone, **database value intact**, level raised, figure back on screen.

---

## The measured findings, ruled (John, 2026-09-19)

### F-COM RIDES THIS ROUND, and closes B2

**One commit.** The Commercials panel's inputs get the estate's field treatment
- the rule the FieldRow fix never reached - and the Units required card gets the
width constraint so **no input sits on its own label**.

**Cosmetic tier** (build discipline 17 M2): red-first guard with the **white
computed background as the failing claim**, a screenshot at 1440 opened and
read, and the affected suite. No live injection harness: no handler and no write
is touched.

**B2 IS CLOSED BY THAT COMMIT**, and its history is recorded rather than tidied:

1. **Group B's Phase 0 named the commercial inputs** as the likely cause of the
   white fields. **That diagnosis was right.**
2. The standard rollout folded B2 in as *"OPPORTUNITIES: the white input boxes"*
   with an exit criterion of *"no white remaining"*, then **RETRACTED** the
   diagnosis in its own close-out: *"my Group B Phase 0 named the 22 commercial
   inputs as the likely cause of the white. It was wrong because I read the
   markup (no class) instead of the stylesheet."*
3. **The retraction was wrong.** That round found a real and different cause -
   `FieldRow`'s text editor rendering an `<input>` with no `type`, which
   `input[type="text"]` cannot match - fixed it correctly, and proved it on four
   FieldRow surfaces. **The Commercials panel's inputs are not FieldRow rows**,
   so the rule never reached them. The inference was withdrawn on evidence about
   different inputs.
4. **And B2 was not on that close-out's carried list**, so nothing tracked it
   between then and John finding it on screen. Measured at the un-park: **62
   elements painting `rgb(255,255,255)`, every one an `<input>`.**

`STANDARD_ROLLOUT_BRIEF.md` gains a one-line pointer here.

### F-TOP DOES NOT RIDE

**Recorded as the opening scope of the next round (the Opportunity round)**,
with the split exactly as measured rather than as a single item:

| | What | Why it is that shape |
|---|---|---|
| **Summary and notes** | A **third caller** of the shared components | `NotesHistory` and `FollowUpTask` already live in `contact/` and are imported by **both** `ContactHost` and `TestBedHost`. Measured on 23 live opportunities: 2 carry a summary, 11 carry notes - the data and its write path exist |
| **The follow-up task** | A **designed feature**: data and routes to build | Measured on the same 23: **zero** carry `followUpDate` or `followUpDescription`. There is nothing to render and nowhere to write it |

**The `--red` hygiene item joins that round's scope**: `var(--red, #e06c6c)`
fallbacks and bare `rgba(242,100,100,0.9)` literals, which are the same shape the
amber sweep closed - a token reachable only through a literal is invisible to the
palette and to the invariant that checks it.

---

## Step 4 — Close

Close-out, `CURRENT_STATE.md` regenerated, **full gate on the branch**. No merge,
no push. **STOP for John's word.**
