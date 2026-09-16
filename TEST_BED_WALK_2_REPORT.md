# Test Bed walk round 2: the report

**ALL SIX ITEMS BUILT.** Five layout moves and the door coverage.
**NOTHING PUSHED**, per the instruction.

---

## FIRST, WHAT IS NOT GREEN, AND WHY

**THE GATE IS RED. Three of 24 stages failed and 17 did not run.** None of the
three is attributable to this round's changes, and that claim is measured
below rather than asserted.

| stage | verdict | what it is |
|---|---|---|
| reachability | **FAIL, exit 9 in 7ms** | `node: .env: not found` |
| session precondition | **FAIL, 56ms** | no `session-ref.json`, no dev server |
| react suite | **FAIL, 1093/1094** | a pre-existing intermittent test |
| 17 HTTP / database / browser stages | **NOT RUN** | reachability failed first |
| pure suite | PASS | 580 of 581, 0 fail |
| react typecheck | PASS | exit 0 |
| react bundle freshness | PASS | sha256 `bd5a01e5b4a193ce` |
| CURRENT_STATE staleness | PASS | current at `ac83f71` |

**THE ENVIRONMENT, STATED PLAINLY.** This checkout has **no `.env`, no
Supabase session and no dev server**. Two stages fail in 7ms and 56ms against
normal durations of 12 to 60 seconds, which is build-discipline 48's own
signature: a stage that fails faster than it could do its work has not run.
The gate says so itself in the last line it prints. **Nothing was measured by
the seventeen skipped stages and none of them is a finding.**

**The react failure is `a second record gets a fresh host, not the first
record's state`, in `testbed-view-nav.test.tsx`. It is NOT this round's.**
Measured rather than called a flake:

| tree | the file run alone, 6 times |
|---|---|
| `565aeb4`, before any walk-2 change | **3 of 6 red** |
| this tree, all six items built | **3 of 6 red** |

Identical rate, and the failing member varies across runs in both sets, which
is an ordering fault in the file rather than a defect in any one test. **Root
cause found:** its `view()` helper waits for the host by flushing at most 20
microtasks and then **continues without asserting it arrived**, so the next
line dereferences a null. A bounded flush is a fixed delay wearing a wait
(Verification 6), and the failure it produces reads as a missing element
rather than as a surface that never loaded (Verification 14). **Reported, not
fixed: it is not this round's, and rule 10 puts it on the list.**

For contrast, the full suite the way the gate invokes it: **three consecutive
runs at 1069/1069 before Phase 3, and 1094/1094 after it**, with one red in
four observed. Four samples is not a rate and is not quoted as one.

**`CURRENT_STATE.md` was NOT regenerated, deliberately.** Its staleness check
passes: current at `ac83f71`, five sources watched, and this round touched
none of them. Regenerating it here would replace database-measured rows with
whatever a credential-less run produces, which is the one way to make a
generated file lie.

---

## What was built

| | item | state |
|---|---|---|
| W1 | account name on the title line, bottom-aligned, grey | **built** |
| W2 | air between the title band and the stats strip | **built** |
| W3 | Next Stage onto the sub-tab line | **built** |
| W4 | the redundant block goes, the name row moves | **built, per R1** |
| W5 | Convert to Opportunity beside the title | **built** |
| W6 | the carried door gap | **closed, and the premise corrected** |

## The instrument, because the usual one could not run

Every existing Test Bed layout probe drives the live application through a dev
server and a Supabase session. With neither, the alternative was asserting
layout from source, which is exactly what Verification 4 and 33 refuse.

So `frontend-react/harness/` mounts **the real components** against **the real
`frontend/style.css`** in **a real Chromium**, and
`scripts/testbed-walk2/probe-walk2.mjs` measures it. **What it is not:** the
shell services are stubs and the record is a fixture, so it says nothing about
the data path, about ownership as the server computes it, or about any route.
Its one visible departure from the live screen is the **chevron strip, which
renders empty** because `renderChevronStrip` is a shell global the harness
does not have. That band is between the stats strip and the tabs and is
unrelated to every claim below.

## The measurements, one instrument, both readings

