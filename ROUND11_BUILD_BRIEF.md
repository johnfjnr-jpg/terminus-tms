# Round 11 build brief: qualification scoring, Installer and Tech Team, Customer Documents

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND9_BUILD_BRIEF.md`, `ROUND10_BUILD_BRIEF.md`. Read all seven before
starting.

This round adds the first mechanism in this system that captures
**judgement** rather than fact. Everything built so far records what
happened. Scoring records what someone thought, why, and when they changed
their mind.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Scope boundaries, confirmed with the business

- **No thresholds anywhere.** A score must be recorded to pass a gate. No
  minimum value blocks anything. Two completed Test Beds is not evidence
  about which scores predict good outcomes, and a floor set today encodes a
  guess as a rule. Data Rights is recorded as the first floor candidate
  once there is evidence.
- **Anchor wording is provisional and stored as data.** The business will
  review it. Review must change rows, never a build.
- **Record history is Round 12.** Scoring produces history in this round.
  Field-change trail and criterion authorship surfaced from `audit_log`
  come next, and Round 12 must not fork what this round builds. Phase 2's
  storage shape is therefore designed to be the general one, not a
  scoring-specific one.
- **Use Case Taxonomy is Round 13.** Use Cases stay free text this round.
  The Clear Use Case Requirements and Metrics criterion scores against free
  text today and against a selected taxonomy entry later, with no rework to
  the scoring mechanism.
- **Google Drive is Round 14.** Customer Documents ships here as a pasted
  URL, which needs no Workspace decision, no service account and no folder
  structure.
- **Approval entitlement stays unenforced**, unchanged since Round 7.

---

## Standing rules that bear on this round

`CLAUDE.md` applies in full. Four items bear directly:

1. **Architecture rule 8.** A path correct for every caller that exists can
   be wrong for the one about to be built. This round adds new writers to
   `record_revisions` and new consumers of `audit_log`. Three instances are
   already recorded.
2. **Verification rule 7, the counterfactual form.** State what the
   condition would look like if the action had not happened, and check it
   differs. Eight faults in Round 10, four written in or after the phase
   that promoted the rule.
3. **Data-driven, not hardcoded.** Every criterion, its anchors, and which
   stages permit a re-score are rows. Nothing about the framework's content
   lives in code.
4. **Extend the generic engine, never fork it.** Scores are payload,
   gates are `stage_gate_rules`, history is the existing append-only
   pattern. If a phase appears to need a new table, stop and report before
   creating one.

---

## Amendments after Phase 0

Phase 0 returned six findings against this brief, three of which change what
a later phase can do. All six are amended in place below, marked **AMENDED
after Phase 0** at the point they apply, rather than collected as errata,
because a correction read separately from the instruction it corrects is a
correction that gets missed. Indexed here so they are discoverable.

| # | Where | What changed |
|---|---|---|
| 1 | 1.1, 4.1, 4.2 | Data and Use Case **splits**, it is not a rename. Four criteria become five. Canonical name is "Clear Use Case Requirements and Metrics" in full |
| 2 | 4.1.1 | `[]` passes the gate today. Extend `requirement_detail` with a **length clause**, written generally. Not a new `requirement_type`, not key-absence |
| 3 | Phase 3 | Share the **interaction**, not the storage. The reason writes to the score entry. Opportunity's note storage is untouched |
| 4 | Phase 6 | An explicit **discriminator** is required. Absence-based exclusion is what Round 10 Phase 7 refused to trust |
| 5 | Phase 2 | The score **author is written server-side**, a deliberate departure from the notes pattern |
| 6 | Phase 0 item 6, Phase 5 | `POST /test-beds/:id/buyer-contacts` **rejects a foreign Account with 422** and cannot be reused. The Opportunity Account picker has not existed since Round 3 |

**Three of these are premise corrections rather than refinements**, in the
sense the standing entry names: the brief stated something confidently that
the code does not do. That is now the fourth consecutive round in which the
investigate-first phase has paid for itself, and it is recorded here rather
than only in the close-out so the pattern stays visible while the round is
being built rather than after.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts. Direct reads of real code and real data.

1. **The five existing criterion rules.** `CURRENT_STATE.md` records 8
   `payload_field_required` rules on `test_bed`. Report all eight, which
   are the Round 9 criteria and which are the original date and duration
   fields, and their exact `requirement_detail` shape including `label`.

2. **`TB_EXIT_CRITERION_KEYS` and the tick mechanism.** Report the exact
   keys, how a tick is stored, how untick removes it, and how
   `renderTbStageExitCriteria` decides a row is tickable. Round 10's
   constraint was two conditions: the field is in `TB_EXIT_CRITERION_KEYS`
   **and** it carries a `label`. Confirm that is what the code does.

3. **How `payload_field_required` evaluates.** Round 9 Phase 0 established
   it blocks only on `undefined`, `null` and `''`, so a boolean `false`
   passes. Re-confirm against current code, because Phase 1 depends on it
   and a score of 0 does not exist but a stored `0` might.

4. **The notes append pattern.** `addTbNote` prepends to a JSONB array of
   `{text, at, by}`. Report the exact shape, who writes `by`, and whether
   anything else in the codebase already stores an append-only series in
   payload. Phase 2 should reuse this, not invent a parallel shape.

5. **The Est. Close Date reason mechanism.** Opportunity has a
   mandatory-reason dialogue and a moves counter, built Round 3 Phase 3,
   fired automatically when a real change to that field is detected at save
   time. Report how it works, where the reason is stored, and whether it
   can be generalised. Phase 3 needs the same behaviour and must not build
   a second one.

6. **Account and Contact linking mechanisms.** Report how Test Bed's buyer
   roles resolve a Contact filtered to the record's own Account
   (`record_contacts`, `contact_role_linked`). Phase 5 needs a Contact
   filtered to a **different** Account than the Test Bed's own, which is a
   variation the existing mechanism does not support.

   **AMENDED after Phase 0: this item originally also asked how
   "Opportunity's Account picker" works. There has been no Opportunity
   Account picker since Round 3**, which made the field read-only and
   inherited from the originating Contact and removed the linking panel
   entirely; it renders today as `refReadonlyRow('Account', ...)` in
   `frontend/opportunity-reference.js`. The only live Account picker in the
   app is Contact detail's own. The premise is struck rather than silently
   dropped, because it is the fourth time in three rounds that a brief has
   stated a mechanism the code no longer has, and the standing entry on that
   pattern is the reason each one gets recorded.

7. **The document child record shape.** `POST /test-beds/:id/complete-document`
   creates a `document` record with a variant and optionally a
   `document_details` URL. Report the full shape. Phase 6 needs
   client-supplied documents that are **not** stage documents and gate
   nothing, and must not collide with `completable_documents` or any
   `document_status` rule.

8. **Baseline the suite.** `npm test` and `npm run test:db` passing on a
   clean checkout before anything is touched.

---

## Phase 1: The scoring model, as data

**Build the tables and the seed rows. No UI, no gates yet.**

### 1.1 The five criteria

Confirmed with the business. Names are final; anchor wording is
provisional and will be revised in review.

| Criterion | Asks | Re-scoreable |
|---|---|---|
| Rollout Path | Does a route to deployment exist | Not yet |
| Client Commitment | Will the client organisation genuinely engage | Not yet |
| Clear Use Case Requirements and Metrics | Can it be proven | **Through Monitoring and Analysis** |
| Physical Suitability | Can it be installed | **Re-scored at Site Assessment** |
| Data Rights | Is it worth doing for Terminus | **Re-scored at Site Assessment** |

**AMENDED after Phase 0. This was written as "two renames from the Round 9
keys" and that was wrong: there are four existing Qualification criteria and
five new ones, so one of them SPLITS.** The original wording is corrected
here rather than annotated, because a rename and a split need different work
and the difference is invisible once the rows exist.

**Two renames**, confirmed with the business:

- `exitQualPartnerCommitment` becomes **Client Commitment**
- `exitQualTechnicalCommercialValue`, Technical and Commercial Value, becomes
  **Rollout Path**

**One split, and one retirement.** `exitQualDataAndUseCase`, "Data and Use
Case", **retires**. It is not renamed to either successor, because it asked
two questions at once and the framework now asks them separately:

- **Clear Use Case Requirements and Metrics**, a new key. Can it be proven.
- **Data Rights**, a new key. Is it worth doing for Terminus.

**One unchanged**: Physical Suitability keeps its key and its name.

So Qualification goes from **four** criteria to **five**, not four renamed to
four. Phase 4.1 is corrected to match.

**The canonical name is "Clear Use Case Requirements and Metrics", in full,
everywhere.** Section 4.2 originally used the short form "Use Case
Requirements and Metrics"; that is wrong and is corrected. This project has
already given one artefact three names across three rounds and recorded the
result as three chances to configure a gate that can never be satisfied. A
criterion name is written into `stage_gate_rules.requirement_detail.label`,
into the criteria table, and into every anchor row, with nothing in the
schema aligning them, which is the identical exposure.

Both fixture records carrying the old keys are test data. Rename in all
three places: `TB_EXIT_CRITERION_KEYS`, the gate rule's
`requirement_detail`, and the label. A misleading key outlives its label.
For the retired key, retire it in all three places too, rather than leaving
`exitQualDataAndUseCase` in `TB_EXIT_CRITERION_KEYS` where it would render a
tick box for a criterion that no longer exists.

### 1.2 Anchors as rows

Each criterion carries anchored wording for **1, 3 and 5 only**. 2 and 4
are "between these". Five full descriptions per criterion is more than
anyone reads.

Anchors describe **what is observably true**, never how the scorer feels. A
good anchor can be checked by asking a question with a yes or no answer. A
bad one cannot be coached and cannot be wrong.

The confirmed wording is in the appendix at the end of this brief. Seed it
as rows. **Do not hardcode any of it.**

### 1.3 Anchor versioning, and why it is not optional

Every recorded score stores **which version of the anchors it was made
against**.

Without it, rewriting an anchor in six months silently changes the meaning
of every historical score, and comparison across time becomes worthless
without anyone noticing. With it, the business can say "under the current
definition that would have scored a 2."

This is the same discipline as immutable approved snapshots, applied to
judgement rather than to money. It is the difference between a framework
that improves and one that merely persists.

**Test evidence required:** report the schema and the seeded rows. Confirm
an anchor's wording can be changed without altering any historical score's
meaning, demonstrated by recording a score, changing the anchor, and
showing the score still resolves to the wording it was made against.

---

## Phase 2: Scores, stored as an append-only series

**Every score is a new entry. Nothing is ever overwritten.**

A 3 at qualification revised to a 4 after site assessment is useful. A 3
overwritten by a 1 when someone finally visits and finds no power at the
mounting positions is the single most valuable data point this framework
will produce, and overwriting destroys it.

Each entry carries:

| Field | Note |
|---|---|
| criterion | |
| score | 1 to 5 |
| comment | **Mandatory at 1 or 2**, naming what is missing |
| reason for change | **Mandatory on any entry after the first** |
| author | **Written server-side.** See below |
| timestamp | |
| anchor version | Per 1.3 |

Reuse the notes append pattern from Phase 0 item 4. Do not invent a
parallel shape. **Round 12 generalises this**, so build the shape that
generalises rather than the shape that is quickest here.

**AMENDED after Phase 0: one deliberate departure from the notes pattern.
The author is written server-side, from `request.user`, not client-side from
the session.** Every notes writer in the frontend sets
`by: currentSession?.user?.email ?? ''`, so the author is **client-supplied
and unverified**. One server-side counterexample already exists,
`src/routes/contacts.js:186` writing `by: request.user.email`, so both
conventions are already in the codebase and this is choosing the stronger
one rather than inventing a third.

**Why the departure is worth making here specifically.** A note records that
somebody said something. **A score records a judgement somebody is
answerable for**, and it is the input to a gate. This system already
distinguishes attribution from entitlement and has recorded plainly that an
approval proves a tick happened and who made it, not that the entitled
person made it. What makes even that half trustworthy is the
`approvals_insert` RLS policy, `with check (auth.uid() = approver_id)`, so an
approval cannot be forged in another person's name. **A payload key has no
equivalent check.** `record_revisions` RLS constrains who may write a
revision, not what a JSON field inside it claims, so a client-supplied
`by` on a score entry is an assertion the database never tests.

Writing it server-side costs nothing and closes that gap at the point the
first judgement is recorded, rather than after a round of scores exists
carrying authors nothing ever verified. **Do not retrofit the notes writers
in this round**; they are out of scope, and the inconsistency is recorded
here rather than fixed in passing.

**The panel shows the current value. The history is reachable**, same
pattern as Notes' two-most-recent default with expansion, built Round 8
Phase 5 and corrected in Round 10 Phase 2 after it was found showing the
two oldest.

**Test evidence required:** record a score, revise it, and confirm both
entries survive with correct authors, timestamps and anchor versions,
verified server-side. Confirm a 1 or 2 without a comment is rejected, and
that the rejection is server-side, not only in the browser. Confirm a
revision without a reason is rejected. Confirm the panel shows the current
value and that history expands to the genuine full series, verified against
a direct query rather than a visual count.

---

## Phase 3: The reason-for-change dialogue

A revised score requires a reason. Confirmed with the business.

**Do not build a second mechanism.** Opportunity's Est. Close Date already
has exactly this: a mandatory-reason dialogue plus a moves counter, fired
automatically when a real change to that field is detected at save time,
not from a separate entry point.

**AMENDED after Phase 0. This section originally read "if it generalises,
extend it", which framed the answer as one decision. It is two, and they go
opposite ways.**

**Share the interaction. Do not share the storage.**

**What generalises, and it is the harder half.** `saveRefFields()` finds the
changed field among the dirty entries at Save, opens the dialogue, **holds
every other dirty field**, and saves them together once the reason is
confirmed. Round 3 Phase 3 proved the load-bearing property empirically
rather than by reasoning: cancelling the dialogue does not discard an
unrelated dirty field edited in the same batch. That is the part worth
reusing, and `saveTbFields()` already has a structurally identical
interception point, the `initialLead` freshness check, so the hook has a
proven home rather than a speculative one.

**What does not generalise: where the reason goes.** Opportunity writes it
into `payload.notes` as prose, prefixed with the from and to values, and
bumps a `closeMoves` counter. **This brief's own test evidence requires the
opposite**, that the reason is stored on the entry and not in a note, so the
existing storage is not merely Opportunity-specific, it is the thing this
phase must not copy. **The reason writes to the score entry.**

**Do not change Opportunity's note storage.** It is correct for what it
records, nothing in this round consumes it, and rewriting a working
mechanism to look like a new one is scope this round has not been given.
Two storage targets behind one interaction is one mechanism, not two.

Two independent implementations of "require a reason when this specific
field changes" is still the shape that produced the duplicated notes
renderers found in Round 10 Phase 2, which is why the interaction is shared.
Report the extraction boundary before building it.

**Test evidence required:** confirm the dialogue fires on a genuine score
change and not on an unrelated save. Confirm cancelling it discards the
score change and does not discard unrelated dirty fields, which is the
specific behaviour Round 3 Phase 3 proved empirically for Est. Close Date.
Confirm the reason is stored on the entry, not in a note.

---

## Phase 4: Gates, and the measurability confirmation

### 4.1 Scores replace ticks

**AMENDED after Phase 0: five criteria, not four.** This section originally
read "the four Qualification criteria", which contradicted 1.1's own list of
five. The count follows from 1.1's split: `exitQualDataAndUseCase` retires
and two criteria replace it.

**Transition 1, Qualification to Pre-Site Assessment, carries six labelled
`payload_field_required` rules** once this phase lands: the five criteria of
1.1, plus the measurability confirmation of 4.3. It carries four labelled
rules today. The three unlabelled date and duration rules
(`testBedDuration`, `estimatedInstallationDate`, `estGoLiveDate`) are
unchanged and are not criteria; Phase 0 item 1 confirmed they carry no
`label`, which is what keeps them out of the tick list.

The gate requires **a score to exist**, not a particular value.
`payload_field_required` continues to be the mechanism.

**4.1.1 The length clause, and it is a general engine change rather than a
scoring one.** Phase 0 item 3 exercised the real evaluator against a real
record and found it more permissive than this brief assumed:

    undefined  blocks      false  PASSES      []  PASSES
    null       blocks      0      PASSES      {}  PASSES
    ''         blocks      '0'    PASSES

The brief anticipated the stored `0`. **The consequential one is `[]`.** A
score series is an array, so the empty series is its natural initial state,
and `met: !(value === undefined || value === null || value === '')` treats an
empty array as present. **An empty series opens the gate today.**

**Extend `requirement_detail` with a length clause. Do not add a new
`requirement_type`, and do not rely on the key being absent.** Absence was
considered and rejected: it makes correctness depend on no renderer, no
migration and no future write path ever initialising the key to `[]`, which
is **a discipline rather than a property**, and this project has recorded
what happens when a guarantee rests on every future caller behaving. The
same reasoning that made `child_record_status` worth building rather than
leaving implicit applies here.

**Write it generally.** The clause is not about scores: **any payload field
holding a series will want non-empty to mean non-empty.** So it belongs on
the existing `payload_field_required` branch, expressed in terms of the
stored value's length, not in terms of what a score is. A rule carrying no
length clause must behave exactly as it does today, so every one of the 15
`contact` rules and the 8 existing `test_bed` rules is unaffected by
construction rather than by inspection.

**Prove the empty case blocks, do not reason about it**, and prove the
unchanged case too: per Verification rule 9, inject a real violating value,
watch the gate block, then revert. The counterfactual for this one is
concrete: if the clause were not being read at all, `[]` would pass and the
test would look identical to a correctly configured rule that happens to
have a score in it.

### 4.2 Re-score gates

Per 1.1, three criteria are re-scoreable and the re-score must be genuinely
required at the later gate, not merely permitted:

| Transition | Requires |
|---|---|
| 3. Site Assessment to Installation | A **Data Rights** score recorded at or after Site Assessment |
| 3. Site Assessment to Installation | A **Physical Suitability** score recorded at or after Site Assessment |
| 5. Monitoring to Review and Completion | A **Clear Use Case Requirements and Metrics** score recorded at or after Monitoring |

A stale qualification guess must not carry unchallenged into installation.
Physical Suitability in particular exists to catch the site problem that is
invisible at qualification and fatal on install day.

### 4.3 The measurability confirmation

Confirmed with the business as a separate plain yes or no, not folded into
the 1 to 5: **can the proposed sensors capture what would be measured?**

Either they can or they cannot. A 3 is not a meaningful answer, which is
why it is not scored.

It is recorded with an author, because it is a technical judgement and it
is currently the only technical judgement recorded anywhere before
commitment. Entitlement is out of scope, consistent with everything else.

Gate it on transition 1 alongside the four criteria.

**Test evidence required:** confirm each gate blocks with no score and
releases with one, proven against the real transition endpoint rather than
the read-only one. Confirm a qualification-stage Data Rights score does
**not** satisfy the Site Assessment gate. Confirm the measurability
confirmation blocks transition 1 when absent. Report the measured
`stage_gate_rules` count after each transition's rows land, from the
baseline `CURRENT_STATE.md` reports rather than from any number in this
brief.

---

## Phase 5: Installer and Test Bed Tech Team

Confirmed with the business.

- **Installer is a link to an Account.** Where the client installs with
  their own staff, that is the Test Bed's own Account. Where a Terminus
  contractor installs, it is that contractor's Account. **No picklist.**
  Client-installed versus contractor-installed becomes an observable fact:
  is the Installer Account the same as the Test Bed's Account or not.
- **Test Bed Tech Team is a single Contact from the Installer's Account.**

Both gate the exit from Installation and Commissioning. An installation
cannot be complete without recording who did it.

**Two things to handle rather than discover:**

1. **The Contact filter sources from a different Account than the record's
   own. AMENDED after Phase 0: this is settled, and the answer is worse than
   "assumes it".** The existing mechanism does not take the Account as a
   parameter and **the server actively rejects the case this phase needs.**

   **Frontend:** `renderTbBuyerRows()` takes no parameter at all. It reads
   `tbBed.account_id` from module state, filters `GET /api/contacts`
   client-side on `parent_record_id === tbBed.account_id`, and caches the
   result in a single-slot module variable, `tbAccountContacts`, cleared only
   on record load. Three separate places assume the record's own Account.

   **Server:** `POST /test-beds/:id/buyer-contacts` returns **422, "Contact
   is not linked to this Test Bed's Account"**, whenever
   `contact.parent_record_id !== bed.account_id`. That check is correct for
   buyer roles, which is exactly why it must not be loosened: it is what
   makes the three `contact_role_linked` gates on transition 1 mean
   something.

   **So Phase 5 cannot reuse that endpoint.** Build the Tech Team link on its
   own path that takes the source Account explicitly, and leave the buyer
   endpoint's Account check exactly as it is. Report the shape before
   building it. Note also that `GET /api/contacts` accepts **no query
   parameters**, so any server-side filtering is a new capability rather than
   a parameter that already exists.

2. **A contractor not yet in the system cannot be selected.** Report what
   happens today and whether the create-new path used elsewhere for
   Accounts applies here. **AMENDED after Phase 0: the create-new path that
   exists is `POST /contacts/:id/link-account`, which accepts
   `new_account_name`, and it hangs off a Contact rather than a Test Bed**,
   so it does not apply directly and a new entry point is needed either way.
   Contractors are Accounts; an Account is an
   organisation Terminus has a relationship with, and the model has no
   reason to distinguish customer from supplier. Note that this begins the
   evidence trail for ISO 9001 Clause 8.4 on externally provided processes,
   which is context rather than scope.

3. **Installer and Test Bed Tech Team are plain free-text payload keys
   today**, `TB_INSTALL_FIELDS` in `frontend/test-bed-detail.js`, both
   already in `TEST_BED_WRITABLE_KEYS`, rendered through the ordinary
   click-to-edit row on the Installation and Commissioning stage tab. So
   this phase converts two existing free-text fields into real links, and
   whatever either currently holds on a live record has to be surveyed
   before the conversion, not after, per the Round 10 Phase 3 picklist
   hazard: a control whose stored value is outside its new vocabulary
   silently clears on the next save.

**Test evidence required:** set Installer to the Test Bed's own Account and
to a different Account, and confirm both persist. Confirm the Tech Team
dropdown offers only Contacts of the Installer's Account, proven with an
Account carrying Contacts that must not appear. Confirm changing the
Installer after a Tech Team is set behaves sensibly, and report what it
does rather than assuming it is correct. Confirm both gates block and
release.

---

## Phase 6: Customer Documents, URL version

Client-supplied reference material: site drawings, QHSE guidelines,
anything Terminus needs from the client's side. **Requested three times by
the business.**

**Placement, per the business:** on the Reference tab, to the right of
Terminus Details and below the Customer Details, Site Details and Key Dates
panels.

**This version is a pasted URL, not a browser upload.** Add Document takes
a name and a link. No Google Workspace decision, no service account, no
folder structure. Round 14 replaces the paste with a real upload and must
not need to change the record structure to do it.

Three constraints:

1. **These are not stage documents and gate nothing.** They must not appear
   in `completable_documents`, must not be matched by any `document_status`
   rule, and must not appear in the Closed lifecycle panel built in Round
   10 Phase 7, which is the record of Terminus's own documents.
2. **Not stage-scoped.** They belong to the Test Bed, not to a stage.
3. **Reuse the existing document child record shape** if Phase 0 item 7
   shows it fits. **AMENDED after Phase 0: it fits, but "a variant that no
   gate rule names" is NOT sufficient, and constraint 1 is not satisfiable
   that way.**

   Two thirds of constraint 1 do hold by construction, and Phase 0 confirmed
   both against the real code. `completable_documents` is derived from
   `stage_gate_rules` rows of type `document_status`, so a variant no rule
   names can never appear in it. The `document_status` branch matches on
   `variant` plus `status`, so the same variant can never satisfy a gate.

   **The Closed lifecycle panel is the exception, and it is deliberate.**
   `GET /test-beds/:id/lifecycle-documents` selects **every**
   `record_type = 'document'` child of the Test Bed, and any whose variant is
   absent from `stage_reference_docs` is surfaced under a group headed **"Not
   in the stage catalogue"**. Round 10 Phase 7 built that on purpose, as
   union-not-intersection, precisely because the two tables hold document
   names as independent free strings and a document the record genuinely
   holds must never be silently dropped from its own history.

   **So Customer Documents built on this shape would appear in the Closed
   panel under that heading**, which constraint 1 forbids.

   **Phase 6 gets an explicit discriminator.** Excluding them by absence,
   that is by their variant not appearing in a catalogue, is exactly the
   inference Round 10 Phase 7 refused to trust, and inverting it here would
   make the Closed panel's honesty depend on a name never colliding.
   **Report the discriminator's shape before building it**, per standing
   rule 4. Whatever it is, it must be something both the Customer Documents
   query and `lifecycle-documents` read positively, so each says what it
   means rather than what it is not.

   Two further facts from Phase 0 that bear on the shape.
   `lifecycle-documents` keys its children map by `variant`, so two documents
   sharing a name collide and the last wins. And `complete-document` looks up
   the existing child with `.maybeSingle()` on
   `(parent_record_id, record_type, variant)`, which **errors** rather than
   misbehaving quietly if two ever match. Customer Documents are named by a
   person, so name collision is a realistic input rather than a theoretical
   one, and neither of those two behaviours is acceptable for this panel.

**Test evidence required:** add two documents with names and URLs, confirm
both persist server-side and survive a reload. Confirm they appear nowhere
in `completable_documents`, nowhere in any stage tab, and nowhere in the
Closed lifecycle panel, checked directly rather than assumed. Confirm the
panel renders in the specified position at 1240px, 1920px and 3440px,
container measured not element, and open the screenshots.

---

## Phase 7: Invariants

Extend `config-invariants.test.mjs`.

1. **Every criterion referenced by a gate rule exists in the criteria
   table**, and its anchors exist. The same shape as the existing document
   invariant, which closed the gap where two tables held names as
   independent free strings.
2. **Every stored score references an anchor version that exists and that
   carries a complete anchor set for that criterion.** An orphaned version
   means a historical score has no definition.

   **AMENDED during Phase 1, before the invariant was written, because the
   obvious phrasing fails on legitimate data.** "References an anchor row"
   would be wrong: anchors exist for **1, 3 and 5 only**, and 2 and 4 are
   deliberately "between these", so a genuine score of 2 has a version but no
   row of its own and would be reported as an orphan on every single
   occurrence. **The referent is the version, not the row.** Complete means
   the version carries the full set of anchors that criterion defines, so a
   half-inserted version is caught rather than silently accepted as a
   definition a score can point at.
3. **The rule count assertion updates to the measured figure**, scoped to
   `record_type = 'test_bed'` explicitly, per Round 9's precedent.
4. **ADDED during Phase 2. Every custom property used in `style.css` is
   defined in it.** `grep -oE "var\(--[a-z-]+\)"` against the definitions
   list, as a test rather than a check someone remembers to run.

   **Round 10 Phase 7 found this exact fault, fixed its own block, and did
   not sweep the file.** `var(--line)` was already live in two places at
   that moment, introduced by `66f2aa6` in Round 9 Phase 6, so
   `.tb-doc-row` and `.tb-crit-row` have each carried a `border-bottom`
   that never rendered for two rounds. An undefined custom property fails
   at computed-value time and the declaration is silently dropped.

   **It was visible in screenshots throughout and nobody read it as a
   defect**, because rows running together looks like a design choice.
   Opening the screenshot catches what looks wrong; it does not catch what
   looks deliberate. **The remedy is the sweep, not a third individual
   fix**, and the two `var(--line)` declarations are corrected here rather
   than earlier, in the same phase that makes a third instance impossible.

   Scoped to this round rather than Round 12 deliberately: the check is
   small, this phase already extends the suite it belongs in, and deferring
   a known cheap check is what let the second instance ship.

For each new invariant, inject a real violating row, show it failing and
naming the offending row, then revert. An invariant not proven capable of
failing is not evidence.

---

## Phase 8: Score a real Test Bed, end to end

Drive one Test Bed from Qualification through Site Assessment in the
browser, scoring every criterion at qualification and re-scoring the three
re-scoreable ones at their later gates.

Then answer three questions with evidence:

1. **Can a person apply the anchors without hesitating?** Report every
   point where the anchor did not clearly determine a score. That is the
   feedback the business review needs, and it is only available from use.
2. **Does the history read as a record of changing judgement?** Show the
   full series for a criterion scored twice, with both reasons.
3. **What did it cost?** Report the added click count against Round 10's
   measured 47.

**Test evidence required:** the full score history by direct query,
screenshots of the panel at qualification and after re-scoring, and an
explicit list of anchors that proved ambiguous in use. **An anchor that
caused hesitation is a finding, not a failure**, and it is the main output
of this phase.

---

## Phase 9: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, and reconcile the diff line by
line against this brief's phase list. Account for every consumed reference
code and every probe record, as Round 10 did. A change no phase accounts
for is a finding.

Note that `stage_gate_rules` **will** move this round, unlike Round 10.
Report the measured figure and derive Phase 7's assertion from it.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **The two criterion renames**, with the old keys visible.
- **Anchor versioning**, and the reasoning: without it a wording change
  silently rewrites history.
- **Phase 8's ambiguous anchors**, verbatim. That list is the input to the
  business review and must not be paraphrased into something tidier.
- **Whether Phase 3 generalised the Est. Close Date mechanism or could
  not**, and why.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off before declaring the round complete.

---

## Appendix: confirmed anchor wording, provisional pending business review

Seed as rows. Scores 2 and 4 are "between these".

### Rollout Path

| | |
|---|---|
| **5** | A specific rollout is defined in scope and approximate scale. A budget route for it is identified and its holder known. A timeframe or trigger exists. The client has stated the Test Bed is the step toward that decision. |
| **3** | A rollout is discussed in general terms with no defined scope or scale. Budget is assumed to exist but its route is not identified. No timeframe beyond general intent. |
| **1** | No rollout has been discussed. The client's interest is exploratory or research-driven with no stated path to deployment. |

### Client Commitment

| | |
|---|---|
| **5** | A named executive sponsor with budget or site authority has personally attended a meeting. Site access dates are confirmed in writing. The client has named their own people and stated the time they will give. The Test Bed is known and supported beyond the sponsor within their organisation. |
| **3** | An engaged manager is driving it, but sponsorship above them is assumed rather than confirmed. Site access is agreed in principle with no dates in writing. Client resource is discussed but nobody is named. |
| **1** | One interested individual with no authority to commit site, people or data. No dates. No evidence anyone else in their organisation knows the Test Bed is proposed. |

**Note:** the Partnership and Test Bed Agreement is deliberately absent
from the 5 anchor. It is a Site Assessment document gating transition 3,
two stages after this score is taken, so requiring it would make 5
unreachable at scoring time and silently turn the scale into 1 to 4.

### Clear Use Case Requirements and Metrics

| | |
|---|---|
| **5** | The client has stated a specific question in their own operational terms. Terminus has identified what would be measured to answer it and confirmed the proposed sensors can capture it. Where a before-and-after comparison is needed, a baseline exists or can be captured before go live. |
| **3** | The use case is stated at a general level. What would be measured is understood by Terminus but not agreed with the client, or the baseline position is unclear. |
| **1** | Interest in the technology with no stated operational question. Nothing identified that would be measured, or the client's stated need cannot be answered by the sensors proposed. |

### Physical Suitability

| | |
|---|---|
| **5** | A Terminus technical person has assessed the site, in person or from client-supplied drawings and photographs. Mounting positions, power and connectivity are identified. Any access, permitting or safety requirements are known and confirmed achievable by the client. |
| **3** | The site is described and appears workable, but no Terminus technical assessment has taken place. Power or connectivity at the specific positions is assumed rather than confirmed. Access and permitting requirements are not yet established. |
| **1** | The site has not been described in any detail, or a known constraint exists that no proposed arrangement resolves. |

### Data Rights

| | |
|---|---|
| **5** | The client has confirmed Terminus may retain and use the data for product development, and the person confirming has authority to grant it. Any restrictions on use, retention or publication are stated and acceptable. Where personal data is involved, the client's own basis for sharing it is identified. |
| **3** | Data access is assumed by both parties but has not been discussed explicitly, or has been agreed by someone without authority to grant it. Restrictions are not yet established. |
| **1** | No data-use discussion has taken place, or the client has stated a restriction that prevents Terminus using the data for development. |

**Note:** restrictions are stated at any score, since "unrestricted" is
itself worth recording deliberately. Data Rights is the first candidate for
a minimum threshold once there is evidence, because a 1 means the Test Bed
cannot deliver its primary return to Terminus, and the programme is
cost-only with no client billing.
