# Leads, P2: the six migration regressions

**All six built and verified. pure 512/512, react 938/938, database 100/100,
typecheck green. Nothing pushed.**

**A pre-commit hook now refuses a red tree** (section 4), ruled as the
mechanical answer to a fault that recurred while its rule was known - and it
found a live database red on its first run.

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

## 4. The red-tree fault, and the mechanism that replaces the rule

**I committed a red tree twice**, both times identically: checked the **react**
suite, saw green, committed with the **pure** suite red.

| | |
|---|---|
| `daa90af` | react 932/932, pure **511/512** - four probes calling `fetch` directly |
| `8ceaaf2` | react 938/938, pure **510/512** - two tests enforcing the ruling A5 supersedes |

**Both reds were correct and both were estate guards working**, and both fixes
were the real one rather than the cheap one: move onto the throwing client
rather than extend an exemption list; **invert** the enforcement tests rather
than delete them, since a deleted test leaves the door unguarded in *both*
directions.

**The second time is the finding.** `aac7561` was me catching this exact fault
and writing it up; it recurred four commits later. The rule is not missing -
Verification 20's *"which script runs this file?"* is in `CLAUDE.md` and I
quoted it at myself. **What fails is that checking one suite feels identical to
checking the suite.**

### RULED (a): the mechanism

> **A rule that failed twice while known is replaced by a mechanism, not a
> third restatement.**

`.githooks/pre-commit` gains a second guard - **extended, not replaced**: it
already guarded scripted edits that did not land, and `core.hooksPath` was
already set.

**What it runs, and what it deliberately does not.** The two **hermetic**
suites always: no network, no session, ~17s together, and **both red commits
above would have been refused by these alone**. The database suite needs a live
session and 40s; a hook demanding one would make committing impossible whenever
the session has expired, and **a hook people cannot run is a hook people
bypass**. It runs when a session is live and is reported **NOT RUN, loudly**,
when it is not.

**A skip is never silent** - that is the whole difference from the habit it
replaces. The round-close gate remains the authority and the script says so.

**Calibrated both ways, and end to end rather than only as a script:**

```
all green        exit 0    PASS pure 4.2s | PASS react 12.6s | PASS database 38.9s
red pure suite   exit 1    COMMIT REFUSED, naming the failure
real git commit  exit 1    HEAD unchanged, injection restored byte-identical
```

### AND ITS FIRST RUN FOUND A LIVE RED I HAD MISSED

Which is the argument for it better than anything written above. The
**database** suite was failing:

```
config-invariants.test.mjs
"the Contact gate list the React suite calibrates against still matches the rows"
```

**R5 added `company` to the Qualify gate.** `GATED_AT_QUALIFY` in
`contact-blocking.test.ts` is a **second reader** of those rows, and
`config-invariants` asserts the two against each other. **It went red the moment
the migration was applied and stayed red through the whole of P2**, because I
was running pure and react and not this one.

Fixed properly rather than by making the number agree: `company` added, and the
breakdown assertion moved 12 -> 13 rows with the card and the declaration
unchanged - **because a new gated field landing in the wrong group would still
sum to 15.**

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
- **No gate run.** That is the round close, and the pre-commit hook does not
  replace it: it consults three suites, the gate has 22 stages.
- **The A9 consequence is recorded, not resolved** - P3's to settle.
- **P3-P5 remain blocked on the mockups.**
