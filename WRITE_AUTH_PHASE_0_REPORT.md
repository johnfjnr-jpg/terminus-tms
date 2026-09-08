# Write authorization, Phase 0: the census and the entitlement map

Read-only against the code. The only writes are the probe writes the brief
authorises, and every one that landed is recorded below and kept under R2.

---

## 0. THE HEADLINE: three holes, all proven live, and the third moves records

The hygiene round stopped on one. There are three.

| # | path | result as a NON-OWNER | evidence |
|---|---|---|---|
| 1 | `POST /opportunities/:id/deal-sheet-versions` | **201** — a version is created on somebody else's record | `5f1517b2` (V0.2 draft) |
| 2 | `POST /deal-sheet-versions/:vid/issue` | **200** — a draft is **ISSUED**, V0.1 → **V1.0 issued** | `e975b27e` |
| 3 | `POST /records/:id/transition-requests` | **201** — and it **auto-approved and MOVED the record** | `0197a77d` |

**Number 3 is the serious one.** Record `e70d0755` was at **Qualification** when
it was handed to another owner. A non-owner raised a transition request on it,
the request is now `approved`, and **the record is at Solution Alignment.** A
person who owns nothing moved somebody else's opportunity to the next stage.

Number 2 is next: issuing is the act that makes a price official, and it needs
no approval and no ownership - only that the version is a draft.

---

## 1. Every write policy, in its FINAL state

`scripts/write-auth/policy-census.mjs`. **117 migrations replayed in filename
order**, because a naive grep returns every policy ever written including the
ones later dropped.

**Calibrated on the case that matters:** `records_select` was
`auth.uid() = owner_id` in `20260801000000` and was replaced with
`auth.uid() is not null` in `20260812000004`. The census resolves it to the
later, team-wide rule. A grep returns the first, which is the opposite answer.

**And the first version of this census was wrong**, recorded because the number
was the only thing that gave it away: it collected every CREATE in a file and
then every DROP, which inverts the estate's commonest idiom
(`drop policy X; create policy X;` in one migration). It reported 24 surviving
policies and 23 dropped, and put `records_select` in the dropped column. Applied
in statement order: **46 surviving, 14 write policies, 1 genuinely dropped.**

**A limit, stated:** `pg_policies` is not in `public`, so PostgREST cannot read
the live policy set - measured, `PGRST205`. Every policy claim here is
source-derived. Where a shape decides a verdict, the map says whether it was
also proven live.

### The 14 write policies by shape

| table | cmd | shape | predicate |
|---|---|---|---|
| `records` | INSERT | **OWNERSHIP** | `auth.uid() = owner_id` |
| `records` | UPDATE | **OWNERSHIP** | `auth.uid() = owner_id` |
| `record_revisions` | INSERT | **OWNERSHIP** | `created_by = uid AND uid = owner of record` |
| `opportunity_details` | INSERT/UPDATE | **OWNERSHIP** | `uid = owner of record_id` |
| `record_contacts` | INSERT | **OWNERSHIP** | `created_by = uid AND uid = owner` |
| `record_contacts` | DELETE | **OWNERSHIP** | `uid = owner of record_id` |
| `record_contact_stances` | INSERT | **OWNERSHIP** | `created_by = uid AND uid = owner via the link` |
| `audit_log` | INSERT | **IDENTITY** | `auth.uid() = actor_id` |
| `approvals` | INSERT | **IDENTITY** | `uid = approver_id AND request_id is null` |
| `transition_requests` | UPDATE | **GATE** | `requested_by = uid AND status = 'open'` -> `'withdrawn'` |
| **`deal_sheet_versions`** | **INSERT** | **IDENTITY** | `auth.uid() = created_by` |
| **`deal_sheet_versions`** | **UPDATE** | **GATE+OPEN** | `auth.uid() is not null AND status = 'draft'` |
| **`document_details`** | **ALL** | **effectively OPEN** | `record_id IN (SELECT id FROM records)` |

