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

**R1 REFRAMED, and MERGED WITH R6.** The popup already shows the correct
server-derived list; what it lacks is **inputs**. R1 is therefore: make
the popup **actionable**, so the missing fields are entered in place and
no separate panel is needed.

**The entry surface is built ONCE** and used by both the Qualify
completion popup and the New Lead grid, because the seven fields R6 adds
to the grid are the same seven the popup needs. **Two implementations of
one field set is the drift this project keeps catching.**

**R3 DEFERRED, in part.** Take R5's action-row move and a notes cap now,
roughly 40 to 55px, and **state that as the achievable figure**. The
remainder defers to the follow-up-entity round, which rebuilds the 218px
follow-up panel anyway. **The follow-up panel is NOT unfrozen to save
height.**

Record R4's counter-pull and hold both rulings together: an editable
Summary is **taller** than a paragraph, and the 192px of slack makes it
affordable. Card height stated **before and after at 1240, 1920 and
3440**.

**R2 CONFIRMED CARD-LOCAL.** Frozen Lead Detail is not touched and not
extracted from; the duplication is declared, like `NurtureDialog`.

**R2 FLIPS last round's R11.** An editable address is a **write**, so the
zero-controls assertion **expires** and is replaced by a read-versus-write
separation, asserted both ways per card: unowned means address readable,
edit controls dead, Save unreachable; owned means editable, Save enabling
only on dirty.

**R5 AT 1240, RULED (a): ACCEPT THE WRAP.** The four buttons sit on the
head's line at 1920 and 3440, and wrap to a second line within the head at
1240 where they plus the name line exceed the width. **No label change.**

**Asserted rather than merely accepted**, at all three widths: the actions
stay inside the head and never overflow it; they share the name's line at
1920 and 3440 and do not at 1240. An accepted behaviour that nothing
checks is one a later change can turn into an overflow unnoticed.

---

## The round-close PROMOTION QUEUE

Candidates named at the phase that raised them.

### F3, the unclassed-control class

Four instances across three phases. Carried from the previous brief; the
table is there. Nothing catches it because presence, position, state and
behaviour all read green on a white browser default.

### `flaky-gate-tests`, NAMED AS A CLASS

**Two intermittent gate failures, different mechanisms, one
consequence.** Both stay recorded; **neither is buried under a retry.**

| | test | mechanism |
|---|---|---|
| **F5** | `teardown-scoping`, the exact-count scan | a query getting **slower** as `record_revisions` grows, crossing Postgres's statement timeout |
| **F8** | `atomicity: 40 genuinely concurrent appends` | a **dropped connection** among forty simultaneous HTTP calls - `TypeError: fetch failed` |

**The consequence is the same and it is the reason this is a class:** a
gate can go red for a reason unrelated to the code, and **at that moment
nobody can tell it from a real regression without re-running.** That is
the one thing a gate exists to make unambiguous.

**And a retry that goes green is exactly how a real intermittent defect
gets dismissed**, which is why the direction matters rather than the
individual fixes.

**The close rules the direction:**

- **retry with a recorded cause** - the runner retries a named set once
  and reports that it did, so a flake is visible rather than invisible;
- **or harden the cases** - bound F5's scan so it cannot outgrow the
  timeout, and give F8's forty calls a transport that tolerates one
  drop.

Recommended: **harden**, with retry as the fallback for what cannot be
hardened. A retry makes the gate quieter; hardening makes it honest, and
this estate's whole argument is that a green must mean something.

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
