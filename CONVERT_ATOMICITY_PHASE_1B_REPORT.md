# Convert atomicity, Phase 1b: the four pending proofs

Ruling 7. The migration is applied; every proof written and unrun in Phase 1
has now been run unchanged, except where running it showed the proof itself was
wrong (§2).

**Both functions resolve.** `probe-convert-function.mjs` no longer exits 3.

| | result |
|---|---|
| `convert_test_bed` | **21/21** |
| `create_opportunity_from_contact` | **15/15**, and it had never been exercised at all |
| the race, before and after, one instrument | **route 4 of 4 created; function 1 of 4 created, 3 refused PT422** |

---

## 1. What is NOT proved, first

**The fourth named proof is half true, and the other half is Phase 2's work.**

> "The limit refusal maps to the route's 422, not a 500."

The function's half is proved: it raises `PT422` with the route's own message,
word for word. **The mapping half is false today.** Measured on the source
through the estate's stripper, so a comment naming PT422 cannot satisfy it:
`PT422` appears **nowhere** in `src/`, so `sendWriteError` falls through to its
500 branch. Nothing is broken, because the routes do not call the functions
yet - but **Phase 2 must add the branch or the limit will answer 500 the day it
switches.**

**Atomicity is proved at two of five insert positions, not all five**, and the
other three have no reachable failure. §3 names each with its reason.

**`20260829000007` still carries its ledger insert on disk.** Ruling 9 records
it as resolved by migration repair; that repair is not in the file. Consistent
with ruling 9's own census note that a rebuild from files would collide, and
stated so nobody reads "resolved" as "the file is clean".

---

## 2. The RLS proof passed for the wrong reason, and was rebuilt

**The first run reported 15/15 and one of those passes was worthless.** Recorded
rather than quietly corrected.

The check read *"an unidentified caller is REFUSED by the database, not by a
guard"*, and asserted only that the anonymous call errored. It did - with
**PT404**. `records_select` is `auth.uid() is not null`, so an unidentified
caller cannot **see** the bed, and the function raises before reaching any
insert. A real refusal, and not the one the assertion claimed. **Verification
17: a probe that fires cleanly and measures the wrong thing.**

### The finding underneath it

**No authenticated caller can be refused by these five insert policies through
these functions.** The functions derive `owner_id`, `created_by` and `actor_id`
from `auth.uid()` rather than accepting them, so every policy is satisfied by
construction. That is Architecture rule 12 working exactly as intended, and it
means *"shown REFUSING at an insert"* is **not constructible** for a signed-in
user without changing policy or data.

The brief says precedent is not proof. It is also not available: no existing
`SECURITY INVOKER` function in this estate calls `auth.uid()` at all.

### So the proof is a contrast, and the delta is the enforcement

The same call, same bed, same arguments, made two ways:

| caller | RLS | `auth.uid()` | measured |
|---|---|---|---|
| publishable key, no JWT | **on** | null | **PT404** - stopped at the READ |
| service key, no JWT | **bypassed** | null | **23502** - past the read, dead at the FIRST INSERT on `owner_id NOT NULL` |

The service-role call is a faithful stand-in for what a `SECURITY DEFINER`
version would do, because bypassing RLS is exactly the privilege a definer
function would have brought. **The two fail at different stages. The difference
between them is RLS, so RLS is in force for the invoker call.** Neither wrote
anything.

Proved on both functions, identically.

---

## 3. Atomicity: two positions measured, three named as unreachable

| position | table | reachable failure? | measured |
|---|---|---|---|
| 1 | `records` | **yes**, `records_reference_code_record_type_key` | **23505**, zero new rows |
| 2 | `record_revisions` | no: `payload` is `jsonb` with no check, and the unique `(record_id, revision_number)` cannot collide on a record created in the same call | - |
| 3 | `opportunity_details` | **yes**, `CHECK (probability_pct >= 0 AND <= 100)` | **23514**, zero rows **after two had been written** |
| 4 | `audit_log` | no: every column is set by the function and none carries a check | - |
| 5 | `record_contacts` | no: `one_role_source` is satisfied by construction and the unique triple cannot collide on a new record | - |

**Position 3 is the one that proves atomicity**, because the record and its
revision had already been written inside that call and both were gone
afterwards. Position 1 proves the function raises rather than proceeding, and
nothing precedes insert 1 to roll back, so it is the weaker of the two.

**Position 1 also reproduces ruling 8's finding at the function**, not only at
the route: a coded bed whose Opportunity is soft-deleted has a conversion count
of zero and a reference code that is still taken, so the function raises 23505
where the count said the bed was free.

