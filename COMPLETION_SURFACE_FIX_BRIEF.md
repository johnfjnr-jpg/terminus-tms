# The LEADS COMPLETION SURFACE FIX round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`LEADS_CARD_POLISH_2_BRIEF.md` and its reports. Drafted 2026-09-12 from
John's walk of the completion surface; re-verify premises against the
tree you are on. This brief's R-series is its own.

**Standing verification:** live DOM and screenshot after rebuild, with
`check-dist-fresh.mjs` before every live-DOM measurement, and **any
layout claim measured at 1240, 1920 and 3440**. **The door calibrated
both ways for any write.** The pre-commit hook runs all suites. **The
vanilla-asserting suites are not evidence about these screens.**

---

## Context

John walked the completion surface built last round. It found two things.

**The follow-up panel stays FROZEN** - rebuilt in the follow-up-entity
round. **Lead Detail stays FROZEN** pending John's parity walk.

---

## Rulings of record (John, 2026-09-12, from the walk)

**R1. STALE MISSING-MARKERS BUG.** On save, the completion surface's `*`
markers **do not recompute**. A required field the user has just filled
keeps its star, so the surface shows **open-time markers over current
values**.

**Target:** the full record stays displayed, and on **every** save - in
the surface **and** via the address popup, which already refreshes values
- the markers recompute against current values from **the server's own
blocking list** (`computeBlocking` through `exit-criteria`). A filled
required field loses its star, a still-empty one keeps it, and the
"N still to complete" count follows.

**Proven by save-then-read:** fill a required field, save, that field's
marker clears while genuinely empty ones remain, and the count is right.

**R2. SUMMARY DUPLICATION.** Summary is editable in **two places at once**
when the full record shows - the completion surface **and** the card's
Summary panel below, both live, both saving.

**Ruled (b): the CARD's Summary panel owns Summary editing.** The
completion surface **stops editing Summary**. It may **mark** Summary as
required - the star, from the server's blocking list - but provides **no
editor** for it. **One field, one editor.**

**The consequence to handle:** a lead whose **only** missing field is
Summary would open the completion surface with nothing to edit. The flow
must handle that gracefully - the surface **says Summary is required and
points at the card's Summary panel**, rather than showing an empty or
confusing surface. **Phase 0 confirms whether the case can arise; Phase 1
handles it.**

**R3. Method unchanged.** Phases stop for sign-off. Rulings given in
conversation are appended **at the phase they launch**. Data changes
proposed before applied. Nothing pushes without the word.

**R3. THE PARENT OWNS REFRESHED BLOCKING** and passes a refresh
callback. The in-surface save and the address-popup path both call **one
thing**. **No second copy in the child** - that is the two-readers fault
this round exists to remove.

**R4. THE VALUE STALENESS IS IN SCOPE, ruled YES.** The empty box over
saved data is the same surface and the same save, and it is the half that
makes a person retype. Markers and values are fixed as **one
save-then-refresh treatment covering all three paths** - in-surface save,
address popup, partial save.

**R5. THE SUMMARY-ONLY SURFACE: STAR IT AND NAME THE CARD'S PANEL.**
"Summary required, complete it below", keeping one consistent surface
rather than a flow that is a surface sometimes and a jump sometimes.

---

## Phase 0: measurement only

1. **R1: reproduce the staleness live.** Fill a required field, save, and
   measure **precisely** what recomputes and what does not - markers, the
   count, the field values. The walk suggests **values refresh while
   markers and the count may not**. **Name the instrument.** Establish
   **where the marker state is computed** and why it does not refresh on
   save.
2. **R1 cross-surface: the address popup path.** It refreshes values, but
   **do the markers behind it recompute?**
3. **R2: confirm Summary is rendered editable in BOTH** the completion
   surface and the card panel with the same value, and measure whether
   they **share state or hold independent copies**. Two independent
   editors of one field is the defect.
4. **R2's consequence: can a lead reach the completion surface with
   Summary as its only missing field?** If so, what does the surface show
   today.

**Do NOT touch the follow-up panel or Lead Detail.**

Stop with the Phase 0 report: R1's precise staleness and where it is
computed, the address-popup cross-surface behaviour, R2's two-editor
confirmation and the Summary-only case, and the decisions Phase 1 needs.
**Nothing pushes.**
