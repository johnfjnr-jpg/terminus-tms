# TEST BED WORKFLOW CORE: Round A close-out

**Model: this session is running Claude Opus 5 (claude-opus-5[1m]).**

## Not done, first

- **Nothing is pushed.** The round waits for the word.
- **Promotions are PROPOSED, not landed** (below). CLAUDE.md is unchanged.
- **Carried into Round B, by ruling:**
  - the route accepting a second contact in an already-linked role;
  - K1, the journal hole;
  - the server refusal text naming "a score of 1 or 2";
  - K2's staleness TREATMENT. It was measured fresh today (below), which settles
    the question for today and builds nothing for tomorrow.
- **Three gates ran, and only the last covers the tree.**
  - cdc21ec was UNANSWERED, not green: 22 stages passed and 2 browser stages
    were skipped, because the gate's shell had no PUPPETEER_PATH and one of the
    two is required.
  - 9bcc365 passed 24/24, after the fixture fix below.
  - 2d81b92 passed 24/24, after a comment correction to StageTabs.tsx (below),
    which is a source file and needed its own gate.

## Rulings R12 and R13, built

Appended to the brief before any work (e62096f).

**R12: the blocked list clears on the host's own reload after a save, and
nowhere else.** The host counts its own `load()` calls, and every one of them
follows a write. StageTabs empties the shell-written element when that count
moves. A mount and a tab change never move it.

- Code and tests in bbf78b7; instruments in 651e274.
- **Unit calibration, 5/5 on their named tests:**
  - the reload no longer moves the token;
  - the clear removed;
  - the clear on every render (reddens the R8 test);
  - the clear on the ATTEMPT rather than the reload (reddens the refused-save
    test);
  - the element removed instead of emptied.

  Reverted React suite: 1172/1172.
- **Live proof, probe-p5-r12.mjs, 8/8** (TBCORE_RUN=p5-r12-2):

      Next Stage refused 422 and the itemised list renders, every item      (422, 14 items)
      R8: the list is STILL THERE after a switch to Reference and back       (14 items)
      before the save the list is present
      the save was accepted and the HOST reloaded the record                 (PATCH 200; GET after it = 1)
      the DATABASE holds the use case just saved
      R12: after the host reload the list is GONE, the element remains with its id, and the view never left
      and it stays gone on the stage tab
      the next attempt renders into the same element again                   (422, 14 items)

- **Live calibration, both directions, each restoring source and bundle
  byte-identical:**
  - spec a (the reload no longer clears) FIRED "R12: after the host reload the
    list is GONE";
  - spec b (the clear on every render) FIRED "R8: the list is STILL THERE".
- **The first live calibration read a real fault as SILENT, and it was the
  harness (Verification 51).** calibrate-live.mjs builds every injection in a
  spec into ONE bundle. There, the every-render clear also emptied the list
  after the save, so the missing reload clear was masked. With one injection per
  spec, each fired.
