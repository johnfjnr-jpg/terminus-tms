# The scanner window blind spot round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill. Drafted 2026-09-13 on `47a24ca`; re-verify every premise against the
tree you are on. This brief's R-series is its own.

**This is R10 from PROBE INVENTORY.** It builds on a gate made
deterministic by the three-round detour that preceded it.

## Rulings of record (John, 2026-09-13)

R1. **A GUARD MUST FAIL LOUDLY WHEN IT CANNOT SEE WHAT IT IS SCANNING,
    NEVER SILENTLY DROP IT.** A scanner that gives up on a chain past its
    window and says nothing is **worse than no scanner**, because it reports
    a false clean.
R2. **(b) WIDENING THE WINDOW IS REJECTED AS THE FIX** unless (a) proves
    infeasible. Any fixed window has the same failure mode one comment
    further out: widening moves the cliff, it does not remove it.
R3. **A fix that makes the scanner fail loud on EVERYTHING is not a fix.**
    It must fail loud only when it genuinely cannot parse a chain.
R4. Method unchanged: phases stop for sign-off, nothing pushes without the
    word.

## The defect, as measured in GATE RACE FIX Phase 1

`scripts/lib/unbounded-selects.mjs` matches a select chain with

```js
/\.from\(\s*['"`]([\w.]+)['"`]\s*\)\s*\n?\s*\.select\(([\s\S]{0,400}?)(?=\n\s*(?:const|let|var|if|for|return|await|\}|$))/g
```

a **400-character window** ending at a lookahead for the next statement
keyword. Text placed inside that window can push the terminator past 400
characters, at which point **the whole chain fails to match** and the scanner
silently stops counting that select.

**It reads as "fewer unbounded selects", which looks like progress.**

Measured in that round: two selects went unseen at **653 and 882 characters**
to their terminator, put there by nothing worse than explanatory comments.

**It was caught only because those two selects were in the allowlist and the
drift detector tripped.** A select blinded WITHOUT shifting an allowlist
entry - a new query, or one never allowlisted - would go uncaught entirely.

**This is a guard with a silent failure mode**, which is the exact thing
PROBE INVENTORY exists to find, now found inside a guard.

## Phase 0: measurement only

1. **Confirm the mechanism and REPRODUCE THE BLINDING.** Construct a select
   that IS genuinely unbounded and that the scanner does NOT see, because its
   terminator sits past the window. **A reproduction that makes the scanner
   miss a real unbounded select on demand is the proof the fix must close**,
   and without it the Phase 1 claim has no counterfactual.
2. **Measure the scope.** How many chains in the current tree sit CLOSE to
   the window - one comment away from blindness - so the fix's value is a
   real number rather than a hypothetical.
3. **The options, with reasoning and a recommendation:**
   - **(a) DETECT-AND-FAIL** - when a chain START is found but no terminator
     lies within the window, the scanner RAISES: *I found a select I could
     not fully parse.* The durable fix, because a window can be exceeded for
     any reason and not only by comments.
   - **(b) WIDEN THE WINDOW** - rejected per R2.
   - **(c) STRIP COMMENTS FIRST** - removes the commonest trigger, not the
     general failure. **Verify whether this is already done**: the scanner
     calls `stripJs` before matching, so (c) may already be in place and
     insufficient, which would be a finding rather than an option.

Recommend **(a), possibly with (c)**. Stop for sign-off.

## Phase 1: the fix

Implement the recommendation. **Prove both halves:**

1. **The Phase 0 reproduction - a real unbounded select the old scanner
   missed - is now CAUGHT**, either seen or failed-loud as unparseable.
2. **The scanner still passes clean on the normal population.** Calibrated
   against the current tree: the count matches the known-good 16 for
   `config-invariants.test.mjs`, with no new false flags anywhere.

Stop for sign-off.

## Phase 2: gate and close

One clean gate suffices - this is not a race fix - with `PUPPETEER_PATH` set
and the precondition checked BEFORE launch, F6 quiet. Reconciliation by
counting, revert rehearsed with the boundary stated, `CURRENT_STATE`
staleness both halves. **Promotion: weigh "a guard with a silent failure mode
is worse than no guard"** - check coverage, instance-not-number per the
discipline. Nothing pushes without the word.
