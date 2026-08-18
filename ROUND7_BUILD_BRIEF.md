# Round 7 build brief: automated verification, then feature work

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND6_BUILD_BRIEF.md`. Read all four before
starting.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---
## Phase 0: Reconcile `supabase/seeds/003_test_bed.sql` with live schema

**Do this first. It is small.**

**Severity corrected after Code's Phase 0 audit, 2026-08-18.** This
phase originally called it "a live correctness defect." It is not. The
dead rows are **unreachable and cannot change gate behaviour today**:
all four read sites either filter `.eq('from_stage', ...)` on a live
stage, or, in `records.js:119`, fetch unfiltered and then match against
`stage_definitions`, which a dead `from_stage` never satisfies. This is
environment drift with a **latent** trigger, not a present break.

The trigger is real and is the actual argument for step 3: if a future
stage is ever named `Compliance and Data Protection`, five document
gates activate silently and at once.

Migration `20260815000000_test_bed_flat_stages.sql` hard-deletes the
`('NDA','Site Assessment')` gate rule as orphaned data, since NDA stopped
being a stage when the flat 8-stage model replaced the old 9-stage one.
`supabase/seeds/003_test_bed.sql` still contains the `INSERT` for that
row, guarded by `WHERE NOT EXISTS` on the exact row. Because the
migration deleted it, that guard now passes.

`scripts/seed.js` applies every `.sql` file in `supabase/seeds/` in
filename order via `npm run db:seed`, a routine documented command. So
any fresh environment built from this repo ends up with a dead gate rule
pointing at a stage that does not exist, while the current live database
is clean. That is environment drift, and it surfaces during a restore or
a new setup, which is the worst time to find it.

1. **Audit complete, 2026-08-18. The finding is six rows, not one.**
   `003_test_bed.sql` contains 10 `INSERT`s. Six name a `from_stage`
   that no longer exists: one `NDA -> Site Assessment`, and five
   `Compliance and Data Protection -> Installation and Commissioning`.
   Migration `20260815000000_test_bed_flat_stages.sql:42-47` deletes
   **both** pairs; the seed re-inserts both. Only the four
   `Decommissioning -> Closed` rules are live.

   Live count is 10, of which just 4 come from this seed. The other 6
   come from migrations, 3 `payload_field_required` from
   `20260815000000` and 3 `contact_role_linked` from `20260815000004`.
   So a fresh `npm run db:seed` yields **16** rules, not 10.

   `001_smoke_test.sql` and `002_lead_opportunity.sql` are both clean.
   The drift is confined to `003`.
2. **Delete the six dead `INSERT`s outright**, leaving the four live
   `Decommissioning -> Closed` rules. Confirmed decision, not commented
   out: git history is the permanent record, the migration's own comment
   block already documents the removal, and dead SQL left inside a file
   that gets executed is precisely how this happened.

   Add a short comment block at the top of the seed recording what was
   removed and pointing at the migration, so the correction stays
   visible in the file without being executable, matching how
   `PROTOTYPE_SPECIFICATION.md` keeps superseded decisions with a note
   rather than deleting them.
3. Add a standing entry to `DESIGN_PRINCIPLES.md` Deferred scope: any
   migration that deletes or rewrites seeded data must reconcile the
   corresponding seed file in the same change, since seeds re-run and
   win. Cite this NDA case as the found instance.

**Test evidence required, corrected.** The original check here was
wrong and would have passed while the fault occurred: it asked to
confirm "the 10 legitimate rules are unchanged," but only 4 of those 10
come from this seed, so 6 dead rows could be added, taking the total to
16, without that assertion failing.

Run `npm run db:seed` against a real database and confirm by direct
query: exactly **10** `test_bed` rules exist afterwards, and **zero**
rows have a `from_stage` or `to_stage` absent from `stage_definitions`
for their `record_type`. Assert both, not just the count.

---
## Phase 1: `scripts/verify-harness.mjs`, a real automated test suite

**This phase is not optional and is not a refactor of the existing
scripts.** Confirmed at the close of Round 6: this repo has zero
automated tests. `package.json` declares no `test` script and no
runner, no test framework is installed, and no tracked test file
exists. Every correctness claim made across Rounds 1 to 6 rests on
one-shot Puppeteer scripts that were run once by hand and then left at
the repo root, where they are now deliberately gitignored because 19 of
23 hardcode `/Users/johnfryatt/terminus-tms/` and all 23 depend on the
uncommittable `session-ref.json`.

That is the gap this phase closes. The three areas below are chosen
because each one is money-or-data critical, each is pure enough to test
without a browser, and each already has a recorded history of real bugs.

Build `scripts/verify-harness.mjs` as tracked, reusable tooling
alongside the existing `scripts/sign-in.js`, `scripts/create-test-user.js`
and `scripts/seed-test-opportunity.js`. Read paths and credentials from
the environment, never from a hardcoded absolute path. Use the built-in
`node:test` runner; do not add a third-party framework.

**The suite is split in two, and the split is load-bearing.**

- `npm test` runs **1.1 only**: pure functions, no database, no
  credentials, no network. It must be runnable by anyone on a clean
  checkout with no environment setup at all.
- `npm run test:db` runs **1.2 and 1.3**, which require a real database
  and documented environment variables.

Add the GitHub Action in this phase, not later. It runs `npm test` on
every push. It must not run `test:db`, which would require putting
database credentials into CI, a separate decision that is not being
made here. Keeping the pure suite genuinely dependency-free is what
makes that separation possible, so do not let a database import leak
into the 1.1 path.

### 1.0 Fixtures and teardown

Every database-backed test in 1.2 and 1.3 creates its own disposable
fixtures. Follow `DESIGN_PRINCIPLES.md` Rule 9:

- Tag every fixture with a per-run `runTag = Date.now()` and derive all
  fixture names and counter keys from it, so no two runs collide and no
  run ever reuses a real, already-existing record as a convenient test
  subject.
- **Counter keys must be unique per run.** The "no gaps" assertion in
  1.2 is only valid on a counter key that nothing else is touching
  concurrently. A shared key makes that assertion meaningless, it would
  be measuring other traffic, not atomicity.
- Check **every** delete's returned `error`, and the affected-row count
  on every `.update()`. Throw or log loudly on any failure. Never print
  a fixture ID as "torn down" without confirming the row is actually
  gone by querying it. An error's wording is a hint to investigate,
  never a substitute for checking the row.
- Teardown soft-deletes test records.

**Teardown must never delete `reference_number_counters` rows.** This is
not a style preference, it is a recorded real collision from Milestone 4,
see `DESIGN_PRINCIPLES.md` Section "Deferred scope". A `GBR-SMARTC`
counter row was deleted during test cleanup while a soft-deleted record
still permanently held `TT-GBR-SMARTC-001`. Reference codes are never
reused even after deletion, so the counter restarted at 1 and collided
with the already-claimed code, a real Postgres unique-constraint
violation caught live. The underlying design question is still
unresolved and deliberately out of scope here. Leave counter rows in
place; the unique per-run key above is what keeps them from
accumulating meaningfully.

### 1.1 Cost calculation, `src/lib/deal-calculator.js`

Pure functions, no database, no session needed. Cover at minimum the
exported surface that carries arithmetic:

- `buildLoanSchedule`, both amortisation methods, including a zero
  interest rate and a single-month term.
- `priceFromCost` at a 0% margin and at margins approaching 100%,
  where the divisor gets small.
- `buildCostGroup` and `calculateContractTotals`, confirming a group
  with no line items totals zero rather than producing `NaN`.
- `calculateTax`, both with and without `grossUp`, since the gross-up
  path reorders the WHT and GST arithmetic.
- `calculateTestBedCost` and `calculateDeal` as end-to-end assertions
  against one fully worked example whose expected figures are stated
  literally in the test, not recomputed by calling the same function
  under test.

### 1.2 Reference-number atomicity, including the 999 boundary

The counter lives in Postgres, not JS: `src/lib/reference-number.js`
delegates to the `issue_reference_number` RPC, which does an
`insert ... on conflict ... do update set current_value = current_value + 1
... returning`. Testing the JS wrapper alone proves nothing about
atomicity. These tests must run against a real database.

- **The 999 to 1000 boundary.** The RPC formats via
  `case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end`.
  This has already been a real production bug once, see
  `supabase/migrations/20260814000001_fix_reference_number_1000_truncation.sql`.
  Seed a counter to 998 and issue four numbers in sequence. Assert
  exactly `998`, `999`, `1000`, `1001`, that `999` is still zero-padded
  to three characters, and that `1000` is four characters and is not
  truncated back to three.
- **Atomicity under real concurrency.** Fire at least 50 concurrent
  `issue_reference_number` calls against one counter key with
  `Promise.all`. Assert the returned set has no duplicates and no gaps.
  A sequential loop does not test this; the calls must genuinely
  overlap.
- **Namespace isolation.** Round 5 introduced `p_scheme` so that
  Account Numbers and record reference codes never share a counter
  sequence even when their segment strings collide. Assert that
  issuing under two different schemes with an otherwise identical key
  advances two independent sequences, and that the pre-existing
  unprefixed keys still resolve to their original counters, which is
  the backwards-compatibility guarantee that migration was written to
  preserve.

### 1.3 `computeBlocking` gate evaluation

`computeBlocking` in `src/routes/transitions.js` is the single gate
guarding every stage transition, and it is called from two separate
places, `transitions.js` itself and `records.js`. It needs a real
database because it reads `stage_gate_rules`.

- Each of the four distinct `blocking.push` branches, asserted to
  fire when its condition is unmet and to stay silent when met.
- The variant-matching logic specifically. The code carries a comment
  warning that `.or()` with a single condition can be misread by
  PostgREST as a top-level OR, bypassing the other `.eq()` filters.
  Assert that a record with a variant picks up both null-variant and
  its own variant rules, that it does **not** pick up another
  variant's rules, and that a record with no variant picks up only
  null-variant rules.
- One assertion that both call sites agree: the same record and
  transition evaluated through `transitions.js` and through
  `records.js` produce the same blocking set.
- **Added 2026-08-18, from Phase 0's audit. A standing orphaned-rule
  invariant, across every record type, not just `test_bed`:** no
  `stage_gate_rules` row may name a `from_stage` or `to_stage` that is
  absent from `stage_definitions` for that `record_type`. Phase 0 fixes
  one instance of this by hand; this assertion is what stops the class
  recurring silently in any record type as new stages are added or
  renamed. It is the sibling of the existing documented invariant that
  a transition must reject every `to_stage` when a record type has zero
  `stage_definitions` rows, and belongs recorded alongside it in
  `DESIGN_PRINCIPLES.md`.
- **A fifth assertion for `child_record_status`, which has no code
  branch at all.** `src/routes/transitions.js:140` is a bare comment,
  "child_record_status handled in a future milestone", so the rule loop
  falls through and pushes nothing. This is not theoretical:
  `supabase/seeds/003_test_bed.sql` seeds three real
  `child_record_status` rules on the `test_bed` Decommissioning ->
  Closed transition (NDA reviewed, PDPA assessment reviewed, Data
  Protection Impact Assessment reviewed).

  Stated precisely: **three of the four seeded requirements on that
  transition are structurally inert.** The transition is not ungated.
  Its fourth rule is `approval_obtained {"track":"Senior"}`, and that
  branch does exist, at `src/routes/transitions.js:39`, so it really
  does block. What is missing is the document-review half of the gate,
  not the gate itself.

  Note also that the surviving fourth rule is only half-backed:
  `routing_rules` is empty, and there are **zero `routing_rules` INSERT
  statements anywhere in the repo**, in any migration or seed. So the
  senior-tier escalation that `DESIGN_PRINCIPLES.md` Section 8
  specifies, computing *which* tier within a track is required, has no
  data behind it either. The `approval_obtained` branch blocks on a
  Senior approval existing at all; the tier-escalation logic the design
  describes is unbacked.

  Assert the **current no-op behaviour explicitly**: a Test Bed with
  those three rules unmet returns an empty blocking set and the
  transition is permitted. Comment the assertion clearly, in the test
  itself, stating that this asserted behaviour is **wrong**, that it
  documents a known gate hole rather than endorsing it, and that when
  the `child_record_status` branch is built this assertion must be
  **inverted**, not deleted. The point is that implementing the branch
  should cause a visible, deliberate test failure rather than passing
  silently.

**Test evidence required:**

1. `npm test` passing from a clean checkout with **no** environment
   setup, plus the actual runner output pasted in full.
2. `npm run test:db` passing with only the documented environment
   variables set, output pasted in full.
3. A green GitHub Action run on a real push, linked.
4. Teardown proven, not assumed: after a full `test:db` run, query and
   report the fixture rows' actual state, per Rule 9, and confirm no
   `reference_number_counters` row was deleted.
5. Deliberately break one assertion per area, three in total, and show
   each failing, so the suite is proven capable of failing rather than
   passing vacuously.

---
## Phase 2: Numeric field validation, client and server

**Superseded by Code's review, 2026-08-18. The original hypothesis in
this phase was wrong and is corrected here rather than deleted, per this
project's standing practice.**

The phase originally suspected Round 6 Phase 3 of reintroducing Round 5
Phase 4's dropped-`opts` fault. Checked directly and **disconfirmed**.
All three layers are intact: `test-beds.js:428` still rejects via
`isValidNonNegativeInteger`, `tbFieldRow` still emits
`min="0" step="1" class="no-spinner"`, and the call site at line 234,
which does still hand-build its `opts` object rather than spreading,
correctly includes `integer: f.integer`. `testBedDuration` remains in
`TB_DATE_FIELDS` with `integer: true`. There is no regression to find.

### 2.1 Duration: the reported fault is entry, not saving

The report was that the field **allows a negative number to be entered**.
That is precisely accurate and it is a different fault from the one this
phase went looking for.

`min="0"` on an `<input type="number">` constrains the spinner. It does
not prevent typing, and it only fails constraint validation when a form
is validated. **This app has zero `<form>` elements**, confirmed by
direct count and already recorded in `DESIGN_PRINCIPLES.md` Deferred
scope, and `test-bed-detail.js` runs no `checkValidity`, `reportValidity`
or equivalent guard before its `PATCH`. So a typed `-3` sits in the field
looking accepted, and the rejection only arrives from the server on save.

**Fix at the client layer, where the fault actually is.** The user needs
immediate feedback at entry, not a server error after a save attempt.
Do not change the server validation, it is working.

### 2.2 Sensor counts have no validation at either layer

Carried in this brief as "server-side rejection was never confirmed."
Now confirmed, and the finding is worse than that wording implied. The
two halves differ sharply:

- **Cost rates are validated.** `test-beds.js:437` runs all nine rate
  fields through `isValidNonNegativePercent`.
- **Sensor counts are not validated anywhere.** `safesightCameras`,
  `airQualitySensors` and `hemirSensors` sit in
  `TEST_BED_WRITABLE_KEYS` but appear in no validation loop, and
  client-side they receive only `{ number: f.number }`, so no `integer`
  and therefore no `min` or `step` either. Negative, fractional and
  string values are accepted at both layers. `estCostPerUnit` is in the
  same position.

**These multiply directly into installation and hosting cost.** A
negative sensor count produces a negative cost line and a wrong total,
silently. That is a live data-integrity hole in the figure a go/no-go
decision rests on, and it is materially more serious than the reported
Duration issue.

Validate at both layers, non-negative integers for counts, non-negative
number for `estCostPerUnit`, reusing `field-validation.js` rather than
writing new checks.

**Test evidence required:** in a real browser, confirm a negative value
can no longer be typed into Duration or any sensor count, and that
feedback appears at entry rather than only on save. By direct API call
bypassing the browser, confirm negative and fractional values are
rejected for `testBedDuration`, all three sensor counts and
`estCostPerUnit`, and that valid values are accepted and persisted.
Confirm a cost breakdown computed from a rejected value never reaches
the database.

---

## Phase 3: Approvals bind to stage, and build the `child_record_status` branch

Two mechanism changes that everything after this depends on. Confirmed
with the business.

### 3.1 Approval scope becomes a property of the rule

Today `computeBlocking`'s `approval_obtained` branch matches approvals on
`.eq('revision_number', currentRevision)`. Since every `PATCH` creates a
new revision, any field edit silently voids every approval already given
and re-blocks the stage with no explanation on screen.

That is Rule 2, immutable approved snapshots, applied to the wrong thing.
Rule 2 was written for a Deal Sheet frozen at proposal submission, a
one-shot event. A Test Bed stage gate sits on a record that is edited for
weeks.

**Confirmed decision: scope becomes per-rule, not global.**

    {"track": "Legal",      "scope": "stage"}      <- Test Bed stage gates
    {"track": "Commercial", "scope": "revision"}   <- Deal Sheet / proposal

- Add a `stage` column to `approvals`, populated at insert time from the
  record's current status.
- `scope: "stage"` matches on the stage. `scope: "revision"` keeps
  today's behaviour. **Absent `scope` defaults to `revision`**, so every
  existing rule and every already-issued approval behaves exactly as it
  does now. This is a continuity requirement, not a style choice.

**Three constraints, all mandatory, so a future pricing-history feature
stays possible.** Confirmed as a real want, deferred, and it must not be
foreclosed here:

1. Approvals keep writing `revision_number` even when gated on `stage`.
   Gate on stage, record the revision. Do not drop the column.
2. Deal Sheet and Opportunity commercial rules stay revision-scoped.
3. Nothing prunes, compacts or overwrites `record_revisions`. Every
   `PATCH` keeps creating a new row.

### 3.2 Build the `child_record_status` branch

`src/routes/transitions.js` currently carries a bare comment,
`// child_record_status handled in a future milestone`, so the rule loop
falls through and pushes nothing. Three real rules seeded on
Decommissioning to Closed are silently ignored today.

