# Round 39 close-out checklist

Written 2026-08-29, mid-round, so nothing here is remembered late. Items are
recorded as they are agreed rather than assembled at the end, which is the
failure mode this file exists to prevent.

Order matters below. Nothing outward-facing happens until the two gates at the
bottom are both satisfied.

---

## Blocked on the business

| Item | Owner | Blocks |
|---|---|---|
| Sign in with the rebuilt `scripts/sign-in.js` | business | three captures, gate stages 3 to 5 |
| Scratch project for the self-serve gate | business | nothing this round, tracked in `DESIGN_PRINCIPLES.md` |
| **The Render auto-deploy answer** | business | **the push at close** |

### The Render answer, and why it is a gate rather than a note

Owed since Round 38's close, where it produced `CLAUDE.md` build-discipline
rule 11: **an unanswerable precondition is a STOP, not a
proceed-with-justification.** The question is whether a push to `main` triggers
a Render deploy, and it cannot be answered from this repository because the
setting lives in a hosting dashboard.

**Standing consequence while it is unresolved: assume Render auto-deploy is
ON.** A push to `main` is therefore a deploy and is treated as one.

Rule 11 records both halves of that fault, and the second half is the
business's own: a precondition has to be answerable by whoever it is set for.
This one is now owned by the person who can see the dashboard, which is what
makes it answerable.

---

## Build work still to run

1. **Three captures**, once the session is live:
   - Structural Terms at 1920 and at 3440, carrying the field notes, the
     accent fix and the GST rows
   - The itemised Deal Sheet section, further down Structural Terms
2. **The full five-stage gate**, one pass, output captured to `.verify/`
3. **Regenerate `CURRENT_STATE.md`** and reconcile its diff against the phase
   list. A change no phase accounts for is a finding.

---

## Documentation work at close

1. **THE RULE INDEX.** Group `CLAUDE.md`'s rules by WHEN THEY APPLY: before
   writing, before claiming, before deleting, before superseding, before
   quoting a measurement. Then ask whether the groups collapse, on the remedy
   and not the shape. The measurement is already recorded in `CLAUDE.md` and
   the pass starts from it rather than repeating it. Grouping sits above the
   numbers, never instead of them.

2. **Reorganise the deferred list BY TRIGGER**, into two or three work packages
   attached to business events rather than a flat list of items. Asked for at
   the start of this round and not yet done.

---

## The merge

1. **Count the phases against the sign-offs**, not against the brief.
   `CLAUDE.md` build-discipline rule 7: the brief is not a reliable source for
   the count and searching it is worse than not searching it.
2. **TAG THIS ROUND.** The Round 38 merge was a fast-forward tagged
   `controls-complete`. **Round 39 is a distinct boundary and needs its own
   tag, so the controls work and the reshape stay separable in history.** That
   matters the day somebody wants to revert one without the other, which is
   precisely the day nobody wants to be reading commit subjects to work out
   where one ended.
3. **The push is an outward-facing act**, so it does not happen until the
   Render answer exists. Not "answer the ones you can and proceed on the
   strength of them".
