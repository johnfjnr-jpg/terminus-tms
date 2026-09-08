# The sibling surfaces probe round: close-out

**A probe round. No source, schema or policy change — measured, not asserted:
`git diff src/ supabase/` over the round is empty.**

Its deliverable was to convert an argument into a measurement. The write
authorization round fixed what it proved and proved what it fixed, and then
claimed the sibling surfaces were safe *because the policies are shared*. That
is an argument. This round measured it.

---

## 1. The result

**Fourteen paths measured. Eleven MATCH, three landings.**

Every MATCH has an owner counterfactual that succeeded and a refusal that is
**ownership-shaped**, not merely a 4xx: `PATCH /test-beds/:id`, `measurability`,
`buyer-contacts`, `tech-team`, `scores`, `units/:unitId`, `PATCH /contacts/:id`,
`link-account`, `key-contacts` and its `DELETE`, and `PATCH /accounts/:id`.

**The argument held for every path that writes to an existing record.** It did
not hold for three that create a new one.

### The three, ruled owner-only under R5

`convert`, `create-test-bed`, `create-opportunity`. **The new record is owned by
the caller, not the victim** — nobody's record was edited, which is a different
shape from the last round. But each reaches into the source record: `convert`
writes `converted_to_opportunity` into another owner's audit history, **consumes
the bed's single conversion allowance**, and takes its reference code; the two
contact paths write an audit row onto the source contact.

Ruled owner-only, handed to a fix round, evidence kept.

---

## 2. Reconciled by counting

| | |
|---|---|
| rulings | **10** (R1–R10), no gaps |
| commits | **7** before this one |
| ruling artefacts | **9/9** |
| paths measured | **14** — 11 MATCH, 3 ruled |
| `src/` and `supabase/` diff | **empty** |
| files added | 6, all probes and reports |

**R9's check read MISSING and the artefact was there.** The brief wraps
*"unit write rights"* across a line, and the pattern required a single space —
the same whitespace-intolerant match that produced a false MISSING in the convert
round's reconciliation. Re-checked across the wrap: present.

---

## 3. Two corrections the round made to its own record

**R8: the brief was wrong about the map.** R1 said *"the map says accounts are
team-editable by design"*. The map says `records | UPDATE | OWNERSHIP`, an
Account is a `records` row, and the measurement agrees — 403 ownership-shaped.
**The map's verdict stands and the brief's sentence is struck in place**, the
superseded wording left visible.

My own probe carried the error forward, labelling the row *"GAP vs the map"*
because it trusted the brief's account of the map rather than reading the map.
**Verification 31's shape: read the decisions, not the description of them.**

**R9: unit ownership is queued.** Units are `records` owned by whoever derives
them, so a handed-over bed leaves its units behind and **a bed's owner may be
unable to edit their own bed's units.** Not a hole — each record is enforced
correctly — and it surfaced only because it made a probe run read as a landing.
Provisional direction recorded: unit write rights follow the parent bed's owner.

---

## 4. Six fixture faults, all mine, all caught the same way

A contact id read as an object · a criterion key that does not exist ·
`criterion_key` for `criterion` · a level label where a 1–5 score belongs ·
`sensorCount` for `safesightCameras` · a retired role, a contact on the wrong
Account, and a bodyless DELETE.

**Every one produced a NOT PROBED or a false verdict that said nothing about the
route, and every one was caught by the rule that the owner run gates whether the
non-owner result counts.** Without it, six paths would have been reported as
refused-therefore-safe — which is exactly how the write authorization round's
first probe nearly reported three worthless refusals.

**And one landing was a fixture fault too**: `units/:unitId` read as a 200
because I handed over the bed and not its units, and `records_update` was
*correct* to permit that write. Checked before reporting, per the standing
discipline; with the unit handed over it answers 403.

---

## 5. WHAT REMAINS UNEXERCISED AS A NON-OWNER, ANYWHERE

The point of the close, so the map's proof coverage is explicit from here.

| surface | state |
|---|---|
| **Opportunity write paths** | `PATCH /opportunities/:id`, version save, version issue, transition request, `document_details` — **all proven** in the write authorization round |
| **Test Bed and Contact write paths** | **all proven here**, 11 MATCH |
| **Opportunity create-from paths** | **UNEXERCISED.** Not in this brief's list. If the create-from shape ruled under R5 exists there too, nobody has measured it |
| `close-date-move`, `probability-override`, `assessment-reviewed`, `close-lost`, `scores` on Opportunity | **UNEXERCISED** as a non-owner |
| `transition-requests/:id/approvals` and `/withdraw` | **UNEXERCISED**; the approver path is proven by the gate probes, the *withdraw* path is not |
| `POST /test-beds/:id/complete-document`, `customer-documents` and its DELETE | `complete-document` **proven** (R9 last round); the other two **unexercised** |
| `POST /records` | **retired**, so nothing to exercise |
| Account creation, Contact deletion | **UNEXERCISED** |

**The route census counted 40 write routes. This round and the last together
have exercised 18 of them as a non-owner.** That is the honest coverage figure
and it belongs in the record rather than a claim that the estate is proven.

---

## 6. Carried items

| item | note |
|---|---|
| **The fix round** for the three create-from paths, ruled owner-only | R5; evidence kept under R7 for its calibration |
| **Unit ownership**, with its provisional direction | R9 |
| **The parked UI hygiene round** — now unblocked on both counts: the door's enforcement is proven on every surface it guards | |
| **22 write routes still unexercised as a non-owner**, itemised above | |
| The convert round's four, unchanged | |
| **This round's fixtures are not torn down.** The three evidence records are kept under R7; the rest are a counted change proposed for the fix round's close | |

---

## 7. What this close does NOT cover

- **The 22 unexercised routes** in §5 — the largest gap, itemised rather than
  glossed.
- **The brief's item 2 sweep** was done against the named list, not re-derived
  from the route census, so a path nobody listed could still be missing.
- **No walk.** Everything was measured over HTTP; no screen was opened.
- **Whether the three landings are reachable through the UI.**
- **Teardown**, deliberately deferred so the fix round can calibrate against
  live evidence.
