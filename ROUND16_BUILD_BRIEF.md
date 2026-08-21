# Round 16 build brief: sub-tabs, Site Details merge, arrow navigation

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND15_BUILD_BRIEF.md`. Read all six before starting.

**`CLAUDE.md` was edited three times in Round 15.** Verification 15 added,
Verification 4 and 11 sharpened. Re-read from disk before doing anything
and say whether the copy you hold is current, rather than assuming either
way.

This round restructures the Reference tab and completes an interaction fix
that Round 15 delivered only half of.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Scope boundaries, confirmed with the business

- **The sub-tab component is built for two consumers, not one.** Round 17
  needs the same pattern for per-unit data on the Installation and
  Commissioning tab. Build it once, reusable, rather than twice as a
  layout.
- **Unit records are Round 17.** Serial numbers and coordinates per
  deployed unit, derived from the Commercials counts. Photographs wait for
  the Google Drive question, which the business is settling separately and
  in one go.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at
  61 total, 45 on `test_bed`.
- **No anchor wording changes.** The business review still has not happened
  and carries nine items.
- **Record history is deferred for a seventh time.** State it plainly as a
  choice, and note that a seventh deferral is itself evidence about its
  real priority relative to everything that keeps displacing it.

---

## Standing rules that bear on this round

1. **Verification rule 7 and its twins.** Rounds 12 through 15 each
   produced seven probe defects and zero product defects in the code under
   test. **Verification 13**: a count of zero from an instrument never
   shown to reach one is not a measurement. **Verification 14**: a check
   that passes when both sides are absent is not a check. Phase 4 in
   particular is an absence claim across many keys and needs its counter
   shown reaching a number.

2. **The relocation form.** Phases 2 and 3 both move things. A change that
   moves something is two claims, not one: it appears in its new place, and
   it is gone from its old one. **Assert the count: exactly one instance,
   not at least one.** Round 10 shipped a duplicate Summary and a stale
   wrapper on exactly this shape and both reached the business.

3. **Build discipline 8: fix the class, not the instance.** Phase 4 must
   reach every single-line field on every screen. Round 15 Phase 2 found
   Contact had no keyboard path at all and three Summary elements written
   statically outside every renderer.

4. **Presence is not legibility**, sharpened in Round 15 Phase 4: a check
   confirms a thing is there, only looking confirms it reads. Every layout
   claim in Phases 1 to 3 needs the screenshot opened.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts.

1. **The Reference tab's current structure.** Round 13 Phase 6 restructured
   it into a card row plus a second row holding Use Cases and Customer
   Documents side by side, each growing independently via
   `align-items: start`. Report the current members of `.ref-cards`, what
   sits outside the grid, and the measured height of the whole tab at 1240,
   1920 and 3440 with realistic content.

2. **Whether any tab mechanism can be reused.** The stage tab strip and the
   detail tab strip both exist. Report how each works, whether either is
   parameterised or hardcoded, and whether a third strip can reuse one of
   them rather than becoming a third implementation. Round 15 Phase 2 found
   the click-to-edit reveal had drifted four ways before Round 10 Phase 0A
   collapsed it.

3. **The Site Details panel's contents and every reader.** Site Ownership,
   Inst. Env., Site Address, City and the Sensors block. Report every place
   each field is read, rendered or validated, since Phase 3 moves four of
   them and Phase 2 moves the fifth somewhere different. Note that
   `installationEnvironment` became a picklist in Round 10 Phase 3.2.

4. **Every single-line input in the application, and every exclusion.**
   This is Phase 4's scope and the phase cannot be built without it. Report
   every text and numeric input, every textarea, every select and every
   date input, per screen. Round 15 Phase 3 converted 69 numeric inputs to
   `type="text"`, so text and numeric are now the same type and must be
   distinguished some other way if the rule needs to.

5. **How focus moves today.** Report the current tab order on the Reference
   tab, whether it follows DOM order, and whether anything already handles
   arrow keys anywhere. Round 15 Phase 2's `fieldDisplayKeydown` excludes
   navigation keys by `key.length !== 1`, so arrows currently reach the
   browser's default handling and do nothing in a single-line input.

6. **Baseline the suite.** `npm test` and `npm run test:db` on a clean
   checkout of `main`. Keep the full output. Check residue before and
   after, paging every harness-wide query, and enumerate from the database
   by tag rather than from any file the harness wrote.

---

## Phase 1: The sub-tab component

A reusable tab strip that renders inside a panel area, takes a list of
labelled panes, and shows one at a time.

**Built for two consumers.** Phase 2 uses it on Reference. Round 17 uses it
on Installation and Commissioning for per-unit data. If it is built against
Reference's specifics it will be rebuilt in Round 17, which is the pattern
Round 10 Phase 0A had to collapse after it had drifted four ways.

**AMENDED after Phase 0. Phase 1 GENERALISES the two existing switchers into
one parameterised component and makes the sub-tab its third consumer. It is
not a standalone third implementation.**

Phase 0 item 2 found the duplication this phase was about to add already
exists: `switchOppTab` and `switchTbTab` are two near-identical functions,
each wired to a hardcoded container id, each reading buttons from static
HTML, neither taking a list of panes. **Standalone makes three. Round 17
makes four.** That is the exact shape Round 10 Phase 0A had to collapse
after the click-to-edit reveal had drifted four ways, and the cost of
collapsing it rises every round it is left.

**This makes Phase 1 materially larger, and that is the cheaper option.**
Say so plainly in the report rather than treating the extra scope as
overrun.

**ARIA lands in the shared component**, so all three strips get it at once.
Phase 0 found no `role="tab"`, `role="tablist"` or `aria-selected` anywhere
in the application, and no arrow-key handling of any kind. Building ARIA
only into the sub-strip would leave the one conformant strip nested inside
two non-conformant parents, which is worse than none.

**Two hazards Phase 0 found, to be handled rather than rediscovered:**

- **`switchOppTab` hides `.detail-tab-panel` GLOBALLY** (`document.querySelectorAll`),
  where `switchTbTab` scopes to `#view-test-bed-detail`. Harmless while one
  detail view shows at a time, and wrong the moment a sub-tab pane uses that
  class. The component's panes must not reuse `.detail-tab-panel`.
  Architecture rule 8.
