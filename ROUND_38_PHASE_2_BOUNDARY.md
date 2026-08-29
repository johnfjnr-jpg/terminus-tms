# Round 38: where Phase 2's boundary actually is

2026-08-29. Written because the scope has grown a long way from where the round
opened, all of it justified and none of it planned, and a phase that ends by
exhaustion ends in the wrong place.

---

## 1. What Phase 2 was

From `COMMERCIALS_RESHAPE_PHASE_0_BRIEF.md`, in the business's words:

> *"When I saw the deal sheet it made me realise we were duplicating where
> information is displayed."*

> *"A single vertical flow with the Deal Sheet live beneath it"*, rather than
> four input tabs and a fifth to check the answer.

**Phase 2 is the reshape.** Four input sub-tabs plus a Deal Sheet sub-tab become
one scrolling flow with a live Deal Sheet and expandable detail. Phase 1 was
save-then-version. Everything after Phase 1 was signed off in conversation
rather than listed in the brief, which is why the count is worth stating rather
than assuming.

**The reshape has not been built.** Not one line of it. `#opp-tab-commercial`
still has its sub-tabs.

---

## 2. What was actually built, and why each was not a detour

Fifteen commits. Sorted by what they answer, not by date.

### Conditions the business set before the reshape could start

Every one of these was a stated precondition, not a discovery.

| | |
|---|---|
| Blank numerics coercing to zero | fixed at source in `readPayload()` |
| Event-inferred dirty flag | replaced by comparison (`payload-diff.js`) |
| Per-tab field ownership | `COMMERCIALS_OWNED_KEYS` |
| Record-level freshness | `p_expected_revision`, compare-and-swap under the lock |
| Clock skew, second occurrence | retry with an asserted budget |
| Fixture hygiene, second occurrence | `fixtures.mjs`, assert-on-create |
| A jsdom harness for the wiring | `commercials-wiring.test.mjs` |

**These are the reason the reshape has not started, and they were the right
order.** Phase 2 adds controls to a panel where every new control used to be
dirty by default and every write was last-writer-wins.

### The recurrences that were closed structurally rather than noted

Each of these was a second or third sighting, and the standing instruction is
that a recurrence produces a structural change or an explicit decision.

- `APPEND_ONLY` on six read-modify-write sites, the deals.js whole-payload
  re-stamp worst among them.
- `CLIENT_UNWIRED` on every whole-form write; now gone from the codebase.
- The migration overload that took every caller down; now a standing test.
- The relabel guard incomplete one migration later; now a standing test.
- Unchecked responses, twice; now one throwing client and a scan.
- A category name asserted rather than measured; now `CLAUDE.md` Verification 19.

### The approver question, which the business asked for inside Phase 2

Blocks 1 to 5, plus the decisions that came with them: approval is of a version,
the bridge is sequential, no baseline states its absence, target means policy,
and a default on a read-only surface is a value with provenance.

**This is the largest single piece and it is the one most worth examining**, see
section 4.

---

## 3. What remains INSIDE Phase 2

Short, and unchanged from the brief.

1. **The reshape itself.** One vertical flow: units, then installation type,
   then the branch that type implies, with the Deal Sheet live beneath.
2. **The Deal Sheet's four cards**, explicitly not settled by a redundancy
   count. What each still earns, reported before anything is deleted.
3. **The two Round 37 walk findings**, which fold in only if the reshape touches
   their section: a reason required on a first version where there is nothing to
   explain, and restore overwriting current pricing with no undo.
4. **Layout at 1240, 1920 and 3440**, before and after, for a flow that does not
   exist yet.

---

## 4. What has arrived that is really Phase 3

Named so the phase does not absorb them by proximity.

| | Why it is not Phase 2 |
|---|---|
| **A catalog change silently re-prices every live deal** | Created by this round and recorded in `DESIGN_PRINCIPLES.md`. It is a notification system across every Opportunity, not a Commercials screen. |
| **Approval routing and the approve control** | The approval PAGE is built. Nothing on it approves anything: there is no request-approval flow, no tier routing, and `routing_rules` is still unbuilt. Blocks 1 to 5 answer "what does an approver need to see", which is what was asked. |
| **The atomic array append** | Named in `record-revision.js` with an owner. Five single-key read-modify-write sites still accept a same-key lost update. |
| **`state-dump.mjs` coverage of versions** | Already scheduled against a trigger rather than a date. |
| **The `SINGLE_KEY_RMW` sites themselves** | Each is one payload key wide and understood. Closing them is the append above. |

---

## 5. The honest reading

**Phase 2's own work is almost entirely unstarted, and the ground it stands on
is now solid.** That is not the same as being behind: a reshape that added
controls to a panel with an event-inferred dirty flag, no field ownership and no
freshness guard would have shipped the same three defects again, and two of them
were already second sightings.

**The approval page is the piece that grew.** It was asked for as a question -
what does a commercial approver need to see on one page - and the answer turned
out to be a surface, not a paragraph.

---

## 5a. SEQUENCING, confirmed 2026-08-29

**The Commercial scope fix lands BEFORE the reshape, and it has.**

The reshape rebuilds the panel that carries the approval entry point and the
save-then-version flow. A control failure does not wait behind a layout change:
while the gate read stage-scoped, an Opportunity could reach Proposal carrying a
Commercial approval against a price nobody saw, and the only thing containing it
was that one person held every approval track.

Order, as built:

