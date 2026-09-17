# TEST BED WORKFLOW CORE: Phase 2 report (scoring, B1 + B2 + L1 + L5)

**Model: this session is running Claude Opus 5 (`claude-opus-5[1m]`).**

## Not built, first

Nothing in 2.1 to 2.6 is left unbuilt. Three positions narrow what "built"
covers, and they are stated here rather than at the end:

- **The Record button sends only the criteria the OPEN stage shows.** A draft
  made on another stage's tab stays drafted and waits there. The vanilla's Save
  bar sent every dirty score regardless of the tab. Under R2 the button is per
  stage, so it sends that stage's scores. Revisitable.
- **Success says nothing.** On a fully recorded run, the vanilla reloaded and
  showed no message, and so does this: the new values, the cleared drafts and
  the server-met exit rows are the confirmation. Only a refusal writes a message.
- **2.4 and 2.5 landed in one commit**, because a single rewrite of the card
  serves both.

## Order, per R9

| Step | Commit | Content |
|---|---|---|
| carried list and R9 | `1ced95e` | K1 to K3 and the ordering ruling appended to the brief |
| 2.1 + 2.2 | `e9cfb64` | the starvation, fixed first |
| 2.3 | `0dd78b8` | the contract |
| 2.4 + 2.5 | `638935a` | measurability and depth |
| 2.6 | `fc58c36` | pending marks |
| calibration | `2658fac` | 42/42 |
| closing instruments | `a1b5b19` | live probe, its live calibration, P0.1 reading |

**No server file changed**: `git diff 6da809e..HEAD -- src supabase` is 0
lines.

## What was built

| Item | Built as |
|---|---|
| 2.1 | `criteriaForStage(allCriteria, stage)`: each criterion's own `stages` rows, over the host's one criteria fetch. The `scoring` state nothing ever set is removed |
| 2.2 | `orderedSeries(payload, key)` in `QualificationScore.tsx`, ordered by `at`; the Reference card and the stage panel both take it, and `currentEntry` sorts through the same `byAt`. The `seriesByKey` state (filled only by a POST response) is removed, and so is `summarise`, which called the OLDEST entry the latest |
| 2.3 | `recordScoresInOrder`: door, then one POST per drafted criterion, `{ criterion, score, reason? }`, in panel order, one at a time, stopping at the first refusal; `recordOutcomeMessage` names what was and was not recorded by criterion name; recorded drafts clear, the rest stay. The host reloads the record and the stage after any attempt that sent something. With nothing drafted the button is disabled and nothing is sent |
| 2.4 | `measurabilityAsked(exit response)` shows the yes/no row exactly when the open stage's requirements name `measurabilityConfirmed`; `recordMeasurability` (door, then `{ confirmed }`) saves at once; the row shows the current confirmation with its entry line |
| 2.5 | current value ("Not scored"); the asks line; the anchors block (toggle with `aria-expanded`, every level, no-wording marking, version line, auto-open while a draft is pending, a made close surviving the next focus); the current entry's reason always shown; history newest first with when, who, value, stage, version, comment, reason, and the wording resolved against the entry's OWN `anchorVersion`; reason labels optional, required and blocking; the lock disabling the OTHER selects and measurability, keeping the blocking criterion's own control, naming it in a note, moving focus into its box, and `applyDraft` refusing past it |
| 2.6 | the exit panel takes `pending` (the non-empty drafts, from the same `StageTabs` state the card edits) and marks an unmet row with a filled dot, the dashed box and "unsaved". A server-met row is never marked, and `data-met` still carries only the server's value |

The drafts live in `StageTabs`, keyed on the record id, because the shell
re-renders the view for the next record rather than remounting it
(Verification 47). The card is keyed on the record too, so open disclosures do
not follow the person to the next Test Bed.

## Evidence

### The closing proof, part 1: a real score, end to end, read back from the database

`scripts/testbed-core/probe-p2-score.mjs`, `TBCORE_RUN=p2-score`, a fixture at
Qualification: **30/30**.

