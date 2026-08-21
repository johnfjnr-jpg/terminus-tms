# Round 17A fix brief: the revision race, and six issues from business testing

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND17_BUILD_BRIEF.md`, `ROUND17A_INPUT.md`. Read all seven before
starting.

**Re-read `CLAUDE.md` from disk** and say whether the copy you hold is
current, rather than assuming either way.

This is a fix round with one severe defect at its head. **Open item 35 is
the most serious thing recorded about this system**, and Round 17 shipped a
surface where it is reachable by ordinary typing rather than by two
overlapping user actions.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Why this round leads with one defect

`ROUND17A_INPUT.md` records seven issues from the business's testing. Six
are ordinary. The first is not, and two of the others are consequences of
it rather than peers.

**The mechanism.** `src/routes/test-beds.js` reads the highest revision
number, computes `+ 1`, and inserts, with no transaction, no
`SELECT FOR UPDATE`, no sequence, no `ON CONFLICT` and no retry. **Nine
sites share that shape and none handles `23505`.** The unique constraint
`(record_id, revision_number)` is the only thing stopping a second write
landing as a duplicate revision, and every gate decision resolves current
state by ordering on that number.

**So the constraint is doing load-bearing correctness work and reporting it
as a 500.** Without it this is not an error. It is two versions of a record
each claiming to be the same one, with gate evaluation picking whichever
the ordering happens to return.

**It leaves no trace.** A refused insert writes nothing, so revision
numbers stay consecutive and a collision cannot be found by looking for a
gap. Every prior occurrence is unknowable, and the only evidence is a user
seeing a 500.

**Round 17 made it substantially easier to hit.** `onTbUnitFieldChange` is
`async`, bound to `change`, unawaited, with no in-flight guard, so tabbing
between fields in one unit row issues overlapping PATCHes to one record.
Every other route needs two overlapping user actions. This one needs a
person filling in a serial and a latitude on a table that can hold 24 rows.

---

## Scope boundaries, confirmed with the business

- **The fix is atomic, not defensive.** Catching `23505` and retrying
  works and leaves the race in place, and a retry loop depends on the
  constraint continuing to catch what it was never meant to be responsible
  for. Confirmed with the business: the proper fix.
- **Live cost calculation computes on the server.** Confirmed with the
  business: no second cost engine. See Phase 6.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at
  61 total, 45 on `test_bed`.
- **No anchor wording changes.** The business review still has not
  happened and carries nine items.
- **Record history is Round 18**, deferred an eighth time by this round's
  arrival rather than by choice. State that plainly.
- **Issue 7's second half is not in scope.** The business flagged that
  units save on blur while the rest of the app uses a batched Save bar, and
  asked to discuss it later. Phase 2 fixes the write path's safety, not the
  interaction pattern. Do not change one into the other.

---

## Standing rules that bear on this round

1. **A race fixed without a reproduction is a race you hope is fixed.**
   Phase 0 must reproduce it. Phase 1's proof is the same reproduction
   shown failing on unmodified code and passing on fixed code, run enough
   times to have failed before. That is Verification 13 applied to a
   timing fault: a zero from a run that was never fast enough to collide is
   not a measurement.

2. **Build discipline 8: fix the class, not the instance.** Nine sites, not
   the one the business stood on. `ROUND17A_INPUT.md` records a related
   miss: `records.js:43` carries a Milestone 2 TODO to make record
   *creation* atomic, the case that cannot collide, while the update path
   that can never got one.

3. **Verification 4: presence is not legibility.** Phase 5 changes a
   layout. Round 15 Phase 4 shipped a card whose totals rendered as the
   least prominent figures on the tab with every check passing.

4. **The `el.focus()` finding.** A visible element with a correct rect and
   `document.activeElement` agreeing can receive no keydown at all. Phases
   2, 3 and 4 all drive fields. Use real mouse clicks and instrument the
   event.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts.

### 0.1 Reproduce the race

**This is the phase's most important output.** Everything after it depends
on having a case that fails.

Two overlapping writes to one record, through the real endpoints. Report
the reproduction rate, since a race that fires one time in fifty needs a
different proof design from one that fires every time.

**Then reproduce it through the UI**, using `onTbUnitFieldChange`, by
tabbing between fields in a unit row. `ROUND17A_INPUT.md` identifies this
as item 35 reachable by ordinary typing. Confirm or refute it, and report
how fast a person has to be.

### 0.2 The mechanism options

Report what is actually available, rather than assuming a transaction.

Three candidates, and the brief does not choose between them because the
answer depends on the client and schema:

| Option | Question to answer |
|---|---|
| `INSERT ... SELECT` computing the number in one statement | Can the Supabase client issue it, and does it hold under concurrency without an explicit lock? |
| A database function called through RPC | What does it cost, and does it fit the existing migration and seeding discipline? |
| Transaction with `SELECT FOR UPDATE` | Is a transaction block reachable at all through PostgREST, given Round 15 established the ledger schema is not? |

**Report which is genuinely available and which only appears to be.**
Round 13 Phase 7 found `db.schema('supabase_migrations')` returns
`Invalid schema` and there is no arbitrary-SQL RPC, so the client's real
capabilities are narrower than they look.

### 0.3 All nine sites

Enumerate them with their exact loci, and report whether they are
genuinely the same shape or merely similar. `ROUND17A_INPUT.md` lists
`accounts.js:440`, `contacts.js:357` and `528`, `opportunities.js:354` and
`440`, `test-beds.js:825`, `1480`, `1687` and `1869`, and `deals.js:297`.

**Report whether one shared writer is the right answer or nine edits are.**
Nine sites sharing a shape is the argument for a helper, and Round 16
Phase 1 made exactly that argument about tab strips. But a shared revision
writer touches every write path in the system, which is a larger change
than a bug fix, and it should be a decision rather than a default.

### 0.4 `POST /api/deals/calculate`

Phase 6 needs the cost engine to compute from draft values without a second
implementation. **Report whether that endpoint already does this**: what it
takes, what it returns, whether it persists anything, and whether the Test
Bed cost engine is reachable the same way. If it is, Phase 6 is wiring. If
not, report what a calculate-only path would need.

### 0.5 The other five issues

Confirm `ROUND17A_INPUT.md`'s findings at each locus rather than restating
them, and report anything it got wrong. It records that two of the six were
reported with a cause the code contradicts.

### 0.6 Baseline

`npm test` and `npm run test:db` on a clean checkout of `main`. Keep the
full output. `PGRST303` was diagnosed in Round 17 Phase 0 as sub-second
host clock skew tripping a zero-tolerance `iat` check; if it fires, that is
the known cause. Check residue before and after, enumerating by `owner_id`.

---

## Phase 1: Make the revision write atomic

**All nine sites, through one shared RPC. Settled by Phase 0, not left
open.**

### Amended after Phase 0, 2026-08-21

Phase 0 answered the three questions this phase was left holding. The
answers are binding, and two of them change what Phase 1 builds.

**1. The atomic write takes the payload merge with it.** The RPC receives a
patch and merges it inside the same statement, so **the read that supplies
the revision number and the read that supplies the payload are the same
read.**

The reasoning, recorded because the narrower version looks correct and is
worse than the defect: today both values come from one JS-side read, and the
unique constraint refuses the loser. Make only the numbering atomic and both
writers succeed, at different numbers, each having merged its own field into
the same stale payload. **The second silently drops the first's field.**
Phase 0.1 already demonstrated exactly that outcome from the current race:
three values entered, `latitude` stored, `longitude` absent, `serialNumber`
still holding a previous value, **and the row reading "Saved"**. Numbering
alone would make that the normal result rather than the collision result.
**A loud failure would be traded for a silent loss.** Any jsonb comparison
introduced in the function follows Architecture rule 5: jsonb to jsonb,
never through a `::text` cast.

**2. One shared RPC for all nine sites.** An atomicity guarantee that lives
in more than one place is not a guarantee.

The evidence is in the file being fixed. `appendPayloadSeriesEntry`
(`test-beds.js:1461`) was extracted for precisely this reason, carrying the
comment "two writers of one shape is not a fork of the mechanism". **It has
one caller.** The score endpoint it was extracted from kept its own copy at
1687. A shared writer was created and the original was never migrated to it,
in the same file, in the same round. Nine sites converging is the argument
Round 16 Phase 1 made for tab strips, with the added force that a guarantee
duplicated is a guarantee lost.

**3. Follow `issue_reference_number`'s established shape.**
`supabase/migrations/20260814000000_reference_number_counter.sql` already
solves this class atomically in this codebase: `INSERT ... ON CONFLICT DO
UPDATE ... RETURNING`, `security definer`, `set search_path = public`,
`grant execute ... to authenticated`, called through `db.rpc()` by a
request-scoped user client. Phase 0.2 confirmed this is the **only**
mechanism genuinely available: no transaction is reachable through
PostgREST, no arbitrary-SQL RPC exists, and a non-public schema returns
`PGRST106`.

**The proof template already exists and is green.** `npm run test:db`
carries "atomicity: 50 genuinely concurrent issues, no duplicates and no
gaps", built on `Promise.all` and carrying the comment that **a sequential
loop would pass even if the RPC were not atomic at all**. Phase 1's test
follows that design, including that reasoning, because it is the same
vacuous-pass trap Verification 13 names.

---

**The proof is the reproduction, not the absence of the symptom.** Run
Phase 0.1's case against unmodified code and show it failing, then against
fixed code and show it passing, at the same concurrency and iteration
count. A fix that makes a race rarer looks identical to one that removes
it, and only the before case distinguishes them.

**Three things to confirm rather than assume:**

1. **The revision number is still contiguous per record.** Gate evaluation
   orders on it, and a fix that leaves gaps would be correct about
   uniqueness and wrong about the thing the number is for.
2. **Every existing caller still behaves.** Nine sites, four record types,
   and the write path every record in the system goes through. The suite
   is the floor, not the proof.
3. **The constraint stays.** It stops being the mechanism and remains the
   backstop. Removing it because the race is fixed would leave nothing
   catching a future path that bypasses the shared writer.

**Test evidence required:** the before and after reproduction, with
iteration counts and failure rates. Confirm contiguity on a record that
took concurrent writes. Both suites passing. Confirm the write path works
for every record type that uses it, exercised rather than reasoned about.

---

## Phase 2: The unit field write path

`onTbUnitFieldChange` is `async`, bound to `change`, unawaited, with no
in-flight guard. Tabbing between fields in a unit row issues overlapping
PATCHes to one record.

Phase 1 makes those writes safe. **Phase 2 makes them not overlap**, which
is a different problem: two PATCHes racing to write the same payload key
have a last-writer-wins outcome that atomicity does not address.

**Do not change save-on-blur into a batched Save bar.** The business
flagged that as a discussion, not a request, and Phase 2's job is the
write path's safety.

**Test evidence required:** tab through every field of a unit row at
realistic speed and confirm every value lands, verified server-side rather
than from responses. Confirm the same for two adjacent rows. Report whether
a user can now outrun the guard and what happens if they do.

---

## Phase 3: The derive control's reachability

`ROUND17A_INPUT.md` corrects the reported cause. **`derive` is idempotent
and would create exactly the missing slots.** What blocks it is
`test-bed-detail.js:2522`, which hides the control behind
`if (!tbUnits.length)`, so the only caller of a working endpoint disappears
when it would first be useful.

The business's case: a unit came out for repair, was set to Planned, the
count was corrected down with a reason, and increasing the count again did
nothing. They expected the slot to re-open.

**Two things to decide and state rather than let fall out:**

1. **Whether increasing a locked count is a correction.** Phase 3 of Round
   17 built the correction path with a reason, and it was framed as a
   downward case. An increase is equally a divergence between plan and
   record, so it presumably needs a reason too.
2. **Whether re-deriving is automatic on a successful increase, or a
   second explicit act.** Round 17 Phase 2 made derivation explicit
   precisely because a write must not be the consequence of a read. An
   increase is already an act, so deriving from it is a consequence of an
   act rather than of a read, which is a different case.

**Test evidence required:** the business's exact sequence, end to end.
Reduce a count with a reason, confirm the surplus Planned slot is soft
deleted, increase it again, and confirm a usable slot exists at the end.
Confirm the restored slot's index, since Round 17 Phase 1 established
indexes are contiguous and a soft-deleted slot 4 followed by a new slot 4
needs a stated outcome.

### Amended after Phase 0, 2026-08-21: the index invariant is ALREADY false

This was written as a question for Phase 3 to decide. Phase 0 found it has
already been decided by accident, against the comment that governs it.

`test-beds.js:1802` states that "a slot is never reissued after a removal:
indexes identify a slot, not a position in an array." **`loadUnits` filters
out soft-deleted rows**, so the `max(index)` the derive loop computes never
sees a removed slot and reissues its number. Measured on the business's own
sequence, reduce 3 to 2 then raise and re-derive:

    live indexes: [1,2,3]   soft-deleted indexes: [3]
    REISSUED index(es): [3]

**Phase 3 states the outcome and then either makes the comment true or
corrects it.** Both are acceptable answers; leaving a governing comment
contradicted by the code it governs is not. If reissue is right, the comment
is wrong and says so. If the comment is right, `max(index)` has to see the
soft-deleted rows.

**Assert it either way**, per Verification 5: whichever outcome is chosen
belongs in the automated suite, where it passes or fails, not in prose that
the next round reads as true.

---

## Phase 4: The date bound and the stale banner

Two small fixes, both confirmed at their loci in `ROUND17A_INPUT.md`.

### 4.1 The calendar allows an invalid go-live date

Round 15 Phase 1 set a native `min` on the go-live field and a `max` on the
installation field. The bound is applied at render and is stale when the
other date changes in the same editing session, which the code comment at
`test-bed-detail.js:220` already admits.

### Amended after Phase 0, 2026-08-21: downgraded to a client affordance defect

**The question this section asked has been answered. The server refuses, in
all three directions**, tested directly against the running endpoint:

    install 2026-10-01 + go-live 2026-12-01, one PATCH     200
    go-live before install, both in one PATCH              400
    move install later than a stored go-live               400
    move go-live earlier than a stored install             400

all three refusals carrying `Est. Go Live cannot be before Estimated
Installation Date`. Round 15 Phase 1's server half holds intact.

**So no invalid data can reach the database, and this is a client affordance
defect only.** The cost is that a user is allowed to enter a pair the server
will refuse, and finds out at Save rather than at entry. Scope it as the
stale bound it is: recompute the `min`/`max` when the other date changes in
the same session. **Do not re-prove the server rule as though integrity were
at stake**, and do not let the fix grow into a validation change.

### 4.2 The scoring error banner persists through a transition

`clearTbSaveFeedback()` has four callers and the transition path is not one
of them. `ROUND17A_INPUT.md` records this as build discipline 6 for the
fourth time, against a 2026-08-15 fix that stopped at `openTbField`.

**Fix the class.** Report every path that changes what the user is looking
at without clearing feedback, not the one reported.

**Test evidence required:** set the installation date after the go-live
date in one session and confirm the bound updates. Confirm the server still
refuses both directions, called directly. Produce a real error, transition,
and confirm the banner is gone, asserted by count.

---

## Phase 5: Total Cost merged into the Cost summary

The business asks for the standalone Total Cost line to be removed and the
Cost summary panel extended to carry the total.

**This reverses part of Round 15 Phase 4**, which deliberately left Total
Cost above the detail because Round 8 Phase 3 put it there to keep it
visible, and pulling it into the grid would push it below the rate panels.

`ROUND17A_INPUT.md` flags that the supporting measurement has already been
shown to invert: Round 17 Phase 0 measured the carried Round 8 item at 25px
below the fold at 1920 and 290px at 1240, having been recorded for seven
rounds as a 1920 problem. **Verification 15 applies:** a criterion
expressed as a measurement at one viewport stops describing the thing it
was written about.

So the question is not whether the merge is tidier. It is whether the total
remains visible after it, **measured at both widths**.

**Test evidence required:** before and after heights above the total at
1240 and 1920, on the same fixture, using Round 17 Phase 0's anchor so the
figures are comparable to the carried item's own record. Exactly one Total
Cost instance, asserted by count. Open the screenshots and report whether
the merged panel reads, since Round 15 Phase 4 shipped a version of this
card whose totals were the least prominent figures on the tab.

---

## Phase 6: Live cost calculation from unsaved values

Confirmed with the business, including the constraint that matters:
**no second cost engine.**

The cost engine is server-side and is the single computation path, the same
discipline Round 9 established for `computeBlocking()`. A browser
implementation would be a second engine that agrees on the day it is
written and diverges quietly, in a tab where the numbers are commercially
binding. The business has confirmed the cash flow tool in Opportunities
will use the same engine, which strengthens rather than weakens the rule.

**So the draft values go to the server and the result comes back.**

### Amended after Phase 0, 2026-08-21: one new route, not wiring

**Phase 6 is NOT wiring to `POST /api/deals/calculate`.** That endpoint is
the right shape and the wrong engine: it calls `calculateDeal`, the
Opportunity engine, with the Opportunity input shape. It is the **precedent
to match, not the endpoint to call.**

What it establishes, and what to copy: it takes the full input object in the
body, returns the computed result, touches no database and persists nothing,
carries a body schema (`dealInputSchema`), and sits inside `server.js`'s
authenticated scope.

**The Test Bed equivalent is one new route over a function that already
exists.** `buildTestBedCostBreakdown(payload)` is exported at
`test-beds.js:17`, is a pure function of the payload, and is **already the
single mapping point**, called from both GET and PATCH, deliberately
exported in Round 7 Phase 8 so a backfill would run through the real
function rather than a copy. A route accepting a draft payload and returning
`buildTestBedCostBreakdown(payload)` reuses the one engine by construction
and satisfies constraint 1 below without needing to be careful, since there
is no write path in it to avoid.

**Three constraints:**

1. **Calculating must not persist.** A displayed figure from unsaved input
   is a preview, and a preview that writes is a write disguised as a read,
   which Round 17 Phase 2 established as the thing to avoid.
2. **The displayed total must never be mistaken for a saved one.** A user
   looking at a figure derived from values they have not saved needs to
   know that, or the Save bar becomes advisory.
3. **Do not call per keystroke.** Report the trigger chosen and why. A
   round trip per character is a different defect from the one being fixed.

**Test evidence required:** enter values without saving and confirm the
totals update. Confirm nothing was persisted, by direct query. Confirm the
figures match what the same values produce after saving, which is the
proof there is one engine rather than two agreeing today. Confirm the
unsaved state is distinguishable, and report how.

---

## Phase 7: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.
`scoring_criteria` 5, `scoring_anchors` 15 at version 1 only.

Tear down by enumerating from the database by `owner_id`.

Report whether the business exercised unmerged branch code mid-round,
counting revisions and timestamping them against the merge. **Round 17's
re-measurement found all 41 business writes landed after the merge**, so
the instrument and the method are established.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **Open item 35's resolution**, including the reproduction rate before and
  after, since a race with no forensic trace can only be proven fixed by
  the case that failed.
- **That the constraint remains as a backstop** and why, so a future round
  does not remove it as redundant.
- **Phase 3's two decisions**, since an upward correction and automatic
  re-derivation both extend a mechanism built one round earlier for the
  opposite case.
- **Phase 6's single-engine decision**, in the business's terms, with the
  Opportunities cash flow tool named as the reason it matters beyond this
  tab.
- **That Round 17 shipped a surface making item 35 reachable by ordinary
  typing.** That is worth recording plainly: a round can make a latent
  defect materially worse without touching it.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off. A report cannot sign off the phase
containing it.

**State in the close-out whether this round edited `CLAUDE.md`.**

---

## Round 17A outcome

Eight phases, 0 through 7, confirmed by `grep -n "^## Phase\|^### Phase"`
returning 8 headings with no `###` sub-phases. **Phases 0 through 6 each carry
an explicit sign-off in the session transcript; Phase 7 is signed off by the
message that commissioned this close-out**, and the report containing it does
not sign off its own phase.

