# Terminus Ops prototype specification

Source: `Terminus_Ops_dc.html` (Claude Design prototype), 11,391 lines.

**Purpose.** This replaces "use the prototype as reference" as a build instruction.
Every entry below is a real, checked citation, not a paraphrase. Rule 8
(`DESIGN_PRINCIPLES.md`) exists because paraphrased or general instructions
produced wrong builds at least six times before this document existed. Nothing
gets built against a section of the prototype until that section has an entry
here.

**Status key.** ✅ Fully extracted and cited, safe to build/audit against.
🟡 Partially extracted, core facts known, detail work still needed before
building. ⬜ Not yet extracted, do not build against, extract first.

**Build status.** The Test Bed build (`TESTBED_BUILD_BRIEF.md`) is
**complete, all 6 milestones signed off**: reference number generator,
Test Bed's core record type, Account precondition and buyer contacts,
Test Bed screens, Test Bed to Opportunity conversion, and Opportunity's
own reference-code wiring and Account picker. Every milestone surfaced
at least one real thing this document didn't know about going in, most
significantly a pre-existing, partially-built Test Bed implementation
found during Milestone 2, see the note in Section 6. Full findings are
tracked in the build brief, not duplicated in full here, check both
documents, they're kept in sync but serve different purposes, this one
is the extracted spec, the brief is the execution sequence. One item
remains genuinely open, not part of this build: a dedicated scan for
unchecked Supabase query errors beyond the 3 files checked during
Milestones 5-6, see `DESIGN_PRINCIPLES.md` Deferred scope.

---

## 1. Contact / Account / Lead ✅

The single most-corrected model this session, now stable and matches
`DESIGN_PRINCIPLES.md` Section 2 exactly.

- `leadDraft` shape (the full Contact field set): line 5179
- Creation-mandatory fields (5): `leadMandatoryFields`, line 7529, exactly
  `name, company, industry, email, mobile` (now 6 in the live build, `source`
  added as a deliberate, confirmed departure from the prototype, per business
  decision)
- Qualification-mandatory fields (14): `leadQualifyRequired`, line 5844,
  `name, company, industry, jobRole, email, mobile, address, city, postcode,
  country, region, linkedin, source, summary`
- `contactFromLead()`, lines 7556-7558: confirmed prototype bug, drops city/
  postcode/region when creating the Contact despite validating them.
  **Deliberately not carried forward** — the live build persists them.
- Country → Region auto-fill: line 7526, confirmed wanted, to be built
- Lead detail template: lines 414-540+ (list 414-472, detail overlay 474-540+)
- Contacts list: lines 273-329 (grid header, `+ Create` hover-menu with
  separate Test Bed/Opportunity targets at 305-312, ✕ delete)
- Industry picklist: line 5531, `usedBy` note confirms the 6-char code feeds
  both Test Bed and Opportunity reference numbers
- Account is **not a prototype concept** — it was designed in conversation
  this session (`DESIGN_PRINCIPLES.md` Section 2), not extracted from the
  prototype. The prototype's `company` is a plain string on Contact. Live
  build: `company` stays free text at creation; real Account linkage is a
  separate, later, qualification-gated action (`POST /contacts/:id/link-account`).

## 2. Opportunity — Commercials tab ✅

Fully extracted and built across A1–A5 (deal-calculator.js, opportunity-deal.js).

- Deal Summary matrix: template 1317-1336, data `dealMatrix` 6946-6963
- Hw/Hosting Setup: template 1338-1367, data 6455-6507, 6684
- Installation: template 1369-1420, data 6495-6502, 6677-6708, 6685.
  Installation Responsibility, 4 real values: line 5703 (picklist), 5569-5570
  (usage) — `Client Own Installation Team / Terminus Contractor - Per Unit /
  Terminus Contractor - Lump Sum / Terminus - Reseller Installation`. Found
  wrong in the live build (3 invented labels, missing Reseller Installation)
  and fixed.
- Structural Terms + Deal sheet: template 1476-1544, data 6790-6986. Deal
  sheet (USD) 16-row P&L: 6971-6986. `rollup.rows` confirmed dead code,
  correctly not built.
- Payment Terms + cash flow: template 1544-1700, data 6816-6945. Cash flow
  orientation: months as columns, categories as rows, `cashflow` section
  6719-6755 — built wrong once (rows/columns swapped), fixed.
- `buildLoanSchedule()`: 6331-6354, direct pure-function port, verified
  correct.
- `buildOppDetail()`: 6410-7017, the full calculation core, ported into
  `deal-calculator.js`, verified against the live prototype class executed
  directly in Node (not just read).

## 2b. Reference Number Generation ✅ — shared, cross-cutting mechanism

