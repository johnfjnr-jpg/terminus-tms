# The LEADS CARD POLISH round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill, `LEADS_CARD_BRIEF.md` and its Phase 0/1/1b/2 reports. Drafted
2026-09-12 from John's walk of the card; re-verify premises against the
tree you are on. This brief's R-series is its own.

**Standing verification for every phase:** live DOM and screenshot after
rebuild, with `scripts/check-dist-fresh.mjs` run BEFORE every live-DOM
measurement, and **any layout claim measured at 1240, 1920 AND 3440**.
Verification 10, and the last phase is the argument: a one-width claim
missed two things, and 1240 was where both showed.

The pre-commit hook runs all suites. **The eight vanilla-asserting suites
are not evidence about these screens.**

---

## Context: the walk happened

John walked the card. **It mostly works.** What follows is polish, not
rescue.

**Two bigger ideas from the walk are DEFERRED to their own rounds and are
NOT in scope here:**

1. **Follow-up tasks become a SYSTEM-WIDE entity** - its own round, next.
2. **Batch Edit** - its own round, after that.

---

## Rulings of record (John, 2026-09-12, from the walk)

**R1. QUALIFY COMPLETION IS SELF-CONTAINED.** Pressing Qualify on an
incomplete lead shows **ONE** completion popup carrying **ALL** missing
data **for entry**, with a message as plain as "please complete missing
data". **The user must NOT have to open Address details, or any other
panel, separately to finish.** The missing set comes from the server's
own list - `computeBlocking` through `exit-criteria` - never a client
copy.

**R2. ADDRESS BECOMES AN EDITABLE POPUP.** The Address details button
opens a popup showing the address panel per the mockup, **editable**, with
a Save that enables only when dirty.

**This FLIPS last round's R11.** An editable address is a **write**, so on
an UNOWNED lead its edit controls are **neutralised by the door** while
**reading is preserved**. Calibrated both ways, per card: unowned means
address readable, edit controls dead, Save unreachable; owned means
editable, Save enabling on dirty.

**R3. CARD VERTICAL DENSITY.** The card is **too tall**. Optimise it.
Measure card height **before and after at 1240, 1920 and 3440**, with a
screenshot at each.

**R4. SUMMARY EDITABLE ON THE LIST.** The Summary on the card becomes
editable inline. It is a write, so the door reaches it on unowned cards
like the others.

**R5. LAYOUT TIDIES.**
- Action buttons on the **top line, middle** (mockup image2).
- **Notes moved left**, to align with the end of the Created Date field.
- Company/Source/Created Date are already on the name line: **keep**.

**R6. NEW LEAD GRID: THE FULL FIELD SET.** Carried from the earlier walk
- "all fields available for entry" - and still not complete. Confirm the
current state and finish it.

**R7. THE FOLLOW-UP PANEL IS FROZEN.** **Do not touch or polish it.** It
is rebuilt next round when follow-up tasks become a system-wide entity,
and polishing a panel that is about to be replaced is work thrown away.

**R8. Method unchanged.** Phases stop for sign-off. Rulings given in
conversation are appended to this brief **at the phase they launch** -
three consecutive rounds have been caught by the count at the close, so
this is the standing risk. Data changes proposed before applied. Nothing
pushes without the word.

**AND LEAD DETAIL REMAINS FROZEN**, from the previous round's R4. It is
retired only after John confirms card parity, which has not happened.

---

## Phase 0: measurement only

1. **The Qualify completion flow today.** What the popup shows on an
   incomplete lead, and **whether it currently forces opening Address
   details to finish**. Reproduce live: this is R1's defect.
2. **Address today.** A read-only disclosure. What an editable popup
   needs, and - since the address panel exists on FROZEN Lead Detail -
   **what is shareable versus what must be card-local**. Do not reuse in
   any way that touches Lead Detail.
3. **Card height composition at 1240** (R3): what drives the vertical
   cost, plus **the busy-card case** - many notes, address open - which
   the last phase flagged as unmeasured.
4. **Summary rendering** on the card, and the editable delta (R4).
5. **Layout deltas** for R5.
6. **New Lead grid**: current field set versus the complete set (R6).

**Do NOT measure or touch the follow-up panel (R7) or Lead Detail.**

Stop with the Phase 0 report: R1's defect reproduced, the
address-editable scope, the card-height drivers, the small deltas
(R4/R5/R6), and the decisions Phase 1 needs. **Nothing pushes.**