---

### THE EXPOSURE: this round removed the last thing between the business's browser and unfinished code

**Placed first because open item 23 has now read "did not fire" for four
consecutive rounds while the exposure behind it grew, and a fourth quiet entry
is exactly how a structural risk becomes one people treat as theoretical.**

Round 17A was built **directly in `main`'s working tree, with no branch at
all.** Every previous round at least put its work on a branch that had to be
checked out. The dev server serves the frontend from disk and the API from the
same tree, so for roughly four hours `localhost:3000` was whatever
half-finished state the current phase had reached.

**Including a window in Phase 1 where ten write paths had been edited and the
server had not yet been restarted**, so the browser was being served new
frontend code against old backend code. Anyone opening the application in that
window would have been using a system in a state no phase ever signed off.

The measurement:

    business revisions today          41
    first / last                      03:29:40Z / 03:52:03Z
    this round's first source change  04:47Z
    business writes after it          0

**So the item did not fire. It did not fire because of timing, not because of
design.** The business finished for the day 55 minutes before the first file
changed. Nothing about the arrangement prevented what it is there to prevent,
and this round made the arrangement worse than any round that preceded it.

**Four rounds of absence establish nothing about the risk.** They are evidence
about the business's weeks. Item 23 stands at full strength and is now
understated by its own history.

