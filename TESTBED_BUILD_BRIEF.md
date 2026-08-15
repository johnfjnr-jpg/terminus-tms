# Build brief: Test Bed module, reference generator fix, Opportunity Person fields

Source of truth: `PROTOTYPE_SPECIFICATION.md` Section 6 (Test Bed), Section
2b (Reference Number Generation), Section 3 addendum (Opportunity Person
fields). Read all three in full before starting. Also read
`DESIGN_PRINCIPLES.md` and `INTERACTION_STANDARDS.md` for the governing
conventions this build must follow.

Work through the milestones below in order. Stop after each one, wait for
real interaction testing and explicit sign-off before starting the next.
Do not batch milestones together even if it looks efficient, this project's
own history shows paraphrased or batched instructions have produced wrong
builds before.

If anything in this brief conflicts with what you find in the actual
prototype file or the live codebase, stop and name the discrepancy plainly.
Do not silently reframe or guess.

---

## Milestone 1: Reference number generator, atomic counter ✅ COMPLETE

Fix the concurrency risk in the current reference generation approach.

- Format stays `TT-{country code}-{industry code}-{number}`.
- One sequence per country+industry combination, shared by Test Bed and
  Opportunity, exactly as today.
- Numbers must never be reused, even after a record is deleted.
- Replace the scan-every-record approach with a real atomic counter,
  Postgres sequence or a `ref_highwater` table with an atomic increment,
  scoped by country+industry prefix. Two concurrent requests for the same
  prefix must never receive the same number.
- Do not change anything about batch or device numbering. Confirmed
  business decision: Asset Management keeps its own separate numbering
  scheme, not folded into `TT-`, since one manufacturing batch can supply
  devices to sites across multiple countries.
- **Confirmed in scope: Test Bed to Opportunity conversion (Milestone 5)
  must not draw a new number from this counter.** A converted record
  inherits the source Test Bed's existing reference unchanged. Build the
  atomic increment so it only fires on genuinely new record creation, and
  confirm the conversion path explicitly bypasses it.

**Test before moving on:** create two Test Bed or Opportunity records for
the same country+industry in quick succession and confirm sequential,
non-duplicate reference numbers.

---

## Milestone 2: Test Bed core record type ✅ COMPLETE

- Register Test Bed as a record type on the generic engine. Extend, do not
  fork.
- Stage list is flat, **8 stages**, no sub-stage layer, corrected after
  cross-checking against DESIGN_PRINCIPLES.md:
  Qualification, Pre-Site Assessment, Site Assessment, Installation and
  Commissioning, Monitoring and Analysis, Review and Completion,
  Decommissioning, Closed.
- **Closed for Test Bed means the end of all site activity, the opposite
  of what Closed/Closing means for Opportunity, which marks the start of
  deployment and site activity. Do not conflate the two.**
- The final transition, Decommissioning to Closed, is gated more heavily
  than the rest of the lifecycle: every stage-gate document from the
  lifecycle actually reviewed, plus a senior-tier sign-off via
  `routing_rules`, same `stage_gate_rules` engine, nothing new.
- `stage_gate_rules` for Qualification's exit only, payload fields required
  to move to Pre-Site Assessment: Test Bed Duration, Estimated Installation
  Date, Est Go Live Date. The remaining 6 stages have no gate rules yet,
  leave them open, do not invent requirements for them.
- Mandatory field sets per stage must be configurable, stored the same way
  as Opportunity's existing stage gate rules, not hardcoded.
- Standard patterns apply: soft delete via `deleted_at`, full audit trail,
  Notes History append-only.
- Site Ownership picklist currently doesn't match prototype sample data
  values (Government/Local Council/Private/Other vs Local Authority/Port
  Authority/National Highways). Decide and document which way this goes,
  extend the picklist or make it free text, before building the field.

**Test before moving on:** create a Test Bed, confirm it cannot progress
past Qualification until Duration, Est. Install Date, and Est. Go Live Date
are all present.

---

## Milestone 3: Account precondition and buyer contact relationships ✅ COMPLETE

