# Round 9 build brief: Test Bed workflow finalisation, gates and stage tabs

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND7_BUILD_BRIEF.md`, `ROUND8_BUILD_BRIEF.md`.
Read all five before starting.

This round configures every remaining Test Bed stage gate, builds the one
new mechanism those gates need, and standardises the 8 stage tabs around a
single layout. It is the round that makes the Test Bed lifecycle a real,
completable workflow rather than a configured shell.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Scope boundaries, confirmed with the business

Recorded so they are not reopened mid-build.

- **Reference tab layout is Round 10.** Summary moving in line with the
  Test Bed name, panel reordering, the label-shortening table, editable
  Test Bed name, and the Installation Environment picklist are all
  confirmed and all deliberately out of this round.
- **Customer Documents and Google Drive are Round 11.** Customer Documents
  means client-supplied reference material (site drawings, QHSE
  guidelines, anything Terminus needs to know from their side). It is a
  concept that does not exist in the system today. It lands on the
  Reference tab, not on the stage tabs, and it arrives with the Drive work.
- **Conversion stays exactly as it is.** Unconditional, available at any
  stage, buyer-contact links still not carried across.
- **Approval entitlement stays unenforced.** One user, who must be able to
  tick every track himself. Do not build a permission check, do not add
  `routing_rules` rows.
- **Success criteria and performance measurement remain unbuilt.** Section
  7's `success_criterion` and `performance_result` records are not in this
  round, so Review and Completion is gated by documents, approvals and
  criteria, not by measured outcomes.

---

## Four rules that govern every row and every change in this round

State these back before Phase 2 begins, to confirm they were read rather
than skimmed. Each one has already produced a real defect in this project.

1. **Every `approval_obtained` rule written this round carries
   `{"track": "<n>", "scope": "stage"}`.** Round 7 Phase 3.1 made an
   absent `scope` default to `revision` for continuity. A revision-scoped
   rule on a Test Bed stage gate is silently wrong: every `PATCH` creates a
   new revision, so the next field edit voids the approval and re-blocks
   the gate while the tick still displays as given. A rule missing `scope`
   is a defect in this round even if it appears to work on the day it is
   written.

2. **Every document gate uses `requirement_type = 'document_status'`,
   never `child_record_status`.** Only `document_status` is read by
   `completable_documents` in `test-beds.js`, which is what renders the
   Confirm control an operator clicks to satisfy the gate. A
   `child_record_status` rule naming a document blocks correctly and offers
   no way to satisfy it from inside the product, which is a worse failure
   than a wrong gate because everything looks configured.

3. **A document name is written identically in three places or the gate is
   broken.** `stage_gate_rules.requirement_detail.document`,
   `stage_reference_docs.document_name`, and
   `supabase/seeds/003_test_bed.sql`. No case folding, no abbreviation, no
   trailing whitespace. These two tables hold the name as independent free
   strings with nothing aligning them, a gap already recorded in
   `DESIGN_PRINCIPLES.md`.

4. **One gate computation path, never a second.** `computeBlocking()` in
   `src/routes/transitions.js` is the only gate evaluator in this codebase
   and Round 5 Phase 5 deliberately made it so. Phase 3 below extends what
   the read-only endpoint returns. It must not introduce a parallel
   evaluation, and the mutating transition endpoint must be regression
   tested against the change, not assumed unaffected.

---

## Phase 0: Build the state generator, then investigate with it

Report before Phase 1 starts. Every item is a direct query against the live
database or a direct read of the real file, not an inference from any
document in this repo, including this one.

**This phase makes no product change**, and the distinction matters because
every prior round's Phase 0 was investigation only. `scripts/state-dump.mjs`
below is read-only reporting tooling, in the same category as
`scripts/verify-harness.mjs` and `scripts/seed.js`, not a change to the
application. Nothing in `src/` or `frontend/` is touched in this phase.

### 0.1 Build `scripts/state-dump.mjs` first, and produce this phase's report with it

Items 1 to 3 and 5 to 7 below are exactly the facts that go stale between
sessions and get reconstructed by hand every round. Build the generator
once, here, and use its output as this phase's report rather than writing
the same facts out manually.

Requirements, all mandatory:

- **Generated only, never hand edited.** The file opens with a header
  saying so, plus the generation timestamp and the git commit SHA it was
  generated at, so a stale copy is detectable rather than silently trusted.
- **Every value read from the live database or by parsing the real source
  file.** Never restated from `DESIGN_PRINCIPLES.md`, this brief, or any
  other document. A generator that reads a document is a document with
  extra steps.
- **It records what is, never why.** Reasoning stays in
  `DESIGN_PRINCIPLES.md`. This is the same separation that already exists
  between that document and `PROTOTYPE_SPECIFICATION.md`, applied to a
  third kind of content: current configured state.
- **No secrets and no client data.** Environment variables, keys and tokens
  are never read or printed. For records, report **counts by status only**,
  never names, reference codes or any other client-identifying value. This
  file gets uploaded into chat sessions.
- **Tracked in git, written to `CURRENT_STATE.md` at the repo root.** The
  diff between rounds is a genuine changelog of configuration, which is
  worth more than the file itself.
- Follows the existing conventions: environment-sourced credentials, never
  a hardcoded absolute path, `node:` built-ins, no new dependency.

Contents, at minimum:

| Section | Source |
|---|---|
| `stage_definitions`, every record type | live database |
| `stage_gate_rules`, every record type, full `requirement_detail` | live database |
| `stage_reference_docs`, every record type | live database |
| `approval_tracks`, `routing_rules`, `conversion_criteria` | live database |
| Record counts by `record_type` and `status`, non-deleted and deleted | live database |
| `approvals` counts by `decision`, and how many carry a null `stage` | live database |
| Writable-key allowlists (`TEST_BED_WRITABLE_KEYS`, `SALESPERSON_WRITABLE_KEYS`, and equivalents) | parsed from the real source files |
| Registered route inventory, method and path | parsed from the real source files |
| Migration filenames applied, in order | repo |

**Test evidence required for 0.1:** run it, paste the full generated file,
and confirm two properties by direct check rather than assertion. First,
that a value in it disagrees with `DESIGN_PRINCIPLES.md` where the document
is stale, or that it agrees everywhere, stated either way. Second, that
running it twice with no change between produces byte-identical output
apart from the timestamp, since a generator with unstable ordering makes
its own diffs useless.

### 0.2 Investigation items

1. **Live Test Bed inventory.** Every non-deleted `record_type =
   'test_bed'` record and its `status`. The real list, not a count. **This
   one item is reported in the phase report only, not written into
   `CURRENT_STATE.md`**, per the no-client-data rule above.

2. **Current `stage_gate_rules` for `test_bed`.** Exact row count and the
   full contents of every row. **Do not assume the count is 7 or 10.**
   Both figures appear in `ROUND7_BUILD_BRIEF.md` as checkpoints taken at
   different moments, and that brief says explicitly the number was
   expected to move again. Every expected-count assertion in this round is
   derived from what you actually find here.

3. **Current `stage_reference_docs` rows for `test_bed`**, all stages,
   exact `document_name` strings.

4. **Resolve which panel is backed by which endpoint key.** Round 7 Phase 7
   renamed "Reference Materials" to "Customer Documents" and "Documents" to
   "Terminus Docs", display-only. `GET /test-beds/:id/document-requirements`
   returns `{ reference_docs, completable_documents }`. Report, by reading
   the real rendering code, which visible panel renders which key. The
   working hypothesis, to confirm or refute: the panel currently labelled
   **Customer Documents** renders `reference_docs`, which is sourced from
   `stage_reference_docs` and therefore holds **Terminus's own** per-stage
   documents, not the customer's. If that holds, the Round 7 rename
   mislabelled it and Phase 6 corrects it.

5. **Is `Senior` a real approval track?** Query `approval_tracks` directly.
   Report whether a `Senior` row exists, and whether an approval can be
   recorded against the existing Decommissioning to Closed rule through the
   real UI at all. Phase 5 removes that rule, so this is for the record
   rather than for a fix.

6. **Approvals rows.** How many exist for Test Beds, how many have a null
   `stage`, and their `decision` values. `approvals.stage` was left
   nullable and deliberately un-backfilled in Round 7 Phase 3.1, so a
   null-stage approval cannot satisfy a stage-scoped rule by design and
   will look correct on screen while counting for nothing.

7. **Does `payload_field_required` treat a boolean `false` as present?**
   Read the real branch in `transitions.js` and report exactly what it
   tests for. Phase 3 depends on the answer. Do not assume.

8. **Baseline the suite.** Confirm `npm test` and `npm run test:db`
   currently pass on a clean checkout before anything is touched, so a
   later failure is attributable. Report the assertions in
   `scripts/tests/gates.test.mjs` that adding rows will affect.

---

## Phase 1: Reset the Test Bed data, by soft delete

**A hard reset is not authorised and is not the default.** The 2026-08-15
full business-data reset required dropping the `audit_log.record_id`
foreign key and restoring it as `NOT VALID`, because `ON DELETE RESTRICT`
blocked the deletion outright. Separately, a standing rule forbids deleting
`reference_number_counters` rows while a soft-deleted record still holds a
code from them, after a real unique-constraint collision. Neither hazard is
worth re-entering to obtain a clean workflow proof.

1. Soft-delete every existing Test Bed via `deleted_at`, the mechanism
   already proven at Milestone 3 for exactly this situation. Leave
   `record_revisions`, `audit_log` and every counter row untouched.
2. Create **one** fresh Test Bed through the real
   `POST /contacts/:id/create-test-bed` path, from a real qualified Contact
   with a real linked Account. Not a direct database insert. This record is
   the subject of Phase 8's walkthrough.
3. If Phase 0 found any Test Bed representing a real client engagement
   rather than test data, **stop and report before deleting anything.**
   Milestone 3 investigated all 8 then-live records individually before
   concluding they were placeholder data. Apply the same standard.

**Test evidence required:** confirm by direct query that every previously
live Test Bed now has a non-null `deleted_at` and that zero rows were hard
deleted. Confirm the new fixture has a real `account_id`, a real
`reference_code`, and `status = 'Qualification'`. Confirm no
`reference_number_counters` row was deleted or modified other than by the
new record's own increment.

---

## Phase 2: Rebuild the document catalogue

Rule 3 means every document name a gate references must already exist as a
`stage_reference_docs` row. Do this before any gate row is written.

### 2.1 Target state, all 8 stages

| Stage | Terminus Documents |
|---|---|
| Qualification | none |
| Pre-Site Assessment | NDA |
| Site Assessment | Site Assessment Report, Compliance and Data Protection, Partnership and Test Bed Agreement |
| Installation and Commissioning | Site Installation Document |
| Monitoring and Analysis | **Test Bed Performance**, **Review Meeting Minutes** |
| Review and Completion | **Test Bed Close Out Report** |
| Decommissioning | **Site Decommissioning Report** |
| Closed | none |

The four bold entries are new. Add them, and remove whatever currently
occupies those stages, in the live database and in
`supabase/seeds/003_test_bed.sql` in the same change, per the standing rule
that a migration changing seeded data must reconcile the seed in the same
commit because seeds re-run and win.

### 2.2 Three superseded decisions, recorded not silently overwritten

Each of these was reasoned about deliberately in an earlier round and is
now replaced by a business decision. Record each one in
`DESIGN_PRINCIPLES.md` with the supersession visible, matching how every
other correction in that document is handled.

| Superseded | By | Consequence |
|---|---|---|
| **Test Bed Review Document**, a single living document shared by stages 5 and 6, with the gate deliberately sitting on transition 5 only (Round 7 Phase 4) | Two distinct documents at stage 5 and one at stage 6 | That entire piece of reasoning is void. Both stages now gate on their own documents. Simpler, and it removes a genuine subtlety a future reader would have had to reconstruct |
| **Decommissioning Report** (Round 7 Phase 4) and **Site Installation Document** on Decommissioning (`PROTOTYPE_SPECIFICATION.md` Section 6) | **Site Decommissioning Report** | Third naming of the same artefact. This one is authoritative. Correct Section 6's table with the superseded entry annotated, not deleted |
| **Senior-tier sign-off on Decommissioning to Closed**, described in `DESIGN_PRINCIPLES.md` Section 8 as a heavier gate than the rest of the lifecycle | Technical, Commercial and Legal approval, the same three tracks as the two preceding transitions | Section 8's "gated more heavily than the rest of the lifecycle" claim becomes untrue and must be rewritten, not left standing. `routing_rules` remains empty and is now referenced by nothing |
| **`child_record_status` has no code branch at all, so a `stage_gate_rules` row using it is a silent no-op that never blocks a transition** (`DESIGN_PRINCIPLES.md` line 352, Section 8, recorded at the Milestone 2 audit and confirmed live at the time) | Round 7 Phase 3.2 built the branch, as a fifth generic branch in the same rule loop. `scripts/tests/gates.test.mjs` now asserts it blocking, having deliberately inverted the assertion that documented the hole | Added Round 9 Phase 0, 2026-08-19. The document states as present-tense fact something a build made false two rounds ago, which is the exact failure mode `CURRENT_STATE.md` exists to expose. Correct line 352 with the superseded text left visible. The same paragraph also describes that transition as requiring every lifecycle document reviewed via `child_record_status` rules; Phase 3.2 deleted those three rules as unsatisfiable, so the only rule surviving there is the `Senior` approval that Phase 5.1 removes, which means the sentence is wrong on both halves |

### 2.3 Living documents

Confirmed with the business: **Review Meeting Minutes and Test Bed
Performance are single living documents that are updated over the life of
the stage, not one record per meeting.** The gate requires the document to
be current and reviewed by the approvers at the point of transition, which
is exactly the shape the existing document mechanism already supports (a
single child record per document name, its URL updatable). No new mechanism
is needed and none should be built.

**Test evidence required:** query `stage_reference_docs` and present the
full post-change row set. Run `npm run db:seed` twice against a real
database and confirm no duplicate rows and no resurrected superseded names.
Confirm every guard involving `jsonb` compares `jsonb` to `jsonb` and never
via a `::text` cast, per the standing rule recorded after Round 7 Phase 0
found that fault duplicating three rows on every single run.

---

## Phase 3: Exit Criteria becomes a real, tickable, gating checklist

**This is the one new mechanism in the round.** Everything else is
configuration or layout.

### 3.1 What changes, and what deliberately does not

Today `GET /records/:id/exit-criteria?stage=` returns `blocking[]`, the
outstanding requirements only, computed by `computeBlocking()`. The panel
shows what is left to do and "Nothing outstanding" when clear.

The business needs a **tick list**: every criterion for the transition,
shown with its satisfied state, not only the unsatisfied ones.

- **Extend what the endpoint returns**, so each requirement carries a met
  or unmet flag alongside its description. Same computation, satisfied
  items no longer discarded.
- **Do not build a second evaluator.** Rule 4. The mutating transition
  endpoint and this read-only endpoint keep sharing `computeBlocking()`.
- **Regression test the mutating endpoint** after the change, directly, not
  by inspection. Round 5 Phase 5 did exactly this when `computeBlocking()`
  was first extracted and it is the same risk.

### 3.2 Judgement criteria are `payload_field_required` rules, not a new type

Confirmed decision: the Qualification checklist gates the transition now,
and it is built on the existing requirement type rather than a new one, so
no branch is added to `transitions.js` and the whole thing is configurable
as data in the eventual Admin module.

Each criterion becomes one `payload_field_required` row:

    {"field": "exitQualPhysicalSuitability", "label": "Physical Suitability"}

`label` is additive, ignored by the engine, and is what the Admin module
will edit later. Confirm by direct reading that the existing branch ignores
unrecognised keys in `requirement_detail` rather than failing on them.

**The tick value must not be a boolean.** Phase 0 item 7 establishes what
`payload_field_required` treats as present and non-empty. A stored `false`
may or may not read as empty depending on that implementation, and a gate
that passes on an unticked box is the worst possible outcome here. **Store
an ISO timestamp string on tick, and delete the key entirely on untick.**
That makes present-and-non-empty structurally equivalent to ticked, rather
than dependent on a truthiness detail. Add the new keys to
`TEST_BED_WRITABLE_KEYS`.

### 3.3 The criteria

| Transition | Judgement criteria (`payload_field_required`) |
|---|---|
| 1. Qualification to Pre-Site Assessment | Technical and Commercial Value; Data and Use Case; Physical Suitability; Partner Commitment |
| 5. Monitoring and Analysis to Review and Completion | All Meeting Actions Completed |
| All others | none |

Every other stage's exit criteria, as specified by the business, restate
that stage's own document requirements ("NDA and status", "Site Assessment
Completed", "Close Out Report Completed and Approved"). Those are already
computed from the `document_status` rules and need no separate criterion.
**Do not create a duplicate checklist item for something a document gate
already covers**, or the same requirement appears twice in the panel and
can be half-satisfied.

**Test evidence required:** confirm the endpoint returns satisfied and
unsatisfied requirements with correct flags on a real record. Confirm a
ticked criterion genuinely satisfies its gate rule and an unticked one
genuinely blocks, both proven against the real transition endpoint, not
only the read-only one. Confirm the mutating endpoint's behaviour is
unchanged for every pre-existing requirement type. Confirm the untick path
removes the key rather than writing an empty value, by direct payload
inspection.

---

## Phase 4: Configure gates, transitions 1 to 4

| # | Transition | Documents (`document_status`) | Approvals (`approval_obtained`, all `scope: "stage"`) | Criteria |
|---|---|---|---|---|
| 1 | Qualification to Pre-Site Assessment | none | Technical, Commercial | 4 items, Phase 3.3 |
| 2 | Pre-Site Assessment to Site Assessment | NDA | **Commercial, Legal (new)** | none |
| 3 | Site Assessment to Installation and Commissioning | Site Assessment Report, Compliance and Data Protection, Partnership and Test Bed Agreement | Commercial, Technical, Legal | none |
| 4 | Installation and Commissioning to Monitoring and Analysis | Site Installation Document | **Commercial, Technical** | none |

Transition 1's existing payload and contact-role rules (Duration, Est.
Install Date, Est. Go Live, plus the three buyer roles) stay exactly as
they are. The four criteria are added alongside them.

Transition 2 currently has its NDA document rule and **no approvals**,
recorded as "none yet" in Round 7 Phase 4. Commercial and Legal are added
here.

Transition 4's approvals are **Commercial and Technical**, superseding
`PROTOTYPE_SPECIFICATION.md` Section 6's table, which lists Technical
alone. Record the change.

One `document_status` row per document, never one row naming several. Read
transition 2's existing NDA row and copy its `requirement_detail` shape
rather than reconstructing it from this brief.

**Test evidence required:**

1. Drive the Phase 1 fixture from Qualification to Monitoring and Analysis
   through the real transition endpoint, satisfying every gate genuinely.
2. At each transition, confirm the blocking list before and after each
   requirement is satisfied, and that it shrinks by exactly one each time.
3. **Confirm the Confirm control genuinely renders for every required
   document in the real browser.** This is the specific failure mode rule 2
   exists to catch and it cannot be proven by an API call.
4. **Prove stage scoping holds.** On transition 3, give all three
   approvals, then edit an unrelated field on the Commercials tab to force
   a new revision, then confirm the gate is still satisfied and the
   transition still succeeds. A revision-scoped rule fails here. This is
   the assertion that catches a missing `scope`.

---

## Phase 4A: Close the two defects Phase 4 surfaced

**Added 2026-08-19, after Phase 4. This is a scope addition and it is its
own phase, deliberately not bolted onto Phase 5.** Both defects were found
by Phase 4's own evidence, and both are code changes in a round whose
other phases are configuration and layout, so folding them into a
configuration phase would hide a mechanism change inside a data change.

**Why now rather than before Phase 8.** Finding B fires whenever a track
is required at two consecutive stages with no field edit between them.
Commercial gates transitions 1 to 4, and Phase 5 configures Commercial on
transitions 5, 6 and 7 as well, so the same 409 would fire three more
times inside Phase 5's own evidence and would have to be worked around
three more times before anyone could see whether Phase 5's rows were
correct. A workaround repeated inside the evidence for a phase is no
longer a workaround, it is a defect being normalised.

### 4A.1 Stage adjacency

Confirmed rule:

- **Forward transitions must be exactly one stage.** Gates apply as
  configured.
- **Backward transitions to any lower stage are permitted, ungated**, and
  recorded in `audit_log` as a regression.
- **Same-stage and unknown-stage transitions are refused.**

Build it in `transitions.js`. No new table and no schema change.

**Backward moves being ungated is a deliberate concession, and it is a
separate future question, recorded rather than resolved here.** A record
moved forward in error has to be recoverable, and the alternative,
gating a reversal on the gates of the stage being returned to, is
incoherent: those gates describe what it takes to leave that stage, not
what it takes to re-enter it. What is genuinely open is whether a
backward move should require a reason, an entitlement, or both, which is
the same governance question as approval entitlement and belongs with it.

### 4A.2 Approvals unique constraint

Target: `(record_id, revision_number, stage, track, approver_id)`, with
`NULLS NOT DISTINCT`.

Both keys are retained deliberately, so a new decision is admitted when
**either** the revision or the stage moves. Dropping `revision_number`
would have been the smaller-looking change and is wrong: Round 7 Phase
3.1 constraint 1 requires approvals to keep recording the revision even
when gated on stage, so a future pricing-history view stays possible.

`NULLS NOT DISTINCT` because `approvals.stage` is nullable and pre-3.1
rows carry null by design. Under the default `NULLS DISTINCT`, two
null-stage approvals for the same record, revision, track and approver
would no longer collide, which would quietly weaken the constraint for
exactly the historical rows it already protects.

**Confirm directly, before building, that the approvals route always
writes a stage today** rather than relying on Phase 0's zero-null finding
continuing to hold for future writes. Phase 0 measured the data; this
needs to establish the property.

**Test evidence required:** Qualification to Closed refused by direct
call. Every two-stage forward jump refused. A backward move permitted,
with its `audit_log` entry shown. The same approver approving the same
track at two consecutive stages with no intervening edit, accepted, which
is the exact 409 that fired twice in Phase 4. A genuine duplicate at the
same stage and revision still refused. Both suites green.

---

## Phase 5: Configure gates, transitions 5 to 7

| # | Transition | Documents (`document_status`) | Approvals (all `scope: "stage"`) | Criteria |
|---|---|---|---|---|
| 5 | Monitoring and Analysis to Review and Completion | Test Bed Performance, Review Meeting Minutes | Technical, Commercial, Legal | All Meeting Actions Completed |
| 6 | Review and Completion to Decommissioning | Test Bed Close Out Report | Commercial, Technical, Legal | none |
| 7 | Decommissioning to Closed | Site Decommissioning Report | Technical, Commercial, Legal | none |

### 5.1 Delete the Senior rule

The existing `approval_obtained {"track": "Senior"}` row on Decommissioning
to Closed is **replaced**, not supplemented. Delete it from the live
database and from `supabase/seeds/003_test_bed.sql` in the same change,
with a non-executable comment recording what was removed and why, matching
how Round 7 Phase 0 handled its own six dead inserts.

**Report before deleting.** If Phase 0 found that `Senior` is not a real
`approval_tracks` row, that is worth recording as a finding in its own
right: it would mean the only heavier-gate mechanism the design ever
described was, in practice, a string that no approval could be recorded
against. Either way the rule goes.

### 5.2 What this does to Section 8

`DESIGN_PRINCIPLES.md` Section 8 states the final transition is gated more
heavily than the rest of the lifecycle, via senior-tier sign-off through
`routing_rules`. After this phase that is no longer true: transitions 5, 6
and 7 carry the identical three tracks. Rewrite the paragraph to describe
what is actually configured, keeping the superseded intent visible. Note
also that `routing_rules` is now referenced by nothing anywhere in the
system.

**Test evidence required:** continue the same fixture through to Closed.
Confirm transition 7 is blocked until the Site Decommissioning Report is
recorded **and** all three approvals are given, both, not either. Confirm
by direct query that no rule anywhere still names the `Senior` track.

---

## Phase 6: Standardise the 8 stage tabs

One shared change applied identically to every stage tab, not eight
changes. Reuse the existing `.ref-cards` grid and its proven
`minmax(280px, 420px)` cap, consistent with every other panel layout in the
app.

### 6.1 Merge two panels into one Terminus Documents panel, positioned left

Phase 0 item 4 establishes which panel renders which endpoint key. On the
working hypothesis, the stage tab today shows the same document twice: once
in the panel labelled Customer Documents (sourced from
`stage_reference_docs`, "go and get the NDA") and once in the panel
labelled Terminus Docs (sourced from `completable_documents`, "Confirm
NDA"). That is one thing presented as two, under a name that describes
neither.

**Target: a single panel titled Terminus Documents, at the left of the
row**, listing that stage's configured documents, each row carrying:

- the document name, from `stage_reference_docs`
- its current status
- a URL, editable, pointing at the working copy of the document
- the existing Confirm action where the document satisfies a gate

`POST /test-beds/:id/complete-document` already creates the child document
record and already optionally stores a Drive URL, so the URL half is wiring
rather than new mechanism. Confirm that directly before building.

**Remove the Customer Documents panel from the stage tabs entirely.**
Customer Documents is client-supplied reference material and arrives on the
Reference tab in Round 11. Nothing on a stage tab represents it today.

**Do not rename any table, endpoint key or payload field.** These are
display changes. A label change must not become a schema change, the same
constraint Round 7 Phase 7 correctly applied to its own renames.

### 6.2 Exit Criteria and Approvals

- **Exit Criteria** renders Phase 3's full tick list, satisfied and
  unsatisfied both, with judgement criteria as genuinely tickable controls
  and document or field requirements as read-only computed rows.

  **Constraint, fixed in Phase 3 and inherited here explicitly rather than
  rediscovered. A requirement renders tickable only when BOTH hold:**

  1. its `field` is a member of `TB_EXIT_CRITERION_KEYS`
     (`src/routes/test-beds.js`), and
  2. it carries a `label`, which supplies the wording.

  **Label presence alone is not sufficient and must not be used as the
  test.** `label` is additive and ignored by the engine, so any
  `payload_field_required` rule may legitimately be given one purely for
  display. If the panel keyed on the label alone, that rule would render
  as a tick box, and a user ticking it would write an ISO timestamp into
  an unrelated payload field. The key-set membership is the half that
  makes the control safe; the label is only the half that makes it
  readable. `TB_EXIT_CRITERION_KEYS` is also the allowlist the `PATCH`
  validates against, so the two conditions together mean the panel can
  only offer a tick the server would actually accept.
- **Approvals shows only the tracks that stage's gate actually requires.**
  Confirm what the current renderer does before changing it. If it renders
  every track regardless, that is the fix; if it already scopes to the
  rules, leave it alone and say so.
- Exit Criteria and Approvals stay side by side, as built in Round 7
  Phase 7.

### 6.3 Closed shows nothing

The Closed stage tab renders no panels. Not an empty Terminus Documents
card, not an empty Approvals card. Nothing. Consistent with the documented
decision not to build the Test Bed list matrices: permanently empty UI with
no visible explanation is worse than absent UI.

**Test evidence required:** screenshots at 1240px and 1920px on at least
three different stage tabs plus Closed. Confirm one documents panel, not
two, positioned left. Confirm a document's URL can be set and updated and
that the change persists, verified server-side. Confirm the Approvals panel
on two stages with genuinely different required tracks shows genuinely
different tracks. Confirm Closed renders nothing. Apply the standing
layout-verification rule: measure the container not the body, assert a
minimum usable width rather than mere presence, run overflow checks on
block-level elements, and open the screenshot and look at it.

---

## Phase 7: Defend the configuration in the automated suite

The rows written above are only as durable as the assertions protecting
them. `DESIGN_PRINCIPLES.md` already records that when a control matters,
the assertion belongs in the suite where it passes or fails, not in prose.

1. **Update the seed count assertion** to the real post-Round-9 figure,
   derived from Phase 0's actual starting count plus what each phase
   actually added, never from a number written in advance.
2. **Confirm the orphaned-rule invariant still passes** across every record
   type. It should, since every stage referenced here is live. Confirm it,
   do not assume it.
3. **New invariant: every `approval_obtained` rule on `test_bed` carries an
   explicit `scope`.** This catches rule 1 at the moment a future round
   adds a rule without it, rather than months later when someone reports
   that approvals keep disappearing.
4. **New invariant: every `document_status` rule's
   `requirement_detail.document` exists as a
   `stage_reference_docs.document_name` for the same `record_type` and the
   rule's own `from_stage`.** This closes the recorded gap that these two
   tables hold names as independent free strings with nothing aligning
   them.
5. **New invariant: no rule anywhere names a track absent from
   `approval_tracks`.** The `Senior` case is the argument for it.

6. **New invariant: no duplicate configuration rows.** No two
   `stage_gate_rules` rows share the same
   `(record_type, variant, from_stage, to_stage, requirement_type,
   requirement_detail)`, and no two `stage_reference_docs` rows share the
   same `(record_type, stage_name, document_name)`. Neither table carries
   a unique constraint, so a duplicate is legal at the database level,
   invisible in the UI, and doubles a requirement.

   **This replaces the migration-ledger parity check, and the substitution
   is deliberate.** Round 9 Phase 2 found the local and remote ledgers
   disagreeing silently, which replayed two already-applied migrations.
   A direct ledger-parity assertion was costed and is **not cheap**:
   PostgREST does not expose the `supabase_migrations` schema (`Invalid
   schema: supabase_migrations`, confirmed directly), and no
   arbitrary-SQL RPC exists, so `test:db`'s documented credentials
   (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`) cannot read it at all.
   Reaching it needs either a new `public` view or `SECURITY DEFINER`
   function exposing the ledger, which is a schema change and an API
   surface widening made to serve a test, or shelling out to
   `npx supabase migration list`, which adds a CLI dependency and a
   third credential to a suite deliberately scoped to two. **Recorded as
   a candidate rather than built.**

   The duplicate invariant costs one query per table and catches the
   damage the ledger drift actually causes, whatever the cause, using
   only the credentials the suite already has. Architecture rule 7 in
   `CLAUDE.md` addresses the cause.

   **Candidate, declined here with the measured reason recorded:
   an invariant asserting that the local and remote migration ledgers
   agree.** Declined on cost, not on value. The cost was measured, not
   estimated: `db.schema('supabase_migrations')` returns `Invalid schema:
   supabase_migrations`, and no arbitrary-SQL RPC exists, so the
   credentials `test:db` documents (`SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`) cannot read the ledger at all. Building it
   requires one of two things, and both are larger than the check:
   **a new `public` view or `SECURITY DEFINER` function** exposing the
   ledger, which is a schema change and a widening of the API surface
   made to serve a test; or **shelling out to `npx supabase migration
   list`**, which adds a CLI dependency and a third credential to a suite
   deliberately scoped to two so it can stay runnable on a clean
   checkout. Worth revisiting only if ledger drift recurs, or if
   something else independently justifies exposing the ledger.

