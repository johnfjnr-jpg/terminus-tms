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

## Investigation results and rulings (John, 2026-11-24). Supersedes the R2 stop

RECORD (all measured by John in the SQL Editor):
- gin_clean_pending_list returned 429 pages (about 3.4 MB of pending entries, just under the 4 MB gin_pending_list_limit).
- reloptions after the apply: {fastupdate=off}. R1 verified.
- score-success, first page, ilike: Index Scan on record_revisions_pkey (NOT the trigram index), Filter ilike, Rows Removed by Filter 38,484, all shared hits (no disk reads), 6,613ms.
- The same statement with like: the identical plan and rows, 280ms.

CAUSES, established:
C1 The gate-2 headroom timeout (fresh rows): the GIN pending list. Fixed by R1.
C2 The score-success timeouts: the planner walks the primary key for ORDER BY id LIMIT 1000 and runs the ilike filter on every row it passes; ilike on payload->>'name' costs about 24x like. Not disk, not the pending list. Record both in DESIGN_PRINCIPLES "F5 TEARDOWN SCALE", with my earlier disk-read guess named as wrong.

RULINGS:
F1  Tag filters in the fixture machinery switch from ilike to like (case-sensitive): tearDown's tag branch in fixtures.mjs, teardown-scoping (every site, purge included), the headroom guard, the create-from-any-contact probe's scans, and the gate's end-of-run sweep. Product search code is NOT in scope; do not touch it.
F1a FIRST, a case census, read-only: for every tag in the fixture ledger and every tag the gate's probes use, count LIVE records matched by ilike and by like. Any tag where like misses a LIVE record that ilike finds: STOP and list them (switching would leave live residue). Report the same counts for soft-deleted rows, informationally.
F1b Add a pure test: every fixture name the code builds starts with its tag exactly (no case transformation), so the census cannot rot.
F2  Re-run R2 with like: the eight tags plus score-success, first touches included, every sample reported, from those set COLD_FACTOR. STOP if any statement exceeds 8s.
F3  R1 stays as applied.
F4  Queued, unchanged: H2 (per-run tags across the 23 wired probes), the gate refusing to start without a usable PUPPETEER_PATH, and :509.

Then: regenerate CURRENT_STATE, the branch gate, rebuild main from 03b4257 with merge --no-ff, the merged gate, ls-remote, and STOP with the report. Report teardown-scoping's duration, the headroom guard's minimum and the database suite's time on every gate run. Do not say "ready for John's push" until John has read it.

### F1a, F1, F1b and F2, built

1. **F1a census, read only** (.verify/f5-teardown-scale/f1a-case-census.txt). 34 tags or prefixes, drawn from the gate's own sources, not from the H2 list:
   - `GATE`, which the gate passes to its ten probe-* stages;
   - the probes' default tags;
   - the fixed tags: readonly-probe, readonly-approver, adjgap, score-success, issue-target, proposal-issued, zero-track, ffdb, tqv, cftermref, cvunpriced, ffwonclick, tqclick, tqlay and tp2ovA;
   - the per-run prefixes cfanyprobe, tdhand, a1deep, a1keep and a1third;
   - a1pad1 to a1pad3.

   The fixture ledger was empty. **LIVE records that ilike finds and like misses: 0.** Live records matched by either filter: 0 for every tag. Soft-deleted counts are in the file, and like and ilike agree on every tag.

   Calibrated: the case-flipped tags r41close, r38Gate and Tqlay came back entirely ilike-only, at 4, 2 and 18 records, exactly their real counts. The live classification read 3 of 3 live records correctly. **No end-of-run sweep exists in verify-all.mjs as a separate site:** the ledger-wide tearDown in fixtures.mjs is the one path, and it is switched.
2. **F1, switched to like:**
   - fixtures.mjs's tag branch;
   - teardown-scoping's or helper, the INDEX probe and the purge;
   - the two calibrators' anchors and their residue reads.

   The create-from-any-contact probe already used like, so only its comment changed. No product code was touched. The headroom calibrator's synthetic heavy branches stay ilike on purpose, because they are a cost injection, not a tag filter.
