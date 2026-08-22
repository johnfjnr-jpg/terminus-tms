# Opportunity stage tabs: Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 20 merged to `main`
at `0768e42`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

Round 20 configured the gates and rendered the exit criteria. The business
then used it and the screen does not work.

**The reported blocker, verbatim:** ticking a criterion resets the screen to
the Reference tab, so every tick requires navigating back.

**The cause is not tab state.** Opportunity's criteria panel sits below the
Reference tab content, so it is *on* the Reference page. Any re-render after
a write returns to where the panel lives. **Moving the panel into a stage
tab removes the defect rather than fixing it.**

Test Bed solves this and has for ten rounds: one sub-tab per stage, each
holding scoring, documents, exit criteria and approvals side by side.
Everything needed to exit the stage is on one screen.

**Confirmed with the business: Test Bed's navigation, editing and validation
is the standard. Opportunity is unfinished work.** Adopt the mechanism.

---

## How this round failed last time, and it is a repeat

Phase 6 of Round 20 verified the criteria panel in the browser with **one
click**: one tick, one ISO timestamp in the database. Every later walk was
driven through the API and measured by status codes. **The browser path of
ticking a second box was never exercised until the business did it.**

That is Round 11A exactly: `recordTbScore` took one score, the driver
recorded one at a time, and scoring five things and pressing Save once was
never tried until the business tried it.

The Round 20 brief quoted that precedent and drew the wrong rule from it. It
said configure three scaffold criteria rather than one. Three were
configured. **The browser still clicked once.** The rule is not about how
many rows exist, it is about how many times a human acts.

**Every browser verification in this round performs the interaction at
least three times, in sequence, without reloading between.** A single
interaction does not test a repeated one.

---

## Confirmed with the business

| | Decision |
|---|---|
| **Tab row** | Reference, Commercials, Qualification, Solution Alignment, Proposal, Evaluation, Negotiating, Closed Won. **Eight tabs, fixed** |
| **Closed Lost** | **No tab.** A lost deal is not a stage you work in. It has no criteria and no approvals, and its tab would be permanently empty. The chevron already shows it |
| **Stage tab panels** | Four, matching Test Bed: Assessments, Documents, Exit Criteria, Approvals |
| **Empty panels** | **Rendered as placeholders**, not omitted. Test Bed does this and the business wants the slots visible for what is coming |
| **Assessments** | **Not built this round.** The panel slot exists as a placeholder. Deal and Risk are a separate conversation |
| **Assessment placement, when built** | On the stage tab, not its own tab and not a sub-tab. One panel holding two sections, Deal and Risk, so the stage tab stays at four panels |
| **Reference tab** | **Not this round.** Its rebuild is the next round |
| **Commercials tab** | Unchanged |
| **Opportunity name** | In scope. See below |

### Why Assessments sits on the stage tab

Recorded because the alternatives were raised and rejected, and will recur.

The stage tab is the "what do I need to do to move on" screen. A separate
tab, or a sub-tab within the stage tab, sends the scorer away from the other
three panels and back. **That is the navigation problem this round exists to
remove, rebuilt deliberately.**

Deal and Risk are two instruments, so five panels would be needed. One
Assessments panel with two sections keeps four and preserves the
side-by-side view. The two instruments are read together anyway, since the
governance case for having two is catching a deal that scores well on one
and badly on the other.

### The opportunity name

Reported: creating an Opportunity from a Contact replicates the account name
and the name cannot be entered.

**Consequence: every Opportunity for one account gets the same name.** A
pipeline list showing four identical rows is unusable, and multiple
opportunities per account is the normal case.

Round 20 Phase 5 established that **both conversion routes already require
`opportunity_name`**. The API takes a name. The UI is filling it in rather
than asking. This is a UI change.

**In scope because it is hit on every creation and is unrelated to the
Reference tab layout**, which is the next round.

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **From disk.** It changed twice in Round 20 |
| `OPPORTUNITY_DESIGN.md` | Authority. Seven open decisions |
| `PROTOTYPE_SPECIFICATION.md` | Sections 3 and 5 |
| `INTERACTION_STANDARDS.md` | What correct interaction behaviour means. Load-bearing this round |
| `DESIGN_PRINCIPLES.md` | Test Bed's stage screen and sub-tab decisions |
| `CURRENT_STATE.md` | Generated. Run its staleness test |
| Round 20 close-out | Including the `renderTransitionSection` finding |

---

## Investigations

### I1. Test Bed's stage sub-tab mechanism

**The question.** How does Test Bed render one sub-tab per stage, and how
record-type agnostic is it?

Report the file and function, how the tab list is derived from
`stage_definitions`, how the active tab is held, and what happens to that
state after a write. **The last part is the defect's answer.**

