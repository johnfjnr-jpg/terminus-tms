# Phase 1: the recovery, and a live defect it made visible

**Stopped for sign-off. Nothing pushed.** Three commits on
`round-testbed-recovery`: `dc04176`, `6119dcc`, `7ce15a0`.

---

## What is NOT finished, first

`CLAUDE.md` build discipline 15: the first section about an unfinished item
says it is unfinished, before any account of what was done.

### The gate is UNANSWERED, not green, and it says so itself

```
22 of 24 stages passed, 2 NOT RUN.
1 REQUIRED stage did not run, so this gate is UNANSWERED, not green.
```

Both skips are `no browser (set PUPPETEER_PATH)`: **`HTTP readonly-view probe`**,
which is marked `required`, and `browser dependency is functional`. No scratch
browser is installed on this machine.

**That is valid for an ordinary run and NOT valid for a round close.** The
close needs `npm i puppeteer --prefix /tmp/tms-probe` and a re-run with
`--round-close`. Nothing about the door has been measured by this gate, and I
am not offering the 22 as evidence about it.

The live verification below went through the in-app browser, which is a
browser but is not that probe.

### Not attempted this round, unchanged from the brief

Admin-catalog rates and the Use Cases taxonomy are deferred as NEW work.
John's walk layout items are their own round. `INTERACTION_STANDARDS.md`
sections 6/8/9/10 still describe the retired `test-bed-detail.js`.

---

## The four items

| | what shipped |
|---|---|
| **L1** | The breakdown renders: four cards, Total Cost first, in its own `Itemized Cost` section below the rate grid. Both `unknown` types replaced by the engine's return. No warranty. |
| **L2** | `Qualification score` card restored, reading the record payload. `ScoreEntry` widened to what `score-entry.js` writes. |
| **L3** | Four rate cards again, units back in the titles. `tb-card-commercials` retired, four call sites re-pointed. |
| **L4** | Reference sub-tab strip restored. Only the open pane renders. Roving tabindex and arrow keys reproduced. |

### L1, and the part worth stating plainly

**Nothing about the engine changed.** The breakdown has been computed on every
keystroke since the migration and discarded: the route answered, `setPreview`
held it, and nothing read it again. `costBreakdown.ts` reads
`calculateTestBedCost`'s own output and computes nothing - the summary card's
three category figures are `rawTotalCost` off each group, and the engine's
`totalCost` is already the sum of exactly those three.

**`*Cost` only, never `*Price`.** `buildCostGroup` computes prices as a side
effect of being shared with the priced Opportunity path. The test fixture gives
every price a value DIFFERENT from its cost, so reading the wrong field cannot
coincide, and asserts none of the twelve price figures is rendered.

**Total-first is measured rather than chosen**, and the vanilla recorded the
measurement: total-last costs 185px of fold because the three category rows
push it down; total-first costs 45px, which is the card's own chrome.

**The warranty is DROPPED, per the ruling, and the discriminating test is the
one that matters.** A test against the real `warrantyPct: 0` data would be true
by absence and would pass on a renderer that still carried the conditional. The
test feeds a NON-ZERO warranty - a state the route cannot produce - and requires
the row to still be absent.

### L2, and why the obvious wiring would have shipped an empty card

The host's `seriesByKey` is populated **only** by the response to
`POST /scores`. On a fresh load it is `{}`, so a card reading it would print
`Not scored` against every criterion on a fully scored record - indistinguishable
from a correctly empty one. The scores live in the record payload, which is
where the vanilla read them.

---

## THE LIVE DEFECT THIS ROUND MADE VISIBLE, AND FIXED

**`onDraftsChange` ran as an effect inside `TestBedPanel`**, which is the
Reference pane. `StageTabs` renders `active === 'reference' ? panel : null`, so
it stopped firing the moment last round moved the cost fields to the Commercials
tab. **Typing a sensor count there scheduled no preview at all.**

**Nothing could see it while the container rendered two words.** A preview that
never arrived and one that had looked identical.

**Filling the cards made it visible, and in the worst way.** The labels follow
the drafts because they are read during RENDER rather than from an effect, so
the screen showed:

```
SafeSight (12 × $4,200)        $0
```

which is the self-contradicting row the vanilla's own comment exists to prevent.

**Found in a browser, not by a test**, and the diagnosis went through the
cause's own answer rather than the symptom: the route was called directly and
answered `200` with exactly the shape the narrowing requires, which ruled out
both a dead route and a rejected response and left the scheduling.

**Fixed here rather than carried.** Build discipline 10's limit: a defect the
round made visible by making its neighbour correct is finishing the work. The
reporting now lives on the host, beside the store it reads - the same reasoning
that lifted the store in R1.