- The existing strips are `<button>` elements, so they are already
  Tab-focusable and Enter/Space-activatable. Adding a roving tabindex must
  not remove that.

**Three constraints:**

1. **Nested tab strips are a known usability problem.** Two rows of tabs on
   one page with no hierarchy between them is genuinely confusing. The
   detail tab strip is already sticky as of Round 13 Phase 5. Give the
   sub-strip a visibly subordinate treatment, and report what was chosen
   and why rather than matching the parent's styling by default.
2. **Keyboard operable**, per the WAI-ARIA Authoring Practices Guide's Tabs
   pattern. Arrow keys move between tabs within a tab strip, which is the
   established pattern and which Phase 4 must not fight.

   **CITATION CORRECTED after Phase 0.** This read "per
   `INTERACTION_STANDARDS.md` Section 4 and the WAI-ARIA Authoring Practices
   Guide it cites". **Section 4 is Park's focus trap for in-page dialogs, not
   a tab pattern, and the APG tabs pattern is not in that document at all.**
   That document cites the APG only for the keyboard-interface conventions
   and the Dialog (Modal) pattern. The APG tabs pattern is the source here and
   is being followed directly.
3. **Selection is not record state.** Which sub-tab is open is a display
   preference. Report whether it persists across records, and make that a
   stated decision. Round 12 Phase 8 recorded the Sensors toggle persisting
   across records deliberately, on the same reasoning.

**Test evidence required:** the component rendering with three panes,
switching by click and by keyboard, exactly one pane visible at a time
asserted by count. Confirm the sub-strip is visually distinguishable from
the parent strip, and open the screenshot rather than asserting it. Confirm
it works at 1240, 1920 and 3440, container measured not element.

---

## Phase 2: Use Cases, Customer Documents and Sensors into the sub-tabs

Confirmed with the business, whose reason is decluttering the Reference
tab.

