# F5_TEARDOWN_SCALE Phase 0: report. Read-only. STOPPED for your review

Branch `f5-teardown-scale` off origin/main 03b4257 (ls-remote read 03b4257). The brief is the first commit. I made no writes to the database: the measurement scripts ran counts and selects only, and they live in the scratchpad, not the repo.

## Not done, first

- **P1's EXPLAIN is not available from this session.** PostgREST refuses the plan media type (`406 PGRST107`, "None of these media types are available"), and this session has no SQL connection. So the plan below comes from the schema and the measured timings, and it is not a planner output. The SQL to run in the dashboard is under P1. EXPLAIN ANALYZE executes the select, which is read-only.
- **The statement timeout value is not measured.** The test assumes `TIMEOUT_MS = 8000`. `pg_roles` is not reachable through PostgREST. The SQL to read it is under P1.
- **Where the test's ~60s goes is not measured.** Phase 0 is read-only and the test writes. I give statement counts from the code below; the durations come in Phase 1, emitted by the run.

## P1: the statement that times out

**It is the test's own enumeration, not tearDown.** The failure text is `ordered: canceling statement due to statement timeout`, and `ordered` is the `must()` label at `teardown-scoping.test.mjs:404` and `:427`:

    GET record_revisions?select=id,record_id
        &or=(payload->>name.ilike.a1deep*, payload->>name.ilike.score-success*)
        &order=id.asc&offset=<0,1000,...,8000>&limit=1000

**Indexes on `record_revisions`** (from `20260801000000_initial_schema.sql`):
- the primary key on `id`;
- `record_revisions_record_id_idx` on `record_id`;
- unique `(record_id, revision_number)`.

**Nothing indexes `payload->>'name'`.** So the `ilike` OR can use no index for the filter. The planner can either walk the primary key in `id` order and filter every row, or seq scan, filter and sort. Either way, every page reads the whole table.

- **It can use:** `record_revisions_pkey`, for `ORDER BY id` only.
- **It cannot use:** anything, for the filter.

**Measured warm**, 3 samples each, sweep `[a1deep, score-success]`:

    page offset 0      746, 691, 508 ms
    page offset 4000   509, 691, 541 ms
    page offset 8000   411, 393, 391 ms

So a page costs ~0.4 to 0.75s warm, more than 10x under 8s. A crossing is a stall, the class `fixtures.mjs:490` already records (2 of 20 idle runs, at 30,132 and 19,823ms). This loop is outside `pagedSelect`, so it has no stall retry. Per your rule, that is correct and stays.

**SQL for the dashboard** (read-only):

    explain (analyze, buffers)
    select id, record_id from public.record_revisions
    where (payload->>'name' ilike 'a1deep%' or payload->>'name' ilike 'score-success%')
    order by id limit 1000 offset 7000;

    select rolname, rolconfig from pg_roles
    where rolname in ('service_role', 'authenticator', 'authenticated', 'postgres');

## P2: the population it scans

Measured now, exact counts:

    record_revisions, whole table     170,909 rows
    records, whole table              131,582 rows
    a1deep%                             3,594 rows over 2,396 records, 0 live
    a1keep%                             2,985
    a1pad1% / a1pad2% / a1pad3%         1,928 / 1,926 / 1,926
    score-success%                      4,452
    tp2ovA%                               180
    the test's sweep [a1deep, score-success]   8,046

**Finding 1: the population is history, and it is not all this test's.**
- The tags are FIXED names (`a1deep`, `a1keep`, `a1pad1..3`). Each run's fixtures are soft deleted, but their revision rows stay and still match. All 2,396 `a1deep` records are deleted.
- The second tag in the sweep is chosen as the heaviest ledger tag, and today that is `score-success`: **another probe's tag**, swept by this test's `tearDown(sweep)` every run. That is the shape of the 66-record defect this file exists to prevent, reaching only soft-deleted rows today because that probe tears down its own records.
- On 11-18 20:58 the population read 5,366 instead of ~7,850, because a different foreign tag was heaviest that run. The population is whatever someone else left behind.

**Growth, from 40 gate transcripts:**
- The swept population grows ~15 rows per run (7,158, 7,173, 7,188 on consecutive runs), from 7,071 on 10-10 to 8,034 on 11-22.
- **The whole table is the term every page pays**, and it grows faster. It was 99,599 rows at the F5 timeout fix (09-13) and is 170,909 now, across 194 transcripts. That is roughly 370 rows per transcript, an upper bound, because non-gate runs add rows too.
- **The test's duration does not track its population.** Durations are 50,428 to 74,674ms across the 40 runs, with no trend against 7,071 to 8,034.

**Verification 26, on the brief's "its cost scales with accumulated fixture history":** that holds in two separate ways with two separate causes.
- The PAGE COUNT scales with this tag's history: 9 pages per enumeration.
- The COST PER PAGE scales with the whole table's history, because no index serves the filter.

A test fix removes the first. Only an index removes the second.

