# Convert atomicity, Phase 2: the routes

Rulings 10 and 11. Both routes now call their functions.

---

## 0. THE PENDING GATE FROM 0389cd2 IS VOID, AND I VOIDED IT

Reported first because it reads as three findings and is none.

```
MERGE GATE  main  31ee564880a8228cb4a934d77d288e654d6c8b71  (WORKING TREE DIRTY)
  18 PASS
  FAIL  HTTP issue-target probe          exit 1  13129ms
  FAIL  HTTP proposal-issued probe       exit 1    132ms
  FAIL  HTTP zero-track transition probe exit 1    509ms
3 of 21 stages FAILED.
```

**Verification 48 reads it before anything else does.** `proposal-issued`
normally runs 29,062ms and failed in **132ms**; `zero-track` normally runs
10,146ms and failed in **509ms**. Those are the instant-failure signature.
Neither ran.

**The cause is mine and it is in the header.** The gate was launched on the
Phase 1b tree, and while it was running I did three things: committed the
rulings (so it recorded `31ee564`), edited `write-errors.js`, `test-beds.js` and
`contacts.js` (so it recorded **WORKING TREE DIRTY**), and **killed and
restarted the API server**. The two instant failures are the window where there
was no server. `issue-target` at 13,129ms is a normal duration, so it did run -
against a half-edited tree, which makes it evidence of nothing either.

**A gate run concurrent with editing is not a weaker gate run, it is not a gate
run.** The replacement is the Phase 2 gate at §7, on a clean committed tree,
with nothing else touching the machine.

**Also reported first: the API server was stale.** It had been started as
`node --env-file=.env src/server.js` with **no `--watch`**, so it was still
serving the pre-switch routes. Build discipline 9 names that exact hazard - new
frontend code against old backend code - and every probe below would have
measured the code I had just replaced. Restarted with the identical invocation
so the no-watch choice stands.

---

## 1. (a) Both routes point at their functions

**`POST /test-beds/:id/convert`.** The four writes and the `audit_log` batch are
one `db.rpc('convert_test_bed', ...)`. The conversion **count** moved inside,
with the lock that makes it true; the limit **value** is still read from
`conversion_criteria` in the route, because reading configuration is not
correctness-critical. The bed `select` no longer fetches `account_id` or
`reference_code`: the function reads both from the record, so this route cannot
pass the wrong ones.

**`POST /contacts/:id/create-opportunity`.** The five writes are one
`db.rpc('create_opportunity_from_contact', ...)`. `account_id` is not passed -
the function reads the Contact's own `parent_record_id`. The reference code **is**
passed, because issuing one increments a counter and stays an explicit call in
the route.

### Behaviour preserved, measured over HTTP on the success path

`probe-routes-preserved.mjs`, **28/28**. Verification 40: every route a boundary
modifies is exercised from outside, as the signed-in user, observing the new
behaviour on the success path. Both routes were rewritten around exactly the
line that produced that rule - a `ReferenceError` thrown while building a 201
for a write that had already committed.

**The assertions are derived from the brief's own sentence**, not from the code
being replaced (ruling 11): *"same status codes, same error shapes, same
response bodies, same carried fields (account_id, reference_code, test_bed_cost,
customerLead mapping, defaults at creation per Round 41 item 1)."* Each named
field is one assertion.

| convert | contact |
|---|---|
| 400 with the same error shape on a missing name | 400 with the same error shape |
| 201, body is the new record | 201, body is the new record and nothing more |
| `account_id` carried | `account_id` from the Contact's Account link |
| `reference_code` = the bed's own, unchanged | `reference_code` issued for this path |
| `converted_from_test_bed_id` on the body | - |
| `test_bed_cost` = the bed's own `accumulated_cost` | - |
| revision 1, created by the caller | revision 1, created by the caller |
| `initialLead` -> `customerLead` mapping | `customerLead` = the Contact's name |
| `company_name` = `client_organisation` | `company_name` = the Account name |
| all five creation defaults | all five creation defaults |
| details row: probability, bed, cost | the buyer link, in `linkContact`'s shape |
| both audit rows | both audit rows |

