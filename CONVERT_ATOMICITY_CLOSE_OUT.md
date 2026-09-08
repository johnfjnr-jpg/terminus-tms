# The convert atomicity round: close-out

Thirteen rulings, five phases, sixteen commits before this one. The round made
two creation paths atomic, closed a race that had never been measured, and
found four things nobody was looking for.

---

## 1. What the round did

**`POST /test-beds/:id/convert`** performed four writes with no transaction and
an unchecked `audit_log` batch. **`POST /contacts/:id/create-opportunity`**
performed five the same way. Both now call one `SECURITY INVOKER` plpgsql
function and commit all of it or none of it.

**The max-conversions check was read-then-write with no constraint behind it.**
Measured before: **4 of 4 concurrent converts committed against a limit of 1**.
Measured after, through the route: **1 of 4, the other three refused 422.**

**A failed audit insert now rolls the conversion back** (ruling 2), implemented
by construct: neither function has an `EXCEPTION` block, so nothing can commit
part of itself.

### The four things nobody was looking for

1. **The reference code strands on soft delete.** `deleting an opportunity
   frees its bed` is false for any Test Bed carrying a reference code, because
   `records_reference_code_record_type_key` is not partial on `deleted_at`. The
   count says free; the index says taken; the caller gets a 409 mentioning
   neither conversions nor Test Beds. **Carried** (ruling 8).
2. **A self-recording ledger row breaks `db push`.** 23505, deterministic, the
   whole migration rolled back. **Nineteen files carry the pattern.** Carried
   (rulings 9 and 10), and `CLAUDE.md` Architecture rule 10 is corrected.
3. **A probe in this repository manufactured the round's own defect shape.**
   `walk-tb-2e.mjs` hard-deleted `opportunity_details` in its teardown and
   produced eleven of the sixteen residue rows Phase 0 found. Fixed (ruling 6).
4. **No route soft-deletes an Opportunity.** The `deleted_at` exclusion the
   migration must preserve protects a state the application cannot create.

---

## 2. The revert rehearsal

Rehearsed on a branch, not written down as a procedure.

### The routes ARE independently revertible

`git revert bbe0fc5` on `rehearse-revert-routes`. All four touched files come
back **byte-identical** to their pre-switch state at `47b63c9`, a tree that had
already passed 21 of 21:

```
src/routes/test-beds.js         6df161b605c8 == 6df161b605c8   IDENTICAL
src/routes/contacts.js          30d54e1c07c2 == 30d54e1c07c2   IDENTICAL
src/lib/write-errors.js         ff57320cc838 == ff57320cc838   IDENTICAL
scripts/round7/walk-tb-2e.mjs   bd98cecac98f == bd98cecac98f   IDENTICAL
```

Pure suite on the reverted tree: **489/489**. The functions are simply left
present and unused.

**And the revert takes the evidence with it**, which is worth naming: the same
commit holds `probe-routes-preserved.mjs` and the four shared-error-path tests,
so reverting the switch also deletes the probe that proves the switch preserved
behaviour.

### The MIGRATION is NOT independently revertible. Measured, not assumed

This session has no DDL path, so the functions could not be dropped to try it.
The three facts that settle it are each measurable and were each measured:

| | measured |
|---|---|
| what PostgREST answers for a function that is not there | **PGRST202** |
| what the routes' own mapper does with that code | **500**, from both `sendWriteError` and `writeErrorStatus` |
| whether the routes call the function unconditionally | **yes**, one call each, neither inside a conditional |

So reverting the migration alone leaves both routes calling a name that does not
resolve, and **every conversion and every contact-created Opportunity answers
500**. The order is: revert the routes first, or not at all.

### The tree afterwards

```
HEAD                e93ad2fb9b43721785a1393d9e83bce1cddba146
uncommitted files   0
tree hash before    88e11ae7eda14c397b5a98e21c933d11c6f561b2
tree hash after     88e11ae7eda14c397b5a98e21c933d11c6f561b2
BYTE-IDENTICAL      YES
```

---

## 3. The round reconciled by counting

`scripts/convert-atomicity/reconcile-round.mjs`. Every number emitted by the run.

| | |
|---|---|
| numbered rulings in the brief | **13**, no gaps, no duplicates |
| commits in the round | **16** |
| ruling artefacts present | **16/16** - each ruling checked against the thing that exists because of it, not against the sentence recording it |
| carried items with a record in the brief | **3/3** |