**This reverses Round 13 Phase 6 one round later**, which moved Use Cases
and Customer Documents into a side-by-side row specifically so each could
grow independently. Record it as a deliberate supersession with that
reasoning left visible. The business's reason is better than the one that
produced the current layout: two large mostly-empty panels for two lists
that are usually short is a poor use of the tab's vertical space.

Three panes: **Use Cases**, **Customer Documents**, **Sensors**.

**Sensors comes from the Site Details panel**, which Phase 3 removes. The
two phases must be sequenced so Sensors moves exactly once. Report which
order was used.

**Test evidence required:** each pane renders its content correctly,
including the add controls for Use Cases and Customer Documents and the
existing not-yet-linked state for Sensors. **Assert the relocation as two
claims**: exactly one instance of each in the sub-tabs, and zero remaining
in their old positions. Confirm a use case can be added and removed, a
customer document added, and the sensor list renders on a Test Bed with a
real mixed count, all from inside the sub-tab. Report the Reference tab's
total height before and after at all three widths, since decluttering is
the stated purpose and the measurement is the evidence.

---

## Phase 3: Site Details merged into Customer Details

Confirmed with the business. Site Ownership, Inst. Env., Site Address and
City move to Customer Details. The Site Details panel is removed.

**Three things to handle rather than discover:**

1. **CORRECTED after Phase 0. Customer Details is NOT `.pg-card-wide`.**
   Measured on the live page it is a plain 420px card, the same as the other
   four, in a `420px 420px 420px` grid at 1920. This constraint was written
   on the belief that it spans two columns, so **it is wrong as written**:
   adding four fields changes its height AND the row's wrapping is governed
   by five equal cards becoming four, not by a spanning card.

   Round 6 Phase 2 did widen it and Round 10 Phase 3 narrowed it again; the
   narrowing is the state that survived. Report the effect on the card row's
   wrapping at all three widths against the measured baseline, not against
   the spanning assumption.
2. **Round 15 Phase 5 retitled the scores card**, so the card row now
   holds Terminus Details, Customer Details, Site Details, Key Dates and
   Qualification score. Removing one leaves four. Report the row counts
   before and after, since Round 13 Phase 6 found removing a card changed
   nothing because Customer Details spans two columns.
3. **`installationEnvironment` is a picklist** as of Round 10 Phase 3.2,
   with values Indoor, Outdoor and Both validated server-side. Moving the
   field must not disturb that, and it is one of the popup controls Round
   10 Phase 0A's single-click reveal covers.

**AMENDED after Phase 0. Move keys out of `TB_SITE_PANEL_KEYS`. Never
delete `TB_SITE_FIELDS`.** That array holds six entries, not four:
`estCostPerUnit` and `indicativeCost` are defined there and are not rendered
in the panel, and `TB_ALL_EDITABLE_FIELDS` spreads it, so the save path, the
label lookup and the input wiring all depend on it staying intact. Deleting
it to remove the panel would take those two definitions and the save path
with it.

**`city` is a sortable column on the Test Beds list** (`app.js` renders
`p.city` in the row and sorts on it). Moving the field between panels does
not change the payload key, so this should survive untouched, but it is a
reader outside the detail page and the evidence must confirm the list still
sorts and renders it rather than assuming.

**Test evidence required:** all four fields render in Customer Details and
are editable, with an edit persisting server-side. **The Test Beds list still
sorts and renders City.** **Assert the removal by
count**: zero Site Details panels, and each of the four fields appearing
exactly once on the tab. Confirm the picklist still offers exactly three
values and still rejects anything else server-side. Confirm the single-click
reveal still works on it, since it is a select. Screenshots at all three
widths, opened.

---

## Phase 4: Up and down navigate between fields

**Round 15 delivered half of this.** The business reported two things about
arrow keys: that they changed values, and that they should navigate. Round
15 Phase 3 stopped them changing values and did not make them navigate, so
they now do nothing at all. That gap was in the report and not in the
brief.

### 4.1 The rule, and its exclusions

**Up and down move to the previous and next field. Single-line text and
numeric inputs only.**

Excluded, each for a real reason:

| Excluded | Because |
|---|---|
| **Textareas** | Up and down are line movement. Summary, Notes and Install Notes are multi-line, and jumping out mid-sentence is worse than the problem being solved |
| **Selects** | Up and down move through the option list |
| **Date inputs** | Up and down change the focused date part |

