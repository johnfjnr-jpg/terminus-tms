# The LEADS CARD POLISH 2 round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`LEADS_CARD_BRIEF.md`, `LEADS_CARD_POLISH_BRIEF.md` and their reports.
Drafted 2026-09-12 from John's walk of the polished card; re-verify
premises against the tree you are on. This brief's R-series is its own.

**Standing verification:** live DOM and screenshot after rebuild, with
`check-dist-fresh.mjs` before every live-DOM measurement, and **any
layout claim measured at 1240, 1920 and 3440**. The door **calibrated
both ways** for every new write. The pre-commit hook runs all suites.
**The vanilla-asserting suites are not evidence about these screens.**

---

## First act, completed before Phase 0

**F5 hardened**, one commit, `7a3f905`, then re-gated.

The statement timeout is **per statement**, so per-statement work is what
was bounded: `TAG_CHUNK_SIZE` 25 to 6, measured roughly linear (25 tags
1,459ms, 6 tags 578ms). Same rows, more statements, **coverage
untouched**. A headroom guard now asserts the **heaviest** chunk against
a **derived** ceiling - warm times the observed 6x cold factor times 1.5
margin must clear the 8s timeout, so 889ms. Calibrated both ways.

**And the first fix rested on a measurement I got wrong**, recorded at
the site: "with payload 7,879ms, without 1,308ms, six times" was two real
numbers run in that order, so the first paid for a cold cache. Alternated
and warm the honest ratio is 1.17x. **The calibration caught it, not a
re-read** - the guard was supposed to fire on the reinjected defect and
did not.

Headline test: **19,887ms failing / 6,339ms passing before, 7,510ms now.**

---

## Context: the second walk

John walked the polished card. These are the polish-2 items.

**The follow-up panel stays FROZEN** - rebuilt next round as a
system-wide task entity, and John deferred its styling there. **Lead
Detail stays FROZEN** pending John's parity walk.

---

## Rulings of record (John, 2026-09-12, from the walk)

**R1. ADDRESS TWO LINES BUG.** The completion popup shows one address
field where the record has **Address Line 1 AND Line 2**. Both must be
enterable. Fix.

**R2. UNIFY THE COMPLETION SURFACE.** The load-bearing item. The Qualify
completion popup is rebuilt from the **SAME panel components the card
already uses** - the address panel, the contact fields, the summary -
assembled into **ONE surface**, not a separate list-with-inputs. This
removes the two-readers drift between the panel that shows and edits a
field and the popup that lists it as missing.

**Constraint: stay CARD-LOCAL.** The address machinery is shared with
**frozen** Lead Detail, so measure what is genuinely shareable against
what must be card-local, and **do not couple to or extract from the
frozen surface** - the same rule the `NurtureDialog` and address-popup
duplications already live under.

**R3. REGION DROPDOWN.** Region becomes a **select** from the region list
already in the solution, not free text. **Phase 0 finds where it lives** -
John says check Opportunities. Applies **everywhere region is entered**:
the completion surface, the address popup, and the grid.

**R4. ACCOUNT AUTOCOMPLETE.** In the account step, typing **searches
existing accounts after each keystroke** and offers a dropdown to pick;
continuing to type creates a new account. Extends `LinkAccountPanel`'s
existing link-or-create rather than replacing it.

**R5. LAYOUT.** Notes moved **further left**. **Add Note AND a Discard**
on the Notes header line. The Discard cancels **the note text being
entered** - a cancel-this-note, **not** a card-level discard.

**R6. Method unchanged.** Phases stop for sign-off. Rulings given in
conversation are appended **at the phase they launch**. Data changes
proposed before applied. Nothing pushes without the word.

**R3 RULED (a): SERVER-DERIVED.** The region list is served from the
server the way `creation-requirements` serves `sources`. Single source,
and it reaches every surface without a per-place edit.

**Frozen Lead Detail's copy is NOT edited.** It stays as it is and is
noted; the new and card surfaces read the derived source. The other
copies are re-pointed when their own surfaces are next touched.

**R4 AND R5 USE OPTIONAL PROPS defaulting to current behaviour** - the
proven `submitPath` / `onCancel` pattern - so frozen Lead Detail is
provably untouched.

**R1 FOLDS INTO R2.** One fix. `address2` arrives through R2's
panel-based completion surface, and is **not** special-cased into the
server-blocking list R2 replaces.

---

## Phase 0: measurement only, read-only after the F5 act

1. **R1:** the completion surface's address field set against the
   record's - confirm Line 1 and Line 2 are both present in the data.
2. **R2:** what the card's panel components are, **which are shareable
   without touching frozen Lead Detail**, and what the current completion
   popup would be replaced by. **This decides R2's real scope and is the
   load-bearing measurement of this phase.**
3. **R3:** **where** the region list lives (check Opportunities), its
   shape, and **every** place region is currently free text.
4. **R4:** `LinkAccountPanel`'s current search and create; whether an
   account-search endpoint exists or must be added; the account count and
   whether client-side search is feasible.
5. **R5:** the current Notes layout and the Add-note/Discard delta.

**Do NOT touch the follow-up panel (frozen) or Lead Detail (frozen).**

Stop with the Phase 0 report: R1 confirmed, **R2's real scope with the
shareable-versus-card-local split**, where the region list lives, R4's
search feasibility, R5's delta, and the decisions Phase 1 needs.
**Nothing pushes.**
