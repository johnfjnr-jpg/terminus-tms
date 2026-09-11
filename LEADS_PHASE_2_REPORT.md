# Leads, P2: the six migration regressions

**All six built. pure 512/512, react 938/938, typecheck green. Nothing pushed.**

Every claim about a screen here is from a **live DOM measurement after a
rebuild**, never from a suite. That is the standing verification for this
phase, and it earned its place three separate times below.

---

## 1. THE BRIEF'S FRAMING WAS INACCURATE, and the rulings stand anyway

**Ruled to be recorded.** The brief calls these six "migration regressions" and
names the retired `contact-detail.js` as the reference to recover behaviour
from. Measured against it at `40a5d8d~1`, 1,327 lines:

| | what the vanilla actually did | so A-item is |
|---|---|---|
| **A1** | had per-field `×` discard **AND** a form-level `cd-save-all` | **new design** |
| **A2** | no blur handling at all | **new** |
| **A3** | revert-to-saved existed - on the `×`, not Escape | **a rebinding** |
| **A4** | `cdEdits = {}` on every load, its own comment saying so | **A GENUINE REGRESSION** |

> **Only A4 is lost behaviour.** For A1-A3 there was nothing to recover, and
> the vanilla is not their reference.

**The rulings stand on their merits** and none of them changed as a result -
but "recover the behaviour" was the wrong instruction for three of the four,
and a later reader comparing the vanilla with the result would otherwise find
a discrepancy and think something was missed.

---

## 2. The six

### A1 - per-field Discard removed, one form-level Save + Discard

**One deletion in `FieldRow`.** Contact, Test Bed, Reference and Account lose
it together, per R4's accepted blast radius. `rows.discard(name)` survives and
is not dead code: it is the revert semantic, and A3 rebinds it to Escape.

### A3 - Escape reverts, then closes

**One line**, at `FieldRow`'s `onRequestClose`. Discard first, so the row
closes onto the restored value.

**It raised the conflict that stopped the phase**: Escape is the only close
path, so revert-on-Escape made "close without discarding" unreachable, taking
two contract behaviours beyond the one R3 retired. **John ruled option (a)**,
and all three are superseded **in writing at their recorded sites** with the
reasoning of record: A1 moves the unit of editing from the row to the form, so
the row-as-unit guarantees have no basis.

**11 tests went red and were disposed one by one**, not deleted: 4 re-pointed
to Escape, 1 inverted in place, 4 re-pointed to the new contract, 2 given a key
press where they clicked a control.

### A2 - the open editor closes when focus leaves the row

**Measured before building, because "focus highlight" named nothing findable.**
There is no CSS focus rule on the row. On the live screen, opening `company`
then `jobRole` left company reading `open: true`. **The open editor IS the
highlight.**

**It closes; it does not revert.** `rows.close`, deliberately not the Escape
path - wiring blur to Escape would revert on every field change and make
multi-field editing impossible.

**And it corrected a supersession written hours earlier.** Behaviour 6's
retirement was written when Escape was the only close. A2 adds a second close
that keeps the draft, so the clause is **retired under Escape and restored
under blur**:

| gesture | editor | draft |
|---|---|---|
| Escape | closes | **reverted** |
| focus leaves the row | closes | **kept, still counted** |

### A4 - edits live only until saved or discarded

**The one genuine regression, fixed at the class.** Back now warns when dirty,
matching unqualify, park and link-account, which all guarded this way already.
And `useFieldRows` gains a `subject`: when it changes, every draft and open row
is dropped, **compared during render** rather than in an effect - an effect
runs after the first paint, so the new record would render once carrying the
old record's drafts.

### A5 - the door on the Lead view, and it has THREE parts

Phase 0 measured that this view had **no door at all**.

**A first attempt did two parts and A6 caught the third.** The door probe read
0 write controls reachable; A6 then **opened an editor** on the same unowned
lead. Two instruments disagreeing was the finding.

The third part is the **row's own guard**: `CAN_EDIT_BY_VIEW['contact-detail']`
was a literal `true`. The class stops a mouse; **the register is what stops a
row opening.**

**And it was true by a PRIOR RULING**, stated in `app.js`: *"Phase 0 of Rounds
2 and 6 measured NO ownership read on either surface, so inventing one would be
the migration adding behaviour. They are open by ruling, not by omission."*
Correct when written; A5 is a deliberate decision to add it. **Struck in place,
not corrected.** **`account-detail` is unchanged** and keeps that ruling.

