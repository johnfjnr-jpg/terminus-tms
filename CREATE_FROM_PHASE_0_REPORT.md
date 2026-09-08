# Create-from ownership, Phase 0: the shape sweep

**The shape is wider than the three known paths. Six instances land.**

---

## The in-scope list for Phase 1

| # | path | non-owner | owner | evidence |
|---|---|---|---|---|
| 1 | `POST /test-beds/:id/convert` | **201** | 201 | `69947943` (probe round) |
| 2 | `POST /contacts/:id/create-test-bed` | **201** | 201 | `745cd214` (probe round) |
| 3 | `POST /contacts/:id/create-opportunity` | **201** | 201 | `ee047aca` (probe round) |
| 4 | `POST /test-beds/:id/customer-documents` | **201** | 201 | `7d04bf64` — **new** |
| 5 | `POST /test-beds/:id/complete-document` | **201** | 201 | `39a14a4c` — **new** |
| 6 | `POST /test-beds/:id/units/derive` | **200** | 200 | **2 unit records**, incl. `e548e77a` — **new** |

**Three more than the ruling anticipated.** R1 said the shape closes, not just
the three paths, and the sweep is why that phrasing mattered.

**Number 6 is the most invasive.** `units/derive` created **two unit records
attached to another owner's Test Bed**. Units are children of their bed and
appear in the owner's own unit list, so a non-owner can populate somebody's bed
with hardware slots they did not create.

Numbers 4 and 5 each attach a **document record** to another owner's bed.

## Create-from shape, already refusing — no Phase 1 work

| path | why |
|---|---|
| `POST /opportunities/:id/deal-sheet-versions` | fixed by the write authorization round; **403** |
| `POST /records/:id/transition-requests` | fixed by the same round; **403** |
| `POST /contacts/:id/link-account` | proven MATCH in the probe round; **403** |

## Create-from by design — not a defect

| path | why |
|---|---|
| `POST /transition-requests/:id/approvals` | **approvers endorse.** A non-owner acting on somebody's record is the whole point, and `decide_transition_request` enforces the approver rules. Named so a later reader does not sweep it in |

---

## The classifier, and its two failures

**The narrow test** — path carries `:id` AND the body inserts a `records` row or
calls an RPC — returned **9 of 40** routes and was precise.

**It missed one.** `units/derive` creates through a helper:
`deriveMissingUnitSlots(db, bed.id, counts, request.user.id)` inserts the units
in `src/lib/units.js`, invisible to a body-local scan. **Found by reading the
route, not by the instrument** — and it turned out to be the most invasive of
the six.

**Widening it over-fired.** Keying on "passes `request.user.id` to a helper"
took the count from 9 to **29 of 40**, sweeping in every ordinary update —
`PATCH /accounts/:id`, `PATCH /contacts/:id` — because almost every route hands
an actor id to an audit or revision writer. That is not the shape: the shape
needs a NEW record whose source is a DIFFERENT record.

**So the list above is the narrow nine plus one read by hand, and that is stated
rather than presented as a clean sweep.** A route creating through a helper this
scan does not know about would still be missed. The honest bound: **every route
that inserts a `records` row in its own body is covered; helper-mediated creates
are covered only where a person looked.**

---

## Method notes

Every result has an owner counterfactual that succeeded, so no row is a refusal
about something else. Fixtures were built through the real API and handed to a
second `auth.users` id by admin write — Verification 47's clause. New rows on
the source were **counted before and after**, not inferred from the status:
that is how `units/derive` was scored, since it returns 200 with a body rather
than a 201.

**No landing fell outside the create-from shape**, so the stop rule did not
fire.

---

## Evidence kept

The three new landings join the probe round's three under R3's positive control:
`7d04bf64`, `39a14a4c`, and the two units from the `units/derive` call. Their
deletion is proposed at this round's close.

---

## What this phase does NOT establish

- **That the list is complete.** The classifier's helper blind spot is real and
  named above.
- **What the fix is for `units/derive`.** It is not a create-from-a-source in
  the same sense as the others: deriving slots is arguably part of maintaining
  the bed, so ownership of the bed is the natural rule, but that is a ruling.
- **Whether documents attached by a non-owner are visible to the bed's owner**
  — likely, since they are children of the bed, but not measured.
- **Anything about the UI.** All six were measured over HTTP.
