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

## Milestone 1: Reference number generator, atomic counter

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

## Milestone 2: Test Bed core record type

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

## Milestone 3: Account precondition and buyer contact relationships

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

---

## Milestone 4: Test Bed screens

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