```
S1 the scoring card is VISIBLE (display block, height 788)
   it offers the criteria whose stage rows name Qualification, in the route's order (5)
   the measurability row is on Qualification; with nothing drafted, Record scores is disabled
S2 Site Assessment offers its own, different set (scorePhysicalSuitability,scoreDataRights)
   and no measurability row, on a visible card
S3 a required level shows the lock note naming the criterion ("Add the Reason for Client Commitment before scoring anything else.")
   the OTHER selects and measurability lock; the blocking one does not
   focus moved into its reason box (tb-score-reason-scoreClientCommitment)
   typing the reason RELEASES the lock
S4 each drafted score marks its exit row "unsaved", and only those
S5 two FLAT bodies, in panel order, the reason only where given
     {"criterion":"scoreRolloutPath","score":3} | {"criterion":"scoreClientCommitment","score":1,"reason":"Live probe: no sponsor named yet."}
   the real route ACCEPTED both (201,201); two new revisions in the database (1 -> 3)
   the DATABASE holds scoreRolloutPath  {"by":"john+test@terminustechnologies.io","stage":"Qualification","value":3,"anchorVersion":1}
   the DATABASE holds scoreClientCommitment WITH its reason {"value":1,"reason":"Live probe: no sponsor named yet.","anchorVersion":1}
   after the reload the screen shows the stored values and the drafts are gone
   no pending marks remain; the exit row now reads met FROM THE SERVER (data-met true)
S6 Yes saved at once as {"confirmed":true}, accepted; the DATABASE holds it; the screen shows Yes
S7 (the second of three POSTs answered by the browser with the server's own captured refusal body)
   the run STOPPED at the refusal: the third was never sent (2 POSTs: ...=201, ...=400)
   "Recorded Clear Use Case Requirements and Metrics. Physical Suitability could not be recorded: a reason for the change is required when revising a score"
   the DATABASE holds the first only (rev 4 -> 5)
   the recorded one cleared; the refused and the unsent stay drafted for a retry
S8 (handed to another owner) every score select, measurability and Record are inert
   a forced click and a forced change send NOTHING, and the record is unchanged
   CALIBRATION: the same listener saw the score POSTs earlier in this run
teardown: live after teardown 0 of 2
```

**S7's refusal is injected**, as the brief's calibration wording has it. The
browser answers one request with the status and body the real route returned
when the capture script provoked that refusal, so the message text is the
server's own and the other two requests went to the real server. What S7 does
not establish is that the server itself refused that particular request.

Screenshots opened: `p2-drafted-1920.png` (definitions open, labels, the typed
reason) and `p2-partial-1920.png` (three recorded rows ticked by the server,
the refused and unsent rows marked "unsaved" with the dashed box). The message
in S7 is read from the DOM; it sits below the fold of that capture.

### The closing proof, part 2: P0.1 and P0.2, same instrument (`TBCORE_RUN=p2-close`)

```
P0.2  Phase 0:  card: hidden=false display=block height=84  criteria selects=0
      Phase 2:  card: hidden=false display=block height=788 criteria selects=5
P0.1  Phase 0:  UI click Record scores -> POST .../scores  request body: {"entries":[]}  response: 400
      Phase 2:  Record scores disabled before the click: true
                UI click Record scores -> NO REQUEST SENT; fingerprint unchanged=true
```

The P0.1 section is the instrument's reading with nothing drafted, which is now
correctly nothing. **The accepted real client body is part 1's S5**, and P0.1's
second line (the pre-fix `{ entries: [...] }` shape sent straight to the route)
still reads 400, as it should: that is a fact about the server, and the client
no longer sends it.

**Beyond the ask, the same run shows L1 closed on the instrument that
reproduced it:** the P0.6 sweep on Qualification now finds `measurability=1`
control (Phase 0: 0).

`probe-p0.mjs` needed one change to take this reading: the P0.1 wait now
reports NO REQUEST instead of dying when the button is disabled. The change is
stated in its commit (`a1b5b19`).

### Component and host tests

Driven through `TestBedHost` itself (`testbed-scoring.test.tsx`, 28 tests), plus
`testbed-exit-criteria.test.tsx` (3 new for 2.6) and
`testbed-scoring-units.test.ts`. **Every response a claim rests on is captured
from the routes** by `scripts/testbed-core/capture-scoring.mjs` into
`fixtures/scoring-live.json`: the criteria with their stage rows and anchors,
the stage list, two exit-criteria responses, the record read back after real
scores and a real confirmation, two real 201 bodies and two real 400 bodies.
Routes no claim is about answer an empty-list stub, and the test header says so.

**Hand-shaped fixtures removed**: the stage-surface test's `k1` criterion
("Budget confirmed"), and the unit tests' `k1`/`k2` criteria with invented
levels. Both now read the captured criteria, with levels taken from the fixture
rather than typed.

**One derived case, labelled at the test**: a version 2 of the captured anchors,
because no live criterion has two versions and "resolved against its OWN
version" cannot be told apart from "the current version" otherwise.

React suite: **1119** at the Phase 1 close, **1146** after 2.6, each emitted by
its run.

## Calibration, both directions

### `scripts/testbed-core/calibrate-p2.mjs`: 42/42 fired on their named tests

The same harness as Phase 1: byte snapshots, a once-only anchor, a check that
each injection landed, a byte comparison after every restore, and an in-flight
marker. Scored by which named test failed. Reverted full React suite:
**1146/1146**.