---

### THIS ROUND EDITED `CLAUDE.md`

**Verification 4 was refined**, in that file, in this round, per the standing
rule that a correction to a rule living there lands there rather than only in a
brief. The refinement: "open the screenshot" assumes the screenshot contains
the thing. A clipped capture was taken of a region the element had scrolled out
of, the image was pure background, and every programmatic check passed on it,
because the checks were querying the live DOM while the picture showed nothing.

**The next session must re-read `CLAUDE.md` from disk.** The copy delivered at
session start is a snapshot, and a session following a round that edited it
receives the old version. Round 15 was the last round to edit it; Rounds 16 and
17 did not.

### Open item 35 is resolved, and the proof is the reproduction

A race with no forensic trace cannot be proven fixed by the absence of the
symptom, because a race that merely became rarer looks identical. Same script,
same concurrency, same iteration counts, before and after:

    concurrent writes to one record    before        after
      2                                50% refused   0%
      3                                53% refused   0%
      5                                68% refused   0%
     10                                82% refused   0%
    200 requests in total              58 landed     200 landed

Two concurrent writes collided in **10 of 10 trials** before. Through the UI at
paste speed, three values entered produced two refused writes and a row reading
"Saved"; after, all three persist.

**The test that guards it is calibrated, not merely green.** Run against a JS
reimplementation of the old read-then-insert at the same concurrency, 37 of 40
appends fail and 3 of 40 patch keys survive. That run also showed **contiguity
alone would not have caught this**: the naive shape left revisions 1..4
perfectly contiguous while losing 92% of its writes.

