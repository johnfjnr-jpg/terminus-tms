# Convert atomicity, Phase 0: the residue probe

Investigation only. **Read-only: no fixes, no data changes.** Every Supabase
call in every pass is a `.select()`; the phase applies no disposition and
proposes all of them.

Tree: `6e03d03`, branched from the migration's close at `f8a9c48`.
Instruments: `scripts/convert-atomicity/`, four passes, each writing its
numbers to a file which is then read. No number below is hand-typed.

---

## 0. The headline, before the detail

**All three counts the brief asks for are effectively zero on live data, and
one of them is zero for a reason that makes it worth nothing as evidence.**

| | count | of which LIVE | attributable to a creation path |
|---|---|---|---|
| P0.1 opportunities with no `opportunity_details` | 585 | **0** | 0 |
| P0.2 records with no `record_revisions` | 22,023 | **62** | **0** (all `document`, a type that has no revision by design) |
| P0.3 Test Beds with more than one live conversion | **0** | 0 | see F1 below |

**Live records in any route-producible failure shape, owned by a real
person: 0.** `john@terminustechnologies.io` owns 109 live records and none of
them is in any of the three shapes. `johnf.jnr@gmail.com` owns 0 records at
all.

**But P0.3's zero is true by absence and must not be read as the limit
holding.** There are zero live conversions in the entire database, so the
query is asking for beds with more than one member of an empty set. The
calibration is what says so: it came back not-firing.

---

## 1. The brief's premises, re-verified by measurement

The brief was drafted against `f8a9c48` and asks for its premises to be
re-checked before any code is written. All hold.

| premise | verified at | result |
|---|---|---|
| four writes in sequence, no transaction | `src/routes/test-beds.js:1494-1542` | HOLDS: `records`, `record_revisions`, `opportunity_details`, then an `audit_log` batch of 2 |
| the audit batch's error is unchecked | `src/routes/test-beds.js:1542` | HOLDS: `await db.from('audit_log').insert([...])`, no destructure, no check |
| the max-conversions check is read-then-write with no constraint behind it | `src/routes/test-beds.js:1444-1460` | HOLDS: a `select` on `opportunity_details`, a JS `filter` on `deleted_at`, a `length >=` comparison |
| the limit lives in `conversion_criteria.condition` | live query | HOLDS: exactly one row, `test_bed -> opportunity`, `{"max_conversions": 1}` |
| the contact sibling has the same shape | `src/routes/contacts.js:788-842` | HOLDS: `records`, `record_revisions`, `opportunity_details`, `linkContact`, unchecked `audit_log` batch. Five writes, no transaction |
| the generic `POST /records` is out of scope and carries its own TODO | `src/routes/records.js:95` | HOLDS: `// TODO M2: wrap the three inserts (records, record_revisions, audit_log)`. The scope boundary is real |

### F4, a correction to how the brief's defect statement reads

The brief lists the failure positions, and it is right about each. What it
does not say, and what changes how the residue is read, is the **order**:
the route returns on `detErr` **before** the audit inserts. So of the four
signatures, only these are producible:

| failure | leaves | visible to |
|---|---|---|
| insert 1 `records` | nothing at all | **nothing. Invisible by construction** |
| insert 2 `record_revisions` | record, no revision, no details, **no audit** | P0.1 and P0.2 together |
| insert 3 `opportunity_details` | record, revision, no details, **no audit** | P0.1 |
| insert 4 `audit_log` | record, revision, details, **no creation audit** | P0.A below |

**Therefore an audit row present with the details row absent is not
producible by this route in any direction.** That fact is what attributes
P0.B below, and without it those 16 rows read as insert-3 failures.

---

## 2. The three counts, with dispositions

### P0.1 — 585 opportunities with no `opportunity_details` row. **LIVE: 0**

| split | count |
|---|---|
| soft-deleted, revision present (the insert-3 shape) | 314 |
| soft-deleted, revision absent (the insert-2 shape) | 271 |
| **live** | **0** |

By owner: 350 `terminus.walk65@gmail.com`, 192
`ownership-other@terminus-probe.invalid`, 38
`john+test@terminustechnologies.io`, 5 `r10-r10@terminus-probe.invalid`.
**None owned by `john@terminustechnologies.io`.**

Attributed by creation audit, which names the route that made the record:

| | count |
|---|---|
| **no audit row at all** (a fixture writing `records` directly, or an insert-2/3 failure) | 568 |
| `created_from_test_bed` present, details absent | **11** (see F2) |
| other audit only (`linked_account`, key-contact activity) | 6 |

