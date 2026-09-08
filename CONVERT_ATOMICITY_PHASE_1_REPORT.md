# Convert atomicity, Phase 1: the migration

---

## 0. WHAT IS NOT BUILT, FIRST

**The migration is written and UNAPPLIED, and four of the five named proofs
could not run.** Build-discipline rule 15: a partial says what is unfinished
before it says anything about what was done.

| named proof | state |
|---|---|
| RLS under INVOKER, passing for an ordinary caller on all four inserts | **written, UNRUN** |
| RLS under INVOKER, refusing where policy says it must | **written, UNRUN** |
| Atomicity: an injected failure at each insert position leaves zero rows | **written, UNRUN**, and one position is measurable, three are not (§5) |
| The race: two concurrent converts produce one conversion and one refusal | **written; the BEFORE half ran and the AFTER half cannot** |
| The limit refusal maps to 422, not 500 | **written, UNRUN** at the function; proved at the route |
| **R5 (ruling 5): live counted, dead excluded, both directions** | **RUN. 17/17, and it found something** |

### Why, measured rather than recalled

`CLAUDE.md` rule 14 records that this session reaches Postgres only through
PostgREST. The brief asks for premises to be re-verified by measurement, so
this one was:

```
psql                 not found
supabase CLI         not found
node pg module       not resolvable
node postgres module not resolvable
.env keys            SUPABASE_JWKS_URL, SUPABASE_PUBLISHABLE_KEY,
                     SUPABASE_SECRET_KEY, SUPABASE_URL   (no connection string)
rpc exec_sql / execute_sql / run_sql / sql  ->  PGRST202, none exists
```

**A migration cannot be applied or even parse-checked from here.** The
dashboard is the first parser it meets, which is the environment fact rule 14
already names and the reason its clause (a) governed every construct choice
below.

Confirmed positively rather than by absence: `probe-convert-function.mjs`
calls the RPC and exits 3 with

> `STOP: public.convert_test_bed does not exist in the schema cache.`

That is Verification 48's discipline inside the harness - a run that produced
no result is stopped, never scored - and it is also the measurement that the
function is not there.

**Nothing here is blocked on a decision. It is blocked on an apply**, and the
proofs run unchanged the moment the migration lands.

---

## 1. The migration

`supabase/migrations/20260908000001_convert_is_one_transaction.sql`, two
`SECURITY INVOKER` plpgsql functions on the `insert_deal_sheet_version`
pattern.

**`convert_test_bed(p_bed_id, p_payload, p_max_conversions, p_probability_pct,
p_test_bed_cost)`** takes
`pg_advisory_xact_lock(hashtextextended(p_bed_id::text, 0))` - the same hash
`append_record_revision` takes on a record id, and a Test Bed is a record, so a
conversion and a revision on that bed serialise against each other. Inside the
lock it re-runs the live-conversion count, raises `PT422` on the limit, and
performs all four inserts.

**`create_opportunity_from_contact(p_contact_id, p_payload, p_reference_code,
p_probability_pct)`** performs five: the link row as well. **No advisory
lock**, and the absence is the decision: a lock exists to make a read-then-write
true and this path has no such read. A lock there would protect nothing and
would read as though it protected something.

### Ruling 2 is implemented by construct, not by code

Neither function carries an `EXCEPTION` block, so any error from any statement
propagates out and aborts the whole call. There is no branch to get wrong.
Architecture rule 14(a): prefer a construct that cannot carry the error, because
the usual compensating control - run it and see - is exactly what is
unavailable here.

**The failure mode that remains is somebody adding a handler later**, in good
faith, to improve a message. That would silently restore the fire-and-forget
this round removes and nothing would fail. `scripts/tests/convert-atomicity.test.mjs`
is the thing that fails; it is in the pure suite and calibrated (§6).

### Constructs chosen because they cannot carry the error

