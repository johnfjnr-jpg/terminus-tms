# Migration Round 4 close-out: the version card

Closed 2026-09-06. Phases 0, 1, 2 and 3, and the first deletions under the
retirement policy.

---

## Against the brief's exit gate

**1. The card works against both forms, proven on the swapped tree and the
reverted branch.**

Proven, and on four configurations rather than two. `works-under.mjs` touches
only ids both cards render and both forms provide, and reports which pair it
actually ran against rather than assuming:

| configuration | card | form | result |
|---|---|---|---|
| the swapped tree | REACT | REACT | 9/9 |
| the card alone reverted | VANILLA | REACT | 9/9 |
| the form alone reverted | REACT | VANILLA | 9/9 |
| both reverted | VANILLA | VANILLA | 9/9 |

Each configuration also failed **exactly** its declared ledger assertions and
nothing else, and `index.html` came back byte-identical from each.

**2. The primary write path walked live in the swap session and again at
close.**

Phase 2: 37/37. Phase 3: 39/39, the same recipe plus two spot checks that the
form beside the card still saves, read back from the server rather than from
the screen that wrote it.

Save from a clean form with no deal revision; save from a dirty form with the
deal saved first and the version freezing the saved value; issue; the
reporter's requesting state surviving a re-render; the reconciliation refusal;
restore fidelity asserted field by field including UI state; a newer draft
taking the ask back.

**3. The coupling and re-point ledgers updated with instruments; the
retirement policy's first deletions landed.**

Both done. Ledgers below; deletions under *Retirement*.

---

## Finding 1, which is what this round will be remembered for

Phase 2 found it by looking, and Phase 3 diagnosed, fixed and calibrated it.
It is worth reading as three separate lessons, because the first fix was
wrong and the second was inert.

**The defect.** A person types a reason, presses *Save version*, and the card
answers *"A reason is required"* with their reason still on screen. Or the box
is short by a few characters, or holds the previous version's reason with the
new one appended.

**The mechanism, by instrument.** Three candidates were named up front and all
three were falsified: `containerSwaps 0` and `containerDetached 0` (the
container never moves), `cardMounts 1` with `cardUnmounts` never (the card
never remounts, so no re-render ever reset its state). The reason-state history
is where it showed: a save cycle began at **53** characters rather than 0, and
dropped to **0 mid-typing** twice.

`onSave` runs a refusal check, a freeze that SAVES the deal, a POST and a full
refetch, and the card cleared the box only after all of it. So the box held the
reason that had just been sent for the whole chain, a person starting the next
one typed on top of it, and the trailing clear then took what they had typed.
**0, 5, 24, 38, 44 and 46 characters survived where 52 were typed.**

**The fix is the clear's position.** The box is cleared at SUBMIT, because it
belongs to the next version from that moment: nothing stale to type over, and
nothing late to wipe what was typed since. A refusal gives the reason back only
into a box nobody has started using.

**AND CALIBRATION KILLED THE FIRST TWO SHAPES OF IT.** This is the part worth
keeping.

- **The first fix disabled the box for the duration.** It read green and was
  worthless: with the box disabled, the only assertion that could fail was the
  one asserting the box was disabled. It also drops a person's keystrokes
  rather than protecting them.
- **The re-entrancy guard could not fire in either direction.**
  `if (saving) return` - two clicks in one tick both read the same stale
  `saving === false` from their own closure, and any later click is already
  refused by `disabled={saving}`. Present, reassuring, unreachable. It is a
  ref now, and the test fails when it is removed.
- **The first probe scored 1 of 4, and its one hit was the assertion that the
  guard exists.** It typed, settled, clicked, and waited for the button before
  going round again, so it never typed while a save was in flight - which is
  the entire defect. Rewritten to type DURING the chain, it reads
  **`kept "" (0 of 36)`** when the clear is moved back.

**Final calibration: 4 of 5 injections detected across two detectors.** The
fifth, init idempotence, is silent and stays silent: the diagnosis falsified
the premise it rested on, so it is a work reduction with no behavioural
signature and no detector can exist. Said out loud rather than left as a gap,
per Verification 51.

Evidence: 147/147 browser probe over three runs, 485/485 react, 463/463 pure.

---

## Retirement, per the ruled one-round confidence window

Two commits, each verified as two claims.

| file | swapped | stood through | deleted |
|---|---|---|---|
| `frontend/opportunity-approval.js` | Round 1 | Rounds 2, 3, 4 | `a3472e1` |
| `frontend/account-detail.js` | Round 2 | Rounds 3, 4 | `d879b28` |

**Claim 1: the file is gone.** Both confirmed absent.

**Claim 2: nothing that remains asserts against it.** Confirmed with the
repository's own comment stripper rather than by eye: **no CODE in any file
names either deleted file.** Every surviving mention is prose recording that it
was deleted. Neither appears in the live markup with comments stripped, and
both React mount containers survive.

Retired in the same commits, so nothing is left asserting against a ghost: two
unloaded-file assertions, two revert comments describing escape hatches that no
longer exist, and six prose claims that named the files as live - one of them
with a line number. That last group is the Verification 41 STRINGS case: a
claim in prose cannot fail, so it has to be found by looking.

