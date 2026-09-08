# The record creation atomicity round: close-out

**The round set out to make a route atomic and deleted it instead.** Seven
rulings, three phases, and no migration.

---

## 1. What the round did

`POST /records` was the last non-atomic creation path and carried its own
`TODO M2` naming the exact fix. Phase 0 measured before drafting, and found:

- **zero callers** anywhere - no screen, script, test, probe or raw fetch;
- **two records created through it, ever** - both `smoke_test`, both
  2026-08-02, both since hard-deleted, and **neither an atomicity failure**;
- **one validation** where `POST /test-beds` has five, accepting any non-empty
  string as `record_type` - a bypass of every typed precondition;
- **no cross-request invariant**, so the planned function needed no lock.

Ruling 6 re-ruled the scope from FIX to RETIRE. **Both `POST /records` and
`GET /records` are deleted.** The atomicity class closed by deletion, the TODO
died with the route, and no migration was written.

**R1's reasoning is left standing in the brief above R6**, per Verification 29,
so a reader can see that a premise failed rather than a preference changing.
R1 assumed the path was worth making atomic because it was a creation path.
Phase 0 measured that nothing creates through it.

---

## 2. The two claims

### Claim one: they are GONE

**a. Nothing names them as a caller.** The caller census re-runs at zero, and
the widened route-name sweep over **682 of 684 tracked files** (the two skipped
are named binaries) finds no live call site.

**b. They refuse.** Measured over HTTP as the signed-in user, against a server
restarted after the deletion per build discipline 9's probe clause:

```
POST /records -> 404  Route POST:/api/records not found
GET  /records -> 404  Route GET:/api/records not found
```

**With the counterfactual stated**, because a 404 from a dead or misrouted
server is indistinguishable from a 404 from a retired route:

```
GET /industries    -> 200  14 rows      GET /records/<id>/pulse           -> 200
GET /opportunities -> 200  24 rows      GET /records/<id>/history         -> 200
GET /test-beds     -> 200   9 rows      GET /records/<id>/stage-approvals -> 200
GET /accounts      -> 200   4 rows
```

The three subpaths matter on their own: `/records` is a prefix of a dozen live
routes, and a retirement that took them with it would be silent until somebody
opened a stage panel.

**c. The generated route table lost exactly those two rows.** From
`CURRENT_STATE.md`, which parses `src/routes/` rather than being told:
**78 routes to 76**, the two `/api/records` rows gone, and all ten
`/api/records/...` subpath rows intact.

### Claim two: what replaced them still works

`probe-routes-preserved.mjs`, **28/28** over HTTP on the success path:
`POST /accounts`, `POST /test-beds`, `POST /contacts`, and both Opportunity
creation paths with every carried field asserted by name. Residue zero.

---

## 3. THE SWEEP WAS WIDENED, AND IT WAS RIGHT TO BE

Recorded prominently because the correction came from outside and the original
claim was mine.

**Phase 0's census swept `*.js *.mjs *.ts *.tsx *.html` - 382 of 684 tracked
files. 302 were never swept, 155 of them markdown.** Its zero was true of
callers, and the report's sentence *"no caller anywhere in the estate"*
over-reached the population the instrument had covered. That is Verification
25's clause exactly: an instrument can be demonstrably working and blind on the
population the claim covers.

The widened sweep covers **682 of 684**, names the two binaries it skips rather
than dropping them silently, and is calibrated nine ways in both directions with
a positive control on the real corpus (11 files naming the live `/test-beds`
collection).

**It found 53 mentions where the narrow one found 8** - and one of its own
patterns was over-escaped and matching nothing at all until a calibration case
that expected a prose mention came back false. The four mentions that pattern
had been missing were real: `CONVERT_ATOMICITY_BRIEF.md`, that round's Phase 0
report, and two rows in `ROUND_41_STAGE_APPROVALS_PLAN.md`.

**Both halves are worth keeping**: a sweep too narrow to support its claim, and
a widened sweep that was silently broken until it was calibrated.

---

## 4. Per-name dispositions

Every mention of the collection routes outside this round's own record.

