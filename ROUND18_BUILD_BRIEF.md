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

   **ANSWERED, Phase 0, 2026-08-21. It has been wrong since `1918f03`, Round
   7 Phase 9, the commit that built it.** The wired guard, the closure over
   `recordId` and the `?stage=` parameter all landed together and none has
   been touched since. Round 9 Phase 3 and Round 12 Phase 5 are NOT
   implicated: the endpoint provably agrees with the panel today, `blocking`
   being exactly the unmet subset of `requirements`, both 11 on the record
   tested.

   **It is correct only for the first record opened in a page session**, and
   that is why it survived four rounds of testing: **every test opens one
   record and hovers.** The defect needs a second record in the same page to
   appear at all, which no automated check and no casual look has ever done.
   This brief's own premise, that a later round broke it, was wrong.

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

   **CORRECTED, Phase 0, 2026-08-21: there are FIVE actors, not two.** Three
   real accounts and two probe users: `john+test@` 989 rows,
   `r10-r10@terminus-probe.invalid` 467, `john@terminustechnologies.io` 458,
   `johnf.jnr@gmail.com` 200, `r10-r10p1@` 16.

   **This brief's premise was wrong and it changes what Phase 4 is looking
   at.** An actor column was written off here as having nothing to do; with
   three real accounts in the log it is doing real work, and the question
   becomes how to show it without the two probe users making a real record's
   history look like test traffic.

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

### Amended after Phase 0, 2026-08-21: a decision to state rather than discover

`addTbNote` builds the whole `notes` array in the browser from `tbPayload.notes`,
a value read at page load, and PATCHes the entire array. Two notes added
concurrently to one record are therefore **last-writer-wins, and one is lost
silently.**

That is Round 17A Phase 2's explicitly open same-key case, sitting on the exact
write Phase 5 is about to touch. Phase 1 of that round made the write atomic
and the merge server-side; it did not make two writers to the same KEY safe,
and `notes` is one key.

**Report whether fixing it is in scope before building.** It is a real defect
on this path, it is adjacent rather than incidental, and widening a phase
because the code is already open is how scope creeps. Two further facts for
that decision: `by` is client-supplied (`currentSession?.user?.email`) unlike
`audit_log.actor_id` which the server sets, and no note has ever carried a
stage, so nothing existing depends on the array's shape.

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

---

## Round 18 outcome

Seven phases, 0 through 6, confirmed by `grep -n "^## Phase\|^### Phase"`
returning 7 headings with no `###` sub-phases and **no non-phase heading
beginning with the word Phase**, per Round 17A's finding that a close-out
heading inflated the very count rule 7 depends on.

**It caught this close-out too, on the first run.** A section here was headed
"Phase 4's recommendation" and the count came back 8. That is the second round
running in which the author of the remedy tripped the same wire while writing
the document the remedy is about, which is the third recorded instance of a
rule catching its own author, and it is the argument for checks over prose:
the grep noticed, nobody would have. Phases 0 through 5 each
carry an explicit sign-off in the session transcript; Phase 6 is signed off by
the message that commissioned this close-out, and the report containing it does
not sign off its own phase.

### THIS ROUND EDITED `CLAUDE.md`

Two rules were added, and **the next session must re-read the file from disk**.
The copy delivered at session start is a snapshot, and a session following a
round that edited it receives the old version. This round proved that in its
own first minutes: the injected copy was 417 lines and disk was 429, missing
Round 17A's Verification 4 refinement entirely.

- **Build discipline 9**: create the round branch before Phase 1 begins, and
  commit at every phase boundary.
- **Verification 16**: capture the run to a file, then search the file.

### The chevron was wrong from the day it was built

Not since a later round changed the endpoint, which is what this brief assumed.
The wired guard, the closure over `recordId` and the `?stage=` parameter all
landed together in `1918f03`, Round 7 Phase 9, and none was touched since.

**Two faults, one cause.** `tb-chevron-wrap` is static markup, so
`dataset.wired` survived every navigation and the listener kept the first
record's id in its closure; and the popup cached what it was showing by stage
NAME alone, so hovering the same stage on a second record issued no request at
all and left the previous record's answer on screen. Either alone still gives a
wrong answer, so the fix was record identity rather than two patches.

**The endpoint was never at fault**: `blocking` is exactly the unmet subset of
`requirements`, both 11 on the record tested.

**WHY FOUR ROUNDS OF TESTING MISSED IT, which is the part worth carrying: it is
correct for the first record opened in a page session, and every test opens one
record and hovers.** The defect needs a second record in the same page to
appear at all. No automated check has ever done that, and neither has any
casual look, because a person checking a fix opens the record they just fixed.

