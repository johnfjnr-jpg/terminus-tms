# Round 14 build brief: one Reason field, popup truncation, creation navigation

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND13_BUILD_BRIEF.md`. Read all six before starting.

**`CLAUDE.md` was edited in Round 13.** Build discipline 8 and Verification
12 were added. The session-start snapshot predates them, so re-read from
disk before doing anything, per the standing rule.

Every item came from the business using the merged Round 13 build. The
first is a simplification they proposed and it is better than what was
built.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Amendments after Phase 0

| # | Phase | Change |
|---|---|---|
| 1 | 1.2 | **The "nothing migrates" reasoning is replaced by a stronger one, measured rather than argued.** The existing rows already mean what the new field means |
| 2 | 1.3 | **The revision case already has a server check.** The instruction to add one is removed |
| 3 | 1 | **Four entry shapes exist, including 5 real entries carrying both texts.** Stated as measured |
| 4 | 3 | **Three popup containers, not two**, and a fourth surface sharing the row class with no cap |
| 5 | 4 | **Round 3 Phase 2's precedent holds**, verified by driving it rather than reading it |

---

## Scope boundaries, confirmed with the business

- **No anchor wording changes.** The business review has still not happened.
  It now carries nine items: eight ambiguities from Round 11 Phase 8, the
  measurement that a 5 anchor averages 3.4 independent conditions with no
  wording at 2 or 4, and Data Rights' drift between a question about intent
  and anchors about mechanism.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at
  61 total, 45 on `test_bed`.
- **The rules governing when a reason is required do not change.** Only the
  field and its enforcement point change. A first score of 3, 4 or 5 needs
  nothing.
- **Record history is deferred again**, for the fifth time. State that
  plainly in the close-out as a choice rather than a drift.

---

## Standing rules that bear on this round

1. **Verification rule 7, the counterfactual.** Rounds 12 and 13 produced
   seven probe defects each and zero product defects in the code under
   test. Two in Round 13 nearly became reported findings: a panel measured
   mid-load that looked like it did not grow, and a delete that reported
   success because a query silently hit PostgREST's 1000-row cap.

2. **Build discipline 8, promoted in Round 13.** Fix the class, not the
   instance the failure named. Its third instance surfaced in Phase 7 of
   the round that promoted it.

3. **Verification 12, promoted in Round 13.** A tool returning empty rather
   than erroring produces output indistinguishable from a true negative.
   `grep` on `scripts/state-dump.mjs` needs `-a`, because of two literal
   NUL bytes. **PostgREST's 1000-row default is the same shape** and caught
   a delete in Round 13 Phase 7.

4. **The re-render constraint.** The scoring panel and the exit criteria
   panel are both rewritten by `innerHTML`. Phase 1 of Round 13 and Phase 2
   of Round 13 both had to apply state by direct DOM mutation rather than
   re-render, because re-rendering eats the field the caret is in. Phase 1
   here touches the same field.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts.

1. **The two fields today.** Report the exact storage shape of a score
   entry, where `comment` and `reason` are written, where each is validated,
   and where each renders. Round 11 Phase 2 specified
   `{ at, by, value, comment, reason, anchorVersion, stage }`.

2. **Every entry in the live data, by which fields it carries.** Count
   entries with a comment only, a reason only, both, and neither. This
   decides what Phase 1's display has to handle, and the answer is data
   rather than inference.

3. **The shared reason dialogue.** `requestChangeReason` was built in Round
   11 Phase 3 with two callers, scores and Opportunity's Est. Close Date.
   Report both call sites exactly, and confirm that removing the score
   caller leaves the Opportunity one working unchanged. **Do not change
   Opportunity's behaviour or its note storage.**

4. **The linked-records hover popup.** Report where the truncation comes
   from. Round 6 Phase 1 added `white-space: nowrap`, `overflow: hidden`,
   `text-overflow: ellipsis` plus a bounded `max-width` on both popup
   containers, to fix names wrapping to three lines. Report the current
   bound, both containers, and every place the popup is used, since the
   business hit it on the Contacts list and Round 6 recorded a second
   caller in the Test Bed matrix.

5. **Test Bed creation's completion path.** Report what happens after a
   Test Bed is created from a Contact: the "Created. VIEW IT" affordance,
   where it is rendered, and what it does. Round 3 Phase 2 made the
   equivalent Opportunity path navigate directly to the new record; report
   whether that path still behaves that way and why the two differ.

6. **Baseline the suite.** `npm test` and `npm run test:db` on a clean
   checkout of `main`. **Keep the full output.** Check residue before
   running and again after. `PGRST303` has been observed five times, most
   recently taking out an entire file at once in Round 13 Phase 7.

---

## Phase 1: One Reason field

**Confirmed with the business.** Two fields become one, called **Reason**.
The rules governing when it is required do not change.

### 1.1 The rule

A Reason is required when either condition holds:

- the score is **1 or 2**, on any entry
- the entry is a **revision**, meaning any entry after the first for that
  criterion

A first score of 3, 4 or 5 requires nothing. A revision down to 2 satisfies
both conditions with **one** Reason, not two.

### 1.2 Storage

**Write the single field to `reason`. Leave `comment` in place, unwritten.**

The field is called Reason and storing it in a column called `comment` is
the kind of drift that costs someone an hour a year from now.

**AMENDED after Phase 0. Nothing migrates, and the reason is stronger than
the one written here first.**

**The existing rows already mean what the new field means.** Measured across
every real business entry, 26 of them on 3 records:

- **15 first entries, 0 of which carry a reason.**
- **11 revisions, 0 of which lack one.**
- **Every comment-only entry is a first score at 1 or 2**, which is precisely
  the case the new rule calls a Reason.

So the data has been obeying the new rule all along under the old field
names. A migration would not be correcting anything; it would be renaming
values that are already right. **This is a measurement, not a judgement, and
it is the primary reason nothing migrates.**

**Secondary, and still true:** an early entry with a comment and no reason is
the truth about when the rule changed, and rewriting it would be a claim
about a decision nobody made. That argument was written first and is kept,
demoted, because it defends the same conclusion on weaker ground: it would
hold even if the data disagreed with the new rule, and the point is that it
does not.

### 1.3 Enforcement at entry, not at save

Round 13 Phase 1 moved the comment requirement to the point of entry and
left the reason firing at save, so the panel currently teaches two rhythms
for two fields that both explain a score. Both now behave the same way.

Reuse Round 13 Phase 1's mechanism rather than building a second one: focus
the field, block further scoring until it is filled, refuse Save locally
with the reason and focus the field.

**The server rules stay exactly as they are, and BOTH already exist.**
Client-side validation is an affordance and the server is the guarantee.

**AMENDED after Phase 0: the revision case already has its own server check**,
at `src/routes/test-beds.js:1505`, refusing any entry after the first that
carries no `reason`. The 1-or-2 check sits immediately above it at 1498. The
instruction to add one is removed: there is nothing to add, and the work is to
leave both untouched while the client stops being the only thing that asks.

### 1.4 What the display must handle, measured

**AMENDED after Phase 0: all four shapes exist in real business data**, so
this is a measurement rather than an anticipation. Across 26 entries on 3
records:

| Shape | Real entries | |
|---|---|---|
| comment only | 4 | first scores at 1 or 2 |
| reason only | 6 | revisions |
| **both** | **5** | **two texts on one entry** |
| neither | 11 | first scores at 3, 4 or 5 |

**The five carrying both are the case worth naming**, because a display that
assumes one text per entry will silently drop one of them, and there is no
version of "render the Reason" that covers an entry holding two distinct
sentences written months apart. Whatever the panel does with them, it must be
a decision rather than a default.

**Test evidence required:** every combination proven at entry and
server-side, called directly with the browser bypassed:

| Case | Reason |
|---|---|
| First score of 4 | not required |
| First score of 2 | required |
| Revision 4 to 5 | required |
| Revision 4 to 2 | required, one field satisfies both |

Confirm the field is labelled Reason everywhere it appears. Confirm the
caret survives typing, per the re-render constraint. Confirm several
criteria scored and saved once still all record, per Round 11A.

---

## Phase 2: The score path stops using the shared dialogue

With Phase 1 enforcing at entry, the modal has nothing left to do on the
score path.

**Remove the score caller only.** Opportunity's Est. Close Date keeps the
dialogue and its note storage exactly as they are. The helper returns to
one caller, which is where it started, and that is not a regression.

**Assert the removal by count**, per the relocation form: the dialogue does
not open on any score path at all, rather than does not open on the path
tested. Round 10 shipped a duplicate Summary and a stale wrapper on exactly
this shape and both reached the business.

**Test evidence required:** revise a score and confirm no dialogue appears
at any point, entry or save. Confirm the reason is stored on the entry.
Then confirm Est. Close Date's dialogue still fires, still holds unrelated
dirty fields, and still leaves them intact on cancel, which is the property
Round 3 proved empirically and this phase must not break.

---

## Phase 3: The hover popup shows full names

Round 6 Phase 1 added the truncation deliberately, to stop long names
wrapping to three lines. It fixed a real problem and created this one.

**The cost, from the business's screenshot:** two Test Beds both render as
"Singapore Instutue of Technolo…" and are indistinguishable, because the
part being cut is the `(2)` and `(3)` suffix that is the only thing telling
them apart. The popup lists two records and identifies neither.

Keep single-line. **Remove the width bound so the popup sizes to its
content**, with a ceiling far above the current one so a single absurd name
cannot produce a popup wider than the viewport.

**Apply it to every caller**, not the one reported. Build discipline 8.

**AMENDED after Phase 0: there are THREE containers, not the two Round 6
recorded.**

| Container | Cap | |
|---|---|---|
| `.contact-count-popup` | 280px | the one the business hit |
| `.tb-matrix-popup` | 280px | Round 6's second caller |
| `.chevron-popup` | **320px** | **added Round 7 Phase 9, after Round 6's record was written** |

**A fourth surface shares the row class and has no cap:** the linked-records
modal at `app.js:1543` renders `.linked-record-row` inside
`#linked-records-modal`, which sets no width bound.