**The register and the class are written DURING RENDER**, matching
`TestBedView`, because the row asks during its own render.

```
record     is-not-mine  controls  write  write-REACHABLE  nav alive
not mine   true               38     20                0          1
mine       false              38     20               20          1
```

**The five named writes are asserted BY NAME**, because 0-reachable is equally
satisfied by a view that rendered none of them:

```
fields    15 present, 0 reachable  |  15 present, 15 reachable
qualify    1 present, 0 reachable  |   1 present,  1 reachable
nurture    1 present, 0 reachable  |   1 present,  1 reachable
addNote    1 present, 0 reachable  |   1 present,  1 reachable
followUp   0 present              <-  NOT YET RENDERED, declared
```

**`followUp` has no surface** - P1 said so - so its zero says nothing about the
door. It is a **declared** absence and **shrink-only**: when P3 renders it,
`present` moves off 0 and the probe goes **red**, telling the next person to
assert it. A control cannot arrive uncovered.

### A6 - an unowned lead shows the owner's saved data

John's acceptance test, verbatim:

```
editor opened on an unowned lead:  false
after navigating away and back:    "Door Holdings", 0 changes, bar hidden
```

**A5 stops the edit being made; A4 stops any edit that was made from outliving
the visit.** Neither does it alone, which is what "resolved by A4+A5" means.

Screenshot read per Verification 4: Link to Account and Add note visibly
dimmed, every value readable, BACK alive.

---

## 3. A DESIGN CONSEQUENCE FOR P3 TO INHERIT, not resolved here

**Ruled a P3 spec matter, settled off-session; recorded so P3 inherits it.**

A3 makes one state unreachable: **a collapsed row can never show a pending
edit.** A display only renders while its row is closed, and the only close that
does not revert is blur - after which the row is closed and the display shows
the saved value, not the draft.

> **So "what has changed but is unsaved" is carried entirely by the header
> bar's count.**

That matters for P3 because the Lead Detail spec has **collapsed-by-default**
Contact Details and Address panels: a pending edit inside a collapsed panel is
invisible except as a number in the header. The resolution code for rendering a
draft is still correct on saved values; what has gone is a reachable state, so
it is also **possible dead capability**.

---

## 4. Two process faults of mine, and the second is the one that matters

**I committed a red tree twice**, both times the same way: checked the **react**
suite, saw green, committed with the **pure** suite red.

| | |
|---|---|
| `daa90af` | react 932/932, pure **511/512** - four probes calling `fetch` directly |
| `8ceaaf2` | react 938/938, pure **510/512** - two tests enforcing the ruling A5 supersedes |

**Both reds were correct and both were estate guards doing their job.** The
first refused a direct `fetch` because it bypasses the throwing client; the fix
was to move onto the client, not to add four names to an exemption list. The
second was two tests enforcing the prior open-by-ruling decision; the fix was
to invert them, not delete them - a deleted test leaves the door unguarded in
both directions.

**The second time is the finding.** `aac7561` was me catching this exact fault
and writing it up, and it recurred four commits later. The rule is not missing:
*"which script runs this file?"* is in `CLAUDE.md` under Verification 20 and I
quoted it at myself. **What fails is that checking one suite feels identical to
checking the suite.**

**Carried as a candidate for a mechanical answer** - a single command that runs
both, or a pre-commit check - rather than a third restatement of a rule that
has now failed twice in one phase while being known.

---

## 5. Three times the suite was green and the screen was wrong

Recorded together because it is the standing verification earning its place
rather than being cited.

1. **A1/A3**: the probe **refused to run** on a stale bundle, first use of the
   P1 standing requirement.
2. **A4**: the unit test passed with the bug still on screen. I keyed the reset
   on `contact.id`; the probe navigates away and back to the **same** lead, so
   the id never changed. Fixed by keying on the **visit**.
3. **A5**: 938 react tests green, door probe green, and **A6 opened an editor**
   on an unowned lead.

---

## What P2 does NOT establish

- **Nothing about `followUp`'s door**, which has no surface until P3.
- **`account-detail` is untouched** and still open by ruling.
- **No gate run.** That is the round close.
- **The A9 consequence is recorded, not resolved** - P3's to settle.
- **P3-P5 remain blocked on the mockups.**
