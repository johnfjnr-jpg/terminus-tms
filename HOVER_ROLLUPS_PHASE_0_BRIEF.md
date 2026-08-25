# Criterion hover and lens rollups

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 31 merged to `main`
at `9510199`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

Two things, both raised by the business after using the Round 31 panel.

**1. The criterion's question is not findable.** Verbatim: *"For Budget
confirmed, where is 'Is money identified and committed' seen? Is it a hover
over the Budget confirmed field? It's not showing at the moment except in the
history pull down."*

**2. Four lens rollups on the exit criteria panel**, so a stage tells you at a
glance which lenses are complete.

**Round C waits behind this round**, on the business's own decision. The
rollups are what make twenty-three criteria manageable, so configuring them
first would mean meeting twenty-three criteria in a panel not yet made
legible. That is the same ordering that held Round C behind four rounds of
panel work, and it was right each time.

---

## 1. The question text

**Round 30 Phase 2 moved it off the row deliberately.** Name plus question is
521px, and with the level control that is 848px of the 876px a 1240 pane has.
It went into the definitions block as the region's lead sentence, and the name
carries it as a `title` attribute.

**The business could not find it.** Either the `title` is gone, or a `title` is
too quiet.

**The decision, confirmed with the business: make the hover work properly.**
Not back on the row — the cost is measured and it does not fit at 1240, where
137px remains after the criterion cell and segments.

**The mechanism exists.** Round 31 Phase 3 built a hover-and-focus popup for
the level definitions: floating rather than in-row, because in-row moved the
six rows below down 36px under the pointer; no debounce, measured rather than
inherited; centred then clamped; identity read from the element at hover time.

**Two of §8's four properties transfer and two do not.** Round 31 established
which and why. **Re-derive rather than copy** — a criterion name is not a
segment and the fourth property inverted last time.

---

## 2. The four lens rollups

**Confirmed with the business, and the answers to three questions resolve what
would otherwise be a contradiction.**

| | |
|---|---|
| **What** | Four rollups on the exit criteria panel: Commercial, Organisational, Technical, Legal |
| **Satisfied when** | Every criterion in that lens is at **Not applicable, Buyer confirmed or Verified** |
| **Not applicable counts** | Yes. It is a complete answer that closes the question, which is why Round 28 decided it requires no reason |
| **Manual or computed** | **Computed.** A display |
| **Display or gate** | **A display.** The approvals still gate |
| **Alongside or instead of Assessment reviewed** | **Alongside.** That tick stays manual and unchanged from Round 26 |

### Why "a display" resolves the tension

The business initially described the rollups in terms that read as a gate, and
a gate would have reopened two settled decisions.

**Round 26 settled that the criteria inform and the approvals gate**, choosing
a manual Assessment reviewed tick over a computed rollup because a computed
rollup tightens silently as criteria are configured and is satisfiable by
clicking through everything at Unknown.

**Round B established that no threshold gate is expressible**: the evaluator
checks array length and entry stage and never reads the value.

**A computed display needs neither.** It reads the same series the Assessment
panel already reads and counts. **No `assessment_current` rule, no gate-rule
mechanism, no engine change**, and Round 26's decision stands untouched.

### One mapping that is a judgement rather than an obvious consequence

Not applicable, Buyer confirmed and Verified satisfy. **That leaves Unknown and
Our hypothesis as the two unsatisfied states.**

Unknown is plainly a gap. **Our hypothesis is a real answer that is not yet
confirmed**, and it will read as a gap. That is probably right — a lens full of
hypotheses is not a lens to be confident in — but it is a judgement and should
be recorded as one rather than as arithmetic.

### The acknowledgement, and it is Round D's

The business also described: *"if not, and the stage approvals are provided, we
check and confirm that whoever has clicked approve accepts all the criteria are
not present but they are happy to progress to the next stage."*