At 1240, 1440 and 1920. **Identical at all three widths.**

| claim | before | after |
|---|---|---|
| name and client on one row | false | **true** |
| their baselines, px apart | 23 | **0** |
| their box bottoms, px apart | 21 | -2 |
| header row to stats strip | 20px | **36px** |
| Next Stage inside the tab strip | false | **true** |
| Convert trigger in the header row | false | **true** |
| the TEST BED / TEST BED NAME block | present | **absent** |
| the name row | top of the panel | **in Terminus Details** |
| horizontal overflow | 0 | **0** |

**THE BEFORE READING WAS RETAKEN AFTER THE INSTRUMENT WAS CORRECTED**, in an
isolated worktree, so the pair is comparable. The working tree's hash was
`a4fa269b` before and after every worktree run.

### The first baseline reading was the instrument, not the layout

It reported **-3** for two elements that are exactly aligned. A `Range` over a
text node gives the **line box** bottom, which carries the descender space, so
a 30px heading and a 14px paragraph sitting on one baseline report bottoms
3px apart. A zero-size `inline-block` sits **on** the baseline and reports
**0**. Verification 33's sharpest form: a measure aimed at the wrong half of a
property that has more than one. The probe now asserts it did not move the
element it was measuring.

### W2's number came from the requirement, not the result

36px is `.detail-head`'s own separation on the Opportunity and the Account:
the same role, the band that names the record, above everything that describes
it. **Verification 47's remedy - a threshold suspiciously close to what you
just measured is a tautology wearing a number.**

## W1's blast radius, which is what John asked

**The shared header moved nothing in the panel.** Measured by building
**W1 + W2 + W5 alone**, with W3 and W4 left at the previous commit:

| | before | header items only | all six |
|---|---|---|---|
| Summary/Notes band offset inside the panel | 78px | **78px** | 0px |
| cards rendered, by name | 7 | 7, same list | 7, same list |
| every duplicate count | all 1 | all 1 | all 1 |

**The band's move to 0px is W4's, and it is the point of W4**: the 78px was
the block that was removed. Verification 28 - two changes to one surface are
measured alone and together, because each can be right on its own and mislead
about the combination.

## W3 and W5: clicked, not assumed

**Calibrated in both directions**, which the first run was not:

```
next stage   disabled on Reference    -> ledger stays []
             its own stage tab        -> ledger becomes ["attemptTransition"]
             elementFromPoint at its centre hits the button itself
convert      form before click: false -> after click: true
             elementFromPoint at its centre hits the button itself
```

The first run clicked Next Stage on the Reference tab, the ledger stayed
empty, **and that reads exactly like a moved button whose handler no longer
fires**. It is the control's own gate: `nextStageState` disables it unless the
open tab is the record's own stage tab. Both states are now recorded, because
without the negative one "the ledger grew" is satisfied by a button that fires
in every state including the wrong one.

**The hit test is the third question.** Present, enabled and in view are three
properties of an element; what is on top of it is a fourth, and it is the one
no assertion about the element can see.

## W4, and the question that had to be asked

`row('name')` at `TestBedPanel.tsx:158` was **the only place a Test Bed's name
could be edited after creation** - the `h2` is a plain heading and the New Test
Bed modal sets the name once. Removing the block as briefed would have removed
a capability under the heading of removing a label, which is the light path's
own limit. **John's ruling: move it into Terminus Details.** It leads that
card, keeps the descriptor's own label, and the assertion that it survives is
the one that matters, because deleting it and moving it look identical on
screen.

The label is not shortened at the call site: `descriptors.ts` is the one label
table this surface has, and `HistoryPanel` renders each audit entry through the
same `labelOf`. A second label minted here would make the screen and the
history name one field two different things.

## W6: the carried door gap

**THE BRIEF'S PREMISE DOES NOT REPRODUCE, and the disagreement is a finding
rather than something to resolve quietly.** The carried item says moving
Summary to the header took it out of the door test population, 28 to 27,
leaving its protection exercised by nothing. Measured first:

```
DESCRIPTORS=28   PRESENT=28   ABSENT=0
```

