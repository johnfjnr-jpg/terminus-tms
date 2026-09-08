# Write authorization, Phase 1b: the calibration

The migration is applied. **13 of 13**, and every refusal is ownership-shaped.

---

## 0. The preflight is the state change

```
preflight: a non-owner insert answers 403 - the migration is applied
```

The same call answered **201** before the push. That one line is the round's
result in miniature.

---

## 1. REFUSED: the three writes that landed, replayed

| # | write, as a NON-OWNER | before | after |
|---|---|---|---|
| 1 | version INSERT | 201 | **403**, ownership message |
| 2 | version ISSUE | 200, V0.1 → V1.0 issued | **403**, and the version is **still a draft** |
| 3 | transition REQUEST | 201, auto-approved, record moved | **403**, and `transition_requests` on that record: 0 → 0 |

**Each is asserted twice**: that it was refused, and that the refusal is
**about ownership** rather than any 4xx. That second assertion is why this
report is trustworthy and it is not a formality - see §4.

## The evidence write, replayed on the real record

`POST /opportunities/29e98c46/deal-sheet-versions`, the exact write the hygiene
round landed on walk65's opportunity: **403, ownership-shaped.** R2's
real-world positive control is satisfied - the fixed policy refuses exactly the
write that created the evidence.

**And the evidence row is untouched**: `5f1517b2` is still V0.2 draft, and that
record still carries exactly 2 versions.

---

## 2. ALLOWED: the owner is not locked out

| | |
|---|---|
| the OWNER may save a version | **201** |
| the OWNER may issue it | **200** |
| the OWNER may raise a transition request | **201** |

Verification 40's clause: a gate made of refusals is satisfied by a route that
refuses everything. These three are what stop that reading.

---

## 3. PRESERVED: the MATCH verdicts still work

**Audit self-signing**: 5 audit rows written by this account on its own record.
`audit_log` stays identity-shaped and still accepts them.

**A non-owner APPROVER approving** is *not* covered by this probe, which says so
in its own output rather than asserting it. It is covered by the two gate probes
that construct an approver seat, **re-run against the applied migration** rather
than relying on the Phase 1 gate, which ran before the push:

```
probe-pricing-approval   15/15   exit 0
probe-commercial-gate    11/11   exit 0
```

That is the half of R6 most likely to be broken by a fix like this one, and it
is intact: **approvers endorse, owners execute**, and the endorsing still works.

---

## 4. Two faults found by the probe's own second assertion

Both are Verification 14, and both would have produced a confident wrong report.

**The server was stale.** The first run showed check 2 refusing with the OLD
zero-rows 409 and check 3 answering **HTTP 500** carrying the ownership
sentence - the unmapped case the Phase 1 route change exists to fix. The server
had been started at 12:42:30, **before** the Phase 1 route edits. Build
discipline 9's probe clause, promoted by me two rounds ago, firing on me for the
third time. Restarted, and all three became clean 403s.

**Two refusals arrived before ownership was asked.**

- Check 1 saved the *same* inputs twice, so the route answered *"No change since
  V0.1. A version records a decision, so there is nothing to record."* Refused,
  and about nothing.
- Check 4, the evidence replay, did the same against V0.2. Measured both ways
  to be sure: **same inputs → 409 no-change, not ownership-shaped. Different
  inputs → 403, ownership-shaped.**

**A write has to be able to REACH the policy before its refusal means anything.**
Both are fixed by varying the inputs, and the probe now asserts the reason, not
the status class.

---

## 5. R8's teardown list, as it stands

**Kept per R2, never deleted in passing:**

| row | state |
|---|---|
| `5f1517b2` version created by a non-owner | V0.2 draft on `29e98c46` — walk65's real record |
| `e975b27e` version **issued** by a non-owner | V1.0 issued on `a7178858` — a probe fixture |
| `0197a77d` request raised by a non-owner | approved, on `e70d0755` — moved it to Solution Alignment |

**Proposed for teardown at the close, John's ruling before any deletion:**

| | |
|---|---|
| live records owned by the test account | **9** (4 account, 4 contact, 1 opportunity) |
| opportunities handed to `ownership-other@terminus-probe.invalid` today | **15** |
| the stray version `8d1f8b18` | V0.1 draft on fixture `db8c6ccb`, from the Phase 1 preflight, **joins the list as instructed** |

The 15 handed-over opportunities are the cost of proving this: each non-owner
proof needs a record the account does not own, and each run built fresh ones.

---

## 6. What this phase does NOT establish

- **That the policies are what the migration says.** `pg_policies` is still
  unreadable from here. The evidence is behavioural: the same calls that
  succeeded now refuse, and the owner's still work.
- **That `document_details` is closed.** It was the one GAP with no live proof
  in Phase 0 and it still has none - the migration changes its policy and no
  probe exercises it. **Named, not assumed.**
- **Test Bed and Contact equivalents.** The policies are shared, so the shapes
  carry, but only Opportunity paths were exercised.
- **That no other identity-shaped write exists.** The census covered the schema
  as of Phase 0; nothing re-ran it after the migration.
- **A full gate.** The Phase 1 gate was green *before* the push. The final-act
  gate belongs to Phase 2 and has not run against the applied policies.