**Test evidence required:** `npm test` and `npm run test:db` both passing,
output pasted in full. For each of the three new invariants, deliberately
inject a real violating row, show the assertion failing and naming the
exact offending row, then revert. An invariant not proven capable of
failing is not evidence.

---

## Phase 8: Full lifecycle walkthrough, Qualification to Closed

**This is the actual deliverable of the round.** Everything above is
configuration and layout. This is the proof that what has been configured
is a workflow a person can complete.

Drive one real Test Bed from Qualification to Closed **through the real
browser UI**, not through API calls, satisfying every gate the way an
operator would. Seven transitions, in order.

At each transition record:

| What to record | Why |
|---|---|
| The exit criteria list before satisfying anything | Confirms the tick list is real and legible |
| The Confirm control rendering for each required document | The `document_status` affordance, provable only in the browser |
| Each approval tick and the resulting criteria state | Confirms tracks are independent and unordered |
| The transition succeeding and the status genuinely changing | Confirmed by direct query, not by the UI's silence |

Then three checks on the completed record:

1. **The audit trail reads coherently end to end.** All seven transitions
   in `audit_log` with real actors and timestamps, in order.
2. **Every approval carries a non-null `stage`.** Any null means a rule was
   written without `scope: "stage"` and the walkthrough succeeded by
   accident.
