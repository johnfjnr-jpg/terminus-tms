# Resume state, 2026-09-14

**Written at a hard stop. Nothing pushed, nothing lost, no further building
against an unhealthy connection.**

## THE BLOCKER, and it is the only thing in the way

**An unhealthy Supabase connection, acute right now.** Five consecutive
database-suite runs, **five different failure sets**:

| run | failed |
|---|---|
| 1 | 6 concurrency tests |
| 2 | 1 teardown statement timeout |
| 3 | 5 mixed |
| 4 (pre-commit) | atomicity + teardown at 79,837ms |
| 5 | atomicity only - `TypeError: fetch failed` |

**No two runs failed the same way.** That is ONE connection expressing
randomly, not five defects - the carried **F8 + concurrent-write environment
timeout**, acute.

**Likely environmental.** The recorded fix for this shape: flush DNS
(`dscacheutil -flushcache`) and toggle the VPN; a VPN resolver with a stuck
entry is indistinguishable from the service being down until measured. Likely
different in hours.

**The gate was never reached.** The pre-commit hook refused correctly each
time. **The gate itself has not been run against this work.**

## WHAT IS ON DISK AND MUST NOT BE LOST

### 1. ENFORCEMENT GAPS - 5 commits, LOCAL, unpushed

All work sound and proven:
- the journal ACCUMULATES instead of deleting on success, closing the
  fail-open that let the false-commit fault recur twice
- `scripts/hooks/journal-guard.mjs` refuses an unrouted modified file, fails
  closed, exemptions structural
- **the dogfood caught its own author** mid-phase on a bad anchor - the exact
  recurring fault, caught by the tool in the round that built it
- `check-state-fresh` and `check-browser-usable` wired as gate stages, both
  measured passing
- the meta-check, calibrated three ways including FAIL CLOSED on indeterminate
- one owner for the suite-membership check; the older, better implementation
  survived the merge
- two promotion instances, no new numbers

**Blocked ONLY by the connection. Not by any defect in the work.**

### 2. The door-at-1920 diagnosis - COMMITTED, local

**Outcome (a): the door is PRESENT at 1920.** Settles at 4850ms against
1240's 4851ms, `is-not-mine` applied, 0 typeable of 290, Mark Closed Lost
blocked, screenshot carries the read-only banner. **No security defect.** The
gate's three door failures were readings of an unrendered page, exactly as
the probe's own fourth line said.

### 3. The pagedSelect stall retry - IN THE WORKING TREE, UNCOMMITTED

**The hook refused it correctly, on the red suite. It is on disk in
`scripts/fixtures.mjs`. Do not lose it.**

Implemented and calibrated three ways:
- recovers from an intermittent stall and LOGS it with attempt count and
  per-attempt durations, printed
- FAILS at a ceiling of 3 consecutive timeouts, naming attempts and durations
- does **NOT** retry a non-timeout error - a bad column throws first attempt,
  undressed

**And it proved itself by NOT firing.** Run 5's `fetch failed` came from an
RPC (`issue_reference_number`), a different path from `pagedSelect`, so no
STALL line printed. The recorded cause correctly said *not my subject* rather
than masking it. The teardown timeout it targets was absent from that run.

**Honest limit**: calibrated on ~30ms injected stalls. Control flow proven;
the wait's adequacy against a real stall is not.

### 4. Teardown-cost round - Phase 0 complete, findings recorded

- the scan is **healthy**: median statement 410ms, flat across 20 runs
- **0 of 20 idle runs reproduced the gate's failure mode** - the 30,132ms and
  19,823ms statements SUCCEEDED; they were slow, not failing
- the gate failure ERRORED at 10,209ms, server-side cancellation, and the
  only instance was under full suite load
- the accumulation is **HISTORICAL, not a leak**: one run adds 78 revisions
  against a 103,384-row table. My earlier "mostly this session" claim was
  wrong and is withdrawn
- **V11 forbids the purge** and the conflict was surfaced, not resolved
  quietly; a fourth FK (`deal_sheet_versions_revision_exists`) could
  manufacture the `inconsistent` state it exists to prevent
- **R2 is unbuildable as specified**: no column on `records` carries the tag,
  and the unbounded scan is a deliberate fallback for handed-away records

## RESUME PLAN

**On a healthy connection: ONE clean gate run.**

- **GREEN** -> commit the retry, ENFORCEMENT GAPS closes, push the whole
  stack: 5 enforcement commits + door diagnosis + teardown-cost + the retry.
  Confirm `origin/main` by `ls-remote`.
- **STILL 4-of-5 different failures on a HEALTHY connection** -> it is a real
  concurrency defect, and RPC-path retry coverage gets built THEN, with clean
  information.

**Do NOT build more against the current connection.** Do NOT retry the gate
to see whether it passes - five different failure sets means picking the run
you like.

## Carried, unchanged

P4 the 4 rotted assertions - P5/P6 standing - the fixture-tag change as
HYGIENE, not as the stall fix - then R1 (the record-surface consolidation,
P2 folds in), the features, and the Sections 6-11 walk.

## Note on this file

**It is UNCOMMITTED, deliberately.** The pre-commit hook refuses on the red
suite, and using `--no-verify` to slip a document past it is the quiet bypass
this estate spent a round removing. It sits in the working tree with the
retry, and both survive.
