# New Lead grid width: close-out

**CLOSED** on the gate at `9892b12a`, 22 of 22 stages, exit 0, door green.
**F6 did NOT fire** - the precondition was checked before launch, which
fixes the setup habit at source rather than reading the verdict afterwards.

**PUSHED** to `origin/main`; `ls-remote` confirmed `origin/main` = local
HEAD = `9892b12a`. Closed by the business 2026-09-13.

**CLIENT-ONLY ROUND. A revert needs NO server restart and NO database
action** - no `src/`, no `supabase/`. That is the opposite of the round
before it, which is why the boundary is stated rather than assumed.

---

## What shipped

| claim | before | after |
|---|---|---|
| modal at 3440 | 1480px, **43%** of viewport | 3268px, **95%** |
| columns readable at 3440 | 6 of 15 | **13 of 15** |
| columns readable at 1920 | 6 of 15 | 7 of 15 |
| horizontal scroll bar | 0px, invisible overlay | **12px, visible, draggable** |
| NAME after a reopen | off-screen left | **visible** |

Three changes. `.modal-panel-batch` gets `width` **and** `max-width: 95vw` -
both, because `.modal-panel` is `width: 90%` and raising only the cap would
have moved a number without reaching the outcome. `.new-lead-scroll` gets
the `::-webkit-scrollbar` rules `.modal-panel` always had, which is the
asymmetry the whole defect was made of. And `scrollLeft = 0` beside the
`scrollTop = 0` that was already there.

`.modal-panel`, shared by eleven surfaces, is untouched (R5).

**R7: the 1920 limit is ACCEPTED AS BUILT** - 7 of 15 plus the real bar,
and the readability fix stands. **Per-column widths are a future
refinement, recorded and NOT built.** The arithmetic behind the limit: 15
columns at a 230px minimum is ~3450px, and 1920 at 95% gives 1824px. It is
asserted in the probe as a known state so it fails loudly if it changes.

---

## WHY THIS ROUND EXISTED: ROUND A SHIPPED IT BROKEN AND ITS PROBE PASSED

Two independent causes, both now diagnosed, and neither was carelessness.

**1. HEADLESS CHROME RENDERS NO SCROLLBAR, BY ANY MEASURE.** Proven in both
directions on a self-contained page: injecting a 14px bar moved the
headless reading not at all, while headed it went 0px to 14px with visibly
different pixels. **Every headless scrollbar reading this estate has ever
taken has been blind** and would have returned the same answer whether a
fix worked or not.

**2. THE PROBE WAS AIMED AT THE WRONG AXIS.** Round A asserted *"the scroll
position RESETS on reopen"* and **guarded it against vacuity**, which is
careful work:

```js
check(setTo > 0, 'the scroll could actually be moved (so the reset claim is not vacuous)')
check(onReopen === 0, 'the scroll position RESETS on reopen')
```

**Both lines read `scrollTop`. The string `scrollLeft` appears in that probe
zero times.** The component resets `scrollTop` and not `scrollLeft`, so the
assertion was pointed at the one axis the component already handled while
3500px of content scrolled along the other.

---

## FOUR BLIND INSTRUMENTS, AND THE FOURTH WAS MINE

| instrument | with a bar | without | discriminates |
|---|---|---|---|
| headless layout gutter | 0px | 0px | **no** |
| headless pixels | same | same | **no** |
| **headed ELEMENT screenshot** | same | same | **no** |
| headed layout gutter | 12px | 0px | yes |
| headed PAGE screenshot | differs | differs | yes |

**The third actively destroyed the measurement**, and it was in my own
probe:

```
fresh open                                   gutter  12px
after scrollLeft = 1500                      gutter  12px
after an ELEMENT screenshot of the container gutter   0px
after a PAGE screenshot                      gutter   0px
```

Puppeteer suppresses the scrollbar to take an element capture and does not
put it back. A draft that photographed the container and then measured it
was reading a bar its own instrument had removed - **and the pixel
comparison then PASSED, on a difference unrelated to the bar.**

**Caught by a guard added for a different reason**: an assertion that the
suppression had genuinely taken before its result was read. It expected
`12px -> 0px` and reported `0px -> 0px`. Verification 14 catching a fault
in the INSTRUMENT rather than the product, which is not what it was written
for.

