# Round 3 build brief: Account architecture, Opportunity Reference and Commercials

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND2_BUILD_BRIEF.md`. Read all four before
starting. This brief assumes Round 2 is complete, including tonight's
Opportunity Account read-only fix and chevron swap.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Phase 1: Complete the Account architecture (Lead/Contact)

**This finishes something discussed but not fully built tonight.**
Confirmed direction: Account = Company, one thing, resolved once at Lead
qualification, not two separate concepts (a free-text Company field plus
a manually-linked Account requiring its own panel and button).

Investigate first, report before building:

1. Is Account linkage currently a hard requirement to qualify a Lead, or
   optional? Check the actual qualification gate rules, don't assume
   from the UI alone.
2. Where else in the codebase does free-text Company get read from
   directly (e.g. `contactPayload.company` feeding `initialLead`/
   `customerLead` auto-population at Test Bed/Opportunity creation,
   confirmed built earlier this session)? Report every real dependency
   on the free-text field before changing what it means.
3. Confirm the existing search-existing/create-new Account reconciliation
   panel (already built, used elsewhere) can be reused here directly for
   this new trigger point, pre-filled from the typed Company text.

Confirmed decisions, build once investigation is reported:

1. Remove the standalone Account panel from the Lead screen entirely
   (currently shown pre-qualification with "Not linked yet" / "Link to
   Account").
2. At Lead qualification, trigger the existing Account reconciliation
   panel automatically, pre-filled from the Company text typed at fast
   entry. The user resolves it (link existing or create new) as part of
   qualifying, not as a separate step afterward.
3. On Contact detail, remove the separate standalone Account panel.
   What was labelled "Company" in Contact Details now displays as
   "Account", showing the resolved, linked Account's name, sourced from
   the real relationship, not the old free-text field.
4. Cancel/Save buttons on the Lead screen: currently floating detached
   at the far edge, "brought back from the edge." Fix positioning,
   consistent with how save-bar positioning has been handled elsewhere
   in this build (anchored relative to real content, not floating).

**Test evidence required:** qualify a real Lead with a Company name
matching an existing Account, confirm the reconciliation panel appears
automatically and pre-fills correctly, confirm linking completes as
part of qualification. Qualify a second Lead with a genuinely new
company name, confirm create-new works the same way. Confirm Contact
Details shows "Account" (not "Company") with the correct linked name
afterward. Confirm nothing that reads Company elsewhere silently broke
(re-test Test Bed/Opportunity creation from a Contact, confirm
initialLead/customerLead auto-population still works).

---

## Phase 2: Contact's Create Opportunity dialogue

When creating an Opportunity from a Contact who already has one or more,
the existing warning dialogue's "Add Another" action should read "Create
New Opportunity" and, on click, navigate directly to the newly created
Opportunity's detail screen automatically, not just create it and leave
the user on the list/dialogue.

**Test evidence required:** trigger the warning on a Contact with an
existing Opportunity, click the relabelled action, confirm a new
Opportunity is genuinely created and the browser navigates to its detail
page automatically.

---

## Phase 3: Opportunity Reference tab

1. Opportunity Name should be editable. Confirm current state (read-only
   or already editable) before assuming it needs building.
2. Buyer Roles (Technical/Commercial/Legal/IT-Security Buyer): replace
   free text with a Contact-search dropdown, filtered to Contacts linked
   to the Opportunity's own Account, same mechanism as Test Bed's
   existing Client Buyer fields. **Confirmed small scope**: not the
   full mandatory-core/admin-catalog/escape-valve design discussed
   earlier tonight, that stays a separate, not-yet-scoped future piece.
3. Est. Close Date: remove the separate "Edit" link and dedicated
   always-present form. Render as a plain date field, same shape as
   the other Key Dates fields. **The mandatory-reason dialogue and the
   Est. Close Date Moves counter must still fire**, triggered
   automatically when a real change to this specific field is detected
   at save time, not from a separate entry point. Confirm the existing
   backend mechanism (dedicated endpoint, real column) can still be
   used under the hood, this is a frontend interaction change, not a
   data-model change.
4. All date fields: confirm which should logically allow past dates
   (Actual Close Date, Actual Go Live, since these record things that
   already happened) versus which shouldn't (Est. Close Date, Est. Go
   Live, since a past "estimate" is nonsensical). Report current
   validation state before building any restriction.
5. Contract Duration: currently allows negative numbers via up/down
   counter arrows. Fix to integer-only, no negative values, remove the
   counter arrows, plain numeric entry.
6. Cancel/Save button row: align to the right edge of the Key Dates
   panel specifically, same "match the rightmost panel's edge"
   technique already used elsewhere in this build, not simply
   full-width or arbitrarily positioned.

**Test evidence required:** edit and save the Opportunity Name, confirm
it persists. Select a Buyer Role from the dropdown, confirm only
Contacts linked to the correct Account appear as options. Change Est.
Close Date, confirm the reason dialogue fires and the moves counter
increments, exactly as before, just without the separate Edit entry
point. Attempt a negative or non-integer Duration, confirm it's
rejected. Screenshot the aligned Cancel/Save row.

---

## Phase 4: Opportunity Commercials tab, layout and input cleanup

1. Investigate the current empty space on the right side of this tab.
   Report what's actually causing it (similar unused-width issue to
   what was found and fixed on the Reference tab, or something
   structurally different, e.g. table-based layout) before proposing a
   fix. Bring it in line with the Reference tab's treatment where
   applicable.
2. All numeric entry fields on this tab (Units Required, Unit Cost and
   Warranty Margin %, Hosting Margin %, and equivalents): integer-only
   entry, remove up/down spinner arrows across the board, not
   field-by-field.
3. Save Changes button should activate whenever any field on this tab
   has changed, confirm current activation logic and fix if it's not
   already behaving this way.
4. Remove the "Submit Deal" button for now. **Investigate first**:
   confirm nothing else in the app depends on this action (stage
   transitions, approvals, or any other workflow that might currently
   be triggered by it) before removing it. Report findings, then remove
   only if genuinely safe to.

**Test evidence required:** confirm numeric fields reject non-integer
and (where applicable) negative entries across the whole tab, not just
one field. Confirm Save Changes activates correctly on any single field
edit. Report Submit Deal's dependency check result before removing it.

---

## Phase 5: Commercial Installation tab

When "Terminus Contractor - Per Unit" is selected as Installation
Responsibility, build the panel shown in the prototype reference image:
a real Installation Pricing table (Item, Units, Unit Cost, Cost, Margin
%, Price), calculated live, matching the prototype's layout. Apply the
same integer-only, no-spinner-arrows convention to all numeric entry
here too.

**Test evidence required:** select the Per Unit responsibility, confirm
the pricing table appears and calculates correctly against real input
values.

---

## Phase 6: Structural Terms, new currency fields

Add three new fields: Bid Currency, Proposal Currency, Currency
Contingency %, matching the prototype's layout for this panel.

**Confirmed scope: data entry only for now.** These fields must be
captured and saved, but do not need to affect the deal calculation yet.
Wiring them into the actual contractNet/margin math is confirmed,
real, future work, explicitly backlogged, not part of this phase.

**Test evidence required:** confirm all three fields save and persist
correctly. Confirm no change to any existing calculated value as a
result of adding these fields, since they're not wired in yet.

---

## Documentation discipline

Same as every prior round: update `DESIGN_PRINCIPLES.md` the moment a
decision in this brief changes during the build, and log the currency
calculation wiring explicitly in Deferred scope once Phase 6 lands.

---

## Build complete, all 6 phases genuinely verified

**A note on how this closing section came to be written, worth keeping,
not tidied away.** "Round 3 is closed" was declared twice during this
round, once after Phase 4's work, once after a follow-up correction,
while Phases 5 and 6 had not been built, tested, or mentioned. Caught
only because the phase count was checked explicitly against this
document's own original list rather than trusting the closing language
in the moment. Both phases were then built properly. Full detail
recorded in `DESIGN_PRINCIPLES.md`'s Round 3 entry, item 7. Left here
as a standing reminder for whoever closes out the next round: check
completeness against the brief's own phase list before saying "done",
not against a sense that the recent work felt substantial.

| Phase | Delivered | Beyond the original brief |
|---|---|---|
| 1. Account architecture | Auto-opened reconciliation panel at qualification, Contact Details relabelled to Account | Confirmed as the second documented exception to `INTERACTION_STANDARDS.md`'s error-summary pattern, not just a UI tweak |
| 2. Create Opportunity dialogue | Relabelled, auto-navigates to the new record | Applied to both the warned and unwarned creation paths deliberately, not just the reported case |
| 3. Opportunity Reference tab | Name editable, Buyer Role dropdowns, Est. Close Date simplified without losing its audit trail, date restrictions, Duration validation, Cancel/Save alignment | The reason dialogue's focus trap was found incomplete and brought to full Park parity; cancelling it was empirically proven not to discard unrelated dirty fields |
| 4. Commercials tab | Layout fixes, integer/percentage field split, Save Changes activation, Submit Deal removed | A real overflow bug found and fixed in the Deal Summary matrix; a proven pattern (cap-and-justify-content) deliberately not reused where it would have made things worse; the initial integer-only pass corrected to preserve real financial precision after a live bug exposed it was too broad |
| 5. Installation pricing table | Cost and Price columns added, Total row added | A genuine wiring gap, not a missing calculation, the same engine already driving Hw/Hosting pricing was already computing correct totals, just never rendered here |
| 6. Structural Terms currency fields | Bid Currency, Proposal Currency, Currency Contingency %, data-entry only | Built alongside a full, deliberately-confirmed 3-card restructure matching a real, pre-existing gap between the live layout and the actual prototype, not silently expanded or silently ignored |

**Genuinely open items, not part of this round:**

- The full buyer-role catalog design (mandatory core / admin catalog /
  free-text escape valve), confirmed direction, not yet scoped or built.
- Currency fields are data-entry only, the calculation wiring is
  confirmed, real, explicitly backlogged future work.
- Test Bed's own Reference tab still does not achieve a single row at
  1240px (the gap found while building this round's Phase 3), left
  untouched, tracked in `DESIGN_PRINCIPLES.md`.