**Due at Round 5's close:** `frontend/opportunity-deal.js` (2,255 lines),
`frontend/opportunity-deal-versions.js` (652), `frontend/deal-feedback.js` (36,
imported only by those two so it retires with them), and the parity suite
(`deal-payload-parity.test.ts`, 221 lines).

---

## The estate ledger

**Loaded vanilla, measured from the live markup with comments stripped:**

| file | lines |
|---|---|
| `frontend/app.js` | 8,827 |
| `frontend/test-bed-detail.js` | 3,261 |
| `frontend/contact-detail.js` | 1,328 |
| `frontend/opportunity-reference.js` | 1,056 |
| **total still loaded** | **14,472** |

**In tree, unloaded, awaiting their window:** `opportunity-deal.js` 2,255,
`opportunity-deal-versions.js` 652, `deal-feedback.js` 36.

**React:** 5,501 lines of source, 5,648 of tests, in a 325,877-byte bundle.

**Coupling ledgers, with their instruments:**

| ledger | file | lines |
|---|---|---|
| the deal form | `vanilla-coupling.test.mjs` | 101 |
| adopted identity | `adopted-identity.test.mjs` | 86 |
| the version card | `version-card-coupling.test.mjs` | 71 |

**Re-points landing on `frontend-react/src/versions/`:** the two
`transition-requests` blocks (their second move; D2c took them from the form to
the vanilla version file), and `FINDING 5`'s version half, which gained an
assertion that `scheduleReconciliation` runs before `freezeCurrentState`.

---

## The queue

**Finding 2, pre-existing: a superseded version can print a sentence that names
nothing.**

> `SUPERSEDED. Approved at revision 2, and the pricing has changed since: . Take a new version and have it approved.`

The React `approvalLine` is byte-faithful to the vanilla's, so this is not new.
**Whether it is reachable with real data is itself the finding**, and it is a
Verification 20 shape: `src/lib/version-pricing.js:143` computes
`changed: payloadsDiffer(now, was)` and `keys: changedKeys(now, was)` as two
independent readers of the same question, side by side. `superseded` is set
from `changed`; the sentence is built from `keys`. They agree today as far as
anything measures; nothing proves they must.

**Finding 3, pre-existing: the sentence explaining a disabled ask is capped at
32 characters' width.** `.pricing-approval-state` carries
`max-width: 32ch; align-self: center`, so at 1240 **and** 1920 the explanation
wraps to four lines in a ~200px column with 1500px free beside it. The
`align-self` has been inert since the walk of 2026-09-03 moved that `<p>` out
of the button row.

Both are recorded, scoped and queued under rule 10 rather than taken into this
round.

---

## Rules

Two extensions, no new numbers, numbering byte-identical at 81 items.

**Verification 9 reaches the guard, not only the detector** - the same
broadening the Round 40 close made, one step further, from "anything whose job
is to notice" to anything whose job is to PREVENT. Same remedy: remove it and
watch something fail. Two inert guards in one session, both mine, both believed
correct on review, both killed by calibration.

**Verification 6 gains the write side** - a controlled input is not written by
writing its DOM value. React's per-input value tracker dedupes a synthetic
write once the component has persisted, so the DOM shows text the component
never received. That reads exactly like a controlled input diverging from its
own render, which is impossible, and cost several measurement cycles.

**Declined:** "refresh freely before probes, never before the gate" is already
the last line of build-discipline rule 16, used as written this session.
"Presence is not availability" is Verification 27's action already - a person
does not experience a hidden control.

---

## Round 5 entry context

What remains vanilla and loaded is **14,472 lines across four files**, and the
shape of the remaining work is not even:

- **`app.js`, 8,827 lines**, is the shell: routing, `ALL_VIEWS`, the detail
  loaders, the banners, and the globals every migrated surface still reads.
  Migration Round 2's queued note applies before it starts - inventory what a
  surface reads from the shell and **split the list by declaration keyword**,
  because `function`/`var` names reach `window` and `let`/`const` names never
  did.
- **`test-bed-detail.js`, 3,261 lines**, and **`contact-detail.js`, 1,328** are
  detail surfaces of the kind already migrated twice.
- **`opportunity-reference.js`, 1,056 lines**, is the reference tab.

Three carried items restated so they are not rediscovered:

1. **The deal form and the parity suite fall due at Round 5's close** under the
   retirement policy, together with `deal-feedback.js`.
2. **Six of the ten version states are not walk-reachable**, because
   `decide_transition_request` reads `auth.uid()` and refuses the requester
   approving their own request. They are covered by the fixture builder and by
   the visual capture's intercept, and any round touching approval states
   inherits that constraint.
3. **The version gate applies from `Proposal` onward.** Every version-scoped
   rule in `stage_gate_rules` sits on `Proposal -> Evaluation` and later, so a
   fresh fixture at `Solution Alignment` hides the ask entirely. A probe that
   needs it must stage the record deliberately.

---

## Gate

Recorded below once the closing tree has been measured.

**Not pushed. The round closes on John's word.**
