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

---

# Phase 0 report

Round 34, 2026-08-26. Branch `round-34-reference-tab`, cut from `main` at
`9c92e4d` after the brief was committed. Server restarted from that tree, token
refreshed. No file edits, no migrations, no configuration changes.

---

## I1. The orphaned hover

### The brief's hypothesis is not the mechanism

**The hide path already cancels a pending show.** `clearTimeout(oppQuestionTimer)`
is the first statement in `hideOppAssessDefn`, added by Round 32 Phase 1 with a
comment saying exactly why.

Measured on the eight-row Organisational lens:

| | popups left open |
|---|---|
| Sweep down the name column, 681ms | **0** |
| Sweep down the level column, 816ms | **0** |
| Enter a name and leave after 60 / 110 / 130 / 200 / 400ms | **0 at every dwell** |

The 97-to-140ms window does not exist, because the leave cancels the timer.

### The mechanism is an early `return` in the hide loop

```
for (const box of document.querySelectorAll('.opp-assess-defn')) {
  const focused = box.parentElement?.querySelector('...:focus')
  if (focused) { showOppLevelDefinition(focused); return }   // <- abandons the loop
  box.classList.add('hidden')
}
```

**`return` exits the function, not the iteration.** Every box after the focused
row in document order is never hidden. Round 32 Phase 1 wrote the fallback so a
focused segment outlives a hovered one, which is right, and used the wrong
keyword to do it.

Measured, with one segment focused and the identical sweep run twice:

| | popups left open |
|---|---|
| As shipped, early `return` | **6** |
| The same sweep with `continue` | **1** |

**The 1 is the focused row's own popup**, which the fallback re-shows on
purpose. **The other five are orphans, and five is what the business
photographed.**

### Why it is "difficult to repeat", and why Round 32 could not see it

It needs a **focused segment**, which a person acquires by clicking a level and
then moving on. A deliberate hover test starts with nothing focused, so the
fallback never fires and the loop always completes. **Round 32's verification
was correct and could not have found this.**

### The row-exclusivity question, separately

**Nothing makes rows exclusive with each other**, and with the `return` fixed
nothing needs to: every hide sweeps every box. Whether a second row's popup
should be able to open at all is a separate decision, and after this fix it can
only happen through the focus fallback, which is deliberate.

### One thing the brief places wrongly

**These popups are not on the Reference tab.** Only two hover handlers exist in
the codebase, `showOppCriterionQuestion` and `showOppLevelDefinition`, both on
`.opp-assess-*` elements, which is the Assessment tab. The Reference tab has no
hover popup of any kind. The defect is real and worth fixing first, and it is
not a Reference tab defect.

---

## I2. The dates

### What exists, and what validates it

| Field | Key | Route | Validation |
|---|---|---|---|
| Est. Close Date | `estClose` | `POST /close-date-move`, reason mandatory | valid ISO, **not past** |
| Actual Close Date | `actualClose` | generic `PATCH` | valid ISO |
| Est. Go Live | `estGoLive` | generic `PATCH` | valid ISO, **not past** |
| Actual Go Live | `actualGoLive` | generic `PATCH` | valid ISO |
| Contract Duration | `duration` | generic `PATCH` | non-negative integer |

**No ordering validation exists between any pair.** Each field is validated
alone.

### Test Bed does validate an ordering, so this is convergence

`src/routes/test-beds.js:865`: **"Est. Go Live cannot be before Estimated
Installation Date"**. Its comment records three properties worth carrying over:

- It runs **only when one of the two dates is in the payload**, so a save
  touching neither is never checked.
- It reads the **merged** values, because the violation is reachable from both
  ends and checking only the submitted key would miss it.
- A record already violating **stays saveable for anything else**, and any edit
  touching a date must leave the pair valid.
- **The message names the labels a user sees**, not payload keys, and its
  comment notes that seven other messages across both route files still name
  keys, recorded rather than fixed in passing.

### The pairs, for the business to say which are errors

From their screenshot: Est Close 05/09/2026, Actual Close 26/09/2026, Est Go
Live 05/09/2026, Actual Go Live 04/08/2026.

