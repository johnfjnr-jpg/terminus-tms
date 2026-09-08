# Sibling surfaces, Phase 0: STOPPED — three non-owner writes landed

R1's stop condition fired. **Nothing has been fixed and no scope has been
re-ruled.** Ids below.

---

## The results table

| verdict | path | owner | non-owner |
|---|---|---|---|
| **MATCH** | `PATCH /test-beds/:id` | 200 | **403** |
| **MATCH** | `POST /test-beds/:id/measurability` | 201 | **403** |
| **MATCH** | `POST /test-beds/:id/buyer-contacts` | 201 | **403** |
| **MATCH** | `PATCH /contacts/:id` | 200 | **403** |
| **MATCH** | `POST /contacts/:id/link-account` | 200 | **403** |
| **LANDED** | `POST /test-beds/:id/convert` | 201 | **201** |
| **LANDED** | `POST /contacts/:id/create-test-bed` | 201 | **201** |
| **LANDED** | `POST /contacts/:id/create-opportunity` | 201 | **201** |
| NOT PROBED | `POST /test-beds/:id/tech-team` | 422 | 422 |
| NOT PROBED | `PATCH /accounts/:id` | 400 | 400 |

**Five MATCH results are real**, each with an owner counterfactual that
succeeded and a refusal that is ownership-shaped rather than any 4xx. The write
authorization round's policy fix carries to the sibling surfaces on every path
that writes to an existing record.

---

## The three that landed, with ids

**All three are CREATE-FROM paths**, and that is the whole of what makes this a
question rather than a repeat of the last round.

| path | new record | owned by | source record | owned by |
|---|---|---|---|---|
| `convert` | `69947943-e1b6-4877-81e6-0473cab37170` opportunity | **me** | `a454f40e` test bed | `ff836462` |
| `create-test-bed` | `745cd214-0bb6-4fa7-8ccb-f9584a1d88e6` test bed | **me** | contact | `ff836462` |
| `create-opportunity` | `ee047aca-d988-4b39-a222-e5f02195fc09` opportunity | **me** | contact | `ff836462` |

**The new record is owned by the caller, not the victim.** Nobody's record was
edited. That is materially different from last round, where a non-owner wrote
onto somebody else's record directly.

### But each one does reach into the source record

Measured, not inferred:

- **`convert` writes `converted_to_opportunity` into the source bed's audit
  history** — a row on `a454f40e`, a record owned by `ff836462`, written by this
  account. Confirmed by a full-population sweep: **1** such row.
- **`convert` consumes the bed's conversion allowance.** `max_conversions` is 1,
  so a non-owner converting somebody's Test Bed **uses up the only conversion
  that bed will ever have**, and the owner's own later attempt is refused 422.
- **`convert` copies the bed's `reference_code`** onto the new Opportunity —
  `TT-SG-AIRPRT-518` here — which, per the convert round's own carried finding,
  cannot then be reused.
- **The two contact paths write an audit row onto the source contact**
  (`created_opportunity`, `created_test_bed`) and create a `record_contacts`
  link naming somebody else's contact.

**So the question is a product one and it is not obviously either way.** A
colleague converting a bed they can see may be exactly what the business wants.
It is also a way for one person to spend another's single conversion, take their
reference code, and leave a row in their record's history. **I have not assumed
an answer.**

---

## What is NOT probed, with the gate that blocks each

| path | why |
|---|---|
| `POST /test-beds/:id/tech-team` | the owner run itself is refused **422 "Set the Installer before choosing a Test Bed Tech Team"**. A real precondition; the fixture needs an installer account first |
| `PATCH /accounts/:id` | the owner run failed **400 "payload contains fields that cannot be set from this endpoint"** — my body, not the route. The Account row remains **unmeasured**, and the map's claim that accounts are team-editable by design is still unproven either way |
| `POST /test-beds/:id/scores` | **not reached.** The stop condition fired first |
| `PATCH /test-beds/:id/units/:unitId` | **not reached** |
| `POST /opportunities/:id/key-contacts` and its DELETE | **not reached** |

**Five of the brief's named paths are unmeasured**, and the brief's item 2
sweep — every write route on these surfaces either probed or named — has not
been done. Both are outstanding.

---

## One fault in my own measurement, recorded

The first sweep for "did anything land on a record I do not own" read the **40
most recent** audit rows and reported **0**. Fixture creation writes many audit
rows, so forty never reached the ones that mattered — and the per-record check
three lines above it had already shown a `converted_to_opportunity` on somebody
else's bed. **Two of my own checks disagreed and the smaller population was
wrong.**

Redone over the whole population with paging coverage asserted: **34,822 audit
rows by this account, 290 on records owned by somebody else.** Most are
legitimate history — this account created those records and then handed them
over, so its own creation audits stay. The one that is not is the convert row.

Verification 25's population clause, in my own instrument, for the second time
this session.

---

## Evidence kept

The three landed records are kept under the standing rule, with the fixtures
they were created from. Nothing is torn down: the probe stopped where it landed,
and the teardown is a counted change for the close once the round is re-ruled.

---

## What this phase does NOT establish

- **Whether the three landings are a defect or a design.** That is John's
  ruling, and it re-rules the round either way.
- **Anything about Account writes**, or `scores`, `units`, `key-contacts`,
  `tech-team`.
- **Whether the same shape exists on Opportunity** — `POST
  /opportunities/:id/...` create-from paths were not in this brief's list and
  were not examined.