- The count is a **correlated `EXISTS`**, not a join - rule 14(a)'s own worked
  example, from the migration that failed on a `LATERAL` in an `UPDATE`'s `FROM`.
- `%rowtype` variables and `returning * into`, both already in the estate.
- `to_jsonb(v_opp) || jsonb_build_object(...)` returns the route's exact
  response body from the function, so Phase 2 does not assemble a second
  version of it (Verification 20).
- The **ledger row travels in the same paste** (Architecture rule 10), guarded
  `on conflict do nothing` so it is a no-op under `db push`.

### PT422, and why not PT409

Enumerated from the migrations rather than recalled: the estate uses `PT400`,
`PT401`, `PT403`, `PT404`, `PT409`, `PT412`, `PT423`, `PT500`. **`PT422` is
free**, and it follows the convention the others set - the code names the HTTP
status. It must not be `PT409`, which means "the record moved under you, reload
and try again"; a conversion limit is not a staleness conflict and the two need
different words on screen.

`PT423` is documented as **inherited, not introduced**: three of the five
tables written here carry `refuse_write_while_frozen` on INSERT
(`record_revisions`, `opportunity_details`, `record_contacts`). A brand-new
Opportunity has no open request so it cannot fire today. Named because
Verification 46 says a new writer inherits every guard already on the table,
including the ones written for something else.

---

## 2. THE FINDING: "deleting an opportunity frees its bed" is false for any bed with a reference code

This came out of building R5's fixture, and it is the phase's substantive
result.

**Measured, on a Test Bed created through the real API with an industry and a
country, so it is issued a reference code:**

| step | expected | measured |
|---|---|---|
| convert once | 201 | 201, opportunity carries `TT-SG-AIRPRT-473`, the bed's own code |
| soft-delete that opportunity | count says the bed is free | `{all: 1, live: 0}` |
| convert again | 201, per the `deleted_at` rule | **409** `That would duplicate a value this record already has` |

`records` carries `records_reference_code_record_type_key UNIQUE
(reference_code, record_type)`, added by `20260815000008` **specifically** so a
Test Bed's code could be carried onto its Opportunity while two Opportunities
could not share one. It is **not partial on `deleted_at`**, so the
soft-deleted Opportunity keeps the bed's code for ever.

**Two correct decisions about the same question, taken in different rounds,
producing a conflict nothing detects.** Verification 23's exact signature. The
conversion count says the bed is free; the unique index says the code is taken;
neither knows the other exists, and the caller gets a duplicate-key message
that says nothing about conversions.

**Nothing could have caught it**, because Phase 0 established that no live
conversion has ever existed in this database, so the second-conversion path has
never been walked.

**Not fixed here.** Build-discipline rule 10: it is not destroying live data,
so it is recorded, scoped and queued. It is also **not a regression the
migration introduces** - the function preserves the route's rule exactly, and
the constraint sits above both. Scoping note for whoever takes it: the options
are a partial unique index excluding soft-deleted rows, or not carrying the
code onto a replacement conversion, and the second changes what Milestone 5
deliberately decided.

### A second finding, from the same measurement

**No route soft-deletes an Opportunity.** Enumerated with the estate's comment
stripper: the whole API has three DELETE routes - a Contact, a key-contact
link, and a customer document - and three writers of `deleted_at`, none of them
an Opportunity.

So the `deleted_at` exclusion the migration must preserve **protects a state
the application has no way to create**. That is the full explanation of Phase
0's F1, and it is why R5's fixture needed a direct write.

---

## 3. R5, the named proof, RUN: 17/17

`scripts/convert-atomicity/probe-conversion-limit.mjs`, against the current
route, so it is also the baseline Phase 2 must reproduce exactly.

### What discriminates, and what only looks as though it does

`max_conversions` is 1. With one live conversion the count is 1 and the answer
is 422; with a dead one wrongly counted too the count is 2 and the answer is
**still 422**. That step cannot tell a correct count from a broken one, and it
is the obvious step to write. It is in the probe, labelled as
**non-discriminating**.