**Statement exposure per run, counted from the code.** These are full-table statements:
- weighing every ledger tag: 5;
- the population count: 1;
- the headroom probe: 5 + 5 + 1 = 11;
- `ordered`: 9 pages, times up to 6 draws;
- the unranged first page: 1;
- `tearDown(sweep)`: 9 pages;
- `tearDown([KEEP])`: 3;
- `tearDown(PAD_TAGS)`: ~6.

That is **about 45 full-table statements on a single draw**, and every one is a ticket in the stall lottery.

## P3: what the test must prove, and the smallest population that proves it

**The claim:** tearDown's TAG branch finds a record whose tagged revision sits beyond row 1,000 of that tag's population, ordered as tearDown pages, and sweeps it. It must also leave an excluded control standing. Three conditions keep the claim meaningful, and today's test asserts all three:
- the record is HANDED AWAY, so only the tag branch can reach it;
- the population is over 1,000;
- the unranged query genuinely cannot see the record.

**The smallest population that proves it is this run's own 1,001+ rows under ONE per-run tag:**
- **Tag:** `a1deep-<stamp>`, unique per run, so history can never match it.
- **One pad record** owned by the test account, carrying ~1,500 revisions under that tag in one bulk insert. This builds the state directly, as this file's `tagged()` already does, and the record has `revision_number` 1 to 1,500.
- **~30 single-revision candidate records** under the same tag. After one paged enumeration, the test picks the candidate whose first index is over 1,000, and hands THAT one away. "Chosen, not hoped for", as the current comment says, with no redraw loop. If the pad is 1,500 rows, P(no candidate deep) is about 0.656^30, or 3e-6. That failure would be stated, not retried.
- **A per-run control tag** `a1keep-<stamp>`, one record, handed away.
- **No ledger read, no pads, no borrowed tags.** The test then passes on an EMPTY estate by construction, which is Verification 9's starved-estate clause satisfied rather than avoided.

## P4: the other tests asserting a population above 1,000

There are exactly two, both in this file. A comment-aware grep of `scripts/tests` for supra-cap assertions found nothing else.
- **`:234`, `record_revisions`.** That is this test's own population assertion, and P3/P5 cover it.
- **`:509`, `transition_requests`** ("the paging helper returns a whole supra-cap table"). The table holds 5,660 rows.
  - It has the same disease, and TERM_QUOTES Phase 0 says so: it rests on history and goes red on a wipe.
  - It is NOT the timeout: 2,508ms in run 2, primary-key ordered, no filter.
  - **Recommended: not the same treatment this round, queued.** Building 1,001 of its own rows means writing 1,001 `transition_requests`, into a table guarded by `refuse_write_while_frozen` and the raise/decide functions. Verification 46 says to enumerate those guards first, and that is a scoping job of its own.
  - The cheap alternative is to prove `pagedSelect` on this test's own 1,500-row pad, read by `record_id`, which is indexed and costs ~2 pages. That would undo the TEARDOWN_INTEGRITY ruling that chose a DIFFERENT table on purpose (the shared-code argument), so it is your call, not mine.

## P5: proposed fix. Test only, no schema change

1. Rebuild the deep test on P3's own population: per-run tags, the pad, the candidates, pick-after and hand away. The redraw loop, the pads, `weighed` and every borrowed tag are removed. The three conditions in P3 stay asserted, unchanged, and so does the unranged counterfactual.
2. **The headroom guard stays, re-aimed at the run's own tags.**
   - It currently needs `TAG_CHUNK_SIZE` ledger tags, which is borrowing again. It will instead build exactly `TAG_CHUNK_SIZE` per-run tags (deep, keep, one more), so the timed statement is the real shape: a 3-tag OR, ordered, one 1,000-row page off the 1,500 pad.
   - Min of 5 and the cold-tail scan term are kept as ruled.
3. **Teardown, then cleanup. One decision for you:**
   - **(a) Verification 11 as written.** Soft delete only. Each run then leaves ~1,530 revision rows permanently, about 4x today's per-run table growth, and that feeds the per-page scan term every tag statement pays. It works against the round.
   - **(b) Recommended.** `tearDown` performs the claim (soft delete, asserted). Afterwards the test HARD-deletes its own rows, revisions then records, as this file's `purge()` already does for the earlier tests. It then asserts zero rows of the run's tags remain.
     - `purge()` today does not check its errors (Verification 8), and I would fix that in the same change.
     - Counters are never touched.
     - (b) departs from Verification 11's letter, which is why it is yours.
4. **Expected exposure:** about 19 full-table statements a run instead of about 45 (more with redraws). Every page is still a full scan, so the stall lottery shrinks but does not close.
5. **The index, named and NOT drafted, because it is not proposed:** a `pg_trgm` GIN index on `(payload->>'name')`, the only thing that removes the per-page whole-table term. Your rule prefers the test fix. I would draft it in full with its rollback only if you want it in the round.