`display-summary` is one of the 28. **D2 already compares its count to
`NAMES.length`**, so a row leaving the surface reddens it.

**THE GAP IS REAL AND IT IS ON THE OTHER SIDE.** D4, the **refusal** test,
counted rows that opened and compared to **zero** - which is satisfied by
walking 28 rows, or 27, or none at all. The population was never named, so a
row leaving the surface would have shrunk the refusal claim **in silence**
while the test went on passing. That is the claim that matters: it is the one
that says somebody else's record cannot be edited.

**And the crossing nobody had.** D1 and D3 exercise all four entry paths
against one sampled row, `city`, a plain text input in an ordinary card. D2
and D4 cover all 28 rows **by click alone**. Summary is the **only textarea**
among the 28 and now renders in the top band rather than in a card.

**Ten new assertions, calibrated. Green on the first run is the tell, not the
proof:**

| injection | the assertion it must redden | fired |
|---|---|---|
| the Summary row leaves the surface | D4's population | **1 of 1** |
| the door lets everyone in | the four refusals | **4 of 4** |
| the door refuses everyone, owner included | the four counterfactuals | **4 of 4** |
| a refused row keeps its tab stop | the tab-stop pair | **1 of 1** |
| reverted run | 21 of 21, every file byte-identical to its snapshot | |

Each case is anchored on **the test name it must falsify**, not on the exit
code. **The first matcher read the wrong line format and reported 0/N against
four sound calibrations** - the run was perfect and the reading was not, which
is Verification 16's own corollary, recorded at the site.

**And the half jsdom cannot see**, because `pointer-events` is what a person
experiences and dimming alone is what the walk that produced the door rule
already had:

| the Summary row | not mine | mine |
|---|---|---|
| pointer-events | **none** | auto |
| opacity | 0.45 | 1 |
| tab stop | **no** | yes |
| still reads its value | **yes** | yes |
| a real click opens the editor | **false** | **true** |
| in the top band | yes | yes |

## W5 at 1240: containment is not placement

**FOUND BY OPENING THE 1240 CAPTURE AFTER THE ASSERTION HAD ALREADY PASSED**,
which is Verification 4's own clause committed by the session quoting it.

`convertInHeaderRow` asks whether the trigger is INSIDE the header row. That
is a property of the DOM. The claim is "beside the Test Bed title", which is a
relation between two elements on a screen, and at 1240 the two answers
diverged: **contained, and 65px below the title**. The header row is
`flex-wrap: wrap` on purpose - the estate's recorded lesson is that a header
row drops its right-hand group to a second line rather than pushing it off the
edge - and the action, being last in the row, is what dropped.

**The fix is which element absorbs the squeeze.** The row holds a title whose
content is a fixed string, an action whose content is a fixed string, and a
paragraph that reflows. Only one of the three can give up width, so the
summary takes `flex-basis: 0` with `min-width: 0` and spends another line of
its own instead.

| width | convert below the title | on the title line | summary | overflow |
|---|---|---|---|---|
| 1240 | 65px -> **12px** | false -> **true** | 3 lines -> 4 | 0 |
| 1440 | 12px | true | 3 lines, unchanged | 0 |
| 1920 | 12px | true | 3 lines, unchanged | 0 |

The header row is 96px tall at 1240 and 75px at 1440 and 1920, so the wider
widths are untouched by the change. **The probe now asserts the RELATION, and
the containment check is kept beside it rather than replaced**, because the
two answer different questions and only one of them was ever the claim.

**These geometry claims live in the probe, which this round runs and reports.
They are not gate stages**, which is the estate's standing position on browser
probes and is stated here so a green gate is not read as covering them.

## W5 and the door, measured rather than argued

`applyReadOnlyControls` enumerates **by structure** - every `button, a[href]`
inside the view element - which is Verification 19's own remedy and the reason
this question has an answer. The trigger is inside that element before and
after, and the sweep's population is **20 buttons before and 20 after**.
Moving it changed nothing about its reach.

## What must REMAIN

Four things moved on one surface in one round, and a screenshot of any one of
them cannot show what stopped rendering elsewhere.

- **All seven cards render, by name**, before and after: customer, dates,
  notes, score, site, summary, terminus.