### And the phase count does NOT reconcile against the brief, which is the point

```
phase headings in the brief:                  4
phases actually run and signed off:           5   (0, 1, 1b, 2, 3)
of which carry a heading in the brief:        4
reports on disk:                              4
```

**Four headings and four reports reads as agreement and is a coincidence.**
Phase 1b has no heading - it was created by ruling 7 in conversation, which is
the case build-discipline rule 7 names exactly - and Phase 3's report is this
document. Two errors cancelling.

That rule says the brief is not a reliable source for the count and searching it
is worse than not searching it. This round is the eighth consecutive instance,
and the first where the wrong number was **right**.

### One instrument fault inside the reconciliation itself

The ruling counter matched `20260815000006.` in the paragraph after the list and
reported a ruling numbered twenty billion, dying on an invalid array length.
Verification 19 arriving inside the instrument: a counter matching something
outside the category it counts. It failed loudly, which is the good case.

---

## 4. The instruments this round built, and what each is proved by

| instrument | proved by |
|---|---|
| the residue probe (P0.1, P0.2, P0.3) | withholding a real row from each anti-join; a bulk population for the P0.1 join; a duplicated row for the P0.3 threshold |
| the P0.B audit cross-check | withholding one bed from the details side |
| coverage on every paged read | an unpaged select returning 1,000 of 68,194 |
| `probe-conversion-limit` (ruling 5) | both discriminating directions on one constructed fixture; the non-discriminating step labelled as such in the probe |
| `probe-convert-race` | the mutual-overlap assertion, which refuses a verdict without overlap; fired at 905ms, 561ms and 178ms |
| `convert-atomicity.test.mjs` | 19 injections, both directions, on copies the harness cannot write to |
| the PT422 branch | each branch removed from **one mapper at a time** |
| the deleter census | a synthetic deleter, the same text in a comment, and a real file dropping 1 to 0 |
| `probe-convert-function` / `probe-contact-function` | the RLS contrast: RLS on stops at the read, RLS bypassed dies at the first insert |
| **the stale server** | **NOTHING. Ruling 13.** |

### The stale-server catch, recorded as ruling 13 asks

The API server had been started as `node --env-file=.env src/server.js` with
**no `--watch`**. After the route switch it was still serving the pre-switch
code, and **every Phase 2 probe would have measured the code that had just been
replaced** - and passed, because the old routes pass those tests too, except
the race.

It was caught by reading `ps`, not by any instrument. Build discipline 9 names
the hazard for browsers; **nothing in this repository detects it, for browsers
or for probes.** Named here rather than fixed: a check that the running server's
loaded source matches the tree is a real piece of work and belongs in a round
that scopes it.

---

## 5. Carried items

| item | ruling | state |
|---|---|---|
| the reference code strands a bed on soft delete | R8 | **carried**, needs a product ruling; the Milestone 5 dependency is named in the brief |
| nineteen migrations self-record their ledger row | R9, R10 | **carried** as one item for its own round; inert today, a rebuild from files collides on each |
| no route soft-deletes an Opportunity | - | **on the list**, found in Phase 1, out of scope |
| nothing detects a stale dev server | R13 | **on the list**, §4 above |
| P0.1's 585 and P0.2's 62 | R4 | **dispositioned: leave.** Nothing remediated, and no data-change commit exists in the round |

---

## 6. Rules

**Two corrections landed in `CLAUDE.md` in this round**, because the
Documentation section requires a correction to live in the file rather than only
in a brief. **The rule count is 81 before and 81 after**: both are extensions,
and rule 32 says a cited number is an identifier and never a position.

- **Architecture rule 10 is CORRECTED.** "Safe under both paths" is false, and a
  migration file must not write its own ledger row. The superseded reasoning is
  left above the correction so a reader can see a premise failed rather than a
  preference changing.
- **Verification 48 is EXTENDED** with ruling 13: the gate is the final act on
  the final committed tree, nothing else running.

**Two more are PROPOSED, not written, because they are John's to take:**

1. **A detector anchored on the defect it watches stops being calibrated the day
   the defect is fixed.** The deleter census was calibrated on
   `walk-tb-2e.mjs`'s hard delete; ruling 6 removed that line and the
   calibration silently began reporting `FIRED = false`. Nearest existing rule
   is Verification 9, which says inject and watch it fail; it does not say the
   anchor must outlive the fix.