**The unique constraint remains as the backstop** and must not be removed by a
future round as redundant: it is what would catch a call site added later that
bypasses the shared writer, which is how ten sites came to share one shape.

### The count was TEN, not nine

Every document in this round said nine sites, including the Phase 0 report that
enumerated them. The input document's own list came to ten while its prose said
nine, and Phase 0 reconciled downward by dropping one to match the count.
**The dropped site was `test-beds.js`'s unit PATCH: the one Phase 0 reproduced
the race against, and the one Phase 2 exists to fix.**

### The carried Round 8 fold item is 45px WORSE at both widths after Phase 5

**A cost paid deliberately, and not to be read as progress against that item.**

The business asked for Total Cost to move into the Cost summary panel. Measured
at Round 15 Phase 4's own anchor, before and after, with the before reproducing
the carried record exactly:

    1240x800    below the fold  290px  ->  335px
    1920x950    below the fold   25px  ->   70px
    3440x1440   above the fold in every arrangement

**The superseded reasoning was right.** Round 15 Phase 4 declined this merge on
the grounds that pulling the total into the grid would push it down behind the
rate panels, and it does.

**The 45px is decomposed rather than estimated: it is the card's own chrome**,
14px of padding, a 26px title and 4px of title margin. A bare band has no
title, so no arrangement of a titled card can match it. The conventional
total-at-the-bottom form costs 185px instead, because the three category rows
push it down, so the total leads the card and the divider sits beneath it.

