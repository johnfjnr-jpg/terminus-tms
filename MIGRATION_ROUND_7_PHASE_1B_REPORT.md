# Round 7 Phase 1b: scoring and units

Behind the line. No swap, no registration, the vanilla Test Bed still live.

**Precondition:** Phase 1a committed at `b0750ea`, 21-stage gate green.

---

## WHAT IS NOT BUILT, first, per build-discipline rule 15

Nothing in this phase's instruction is carried. Both items landed whole, the
detectors ran, the contract addendum is in.

**One thing is DEFERRED BY RULING rather than unfinished:** A12, the contract
addendum landed by item 4, is implemented in Phase 2's swap commit and not
here. That is the instruction, not a shortfall, and the entry says what Phase 2
owes it.

**One discipline lapse, recorded because the round's own rules say a record is
worth more tidy than flattering.** Item 2's first batch - `units.ts` and
`scoring.ts` covering S2, S4, S5, C1, C5, C6, C7, C8, C9 - was written BEFORE
its tests, not red first. The second batch (S1, S3, S7, C2) was properly red
first and is quoted below with its failures. What makes the first batch
evidence is the injection sweep rather than the ordering: 21 of 21 injections
fired, which is the standard Verification 47 sets for a suite that was green on
its first run.

---

## Item 1: the four load-bearing behaviours

Enumerated first, in a dated addendum to `MIGRATION_TEST_BED_CAPABILITIES.md`
naming Q1-Q8, U1-U5, B1-B5 and R1-R4 exactly. Then built B-style.

**Red first, quoted from the run:**

```
Failed to resolve import "../testbed/unitQueue" from "src/__tests__/testbed-queue.test.ts"
```

Four modules followed: `unitQueue.ts`, `useCases.ts`, `exitCriteria.ts`,
`scoreReason.ts`. **27 of 27 tests pass.**

### The calibration

`scripts/round7/inject-phase-1b.mjs`, verified-snapshot harness per
Verification 44: full-path keys, the snapshot asserted non-empty and
round-tripped before anything is injected, the restore compared byte-for-byte
after EVERY injection with a stop on mismatch, a unique-anchor refusal, and a
final reverted run.

**12 of 12 detected. Reverted run GREEN. All four files byte-identical.**

| behaviour | injection | verdict |
|---|---|---|
| Q3 | the revision is read at ENQUEUE instead of at execution | DETECTED |
| Q1 | ONE GLOBAL QUEUE, so two rows serialise against each other | DETECTED |
| Q5 | failures become burst-scoped, so a later success erases a refusal | DETECTED |
| Q6 | the row names the MOST RECENT failure instead of the first | DETECTED |
| Q7 | a thrown link breaks the chain | DETECTED |
| Q4 | the response is not adopted, so the next link reads a stale unit | DETECTED |
| U | a blank use case is written anyway | DETECTED |
| B1 | THE TICK BECOMES A BOOLEAN, which the gate reads as PRESENT | DETECTED |
| B2 | isTicked stops agreeing with the gate about `false` | DETECTED |
| R1 | the level stops deciding, and a hardcoded list decides instead | DETECTED |
| R4 | MUST-DIFFER REMOVED, so the same reason is accepted again | DETECTED |
| R4 | it compares against the OLDEST reason instead of the newest | DETECTED |

### Two fixtures that were too weak to falsify anything

Both were found by an injection coming back SILENT with **zero** failures,
which is the Verification 51 signature.

**The refusal fixture** (carried from Phase 1a and hit again here). `{ ok:
false }` with no body makes the guarded and unguarded forms answer identically,
so the guard's removal changed nothing. Fixed by giving the refusal a body.

**The levels fixture.** `{ 1: reason required, 3: not }` is answered exactly as
well by `score <= 2` as by reading the level, so R1's injection - replacing the
data read with a hardcoded level list - was invisible. **The fix was to add a
HIGH level that requires a reason** (value 3, `reason_required: true`), which is
the real case `CLAUDE.md` records against Architecture 9's fourth variant: a
confirmation scale whose **Confirmed** level gained a required reason, and a
message that went on saying "name what is missing".

---

## THE FINDING: R4 must-differ is implemented NOWHERE, and my own enumeration was wrong

**`src/lib/score-entry.js` refuses an empty reason twice** - line 129 for a
level carrying `reason_required`, line 158 for a revision - **and compares it to
nothing.** The client checks non-empty only. There is no must-differ rule in
this system.

**The Phase 0b enumeration stated it as C4, a behaviour of this surface, citing
Round 30.** Round 30's ruling was about the **Opportunity assessment panel**,
which is a different surface. The enumeration inherited a measurement from one
screen and stated it as a fact about another - Verification 26 exactly, and the
business's own remedy for it names the measurement an instruction rests on.