Against the whole opportunity population as a baseline: 3,801
`created_from_contact`, 81 `created_from_test_bed`, 576 with no audit at all.

**Disposition proposed: leave all 585 untouched.** Every one is already
soft-deleted and therefore invisible to the application; `records` carries
`ON DELETE RESTRICT` from three tables and Verification 11 forbids hard
deletion outright. Nothing is gained by touching them and a counter or a
history row is at risk if anything is.

**What this does NOT establish:** the 568 with no audit are an *upper bound*
on insert-2/insert-3 residue, not a measurement of it. A fixture that inserts
into `records` directly leaves the identical shape, and probes in this
repository do exactly that. Nothing in the data can separate the two.

### P0.2 — 22,023 records with no `record_revisions` row. **LIVE: 62**

The headline number is dominated by a category error and by dead harness data:

| record type | total | no revision | of which live |
|---|---|---|---|
| `unit` | 7,755 | 0 | 0 |
| `contact` | 5,025 | 916 | 0 |
| `opportunity` | 4,468 | 271 | 0 |
| **`document`** | 2,509 | **2,425 (96.7%)** | **62** |
| `account` | 868 | 0 | 0 |
| `test_bed` | 842 | 0 | 0 |
| 2,684 distinct `harness_*` types | 21,312 | 18,411 | 0 |

**F3: `document` has no revision by design, so P0.2 counts a design decision
as residue.** Both document creation paths
(`src/routes/test-beds.js:1323` and `:1941`) insert into `records` and then
into `document_details`, and **neither writes a `record_revisions` row**.
Measured rather than read off the routes: 100% of live documents lack one,
and the 84 that have one are all soft-deleted harness rows.

Excluding `document`, records with no revision = 19,598, **of which LIVE =
0**.

The 62 live rows in full, by shape rather than by id (all owned by
`john@terminustechnologies.io`, all created 2026-08): 61 `terminus`-kind and
1 `customer`-kind, every one parented to a **live** Test Bed, 2 carrying a
`document_details` row and 60 not - which is the ordinary state of a document
whose location was never entered, since path A upserts `document_details`
only `if (document_location !== undefined)`.

**Disposition proposed: none. These are not residue.** The finding is about
the criterion, not the rows: P0.2 as stated has a shape that includes a
record type the system deliberately creates without a revision.

### P0.3 — Test Beds with more than one live conversion. **0**

And this is the one that needs its calibration read beside it.

```
opportunity_details carrying converted_from_test_bed_id = 70
distinct source Test Beds named                         = 70
conversions per bed                                     = 70 bed(s) with 1
of those rows: opportunity LIVE = 0, SOFT-DELETED = 70, MISSING = 0
of those beds:  bed LIVE = 0, SOFT-DELETED = 70, MISSING = 0
by owner of the converted opportunity: 70  john+test@terminustechnologies.io
by month: 2026-08  70
```

**F1: the zero is true by absence.** Every recorded conversion in the
database is an August fixture whose bed and opportunity are both
soft-deleted. There is not one live conversion anywhere, so P0.3 cannot
distinguish "the limit held" from "there was nothing to count". The count
ignoring `deleted_at` is also 0, and the reason is stronger than the count:
**every one of the 70 beds was converted exactly once.**

**Disposition proposed: nothing to dispose of.** What carries forward is that
**Phase 1's race proof cannot be validated against history and must be
constructed from scratch**, and that the `deleted_at` exclusion the brief
asks Phase 1 to preserve is currently doing no work on any live row - so a
test that only exercises live conversions will not exercise it.

---

## 3. Two measurements beyond the brief's three

Labelled P0.A and P0.B so they cannot be read as a fourth and fifth item of
the brief's own list.

### P0.A — conversions with no audit trail: **0**

The brief's own defect statement names insert 4 ("converts with no audit
trail and still returns 201"), and ruling 2 changes that behaviour, so
whether the residue exists decides whether the ruling has anything
retrospective to answer for. Every one of the 70 converted opportunities
carries its `created_from_test_bed` audit row. Orphan `opportunity_details`
rows naming no record: 0.

Separately, opportunities holding details **and** a revision but **no**
creation audit at all: 12, all soft-deleted, 10 owned by
`r10-r10@terminus-probe.invalid`. That is the insert-4 shape and also the
shape a direct fixture insert leaves; **live: 0**.

### P0.B — beds audited as converted, cross-checked against the details rows: **16**

The instrument the brief's three counts do not contain. If insert 3 fails,
nothing in `opportunity_details` can see the conversion at all, so the
audit row on the **bed** is the only independent witness.

