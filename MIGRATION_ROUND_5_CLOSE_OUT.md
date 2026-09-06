# Migration Round 5 close-out: the Reference tab

Closed 2026-09-06. Phases 0, 1, 2 and 3, 18 commits.

---

## What is NOT done, first

**`frontend/opportunity-deal.js` is not retired.** Triage stated rather than
discovered, as the brief allowed.

Measured: **44 code mentions across 14 files**, of which **16 are distinct
source-shape assertions inside `commercials-wiring.test.mjs`**. Each is a
judgement, not a deletion — does the claim still hold on the React tree and
re-point, or was it about the vanilla only and retire? That is its own
session. `deal-feedback.js` retires with it, and the Phase 0 instrument's
target list now says so.

The version card retirement DID land, verified as two claims.

---

## Against the brief's exit gate

**1. All census rows pass the contract recipe live, including the door in both
directions on real ownership.**

`walk-reference.mjs`, **40/40** on the closing tree. Every editor kind opened
and typed into; the batched save round-tripped with only-dirty keys; the
suffix rendered; same-as-account flipped both ways with a boolean flag stored
and no address copied; key contacts rendered.

**The door on a record genuinely owned by somebody else**, created by admin
write: all 21 rows refuse by click, Enter, Space and seed; the same-as-account
direct input is disabled; the read-only rows carry no tab stop; and after
handing the record back, all 21 open again.

**2. The first-contact checklist has written verdicts; any amendment is a
dated contract addendum.**

Two dated addenda, both written **before** any code: the two-shape census
(21/5 and 15/11 by branch, amended at the head table as well as in the
addendum) and seven editor rulings A1–A7. A third entry carries the twelve
checklist verdicts, all CONFIRMED, with three strengthened by this surface.

**3. The retirements landed clean; the estate ledger restates the remaining
coupled counts with instruments.**

One of two landed clean; the other is triaged above. Ledger below.

---

## The defect this round will be remembered for

**Typing into a textarea row reversed the text.** `abcd` became `dcba`.

**The mechanism, by instrument** — and it was the candidate the Phase 3 brief
named:

| value | caret | same DOM node | editor mounts | editor unmounts |
|---|---|---|---|---|
| `a` | 0 | false | 1 | 1 |
| `ba` | 0 | false | 2 | 2 |
| `cba` | 0 | false | 3 | 3 |
| `dcba` | 0 | false | 4 | 4 |

`const Card` was declared **inside** `ReferencePanel`'s body, giving it a new
component type on every render. React cannot reconcile two different types, so
it unmounted and remounted the whole card subtree on every keystroke, and a
fresh DOM node starts with its caret at 0.

**An `<input>` hid it completely.** `FieldRow`'s focus effect restores the
caret to the end for an `HTMLInputElement` and not for a textarea, so every
text row read perfectly while being remounted just as hard. The textarea is
the only reason it was ever seen.

**The fix is one hoist.** After it: caret 1,2,3,4, same node, **zero mounts and
unmounts** while typing.

**Calibrated with the real defect**, not an approximation — the injection puts
`Card` back inside the render body. The jsdom suite loses three tests; the live
probe drops to 4/16 and reproduces the reversal verbatim.

**Why jsdom could catch this and did not: a caret needs layout and jsdom has
none, but a MOUNT COUNT needs neither.** It was invisible only because nothing
counted. `field-row-stability.test.tsx` counts now, across every editor kind
rather than the one that showed a symptom.

**Two Phase 2 attempts are recorded as failures.** Memoising the descriptor
identity is kept — right on its own terms — and did not fix it. A caret-restoring
layout effect was **removed**, and that removal is the more important half: a
fix that looks applied and does nothing stops the next reader looking.

---

## The Round 2 reconciliation

**Round 2's instrument lied, and git settles it without argument.**

`git log -S'.field-row {' -- frontend/style.css` returns **exactly one commit
in the entire history**: `09cce15`, this round's Phase 2. The rule did not
exist at Round 2's close, so the React field rows were unstyled then — and an
unstyled stack of text cannot share geometry with a flex two-column row.

Round 2's close-out reports **identical outer boxes** for the two
implementations: `140x1693`, `1040x1126`, `1440x834`. Two independent
renderings agreeing to the pixel on a 1693px height is not a result; it is the
signature of **one tree captured twice**. Its own clock control points the same
way: vanilla-against-vanilla 30 seconds apart differed *more* (120 and 111 px)
than the supposed migration comparison (29 and 55).