**24 of 34 RLS-enabled tables have no write policy at all** and are closed by
deny-by-default. That is a finding in the schema's favour and is named rather
than left to inference.

### The functions that write

| function | security | writes | reads `auth.uid()` | mentions `owner_id` |
|---|---|---|---|---|
| `raise_transition_request` | **DEFINER** | `transition_requests`, **`records`** | yes | **NO** |
| `decide_transition_request` | **DEFINER** | `approvals`, `transition_requests`, `records` | yes | **NO** |
| `insert_deal_sheet_version` | INVOKER | `deal_sheet_versions` | no | no |
| `convert_test_bed` | INVOKER | records, revisions, details, audit | yes | **yes** |
| `create_opportunity_from_contact` | INVOKER | + `record_contacts` | yes | **yes** |
| `apply_stage_probability`, `touch_record_freshness`, `close_superseded_reviews`, `issue_reference_number` | DEFINER | derived/system state | no | no |

**`raise_transition_request` is the mechanism behind hole 3.** A definer
function bypasses RLS entirely, and it checks identity but never asks whose
record it is. Architecture rule 12's own subject: *the more powerful the
executor, the less it may take on trust.*

---

## 2. Every write route: 40 across 9 files

`scripts/write-auth/route-census.mjs`. **15 of 40 carry no ownership guard in
the route itself**, which is correct wherever the policy behind the table is
ownership-shaped - a route need not restate what the database enforces.

**The census has known false negatives and is supporting context, not a
verdict.** `PATCH /opportunities/:id` reads as unguarded and is proven live to
answer **403**, because the refusal happens in `appendRecordRevision` and the
`42501` mapping, outside the route body the scanner slices. The map's verdicts
rest on policy shape plus live proof; the route census says where to look.

---

## 3. The live proofs

Every target was **constructed by this probe** and then handed to a second real
`auth.users` id by an admin write - Verification 47's clause, with the
migration's Round 5 as precedent. Nothing anybody else owns was touched. (The
hygiene round's probe wrote to walk65's real opportunity: right at the time,
and not right twice.)

### Proof A: version ISSUE — **NOT REFUSED**

Owner takes a draft, record changes hands, non-owner issues it.

```
issue as NON-OWNER -> 200
version e975b27e: V0.1 draft  ->  V1.0 ISSUED
```

The issue route's only precondition, read from source, is `status === 'draft'`.
No approval gate, no ownership check, and the update policy behind it permits
any authenticated caller.

### Proof B: approval REQUEST past the gate — **NOT REFUSED**

The hygiene round's attempt answered 409 "not ready" for **both** the owner and
the non-owner, so ownership was never reached. This one measures the gate
(`assessmentReviewed`), satisfies it **as the owner**, and only then hands over.

**And the first version of this proof repeated the same mistake.** It shared one
record between the counterfactual and the test, so the owner's raise moved the
record and the non-owner's attempt answered `400 "record is already in that
stage"` - a refusal about nothing, scored as a pass by a check that accepted any
4xx. Verification 14, one round after the round it caught. Split across two
records, with the refusal's **shape** asserted rather than its status class:

```
owner raises on its own record   -> 201   (the counterfactual)
request as NON-OWNER             -> 201
  transition_requests on that record: 0 -> 1
  the request is now `approved` and the record is at Solution Alignment
```

---

## 4. THE ENTITLEMENT MAP

**This is the deliverable, and it is a product decision.** Each row says who the
business rules should let write, what the policy actually says, and a verdict.

