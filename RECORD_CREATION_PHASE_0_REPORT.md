# Record creation atomicity, Phase 0: the census

Read-only. Every database call is a `.select()`; no fixes, no data changes.
Tree: `9f3f2c1`. Instruments: `scripts/record-creation/`, three passes, each
emitting its own numbers.

---

## 0. THE SCOPE DISCOVERY, FIRST

**`POST /records` has no caller. Not one, anywhere in the estate.**

The brief's premise is correct as far as it goes - this is the third and last
non-atomic creation path, and its own `TODO M2` names this exact fix. What the
census adds is that **nothing in this repository has ever called it, and only
two records in the database were ever made through it**, both `smoke_test`, both
on 2026-08-02, both since hard-deleted.

Build-discipline rule 15 says a scope discovery is the deliverable and measuring
it precisely beats delivering a fifth of the work assumed. **This does not stop
Phase 1** - the route is live, registered, and reachable by any authenticated
caller - but it changes what the round is buying, and that is John's call rather
than mine. §5 sets out the three readings without choosing between them.

---

## 1. Callers: **0**

`scripts/record-creation/caller-census.mjs`, over **379 tracked files**,
comment-stripped through the estate's own stripper.

```
exact POST '/records' call sites : 0
raw fetch to /api/records        : 0
POST to a /records/... subpath   : 27   (deliberately not counted)
```

The 27 are the live sub-routes and they are listed in the run: 19
`/records/:id/transition-requests`, 5 `/records/:id/transition`, 2
`/records/:id/approvals`, 1 `/records/:id/transition-requests`. **`/records` is
a prefix of a dozen real routes**, which is why a plain grep for the string
reports a dozen false callers and why the census separates the exact path from
the prefix.

### The zero is calibrated, and the population clause is honoured

Verification 12/13/17/25 collapsed: a null reading is trusted only once the
instrument has produced a non-null one **on the same population the claim
covers.** Seven synthetic cases pass in both directions - a real call, the same
call in a comment, a subpath, a template subpath, a double-quoted call with odd
spacing, and a GET - but synthetic cases are a different population from the
estate.

So the same instrument was pointed at paths that exist, over the same files:

```
POST /test-beds     9 call site(s)
POST /accounts      8 call site(s)
POST /contacts      4 call site(s)
POST /records       0 call site(s)
```

### And the indirection check, because adjacency is an assumption

A pattern requiring `'POST'` and `'/records'` to be adjacent is blind to
`const p = '/records'; api('POST', p)`. So the census also counts **every
occurrence of the exact literal `/records`, in any position, in any file.**

```
src/routes/records.js:97   app.post('/records', ...)
src/routes/records.js:138  app.get('/records', ...)
total: 2
```

**Both are the route definitions.** There is no indirection because there is no
second mention.

**A second finding falls out of that line: `GET /records` has no caller
either.** The whole collection-level pair is uncalled. `/records/:id` and its
sub-routes are heavily used; it is specifically the collection that nothing
touches. Out of scope, on the list.

### Response shape

The brief asks whether callers rely on the response shape. **With zero callers
the question has no subject**, and that is worth saying rather than answering
"no": the 201 body is `record` - the inserted row, `.select().single()` - and
Phase 1 must preserve it because a future caller will read it, not because a
present one does.

---

## 2. Types: **2 records, both `smoke_test`, and no documents**

`scripts/record-creation/type-census.mjs`. Coverage asserted against the
server's own count on every table: `audit_log` 5,357 (`action='created'`),
`records` 43,557, `record_revisions` 69,670.

### The fingerprint, and why one exists

`records` carries no provenance column and the route has no caller to
instrument, so the only instrument available is the audit row. Four routes write
`action: 'created'` and **each writes a different `detail` shape**, enumerated
from source rather than recalled:

| route | `detail` keys |
|---|---|
| `accounts.js:242` | `name` |
| `contacts.js:227` | `name`, `company` |
| **`records.js:129`** | **`initial_status`** |
| `test-beds.js:302` | `name` |

`initial_status` is written by this route and by nothing else - measured, one
file, one occurrence. The other 5,355 creation audits divide cleanly by shape
(`company+name` 4,108, `name` 1,217, `account_id+name` 19, `company_name` 9,
`script+seeded` 2), so the fingerprint is bounded as well as unique.

### What it found

```
audit rows with action='created'      : 5357
of which carry detail.initial_status  :    2

2026-08-02T00:45:58Z  smoke_test  status "draft"
2026-08-02T01:07:13Z  smoke_test  status "draft"
```

Both from Milestone 1. Both records **no longer exist** - hard-deleted, before
the soft-delete rule was in force.

### Neither is an atomicity failure, and the route's own ordering proves it

Both show `revisions = 0`, which reads as the insert-2 shape. **It is not.** The
route returns on `revErr` **before** writing the audit row, so **an audit row
present proves the revision landed.** Both revisions were written and later
hard-deleted with their records. The same deduction the convert round used for
its F4, arriving on the other side of the same argument.

**So this route has no recorded atomicity failure. Ever.**

### Documents

