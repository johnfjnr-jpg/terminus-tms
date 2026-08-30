# Commercials: one flow, live Deal Sheet, expandable detail

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 37 merged to `main`
at `2e64295`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

**The business used the Deal Sheet Round 37 built and saw a duplication in the
screen it sits on.**

> *"When I saw the deal sheet it made me realise we were duplicating where
> information is displayed. The deal sheet looks really cool and is the source
> of truth on the deal financials."*

**The computed pricing cards on HW / Hosting Setup show cost, margin and price
per product. The Deal Sheet shows revenue, cost and margin.** The same numbers
twice, on two screens, one of which you have to navigate to.

**The reshape, in the business's words:**

> *"We enter the number of units, then we enter the installation type,
> depending on the installation type if it's Terminus contractor per unit then
> we see the default installation per unit data that we can change, or if it's
> contractor lump sum we get that dialogue. The deal sheet is constantly
> updated based on the user input."*

**A single vertical flow with the Deal Sheet live beneath it**, rather than
four input tabs and a fifth to check the answer.

---

## Read the prototype first

**`Terminus Ops.dc.html` is in the repository root**, untracked, and has been
present since Round 37.

**It is the source for four things this brief describes at second hand:** the
cash flow, the PO factoring model, the contractor milestone dropdown, and the
Structural Terms layout.

**Read it. Do not work from this brief's description of it.** The brief's
author has been describing it from screenshots and has already asked the
business a question the prototype answers.

**Report what it actually contains**, and where it disagrees with this brief.

---

## What is built and what is not

| Section | State |
|---|---|
| Units Required | **Built.** Four inputs, fixed by Round 37 Phase 1 |
| Computed pricing cards | **Built.** Cost, margin per line, price. **This is the duplication** |
| Installation | **Not built.** Round 37 added install rates to the catalog and a total |
| Structural Terms | **Not built** |
| Payment Terms | **Not built** |
| Cash flow | **Not built.** Not wanted for Test Bed |
| PO factoring | **Not built** |
| Deal Sheet | **Built.** Read-only sub-tab, four cards, versioned |

**Most of what the business has redesigned is unbuilt**, which makes this a
reshape of empty sections rather than a rewrite of working ones.

---

## Decided with the business

### The layout

**No sub-tabs. One scrolling Commercials screen**, sections in order:

1. **Units Required**
2. **Installation** — a type selector, with a conditional panel:
   - *Terminus Contractor Per Unit* shows the four per-unit rates from the
     catalog, **editable**
   - *Terminus Contractor Lump Sum* shows a lump sum figure in bid currency and
     the contractor payment milestones
   - *Client Own Installation Team* and *Terminus Reseller Installation* cost
     Terminus nothing and show no panel
3. **Structural Terms**
4. **Deal Sheet Summary**, live, with detail expandable **horizontally beside
   it** on request
5. ~~**Payment Terms and Cash Flow, side by side**~~

> **SUPERSEDED 2026-08-30 BY THE BUSINESS, Round 41, and the wording above is
> struck through rather than deleted so this conflict cannot be relived.**
>
> `ROUND_41_BRIEF.md` item 5 asks for a layout this section did not anticipate,
> and Round 41's items 5 and 6 report raised the contradiction rather than
> building past it:
>
> - **Units Required and Installation become a SECOND side-by-side**, sections 1
>   and 2 paired, Units on the left and Installation on the right.
> - **Cash Flow leaves the pair** and sits below Payment Terms, on the left.
>
> **Conditional on the installation text surviving 1240.** The business's own
> condition: if the three paragraphs wrap mid-word, clip, or fall below readable
> width, the build stops and reports with the capture rather than shipping.
>
> **The numbered order of the sections is otherwise unchanged**, and everything
> else in this section still stands: no sub-tabs, one scrolling screen, the
> detail expandable horizontally beside the summary.
>
> A later reader looking for "the decided layout" should read this brief AND
> `ROUND_41_BRIEF.md` item 5 together. `CLAUDE.md` Verification 23 is why this
> note exists: two correct decisions about the same behaviour, taken in different
> rounds, produce a conflict nothing detects, and Round 39 already lost its
> structural half to reading past this very section.

### The detail panel

> *"What would be good would be the option to select to open the detailed
> revenue and costs per unit / summary totals etc horizontally next to the deal
> sheet summary panel IF the user wants to see it."*

**On request, beside the summary, not below it and not on another screen.**
That is what removes the duplication rather than moving it.

### Margin

**Target margin is the default for every component.** Viewable and editable on
request, for finer tuning.

**This supersedes Round 36's per-line model**, where every row including
warranty carries its own margin cell. **Record it as a supersession with the
reasoning**, not as drift — the business stated the per-line model explicitly
two rounds ago and has now stated a better one.

**A margin on the warranty line was never a real decision**, and hiding the
per-component fields until asked for is the same reasoning that removed 1,800px
from the assessment panel in Round 30.

### Versioning stays

> *"The deal sheet versioning still needs to stay. That's a real value in this
> whole commercials sheet. Traceability of calculations used in proposals."*

**Unchanged.** Manual save, required reason, V0.n as drafts, V1 on issue, a
draft relabelled rather than copied, immutable once issued, restore with two
confirmations.

**The Deal Sheet stops being a sub-tab and does not stop being versioned.**

### Milestones

**Five, not six.** The business's spreadsheet showed six rows and confirmed the
prototype's five is right.

