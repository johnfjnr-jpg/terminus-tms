# THE GOLDEN DEALS ROUND: CLOSE-OUT

Branch `golden-deals` off `main` at `620b845`. Measurement and documentation,
plus one pricing fix John ruled after the round's own Phase 0 stop found it.

---

## THE SHAPE OF THE ROUND

| | |
|---|---|
| `ad08af4` | the brief, with 26 pricing rules enumerated from the code |
| `5aef85d` | **Phase 0 STOP**: the contractor schedule reaches no arithmetic |
| `31d7dbf` | A1 to A3: the fix, red-first; the census wired; the false comment corrected |
| `63a5278` | A5: four goldens on the fixed engine, `PRICING_LOGIC.md`, the harness |
| (this one) | live proof, the close-out, CURRENT_STATE |

**The round stopped once and was resumed by a ruling**, which is the thing
worth recording about it: Phase 0's job was to enumerate the pricing rules, and
enumerating them is what found a rule that did not do what the estate believed.

---

## THE FINDING, AND WHAT IT COST TO FIND

The cash flow filtered and summed contractor milestones on a `usd` field.
R-N1 stopped anything writing one and the route refuses one that arrives, so
`contractorStaged` was **false on every deal the system could save** and the
whole principal left in month 1 however the schedule read. Meanwhile the
version gate refused to ISSUE a schedule that did not sum to the lump sum.

**The gate enforced a schedule the engine ignored.**

Full measurement in `GOLDEN_DEALS_PHASE0_FINDING.md`. Ruled option (a) by John
2026-09-28 and recorded in `DESIGN_PRINCIPLES.md` as **R-N1 extended**.

---

## EVIDENCE, PER CLAIM

| claim | what proves it |
|---|---|
| the contractor schedule now stages | 6 of 7 model-level tests RED before the fix, green after |
| it moves cash timing and nothing else | asserted in the model test AND on golden G2, both directions |
| no engine sub-key is read that nothing writes | the census, a gate stage, born red on this instance |
| the four goldens are the engine's own answer | 3651 figures, one run, shared pipeline with the harness |
| the harness can fail | five injections, five fired, byte-identical restore |
| it reaches the screen | 30 of 30 live at 1920/1440/1240, counterfactual both ways, capture opened and read |

---

## WHAT THE FIRST RUNS CAUGHT IN MY OWN WORK

Four, and each was caught by a control rather than by rereading.

1. **A fullPage screenshot that was evidence of nothing.** This screen puts the
   cash flow grid thousands of pixels below the fold, so the capture was
   complete and unreadable. Caught by opening it, which is Verification 4's own
   remedy. The probe now asserts the grid is inside the captured region before
   the shutter.
2. **G1's SafeSight fee priced that type at a 1.3% blended margin.** At 1.3% the
   division rule and a flat markup give almost the same answer, so the figure
   could not check the rule the document is largely about. The fee moved from
   $425 to $650 and the blend to 35%.
3. **The margin table described a decision nobody took.** It read
   `payload.priceOverrides` and reported all eleven G1 lines as pricing from the
   32% target margin. **Eight do not**: under OPEX the all-in fee's inverse
   allocation writes an absolute price onto every scalable line. It now reads the
   effective overrides and distinguishes an entered price from an allocated one.
4. **The harness would have accepted a hand-flipped status.** Found by
   calibrating it: setting `PROVISIONAL` to `CONFIRMED` left the suite green with
   the warning simply gone. `CONFIRMED` now requires `confirmedBy` and
   `confirmedOn`.

---

## THE ONE-COMPARISON GUARDS, BECAUSE THEY ARE WHAT MAKE THE REST MEAN ANYTHING

- The G2 pairwise property asserts seven equalities AND that the timing moves,
  so the equalities cannot be a description of two identical runs.
- The census refuses rather than passing when a bucket is unmeasured.
- The harness asserts the rate card first, so perturbing a catalog rate names
  the rate rather than four hundred figures.
- The harness asserts each deal pins a non-empty set of figures.

---

## STATUS: PROVISIONAL, AND IT SAYS SO ON EVERY RUN

The expectations record what the engine **does**, not yet what John has
confirmed it **should** do. `scripts/golden-deals-check` prints PROVISIONAL on
every run including a green one, and the gate stage is named
`golden deals (PROVISIONAL)`.

**A green means pricing has not moved since the figures were taken. It does not
mean they are right.** That changes when John reproduces them in Excel and the
status is set to CONFIRMED with his name and the date.

---

## WHAT THIS ROUND DOES NOT ESTABLISH

- **The figures are not confirmed.** Everything above is about whether the
  engine is self-consistent and guarded, not about whether its answers are the
  commercially correct ones.
- **The census covers the three nested objects the engine reads.** A dead
  sub-key inside something it does not read is not asserted.
- **`PRICING_LOGIC.md` is about the engine.** Where a surface shows a figure it
  reads it from these same functions, and the document is not evidence about
  rendering.
- **The live proof covers one deal shape.** The staged pair renders and carries
  the right figures on a two-phase lump sum deal; hybrid and OPEX lump sum
  shapes were measured in the model, not on the screen.
- **No record was migrated and none needed to be**, per John's ruling: the
  stored `pct` payloads were already the correct shape, and all existing records
  are test data.