| Pair | Their values | Is it an error? |
|---|---|---|
| Actual Close after Est Close | 26/09 after 05/09 | **Almost certainly not.** A deal slipping three weeks is the ordinary case |
| Actual Go Live **before** Est Go Live | 04/08 before 05/09 | **Ambiguous.** Going live a month early is unusual but possible |
| Actual Go Live **before** Actual Close | 04/08 before 26/09 | **This is the one they flagged.** Live seven weeks before the deal closed |
| Est Go Live same day as Est Close | both 05/09 | Possible, and a same-day go-live is a real thing on a small deployment |

**Only the third is unambiguously wrong**, and even it has a reading: a phased
deployment can go live on an earlier site before the contract completes. **This
is a business question and the answer decides how many rules Phase 2 builds.**

---

## I3. The four deferred defects

### 1. The opportunity name: FIXED, and by a different round than the brief expects

The brief attributes the likely fix to Round 21 Phase 8. It was **Round 3 Phase
3**, which added `name` to the writable keys and rendered it as a click-to-edit
header. Verified live: `ref-display-name` exists, it is a click-to-edit field,
and it carries the record's own name.

### 2. Field truncation: REAL, and it is the edit control, not the display

**The display does not truncate, it wraps.** Given a 67-character address, the
216px display box grows from 24px to 63px high, `white-space: normal`,
`text-overflow: clip`, nothing lost.

**The edit input is 191px wide, about 27 characters.** The same 67-character
value scrolls inside it, so two thirds of what you are editing is off-screen.
That is the defect as reported, and it lives in the input.

### 3. Field sizing: REAL, measured

| | width | height |
|---|---|---|
| `.ref-field-display` | 216px | 24px |
| `.ref-field-edit` input | 191px | 35px |
| **delta** | **-25px** | **+11px** |

Identical at 1240, 1920 and 3440. The edit control is narrower and taller than
the text it replaces, on every field.

### 4. The cursor shifting the page: REAL, and it is 76px

Opening any field un-hides `#ref-edit-bar`, which is an **in-flow element above
the cards** with 10px padding, a border and a 20px bottom margin. Measured, the
first field opened moves the row under the pointer by **76px**, or scrolls the
container by 76px where the row is lower in the view:

| Field | scroller moved | row moved |
|---|---|---|
| `customerLead` | 0px | **76px** |
| `commAddress` | 0px | **76px** |
| `duration` | **76px** | 0px |
| `summary` | **76px** | 0px |

**Focus survived programmatically in every case**, so "loses focus" is most
likely the target moving out from under a second click rather than focus being
dropped. **Same class as the defect Round 30 refused for the assessment popup:
content moving under the pointer that asked for it.**

---

## I4. The panel comparison, at 1920

| | Test Bed | Opportunity |
|---|---|---|
| Visible `.ref-field` rows | 22 | 21 |
| Cards | 4 | 3 |
| **Terminus Details** | Test Bed Name, Terminus Reference, Terminus Lead, Comm. Auth, Tech. Auth, Legal Auth, Region, Country, Industry, Stage (**10**) | Terminus Lead, Commercial Authority, Technical Authority, Legal Authority, Status (**5**) |
| **Customer Details** | Account, Client Lead, Site Ownership, Inst. Env., Site Address, City (**6**) | Account, Customer Lead, Commercial Address for Proposal, and the four buyer roles (**7**) |
| **Key Dates** | Date Created, Age, Estimated Installation Date, Est. Go Live, Test Bed Duration (**5**) | Date Created, Est. Close Date, Est. Close Date Moves, Actual Close Date, Est. Go Live, Actual Go Live, Contract Duration (**7**) |

**The brief's ten-against-five is exact.**

### The grid, measured rather than read from a comment

**Two columns at 1240, three at 1920 and 3440.** Cards are 420px wide at every
width and do not grow. That matches what Round 31 Phase 1 measured and confirms
Round 21's own comment, which describes a 2-up grid at both 1240 and 1920, is
still wrong.

### The vocabulary divergences, and there are three not two