3. **Report the real click count for the full lifecycle.** Not a quality
   gate, an input to a business decision. Nineteen approval ticks sit
   across this lifecycle, all made by one person while entitlement is
   unenforced. If that number is high enough to be worth revisiting, it is
   a row edit rather than a rebuild, and the business should see the figure
   before deciding.

**Test evidence required:** screenshots at each of the seven transitions,
direct query output for the three checks above, and an explicit statement
of anything that blocked, confused or needed a workaround during the
walkthrough, recorded even where it falls outside this round's scope. A
workflow driven end to end once by the person who configured it is the
cheapest opportunity this project will get to find out what is wrong with
it.

---

## Phase 9: Regenerate the state file and make it a standing rule

Re-run `scripts/state-dump.mjs` and commit the regenerated
`CURRENT_STATE.md`. This is the first time the generator is exercised
across a large configuration change, which is the only thing that proves it
reflects reality rather than the moment it was written.

1. **Diff it against the Phase 0 output and confirm the diff is exactly
   what this round did**, item by item.

   **Known item to reconcile, recorded now so it does not read as
   unexplained.** `TT-SGP-AIRPRT-005` is a diagnostic stray: it was
   created through the real `create-test-bed` endpoint while debugging a
   failing Phase 4A script, and soft deleted immediately once identified.
   It accounts for one increment of the `SGP-AIRPRT` counter and one
   soft-deleted `test_bed` row that no phase's own work produced.
   `TT-SGP-AIRPRT-006` is the Phase 4A adjacency probe, also created
   through the real endpoint and soft deleted at the end of that phase,
   and accounts for a second increment and a second soft-deleted row. Every new gate rule, every document
   catalogue change, the deleted `Senior` rule, the new criteria fields. A
   difference that no phase in this brief accounts for is a finding, not
   noise, and must be reported rather than absorbed.
