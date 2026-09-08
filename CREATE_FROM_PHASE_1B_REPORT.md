# Create-from ownership, Phase 1b and Phase 2: report

Migration `20260908000003` applied by John via `db push`. Nothing pushed.

## 1. A CORRECTION TO THE SIGNED-OFF PHASE 1 REPORT

**The "audit-row anomaly" does not exist, and it was my measurement error.**

Phase 1 reported that the other-owned source records carried zero `audit_log`
rows, against the brief's statement that a non-owner conversion makes the
source's audit history gain a row, and queued it as a carried item.

The query selected `audit_log.created_at`. **That column does not exist**; the
columns are `id, record_id, record_type, action, actor_id, timestamp, detail`.
PostgREST returned an error, `data` came back `null`, and my `audit ?? []`
turned the null into an empty array. The zero was the error.

**Verification 8, in my own probe**: every Supabase call has its `error`
checked. A read whose error is unchecked is at least visibly empty - unless a
`?? []` dresses it as a measurement, which is what happened.

Measured with the error checked, on the same population:

    AUDIT ROWS on the 12 records owned by the probe account: 18
      converted_to_opportunity  1
      created                  12
      created_opportunity       1
      linked_account            4

`converted_to_opportunity` and `created_opportunity`, one each, are precisely
the two Phase 1 non-owner landings, recorded on the sources they took from.
**The brief's defect statement is correct and was never in doubt.** The carried
item is withdrawn rather than carried.

The census now checks every error and derives its sentence from the count
instead of stating it as a literal (`scripts/create-from/evidence-census.mjs`).

## 2. Phase 1b: 6/6, both directions

Same probe binary, same tree, before and after John's push:

| path | owner | non-owner (before) | non-owner (after) |
|---|---|---|---|
| `customer-documents` | 201 | 403 | **403** |
| `complete-document` | 201 | 403 | **403** |
| `units/derive` | 200 | 403 | **403** |
| `contacts/:id/create-test-bed` | 201 | 403 | **403** |
| `test-beds/:id/convert` | 201 | **201 landed** | **403** |
| `contacts/:id/create-opportunity` | 201 | **201 landed** | **403** |

**The flip is the proof the migration took.** Nothing on this side changed
between the two runs: no code, no restart, no probe edit. Two paths went from
admitting a non-owner to refusing one, which only the database can have done.

Refusals asserted ownership-shaped, not merely 4xx. Owner column asserted
throughout, because the reverted near-miss would have scored six refusals
while locking every owner out.

## 3. The flows that had to survive: 7/7

`scripts/create-from/probe-flows-unchanged.mjs`

    PASS  the owner's first convert succeeds                   201
    PASS  the SECOND convert refuses on the allowance          422
    PASS  the allowance refusal is NOT ownership-shaped
    PASS  the owner links an Account                           200
    PASS  the owner qualifies their own contact                200
    PASS  the owner creates a Test Bed from it                 201
    PASS  the owner creates an Opportunity from it             201

The allowance check is the one that matters most: the new guard sits directly
above the conversion count, and a guard that displaced it would still look
like a refusal. It refuses on `PT422` with the allowance's own message, and
that message is asserted **not** to be ownership-shaped.

**Three failures on the way, all my fixture, none a regression**, and each was
named by the refusal itself rather than diagnosed:

- `PATCH /contacts/:id {status}` answered *"body must contain payload or
  industry_id"*. A PATCH does not move a stage; `POST /records/:id/transition`
  does, which is what `scripts/fixtures.mjs:154` already uses.
- The transition then refused, naming `summary` as the unmet requirement.
- The contact fixture was built with six of the gate's thirteen
  `payload_field_required` fields. Rebuilt from `stage_gate_rules` read out of
  the database rather than guessed (Verification 47), it qualifies through the
  front door - a better fixture than Phase 1's admin write.

The write authorization round's two named flows, unchanged:

    probe-pricing-approval   15/15   27s
    probe-commercial-gate    11/11   27s

Both at normal durations, not the ~130ms environment signature.

## 4. FINDING: a gate probe silently applied a data change

**66 of this round's 78 evidence records were soft-deleted in one bulk update
at `2026-09-08T12:05:56.949+00:00`** - a single timestamp across all 66, so
one statement, not a per-fixture teardown.

The cause is `tearDown()` in `scripts/fixtures.mjs:246`:

    .eq('owner_id', TEST_USER_ID).is('deleted_at', null)

It enumerates **every live record owned by the test account**, not the
fixtures its caller created. Its own comment calls this a "complete set by
construction", which is a category name asserting a property nobody measured
(Verification 19): it is complete only while nothing else owns live records,
and this round owned 66.

**Why it matters beyond this round.** The estate's method is that data changes
are proposed before they are applied. This one is applied by any gate run, to
any live fixture, with no proposal and no report - `probe-commercial-gate`
printed `2 soft-deleted` while 66 went. The sibling round's R7 evidence and
the write authorization round's R2 row were both "kept" under exactly this
exposure.

**Not fixed here.** Under rule 10 a control finding goes on the list unless it
is destroying live data; these are test-account fixtures, and the fix - scope
the teardown to a tag the fixtures carry - is Verification 11's own remedy and
belongs in a round that scopes it. **Recorded, scoped, queued.**

## 5. Evidence teardown, proposed

The proposal is now mostly moot, for the reason above.

| tag | live | already soft-deleted |
|---|---|---|
| `cf1b-flows` | 0 | 22 |
| `cf1b-r0` | 6 | 23 |
| `cf1b-r1` | 6 | 21 |

**PROPOSED: soft-delete the 12 remaining live records.** All 12 are owned by
the probe account, which is why they survived the sweep. Soft delete only; no
`reference_number_counters` row touched (Verification 11). Not applied - this
awaits John's word.

## 6. Coverage, and a disagreement between two documents

The sibling round's close records **18 of 40** write routes exercised as a
non-owner. This round adds the create-from six, of which three were already in
that 18 (convert, create-test-bed, create-opportunity - the sibling round's
three landings).

**The other three disagree between documents, and the disagreement is the
finding rather than something to resolve quietly.** `SIBLING_SURFACES_CLOSE_OUT.md`
lists `complete-document` as **proven (R9 last round)**; this round's Phase 0
report measured it as **new**. Both are defensible and they are about different
things: R9 proved the `document_details` **table** in both directions, and this
round exercised the **route** as a non-owner for the first time. The close's
table conflated the two.

Reading it as the route, which is what "routes exercised" counts:

**21 of 40 exercised as a non-owner, 19 remaining.** The newly covered three
are `customer-documents`, `complete-document` and `units/derive`.

## 7. What this does NOT establish

- Nothing about the 19 routes still unexercised as a non-owner.
- The teardown finding is measured but unfixed, and every future gate run
  will keep applying it.
- Concurrency is not measured on any of the six paths and was not claimed.
- The gate result is stated separately below; this section predates it.