---

## Investigations

### I1. The prototype

**Read `Terminus Ops.dc.html`.**

Report the cash flow: what it computes, what it displays, what inputs it needs.

**Report the PO factoring model in full.** The business's description: *"a cash
flow management mechanism whereby we use loan financing to provide cash to
place the order with the manufacturer, and we then pay that back over a
specific term. The aim is to stay cash positive through the deal."*

**Report whether it is an input or computed from the payment terms.** The
four-figure strip already carries **Finance Cost** and nothing computes it.

Report the contractor milestone dropdown's options and the Structural Terms
layout.

**Report where the prototype disagrees with this brief.**

### I2. What the reshape costs

**Report what the current Commercials tab is**, structurally: the sub-tab
mechanism, what renders each section, and what a single scrolling flow would
remove.

**Report what the computed pricing cards do that the Deal Sheet does not.**
Round 37 Phase 2 found the four-figure strip and the Deal Sheet are two
different facts — the strip multiplies hosting by 36 months. **Whether the
cards are genuinely duplicate or carry something the Deal Sheet lacks is a
measurement, not an assumption.**

**Report what happens to the Deal Sheet's four cards** — Margins, Base cost
data, Terms, Units required — once the inputs sit above them on the same
screen. **Some of them may become the duplication.**

### I3. The live Deal Sheet

**The question.** It renders from saved state today. **The business wants it
current as they type.**

Report what recomputes it, what triggers that, and what a live update costs.
Round 37 Phase 2 established it reads through `deriveDealSheet`.

**Report the unsaved-state question.** The Deal Sheet is read-only and versions
are taken from it. **If it shows unsaved input, a version taken from it either
captures unsaved work or captures the saved state and disagrees with the
screen.**

**That is a real problem and it is this round's sharpest.** Report the options;
do not choose.

### I4. The expandable detail

**Horizontally beside the summary, on request.**

Report what the detail contains — per-unit revenue and costs, summary totals —
and where those numbers come from today.

Report what "horizontally beside" costs at 1240, where Round 37 Phase 2 found a
five-column table at 138% of its container and rebuilt it as two columns.
**A summary plus a detail panel side by side at 1240 is measurable, not
arguable.**

### I5. The margin reshape

Report what per-line margin does today and what removing it touches.

**Report where the per-component margins live.** Hardware and installation are
separate in the business's sheet, three products each, so six values plus the
target.

**Report what happens to versions taken under the old model.** Round 37 built
`sections_present` for exactly this: a version taken before the reshape carries
per-line margins and one taken after carries per-component. **They must remain
distinguishable and readable.**

### I6. What the design cannot express

**Output item 6 has caught the brief's central premise being wrong six times in
eighteen rounds.** Round 37's own merge confirmation asked about an attribute
fix that has never existed in this codebase, because the brief's author carried
a name from a report without checking it.

**This brief describes a prototype its author has only seen in screenshots.**

---

## The plan to produce

**Deliberately not proposed.** I1 will change it — the cash flow and PO
factoring are described here at second hand and read directly there.

**Report a plan once the prototype is read**, and say which sections are one
phase and which are more.

**Two sequencing constraints:**

**The reshape before the empty sections.** Building Installation, Structural
Terms, Payment Terms and cash flow into the four-tab structure and then
reshaping would build them twice.

**The live Deal Sheet before or with the reshape**, since it is what makes the
single flow worth having.

---

## Verification requirements

**Read the inputs and multiply by hand, at two different mixes.** Round 36 and
Round 37 both found defects this way, and Round 37's walk found a stale margin
default that Phase 1's fix had missed in a second location.

**An attribute name and a payload key are the same class of contract and
neither has a compiler.** Three mismatches in two rounds, all in this data
path.

**A removal is two claims.**

**Establish Test Bed reachability rather than running a pixel check.**

**Test data may be deleted rather than migrated.**

**Calibrate on the kind of change each phase makes**, and check the calibration
is in the right file and on the right page. Round 37 Phase 2 ran a pixel
comparison of a tab neither capture had opened.

**No probe prints a conclusion it has not computed.**

**Capture the whole run, never through a filter.**

**Enumerate teardown from the database by this round's tag, paged, in
dependency order.**

---

## Explicit non-goals

- **The pipeline panels.**
- **Industry on the Customer panel**, confirmed as from the Account and
  overridable.
- **The sub-contractor pricing criterion**, confirmed as Commercial lens at
  Solution Alignment.
- **Renaming Record to Save on the Key Contacts panel.**
- **The Test Bed catalog divergence** — ten of 39 hand-typed rate values across
  eight live records disagree with the catalog. **Recorded in Round 37,
  untouched, and a design question the business has not been asked.**
- **The Risk assessment**, parked.
- **Currency conversion.**
- Round D, the truncation fix, the renderer and draft-store fork, Opportunity
  to Test Bed conversion, hosting for internal comment.

**Two Round 37 walk findings fold into this round if they touch a section it
reshapes**, and are otherwise out:

- A reason is required on a first version, where there is nothing to explain.
- Restore overwrites current pricing with no undo, and save-then-restore is a
  discipline rather than a mechanism.

---

## Output format

1. **I1 first and in full**, since everything else depends on it.
2. **I2 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
3. **The I3 options**, with costs, not chosen. This is the round's sharpest
   question.
4. **The plan**, once the prototype is read.
5. **Where the prototype disagrees with this brief.**
6. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.
