# Migration Round 6, Phase R: the retirement session

Session of 2026-09-06 into 2026-09-07. Act one of the round: the retirement
debt paid with designed work, before Contact is touched.

---

## WHAT IS NOT DONE, FIRST

**`frontend/opportunity-reference.js` is NOT retired.** It was measured, not
skipped, and the measurement is the deliverable for that half.

**It has exactly ONE asserter left**, and that asserter carries a claim whose
React half does not exist:

> `opportunity-dates.test.mjs` :: *the ROUTE and the SCREEN ask the same
> question, from the same file*

The route half is fine. The screen half reads the vanilla, because Round 5's
swap made that file unloaded. The obvious action is to re-point it at the React
panel. **Measured, there is nothing to point at.**

- `closeDateNeedsReason` appears **nowhere** in `frontend-react/`.
- `ReferenceHost.tsx:88` drops the key on save: `if (k === 'estClose') continue`.
- There is no close-date route call anywhere in the React reference code.

**So the claim is currently true of the route and of nobody else.** Deleting the
half would delete the only assertion a real rule has; re-pointing it would be
Verification 14's true-by-absence, which this round has already been caught by
once. It stays pointing at the vanilla, with the reasoning written at the site,
and **that single assertion is what holds the file in tree.**

### And the gap underneath it is a live defect, reported not fixed

`estClose` is **a fully editable date row on the migrated Reference tab**, and
saving it does nothing:

| | measured |
|---|---|
| rendered | `descriptors.ts:109`, editor `date`, no `readOnly` |
| on save | `continue`d out of the payload |
| alternative route | none in `frontend-react/` |
| if it is the only dirty field | `if (!Object.keys(payloadUpdate).length) return` |

A person opens Est. Close Date, types a new date, saves, and the value is
discarded silently.

**This is not new and not mine.** Round 5's Phase 1 report named it: *"estClose's
write path is the one row that is not the batched save, and it is named in the
contract rather than solved."* Under build-discipline rule 10 it goes on the
list rather than into this session, and it is now measured concretely instead
of being carried as a sentence.

**For Phase 3:** build the estClose write path on the React panel, re-point the
screen half of the dates assertion at it, then retire the file. That is the
whole remaining list.

---

## 1. The enumeration, and what it cost to be wrong about it

Sandbox deletion of `frontend/opportunity-deal.js`, snapshot-delete-restore with
full-path keys, snapshot asserted before deleting and restored bytes compared
after.

**31 failing tests across 7 files**, confirming Phase 3b's re-measurement on the
current tree. Mentions were 44 across 14 files; **a mention count was the wrong
instrument and the failure list is the right one.**

| file | failing | resolved |
|---|---|---|
| `commercials-wiring.test.mjs` | 17 | 17 |
| `transition-requests.test.mjs` | 4 | 4 |
| `latches.test.mjs` | 3 | 3 |
| `milestone-schedule.test.mjs` | 3 | 3 |
| `rate-resolution.test.mjs` | 2 | 2 |
| `opportunity-headline.test.mjs` | 1 | 1 |
| `strip-comments.test.mjs` | 1 | 1 |
| **total** | **31** | **31** |

Re-measured after the work: **1**, then **0**. The last one was
`milestone-schedule`'s percentage round trip, covered better on the React side.

---

## 2. The dispositions

Every one of the 31 fell inside the three the instruction named. **None fell
outside, so the stop condition did not fire.**

### Covered by the React corpus already (deleted with reasoning)

The census facts, the full-width rows and their dead cells, the relabelled
per-column margin, the signpost's co-appearance, the eleven margin inputs by
name, the catalog notice, the milestone percentage round trip.

**Several are covered BETTER, and the pattern is worth stating.** The vanilla
asserted **source text**; the React suite asserts **built rows and rendered
output**. `deal-panel.test.tsx` checks that the model gives a full-width row no
group keys and that no such row renders three dashes, where the vanilla matched
the expression that builds them. `deal-render.test.tsx` asserts the signpost is
never out of step **across every responsibility**, where the vanilla sampled two
branches.

### Died with the file (deleted with reasoning)

`renderCatalogNotice`, whose own comment says it exists to check the *shipped
vanilla DOM writer* rather than the notice; the halves asking whether the
vanilla left `renderDealMatrix` and `renderDealSheet` behind as dead code; the
`INSTALL_RESP_NOTES` source half of the per-option note removal.