| Test Bed | Opportunity |
|---|---|
| `Stage` | `Status` |
| `Client Lead` | `Customer Lead` |
| **`Comm. Auth` / `Tech. Auth` / `Legal Auth` / `Inst. Env.`** | **`Commercial Authority` / `Technical Authority` / `Legal Authority`, spelled out** |

**The third is not in the brief.** Test Bed abbreviates its authority labels and
Opportunity spells them out, so converging the field set means choosing one
convention for labels that already exist on both sides.

**All three are display labels over unchanged stored keys**, which is what makes
them cheap: `refFieldLabel` and the `TERMINUS_FIELDS` table hold them, and no
payload key or endpoint moves.

---

## I5. The fork, read only

**The brief's figures are exact**, measured:

| | file | lines |
|---|---|---|
| `refFieldRow` | `frontend/opportunity-reference.js` | 106..172, **67** |
| `tbFieldRow` | `frontend/test-bed-detail.js` | 282..382, **101** |
| `acctFieldRow` | `frontend/account-detail.js` | 42..58, **17** |

**They already share the CSS.** Both emit `.ref-field`, `.ref-field-label`,
`.ref-field-display`, `.ref-field-edit` and `.ref-field-discard`; only the id
prefix and the handler names differ. **The fork is in the JavaScript, not the
styling**, which the brief does not say and which changes what extraction costs.

**Round 25's deeper finding holds**: three separate draft stores with their own
open and discard pairs, `refEdits` (14 references), `tbEdits` (33),
`acctEdits` (11).

### The options and their costs, not chosen

| | Cost | What it leaves |
|---|---|---|
| **Copy the pattern** | Smallest. Phases 4 and 5 add rows to `TERMINUS_FIELDS` and `CUSTOMER_FIELDS` and reuse `refFieldRow` unchanged | Two renderers, three draft stores, and the next Round 19 bug still possible |
| **Extract the renderer only** | Medium. One `fieldRow` taking the id prefix and handler names as arguments | The three draft stores, which is where Round 25 said the real fork is. The renderer stops drifting; the edit behaviour does not |
| **Extract renderer and draft state** | Largest. One store, one open/discard pair, one save bar, across two working screens and a third that shares the CSS | Nothing forked, and a refactor touching Test Bed, which every phase of the last nine rounds has held pixel-identical |

### Does I2 change the answer?

**Yes, and this is the part to weigh.** Test Bed already has an ordering rule
and Opportunity has none. If Phase 2 adds Opportunity's rules to
`opportunities.js` alone, **the fork acquires a behavioural difference on top of
a structural one**: two record types validating dates by different rules in
different files. The ordering rules are server-side, so they do not touch
`refFieldRow` at all, but they do make "one job, two implementations" true of
the API as well as the renderer.

---

## The three Round 22 questions, for the business

1. **Do Site Ownership and Installation Environment belong on an Opportunity?**
   Test Bed carries both and a Test Bed is one site. An Opportunity may span
   several, and a single value would be answering for all of them.
2. **Does Commercial Address for Proposal stay?** It is Opportunity-only, Test
   Bed has no equivalent, and it is the one Customer Details field convergence
   would otherwise delete.
3. **Does the reference number move from the page header into the panel?** Test
   Bed's sits in Terminus Details as a row. Opportunity's is in the header.

---

## I6. What the design cannot express

1. **The hover defect is not a Reference tab defect.** It is on the Assessment
   tab, and the round is otherwise about a different screen. Phase 1 is right
   to be first and independent, and the round's title does not cover it.
2. **The brief's I5 premise understates what is shared.** Both renderers already
   emit the same classes, so "two implementations of one job" is true of the
   JavaScript and false of the styling.
3. **Test Bed's own Reference tab is in the same document as Opportunity's.**
   The Opportunity page holds **61 `.ref-field` rows of which 21 are visible**;
   the other 40 are Test Bed's, hidden. Any measurement of either screen must
   filter on visibility, and two of my own measurements did not.
4. **The `summary` key appears three times** in `.ref-field` rows on the
   Opportunity page. Two are hidden. Worth a look before Phase 5 touches
   Customer Details.