- A linked `account_id` is a hard precondition at Test Bed creation, not a
  Qualification exit field. If the source Contact (when creating via
  Contact conversion) has no Account link yet, that must be resolved before
  the Test Bed can be created.
- Add a new relationship-based `stage_gate_rules` type, checks that a
  required `record_contacts` link exists for a given role, not just that a
  payload field is present. This is new mechanism, does not exist yet.
- Three new roles required to exit Qualification: Client Commercial Buyer,
  Client Technical Buyer, Client Legal Buyer. Each must be a Contact linked
  to the same `account_id` as the Test Bed. Validate this at save time.
- Existing prototype "Contacts" fields (Commercial/Technical/Legal Contact)
  were confirmed as test data, Terminus staff mislabelled as client
  contacts. Rename these to Terminus Commercial/Technical/Legal Owner.
  Initial Lead stays separate, the client-side originator of the
  engagement, not necessarily one of the three buyers.

**Test before moving on:** attempt to set a Client Buyer field to a Contact
not linked to the Test Bed's Account, confirm it's rejected. Confirm
Qualification cannot be exited until all three buyer roles are linked.

**What actually happened, signed off:**

- `account_id` built as a dedicated column, not `parent_record_id`,
  confirmed 2 live records already used `parent_record_id` for a legacy,
  superseded Lead pointer, reusing it would have silently corrupted those.
- Enforced at two layers: application validation in both creation
  endpoints, plus a `record_type`-conditioned `CHECK` constraint at the
  database level, proven with real rejected and accepted inserts, not
  just endpoint tests.
- **Retroactive correction to Milestone 2:** a second real creation path,
  `POST /contacts/:id/create-test-bed`, had the same stale `status: 'NDA'`
  bug Milestone 2's fix never reached. Both paths are fixed now.
- **The entire live `test_bed` dataset (8 records) was confirmed test or
  placeholder data, not real clients**, investigated individually before
  any backfill decision, then soft-deleted rather than backfilled with a
  fabricated Account. Production starts Milestone 4 with zero real Test
  Bed records.
- `NOT VALID` on the `CHECK` constraint didn't exempt those 8 records from
  future writes, including soft-delete itself, discovered live. Fixed by
  adding a `deleted_at IS NOT NULL` escape to the constraint, re-tested,
  all original cases still hold.
- `contact_role_linked` requirement type built generically in
  `transitions.js`'s existing gate loop, not special-cased, tested with a
  real escalating gate check, payload fields alone, then buyer roles
  linked one at a time, confirming each blocks independently.
- Owner-field rename confirmed as a naming decision only, no live data
  contains the old field names, nothing to migrate, carried into
  Milestone 4 below.

---

## Milestone 4: Test Bed screens ✅ COMPLETE

**Two things confirmed during Milestone 2, must be handled here, not
rediscovered:**

- **No country-name-to-ISO-code mapping exists anywhere in the
  codebase.** `reference_code` generation (built in Milestone 2) requires
  a 3-letter ISO code, but nothing resolves a Contact's stored country
  name into one. When this milestone builds "Contact's fields populate
  Test Bed's reference fields directly," it must include this resolution,
  otherwise every Test Bed created from a Contact gets `reference_code:
  null` indefinitely, exactly the honest-but-incomplete state confirmed
  during Milestone 2 testing. Confirm whether a mapping already exists
  elsewhere in the system (e.g. on Contact/Account) before building a new
  one, don't duplicate.
- **The stage-tracker chevron strip will break visually once `phase` is
  null across all 8 Test Bed stages**, confirmed live during Milestone 2:
  labels overlap and become unreadable once `renderChevronStrip` stops
  grouping stages and renders 8 individual full-length chevrons instead
  of the ~6 it was built to fit. This needs a CSS/layout fix as part of
  building this screen, not a bug to discover fresh here.

- List view: two matrix breakdowns (by status/region, by industry/region)
  with hover drill-down, plus a sortable flat table (Region, Test Bed,
  Location, Status, Open tickets, Issue). Live/degraded/in-progress count
  badge.
- Detail view: 4 tabs only, Reference, Site Details, Documents, Approvals.
  Do not build more, the prototype's placeholder hint of 9 is a design-tool
  artefact, not a real spec.
