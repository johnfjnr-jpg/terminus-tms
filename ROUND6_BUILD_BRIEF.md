# Round 6 build brief: Test Bed panel reorganization, cross-cutting fixes

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND5_BUILD_BRIEF.md`. Read all four before
starting.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Phase 1: Contacts hover popup, investigate the regression first ✅ COMPLETE

**Confirmed real regression, or a second, unfixed instance, investigate
before building.** The linked-records hover popup (showing Test Bed/
Opportunity names when hovering a Contact's record count) is wrapping
long names to 3 lines again ("Trilogy Technologies Pte Ltd"), despite
single-line truncation being explicitly built and confirmed for this
popup earlier in this build.

Investigate first, report before fixing:

1. Is this genuinely the same popup component that was already fixed,
   now broken by something touched since, a real regression? Or is
   this a second, separately-coded popup with a similar shape that
   never received the original fix? Check git history on the relevant
   CSS/component, don't assume either way.
2. If it's a regression, identify what changed it, don't just
   reapply the fix blind, understand why it stopped holding.

**Test evidence required:** whichever the cause, fix it and confirm
with a real Contact linked to multiple long-named Test Beds/
Opportunities, every entry renders as a single line, truncated with
ellipsis if needed, not wrapped.

---

## Phase 2: Test Bed Customer Details panel, width and buyer save flow ✅ COMPLETE

1. Widen the Customer Details panel so the buyer role dropdown and its
   actions aren't truncated (confirmed live in the attached
   screenshot, "Select a contact..." cut off, Link/+New buttons
   crowded).
2. Remove the separate "Link" button entirely. Selecting a Contact
   from the dropdown saves directly, same pattern already built for
   Opportunity's Account picker (click a result to commit, no
   separate confirm click).
3. The "New [Role]" inline Contact-creation dialogue (Round 5 Phase 9)
   drops the role-specific wording from its title, "New Contact," not
   "New Client Commercial Buyer."
4. Rename "Create and Link" to "Save" on that same dialogue.

**Test evidence required:** confirm the widened panel shows the full
dropdown and buttons without truncation at the tested widths. Confirm
selecting a Contact from the dropdown saves immediately with no
separate click. Confirm the inline-creation dialogue's title and
button text match the above regardless of which buyer role triggered
it.

---

## Phase 3: Test Bed Reference tab reorganization ✅ COMPLETE

Confirmed decisions, all four:

1. Sensor count fields (# SafeSight, # Air Quality, # HEMIR) move from
   Site Details to the Commercials tab, alongside the cost engine that
   already consumes them as inputs.
2. Remaining Site Details fields (Site Ownership, Installation
   Environment, Site Address, City, the generated Sensors list, and
   anything else not otherwise relocated) become their own panel,
   positioned under Key Dates.
3. Installer, Test Bed Tech Team, and Install Notes move into the
   Installation and Commissioning stage tab specifically (one of the 8
   workflow-stage tabs from Round 5 Phase 7), not a generic panel.
4. Exit Criteria removed from Reference, relocated: each of the 8
   stage tabs now shows its own outstanding requirements for that
   specific stage, reusing the existing `computeBlocking()`/exit-
   criteria mechanism (Round 5 Phase 5), generalised to accept a
   target stage the same way `document-requirements?stage=` was
   generalised in Round 5 Phase 7, not a second computation path.
5. Use Cases stays on Reference, repositioned to sit with Summary
   rather than as its own separate grid panel.

**Test evidence required:** confirm the Commercials tab shows the 3
sensor fields and that they still feed the cost calculation correctly,
no regression to Phase 6's cost math. Confirm the new Site Details
panel renders under Key Dates with all its fields intact, nothing
dropped. Confirm the Installation and Commissioning stage tab shows
Installer/Tech Team/Install Notes, and that editing them there
persists correctly. Confirm each of the 8 stage tabs shows its own,
genuinely different Exit Criteria (not the same list repeated on every
tab), verified against at least 2 different stages with different real
outstanding requirements. Confirm Use Cases and Summary render
together, Use Cases panel itself removed from the main grid.

---

## Phase 4: Accounts page, Parent Account spacing ✅ COMPLETE

Real, confirmed CSS bug (screenshot attached to the original feedback):
when Parent Account is unset, "None" sits directly against the "Link
Parent Account" button with no spacing, and the button's own label
wraps awkwardly to 2 lines instead of fitting on one.

**Test evidence required:** screenshot before/after, confirm proper
spacing and the button label rendering on one line at the tested
widths.

---

## Documentation discipline

Same as every prior round: update `DESIGN_PRINCIPLES.md` the moment a
decision in this brief changes during the build. The Phase 1 regression
finding (genuine regression vs. second unfixed instance) is worth
recording precisely regardless of which it turns out to be, given this
build's history of both categories showing up before.

---

## Build complete, all 4 phases genuinely verified

**A note on how this closing section came to be written, same discipline
as Round 5's own close-out.** Each phase updated `DESIGN_PRINCIPLES.md`
live as it was built, not in one consolidated pass after the fact - this
table is assembled from those 4 already-written entries. Worth naming a
cross-cutting theme that showed up twice this round, not three separate
coincidences: Phase 1's first truncation check (`span.scrollWidth`,
always `0` for an inline element) and Phase 3's first Exit Criteria check
(waiting for "non-empty," which resolved instantly on the *previous*
tab's stale content) were both the identical class of mistake, a
verification that measured something other than the thing actually being
claimed. Both were caught and fixed before being reported, not after,
but a future round's own testing should watch for this pattern
specifically: confirm the check is measuring genuinely fresh, real state,
not a technically-true but misleading proxy for it.

| Phase | Delivered | Beyond the original brief |
|---|---|---|
| 1. Contacts hover popup | Investigated first, per the brief: confirmed a never-fixed gap, not a regression - `.linked-record-row` never had truncation CSS in either of its two real callers (the Contacts count popup and the Test Bed matrix popup). Fixed with the same established `.record-card-title` pattern (`white-space: nowrap`/`overflow: hidden`/`text-overflow: ellipsis`) plus a bounded `max-width` on both popup containers | Retroactively documented the 2026-08-16 click-modal-to-hover-preview switch for the Contacts count - a real architectural change that had never been recorded anywhere in `DESIGN_PRINCIPLES.md` before this |
| 2. Test Bed Customer Details panel width and buyer save flow | Customer Details spans 2 grid tracks (`.pg-card-wide`); standalone "Link" button removed, the buyer-role `<select>` saves directly on `onchange`; inline-creation dialogue title fixed to "New Contact" regardless of triggering role, Save button renamed from "Create and link" | Flagged plainly that the brief's own cited precedent (Opportunity's Account picker, "click a result to commit") no longer exists - it was made read-only/inherited back in Round 3 - built directly against the stated requirement instead of a precedent that had since been removed |
| 3. Test Bed Reference tab reorganization | Sensor counts moved to a new Commercials "Unit Counts" card; Site Details trimmed to its remaining 4 fields plus the Sensors list; Installer/Tech Team/Install Notes moved to the Installation and Commissioning stage tab specifically; Exit Criteria generalized from the Reference tab to each of the 8 stage tabs via a new `?stage=` param on `GET /records/:id/exit-criteria`; Use Cases repositioned to sit with Summary, out of the `.ref-cards` grid | A deliberate architectural choice made while investigating how to do the Installation-fields move safely: render them once and only toggle visibility per stage tab, never tear down and rebuild, avoiding a real data-loss risk (an in-progress edit silently discarded by switching tabs) the brief itself never named |
| 4. Accounts page, Parent Account spacing | Fixed the row's own flex structure (value and button stacked in one column, not 3 competing children of a 2-child-shaped `.ref-field` row) | Traced the bug past the single row to its real structural root cause - Account detail's `.ref-cards` had never received the same `minmax(280px, 420px)` width cap Contact detail, Test Bed, and Opportunity's own Reference-style pages already have - and fixed that too, not just the one reported symptom |

**Genuinely open items, not part of this round** - carried forward from Round 5 where still true, plus one new item found this round:

- `DESIGN_PRINCIPLES.md` Section 6 (Opportunity value estimation) still describes the unbuilt `product_defaults`-driven flow found stale during Round 5 Phase 6 - unreconciled, still a materially bigger rewrite than any single phase since.
- Test Bed's sensor-count and cost-rate fields still lack confirmed server-side rejection of garbage values (client-side `type="number"` only) - unaffected by Phase 3's relocation, which only moved where these fields render, not their validation.
- The full buyer-role catalog design remains confirmed but unscoped, unchanged since Round 3/4.
- Deep Parent Account cycles (A→B→C→A) remain explicitly out of scope, unchanged since Round 4.
- **New, found during Phase 1's investigation, not acted on since it was outside that phase's own scope**: the Test Bed list's region/status matrix (`.tb-matrix`, `renderTbMatrix`, `frontend/app.js`) is live and rendered today, but `PROTOTYPE_SPECIFICATION.md` Section 6 explicitly documents a "business decision: don't build the matrices or fabricate the missing columns... sortable flat table only, no matrix breakdowns." Confirmed by direct code reading that the matrix genuinely is built and wired into the live Test Bed list, not dead code - a real, unresolved discrepancy between a documented decision and what's actually shipped, flagged here for whoever picks it up next.