- `audit_log` rows with `action = converted_to_opportunity`: **93**
- distinct beds named by them: **86**
- distinct beds named by `opportunity_details`: **70**
- **beds audited as converted with no details row naming them: 16** (23 audit rows)
- the inverse, details rows with no audit row on the bed: **0**
- beds audited as converted more than once: **3**

Two cohorts, and neither is an insert-3 failure:

**The recent 11 (2026-09-07 x 9, 2026-09-08 x 2, actor
`john+test@terminustechnologies.io`).** Every one names an opportunity that
still exists, is soft-deleted, **has a revision, and has no details row** -
which per F4 the route cannot produce, because the audit is written after
the details insert succeeds. These are the same 11 that P0.1 attributes as
`created_from_test_bed | revision=true`. The counts match exactly.

**F2, and it is the finding of this phase.** A repository-wide
comment-stripped census of hard deletes on the child tables found **exactly
one** deleter of `opportunity_details`:

```
scripts/round7/walk-tb-2e.mjs:287
  await admin().from('opportunity_details').delete().eq('record_id', convertedOppId)
```

committed 2026-09-07, in the teardown of the Round 7 Phase 2e walk, which ran
again during Round 8. **A probe in this repository manufactures the exact
residue shape this round exists to prevent**, and it does so with a hard
delete on a child table - which Verification 11 rules out for fixtures. It
had produced 11 rows that read as insert-3 failures and are not.

Per build-discipline rule 10 this goes **on the list**: it is not destroying
live data, it is deleting a child row of a record its own run created.
Recommended fix when it is reached: soft-delete the opportunity and leave the
details row, the way the application does.

**The older 5 beds / 12 audit rows (2026-08-02, -03, -15).** Every named
opportunity's record is **gone entirely** - hard-deleted, before the
soft-delete rule was in force - so only the audit rows survive. Among them,
one bed audited as converted **six times** on 2026-08-03 by
`johnf.jnr@gmail.com` and two beds audited twice. That is the "Real data
showed one Test Bed converted six times" recorded in the Milestone 5 comment
at `src/routes/test-beds.js:1386`, from before `conversion_criteria` was
queried at all. **It is the historical proof that the limit is real and was
once breached**, and it pre-dates the check that now enforces it.

**Disposition proposed for all 16: leave.** `audit_log` is append-only
history and the records it refers to are gone or already deleted. Deleting an
audit row would destroy the only evidence that the six-way conversion
happened.

---

## 4. Calibration, both directions

Every count above is an absence, and Verification 12/13/17/25 collapsed says
an absence is trusted only once the instrument has produced a non-null
reading **on the same population the claim covers**.

| # | instrument | calibration | result |
|---|---|---|---|
| C1 | P0.1 anti-join | withhold one real opportunity's details row | **FIRED** 585 -> 586, names the victim |
| C1b | P0.1 anti-join, bulk | aim it at non-opportunity records, all of which must lack a details row | **FIRED** 38,311 of 38,311 |
| C2 | P0.2 anti-join | withhold one real record's revisions | **FIRED** 22,023 -> 22,024, names the victim |
| C3 | P0.3 grouping | lower the threshold from `> 1` to `>= 1` | **DID NOT FIRE - and that is F1** |
| C3b | P0.3 threshold | duplicate one conversion row on the deleted-inclusive grouping (70 groups) | **FIRED** 0 -> 1, names that bed |
| C4 | the coverage assertion | one unpaged `select` on `record_revisions` | **FIRED** returns 1,000 against a server count of 68,194: a probe without paging would have read **1.5%** of that table |
| C5 | P0.B cross-check | withhold one bed from the details side | **FIRED** 16 -> 17, names it |
| C6 | the deleter census | comment out the one known deleter in a copy of the real file | **FIRED** 1 -> 0 |
| C7 | the comment stripper | nine cases, both directions | **ALL PASS** after a fix, below |

Coverage was asserted, not assumed, on every table on every pass: the paged
row count is compared against the server's own `count: 'exact'` for the same
filter and the run stops dead on a mismatch. `records` 42,779, `opportunity_details`
3,883, `record_revisions` 68,194, `audit_log` 34,198, `document_details` 79.

### F5 - two faults in my own instruments, both caught only by calibration

**A calibration skipped by a guard on its own population.** Pass 1's C3b was
written `if (groups.size) { ... }` over the live-conversion grouping, which
turned out to be empty, so it never ran and **printed nothing**. That is
Verification 14's commonest shape committed by the calibration harness
itself, and a skipped calibration is indistinguishable from a passing one.
Re-run in pass 3 against the deleted-inclusive grouping, where the population
is 70, it fires.