Report whether the component is genuinely reusable or Test Bed specific.
Adopting a reusable component is a different phase from extracting one.

### I2. The re-render, measured

**The question.** What exactly happens after a criterion tick on
Opportunity today?

**Measure it, do not reason about it.** Tick a criterion in the browser and
report what re-renders, what scroll position results, and what the user then
sees. The brief's explanation, that the panel lives on the Reference page,
is a hypothesis. Confirm or refute it.

**Then tick three in a row** and report what the third one costs in clicks
and navigation. That is the reported experience and nobody has reproduced it.

### I3. Test Bed's four stage panels

**The question.** How are Scoring, Documents, Exit Criteria and Approvals
laid out on one stage tab, and what does each do when empty?

Report the placeholder wording, since the business wants placeholders and
they should read the same as Test Bed's.

**Report how approvals render**, including approver and date, which
Opportunity does not surface at all today.

### I4. The Closed tab

**The question.** How does Test Bed's `• CLOSED` tab behave? What is the
dot, and what does the tab hold?

Opportunity's Closed Won tab has one criterion and three approvals, so it is
not empty. Report whether the Test Bed pattern carries.

### I5. Where a deal is lost

**The question, and it is a design gap rather than a code question.**

Closed Lost is reachable from any stage and has no tab. **So what does the
user click to lose a deal?**

Test Bed has a `FINAL STAGE` button at the right of the tab row. Report what
it does and whether an equivalent exists for Opportunity.

Report the options. **Do not choose one.** This comes back for a decision.

### I6. The opportunity name in the creation flow

**The question.** Where does the name get set on each of the three creation
paths: direct creation, from Contact, and from Test Bed?

Report which fill it automatically, which prompt, and what each sends as
`opportunity_name`. Round 20 Phase 5 confirmed both conversion routes
require the field, so report what the UI currently supplies.

### I7. The field-rendering fork

**Not for this round. Report for the next one.**

`refFieldRow` in `opportunity-reference.js` and Test Bed's equivalent are two
implementations of one job. Round 20 confirmed both build staff dropdowns
separately, and the `refFieldRow` blank-option bug existed because a fix to
one never reached the other.

**Report how far apart they are**, so the next round can choose between
copying the pattern and extracting a shared component. Copying is faster and
leaves the fork. Extraction fixes it and may be a refactor of a working
screen.

Read only. Change nothing.

---

## The plan to produce

Small phases, each with its own verification, each committing. Suggested
shape, to be argued with:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The sub-tab mechanism: adopt or extract, per I1 |
| 2 | Stage tabs rendered, eight, driven from `stage_definitions` |
| 3 | Exit criteria panel moved into the stage tab. **The blocking defect** |
| 4 | Approvals panel, with approver and date |
| 5 | Documents and Assessments placeholder panels |
| 6 | Where a deal is lost, per the I5 decision |
| 7 | Opportunity name in the creation flow |
| 8 | Browser verification, repeated interactions throughout |

**Argue with it.** In particular, if I1 shows the component is genuinely
reusable, Phases 1 and 2 merge. If it needs extracting, Phase 1 grows and
may deserve its own round.

---

## Verification requirements specific to this round

**Every browser check performs its interaction at least three times in
sequence, without reloading between.** This is the round's central lesson and
it is not optional.

**The screenshot preconditions from Round 20 Phase 7 apply**, with the fix:
non-zero size *before* containment, measured on the element itself, not a
wrapper. A guard that a zero-height element satisfies is theatre.

**A tick is verified in the database, not the DOM.** Round 20 Phase 6 did
this correctly and it should carry.

**Then look at it.** Presence is not legibility, and no assertion in Round 20
would have caught a chevron reading `CLOSED LOST · QUALIFICATION`.

---

## Explicit non-goals

- The Reference tab rebuild. Next round.
- Field truncation, field sizing, and the cursor-shifts-the-page defect. All
  on the Reference tab. **They are symptoms of that layout not having had
  the Test Bed treatment, and fixing them separately means fixing them
  twice.**
- The Commercials tab.
- Deal and Risk criteria or anchors.
- Extracting the `refFieldRow` fork. Investigate only.
- Reason codes, `routing_rules`, the four dates, the revision event.
- The `23503` raw foreign-key 500.
- Ownership widening.

---

## Output format

1. **I1 through I7**, each with the command run or the interaction
   performed, the actual output, and the finding.
2. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.
3. **The phase plan**, with the argument for any departure.
4. **The I5 options**, presented for a decision and not chosen.
5. **Anything in the confirmed decisions that cannot be built as stated.**
   These were settled from two screenshots without repository access. If one
   collides with how the screen actually works, say so now.

Then stop and wait for sign-off.
