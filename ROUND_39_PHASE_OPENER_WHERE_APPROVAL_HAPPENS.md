# Where does approving actually happen?

Phase opener for the phase that follows the approval page. 2026-08-29.

The question is not "add an approve button". It is whether the surface that
carries the control puts the approval page **in front of** the approver or
**beside** it, because a briefing you have to remember to open before acting
somewhere else does not get opened.

Everything below is measured against the live database and the shipped code.
Nothing here is inferred from how it ought to work.

---

## 1. Approving already happens, and it already gates

Not a gap. A working mechanism the approval page was built without looking at.

**`stage_gate_rules` holds 31 `approval_obtained` rules, 12 of them on
Opportunity:**

| From | To | Tracks required |
|---|---|---|
| Solution Alignment | Proposal | Commercial, Technical, Legal |
| Proposal | Evaluation | Commercial, Technical, Legal |
| Evaluation | Negotiating | Commercial, Technical, Legal |
| Negotiating | Closed Won | Commercial, Technical, Legal |

**Where the control is:** the Opportunity stage tab. `buildStageApprovalRowHtml`
(`app.js:6047`) renders one clickable row per required track, labelled *"Click to
approve"*, and `submitStageApproval` POSTs `/api/records/:id/approvals`. A
Commercial approval at Solution Alignment is one click on a row in a list of
three, on a tab that is not Commercials.

**It really blocks.** `computeBlocking` refuses the transition until every track
has an approval, through `approvalSatisfiesRule`, which `transitions.js` calls
the single definition and which two call sites import rather than reimplement.

**So the answer to "where does approving happen" is: on the stage tab, one click,
today, with no sight of any pricing at all.**

---

## 2. AND THE TWO MODELS DISAGREE ABOUT WHAT AN APPROVAL SURVIVES

This is the finding, and it is larger than the missing button.

Every Opportunity approval rule carries `{"scope": "stage"}`. `approvalSatisfiesRule`
reads that:

```js
return ruleScope(rule) === 'stage'
  ? approval.stage === from_stage          // survives every revision
  : approval.revision_number === currentRevision
```

**Stage-scoped means a Commercial approval given at Solution Alignment stays
satisfied for as long as the record is at Solution Alignment, through any number
of revisions.** The pricing can move ten times underneath it and the gate stays
green.

The approval page says the opposite, and `DESIGN_PRINCIPLES.md` now records it as
a decision: an approval is of a version, it names the revision the version was
taken from, and **any revision after it voids it**. That rule exists because
without it "an approval means something was once approved, which is worse than no
approval because it looks like control".

**Both read the same `approvals` table. Both are shipped. They answer the same
question differently, and nothing reconciles them.**

Note that `scope: 'stage'` was not an accident: Round 7 introduced it
deliberately, because revision-scoped approvals were being invalidated by editing
any field, which re-enabled the row and recorded a duplicate approval per edit.
The reasoning was sound for a gate about *reaching a stage*. It is wrong for a
gate about *a price*, and the same word now covers both.

---

## 3. What that means in practice, today

An approver at Solution Alignment:

1. opens the Opportunity, lands on the stage tab
2. sees three rows saying "Click to approve"
3. clicks Commercial
4. the gate goes green and stays green

**The approval page is never in that path.** It is reachable only from a button
on the Commercials tab, which an approver has no reason to open. Everything the
page was built to put in front of them - what moved since the last approved
version, the exposures in dollars, the age of the cost basis, the assumptions
being accepted - is one click away from a screen where one click approves.

**This is the failure the phase has to prevent, and it fails quietly:** nothing
errors, no test breaks, the gate works exactly as designed, and the briefing
becomes something people mean to look at.

---

## 4. The choice, stated so that not choosing is visible

**Option A: the control comes to the page.** Approve from the approval page, and
remove or disable the stage-tab row for tracks that have a page. The approver
cannot approve without having been shown the deal.

- Fits the version model directly: approving V1.2 approves its revision, and the
  "over twelve months" acknowledgement has somewhere to live.
- Costs: two places currently approve one track, so one of them stops. The stage
  tab's Commercial row becomes a link to the page rather than a control, and
  Technical and Legal keep theirs.

**Option B: the page becomes a required step in the flow that carries the
control.** The stage tab keeps the control, and the Commercial row cannot be
clicked until the approver has opened the page for the current revision.