- Reference tab fields: Terminus Reference, Terminus Lead, Commercial
  Authority, Technical Authority, Industry, Region, Country, Stage.
- Site Details tab fields: Site Ownership, Installation Environment, Site
  Address, No. of SafeSight Cameras, No. of Air Quality Sensors, No. of
  HEMIR Sensors, Estimated Cost per Unit, Indicative Cost, generated
  Sensors list. Plus Key Dates (Created, Est. Install, Est. Go Live,
  Duration), Installation (Installer, Tech Team, notes), the renamed Owner
  fields and new Client Buyer fields, Use Cases list.
- Documents tab: same pattern as Opportunity, centrally-maintained template
  links, honest empty state where no real document exists. Per-stage docs
  and criteria (from the stage definitions) are read-only reference
  information only, they do not gate anything. Do not build document
  approval tracking, that is an explicit backlog item, not this build.
- Approvals tab: real stage/role gating, do not port the prototype's
  hardcoded `canApprove = true` testing stub. Gate off actual stage and
  role logic, same pattern as Opportunity's existing
  `GET /records/:id/stage-approvals`.
- Creation flow: from Contact conversion, Contact's fields populate Test
  Bed's reference fields directly (name, industry, country, region, linked
  Account). No fields are mandatory purely to create the record.

**Test before moving on:** full walkthrough, create from a Contact, fill
Qualification's mandatory fields and buyer links, progress to Pre-Site
Assessment, confirm Documents tab shows the right reference material for
each stage without blocking anything.

**What actually happened, signed off:**

- A working but incomplete Test Bed frontend already existed, audited the
  same way as Milestone 2's backend discovery. Chevron strip, Documents
  section, transition button kept as generic and correct. Standalone
  "New Test Bed" form removed, permanently broken by Milestone 3's
  `account_id` requirement and not the confirmed creation flow anyway.
  List view and Approvals section replaced, wrong columns and a
  hardcoded stage-name check that never used the generic mechanism.
- **List view built without the two matrix breakdowns.** The underlying
  data, open tickets, issue status, live/degraded state, doesn't exist
  anywhere in the system, an operational monitoring concept for
  Asset Management's deferred work, not this build. Building empty
  matrices would have been confusing UI, not a genuine placeholder.
  Sortable flat table only, real columns: Test Bed name, linked Account,
  Region, Industry, Stage, Indicative Cost, created date.
- **Region is not carried over from Contact to Test Bed on creation**,
  corrected during build. Contact's region is continent-scale, Test Bed's
  is UK-sub-national free text, carrying the value over would have been
  actively misleading, not just imprecise. Confirmed via direct query,
  region genuinely absent from the payload, not blank string.
- Country-code resolution built as `src/lib/country-code.js`, ported from
  the prototype's own `countryToCode()` per Rule 8, its non-authoritative
  fallback for unmapped countries inherited as-is, not fixed.
- Approvals tab rebuilt to genuinely match Opportunity's real, current
  pattern, stage-gated only, no role-permission system exists anywhere
  in the app, confirmed by reading Opportunity's actual code rather than
  the brief's paraphrase of it.
- **Real bug found and fixed: Documents tab returned empty for every
  stage of every Test Bed**, not a deliberate empty state. The original
  brief conflated "same pattern as Opportunity's empty Documents tab"
  with "read-only reference information," and the only mechanism that
  existed to show per-stage document content was `stage_gate_rules`
  itself, which had no rows for 6 of 7 transitions by Milestone 2's own
  design. Fixed with a new, deliberately separate `stage_reference_docs`
  table, zero gating semantics, confirmed by direct diff that nothing in
  `transitions.js` reads it.
- Logged, not fixed: a reference-code counter collision caused by test
  cleanup deleting a counter row while a soft-deleted record still held
  a code from it. Real fix needs a design decision about counter/deletion
  interaction, deferred, recorded in `DESIGN_PRINCIPLES.md`.

---

## Milestone 5: Test Bed to Opportunity conversion