**That fourth surface is what identifies the lever.** The truncation
properties live on the shared row class and the BOUND lives on the
containers. Changing the row class would reach the modal, which is not
truncating and has no reported problem; changing the container caps reaches
exactly the three popups and nothing else. **Change the container cap, not the
row class.**

**Test evidence required:** the business's real case, two Test Beds under
one Account distinguished only by suffix, both fully legible and on one
line each. Confirm no wrapping returns, which is the fix this is modifying.
Confirm behaviour at 1240, 1920 and 3440, and confirm the ceiling holds
with a deliberately long name. Container measured, not element. Open the
screenshots.

---

## Phase 4: Creating a Test Bed navigates to it

Today creation shows "Created. VIEW IT" and leaves the user where they
were. Round 3 Phase 2 made the equivalent Opportunity path navigate
directly to the new record on exactly this reasoning: the user has just
named it and the next thing they do is fill it in.

Navigate automatically to the new Test Bed's detail screen.

**AMENDED after Phase 0: the precedent holds, and the check was worth
running.** Driven on a clean Contact rather than read from the source: creating
an Opportunity lands on `view-opportunity-detail` with no warning and no
dialogue, exactly as Round 3 Phase 2 recorded. Creating a Test Bed opens the
naming dialogue, then stays on the Contacts list with a "Created. View it"
feedback row.

