# Opportunity Reference tab: convergence, dates, and the orphaned hover

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 33 merged to `main`
at `bf709a6`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

**The Reference tab has been queued since Round 22 and the business has now
asked for it.** Verbatim: *"Screen needs to be consistent with the Test Beds
layout."*

**It is the screen you land on for every opportunity** and the last major
Opportunity surface that has not had the treatment the Assessment tab, the
stage tabs and the tab-line controls have each had.

**It also carries two live defects the business reported in the same log**, and
four deferred from their very first one.

---

## The four defects deferred to this round in Round 22

Reported after Round 20 and explicitly held for the Reference tab round:

| | |
|---|---|
| **The opportunity name** | Auto-filled from the account, not enterable. Round 21 Phase 8 fixed the Contact route; **confirm whether the UI still fills it** |
| **Field truncation** | The edit field is too narrow and text truncates |
| **Field sizing** | The edit field is a different size to the display text |
| **The cursor shifting the page** | Cursor at the end of a field shifts the page down and loses focus |

**Round 22 recorded why they were held:** truncation and sizing are symptoms of
the layout not having had the Test Bed treatment, so fixing them separately
means fixing them twice.

**Verify each still exists.** Three rounds have rewritten adjacent code since.

---

## The two new defects

### 1. Five hover popups orphaned by a sweep

The business reported *"hover message persists after cursor has moved"* and
*"difficult to repeat"*. **The screenshot shows five open simultaneously**,
which is a stronger signal than the description.

**A specific hypothesis, to verify rather than assume.**

Round 32 Phase 1 measured a **140ms delay** before showing, from the 97ms a
sweeping pointer spends crossing a name, giving zero opens on a passing pointer
and one on a deliberate hover.

**If the hide path does not cancel a pending show**, leaving between 97ms and
140ms fires the hide first and the show second — a popup appearing after the
pointer has gone, with nothing left to trigger a hide.

**And the popup is one per row.** Round 32 Phase 0 recorded that sharing one
element per row makes the name and level popups exclusive **within** a row.
Nothing makes rows exclusive with each other. **So a sweep down five rows
orphans five popups by the same race.**

That explains both the count and "difficult to repeat": a deliberate hover
never enters the window.

**Test it directly.** Enter a name, leave at 120ms, see whether the popup
appears. Then sweep the column and count what remains.

### 2. No date ordering validation

The business: *"Notice dates — allows me to enter go live dates before the
estimated."*

Their screenshot: **Est Close 05/09/2026, Actual Close 26/09/2026, Est Go Live
05/09/2026, Actual Go Live 04/08/2026.** Actual Go Live is a month before Est
Go Live, and Actual Close is after Est Go Live — going live before the deal
closed.

**These are Reference tab fields**, which is why this belongs here.

**Report what Test Bed does.** It carries Estimated Installation Date, Est Go
Live and Test Bed Duration, and whether it validates ordering is unknown. If it
does, this is convergence. If it does not, it is a decision about both record
types.

---

## The convergence, and the field set is already settled

**Confirmed with the business in Round 22 and not revisited:**

| Panel | |
|---|---|
| **Terminus Details** | *"It's the same data required for opportunities."* Test Bed's ten fields |
| **Customer Details** | *"Everything except city and address."* |

**Test Bed's Terminus Details holds ten**: name, reference, Terminus Lead,
Commercial Authority, Technical Authority, Legal Authority, Region, Country,
Industry, Stage.

**Opportunity's holds five**: Terminus Lead, Commercial Authority, Technical
Authority, Legal Authority, Status.

**Three questions the business set aside in Round 22**, to be put to them by
this round rather than assumed:

- Do **Site Ownership** and **Installation Environment** belong on a deal that
  may span several sites?
- Does **Commercial Address for Proposal** stay? It is Opportunity-only and
  Test Bed has no equivalent.
- Does the **reference number** move from the page header into the panel, as
  Test Bed's does?

**And one vocabulary divergence Round 22 measured:** Opportunity says `STATUS`
where Test Bed says `STAGE`, and `CUSTOMER LEAD` where Test Bed says `CLIENT
LEAD`. One vocabulary, two names, and Round 20 already recorded four column
names for the stage in the database.

---

## The fork

**`refFieldRow` and `tbFieldRow` are two implementations of one job**, recorded
in Round 25 Phase 0 and not touched since.

| | |
|---|---|
| `refFieldRow` | 67 lines, textarea support |
| `tbFieldRow` | 101 lines, `formatCost`, `tbEffectiveValue`, heavier date handling |
| `acctFieldRow` | 17 lines |

**Round 25 found the deeper fork is the draft-state model, not the renderer.**
Each carries its own open and discard pair over separate stores, so extracting
the row function alone would leave two edit-state systems underneath it.

**Round 19 found what the fork costs**: `refFieldRow` lacked the leading blank
`<option>` that Test Bed's equivalent had, so an unset staff field silently
pre-selected the alphabetically-first name.