- **Found at the close, and part of the change (Rule 10's authorship limit).**
  The first R12 tests answered the save with a hand-shaped `{}` and
  `{ error: 'refused' }`, which exit gate point 3 forbids. In 9bcc365 they serve
  PATCH /api/test-beds/:id's own answers, captured by capture-patch.mjs (200
  `{ ok, revision_number, record_revision_number }`; 400 "payload must be an
  object"). Re-calibrated 5/5, reverted suite 1172/1172. The product code did
  not change, so the live proof above still stands.

**R13: the pre-commit hook gains a React typecheck stage** (474df17). It was
calibrated in a throwaway worktree with a type error injected into identity.ts
only, each attempt a real `git commit`:

    OLD hook, injected:            PASS pure / react, exit 0              (the Phase 4 defect)
    NEW hook, injected:            FAIL typecheck, COMMIT REFUSED naming TS2322, exit 1
    NEW hook, restored (sha256 matches): PASS pure / react / typecheck, exit 0

The worktree and its branch were removed. Every commit since has gone through
the stage, which took 0.6 to 0.7s both passing and failing. Because the failing
run named the injected error, the fast time is a real run rather than a stage
that did not run (Verification 48).

## The gate on the exact tree

`npm run verify` on 2d81b92, nothing else running, browser available:
**All 24 stages passed.**

| Suite | Result |
|---|---|
| Pure | 582/582 |
| Database | 102/102 (146.7s) |
| React | 1172/1172 |
| Typecheck, bundle freshness, CURRENT_STATE staleness | PASS |
| 16 HTTP and browser probes | PASS, including readonly-view and browser-dependency, the two skipped on cdc21ec |

**The header reads WORKING TREE DIRTY, and nothing tracked is dirty.**
`git status --porcelain` lists exactly `?? tb-audit-phase0.bundle` and
`?? tb-round-a.bundle`. Both were untracked when this session started, and
neither is mine to remove.

**The close-out's own commits ride that gate (Verification 48 (a)).** They are
markdown that no gate stage reads: no file under scripts/ names
TEST_BED_WORKFLOW_CORE. Four of them fall BEFORE 2d81b92 and are inside the
gated tree anyway: 5199996, 307e7f9, 429112e and 4fe7837. Only the one carrying
this sentence comes after it.

## Revert rehearsal

This was run in a detached worktree at 1194890. It restored from the explicit
ref 6da809e, never from the index, and verified by tree hash.

    round diff: 69 files, 8 markdown (kept: the record), uncovered by the revert paths: 0
    restored from 6da809e: 5 paths; files added by the round removed: 37
      MATCH  frontend-react, frontend/style.css, scripts/pre-commit-suites.mjs,
             scripts/tests/no-duplicate-ids.test.mjs, scripts/tests/seam-ledger.test.mjs,
             scripts/testbed-core (absent at the base, absent after)
    index vs base, excluding markdown: 0 files differ
    the reverted tree: bundle fresh against its source, react 1098/1098, typecheck exit 0, pure exit 0
    main after: HEAD, tree and index identical to before; worktrees: 1

The rehearsal ran at 1194890. The two commits since then change CURRENT_STATE.md
(markdown, which a revert keeps) and one test, one fixture and one capture
script. The last three are inside frontend-react and scripts/testbed-core, which
the rehearsal reverts by path, so the revert procedure covers them. The
rehearsal's tree-hash evidence is for 1194890, not re-run on 9bcc365.

## Reconciliation, by counting

**Commits against sign-offs.** There are 44 commits in 6da809e..2d81b92, the
gated tree. Every sign-off has commits, and every commit belongs to a sign-off:

| Stretch | Commits | Signed off |
|---|---|---|
| Phase 0 | fd0e006, 67b34c7, ce38167 | yes |
| R5 to R8 at that sign-off | ec0e822, 590bd48, fb4873d | (with Phase 1) |
| Phase 1 | 6260fc7, 76cc8d9 | yes |
| Phase 2 | 1ced95e, e9cfb64, 0dd78b8, 638935a, fc58c36, 2658fac, a1b5b19, 1eef1e6, 902be28 | yes |
| Phase 3 | d8fcbe1, 6c469ff, 557c191, 3e0400b, 8ba56c3, 2d3feea, eaffb6f, 25766a3 | yes |
| Phase 4 | 36408a5, abe38d6, 1c777aa, adfd995, 4cc4dae, eb1e6ba, 358619c | yes |
| Phase 5 | e62096f, bbf78b7, 651e274, 474df17, 1194890, cdc21ec, 9bcc365, 5199996, 307e7f9, 429112e, 4fe7837, 2d81b92 | awaiting the word |

3 + 3 + 2 + 9 + 8 + 7 + 12 = 44, matching `git rev-list --count 6da809e..2d81b92`.

**Items against the brief.** A grep of the brief's `- N.N` item lines returns 20
matches. 4.1 appears twice (its item and its Phase 3 carry), so there are 19
distinct items. With P0.1 to P0.6 that makes 25 items:

| Phase | Items | Closed by |
|---|---|---|
| 0 | P0.1 to P0.6 | reproduced, the Phase 0 report |
| 1 | 1.1 to 1.6 | the Phase 1 report's table |
| 1.7 | "pending marks land in Phase 2; the hook point is left named" | closed by 2.6 (fc58c36) |
| 2 | 2.1 to 2.6 | the Phase 2 report's table |
| 3 | 3.1 to 3.3 | the Phase 3 report's table |
| 4 | 4.1 to 4.3 | the Phase 4 report's table |

**The brief's other lists:**
- 13 rulings (R1 to R13), each landed in the phase it launched;
- 2 addenda, (a) and (b), in 6c469ff;
- K1 to K3: K1 carried; K2 measured (below) with its treatment carried; K3
  (below).

**CURRENT_STATE.md against the phases** (cdc21ec):
- the bundle's size and sha, and the React count 1025 to 1172: Phases 1 to 5;
- tag distances: commits;
- record, harness and approval counts: probe and suite traffic;
- **no configuration section moved**, which is consistent with no server change.

One line no phase accounts for: **live `unit Planned` rose 7 to 9**. Measured,
these are two units created 2026-09-16T15:25Z, before this round began, on a
live Qualification Test Bed created 2026-09-15. Both the units and the bed are
owned by an account that is not this session's probe identity. Verification 11
asks whether that account is a real person, and this session cannot answer it.

## CURRENT_STATE.md

Regenerated in cdc21ec, recording commit 1194890.

**Staleness check:**
- the recorded SHA is an ancestor of HEAD: yes;
- `git diff --name-only 1194890..HEAD -- supabase/migrations supabase/seeds
  src/routes`: 0 files;
- the gate's CURRENT_STATE staleness stage: PASS.

It records "Working tree at generation: dirty". The cause is the same two
untracked bundles, and nothing tracked.

## K2: exit-criteria-live.json, measured

At the close the fixture was copied aside, recaptured through
capture-exit-criteria.mjs against the live gate, compared and restored
byte-identical:

    captured 2026-09-17T01:36:28.322Z vs now 2026-09-17T06:22:44.829Z
    cases identical apart from capturedAt: true    (all seven cases)

The fixture is not stale today. The treatment, something that makes it
impossible to be stale unnoticed, is Round B's by ruling.

## K3: the database stage, which has moved in three consecutive phases

Every hook commit this round printed its database stage duration. Grouped by
phase and emitted by a script over the captured files
(.verify/tb-core/p5-k3-durations-final.txt, which includes this close-out's own
commit):

| Phase | n | min | median | max |
|---|---|---|---|---|
| 0 | 6 | 112.5s | 119.5s | 125.8s |
| 1 | 2 | 158.1s | 162.4s | 166.7s |
| 2 | 10 | 124.3s | 127.0s | 142.5s |
| 3 | 8 | 123.2s | 128.3s | 147.1s |
| 4 | 7 | 134.4s | 148.0s | 178.4s |
| 5 | 8 | 145.2s | 157.2s | 164.8s |

The three gate runs read 166.5s, 158.1s and 146.7s.

**Read by the MINIMUM, per Verification 48's own caveat:** noise only adds, so
the floor is the honest trend.
- The floor is flat from Phase 0 to 3 (112.5, 124.3, 123.2).
- It then rises in Phases 4 and 5 (134.4, then 145.2): **+29% on Phase 0**.
- Phase 1's two samples sit high and above Phases 2 and 3. **Two samples cannot
  separate a trend from a distribution**, so Phase 1 is not read as part of it.

**What it is not, as far as measured.** Today the tables grew:
- records by 3,478 (4.4% of 78,276);
- record_revisions by 2,349 (2.1%);
- audit_log by 1,491 (2.7%).

A 2 to 4% growth does not by itself explain a 29% rise in the floor, unless
some query scales far worse than linearly, which nothing here measured.

**The cause is not identified.** One correction to an earlier report: Phase 4's
report cited two database durations "where captured", when seven were captured
(134.4s to 178.4s).

**The next measurement that would discriminate:** per-test durations from
`test:db` on two runs at different floors, to see whether one test moved or all
did.

## C6 and C9, annotated per R11

Annotated in 1194890, with the original sentences left in place.

- **C6 misreads the vanilla.** `applyTbScoreEntryLock`
  (54001c5^:frontend/test-bed-detail.js:1759) is the awaiting-reason lock, and
  never a lock on a recorded criterion.
- **C9 agrees with the vanilla.** Both renderers take the newest entry
  (2055, 2171, and 2149 for measurability). The React build's `summarise` was
  the disagreeing second reader.

**This corrects the Phase 2 report's "C6 and C9 were misread" for C9**: C9's
sentence was right.

## The exit gate, point by point

**1. All six Phase 0 claims reproduced, then shown closed by the same
instrument.** Reproduced in the Phase 0 report. probe-p0.mjs re-run on the final
product code (TBCORE_RUN=p5-close, exit 0):

| Claim | What probe-p0 read |
|---|---|
| P0.3 | 14 of 14 requirements readable |
| P0.2 | 5 criteria selects |
| P0.4 | `getElementById('tb-next-stage-feedback') present=true`, all 14 rendered |
| P0.5 | the lookup row gone: 3 direct-write rows, 0 lookup FieldRows |
| P0.1 | NO REQUEST: the button is disabled with no draft |
| P0.6 | the measurability control present on Qualification |

**Stated exactly:** P0.2, P0.3 and P0.4 are closed by the same instrument.
**For P0.1, P0.5 and P0.6, probe-p0 is read-only**, so it shows the defect's
mechanism gone, and a second committed instrument shows the write succeeding:
- probe-p2-score: a real score 201, read back from the database (P0.1);
- probe-p3-buyers: a real link 201, in the database (P0.5).

**P0.6's write has NO live proof.** The measurability save is proven by unit
tests against the route's own captured answer (scoring-live.json
`accepted.measurability`), and live only as the control existing and working
under the door. No live run ever recorded a measurability confirmation, which
is a gap in point 1, not a closure.

