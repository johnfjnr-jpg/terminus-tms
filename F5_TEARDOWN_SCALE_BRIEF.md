# F5 teardown scale: brief

Governing docs: CLAUDE.md, the tms-round-method skill, F5_TIMEOUT_FIX_BRIEF.md
and its close-out, TEARDOWN_INTEGRITY_BRIEF.md and its close-out,
TEARDOWN_SCAN_COST_BRIEF.md, CREATE_FROM_ANY_CONTACT_BRIEF.md (whose close-out
records the three readings). Branched off origin/main at 03b4257, confirmed by
ls-remote.

## The round, as given (John, 2026-11-22). Verbatim

ROUND F5_TEARDOWN_SCALE. Branch off origin/main at 03b4257 (ls-remote must read
it; if not, STOP). Brief first commit.

PURPOSE: scripts/tests/teardown-scoping.test.mjs "tearDown reaches a record
beyond row 1,000 of its own tag population" is URGENT. On one tree: 59,120ms
pass, 51,709ms statement timeout, 61,202ms pass, with the fixture at index 7852
of 8034. Its cost scales with accumulated fixture history, which every gate run
grows. Rule of record: the product cannot produce this load, so fix the TEST;
never raise the timeout or add retries.

PHASE 0 (read-only, then STOP):
P1 The exact statement that times out, its EXPLAIN (read-only), and the indexes
   it can and cannot use.
P2 The population it scans: total rows, rows matching its tag, and growth per
   gate run (from two or more gate transcripts).
P3 What the test must prove (teardown pages past row 1,000 within ONE tag), and
   the smallest population that proves it: its own 1,001+ tagged rows, built
   and torn down by the test, never history.
P4 The other tests asserting a population above 1,000 (teardown-scoping :234
   record_revisions and :509 transition_requests, per TERM_QUOTES Phase 0).
   Same treatment, or say why not.
P5 Proposed fix. Prefer a test change with no schema change; any index or
   migration drafted in full with rollback, for my review.
P6 Calibration plan: the fixed test still FIRES on a teardown that stops at
   row 1,000.
STOP with the report.

## Phase 0 (2026-11-22)

Reported in F5_TEARDOWN_SCALE_PHASE_0_REPORT.md (6de1dc5), read-only.

## Rulings on Phase 0 (John, 2026-11-22). Verbatim

D1  P5.3 option (b): tearDown performs the claim (soft delete, asserted), then
    the test hard-purges ITS OWN rows. Conditions:
    - The purge reaches only rows carrying this run's per-run tags AND owned by
      the test account; both filters are asserted in the query, never inferred.
    - Enumerate every RESTRICT child the soft delete or the fixtures write
      (audit_log, record_contacts, anything else) and purge them in order. If a
      child cannot be purged, STOP and report; do not widen the purge.
    - purge() checks every error (Verification 8).
    - The test ends asserting zero rows of this run's tags remain, in every
      table it wrote.
    - Record in DESIGN_PRINCIPLES that this departs from Verification 11's
      letter for test-owned fixture rows only, and why: soft-deleted fixture
      history is the cost every tag statement pays.
D2  P4 :509 transition_requests: queued, unchanged this round.
D3  The pg_trgm index: out of this round.
D4  The rebuilt test as P3/P5 propose: per-run tags, the 1,500-row pad, about
    30 candidates, pick-after and hand away, no ledger reads, no borrowed tags,
    the three P3 conditions and the unranged counterfactual kept. The headroom
    guard is re-aimed at the run's own tags.
D5  Calibration as P6, I1 to I7, each read by its named assertion, plus the
    starved-estate run. I7 is mandatory: the sweep set is only this run's tags.
D6  The close-out states plainly that stalls are reduced, not removed. A future
    red on teardown-scoping is investigated as a stall (fixtures.mjs:490
    class), never retried.

Optional, if John runs them: the two dashboard queries in P1 (EXPLAIN,
pg_roles). Record the results if supplied; do not block on them.

Then: tests, the rebuild, calibration, full gate, merge --no-ff, merged gate,
ls-remote, "ready for John's push". Report teardown-scoping's duration on every
gate run.

## The build, against the rulings (2026-11-22)

1. D4 and D1 (f1a98e9):
   - The page-cap test was rebuilt with per-run tags, a 1,500-revision pad and
     30 candidates, choosing the deep candidate after enumeration and handing
     it away.
   - It reads no ledger and borrows no tags. The three P3 conditions and the
     unranged counterfactual are kept.
   - The headroom guard is re-aimed at the run's own 3 tags.
   - New assertions: the sweep set is only this run's tags, and tearDown
     removed nothing the run did not create.
   - The test hard-purges its own rows: both filters in the query, a RESTRICT
     census that stops rather than widens, and a zero-rows census over every
     table and child.
   - purge() now checks every error.
   - DESIGN_PRINCIPLES "F5 TEARDOWN SCALE" records the departure from
     Verification 11's letter.
   - First run: 6/6, with the deep test at 28,559ms (50,428 to 74,674ms over
     the last 40 gates). Population 1,530, fixture at index 1,062.
