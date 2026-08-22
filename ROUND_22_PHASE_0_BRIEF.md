# Opportunity stage tab: panel order and advance behaviour

**Round number to be confirmed against the repo.** Round 21 merged to `main`
at `8aab336`.

**This is a short round.** Two items, both reported by the business after
using Round 21's output. It is deliberately not the Reference tab rebuild,
which is the larger piece of work and follows this.

---

## Phase 0 is investigation and a plan

No file edits, no migrations, no code, no configuration changes.

---

## The two items, as reported

**1. The stage panels are in the wrong order.** They should read
**Assessments, Terminus Documents, Exit Criteria, Approvals**, left to
right, matching Test Bed.

**2. Advancing a stage shows no panels.** The advance control moves the
record, the green dot moves with it, and the panel area is empty until the
stage tab is clicked manually.

**Confirmed with the business: the tab should follow the record to the new
stage.** You advance because you are now working the next stage.

---

## Why item 2 is not a one-line fix

Three things make it worth care.

**`oppUserPickedTab` is directly implicated.** Round 21 Phase 1 introduced it
so that a user's tab click survives an in-flight page load, which was the
second of the two causes behind the reported blocker. **Advancing is the case
where the system should move the tab and the user has not asked it to.** If
the guard treats an advance the way it treats a page load, the tab will not
follow. If it is cleared too eagerly, the Phase 1 race returns. That race is
Round 5 Phase 7's Test Bed bug, which went unported for sixteen rounds, so
reintroducing it would be expensive.

**Test Bed almost certainly solves this already.** It has had an advance
control and per-stage tabs for ten rounds. **Read what it does from source
and follow it**, as Round 21 Phase 3 did for the non-current-tab rule, rather
than inventing behaviour. If Test Bed does *not* solve it, that is a finding
about Test Bed and should be reported rather than fixed here.

**The terminal case differs.** Advancing into Closed Won should land on the
Closed Won tab, which renders one card rather than four. Different landing
behaviour, and the one least likely to be covered by a test.

---

## The finding underneath, which matters more than either item

**Round 21 Phase 9 walked a record to Closed Won and to Closed Lost and did
not catch item 2.** The walk advanced and then clicked the next stage's tab,
because a harness clicks by DOM query and does not notice that a human would
be looking at an empty screen.

That is the same shape as the original blocker, where the harness completed
three ticks only because it clicks hidden rows regardless of visibility.

**A test that navigates deliberately cannot see a navigation defect.**

This belongs in the round as a recorded finding, not only as a fix. It also
shapes the verification below: **after every advance, assert what is on
screen without touching the tab strip.**

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **From disk.** It changed twice in Round 20 |
| `INTERACTION_STANDARDS.md` | Load-bearing. Focus and navigation behaviour |
| `OPPORTUNITY_DESIGN.md` | Seven open decisions |
| Round 21 close-out | Especially Phases 1, 3 and 5, and the six-instance finding |
| `CURRENT_STATE.md` | Generated. Run its staleness test |

---

## Investigations

### I1. Test Bed's behaviour after advancing

**The question.** When a Test Bed advances a stage, what happens to the
active sub-tab?

Report from source: which function handles the advance, whether it switches
the tab, whether it clears `tbUserPickedTab`, and in what order relative to
the re-render.

**Then confirm it live.** Advance a Test Bed and report what is on screen
without clicking anything.

**If Test Bed does not follow the record, say so.** That is a finding about
Test Bed, and Opportunity should still follow per the business decision, but
the two would then diverge and that needs recording rather than hiding.

### I2. What happens on Opportunity today, measured

**Reproduce it.** Advance an Opportunity through the browser and report the
active tab, the visible panels and what a user would see, **without clicking
the tab strip**.

Repeat for **three consecutive advances in one session without reloading**,
since that is the reported experience and a single advance may behave
differently from the second.

### I3. The `oppUserPickedTab` interaction

**The question.** What exactly does the guard do, when is it set, when is it
cleared, and what would each candidate change do to the Phase 1 race?

**State the race explicitly**: an early tab click during an in-flight load,
which Phase 1 fixed and which must still pass afterwards.