## P6: calibration plan

The calibration runs the rebuilt test on a temp copy of HEAD, mutating only the copy, with snapshot and byte-compare after each injection. Each verdict is read by the NAMED assertion that failed (Verification 9 and 51), and the run ends with a reverted run.

| | injection, in the copy | must fail on |
|---|---|---|
| I1 | tag branch stops at row 1,000 (an unranged single page) | "the record at index N of M was NOT swept" |
| I2 | `pagedSelect` returns after page 0 | the same |
| I3 | pad shrunk to 900 rows | the population > 1,000 assertion |
| I4 | **wrongly passing:** deep pick forced to a shallow candidate | the index > 1,000 assertion |
| I5 | tag scope ignored for handed records | the control-survives assertion |
| I6 | cleanup skipped (if 5.3(b)) | zero rows of the run's tags remain |
| I7 | a foreign tag added to the sweep | a new assertion: the sweep set is only this run's tags |

I7 closes Finding 1 rather than only rebuilding around it. **Starved-estate check:** the rebuilt test reads no ledger, and it is also run with the fixture tag files moved aside in the copy.

## Decisions for you

1. **P5.3: (a) soft delete only, or (b) teardown then hard purge of the test's own rows.** I recommend (b).
2. **P4 `:509`: queue it, or re-aim it at the test's own pad**, which undoes the TEARDOWN_INTEGRITY ruling. I recommend queuing it.
3. **The index: out of this round, or drafted for your review.** I recommend out.

STOPPED.

## Correction, P7 (2026-11-23). The P1 timing claim was wrong

The sentence under P1, "a page costs ~0.4 to 0.75s warm, more than 10x under 8s", is **wrong as a statement of headroom**. It is left standing above, so a reader can see what was claimed and on what evidence (Verification 29).

**How those timings were taken.**
- The client wall clock in Node, through supabase-js with the service key, over the internet to PostgREST.
- The statement was the test's own: the two-tag OR, ordered by id, one 1,000-row page.
- There were only 9 samples, 3 at each offset. **They were taken after the same script had already scanned the whole table** with an exact count per tag.
- **So every sample was warm. The script never timed a page on a table it had not just read.** The cold cost was in Phase 0's own data: the first `a1deep` count took 4,130ms. I read that as the cost of a count, not as what a first page costs.

**Re-measured through PostgREST, as the test issues it** (12 samples each, `.verify/f5-teardown-scale/p7-page-timings.txt`, script `p7-measure.mjs` beside it):

    one row by primary key (round trip)       min 111  median 146  max 618 ms
    P1, offset 7000, ordered                  min 511  median 560  max 6,657 ms   (the 6,657 is the FIRST sample)
    P1, unordered                             min 456  median 522  max 701 ms
    exact count of the filter                 min 384  median 430  max 720 ms

- **Warm, it reproduces Phase 0:** about 0.4s at the server, after subtracting the round trip.
- **The first touch took 6,657ms**, which is 83% of the timeout. Phase 0's method could not see this.

**The 10x gap against John's 4,054ms is not fully accounted for from here.**
- John's plan read all shared hits, so buffer residency does not explain it.
- The network round trip is about 0.11s, so the network does not explain it.
- Three candidates that this session cannot test:
  - **JIT compilation.** It counts toward Execution Time, and in a parallel plan each worker compiles.
  - **A different plan.** PostgREST sends the statement as a parameterised prepared statement, which may not get the parallel plan.
  - **EXPLAIN's per-row instrumentation.** This should be small with timing off.
- The SQL that tells them apart is in the round's report.

**Which statement_timeout applies to service_role through PostgREST: 8s, measured** (`.verify/f5-teardown-scale/p7-timeout-ladder.txt`, script `p7-timeout.mjs` beside it).
- The probe was a graduated whole-table count. Each extra `ilike` term makes every row extract `payload->>name` once more:

      2 terms     200   1,110ms
      20 terms    200   5,773ms
      60 terms    500   8,296ms  57014 canceling statement due to statement timeout

- service_role has no setting of its own (John's pg_roles reading). PostgREST signs in as authenticator, whose 8s applies from login, and then switches role for each request. **The 8s cancellation is measured; the mechanism in this paragraph is inference.**
- **A finding the ladder also gives:** each `payload->>name` term costs about 0.25s across the whole table. Extracting the name from the jsonb on every row is the dominant cost, so tearDown's three-tag OR costs about three extractions per row.

**What this corrects downstream:**
- **Headroom is about 1.2x cold, 2x on John's server-side reading, and 14x only warm.** A crossing needs a cold first touch, not an anomaly. D6's wording, "a crossing is a stall", is too strong, and the round's report says so.
- **The headroom guard's `COLD_FACTOR = 6` undercounts.** Today's cold-to-warm ratio on the P1 statement was 6,657 / 511, about 13x. This is recorded, not changed: with the index in (D3 reversed), the term the guard watches stops scanning the table.