**That is Round D's incomplete-approval reason**, designed in Round B and
deferred: an approver may approve with unanswered criteria, recording why.

**Per lens rather than per approval is sharper** than what Round B specified —
"Legal approved with three criteria unanswered, reason recorded" is a more
useful record than "approved with gaps somewhere."

**Not this round.** Recorded so Round D meets the refinement rather than the
original.

---

## Investigations

### I1. What happened to the question text

**The question.** Is the `title` attribute still on the criterion name, and
does it work?

Report from source and from the live page. **Round 30 Phase 2 put it there;
Round 30 Phases 3 and 4 and Round 31 Phase 4 all rewrote that row.**

**If it is gone**, that is a regression and the round should say which phase
removed it.

**If it is present**, report what a native `title` actually does — its delay,
its styling, whether it is reachable by keyboard — and whether "too quiet" is
the honest diagnosis.

Report where else the question renders. The business found it in the
disclosure, which is where Phase 2 put it as the region's lead sentence.

### I2. The hover mechanism

**The question.** How much of Round 31 Phase 3's popup transfers to a criterion
name?

Report each of its properties and whether it earns its place here:

- **Floating rather than in-row.** Round 31 measured in-row moving the rows
  below down 36px under the pointer. **Does a criterion-name hover have the
  same problem?** The name is at the row's left edge, not among five segments.
- **No debounce**, refused on measurement: five shows for five segments in a
  667ms sweep, no hide between them. **A criterion name is one target, not
  five.** Re-derive.
- **Centred then clamped.** Round 31 found a 62px overhang at 1240 on the
  rightmost segment. A left-edge element clamps on the other side, or not at
  all.
- **Identity at hover time.** Transferred last time; report whether it applies.

**Report focus.** Round 31 gave the segments hover and focus, and the business
has since said the arrow keys add no value. **A criterion name is not
focusable today.** Whether it should become so is a decision, and the
definitions block already carries the question for anyone who cannot hover.

**Report whether one popup or two.** The level popup exists. A criterion popup
showing a different string could reuse the element or need its own, and two
popups that can both be open is a state nobody has designed.

### I3. What the exit panel looks like with four rollups

**The question.** What does the exit criteria panel render today, and what do
four rollups do to it?

Report the current panel per stage: how many requirements, what they read,
and the panel's height at 1240 and 1920.

Round 31's screenshot showed Qualification with one requirement, *Assessment
reviewed*, and the panel at roughly 200px. **Solution Alignment carries four
in Round 30's configuration and will carry more.**

**Report where four rollups sit** relative to the existing requirements, and
whether they read as requirements or as something else. They are a display and
the rest of that panel gates, so a rollup that looks like a gate would be
lying.

### I4. Computing satisfaction

**The question.** What does the exit panel need to compute a lens rollup, and
does it already have it?

The Assessment panel reads criteria with their `lens_id` and the record's
series. **Report whether the exit panel has access to the same data**, or
whether this needs a fetch it does not currently make.

**Report the empty cases**, because they are not the same:

- A lens with **no criteria configured at all** — three of four today.
- A lens with criteria, **none assessed**.
- A lens whose criteria are **all Not applicable**.

**The first is the one to get right.** Three lenses are empty until Round C,
and "satisfied" and "nothing to satisfy" must not render the same.

### I5. What the design cannot express

**Output item 4 has caught the brief's central premise being wrong five times
in eleven rounds.**

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The criterion hover |
| 2 | The lens rollups on the exit panel |
| 3 | Full walk and close-out |

**Small, and it should stay small.** Round C is twenty-three criteria and it is
waiting.

**Argue with it.** If I4 shows the exit panel cannot see the assessment data,
Phase 2 grows.

---

## Verification requirements

**Captures of a hover state need the subject asserted visible and still
rendered after the capture.** Round 31 Phase 3 found the shutter ends the hover
**even on a full-viewport capture with no clip**, and captured the focus path
instead. **A criterion name may have no focus path**, so report how the hover
is evidenced before relying on an image.