| table | who SHOULD write it | current policy | verdict |
|---|---|---|---|
| `records` | the owner only | OWNERSHIP | **MATCH** |
| `record_revisions` | the owner only | OWNERSHIP + self-signed | **MATCH** |
| `opportunity_details` | the owner only | OWNERSHIP | **MATCH** |
| `record_contacts` | the owner only | OWNERSHIP + self-signed | **MATCH** |
| `record_contact_stances` | the owner only | OWNERSHIP + self-signed | **MATCH** |
| `audit_log` | **any actor, signing their own row** | IDENTITY (`uid = actor_id`) | **MATCH** — named in the brief, and correct: an audit row is a statement about who did something, and an approver or a future non-owner actor must be able to write one |
| `approvals` | **an approver, who is by design NOT the owner** | IDENTITY (`uid = approver_id`) + the workflow rows via `decide_transition_request` | **MATCH** — named in the brief. Owner-only here would break the feature: the whole point is that somebody else signs |
| `transition_requests` UPDATE (withdraw) | the raiser, on their own open request | GATE (`requested_by = uid`) | **MATCH** |
| **`deal_sheet_versions` INSERT** | **the owner only** — a version is a priced snapshot of that owner's deal | IDENTITY (`uid = created_by`) | **GAP**, proven live |
| **`deal_sheet_versions` UPDATE (issue)** | **the owner only**, and arguably owner-plus-approval | GATE+OPEN (`uid is not null AND status='draft'`) | **GAP**, proven live. The wider of the two: it makes a price official |
| **`transition_requests` INSERT** (via `raise_transition_request`) | **the owner only** | DEFINER, identity-checked, **ownership never asked** | **GAP**, proven live, and it MOVES the record |
| **`document_details`** | the owner of the parent record | `record_id IN (SELECT id FROM records)` — and `records_select` is team-wide, so this is **any authenticated user on any record** | **GAP**, source-derived, **NOT proven live** |

**Two questions the map cannot answer and John should:**

1. **Should an APPROVER be able to issue a version?** The map says owner-only for
   issue because that is the conservative reading. If issuing is meant to follow
   approval, the rule is owner-or-approver and the policy shape differs.
2. **Should a non-owner ever raise a transition request?** Owner-only is assumed.
   If a manager is meant to be able to push somebody's deal forward, this is
   owner-plus-a-named-role and the fix is a different shape.

---

## 5. Evidence rows kept under R2, and the probe residue

**Kept, never deleted in passing. Disposition proposed at the close.**

| what | id | on record | state |
|---|---|---|---|
| version created by a non-owner (hygiene round) | `5f1517b2` | `29e98c46` (walk65's real record) | V0.2 draft |
| version **issued** by a non-owner | `e975b27e` | `a7178858` (probe fixture) | V1.0 issued |
| transition request raised by a non-owner | `0197a77d` | `e70d0755` (probe fixture) | **approved**, record moved to Solution Alignment |
| the owner's counterfactual request | `7e18db7e` | `ff81242a` (probe fixture) | expected, owner-raised |

**Probe residue, deliberate and larger than ideal:** 16 live records owned by
the test account (7 accounts, 7 contacts, 2 opportunities) and **5 opportunities
handed to `ownership-other@terminus-probe.invalid`**. Teardown was suppressed
because R2 keeps what lands, and three probe runs each built fixtures. Only the
four rows above are evidence; the rest are incidental and should be torn down at
the close. **Only `29e98c46` is somebody's real record** - the other four are
fixtures this round built.

---

## 6. What this phase does NOT establish

- **The live policy set.** `pg_policies` is unreadable from here. Every policy
  claim is source-derived from the migrations replayed in order.
- **`document_details` is a GAP by reading, not by probe.** It is the one verdict
  with no live proof behind it.
- **Whether the three holes have ever been exploited.** Nothing was measured
  about historical rows; the evidence rows are this round's own.
- **The other 25 write routes.** The census classifies them; only the four
  named paths were exercised live.
- **Test Bed and Contact equivalents.** Only Opportunity paths were probed. The
  policies are shared, so the shapes carry, but the routes were not exercised.
- **Anything about the parked hygiene round's door work**, which resumes after
  this round per R1.