**Each of these would now be true by absence** - Verification 14's trap, and the
reason they are deleted rather than left passing. The markup halves of the same
tests survive untouched, because `index.html` is shared and still shipped.

### Survives and needs a new assertion

| claim | where it went |
|---|---|
| the scroll boundary announces itself | re-pointed to `DealPanel.tsx`, mechanism ported verbatim |
| closing cash through ONE reader | re-pointed to `cashflow.ts`, one call site measured |
| one reader of `costIncomplete` | re-pointed to `rows.ts`, expression ported character for character |
| GST from a second read | corpus re-pointed, and widened to read the directory |
| GST has a row | **re-derived** in `deal-panel.test.tsx` |
| the hosting period travels with the figure | **re-derived** |
| two withholding lines, different money | **re-derived** |
| no rate box prefills a value nobody entered | **re-derived**, class-level |

---

## 3. The designed assertions, and this is Verification 47 work

The four re-derived assertions were written **from the rulings as the business
stated them when each defect was found**, with `rows.ts` unopened. Sources: the
unfold ruling, the census, and each claim's own recorded origin.

**Calibration did real work rather than confirming what was already believed.
Three of the four were wrong on their first writing and every one read green.**

**The GST row came back SILENT.** A bare match for `GST` over the joined row
labels passed with the GST row's label removed, because **the price row names
GST too**. The assertion could not tell *"GST has a row"* from *"something
mentions GST"* - which is the entire defect the business reported. Anchored on
the start of the label, it fires. Verification 51: the silence named the
weakness rather than clearing it.

**The prefill guard asserted my own fixture.** It mounted with a hand-written
`Values` object, so it proved I had not typed a zero into it. Injecting a real
prefill into `valuesFromPayload`'s own `str()` left it **green**. It is driven
through `valuesFromPayload` now, so the values come from the code. Verification
47 exactly, in the shape the rule names.

**The withholding filter over-matched.** `/withholding/i` also caught *"Margin
before financing, test bed and withholding"* - the per-column margin, relabelled
by the same unfold ruling - and reported three withholding lines where there are
two. Verification 17: a probe firing correctly and measuring the wrong thing.

**Final: 4/4 detected**, reverted run green, all three touched files
byte-identical. `scripts/round6/inject-phase-r.mjs`.

**The harness refused rather than proceeding, twice**, on an anchor that
appeared zero times. That is Verification 44's requirement doing its job before
anything was injected.

---

## 4. THE FINDING: two readers of achieved margin, and they disagree about absence

Reported rather than fixed, per build-discipline rule 10: **it is pre-existing,
not authored by this round.**

The vanilla asserted `marginPresentation` is called **exactly once** - *"a second
call would be a second reading of the same value"*. **The React tree has two**,
and the guard was never ported, so nothing has been watching.

Measured on a deal with no achieved margin:

| surface | text | state | note |
|---|---|---|---|
| stats strip (`panelParts.tsx:197`) | **`0.0%`** | `under-target` | *against target 30%, down 30.0 pts* |
| Structural Terms (`section36.tsx:45`) | **`--`** | none | none |

**The strip does not merely differ from its neighbour. It asserts a specific
false fact about a deal nobody has priced**, in the accent that means something
on this screen, on the most prominent figure on it. `result.achievedMargin ?? 0`
is Architecture 11's fallback wearing an initial value's clothes.

The vanilla assertion is **not re-pointed**, because a re-point would have gone
red and a red assertion is not a disposition. The reasoning is recorded at the
deletion site.

---

## 5. The retirement

**`frontend/opportunity-deal.js`, 2,255 lines, deleted**, with `deal-feedback.js`
(36), `deal-payload-parity.test.ts` and `vanilla-coupling.test.mjs`.

### Two claims, verified with the repository's stripper

Not grep: Verification 39, so prose about the file cannot satisfy either.

**The browser does not load it.** No live tag names either file; both gone from
disk.

**Nothing asserts against it.** Four code mentions survive, each with a
disposition, per Verification 41:

| caller | disposition |
|---|---|
| `live-form.test.mjs` | **KEPT.** Names it to assert it does NOT exist |
| `enumerate-retirement.mjs` | **RE-POINTED** to `contact-detail.js`, the next candidate |
| `round5/inbound-and-coupled.mjs` | **RE-POINTED** to `opportunity-reference.js` |
| `probe-fact-census.mjs` | **DELETED.** Its subject is gone; the React census supersedes it |

### The ledger retired by its own calibration

