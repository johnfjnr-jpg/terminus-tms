# Round 13 build brief: scoring interaction, sticky tab row, Reference layout

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND12_BUILD_BRIEF.md`. Read all six before starting.

Round 12 put the anchors in front of the scorer. This round is about what
happened when the business used them: the panel presents the framework
correctly and does not yet support the act of scoring. Every item came from
scoring a real prospect.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Amendments after Phase 0

Three findings against this brief, all recorded here rather than folded
silently into the phases.

| # | Phase | Change |
|---|---|---|
| 1 | 7 | **Add `asks` to `scripts/state-dump.mjs`.** It is a configuration value that can change and is not recorded, so Phase 3's row edit would produce no diff at all. That is precisely the gap the "the diff between rounds is the configuration changelog" rule exists to close |
| 2 | 5 | **The tab row's measured height carries into the phase**, and a width-threshold fallback is named but deliberately not built |
| 3 | 3 | **A second `asks` value is reported, not changed.** Data Rights reads as a commercial-value question |

---

## Scope boundaries, confirmed with the business

- **No anchor wording changes.** The business review has not happened. Eight
  recorded ambiguities, plus the measurement that a 5 anchor averages 3.4
  independent conditions and that 2 and 4 carry no wording at any version,
  are its input. Phase 3 changes one `asks` value and no anchor text.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at
  61 total, 45 on `test_bed`. The invariant asserts it, so any change fails
  the suite, which is the intended behaviour.
- **The scrolling scoring panel is parked**, superseded by Phase 5's sticky
  tab row, which addresses the same problem without a second scroll
  context.
- **Record history is still deferred.** The per-field change trail and
  criterion authorship from `audit_log`, requested three times, moves behind
  this round again. Note that plainly in the close-out.

---

## Standing rules that bear on this round

`CLAUDE.md` applies in full. Four bear directly:

1. **Verification rule 7, the counterfactual.** State what the condition
   would look like if the action had not happened, and check it differs.
   Round 12 recorded seven harness defects and no product defects in the
   code under test; four of the seven passed a real-state wait that the old
   state already satisfied. This round has drivers in five phases.

2. **A walkthrough proves the path it walks.** Before writing a driver,
   state how many of a thing a user would do before saving, and drive that
   number. Phase 2 in particular: a user scores several criteria before
   saving, and Round 11A shipped a fault because the driver scored one at a
   time.

3. **Measure the container, not the element, and presence is not
   legibility.** Phases 5 and 6 are both layout. Round 11 Phase 4 shipped
   six correct rows in an unusable panel that passed every programmatic
   check.

4. **A fix built for the surfaces that existed is not a fix for the ones
   built after it.** Now at five confirmed instances. Phase 1 exists partly
   to establish whether the Test Bed creation dialogue reached every
   caller.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts. Direct reads of real code and real data.

1. **Every Test Bed creation entry point.** The business reported that
   creating a Test Bed named it after the Company with no chance to edit,
   then corrected themselves: renaming does work. **That correction does not
   close the question.** Round 10 Phase 1 built a creation dialogue with the
   suffixed default pre-filled and pre-selected, and Round 2 Phase 5 built a
   hover Create dropdown on the Contacts list, which is a second entry
   point. Report every path that creates a Test Bed, and **which of them
   open the naming dialogue**. If any bypasses it, that is a real gap even
   though the business withdrew the report.

2. **Whether the exit criteria panel refreshes after a score is saved.**
   The business observed ticks not appearing, and correctly attributed it to
   not having saved. Confirm that is the whole explanation: record a score,
   save, and report whether the exit criteria panel updates without a manual
   refresh or a tab change. Round 12 Phase 1 made saves re-apply the current
   tab, which should refresh it, so confirm rather than assume.

3. **The comment field's current behaviour at a score of 1 or 2.** Report
   where the requirement is enforced today, what the user sees when it is
   violated, and at what point. Round 11A recorded that the server rejects
   at save time and that a partial failure across several scores stops at
   the first refusal.

4. **The `asks` field.** Report where it is stored, how it renders today,
   and its current values for all five criteria. Phase 3 changes one value
   and its prominence.

5. **The page's current scroll and header structure.** Report the height of
   everything above the stage tab row, the tab row's own height, and whether
   anything is already sticky or fixed anywhere in the app. Round 10 Phase 2
   cut the header from 346px to 145px specifically to recover height, so
   report what a sticky region would cost against that.

6. **The Reference grid today.** Members, the `minmax(280px, 420px)` cap,
   which elements sit inside the grid and which are full-width sections
   outside it. Round 12 Phase 3 measured five cards fitting without adding a
   row; report what six would do at 1240, 1920 and 3440.

7. **Baseline the suite.** `npm test` and `npm run test:db` passing on a
   clean checkout of `main`. **Keep the full output.** Round 12 recorded a
   failure whose cause was destroyed by filtering the output of a run whose
   result was not yet known, and a second failure caused by orphaned rules
   from a killed run. If either fires, check residue before re-running.

---

## Phase 1: Comment required at 1 or 2, enforced at entry

Confirmed with the business.

Today the requirement is enforced server-side at save time. A score of 1 or
2 with no comment is refused, and Round 11A's partial-failure rule means
everything after it in the batch is not attempted. So a user scoring five
criteria, one of them a 2, loses the rest of that save.

**Move the enforcement to the point of entry:**

1. Selecting 1 or 2 places the cursor in that criterion's comment field and
   makes the field visibly the thing that needs attention.
2. Further scoring is blocked until the comment is entered.
3. **The server check stays exactly as it is.** This is an addition, not a
   relocation. Client-side validation is an affordance; the server rule is
   the guarantee, and Round 11A's partial-failure behaviour must be
   unchanged.

**Test evidence required:** select a 2, confirm focus lands in the comment
field, confirm another criterion's control cannot be used until a comment
is present, then confirm it can. Score several criteria including one at 2
with a comment and save once, confirming all are recorded. **Confirm the
server still refuses a 1 or 2 with no comment when called directly**,
bypassing the browser, and that the partial-failure message is unchanged.

---

## Phase 2: Pending tick state in exit criteria

Confirmed with the business, after considering the alternative.

The exit criteria panel shows what the server has recorded. The business
wants to see requirements ticking off as scores are entered, before saving.

**Build a distinct pending state, not an ordinary tick.** A tick that means
"recorded" in one moment and "chosen but unsaved" in another is a screen
that lies, and Round 11A's fault was precisely a screen state that did not
match the server. The pending treatment must be plainly distinguishable
from a confirmed tick, without relying on colour alone.

Three requirements:

1. A pending mark appears when a score is selected and not yet saved.
2. It becomes a confirmed tick when the save lands, and reverts if the save
   fails.
3. **A confirmed tick never appears for anything the server has not
   confirmed.** Assert this directly rather than by inspection.

**Test evidence required:** select a score, confirm a pending mark appears
and that it is distinguishable from a confirmed tick by something other
than colour. Save, confirm it becomes confirmed. **Force a save failure and
confirm the pending mark reverts rather than promoting**, which is the case
that matters and the one a happy-path driver will not reach. Confirm the
transition endpoint is entirely unaffected: this is display over
`computeBlocking()`'s output and must not change what blocks.

---

## Phase 3: The question, made prominent

The `asks` value renders today as a small dim heading above the anchors.
The business reads it as the label for the whole criterion and wants it
visible.

1. **Raise its prominence** so it reads as the question being answered
   rather than as a caption on the anchor block.
2. **Change one value**, per the business: Rollout Path's `asks` becomes
   **"Does a suitable rollout path exist"**. A row edit in
   `scoring_criteria`, not a code change. Leave the other four unchanged.

3. **AMENDED after Phase 0: report a second `asks` value, do not change
   it.** Data Rights' `asks` is currently **"Is it worth doing for
   Terminus"**, which reads as a commercial-value question and does not
   obviously match the criterion it labels. The other four read as direct
   questions about their own criterion. **Propose a wording and stop**; this
   is not edited without sign-off, for the same reason the anchors are not.

**No anchor wording changes.** The `asks` field is the question; the
anchors are the instrument, and they are the business review's subject.

**Test evidence required:** confirm the new wording renders and that the
other four are untouched, verified against the table rather than the
screen. Confirm the change is a row edit by showing the migration contains
no code change to how `asks` is read. Screenshots at the three widths.

---

## Phase 4: The dropdown position

**Confirmed with the business: leave the select where it is.** They looked
at it obscuring the anchor text and decided against restructuring.

This phase exists to record that decision rather than to build anything, so
a later round does not rediscover it as an unaddressed defect. Record in
`DESIGN_PRINCIPLES.md`: a native `select` renders in the browser's popup
layer and its position is not controllable, so the list will overlay
content below it; moving the select below the anchors was offered and
declined.

**No code changes in this phase.** Note that a phase shipping no diff is
still a phase, per Round 11A.

---

## Phase 5: Sticky tab row

Confirmed with the business, option A: **the tab row alone sticks.** Not
the workflow chevron, not the Test Bed name, not Summary.

The reason for the narrow choice is recorded: the tab row is the smallest
thing that answers "where am I and how do I get elsewhere". The chevron and
the name are checked on arrival rather than continuously, and every pixel
made permanently sticky is a pixel taken from every long tab forever. Round
10 Phase 2 cut the header from 346px to 145px specifically to recover
height.

Adding the chevron later is trivial; removing it once people rely on it is
not.

**AMENDED after Phase 0: the height is measured, and it is not constant.**
The tab row **wraps**, so it is tallest exactly where vertical space is
scarcest:

| Width | Tab row height |
|---|---|
| 1240 | **109px** |
| 1920 | 72px |
| 3440 | 35px |

385px of content sits above it at every width. For scale, Round 10 Phase 2
cut the header from 346px to 145px to recover height, so at 1240 a
permanently sticky tab row gives back about half of what that round
recovered. **Report specifically how 1240 feels**, not just what it measures.

`.app-content-scroll` is the scroll container and the body does not scroll,
and there are no overflow or transform ancestors between the tab row and that
scroller, so `position: sticky; top: 0` needs no new scroll context. That was
checked in Phase 0 rather than assumed.

**The fallback, named so it is not invented under pressure, and NOT to be
built pre-emptively:** if 109px proves unacceptable at 1240, the sticky
region can apply above a width threshold rather than universally. Build the
universal version first and report; only reach for the threshold if the
measurement at 1240 says to.

**Test evidence required:** scroll a long stage tab and confirm the tab row
remains visible and functional, including that clicking a tab from the
stuck position works. Report the exact height consumed. Confirm nothing is
obscured beneath it at any of the three widths, specifically that the first
row of content is not hidden under the stuck row, which is the classic
failure of this pattern. Confirm the behaviour on the Reference tab and on
a stage tab. Screenshots, opened.

---

## Phase 6: The Reference layout

The business proposed Use Cases and Customer Documents as their own wider
panels, with the scores summary in a left-hand column beside them.
**Confirmed after discussion: the scores summary joins the card row
instead.**

The reasoning, recorded because it decides future cases: a fixed five-row
card beside two panels that grow indefinitely produces a short card next to
a long one and a large dead area beneath it, which is the dead-space failure
mode already fixed three times in this project. The scores summary is also
read at the same moment as the four detail cards, and Use Cases and Customer
Documents are worked with once you are already in the record.

| Row | Content |
|---|---|
| 1 | Terminus Details, Customer Details, Site Details, Key Dates, Scores |
| 2 | Use Cases and Customer Documents, side by side, each growing independently |

**Two things to handle rather than discover:**

1. **Use Cases is currently a full-width section outside the grid** and
   Customer Documents is a card inside it. Both move into a new row-2
   arrangement. This is a restructure, not a reorder.
2. **Row 1 will wrap at 1920.** Five cards at 420px need roughly 2160px and
   the Reference grid is about 1556px there. That is expected and already
   happens; "row 1" means one group, not one literal line. Do not force
   five across with a narrower cap, which would reintroduce the truncation
   Round 6 Phase 2 fixed.

**Test evidence required:** before and after measurements at 1240, 1920 and
3440, container measured not element, no card overflow and no page
overflow. Confirm Use Cases and Customer Documents each grow independently
by loading one with many more entries than the other and confirming neither
strands the other. Confirm the scores summary is still read-only, asserted
structurally as Round 12 did: zero controls, zero handlers, zero focusable
nodes, proven by injecting a control and watching the count move. Open the
screenshots.

---

## Phase 7: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

**AMENDED after Phase 0: `asks` must first be added to the generator, or
this phase's own expectation cannot be checked.** `scripts/state-dump.mjs`
selects `id, record_type, criterion_key, name, sort_order,
rescore_through_stage` and **not `asks`**, so Phase 3's row edit produces no
diff and "exactly one `asks` value different" is unverifiable from the file.
Add the column to the generator's `scoring_criteria` select and table, so the
change appears in the configuration changelog where a configuration change
belongs.

**Note when editing that file: plain `grep` returns NOTHING for it.** It
holds two literal NUL bytes at lines 500 and 561, used as composite-key
separators, so `file` reports it as `data` and `grep` treats it as binary and
stays silent. Use `grep -a`. See `CLAUDE.md` Verification rule 12.

**`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.**
`scoring_anchors` unchanged at 15, version 1 only. `scoring_criteria`
unchanged at 5 rows, with exactly one `asks` value different, which Phase 3
accounts for and which the generator change above makes visible.