3. **F1b:** scripts/tests/fixture-names-carry-tag.test.mjs, in the pure suite, with scripts/lib/fixture-name-tag.mjs.
   - It checks that every fixture name in the three switched files starts with `${tag}` exactly.
   - It also checks that no fixture or teardown call anywhere in scripts/ passes a case-transformed tag.
   - The counterexamples are built into the test.
   - Calibrated on real files on temp copies, 3/3: a lowercased tag in a fixtures.mjs name fires, a transformed tag at a real tearDown call fires, and the untouched copy passes.
   - Its first run caught two of my own faults: a capture that stopped at the `}` of `${tag`, and the call scan reading its own literal counterexamples. The second was fixed by assembling those strings, not by exempting the file.
4. **F2** (.verify/f5-teardown-scale/f2-cold-warm-like.txt, 05:04 UTC). Each figure is the first touch over the warm minimum:

   | tag | ratio |
   |---|---|
   | tqlay | 1.11 |
   | R38GATE | 1.28 |
   | cfanyprobe | 1.54 |
   | a1pad3 | 2.03 |
   | a1pad1 | 2.13 |
   | a1keep | 2.13 |
   | a1deep | 2.77 |
   | a1pad2 | 2.95 |
   | **score-success** | **4.32** (first 1,219ms, warm min 282ms) |

   No statement crossed 8s. **COLD_FACTOR is 5; the ceiling is 1,067ms.**

### The commit was REFUSED: the INDEX guard fired. STOPPED before any gate

The pre-commit hook ran:

| suite | result | time |
|---|---|---|
| pure | PASS | 5.9s |
| react | PASS | 29.7s |
| typecheck | PASS | 0.8s |
| database | **FAIL** | 126.3s |

teardown-scoping failed in 26,316ms with: "INDEX: the no-match tag lookup costs 202ms over a one-row pk read (lookup min 317ms)", against 100ms of slack. The HEADROOM assertion comes first in the test, so it passed. The hook truncates, so its minimum is not in the output. Per D6, I investigated and did not retry.

**Measured, read only** (.verify/f5-teardown-scale/f1-index-probe-measure.txt and -20.txt), 20 interleaved samples each:

| form | min | samples | note |
|---|---|---|---|
| one-row pk read (rtt) | 120ms | | |
| direct like, ORDER BY id, one page: the INDEX probe's form | 116ms | about half of the 20 at 300 to 680ms, the rest at about 120 to 145 | **bimodal.** An earlier 8-sample run opened at 4,223ms |
| direct ilike, the same shape | 122ms | 124 to 181, one at 879 | |
| like in or-form, ORDER BY id: the form tearDown, the headroom probe and the purge run | 112ms | mostly 112 to 206, one at 309 | |
| like with no ORDER BY: the form the create-from-any-contact probe runs | 122ms | mostly 122 to 165, one at 396 | |
| 3-tag like OR over a1deep, a1keep and a1pad1 | 268ms | 268 to 634 | gate 1's ilike headroom minimum was 174ms |

**Reading, NOT established (no plans from PostgREST).**
- The direct-like form alternates between two plans. Its slow mode fits C2's primary-key walk, with a cheap like filter, over most of the table.
- Under ilike the same shape planned onto the trigram index. Under like the planner sometimes prefers the walk.
- The guard is right that this form sometimes reads the table. But no code in the fixture machinery issues that form.
- F1 makes the per-row cost of the walk cheap. It does not stop the planner choosing the walk, and the walk grows with the table.

**Positions for John:**
1. **Re-aim the INDEX probe at the or-form, the statement tearDown actually issues**, as HEADROOM already does. This is the recommendation, but it changes what a guard measures after the guard fired, which is the move Verification 47 warns about. So it is John's call.
2. **Or keep the direct form and treat its bimodality as the finding.** That would need EXPLAIN of both modes: `explain (analyze, buffers) select id, record_id from public.record_revisions where (payload ->> 'name') like 'zzzz-headroom-no-match-%' order by id limit 1000;`, run several times.

The F1, F1b, COLD_FACTOR and DESIGN_PRINCIPLES work is STAGED and uncommitted on f5-teardown-scale, because the hook refused it. No file under src/ or frontend/ is touched.

## Ruling on the INDEX guard (John, 2026-11-24)

