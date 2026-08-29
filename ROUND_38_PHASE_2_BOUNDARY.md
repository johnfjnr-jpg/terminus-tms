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

### One of the four items has changed, and it is item 2

**Item 2 was "report what each Deal Sheet card still earns."** That question was
asked when those four cards - Margins, Base cost data per unit, Terms, Units
required (`opportunity-deal.js:389-419`) - were the ONLY consolidated view of a
deal. Their job was "check what you are about to freeze before you take a
version".

**That job now belongs to the approval page**, which does it better on all four:
margins appear as lines below target with the gap, base cost data appears with
its age and a warning when a product has none, terms appear as dollar exposures
rather than percentages, and units appear in the ask.

So the question is not "what does each card earn" any more. It is narrower and
easier: **what does each card earn DURING ENTRY**, when the answer is already
live beneath the form. On a first read, three of the four restate values visible
on the same screen; "Base cost data, per unit" is the one showing something a
salesperson genuinely cannot otherwise see, because the catalog rates are
read-only and not on the input surface at all. **That is a report, not a
decision, and the decision is the business's.**

### Item 3 has also changed, in both halves

- **"A reason is required on a first version, where there is nothing to
  explain."** The reason now has a job it did not have when that was written: it
  is the ONLY prose anywhere explaining a re-price, and the approval page renders
  it beside the bridge that shows what moved. On a first version, block 2 says
  "First approval. No prior approved version" and the reason says why this
  pricing. **The finding is arguably answered rather than open**, and the
  business should be asked whether it still wants it raised.
- **"Restore overwrites current pricing with no undo."** Still true, and **no
  longer silent**: restore writes a revision, any revision after an approval
  supersedes it, and the version list now says so in a sentence. The data loss
  is unchanged; the invisibility is not.

### Items 1 and 4 are unchanged

The reshape, and layout at 1240, 1920 and 3440 before and after.

### The one thing to add

**The reshape must not lose the approval entry point or the save-then-version
flow.** Both are new since the brief was written, both live in the panel being
rebuilt, and `DESIGN_PRINCIPLES.md` now records save-then-version as
load-bearing for approval. A reshape that separated them would break approval
with nothing failing at the moment of the split.