5. **The output numbering is off by one**, as in the last two briefs: I6 says
   "output item 6" where the list makes item 6 the phase plan and item 7 the
   premise check.

---

## My own probe faults, recorded

1. **A calibrated search in the wrong file.** I searched `frontend/app.js` for
   `refFieldRow`, calibrated it against a function I knew was there, and
   reported the fork's renderers absent. They are in
   `frontend/opportunity-reference.js`, a file I had not opened. **The
   calibration proved the search ran in that file; it did not prove that file
   was the right place to look.** Verification 12 says to confirm a search can
   find something known present, and this one did. It is not sufficient.
2. **A selector for a class that does not exist.** The Test Bed comparison
   queried `.tb-field`; Test Bed uses `.ref-field`, the same class Opportunity
   does. It timed out rather than reporting nothing, which is the good failure.
3. **Two measurements taken on hidden elements**, because `.ref-field` matches
   both views. The `summary` row reported 0x0 and its truncation reading was
   meaningless.

---

## The phase plan

The brief's shape survives, with **one reordering and one split**.

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The orphaned hover: `return` to `continue`, and the row-exclusivity decision |
| 2 | The date ordering, per the business's answer on which pairs are errors |
| 3 | The four deferred defects, **moved forward** |
| 4 | Terminus Details |
| 5 | Customer Details |
| 6 | Full walk and close-out |

**Phase 3 moves from last to third, and the brief's own reasoning is why it
should.** Round 22 held truncation and sizing because they are symptoms of a
layout that had not had the treatment. **Measured, they are not.** The edit
input is 25px narrower than the display on every field, and the edit bar shifts
the page 76px, and neither is caused by the card grid or the field set. They
are properties of `refFieldRow` and `#ref-edit-bar`, which Phases 4 and 5 will
call and re-call. **Fixing them after adding fifteen more fields means fixing
them across fifteen more rows.**

**The brief's Phase 6 becomes unnecessary as a verification**, because Phase 3
fixes rather than checks. If the treatment is adopted properly in Phases 4 and
5, nothing regresses; the walk will say so.

**The fork phase is dropped as a build.** I5 shows the renderer is 67 lines
already sharing its CSS, and the real fork is three draft stores. **Extraction
is a refactor of two working screens and one shared stylesheet, and it belongs
in its own round rather than inside one that is adding fields to one of them.**
Recorded as a decision for the business, not deferred silently.

---

## Anything that cannot be built as stated

1. **The hover defect is on the Assessment tab.** Buildable and first, but the
   round's framing places it wrongly and the phase list should say so.
2. **The date ordering cannot be built until the business answers I2.** Three of
   the four pairs have a legitimate reading, and building all four rules would
   refuse saves the business intends.
3. **Convergence deletes a field unless question 2 is answered.** Commercial
   Address for Proposal has no Test Bed equivalent.
4. **The vocabulary has three divergences, not two**, and converging labels
   means choosing between spelled-out and abbreviated on fields that already
   exist on both screens.
5. **Phase 3 as written verifies four defects that are already confirmed
   present.** Two of them are in code Phases 4 and 5 will call repeatedly, which
   is the argument for moving it forward rather than a reason not to do it.

---

# Round 34 close-out

Branch `round-34-reference-tab`, cut from `main` at `9c92e4d`. Seven phases,
each signed off in conversation before the next began.

| Phase | Content | Commit |
|---|---|---|
| 0 | Investigation | `0c17109` |
| 1 | The orphaned hover | `991ddcf` |
| 2 | The date ordering | `7b65c70` |
| 3 | The four deferred defects | `c4f3be8` |
| 4 | Terminus Details | `62e7ee2` |
| 5 | Customer Details and the proposal address | `9a3b3d6` |
| 6 | The walk and this close-out | this commit |

**Rule 7's instrument returned 1 against this brief**, the reading the rule
names as dangerous, and the fifth round running. Counted from the sign-offs:
seven phases, every one with exactly one commit.

## The walk

One record, Qualification to Solution Alignment, one session. **9 of 9.**

