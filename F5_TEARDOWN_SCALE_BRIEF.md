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