Tear down before regenerating, selecting by what the round created rather
than by relationship. **Expect live changes that no phase accounts for**:
the business is using the system in production between rounds, and Round 12
found twelve such changes belonging to one record driven through five
stages. Attribute them rather than absorbing them, and state plainly that
they are explained by an actor outside the round, which is a different
answer from explained by a phase.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **The pending-versus-confirmed distinction** and why an ordinary tick was
  rejected, since it decides every future case of showing unsaved state.
- **The sticky region's scope**, with the reasoning for the tab row alone
  and the note that adding to it later is cheap and removing from it is not.
- **The layout decision**, including the rejected alternative and why, so a
  future round does not restore the business's original arrangement for
  tidiness.
- **Phase 4's declined change**, so it is not rediscovered as a defect.
- **Phase 0 item 1's finding**, whichever way it resolves. The business
  reported a fault and withdrew it, and the underlying question of whether
  every creation path reaches the dialogue is unanswered either way.

**THIS ROUND EDITS `CLAUDE.md`, so the close-out must say so.** Two rules
were added in Phase 0: Build discipline 8 (fix the class, not the instance
the failure named) and Verification 12 (a tool that returns empty rather than
erroring). `CLAUDE.md` is delivered to each session as a snapshot taken at
session start, so the next session receives the OLD copy and must re-read it
from disk. That only happens if this round's close-out records the change.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off before declaring the round complete. A
phase that ships no diff is still a phase, and a report cannot sign off the
phase containing it.