- **The tab row with four controls and a dirty field.** At 1920, the width
  Phase 3 identified as the band where the strip flips lines: two lines at rest
  and two with Cancel, Save changes, Next Stage and Mark Closed Lost all
  present, and the cards moved **0px**.
- **Both date rules from a legal starting point.** Actual Close saved, Actual Go
  Live before it refused with the right message, Actual Go Live after it saved.
- **The tick in both states in one session**, through the journey the business
  chose: ticked against an empty account, followed the link, filled the account
  on the account, returned, and the address showed through the flag.
- **The hover with a segment focused and swept**: exactly one popup open, and it
  is the focused row's own, asserted by key.
- **Advancing from the tab line.**

## The species this round found

**A calibrated search in the wrong file still reads absent.** Phase 0 searched
`frontend/app.js` for `refFieldRow`, calibrated the search against a function
known to be there, and reported the fork's renderers missing. They are in
`frontend/opportunity-reference.js`, a file that had not been opened.

**Every prior instrument fault in this project was an instrument that could not
discriminate. This one discriminated perfectly, in the wrong place, and the
calibration made the wrong answer look verified.** Verification 12 says confirm
the search can find something known present; it did, and that is not sufficient,
because it only proves the search ran where it was pointed.

**A promotion candidate if a second instance appears.** Recorded here rather
than in `CLAUDE.md` on one instance.

## The other instrument faults, and there were many

1. **`offsetParent` does not detect `visibility: hidden`** (Phase 3), in the
   phase whose fix is `visibility: hidden`. The check would have reported the
   reserved buttons visible at every point and passed on a claim it never
   measured.
2. **A paged scan reporting zero violators over a fourteenth of the
   population** (Phase 2). `record_revisions` fetched with no `Range` header
   returned 1000 of 14748 rows, and clean is what a pass looks like. Re-scanned
   paged: one live record violates.
3. **A node reference held across a re-render** (Phase 3), which made a working
   save look like a display that never refreshed.
4. **A save test writing a fixed value** (Phase 3), so a second run left nothing
   dirty and saved nothing.
5. **A wait on save feedback the success path never writes** (Phase 6).
   `performGenericRefSave` writes to `ref-save-feedback` only on failure; on
   success it re-renders. Success is the controls going away.
6. **A mark placed on the container whose `innerHTML` is replaced** (Phase 6).
   `innerHTML` destroys the children and preserves the element and its
   attributes, so the mark survived the very re-render it was meant to detect
   and reported "did not re-render" while the panel plainly had. Moved to a
   child.
7. **State carried between widths** (Phase 5), so "unticked" was not unticked.
8. **Setting a flag by API behind an open page** (Phase 5). A mark proved this
   was not a wait problem: navigating to the same record id does not re-render
   the tab, which is a property of the app rather than a defect, and not
   something a user can do.

**Phase 5 took three attempts and the third was the honest one.** The first two
would each have produced a plausible wrong diagnosis.

## The region list, which diverged on the first attempt

Phase 4 wrote the region option list from memory and it was wrong **in two ways
at once**: "Asia Pacific" for APAC, and a different order.

Four identical copies already exist, in `test-bed-detail.js`,
`account-detail.js`, `contact-detail.js` and `app.js`. **The duplication is not
what kept them consistent; nobody having written a fifth from memory was.**
There is no server-side validation of region on either record type, so the wrong
value would have saved and an Opportunity would have carried a region string no
Test Bed could match.

Copied verbatim now, and the duplication is five. **This is the strongest
argument the fork decision will get, and it was produced by accident.**

## What the round fixed

**The orphaned popups were a `return` where a `continue` was meant.** The
brief's hypothesis was wrong in every particular: the hide path already cancels
a pending show, the 97-to-140ms window does not exist, and the popups are on the
Assessment tab rather than the Reference tab. `hideOppAssessDefn` abandons its
loop on the first row carrying a focused segment, so every popup after it is
never hidden. Six with `return`, one with `continue`, on the identical sweep.
**It needs a focused segment, which a deliberate hover test never has**, which
is why Round 32's verification was correct and could not have found it.

