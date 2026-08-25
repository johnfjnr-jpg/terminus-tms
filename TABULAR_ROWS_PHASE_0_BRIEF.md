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