**Consequence for scope, stated plainly: building must-differ is an IMPROVEMENT,
not a port.** It is built here because the ruling behind it is sound and the
reasoning is recorded, but it must not be described as parity, and a walk
comparing the two surfaces will find the React one refusing something the
vanilla accepts.

---

## Item 2: the rest of scoring (24 names) and units

Derived from the Phase 0b enumeration's S1-S7 and C1-C9.

**Red first for the second batch, quoted from the run** (7 failing):

```
AssertionError: safesightCameras is not declared a payload count
TypeError: DERIVE_ROUTE is not a function
TypeError: Cannot convert undefined or null to object
TypeError: unitsForTab is not a function
```

Two modules: `units.ts` and `scoring.ts`. **24 of 24 tests pass.**

### What the enumeration asked for, and what was done with it

**S5 was the enumeration's own instruction and it is met by DERIVATION rather
than by a test over two tables.** `COUNT_KEY_FOR_UNIT_TYPE` is built from
`COUNT_KEY_TO_UNIT_TYPE` with `Object.fromEntries`, and the test proves the two
inverse in both directions plus equal in size - so a hand-written replacement
fails rather than drifting. Verification 20.

**S2's clamp is PER TYPE, and that is asserted separately from the shortfall
itself.** Three surplus SafeSight units must not cancel two missing HEMIR ones,
because the correction offered is per type. The obvious implementation - clamp
the total - passes the simple case and fails only this one.

**S7 is a contract silence, and a position was taken.** The enumeration names
`UNIT_TYPE_FOR_TAB_KEY` and never says what the tab keys are. **Position, dated
2026-09-07 and recorded at the code: the tab key IS the count key**, so the map
is the count map under another name and is not written a second time. Same
reasoning as S5. Revisitable at first contact with the real tabs.

**S3's route was read as shorthand.** The enumeration writes the other routes
in full (`GET /test-beds/:id/units`, `POST /test-beds/:id/measurability`) and
this one as `POST /units/derive`, under the same prefix. Read as
`/api/test-beds/:id/units/derive`, and asserted DIFFERENT from the units read so
the two cannot collapse.

**C2's two stores are separate on purpose.** `drafts` is what the box holds;
`recorded` is what the record has been told. Recording clears that criterion's
draft and leaves every other draft alone - which is what makes C6's lock a lock
rather than a second copy of the same number.

### The calibration

`scripts/round7/inject-phase-1b-item2.mjs`, same verified-snapshot harness.
**Matchers anchor on TEST NAMES, not on assertion messages**, per the caveat
this round added to Verification 51: a test aborts on its first failing
assertion, so a matcher taken from a later assertion never appears and a fired
injection reads SILENT.

**21 of 21 detected. Reverted run GREEN. Both files byte-identical.**

| family | injection | verdict |
|---|---|---|
| S5 | the inverse is HAND-WRITTEN instead of derived, and drifts | DETECTED |
| S2 | the shortfall is clamped on the TOTAL, so a surplus cancels a gap | DETECTED |
| S2 | the count is read without the string coercion | DETECTED |
| S4 | the lock asks EVERY unit instead of ANY | DETECTED |
| S4 | an unknown count key locks the row | DETECTED |
| S1 | the payload count list is hardcoded and misses one | DETECTED |
| S3 | derive collapses onto the units READ route | DETECTED |
| S7 | the tab map is written a SECOND time and drifts | DETECTED |
| S7 | the pane stops filtering, so every type renders in every tab | DETECTED |
| C5 | the save stops blocking on a missing reason | DETECTED |
| C5 | whitespace is accepted as a reason | DETECTED |
| C5 | a draft with no criterion is treated as one | DETECTED |
| C1 | levels are invented when the criterion carries none | DETECTED |
| C6 | the entry lock never engages | DETECTED |
| C7 | disclosure MUTATES the caller set, making it state | DETECTED |
| C8 | measurability folds onto the score route | DETECTED |
| C9 | the summary reads the OLDEST entry as latest | DETECTED |
| C2 | recording does not clear the draft | DETECTED |
| C2 | recording clears EVERY draft, not only the recorded keys | DETECTED |
| C2 | setting a draft RECORDS it | DETECTED |
| C2 | the draft store is mutated in place | DETECTED |

---

## Item 3: the standing detectors