The two that discriminate:

| | count must be | answer | meaning |
|---|---|---|---|
| one LIVE conversion exists | 1 | **422** | the live one IS counted |
| that conversion soft-deleted | 0 | **201** | the dead one is NOT counted |

Both fired. After the second, the bed holds **one live and one soft-deleted
conversion** - ruling 5's named fixture, a state that exists nowhere in the
database.

Every step also reads the count directly through the same accessor the
enforcement uses, so a 422 arriving for another reason cannot be misread as the
rule holding (Verification 14: an assertion about an effect carries the cause's
own answer). That is what turned the 409 above from "the probe failed" into a
finding within one run.

**Two beds, and the second one is the point.** A coded bed and an uncoded bed,
both produced by the real API. Running both is what separates *the rule does not
work* from *the rule works and something above it makes the state unreachable*,
and those are different findings with different fixes.

**Fixture honesty.** The Account, both Test Beds and every conversion are made
through the real API as the signed-in user. The soft delete is a direct write,
because no route can perform it (§2), which is Verification 47's own clause -
where the system cannot reach the state with one account, build it directly and
say so. The value written is the one the system itself writes, and the count
reads `deleted_at` with no opinion about how it got there.

---

## 4. The race, BEFORE: 4 of 4 committed against a limit of 1

`scripts/convert-atomicity/probe-convert-race.mjs`, four concurrent converts of
one bed:

```
4 requests, slowest 1296ms, mutual overlap 991ms
  #1  201  1296ms      #2  201   992ms
  #3  201  1005ms      #4  201  1265ms
201=4  422=0  other=0        conversion rows written: 4, live: 4
VERDICT: THE RACE IS LIVE.
```

**The flake tell is satisfied and it is an assertion, not a note.** The
close-out's carried item 6 says a concurrency proof that finishes implausibly
fast did not run. This probe records each request's own interval, computes the
mutual overlap, and **refuses to report a verdict when the requests did not
overlap**. 991ms of genuine overlap across all four.

**Reproduced twice**, with the second run through a rewritten client (§7), same
verdict, same shape. An instrument that cannot reproduce itself cannot compare
anything (Verification 6).

**An uncoded bed, deliberately.** A coded bed's second concurrent conversion is
refused 409 by the unique index of §2, which would look exactly like the limit
working and would be nothing of the kind. Which is itself worth saying plainly:
**today the only thing standing between a coded Test Bed and a double
conversion is a unique index whose refusal mentions neither conversions nor
Test Beds, and an uncoded bed has no backstop at all.**

This is the before measurement. Assertions 3, 4 and 5 fail today by design and
must pass after Phase 2. Verification 9: the detector is proven capable of
firing.

**Residue: zero**, re-queried after teardown on every run, with Phase 0's own
P0.3 detector.

---

## 5. What the atomicity proof can and cannot measure, stated

The brief asks for "an injected failure at each insert position". Measured
against the schema, the five tables offer **one** real injection point:

| position | table | a real failure available? |
|---|---|---|
| 1 | `records` | no: every column written is fixed or derived |
| 2 | `record_revisions` | no: `payload` is `jsonb` with no check |
| 3 | `opportunity_details` | **yes**: `CHECK (probability_pct >= 0 AND <= 100)`, so 999 fails |
| 4 | `audit_log` | no: no check to violate |
| 5 | `record_contacts` | no: the unique triple cannot collide on a new record |

So the proof is built in two halves, and the report says which is which:

- **The instance, measurable.** `p_probability_pct = 999` fails insert 3 after
  the record and its revision have been written. The probe asserts **zero rows
  across every touched table** afterwards. Written, unrun.
- **The general claim, structural.** Any failure at any position rolls
  everything back, because neither function has an `EXCEPTION` block. That is
  not measurable one position at a time; it is asserted on the source and
  calibrated in both directions (§6).

