# Round 7 build brief: automated verification, then feature work

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND6_BUILD_BRIEF.md`. Read all four before
starting.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Phase 1: `scripts/verify-harness.mjs`, a real automated test suite

**This phase is not optional and is not a refactor of the existing
scripts.** Confirmed at the close of Round 6: this repo has zero
automated tests. `package.json` declares no `test` script and no
runner, no test framework is installed, and no tracked test file
exists. Every correctness claim made across Rounds 1 to 6 rests on
one-shot Puppeteer scripts that were run once by hand and then left at
the repo root, where they are now deliberately gitignored because 19 of
23 hardcode `/Users/johnfryatt/terminus-tms/` and all 23 depend on the
uncommittable `session-ref.json`.

That is the gap this phase closes. The three areas below are chosen
because each one is money-or-data critical, each is pure enough to test
without a browser, and each already has a recorded history of real bugs.

Build `scripts/verify-harness.mjs` as tracked, reusable tooling
alongside the existing `scripts/sign-in.js`, `scripts/create-test-user.js`
and `scripts/seed-test-opportunity.js`. Read paths and credentials from
the environment, never from a hardcoded absolute path. Use the built-in
`node:test` runner; do not add a third-party framework.

**The suite is split in two, and the split is load-bearing.**

- `npm test` runs **1.1 only**: pure functions, no database, no
  credentials, no network. It must be runnable by anyone on a clean
  checkout with no environment setup at all.
- `npm run test:db` runs **1.2 and 1.3**, which require a real database
  and documented environment variables.

Add the GitHub Action in this phase, not later. It runs `npm test` on
every push. It must not run `test:db`, which would require putting
database credentials into CI, a separate decision that is not being
made here. Keeping the pure suite genuinely dependency-free is what
makes that separation possible, so do not let a database import leak
into the 1.1 path.

### 1.0 Fixtures and teardown

Every database-backed test in 1.2 and 1.3 creates its own disposable
fixtures. Follow `DESIGN_PRINCIPLES.md` Rule 9:

- Tag every fixture with a per-run `runTag = Date.now()` and derive all
  fixture names and counter keys from it, so no two runs collide and no
  run ever reuses a real, already-existing record as a convenient test
  subject.
- **Counter keys must be unique per run.** The "no gaps" assertion in
  1.2 is only valid on a counter key that nothing else is touching
  concurrently. A shared key makes that assertion meaningless, it would
  be measuring other traffic, not atomicity.
- Check **every** delete's returned `error`, and the affected-row count
  on every `.update()`. Throw or log loudly on any failure. Never print
  a fixture ID as "torn down" without confirming the row is actually
  gone by querying it. An error's wording is a hint to investigate,
  never a substitute for checking the row.
- Teardown soft-deletes test records.

**Teardown must never delete `reference_number_counters` rows.** This is
not a style preference, it is a recorded real collision from Milestone 4,
see `DESIGN_PRINCIPLES.md` Section "Deferred scope". A `GBR-SMARTC`
counter row was deleted during test cleanup while a soft-deleted record
still permanently held `TT-GBR-SMARTC-001`. Reference codes are never
reused even after deletion, so the counter restarted at 1 and collided
with the already-claimed code, a real Postgres unique-constraint
violation caught live. The underlying design question is still
unresolved and deliberately out of scope here. Leave counter rows in
place; the unique per-run key above is what keeps them from
accumulating meaningfully.

### 1.1 Cost calculation, `src/lib/deal-calculator.js`

Pure functions, no database, no session needed. Cover at minimum the
exported surface that carries arithmetic:

- `buildLoanSchedule`, both amortisation methods, including a zero
  interest rate and a single-month term.
- `priceFromCost` at a 0% margin and at margins approaching 100%,
  where the divisor gets small.
- `buildCostGroup` and `calculateContractTotals`, confirming a group
  with no line items totals zero rather than producing `NaN`.
- `calculateTax`, both with and without `grossUp`, since the gross-up
  path reorders the WHT and GST arithmetic.
- `calculateTestBedCost` and `calculateDeal` as end-to-end assertions
  against one fully worked example whose expected figures are stated
  literally in the test, not recomputed by calling the same function
  under test.

### 1.2 Reference-number atomicity, including the 999 boundary

The counter lives in Postgres, not JS: `src/lib/reference-number.js`
delegates to the `issue_reference_number` RPC, which does an
`insert ... on conflict ... do update set current_value = current_value + 1
... returning`. Testing the JS wrapper alone proves nothing about
atomicity. These tests must run against a real database.

- **The 999 to 1000 boundary.** The RPC formats via
  `case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end`.
  This has already been a real production bug once, see
  `supabase/migrations/20260814000001_fix_reference_number_1000_truncation.sql`.
  Seed a counter to 998 and issue four numbers in sequence. Assert
  exactly `998`, `999`, `1000`, `1001`, that `999` is still zero-padded
  to three characters, and that `1000` is four characters and is not
  truncated back to three.
- **Atomicity under real concurrency.** Fire at least 50 concurrent
  `issue_reference_number` calls against one counter key with
  `Promise.all`. Assert the returned set has no duplicates and no gaps.
  A sequential loop does not test this; the calls must genuinely
  overlap.
- **Namespace isolation.** Round 5 introduced `p_scheme` so that
  Account Numbers and record reference codes never share a counter
  sequence even when their segment strings collide. Assert that
  issuing under two different schemes with an otherwise identical key
  advances two independent sequences, and that the pre-existing
  unprefixed keys still resolve to their original counters, which is
  the backwards-compatibility guarantee that migration was written to
  preserve.

### 1.3 `computeBlocking` gate evaluation

`computeBlocking` in `src/routes/transitions.js` is the single gate
guarding every stage transition, and it is called from two separate
places, `transitions.js` itself and `records.js`. It needs a real
database because it reads `stage_gate_rules`.

- Each of the four distinct `blocking.push` branches, asserted to
  fire when its condition is unmet and to stay silent when met.
- The variant-matching logic specifically. The code carries a comment
  warning that `.or()` with a single condition can be misread by
  PostgREST as a top-level OR, bypassing the other `.eq()` filters.
  Assert that a record with a variant picks up both null-variant and
  its own variant rules, that it does **not** pick up another
  variant's rules, and that a record with no variant picks up only
  null-variant rules.
- One assertion that both call sites agree: the same record and
  transition evaluated through `transitions.js` and through
  `records.js` produce the same blocking set.
- **A fifth assertion for `child_record_status`, which has no code
  branch at all.** `src/routes/transitions.js:140` is a bare comment,
  "child_record_status handled in a future milestone", so the rule loop
  falls through and pushes nothing. This is not theoretical:
  `supabase/seeds/003_test_bed.sql` seeds three real
  `child_record_status` rules on the `test_bed` Decommissioning ->
  Closed transition (NDA reviewed, PDPA assessment reviewed, Data
  Protection Impact Assessment reviewed). All three are silently
  ignored today, so that transition is currently ungated.

  Assert the **current no-op behaviour explicitly**: a Test Bed with
  those three rules unmet returns an empty blocking set and the
  transition is permitted. Comment the assertion clearly, in the test
  itself, stating that this asserted behaviour is **wrong**, that it
  documents a known gate hole rather than endorsing it, and that when
  the `child_record_status` branch is built this assertion must be
  **inverted**, not deleted. The point is that implementing the branch
  should cause a visible, deliberate test failure rather than passing
  silently.

**Test evidence required:**

1. `npm test` passing from a clean checkout with **no** environment
   setup, plus the actual runner output pasted in full.
2. `npm run test:db` passing with only the documented environment
   variables set, output pasted in full.
3. A green GitHub Action run on a real push, linked.
4. Teardown proven, not assumed: after a full `test:db` run, query and
   report the fixture rows' actual state, per Rule 9, and confirm no
   `reference_number_counters` row was deleted.
5. Deliberately break one assertion per area, three in total, and show
   each failing, so the suite is proven capable of failing rather than
   passing vacuously.

---

## Phase 2 onward

To be defined after Phase 1 signs off.