Report the options for distinguishing a system-initiated tab change from a
page-load default. **Do not choose one.** This comes back for review.

### I4. Panel order: decision or construction order

**The question.** Is Opportunity's current panel order a deliberate choice or
an artefact of the build sequence?

Round 21 added panels in Phases 3, 4 and 5, and the row may simply reflect
that. Report Test Bed's order from source, Opportunity's order, and whether
anything other than markup position determines it.

### I5. The terminal landing case

**The question.** What happens when a record advances into Closed Won?

Closed Won hides the four-panel row and renders a single completed-record
panel, keyed on `is_terminal`. Report what the tab should do and whether the
same mechanism carries.

---

## The plan to produce

Small phases, each verifying, each committing. Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | Panel order |
| 2 | Advance follows the record, per the I3 decision |
| 3 | Terminal landing case |
| 4 | Verification: repeated advances, no tab clicking |

**If I1 shows Test Bed already solves this cleanly, Phases 2 and 3 may
merge.** If Test Bed does not solve it, Phase 2 grows and the divergence
needs recording.

---

## Verification requirements

**After every advance, assert what is on screen without touching the tab
strip.** This is the round's central lesson and it is not optional. A
verification that clicks the destination tab cannot see this defect.

**Three consecutive advances in one session without reloading.**

**The Phase 1 race must still pass.** An early tab click during an in-flight
load must survive. Verify it explicitly rather than assuming the change did
not touch it.

**Look at the result.** Presence is not legibility, and no assertion in Round
21 caught an empty panel area after an advance.

**Calibrate every absence-shaped check**, and confirm any probe distinguishing
two states returns different values in each.

---

## Explicit non-goals

- The Reference tab rebuild, the four Reference-tab defects, and the
  `refFieldRow` fork. Next round.
- Deal and Risk assessments. The Assessments panel stays a placeholder.
- Rule 7, `test-bed-name-suggestion`, `approver_id`, the `CURRENT_STATE.md`
  table blind spot, Test Bed's static tab strip. All recorded, none this
  round.
- Rejection reason codes, `routing_rules`, the four dates, the revision
  event.
- The Exit Criteria and Approvals duplication.

---

## Output format

1. **I1 through I5**, each with the command run or the interaction
   performed, the actual output, and the finding.
2. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.
3. **The I3 options**, presented for a decision and not chosen.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated.** These items were settled from
   a business report without repository access.

Then stop and wait for sign-off.

---

## Round 22 outcome

Five phases, 0 through 4. Both reported items are fixed. The round found
three defects nobody reported and one gap in its own bookkeeping.

### Rule 7 returned a wrong number rather than no number

`grep -c "^## Phase\|^### Phase"` returns **1** against this brief. The real
count is **5**, carried in a table; the single heading it matched is line 12,
`## Phase 0 is investigation and a plan`, which is a section about the phase
rather than the phase list. Calibrated: the same pattern returns 5 against
`ROUND18A_FIX_BRIEF.md`.

**This is the fourth consecutive round the rule has failed, and the first
where it failed by returning a plausible number.** Rounds 19, 20 and 21 each
returned 0, which is obviously broken. A 1 is not obviously anything, and a
round that trusted it would have declared itself complete after Phase 0.

Counted from the table: phases 0, 1, 2, 3, 4. Phases 0 to 3 carry explicit
sign-off in the session transcript. This report is Phase 4 and does not sign
off its own phase.

### The record of someone working around the product

The audit trail for the Opportunity the business created at 10:45 on
2026-08-22 shows four transitions between 14:11:30 and 14:13:44: Solution
Alignment to Proposal to Evaluation to Negotiating to Closed Won, in two and
a half minutes. **Each one landed them on an empty screen and each was
followed by a manual tab click.** That is the reported defect, timestamped,
in the business's own data.

### Panel order: why Assessments is first, and why that is not an oversight

The four cards read **Assessments, Terminus Documents, Exit Criteria,
Approvals**, matching Test Bed position for position with Assessments in the
slot Test Bed gives Qualification scoring.

**The previous order was never a decision.** Round 21 built these panels
across three phases and each appended its card at the end, so the row recorded
the build sequence. Nothing else ordered them: there is no `order:`
declaration in the stylesheet, and no hand-written document recorded an
intended order.