**The general claim - any failure at any position rolls everything back -
remains structural**, because neither function has an `EXCEPTION` block. It is
asserted on the source by `scripts/tests/convert-atomicity.test.mjs` and
calibrated in both directions. Reaching positions 2, 4 and 5 would need a
modified function, which is a second migration; not worth one.

---

## 4. The race is closed

**One instrument, two targets**, so the before and the after are the same
reader rather than two probes (Verification 20). The baseline was re-taken with
the current instrument after the probe changed, so the comparison is honest.

```
via route:     4 requests, slowest 1448ms, mutual overlap 905ms
  #1 201   #2 201   #3 201   #4 201
  created=4  refused-with-the-limit=0        VERDICT: THE RACE IS LIVE

via function:  4 requests, slowest  297ms, mutual overlap 178ms
  #1 PT422   #2 201   #3 PT422   #4 PT422
  created=1  refused-with-the-limit=3        VERDICT: THE RACE IS CLOSED
```

**The flake tell is an assertion, not a note, and it held both times.** The
probe records each request's own interval and **refuses to report a verdict when
the requests did not overlap** (the close-out's carried item 6). 905ms of
mutual overlap on the route and 178ms on the function, so at least one refusal
came from a request that began before the winner finished. That is the lock
doing the work rather than the requests arriving in turn.

**The two timings are not comparable and are not compared.** The RPC skips the
route's several reads, so it is a quarter of the wall clock. Only the outcome is
being compared.

**Residue zero after every run**, re-queried with Phase 0's own P0.3 detector,
on all four runs.

---

## 5. `create_opportunity_from_contact`, exercised for the first time

Phase 1 wrote it and proved nothing about it. **15/15.**

- Resolves; an unknown contact raises **PT404**.
- The same RLS contrast as above: **PT404** with RLS on, **23502** with it
  bypassed, nothing written by either.
- **Atomicity at insert 3**: 23514, and no audit row on the contact.
- **All five inserts land**, including the `record_contacts` link, measured per
  table rather than inferred from the return value.
- **The link's shape satisfies a constraint written for something else.**
  `role = 'commercial buyer'`, `role_id` and `role_other` null, so
  `num_nonnulls(role, role_id, role_other) = 1` holds -
  `record_contacts_one_role_source`, which this insert inherits (Verification
  46).
- **`account_id` is DERIVED** from the contact's own `parent_record_id`, not
  passed - the Phase 1 departure, now measured.
- **`reference_code` IS a parameter**, correctly, because issuing one
  increments a counter and must stay an explicit call in the route.
- Owner is the caller, stage is `Qualification`, and **both** audit rows were
  written, one on each record.

---

## 6. Calibration and instrument corrections

| | |
|---|---|
| the function probe stopping cleanly when unapplied | proved in Phase 1 (exit 3); it no longer fires, which is the state change being reported |
| the RLS contrast | discriminates: two callers, two different failure codes, on the same call |
| the race | flake tell fired at 905ms and 178ms; refuses a verdict without overlap |
| PT422 mapping absence | read through the estate's stripper, so prose cannot satisfy it |
| the migration's structural tests | 13/13, calibrated 13/13 both ways, unchanged this phase |

**A numbering collision, found and fixed.** Two checks in the function probe
were both labelled `8.` after the PT422-mapping check was added. The skill is
explicit that colliding numbering in one document has already produced a false
coverage claim once; renumbered and re-run.

---

## 7. What this phase does NOT establish

- **That the routes behave correctly.** They still do not call the functions.
  Everything here is measured at the RPC.
- **That a signed-in user can ever be refused at an insert.** They cannot, by
  design (§2), so that half of the RLS proof is answered by contrast rather
  than by construction.
- **That atomicity holds at positions 2, 4 and 5** by measurement. It holds by
  construction and that construction is tested on the source.
- **That the limit answers 422 through a route.** It answers PT422 at the
  function and would answer 500 through `sendWriteError` today (§1).

---

## 8. For Phase 2

1. **Add the `PT422` branch to `src/lib/write-errors.js`** mapping to 422, in
   both `sendWriteError` and `writeErrorStatus` - that file's own comment says a
   mapper that knows a code and a twin that does not is worse than neither.
2. **Map `PT404`** from both functions to the 404 the routes already answer.
3. Point both routes at their functions, preserving the response bodies the
   functions now return.
4. Re-run, unchanged, and expect the same numbers:
   `probe-conversion-limit.mjs` (17/17 at the route),
   `probe-convert-race.mjs after 4 --via=route` (must now read CLOSED),
   `probe-convert-function.mjs`, `probe-contact-function.mjs`.
5. Ruling 6's item: the `walk-tb-2e.mjs` teardown.
