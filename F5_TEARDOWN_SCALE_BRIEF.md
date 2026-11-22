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