**2. Every new check calibrated in both directions, with the injection named
against the test it must falsify.**

| Phase | Unit | Live |
|---|---|---|
| 1 | 20/20 | 2 checks |
| 2 | 42/42 | 2 |
| 3 | 15/15 | 3, plus the addendum's |
| 4 | 15/15 | a, b, c |
| 5 | 5/5 | a, b; R13 three commits |

R7 was calibrated with three commits too. Every silence was explained in its
report: Phase 1 two, Phase 3 two, Phase 4 spec c twice, Phase 5 once.

**3. No hand-shaped fixture stands where a server shape exists.** Every response
a claim reads is captured by a committed script:
- exit-criteria-live.json;
- scoring-live.json;
- buyers-live.json;
- testbed-patch-live.json.

The close's own relapse is recorded above and fixed. **Disclosed rather than
changed:** the round's tests answer routes no claim reads with `{ entries: [] }`
for /history, which is that route's own empty shape (src/routes/records.js:459),
and with `{ error }` for an uncaptured exit-criteria read, which is the route's
error shape.

**4. No server file changed.** `git diff 6da809e..HEAD -- src supabase`: 0
lines.

**5. Gate green on the exact tree; nothing pushed without the word.** 24/24 on
2d81b92. The close-out markdown after it rides it, named above. Nothing is pushed.