The document records these rules read already exist:
`POST /test-beds/:id/complete-document` creates or updates a real
`record_type = 'document'` child with `variant = document_type` and
`status = 'approved'`, optionally storing a Google Drive URL. Only the
gate branch is missing.

Build it as a fifth branch in the same generic loop, matching the shape
of the existing four. Do not special-case per record type.

**Note for Phase 1's harness:** the assertion written there documents the
current no-op. Building this branch must **invert** that assertion, not
delete it, exactly as that phase specifies. A visible, deliberate test
failure here is the point.

### 3.3 Approver identity stays unenforced, deliberately

Confirmed with the business: there is currently one user, and he must be
able to tick every track himself to progress a stage. Role-based approval
is a later round.

The `approvals` unique constraint is
`(record_id, revision_number, track, approver_id)`, so different tracks
are different rows and this already works with no change. `approver_id`
continues to be recorded for audit.

Do not build a permission check in this round. Do add a short note to
`DESIGN_PRINCIPLES.md` stating plainly that until enforcement exists, an
approval proves a tick happened, not that the entitled person made it,
so the system supports documented approval but not yet controlled
approval in an ISO 9001 sense.

**Test evidence required:** an approval given, then an unrelated field
edited, then the gate confirmed still satisfied, proving stage scoping
works. Separately, a revision-scoped rule confirmed still voided by an
edit, proving continuity. A `child_record_status` rule confirmed to
block when its document is absent and to clear when
`complete-document` has been called.