**The divergence is deliberate and documented in the shared function itself**,
which carries the line "Test Bed is untouched, the brief scoped this to
Opportunity only". So the two paths differ by an explicit scope boundary from
Round 3, not by drift.

**Recorded as a check that came back confirming rather than refuting**, which
is worth as much as one that overturns something and is easier to skip. Round
6 Phase 2 found a brief citing a precedent removed three rounds earlier; that
hazard is real, it is why this was verified, and this time the answer was that
the precedent is intact.

**Test evidence required:** create a Test Bed from a Contact and confirm
the browser lands on that record's detail screen, verified by the record's
own reference code rather than by the URL alone. Confirm it works from both
creation entry points, which Round 13 Phase 0 established are the Contacts
list hover Create and the Contact detail button. Confirm the record is
genuinely created and correct, so navigation cannot pass by arriving at
something broken.

---

## Phase 5: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

**`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.**
`scoring_criteria` 5, `scoring_anchors` 15 at version 1 only.

Tear down before regenerating, selecting by what the round created rather
than by relationship. **Watch for PostgREST's 1000-row cap** on any
harness-wide query, which silently truncated a delete in Round 13.

Expect live changes no phase accounts for. The business uses the system
between rounds, and Round 13 found four such records. Attribute them and
state plainly that they are explained by an actor outside the round.

**A NAMED ITEM FOR THE BUSINESS, not a close-out line: the scoring panel's
height.** Three independent observations now point at it, from three different
rounds and three different causes:

1. Round 13 Phase 1's lock note scrolls above the viewport when working on a
   lower criterion, so the explanation for the disabled controls is off screen.
2. The scrolling scoring panel the business raised, parked at the head of Round
   13 on the recommendation that the sticky tab row superseded it. **It did
   not:** the sticky row answers where you are in the record, not that the
   panel is taller than the decisions it holds.
3. Round 14 Phase 1 measured the cost of always showing the Reason: **665px to
   875px with five criteria scored, up 210px or 32 percent**, which at 1240x800
   takes the panel from 0.83 viewports to 1.09. It no longer fits one screen at
   the width where height is scarcest.

**The options, for the business rather than for a build decision:** collapse a
criterion once it is scored, collapse the Reason specifically, or revisit the
scrolling panel. **The case for the third is stronger now than when they raised
it**, and the recommendation to park it was mine.

**Note open item 23:** the dev server serves the frontend from disk, so
the business may be exercising unmerged branch code mid-round. Report
whether that happened again.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **Why two fields became one**, in the business's terms: the reason for a
  score and the explanation of a score are the same statement, and the
  append-only history already shows the previous entry, so a second field
  asks the user to write a delta the record displays.
- **That the rules did not change**, only the field and its enforcement
  point. A future reader should not infer that requirements were relaxed.
- **That nothing migrated**, and why: an early entry with a comment and no
  reason is the truth about when the rule changed.
- **Phase 3 as a deliberate partial reversal** of Round 6 Phase 1, with the
  original reasoning left visible, since that fix solved a real problem and
  this one modifies rather than refutes it.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off. A report cannot sign off the phase
containing it.

**State in the close-out whether this round edited `CLAUDE.md`.** Round 13
established that the next session receives a stale snapshot and only
re-reads from disk if prompted.

---

## Round 14 outcome

All 6 phases delivered. Checked with `grep -n "^## Phase\|^### Phase"` per rule
7, **with the pattern including `###`**, which returns 6 headings and no
sub-phases. Phase 0 is the investigate phase and built nothing, which is stated
rather than inferred from an absent diff.