`vanilla-coupling.test.mjs` opens by asserting the scan **can see a coupling at
all**, so the enumeration below it is measuring something. With the last entry
re-pointed that went red - *"the scan found no coupled block"* - which is the
ledger **reporting it has finished**, not a defect. The same shape the `.ds-row`
assertion describes in its own comment.

That `.ds-row` half was re-pointed **with its premise re-measured** rather than
assumed: `app.js` still uses the class, so the retiring file was not the last
consumer and the instruction to delete the assertion does not fire.

### The one-line revert is removed with the file

The commented `<script>` tag in `index.html` was the load-order revert.
Restoring it now would 404. **A restore instruction pointing at a deleted file
is worse than none**, because it reads as an escape route somebody might reach
for - Verification 25's corollary, a recovery path that cannot recover.

`live-form.test.mjs`'s calibration **fired on exactly this**: *"the vanilla tag
is GONE, so the one-line revert has nothing to restore."* That failure was the
instruction to rewrite it, and it now asserts the tag is absent from the RAW
markup, live or commented, and that the file has not reappeared.

---

## 6. The estate ledger

**Loaded vanilla, from the live markup with comments stripped:**

| file | lines |
|---|---|
| `frontend/app.js` | 8,848 |
| `frontend/test-bed-detail.js` | 3,261 |
| `frontend/contact-detail.js` | 1,328 |
| **total still loaded** | **13,437** |

Unchanged: nothing retired this session was loaded. **That is the point of the
one-round window** - the debt was in what still asserted against the file, not
in what the browser ran.

**In tree, unloaded:** `opportunity-reference.js`, 1,055, with one asserter and
a named blocker.

**Deleted this session:** `opportunity-deal.js` 2,255, `deal-feedback.js` 36,
plus the parity suite, the coupling ledger and `probe-fact-census.mjs`.

**Coupling ledgers, with their instruments:**

| ledger | file | state |
|---|---|---|
| the Reference tab | `reference-coupling.test.mjs` | live, both directions, strings clause |
| the deal form | `vanilla-coupling.test.mjs` | **retired with the file** |
| adopted identity | `adopted-identity.test.mjs` | live |

**Instruments added:** `scripts/round6/enumerate-retirement.mjs` (sizing by
sandbox deletion, now pointed at `contact-detail.js` for Phase 0 item 6) and
`scripts/round6/inject-phase-r.mjs` (the calibration harness, 4/4).

---

## Surprises

**Three of four designed assertions were wrong and all read green.** The value
of the calibration was not confirmation; it was three corrections. Two of the
three faults were mine in ways the rules name exactly, written by somebody who
had read those rules that hour.

**The blast radius shrank to 1 before it shrank to 0**, and the last one was in
a file nobody had listed as a judgement, found only by re-running the
enumeration rather than by trusting the first list.

**The reference file's blocker is a live editable row that silently discards
what a person types.** Looking for a retirement precondition found a defect on
the surface migrated last round.

---

## Gate

**All 21 stages passed** on `54edd8b`, the closing tree, clean.
Pure 456/456, database 92/92, react 472/472, all 0 fail, typecheck clean, and
14 HTTP probes. Every figure parsed from the run rather than typed.

Transcript: `.verify/verify-1161196039692791.txt`

**The first run was RED, on the react typecheck, and the cause was this
session's own retirement.** `deal-payload-parity.test.ts` imported `node:fs` and
`node:path` and was **the only thing pulling `@types/node` into the react
program**; deleting it took the global `require` with it, and
`deal-panel.test.tsx` had three. Fixed here rather than listed, under rule 10's
limit: a finding the round's own change created is part of the change.

**And it exposed two more.** `require` returns `any`, so it had been hiding a
declaration for `buildDealInputs` with no `rates` option though every caller
passes one, and a `Result` declaring `financeCost` as `number` where the
function returns `number | null`. Both are declaration bugs rather than
call-site bugs - the 472 tests pass either way - so they are named at the site
and left for the round that owns those files.

**Nothing failed faster than it could run.** Every stage's duration is in its
normal band (Verification 48), including the 554ms typecheck, which is a
typecheck's own speed rather than a stage that did not execute.

**What a green gate does not mean here.** The estClose gap at the head of this
report is live on the migrated Reference tab and no stage can see it: the write
path does not exist, so there is nothing to fail. It was found by asking what
held a file in tree, not by any check in this run.

**Not pushed. Phase 0 not started.**
