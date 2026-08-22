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

---

## Round 21 outcome

Ten phases, 0 through 9. The screen the business reported as unusable is
usable, and the round found five defects nobody had reported.

### Rule 7 returned zero for the third consecutive round

`grep -n "^## Phase\|^### Phase"` returns **0** against this brief, with the
`###` half included. The same pattern returns 5 against
`ROUND18A_FIX_BRIEF.md`, so the zero is a real absence.

**Three consecutive rounds have now written their phase list as a table.**
Rounds 19 and 20 each recorded this as a finding about the rule. It is no
longer an accident of one brief: it is how briefs are written here, and the
rule counts headings. The two candidate resolutions are unchanged, require
phase headings or widen rule 7, and this is the third data point.

Counted from the table, phases 0 through 9, each signed off in the session
transcript. This report does not sign off its own phase.

### What the round did

The blocking defect had **two independent causes**, and fixing the first left
the symptom in place. The tick handler reloaded the whole page; and
`renderOppDetail` ended with an unconditional default-to-Reference that landed
after an awaited load, silently overwriting a tab click. The second is the
Round 5 Phase 7 Test Bed race, never ported.

Opportunity then got Test Bed's stage screen: eight tabs generated from
`stage_definitions`, four panels per working stage, a terminal panel, the
Closed Lost reason list, the control to lose a deal, and a name on creation.

### The finding with the longest reach, now six instances

**A fix built for the screen that existed is not a fix for the screen built
beside it.** Test Bed was built first and Opportunity beside it, so every Test
Bed fix is a fix Opportunity does not have. Six instances now, five of them
found in the last three rounds:

1. `refFieldRow`'s missing blank option, Round 19.
2. `renderTransitionSection` duplicating server-owned next-stage logic that
   the Round 20 server fix could not reach, Round 20 Phase 6.
3. `tbUserPickedTab` with no Opportunity equivalent, Round 21 Phase 1.
4. **`submitStageApproval` refreshing nothing for Opportunity**, Round 21
   Phase 4.
5. Two shared loaders defaulting to a container Phase 5 deleted, Round 21
   Phase 5.
6. Element ids built from a stage name and containing spaces, Round 21
   Phase 7. `getElementById` resolves, every CSS selector matches nothing,
   and neither errors.

**The fourth is different from all the others and it is the one that matters.**
Instances 1, 2, 3, 5 and 6 were LATENT: wrong code waiting for a use that had
not arrived. **`submitStageApproval` has been live in production since Round
9.** Anyone approving a track from Opportunity's Stage and Approvals tab
watched the screen do nothing, and the only reason it was never reported is
that Opportunity's approvals were barely used before Round 20 configured them.

The other five were found by working nearby. That one would have been found by
the business. **A deliberate audit belongs in Round 22**, which is already
about convergence: enumerate every Test Bed behaviour Opportunity's equivalent
should have, rather than waiting for the next one to surface.

### The Exit Criteria and Approvals panels repeat each other

A stage tab shows both cards side by side. The Approvals card lists Commercial,
Technical and Legal with their dates. The Exit Criteria card lists the same
three as computed rows reading "Requires an approved Commercial decision at
stage Solution Alignment". Three facts, stated twice, a hand apart.

**Established on both record types, not introduced here.**
`renderTbStageExitCriteria`'s `isProcessRequirement` returns true for
`approval_obtained`, so Test Bed has done this since Round 9 Phase 6.2. Two
defensible readings, recorded in `DESIGN_PRINCIPLES.md`, and choosing changes
both record types.

### Test Bed's tab strip is static markup

Test Bed's eight stage tabs are hardcoded `<button>` elements in
`index.html`. They match `stage_definitions` today **by hand**, and nothing
keeps them in step. Opportunity's are generated, which is why Round 20's
renaming of every Opportunity stage cost nothing here.

**If Test Bed's stages are ever renamed, its tab strip breaks the same way**
Opportunity's would have. Not this round's work, and worth knowing before
anyone renames one.

### The tab row has no room left

The eight-tab strip measures **876px in 876px at 1240**. Zero margin. It fits
and one longer stage name, or one more tab, overflows it: the transitional
ten-tab row measured 971px in 876px and cut "Closed Won" to "CL W".

**This already settled one decision**: the lose-a-deal control went beside the
advance control rather than into the tab row, by measurement rather than
preference. It constrains anything added there later.

### Recorded and not fixed

- **`test-bed-name-suggestion` called from the Opportunity dialogue.** The
  parameterised name dialogue fetches its suggestion from
  `GET /contacts/:id/test-bed-name-suggestion` for both record types. It
  returns the Account name, so it is functionally right and semantically
  odd. Renaming a live endpoint mid-round to fix a name was not worth the
  risk. Round 22.
- **`approver_id` resolves to nobody, on either record type.** The API
  returns a uuid and no screen turns it into a person, so an approval shows
  its track and its date and not who gave it. Test Bed does not show it
  either, so there was no pattern to adopt. The Round 19 staff-field finding
  is the precedent for how it should be done when it is.
- **`CURRENT_STATE.md` does not dump the new reason table's rows.** The
  generator writes a fixed list of tables, so `closed_lost_reasons` appears
  only in the migration list. Pre-existing rather than new: `terminus_staff`
  has been in the same position since Round 19. A file whose stated job is
  recording what is configured has a blind spot for configuration added
  after it was written.

### A recommendation about how probes are written

**Twice this round a throwing probe outran its own teardown**, and the
standing residue check caught the orphan rather than the test that made it.
Both times the record was created ad hoc, its id held in a local array, and
an exception between creation and the `finally` left it live.

**Recommendation, not a rule**: create fixtures through `verify-harness.mjs`
rather than ad hoc. Its `Fixtures` class registers a record at creation and
tears down by re-querying, so a throw between the two costs nothing. This
constrains how probes are written, not what they must prove, which is why it
is a recommendation.

### Open decisions in `OPPORTUNITY_DESIGN.md`: seven

Asserted row by row rather than by count:

1. Revision event: series plus approval plus re-score as one thing
2. Deal Sheet freeze point after the stage compression
3. Staff fields have no server-side validation
4. `Account` is a third staff-field surface
5. Base Cost Data catalog
6. One stage vocabulary under four column names, joined by nothing
7. `approvals.comment` unused on all 229 rows, `tier` null on all 229

Seven at Round 20's close and seven now: the unstated-approvals item closed
in Round 20, and nothing opened in Round 21. No bolded row claims to be
confirmed. **Whether a loss can be reopened remains undecided**, which is why
the lose-a-deal dialogue says the action cannot be undone.

### Reconciliation

`CURRENT_STATE.md` regenerated at `61ee2fd`. Five tracked configuration
sources changed. Every line is accounted for:

- **Routes 57 to 59**: `GET /api/closed-lost-reasons` and
  `POST /api/opportunities/:id/close-lost`.
- **Migrations 62 to 64**: the reason list and what a lost deal records.
- **Live records 93 to 94**: one Opportunity the business created at 10:45,
  now in Solution Alignment. It is the first record to move through the
  stage model this round configured.
- **Soft-deleted rows up by 655 and harness types by 45**: suite runs and
  phase fixtures, all torn down, none live.
- **Opportunity records by status** now include Closed Won and Closed Lost
  rows, which is the walk and the loss fixtures.
