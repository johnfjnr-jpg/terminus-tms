# Assessment panel: tabular rows

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 29 merged to `main`
at `2f2f3fd`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

The business scored a real opportunity through the Round 28 panel and
reported, verbatim:

> *"Why are we wasting so much screen real estate. There is too much empty
> space. We need the data input to be quick and easy otherwise sales people
> will not use it. Could we not condense these rows down by using the right
> hand side of the panel which is empty. You could almost make this a grid
> where the user can just enter the data. Think tabular rather than long
> winded screen tabbing and multiple click entry."*

**This replaces the row layout Round 28 shipped.** That should be stated
plainly rather than presented as a refinement. **What Round 28 did is not
undone**: it removed roughly 1800px of always-open anchor text, closed a
cross-record draft bleed that could write one Opportunity's judgement onto
another, and gave the panel one save. The row itself is what this round
replaces.

**One question the business answered while reporting this: Verified is
reachable.** The five-level scale is not four levels and an aspiration.

---

## The requirement, and a correction to how it was first framed

The brief's author initially proposed a keyboard-first design: tab into the
first criterion, choose a level, tab to the reason, type, tab to the next.
Seven criteria in one pass without the mouse.

**The business rejected that, and the reasoning corrects a real error:**

> *"The user may see just 1 field he wants to change as a go back and correct
> thing. Having to tab through all the fields to get to that 1 field would be
> a poor way to design this."*

**The common case is not scoring seven from scratch. It is coming back to
change one.** A tab chain optimised for a first pass makes the frequent case
worse.

**So the requirement is direct access to any single field, with a first pass
that is not painful.** Click straight into the row you want. Tab moves forward
from wherever you are because that is what tab does, not because the design
assumes a sequence.

**That changes why the grid earns its place.** Seven rows on one screen means
you can see the one you want and click it. At the current row height you
scroll to find it first, which is the real cost.

---

## What exists today

From the business's screenshot of one criterion, unverified and to be measured
in I1: roughly **200px tall** and using about **60% of the width**, with the
right-hand side empty. Stacked vertically inside the row: current reason,
value, meta line with author and timestamp, then two separate toggles.

Round 28's final measurements were **687px collapsed** and **1463px drafting**
for seven criteria, down from 818 and 3266. **Those are the numbers this round
is measured against.**

---

## The proposed shape

**One row per criterion. Level, reason, value and a control on the line.**

Name and question in the left column, then the level select, the reason, the
value where the criterion carries one, and a single control for what comes off
the row.

**What comes off the row:**

- The meta line, author and timestamp, to hover or the expanded state.
- The definitions toggle and the history toggle, behind one control per row
  rather than two links.

---

## Three decisions that are for the phases, not this brief

### The reason, truncated or not

**The business declined to decide this in advance:** *"I would have to see how
this looks in use."*

**That is the right answer and the round should honour it.** Build the row with
the reason truncated and the full text on expand, look at it with real
content, and report. If it reads badly the fallbacks are a two-line row that
still beats 200px, or a reason that expands in place on focus.

**Do not decide it before the phase that can look at it.** This is the same
shape as Round 28 Phase 3's 16px finding and Round 29 Phase 4's prominence
measurement: a judgement that becomes answerable once the thing exists.

**The tension worth naming:** the reason is variable length and it is what a
bid review challenges. Truncating is a real loss. The counter is that a reason
nobody can scan past is not being read either.

### The level control

**Do not carry the dropdown forward by default.** Five options, one click to
open and one to choose, in a design whose complaint is multiple click entry.

**Report the alternatives with the row in front of you** and say what you
chose. Whatever it is must support direct access to one field without a
sequence.

### The 880px cap

Round 28 capped the criterion at 880px because that is where the anchor prose
read well.

**The definitions are behind a toggle now and mostly closed**, so the cap
serves the open state and penalises the closed one, which is the state a user
is in almost always. **Setting the cap on the definitions block rather than on
the row is the likely fix**, but measure it rather than assuming.

---

## Investigations

### I1. What the row actually costs

**Measure, do not estimate.** Row height and the used width, at 1240 and 1920,
for a criterion in each of these states: never scored, scored with a reason,
scored with a reason and a value, and drafting.

Report the panel height for seven criteria in each state, against Round 28's
687 collapsed and 1463 drafting.

**Report where the vertical space goes**, per element, the way Round 28 Phase 4
found that 22px of a row was 10px of declared margin and 12px of an unreset
`<p>` bottom margin.

**Report the empty width**, since that is the business's own observation and
it is what the grid would use.

### I2. Direct access to one field

