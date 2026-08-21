# Round 18A fix brief: fixture removal, readable refusals, and the test that could not see them

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND18_BUILD_BRIEF.md`. Read all six before starting.

**Round 18 edited `CLAUDE.md`.** Build discipline gained rule 9 and
Verification gained rule 16. Re-read from disk and say whether the copy you
hold is current, rather than assuming either way.

A defect from business testing, on `main`. Editing the Summary on Test Bed
"21st Century Boy" failed with `new row violates row-level security policy for
table record_revisions`. **It was not a regression.** The record is a Round 9
test fixture that was never torn down, owned by the automation account, sitting
live in the business's working set. Open item 32's known-opaque failure met a
piece of residue eleven rounds old.

Three things are wrong and they are separable. This round fixes all three. A
fourth is named and deliberately not fixed.

Work through phases in order. Stop after each, report real test evidence, wait
for sign-off before starting the next. **Create the round branch before Phase 1
begins and commit at every phase boundary**, per Build discipline 9.

---

## Scope boundaries, confirmed with the business

- **None of the 26 records is wanted.** All five top-level records and their
  children are removed.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at 61
  total, 45 on `test_bed`.
- **No anchor wording changes.** The business review still has not happened.
- **The ownership model is not changed here.** See the closing section.

---

## Standing rules that bear on this round

1. **Verification 11: records are SOFT deleted, never hard.** `records` carries
   `ON DELETE RESTRICT` from `record_revisions`, `approvals` and `audit_log`, so
   a hard delete is blocked or orphans history. A
   `reference_number_counters` row is never deleted at all, so the two
   reference codes that die with these records are simply never reissued.

2. **Build discipline 8: fix the class, not the instance.** The reported
   failure was one route. Phase 0 found 45 write-adjacent sites returning a raw
   Postgres message and three that map `42501`, one of which is in the same file
   as the reported one.

3. **Verification 14: a check that passes when both sides are absent is not a
   check.** Phase 3's test must assert the read SUCCEEDS as well as the write
   being refused. A test asserting only refusal passes on a record nobody can
   see, which is the opposite of the bug.

4. **Verification 16: capture the run to a file, then search the file.** New in
   Round 18 and it has already paid twice.

---

## Phase 0: Investigate and report. No building.

Complete. Findings that change what follows:

- **The live set is 26 records, all owned by `john+test@`.** No probe user owns
  a single live record. Written to `scratchpad/r18a/live-set.json` so removal
  works from a list rather than a query run twice.
- **One of the 26 is an orphan**: a live document whose parent is already soft
  deleted. It is not a child of anything in the set and is reported separately.
- **A live, business-owned contact is linked to both fixture Test Beds.**
  "joane tester" holds **21 links, of which 6 are to LIVE business-owned Test
  Beds as Test Bed Tech Team**. Deleting `record_contacts` by contact would take
  those. **Delete selectively by fixture record id, never by contact.**
- **45 write-adjacent raw-error sites** across seven files, three existing
  `42501` handlers. The 45 came from a heuristic that caught only one of the
  three, so it is a working list and not a proven total.
- **The suite cannot see this class at all**: 50 database tests, every one
  running as the service-role client, which bypasses RLS entirely.

---

## Phase 1: Remove the 26

Work from `live-set.json`. Validate each id still exists, is still owned by a
target account and is still live, then act; that is checking the list, not
re-deriving it.

- **Records: soft deleted.** Never hard, per Verification 11.
- **`record_contacts`: hard deleted, selectively BY FIXTURE RECORD ID.** Never
  by contact. This is the one step where a wrong filter destroys business data.
- **`approvals`: hard deleted**, the harness's own convention, which Round 17A
  found ad-hoc teardown had been skipping.
- **`document_details`: hard deleted.**
- **`record_revisions` and `audit_log`: untouched.** History is not rewritten.
- **`reference_number_counters`: untouched.**

**Test evidence required:** the count removed, re-queried rather than inferred
from the delete's own result. The orphan document reported separately. **joane
tester's 6 live business links intact afterwards, asserted by count**, and her
7 fixture links gone. Zero live records owned by any target account.

---

## Phase 2: Readable refusals at every write-adjacent site

**Re-derive the list rather than inheriting 45.** The heuristic that produced it
caught one of the three existing handlers, so it will miss handled and unhandled
sites alike in unknown proportion.

A `42501` becomes a refusal a person can act on. It is not a server error and
must not be reported as one.

**Test evidence required:** every write-adjacent site enumerated by a method
that finds all three known handlers. The reported route returns a readable
refusal, proven by a real non-owner write rather than a simulated one. No route
returns a raw Postgres message on a `42501`.

---

## Phase 3: The test that can see it

Two probe users, both of which already exist. One `userClient(email)` helper in
the harness, minting a session with `generateLink` plus `verifyOtp`, which needs
only the service key already in `.env`.

**Its own file**, not `config-invariants.test.mjs`, given Round 18's
cross-file race between a global-invariant file and a fixture-creating one.

**Assert the refusal AND assert the read succeeds.** The read is what makes this
class invisible, and a test that only asserts refusal would pass against a
record that is simply absent.

**Test evidence required:** the test failing when the policy would allow the
write, proven by injecting a real violating case rather than asserting it.
Teardown by the same rules as everything else.

---

## Phase 4: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line. Live record
counts fall by 26, which is the first round in this project's history where
that number goes down.

`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.
`scoring_criteria` 5, `scoring_anchors` 15 at version 1 only.

