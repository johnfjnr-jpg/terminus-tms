# Round 7 close-out: the Test Bed

**The estate's largest surface is migrated, live, and walked.** This is the last
record surface; the shell round follows.

---

## The exit gate

| # | criterion | verdict |
|---|---|---|
| 1 | Test Bed's capabilities and door pass live in both directions; the checklist has written verdicts; second-visit behaviour proven | **MET.** Walk 32/32, residue 0. The door measured on a real not-owned record: 0 tab stops of 31 rows, 31 still reading, 0 opening. Second visit walked |
| 2 | Contact's vanilla is retired clean; the only remaining vanilla surface file is `test-bed-detail.js`, sized | **MET.** `contact-detail.js` deleted, 4 coupled tests dropped, restore byte-identical before the real deletion |
| 3 | the shell inventory is complete enough that the shell round starts from a list | **MET.** Below |

---

## What the round did, in one table

| phase | outcome |
|---|---|
| 0, 0b | the accounting instrument; a THREE-ROUND-OLD LIVE DEFECT found (`payloadUpdate` undeclared, every field save threw) |
| 1a, 1b | the field surface, scoring and units behind the line |
| 2 | **the swap refused.** The reach instrument measured file EXISTENCE, not reachability |
| 2b s1 | the stage-tab shell; LOGIC-ONLY reached zero |
| 2b s2 | the six absent capabilities; the ratchet reached zero |
| 2c | **the swap refused again.** The instrument's population was a FILE where the decision is a VIEW |
| 2d s1-s3 | the view's `app.js` half: 574 lines to zero across three sessions |
| 2e | **THE SWAP**, A12 on four surfaces, the live walk at 32/32 |
| 3 | the visual comparison at three widths, the revert rehearsal, the retirement |

**The swap was held back twice by the instrument built to permit it**, and both
refusals were correct.

---

## THE SHELL ROUND'S ENTRY CONTEXT

### The declaration-keyword inventory, `frontend/app.js`

**340 top-level names.** The split is the shell round's first constraint,
because it decides which couplings are a deprecation and which are a redesign.

| form | count | reachable from a bundle? |
|---|---|---|
| `function` | 161 | **YES** - and every use is debt that comes due at modularisation |
| `window.X =` | 69 | **YES** - includes `window.X = (a) => {}` arrows, which a keyword-anchored scan misses |
| `let` | 79 | **NO** |
| `const` | 31 | **NO** |

**230 reachable, 110 LEXICALLY UNREACHABLE.** The 110 are not a coupling to
carry over; they are a coupling that was never possible. Among them:
`currentSession`, `CAN_EDIT_BY_VIEW`, `OWNERSHIP_REFUSAL_TEXT`,
`EDIT_OPENING_SELECTOR`, `stageCache`, `terminusStaffCache`, `tbTabStrip`,
`tbLandOnStageAfterLoad`, and the whole `opp*` family.

**The count has been corrected twice across rounds.** Round 6's instrument
anchored the window branch on `function` and missed fifteen
`window.X = function` names on the next surface it met; Round 7's Phase 0
found one more shape, `window.X = (a, b) => {}`, which hid
`toggleExitCriterion`. The parser now takes any `window.X =`.

### Every C1-pattern seam, accumulated

`ShellServices` has **14 members**, each a fact the shell owns that a bundle
cannot reach. The Test Bed ledger names them all; the four the Test Bed would
break without are asserted present in the shell.

| direction | seam |
|---|---|
| shell answers | `canEditFields`, `currentUserEmail`, `currentUserId`, `usesWorkflow`, `attemptTransition`, `takeTestBedLanding`, `staleWriteHtml`, `getOppLoadedRevision`, `navigate`, `detailLoaded`, `api` |
| shell asks the bundle | `setContactReturnView` - the only inverted one |
| shared dialogues | `requestChangeReason`, `confirmDiscard` |

**`takeTestBedLanding` is the newest and the shape to copy**: the shell owns a
`let` no bundle can read, keeps its one writer, and publishes a guarded accessor
that clears on read.

### The ownership sweeps, and the door's dependence on them

**Two identical derivations, `app.js:6520` (Test Bed) and `:8049`
(Opportunity).** Both compute `notMine` from `owner_id` against
`currentSession.user.id` and toggle `is-not-mine` on their view.

**`CAN_EDIT_BY_VIEW` READS THAT CLASS**, which is what makes the behaviour
shared by construction rather than by matching - and it is why the door is a
class rather than a record read.

**Round 7 found what that costs.** The Test Bed's sweep lived in the vanilla's
load path; the swap retired it, and the door stayed open on somebody else's
record while the banner rendered correctly. **The React view now writes the
class, during render, before the row component asks.** The Opportunity's sweep
at `:8049` is untouched and will meet the same problem when it is swapped.
**The shell round inherits the choice**: keep the class with one writer per
view, or move the door to the record and accept two derivations.

### `loadTestBedDetail`'s family: superseded functions `app.js` still owns