2. D5 (f866e59):
   - scripts/f5-teardown-scale/calibrate-teardown-scoping.mjs on a temp copy
     of HEAD with no fixture ledger.
   - Run mwrvzbed: I1 to I7 all FIRED by their named assertions, with residue 0
     after each; I6 cleaned its 33 records.
   - The reverted, starved whole-file run was GREEN 6/6, with the deep test at
     27,482ms.
   - docs/PROBES.md gained a MANUAL row.
3. D2 and D3: `:509` and the index are untouched.
4. CURRENT_STATE regenerated. Live 134 to 135: the one new live opportunity
   was created 13:50 local by a staff account, so it is a person's record, not
   residue. Every other moved line is a soft-deleted or history count.

## Amended rulings after the red merged gate (2026-11-23), verbatim

F5_TEARDOWN_SCALE: John's decision on the red merged gate (4c35c54). Neither option alone. The amended rulings below never reached you; they apply now.

Do NOT re-gate or push. Keep everything built (D1, D4, D5 stand as built).

MEASURED BY JOHN in the SQL Editor (postgres role, no statement timeout):
- The P1 query (offset 7000, limit 1000), explain (analyze, timing off, buffers): Execution Time 4,054ms; with per-node timing 4,061ms. Parallel seq scan over the whole table, all shared hits. Planner estimate 42 to 44 rows; actual 8,000.
- pg_roles: authenticator statement_timeout=8s, lock_timeout=8s; authenticated 8s; service_role none of its own; postgres none.
This CONTRADICTS Phase 0's "0.4 to 0.75s warm, more than 10x under 8s". Real headroom is about 2x.

P7  Read-only first: how were Phase 0's page timings taken? Re-measure the same statement through PostgREST, as the test issues it, and account for the 10x gap. Confirm which statement_timeout applies to a service_role request through PostgREST. Correct the Phase 0 report in writing.
D3  REVERSED, the index comes IN. Draft the migration: pg_trgm in the extensions schema if not present, and a GIN trigram index on (payload->>'name') of record_revisions using extensions.gin_trgm_ops, so the existing ilike and like prefix filters use it unchanged. Full rollback. State the write overhead on record_revisions inserts and the build time on about 171,000 rows. List every gate statement that filters payload->>'name' (the cfanyprobe teardown scan at probe-create-from-any-contact.mjs:279 included) and confirm each pattern can use the index. Not parse-checked: STOP for my review.
H1  Harden probe-create-from-any-contact.mjs's teardown: a per-run tag instead of the fixed 'cfanyprobe'; tearDown reached in every outcome, so a failed enumeration still tears down; the run ends asserting zero live records of its tag. Calibrate: a forced enumeration failure still leaves zero live.
H2  Census every other probe whose finally block starts with a tag scan before tearDown, and every probe using a FIXED tag. List them; fix only H1 this round, queue the rest.

Sequence: P7, the D3 draft and H1, then STOP for my review. After John applies the index and confirms its EXPLAIN: full gate, merge --no-ff (rebuild main from the branch), merged gate, ls-remote, "ready for John's push". Report teardown-scoping's duration and the headroom guard's minimum on every gate run.

## The build, against the amended rulings (2026-11-23). STOPPED for John's review

1. **P7.** The correction is written into F5_TEARDOWN_SCALE_PHASE_0_REPORT.md under "Correction, P7".
   - Phase 0's page timings were nine warm samples, taken after the same script had scanned the table.
   - Re-measured through PostgREST: about 0.4s at the server when warm, but the first touch took 6,657ms.
   - The service_role bound is 8s, measured: a 60-term whole-table count was cancelled with 57014 at 8,296ms wall.
   - John's 4,054ms is not fully accounted for from this session. JIT, the plan and EXPLAIN overhead are named, with the SQL that separates them.
2. **D3 (reversed), drafted, not applied.**
   - The migration is `supabase/migrations/20261123000001_record_revisions_name_trigram_index.sql`, with its rollback in `supabase/rollbacks/`.
   - It installs pg_trgm in `extensions` if absent, and refuses by name if pg_trgm is installed in another schema.
   - It builds a plain (not CONCURRENTLY) GIN index on `(payload ->> 'name') extensions.gin_trgm_ops`, then runs ANALYZE.
   - Not parse-checked.
3. **H1, built and calibrated.**
   - probe-create-from-any-contact.mjs now takes a per-run tag and builds its fixture inside the try.
   - Every teardown step records its failure and carries on, so tearDown is always reached.
   - A named check ends the run: zero live, read from the tracked ids plus a fresh tag scan.
   - Calibrator run mwt7cmd8:
     - H1-new, enumeration forced to fail: the failure was reported, the check failed, and 0 of 8 records were live.
     - H1-old, the pre-H1 teardown with the same injection: 8 of 8 live, cleaned to 0.
     - Reverted: 23/23.
4. **H2, censused, nothing fixed.** The list is in the round's report and in `.verify/f5-teardown-scale/h2-census.txt`.
   - Two manual probes start their finally with an unguarded tag scan.
   - 23 wired probes use a fixed tag.
5. **A premise conflict for John, not resolved here.** DESIGN_PRINCIPLES "F5 TEARDOWN SCALE" says the hard purge (D1) "is worth having only while the tag query reads the whole table" and that with an index "Verification 11's letter can be restored". D3 reversed removes that premise once the index is applied. John ruled that D1 stands as built. Under Verification 29 the decision is re-taken rather than re-weighed, so it is his to re-take.