**The question.** What does it take to click straight into any single field
without a sequence, and what does the current panel do?

Report the current tab order through one criterion and through seven. Report
whether anything today prevents clicking directly into a field.

**Report what the level control does to this.** A native select opens on
click; whatever replaces it must not be worse for the single-field case.

### I3. The grid, and what it does to the existing mechanisms

Round 28 and Round 29 built five things into this panel. **Report what each
needs from the layout:**

- The **save bar**, sticky at the foot, driven by a dirty set derived from
  `oppAssessDraft`.
- The **reason box**, mandatory at Unknown and on any revision.
- The **value**, on Budget confirmed only, an amount plus a currency from
  `CURRENCY_CODES`.
- The **definitions block**, with its scale-level description and
  per-criterion override precedence.
- The **history control**, showing the series minus the current entry.

**Report which of these fit a row and which do not**, and what the ones that
do not become.

### I4. What the row does at width

The panel is inside a lens sub-tab inside the Assessment tab. **Report the
available width at 1240 and 1920**, and what a row with five columns does at
the narrower one.

**Round 28 Phase 4 found one criterion whose name plus question already
exceeds its cell**: "Competition, including do-nothing" wraps at both widths.
Report what that does in a row layout, since a wrapping name in a grid is a
different problem from a wrapping name in a stacked block.

### I5. Test Bed

**Report what Test Bed's scoring panel does and whether any of this should
reach it.** Round 29 recorded that Test Bed and Opportunity have converged
where the mechanism was shared and diverged where it was not.

**This round is Opportunity only unless the investigation says otherwise.**
Test Bed's panel is not the subject of a business complaint, and its five
criteria are a different instrument. **Report, do not propose.**

### I6. What the design cannot express

**Output item 4 has caught the brief's central premise being wrong four times
in nine rounds**, most recently the tab strip's free space and Reference having
no edit bar. This brief is written from one screenshot of one criterion.

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The row: level, reason, value on one line |
| 2 | What comes off the row: meta, definitions, history |
| 3 | The level control, per I2 |
| 4 | The reason treatment, decided by looking |
| 5 | Full walk and close-out |

**Argue with it.** If I3 shows the save bar or the value do not fit a row,
that reshapes Phase 1. If I1 shows the vertical cost is somewhere other than
the row structure, the whole plan changes.

---

## Verification requirements

**Measure the panel height for seven criteria at every phase**, at 1240 and
1920, against 687 collapsed and 1463 drafting. **That is the number the
business asked about and it should not be quoted from an earlier phase without
re-measuring** — Round 28 Phase 8 found the per-phase contributions did not
sum the way the reports implied, and Round 29 found a stale measurement that
had been load-bearing for a design decision a round later.

**Look at it, every phase.** This round is about whether a panel is quick to
use, which no assertion measures. Round 29 Phase 4 quantified a prominence
judgement and shipped no diff; that is an acceptable outcome for a phase here
too.

**Direct access to one field is the test, not a first pass.** Verify by
clicking into the fourth criterion's reason with nothing else touched, three
times in sequence without reloading.

**Every browser interaction at least three times in sequence without
reloading.**

**Test Bed pixel-identical**, calibrated on the elements each phase changes,
not on whatever the probe happens to measure. Round 28 Phase 6 found a probe
that fired correctly for four phases and was structurally blind for the fifth.

**Captures: assert the subject is visible and still rendered after the
capture.** Round 29 Phase 5 found a clipped screenshot that was itself ending
the hover, and an in-frame guard that checked position but not visibility.

**Citations in any documentation name symbols, not lines.** Round 29's own
citations rotted three phases after they were written.

**Enumerate teardown from the database by tag**, and check the tag is this
round's. Round 29 Phase 2 found a stale tag that caught its fixture only
because the setup script's tag was stale in the same direction.

---

## Explicit non-goals

- **Round C.** Three lenses, twenty-five criteria. **This round is the gate on
  it**: configuring twenty-five more criteria into a panel that is still
  tiring would build the problem four times larger.
- **Test Bed's scoring panel**, unless I5 says otherwise.
- **The system-wide dirty registry** `INTERACTION_STANDARDS.md` Section 5
  specifies.
- **The Closed Lost hover wording**, still with the business.
- **The five undocumented mechanisms** named but not recorded in Round 29.
- Round D, the Reference tab round, reopening a loss, the open-decisions
  convention, `measurabilityConfirmed`, the approval snapshot.

---

## Output format

1. **I1 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 measurements**, per state and per element.
3. **The I3 verdict** on which mechanisms fit a row and what the others
   become.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated**, and there will be something,
   because this brief is written from one screenshot.