**A comment stripper that ate real code.** The first deleter census used the
usual line-based regex strip. Calibrated in the second direction per
Verification 39, it destroyed `const u = 'https://x//y'` at the `//` and took
the rest of the line with it - so any deleter sitting after a URL, a regex or
a template literal would have been silently missed, and the census would have
reported a clean "exactly one" for a reason unrelated to the truth.
Replaced with a character walk that tracks string, template and regex
context (`scripts/convert-atomicity/strip-comments.mjs`), calibrated on nine
cases in both directions, and proved not to eat code on the real corpus:
**all 211 tracked `.js`/`.mjs` files parse identically before and after
stripping.**

---

## 5. What surprised

**The count that mattered was the one nobody asked for.** P0.1, P0.2 and
P0.3 are 585, 22,023 and 0, and the disposition of all three is "leave it".
P0.B is 16, and it is the only number in the phase that named a live problem
- a probe in this repository that manufactures the round's own defect shape.

**The six-way conversion is still in the audit log.** The Milestone 5 comment
says real data showed one Test Bed converted six times. The records are gone
and the six audit rows are still there, timestamped within eighteen minutes
of each other on 2026-08-03. The defect this round is closing has a
documented instance in this database.

**Half the `records` table is dead harness data.** 21,312 rows across 2,684
distinct `harness_*` `record_type` values, 0 of them live. `record_types` is
not a table, so none of this reached configuration - it is data volume only.
Named here, not acted on: rule 10, on the list.

---

## 6. What Phase 0 does NOT establish

- **It does not establish that the convert route has never failed
  mid-sequence.** It establishes that no LIVE row is in a shape a
  mid-sequence failure leaves. A failure whose record was later deleted is
  indistinguishable from a fixture that was torn down.
- **It does not establish that the max-conversions limit holds.** P0.3's zero
  rests on an empty population (F1). The only evidence about the limit in
  this database points the other way: a bed converted six times before the
  check existed.
- **It cannot see an insert-1 failure at all.** Nothing is written, so
  nothing is left to count.
- **The 568 no-audit rows are an upper bound, not a measurement.** A direct
  fixture insert leaves the same shape as an insert-2 or insert-3 failure and
  the data cannot separate them.

---

## 7. For sign-off

**Nothing is applied.** Every disposition above is a proposal:

| item | count | proposed disposition |
|---|---|---|
| P0.1's 585 soft-deleted opportunities | 585 | leave: already invisible, `ON DELETE RESTRICT`, Verification 11 |
| P0.2's 62 live documents | 62 | none: not residue. The criterion excludes `document` |
| P0.3 | 0 | nothing found; carry F1 into Phase 1's proof design |
| P0.A | 0 | none |
| P0.B's 16 audited beds | 16 | leave: append-only history, records already gone or deleted |
| F2 `walk-tb-2e.mjs:287` | 1 line | **queue** a fix (rule 10: on the list, not destroying live data) |
| the 21,312 harness records | 21,312 | **queue**; 0 live, data volume only |

**Two things Phase 1 inherits from this phase rather than from the brief:**

1. **F1** - the race and limit proofs must be constructed, because no live
   population exists to validate them against, and the `deleted_at` exclusion
   Phase 1 must preserve is currently exercised by nothing.
2. **F4** - the audit is written after the details insert, so the audit row
   is not a witness to insert 3. Under ruling 2 that changes: with all four
   inside one transaction, an audit row will witness the whole conversion,
   which makes P0.B a genuine detector going forward rather than a probe
   artefact detector.

---

## 8. The gate

Run to completion and captured to a file, which is then read. Every number
below is the gate's own, emitted per stage.

```
MERGE GATE  main  41e7eb81a33aae489fdc5d850fdb987ea65f01d9
  21 of 21 stages PASS
  pure suite      476/476 pass, 0 fail
  database suite   94/94  pass, 0 fail
  react suite     915/915 pass, 0 fail
  HTTP stages     14, all PASS, 10.1s to 46.7s
  full output: .verify/verify-1278530308111916.txt
```

**The SHA is `41e7eb8`, not the `6e03d03` the run was launched against.** The
report file was committed while the gate was in flight and the gate reads its
HEAD at the end, so it recorded the later commit. The two trees differ by this
markdown file alone, which no stage reads. Stated rather than tidied.

Durations are the normal ones for this suite (Verification 48): the HTTP
stages ran 10.1s to 46.7s against a floor of about 130ms, so no stage failed
faster than it could have run, and none was skipped.