**And its test opens the Commercials tab before typing**, because an assertion
on the Reference tab passes against the defect.

---

## Verification

### The figures match the route, read from the response in the same run

On an owned fixture, with `12` cameras at `$4,200`, `$500` install, `$35`
hosting and `36` months typed through real keystrokes:

| | |
|---|---|
| rendered figures compared against `POST /api/test-beds/calculate` | **10 of 10 match** |
| undefined on either side | **0** (both sides required to exist before comparing) |
| Total Cost | `$71,520`, and `$50,400 + $6,000 + $15,120` sums to it |

Not hand-recomputed. `CLAUDE.md` Verification 20's addendum: a hand-computed
expectation that happens to agree today is the bad case.

### The score card was made to discriminate

An unscored record makes a working card and a broken one look identical. A
score was recorded **through the real route**, and the card then read:

```
Rollout Path                              3   Qualification
Client Commitment                 Not scored
Clear Use Case Requirements...    Not scored
Physical Suitability              Not scored
Data Rights                       Not scored
```

### Looked at, at two widths

| | 1240 | 1920 |
|---|---|---|
| breakdown cards | 2 rows of 2 | 3 across, 4th wraps |
| horizontal overflow | none (1240/1240) | none (1920/1920) |
| Total Cost above the categories | yes | yes |

Total is `15px/600` against three `13px` rows; itemized values are dimmed at
32% alpha, summary and total full white; the subtotal rows carry a `1px`
divider and the summary rows `0px`, which is the vanilla's deliberate split.
**The dimmed itemized treatment is absent from the total** - the Round 15
Phase 4 defect Verification 4 is written from is not reproduced.

### The suite, and the calibration

| | |
|---|---|
| React suite | **1025 -> 1066**, 57 files, read from the run |
| pure suite | 553/554 pass, 0 fail, 1 skipped |
| database suite | **102/102** |
| injections | **19 of 19 FIRED**, anchored on the named test, **reverted byte-for-byte** |

The harness verifies its snapshot before injecting, compares bytes after every
injection, refuses a non-unique anchor, and writes an in-flight marker so a
killed run cannot have its mutation blessed as the original. Its uniqueness
guard fired on the first run, before touching anything.

**No injection came back silent**, so no claim in these tests is unasserted.

---

## What the controls caught, recorded because they are the point

- **The pre-commit hook refused the first commit** on a red database suite that
  was not mine: `scripts/fixtures.mjs` held four absolute paths into a dead
  agent session's temp directory. Fixed as its own commit, `dc04176`. It had
  broken by the passage of time rather than by a commit.
- **A fourth constant was found by a comment-stripped scan** after three were
  fixed by eye.
- **The id guard refused the next commit** on `id="tb-ref-subtabs"`, which
  `index.html:1025` still carries in the retired block. No DOM id collided - the
  value is a prefix - but a prop called `id` that is not an id is a name
  asserting something untrue, so it became `idPrefix` rather than an exemption.
- **A test found a real bug in my own code**: `CSS.escape` is undefined in
  jsdom and threw out of the keydown handler. Removed rather than guarded.
- **Two classes I invented had no stylesheet rule**, and the vanilla
  distinguished two subtotal treatments I had conflated into one.

---

## Carried, not fixed

- **`setScoring` is never called anywhere in `TestBedHost.tsx`**, so `scoring`
  is permanently `{}`. It feeds the stage panel, not this card. Not this round.
- **`StageTabs` has no roving tabindex and no arrow keys.** The sub-strip
  reproduces both; the stage strip beside it does not.
- **Four more baked-in session paths**, in `census-form-identity.mjs`,
  `contact-mode/calibrate-cmode.mjs`, `contact-swap/calibrate-r8.mjs` and
  `testbed-header/calibrate-grid-reconcile.mjs`. None is in a gate suite.
- **`INTERACTION_STANDARDS.md`** sections 6/8/9/10.

---

## Housekeeping

The fixture and its Account were torn down and **confirmed by re-querying
`deleted_at`**, not by trusting the delete's own result. Live Test Beds are
back to 10. The dev-session copy of the token was deleted and the mount is
404 again.

`CURRENT_STATE staleness` passed: no watched source changed.

---

## The walk

John walks the Commercials tab: enter sensor counts, watch the costs appear and
update, and check the two totals read clearly - `Total cost (saved)` in the
header strip against `Cost summary / unsaved` in the card.

**That pair is the one thing here that no assertion settles.** Both labels are
asserted present and correct, and whether they are legible enough to tell apart
in use is a property of a person reading a screen.
