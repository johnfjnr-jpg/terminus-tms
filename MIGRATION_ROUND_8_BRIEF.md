# Migration Round 8: the shell, the retirements, and the door

**Final, 2026-09-07.** The last round. Ruled by John this date: the
ownership door moves to a RECORD READ - it reads `owner_id` against the
session directly, no CSS class, no writer a swap can retire out from
under it, so the Round 7 defect class (a door that looks shut and is
open) cannot recur. Ground: the class mechanism's failure mode is silent
and security-relevant, and the migration hit it once for real. The cost
is reconciling the two ownership sweeps' derivations to the door's one,
which Phase 0 item 3 sizes. **Checkpoint, not a formality:** if Phase 0
finds `is-not-mine` readers beyond `CAN_EDIT_BY_VIEW`, or the sweeps feed
anything other than the door, the removal cost changes and returns to
John before Phase 1 implements - the ruling fixes the direction, the
measurement confirms the price.

The last round. `app.js` is 8,985 lines and is not a surface: it is the
shell every React view mounts into, the router, the session holder, the
two ownership sweeps, and the host of ~900 lines of now-dead Test Bed
view code. This round does NOT rewrite the shell in React - the React
tree needs a shell to mount it. It does three things: retire the two
remaining vanilla surface files and the dead shell code with them; rule
and implement the door model; and leave the shell inventory in a state a
future maintainer can read.

Method per the skill and all promotions through Round 7. The retirements
are sized by sandbox deletion and carry the rename lesson (a superseded
function in a still-loaded file is renamed, not merely made to refuse).

---

## Phase 0: investigation (no product code)

1. **The retirement inventory, both files, sized by sandbox deletion.**
   `test-bed-detail.js` (3,282 lines, one-round window open) and
   `contact-detail.js` (retired at Round 7 close but its tag and any
   residual couplings measured here - a retirement with a live tag is
   an incomplete retirement). Each: what breaks on deletion, one
   disposition per coupled test, the rename list for any superseded
   `app.js` function the deletion orphans.
2. **The dead shell code, enumerated exactly.** The ~900 lines of Test
   Bed view code in `app.js` (`renderTestBedDetail`, `loadTbStageDetailTab`,
   the tab strip, convert, and friends per Round 7's
   `tb-view-surface.mjs`). Each name: dead-reachable (delete),
   superseded-and-must-rename, or still-live. Sandbox-deletion evidence
   for every "dead", not a grep.
3. **THE DOOR, both sweeps measured.** `app.js:6520` (Test Bed) and
   `:8049` (Opportunity): what each derives `notMine` from, what reads
   the class, and the exact cost Round 7 found (the Test Bed sweep
   lived in the retired load path; the React view now writes the class
   during render). Under the record-read ruling, measure the full
   removal cost: every reader of `is-not-mine` (not only
   `CAN_EDIT_BY_VIEW`), and what each sweep feeds besides the door.
   THE CHECKPOINT: if a reader exists beyond the door, or a sweep feeds
   something else, that returns to John before Phase 1. The direction is
   fixed; the measurement confirms the price.
4. **The seam, final state.** The 14 `ShellServices` members: which are
   permanent (the shell genuinely owns them), which are temporary
   (bridging a vanilla mechanism that could retire). The inverted one
   (`setContactReturnView`) noted - it retires with `contact-detail.js`.
5. **What must stay vanilla, named.** The router, session bootstrap,
   the tab strip mechanics, `createTabStrip`, and anything the React
   tree mounts through. This is the shell's permanent core and the
   round does not touch it beyond the door.

## Phase 1: the door, record-read, behind the line

The door reads `owner_id` against the session through the seam; the two
sweeps' derivations reconcile to that one; the `is-not-mine` class and
its readers are removed, per Phase 0's measured set. Contract-derived
tests, injection-calibrated both directions on every doored surface, red
first: a record the session does not own refuses every row (click,
Enter, Space, seed); an owned record refuses none; and no removed class
can silently reopen anything, because there is no class left to write.
The Round 7 render-order failure mode is gone by construction, and a
test records that it cannot recur.

## Phase 2: the retirements, per policy

`test-bed-detail.js` and `contact-detail.js` deleted, each its own
commit, two-claims verified with the stripper. The dead shell code
retired in the same commits or their own, per Phase 0's enumeration,
every "dead" carrying deletion evidence. Renames landed for superseded
functions the deletions orphan. Coupling ledgers closed. The seam's
`setContactReturnView` retired with its file.

## Phase 3: walk, revert, close-out

The full estate walked live - every migrated surface still works, the
door in both directions on every doored surface, second-visit behaviour.
Revert rehearsals as applicable (the door change; the retirements are
deletions, not swaps, so their "revert" is the file's return, sized not
rehearsed). Rule promotion check. CURRENT_STATE.md. The close-out is the
MIGRATION'S close-out as well as the round's: the estate ledger at zero
vanilla surface files, the shell's permanent core named, the door model
recorded with its reasoning, and every carried business/data item
restated for John's disposition (the convert transaction, the
Unqualified->Parked rule, must-differ, marginPresentation, the
create-route nulling, the atomicity flake, the two-names revision field).

## Exit gate for the migration's close

1. The door model is ruled, implemented, and proven in both directions
   on every doored surface, with the reopen-on-retired-writer failure
   mode guarded or removed.
2. No vanilla surface file remains loaded; the dead shell code is gone
   with deletion evidence; the shell's permanent core is named and
   intact.
3. Every carried item is stated for disposition; the migration's
   close-out reads as the estate's map, not just this round's diff.