2. **Build discipline 9's stale-server clause reaches probes, not only
   browsers.** Its instance is a browser served new frontend against old
   backend. The same server serves probes, and a probe cannot see the mismatch
   at all.

---

## 7. The exit gate

1. **Both routes are atomic and both are proven.** 28/28 over HTTP on the
   success path with every carried field the brief names; 21/21 and 15/15 at the
   functions; the race closed end to end at the route.
2. **The two ruled behaviour changes are the only behaviour changes.**
   `probe-conversion-limit` reads 17/17 at the route, identical to the
   pre-switch baseline, step for step.
3. **Every ruling has an artefact and every artefact was checked**, 16/16, by
   counting rather than reading.
4. **The revert is rehearsed, not written**, in both directions, with the tree
   proven byte-identical after.
5. **Every finding is recorded whether or not it was the expected answer**, and
   the four that nobody was looking for are in §1.

---

## 8. `CURRENT_STATE.md`, regenerated and its diff reconciled

Its own two-part staleness test passes: the recorded SHA is an ancestor of
`HEAD`, and no tracked configuration source has changed since it.

**Every line of the diff is accounted for by a phase, measured rather than
read:**

| change | accounted for by |
|---|---|
| `116 files in supabase/migrations/` -> **117** | the round's own migration, Phase 1 |
| commits-since-tag **298 -> 316**, delta **18** | 16 commits in this round + 2 between the last generation and the round's first commit. Both counted, not assumed |
| every other line: soft-deleted row counts rising | the fixtures Phases 1b and 2 created and tore down |

**And the line that matters most does not move at all:**

```
before   115 live, 42434 soft deleted, 42549 rows in total.
after    115 live, 43194 soft deleted, 43309 rows in total.
```

**115 live before, 115 live after.** The round created and soft-deleted 760
fixture records and left the live population untouched to the row - and every
per-type live count is identical too: account 4, contact 8 Qualified and 1
Unqualified, opportunity 6/7/8, test_bed 1, unit 3.

**No change is unaccounted for**, which is what `CURRENT_STATE.md` rule 6 asks
and the only reading under which its diff is evidence rather than noise.

---

## 9. The gate, as the final act

Ruling 13's first application. Clean committed tree, nothing else running on
the machine, nothing edited during it, and **no `WORKING TREE DIRTY` in the
header for the first time this round.**

```
MERGE GATE  main  1f1744702b7f7b3f433e66c178b528ad6c19b0e5
  21 of 21 stages PASS
  pure suite      493/493 pass, 0 fail
  database suite   94/94  pass, 0 fail
  react suite     915/915 pass, 0 fail
  HTTP stages     14, all PASS, 10.8s to 53.0s
  full output: .verify/verify-1283698446502416.txt
```

Durations are the suite's normal ones (Verification 48), so no stage failed
faster than it could have run and none was skipped.

**What the green covers and what it does not.** It covers the estate: the
routes, the shared error path, the pure and database suites, and fourteen HTTP
probes including the two this round rewrote. It does **not** cover the browser -
no walk was run this round - and it does not re-parse the migration, which the
database applied and which no gate stage reads.

**The round is complete and waits for the word.**

---

## 10. The push, and the round's final reconciliation

### The remote's own answer

Asked of the remote directly rather than read from a local ref, because a local
`origin/main` is a cached claim and the thing being confirmed is what the remote
holds:

```
$ git ls-remote origin refs/heads/main
c2bf26146761cb8390ee5ced404fbc7280b53de2	refs/heads/main

remote head              c2bf26146761cb8390ee5ced404fbc7280b53de2
local HEAD               c2bf26146761cb8390ee5ced404fbc7280b53de2
remote == local          YES
rev-list origin/main..HEAD   0
uncommitted files            0
```

The remote moved from `f8a9c48`, the migration's close, to `c2bf261`.

**Pushed by John from his own terminal.** The push from this session was refused
by the environment's permission classifier - not by git, not by the remote, and
not by anything in the repository. Recorded because a close-out that says "the
round was pushed" without saying who did it and why is the kind of sentence that
reads as fact and is not checkable.