**What was gained is one place to read the cost. What was paid is 45px of fold
at both widths.** The carried item is not improved by this round and any future
report of it must start from 335px and 70px, not from 290px and 25px.

### Record history is ROUND 18, deferred an EIGHTH time, by this round's arrival rather than by choice

Round 17 deferred it for the seventh time for the same reason: something more
urgent arrived. Its confirmed shape is unchanged, a read-only History pane
sourced from `audit_log` deliberately without readability work, plus notes
carrying the stage they were written at.

**This round added to what it will have to surface**, which is the argument for
it rather than against: `unit_count_corrected` rows now record upward
corrections as well as downward, and open item 36 records that a state-only unit
edit writes a revision containing no change, which a History pane would show as
one.

### PROCESS FINDING: a close-out heading broke rule 7's own count

Written here because it was caught during this close-out and would otherwise
recur. The section above about Phase 5's fold cost was first titled
`### Phase 5 leaves the carried...`, which matches rule 7's mandated pattern
`^## Phase\|^### Phase`. **The check returned 9 headings against a brief with
8 phases**, and the extra one was prose in the close-out rather than a phase.

Rule 7 exists because two rounds recorded a premature completion claim that
only a phase count caught, and it was already corrected once, in Round 10A,
after the narrow `^##` pattern undercounted Round 10's sub-phases. **This is
the same rule failing in the opposite direction**, from a document that
describes phases sitting in the file the pattern searches.

