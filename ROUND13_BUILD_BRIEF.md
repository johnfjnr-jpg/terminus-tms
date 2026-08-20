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