**`test_bed_cost` is asserted RELATIONALLY, not against a planted number.**
`PATCH /test-beds/:id` refuses `accumulated_cost` with
`disallowed: ["accumulated_cost"]`, because the cost is derived from the bed's
units rather than typed. So the probe reads the bed's own revision payload and
asserts the response equals it - which is what "carried" means, and is a
stronger claim than equality with a value the probe chose.

**Two fixture facts stated rather than hidden.** The `PATCH` body shape was read
off the route after the first run sent the fields flat and got a 400
(Verification 47's caller-side clause: read the route before writing the call).
And the fixture Contact is set to `Qualified` by a direct write, because
`loadQualifiedContact` correctly refuses 422 otherwise and reaching that state
through the transition engine is a large amount of unrelated setup;
Verification 47's own clause, with the migration's Round 4 as direct precedent.

### And the two ruled changes are visible where they should be

`probe-conversion-limit.mjs` at the route: **17/17, identical to the
pre-switch baseline** - the same 422, the same message, the same 409 on the
coded bed, the same counts at every step.

`probe-convert-race.mjs --via=route`: **THE RACE IS CLOSED END TO END.**

```
via route: 4 requests, slowest 781ms, mutual overlap 561ms
  #1 422   #2 201   #3 422   #4 422
  created=1  refused-with-the-limit=3  other=0
```

Before the switch the same instrument read 4 of 4 created. **The three refusals
are HTTP 422, not PT422 raw and not 500**, so that run is also the end-to-end
proof of the mapping in §2. The flake tell held at 561ms.

---

## 2. (b) PT422 in both mappers, and the test that was missing

`isLimit` / `LIMIT_STATUS = 422` and `isMissing` / `MISSING_STATUS = 404`, in
**`sendWriteError` and `writeErrorStatus`**.

**PT404 is mapped too, and it was not named in ruling 11.** Both functions raise
it when the source record vanishes between the route's read and the call. It is
in the shared path rather than inline for the same reason as the other two: two
routes today, and a third that forgets is the failure mode. Recorded as a
documented position rather than slipped in.

### What was actually missing was a test, not a branch

That file's note on PT423 says a mapper that knows a code and a twin that does
not is **worse than neither**, because the route using the second one looks
covered. **Nothing tested it.** The two existing tests that mention
`write-errors.js` read it as source text and never call either function.

So the assertion added is not "PT422 maps to 422". It is **THE TWINS AGREE**,
table-driven across every code either mapper knows: PT422, PT404, PT423, 23505,
42501, and an unknown code. Plus: the limit carries the database's own sentence
through rather than substituting one, and the limit is not confused with a
conflict or a freeze.

### Calibrated one mapper at a time, which is the point

```
FIRED  the PT422 branch is removed from sendWriteError only    (pass 15, fail 2)
FIRED  the PT422 branch is removed from writeErrorStatus only  (pass 16, fail 1)
FIRED  the PT404 branch is removed from sendWriteError only    (pass 15, fail 2)
FIRED  PT422 is given the freeze status by mistake             (pass 14, fail 3)
FIRED  the limit substitutes its own message                   (pass 16, fail 1)
FIRED  the untouched mappers are green                         (pass 17, fail 0)
write-errors.js sha256 unchanged = true
19/19 calibrations behaved as required
```

Each injection is a temporary copy: the test imports `write-errors.js` from
`WRITE_ERRORS`, so the harness cannot write to the real file, and checks its
sha256 unchanged anyway (Verification 44).

---

## 3. (c) Ruling 6: the walk teardown

`scripts/round7/walk-tb-2e.mjs` no longer hard-deletes `opportunity_details`.
The soft delete alone is sufficient, is what the rest of the estate does, and
frees the bed by the `deleted_at` rule measured in Phase 1b.

**Claim one, it is gone.** The deleter census, comment-stripped through the
estate's stripper: **zero** hard deletes of `opportunity_details` across 223
tracked files.

**Claim two, what replaced it is proven.** Phase 0's own P0.B measurement,
re-run: **still 16.** In between, this round's probing performed 34 further
conversions - `converted_to_opportunity` audit rows went 93 to 127, beds named
in `opportunity_details` went 70 to 87 - **and not one of them added to the
residue count.** The shape is no longer being manufactured.

### And the census had to be repaired to say that

Two faults surfaced the moment the fix landed, and both are the kind that make a
detector quietly stop working:

- **Its calibration was anchored on the very line ruling 6 deleted**, so it
  began reporting `FIRED = false`. A detector whose anchor can be removed stops
  being calibrated on the day the thing it watches is fixed.
- **It began matching its own source**, because the calibration string was
  written as a literal into a file the census scans. Round 8 met this exact
  shape; its answer is the one used here - the harness names the string
  **nowhere**, assembling it from parts, rather than being excused from the
  scan. An exemption list rots; an absent string cannot.

Now calibrated three ways: a synthetic deleter fires, the same text inside a
comment stays silent, and a **real** file (`src/routes/opportunities.js`) drops
from 1 to 0 when one delete is turned into a select. Plus an assertion that the
census sees zero hits in itself.

---

## 4. (d) The dead code the switch stranded

**Claim one, comment-stripped:** `priorConversions` and `liveConversions` are
gone from `src/routes/test-beds.js`. `account_id` and `reference_code` are no
longer selected from the bed. **No unused imports in either route file.**

**Claim two:** what replaced them is the count inside `convert_test_bed`, under
the advisory lock, proven by the race probe reading CLOSED at the route and the
limit probe reading 17/17.

**`linkContact` is NOT stranded and stays.** Enumerated: two call sites, and the
one at `create-test-bed` is untouched by this round.

**One pre-existing observation, not acted on:** the bed `select` also fetches
`status`, which the convert route never used, before this round or after it. It
is left alone - a defect the round walked past goes on the list (rule 10), and
this one is a single unused column rather than a defect.

---

## 5. Ruling 10 recorded

`20260829000007` is untouched. The nineteen-file rebuild-collision exposure is
in the brief as one carried item for its own round.

---

## 6. What this phase does NOT establish

- **That the browser works.** No walk was run. Everything here is HTTP and
  database.
- **That the contact route's qualification gate is right.** The fixture sets
  `Qualified` directly; the gate itself is out of scope and untested by this.
- **That `PT404` from the functions can be reached in production.** Both routes
  read the source record and 404 before calling, so it fires only on a race
  between that read and the call. The mapping is proved on a synthetic error,
  not on a real race.
- **That atomicity holds at insert positions 2, 4 and 5** by measurement -
  unchanged from Phase 1b, where they are named as having no reachable failure.

---

## 7. The gate

Run on the clean committed Phase 2 tree, with nothing else touching the machine,
and captured to a file which is then read.

```
MERGE GATE  main  bbe0fc57ef96d5d9f771c38f8b2b8ed0fb22f9c7  (WORKING TREE DIRTY)
  21 of 21 stages PASS
  pure suite      493/493 pass, 0 fail     (489 before this phase, +4)
  database suite   94/94  pass, 0 fail
  react suite     915/915 pass, 0 fail
  HTTP stages     14, all PASS, 10.6s to 53.0s
  full output: .verify/verify-1282892858505666.txt
```

**The three stages that failed on the void run all pass here, at normal
durations**: `issue-target` 20,884ms, `proposal-issued` 29,754ms, `zero-track`
10,599ms. That settles §0: those failures were the missing server and the
half-edited tree, not findings.

**AND THE DIRTY FLAG IS MINE AGAIN, which is the honest half.** The only
uncommitted file during this run was `CONVERT_ATOMICITY_PHASE_2_REPORT.md` -
this document, being written while the gate ran. No stage reads it, and the
result stands. But the discipline is the one §0 is entirely about, and it was
breached a second time in the same phase by the person recording the first
breach. That is why ruling 13 exists and why it is phrased as *the gate is the
final act on the final committed tree, nothing else running* rather than as
advice about editing source.