Injecting a `raise` at each position would need a modified function, which
needs an apply, which is the thing this session cannot do. Recorded rather than
worked around.

---

## 6. Calibration

### The migration's structural claims: 13 tests, 13/13 calibrated both ways

`scripts/tests/convert-atomicity.test.mjs`, in the pure suite. Suite **476 ->
489**, and the count moved, which is the check Verification 20's addendum
exists for.

`scripts/convert-atomicity/calibrate-migration-test.mjs`:

```
DIRECTION ONE: each claim, falsified
  FIRED  an exception handler is added                    (pass 11, fail 2)
  FIRED  a function becomes SECURITY DEFINER              (pass 12, fail 1)
  FIRED  an identity guard is restated in the function    (pass 12, fail 1)
  FIRED  the deleted_at exclusion is dropped              (pass 12, fail 1)
  FIRED  the limit refusal is given PT409 instead         (pass 12, fail 1)
  FIRED  the advisory lock is removed                     (pass 12, fail 1)
  FIRED  the bed reference_code becomes a parameter       (pass 12, fail 1)
  FIRED  the ledger row is dropped                        (pass 12, fail 1)
  FIRED  the grant is dropped                             (pass 12, fail 1)
  FIRED  an insert is lost from the contact path          (pass 11, fail 2)

DIRECTION TWO: prose must not satisfy or defeat the scan
  FIRED  a comment mentioning an exception handler leaves it green
  FIRED  a comment mentioning security definer leaves it green
  FIRED  the untouched file is green

migration sha256 unchanged = true          13/13
```

**The harness cannot destroy the work it is calibrating, by construction.** The
test reads its target from `CONVERT_MIGRATION`, so every injection is a fresh
temporary copy and the real file is only ever read. Verification 44 asks for a
verified snapshot and a verified restore after two harnesses destroyed
uncommitted work in consecutive phases; this one has nothing for those checks to
catch. It verifies the migration's sha256 is unchanged at the end anyway,
because a harness that believes it cannot touch something is exactly the one
that should look.

**A measured surprise, and it changed the test.** The estate's `stripSql`
**does not reach inside a dollar-quoted body**, and it is right not to -
`CLAUDE.md` Verification 39 names `$$ -- inside a plpgsql body $$` as one of the
things a stripper must not eat. The first run of the test file therefore matched
its own comments. The fix is a local `--` strip applied only to the two function
bodies, with both directions calibrated: prose saying "exception when" leaves
the suite green, and the strip is asserted to have kept all nine `insert into
public.` statements.

### The route-level proofs

| probe | calibration |
|---|---|
| R5 | both discriminating directions fired on the same fixture; the non-discriminating step is labelled as such in the probe |
| the race | the flake tell is an assertion and it fired at 991ms; the probe refuses a verdict without overlap; reproduced twice |
| the function probe | proven to stop cleanly (exit 3) rather than score a run that produced no result |

---

## 7. Departures from the brief, each with its measurement

**1. The bed's `account_id` and `reference_code` are read inside the function,
not passed.** The brief says the conversion count is the only read that moves
inside, and enumerates what stays in the routes: the bed payload, the criteria
row, the probability default, the system defaults, reference-number issuance.
These two are in neither list.

They are moved because they are **facts the database holds about a record**, not
computed values, and Architecture rule 12's test is whether a parameter is about
the caller or about the world. A caller supplying its own `reference_code` would
produce an Opportunity carrying a code belonging to a different Test Bed, and it
would look entirely normal to everyone downstream - the `p_from_stage` shape
exactly. The read is free: the function is already inside the lock and already
needs the bed row to exist. The same reasoning moves the Contact's
`parent_record_id`; the reference code on that path stays a parameter because
`issue_reference_number` increments a counter and must remain an explicit call
in the route.

