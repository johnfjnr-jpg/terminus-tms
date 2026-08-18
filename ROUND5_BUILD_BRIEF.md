# Round 5 build brief: Test Bed stage-based workflow, Account module, cross-cutting fixes

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND4_BUILD_BRIEF.md`. Read all four before
starting.

This is the largest round to date, quick bug fixes through a genuine
redesign of Test Bed's page navigation. Work through phases in order.
Stop after each, report real test evidence, wait for sign-off before
starting the next. Several phases depend on earlier ones in this same
round, don't reorder without flagging it first.

---

## Phase 1: Modal sticky headers ✅ COMPLETE

**Confirmed real bug, via screenshot.** Scrolling down inside the New
Lead dialogue or the Account Details panel (Round 4) loses the header
entirely, no way to tell what you're editing once scrolled.

Fix: freeze/pin the title line so it stays visible while the body
scrolls, both dialogues, same mechanism if the two share enough
structure to reuse one fix.

**Test evidence required:** scroll to the bottom of a long form in
both dialogues, confirm the header stays visible throughout, screenshot
before/after.

---

## Phase 2: Test Bed duplicate-naming bug ✅ COMPLETE

**Confirmed real bug**, and a known, previously-flagged gap from Round
2 that was deferred, now surfacing as a real problem. "Add Another"
creates a second Test Bed for the same Contact with the *identical
name* as the first, since Test Bed names inherit from the linked
Account's name, not something distinguishing.

Fix: new Test Beds need a name that distinguishes them from siblings
under the same Account, investigate the simplest correct approach
(e.g. appending a sequence number, or requiring/prompting a name at
creation) before building, don't guess. Rename the button from "Add
Another" to "Add New" as part of this fix.

**Test evidence required:** create two Test Beds for the same Contact
via the Add New flow, confirm they have genuinely distinguishable
names, not just visually similar ones.

---

## Phase 3: Account linking button and visibility ✅ COMPLETE

1. "Link to Account" button relabels to "Change Account" once an
   Account is already linked, stays "Link to Account" while unlinked.
   Label describes the action about to happen, not a fixed string.
2. Add a "Show Account Details" button on the same panel, view-only,
   opens the real Account Details panel (Round 4) in a read/view
   mode, distinct from the change action.

**Test evidence required:** confirm the label switches correctly
between linked and unlinked states. Confirm Show Account Details opens
the real, correct Account's details, not a blank or wrong record.

---

## Phase 4: Test Bed's own Key Dates validation ✅ COMPLETE

**Confirmed gap.** Round 3 Phase 3 built past-date restriction (Est.
Close Date, Est. Go Live) and Duration validation (integer, non-
negative, no spinner arrows) for *Opportunity*. Test Bed has its own,
separate Key Dates fields that were never given the equivalent fix.

Investigate first: confirm exactly which Test Bed date fields should
logically reject past dates (Estimated Installation Date, Est. Go
Live, by the same reasoning as Opportunity) versus which should allow
them if any exist. Confirm Test Bed's own Duration field
(`testBedDuration`) still has spinner arrows and accepts negative
values, mirror Round 3's exact fix.

**Test evidence required:** same standard as Round 3, attempt a past
date on the restricted fields, confirm rejection. Attempt a negative
or non-integer Duration, confirm rejection.

---

## Phase 5: Test Bed Reference page consolidation ✅ COMPLETE

**The largest layout change this round.** Fold Site Details' content
onto the Reference tab directly, per the provided layout reference
(a mockup, not literal pixel positions, use sensible judgement to fit
the screen well):

- Existing Terminus Details and Customer Details panels stay as-is.
- New Site Details panel: Site Ownership, Installation Environment,
  # of SafeSight, # of Air Quality, # of HEMIR.
- New Use Cases panel.
- New Exit Criteria panel: a live list of what's still outstanding to
  exit the current stage. Reuse the existing gate-check logic already
  used elsewhere (the same `blocking[]` data a transition attempt
  already returns), don't build a second, separate criteria-computation
  path.
- Key Dates panel moves to sit to the right of Customer Details,
  extend available screen width if needed, matching the wide-layout
  treatment already used on Contact detail and Opportunity's Reference
  tab.

**Also in this phase**: the "N fields open, M changed" edit-bar banner
is removed from this consolidated page. Investigate first what
actually triggers it today, merely opening a field for edit, or only
a genuine change, report which before building. Confirmed behaviour:
opening a field and leaving it unchanged should have zero visible
effect, only a real edit should surface Save/Cancel.

**Test evidence required:** screenshot the consolidated page at
1240px, 1920px, and 3440px. Confirm Exit Criteria genuinely reflects
real outstanding requirements for a Test Bed's current stage, not
placeholder text, verified against a real record with known missing
requirements. Confirm opening then leaving a field unchanged shows no
banner or Save/Cancel prompt; confirm a genuine change does.

---

## Phase 6: Test Bed Commercials tab ✅ COMPLETE

**Confirmed scope: cost-only, no price or margin.** Test Bed is
explicitly "cost to the business, no client billing" (its own
long-standing definition in `DESIGN_PRINCIPLES.md`), so a full
Opportunity-style Deal Sheet (cost → price → margin) doesn't apply,
margin has no meaning without a customer price. This tab exists to
answer "what will this Test Bed cost to build," supporting a real
go/no-go decision before committing to it.

Reuse the existing cost-calculation engine already proven for
Opportunity (the same logic computing Hardware/Hosting/Installation
costs from Base Cost Data), stopping at Cost, never computing Price or
Margin. Replaces the old Site Details tab slot (now folded into
Reference per Phase 5).

`Accumulated Cost` and `Indicative Cost`, currently static informational
fields on Test Bed, should become real, itemized, calculated totals
from this same engine, not separate, manually-implied numbers.

**Test evidence required:** enter real unit counts and confirm the
itemized cost lines and total match an independently-computed expected
value, same standard as every other calculation verification this
build has used. Confirm no price or margin figure appears anywhere on
this tab.

---

## Phase 7: Test Bed tab bar restructured to workflow stages ✅ COMPLETE

**Confirmed, the single largest architectural change in this round.**
Remove the remaining old tabs (Documents, Stage & Approvals). Replace
with 8 new tabs, one per real workflow stage (Qualification,
Pre-Site Assessment, Site Assessment, Installation and Commissioning,
Monitoring and Analysis, Review and Completion, Decommissioning,
Closed). Each stage tab shows that stage's own Documents (reference
material, informational only, per the existing `stage_reference_docs`
mechanism) and Approvals together, not as separate concepts.

**Confirmed, kept deliberately separate**: the existing chevron strip
stays exactly as it is today, a status/progress indicator, unchanged.
This is not the same navigation as the new tab bar, both exist
simultaneously. Final tab bar: Reference, Commercials, then the 8
stage tabs, 10 tabs total. Flagged as a real amount of visual density
worth being aware of, confirmed as the intended design regardless, not
something to silently simplify away.

Investigate first: confirm exactly how `stage_reference_docs` and the
existing Approvals mechanism can be filtered to a single stage's data
for rendering inside its own tab, versus how they're currently queried
(likely for the whole record, not stage-scoped). Report findings
before building.

**Test evidence required:** navigate to a real Test Bed's each of the
8 stage tabs in turn, confirm each shows only that stage's own real
Documents and Approvals content, not another stage's, not everything
at once. Confirm the current, active stage's tab is visually
distinguishable from the others.

---

## Phase 8: "Next Stage" button ✅ COMPLETE

Investigate first: this build already established (early this
session) that clicking ahead on the chevron attempts the real stage
transition, gated by actual requirements. Confirm whether an explicit
"Next Stage" button at the top of the chevron would duplicate that
existing mechanism, or whether it's meant as a more discoverable,
separate entry point to the same underlying transition logic. Report
before building, don't build a second, parallel transition mechanism.

**Test evidence required:** confirm the button (once built) triggers
the identical real transition logic already proven for the chevron,
same gating, same rejection behaviour if requirements aren't met.

---

## Phase 9: Inline qualified Contact creation from Buyer Role dropdowns ✅ COMPLETE

**Confirmed scope, both Test Bed and Opportunity.** If the desired
Contact isn't in a Buyer Role dropdown's list (filtered to Contacts
linked to the record's Account), offer the option to create one
inline. Since being selected as a Test Bed or Opportunity buyer
implies qualification, the new Contact goes through the same
mandatory qualification field requirements as the existing
qualification flow, not fast, unqualified entry. After completing
that entry, return to the original screen to continue.

**Test evidence required:** trigger inline creation from a Buyer Role
dropdown on both Test Bed and Opportunity, confirm mandatory
qualification fields are genuinely required (not skippable), confirm
completing creation returns to the original screen with the new
Contact now selectable and correctly linked to the right Account.

---

## Phase 10: Accounts as a first-class module ✅ COMPLETE

**Confirmed, genuinely new scope.** No Account detail or list screen
exists anywhere today, confirmed in Round 4's investigation, Account
is currently only reachable through pickers. Add:

- A new "Accounts" item in the left-hand navigation.
- A list view.
- A detail view, showing and allowing editing of everything built in
  Round 4's Account Details panel (Account Number, Terminus Lead,
  Billing/Shipping Address, Website URL, Parent Account, and so on).
- Create, edit, and review capability from this new area, not just
  through the existing Contact-linking pickers.

**Test evidence required:** create a new Account directly from this
new area (not via a Contact), confirm it appears correctly in the
list, edit it, confirm changes persist, confirm it's also correctly
linkable from Contact/Test Bed/Opportunity's existing pickers, no
regression to those.

---

## Documentation discipline

Same as every prior round: update `DESIGN_PRINCIPLES.md` the moment a
decision in this brief changes during the build, particularly the
Exit Criteria computation approach (Phase 5) and the stage-scoped
Documents/Approvals query pattern (Phase 7), both genuinely new
mechanisms worth recording precisely for future reference.

---

## Build complete, all 10 phases genuinely verified

**A note on how this closing section came to be written, worth keeping,
not tidied away, same discipline Round 3's own closing section
established.** A "Round 5 fully built" claim was made prematurely after
Phase 8, with Phases 9 and 10 (inline qualified Contact creation, and
this Accounts module) not yet built, tested, or mentioned in any
report. Caught only because the phase count was checked explicitly
against this document's own original phase list, `grep -n "^## Phase"`
against this file directly, not trusted from a sense that the recent
work felt substantial. Both phases were then built properly. Full
detail recorded in `DESIGN_PRINCIPLES.md`'s Round 5 Phase 9 entry. Left
here as the same standing reminder Round 3 left for this round: check
completeness against the brief's own phase list before saying "done."
This round's own documentation discipline differed from Round 3/4's
single consolidated write-up done after the fact - each phase updated
`DESIGN_PRINCIPLES.md` live as it was built, and this closing table is
assembled from those 10 already-written entries, not a fresh summary
composed from memory.

| Phase | Delivered | Beyond the original brief |
|---|---|---|
| 1. Modal sticky headers | `.modal-header-sticky` (New Lead and Account Details, the only two dialogues with a scrolling body) | Confirmed by full grep that the other 5 `.modal-backdrop` dialogues genuinely don't need this fix, none scroll, rather than assuming the fix should spread further |
| 2. Test Bed duplicate-naming bug | Count-then-suffix naming (`" (N)"`) on `POST /contacts/:id/create-test-bed`, "Add Another" renamed to "Add New" | Investigated and ruled out a name-prompt modal specifically because Test Bed's `name` field has no post-creation edit UI, unlike Opportunity's - a friction-vs-correctability tradeoff made explicit, not assumed |
| 3. Account linking button and visibility | State-aware "Link to Account"/"Change Account" label; new view-only "Show Account Details" via a shared `setAccountDetailsMode()` | A real bug caught in the same area, not part of the brief: `validateParentAccountId`'s circular-reference check falsely rejected normal Parent Account selection at creation (`null === null`), fixed with an `accountId &&` guard |
| 4. Test Bed's own Key Dates validation | Past-date restriction on both Test Bed estimate date fields, non-negative-integer + no-spinner on `testBedDuration`, mirroring Round 3 Phase 3's Opportunity fix exactly | Confirmed both existing Test Bed date fields are estimates (no "actual" counterpart exists, unlike Opportunity), so nothing needed excluding from the fix's scope |
| 5. Test Bed Reference page consolidation | Site Details folded onto Reference (Terminus/Customer/Site/Key Dates), new Use Cases and Exit Criteria panels, edit-bar banner gated on genuine dirty state | Confirmed nothing from the old Site Details tab was dropped despite the provided mockup showing a narrower field set than the live tab actually had |
| 6. Test Bed Commercials tab | Cost-only tab reusing Opportunity's proven 3-group cost engine, `Accumulated`/`Indicative Cost` now real itemized totals | A real, precisely-recorded discrepancy found between this document's own Deal Sheet description and the live implementation - Deal Sheet is not a persisted `record_type = 'deal'` record, flagged then, corrected in this end-of-round pass (see `DESIGN_PRINCIPLES.md` Section 2) |
| 7. Test Bed tab bar restructured to workflow stages | 8 stage tabs sharing one physical panel, stage-scoped `document-requirements?stage=` param, relocated Stage Transition section, current-stage dot on the tab bar | Two real races found and fixed by testing, not assumed safe (`tbStageTabLoadToken`, `tbUserPickedTab`) - both only surfaced because completion was verified with a genuine signal, not a fixed delay |
| 8. "Next Stage" button | New button at the top of the chevron, wired to the exact same `attemptTransition` the relocated section's own button already uses | Investigated first and confirmed, via full `git log`/`git show` history, that the chevron never had a click handler at any point - this was genuinely new, not a restoration of lost functionality, contrary to the brief's own premise |
| 9. Inline qualified Contact creation from Buyer Role dropdowns | Shared `openInlineBuyerContactModal`/`saveInlineBuyerContact` (Test Bed and Opportunity), chaining `POST /contacts` → `link-account` → `Qualified` transition → `buyer-contacts`, one implementation not two | Caught before this phase started: a premature "Round 5 fully built" claim, the round-level version of Round 3's own documented process failure, corrected immediately, see this section's own opening note |
| 10. Accounts as a first-class module | New nav item, list view, lightweight create prompt, full click-to-edit detail page (`account-detail.js`) with Parent Account search-and-link and a read-only Linked Contacts roll-up | A deliberate architectural choice, not assumed from the brief's field list: a genuine detail page matching every other record type's own pattern, not a reuse of Round 4's all-at-once modal |

**Genuinely open items, not part of this round:**

- `DESIGN_PRINCIPLES.md` Section 6 (Opportunity value estimation) still describes the unbuilt `product_defaults`-driven flow found stale during Phase 6 - only Section 2's references were reconciled in this round's end-of-round documentation pass, Section 6 itself is a materially bigger rewrite, flagged, not undertaken.
- Test Bed's Site Details numeric fields (camera/sensor counts, per-unit costs) still have client-side `type="number"` only, unconfirmed server-side rejection - a pre-existing gap, not touched by this round.
- The full buyer-role catalog design remains confirmed but unscoped, unchanged since Round 3/4 - Phase 9 built one more concrete consumer of buyer roles, it didn't resolve the catalog design question itself.
- Deep Parent Account cycles (A→B→C→A) remain explicitly out of scope, unchanged since Round 4 - only direct A↔B and self-reference are guarded against.