**Report the options and their costs. Do not choose.** Copying the pattern is
faster and leaves the fork; extracting is a refactor of two working screens.

---

## Investigations

### I1. The orphaned hover

**Reproduce it, then diagnose.** Report whether the hide path cancels a pending
show, and whether the 97ms-to-140ms window is the mechanism.

**Report the row-exclusivity question separately.** Even with the race fixed,
nothing hides another row's popup. Whether it should is a decision — Round 32
made them exclusive within a row deliberately, and across rows may be right or
may be unnecessary once orphaning is impossible.

**A test that hovers deliberately cannot see this**, which is why Round 32's
verification passed. **Sweep, do not hover.**

### I2. The dates

Report every date field on the Opportunity Reference tab, what validates them
today, and what Test Bed does with its own.

**Report the orderings that are actually wrong**, not every pair that could be
compared. Est Close before Actual Close is one thing; Actual Go Live before Est
Go Live is another; Go Live before Close is a third and may be legitimate on a
phased deployment.

**This is a business question wearing a validation question.** Report the pairs
and let the business say which are errors.

### I3. The four deferred defects

**Verify each still exists** and report what causes it. Three rounds have
rewritten adjacent code.

**The opportunity name is the one most likely already fixed** — Round 21 Phase
8 changed the Contact route to require a name and the UI to ask for one.
Report what the Reference tab does with it now.

### I4. The panel comparison

Report both Reference tabs side by side: fields, labels, order, the panel grid,
and what each does at 1240, 1920 and 3440.

**Round 31 Phase 1 found Round 21's own comment describing a 2-up grid that is
3 columns at 1920.** Measure rather than reading comments.

**Report the vocabulary divergences** and whether they are display labels over
unchanged stored names, which is what makes them cheap.

### I5. The fork

Read only. Report the options and their costs.

**Report whether the date validation from I2 changes the answer.** If it lands
in one renderer and not the other, the fork acquires a behavioural difference
rather than a structural one.

### I6. What the design cannot express

**Output item 6 has caught the brief's central premise being wrong five times
in thirteen rounds**, most recently a retirement claim that had travelled
through four rounds and into `DESIGN_PRINCIPLES.md`.

**This brief is written from two screenshots and a Round 22 conversation.**

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The orphaned hover |
| 2 | The date ordering, per the business's answer on which pairs are errors |
| 3 | The fork, per the I5 decision |
| 4 | Terminus Details |
| 5 | Customer Details |
| 6 | The four deferred defects, verified gone rather than fixed separately |
| 7 | Full walk and close-out |

**Phase 1 is first because it is live and independent.** Phase 6 is a
verification rather than a fix, on Round 22's reasoning: truncation and sizing
are symptoms of the layout, and if they survive Phases 3 to 5 the treatment was
not properly adopted.

**Argue with it.** If I5 says extraction is a refactor of two working screens,
Phase 3 may become a decision rather than a build, or its own round.

---

## Verification requirements

**Sweep, do not hover.** Round 32's verification hovered deliberately and could
not see this.

**Captures of a hover state need the subject asserted visible and still
rendered after the capture.** Round 31 Phase 3 found the shutter ends the hover
even on a full-viewport capture with no clip, and captured the focus path
instead.

**Test Bed pixel-identical** unless a phase deliberately changes it, on a page
that contains the elements under test. Round 32 Phase 2 found a check running
on a page with none of them.

**Calibrate on the kind of change each phase makes.** Recorded variants: blind
for one phase, half-inert from selector specificity, half-matched from a
structural assumption, wrong kind of change rather than wrong place, the
obvious dimension correctly being the wrong one, an injection landing where the
probe does not scan, and a page with none of the elements under test.

**Verification 18 applies:** one green result may have several independent
causes, each visible only after the previous is fixed.

**No probe prints a conclusion it has not computed.** Four instances in Round
32 alone.

**Capture the whole run, never through a filter.**

**Waits must be counterfactual-safe**, and **drive the real control**. Round 33
Phase 6: *a walk that drives anything other than the control a person uses is
not walking the product.*

**Enumerate teardown from the database by this round's tag**, and check the
extractor reads the field it thinks it reads.

---

## Explicit non-goals

- **Round D.** Creation checks, the per-lens incomplete-approval reason,
  coverage and confidence.
- **The Risk assessment.** Not designed, and a conversation before a build.
- **The assessment panel.** Round 33 closed it.
- The three-string vocabulary reconciliation, `measurabilityConfirmed`, the
  app-wide `<p>` reset and its census, Terminus Documents leading the row, the
  Closed Lost hover wording, reopening a loss, the open-decisions convention,
  the approval snapshot, the eight remaining undocumented mechanisms.

---

## Output format

1. **I1 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 answer, stated plainly**: is the debounce race the mechanism.
3. **The I2 pairs**, for the business to say which are errors.
4. **The three Round 22 questions**, put to the business.
5. **The I5 options**, with costs, not chosen.
6. **The phase plan**, with the argument for any departure.
7. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.