---

## Phase 4: Configure the gates for transitions 1 and 2 only

**Deliberately not all seven.** `DESIGN_PRINCIPLES.md` Section 8 and
`TESTBED_BUILD_BRIEF.md` Milestone 2 both say the undefined stages stay
open until real Test Beds have run through them, and Milestone 2 says
explicitly not to invent requirements for them. The business is working
through the stages by review pass. Configure what has been reviewed.

| # | Transition | Documents | Approvals | Fields |
|---|---|---|---|---|
| 1 | Qualification to Pre-Site Assessment | none | **Technical, Commercial (new)** | Duration, Est. Install Date, Est. Go Live, plus the 3 buyer roles, all already live |
| 2 | Pre-Site Assessment to Site Assessment | **NDA (new)** | none yet | none yet |

Both are new `stage_gate_rules` rows, data not code. Transition 1's
approval rules use `scope: "stage"` per Phase 3.

**Confirmed convention, worth stating because it governs the remaining
five gates:** a stage's documents are produced during that stage and gate
the exit from it. The template arrives on entry, the completed document
releases the exit. Item 16 of the source feedback confirms this
independently: the NDA template is pulled on progression into Pre-Site
Assessment, and the NDA gates the exit from it.

**Confirmed, resolved earlier, record it here so it is not rediscovered:**
transitions 5 and 6 share one living Test Bed Review Document. The
document requirement sits on transition 5 only; transition 6 is gated by
its approval ticks, which are made at that moment and therefore carry the
freshness a persistent document cannot. Transition 7 requires a separate
Decommissioning Report plus Senior approval, and drops the NDA, PDPA and
DPIA requirements as redundant, since gates 2 and 3 already prove those
were reviewed.

