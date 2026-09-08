# Sibling surfaces, Phase 0: the complete results table

R6 resumed the probe. **Every named path is now measured.** No new landing.

---

## The table

| path | owner | non-owner | verdict against the map |
|---|---|---|---|
| `PATCH /test-beds/:id` | 200 | **403** | **MATCH** |
| `POST /test-beds/:id/measurability` | 201 | **403** | **MATCH** |
| `POST /test-beds/:id/buyer-contacts` | 201 | **403** | **MATCH** |
| `POST /test-beds/:id/tech-team` | 201 | **403** | **MATCH** |
| `POST /test-beds/:id/scores` | 201 | **403** | **MATCH** |
| `PATCH /test-beds/:id/units/:unitId` | 200 | **403** | **MATCH** |
| `PATCH /contacts/:id` | 200 | **403** | **MATCH** |
| `POST /contacts/:id/link-account` | 200 | **403** | **MATCH** |
| `POST /opportunities/:id/key-contacts` | 201 | **403** | **MATCH** |
| `DELETE /opportunities/:id/key-contacts/:linkId` | 200 | **403** | **MATCH** |
| `PATCH /accounts/:id` | 200 | **403** | **MATCH** — see §1 |
| `POST /test-beds/:id/convert` | 201 | **201** | **RULED OWNER-ONLY, R5** — fix round |
| `POST /contacts/:id/create-test-bed` | 201 | **201** | **RULED OWNER-ONLY, R5** — fix round |
| `POST /contacts/:id/create-opportunity` | 201 | **201** | **RULED OWNER-ONLY, R5** — fix round |

**Eleven MATCH.** Every one has an owner counterfactual that succeeded and a
refusal that is ownership-shaped rather than any 4xx. **Three landings**, all
create-from paths, all ruled owner-only under R5 and going to a fix round.

**The write authorization round's policy fix carries to every sibling path that
writes to an existing record.** That was an argument from shared shapes; it is
now a measurement.

---

## 1. `PATCH /accounts/:id`: the brief's premise was wrong, not the map

My probe first labelled this **"GAP vs the map"**, because the brief says *"the
map says accounts are team-editable by design"*. **The map says no such thing.**

`WRITE_AUTH_PHASE_0_REPORT.md:56` reads:

```
| `records` | UPDATE | **OWNERSHIP** | `auth.uid() = owner_id` |
```

An Account is a `records` row, so the map already had it as **owner-only, and
verdict MATCH**. The measurement — owner 200, non-owner 403 — **confirms the
map** and contradicts the brief's sentence about it.

**Reported rather than resolved quietly**, per the estate's rule about a
hand-written document disagreeing with a measured one: the disagreement is the
finding. The verdict is MATCH; the brief's R1 needs correcting if this round's
record is to stay true.

---

## 2. A modelling observation worth the fix round's attention

**Owning a Test Bed and owning its units are separate.** Units are `records`
rows in their own right, owned by whoever calls `units/derive`. Handing a bed to
another person leaves its units with the original owner.

Found because it made a probe run read as a landing: with the bed handed over
but the units not, `PATCH .../units/:unitId` answered **200** — and
`records_update` was **correct** to permit it, because I still owned the unit.
With the unit handed over too: **403**, and the state did not change.

**Not a security hole** — each record is enforced correctly. But a bed's owner
may be unable to edit their own bed's units, and the fix round should know.

---

## 3. Six fixture faults in my own probe, all found by the owner counterfactual

Every one produced a NOT PROBED or a false verdict that said nothing about the
route. **The owner-run-gates-the-result rule caught all six**, which is the
argument for it:

| fault | what it produced |
|---|---|
| `mkContact` returns an id; I read `.id` off it | `POST /contacts/undefined/...` → 404 |
| a criterion key that is not a `test_bed` criterion | 400 both sides |
| `criterion_key` where the body wants `criterion` | 400 both sides |
| `level: 'Buyer confirmed'` where it wants `score: 4` | 400 both sides |
| `sensorCount` where `units/derive` wants `safesightCameras` | no unit derived |
| a `contact_roles` row that was retired; a contact on the wrong Account; a bodyless DELETE | 422, 422, `FST_ERR_CTP_EMPTY_JSON_BODY` |

**Each was read off the route's own refusal rather than guessed again.** Without
the owner run, six paths would have been reported as refused-therefore-safe.

---

## 4. Evidence kept under R7

| id | what |
|---|---|
| `69947943-e1b6-4877-81e6-0473cab37170` | Opportunity created by a non-owner from another's Test Bed |
| `745cd214-0bb6-4fa7-8ccb-f9584a1d88e6` | Test Bed created by a non-owner from another's Contact |
| `ee047aca-d988-4b39-a222-e5f02195fc09` | Opportunity created by a non-owner from another's Contact |
| the audit rows on the three source records | including `converted_to_opportunity` on bed `a454f40e`, owned by `ff836462` |

Kept until the fix round calibrates against them; deletion proposed at that
round's close.

---

## 5. What this does NOT cover

- **Opportunity create-from paths** were not in this brief's list and were not
  examined. If the same shape exists there, it is unmeasured.
- **The brief's item 2 sweep** — every write route on these surfaces either
  probed or named — is done for the named list but was not re-derived from the
  route census, so a path nobody listed could still be missing.
- **Fixture teardown.** Nothing from this round has been torn down; it is a
  counted change for the close.
- **Whether the three landings are reachable through the UI.** They were
  measured over HTTP; no screen was opened.