Report whether the business exercised branch code mid-round, timestamped
against the branch's creation.

---

## Deferred, and why: reads are team-wide while writes are owner-only

**Recorded verbatim from the business.**

> Reads are team-wide while writes are owner-only, which is a single-user model
> nobody chose. It shipped in the initial schema and reads were widened four
> days later while writes were not. Terminus is a shared system and this will
> stop two people working on one Test Bed. That is a design decision for the
> business, not a fix.

Nothing in this round changes `records_update`, `record_revisions_insert` or any
other write policy. Phase 2 makes the refusal legible; it does not make it
happen less often. **Open item 32 stands and is now understood to be a symptom
of that model rather than a defect in a route.**

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **That live test fixtures reached the business's working set and stayed there
  for eleven rounds**, and what would have caught it.
- **Phase 1's selective-delete decision**, with the count of business links that
  a delete-by-contact would have destroyed.
- **That the suite could not see this class for two rounds while reporting
  green fifty times**, which is the sharpest thing this round has to say.
- **The deferred ownership question, verbatim**, as above.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm every
phase has an explicit sign-off. **No non-phase heading in this file may begin
with the word Phase**, per Round 17A's finding that a close-out heading inflated
the count the rule depends on.

---

## Round 18A outcome

Five phases, 0 through 4, confirmed by `grep -n "^## Phase\|^### Phase"`
returning 5 headings, with no `###` sub-phases and no non-phase heading
beginning with the word Phase. The wider `grep -n "^#\+ .*Phase"` returns the
same 5, so nothing in this close-out inflates the count. That check has now
caught its own author in two consecutive rounds, so no heading below contains
the word at all.

Phases 0 through 3 each carry an explicit sign-off in the session transcript.
Phase 4 is signed off by the message that commissioned this close-out, and this
report does not sign off its own phase.

Four commits at phase boundaries plus this one, per build discipline 9. The
branch carried its own scope from the start: the brief was committed before
anything was deleted, because this round removes production data and Round 10A
found the same gap when rule 7 had nothing to grep.

### A fixture from Round 9 lived in the business's working set for nine rounds

The defect that started this round was a permission error. What the
investigation found underneath it was 26 live records owned by an interactive
test account, sitting in the business's own list views, indistinguishable from
real data. The oldest dates to Round 9.