The fix is trivial and the lesson is not: **do not begin any non-phase heading
with the word Phase in a file rule 7 is run against.** The renamed heading
carries the same meaning and the count is 8 again.

### PROCESS FINDING: this round made no per-phase commits, and that is a real loss rather than untidiness

Every phase was signed off against evidence and **none of it was committed
until the round ended.** Prior rounds committed each phase as it was accepted;
the git log shows `Round 17 Phase 1`, `Phase 2`, and so on.

**Why it matters, from this project's own history.** Per-phase commits are what
made Round 15's mid-round checkout recoverable: the work had landing points to
return to. **Round 14 lost work to that same manoeuvre even with commits in
place**, which is the measure of how much worse it goes without them. This
round ran eight phases with no landing point at all, so any interruption
between Phase 0 and now would have cost the entire round.

**It is one commit because per-phase commits were not made, and reconstructing
them by hand now would be fiction**: the working tree holds the end state, not
eight intermediate ones, and inventing them would put signed-off evidence
against diffs that never existed in that form.

Compounding the exposure section above: no branch and no commits are the same
omission twice, and the second is why the first lasted four hours.

### `CURRENT_STATE.md` regenerated and reconciled

Regenerated at `715c0ad` with the working tree dirty, which is correct: this
round was not committed at the time of generation. Staleness test run first and
passed on the prior copy. Every line of the diff accounted for by phase:

- **Routes 54 to 55**, `POST /api/test-beds/calculate`. Phase 6.
- **Migrations 53 to 55**, the two atomic-revision migrations. Phase 1.
- **`accounts.js:12` to `:13`** for the `BILLING_KEYS` spread, a one-line
  offset from the import added at the top of the file. Phase 1.
- **Live records 93 to 107.** All 14 are the business's own, created 03:30 to
  03:52Z, before this round's first source change. Not residue.
- **Soft-deleted records +615, `harness_*` types 321 to 362.** This round's
  fixtures and 41 test-suite runs, all torn down.
- **Approvals 229 to 247**, all 18 the business's own on their live Test Bed.
  **Two further approvals were mine and were residue**: the harness hard
  deletes approvals and my ad-hoc Phase 4 fixtures did not, so they were
  removed and the removal re-queried before regenerating.
- **Live units 0 to 4, live Closed test beds 5 to 6.** The business's.

**Configuration unchanged**, which is why none of it appears in the diff, and
confirmed by reading the regenerated file rather than by the diff's silence:
`stage_gate_rules` 61 total and 45 on `test_bed` (18 approval_obtained, 4
contact_role_linked, 9 document_status, 14 payload_field_required),
`scoring_criteria` 5, `scoring_anchors` 15 all at version 1.