**Test evidence required:** a real Test Bed at Qualification confirmed
blocked until both approval ticks are given, then confirmed to advance.
A Test Bed at Pre-Site Assessment confirmed blocked until
`complete-document` records the NDA.

---

## Phase 5: Test Bed header rework

Three changes, all from the annotated screenshots.

1. **Fill the empty space to the right of the Test Bed name** with the
   Summary and the last 2 notes, latest first.
2. **Remove the Stage / Accumulated Cost / Age / Terminus Reference
   strip.** Stage is in the chevron, Terminus Reference is on the
   Reference tab, Accumulated Cost is on Commercials.
   **Age is not dropped, it relocates to the Key Dates panel on the
   Reference tab**, joining Date Created, Estimated Installation Date,
   Est Go Live and Test Bed Duration.

   Age needs no storage. It is `today` minus `created_at`, computed at
   display time, exactly as `DESIGN_PRINCIPLES.md` Section 2 already
   states for Opportunity age and days-since-last-update.

   A `daysAgo()` helper and a `tb-detail-age` element already exist in
   `app.js`, used by the strip being removed. Reuse the helper rather
   than writing a second date-difference function.

   **It must render as a read-only row, not a `tbFieldRow` click-to-edit
   row.** Every other field in Key Dates is editable, so the default
   path would silently make a computed value look editable. Follow the
   existing read-only precedent used for Account Number and the Parent
   Account display row, not the editable field pattern.
