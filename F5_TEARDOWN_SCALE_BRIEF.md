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

## Index applied and confirmed; rulings on the two open findings (John, 2026-11-24), verbatim

F5_TEARDOWN_SCALE: index APPLIED and confirmed (John, 2026-11-24).

APPLY RECORD, for the close-out: the ledger row for 20261123000001 was recorded BEFORE the migration ran (the pre-check had shown no pg_trgm row). John then applied the migration (begin/commit). Post-apply: the index exists, pg_trgm in extensions, ledger present. State this order plainly.

EXPLAIN after the apply, SQL Editor:
- P1 (two-tag ilike, offset 7000): BitmapOr of two Bitmap Index Scans on record_revisions_payload_name_trgm_idx; 4,506ms before, 265.8ms after. Estimate 7,777, actual 8,070. Nearly all of the remaining time is the heap visits for the 8,070 matched rows.
- cfanyprobe like: Bitmap Index Scan, 477.6ms before, 16.1ms after.

RULINGS on the two open findings:
1. D1 stands, re-taken on a new premise (Verification 29): the hard purge is kept because test-owned fixture rows left soft-deleted grow the table for every whole-table reader and grow the matched set of any reused tag, not because tag queries read the whole table (no longer true). Rewrite the DESIGN_PRINCIPLES "F5 TEARDOWN SCALE" entry to say so, with the superseded sentence left visible.
2. YES, correct teardown-scoping's comments and the headroom guard before the gate. The guard must measure what it claims: re-aim it at the indexed statement's cost, re-measure the cold-to-warm ratio after the index, and set COLD_FACTOR from that measurement, stated with the samples. Calibrate that the guard still FIRES on a statement made to exceed its ceiling.

H2: queued as the next round (per-run tags for the 23 wired fixed-tag probes, then the manual ones; the two unguarded finally blocks).

Then: full gate on the branch, rebuild main from 03b4257 with merge --no-ff, merged gate, ls-remote, and STOP with the report. Report teardown-scoping's duration, the headroom guard's minimum and the database suite's time on every gate run. Do NOT say "ready for John's push" until John has passed the report to me.

## The build, against the rulings of 2026-11-24

**Apply record.** The ledger row for 20261123000001 was recorded BEFORE the migration ran; the pre-check had shown no pg_trgm row. John then applied the migration in one begin/commit. After the apply, the index exists, pg_trgm is in `extensions`, and the ledger row is present.

1. **D1, re-taken.** The DESIGN_PRINCIPLES "F5 TEARDOWN SCALE" entry now carries John's new premise. The superseded sentence is struck through and left in place. The test's own D1 comment says the same.
2. **The headroom guard, re-aimed** in teardown-scoping.test.mjs.
   - HEADROOM: the minimum of 5 samples of the real 3-tag statement times COLD_FACTOR must clear 8,000ms with a 1.5x margin.
   - COLD_FACTOR is 4, set from a post-index measurement: first touch over the warm minimum, across eight fixture tags, gave 1.29, 2.01, 2.08, 2.10, 2.26, 2.65, 2.74 and 3.47 (`.verify/f5-teardown-scale/p8-cold-warm.all.txt`).
   - INDEX (new): the old no-match "scan term" probe now asserts its cost over a one-row pk read stays under 100ms, so a dropped or unused index fails by name.
   - The stale whole-table comments in the test, fixtures.mjs and the create-from-any-contact probe are dated, with the history left visible.
3. **Calibrated** by scripts/f5-teardown-scale/calibrate-headroom-guard.mjs, run mwu32dw6, 3/3.
   - HEADROOM fired at a 3,522ms minimum against the 1,333ms ceiling.
   - INDEX fired at 387ms over the round trip against 100ms of slack.
   - The reverted run passed, at a 162ms minimum and 24ms over the round trip.
   - Zero rows of any run's tags were left.
   - Two earlier injections were too light and the harness stopped on each: 848ms with 12 branches and 1,115ms with 30. **A 30-branch whole-table read passes HEADROOM, so only the INDEX check catches a pre-index regression.**
4. **A finding, not absorbed: the cold index.** The first indexed statement of the measuring session, `score-success` (4,452 matched rows), was cancelled by the 8s timeout. Retouched, it took 3,063ms, then 516 and 355. That is at least 22x, censored, against 3.47x for every later tag. It reads as the GIN index being cold after idle and is not covered by COLD_FACTOR. It bears on H2, because score-success is one of the wired fixed-tag probes.

## Branch gates, 2026-11-24. RED, STOPPED before the merge

1. **Gate on 2bdff41: RED, 28 of 39 stages, and both causes were mine.** CURRENT_STATE staleness failed (144ms) because it had not been regenerated after the migration. Ten browser stages did not run because the gate was launched without PUPPETEER_PATH. The deep test passed in 18,737ms with a headroom minimum of 174ms, and the database suite took 109,085ms (113/113). CURRENT_STATE was regenerated (6bf7aef) and the NEW tree was gated; the same tree was not rerun.
2. **Gate on 6bf7aef: RED, 38 of 39 stages.** The database suite took 112,879ms (112/113). The deep test failed in 24,737ms with `headroom probe: canceling statement due to statement timeout`: the INDEXED 3-tag statement, over 1,532 freshly inserted rows, crossed 8s on one sample. No minimum was produced. The purge still ran: 33 records removed, 0 rows of the run's tags left.
3. **This is the second indexed statement to cross 8s in one day.** The first was score-success's first touch (item 4 above). Both reads are against an index whose warm cost is 150 to 450ms. Per D6 it is investigated, never retried. No merge was made, main was not touched, and origin is still at 03b4257.

## Rulings on the branch gate red (John, 2026-11-24)