**Round 31 Phase 4 found three instruments and two invalid.**
`elementFromPoint` reports hit-testing, and a `pointer-events: none` popup
reports whatever is underneath. A clipped pixel diff returned identical hashes
for two visibly different states.

**Calibrate on the kind of change each phase makes.** Six variants recorded.

**No probe prints a conclusion it has not computed.** Twice in Round 31.

**Capture the whole run, never through a filter.**

**Measure the exit panel at 1240, 1920 and 3440** before and after, re-measured
rather than quoted.

**Test Bed pixel-identical.** Opportunity-only.

**Enumerate teardown from the database by this round's tag.**

---

## Explicit non-goals

- **Round C.** Waiting on this round.
- **The incomplete-approval acknowledgement.** Round D, with the per-lens
  refinement recorded.
- **Any gate.** The rollups are a display. The approvals gate.
- **`assessment_current` rules.** Still zero, still deliberate.
- **A roving tabindex for the segments.** Recorded in Round 31, not fixed.
- The three-string reconciliation, `measurabilityConfirmed`, the app-wide `<p>`
  reset, Terminus Documents leading the row, the Closed Lost hover wording, the
  Reference tab round, reopening a loss, the open-decisions convention, the
  approval snapshot.

---

## Output format

1. **I1 to I5**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 answer, stated plainly**: is the `title` present, and is "too
   quiet" the right diagnosis.
3. **The I4 empty cases**, and how each should read.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.

---

# Phase 0 report

Round 32, 2026-08-25. Branch `round-32-hover-rollups`, cut from `main` at
`e9c0680` after the brief was committed. Server restarted from that tree,
API session token refreshed. No file edits, no migrations, no configuration
changes.

---

## I1. What happened to the question text

**Commands.**

    grep -n 'title="${escHtml(c.asks)}"' frontend/app.js
    git log --oneline -S 'title="${escHtml(c.asks)}"' -- frontend/app.js
    git log --oneline -S 'opp-assess-name' -- frontend/app.js
    git log --oneline -S 'opp-assess-criterion' -- frontend/app.js   # calibration
    git log --oneline -S 'opp-assess-nonexistent-xyz' -- frontend/app.js  # calibration

**Output.** The attribute is at `frontend/app.js:2248`:

    <span class="opp-assess-name"${c.asks ? ` title="${escHtml(c.asks)}"` : ''}>${escHtml(c.name)}</span>

`git log -S` on the attribute returns exactly one commit, `1e6780a`, Round 30
Phase 2. `git log -S 'opp-assess-name'` returns two commits, Round 30 Phase 4
and Round 25 Phase 6, neither of which touched the attribute. Calibration: the
same search returns 3 for a string known present and 0 for a string known
absent, so a zero here would have meant something.

**Live page**, scored fixture at Proposal, both widths: the `title` is present
on all seven criterion names and carries the question, reading for the first
row *Is money identified and committed*.

**Finding: it is not a regression.** It was added once and never removed. The
three phases the brief flagged as suspects all rewrote the row around it and
left it in place.

### Is "too quiet" the honest diagnosis

**It is right and it is imprecise, and the imprecision matters for Phase 1.**
Measured on the live element:

| | |
|---|---|
| `cursor` over the name | `auto` |
| Focusable | `false` (`tabIndex: -1`) |
| Name box | 230px, against name text of 96 to 226px |
| Adjacent chevron | carries its own competing `title` |

A native `title` waits roughly a second before appearing, renders in OS chrome
rather than the app's, times out on its own after a few seconds, is
unreachable by keyboard, and does nothing at all on touch.

**But the sharper problem is that there is no affordance.** The cursor does not
change, the name is not underlined, and nothing on the row says the name is
hoverable. The question is not quiet; it is **invisible until discovered by
accident**, and the discovery requires resting a pointer on a word that gives
no reason to rest there. The business found the text in the disclosure instead,
which is the only place it is announced.