3. **Remove the Stage Transition section** (`#tb-transition-section`,
   `renderTransitionSection`). Its function moves to Phase 6. Do not
   remove it before Phase 6 lands, or the app has no working transition
   trigger at all, which is precisely what Round 5 Phase 7 avoided when
   it relocated this section rather than deleting it.

**Notes must follow the existing shared pattern.** `DESIGN_PRINCIPLES.md`
Rule 10: every note anywhere in the app renders as timestamp, then
author, then text, via `.ref-notes-row` / `.ref-notes-when` /
`.ref-notes-text`. Reuse that markup. Do not build a compact header
variant with its own ordering.

Summary moving here dissolves the Summary-plus-Use-Cases grouping built
in Round 6 Phase 3. That is expected, Use Cases moves in Phase 8.

**Test evidence required:** screenshots at 1240px, 1920px and 3440px
confirming the header fills sensibly and the notes render in the shared
pattern. Confirm a record with zero notes and a record with one note both
render honestly rather than showing an empty box.

---

## Phase 6: Next Stage, Cancel and Save Changes move into the tab row

**Confirmed layout**, per the supplied reference images: Next Stage,
Cancel and Save Changes sit at the right-hand end of the tab row, after
Closed. The separate save-bar banner line is removed.

**Confirmed behaviour: Next Stage is disabled unless the open tab is the
record's real current stage.** The business instruction is that stage
progression happens from inside the stage itself, so the user must
navigate to the current stage, review its criteria and approvals, and
progress from there.

