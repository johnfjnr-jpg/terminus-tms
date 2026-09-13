# The gate race fix round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill. Drafted 2026-09-13 from PROBE INVENTORY's Phase 0 measurement;
re-verify against the tree you are on. This brief's R-series is its own.

**THIS ROUND BREAKS PROBE INVENTORY'S MEASUREMENT-ONLY SCOPE, deliberately
and for one finding**: the gate is non-deterministic, which degrades every
other claim the inventory makes. The rest of the inventory's prioritised
list resumes after this.

## Rulings of record (John, 2026-09-13)

R1. Scope: **the gate race, and nothing else.** PROBE INVENTORY's other
    findings stay recorded and unfixed.
R2. **THE FIX MUST MAKE THE INVARIANT CORRECT, NOT MERELY QUIET.** An
    exclusion that hides a real orphan is worse than the race. A race fix
    that makes the check always-green is not a fix.
R3. **THE VERIFICATION IS LOAD-BEARING AND HAS TWO HALVES.** Determinism:
    `test:db` run at least 20 times, all green, AND the forced-race
    reproduction from Phase 0 shown unable to fail. Sensitivity: the
    invariant must still go RED on a real orphan - inject one, it fails;
    remove it, it passes.
R4. The close runs the gate MULTIPLE TIMES, to show the race is gone at the
    gate level and not only in `test:db`.
R5. Method unchanged: phases stop for sign-off, nothing pushes without the
    word, rulings appended at the phase they launch.

## The defect, as measured in PROBE INVENTORY Phase 0

`scripts/tests/config-invariants.test.mjs` loads **every row** of
`stage_gate_rules` in a `before` hook and INVARIANT 2 scans all of them for
a `from_stage`/`to_stage` absent from `stage_definitions`.

`scripts/tests/gates.test.mjs` asserts **the same claim** and carries an
exclusion the other does not:

```js
const orphans = rules
  .filter(r => r.record_type !== TYPE)     // TYPE = `harness_${runTag}`
  .filter(r => !live.has(...))
```

Its own comment says why: *"Fixture rules use a synthetic record_type with
no stage_definitions rows at all, so they are excluded by record_type - not
by ignoring orphans generally, which would defeat the invariant."*

`npm run test:db` runs **ten files** through `node --test` with **no
`--test-concurrency` flag on an 8-CPU machine**, so they run in parallel.
`verify-harness.mjs` inserts the harness gate rules; `config-invariants`
sees them mid-run; INVARIANT 2 goes red or green **by timing**.

**Zero orphans on disk when queried directly. The failure is the race, not
the data.** Verification 20 - two readers of one value - inside the gate,
which makes every green partly chance.

## Phase 0: confirm and reproduce

The mechanism is measured; do not re-derive it wholesale. Confirm:

1. The two invariants and the missing exclusion, by reading both.
2. The parallel run with no concurrency flag.
3. **REPRODUCE THE INTERMITTENCY.** Either run `test:db` until it flips, or
   force the race directly. **A probe that can make INVARIANT 2 fail on
   demand is the proof the fix must then close**, and without it the Phase 1
   claim has no counterfactual.

Then establish which fix is right, with reasoning:

- **(a)** give `config-invariants` the same fixture-type exclusion;
- **(b)** serialise the two files;
- **(c)** scope both invariants to real record types only.

**This is an implementation call: take it with a recommendation** (the
standing delegation rule), and weigh it against R2 - the question is which
makes the invariant CORRECT, not which makes it quiet.

Stop for sign-off.

## Phase 1: the fix

Apply it. Then **both halves of R3**, neither on its own:

- **Determinism**: `test:db` at least 20 times, all green, and the Phase 0
  forced race shown unable to fail.
- **Sensitivity**: a REAL orphan injected makes the invariant fail;
  removing it makes it pass. **This is the half that proves the fix did not
  simply blind the check.**

Stop for sign-off.

## Phase 2: gate and close

Final-act gate on the exact committed tree, `PUPPETEER_PATH` set and the
precondition checked BEFORE launch (F6 refused two closes running on that
habit; the third close fixed it by checking first). **The gate runs MULTIPLE
TIMES** per R4. Reconciliation by counting, revert rehearsed with the
boundary stated, `CURRENT_STATE` staleness both halves. Nothing pushes
without the word.


## Rulings appended at Phase 1 (John, 2026-09-13)

R6. **SCOPE: the predicate applies to EVERY invariant reading `rules`
    unfiltered**, not only the two proven exploitable. *"Not exploitable by
    today's fixtures" is not "safe" - tomorrow's fixtures differ.*
R7. Fix approach accepted as recommended: one shared imported predicate
    closing the Verification 20 fault at root, applied in the `before` hook,
    plus the coverage assertion. The name-based predicate is accepted **with
    the limitation stated**, no fixture-marking column existing.
R8. **PROMOTION: add the INSTANCE, not a number**, where an existing rule
    already carries the remedy.

## Rulings appended at the close (John, 2026-09-13)

R9. The PROBE INVENTORY prioritised list **resumes after this round**: P2
    into R1, P3 wire `check-state-fresh.mjs`, P4 the four rotted assertions,
    P5 and P6 as standing conditions.