**The gate that authorised it ran on that exact tree**, `c2bf261`, clean, as the
final act with nothing else running: 21 of 21, 493/493 pure, 94/94 database,
915/915 react, 14 HTTP probes at 10.3s to 45.4s. Ruling 13's second application,
and the reason three commits were gated again after Phase 3's green: two of them
added scripts the gate's source scans read.

### 21 commits against 8 sign-offs

| sign-off | commits | |
|---|---|---|
| Phase 0 | 4 | brief, probe, report, gate |
| Phase 1 | 4 | rulings R4-R6, migration, report, gate |
| the `db push` failure | 1 | the ledger-row fix, outside any phase |
| Phase 1b | 3 | rulings R7-R9, proofs, report |
| Phase 2 | 3 | rulings R10-R11, the switch, report + gate |
| Phase 3 | 3 | rulings R12-R13, the close, gate as final act |
| R14 / R15 | 2 | the two promotions, the walk |
| R17 / R18 | 1 | ruling 17, then the push |
| | **21** | |

Every commit belongs to a sign-off and every sign-off has commits. **The one
that belongs to no phase is the `db push` failure**, which is correct: it was
not phase work, it was a deployment defect found while handing a migration over,
and it is recorded as its own commit for that reason.

**Five ruling commits, eleven phase commits, four gate commits, and the brief.**
17 rulings of record, none renumbered, no gaps.

---

## 11. Carried items, in full

Nothing below is fixed. Each is recorded where a later round will find it.

| # | item | where | size |
|---|---|---|---|
| 1 | **The reference code strands a bed on soft delete.** `records_reference_code_record_type_key` is not partial on `deleted_at`, so the conversion count says a bed is free while the index says its code is taken, and the caller gets a 409 mentioning neither. Needs a product ruling; the Milestone 5 dependency is named | brief R8 | medium, and it changes a deliberate decision |
| 2 | **Nineteen migrations write their own `schema_migrations` row.** All applied by hand and inert; **a rebuild from files collides on each** | brief R9, R10; `CLAUDE.md` Architecture 10 | one round of its own |
| 3 | **The React six-cell stat strip dropped the Test Bed cost cell** during the strip swap, while `app.js:7227` still writes the value into the hidden vanilla strip on every load, and the comment asserting the strip "stays OUTSIDE both" is false by measurement. Display only; the value is on the Deal Sheet | brief R17, walk report | low, dated to the strip swap rounds |
| 4 | **The Opportunity list gains a Reference code column**, matching the Test Bed list. Measured: it has never had one | brief R17 | small |
| 5 | **No route soft-deletes an Opportunity**, so the `deleted_at` exclusion protects a state the application cannot create | Phase 1 report | small, and it is why F1 happened |
| 6 | **Nothing detects a stale dev server.** Caught by reading `ps`; a check that the running server's loaded source matches the tree is real work | close-out §4, `CLAUDE.md` build discipline 9 | medium |
| 7 | **P0.1's 585 and P0.2's 62 rows: leave them.** Dispositioned, not remediated, and no data-change commit exists in the round | Phase 0 report, brief R4 | none, closed |

---

## 12. What this close does NOT cover

Stated because a close that lists only what it proved is a claim about coverage
that nobody measured.

- **The estate was not walked.** One path was: Test Bed to Opportunity, twice,
  in a browser. Nothing else on any screen was exercised this round.
- **No gate stage parses the migration.** The database applied it; the 13
  structural tests assert its TEXT. A green gate says the estate is unbroken, not
  that the SQL is right.
- **Atomicity is measured at two of five insert positions.** Positions 2, 4 and
  5 have no reachable failure and rest on the structural claim that neither
  function carries an `EXCEPTION` block.
- **The RLS refusal at an INSERT is not constructible for a signed-in user**, by
  design, so that half of the proof is a contrast between RLS on and RLS
  bypassed rather than a direct observation.
- **`PT404` from the functions was never reached by a real race**, only by a
  synthetic error. Both routes 404 before calling.
- **The contact route's qualification gate is untested.** The fixture sets
  `Qualified` by direct write, and the gate itself is out of scope.
- **The 585 and 22,023 residue rows are an upper bound, not an attribution.** A
  direct fixture insert leaves the same shape as an insert-2 or insert-3 failure
  and the data cannot separate them.
- **The Commercials tab was never reached by automation.** Three attempts
  failed; the question was settled by a person looking. Recorded as an
  instrument limitation.

**The round is closed.**