---

## Round 13 outcome

All 8 phases delivered. Checked with `grep -n "^## Phase\|^### Phase"` per rule
7, **with the pattern including `###`**, which returns 8 headings and no
sub-phases. Phase 0 is the investigate phase and built nothing, and Phase 4
shipped no diff to `src/` or `frontend/` by design; both are stated rather
than left to be inferred from an absent diff.

**Phases 0 through 6 carry an explicit sign-off. Phase 7 is the phase this
close-out is part of and is reported, not signed off**, because it cannot sign
off the report that contains it.

### THIS ROUND EDITED `CLAUDE.md`

**Two rules were added, and the next session will not see them unless it
re-reads the file from disk.** `CLAUDE.md` is delivered into each session as a
snapshot taken at session start, so a session following this round receives the
version from before it. That is why this notice exists and why it is the first
thing in the outcome rather than a footnote.

- **Verification 12: a tool that returns empty rather than erroring produces
  output indistinguishable from a true negative.**
- **Build discipline 8: fix the class, not the instance the failure happened
  to name.**

| Phase | Delivered | Beyond the brief |
|---|---|---|
| 0. Investigate | Seven items, three findings against the brief | **A silent `grep` failure that nearly published a wrong conclusion**, and six live harness records left by Round 12 that falsified a `CURRENT_STATE.md` claim for a full round |
| 1. Comment at entry | Focus moves to the comment, further scoring blocked, server untouched | **The handler refuses, not only the control.** A change event dispatched at a disabled select still took the draft, which is Architecture rule 8's shape. Save also refuses locally, a stated departure, without which the fault was still reachable in one click |
| 2. Pending tick state | A dot, a dashed border and the word "unsaved", promoting on save and never on failure | **Round 11A's recorded partial-failure behaviour is wrong**, found while verifying something else |
| 3. The question | Raised out of the anchors block; one row edit | **The generator change was moved forward from Phase 7**, because a row edit is only visible as a row edit if the column already exists in the baseline |
| 4. Dropdown position | Nothing. A decision recorded | **A refuted hypothesis of my own, kept visible and struck** |
| 5. Sticky tab row | The tab row alone, 119px at 1240 | **The action group's own line is the lever, not a width threshold**, which is a better answer than the fallback the brief named |
| 6. Reference layout | Two growing panels in their own row | **Independence proven in both directions**, which is what makes it evidence rather than an observation |
| 7. Regenerate and reconcile | Fixtures torn down, regenerated, every hunk attributed | **A third class of residue from the same killed run**, and a silent row cap that made a delete report success |

