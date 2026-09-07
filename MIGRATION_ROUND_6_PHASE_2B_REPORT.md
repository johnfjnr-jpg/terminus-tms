# Migration Round 6, Phase 2b: the capability gap, the family, and the swap

Session of 2026-09-07.

---

## Nothing is unfinished

The swap is taken. All seven capabilities are built and walked live. Two
findings are recorded and queued, both belonging to code this phase did not
write, and both named below.

---

## 1. The accounting instrument

`scripts/tests/surface-accounting.test.mjs`. It asks the question a field census
cannot: **is every top-level name in the file claimed by an enumerated
capability?** A name nobody has claimed is a capability nobody has written down.

**AND IT COUNTS `window.X = function`, WHICH PHASE 0's INVENTORY DID NOT.** That
scan anchored on `function`/`var`/`const`/`let` at line start and reported **61
names where there are 76**. Among the fifteen it could not see:
`attemptContactUnqualifyFromDetail`, `openAccountDetailsModal`,
`deleteContactFromDetail`. Verification 50's clause, hiding a fifth of the file.

**Calibrated three ways**, each restored byte-identical:

| injection | result |
|---|---|
| a new unmapped name in the source | fires |
| a map entry naming something the file no longer has | fires |
| removing the window-form matcher | fires **two** tests - the Phase 0 failure, reproduced deliberately |

### The verdict: SEVEN capabilities, not the five the screenshot showed

All 76 names map. Two more were flagged than a screenshot could show:

**`stage-actions`** - `renderCdActions` draws Qualify, Park **and** Move to
Unqualified. The Phase 2 panel had only Qualify, so the capability was **two
thirds absent while reading as present**. A screenshot shows that as "a button
is missing"; an accounting shows it as a claim nobody made.

**`layout`** - `syncCdBelowGridWidth` aligns the below-grid block to the card
row. Invisible in a flat column, and visible the moment the cards exist.

**It is a standing Phase 0 item now.**

---

## 2. The re-navigation family

**Measured before fixed**, because reading is not measuring and these are
surfaces in production. Driven through the harness `main.tsx` actually uses -
one root, re-rendered per navigation.

| view | detailLoaded across two navigations | record on the second |
|---|---|---|
| **AccountView** | **1** - `is-loading` never clears | **cached** - a rename made elsewhere stays invisible |
| **ApprovalView** | **1** - `is-loading` never clears | not separately measured |

ApprovalView is the one that matters most: it shows **who has approved what**,
and serving a cached answer to somebody deciding whether to approve is the
wrong-green Round 38 recorded.

Fixed per the proven Contact pattern - no dependency array on `detailLoaded`, a
refetch keyed on the navigation token. Build discipline rule 8: the fix is
scoped to what the event did, not to the instance the failure named.

**4/4 injections**, each restoring the defect on **one** view, so the class fix
is shown to be three fixes rather than one that leaked.

### And the fourth injection was SILENT twice, on the same claim

Freezing the token in `main.tsx` changed nothing, because every test passed the
token in as a prop and **none went through `register()`**. The claim was true,
relied on by three views, and asserted nowhere.

The assertion I then wrote counted `detailLoaded` - **which fires on every
render regardless of the token** - so it came back silent again. The token's only
observable effect is the **refetch**. Verification 51 twice over on one claim.

---

## 3. The five capabilities

Enumerated first in `MIGRATION_CONTACT_CAPABILITIES.md` as **N1-N9, P1-P9,
U1-U3, D1-D3, A1-A6**, written from the vanilla before any of it existed, and
the tests derived from that document rather than from the code.

**12/12 injections**, one per behaviour family, reverted green, five files
byte-identical. Each restores the shape the vanilla had a **reason** for, so
each asserts a ruling rather than an implementation detail.

### P8 needed a different answer in React

The park form is a fixed full-screen popup, and the vanilla closes it with a
direct DOM write **before** opening the discard dialogue - otherwise *"Keep
editing"* points at a Save button nobody can reach.

Calling `onCancel()` only **schedules** that, and React batches it, so the
dialogue opened with the popup still covering everything: **the exact defect P8
exists to prevent, reproduced by the framework rather than by forgetting.**
`flushSync` is the fix, and the test reads whether the form is still in the DOM
at the moment the dialogue is asked.

### And the duplicate-id detector paid for itself a second time

Every other Contact component reproduces the vanilla's ids on purpose, because
they render inside the container `createRoot` clears. **The account-details
modal does not**: its vanilla markup is at `index.html:2849`, **outside** the
view, so both copies would have been in the document - the arrangement that sent
the Reference tab's focus to the wrong button. Caught before it shipped.

Its **rot guard** also fired correctly: `ContactHost` stopped clashing when the
Qualify button moved into `StageActions`, and a dead exemption would have waved
through the next real one.