### Record history shipped, after eight deferrals

Raw and deliberately provisional. Read-only, from `audit_log`, in the Reference
sub-tab strip, loaded when its tab is opened.

It is provisional **by wording rather than by colour**, because open item 37
records that this palette has one accent and it is already every card title.
The line says: "Raw audit entries, unedited. What each action should say, how
entries should be grouped, and which of them belong here at all are not decided
yet." It names the open decisions rather than merely apologising.

`GET /api/records/:id/history` is the only read of `audit_log` anywhere in
`src/`; every other reference is an insert. Read-only asserted structurally,
zero operable nodes, with the counter shown moving to 1 on an injected button
and back.

### The history pane recommendation, verbatim, from Phase 4

Reproduced here in full because it is the input to the vocabulary work and must
not be paraphrased into something tidier. Measurements first: **83 entries**,
**235ms** to paint, **4983px against a 1000px viewport**, five screens.

1. **Grouping beats paging, and filtering beats both.** 83 rows is a long
   scroll, not a pagination problem, and paging it would hide the one thing the
   pane is for: seeing the shape of what happened. **71 of the 83 entries share
   the previous entry's minute.** This is not a timeline, it is a handful of
   bursts, and the right first move is to collapse a burst into one line that
   can be opened.
2. **Two action types are 64% of the record**, 33 `approval_submitted` and 20
   `document_approved`. Any grouping that does not collapse consecutive runs of
   the same action will not help.
3. **Fix the When column before anything else.** It is 41px wide and **every
   one of 83 rows wraps to three lines**, so every row is 59px instead of about
   30. The pane is twice as tall as its content needs for no reason a reader
   could see, and that is a five-minute fix that halves the scroll.
4. **The actor column is doing nothing on this record and should not be
   removed.** All 83 entries carry one actor. Phase 0 found five actors across
   the log as a whole, three real accounts and two probe users, so the column is
   real; it is this record that is single-actor. What it must not do is show a
   raw uuid, which is what it does today.
5. **Decide what belongs here before deciding what it should say.** The wording
   work is cheap once the set is settled and wasted if it is not.

**Which action types read as noise**, verbatim, as observed rather than as
reasoned:

- `document_location_set` **reads as noise, four entries, two of them
  consecutive duplicates on the same document** with different URLs a minute
  apart. It records that someone pasted a link, then repasted it.
- `approval_submitted` **is not noise but is unreadable in bulk**: 33 entries,
  arriving in threes, differing only by `track`. Three consecutive lines saying
  Technical, Commercial, Legal are one event to a human.
- `document_approved` **at 20 entries has the same problem**, and pairs with the
  `transition` immediately after it. A document approved and the stage it
  unblocked are one story told twice.
- `transition` **is the signal**, 14 entries, and is what a reader is looking
  for. It is currently indistinguishable from everything around it.
- `buyer_contact_linked` **reads as setup rather than history**, 9 entries all
  within one minute at the start.
- `created_from_contact` **is the one entry that anchors the record** and it is
  at the bottom of a five-screen scroll.
- `data_correction` **is genuinely interesting and is invisible**, two entries
  lost among 81 others.

**The shape of the finding: the two entries a person would most want, the
correction and the creation, are the hardest to find, and the two action types
that dominate are the ones that carry least meaning per row.**

### CARRIED ITEM: `CLAUDE.md`'s size, and the ratchet that produced it

`CLAUDE.md` is **473 lines and 25653 bytes**, up from 429 and 23238 at the start
of this round. Its own opening says it is deliberately short and that past
roughly two pages it "stops being read properly and stops working". It is
roughly ten pages.

**Named as a ratchet rather than as a defect:** every round has said promote
this and no round has said remove that. Nothing here was added carelessly and
each addition was justified on its own; the sum is the problem, and no single
round's decision produced it.

**Evidence the stated failure mode is already occurring**, rather than a
prediction: Round 17A found two rules that had been followed literally while
wrong, and this round opened with a stale injected snapshot missing a
refinement written the day before.

**Two candidate directions, neither chosen here:**

1. **The instruction stays in `CLAUDE.md`; the evidence that produced it moves
   to `DESIGN_PRINCIPLES.md`.** Most rules here now carry several paragraphs of
   incident history, which is what makes them persuasive and also what makes
   them long. A one-line rule with a pointer keeps the persuasion available to
   anyone who wants it without spending the reader's attention by default.
2. **Any rule a test can assert stops being prose**, as Round 9's gate rules did
   when they became invariants. Several rules here describe properties a check
   could hold: the phase-count grep, the `CURRENT_STATE.md` staleness test, the
   overflow and three-width layout checks. A rule that a suite enforces does not
   need to be read to be obeyed.