R1  Draft migration 20261124000001, exactly these statements and nothing else:
      alter index public.record_revisions_payload_name_trgm_idx set (fastupdate = off);
      select gin_clean_pending_list('public.record_revisions_payload_name_trgm_idx'::regclass);
    Rollback: alter index ... reset (fastupdate); and the ledger row delete. Comment why: the two indexed statement timeouts today (score-success on first touch, the headroom probe right after about 6,000 inserts) match the GIN pending-list mechanism; cause NOT established. Paste both files in full in the report and STOP for my review.
R2  COLD_FACTOR: not confirmed. After John applies R1, re-measure the cold-to-warm ratio on the same eight tags plus score-success, first touches included, and report every sample. If any indexed statement exceeds 8s again after R1, STOP: the pending list is ruled out and it is investigated, not absorbed into the factor.
R3  Gating 6bf7aef after 2bdff41's self-inflicted red: accepted (a new tree, disclosed). Queue: the gate refuses to start (exit non-zero, before any stage) when PUPPETEER_PATH is unset or unusable.
R4  Record the apply order honestly in the close-out, as before.

After John applies R1 and the re-measure is clean: full gate on the branch, rebuild main from 03b4257 with merge --no-ff, merged gate, ls-remote, and STOP with the report. Do not say "ready for John's push" until John has read it.

### R1 drafted, STOPPED for review

- supabase/migrations/20261124000001_record_revisions_name_trigram_fastupdate_off.sql: the two ruled statements, fastupdate off first, then the flush.
- supabase/rollbacks/20261124000001_record_revisions_name_trigram_fastupdate_off.rollback.sql: reset (fastupdate) and the ledger row delete, in one begin/commit.
- R3's gate refusal is queued beside H2. R2 waits on the apply.

### R1 applied (John, 2026-11-24); R2 re-measure: STOPPED, score-success crossed 8s again

**Apply record (R4).** John reviewed and approved the migration, then applied it in one begin/commit. The ledger row for 20261124000001 was recorded AFTER that, as a separate statement. The pages-removed count from gin_clean_pending_list was not received (the ruling carried the placeholder "[NUMBER]"). The apply was not verified from this session, because PostgREST does not expose pg_class.reloptions.

**John's diagnostics BEFORE the apply (SQL Editor).**
- The index's reloptions were null, so fastupdate was on, the default. Its size was 7,992 kB.
- record_revisions: n_tup_ins 51,432; n_dead_tup 15,340; last_autovacuum 2026-11-23 12:01:43 UTC, before the index existed; last_autoanalyze 2026-11-24 02:38:28 UTC; autovacuum_count 1.
- John's reading: no autovacuum cleaned the pending list after the index was built, so every insert since then sat in it and every search scanned it.

**R2, run 2026-11-24 04:45 UTC, after the apply.** The measurer was .verify/f5-teardown-scale/p8-cold-warm.mjs, with output in r2-after-fastupdate-off.txt. Each tag got its first touch, then six warm repeats, as one 1,000-row page of the indexed prefix ilike.

| tag | matched | first ms | warm ms | warm min | first/min |
|---|---|---|---|---|---|
| score-success | 4,500 | **8,369, cancelled (57014)** | 906, 753, 585, 358, 439, 346 | 346 | >23.1 |
| cfanyprobe | 66 | 261 | 150, 130, 145, 146, 140, 147 | 130 | 2.01 |
| a1deep | 3,594 | 503 | 279, 285, 183, 267, 265, 199 | 183 | 2.75 |
| R38GATE | 11 | 140 | 113, 134, 124, 120, 116, 122 | 113 | 1.24 |
| a1pad1 | 1,928 | 294 | 289, 261, 204, 285, 248, 147 | 147 | 2.00 |
| a1pad2 | 1,926 | 406 | 720, 141, 160, 252, 245, 198 | 141 | 2.88 |
| a1pad3 | 1,926 | 249 | 262, 239, 192, 192, 150, 190 | 150 | 1.66 |
| tqlay | 63 | 251 | 125, 124, 117, 116, 125, 125 | 116 | 2.16 |
| a1keep | 2,985 | 269 | 259, 255, 208, 259, 258, 149 | 149 | 1.81 |

Reference reads in the same run:
- one-row pk read: 158, 116, 249, 107, 124, 125, 112, 141 (min 107);
- no-match index lookup: 306, 122, 111, 109, 117, 122, 239, 122 (min 109);
- a forced whole-table read (an OR with one unindexed branch): 805, 368, 264, 366, 908 (min 264).

**Per R2 this is the stop.** An indexed statement crossed 8s after R1, so the pending list is ruled out as the whole cause, and the event goes to investigation, not into COLD_FACTOR. No gate was run, main was not touched, and nothing was pushed.

**What the samples show.**
1. **The event is specific to the tag, not to the population.** score-success's first touch has now timed out in both sessions it was measured in. a1deep matches 3,594 rows and its first touch took 503ms. The eight other tags ran 1.24x to 2.88x their warm minimum.
2. **The cancelled statement was slower than a whole-table read.** The forced whole-table read took a 264ms minimum, and score-success's first touch was cancelled at 8,369ms. Whatever is expensive is in how that statement is planned or executed, not in the amount of data.
3. **Candidate, NOT established:** score-success%'s trigrams are common across the table, so the GIN scan has many long posting lists to combine. A cold read of those lists, or a lossy bitmap rechecking many heap pages, would cost more than a sequential read.
4. **The read-only step that settles it** is EXPLAIN (ANALYZE, BUFFERS) of the exact statement in the SQL Editor, ideally on its first run after idle. Beside it, select reloptions to confirm fastupdate=off.

**CURRENT_STATE regenerated** (ruled): live records unchanged at 135; the migration list gains 20261124000001. R2 was run before the regeneration rather than after. Both are reads, so the order changes no result.
