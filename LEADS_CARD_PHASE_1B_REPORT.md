# Phase 1b: the conversion proven, and Phase 1 closed

Both migrations applied by John. Everything below is measured
independently over PostgREST, **never on the report**. Nothing pushed.

`scripts/leads-card/probe-qualify-conversion.mjs`, **15/15**.

---

## Identity, stated first

Every call to `qualify_contact` goes through a **real user JWT**. The
service role builds fixtures and reads state back for assertions and
**never exercises the function** - it is `security invoker`, so a
service-role call carries no `auth.uid()` and would prove nothing about
the rule it enforces.

**Both identities are checked live before anything is claimed**, because
a dead token refuses everything, which reads exactly like a working rule:

```
identities live: owner john+test@..., non-owner john+test2@...
the non-owner is a DIFFERENT real account: 23216963 vs owner 266a2812
```

---

## 1. The supersession

| check | result |
|---|---|
| the gate carries 14 rules | 14 |
| `parent_record_id` is gone | absent from the 14 |
| the 14 map exactly to Contact 8 + Address 5 + Summary 1 | exact match, sorted |
| **a complete lead with NO account link is NOT blocked** | `parent_record_id=null`, `blocking=[]` |
| the gate instrument discriminates | complete lead **0** blocking; bare lead **13** |

The last line is what makes the one above it evidence. **Two probe
faults were caught by it**, and both would have been invisible without
it:

- The first run passed `computeBlocking` an **empty payload**, so every
  field blocked on every lead - 14 and 14. A reader that always says
  "blocked" cannot show anything is unblocked.
- Corrected, the complete lead still blocked on **one** field:
  `industry_id`. It is a **real column on `records`**, not a payload
  key - `RECORD_COLUMN_FIELDS` says so and the gate reads the row for
  it. My fixture had put it in the payload, the way it reads on a form.
  **Verification 47 exactly: a fixture shaped to my assumption rather
  than to how the system produces the state.**

---

## 2. Atomicity

| check | result |
|---|---|
| a failed account step writes NOTHING | HTTP 404 `account not found`, fingerprint unchanged |
| **a failed status flip leaves NO ORPHAN ACCOUNT** | HTTP 423, accounts **5 -> 5**, orphans named: **0** |
| and the lead is untouched by the failed conversion | `Unqualified`, `account null`, revisions unchanged |
| the owner CAN qualify, creating and linking the account | HTTP 200, `Unqualified -> Qualified`, accounts 5 -> 6, revisions 1 -> 2 |
| the conversion wrote its audit row | `contact:qualified` |

### The failure was injected with a real guard, not a fabricated one

The load-bearing case is a failure **after the Account exists inside the
same transaction**. This session cannot apply DDL, so no temporary
trigger was available - and none was needed.

**An open `transition_requests` row freezes a record**, and
`records_frozen_trg` refuses every write to it including the function's
own `UPDATE`. So the account insert succeeds, the status flip raises
**PT423**, and the transaction rolls back - taking the account with it.
Measured: **accounts 5 before, 5 after, zero rows named
`p1bconv Orphan Account Check`.**

**The success path is what stops all of that proving only that the
function refuses things.** A gate made entirely of refusals is satisfied
by a function that refuses everything.

---

## 3. Identity and ownership

| check | result |
|---|---|
| a real non-owner JWT is REFUSED, ownership-shaped | **HTTP 403** *"This record belongs to another user..."* |
| and the refusal wrote nothing | fingerprint unchanged |
| the non-owner is a different real account | `23216963` vs `266a2812` |

The refusal is asserted by its **reason**, not merely by a 4xx: a
refusal for another cause - a bad body, a missing record - would have
proved nothing about ownership.

---

## 4. R8: cancel leaves nothing

| check | result |
|---|---|
| a cancelled account step leaves zero new records | fingerprint identical, status `Unqualified`, account `null` |
| **and the lead is still qualifiable afterwards** | HTTP 200, `Unqualified -> Qualified` |

**The first line alone is nearly a tautology** and is reported as such:
it fingerprints twice with nothing in between, and "nothing happened" is
what it must show. The second line is what makes it a measurement -
**abandoning a qualification must leave a lead that can still be
qualified**, not merely one whose row is unchanged. A cancel that quietly
froze the record or consumed something would pass the first and fail the
second.

**What it does not establish:** the cancel path has no UI yet. This
proves the server-side guarantee - no call, no write, nothing consumed -
which is the half that can exist before the card does. The button is
Phase 2.

---

## 5. Two guards fired on this work, and both were right

**`config-invariants`** caught the migration's React-side reader:
`GATED_AT_QUALIFY` still listed `parent_record_id`, and the test named
the file and the fix. Reconciled, and the arithmetic assertion moved with
it - the group that loses a member is **the card**, which is now empty,
so `asCard` is `[]` rather than the count being quietly reduced.

**The fetch guard** caught this probe calling `fetch` directly - the
**second** time it has caught me. The need was real: an identity
counterfactual needs a second user's JWT, and `api()` reads one session
file and prefixes `/api`, while a `security invoker` function lives at
PostgREST's own `/rpc`.

**So the CLIENT gained the capability rather than the probe gaining an
exemption**, which is the same choice the last round made and for the
same reason: a by-name allowlist is the enumeration Verification 19 warns
about. `rpcAs` and `sessionIsLive` are now in `api-client.mjs`, and the
allowlist is unchanged at two.

**And the refactor immediately broke a check, which is the right
direction.** My local helper returned `{status, body}` and the client
returns `{status, ok, data}`; the ownership check read `.body.message`,
found nothing, and **failed** rather than passing on an empty string.

---

## 6. Residue, and something worth reporting

**No residue from this phase.** Enumerated from the database: nine
fixtures soft deleted, **zero live records carrying any probe tag**.

**But the live count moved for a reason that is not mine, and it is good
news.** `walk65` gained three contacts at `2026-09-11T23:46`, thirteen
seconds apart: *"Tom Cat / Warner Borthers"*, *"Mickey Mouse / Disney and
co"*, *"Wade Bhatti / Home Hunt"*.

**Three rows in one batch is the New Lead grid's signature.** That is a
real person using P5's grid in a real session, and as far as this record
shows it is the first time. Left alone - it is John's data, not fixture
residue.

---

## 7. Suites

| suite | result |
|---|---|
| pure | 519/519 |
| react | 939/939 |
| database | 100/100 |

---

## 8. What Phase 1 leaves for Phase 2

- **No route calls `qualify_contact` yet.** The function is proven;
  nothing reaches it from a screen.
- **R7's `LinkAccountPanel` reuse is unbuilt.** The panel exists and
  works on Lead Detail; wiring it as the account step, and moving its
  three writes inside the function, is Phase 2.
- **R2's card is unbuilt**, by instruction - it renders on top of this.
- **R10 is recorded and not built**, per John's ruling: a round-close
  refuses a run where required stages did not run, as a future
  round-opening act.
- Lead Detail is **untouched** (R4).