### The suite's intermittent failures are now characterised

Recorded in full in `DESIGN_PRINCIPLES.md`. Both had been carried without
characterisation for several rounds.

**The cross-file race is closed as a candidate and reproduced on demand.**
`config-invariants.test.mjs` asserts properties of the whole configuration while
`gates.test.mjs` legitimately holds fixture rows. Polling showed harness rows
first visible at 1.8 seconds and peaking at 23 at once. Started deliberately six
seconds apart, `config-invariants` fails **INVARIANT 2 and INVARIANT 4**, which
are exactly the two seen failing intermittently, while `gates` finishes clean
and the residue returns to zero. **Running the two files together does not
reproduce it**, because the fast file finishes before the window opens, which is
precisely why it only fires in the five-file suite. Not fixed: the choice is
between scoping the invariants to exclude `harness_%` and running that file
serially, and each has a real cost.

**`PGRST303` is sharpened rather than solved, and Round 17's mechanism is wrong
on every path.** No code in this project mints a token: the session JWT's `iss`
is Supabase Auth, and `SUPABASE_SECRET_KEY` is an opaque `sb_secret_` key that
is not a JWT. The host clock, measured at +0.39s in Phase 0 and +0.27s now,
cannot stamp an `iat` on anything. **Not reproducible by volume**: 650 requests
in four shapes produced zero, including 100 concurrent writes to the exact table
and operation that fails. The leading candidate, explicitly untested, is skew
between Supabase's own gateway and database, which nothing in this repository
can measure.

### `CURRENT_STATE.md` regenerated and reconciled

Regenerated at `751beda` with the working tree dirty, which is correct: the
round is not committed at generation time. Staleness test run first and passed.
Every line accounted for by phase:

- **Routes 55 to 56**, `GET /api/records/:id/history`. Phase 4.
- **No migration change, and none expected**: this round added a route and no
  migrations, which is why that section does not appear in the diff at all.
- **Live records 107 to 119.** All 12 are the business's, created before the
  branch existed. Not residue.
- **Soft deleted +1776, `harness_*` types 362 to 486.** This round's fixtures
  and 124 test-suite runs, every one torn down.
- **contact Qualified +6 soft** (three buyers each in Phases 1 and 5),
  **test_bed Qualification +2 soft** (Phases 1 and 2), **Pre-Site Assessment +1
  soft** (Phase 5's fixture, transitioned then torn down).
- **Approvals 247 to 265.** All 18 are the business's, on live records, zero
  attached to a soft-deleted record.
- **Live Closed test beds 6 to 7 and live Qualification 2 to 1**: the business
  moved one through.

**Configuration unchanged**, confirmed by reading the regenerated file rather
than by the diff's silence: `stage_gate_rules` 61 total and 45 on `test_bed`
(18 approval_obtained, 4 contact_role_linked, 9 document_status, 14
payload_field_required), `scoring_criteria` 5, `scoring_anchors` 15 with all
five criteria at version 1.

### Teardown, enumerated by `owner_id`

Zero live `harness_*` rows. Zero live records owned by any probe user. The 26
owned by the test user were all created between 2026-08-17 and 2026-08-19, so
none is this round's. Live records **119**, matching the Phase 0 baseline
exactly.

**The teardown template was corrected mid-round**, in Phase 2, after it left
nine unit records alive by enumerating only the tagged parent. It now
enumerates children, which is build discipline rule 8 applied to my own
tooling.

### The business did not exercise branch code, and this time by design

    branch created                    2026-08-21T12:44:45Z
    business revisions today          67
    first / last                      03:29:40Z / 09:02:28Z
    after the branch existed          0

**Open item 23 did not fire, for the fifth round running, and this is the first
round where that means something.** Every previous entry recorded an absence
that was about the business's week. This round `main`'s working tree was never
mid-round, because the branch existed from before Phase 1 and every phase
committed to it, so the exposure was closed rather than merely unexercised.

### Open, carried forward

Round 17A's thirty-seven stand. One added:

38. **The chevron popup overlays the detail tab row and swallows clicks on
    it.** Found as a probe fault and confirmed as a real one: the pointer
    travels from the chevron strip to the tabs, rests on a chevron on the way,
    and arrives at a tab the popup now covers. The click does nothing and reads
    as an unresponsive tab.

Item 35 is resolved and kept for its measurements. Items 36 and 37 stand; item
37, the missing attention colour, was met again in Phase 4 and carried by
wording again. Item 23 stands but is now about a closed exposure rather than an
open one. The same-key lost update on notes is recorded inside Phase 5's entry
with the reason the obvious fix does not work.