---

## 4. The swap, retaken

The tag is out. All seven capabilities are built, and
`surface-accounting.test.mjs` is what says so rather than an impression - which
is the difference between this swap and the one Phase 2 held back.

### The walk: 50/50, residue 0

The 35 checks from Phase 2, plus the five capabilities live:

| capability | measured |
|---|---|
| **notes** | an empty history says so; a note written on screen is **on the server** and **listed** |
| **park** | the record moves to `Parked`, the follow-up date is recorded, and the reason is **prose on the same list** |
| **unqualify** | the record moves, **the control withdraws** because it no longer applies, and Qualify is offered again |
| **the modal** | a blocked Account with no match opens the creation form, the company is carried in, and creating it **links it in one write** |
| **delete** | the record is gone, and the screen returns to **the view it came from** |

**One fixture per capability, and that is a correction rather than a style.**
Threading one record through five state changes made every later check depend on
every earlier one: linking an Account for Park removed the very condition the
modal check needs, and writing through the API after the page had loaded
produced a **409 that read as a park defect**. It was the handshake working.

### FINDING: a configured gate rule the stage order makes unreachable

**`Parked` is `sort_order` 3 with `reachable_from_any_stage: false`**, so
`Unqualified -> Parked` skips `Qualified` and the route refuses it:

```
cannot skip stages: Parked is not the next stage after Unqualified
```

**Measured directly at the route**, for any client, so the vanilla hits the same
wall. And a `stage_gate_rules` row nonetheless exists for that transition
requiring `followUpDate`: **configured, and unsatisfiable from inside the
product** - the shape `transitions.js`'s own comment names. Queued, not this
surface's to fix.

**The walk found it the honest way.** P2 writes the note **before** the move, so
the reason was already recorded when the move was refused - and the failing
check carried **the route's own sentence** rather than just "it did not move".

---

## 5. The visual comparison

**19/19** at three widths, still asserting its two captures are of **different
implementations** before comparing them.

**The Phase 2 divergence is fixed by adopting the application's own classes
rather than inventing any.** `.pg-card` and `.pg-card-title` already carry the
hairline border and the mono uppercase title every other card uses, and
`.ref-cards` is the auto-fit grid the Reference tab and the vanilla Contact view
both sit in. A `.cd-card` beside them would have been a second definition of one
look.

| | before | after |
|---|---|---|
| view height at 1920 | 1184 | **956** |
| cards across at 1920 | none - one flat column | **three** |
| at 1240 | one column | **reflows to two, then one, with no media query** |

### Three divergences remain, and all three are deliberate

1. **The name is a `FieldRow`, not an H1** - the same departure the Reference
   tab took, so the name has a door, a discard and a draft like every field.
2. **The edit bar sits at the bottom**, not Cancel/Save top-right. Field-row
   contract, behaviour 6.
3. **The status tag sits on the eyebrow line.** Wedged between a
   label-and-value row and the company subtitle it read as a third unrelated
   line; on the eyebrow it reads as what it is - the stage.

### And the seventh capability is satisfied by construction

`syncCdBelowGridWidth` exists because the vanilla measures the card row in
JavaScript and copies its width to the block below. The React surface is in the
CSS grid, so that block **is** that width already. Recorded as
met-with-no-counterpart rather than marked migrated without saying how.

---

## Findings

| # | finding | state |
|---|---|---|
| S8 | `Unqualified -> Parked` is a configured gate rule the stage order forbids | **queued**, server-side, affects the vanilla equally |
| S3b | the re-navigation family on `AccountView` and `ApprovalView` | **fixed here**, measured first |
| S9 | Phase 0's declaration inventory undercounted by 15 | **fixed** by the accounting instrument |
| S10 | the account-details modal would have duplicated live ids | **caught before shipping** |
| S7 | `email` and `mobile` cannot be emptied - the route validates format on `''` | **carried** from Phase 2 |
| KC1 | the `key-contacts` GET route does not exist | **carried** from Phase 1 |

---

## Surprises

**An expect matcher, not a missing detector, was what a silence meant FIVE
times this round.** A test aborts on its **first** failing assertion, so a
matcher taken from a later assertion never appears - and once, the injection
broke a test's **sibling** rather than the obvious one. The lesson is narrower
than "anchor on test names": anchor on the test the injection actually
falsifies, which is not always the one it was written for.

**The instrument that found the Phase 2 gap would have found it in Phase 0.**
It is forty lines. What it cost to not have was a swap taken and reverted.

---

## Gate

**All 21 stages passed** on `dce5803`, and again on the commit this report lands
in.

Pure 469/469, database 94/94, react 580/580, all 0 fail, typecheck clean, 14
HTTP probes. Every figure parsed from the run.

**Not pushed. Phase 3 follows on sign-off.**