**The adjacent chevron makes it worse.** It sits beside the name with
`title="Show definitions, history and who recorded this"`, so a pointer
travelling toward the name from the right can raise the chevron's tooltip
first, and only one native tooltip shows at a time.

**Where else the question renders.** In the detail region, as its lead
sentence, put there by Round 30 Phase 2. That region is **collapsed by
default**, which is what the business meant by "the history pull down".

---

## I2. The hover mechanism

Round 31 Phase 3's four properties, **re-derived on the criterion name rather
than inherited from the segments**. Measured at 1240, 1920 and 3440, by
injecting each candidate placement into the live panel and removing it again
(both injections confirmed removed).

The seven questions are 33 to 52 characters, rendering 185 to 284px on a single
line at 12px.

### 1. Floating rather than in-row: TRANSFERS

In-row costs **+36px on the row and moves every row below down 36px**, at all
three widths. Identical to what Round 31 measured for the level definitions,
and objectionable for the same reason: the content under the pointer moves
while the pointer is on it.

### 2. Centred then clamped: DOES NOT TRANSFER

The name is the **leftmost element in the row**, at x=302 against a pane that
starts at 302. Centring the popup on it would start it at **x=264, 38px outside
the pane's left edge, at all three widths**.

**Left-aligned on the name needs no clamp at all.** The longest question sets a
305x34px box, two lines, running 302 to 607 against a right edge of 1178 at the
narrowest width. No overhang in either direction anywhere.

So the property inverts: Round 31 needed a clamp because its target was near
the right edge, and this one needs a different anchor instead.

### 3. No debounce: DOES NOT TRANSFER CLEANLY, and the reasoning reverses

Round 31 refused a debounce **because it measured five shows in a 667ms sweep
across five adjacent segments with no hide between them**, and concluded the
debounce was protecting against nothing the segments actually did.

A criterion name has **no adjacent sibling of the same kind**: the next name is
a full row down, 66px away. So the sweep the debounce would have guarded
against cannot happen, and the measurement that justified refusing it does not
apply either. **The refusal was correct on evidence that is now absent**, which
is not the same as being correct here. Phase 1 re-measures rather than quoting.

### 4. Identity at hover time: TRANSFERS

The panel re-renders on every draft change, so an element captured at bind time
can be stale by the time it is read. Same mechanism, same fix.

### Focus

**The name is not focusable and nothing makes it so today** (`tabIndex: -1`,
measured). Round 31's segments are radio inputs and got focus for free.

Making seven spans focusable adds seven tab stops to a panel the business has
already said gains nothing from arrow keys. **The definitions region carries
the question for anyone who cannot hover**, and it is one keyboard-reachable
chevron away rather than seven.

**Recommendation: hover only, and say so as a decision rather than an
omission.** This is the property Round 31 flagged as having inverted once, and
it has inverted again, in the other direction.

### One popup or two

**One, shared per row.** Two would allow both open at once, which is the state
the brief correctly says nobody has designed: hovering a name and then
keyboard-focusing a segment reaches it, because their show and hide paths are
independent. Sharing one element per row makes them mutually exclusive by
construction rather than by a rule someone has to maintain.

### One thing Phase 1 must not miss

**Adding the popup without removing the `title` ships both.** The custom popup
would appear immediately and the OS tooltip roughly a second later, overlapping
it. That is Verification 7's move claim: the question appears in its new place
**and is gone from its old one**, and the second half needs its own assertion.

---

## I3. What the exit panel looks like today

**Interaction.** Scored fixture, each stage tab opened in turn, the Exit
Criteria card measured. First attempt was wrong and is recorded: `.pg-card`
unscoped matched cards in **hidden** panels, so the lookup returned a
Qualification card that never fills. Every lookup is now scoped to the visible
`[data-opp-stage-panel]`.