- Wire it to `window.attemptTransition` unchanged. Do not build a second
  transition mechanism. This is the same function Round 5 Phase 8's
  button and the removed section both already use.
- Disabled state needs a readable reason. Distinguish "not the current
  stage" from "final stage", which the existing section already handles.
- **Blocking feedback needs one unambiguous home.** Round 5 Phase 8 gave
  the top button its own feedback area specifically so a rejection
  appeared at the point of the click. With the section gone there is one
  button, so there must be exactly one feedback target, positioned where
  it is visible from the tab row without scrolling.
- **Keep the dirty-gating.** Round 5 Phase 5 deliberately gated the save
  bar on `dirtyCount` rather than on any field being open, so opening a
  field and leaving it unchanged has zero visible effect. Relocating the
  buttons must preserve that, not revert it.

**Test evidence required:** confirm Next Stage is disabled on every tab
except the record's current stage, and active on that one. Confirm a real
blocked transition shows its reasons in the single feedback area.
Confirm a real satisfied transition advances the record. Confirm opening
a field without editing shows no Save, and a genuine edit does.

---

## Phase 7: Stage tab layout and naming, all 8 stages

Applies identically to every stage tab, one shared change, not eight.

1. Rename **Reference Materials** to **Customer Documents**.
2. Rename **Documents** to **Terminus Docs**.
3. Lay out **Exit Criteria** and **Approvals** as two side-by-side
   panels or columns rather than stacked.