2. **Confirm nothing in it is stale.** If any figure disagrees with what
   the phase reports claimed, the phase report was wrong, not the
   generator. That asymmetry is the whole point of building it.
3. **Add a standing entry to `DESIGN_PRINCIPLES.md`** establishing this as
   permanent practice, in the same shape as the other standing rules
   already in that document:

   > Every round ends by regenerating `CURRENT_STATE.md` and committing it.
   > It is generated, never hand written, and records what is configured,
   > never why. Reasoning stays in `DESIGN_PRINCIPLES.md`, prototype
   > extraction stays in `PROTOTYPE_SPECIFICATION.md`. Its diff between
   > rounds is the configuration changelog. It carries no secrets and no
   > client-identifying data, because it is uploaded into chat sessions
   > where design work happens away from the repo. A round is not complete
   > until it has been regenerated and its diff reconciled against that
   > round's own phase list.

4. **Add the reciprocal check to the automated suite** if it can be done
   cheaply: fail the build when `CURRENT_STATE.md`'s recorded commit SHA
   is **not an ancestor of HEAD, or when a tracked configuration source
   has changed since that commit.** Report the cost before building it.
   If it is more than trivial, record it as a candidate rather than doing
   it here, since the standing rule above already covers the discipline
   and this only covers the forgetting.

   **Reworded 2026-08-19, after Round 9 Phase 2.** This item originally
   said "is not the current HEAD", and that check can never pass. A
   generated file records the commit it was generated at, and it is then
   committed, so the commit containing it is always later than the one it
   names. `CURRENT_STATE.md` was stale by its own rule the moment it was
   first committed. Ancestry plus an unchanged-sources test is the check
   that actually expresses the intent: the file was generated from a
   state this branch still contains, and nothing it reports has moved
   since.

