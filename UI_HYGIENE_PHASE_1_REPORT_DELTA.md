# UI hygiene v2, Phase 1: close report (delta)

Supplements `UI_HYGIENE_PHASE_1_REPORT.md`, which was accepted as a blocked
state capture. Tree at `d0cf07f`, working tree **clean**. Nothing pushed.

## 1. The five resume items

| # | item | result |
|---|---|---|
| 1 | auth live, idle fix verified | **done, and the fix was superseded** |
| 2 | widget calibration both directions | **done, 4 to 29 to 4, byte-identical** |
| 3 | four survivors named and dispositioned | **done, and one is an open defect** |
| 4 | R9 gate stage | **NOT LANDED, reported below** |
| 5 | R10 write probe | **built and run, 9/13 both directions, 0 landed** |

## 2. Item 1: the idle fix was verified and then RETIRED

Auth confirmed live by an authenticated `GET /industries` returning 200 and 14
rows, not by reading the token's expiry.

The committed idle fix **did not work**: the floor stayed at 1021. Three
attempts at a mutation-count floor now stand at 3, 391 and 1021, and at 1021 the
verdict rule demanded 4100 mutations where a control measured LIVE had scored
1364. **The mutation half of that instrument was dead in every run this round.**

It is retired rather than tuned a fourth time. The probe now reads **mutating
API requests**, which a clock cannot manufacture. That needed one correction of
its own: counting any `/api/` request made every control RESPONDED on the same
row, `GET /api/records/<id>/pulse`, a **background poll**. Non-GET only.

**And the negative result is now calibrated.** The same probe on a record the
user OWNS reports **4 of 8 RESPONDED** against **0 of 8** on the unowned one.

**Also recorded: the scratch puppeteer install had been emptied** (`lib` and
`src`, no `package.json`), so the first run failed at the loader. Reinstalled
outside the repo; `package.json` here is untouched.

## 3. Item 3: the four survivors, named

All four are `button`, `pointer-events: none`, `disabled=false`, **mouse
unreachable and keyboard reachable**.

| control | tab | disposition |
|---|---|---|
| `#btn-toggle-detail` "Show detail" | Commercials | **exception by design** - disclosure. Reading more of a record you cannot edit is still reading |
| `button.btn-text` "Restore" x2 | Commercials | **OPEN DEFECT** - version restore is a write |
| `#opp-next-stage-btn` "Request next stage" | Solution Alignment | **OPEN DEFECT** - raises a transition request, a write |

**Why they survive: `.btn-text` is in `NON_ACTION_SELECTOR`.** The sweep skips
it deliberately. That exception was written for navigation-shaped text buttons
and now shelters two write actions. Verification 19: a category name asserting
a property nobody measured.

**Their state is UNPROVEN, not closed.** The interaction proof cannot
discriminate for them: both are inert on the OWNED record too, because a fresh
opportunity has no version to restore and unmet exit criteria. A probe that
reads the same value in both states measures nothing (Verification 17), so I
will not claim they are inert on an unowned record. **They are the first item of
Phase 2.**

## 4. Item 4: R9 is NOT landed, and why

Stability is met: four runs at 49, 50, 51 and 51 seconds with identical numbers.

**The enumeration is not repaired.** `probe-readonly-view` still enumerates from
an allowlist - `input, textarea, select` plus four class names - and this phase
proved it blind to exactly the class that survived the first treatment. Its
`296/0 PASS` was true and silent about 28 reachable widgets.

**Gating on it now would install the very false-completion signal R9 exists to
remove.** The census is the instrument that is not blind, and it is not wired,
not stable-tested as a gate stage, and takes about 24 seconds per run.

Two ways forward, both needing John's word because each changes what R9 named:
**(a)** repair `probe-readonly-view` to enumerate by the census's four
instruments, then gate it; **(b)** gate the census instead. Not reasoned
forward.

## 5. Item 5: R10

Every write attempted as a **real signed-in user over HTTP**. The service role
appears nowhere in the attempt path; it creates the fixture and hands it to
another owner, a state one account cannot otherwise reach.

    9/13  BOTH DIRECTIONS: the owner's identical write LANDS, the non-owner's
          is REJECTED 403 ownership-shaped
    1/13  refused BY DESIGN (the superseded approvals route)
    3/13  blocked by an earlier gate for BOTH identities, so no ownership
          signal - reported NOT PROVEN
    0     landed. The stop clause did not fire.

Proven both ways: scores, close-lost, PATCH, close-date-move,
probability-override, assessment-reviewed, key-contacts add, key-contact
stance, key-contact delete.