G1  Option 1: re-aim the INDEX probe at the or-form, the statement tearDown actually issues. Measure it with ONE tag and with three, both no-match, ORDER BY id, one page. The 100ms-over-rtt slack stands unless your samples of the or-form show it cannot hold; if so, report the samples and STOP rather than widen it.
G2  This is a re-aim to the claim, not a relaxation after a red: record in the brief and DESIGN_PRINCIPLES that the direct single-term like form, ORDER BY id LIMIT, alternates between the trigram index and a primary-key walk (min 116ms, about half the samples 300 to 680ms, one 4,223ms), with the samples, and that no fixture code issues it.
G3  Add a pure test: every tag filter in fixtures.mjs, teardown-scoping and the two calibrators goes through the one or-helper; a direct single-term like or ilike on payload->>name with ORDER BY id in those files fails it. Calibrate: an injected direct form FIRES; the untouched tree passes.
G4  Record, not acted on: the 3-tag like OR's minimum (268ms) is above gate 1's 174ms under ilike, unexplained, and under the 1,067ms ceiling.
G5  COLD_FACTOR 5 and the 1,067ms ceiling accepted, with F2's caveat recorded (score-success had been read 20 minutes earlier).

Then: commit (the hook's four suites must pass), the headroom calibrator re-run for the new ceiling, regenerate CURRENT_STATE, the branch gate, rebuild main from 03b4257 with merge --no-ff, the merged gate, ls-remote, and STOP with the report. Report teardown-scoping's duration, the headroom guard's minimum, the INDEX figure and the database suite's time on every gate run. Do not say "ready for John's push" until John has read it.

### G1 to G5, built

1. **G1, measured before the re-aim** (.verify/f5-teardown-scale/g1-orform-measure.txt, 05:28 UTC). Two runs of 20 interleaved samples. The guard statistic is the minimum of 5 samples, over the rtt minimum of the 5 alongside them.

   | run | form | rtt min | lookup min | over rtt | guard statistic per window |
   |---|---|---|---|---|---|
   | 1 | 1 term | 112ms | 109ms | -3ms | -19, -14, -5, 2 |
   | 1 | 3 terms | 112ms | 109ms | -3ms | -14, -14, -6, 8 |
   | 2 | 1 term | 111ms | 111ms | 0ms | 2, 1, 1, -2 |
   | 2 | 3 terms | 111ms | 111ms | 0ms | 17, 23, 0, -2 |

   **The slack holds, and it stands at 100ms.** The INDEX probe is now TAG_CHUNK_SIZE no-match terms through the same `or` tearDown uses.
2. **G2, recorded** here, in DESIGN_PRINCIPLES "F5 TEARDOWN SCALE", and at the probe.

   The direct-like samples, 20 interleaved, 05:13 UTC: 681, 136, 303, 136, 365, 135, 352, 312, 385, 304, 116, 376, 531, 640, 132, 124, 125, 129, 143, 210. An earlier 8-sample run: 4,223, 421, 326, 305, 356, 116, 311, 383.
3. **G3:** `tagOr` and `syntheticNameCost` in scripts/lib/tag-filter.mjs.
   - fixtures.mjs, teardown-scoping (its `or` and the purge) and both calibrators build every tag filter with `tagOr`. The calibrators' anchors moved with the code; each lands exactly once.
   - The headroom calibrator's synthetic cost comes from `syntheticNameCost`, defined in the guard's own module.
   - scripts/tests/one-tag-filter.test.mjs, in the pure suite, refuses a direct `.like` or `.ilike` on payload->>name, and a hand-built payload->>name filter string, in those four files.
   - It is stricter than the ruling's letter: it refuses the direct form whatever follows it, because an ORDER BY two lines down a chain is easy for a matcher to lose.
   - Calibrated 3/3 on real files on temp copies: a direct like injected into teardown-scoping fires, a hand-built string injected into fixtures.mjs fires, and the untouched copy passes.
   - Two faults in my own harness along the way: a population floor of 2 where teardown-scoping makes one call (the test body holds an alias), and a typed pass count of 7 where the suite prints 6. Both were corrected to the counts the run printed.
4. **G4, recorded, not acted on:** the 3-tag like OR's minimum of 268ms is above gate 1's 174ms under ilike. It is unexplained, and under the 1,067ms ceiling.
5. **G5, accepted:** COLD_FACTOR 5 and the 1,067ms ceiling, with F2's caveat. score-success had been read with ilike 20 minutes before F2. On John's EXPLAIN its cost is CPU, not cache, so its "first touch" was the first statement of the process.

### The merged gate on 21b66b5: RED, 38 of 39 (2026-11-24). STOPPED

- The branch gate on 75510b0 was GREEN, 39 of 39.
- The merged gate failed one check in `browser term quote tab`: K10, "choosing Commercials writes pricingMethod, and the Term quote tab goes inactive". The click on `pm-commercials` sent NO request, and the stage took 98,631ms against 53,820ms on the branch.
- The merged tree is byte-identical to the branch tree, and nothing under src/ or frontend/ differs from 03b4257's merge base. K10 passed in the 10 other gate logs kept. There was no residue.
- The cause was not established: the run did not record what was at the click point (Verification 14's click clause). Nothing was pushed; origin main stayed at 03b4257.

## Ruling on the K10 red (John, 2026-11-25). Option 1.

K1  Instrument K10 in probe-term-quote-tab-click.mjs. Immediately before the click on pm-commercials, record elementFromPoint at the control's centre, the control's disabled state and any in-flight request count. Then wait for the control to be present, enabled and on top (elementFromPoint is the control or its child) before clicking, with a bounded wait whose expiry is a named failure stating what was found.
K2  If the instrument shows the control disabled or covered BECAUSE the product had a save or reload in flight (not because the probe raced the first render), that is a PRODUCT finding: a user's click would be swallowed silently. Then STOP and report it; do not absorb it into the wait.
K3  Calibrate: an injected cover over the control FIRES the named failure; an injected disabled state FIRES it; the untouched probe passes.
K4  Apply the same present-enabled-on-top wait to the probe's other selector clicks only if the same helper serves them; otherwise list them as queued.

Then: commit on the branch (the hook's four suites), branch gate, rebuild main from 03b4257 with merge --no-ff (21b66b5 and 4c35c54 kept as recovery points), the merged gate once, ls-remote, and STOP with the report. Report the K10 instrument's readings, teardown-scoping's duration, the headroom minimum, the INDEX figure and the database suite's time on every gate run. Record this stop and ruling in the brief. Do not say "ready for John's push" until John has read it.

### K1 to K4, built

1. **K1:** `clickWhenLive(sel, label)` in the probe.
   - It waits for presence, scrolls the control to centre (what `page.click` would do), and prints a FIRST-SIGHT reading: present, disabled, onTop, the elementFromPoint hit, the point, `__oppLoadsInFlight()`, and every /api request in flight (tracked from the page's request events).
   - It then waits up to 10,000ms for present, enabled and on top, and prints an AT-CLICK reading.
   - Expiry is the named failure `K10 pm-commercials: <selector> present, enabled and on top within 10000ms`, carrying the reading. The K10 check also requires that the click was made.
2. **K2:** a control NOT live at first sight while anything was in flight fails its own check, `not live at first sight with nothing in flight (else a click is swallowed)`, so it is reported rather than absorbed by the wait.
   - **Its limit, measured:** two background GETs (the record's history and exit criteria) were in flight at first sight on every run, so this check fires on ANY not-live first sight, including both injections. It records a coincidence, not a cause. If it fires on a gate, the readings are read before anything is concluded.
3. **K3, calibrated 3/3** (scripts/f5-teardown-scale/calibrate-k10-live-click.mjs, run mwvqeggz, on temp copies of the working-tree probe, sha256 8897728130696af2):
   - COVER, a transparent fixed cover over the viewport: the named failure fired, hit `div#k3-cover`, onTop false.
   - DISABLED, the control disabled in the DOM: the named failure fired, disabled true.
   - reverted: 29/29, the at-click reading on top.
   - Each run's tag read back from the database with zero live records.
4. **K4:** the K10 return click (`pm-term_quote`, the same selector) goes through the same helper. The probe's nine other `page.click` sites are not served by it and are QUEUED: the detail-tab click in `tab()`, `tp-ladder-120` twice, `tq-save` twice, `tq-submit` twice, `tp-tab-payment`, and `tp-factoring-toggle`.
5. **The instrument's first readings, on the tree** (.verify/f5-teardown-scale/k1-untouched-tree.txt): both K10 clicks live at first sight, enabled, the hit the button itself. The return click was made with the opportunity reload still in flight (`oppLoads` 1, five GETs), and it landed.
