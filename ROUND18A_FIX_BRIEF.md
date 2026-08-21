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