**They were not merely present. They were adopted.** Business users had opened
them, edited them and worked from them, and the record that produced the
reported error was one of them: "21st Century Boy", a Test Bed the business
believed was theirs and could not save. The permission error was not the fault.
It was the first symptom visible from outside of a fixture that had been taken
for real data for nine rounds.

Confirmed with the business that none of the 26 was wanted, then removed:
3 accounts, 2 contacts, 19 documents, 2 Test Beds, soft deleted per
Verification 11, with 9 `record_contacts`, 36 `approvals` and 1
`document_details` hard deleted by explicit row id. Contact links were deleted
by fixture record id and never by contact, because one contact held 6 live
links to business-owned Test Beds that deleting by contact would have taken.

### Residue made by one mechanism is invisible to a check phrased around another

Eighteen rounds of residue reports were true and missed all 26.

The standing residue questions were "are there live `harness_*` records" and
"are there live records owned by a probe user". Both are shaped around
`verify-harness.mjs`, which mints a synthetic `record_type` and owns its rows as
a probe user. **A browser session driven by an interactive test account produces
neither.** It signs in and calls the real API, so it leaves an ordinary record
with an ordinary reference code, owned by an account that is neither a probe
user nor the business. Every report that said "no residue" was answering the
question it was asked.

**The general form: a residue check phrased around one production mechanism
cannot see residue made by another.** The check names the mechanism it was
written against, and then reads as though it names the category. Verification 11
now asks the question that spans both: live records owned by any non-business
account, not only harness types and probe users. The account list is the input,
so the question is "which of these are real people", and everything else is
residue by definition.

### A policy that manifests two ways, one of which produces no error

The reported defect was one route surfacing a raw Postgres `42501` as a 500.
The obvious class is every site that handles that error, and sweeping for it
found 52 sites across 8 files, a different set from the 45 a pattern match had
counted, and produced a real fix.

**The actual class was every way the policy manifests, and the two are not the
same set.** `records_update` and `record_revisions_insert` are one ownership
rule enforced at two layers. Refused on an INSERT it raises `42501`. Refused on
an UPDATE it raises nothing at all: row-level security filters the row out of
the statement's scope, so the update succeeds against zero rows and returns no
error.

**A search for the error code cannot reach a silent zero-row success.** There
is no code to search for, no log line, no failure. Nine routes had already
detected the zero-row case independently and replied `403 "not permitted"`,
which means nine authors had each met this and handled it locally without
anyone noticing they were all handling the same policy as the defect being
reported. Nine independent local fixes to one thing is itself the signal, and
it was in the codebase in plain sight the whole time.

The question that reaches it: take the rule rather than the error, and ask what
it does to each verb it governs. One of those answers is usually "nothing
visible happens", and that is the branch no error-shaped search returns.

All 52 sites and all 10 zero-row checks now produce one sentence through
`src/lib/write-errors.js`: "This record belongs to another user. You can view
it, but only its owner can change it." One helper rather than a fourth bespoke
handler, and it lives where an error becomes a reply rather than inside the
writer, because 49 of the 52 sites never touch the writer at all.

### What the suite was blind to, as a number

**The suite could not see this class for two rounds while reporting green fifty
times.** Not because an assertion was missing, but because an actor was.

Every database-backed test in this project ran through `adminClient()`, which
holds the service key. Row-level security is never consulted for that client.
Adding ownership assertions to the existing files would have changed nothing:
they would have been asserted by a client for which the answer is always yes.

`scripts/tests/ownership.test.mjs` is the first test here that signs in as a
person, and it needed two of them, because one user cannot demonstrate a
boundary. Nine tests, 4.5 seconds, pinning both shapes, each refusal paired
with the owner doing the same write successfully so that neither the zero nor
the error code is an uncalibrated reading. The reads are asserted too: a test
that asserts only refusal passes just as well on a record nobody can see, which
is a different system with the same test results.

**Injection B is the measurement.** Putting the non-owner back on the service
key, which is exactly the state the suite was in for two rounds, turns **4 of
the 9 tests red**. That number is what the old suite was blind to, stated as a
count rather than as a claim. Two other injections were run and reverted: the
subject record owned by the writer turns 7 of 9 red, and `isRefusal` looking
for the wrong code turns 1 of 9 red.