**Phases 0 through 4 carry an explicit sign-off. Phase 5 is the phase this
close-out is part of and is reported, not signed off**, because it cannot sign
off the report that contains it. Phase 1 was signed off twice, once for the
build and once for the display decision that completed it.

### THIS ROUND EDITED `CLAUDE.md` TWICE

**The next session receives a snapshot taken at its own start, which will
predate both.** It must re-read from disk, and that only happens if this
close-out says so, which is why this is the first item rather than a footnote.

- **Verification 13: a count of zero from an instrument never shown to reach
  one is not a measurement.**
- **Verification 14: a check that passes when both sides are absent is not a
  check**, and it is more dangerous than 13 because it reports success rather
  than nothing.

Both came out of this round's own probes rather than out of the product.

| Phase | Delivered | Beyond the brief |
|---|---|---|
| 0. Investigate | Six items, five amendments | **Item 2 inverted the brief's own reasoning**: the data had been obeying the new rule all along under the old field names |
| 1. One Reason field | Two fields become one, enforced at entry | **The server's 1-or-2 check had to move**, found by asking the running server before writing code. My own amendment saying otherwise was wrong |
| 1. completion | The current entry's Reason always renders | **A single-entry criterion showed its explanation nowhere**, which the new rule turned from survivable into a contradiction |
| 2. Dialogue removed | Score caller gone, Opportunity untouched | **The zero was calibrated**: the same counter reads 1 on Opportunity |
| 3. Popup truncation | Three containers size to content | **The third container was never in Round 6's record**, and only a class sweep reaches it |
| 4. Creation navigates | Both entry points and the warning path | **A vacuous assertion reported MATCH for two paths that created nothing** |
| 5. Regenerate | Reconciled, every hunk attributed | Live changes belong to an actor outside the round, again |

### The scoring panel's height, as a named item for the business

**Three independent observations, from three rounds and three causes, now point
at one surface.** This is stated here as a decision for the business rather
than as a close-out line, because it is the third time and the answer is theirs.

1. **Round 13 Phase 1's lock note scrolls above the viewport** when working on
   a lower criterion, measured at minus 509px at 1240, so the explanation for
   the disabled controls is off screen while the controls are disabled.
2. **The scrolling scoring panel the business asked for**, parked at the head
   of Round 13 on the recommendation that the sticky tab row superseded it. **It
   did not.** The sticky row answers where you are in the record; this is that
   the panel is taller than the decisions it holds. **Parking it was my
   recommendation and it was wrong.**
3. **Round 14 Phase 1 measured the cost of always showing the Reason**: 665px
   to **875px** with five criteria scored, up 210px or 32 per cent, which at
   1240x800 moves the panel from 0.83 viewports to **1.09**. It no longer fits
   one screen at the width where height is scarcest.