```
2.1  no criteria on any stage (the original starvation)   2.1  every criterion on every stage
2.2  series from nowhere (the POST-only series)            2.2  the reducer trusts stored order
2.3  criterion_key body; reason never sent; drafting order; run continues past a refusal;
     recorded scores stay drafted; refused scores cleared too; message names keys;
     door removed; button live with nothing drafted; no record reload
2.4  measurability on every stage; door removed; the choice sent as a string;
     no record reload; the current confirmation not shown
2.5  no current value; asks shows the name; no no-wording marking; wrong version line;
     no auto-open; a made close does not survive; history oldest first;
     history resolved against the current version; reason only inside history;
     lock disables nothing; lock disables the blocking one too; handler takes a draft
     past the lock; focus not moved; note names the key; measurability live under the
     lock; required reads optional; clearing keeps the reason; history toggle loses
     aria-expanded; clearing keeps the drafted level
2.6  a server-met row marked; drafts never reach the panel; no "unsaved"; no pending box
```

**The first run was 40/42. Both misses were the injection, not a missing
detector (Verification 51), and both were re-aimed rather than excused:**

- **2.5d came back SILENT.** It replaced the version line with "Version 1", and
  every captured criterion IS at version 1, so the injected output was correct.
  The derived version 2 test gained a version-line assertion, and the injection
  now fires on it.
- **2.5s fired on a different test.** Storing `''` on a cleared draft still
  releases the lock, because `''` is no level and a fresh record has no revision.
  So that injection could not break the claim "clearing releases the lock". It
  now keeps the drafted LEVEL on clear, which does hold the lock, and fires on
  the release test.

### `scripts/testbed-core/calibrate-p2-live.mjs`: the live probe on a broken bundle

```
injected source built into the served bundle
  FAIL  two FLAT bodies ... ({"criterion_key":"scoreRolloutPath","score":3} | ...)
  FAIL  the real route ACCEPTED both  (400,400)
  FAIL  the run STOPPED at the refusal: the third was never sent  (5 POSTs: ...=400 x5)
18/30 checks PASS
FIRED   contract: "the real route ACCEPTED both"
FIRED   stop: "the run STOPPED at the refusal"
source and committed bundle restored byte-identical; marker removed
```

**The contract injection is B1 reproduced against the REAL server on the new
code path**: the old key refused 400 live, and the database untouched.

## Findings and positions, with reasons

1. **A contract finding: the enumeration's C6 misread the vanilla.**
   `MIGRATION_TEST_BED_CAPABILITIES.md` C6 reads `applyTbScoreEntryLock` as
   "locks entry once recorded", and the React card built exactly that: a
   recorded criterion's select stayed disabled for the session. The vanilla
   function is the AWAITING-REASON lock, the one 2.5 describes. After a record
   the vanilla reloads and offers "Revise...". The permanent lock is removed:
   it also defeated 2.3's retry. **The capabilities document still carries the
   misreading and was not edited here**, which puts it on the list.
2. **`summarise` was wrong in a way nothing could see**: `series[0]` is the
   oldest entry of an appended series. It never mattered, because its only input
   was a state no POST ever filled.
3. **The door exempts `[aria-expanded]`**, so both disclosure toggles carry it.
   That is a true statement about them, and it means an unowned record's
   definitions and history stay readable. Calibrated: 2.5r.
4. **The measurability select is always offered empty** ("Confirm..." or
   "Change...") and saves on choice, as the vanilla's did, so it never holds a
   value it has not sent.
5. **A server string that describes old configuration, noticed not fixed.** The
   captured refusal reads "a reason is required at a score of 1 or 2, naming
   what is missing". It is correct for today's default levels, and it is the
   shape of Architecture 9's fourth variant. It is server text, so it is out of
   scope here and goes on the list.

## Process notes

- **The journal guard refused one commit, correctly.** The 2.3 tests had been
  appended with a shell redirect. The file was restored from HEAD (checked
  byte-identical to HEAD), and the identical block was re-applied through
  `scripts/edit.mjs` (byte-compared to the tested file). The commit message
  says so.
- **K1 in action, again**: one `sed` fixed a memo-dependency line in
  `TestBedHost.tsx`, a file already journaled in the batch, and the guard could
  not see it. The line was confirmed by typecheck and the suite.
- **Several `edit.mjs` batches stopped early** on a malformed or no-op edit.
  Each was re-run, and the journal cleared on the next successful batch.
- **Hook database stage on this phase's commits: 126.2s to 138.6s.** K3 shape:
  within the 112 to 126s band's upper edge and below the 158 to 167s readings of
  Phase 1.
- **Residue**: 66 records created by the probe identity since 02:10, including
  hook database suites; `LIVE: 0`.
- **Environment unchanged**: Chrome for Testing 152 via
  `PUPPETEER_EXECUTABLE_PATH`, the browser run outside the command sandbox.

## For the list (Rule 10), not acted on

- `MIGRATION_TEST_BED_CAPABILITIES.md` C6 and C9 describe behaviour that was
  misread and has now been removed.
- The server refusal text naming "a score of 1 or 2".

## What this does not establish

- That the server itself refuses a SECOND score mid-run in the live partial
  failure: S7's refusal is injected by the browser, with the server's real body.
- Anything at 1240 or 3440 for the scoring card. The card is new content on an
  existing column; captures are 1920.
- Round B's unit work, and B5, B6 and the riders, which later phases own.