**This is not new-build, it's a fix.** `POST /test-beds/:id/convert`
already exists and is live, confirmed working end to end for the parts it
gets right, but audited during Milestone 2 and found to diverge from spec
in three confirmed, specific ways. Fix these, do not rebuild the endpoint
from scratch.

Confirmed by direct code and data inspection during Milestone 2:

1. **No `conversion_criteria` check, conversion is unconditional.**
   `conversion_criteria` exists as a table but is never queried anywhere
   in the codebase. Real data shows one Test Bed converted six separate
   times. **Business decision, confirmed:** a Test Bed converts only
   once. Add the `conversion_criteria` check and block a second
   conversion attempt on a Test Bed that's already converted, real
   rejection, not just a UI hint.
2. **`reference_code` carryover is now buildable, it wasn't when this
   section was first written.** Milestone 2 added the `reference_code`
   column and the generator, neither existed before. Confirm the new
   Opportunity created on conversion inherits the source Test Bed's
   `reference_code` unchanged, and does not call `issueReferenceNumber`,
   see Milestone 1's build requirement, the increment must stay a
   distinct, explicit call so this path can skip it.
3. **`test_bed_cost` is stored but never consumed.** It's correctly
   written to `opportunity_details` on conversion today, but nothing in
   `deal-calculator.js`, `deals.js`, or `opportunity-deal.js` reads it,
   confirmed by direct grep. Wire it into the Deal Sheet as a real cost
   line, same treatment Pilot cost already gets, not just stored data
   nobody sees.

Everything else the endpoint already does correctly, confirmed during
audit, leave untouched:

- Conversion action available at any point in the Test Bed's lifecycle,
  not restricted to Decommissioning or Closed.
- Creates a new Opportunity record referencing the source Test Bed via
  `converted_from_test_bed_id`, confirmed correct in real data.
- Test Bed record itself is not mutated, confirmed, the endpoint only
  reads it.

**Test before moving on:** attempt to convert an already-converted Test
Bed, confirm it's rejected. Convert a fresh Test Bed mid-lifecycle,
confirm the new Opportunity carries the identical `reference_code`,
confirm the carried-over cost appears as a real line item on the new
Opportunity's Deal Sheet, not just as a stored, unused field.

---

## Milestone 6: Opportunity Person fields, bundled

**Confirmed during Milestone 2, add to this milestone's scope:**
Opportunity has the identical gap Test Bed had before Milestone 2, its
creation path never calls `issueReferenceNumber` either, confirmed by
direct inspection. `reference_code` now exists as a real column
(Milestone 2), the generator is built and tested (Milestone 1), Opportunity
just isn't wired to either yet. Wire Opportunity creation the same way
Test Bed's was, resolve country and industry to their codes, call the
generator, store the result, same honest-null-if-unresolved behaviour
Test Bed uses.

- Swap Opportunity Reference tab's free-text Terminus Lead, Commercial/
  Technical/Legal Authority, and Account fields for real Contact dropdowns
  with inline "create new contact", same pattern as Test Bed's buyer
  fields, linked via `record_contacts`.
- This is a change to an already-live screen. Test carefully for
  regressions against existing Opportunity records that currently hold
  free-text values in these fields, decide and confirm a migration or
  fallback approach for existing data before this ships.

**Test before moving on:** confirm existing Opportunity records still
display correctly, and new/edited records use the Contact dropdown.

---

## Outstanding, deliberately not in scope for this build

- Connecting Test Bed's Site Details tab to the real Device link mechanism
  (`applyDeviceLink`, already built in the prototype but unconnected).
  Belongs to Asset Management's Stage 4-5 operational tracking work.
- The `'tb'`/`'op'` vs `'testbed'`/`'opportunity'` link-kind naming
  inconsistency in the prototype. Needs a single convention decided when
  the Device linkage above is actually connected, not before.
- Document approval workflows. Backlog item.

---

## Documentation discipline

Update `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`, and
`INTERACTION_STANDARDS.md` the moment any decision in this brief changes
during the build, same discipline as every prior milestone. An unwritten
decision is, for practical purposes, a decision the next session doesn't
have.