**The business chose this order knowing what it costs today.** Measured true
before and after, with the file swapped and restored:

    1240x800   Exit Criteria  before top=425 bottom=623 (fully visible)
                              after  top=626 bottom=824 (clipped by 24px)
    1440x900   Exit Criteria  before 411/609 visible    after 612/810 visible
    advance control  852 at 1240x800, 838 at 1440x900, IDENTICAL before and after

The reorder costs no total height. The two grid rows swap and their heights
are unchanged, so nothing below the grid moved. What moved is Exit Criteria,
down 201px, and at 1240x800 that clips it by 24px.

**The reason it looks awkward is this round's own non-goal.** Assessments is a
placeholder, so the top row is two empty "No ... configured for this stage"
boxes above the only working content on the tab. On Test Bed the equivalent
slot holds real scoring controls and the same order reads correctly.

**The decision was to keep it**: seeing the shape of the finished screen is
worth the temporary awkwardness, and it resolves when Deal and Risk
assessments are built. Recorded as reasoning rather than as an outcome
specifically so that nobody later reads two empty boxes as a mistake and
reverses the order.

### "Left to right" means three different things

The instruction was well defined at 1240 and means something else at the other
two widths. The grid is **2-up at 1240, 3-up at 1920, 4-up at 3440**.

At 1240 the reading order is Assessments and Terminus Documents, then Exit
Criteria and Approvals. **At 1920 the top row is Assessments, Terminus
Documents, Exit Criteria, with Approvals alone underneath**, which separates
the two cards that belong together. At 3440 all four sit in one row.

Neither the business nor the brief knew this when the instruction was given,
and the requested DOM order is honoured at every width. Only the wrapping
differs, and wrapping is content-driven: Test Bed's own stage panel wraps
differently between its own stages. "Matches Test Bed" is a claim about DOM
order, which holds.

### The one second window

Measured in-page, from the click, across four advances:

    tab active and panel populated   1266ms, 1570ms, 1565ms
    new advance control              2302ms, 2562ms, 2559ms

There is a consistent **one second window where the new stage's panel is on
screen and its advance control has not rendered**, because `loadOppStageTab`
fetches criteria and approvals before rendering the transition section.

**The lag is not new; what changed is who is looking at it.** It always
existed behind a manual tab click, where the user had just acted and expected
a wait. Now the screen arrives on its own and sits visibly incomplete, which
reads as broken rather than as loading. Candidate for the Reference tab round.

### The built-for-the-screen-that-existed finding, now eight

**The seventh was closed rather than widened.** `attemptTransition` branched
on `sectionId === 'tb-transition-section'`, setting a landing intent for Test
Bed and dropping Opportunity into an `else` that did less, live in production
and not latent. Adding a second branch would have widened the fork. It is now
a lookup keyed on record kind, because after this round both types do the same
two things. `sectionId` is gone: it read as an element id, was compared once,
never looked up, and no element of that id exists anywhere. **An unrecognised
kind now logs and returns rather than guessing**, where the old `else` would
have silently reloaded the wrong detail view for a third record type.

**The eighth is `returnFocusTo`.** The close-lost dialogue named
`'opp-stage-transition'`, an id that has never existed: the generated ids all
carry the stage key. `getElementById` returned null and the optional-chained
`.focus()` swallowed it, so cancelling the dialogue dropped focus silently.
Same family as Round 21 Phase 7's element ids built from a stage name: an id
that resolves in the mind and not in the document. It now names the button
that opened it, not the container, because the container is a `div` with no
tabindex and focusing one is a no-op, so fixing the id alone would have
replaced a silent failure with a quieter one.

### Nothing reads the loss reason

The reason, the note and the date are written correctly and **displayed
nowhere**. Searched the whole detail view case-insensitively with two
known-present strings as calibration: `Closed Lost` present, the record's
actual reason label absent, the note absent, no "lost at" anywhere.

The stated reason for landing a lost deal on Reference is that Reference is
where you look to see what happened. Reference shows **that** it happened and
not **why**.

**Round 21 built the list as configuration and added the write; neither round
asked what reads it.** Open item, and it pairs with the Reference tab round
since that is the surface it belongs on.

