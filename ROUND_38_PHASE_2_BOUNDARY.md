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
into a surface with five blocks, an endpoint, a shared assembler and 149 pure
tests. That was the business's own sequencing, and every decision inside it was
taken by the business, but it is fair to say the phase now contains two things:
a reshape that has not begun, and an approval page that is substantially
finished.

**The recommendation, which is the business's call and not mine:** close Phase 2
at the reshape, and let the approval page be its own phase in the record even
though it was built inside this one. The alternative is a phase whose name
describes a third of its contents.