Reuse the existing `.ref-cards` grid and its proven
`minmax(280px, 420px)` cap rather than new grid CSS, consistent with
every other panel layout in the app.

The renames are display-only. Do not rename the underlying
`stage_reference_docs` table, the `document-requirements` endpoint keys,
or any payload field. A label change must not become a schema change.

**Test evidence required:** screenshots at 1240px and 1920px on at least
three different stage tabs, confirming both panels sit side by side and
neither truncates. Confirm the renamed labels appear and that a direct
API call to `document-requirements` returns the unchanged key names.

---

## Phase 8: Reference and Commercials panel changes

### 8.1 Reference tab

- Sensors list moves into its own panel.
- Use Cases moves into its own panel rather than a full-width line.

### 8.2 Commercials tab

- **Remove the Warranty input panel. Do not change the calculation
  engine.** Confirmed decision, and deliberately the lower-risk of the
  two options considered. A Test Bed is Terminus-funded R&D with no
  customer warranty commitment, so the input is not relevant, but
  `calculateTestBedCost` keeps calling `calculateHardwareAndWarranty`
  exactly as it does today. Warranty is neutralised by data, setting
  `warrantyPct` to `0`, not by a code path that diverges from
  Opportunity's.

  This is the point of the decision: the two record types keep running
  through identical arithmetic, so they cannot drift apart later.

- **Corrected after Code's review, 2026-08-18. Removing the input is not
  enough, and this inverts the phase's intent if built as originally
  written.** `buildTestBedCostBreakdown` (`test-beds.js:19`) falls back
  to `warrantyPct: 2` when the key is absent or empty. So simply
  deleting the input and the stored key produces a permanent, invisible
  2 percent warranty, exactly the silent cost drift this phase exists to
  prevent. Worth noting plainly: any Test Bed that never had warranty
  set has been computing a 2 percent warranty nobody chose, today, right
  now.

- **Pass `warrantyPct: 0` explicitly** in `buildTestBedCostBreakdown`,
  replacing the conditional entirely, so the stored payload key is
  ignored rather than read. **This is not a cost-engine change.**
  `buildTestBedCostBreakdown` is the Test Bed route's own mapping
  function, and exists to hold exactly this kind of Test-Bed-specific
  decision. `deal-calculator.js` is untouched, and so is `deals.js:148`,
  which carries Opportunity's own separate `?? 2`. Confirm all three
  defaults are genuinely independent before editing, they are, at
  `deal-calculator.js:108`, `deals.js:148` and `test-beds.js:19`.

- **Then lock it.** Remove `warrantyPct` from `TB_COST_FIELDS`, from
  `TEST_BED_WRITABLE_KEYS`, and from the percent-validation loop at
  `test-beds.js:436`, so a direct API `PATCH` naming it is rejected the
  same as any unrecognised field. Same treatment `accumulated_cost` and
  `indicativeCost` already received in Round 5 Phase 6. Passing 0
  explicitly means no `warrantyPct` backfill is needed, stale stored
  values simply stop being read.

- **Omit the warranty line from the itemised breakdown while it is
  zero**, rather than rendering a permanent `USD 0.00` row. Consistent
  with the documented decision not to build the Test Bed list matrices:
  permanently empty UI with no visible explanation is worse than absent
  UI.
- Hardware, Installation and Hosting render as three side-by-side
  panels.

**Zeroing `warrantyPct` still changes real stored figures, and needs
handling, not just setting.** Any live Test Bed carrying a non-zero
warranty today, Round 5 Phase 6's own verification used 5 percent, gets a
lower total. `accumulated_cost` and `indicativeCost` are server-computed
mirrors refreshed on every `PATCH`, while `GET /test-beds/:id`
live-recomputes the breakdown on every fetch. So the detail page drops
immediately while the stored mirror stays stale until each record is next
saved, and the Test Beds list view reads the stored payload. List and
detail will disagree until every record is touched.

**Corrected after Code's review: the split is not list versus detail, it
is live versus stored, and the detail page sits on both sides of it.**
There are three cost surfaces, not two:

