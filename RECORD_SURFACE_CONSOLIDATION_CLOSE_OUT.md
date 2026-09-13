# LEADS ROUND B - record surface consolidation: close-out

**CLOSED** on the gate at `f24b2886`, 22 of 22 stages, exit 0, door green.
**PUSHED** to `origin/main`; `ls-remote` confirmed `origin/main` = local HEAD
= `f24b2886`, so the gated tree is exactly what is published.

Closed by the business 2026-09-13. The word was given once and covered the
push and nothing else.

---

## THE PUSH IS NOT THE WALK

**This round is NOT final.** The business's own wording, recorded here
because a published commit reads like a finished round and this one is not:

> **The push publishes the code; the walk confirms it on the real screen.**

**Still required:** John walks a linked contact showing its real account
name (the Not-Linked fix), and the account section rendering.

**A revert of this round needs the API server restarted.**
`src/routes/contacts.js` changed and the server runs without `--watch`, so a
git-only revert leaves the replaced route loaded and no probe can notice
(build-discipline 9's stale-server clause).

---

## What shipped

**R6, the Not-Linked defect.** `accountsFor(db, contacts)` resolves
`parent_record_id` to the account's latest revision, and BOTH
`GET /contacts` and `GET /contacts/:id` call it. One derivation, so the
list and the detail view cannot disagree - Verification 20 closed at the
source rather than at each reader.

Measured live on the whole population, against a baseline taken before the
change by a different run:

```
NAMED 10/10    NOT LINKED 0/10    UNRESOLVED 0/10
the BEFORE reading, from baseline.json: "Not linked"
```

**R2, the shared account section**, landed on the bespoke contact screen.
Both testids survive by name. Its render rule gained a second half on
measurement: R2 as written would have taken the LINK PANEL off the screen
where an account is linked. The rule is now *render when the record HAS an
account, or when the host has given the section something to OFFER* - both
halves structural, neither a flag.

**R8, a defect this change created and therefore fixed here** under
build-discipline 10's limit. The panel shell is not a card, so the swap
dropped `.pg-card`: the account name rendered as bare text outside any
border while all five siblings were framed, and the link control was
clipped. **Every assertion passed.** Found by opening the screenshot.

**R1, the surface swap, did NOT ship** and was not attempted, per the
business's R7 ruling that it becomes its own round with the 15-test
re-pointing budgeted as explicit work.

---

## Evidence

| claim | instrument | result |
|---|---|---|
| the gate | `npm run verify --round-close` on `f24b2886` | 22/22, exit 0 |
| suites | emitted by the run, not typed | pure 539/539, react 987/987, db 100/100 |
| R6 live | `probe-r6-account.mjs`, all 10 live Qualified contacts | 10 NAMED, 0 NOT LINKED |
| assertions real | `calibrate-r6r2.mjs`, 8 injections | 8/8 fired, 0 silent, reverted green, bytes identical |
| residue | owner scan, coverage asserted | 119 walked of 119 exact, 0 rows without an auth user |
| revert | explicit ref, `git write-tree` | byte-identical, `a8ff3c24` |
| state staleness | both halves | ancestor PASS, 0 configuration sources changed |
| reconciliation | counting | 8 commits, 4 sign-offs, none unaccounted |

---

## RECORDED PLAINLY: what this round cost in apparatus

**F6 refused the first gate.** It ran browserless - `PUPPETEER_PATH` was set
on every individual probe this round and **not on the gate itself**, so the
one stage needing a browser never ran and the gate answered *UNANSWERED, not
green. Do not close.*

**This is the SECOND CONSECUTIVE ROUND where the gate's own refusal, rather
than setup checking, is what stopped a premature close.** Recorded as a
pattern rather than as an incident: the control is working and the habit
upstream of it is not.

**The exit-code near-miss.** The background harness summarised that same run
as *"exit code 0"* while its text said *Do not close*. Reading the captured
output showed `GATE EXIT: 1`. **Had the summary been quoted, a false finding
would have been filed against `verify-all.mjs`** - that its exit code
disagrees with its verdict. It does not; the summary was reporting the
wrapper's exit, not the gate's. Verification 16's corollary one layer out:
read a run's captured output, never its summary.

**Four manual self-catches this round**, all of them caught and none of them
prevented:

1. R6-4 written to assert a state the requirement does not name - **its
   first run failed**, and the test was rewritten to the requirement rather
   than bent to pass.
2. The frame defect, found by opening the screenshot after every assertion
   went green.
3. A probe reported as proving a disposition when **the branch naming that
   disposition was never reached** - withdrawn on reading WHICH assertion ran.
4. The exit-code near-miss above.

**THE WATCHED QUESTION, CONCLUDED.** Across three rounds the proxy-fault
family - an assertion validating the change just made rather than testing
the requirement - has recurred outside every remedy minted for it. V47's
threshold remedy addressed one member; Phase 1's fault was implementation
and Phase 2's were neither.

> **Not fully rule-preventable. The walk is the backstop.**

And the honest other half: the good version showed four times, and **every
instance was manual and per-instance.** The rules named each shape and made
it fast to diagnose. Not one fired by itself.

This bears directly on the Sections 6-11 migration-conformance walk, where
the surfaces are numerous and the faults are of exactly this shape.

---

## Promotions: three, all EXTENSIONS, nothing renumbered

Coverage was checked before each; none needed a new number (Verification 32:
a cited number is an identifier, never a position).

- **Verification 49 gains the SAVE PATH clause.** A capability can live in a
  handler with no markup at all, so no census of what a surface RENDERS
  reaches it. The instance is the audit trail `ContactHost.onSave` writes,
  which the R1 swap would have deleted silently - and **no test on the
  replacement could have noticed, because the replacement never had the
  behaviour to lose.** Verification 7's behaviour axis is the nearest
  neighbour and covers a replaced ELEMENT's props, not a replaced HOST's
  writes.
- **Verification 9 gains the clause before all its others.** Every existing
  clause begins by EXECUTING the detector, so none can see one that never
  runs. On mint-vs-remedy, weighed as the last two rounds did: **the rule is
  worth less than the check**, so the clause is short and the queued scan is
  the deliverable.
- **The index task's limit-of-promotion note gains the three-round
  conclusion** above, as measurement rather than as a lesson.

## 48(a), MEASURED PER FILE, NOT INHERITED

| file | real disk reader | consequence |
|---|---|---|
| `DESIGN_PRINCIPLES.md` | **none** - every hit is prose | markdown edits RIDE the green gate |
| `INTERACTION_STANDARDS.md` | `scripts/tests/standards-staleness.test.mjs` | touching it **RE-GATES** |
| `CURRENT_STATE.md` | `check-state-fresh.mjs`, `state-dump.mjs`, `reconcile-round.mjs` | **RE-GATES** |
| this close-out | none | RIDES |

The two the business named differ from each other, which is the argument for
re-measuring rather than inheriting. Measured by matching the filename inside
a `readFile`/`join` call rather than anywhere in the text, because a file that
talks about another file contains every string a scan looks for
(Verification 39).

**No `DESIGN_PRINCIPLES.md` change was needed.** The round's decisions - R6's
one-source derivation, R2's render rule, R8's framing prop - are recorded at
the sites that implement them and in the brief's appended rulings. Nothing
superseded an existing principle.

**This close-out commit is markdown-only with no gate reader, and rides the
green gate at `f24b2886` under build-discipline 48(a), named here as the
control that clause requires.**

---

## Carried, in the business's order

1. **R1, the surface swap** - its own next round, 15-test re-pointing
   budgeted, re-pointed against the REQUIREMENT rather than the change.
2. **The dead-probe sweep** - a check finding probes wired to no gate stage.
   `probe-gated-fields-reachable.mjs` was dead for two rounds because
   nothing ran it. **How many others have rotted the same way is
   unmeasured**, and that is the state rather than a reassurance.
3. `NewLeadGrid.tsx` lines 14-18, the stale `jobRole` comment
   (Architecture 9's fourth variant).
4. `LinkAccountPanel`'s dim button, for John's eye.
5. Region drift.
6. F5 ceiling derivation review.
7. F8, plus the concurrent-write environment timeout.
8. The follow-up-entity round.
9. **The Sections 6-11 migration-conformance walk**, where the watched
   conclusion lands.
10. Batch Edit.
11. The two declared duplications (`NurtureDialog`, the address popup).