### Teardown, enumerated by `owner_id`

Zero live `harness_*` rows. Zero live records owned by any probe user. The 26
live records owned by the test user this round's fixtures ran as were all
created between 2026-08-17 and 2026-08-19, so **none is this round's**. Every
fixture created in Phases 0 through 6 was soft deleted and re-queried at the
end of its own phase.

### Findings recorded in `DESIGN_PRINCIPLES.md`

Seventeen entries carry the `Round 17A` marker. The ones that outlive this
round:

- When a list and its count disagree, the list is the evidence.
- Contiguity is blind to the failure mode that actually occurs.
- A probe whose own input is silently altered reports on a case it never ran.
- An injected precondition is not the precondition.
- A calibration that silently fails to inject reports the same output as a test
  that cannot fail.
- A blank screenshot passes every check, promoted into `CLAUDE.md`.
- A round can make a latent defect materially worse without touching it.
- A rule caught its own author within the hour, for the third time in this
  project, which says what promotion can and cannot buy.

### Open, carried forward

Round 17's thirty-four stand. Three added:

35. **The revision race.** RESOLVED this round. The entry is kept rather than
    struck, because its measurements are what a future round would need to
    re-prove the fix, and because the constraint remains as the backstop.
36. **A state-only unit edit writes a no-op revision.** Predates Phase 1 and is
    not a regression. Round 18's subject.
37. **The palette has no attention colour.** `--green` is the only accent and
    is already every card title, so Phase 6's unsaved marker relies on the word
    rather than the colour. It will recur on pending, stale and provisional
    states, and on open item 32's refusal.

Still open and untouched: item 23 at full strength and understated by its own
history, item 32's opaque 500 on a non-owner unit edit, item 33's two link-kind
conventions, item 34's absent unit state transitions.

### Probe defects, and where they landed

Every one was in the harness rather than the product, and **five of the eight
produced confident output about a case that never ran**:

- **A stale wait condition.** `[data-tb-tab="stage-..."]` is static markup, so
  it was true on a blank page before any record loaded.
- **Selection that silently failed, twice**, by two mechanisms, so typed text
  appended and an intended out-of-range latitude became a valid one. The probe
  reported "invalid value accepted, 200", which read as a hole in server
  validation and was not one.
- **Date segments filled in the wrong order**, turning `03/01/2027` into
  `0007-12-30`, and the probe reported that the bound did not follow the draft.
- **A retyped identical value fired no `change` event**, so the previous run's
  data satisfied every assertion while nothing was saved.
- **An injected banner behaved differently from a real one**, which hid a
  second ownership fault behind a green result.
- **A `sed` that matched nothing and exited 0**, so an injection never applied
  and 25 passing tests nearly stood as proof an invariant works.
- **A clipped screenshot of a region the element had scrolled out of.**
- **An unchecked query error** (`audit_log` has no `created_at`), which is
  Verification 8's own lesson inside my own instrument.

### `CLAUDE.md` re-read confirmed at session start

Checked from disk rather than assumed: last commit touching it was Round 15
Phase 5, mtime predated session start, structure matched the injected copy.
**That is no longer true for the next session**, per the section above.