**2. There is deliberately no identity guard in either function.** An
`if auth.uid() is null then raise` would be a second reader of the fact the five
insert policies already read (Verification 20), and worse: it would **mask** the
RLS refusal, making the "shown REFUSING where policy says it must" proof
impossible to fire. The database refuses; the function does not restate it. A
test asserts the guard is absent and the calibration fires when one is added.

**3. Both functions raise `PT404` when the source record is gone**, which the
routes already 404 on before calling. It is defence against the race between the
route's read and the call, and Phase 2 will need the mapping. Stated because it
adds one line to Phase 2's work.

**4. One behaviour difference, small and named.** `p_test_bed_cost` is
`numeric`, where the route passed `bedPayload.accumulated_cost` raw into both
the column and the audit `detail`. The column always coerced; the audit detail
did not. So an audit row will now carry a JSON number where it previously
carried whatever JSON type the payload held. Arguably a correction, recorded as
a difference.

---

## 8. What surprised

**The estate already had the comment stripper I wrote in Phase 0.**
`scripts/lib/strip-comments.mjs`, with `stripJs`, `stripSql`, `stripCss`,
`stripHtml`, `stripSh`, and its own both-directions test in the gate. I built a
duplicate because I never looked - Verification 23's own remedy, *search for an
existing decision about the same behaviour*, applied to a tool rather than a
rule. **The duplicate is deleted**, the census is re-pointed, and Verification
41's two claims are answered: the file is gone, and what replaced it is proven -
the estate's `stripJs` passes all nine cases the duplicate was calibrated on,
**including the URL case the duplicate's own first version failed**. The census
returns the identical answer through it: 8 hard deletes over 215 files, exactly
one on `opportunity_details`.

**The estate's `fetch` control caught the race probe within the minute.** The
first version called `fetch` directly, reasoning that every refusal is a value
to count rather than an exception to handle. `scripts/tests/api-client.test.mjs`
failed, and its own note says adding a file to its allowlist is a decision while
forgetting one is a failure. It was neither: it was a third way of talking to the
API, which is what the control exists to stop. `ApiError` carries `.status` and
`.body`, so a refusal is still a value. **No allowlist entry was added.**

**R5 was expected to be a formality and produced the round's biggest finding.**
It was added to the brief because Phase 0 showed the rule had never been
exercised. Exercising it took one probe and found that for most Test Beds the
rule cannot be reached at all.

---

## 9. What this phase does NOT establish

- **That the migration is syntactically valid.** It has not been parsed by
  anything. Every construct was chosen under rule 14(a) for that reason, and
  that is a mitigation, not a check.
- **That the functions behave as written.** Four of five named proofs are unrun.
- **That `SECURITY INVOKER` works for `auth.uid()` in this project.** No
  existing INVOKER function calls it; the precedents are all DEFINER. The brief
  says precedent is not proof, and this one does not even have precedent.
- **That atomicity holds at every insert position.** One position is measurable;
  the rest rest on the structural claim.

---

## 10. For sign-off

**Ready to run the moment the migration is applied**, unchanged:

```bash
node scripts/convert-atomicity/probe-convert-function.mjs applied
```

That single probe covers PT404, the RLS refusal for an unidentified caller with
zero rows written, atomicity at insert 3 with zero rows written, the success
path with all four inserts landing, PT422 with its exact message, R5 at the
function in both directions, and a null limit exercised with a value other than
1 (Verification 24).

Then, to prove the race closed and the baseline preserved, after Phase 2 points
the routes at the functions:

```bash
node scripts/convert-atomicity/probe-convert-race.mjs after 4
node scripts/convert-atomicity/probe-conversion-limit.mjs after
```

**Queued, not fixed** (rule 10):

| item | why it is queued |
|---|---|
| the reference-code collision (§2) | not destroying live data; not introduced by this round; the fix changes a Milestone 5 decision |
| no route soft-deletes an Opportunity (§2) | scope beyond the brief |
| the Phase 2 item R6 already names | the walk teardown, per ruling 6 |