**Left and right are never touched**, on any field. A user correcting a
character mid-string reaches for the left arrow and that must keep working.

### 4.2 Order: DOM order, confirmed with the business

**Option A.** Down goes to the next field in DOM order, which is the order
Tab already uses. Within a card that is the row below; at a card's end it
moves to the top of the next card, which is sideways on screen.

That was chosen deliberately over visual-column order: it is predictable,
it needs no geometry, and it matches the keyboard order that already
exists. **If it reads wrong in use the business will know quickly**, which
is better than guessing at column detection now.

**AMENDED after Phase 0. This option owns its own reasoning and does NOT
cite `INTERACTION_STANDARDS.md` Section 1.** Section 1 requires tab order to
match visual layout *exactly*, which is stricter than what is being built
here. Phase 0 measured the divergence: DOM order is card-major, and a strict
top-to-bottom left-to-right reading of the page is row-major, and the two
part company at the second focusable element.

**The real justification is that a card reads as a unit.** A person reads
Terminus Details top to bottom and then moves to the next card; they do not
read across three cards a row at a time. Card-major order matches how the
content is actually read, and it is what Tab already does today. That is the
argument, and it stands on its own without Section 1.

### 4.3 Scope

**Every screen, not the one reported.** Round 15 Phase 2 found the same
class of fix had missed Contact entirely and three statically written
Summary elements. Phase 0 item 4 establishes the full inventory.

**AMENDED after Phase 0. The scope is about 155 fields, decided as follows:**

- **119 fields on the four detail screens**, 69 numeric and 50 text, the 69
  cross-checking exactly against Round 15 Phase 3's own count of unique
  numeric ids.
- **Modals are IN**, adding roughly 34 single-line text inputs across seven
  modal containers.
- **`type="email"` is IN.** There are exactly two, both in modals. The rule's
  table listed neither an inclusion nor an exclusion for it.
- **Readonly fields can be navigated OUT of but are not landing targets.**
  Ten of the 119 are readonly computed Deal Sheet figures.
- **Park's focus trap is respected, not bypassed. Arrow navigation never
  carries focus out of a trapped dialog**, the same confinement
  `INTERACTION_STANDARDS.md` Section 4 already requires of Tab.

**The text/numeric merge does not complicate this rule.** Round 15 Phase 3
made both `type="text"`, distinguishable only by `inputmode`. Phase 4
includes both and treats them identically, so it never needs to tell them
apart: the three exclusions are each unambiguous on their own
(`tagName === 'TEXTAREA'`, `tagName === 'SELECT'`, `type === 'date'`).

**Watch the interaction with Phase 1.** Arrow keys move between tabs inside
a tab strip, per the ARIA pattern. A field inside a sub-tab pane must not
have its arrow keys stolen by the strip, and the strip must not have its
arrows stolen by this rule.

**Test evidence required:** down and up move between fields on every
screen, proven field by field against Phase 0 item 4's inventory rather
than on a sample. Every exclusion proven to still behave as before: a
textarea's caret moves by line, a select's options change, a date part
changes. **Left and right unchanged on every field type.** The absence
claims need a calibrated counter per Verification 13, shown reaching a
number on a case that should move. Confirm the tab strip's own arrow
behaviour is unaffected.

---

## Phase 5: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

**`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.**
`scoring_criteria` 5, `scoring_anchors` 15 at version 1 only. This round
configures nothing.

Tear down by enumerating from the database by tag, per Verification 11 as
sharpened in Round 15, which found four live records four phases old that
every per-phase teardown had reported clean.

Report whether the business exercised unmerged branch code mid-round, per
open item 23. **Count revisions, not new records.** Round 15 established
that editing an existing record writes a revision and creates nothing, and
a record count would have reported clean for the wrong reason.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **Phase 2 as a deliberate supersession of Round 13 Phase 6**, with that
  round's reasoning left visible and the business's better reason stated.
- **Phase 4 as the completion of a half-delivered fix**, and specifically
  that the gap existed because the report had two parts and the brief
  scoped one. That is a brief-writing failure rather than a build one.
- **Phase 1's subordination treatment and the reasoning**, since a second
  tab strip is a usability risk taken deliberately.
- **The sub-tab selection persistence decision**, whichever way it goes.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off. A report cannot sign off the phase
containing it, and a phase that ships no diff is still a phase.

**State in the close-out whether this round edited `CLAUDE.md`.**

---

## Round 16 outcome

Six phases, 0 through 5, confirmed by `grep -n "^## Phase\|^### Phase"`
returning 6 headings with no `###` sub-phases. Phases 0 through 4 each carry
an explicit sign-off in the session transcript; Phase 5 is signed off by the
message that commissioned this close-out, and the report containing it does
not sign off its own phase.