### The round's own rule, demonstrated three times on itself

**Build discipline 8 was promoted in Phase 0 and its third instance was found
in Phase 7 of the same round.** One killed test run in Round 12 left three
kinds of residue:

1. **4 orphaned `stage_gate_rules`**, which failed three invariants and were
   cleaned at the end of Round 12. That is the instance the assertion named.
2. **6 live `harness_*` records**, which nothing asserted against, found in
   Phase 0 of this round. They falsified `CURRENT_STATE.md`'s own printed claim
   that no harness record type holds a live row, for a full round.
3. **1 `approvals` row** carrying a null `stage` on the `Senior` track, found
   in Phase 7 because it changed a configuration section. `CURRENT_STATE.md`
   had recorded 0 null stages.

**Each time the fix was scoped to what had just complained.** The rule says to
enumerate everything the responsible actor writes; the harness's own teardown
reports `recordsSoftDeleted`, `rulesDeleted`, `approvalsDeleted` and
`contactLinksDeleted`, so the list of what to check was available from the
start and was not used until the third pass.

### Corrections to the record, which are this round's real output

**1. Round 11A's partial-failure behaviour is not what its close-out says.**
The claim is "everything unrecorded stays dirty". Measured with three criteria
and the failing one in the middle: before the save the drafts were Rollout Path
4, Physical Suitability 2, Data Rights 5; after it `tbEdits` was `{}` and all
three selects were empty. **The valid 5 is discarded from the form with nothing
saying so**, because the failure branch reloads the record and loading resets
the drafts. Phase 1 makes the common route to this unreachable; the record is
corrected rather than the code.