**The three options, none of them a build decision:** collapse a criterion once
it is scored, collapse the Reason specifically, or revisit the scrolling panel.
**The case for the third is stronger now than when they raised it.**

### Record history is deferred for the fifth time, as a choice

**Stated plainly as a choice rather than allowed to read as a drift.** The
per-field change trail and criterion authorship from `audit_log` has been
requested and deferred in five consecutive rounds. Nothing in this round
brought it closer, and no phase was cut to make room for it: every phase here
came from the business using the merged Round 13 build, and this did not.

**What has changed since it was first asked for** is that the argument for it
is now partly satisfied by accident: scores carry an author, a stage, an anchor
version and a Reason, and the panel shows the current one and the history
behind it. **That covers scoring and nothing else.** A fifth deferral is a
choice to keep covering scoring and not the rest.

### `CURRENT_STATE.md` reconciled

**13 of 16 sections are byte-identical across the whole round**, including all
nine configuration sections. The three counts hold: `stage_gate_rules` **61
total, 45 on test_bed**, `scoring_criteria` **5**, `scoring_anchors` **15 at
version 1 only**. This round configured nothing, so identical configuration is
the required result rather than a pleasing one.

Three sections changed. The header is mechanical. `approvals` is plus 18 and
record counts are plus 11 live, and **every one of those 11 is the business**:
`TT-SGP-EDUCAM-002` created, nine documents approved, and `TT-SGP-EDUCAM-003`
driven through Monitoring and Analysis, Review and Completion, Decommissioning
and into Closed between 06:10 and 06:26. Attributed by owner and by
`audit_log`, and **explained by an actor outside the round, which is a
different answer from explained by a phase.** Soft-deleted growth is this
round's fixtures and the `test:db` runs.

**Every harness-wide query in this phase was paged**, because Round 13 Phase 7
hit PostgREST's 1000-row default and a delete reported success while missing
its target. The scan covers **3240 harness records**, comfortably past the cap,
with 0 live, 0 orphaned gate rules and 0 approvals attached to them.

### Open item 23 fired again, and this time it mattered more

**The dev server serves the frontend from disk, so the business was again
exercising unmerged branch code mid-round.** Confirmed rather than assumed: the
served assets carry Phase 1's `tb-score-reason`, Phase 2's pending marks, Phase
3's `width: max-content` and Phase 4's removed "Created. View it".

**They were not incidentally exposed to it, they used it.** The `score_revised`
at 06:25:16 went through Phase 1's one-Reason field and its entry-time
enforcement, on a real record, before any of it was signed off. Nothing broke.
**That is luck rather than design**, and it is the second consecutive round in
which it has happened.

### Seven probe defects, and where they landed

**Every defect this round found in its own work was in the verification, not in
the code under test**, which is now the third consecutive round.

Phase 0: a fixture linked Test Beds by `account_id` and `initialLead` when the
popup is driven by `record_contacts`, so no popup existed; a second Opportunity
run hit the duplicate warning **because the first run had created one**; and a
measurement read the inline `span`, whose `scrollWidth` is always 0, rather
than the row that carries the truncation. Phase 2: a guessed save-button id
that never clicked, an opportunity fixture missing its `opportunity_details`
row so the endpoint updated zero rows and the date silently never moved, and
two assertions reading the payload for values that live elsewhere. Phase 3:
the chevron popup opens on a delegated `mouseover` needing a
`.chevron-item[data-stage]` target, not a `mouseenter` on the wrapper. Phase 4:
a fixed delay that clicked Save before the suggested name had arrived, and the
vacuous `null === null` match.

**Two of them produced output that looked like a product defect**: the
Opportunity date silently not moving, and two creation paths reporting no
navigation. In both cases the thing that separated a probe defect from a
product defect was running the same probe against `main` before concluding
anything.

### Open, carried forward

Round 13's twenty-four stand, with item 21 now promoted into the named business
item above and item 23 confirmed as recurring. Two added:

25. **The score `comment` field is still accepted and still stored by the
    server, and nothing writes it.** Left in place deliberately so historical
    entries keep what they carry, per Phase 1.2. A future reader will find a
    field with a writer that no longer exists.
26. **`recordTbScores` still computes a partial-failure message across several
    scores**, and Phase 1's entry-time enforcement makes the common route to it
    unreachable. The message is still correct and still reachable by network
    failure or concurrent change; it is simply much harder to see, which is
    worth knowing before anyone assumes it is dead code.