Then stop and wait for sign-off.

---

# Phase 0 report

Round 30. Branch `round-30-assessment-tabular-rows`, cut from `main` after the
brief was committed there, so the branch carries its own scope from its first
commit.

Investigation only. No code, no migrations, no seeds, no routes. The two live
style injections below were removed and confirmed gone.

---

## I1. What the row actually costs

Fixture at Proposal, walked through the real gates: `assessmentReviewed` at
each stage, four Solution Alignment payload fields, three track approvals.
Fresh record, zero assessment series, which is the state Round 28 measured.

### Round 28's numbers reproduce exactly

| state | 1240 | 1920 |
|---|---|---|
| collapsed, nothing touched | 687 | 687 |
| a level chosen on all seven | 1463 | 1463 |

**Reproducing them rather than quoting them is what made the gap visible.**
Both are fresh-record figures. The business is not on a fresh record.

### The states the business is actually in

| state | panel, 7 criteria | per row |
|---|---|---|
| never scored | 687 | 96 (112 wrapping) |
| **scored with a reason** | **1279** | **173** (229 with a value, 189 wrapping) |
| drafting, fresh | 1463 | 197 |
| **drafting, already scored** | **2055** | **274** (399 with a value) |

**1279 and 2055 are this round's targets.** 687 and 1463 describe the emptiest
possible record.

The business estimated the row at roughly 200px from one screenshot. Measured:
173px, and 229px for Budget confirmed.

### Where the vertical space goes, per element

**There is no `p` reset anywhere in the stylesheet.** The reset block zeroes
`body` only, so every `<p>` in the application carries the user agent's default
1em top and bottom margin unless a rule overrides it.

Gaps read directly off one scored row:

| gap | declared | actual | undeclared |
|---|---|---|---|
| head to current block | 10px | 14px | +4 |
| reason to meta, inside the block | 3px | 14px | +11 |
| current block to definitions control | 10px | 21px | +11 |
| below the control | 0 | 4px | +4 |

`.opp-assess-current-reason` and `.opp-assess-current-meta` declare no margin at
all. The meta's 11px bottom margin escapes its parent, which has no bottom
padding or border to stop the collapse, and lands between the current block and
the control below it.

**Proved by injection rather than by reading the cascade: 217px off the 1279px
pane, 29px per row, 43px on the row carrying a value, and it reverts to 1279
exactly.** That is 17 per cent of the panel, available before any design
decision is taken.

### The class is application-wide

Injecting the same reset everywhere and reading the delta per screen:

| screen | visible `<p>` | carrying a UA margin | delta |
|---|---|---|---|
| opportunity detail, Assessment | 17 | 15 | 275px |
| opportunity detail, Reference | 9 | 4 | 136px |
| test bed detail | 12 | 2 | 120px |
| opportunities list | 2 | 0 | **0px** |

The zero is the calibration. The instrument discriminates rather than always
reporting a number.

### The empty width

| viewport | pane | row | used | empty |
|---|---|---|---|---|
| 1240 | 876 | 876 | 100% | **0px** |
| 1920 | 1556 | 880 | 57% | **676px** |
| 3440 | 3076 | 880 | 29% | **2196px** |

Zero block-level overflow at all three. The business reported "about 60 per
cent", which is 1920, not 1240.

---

## I2. Direct access to one field

**The verification this brief names cannot be performed.** Clicking into the
fourth criterion's reason with nothing else touched, three times in sequence
without reloading, returned the same answer three times: there is no field to
click. **Zero of seven criteria carry a reason field at rest.**

`reasonBox` is emitted only for a criterion with a draft in progress. The
shortest real route to one reason field is three steps, and the level is
necessarily restated as part of amending a reason.

Two further findings from looking at the drafting state, both checked rather
than read off the picture:

- **The existing reason is not carried into the field you must type into.**
  192 characters sit on screen above it; the textarea holds zero. The business
  described "just 1 field he wants to change as a go back and correct thing".
  There is nothing to correct: you retype it.
- **The head then shows the same words twice**, the value cell and the select
  both reading the chosen level.

**One thing the picture appeared to show was false.** The Budget figure box
looked prefilled with `450000`. It is empty. `450000` is a hardcoded
`placeholder` in the source that happened to equal this fixture's stored
amount. Reported from the image it would have been a fabricated finding.

Tab order costs 14 stops for seven criteria: each criterion's definitions
toggle sits between it and the next.

---

## I3. Verdict on the five mechanisms