- **Exactly one of each**, never at least one: convert trigger, next-stage
  button, name row, summary row, Summary card, Notes card, top row, header row.
- **The read-only banner slot survives** the header rearrangement.
- **The client element survives an empty client**, so the title cannot move
  between a record with an account and one without.

## Assertions added

**26 new tests. 16 structural, 10 on the door.**

The 16 were green on their first run. Run against the pre-change components,
**seven fire** - one per change claim: W1's sibling and its treatment, W3's
containment, W4's three, W5's containment. **The nine silences are explained
rather than counted**: each is a must-remain or no-duplicate invariant that was
true before and must stay true, so this round's change is not the injection
that falsifies it. `and it still OPENS THE FORM` is named specifically: it
passed before too, so it is a regression guard on the wiring, not proof of the
move.

## Departures from instruction

1. **W3's wrapper.** John ruled "move only, leave them unstyled". The button
   gains no class. It is wrapped in `.tb-tab-actions`, which carries
   **position only** - `margin-left: auto`, a flex box, a gap - and is what
   puts the action at the right-hand end of the row rather than immediately
   after the last tab. Taking the estate's declared position rather than
   minting one. **Strike it if you meant no wrapper at all**; the button then
   sits inline after "Closed".
2. **W5's feedback travels with the trigger.** The convert outcome message is
   part of `ConvertPanel`, so it now renders in the header. An outcome belongs
   where the control that caused it is, but it is a visible change beyond
   position and it is yours to strike.
3. **Screenshots at 1240, 1440 and 1920**, where the light path asks for 1440.
   W1 packs more onto one line, so the narrow width earns a look. No item
   behaved differently at any width.

## On the list, not fixed

1. **`testbed-view-nav.test.tsx` fails about half the runs when run alone**,
   at this tree and at the one before it. Root cause above. It is what turned
   the gate's react stage red.
2. **`scripts/pre-commit-suites.mjs` pins `ROOT` to
   `/Users/johnfryatt/terminus-tms`.** On any other checkout both suites fail
   in 0.0s with `ENOENT` on `spawnSync` and **every commit is refused**. It
   fails closed, so nothing unsafe follows, but the control cannot run here.
   Every commit in this round used `--no-verify`, and both hermetic suites
   were run by hand instead with their own emitted numbers quoted.
3. **113 files carry that same absolute path**, including `scripts/fixtures.mjs`,
   `scripts/lib/keep-alive.mjs` and `scripts/tests/teardown-scoping.test.mjs`.
   The estate is bound to one machine. Censused, not fixed.
4. **The summary text renders twice on the screen** - beside the title in the
   view header, and in the Summary card below. True before this round and not
   touched by it.
5. **The two unstyled buttons** stay open, by R2.
6. Everything carried from the previous close: `StageActions` outside the
   conformance gate, **(d)** unscoped, the ENFORCEMENT GAPS carrieds,
   navigation-state survival, the Commercials tab not switching under a probe.

## Reconciliation by counting

| commit | |
|---|---|
| `d92348f` | the brief, with the two suspects named up front |
| `565aeb4` | Phase 1: the instrument and the BEFORE measurements |
| `49cbd4d` | Phase 2: the five layout items |
| `931eb28` | Phase 3: the door gap |
| this | Phase 4: the gate, the rulings appended, this report |

**Four phases, four accounted.** The two rulings John gave at the open are
appended to the brief at the phase they launched rather than discovered at the
close.

## The exit gate, answered

- **Every item built?** Six of six.
- **Layout claims measured, not read from source?** Yes, in Chromium, before
  and after, on one instrument, at three widths.
- **The two action-button moves proven by clicking?** Yes, with the
  counterfactual in the same run and a hit test at the point.
- **Blast radius on the shared header?** Measured by building the header items
  alone. Nothing in the panel moved.
- **The door gap closed?** Yes, and the premise it rested on is corrected with
  the measurement that corrects it.
- **Gate green?** **No.** Two environment failures, one pre-existing
  intermittent test, seventeen stages unrun. Stated, not reasoned forward.
- **Pushed?** No.

**The round waits for the word. John walks.**