**2. A hypothesis of mine, refuted in the same round.** Phase 3 recorded that
Data Rights' `asks` looked like a stray label from the retired Technical and
Commercial Value criterion. It was deliberate: Data Rights is the only
criterion measuring value to Terminus rather than to the client, on a
cost-only programme where the data is a substantial part of the return. Kept
visible and struck, with the note that **the obvious explanation for a value
nobody has been asked about is a guess wearing evidence's clothes.**

**3. A better answer than the brief's own fallback.** The width threshold named
for the sticky row would remove navigation help at exactly the width where
wrapping makes navigation hardest. The action group's own line costs 34px at
both 1240 and 1920, more than the threshold would save. **Trim what sticks
rather than disable it by width.**

### Seven probe defects, and one that was a tool

**Every defect this round found in its own verification was in the
verification, not in the code under test**, which is now the second consecutive
round where that is true.

Phase 2: a fixture pre-seeded a Rollout Path score, so the promote test ran
against a criterion the server had already confirmed, **and the wait on
`data-met` becoming `true` was already true before the save**, resolving
instantly against a save that never happened. Phase 5: the hit-test x came
from the scroller's rect rather than the row's, so every test returned
`DIV.wrap`; the probe scrolled a fixed 700px and **reported a false failure**
where the page was too short to travel that far; and the ordinary fixture does
not scroll at all at 3440, so stickiness there was untested rather than
passing. Phase 6: the measurement waited on `#tb-usecases-list`, which is
populated whether or not the separate customer-documents fetch has landed, so
a panel that settles at 1328px was measured at 231px and **very nearly became
a reported finding that it does not grow**. Phase 7: a records query hit
PostgREST's 1000-row default against 3000-plus harness rows, so the row being
looked for was silently outside the set and **the delete reported 0 and looked
like success**.