| Stage | Card | Requirements | Reads |
|---|---|---|---|
| Qualification | 420x130 | 1 | *All criteria met - ready to move to Solution Alignment* |
| Solution Alignment | 420x430 | 8 | all met |
| Proposal | 420x371 | 8 | *8 of 8 outstanding to move to Evaluation:* |
| Evaluation | 420x322 | 6 | |
| Negotiating | 420x441 | 9 | |
| Closed Won | none | | no Exit Criteria card exists |

**The card is 420px wide at 1240, 1920 and 3440.** It does not grow with the
viewport, so four rollups have 420px whatever the screen.

**Two findings.**

**The panel already has a satisfied vocabulary**, and it is a sentence, not a
badge: *All criteria met* against *8 of 8 outstanding*. A rollup that
introduced a second, different way of saying satisfied in the same card would
compete with it.

**Every existing row is a tick or an empty box against a label.** Rendering a
rollup in that list would make it read as a requirement, because that is what
every other row in the card is. The brief's constraint is therefore a real
design constraint and not a caution: **the rollups need to be visibly a
different kind of thing**, in their own block, and the block needs to say what
it is.

Rollups appear at five stages. Closed Won has no card to put them in.

---

## I4. Computing satisfaction

**The exit panel already has everything, and needs no fetch.**

`ensureOppCriteria` and `ensureOppLenses` are each called from exactly one
place, `mountOppAssessmentLenses()` at line 2728, which is called from
`renderOppDetail()` at line 5539. **That is the detail load, not the Assessment
tab.** Measured on a stage tab with Assessment never clicked: `oppCriteria: 7`,
`oppLenses: 4`, and the record's payload holding 7 `assessComm` series.

Criteria carry `lens_id`. All seven are Commercial. The four lenses are
Commercial, Organisational, Technical and Legal.

**A dependency worth naming rather than relying on.** The exit panel would be
reading data another panel's mount happens to have loaded. That is Architecture
rule 8's shape exactly: correct for every caller that exists, and silently
empty the day the Assessment panel is lazy-mounted per tab. **The rollup
renderer should call the ensure helpers itself.** They are cached, so it costs
nothing when the data is already there, and it removes the ordering dependency
altogether.

The brief's stated trigger for Phase 2 growing was the exit panel not being
able to see the assessment data. **It fired negatively.**

### Criteria per lens, and per lens per stage

| Lens | Total | Qual | Sol | Prop | Eval | Neg |
|---|---|---|---|---|---|---|
| Commercial | 7 | 1 | 6 | 7 | 7 | 7 |
| Organisational | 0 | 0 | 0 | 0 | 0 | 0 |
| Technical | 0 | 0 | 0 | 0 | 0 | 0 |
| Legal | 0 | 0 | 0 | 0 | 0 | 0 |

**Criterion visibility is stage scoped**, and this is the fact I5 turns on.

---

## The I4 empty cases, and how each should read

Measured on both fixtures. `every()` over the satisfying levels returns:

| Case | Today | The rule as written returns | Should read |
|---|---|---|---|
| No criteria configured at all | Organisational, Technical, Legal | **`true`** | *Not configured* |
| Criteria exist, none assessed | Commercial on a fresh record | `false` | *0 of 7* |
| Criteria exist, all Not applicable | none today | `true` | satisfied, plainly |

**The first case is the trap and the measurement confirms it.** `every()` on an
empty array is vacuously true, so the three empty lenses compute **satisfied**,
on no evidence, and would render as three ticks beside the one lens that has
actually been worked. Until Round C that is three quarters of the display
asserting completeness about nothing.

**The third case should read as satisfied without qualification.** Round 28
settled that Not applicable is a complete answer requiring no reason, and a
lens closed by seven of them is closed. It should not be distinguished from a
lens closed by seven Verified, because the rollup's question is whether the
lens is answered, not how.

