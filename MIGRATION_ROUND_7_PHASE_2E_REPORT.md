# Round 7 Phase 2e: THE SWAP

**Precondition:** Phase 2d session 3 committed at `3f3cea9`, both populations
reading zero gaps, both gates inverted to floors.

**THE REACT TEST BED VIEW IS LIVE.**

---

## WHAT IS NOT DONE, first, per build-discipline rule 15

**The visual comparison at three widths is NOT done** (item 4's second half).
The walk, the swap, A12 and the injections are. The comparison needs the vanilla
loaded beside the React surface to prove the two captures are of different
implementations, and that is a session's work on its own. **Carried, and named
here rather than in a closing paragraph.**

Everything else in items 1, 2, 3 and 5 is complete.

---

## Item 1: the swap

| piece | state |
|---|---|
| the bundle registers `loadTestBedDetail` | done, `main.tsx`, whole-view on the Account/Approval/Contact pattern |
| `CAN_EDIT_BY_VIEW` gains its line | done, **same commit** |
| C1-pattern shell adaptations | `takeTestBedLanding` (shell publishes, bundle reads), `currentUserId`, `usesWorkflow`, `attemptTransition` |
| the vanilla tag | commented with its restore comment |
| re-points | every caller of `loadTestBedDetail`, listed below |
| coupling ledger both ways | `scripts/tests/testbed-coupling.test.mjs`, in the suite |
| live-form inverted | four new assertions in `live-form.test.mjs` |
| strings scan | the ledger IS the scan, by filename as a string |

**The revert is TWO lines, not one, and the tag comment says so.** Restoring the
script is not enough while `app.js` carries a refusing `loadTestBedDetailSuperseded`.
The Account and Contact reverts were one line because their vanilla FILE went
away, taking its declarations with it.

### Every caller of the superseded path, with a disposition

| caller | disposition |
|---|---|
| `app.js:347` the arrival | **re-pointed** to `loadTestBedDetailOrSayWhyNot` |
| `app.js:5008` `TRANSITION_LANDING.test_bed.reload` | **re-pointed** |
| `app.js:2973` the inline buyer-contact save | **re-pointed** |
| 13 sites in `test-bed-detail.js` | **removed with the file's load**, which no longer runs |
| `app.js` itself | **REFUSED.** It throws, per Verification 41: a superseded path that goes on working is worse than one that breaks |

---

## THE FINDING THE WALK EARNED, and no test could have

**`async function loadTestBedDetail` in `app.js` OVERWROTE the bundle's
registration.**

A top-level function declaration in a classic script is a property of `window`,
and **app.js loads after the bundle**. So the superseded function - written to
refuse - became `window.loadTestBedDetail`, and every navigation reached the
refusal instead of the view. The page showed the static markup and threw the
refusal's own message.

**The load-order property that makes the revert one line is the same property
that did this.** Account and Contact never met it because their vanilla FILE was
removed; `app.js` cannot be. Renamed to `loadTestBedDetailSuperseded`, with an
assertion that the name cannot come back.

**Every unit test passed throughout.** The registration is correct, the refusal
is correct, and their collision exists only when both scripts are on one page.

---

## Item 2: A12, four-surface evidence

**A row the door refuses drops its tab stop** - behaviour 7's own logic for the
second cause of the same condition.

`a12-four-surfaces.test.tsx`, **20 tests**, five claims per surface on **Test
Bed, Contact, Reference tab and Account**:

| claim | why it is there |
|---|---|
| EVERY row is a stop with the door open | the counterfactual - without it the refusal claim is satisfied by a surface with no rows |
| NO row is a stop with the door shut | A12 itself |
| behaviour 7's read-only rows are never stops, door or no door | the older rule, unchanged |
| a refused row STILL READS | Verification 7 - the second claim, which almost never gets an assertion |
| A12 does not reach hand-rolled displays | the Account's name header is not a FieldRow, and its missing stop is a Round 2 ruling |

**Live, on a real not-owned record: 0 tab stops of 31 rows, 31 still reading, 0
rows opening on a click.** With the record owned: 31 of 31 are stops.

The Phase 1a finding that recorded the old behaviour is **inverted rather than
deleted**.

---

## Item 3: the live walk - 32/32, residue 0

`scripts/round7/walk-tb-2e.mjs`. Over HTTP, as the signed-in user, on the
success path.

| group | checks |
|---|---|
| the swap | vanilla globals GONE, loader registered, landing accessor published, host on screen, 31 rows |
| the door, mine | 31/31 rows are tab stops |
| the batched save | wrote only the dirty key; **the revision handshake advanced** |
| the ten stage tabs | all ten render; the three panels settle on the stage they show; P8's card revealed once derived |
| the terminal tab | shows the completed record and NOT the panels; read-only by construction |
| re-navigation | second visit renders, settles, lands on Reference, re-read the record |
| **the convert path** | **created; offers rather than navigates; the link row on the target; revision 1; both renames; only an audit row on the source; a second conversion refused with its own sentence** |
| the door, not mine | banner shown, class set, **0 stops of 31 rows**, all 31 still read, 0 open |

### Four defects the walk found, all fixed

**1. The registration collision**, above.

**2. `/api/stages` does not exist.** The host fetched a route I invented; it is
`/api/stage-definitions`. The stage list stayed empty, so the terminal check -
which reads the last stage by sort order - could never be true and **the Closed
tab rendered the ordinary panels**. The same class as session 1's invented
document routes.

**3. The stage loader captured its deps ONCE.** It lives in a `useRef`, so it
held the first render's stages - empty, because they arrive from a fetch. Fixed
by reading the deps through a ref while keeping ONE loader instance, because its
P1 token is what orders overlapping loads.

**4. THE DOOR'S CLASS WRITER WENT WITH THE VANILLA'S LOAD PATH.** `app.js` wrote
`is-not-mine` inside `loadTestBedDetail`, and `CAN_EDIT_BY_VIEW` **reads that
class**. The swap retired the writer, so the React banner rendered correctly
from the record while the door stayed open: **31 tab stops and 31 rows opening
on somebody else's record.** Verification 43 exactly - the display and the
enforcement on different sources.

**And the first fix was one render too late.** Written as an effect, it ran
after `useFieldRows` had already read `canEditFields()`, and nothing re-rendered
to correct it - the walk measured the same 31/31 with the class correctly set.
It is now applied **during render in `TestBedView`, before the host is
returned**: an idempotent class toggle on an element outside React's tree, where
the ordering is the whole point.

**The class rather than a prop**, because re-pointing the door at the record
would give the Test Bed a second derivation of ownership beside the
Opportunity's - Verification 20, and the reason the registry line reads a class
at all.

### And three faults in the walk itself, recorded

- **The save button's `id` was queried as a `data-testid`.** It found nothing,
  which read as a save that wrote nothing.
- **An open row was counted as the presence of an input.** Behaviour 3 keeps
  both halves in the document always, so that counts every closed row - 31 rows
  "opening" when none had. An open row is a **hidden display half**.
- **The wait was satisfied by the previous render.** `testbed-host` is already
  present on a return visit, so the ownership step read the old owner.
  Verification 7's counterfactual, and the waits now key on a value only the new
  state carries.

---

## Item 4: re-navigation, and the key that came back

**Walked live: the second visit renders, settles, and lands on Reference.**

**The host's `key` was removed on a jsdom measurement and the walk put it back.**
The harness navigated tb-1 -> tb-2, where `useQuery` has no cache, `isPending`
is true and the host unmounts on its own - so the key looked redundant. **The
walk went tb-1 -> the list -> tb-1**, which is what a person does, and there the
query is cached: nothing unmounts and the previous visit's stage tab was still
open. Verification 47 - the harness must reproduce how the code is INVOKED.

Keyed on `navToken` rather than the id, because the id does not change on a
return visit and that is the case it exists for. The jsdom test now covers it.

**Duplicate-id detector: 3/3, no new dispositions.** The Test Bed React tree
declares no DOM ids; `EditBar`'s `id={saveId}` is `tb-react-save-all`, which the
markup does not carry.

---

## Item 5: calibration

`scripts/round7/inject-phase-2e.mjs`, hardened harness. **15/15 detected,
reverted run GREEN, all five files byte-identical.**

**Seven silences on the first sweep, every one a real weakness in my own
instruments**: two regexes matching the same strings elsewhere in `app.js`, a
services object rebuilt per navigation so a memoised effect re-ran anyway, an
assertion reading `textContent` that could not see a hidden row, a read-only
check reading the display half while the injection moved the wrapper, and a
keying assertion true by absence. All closed.

**Teardown in a `finally`, residue 0** on every run, including the conversion's
own Opportunity, which the fixture tag does not cover and the walk deletes by id.

---

## The ledger

`testbed-coupling.test.mjs`, **both directions**, in the pure suite.

**Direction A**, what reads the vanilla: 14 files, each removed, refused or
kept-with-a-reason. `app.js` is **REFUSED**; four test files are **KEPT as
retirement preconditions**; four are **PROSE ONLY** - comments naming the file,
which is the shape Verification 41 says to grep for as a string.

**Direction B**, what the React tree reaches back for: all 14 `ShellServices`
members, each with its reason, and the four the surface would break without
asserted present in the shell.

---

## Surprises

**1. The swap's worst defect was invisible to 900 unit tests and obvious in one
browser.** The registration collision needed both scripts on one page; the
door's class needed a real `canEditFields` reading a real DOM.

**2. Two of the four walk defects were routes or wiring I invented rather than
read.** `/api/stages` and, in session 1, the document routes. The same failure
twice in one round, both caught only by exercise.

**3. A fix can be correct and one render too late.** The ownership class written
from an effect was right in every way except when it ran, and the measurement
that caught it was identical to the one before the fix.

---

## Gate

**All 21 stages passed.** Pure 494/494, database 94/94, react **901/901**, all 0
fail, typecheck clean, 14 HTTP probes.

**Not pushed. Phase 3 follows on sign-off, and it owes the visual comparison.**