**The eighth was not mine.** `scripts/state-dump.mjs` holds two literal NUL
bytes, so `grep` treats it as binary and matches nothing, silently, with the
same exit status as a pattern that genuinely is not there. Searching it for
`scoring_criteria` returned nothing, and the reading that follows is "the
generator does not record the scoring tables", which is false and was about to
be reported. What caught it was noticing that a file `head` could read was a
file `grep` could not.

### `PGRST303` caught with its evidence intact, which partly answers Round 12's open item 20

**Phase 7's first `test:db` run failed 10 of 38, and this time the output was
kept.** All ten failures are one root cause: `config-invariants.test.mjs`
raises `PGRST303: JWT issued at future` on its shared setup query, so every
invariant in that file fails at once. **30 occurrences of the message in a
single run.** Residue was checked before re-running, per the brief's own
instruction: 61 gate rules, 0 harness orphans, 0 live probe records, 0
null-stage approvals. Two retries then passed 38 of 38 with zero occurrences.

**Round 12's open item 20 recorded a failure whose cause was destroyed by
filtering.** This is the mechanism it named as a candidate, now with evidence,
and it is the fifth sighting in this project. **It is not proof that Round 12's
failure was this**, because that run reported `fail=1` and this reports
`fail=10`, and this fault takes out a whole file at once. What it does
establish is that the clock-skew error is real, is current, and takes out
every test in the file whose setup it hits. **The instruction to keep the full
output is what turned an unexplained failure into a diagnosed one**, one round
after the instruction was written.

### `CURRENT_STATE.md` reconciled

**11 of 16 sections are byte-identical across the whole round.** The three
counts the brief names all hold: `stage_gate_rules` **61 total, 45 on
test_bed**, `scoring_anchors` **15 rows, version 1 only**, `scoring_criteria`
**5 rows with exactly one `asks` value different**.

**The `asks` column already existed in the baseline before this phase**, added
and committed in Phase 3 along with a clean regenerated baseline. The
round-level diff therefore shows the column and the value change together,
which is expected; **the one-line attribution lives in history**, at `7d24f59`
against `f01a5c1`, which is the whole reason the ordering was chosen.

Migrations 52 to 53, accounted for by Phase 3. Record counts and `approvals`
are fixture churn plus the item below.

**Live changes explained by an actor outside the round, which is a different
answer from explained by a phase.** Four live documents, five approvals and a
run of transitions and a score revision on `TT-SGP-SMARTC-004` belong to the
business using the system between 04:26 and 04:28, attributed by owner and by
`audit_log`. **Worth stating precisely because of where they were working:**
the dev server serves the frontend from disk, so it has been serving this
round's unmerged branch since the branch was created. Their use during the
round exercised Phase 1, 2, 3 and 5 code that had not been signed off. Nothing
broke, and the score revision they recorded went through Phase 1's comment
guard and Phase 2's pending marks.

### Open, carried forward

Round 12's twenty stand, with item 15 unchanged: the anchor review has not
happened and no wording was amended. Four added:

21. **The scoring panel is taller than the decisions it holds**, and two
    independent observations now land on it: Phase 1's lock note scrolls above
    the viewport when working on a lower criterion, and the scrolling-panel
    request parked at the head of this round. **That request is not superseded
    by the sticky tab row**, which solves locating yourself in the record
    rather than the panel's own height.
22. **Data Rights is item 9 of the anchor review**, framed as a drift rather
    than an error: the `asks` states intent, the anchors measure the mechanism,
    and permission is necessary for value without being value. Two defensible
    resolutions, neither a build decision.
23. **The dev server serves the working tree**, so an unmerged branch is live
    to anyone using that server. Useful during this round and a real hazard in
    general.
24. **Round 11A's close-out is wrong about what survives a partial failure**,
    corrected in `DESIGN_PRINCIPLES.md` and left uncorrected in the code, since
    Phase 1 makes the common route unreachable.