### THIS ROUND DID NOT EDIT `CLAUDE.md`

Confirmed by `git log main..HEAD -- CLAUDE.md`, which returns nothing. The
next session's injected copy is therefore current and needs no re-read on
that account. Round 15 edited it three times and this round edited it none.

Four findings landed in `DESIGN_PRINCIPLES.md` instead, none of which
generalises to a standing rule: the Round 13 Phase 6 supersession, the
half-delivered-fix shape, and the `el.focus()` keyboard-delivery finding.

### Phase 1 generalised two switchers, and fixed two live faults doing it

The phase was reframed by Phase 0 and the reframing is the round's most
useful result. It was scoped as "build a sub-tab component"; investigation
found the duplication it was about to add **already existed**. `switchOppTab`
and `switchTbTab` were two near-identical functions, each wired to a
hardcoded container id, each reading buttons from static HTML, neither taking
a list of panes. Standalone would have made three, and Round 17's per-unit
strip four.

So Phase 1 collapsed them into one `createTabStrip` with three consumers,
which is materially larger than the phase as briefed and the cheaper option.

**Two ARIA faults were live on `main` and are fixes rather than prevention:**

1. **Initial state was only applied on the first switch**, so a strip nobody
   had clicked carried `role` and `aria-controls` and **no `aria-selected` at
   all**. That was the real state of the Opportunity strip on every freshly
   opened record: the `.active` class said one thing and assistive technology
   was told nothing.
2. **`aria-labelledby` was set per button while wiring**, and Test Bed's eight
   stage tabs all control one shared panel, so the panel was labelled by
   whichever stage tab happened to be last in the loop.

Before this round the application had no `role="tablist"`, no `role="tab"`, no
`aria-selected` and no arrow-key handling anywhere at all.

### The Site Details merge reduces height at 1240 ONLY

Stated plainly because the phase reads as a decluttering win and is one at
exactly one width:

| Width | Before | After |
|---|---|---|
| 1240 | 1536px | **1257px**, a whole grid row disappears |
| 1920 | 1257px | **1257px**, unchanged |
| 3440 | 876px | **876px**, unchanged |

Customer Details grew from 297px to 459px, at an unchanged 420px width, by
very nearly what the removed card freed. **At 1920 and 3440 the merge buys no
vertical space whatever.** Anyone citing it later as a height saving should
cite 1240 and not the other two.

### Record history is deferred for the SEVENTH time, as a choice

Not an oversight and not a backlog item that keeps narrowly missing the cut.
Every round since Round 10 has had a more valuable use of its phases, and this
round spent them on a component collapse, two relocations and a
half-delivered fix. **A seventh deferral is itself evidence about its real
priority relative to everything that keeps displacing it**, and the question
worth putting to the business is whether it is genuinely wanted rather than
when it will be scheduled.

### `CURRENT_STATE.md` reconciled

Regenerated at `04a19c6`. Staleness test passed before regenerating: the
recorded SHA is an ancestor of `HEAD` and no tracked configuration source had
changed.

- **Configuration unchanged, verified against the database with every query
  paged rather than inferred from an absent diff line**: `stage_gate_rules` 61
  total and 45 on `test_bed`; `scoring_criteria` 5; `scoring_anchors` 15, all
  at version 1. This round configured nothing, as scoped.
- **Live record counts are identical, 93 before and after, on every record
  type.** Every fixture this round created was torn down.
