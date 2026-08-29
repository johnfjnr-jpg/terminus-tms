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

## 5. What I recommend, and what I am not deciding

**Option A**, and the argument is that it is the only one where the approver
cannot act without being shown the deal. B records that a page was opened, which
is a weaker claim wearing the same word, and every "you must read this" control
in every system decays into a click-through.

**The scope question is the business's and it is the real one:** should a
Commercial approval on an Opportunity survive a re-price? The gate says yes
today. The approval page says no. My reading is that a Commercial approval is
about a price and should be revision-scoped, while Technical and Legal are about
the solution and the contract and are reasonably stage-scoped - which would mean
`scope` becomes per-track rather than per-rule, and it is exactly the kind of
change that is cheap now and expensive once the business is trading.

Not decided here.

---

## 6. Two smaller things that belong to the same phase

- **The over-twelve-months acknowledgement has no home until the control does.**
  The requirement is stated on the page and cannot be enforced without an approve
  action to attach it to.
- **The Commercials reference panel carries the same staleness treatment**, from
  `src/lib/cost-basis.js`, which is why the bands and their sentences were moved
  there rather than left on the approval page. The salesperson sees the rates
  before any approver does and is the first person who could act on an ageing
  basis.
