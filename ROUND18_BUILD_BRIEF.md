# Round 18 build brief: the chevron, unit tabs, standing rules, record history

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND17A_FIX_BRIEF.md`. Read all six before starting.

**Round 17A edited `CLAUDE.md`.** Verification 4 gained a refinement.
Re-read from disk and say whether the copy you hold is current, rather than
assuming either way.

Two defects from the business's testing, two standing rules that have
earned a permanent home, and **record history, deferred eight times.**

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Branch before Phase 1

**Round 17A ran eight phases in `main`'s working tree with no commits.**
The dev server serves the frontend from disk, so for about four hours
`localhost:3000` was whatever half-finished state the current phase had
reached, including a window where ten write paths were edited and the
server had not restarted.

Nothing happened because of timing, not because of design. Open item 23 has
read as "did not fire" for four rounds while the exposure grew.

**Create the round branch before Phase 1 begins**, and commit at every
phase boundary. Phase 3 writes this into `CLAUDE.md`; this instruction
applies from now rather than from then.

---

## Scope boundaries, confirmed with the business

- **The history pane ships without readability work.** Confirmed with the
  business, and the reasoning is theirs: the expensive part is deciding
  what each action should say to a person, and that judgement is better
  made after seeing real entries in place. This is not build-it-badly-then-
  fix-it. It is build the shape, look at what it contains, then decide the
  vocabulary.
- **No per-field change trail as notes.** The original framing was that
  every field change becomes a note, and it was wrong. Field changes as
  notes bury the human ones, and this system already has the live example:
  `record_revisions` holds every payload version and nobody has ever opened
  one.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at
  61 total, 45 on `test_bed`.
- **No anchor wording changes.** The business review still has not happened
  and carries nine items.
- **The palette gap is optional scope.** Open item 37 records that
  `--green` is the only accent and is already every card title, so a
  warning state relies on wording. It sits naturally beside the history
  work and it is not required.

---

## Standing rules that bear on this round

1. **Verification 13 and 14.** A count of zero from an instrument never
   shown to reach one is not a measurement, and a check that passes when
   both sides are absent is not a check. **Phase 1 is an absence claim
   about an absence claim**: the chevron currently reports nothing
   outstanding when things are outstanding, so a fixed chevron reporting
   something must be shown able to report nothing correctly too.

2. **An injected precondition is not the precondition**, recorded in Round
   17A Phase 4. A real message arrives with everything else its production
   sets up. Phase 4 renders `audit_log` entries and the temptation to
   inject rows rather than produce them is strong.

3. **Verification 4 as refined in Round 17A**: open the screenshot, and
   confirm the element is in the captured region before treating the image
   as evidence. A blank capture passed every programmatic check.

4. **Presence is not legibility.** Phase 4 renders a record's whole
   history, which for a completed Test Bed is seven transitions, eighteen
   approvals, nine documents and a great many field changes. A list that is
   technically correct and unreadable is the expected outcome, not the
   failure mode, and reporting it is the phase's job.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts.

1. **The chevron popup's actual query.** It reports "Nothing outstanding"
   on a stage the Exit Criteria panel says has 8 of 14 outstanding, on the
   same screen, at two different stages, and at 2 of 14 as well. So it is
   consistently wrong rather than stale. Report what it asks for, what it
   receives, and where the two consumers diverge. Round 12 Phase 0 recorded
   it reading `blocking` and `blocking[].message` from
   `GET /records/:id/exit-criteria`.

   **Report specifically whether it passes a `stage` parameter**, and if
   so which stage. The panel shows what is needed to leave the current
   stage; a chevron hover naming a stage could reasonably mean either
   leaving it or reaching it, and for the current stage those are different
   questions with different answers.

2. **When it last worked.** Round 7 Phase 9 built it. Round 9 Phase 3
   changed the endpoint to return `requirements` with `met` flags and
   derived `blocking` from them. Round 12 Phase 5 split the panel's display
   into data-entry and process. Report whether the chevron ever showed
   correct output, and if it stopped, when. A display that has been wrong
   since a change three rounds ago is a different finding from one that
   broke last week.

3. **The unit type sub-tab and the correction control.** The tabs select a
   type and the table follows; the correction dropdown does not. Report how
   each is wired and whether the tab strip exposes its active key to
   anything outside itself. `createTabStrip` was generalised in Round 16
   Phase 1 with three consumers.

4. **`audit_log`'s real contents.** For Phase 4 this is the whole
   question. Report the schema, every distinct `action` value with its
   count, what each carries in its detail column, and what a completed Test
   Bed's full history actually looks like end to end. **Report the row
   count for the largest record**, since that decides whether the pane
   needs paging, grouping or filtering before it needs better words.

   Report whether the actor is ever anyone but the two known accounts.
   Today it is the business and the probe user, and that changes what an
   actor column is for.

5. **Notes today.** Where they are stored, their shape, who writes `by`,
   and whether anything already records the stage a note was written at.
   Round 17A established `appendRecordRevision` is now the single write
   path, so Phase 5 must go through it.

6. **Baseline the suite.** `npm test` and `npm run test:db` on a clean
   checkout of `main`. **Capture to a file, then grep the file.** Round 17A
   destroyed the identity of a 49/50 failure by piping through `grep`, and
   that is now the third time in this project. Check residue before and
   after, enumerating by `owner_id`.

---

## Phase 1: The chevron reports what is actually outstanding

**This is the most consequential of the two defects.** The chevron is what
someone glances at to see whether a stage is clear, and it currently says
every stage is clear.

Phase 0 item 1 establishes whether the two consumers are asking different
questions or the same question and getting different answers. **Fix the
cause rather than the symptom**: if the chevron is asking about reaching a
stage rather than leaving it, the fix is the question, not the rendering.

**One computation path.** `computeBlocking()` is the only gate evaluator
and Round 9 made it so deliberately. Whatever the chevron shows comes from
the same endpoint the panel reads. Do not add a second query shape.

**Test evidence required:** the chevron and the panel agree on the same
record at the same moment, at a stage with outstanding items and at a stage
with none. **Both directions matter**: a chevron that always reports
something outstanding is as wrong as one that never does, and the current
fault is invisible precisely because "nothing outstanding" is a plausible
answer. Confirm against a record driven to a genuinely clear state, and
against one with a known count, asserting the number rather than the
presence of text.

---

## Phase 2: The unit type tab drives the correction control

Air Quality selected, the table correctly showing two Air Quality rows, and
the correction dropdown reading "SafeSight (1 now)".

Small, and the failure mode is not: someone adjusting Air Quality counts,
looking at Air Quality rows, corrects SafeSight without noticing. The
correction carries a mandatory reason and writes an audit row, so a
misdirected one is a recorded wrong decision rather than a slip.

**Test evidence required:** switch tabs and confirm the correction control
follows, for all three types. Confirm the count shown beside the type is
that type's count. Confirm a correction applied after a tab switch lands on
the type shown, verified server-side rather than from the control. Confirm
the tab strip's own behaviour is unchanged, since Round 16 Phase 1 gave it
three consumers and this is the second time one of them has needed to
expose state outward.

---

## Phase 3: Two rules into `CLAUDE.md`

Both have earned a permanent home, and Round 15 established that a rule
restated across briefs stays unread.

### 3.1 Branch at Phase 0, not at the close

Under Build discipline. **The round branch is created before Phase 1
begins, and every phase boundary commits to it.**

Two reasons, both recorded from real cost:

- **`main`'s working tree is never mid-round.** The dev server serves the
  frontend from disk, so an uncommitted round means whatever the business
  opens is whatever the current phase has reached. Round 17A ran eight
  phases that way for four hours.
- **Per-phase commits are the recovery point.** Round 15 restored its edits
  after checking out `main` to compare, and Round 14 lost work to that same
  manoeuvre even with commits in place. Without them there is nothing to
  restore to.

### 3.2 Capture to a file, then grep the file

Under Verification. **Never pipe a run whose result is not yet known
through a filter.** Write the full output to a file and search the file.

The existing entry names a mistake to avoid. This names a step to perform,
which is the distinction recorded in Round 17A Phase 5: knowing a rule
confers no ability to spot its instances, so prefer rules naming a step.

Three instances: Round 12 lost a failure's identity to filtering, Round 13
diagnosed `PGRST303` at seven sightings **because** it kept the output, and
Round 17A lost a 49/50 the same way after the rule existed.

**Test evidence required:** the file reads correctly and both rules are
present. State in the close-out that `CLAUDE.md` was edited.

---

## Phase 4: The history pane, without readability work

**Deferred eight times.** The business has asked for it three times and
every round something found in use displaced it.

### 4.1 What it is

A **read-only** pane showing that record's own `audit_log` entries: what
happened, when, and who did it. Placed in the sub-tab strip built in Round
16 Phase 1, which is its third consumer.

**Deliberately without vocabulary work.** Actions render as whatever
`audit_log` carries, actors as whatever identifies them. That is the point
rather than a shortcut: the expensive judgement is what each action should
say to a person, and it is better made after seeing real entries than
before.

**It must be obviously provisional**, so nobody mistakes it for finished.
Choose the mechanism, state it, and do not build something that looks
complete and is not. Round 17A open item 37 records that the palette has no
attention colour, so this may have to be carried by wording.

### 4.2 What looking at it is for

Phase 0 item 4 reports the row count for the largest record. **This phase's
real output is what the pane shows about itself:**

- Whether it belongs in the sub-tab strip at all, or reads as a footer, or
  as something opened occasionally rather than a peer of Use Cases.
- **How much there actually is.** A completed Test Bed carries seven
  transitions, eighteen approvals, nine documents and a great many field
  changes. That is either a useful record or an unreadable wall, and the
  number decides whether it needs paging, grouping or filtering before it
  needs better words.
- **Which actions are worth showing at all.** Some entries will obviously
  be noise, and that can only be judged beside the ones that matter. **That
  decision is worth more than the wording and it comes first.**
- Whether the actor column is doing anything, given every entry today
  belongs to one of two accounts.

### 4.3 What it must not do

- **Not writable.** An audit trail a person can write to stops being
  evidence. Assert it structurally as Round 12 Phase 3 did for the scores
  card: zero controls, zero handlers, zero focusable nodes, proven by
  injecting a control and watching the count move.
- **Not a second query path.** Whatever reads `audit_log` reads it once.
- **Not shipped beyond your own testing** until the vocabulary lands, which
  costs nothing since nothing is deployed.

**Test evidence required:** the pane renders a completed Test Bed's full
history, and **the screenshot is opened and reported on in prose**. Report
the row count, the read time, and an explicit recommendation on paging,
grouping or filtering. Report which action types read as noise. Confirm
read-only structurally. Confirm no second query path by naming the shared
code.

---

## Phase 5: Notes carry the stage they were written at

Notes are thin because they lack context, not because there are too few of
them. A note written while scoring is already captured as a Reason on the
score. A note written while advancing a stage is not.

**Add the stage to the note's own record**, through `appendRecordRevision`,
which Round 17A made the single write path.

**Do not change what notes are.** No prompt on transition, no filtering by
stage on the stage tabs, no per-field trail. Those are candidates that
depend on notes carrying a stage first, and each is a decision the business
has not made.

**Nothing migrates.** Existing notes have no stage and did not have one
when written, and inventing one from the record's current status would be a
claim about a decision nobody made. Round 14 Phase 1 made the same call
about comments and reasons, and the reasoning holds.

**Test evidence required:** a note written at a given stage carries it,
verified server-side. A note written after a transition carries the new
stage. Existing notes still render, without a stage and without an empty
label implying one is missing. Confirm the note write goes through
`appendRecordRevision` by naming the path.

---

## Phase 6: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.
`scoring_criteria` 5, `scoring_anchors` 15 at version 1 only.

Tear down by enumerating from the database by `owner_id`.

Report whether the business exercised unmerged branch code mid-round,
counting revisions and timestamping against the branch's creation rather
than against a merge, since Phase 3's rule means a branch exists from the
start this time.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **Phase 1's finding on when the chevron last worked.** A display wrong
  since a change three rounds ago is a different finding from one that
  broke last week, and it says something about how many consumers a shared
  endpoint quietly acquired.
- **Phase 4's recommendation**, verbatim and in full. That list is the
  input to the vocabulary work and must not be paraphrased into something
  tidier.
- **That record history was deferred eight times** and what displaced it
  each time. Every deferral was reasonable and the pattern is worth seeing
  whole.
- **Phase 5's no-migration decision**, with the Round 14 Phase 1 precedent
  named.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off. **No non-phase heading in this file
may begin with the word Phase**, per Round 17A's finding that a close-out
heading inflated the count the rule depends on.

A report cannot sign off the phase containing it, and a phase that ships no
diff is still a phase.