- Totals rose by the fixtures and suite runs that were then soft deleted:
  account, contact, opportunity and test_bed each +5, one per phase.

### Open item 23 did not fire, and this time nothing fired at all

Counted by **revisions, not new records**, per Round 15's finding that editing
an existing record writes a revision and creates nothing.

    record_revisions written this round: 27   mine 27, NOT mine 0
    records created this round: 412           mine 412, not mine 0

**The business did not touch the application during this round.** No writes at
all.

**THE ITEM STAYS OPEN AT FULL STRENGTH, and the two rounds establish different
things.** Round 15 established that the business used the app and stopped
before the branch code reached disk, so they exercised `main`. **This round
establishes only that they were absent.** Absence is not evidence about the
exposure; it is evidence about their week.

**Two rounds of non-occurrence do not reduce a structural exposure.** The dev
server serves the frontend from disk, so whenever they open the app mid-round
they get whatever branch is checked out, unreviewed and unmerged. Nothing
about that has changed, nothing in either round tested it, and the risk is
identical to the day it was first recorded. **Do not read a run of quiet
rounds as the item decaying**, which is the specific way a structural item
gets quietly downgraded: each round reports "did not fire", the phrase
accumulates, and the exposure is eventually treated as theoretical because
nothing has gone wrong yet.

### Teardown enumerated by owner, per Phase 2's own refinement

Phase 2 found that enumerating by tag misses `document` records, because the
tag lives in `payload.name` and documents do not carry one. Teardown now
enumerates by `owner_id`, which every record type has. Zero live probe-owned
records remained at Phase 5, Phase 4's teardown having already been complete.
`reference_number_counters` stands at 974 rows, untouched by rule.

### Probe defects, and where they landed

Every one was in the harness rather than the product, and each was caught by a
signal rather than by suspicion.

- **Phase 4, 130 mismatches on working code.** `el.focus()` set
  `document.activeElement` on a visible element with a 190px rect and the
  browser delivered no keydown at all. Recorded in `DESIGN_PRINCIPLES.md` as
  its own entry, because the visibility check that catches Round 15's
  zero-rect version passes cleanly here.
- **Phase 4, a dropped argument that halved the scope.** An unhide call read
  `` `#${x} .hidden` `` with the `panelId` argument omitted, producing
  `#undefined .hidden`; the Deal Sheet contributed 11 landing targets instead
  of 55.
- **Phase 4, an uncalibrated trap test.** The first version proved focus never
  escaped a dialog over a page with no eligible fields behind it. Re-run over
  a populated page: 18 candidates document-wide, 10 inside, **8 outside**.
- **Phase 2, two miscounts.** Sensors counted by container children read 2
  where the answer was 24; a customer-document add read `1 -> 1` because an
  empty-state row was replaced by a real one.
- **Phase 3, a defect introduced and caught inside one phase.** Removing
  `renderTbSiteDetails` left `renderTbSensors` reachable only from its own
  toggle, so Phase 2's pane would have rendered empty on load.

### Open, carried forward

Round 15's twenty-eight stand. Item 23 did not fire and stays open on
structural grounds. Two added:

29. **Sub-tab panes inherit the full content width**, so at 3440 a use case's
    Remove control sits roughly 2900px from the text it belongs to. It matches
    the Notes list directly beneath it, which has always been full width, so
    it is consistent with the page rather than anomalous. Reported rather than
    changed unasked.
31. **The units table's column headers scroll out of view.** Round 17 Phase 2:
    at 24 units the table is 814px and the header row leaves the viewport, so
    a reader deep in the list has no labels for Serial, Latitude, Longitude
    and State. **It is masked today and will stop being masked exactly when
    the feature starts being used**: every empty cell carries a placeholder
    repeating its column name, so the labels read as inline hints while the
    units are still Planned, and they disappear the moment real serials and
    coordinates are entered. A sticky header row is the fix. Logged rather
    than built, being outside that phase's scope.

30. **One database-suite run returned 37/38 and the failure text was not
    captured.** Four subsequent runs returned 38/38 with no `PGRST303` and no
    assertion text in any log. Recorded as an uncharacterised transient rather
    than presented as five green runs.