| Surface | Source | After the change |
|---|---|---|
| Itemised breakdown | `bed.costBreakdown`, live-recomputed on every `GET` | drops immediately |
| Detail header `tb-detail-cost` | `p.accumulated_cost`, stored | stale until next save |
| Test Beds list column | `p.indicativeCost`, stored | stale until next save |

So the visible inconsistency is between two figures **on the same page**,
header against breakdown, not only between two screens. An evidence check
that confirms only "list and detail agree" can pass while that
inconsistency is sitting in front of the user.

Backfill `accumulated_cost` and `indicativeCost` across all live Test
Beds as part of this phase, and confirm all three surfaces agree
afterwards, naming each one separately.

Opportunity's warranty handling is **untouched**, and because the engine
is not being changed this should now be provable rather than merely
argued. Confirm by regression test that an Opportunity's deal
calculation is byte-identical before and after, and confirm by direct
diff that `calculateHardwareAndWarranty` and `calculateTestBedCost` were
not modified at all.

**Test evidence required:** a Test Bed cost hand-computed independently
and matched against the server response, confirming the warranty
contribution is genuinely zero. Confirm no warranty input or figure
appears anywhere on the tab. Confirm a direct `PATCH` naming
`warrantyPct` is rejected.
Confirm an Opportunity's deal calculation is byte-identical before and
after. Confirm the backfill by querying stored `accumulated_cost` against
the live-computed breakdown for every Test Bed.

---

## Phase 9: Chevron hover shows outstanding criteria

Hovering a stage in the chevron strip shows a popup listing that stage's
outstanding actions and exit criteria.

Almost entirely wiring. The data already exists:
`GET /records/:id/exit-criteria?stage=` was generalised in Round 6 Phase
3 and returns exactly the `blocking[]` a real transition attempt would.

**Reuse the established hover-popup pattern, do not build a fourth
variant.** Two already exist, `.contact-count-popup` and
`.tb-matrix-popup`, both sharing `.linked-record-row` and both given
`white-space: nowrap` / `overflow: hidden` / `text-overflow: ellipsis`
plus a bounded `max-width` in Round 6 Phase 1. Attach listeners to the
wrapper rather than the label, the mistake both of those had to correct,
so moving the pointer into the popup does not register as leaving.

The chevron stays non-clickable. Round 5 Phase 7 and Phase 8 established
by direct git history that it has never had a click handler and is purely
a status indicator. Adding hover must not add click.

**Test evidence required:** hover a stage with real outstanding criteria
and confirm the list matches a direct
`GET /records/:id/exit-criteria?stage=` call for the same stage. Hover a
stage with none and confirm an honest empty state. Confirm long
requirement text truncates rather than wrapping, measured on the block
element, not on an inline span.

---

## Deliberately not in this round

- **Google Drive document architecture.** Customer reference folders per
  Test Bed and Opportunity, a Terminus folder per Test Bed, templates
  copied from a master library on stage progression, and document links
  surfaced for editing. Confirmed as Round 8 with its own investigation
  phase. It is a real integration, not a layout change, and it has
  external prerequisites: which Google Workspace, a service account with
  Drive scope, and where the master template folder lives. Architecturally
  it is already committed to by `DESIGN_PRINCIPLES.md` Section 1, store a
  Drive file ID and link out, never build file storage.
- **Gate configuration for transitions 3 to 7.** Awaiting the business
  review pass on those stages. The shape is agreed and recorded in Phase
  4; only the mandatory-field column is open.
- **Role-based approval enforcement.** See Phase 3.3.
- **Pricing history view for Deal Sheet revisions.** Confirmed as
  wanted, deferred. The data already exists in `record_revisions`;
  Phase 3's three constraints exist to keep it that way.
- **The full buyer-role catalog design**, unchanged since Round 3.
- **Deep Parent Account cycles**, unchanged since Round 4.

---

## Documentation discipline

Same as every prior round: update `DESIGN_PRINCIPLES.md` the moment a
decision in this brief changes during the build. Phase 3's approval
scoping and the `child_record_status` branch are genuinely new mechanisms
and need recording precisely, as Round 5's Exit Criteria and stage-scoped
document work did.

Before declaring this round complete, check the phase count against this
document's own list with `grep -n "^## Phase"`. Rounds 3 and 5 both
recorded a premature completion claim caught only by doing exactly that.