**Test evidence required:** the committed file, the full diff against the
Phase 0 output, and an explicit line-by-line reconciliation of that diff
against this brief's own phase list. Confirm the file contains no
environment variable, key, token, client name or reference code, by direct
inspection, not by assertion that the generator was written not to include
them.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` the moment a decision in this brief changes
during the build. Six things need recording precisely regardless of
outcome:

- **The standing `CURRENT_STATE.md` rule from Phase 9.3**, and the
  three-way separation it completes: what is configured, why it was
  decided, and what the prototype actually does.

- **The three supersessions in Phase 2.2**, each with the superseded
  reasoning left visible rather than deleted.
- **Section 8's per-stage gate table rewritten to describe what is actually
  configured**, not what was intended. This round is the first time the two
  can genuinely be reconciled.
- **The Round 7 Phase 7 mislabelling**, if Phase 0 item 4 confirms it. A
  display rename that attached a customer-facing name to Terminus's own
  document list is worth recording alongside the existing entry about
  documents that describe controls which do not exist.
- **The Phase 0 finding on `Senior`**, whichever way it resolves.
- **The Exit Criteria mechanism**, specifically the decision to reuse
  `payload_field_required` with a timestamp rather than build a new
  requirement type or store a boolean, and the reasoning. Round 5's Exit
  Criteria work and Round 7's approval scoping were both recorded at this
  level of precision and this is the same category of change.

Before declaring this round complete, check the phase count against this
document's own list with `grep -n "^## Phase"`. Rounds 3 and 5 both
recorded a premature completion claim caught only by doing exactly that.