| name | disposition |
|---|---|
| `src/routes/records.js` x4 | **KEPT** - the retirement note itself, deliberately prose and not commented-out code (Verification 7's third clause: a pointer to nothing is an escape route) |
| `CURRENT_STATE.md:496,497` | **REGENERATED** - both rows dropped, 78 routes to 76 |
| `frontend/app.js:8013` | **AMENDED** - says the route is retired, so nobody goes looking for the alternative |
| `scripts/tests/transition-requests.test.mjs:515` | **AMENDED** - same, in a live test |
| `DESIGN_PRINCIPLES.md:9825` | **KEPT** - historical; this estate leaves superseded reasoning visible |
| `CONVERT_ATOMICITY_BRIEF.md:14` | **KEPT** - records a ruling true when taken |
| `CONVERT_ATOMICITY_PHASE_0_REPORT.md:48` | **KEPT** - a measurement true at the time |
| `ROUND_41_STAGE_APPROVALS_PLAN.md:54,535` | **KEPT** - historical plan |
| `scripts/convert-atomicity/reconcile-round.mjs:59` | **KEPT** - a label asserting R1's scope |
| `scripts/record-creation/invariant-census.mjs` | **REFUSES**, exit 3 with a named message. Deleting it would leave the Phase 0 report citing nothing; letting it run would slice from `-1` and return plausible garbage |
| `scripts/record-creation/caller-census.mjs` | **KEPT** - it is claim one's instrument and still runs |

---

## 5. The revert, rehearsed

**There is no migration to revert.** R6 closed the class by deletion, so the
brief's *"the migration's revertibility measured not assumed"* clause has no
subject. Said rather than answered; `git diff` confirms zero migrations added.

**The retirement reverts cleanly.** On a branch, `git revert` restored all three
touched files **byte-identical** to their pre-retirement state, `records.js`
parsed, both route definitions were back, and the pure suite read **493/493**.

**The tree afterwards:**

```
tree hash before  22c42e926f51812c577091a6dec390cbd6cc31cd
tree hash after   22c42e926f51812c577091a6dec390cbd6cc31cd
BYTE-IDENTICAL    YES
```

**And the server was confirmed by CONTENT, not mtime**, after the checkout
returned: the committed `records.js` and the on-disk one hash the same, so the
process started at 12:42:30 is still serving this tree.

---

## 6. Reconciled by counting

| | |
|---|---|
| numbered rulings | **7**, no gaps, no duplicates, R1 superseded by R6 and left visible |
| commits in the round | **5**, including this one |
| ruling artefacts present | **11/11**, each checked against the thing that exists because of it |
| migrations added | **0** |
| net change in `src/` | 1 file, +35 / -60 |

### The phase count does not reconcile against the brief, and cannot

The brief carries **four** phase headings, written for a fix: census, migration,
route, gate-and-close. **R6 re-ruled the scope after Phase 0, so the brief's
Phases 1 and 2 were never run and never will be.** What ran was Phase 0, the
retirement as Phase 1, and the close as Phase 2 - **three**.

Build-discipline rule 7 again, in a new way: this project has recorded briefs
whose phase list was a table, was absent, and was a heading about Phase 0. This
one had a correct list **that a ruling made obsolete mid-round**.

### One instrument fault inside the reconciliation

The R7 check read `MISSING` while the artefact was there: the brief wraps the
phrase across a line break and an indent, and the pattern required a single
space. Verification 17 - a probe that runs cleanly and cannot see the thing.
Fixed across whitespace, and the same fix applied to three neighbouring patterns
rather than only the one that fired.

---

## 7. Carried items

Nothing below is fixed; each is recorded where a later round will find it.

| item | where | note |
|---|---|---|
| **R4a Reference code on soft delete: ruled NO release.** A deleted Opportunity keeps its code forever; Milestone 5's carry stands. **Residual consequence recorded:** if Opportunity soft-deletion is ever built, the convert path's "bed is free" count and the unique index will disagree and the refusal copy must be made honest in that round | brief R4a | unreachable today |
| **R4b Must-differ on a score reason: ruled IN.** The Round 7 Phase 1b implementation, stripped in 2e as a behaviour change inside a swap, returns as its own small round | brief R4b | queued |
| **R4c Unqualified to Parked: ruled REACHABLE.** The stage configuration is corrected in its own round, at which point the existing `followUpDate` gate rule becomes live and must be proven to gate it | brief R4c | queued |
| **R7 a future generic creation path**, if ever needed: built new, atomic from birth, with a `record_type` allowlist | brief R7 | nothing built speculatively |
| **The React stat strip dropped the Test Bed cost cell** | convert round R17 | low, display only |
| **The Opportunity list gains a Reference code column** | convert round R17 | small |
| **Nineteen migrations self-record their ledger row** | convert round R9/R10 | one round of its own |
| **Nothing detects a stale dev server** | convert round R13 | it fired twice this round, both times usefully |

---

## 8. What this close does NOT cover

- **No walk.** Nothing was opened in a browser this round. The retirement is
  proven by HTTP and by the generated route table, and the case for that is that
  a route with no caller has no screen to walk.
- **That nothing outside this repository called it.** The sweep covers tracked
  files. A curl in somebody's shell history is invisible to it, and the two
  `smoke_test` records are the only evidence anyone ever did.
- **That the two `smoke_test` records were created by a person.** The
  fingerprint says which route, not who or why.
- **Anything about the other creation paths.** Settled ground under R1's
  surviving clause, and not re-measured beyond the 28/28 that proves they work.
- **The three product rulings in R4.** Recorded, not investigated. Each is its
  own future round.

---

## 9. The gate, the push, and the red window

### The final-act gate went RED first, and it was mine

```
MERGE GATE  main  58cb31d
  FAIL  pure suite  exit 1  4158ms  492/493 pass, 1 fail
  20 of 21 PASS
```

4,158ms is the pure suite's normal duration, so it ran and found something.
`scripts/tests/api-client.test.mjs` flagged `route-name-sweep.mjs:84` as a
script calling the fetch primitive directly. **It is not a call.** It is a
calibration string that spells the primitive out, and the control cannot tell
one from the other.

**No allowlist entry was added.** That file's own note says adding one is a
decision and forgetting one is a failure, and this was neither. The remedy is
Round 8's, and it is the one the sweep already applied to the route paths it
hunts: **name the string nowhere and assemble it from parts.** I had applied
that discipline to `/records` and not to `fetch`, ten lines apart in the same
file.

**Why it was not caught earlier, said plainly: the Phase 1 commit that
introduced the sweep was never gated.** The gate ran at Phase 0 and again as the
final act, which is where it fired.

Re-gated on `94cbe59`: **21 of 21, pure suite 493/493**, durations normal.

### THE PROCESS RULING, for promotion next round

> **The push waits for the gate RESULT to be stated. It never runs in parallel
> with a gate on the expectation of green.**

**The measured argument is this round's own red window.** The push of `58cb31d`
was made while its gate was still running, on every reasonable expectation that
it would pass. It did not. **`58cb31d` sat on `origin/main` RED**, and neither
party could have known, because the only instrument that could say so had not
finished. Nothing came of it - the defect was a test-only false positive in a
probe - which is the same shape as Round 17A's four-hour window: timing, not
design.

**This is the second form of the same lesson in one round**, and the pair is
what makes it worth promoting. Verification 48's clause, set at the convert
round's close, stops other work running **during** a gate. This stops an
outward-facing act running **ahead** of one. Both are cases of an act taken
against a gate's expected answer rather than its stated one.

**Nearest existing rule is build discipline 11**, an unanswerable precondition
is a stop. This is narrower and more common: a precondition that is merely
**unanswered yet**, where waiting costs minutes and not waiting puts a red tree
on a published branch.

### The push, confirmed

Asked of the remote directly rather than read from a local ref:

```
$ git ls-remote origin refs/heads/main
94cbe59fcea001a28917755fbdb373bc0aeccc4c	refs/heads/main

remote head              94cbe59fcea001a28917755fbdb373bc0aeccc4c
local HEAD               94cbe59fcea001a28917755fbdb373bc0aeccc4c
the gated tree           94cbe59fcea001a28917755fbdb373bc0aeccc4c
all three match          YES
commits still unpushed   0
uncommitted files        0
```

**The published branch is now the tree the gate passed on**, which is the thing
the red window briefly made untrue.

**The round is closed.**