**The second case is the only one the rule as written already gets right.**

---

## I5. What the design cannot express

### 1. "Every criterion in that lens" is ambiguous, and the two readings disagree on live data

The brief states the rule lens-wide. Criteria are **stage scoped**, and the
rollup sits on a **stage's** exit panel. On the scored fixture, at
Qualification, where Commercial holds one visible criterion of seven:

    READ LENS WIDE    at Qualification: satisfied = false
    READ STAGE SCOPED at Qualification: satisfied = true

Same record, same moment, opposite answers. The probe discriminates.

**The lens-wide reading is not merely stricter, it is unactionable.** At
Qualification it asks the record to satisfy six criteria that Qualification
does not render. Nothing anyone does at that stage can change the answer, so
the Commercial rollup would sit unsatisfied through the whole of Qualification
as a matter of configuration rather than of the deal.

**Stage scoped is almost certainly what was meant**, because the card's subject
is what stops you leaving this stage. **But the brief says lens-wide and this
is a business decision, not a build detail**, so it is raised rather than
assumed. It also has a consequence worth stating: under stage scoping a lens
can be satisfied at Qualification and unsatisfied at Proposal on the same
record at the same moment, because the stage brought six more criteria into
view. That is correct behaviour and it will look like a regression the first
time someone advances a stage and watches a tick disappear.

### 2. The rule has two states and the display needs three

The brief asks that *satisfied* and *nothing to satisfy* not render the same,
and it is right. **But the rule as written does not give them different values
to render** — both are `true`. Three states are needed at the rule, not a
rendering rule layered over a boolean: satisfied, not satisfied, nothing
configured.

### 3. Small, and both are one sentence

Neither of these blocks the round. Both change what Phase 2 builds, and both
are cheaper to settle now than to discover in a screenshot.

---

## The phase plan

**The brief's shape survives, with its own stated growth trigger having fired
negatively.**

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The criterion hover |
| 2 | The lens rollups on the exit panel |
| 3 | Full walk and close-out |

**Argument for keeping four.** The brief said Phase 2 grows if the exit panel
cannot see the assessment data. It can, on detail load, with no fetch. The two
open questions in I5 are decisions, not work, and they belong in this phase's
sign-off rather than in a phase of their own. Round C is waiting and the brief
is right that this should stay small.

**Phase 1 carries, beyond the obvious.** The `title` is removed and asserted
gone, not merely superseded. One popup element per row, shared with the level
definitions. The debounce re-measured rather than inherited, since the
measurement that refused it last time does not apply. Left-aligned, not
centred. An affordance on the name, because the absence of one is the actual
diagnosis. Hover only, recorded as a decision.

**Phase 2 carries.** Three states at the rule. The ensure helpers called by the
renderer rather than depended on. Its own block in the card, visibly not a
requirement row, not competing with the card's existing satisfied sentence.
420px at every width. Five stages, because Closed Won has no card.

---

## A probe fault, recorded

**The third instance in two rounds of a script printing a conclusion it had not
computed.** The I4 probe measured `oppCriteria: 7` and `oppLenses: 4` and then
printed *the criteria and lenses are not [loaded], until something calls the
ensure helpers*, which is the opposite of what it had just read. The line was
written before the measurement and never made to depend on it.

Round 31 produced two of these, and this is the first in Round 32. The
correction is the same each time and it is not "read the output more
carefully": **the verdict is computed from the measurement and printed as a
value**, so that a wrong conclusion becomes impossible rather than merely
unlikely.

---

## Teardown

Enumerated from the database by this round's tag, not from the fixture file.
Six live records carrying `R32`, two Opportunities, two Accounts, two Contacts.
All six soft deleted, `deleted_at` set, re-queried directly: **0 still live, 6
soft deleted**. No `reference_number_counters` row was deleted; the script
issues no delete at all.