| name | state |
|---|---|
| `loadTestBedDetailSuperseded` | **REFUSES**, and is RENAMED - the rename is what stops it overwriting the bundle's registration on `window` |
| `renderTestBedDetail` | dead, reachable, still declared. **Called by nothing** |
| `loadTbStageDetailTab`, `renderTestBedDocuments`, `renderTbStageApprovals`, `renderTbClosedPanel`, `refreshTbStagePanels`, `markStagePanel*`, `tbTabStrip`, `switchTbTab`, `markTbCurrentStageTab`, `refreshTbNextStageButton`, `wireTbNextStageButton`, `convertTestBed` and friends | dead, and each has a React counterpart named in `scripts/round7/tb-view-surface.mjs` |

**Roughly 900 lines of `app.js` are now dead Test Bed view code.** They retire
with `test-bed-detail.js` at the shell round, and the enumeration is the work
list.

**The general lesson for the shell round is the rename**: a file that stays
loaded keeps publishing its top-level names, so a superseded function must be
renamed as well as made to refuse.

### `test-bed-detail.js`, sized for retirement

**3,282 lines, 136 top-level names, 25 published on `window`.** Its one-round
confidence window OPENS NOW and closes at the shell round.

**Coupled tests, from the ledger:** `class-rules` and `client-preconditions` are
retirement preconditions and will fail on deletion; `cost-preview` and
`opportunity-headline` read it for evidence and move to the React descriptors;
`test-bed-accounting`, `tb-view-surface`, `tb-swap-readiness`, `visual-tb` and
`tb-app-surface` retire with it. Four files carry PROSE only.

---

## Carried business and data items

**None of these is this round's to fix, and each is measured rather than
suspected.**

| item | what was measured |
|---|---|
| **the convert has NO TRANSACTION** | three inserts with a return between each. A failure after the second leaves an Opportunity with no `opportunity_details` row, hence no `converted_from_test_bed_id` - which is exactly what the max-conversions check reads, **so a second conversion is permitted.** The route's own comment records that this check once returned zero silently |
| **`Unqualified -> Parked` is unsatisfiable** | `Parked` is sort_order 3 with `reachable_from_any_stage` false, so the transition SKIPS `Qualified` and the route refuses it for any client. A `stage_gate_rules` row nonetheless exists for it requiring `followUpDate`: configured, and unreachable from inside the product |
| **must-differ on a score reason** | built in 1b, **stripped in 2e by ruling** because a rule the vanilla does not have is a behaviour change inside a swap. The argument is unchanged: a person can retype the same sentence and the new level carries the reasoning given for a different one. Queued, pending a business ruling |
| **`marginPresentation`** | carried from an earlier round, unchanged |
| **the create-route nulling** | carried, unchanged |
| **the atomicity flake** | `atomicity: 40 genuinely concurrent appends` failed once with 1 of 40 refused under full-suite contention, passing in isolation and on re-run. Seen again in this round at **26ms against a ~5000ms normal**, which is Verification 48's tell that it did not run at all |
| **the revision field's two names** | `GET /test-beds/:id` answers `latest_revision_number`; `PATCH` answers `revision_number`. Measured in Phase 0b, unchanged |

---

## The visual comparison

**31/31 at 1240, 1920 and 3440**, on two exercised states per width, with the
vanilla restored at runtime and each capture identified before anything was
compared.

**Two defects found, both fixed.** The React tab strip overflowed by 122px at
1240 because the wrap rule is keyed on `#tb-detail-tabs` and the React strip did
not carry the id - a swap reintroducing the exact defect that rule was written
for. And the Next Stage button read *Final stage* on the first paint of a record
at Qualification, **found by looking at the screenshot** while every assertion
passed.

**One divergence recorded as deliberate:** React shows 31 visible rows against
the vanilla's 16, because it renders every field on one scrolling surface where
the vanilla splits them across sub-tabs.

---

## The revert rehearsal

**On a branch, restored byte-identical, tree hash matched.**

**It confirmed the tag comment's claim: the revert is TWO lines, not one.** With
only the script restored, `openTbField` returned and **React still rendered the
view**, because the entry calls the bundle's registration. The second line -
`app.js`'s own entry pointing back at the vanilla path - produced the vanilla
surface: 10 rows, no React host, no page errors.

**And the rename does not resurrect the dead path.** With one line restored,
`loadTestBedDetailSuperseded` was never reached and nothing threw.

**Expected ledger failures, enumerated: exactly one.** `THE REACT TEST BED VIEW
IS THE LIVE ONE`.

---

## Rule promotions: five extensions, no new numbers

**81 numbered rules before and after.** Rule 32 says a cited number is an
identifier, so each finding extends the rule whose REMEDY it shares.

| extends | what it adds |
|---|---|
| Verification 44 | a killed harness poisons the next run's baseline; the control is an in-flight marker, and an injection expecting a hang declares itself |
| Verification 41 | a superseded function in a file that stays loaded must be RENAMED, not merely made to refuse |
| Verification 43 | the enforcement must not read state a swap can retire; and a fix for it can be one render too late |
| Verification 47 | the caller side - a request shaped by what the reader wanted, twice in one round, invisible to every layer above the network |
| Verification 49 | the population of a swap is a VIEW, not a file; and the enumeration is declared, not inferred |

---

## Gate

Reported with the closing commit.

**Not pushed. The round closes on John's word.**