## Promotions to CLAUDE.md, PROPOSED, not landed

**P1. Extend Verification 47's response-fixture clause. Checked first: it
already says "built from what the ROUTE returns, once, in one shared place".**

Proposed addition:
- the capture is a COMMITTED SCRIPT, named in the fixture's own `source` field;
- staleness is measured by RECAPTURE and diff, not assumed.

The instance that argues for it: this round wrote four such scripts, and then
relapsed at its own close. A hand-shaped PATCH answer was caught by the exit
gate's point 3, not by the rule. That is the limit of promotion again: **the
rule names the check, and the gate point performed it.**

**P2, WITHDRAWN on measurement: it is Verification 47 as written.** An earlier
draft of this close-out proposed that the clause "the shell RE-RENDERS a view
rather than mounting a new one" had gone stale. **It has not.** main.tsx still
re-renders the Test Bed VIEW. TestBedView, below it, keys the host on
`navToken ?? id`, so the host remounts per navigation.

The Phase 4 jsdom test that drove an unneeded fix (Phase 4 finding 2) rendered
TestBedHost DIRECTLY, one level below that key. That is the clause's own check,
"ask how the PRODUCTION ENTRY POINT invokes this code", not followed. It is an
instance, not a new rule.

**P3. Extend Verification 51.** Injections built into ONE run can mask each
other: one injected fault can produce the outcome another injection's check
expects to lose. The R12 live calibration read SILENT for exactly this reason.