### Probe hygiene: a failure that produced a falsy value

**An expired session surfaced as an empty fixture id rather than as an error,
twice.** The setup script's id was captured into a shell variable, the API
returned 401, the script threw into a discarded stream, and the variable held
the empty string. The browser probe then ran against a record id of `""` and
reported cleanly on a page that had loaded nothing.

**A failure producing a falsy value instead of throwing is how a probe runs
against nothing and reports a result.** Same family as Verification 12 and 13:
the instrument returns something indistinguishable from a real answer. The
setup now says what is wrong when the contacts lookup does not return an
array, rather than failing on `contacts.find is not a function`.

Two more probe faults, both caught:

- **A threshold that the empty state already exceeds.** A wait on the
  Reference panel having "more than 200 characters" passed on an unloaded
  record, whose labels alone come to 206. Every content check then read false,
  including strings known to be present. **Two known-present strings before
  trusting an absence should be the habit.**
- **A hover left by the probe itself.** Puppeteer's `page.click` leaves the
  pointer on the element, and `.detail-tab:hover` paints it at full
  brightness. A stale selected state was nearly reported as a defect. With the
  mouse moved off the strip, no tab is bright at all: **nothing is selected,
  rather than the wrong thing being selected.**

### Verification

The full walk, at 1240, one session, no reload:

- **Qualification to Closed Won, five advances, one strip click in total**,
  the one needed to reach the advance control. Every advance landed on the
  record's own stage with a populated panel and focus on the tab.
- **A second record advanced twice and then lost**, one strip click in total,
  landing on Reference with a populated panel, no tab carrying the dot, the
  strip still eight, and the reason, origin stage, note and timestamp stored.
- **All eight tabs looked at**, each with a non-zero size and non-empty
  content confirmed before the image was treated as evidence. Five working
  stages show four cards in the new order; Closed Won shows one.

Calibration throughout was the same probe run against both code states with
the file swapped and restored. Pre-fix, **advances 2 and 3 are impossible
without clicking the strip**, which is the reported experience stated as a
measurement.

The Round 21 Phase 1 race still passes, both directions: an early click on
Commercials during an in-flight load leaves `commercial` active, and the same
trial without the click leaves `reference`. **The guard is never written in
this round**, shown as a diff rather than asserted: its three write sites are
byte-identical before and after, and the only changed line mentioning it moved
a read into an `else`.

Suites: 25/25 and 59/59.

### Open decisions in `OPPORTUNITY_DESIGN.md`

**Seven bolded rows, none claiming Confirmed**, asserted individually:

1. Revision event: series plus approval plus re-score as one thing
2. Deal Sheet freeze point after the stage compression
3. Staff fields have no server-side validation
4. `Account` is a third staff-field surface
5. Base Cost Data catalog
6. One stage vocabulary under four column names, joined by nothing
7. `approvals.comment` unused on all 229 rows, `tier` null on all 229

Unchanged from Round 21's close. Nothing opened and nothing closed.

**A finding about the count itself.** The table holds 21 rows, and the
headline seven counts only the bolded ones. **Three further rows are marked
Undecided and are not bolded**: Deal assessment criteria, Risk assessment
criteria, and **Is a loss reversible**. That third one governs the wording
this round shipped: the lose dialogue says the action cannot be undone
precisely because the question is open, so an undecided item the headline
count omits is currently deciding what the product says to a user.

### `CURRENT_STATE.md` not regenerated, and why

**This round changed one file, `frontend/app.js`.** Zero migrations, zero
seeds, zero routes, calibrated against Round 21's range which returns 5 for
the same query. The generated file records configuration and source-parsed
structure, and none of its inputs moved.

It also passes its own staleness test: the recorded SHA `61ee2fd` is an
ancestor of `HEAD`, and zero tracked configuration sources have changed since
it. Stated here rather than left as an omission to be queried.

### State

Fixtures enumerated from the database by tag across the round: 18 parents and
2 children, all soft deleted, re-queried, **zero remain**, with 35 tagged
revisions seen so the scan was not blind. Live records 94, one owner, zero
live `harness_*` rows, calibrated against harness rows existing in the table.
No `reference_number_counters` row touched.