Never previously given its own citation, only mentioned in passing in
Section 1 ("the 6 character code feeds both Test Bed and Opportunity
reference numbers"). Extracted properly this session, lines 7725-7796.
Flagged as needing a build decision because the prototype's approach is
correct for a single-user demo and unsafe for a real multi-user backend.

**Built and verified, Milestones 1 and 2.** The generator itself
(`issue_reference_number()`, an atomic counter table, `reference-number.js`
wrapper) is built and confirmed correct under real concurrency, including
a genuine truncation bug found by explicit boundary testing and fixed, see
`DESIGN_PRINCIPLES.md` Section 9 for the full record of that. A real
`reference_code` column now exists on `records`, and Test Bed's creation
path is wired to it, confirmed with real sequential records. **Opportunity
is not wired yet**, confirmed by direct inspection, its creation path has
the identical gap Test Bed had before Milestone 2. Scheduled for
Milestone 6. **No country-name-to-ISO-code mapping exists anywhere in the
codebase**, confirmed during the same audit, Test Bed currently accepts a
pre-resolved country code rather than deriving one from a name, this
resolution still needs building, scheduled for Milestone 4.

### What the prototype does

- Format: `TT-{country code}-{industry code}-{number}`, e.g.
  `TT-GBR-SMARTC-001`. Country code via `countryToCode()` (line 7725),
  industry code via `industryToCode()` (line 7731), sourced from the
  Industry picklist's 6-character codes (Section 1).
- **One shared sequence per country+industry combination, used by both
  Test Bed and Opportunity records.** A UK Smart City Test Bed and a UK
  Smart City Opportunity draw numbers from the same line.
- Numbers are never reused, even after a record is deleted. This is an
  explicit, deliberate rule in the source comment, not an accident.
- Mechanism: `nextRecordRef()` (line 7741) **scans every existing Test Bed
  and Opportunity record** on every call to find the current highest
  number for that prefix, then returns max + 1.

### Why the scanning approach cannot be carried into the live build as-is

| In the prototype | In the live Supabase/Fastify backend |
|---|---|
| Single browser tab, one user, in-memory array | Multiple users, concurrent writes, real database |
| Scan-and-recompute on every call is safe, nothing else can write concurrently | Two people creating a UK Smart City record at the same moment could both scan, both see the same current max, both get issued the same reference number |
| No race condition possible | Real race condition, a classic double-booking bug |

**Build requirement, not optional:** this must become a real, atomic
counter, most likely a Postgres sequence or a `ref_highwater` table with
an atomic increment, scoped by country+industry prefix. The "never reused,
even after deletion" rule specifically requires a durable, monotonic
counter rather than a value derived by scanning existing records, since a
derived value can never enforce that guarantee once records are deleted.

**Confirmed this session: Test Bed to Opportunity conversion (Section 6)
must not draw a new number from this counter.** When a Test Bed converts,
the new Opportunity record inherits the Test Bed's existing reference
unchanged. The atomic increment only fires on genuinely new record
creation, never on a conversion-created record. Get this wrong and a
converted engagement ends up with two different reference numbers across
its lifecycle, which defeats the entire point of the shared sequence.

### Asset Management does not feed off this reference system, confirmed as a genuine gap

Checked component batches, build batches, and device serials against the
`TT-` scheme. None of them use it:

| System | Format | Example |
|---|---|---|
| Test Bed / Opportunity | `TT-{country}-{industry}-{number}` | `TT-GBR-SMARTC-001` |
| Component batches | Contractor-prefixed | `VO-OPT-26041`, `KS-LID-8820` |
| Build batches | Product-line-prefixed | `SSB-2025-01`, `AQB-2026-01`, `HMB-2025-01` |
| Device serials | Device-type prefix + counter, `nextDeviceSerial()` line 9105 | e.g. `SS-00001` |

**Business decision, confirmed this session:** batch and device numbering
stays as its own separate manufacturing-domain scheme, **not** folded into
the `TT-` prefix system. Reason: a single manufacturing batch can and does
supply devices to multiple sites across multiple countries, so a
batch-level or device-level identifier tied to one country+industry prefix
would be actively wrong, not just redundant, the moment a batch ships
internationally. Traceability from a Device back to the Test Bed it is
installed at is handled instead through the linking mechanism below, not
through shared numbering.

### Device already has a working link to Test Bed, correction to a prior note

The prototype already implements `applyDeviceLink()` (line 9141) and
`linkTargetOptions()` (line 9135), linking a Device to a Test Bed or
Opportunity by `linkKind`/`linkId`, with a full history of linked/unlinked
dates, the same discipline as the Component assign/unassign engine covered
under the Asset Management dependency note below. This mechanism is built,
it is simply never surfaced in Test Bed's own Site Details tab today, which
still shows only typed-in counts. This corrects the "not designed yet"
framing used when this was first raised.

**Confirmed naming inconsistency in the prototype, needs a decision at
build time.** Two different link-target "kind" string conventions exist for
the same concept: Use Case linking uses `'testbed'` / `'opportunity'`
(line 8136), Device linking uses `'tb'` / `'op'` (line 9137). The live
build should standardise on one, not carry the inconsistency forward.

## 3. Opportunity — Reference tab ✅

- Template: lines 1130-1330. Reference number strip, Terminus Details /
  Customer Details / Key Dates cards, Executive Summary, Notes.
- Editing model: click-to-edit in place, multiple fields open at once,
  built matching this exactly (`opportunity-reference.js`), confirmed as a
  deliberate choice over a simpler save-triggered form.
- Est. Close Date: dedicated move-form with mandatory reason, own endpoint
  (`POST /opportunities/:id/close-date-move`), separate from the generic
  PATCH since `forecast_close_date` lives on a real column, not payload.
- Person fields (Terminus Lead, Commercial/Technical/Legal Authority,
  Account): originally assumed to need the same treatment as one group.
  **Resolved and built, Milestone 6, and the original assumption was
  wrong.** Checked against the prototype's own field definitions directly
  (Terminus Ops.dc.html:5675-5687), not the paraphrase above, before
  building anything: Account (line 5687) is a genuine Account picker,
  "accounts already on file, or '+ New account' to type a new one," a
  distinct `'account'` kind in the prototype's own template, separate
  from the `'person'` kind used for real Contact fields. The four
  Authority fields (lines 5675-5678) are explicitly documented as
  "Terminus staff, from Contacts," a population this live system has no
  equivalent of. Contact here is exclusively client people, gated by
  qualification, Account links, and buyer roles, per `DESIGN_PRINCIPLES.md`'s
  Lead/Contact/Account model. There is no staff directory record type
  anywhere in this system. Same finding, same reasoning, as Test Bed's
  own Owner-field decision in Milestone 3, caught before build this time
  rather than after.

  **Built accordingly**: Account is a real picker, `records.account_id`,
  search-existing-or-create-new, reusing the exact mechanism already
  built for Contact-to-Account linking, not a new one. **Terminus Lead,
  Commercial Authority, Technical Authority, and Legal Authority stay
  free text**, unchanged from their original field names, no
  Contact-dropdown swap, since these were never mislabeled as client
  contacts in the first place, unlike Test Bed's fields, which needed
  renaming as well as re-scoping.

  Zero live or soft-deleted Opportunity records had any value in any of
  these 5 fields at the time of the swap, confirmed by direct query of
  all 29 records, genuinely greenfield, nothing to migrate.

  A real, pre-existing frontend bug found and fixed in the same pass:
  the reference-code display on this tab was hardcoded to always show
  "Not yet generated," regardless of whether a real code existed. Now
  displays the genuine `reference_code`.

  `POST /contacts/:id/create-opportunity` is now wired to
  `issueReferenceNumber`, the identical gap Test Bed had before its own
  Milestone 2 fix. Also now carries `account_id` from the source
  Contact's own linked Account, same direct-copy pattern as
  `create-test-bed`, no precondition, absent rather than blocked if the
  Contact has none. `POST /test-beds/:id/convert` was deliberately left
  untouched, wiring it to the generator would have broken Milestone 5's
  carryover rule.

## 4. Opportunity — Documents tab ✅ (deliberately minimal)

- Template: lines 1770-1778. Flat template-link list, sourced from a
  centrally-maintained Admin document library.
- Live build: honest empty state, no template data source exists. Correctly
  scoped as out, not a silent gap.

## 5. Opportunity — Stage & Approvals tab ✅

- Template: lines 1780-1816+, data 6368-6396. 3-column table (Stage / Exit
  criteria / Approvers), dot states, 0.55 opacity for upcoming rows.
- Prototype hardcodes `canApprove = true` as a testing stub — **not** ported.
  Live build gates real clickability off actual stage/role logic via a new
  `GET /records/:id/stage-approvals` endpoint combining `stage_definitions` +
  `stage_gate_rules` + `approvals`.

## 6. Test Bed ✅

Extracted lines 591-926 (list + detail template), 5297-5326 (stage/sub-stage
workflow), 5455-5615 (document templates, picklists), 5793-5807 (sample
data), 7347-7416 (stage view logic), 7796-7923 (creation + detail field
computation), 9270 (unassign reasons, resolved as out of scope). Two factual
errors in the original 🟡 note are corrected below.

### List view — corrected during build, Milestone 4

The prototype's citation for this screen (lines 603-716) describes two
matrix breakdowns ("by status, by region", "by industry, by region") with
hover drill-down, plus a table with Region, Test Bed, Location, Status,
Open tickets, Issue columns, and a live/degraded/in-progress count badge.

**Confirmed during build: the underlying data for most of this does not
exist anywhere in the system**, and was never going to by this milestone.
`Open tickets`, `Issue`, and a live/degraded/in-progress status are an
operational monitoring concept, the kind of thing Asset Management's
deferred monitoring work would eventually produce, not something this
build has any source for. There is no ticketing or issue-tracking concept
anywhere in this codebase.

**Business decision: don't build the matrices or fabricate the missing
columns.** A layout with permanently empty cards and blank columns is
worse than not building it, confusing UI with no visible explanation,
not a genuine "ready the day the data exists" placeholder. **Live build:
sortable flat table only, no matrix breakdowns**, real columns only, Test
Bed name, linked Account, Region, Industry, Stage, Indicative Cost,
created date. The matrices and monitoring-status columns can be added
later, when Asset Management's monitoring work actually produces
something to show, not before.

### Detail view: only 4 tabs, not 9

Template's `hint-placeholder-count="9"` (line 735) is a design-tool render
hint, not a real count. The actual tab list, confirmed at line 11226, is
**Reference, Site Details, Documents, Approvals**. Building 9 tabs would
have been a wrong build from a misleading placeholder.

### Stage model — corrected, and flattened per business decision

Original prototype note said 5 sub-stages ending at "Review and
Completion." This was wrong. The real prototype model, `testbedStage` at
line 5297, is 6 stages, 7 sub-stages, and it includes a Decommissioning
stage the original note omitted entirely.

**Business decision, this session:** the two-level stage/sub-stage
structure is not carried into the live build. Checked against actual usage
(`computeAllStagesView`, line 7347): the Test Bed record's `subStageKey`
always points at the sub-stage directly, never at the stage. Every stage
in the prototype has exactly one sub-stage except Planning, which has two,
and the template hides the sub-stage name wherever it equals the stage name
(`showSubStageName: ss.name !== item.stageName`, line 7377). The two-level
split does nothing structurally except group two rows under one label in
the Approvals tab display. Docs, criteria, and approvals attach at the
sub-stage level regardless, so flattening loses nothing.

The two-level model had been built with an eye to future flexibility, more
granular staging inside a phase later. That flexibility is being traded
away deliberately here in favour of one flat list, consistent with every
other record type in the system (Opportunity already uses a single flat
stage list, Section 3). If finer staging inside a phase is genuinely needed
later, it can be added as new flat stages at that point, same as any other
stage addition, rather than reintroducing a second structural layer for a
distinction the rest of the system doesn't use.

**Live build stage list — 8 flat stages, confirmed against DESIGN_PRINCIPLES.md.**
The prototype itself only goes as far as Decommissioning, it has no
terminal "Closed" state, and DESIGN_PRINCIPLES.md's own Test Bed section
(now corrected to match this flat model) confirmed a genuine Closed stage
is wanted, added this session, not something the prototype extraction
found on its own:

| Stage | Docs (informational) | Approvers |
|---|---|---|
| Qualification | none | Commercial, Technical |
| Pre-Site Assessment | NDA | Legal, Commercial |
| Site Assessment | Site Assessment Report, Compliance and Data Protection, Partnership and Test Bed Agreement | Legal, Commercial, Technical |
| Installation and Commissioning | Site Installation Document | Technical |
| Monitoring and Analysis | Test Bed Review Document | Commercial, Technical, Legal |
| Review and Completion | Test Bed Review Document | Commercial, Technical, Legal |
| Decommissioning | Site Installation Document | Commercial, Technical, Legal |
| Closed | none | senior-tier sign-off, heavier gate than the rest of the lifecycle, per DESIGN_PRINCIPLES.md Section 8 |

**Closed here is not the same concept as Opportunity's Closed/Closing.**
For Opportunity, Closed marks a signed contract, the start of deployment
and site activity. For Test Bed, Closed marks the end of all site
activity, decommissioning finished, nothing further happens on site. Same
word, opposite direction. Do not conflate the two when building gate logic
or reporting against either record type.

**Test Bed to Opportunity conversion — confirmed in scope. Built, Milestone 5.**
Not something the prototype has, `Terminus_Ops_dc.html` contains no
conversion UI at all, this was new design, not extraction. Built as a
**fix**, not new-build, `POST /test-beds/:id/convert` already existed,
built in a prior, unrelated session, discovered during Milestone 2's
audit, and diverged from spec in three confirmed ways, all now fixed:

- Can happen at any point in the Test Bed's lifecycle, not only at
  Decommissioning or Closed. Confirmed correct, unchanged.
- **Conversion is now limited to once per Test Bed**, a
  `conversion_criteria` row (`{"max_conversions": 1}`) is checked and
  enforced, correcting the original endpoint, which had no check at all,
  real data showed one Test Bed converted six separate times before this
  was fixed.
- A new Opportunity record is created, referencing the Test Bed via
  `converted_from_test_bed_id`. The Test Bed record itself is not mutated,
  it remains the historical record of the R&D work. Confirmed correct,
  unchanged.
- **The reference code now genuinely carries over unchanged**, this
  wasn't buildable when originally specified, `reference_code` didn't
  exist as a column until Milestone 2. Confirmed by real test, and
  confirmed `issueReferenceNumber` is never called on this path, the
  generator stayed a distinct, explicit call precisely so this path could
  skip it, per Milestone 1's original build requirement.
- **`account_id` now carries across on conversion**, added during
  Milestone 5 after the original audit found it silently dropped, a real
  gap, not part of the original three findings. **Buyer-contact links are
  deliberately not carried**, that requires deciding how Test Bed's
  Client Buyer roles map onto Opportunity's own Person-field roles, which
  aren't obviously the same set, correctly left for Milestone 6 rather
  than decided as a side effect of this fix.
- **Test Bed cost now attaches to the Deal Sheet as a real line item**,
  added directly to total deal cost, not priced or marked up to the
  customer, reducing margin without touching contract value, matching
  DESIGN_PRINCIPLES.md's description of the intended Pilot-cost treatment.
  Worth noting plainly: Pilot itself was never built anywhere in this
  codebase, confirmed by exhaustive search, so this was built against
  DESIGN_PRINCIPLES.md's description of the intended design directly, not
  against an actual working precedent that doesn't exist.
- **The `reference_code` uniqueness constraint had to be corrected**,
  not just the application logic. A plain per-record `UNIQUE` constraint
  made the deliberate carryover structurally impossible, a Test Bed and
  its converted Opportunity sharing one code is the entire point.
  Replaced with a compound `UNIQUE (reference_code, record_type)`
  constraint, which permits the one deliberate shared-code case while
  still rejecting any accidental collision between two records of the
  same type, confirmed both ways with real inserts.

**`computeAllStagesView` (line 7347), which drives the live Approvals tab,
hardcodes `canApprove = true`, the same testing stub already correctly not
ported for Opportunity in Section 5. Do not port it here either** — gate
real clickability off actual stage/role logic, same pattern as Opportunity's
`GET /records/:id/stage-approvals`.

`computeSubStageView` (line 7384) has real approval gating (checks
`this.state.currentUserName === approverName`) but its output is never
referenced anywhere in the template. **Confirmed dead code**, same category
as `rollup.rows` in Section 2. Not to be built.

### Detail field set (line 7847, `computeDetailView`)

| Section | Fields |
|---|---|
| Reference | Terminus Reference, Terminus Lead, Commercial Authority, Technical Authority, Industry, Region, Country, Stage |
| Summary | Free text, click to edit |
| Site Details | Site Ownership, Installation Environment, Site Address, No. of SafeSight Cameras, No. of Air Quality Sensors, No. of HEMIR Sensors, Estimated Cost per Unit, Indicative Cost, generated Sensors list (name, status, lat/long, photo) |
| Key Dates | Date Created, Estimated Installation Date, Est Go Live, Test Bed Duration |
| Installation | Installer, Test Bed Tech Team, Install Notes log |
| Contacts | Initial Lead, Commercial Contact, Technical Contact, Legal Contact |
| Use Cases | Flat list of strings |

**"Contacts" section is mislabelled and must not be ported as-is.** Sample
data (line 5793-5807) shows Commercial/Technical/Legal Contact populated
with Terminus staff names (Tom Reyes, Priya Shah, Dana Whitfield), duplicate
of the Reference tab's Commercial/Technical Authority fields. Confirmed with
the business as placeholder test data, not a real design intent. **Live
build decision:** rename existing fields to Terminus Commercial/Technical/
Legal Owner, and add three new fields for the client side — Client
Commercial Buyer, Client Technical Buyer, Client Legal Buyer — linked via
the existing `record_contacts` join table, tagged by role. Initial Lead
stays separate: it is the client-side person who originated the engagement,
not necessarily any of the three sign-off buyers, per business decision.

**Buyer-role linking built, Milestone 3.** New `stage_gate_rules`
requirement type, `contact_role_linked`, a generic branch added to
`transitions.js`'s existing gate loop, checked the same data-driven way
as every other requirement type, not special-cased per record type. The
3 roles use deliberate title case, Client Commercial Buyer, Client
Technical Buyer, Client Legal Buyer, distinct from the existing lowercase
`'commercial buyer'` default already used elsewhere in `record_contacts`,
so the two are never confused. Save-time validation confirmed real,
tested live: rejects linking a Contact whose own `parent_record_id`
doesn't match the Test Bed's `account_id`.

**Owner-field rename, no data migration needed.** Confirmed by direct
query of all live Test Bed payloads before Milestone 4 builds the
screens: no live record contains `commercial_contact`, `technical_contact`,
`legal_contact`, `initial_lead`, or any variant. These fields only ever
existed in the prototype's own sample data, never in a live payload. This
is a naming decision for Milestone 4's build to follow, not a migration.

### Picklist discrepancies

- **Site Ownership** (line 5600) offered Government / Local Council /
  Private / Other. Sample data used "Local Authority", "Port Authority",
  "National Highways", none of which were in the picklist. **Resolved and
  built, Milestone 2:** extended to Local Authority, Port Authority,
  National Highways, Central Government, Private, Other, replacing "Local
  Council" with "Local Authority" to match the real sample data. Confirmed
  built as `VALID_SITE_OWNERSHIP` in `src/routes/test-beds.js` (a
  hardcoded validation array, matching the existing convention in
  `contacts.js`'s `VALID_SOURCES`, no picklist-admin table exists for any
  field yet, so this correctly didn't invent new infrastructure for it).
- **The "region" picklist is not Test Bed's own Region field.** Picklist at
  line 5547 (Americas / Europe & UK / Middle East / APAC / Africa) is
  actually consumed by the Contact/Lead form's Region field (line 10723),
  confirmed by usage. Test Bed's own `region` field (Yorkshire, North West,
  Ireland) has no picklist backing in the prototype, it is free text.
  **Do not assume these are the same picklist when building.**

### A pre-existing, partial Test Bed implementation was found during Milestone 2, not accounted for anywhere above

This section was written assuming nothing existed yet in the live
codebase beyond the prototype. That assumption was wrong. Discovered
during Milestone 2's build, confirmed by direct code and data inspection,
not by the prototype or by this document:

- `src/routes/test-beds.js` already existed, already registered, already
  consumed by a Test Beds screen built in an earlier, unrelated session.
- A prior migration had already seeded `stage_definitions` for
  `test_bed` with **9 rows**, a stale model matching neither the old
  migration file's own 6-stage list nor this document's corrected flat
  8-stage list: NDA, Site Assessment, Partnership and Test Bed Agreement,
  Compliance and Data Protection, Installation and Commissioning,
  Monitoring and Analysis, Close out Review, Decommissioning, Closed.
- A working document-gate mechanism already existed,
  `GET /test-beds/:id/document-requirements` and
  `POST /test-beds/:id/complete-document`, creating and approving real
  `record_type = 'document'` child records, with a fallback that groups
  documents by `stage_definitions.phase`, the two-level Planning/sub-stage
  model this document explicitly rejected earlier in this section.
- **A working `POST /test-beds/:id/convert` endpoint already existed**,
  this is Milestone 5's deliverable, already built in a prior session.
  Audited against spec during Milestone 2, found to diverge in three
  confirmed ways, no `conversion_criteria` check (real data showed one
  Test Bed converted six separate times), no `reference_code` carryover
  (the field didn't exist at all until Milestone 2 added it), and
  `test_bed_cost` stored but never read by the Deal Sheet calculation.
  Full findings and the fix plan are in `TESTBED_BUILD_BRIEF.md`
  Milestone 5, not repeated here to avoid the two documents drifting out
  of sync on the same facts.
- 14 live `test_bed` records existed at the time of discovery, checked
  against the corrected 8-stage list before anything was changed, the
  only non-deleted ones sat at Closed or Installation and Commissioning,
  both of which survive the correction, so no live record was orphaned.

**Practical implication for anyone reading this document going forward:**
"not in the prototype" and "not yet built" are not the same claim. Several
things this document once treated as pure new-design work, most
significantly the conversion mechanism, already had a real, if partially
incorrect, implementation before this build started. Check the actual
live codebase, not just this document or the prototype, before assuming
something needs building from scratch.

### Account link — new, not in the prototype. Built, Milestone 3.

Test Bed has no Account link in the prototype at all; it carries `industry`,
`country`, `region` as flat fields only. Confirmed as a real gap, not an
extraction miss, since the concept doesn't exist in `Terminus_Ops_dc.html`.
**Business decision:** a linked `account_id` on Test Bed is a **hard
precondition at creation**, not a Qualification exit-gate field. Buyer-role
validation is meaningless without it, and Qualification is the stage where
the client relationship is meant to be established. If the source Contact
(when creating Test Bed from Contact) has no Account link yet, that must be
resolved first before the Test Bed can be created.

**Built as a dedicated `account_id` column, not `parent_record_id`.**
Confirmed during Milestone 3 that reusing `parent_record_id` would have
been actively wrong, not just inelegant: 2 of the then-live Test Bed
records already had `parent_record_id` set, pointing to legacy
pre-`record_contacts` Lead-conversion pointers, superseded infrastructure
`contacts.js` itself documents as replaced. Reusing that column would
have silently misread a legacy Lead pointer as an Account link.
**Historical only, not current state**: the 2026-08-15 full business-data
reset (Deferred scope, `DESIGN_PRINCIPLES.md`) cleared every live
business record, those 2 Test Bed rows included. Re-confirmed directly,
Round 4 Phase 1 (2026-08-17): zero `record_type = 'lead'` rows and zero
Test Bed rows with `parent_record_id` set exist today. The reasoning
above remains the correct explanation for why `account_id` is a
dedicated column, it just no longer describes anything about live data,
and should not be read as a current caveat to check for.

**Enforced at two layers, not just the application code.** A
`record_type`-conditioned `CHECK` constraint on `records` backs the
endpoint validation: `record_type != 'test_bed' OR account_id IS NOT NULL
OR deleted_at IS NOT NULL`. The `deleted_at` clause was added after the
first version of the constraint locked 8 legacy Test Bed records out of
being edited at all, including soft-deleted, discovered live during
backfill, not anticipated in the original design, see below.

**A second, real Test Bed creation path existed that the original
Milestone 2 fix never touched.** `POST /test-beds` (fixed in Milestone 2)
is not the only creation path, `POST /contacts/:id/create-test-bed` in
`contacts.js`, the actual Contact-conversion flow the business decision
above describes, still hardcoded `status: 'NDA'`, a stage that no longer
exists in the corrected list. **Retroactive correction to Milestone 2's
sign-off**: that milestone's "initial creation status fixed" claim was
incomplete, only one of two paths was fixed. Both are fixed now, as of
Milestone 3.

**The entire live `test_bed` dataset at the time of this build was test
or placeholder data, not real client records.** All 8 non-deleted Test
Bed records that existed before Milestone 3's constraint were
investigated individually, name fields, linked contacts, industry,
reference codes, before any backfill decision was made. None resolved
to a real, identifiable client. Confirmed and soft-deleted rather than
backfilled with a fabricated Account link. **Practical implication**:
production effectively starts from zero real Test Bed records going
into Milestone 4's screens work, not from an existing dataset that
needs migrating.

### Creation — no prototype precedent, new business decision. Built, Milestone 4.

Prototype's only Test Bed creation path is `createTestbedFromContact()`
(line 7796), triggered from the Contacts list `+ Create` hover-menu (Section
1). It applies **zero field validation** — every field stamped with a dash
placeholder, dumped straight into the Reference tab. Unlike Lead's
`leadMandatoryFields`, there is no prototype-defined mandatory set for Test
Bed creation to extract.

**Business decision, confirmed this session:** when a Contact converts to a
Test Bed, the Contact's fields populate the Test Bed's reference fields
directly. No fields are mandatory purely to *create* the record —
mandatory fields instead gate *stage progression*, via `stage_gate_rules`,
same mechanism already built for Opportunity.

**Correction made during build, Milestone 4: region was not carried over.
Superseded, first real-use testing pass, 2026-08-15.** The original plan
listed "name, industry, country, region, linked Account" as fields
populated from the Contact. Once actually built, this was caught and
corrected, Contact's `region` field is a continent-scale picklist
(Americas, Europe & UK, Middle East, APAC, Africa), while Test Bed's own
`region` field was UK-sub-national free text (Yorkshire, North West,
Ireland). Carrying the value over would have populated Test Bed's region
field with something like "Europe & UK" instead of a real region name,
actively misleading, not just imprecise. Milestone 4's live build left
region blank on creation instead.

**Superseded after real, first-hand use of the built application.**
Feedback from actually working through the Test Bed screens (not test
scripts) confirmed the two fields being different scales was itself the
problem worth fixing, not something to route around. **Business decision:
Test Bed's own `region` field is no longer free text. It now reuses
Contact's exact picklist** (Americas, Europe & UK, Middle East, APAC,
Africa), one shared definition, not two lists that could drift apart.
**With both fields now the same scale, region correctly carries over from
Contact on Test Bed creation again**, reversing Milestone 4's blank-on-
creation behaviour, which was the right call only while the scale
mismatch existed. Built and confirmed, region carries over correctly and
renders as the picklist value, not free text.

Country resolution to the 3-letter ISO code `reference_code` generation
needs is handled by `src/lib/country-code.js`, ported from the prototype's
own `countryToCode()` (line 7725) per Rule 8, rather than invented fresh.
**Inherited as-is, not fixed**: the prototype's own fallback for
unmapped countries (first 3 letters, uppercased, padded) is not real
ISO 3166 data, this was true in the prototype and remains true in the
live build, a known limitation, not a regression.

**A working but incomplete Test Bed frontend already existed before
Milestone 4 started**, discovered and audited the same way the pre-existing
backend was found in Milestone 2. Disposition: the chevron strip,
Documents section, and stage-transition button were generic and correct,
kept unchanged. The standalone "New Test Bed" creation form, permanently
broken by Milestone 3's `account_id` requirement and not part of the
confirmed creation flow anyway, was removed rather than patched. The list
view and Approvals section were built against wrong assumptions, wrong
columns entirely on the list, a hardcoded `'Decommissioning'` stage-name
check on Approvals that never reused the generic `stage-approvals`
mechanism, and were replaced.

### Qualification exit-gate — configured now, other 6 stages deferred

Only Qualification's exit criteria are being defined now, since it's the
only one specified with real business input. The remaining six stages are
left open until Test Beds have actually run through them and real
requirements are known, consistent with "build the business while building
the software."

**To exit Qualification (move to Pre-Site Assessment):**

| Rule type | Mechanism | Fields |
|---|---|---|
| Mandatory payload fields | Extend existing `stage_gate_rules` | Test Bed Duration, Estimated Installation Date, Est Go Live Date |
| Mandatory contact-role links | New rule type, not yet built | Client Commercial Buyer, Client Technical Buyer, Client Legal Buyer, each validated as linked to the Test Bed's own `account_id` via `record_contacts` |

Mandatory field sets per stage must be **configurable**, stored in the
same admin-editable table as Opportunity's stage gate rules, scoped by
record type and stage key, not hardcoded.

### Known dependency: device linkage to Asset Management, already built, not yet connected

Flagged during this session. Test Bed's Site Details tab currently carries
`No of SafeSight Cameras`, `No of Air Quality Sensors`, `No of HEMIR
Sensors` as plain typed numbers, with no link to any real Device record.

**Correction to the initial framing of this note.** This was first raised
as "not designed yet." That was wrong. The prototype already implements a
working Device-to-Test-Bed link mechanism, `applyDeviceLink()` (line 9141)
and `linkTargetOptions()` (line 9135), which links a Device to a Test Bed
or Opportunity by `linkKind`/`linkId` with a full history of linked/
unlinked dates, separate from and in addition to the Component
assign/unassign engine (`assignComponentTo`, `confirmUnassign`, reason
codes) noted earlier. **The mechanism is built. It is simply never
surfaced in Test Bed's own Site Details tab**, which still shows only
typed-in counts disconnected from any real Device record. See Section 2b
for the full citation and the related reference-numbering decision, batch
and device numbering stays separate from the `TT-` scheme, traceability
runs through this link mechanism instead.

**Business decision, direction only:** Test Bed should consume this
existing Device link mechanism rather than build its own serial tracking
or its own linking logic. New modules extend, never fork, the generic
engine. This gives two currently informational stage gates real,
data-backed teeth without new mechanics:

| Stage | Current gate | With the linkage, once connected |
|---|---|---|
| Installation and Commissioning | Doc only, informational | Could require N devices actually linked to this Test Bed, matching declared camera/AQ/HEMIR counts |
| Decommissioning | Doc only, informational | Could require zero devices still linked, i.e. all unlinked with a reason logged |

**Not built here, deliberately.** Connecting Test Bed's Site Details tab to
the real Device link mechanism is a dependency of Asset Management's
Stage 4-5 operational tracking work, already listed as deferred, and
belongs there when that module is actually built, not retrofitted into
Test Bed ahead of it. The mechanism existing already makes this cheaper
when the time comes, it is a wiring task, not new design.

### Documents and exit criteria — informational only, not gating. Built, Milestone 4.

**Confirmed business decision:** the per-stage docs and criteria lists
(the `docs` and `criteria` arrays in the workflow definition above) are
**read-only reference information**, telling the user what to go and get.
They do **not** block stage transition. Document approval workflows are a
**backlog item**, explicitly deferred, not designed further here.

**Correction to how this was originally framed for the build.** The
Milestone 4 brief described this as "same pattern as Opportunity" and
"read-only reference information" in the same instruction, as if they were
one thing. They aren't. Opportunity's Documents tab (Section 4) is
deliberately minimal because there's genuinely nothing to show, an honest
empty state. Test Bed's per-stage list is fully specified, known content,
NDA for Pre-Site Assessment, Site Assessment Report/Compliance and Data
Protection/Partnership and Test Bed Agreement for Site Assessment, and so
on. Conflating the two in the original instruction led to a real, found
bug: `document-requirements` had only ever been built against
`stage_gate_rules`, the gating table, with no separate source for
informational content at all. Once Milestone 2 flattened `phase` to null
across all 8 stages, the endpoint silently returned `[]` for every stage
of every Test Bed, and this went unnoticed through the rest of Milestone
4's build until explicitly re-traced rather than accepted on report.

**Built as a genuinely separate, non-gating table**, `stage_reference_docs`
(`record_type`, `stage_name`, `document_name`), deliberately decoupled
from `stage_gate_rules`, nothing in `transitions.js` reads it, confirmed
by direct diff, not just design intent. `GET
/test-beds/:id/document-requirements` returns `{ reference_docs,
completable_documents }`, the first unconditional and stage-keyed, the
second the original document-completion mechanism, untouched, just
properly separated so the frontend can never conflate the two. This is
the correct general pattern going forward: **informational, non-gating
content belongs in its own table, never layered onto `stage_gate_rules`
"for display purposes," since that table's rows carry real gating
semantics elsewhere in the system and reusing it for display risks
silently gating something that was never meant to block anything.**

Document templates specific to Test Bed, confirmed at lines 5459, 5461:
"Partnership and Test Bed Agreement", "Test Bed Review Document".

### Unassign reasons — resolved, does not belong here

Line 9270, `unassignReasons` (Warranty Swap, Reallocated to Demo/Test Bed,
Failed/Faulty, Decommissioned), is confirmed to be Component-to-Device
assignment logic within Asset Management, not a Test Bed field. "Reallocated
to Demo/Test Bed" is one of four reason labels on a Device unassign action.
Belongs to Section 8's deferred Asset Management scope, not Section 6.

### Sample data coverage note

Only 3 of 13 sample Test Bed records (tb1, tb7, tb9) have full detail data
in `testbedDetailData` (line 5474). The other 10 fall through to an explicit
"not yet configured" empty state (line 7850). Not a bug, but relevant when
testing against the live build — most sample rows will render the fallback.

## 7. Admin ⬜ — out of v1 scope, not extracted

Referenced only where it feeds in-scope modules (Industry picklist codes,
document template library). The full multi-tab Admin module (Data Objects,
Picklists, Workflows, Contractors, and more per earlier CLAUDE.md notes) is
listed in `DESIGN_PRINCIPLES.md`'s Deferred scope section. Do not extract
until it's actually queued to build.

## 8. Contractor Management, HR/timesheets, full Documents module ⬜

Confirmed out of v1 scope (`DESIGN_PRINCIPLES.md` Deferred scope). Not
extracted. Exists in the prototype but deliberately not read in detail —
extracting now would be wasted effort against a moving target until these
are actually queued.

---

## How to use this document

1. Before building or auditing any screen, check its status above.
2. ✅ means build directly against the citations here — they're checked, not
   assumed.
3. 🟡 or ⬜ means stop and extract that section first, same method as
   Sections 1-5: read the actual template and data lines, cite them, write
   a plain-language spec of the real layout/field/validation decisions,
   *then* build.
4. Update this document the moment a new section is extracted. An
   unwritten decision is, for practical purposes, a decision Claude Code
   doesn't have.