Proposed check: **before explaining a silence, ask whether a companion injection
in the same run produced the outcome**, and give interacting injections a run
each.

**Found at the close and fixed, not listed.** An earlier draft put the
StageTabs `recordId` comment on the list as "not written by this round". Blame
shows 0dd78b8, Phase 2.3, so it was this round's, and it was corrected in
2d81b92 under Rule 10's authorship limit. It was a comment-only change: the
rebuilt bundle is byte-identical.

**Not proposed, because it is already covered.** R13 is an instance of "MECHANICAL
ENFORCEMENT IS GATEABLE", not a new rule. And spec c's two silences on a
never-loaded record are Verification 13/17/25's collapsed rule ("on the same
population").

## For the list (Rule 10), not acted on

- **Three comments written before this round say "the shell re-renders this
  view" at the HOST and StageTabs level:** StageTabs.tsx:167 (6a3d85f),
  TestBedHost.tsx:161 (f356e9a) and TestBedHost.tsx:839 (49cbd4d). Each is true
  of the view and misleading about the component it sits in, for the reason in
  P2.
- **The recordId drafts reset in StageTabs is redundant in production** (a
  Verification 9 question), because the key remounts the component. It is kept,
  because the jsdom tests re-render the host directly, and whether to remove it
  is a ruling.
- **Who owns the live Test Bed and two live units** created 2026-09-15 and
  2026-09-16 under an account that is not the probe identity (Verification 11).
- **The gate header's DIRTY flag counts untracked files**, so two stray bundles
  make every gate read dirty.

## Process notes

- **Residue:** 676 records created by the probe identity since
  2026-09-17T00:40Z, including every hook database suite. LIVE: 0.
- **Environment:** Chrome for Testing 152 via PUPPETEER_EXECUTABLE_PATH, the
  browser run outside the command sandbox. The gate needs PUPPETEER_PATH in its
  own environment, or its browser stages SKIP and the gate is unanswered. That
  cost one gate run this close.
- **The session was not refreshed by hand before any of the three gates.**
- **One unrouted edit of mine, caught before commit.** The last close-out update
  was first written by a node script straight to the file. It was restored from
  HEAD, re-applied as 13 routed edit.mjs hunks, and compared equal to the
  intended text before commit.

## What this does not establish

- **The cause of K3.**
- **A live measurability confirmation.** See exit gate point 1.
- **Whether R12's clear is right after a REFUSED save that does reload** (a 409).
  `load()` runs there too, so the list clears. The live proof covers an
  accepted save only.
- **Anything about pushing.** The round waits for the word.