Not proven: deal-sheet-version (409 for both identities), transition-request
(needs an issued version), transition (422, stage gate). Their ownership was
proven in the write authorization round; it is not re-proven here.

**The first run proved almost nothing and said so**: nine of eleven were refused
on body validation before ownership was asked. Bodies were rebuilt from the
routes and the database.

**A measured finding that changes what the 403s mean:** `isRefusal()` is true
only for Postgres `42501`, so these refusals are **RLS at the database**, not a
route-level constant.

**The policy-weakening calibration R10 names is not available** (rule 14: no
psql, PostgREST only). The identity counterfactual is used instead, and it is
the discriminating pair.

## 6. A regression the act-1 change introduced, found by counting

`freshOpportunity` **overwrites** the id file, so a probe building two fixtures
under two tags left the FIRST unswept. `probe-readonly-view` does exactly that,
and **12 records accumulated**. Owner-scoping caught it by accident; tag-scoping
did not.

A tag ledger now records every tag a run creates. It holds **identities, not a
list of records**, so Verification 11's objection does not apply. The act-1
calibration still fires **5/5** afterwards.

## 7. Residue, and a PROPOSED data change

Test-account residue after sweeping: **0**.

**Four records remain and teardown structurally cannot reach them**, because
they were handed to the probe account and its candidate set is
`owner_id = TEST_USER_ID`:

    76996fc8-8f9c-45dc-8cbd-7c4cc23fe8a5  opportunity  TT-SGP-AIRPRT-3976
    c4ce54e9-5417-4ee5-9e51-878980a6c61e  opportunity  TT-SGP-AIRPRT-3977
    35323a63-1ac8-48e9-b510-2a086fd253b3  opportunity  TT-SGP-AIRPRT-3978
    812bb63d-9e42-4bdd-bc9a-bb20ab2bd394  opportunity  TT-SGP-AIRPRT-3979

**PROPOSED, not applied.** Every ownership probe hands a record away, so this
gap recurs by construction and is the same shape as the previous round's R8.

## 8. Commits, reconciled by counting

Nine commits this phase, one since the blocked-state report.

| commit | instruction it answers |
|---|---|
| `543f5d2` | act 1 harness preserved, re-query injection |
| `8201570` | brief amended R5 to R8 |
| `13868f0` | em dashes in my own wording |
| `b78f833` | R8 defects one and two |
| `7d7b143` | rulings R9 and R10 recorded |
| `3b737a5` | R10 completed verbatim |
| `31292dd` | the door treatment |
| `495cf1a` | the blocked-state report |
| `d0cf07f` | R10 probe, widget calibration, the act-1 regression |

Every commit maps to an instruction; no instruction lacks a commit except R9,
which is reported as not landed. Staged by name throughout, per R7.

## 9. What this phase does NOT establish

- **The two Restore buttons and Request next stage are UNPROVEN**, not closed.
- R9 is not landed; nothing is gated.
- The 3 unproven R10 surfaces are not re-proven here.
- The policy-weakening direction of R10 was not run and cannot be from here.
- One viewport for the census; the probe covers 1240 and 1920.
- R2b, c and d are untouched.
- **The gate has not been run on this tree.**

---

## 10. Ruling 3's sweep, executed

Approved data change, run at the Phase 1 close.

    BEFORE, the four named records:
      76996fc8-8f9c-45dc-8cbd-7c4cc23fe8a5  opportunity TT-SGP-AIRPRT-3976
      c4ce54e9-5417-4ee5-9e51-878980a6c61e  opportunity TT-SGP-AIRPRT-3977
      35323a63-1ac8-48e9-b510-2a086fd253b3  opportunity TT-SGP-AIRPRT-3978
      812bb63d-9e42-4bdd-bc9a-bb20ab2bd394  opportunity TT-SGP-AIRPRT-3979

    PER-ID RESULT: 4 SOFT-DELETED, 0 failed
    RE-QUERY: live records for the probe account: 0
    reference_number_counters: 3693 rows, untouched

**SOFT, and the interpretation is stated rather than made silently.** The
ruling says "delete". Verification 11 says test fixtures are SOFT deleted and
never hard deleted, because `records` carries `ON DELETE RESTRICT` from
`record_revisions`, `approvals` and `audit_log`, so a hard delete is either
blocked or orphans history. CLAUDE.md wins over a brief and the disagreement is
a finding, so the rule-compliant reading was taken and is flagged here.

**Two guards the sweep carried, because the ruling named id PREFIXES.** Each
prefix had to resolve to exactly one live record, and the live set for that
account had to be exactly the four named. Either mismatch refuses rather than
sweeping a set it was not given.