**Two date rules for one constraint**, mirroring Round 15 Phase 1's shape on
Test Bed and spanning two endpoints, because Est. Close Date is
`forecast_close_date` rather than a payload key. One live record violates,
`TT-SGP-MANUFI-002`, and nothing about it changed.

**The 76px page shift**, which Test Bed had solved twice with a comment saying
the fix was held back from Opportunity "unless a future round asks for it there
too". **A deferred decision recorded in the right place and picked up
correctly**, which is unusual in this project. Both halves adopted: the banner
is gone and the gate is dirty. Moving the controls introduced a 37px shift in
the 1556-to-2036 band, fixed by reserving their space, with the cost stated
rather than absorbed.

**Terminus Details converged** on Test Bed's shape, with Region and Country
added to the allowlist they had never been in, and three display-only renames
whose stored keys are unchanged.

**The proposal address became six fields and a relationship.** A flag rather
than copied values, because a copy diverges silently the day the account moves;
Shipping rather than Billing; and the empty-account case says so with a link
rather than rendering six blanks.

## Recorded, not scoped

- **Industry is absent from every Opportunity.** The column exists on every
  record, nothing in `opportunities.js` reads or writes it, the endpoint returns
  no industry object, and zero of four live opportunities carry a value against
  five of five test beds. A row would read `--` forever. **Where it should come
  from is a business question.**
- **Opportunity to Test Bed conversion with a shared reference.**
  `conversion_criteria` carries test_bed to opportunity only, at
  `max_conversions` 1, which is the opposite direction, and no mechanism exists
  for sharing one reference across two records. **It matters because a pilot is
  how most of these deals will start.**
- **The six-field proposal address is a deliberate exception** to this round's
  converge-on-Test-Bed principle, recorded in both the route and the panel so a
  later reader repairing "drift" finds the reason first.
- **The first checkbox in the application** sets a convention rather than
  following one. Unstyled it rendered in the browser's default blue, the only
  blue on a screen whose affirmative colour is green. **Found by looking;
  nothing measures a colour nobody declared.**
- **The truncation diagnosis, which turns a complaint into a fix.** Three rounds
  treated it as a width problem. **The display already wraps and the input does
  not**, so making the input match the display is the fix rather than widening
  it. Widening by the available 25px would have addressed a quarter of the
  symptom and none of the cause. Unticked, the proposal address is six 191px
  inputs at about 27 characters each, which is six times the exposure rather
  than one.
- **The fork is not extracted**, and Phase 0 recorded the options with costs.
  `refFieldRow` is 67 lines, `tbFieldRow` 101, `acctFieldRow` 17, and they
  already share every CSS class; the real fork is three draft stores. That is a
  refactor of two working screens and belongs in its own round.
- **61 `.ref-field` rows of which 21 are visible**, the rest Test Bed's in the
  same document. Every measurement this round filtered on visibility, and two
  in Phase 0 did not before that was known.

## `CURRENT_STATE.md`

**Regenerated, staleness test run rather than assumed.** The recorded SHA
`ec2b67e` is an ancestor of `HEAD` and `src/routes/opportunities.js` changed
since it, so the file was stale by the second half of the test.

**The diff reconciles exactly.** 30 changed lines: the writable-key list goes
from **55 to 63 literal keys**, which is `region` and `country` from Phase 4 and
the six proposal-address keys from Phase 5, and the rest is append-only history
from fixture work. **Live records read 94 before and 94 after**, with every
per-type live count identical.

## Residue

Eighteen live records carried this round's tag and all eighteen are soft
deleted, re-queried directly: 0 live, 18 soft deleted, no
`reference_number_counters` row touched. The broader sweep reads four live
opportunities and none fixture-looking, with the extractor calibrated on the
real rows.

## Still open

- **Truncation and sizing**, now with a diagnosis and no fix. The input should
  grow the way the display wraps.
- **Industry**, and where an Opportunity's should come from.
- **The renderer and draft-store fork**, with the region list as new evidence.
- **Round D**: creation checks, the per-lens incomplete-approval reason,
  coverage and confidence.
- **Opportunity to Test Bed conversion**, a design conversation before a build.