| mechanism | fits a row | what it becomes |
|---|---|---|
| Save bar | panel level, unaffected | stays; its `max-width: 880px` must track whatever the row does or it detaches from the rows it belongs to |
| Definitions | no, 222px tall at full row width | already expand only; becomes the row's expanded region |
| History | no | already expand only; joins definitions under one control |
| The value | does not earn a column | 1 of 7 criteria carry one, so a permanent column is empty on six rows. Treatment decided in Phase 2 with the row present |
| The reason | **no, not at 1240** | this is what reshapes Phase 1 |

**The reason is what breaks the proposal.** At 1240 there are 876px. Worst-case
name plus question is 521px, the level label 117px, the select 210px: **848px
of 876 before the reason gets anything.** Dropping the question entirely leaves
322px, and the shortest real reason measures 357px on one line while the
longest measures 1210px.

---

## I4. What the row does at width

Container chain at 1240: `#app-shell` 1240, `.app-content-scroll` 1024,
`#view-opportunity-detail` 1000 with 62px padding each side, pane **876**.
At 1920 the pane is 1556; at 3440 it is 3076.

**The 880px cap is inert below a 1244px viewport.** It does nothing at 1240 and
wastes 676px at 1920 and 2196px at 3440.

"Competition, including do-nothing" wraps its name at both widths, costing 16px
on that row in every state.

---

## I5. Test Bed

Its scoring list is **390px wide, inside a 420px card, identical at 1240 and
1920**, one card in a multi-panel row rather than a full-width panel. Row
heights identical at both widths. It cannot take a five-column row and this
round should not touch it.

**The most important finding of this phase.** Round 12 Phase 2 solved the same
problem on Test Bed and took the opposite decision, and wrote the reasoning
into the stylesheet: `.tb-score-name` is `flex: 0 0 170px` so the eye travel
from a criterion to its score is a constant 182px, and the comment states
explicitly that this "is also why it is not a width problem to be solved by
capping the panel."

**Opportunity gave the name `flex: 1 1 auto` and capped the panel at 880px.**
It took the approach Round 12 had rejected, and received the complaint Round 12
was avoiding.

**This is the first instance in this project of a rejected approach being
documented in the code and taken anyway.** Distinct from every prior finding of
its family: build discipline rule 6 is a fix not reaching a new surface, and
architecture rule 8 is an unchanged path meeting a new demand. Here the
reasoning against the approach was written down, in this repository, in a
comment a reader of the scoring CSS would pass on the way to the Opportunity
rules, and the approach was taken regardless. A written rationale is not a
guard. Nothing reads it.

One fault the two panels share: Test Bed's reason field is also absent at rest,
zero of six, and its code says so in as many words: "the comment field does not
exist until this render produces it".

---

## I6. What cannot be built as stated

**The brief's premises are mostly right**, which is unusual for output item 5:
roughly 200px tall, roughly 60 per cent of the width, an empty right-hand side,
the stacking order, and two toggles on a criterion carrying history are all
confirmed by measurement. Written from one screenshot and it held.

What does not survive:

1. **The five-column row does not fit at 1240.** 848px of 876 is spent before
   the reason.
2. **The 880px cap is not the 1240 lever.** Verification 15: a fix well defined
   at one width that does nothing at the other.
3. **The named verification is unperformable**, because the field it names does
   not exist at rest.
4. **687 and 1463 measure a state the business never sees.**

---

## The plan

| Phase | Content |
|---|---|
| 1 | The undeclared margins |
| 2 | The row: name, level, reason, value on one line, reason present at rest |
| 3 | What comes off the row: meta, definitions, history |
| 4 | The level control |
| 5 | The reason treatment, decided by looking |
| 6 | Full walk and close-out |

Six phases rather than the brief's five. The margins go first because they are
17 per cent of the panel, need no judgement, and move the baseline every later
phase measures against. Phase 2 absorbs direct access, because a reason cell
present at rest is what makes direct access fall out of the row rather than
needing its own mechanism.

**Departure from build discipline rule 8, recorded rather than assumed.** The
rule says fix the class. The class is application-wide, and an application-wide
`p` reset inside a panel round would change screens nobody asked about. Phase 1
fixes the assessment panel explicitly and enumerates the rest with counts as a
recorded finding, so the round that does the application-wide reset meets the
reasoning rather than the exception.

**All success measurements this round are against 1279 and 2055.**

---

## Teardown

Six records, enumerated from the database by this round's tag, asserted against
the round number rather than assumed. Soft deleted; no
`reference_number_counters` row touched. Re-queried directly at row level: zero
still live, six carrying `deleted_at`.

**One of the six was named by no file.** The fixture B setup script threw before
writing its bookkeeping file, leaving a contact and an account behind, and a
later recovery script wrote a file naming the contact and the opportunity but
never the account. Verification 11 demonstrated inside the phase that cites it.