---

## RECORDED PLAINLY: A FALSE COMMIT MESSAGE, IN THE ROUND ABOUT FALSE PASSES

The promotions commit landed with **neither promotion in it** while its
message claimed both. A trailing comma in the editing script made the
buffer a tuple; the second anchor test then ran `in` against a tuple rather
than a string, failed, and nothing was written. The commit went through on
the brief change alone.

**Amended, because it was never pushed, and the amended message says so.**
A commit that silently became correct would have left the record claiming
something that did not happen for the length of one commit.

**This is the round's own instance of the class it existed to fix**: a
claim that passed while the thing it claimed had not happened. It is
recorded here rather than tidied away for exactly that reason.

---

## Promotions: two, both EXTENSIONS, nothing renumbered

- **Verification 33 gains the AXIS clause.** A measure can be correct,
  calibrated AND non-vacuous and still be aimed at the wrong axis of a
  property that has more than one. **Verification 17 was satisfied and did
  not help**, and that boundary is the load-bearing part: a calibration
  proves an instrument can tell two states apart, never that the states are
  the ones that matter. The check: when a property has more than one
  dimension, name the dimensions and assert each. The tell is a claim
  phrased in the singular about something that is not singular.
- **Verification 4 gains the PERTURBING-CAPTURE clause.** Every other V4
  clause is a screenshot that fails to SHOW the thing; this is one that
  DESTROYS it, with the evidence and the damage in the same call. Measure
  first, capture second, and never photograph the element whose own
  geometry is the claim.

## Evidence

| claim | instrument | result |
|---|---|---|
| the gate | `npm run verify --round-close` on `9892b12a`, `PUPPETEER_PATH` set | 22/22, exit 0 |
| suites | emitted by the run | pure 539/539, react 987/987, db 100/100 |
| (a)(b)(c) | `probe-p1.mjs`, HEADED, 1240/1920/3440 | all claims pass |
| assertions real | `calibrate-p1.mjs`, 3 injections | 3/3 fired, 0 silent, reverted clean, bytes identical |
| revert | explicit ref, `git write-tree` | byte-identical, `e7d9d914` |
| state staleness | both halves | ancestor PASS, 0 configuration sources changed |
| reconciliation | counting | 5 commits, each mapped to a phase or the close |

## 48(a), MEASURED FOR THIS ROUND, NOT INHERITED

| file | real disk reader | consequence |
|---|---|---|
| `DESIGN_PRINCIPLES.md` | **none** | markdown edits RIDE the green gate |
| `INTERACTION_STANDARDS.md` | `scripts/tests/standards-staleness.test.mjs` | **RE-GATES** |
| this close-out | none | RIDES |

Measured by matching the filename inside a `readFile`/`join` call rather
than anywhere in the text, so prose about a file cannot satisfy the scan.
**No change to either was needed**: the round's decisions live in the
brief's appended rulings and in the two promoted clauses, and nothing
superseded an existing principle or interaction standard.

**This close-out is markdown with no gate reader and rides the green gate
under build-discipline 48(a), named here as that clause requires.**

---

## Carried, in the business's order

1. **Per-column widths** - Postcode, Region and City need less than Company
   Name and Email. R7's future refinement, not built.
2. **R1, the record surface swap** - its own round, 15-test re-pointing
   budgeted against the requirement.
3. **THE DEAD-PROBE SWEEP - NEXT.** A check finding probes wired to no gate
   stage. **It opens on John's go, not automatically.**
4. `NewLeadGrid.tsx` lines 14-18, the stale `jobRole` comment
   (Architecture 9's fourth variant).
5. `LinkAccountPanel`'s dim button, for John's eye.
6. Region drift.
7. F5 ceiling derivation review.
8. F8, plus the concurrent-write environment timeout.
9. The follow-up-entity round.
10. The Sections 6-11 migration-conformance walk.
11. Batch Edit.
12. The two declared duplications.

**Still required before this is final: John walks it** - near-full-width,
most columns visible, a real draggable scroll bar when the window is small,
and NAME visible on reopen. **The push published the code; the walk
confirms it on the real screen.**