- Fits the existing gate machinery: a new `requirement_type`, in the same
  data-driven table, alongside `approval_obtained`.
- Costs: "has been read" is a weaker claim than "approved this version", and it
  needs somewhere to record that reading, which is a new write and a new table
  or payload key.

**Option C, which is what happens if nobody chooses:** the page stays beside the
control. Within a month approval is a click on the stage tab and the page is a
thing people mean to open.

**A and B both need the scope disagreement in section 2 settled first**, because
each of them makes a Commercial approval mean something specific, and today it
means one thing to the gate and another to the page.

---

## 5. DECIDED 2026-08-29: option A, and why the gate fix made it urgent

**The Commercial row cannot be satisfied without the approval page having been
put in front of the person.** Clicking the stage row opens the approval page;
approve lives at its foot; the stage row becomes a status display, not a control.

**The scope fix makes the current arrangement worse before better, and that is
the argument.** A gate that closes on every re-price means clicking again, on a
screen that shows nothing. **Friction without information produces reflexive
clicking, and a rubber stamp applied four times is weaker evidence than one
applied once.** Having made the gate correct, leaving the control where it is
converts a silent failure into a trained one.

**It also gives the stale-basis acknowledgement its home.** The over-twelve-month
rule requires explicit acknowledgement that the basis is stale, and there was
nowhere to attach it. A checkbox at the foot of the approval page, beside
approve, reachable no other way.

---

## 6. THE HOLE ONE STAGE LATER, scoped now rather than found in Round 45

**The question.** Commercial gates the transition INTO Proposal, and the Deal
Sheet keeps moving THROUGH Proposal by design. What does a voided Commercial
approval mean after the transition it guarded has already happened?

**Measured answer: between the two gates, nothing.** The record sits at Proposal,
the Deal Sheet moves freely, the approval reads `superseded` on the approval page
and in the stage-approvals panel, and no gate is being evaluated. **The proposal
document that reaches the customer is produced inside exactly that window.**

**The second gate is specified and it already exists as a TICK BOX.**
`DESIGN_PRINCIPLES.md:285` says of Proposal to Evaluation, "Proposal Submitted":

> The proposal itself (built on the Deal Sheet) must be approved across all
> required tracks before it can be sent. The Deal Sheet is effectively frozen at
> this point.

And the configuration for that transition, measured, carries:

| Rule | What it is today |
|---|---|
| `exitPropPricingApproved` "Pricing approved" | **`payload_field_required`. A checkbox a person ticks.** |
| `exitPropDocumentation` "Proposal documentation approved" | a checkbox |
| `exitPropContractTerms` "Contract terms and variations approved" | a checkbox |
| Commercial `approval_obtained` | now version-scoped, so it IS a live check |

**So the thing labelled "Pricing approved" at the proposal gate is a
self-assertion.** It can be ticked while the pricing has moved since anyone
approved it, and it is the line a person reads. The Commercial rule beside it now
does the real work, which means the tick is at best redundant and at worst the
one people trust.

**Scope for the next round: `exitPropPricingApproved` stops being a tick and
becomes the THIRD CALLER of `liveVersionApproval()`.** Same reader, same derived
state, no new mechanism. It needs a new `requirement_type` that evaluates a
derived condition rather than reading a payload key, which is the piece of
engine work this implies and the reason it is scoped rather than done here.

**Callers of `liveVersionApproval()` after that change:**

1. `computeBlocking`, the transition gate
2. `buildStageTracks`, the stage-approvals panel
3. the proposal-submission requirement
4. the approval page itself, unified onto it in this round after it was found
   assembling the same answer from the two functions underneath - Verification 20
   applied to something this round created

**What it does not close, stated so it is not assumed:** the window between the
two gates. A deal repriced at Proposal and never moved onward is guarded by
nothing, because no transition is being attempted. The containment is that the
stage-approvals panel now shows the Commercial track un-ticked with the reason,
on the tab the owner already uses. Whether a live deal should be able to sit at
Proposal with a void Commercial approval and no prompt is a business question
this round does not answer.

---

## 7. What I am not deciding

**The scope question for Technical and Legal.** Recorded in
`DESIGN_PRINCIPLES.md` with its successor and its trigger: scoping each track to
the fields it governs, once a field-to-track map can be built safely, and the
trigger is a person rather than a date - before a second individual holds any
approval track.