1. **Done.** The Commercial gate asks the approval page's evaluator
   (`20260829000005`, `liveVersionApproval`).
2. **Next.** Where approving happens, per
   `ROUND_39_PHASE_OPENER_WHERE_APPROVAL_HAPPENS.md`. The gate is now correct
   and the approver still reads the page beside the control rather than in
   front of it.
3. **Then.** The reshape and its four items.

---

## 6. The phase split, and the general rule it produces

**Taken 2026-08-29.** Phase 2 is the reshape and its four items. The approval
page is its own numbered phase, already delivered.

**The useful part is the reason, not the renaming.**

> **A question asked inside a phase can turn out to have a SURFACE as its
> answer. The moment to re-scope is when that becomes apparent, not at the end
> of the phase.**

Here it was apparent early and was not acted on. "Bring me the question of what
a commercial approver needs to see on one page" was asked as a question, and the
answer was already a page - five blocks, an endpoint, a shared assembler, a
sequential bridge - by the time the first block was designed. Everything after
that point was building a second deliverable inside a phase named after the
first.

Nothing was wasted and nothing was wrong. But the phase's name stopped
describing its contents several days before anyone said so, and a phase whose
name is wrong is a phase whose completion cannot be checked. Build discipline
rule 7 says to count the phases actually signed off rather than trusting the
brief; this is the same failure arriving from the other direction, where the
phase is real and its scope has quietly doubled.

**The signal to watch for:** an answer that needs a route, a module and a test
file is not an answer to a question, it is a deliverable. Say so at that moment.

---

## 7. Is the reshape still the right shape?

Asked because the reshape was scoped against a question - what each Deal Sheet
card earns - that a later decision has partly answered.

### The reshape itself: YES, unchanged

The business's premise is untouched by anything built since:

> *"The computed pricing cards on HW / Hosting Setup show cost, margin and
> price per product. The Deal Sheet shows revenue, cost and margin."* The same
> numbers twice, on two screens, one of which you have to navigate to.

**The approval page does not replace it, because it is a different moment and a
different person.** The approval page is read once, by an approver, after the
pricing is done. The reshape is about entering a deal: a salesperson typing
units and watching the number move. Nobody opens the approval page mid-entry,
and it would be wrong if they did - it deliberately shows what DID happen, under
the opposite convention to an input screen.

### Item 2: DECIDED 2026-08-29. Three cards go, one becomes a reference panel.

The four cards were Margins, Base cost data per unit, Terms and Units required
(`opportunity-deal.js:389-419`). They were the only consolidated view of a deal
when they were built, and their job was "check what you are about to freeze".
**That job is the approval page's now**, and it does it better on all four:
margins as lines below target with the gap, base cost data with its age and a
warning when a product has none, terms as dollar exposures rather than
percentages, units in the ask.

**Margins, Terms and Units required are removed.** They restate values visible on
the same screen, and the reshape puts the computed answer live beneath the form.

**Base cost data, per unit stays, and stops being a card that summarises the
deal.** It is the only place a salesperson sees the rates they are pricing
against, because those rates are read-only, written from the catalog at save and
absent from the input surface entirely.

It becomes a **reference panel**:

- visible DURING entry, not a block of restated numbers below the form
- carrying each rate's batch label and effective date, because a rate without its
  date is the thing the staleness policy exists to stop being invisible
- **carrying the SAME staleness treatment as the approval page** - same bands,
  same words, earlier. The salesperson sees these rates before any approver does
  and is the first person who could act on an ageing basis. The bands and their
  sentences were moved into `src/lib/cost-basis.js` for exactly this, so the
  panel reads them rather than writing its own (Verification 20)
- read-only and clearly so, since nothing on it is editable and it must not read
  as a set of inputs somebody forgot to fill

**It lands with the reshape**, not before: the panel needs the reshaped entry
surface to sit beside, and removing three cards from a tab that is about to be
rebuilt is churn.

### Item 3: HALF CLOSED 2026-08-29

**The reason is answered, with one change.** It has a reader - the approval page
renders it as prose beside the bridge - and that is what justifies requiring it.
But a required field decays into boilerplate the moment it has nothing to say,
so **the prompt changes by context**: a first version asks what the price is
based on, a subsequent one asks what changed and why. Same field, two questions,
because they are two questions. Built, and written up as `CLAUDE.md`
Verification 22.

**Restore is nearly closed, and the residual is measured rather than assumed.**
It does not refuse; it WARNS, through the same discard dialogue the assessment
panel uses, and only when the form is dirty. What was worth checking is what the
check read: a cached boolean that `updateDirtyState()` kept in step with the real
comparison, which is Verification 20 in miniature. It now asks
`dealDirtyKeys()` directly, and three wiring tests lock warn-when-dirty,
do-not-ask-when-clean, and stop-asking-when-edited-back.

The data loss on restore is unchanged and is accepted: it is what makes restore
useful during a negotiation, it now supersedes any approval visibly, and forcing
a save first would write a revision nobody asked for at the moment they are
trying to go back.

### Items 1 and 4 are unchanged

The reshape, and layout at 1240, 1920 and 3440 before and after.

### The one thing to add

**The reshape must not lose the approval entry point or the save-then-version
flow.** Both are new since the brief was written, both live in the panel being
rebuilt, and `DESIGN_PRINCIPLES.md` now records save-then-version as
load-bearing for approval. A reshape that separated them would break approval
with nothing failing at the moment of the split.