**0 of 2,533 document records came through this route.** The convert round's F3
measured that documents carry no revision by design; this is the different
question the brief asked, and the answer is that they arrive by their own two
routes in `test-beds.js`.

### Revision-1 by type, for the semantics Phase 1 must preserve

| type | total | with a revision numbered 1 | |
|---|---|---|---|
| `unit` | 7,869 | 7,869 | 100.0% |
| `account` | 902 | 902 | 100.0% |
| `test_bed` | 879 | 879 | 100.0% |
| `opportunity` | 4,646 | 4,369 | 94.0% |
| `contact` | 5,170 | 4,236 | 81.9% |
| `document` | 2,533 | 84 | **3.3%** |
| 2,714 `harness_*` types | 21,558 | 2,937 | 13.6% |

**The route writes revision 1 unconditionally**, which matches every type it
could plausibly be used for and is wrong for exactly one: `document`. Since no
document has ever arrived this way, **Phase 1 preserves the unconditional
write** and the alternative is not a live question.

---

## 3. Invariants: **none. The function needs no lock**

`scripts/record-creation/invariant-census.mjs`. Taken by measurement, because
the brief is explicit that copying the convert function's shape is not an
argument.

**The route performs three INSERTs and no reads.**

```
INSERT on records
INSERT on record_revisions
INSERT on audit_log
standalone reads before the writes: 0
```

A read-then-write race needs a read. There is none. The convert function's lock
exists because a **count** had to be true across a read and a write; nothing
here has that shape.

**The cross-row constraints it could theoretically race, and why it cannot:**

- `records_reference_code_record_type_key UNIQUE (reference_code, record_type)`
  - **the route never sets `reference_code`**, confirmed against its own insert;
    the column is absent, so the value is null and nulls do not collide.
- `record_revisions UNIQUE (record_id, revision_number)` - `record_id` is a
  uuid minted by the insert immediately above, so two concurrent calls cannot
  collide on it.

**The triggers it inherits** (Verification 46): the freshness triggers on all
three tables, and `refuse_write_while_frozen` on `records` and
`record_revisions`. All per-row, and a record created in the same statement
cannot have an open transition request.

**Position, for Phase 1: no advisory lock, and its absence is the measurement
above rather than an omission.**

### But the route has almost no validation, which is a different finding

| route | refusals before the insert |
|---|---|
| `POST /test-beds` | 5 |
| `POST /contacts` | 4 |
| `POST /accounts` | 1 |
| **`POST /records`** | **1** - `record_type is required` |

**And it accepts any non-empty string as `record_type`.** No allowlist, no check
against a known type. So it can mint a `test_bed` with no Account, a `contact`
with no email, or a record type that has never existed - **bypassing every
precondition the typed routes enforce.**

That is not an atomicity defect and it is not this round's scope. It is recorded
because it bears directly on §5, and because a control observation goes on the
list rather than into the round (rule 10).

---

## 4. Residue since `c2bf261`: **0**

`c2bf261` was committed `2026-09-08T11:16:32+08:00`. Both fingerprinted audit
rows are from 2026-08-02. **Nothing attributable to this route has appeared
since**, which is what a route with no caller would predict and is measured
rather than assumed.

The convert round's estate-wide counts (P0.1, P0.2) were dispositioned *leave*
and are not re-reported.

---

## 5. The three readings, for John

Stated without choosing. Each is defensible and the choice is a product one.

1. **Fix it as briefed.** The route is live and reachable by any authenticated
   caller. An atomic creation path costs one migration and one route change, the
   pattern is proven twice over, and the estate ends with no non-atomic creation
   path anywhere. **Cost: one round. Benefit: closes the class.**
2. **Retire it.** Nothing calls it, nothing has called it, and it bypasses every
   typed precondition. Retirement is the convert round's Verification 41 shape -
   the two claims, plus making the route refuse - and it removes a surface
   rather than hardening one. **Cost: less than fixing it. Benefit: one fewer
   way to make a malformed record.**
3. **Fix it AND constrain it.** Atomic, plus a `record_type` allowlist, so the
   generic path stops being a bypass. **Cost: more than 1. It is the only
   reading that leaves the route both safe and useful.**

**My recommendation is 2 or 3, not 1**, because reading 1 leaves the validation
gap exactly as it is while making the thing that has never been used more
robust. But the brief rules the scope, and R1 says fix; I have not acted on this
view and Phase 1 will follow whatever is ruled.

---

## 6. What this phase does NOT establish

- **That the route is unreachable.** It is registered and any authenticated
  caller can POST to it. "No caller in the estate" is not "no risk", and
  `CLAUDE.md` build-discipline rule 13 records that sign-in is not yet
  restricted in the application.
- **That the two `smoke_test` records were created by a person.** The
  fingerprint says which route, not who or why. Both actor ids are in the audit
  rows and were not resolved.
- **That no caller exists outside this repository.** The census covers tracked
  files. A curl in somebody's shell history is invisible to it.
- **That `GET /records` is dead.** It has no caller in the estate by the same
  measure, and it was not otherwise investigated - it is an adjacent
  observation, not a finding this phase stands behind.
- **Anything about the other two creation paths.** Settled ground per R1 and
  not re-measured.