| detector | result |
|---|---|
| accounting (`test-bed-accounting.test.mjs`) | 8/8 pass, and it grew - see below |
| duplicate ids (`no-duplicate-ids.test.mjs`) | 3/3 pass, no new disposition needed |
| computed visibility (`hidden-not-overridden.test.mjs`) | 2/2 pass |
| node stability (`field-row-stability.test.tsx`) | 4/4 pass |

### The accounting's `migrated` flag had no reader, and now has one

It was declared, asserted to be a boolean, and read by nothing else - a
hardcoded claim with a shelf life (Architecture 9's fourth variant) and a
required field with no reader (Verification 22). **Ten flags were about to be
flipped to `true` by hand on the strength of my own memory of what Phase 1a
built.**

**Every capability now names the React modules that implement it, and the flag
is asserted to AGREE with whether those files exist on disk.** A flag flipped
without a module fails; a module deleted under a flag fails; a flag left `false`
while its module exists fails. A second test refuses the degenerate agreement of
declaring nothing on both sides, which is Verification 14.

**Calibrated three ways, each reverted byte-identical:**

| injection | result |
|---|---|
| a flag flipped `true` with no module | 2 failed |
| a migrated capability's module renamed away | 1 failed |
| a flag left `false` while its module exists | 1 failed |

**Ten of twenty capabilities now read migrated:** field-rows, save-path,
cost-preview, date-bounds, buyer-roles (Phase 1a); sensor-counts, use-cases,
exit-criteria, scoring, units (Phase 1b). Ten remain: view-lifecycle,
validation, notes-history, revision-history, site-details, commercials,
install-section, installer, tech-team, customer-documents.

### Duplicate ids: the Phase 1b modules declare none

Measured rather than assumed, because my first scan of this was wrong. **The
Test Bed React tree declares no DOM `id` at all** - everything is
`data-testid`, and the one real id it renders is `EditBar`'s `id={saveId}`,
passed as `tb-react-save-all`. Not present in `index.html` (`tb-save-all` is the
vanilla's), and the standing detector already covers the `saveId=` form
specifically. No new disposition.

**A recorded instrument fault, because it is the shape this file keeps
recording.** My first pass at this scan ran a regex through a double-quoted
shell string containing a backtick. The shell ate it, the scan reported
`ids: 0` for every file, and **a zero from a scan that did not run reads exactly
like a clean result** (Verification 12). It was caught because a plain `grep`
found ids the scan said were absent. The rewritten scan carries a calibration
line - `index.html ids parsed: 514, ref-save-all present: true` - so a future
zero is separable from a future silence.

---

## Item 4: the contract addendum, landed

**A12, dated 2026-09-07, eighth entry in `MIGRATION_FIELD_ROW_CONTRACT.md`: on
a surface whose door refuses, a row has no tab stop.**

It is behaviour 7's own logic rather than a new rule - a stop that cannot be
acted on is a stop that lies - stated for the second cause of the same
condition. The entry carries the Phase 0b measurement it rests on (the vanilla
door is presentational: mouse blocked, keyboard open), the distinction from that
fault (this is not a hole; the row refuses correctly, the stop just means
nothing), and the reason the scope is the shared component rather than each
surface.

**Implementation deferred to Phase 2's swap commit, as ruled**, with three
things named that Phase 2 owes it: the branch, an injection per cause asserted
separately, and an assertion that the refused row still READS.

---

## Checklist deltas

**None.** Phase 1b built no new field-row usage - the four behaviours and the
scoring and units work are all logic modules with no rows - so the seventh
entry stands as Phase 1a left it. A12 is a contract addendum, not a checklist
position.

---

## Surprises

**1. The must-differ finding, above.** A behaviour I enumerated as a port turned
out to exist nowhere, and the citation I gave for it was about a different
screen.

**2. A fixture can be too weak in a way only an injection shows, twice in one
phase.** Both the refusal body and the levels shape read as perfectly reasonable
test data. Neither could tell the guarded form from the unguarded one.

**3. The `migrated` flag was one commit away from being ten hand-typed claims.**
The instruction said "accounting updated with the migrated flags", and the
obvious reading is to flip ten booleans. Giving them a reader took twenty lines
and three calibrations, and it means the next round cannot inherit a flag that
has quietly stopped being true.

**4. My own id scan was the instrument fault it was looking for.** Recorded
above.

---

## Gate

**All 21 stages passed.** Pure 479/479, database 94/94, react 684/684, all 0
fail, typecheck clean, 14 HTTP probes, on the working tree carrying this phase.
Every figure parsed from the run's own output per Verification 20.

The react suite grew by 51 across this phase (633 to 684); the pure suite by 2
(477 to 479, the accounting's two new tests).

**Not pushed. Phase 2 not started.**