A broader sweep of all 25 live records across four record types found zero
matching any round-tag or fixture pattern, with the matcher calibrated against
a pattern known present. `joane tester` and `fred blogs` sit live in Contacts;
they are neither this round's nor a probe's.

---

# Phase 5 record: the reason treatment, and nothing changes

**No product diff.** No frontend, API, migration or seed file is touched by
this phase. The question it was given turned out to have an answer that
required no change, and the measurement is the deliverable.

---

## The question could not be answered from this round's own fixtures

Phase 2 built the reason truncated and left the judgement to this phase. At the
end of Phase 2 six of seven reasons read whole on one line; after Phase 4 five
of seven did. **Both exceptions are strings this round invented.** The
business's two scored opportunities carry reasons of eight and nine characters,
typed to clear a required field rather than written. Neither end of that range
is evidence about anything.

So the corpus is the business's own writing, everywhere it exists in this
product. Lengths only are recorded here: the content is client data.

## What this business actually writes

**Fifty reasons and comments recorded against a score, across both record
types**, opportunity assessments and test bed scores together.

| | characters |
|---|---|
| shortest | 3 |
| p25 | 8 |
| median | 14 |
| p75 | 25 |
| p90 | 39 |
| **longest** | **58** |

Widened to every value of three words or more anywhere in the system, 79 of
them: median 24, p75 32, p90 39. The single outlier at 659 characters is a
contact `summary`, a paragraph field, not a one-line justification.

**The longest score justification this business has ever written is 58
characters.**

## Measured against the cell rather than counted

The fifty real strings, rendered in the reason cell's own typography, in the
live page, at all three widths. The measurer was calibrated first: one
character 7px, fifty characters 350px.

| viewport | reason cell | the 50 real strings | fit on one line |
|---|---|---|---|
| 1240 | 876px | min 19, median 92, max **372** | **50 of 50** |
| 1920 | 817px | min 19, median 92, max **372** | **50 of 50** |
| 3440 | 861px | min 19, median 92, max **372** | **50 of 50** |

The longest real justification uses 372px of a cell between 817 and 876px:
**the cell is 2.2 to 2.4 times the width the longest real content needs.**

## Where truncation actually begins

Found by bisection on ordinary English prose in the live cell, rather than by
dividing by an average character width.

| viewport | truncation begins at | longest real | ratio |
|---|---|---|---|
| 1240 | **142 characters** | 58 | 2.4x |
| 1920 | **133 characters** | 58 | 2.3x |
| 3440 | **140 characters** | 58 | 2.4x |

**The business would have to write more than twice as long as they ever have
before the first reason truncates.**

## The outlier degrades gracefully

A 659-character value, the length of the longest prose anywhere in the system,
pasted into the cell: one line of five at rest, four lines on focus, and the
remainder scrollable. Nothing is lost and nothing overflows.

## Looked at, with content at the real distribution

A fixture whose seven reasons carry the real percentile lengths, min 3 through
max 58, in this round's own words rather than the business's strings. At 1920
the panel is 461px, every reason reads whole, and none is near its cell's
capacity.

**One observation from looking, recorded and not acted on.** At real content
lengths the cells carry a lot of unused width: 130 to 330px of content in an
817px field. That is not the empty space the business complained about, which
was 676px of dead panel to the right of everything. This is width inside an
input, and an input's width is an affordance: a narrow reason box says write
less, which is the wrong instruction for the field a bid review reads. No
change proposed.

## The decision

**Nothing to decide. No diff.**

Truncation is not a live condition. It is 2.3x away from anything this business
has written, in a panel where the full text is one click away when it ever is.

**Test Bed pixel-identical is not asserted, because nothing changed.** Running
a comparison across a phase that touched no file is a check that cannot fail,
and reporting it would be the third species of uncalibrated instrument this
round has recorded.

## What would falsify this

**The historical distribution may be an artifact of the panel that produced
it.** Until Phase 2 a reason cost three steps to reach, restated the level as a
side effect, and arrived as an empty box beside the text it was replacing.
Eight-character reasons are what that panel deserved. A panel where the field
is present, prefilled and directly editable may earn longer ones.

The corroboration against that reading is that **Test Bed's scoring panel is a
separate instrument with its own history, untouched by this round, and its
longest justification is also 58 characters.** Two panels, two record types,
many rounds, same ceiling.

**The falsifier is now a number rather than a feeling: 133 characters at 1920.**
If reasons start crossing it once the field is easy to use, this decision
should be revisited, and the threshold is recorded here so the next round
measures rather than re-argues.