**One limit, stated rather than dressed up.** The genuinely violating case for
the silent shape is widening `records_update` itself, and it could not be run:
there is no `psql` on this machine and no direct database URL, so the only
route would be a migration against the live database the business uses. The
injections alter the actor or the fixture, not the policy. They prove the
assertions move and that they read ownership rather than something adjacent.
They do not prove the file would catch a hand-edited policy.

Rate limits were measured rather than assumed, since that was the named risk:
30 consecutive `generateLink` calls and 12 consecutive full session pairs, zero
failures, roughly 190ms per session. `generateLink` returns the link to the
caller and dispatches no mail, so the email budget never applies. A suite run
needs two.

### Deferred, and recorded verbatim as commissioned

> Reads are team-wide while writes are owner-only, which is a single-user model
> nobody chose. It shipped in the initial schema and reads were widened four
> days later while writes were not. Terminus is a shared system and this will
> stop two people working on one Test Bed. That is a design decision for the
> business, not a fix.

This round makes the refusal readable and pins the boundary where it currently
sits. It does not move it. **If the business answers this by widening writes,
the new tests should fail**, and that expectation is written into the test
file's own header, so moving the boundary is a visible decision rather than a
silent one.

### `CLAUDE.md` was edited this round

Verification 11 gained the non-business-owner residue check. **The next session
must re-read the file from disk**; the copy delivered at session start is a
snapshot, and a session following a round that edited it receives the old
version.

### Reconciliation

`CURRENT_STATE.md` regenerated at `dd7459a`, working tree clean. Every changed
line is accounted for.

- **Live records 119 to 93.** Exactly the 26 removed, matching type for type:
  account 7 to 4, contact Qualified 9 to 7, document approved 80 to 61,
  test_bed Closed 7 to 5.
- **The business created nothing since the previous dump.** Zero live records
  with a `created_at` after it, so the whole live delta is this round's removal
  and nothing else.
- **Total rows 8316 to 8849, all 533 new rows soft deleted, none live.** 343
  `harness_*` fixture rows across 46 run tags, plus 190 real-typed fixture rows
  (153 unit, 36 document, 1 test_bed), from the suite runs and the owner-path
  check across phases 2 to 4. The single test_bed is the fixture the owner-path
  check created and tore down.
- **Distinct harness record types 486 to 532**, the same 46 run tags. They
  accumulate permanently by design.
- **Approvals 265 to 229**, exactly the 36 hard deleted with the 26, split
  Commercial 14, Legal 10, Technical 12. Fixture approvals net to zero because
  teardown hard deletes them.
- **`src/routes/accounts.js:13` to `:14` and `:14` to `:15`**, a one-line shift
  from the `write-errors.js` import added in phase 2. The only source-parsed
  change in the file.
- **Unchanged, as expected:** `stage_gate_rules` 61 total and 45 on `test_bed`,
  `scoring_criteria` 5, `scoring_anchors` 15 at version 1 only. No migration ran
  this round.
- **Two new probe users exist on the project by design and own nothing live.**
  `ownership-owner@terminus-probe.invalid` and
  `ownership-other@terminus-probe.invalid`, created once and reused forever.
  Fixed rather than per-run because `records.owner_id` references `auth.users`
  and fixtures are soft deleted, so a per-run user would still own rows
  afterwards and could never be removed, accumulating one pair per suite run.
  They are not residue: 0 live records are owned by any non-business account.

Both suites green on the branch, captured to files: 25 of 25 on `npm test`,
59 of 59 on `npm run test:db`, up from 50 with the 9 new ownership tests. Three
consecutive `test:db` runs at 32s, 28s and 30s against roughly 31s before, so
the new file costs nothing under parallelism and shows no cross-file
interference. Residue after: 93 live records, 0 owned by any non-business
account, 0 live `harness_*`, 0 orphan gate rules.