**How is not fully recoverable, and that is itself the finding: no Round 2
visual probe was ever committed.** The first committed visual comparison in
this repository is Round 4's. A claim whose instrument is gone cannot be
re-checked, only re-derived.

**The guard, extended into the method:** a comparison asserts its two captures
are of **different implementations** before comparing them, and says which one
it captured. Identical geometry between two independent renderings is a TELL,
not a result — Verification 49 arriving in the visual dimension.

**Account is now styled** by this session's rules, verified at three widths:
flex rows, a 170px mono uppercase label column, a hairline rule. 11/11.

---

## What looking found that no assertion could

Five defects, none of which any programmatic check saw. All are fixed.

1. **The migrated field row had no styling at all** — and had not since Round 2,
   on the Account surface too.
2. **`display: flex` overrode `[hidden]`** on the row's edit half: every closed
   editor rendered while every attribute assertion passed.
3. **The shared edit bar** did the same — "0 CHANGES" on every load. Mine, from
   Phase 2.
4. **The Account name editor** did the same, and had sat open beside the
   account name **since Round 2**.
5. **An empty row collapsed to height 0** and could not be clicked at all —
   width 1236, height 0, visible, not hidden. jsdom has no layout, so 550 tests
   passed on a row a person cannot reach.

`scripts/tests/hidden-not-overridden.test.mjs` now forbids the cascade behind
2, 3 and 4, calibrated in both directions.

---

## The estate ledger

**Loaded vanilla, from the live markup with comments stripped:**

| file | lines |
|---|---|
| `frontend/app.js` | 8,848 |
| `frontend/test-bed-detail.js` | 3,261 |
| `frontend/contact-detail.js` | 1,328 |
| **total still loaded** | **13,437** |

Down from 14,472 at Round 4's close: the Reference tab's 1,055 lines are
unloaded.

**In tree, unloaded:** `opportunity-reference.js` 1,055 (due at Round 6's
close), `opportunity-deal.js` 2,255 and `deal-feedback.js` 36 (both overdue,
triaged above).

**Deleted this round:** `opportunity-deal-versions.js`, plus five instruments
and harnesses that retired with it.

**React:** 6,357 lines of source, 6,801 of tests.

**Coupling ledgers, with their instruments:**

| ledger | file | lines |
|---|---|---|
| the Reference tab | `reference-coupling.test.mjs` | 172 |
| the deal form | `vanilla-coupling.test.mjs` | 101 |
| adopted identity | `adopted-identity.test.mjs` | 89 |

The Reference ledger runs **both ways** and carries a **strings** ledger with a
disposition per file, because a pattern cannot tell a path being read from a
claim inside a data structure.

---

## Rules

Four extensions, **no new numbers**, numbering byte-identical.

- **Verification 14** gains *true by absence*: an assertion satisfied because
  the thing it is about does not exist. Pair every "not in" with one asserting
  the thing exists.
- **Verification 9** reaches *a fix*, which is worse than a dead guard,
  because it stops the next person looking.
- **Verification 4** gains *an attribute assertion is not a visibility
  assertion*, and unlike rule 4's own remedy this one is automatable.
- **Verification 47** gains *the state one account cannot reach*, with the two
  conditions that keep an admin-write fixture honest.

---

## Round 6 entry context

**13,437 lines still loaded, across three files, and the shape is uneven.**

- **`app.js`, 8,848 lines** — the shell, not a surface: routing, `ALL_VIEWS`,
  the detail loaders, the banners, `CAN_EDIT_BY_VIEW`, and the ownership sweep
  this round twice had to reason about. **Migration Round 2's queued note
  applies before it starts: inventory what a surface reads from the shell and
  split the list by declaration keyword**, because `function`/`var` names reach
  `window` and `let`/`const` names never did.
- **`test-bed-detail.js`, 3,261 lines** and **`contact-detail.js`, 1,328** are
  detail surfaces of the kind now migrated three times. Both use the field-row
  pattern this round proved on its birthplace.

**Three carried items so they are not rediscovered:**

1. **`opportunity-deal.js` and `deal-feedback.js` are overdue**, with the
   44-mention list as the work list and 16 judgements in
   `commercials-wiring.test.mjs`.
2. **`opportunity-reference.js` falls due at Round 6's close** under the
   one-round window.
3. **The version gate applies from `Proposal` onward**, and one account cannot
   transition a record there — `decide_transition_request` reads `auth.uid()`.
   Any probe needing that state stages it by admin write, per the Verification
   47 extension.

---

## Gate

Recorded below once measured.

**Not pushed. The round closes on John's word.**
