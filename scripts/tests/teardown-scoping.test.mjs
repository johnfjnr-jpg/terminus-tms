// tearDown() is scoped by TAG, not by owner.
//
// THE DEFECT THIS EXISTS TO PREVENT, measured 2026-09-08: a single gate run
// soft deleted 66 records belonging to another round, in one bulk update,
// while the probe that triggered it printed "2 soft-deleted". The teardown
// swept every live record owned by the test account and called that "the
// complete set by construction".
//
// BOTH DIRECTIONS IN ONE TEST, deliberately. A test that only proves the
// sweep works would pass against the old code too: the old code swept
// everything, so it swept its own fixtures correctly. The claim that
// discriminates is the SURVIVOR.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { admin, tearDown, tagsToSweep, TAG_CHUNK_SIZE } from '../fixtures.mjs'
import { tagOr } from '../lib/tag-filter.mjs'

const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const stamp = () => Math.random().toString(36).slice(2, 8)

// Built the way the SYSTEM produces the state (Verification 47): a record the
// test account owns, carrying a tag in its payload name, exactly as every
// fixture helper writes one.
async function tagged(tag, owner) {
  const rec = must(await db.from('records').insert({
    record_type: 'opportunity', status: 'Qualification', owner_id: owner,
  }).select('id').single(), 'insert record')
  must(await db.from('record_revisions').insert({
    record_id: rec.id, revision_number: 1,
    payload: { name: `${tag} Opportunity` }, created_by: owner,
  }).select('id').single(), 'insert revision')
  return rec.id
}
const isLive = async (id) => {
  const r = must(await db.from('records').select('id, deleted_at').eq('id', id), 'read')
  return r.length === 1 && !r[0].deleted_at
}
// Every error checked (Verification 8, ruling D1 of F5_TEARDOWN_SCALE). It
// used to discard both results, so a purge blocked by a RESTRICT child
// returned silently and left the row. Records go ONE AT A TIME in the order
// given, so a caller passing a child before its parent is never refused by
// parent_record_id's RESTRICT inside a single statement.
const purge = async (ids) => {
  must(await db.from('record_revisions').delete().in('record_id', ids).select('id'), 'purge revisions')
  for (const id of ids) {
    const gone = must(await db.from('records').delete().eq('id', id).select('id'), `purge record ${id}`)
    assert.equal(gone.length, 1, `purge: record ${id} was not deleted`)
  }
}

test('tearDown sweeps its own tag AND leaves another round\'s tag standing', async () => {
  const session = JSON.parse((await import('fs')).readFileSync(
    '/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
  const owner = session.user.id
  const mineTag = `tdscope-mine-${stamp()}`
  const theirsTag = `tdscope-theirs-${stamp()}`

  const mine = await tagged(mineTag, owner)
  const theirs = await tagged(theirsTag, owner)
  // A UNIT CARRIES NO NAME IN ITS PAYLOAD, so no tag can ever match it. It has
  // to be reached as a CHILD of a record that does match. Without this the
  // descendant rule is a claim nothing asserts, and an injection removing it
  // would come back silent (Verification 51).
  const child = must(await db.from('records').insert({
    record_type: 'unit', status: 'Active', owner_id: owner, parent_record_id: mine,
  }).select('id').single(), 'insert child').id

  try {
    assert.equal(await isLive(mine), true, 'precondition: my record starts live')
    assert.equal(await isLive(theirs), true, 'precondition: their record starts live')

    const { removed } = await tearDown(mineTag)

    // DIRECTION ONE: the sweep works.
    assert.equal(await isLive(mine), false, 'the tagged record was NOT swept')
    assert.ok(removed.some((r) => r.id === mine), 'the swept record is not in the returned list')

    // DIRECTION TWO: and it stopped there. This is the assertion the old
    // owner-scoped code fails, and the only one that can tell them apart.
    assert.equal(await isLive(theirs), true,
      'ANOTHER ROUND\'S TAGGED RECORD WAS DESTROYED - this is the 66-record defect')
    assert.ok(!removed.some((r) => r.id === theirs),
      'another round\'s record appears in the removed list')

    // The unnamed child goes with its parent.
    assert.equal(await isLive(child), false,
      'the unit child was left live - a tag cannot match it, so it must be swept as a descendant')
  } finally {
    await purge([child, mine, theirs])
  }
})

test('tearDown REFUSES when no tag can be determined, never sweeping by owner', async () => {
  // An explicit empty ARRAY, not '': a falsy string means "no explicit tag,
  // use the files", and while a fixture file exists that path finds tags and
  // the refusal is never reached. Measured, not assumed - the first version of
  // this test passed '' and swept the recorded tags instead of refusing.
  await assert.rejects(() => tearDown([]), /will NOT fall back/,
    'with no tag it must refuse, because the fallback IS the defect')
})

test('tagsToSweep prefers an explicit tag over the recorded files', () => {
  assert.deepEqual(tagsToSweep('explicit-wins'), ['explicit-wins'])
  assert.deepEqual(tagsToSweep([]), [], 'an explicit empty array is a set, not an absence')
})

// ── P2.5: A PROBE THAT HANDS A RECORD AWAY LEAVES ZERO RESIDUE ────────────
//
// tearDown's candidate set is owner scoped, which is what makes reaching a
// business record impossible. Every ownership probe hands a record to another
// owner - that IS the state being tested - and the moment it does, the record
// leaves that set and cannot be swept. Measured three times in one phase.
test('a record handed to another owner is still swept', async () => {
  const session = JSON.parse((await import('fs')).readFileSync(
    '/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
  const owner = session.user.id
  const tag = `tdhand-${stamp()}`
  const { data: u } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const other = u.users.find((x) => x.email === 'ownership-other@terminus-probe.invalid')?.id
  assert.ok(other, 'the probe account must exist for this test to mean anything')

  const id = await tagged(tag, owner)
  try {
    // HANDED AWAY: from here it is outside the owner-scoped candidate set.
    must(await db.from('records').update({ owner_id: other }).eq('id', id).select('id'), 'hand over')
    const beforeOwner = must(await db.from('records').select('owner_id').eq('id', id), 'read')[0].owner_id
    assert.equal(beforeOwner, other, 'precondition: the record now belongs to someone else')

    const { removed } = await tearDown(tag)
    assert.ok(removed.some((r) => r.id === id),
      'a handed-away record was NOT swept: it is outside the owner-scoped candidate set')
    assert.equal(await isLive(id), false, 'the handed-away record is still live after teardown')
  } finally {
    await purge([id])
  }
})

// ── A1, 2026-09-10: THE PAGE CAP ──────────────────────────────────────────
//
// tearDown's tag branch answered from PostgREST's default first 1,000 rows.
// Measured before the fix: 23,210 matching revision rows covering 7,938
// records, of which the query returned 1,000 covering 414. Teardown was
// deciding what to sweep from 5.2% of the records it was asking about.
//
// THIS TEST EXISTS BECAUSE EVERY OTHER TEST IN THIS FILE IS BLIND TO IT. They
// build two or three fixtures and sweep them, so their population is three
// orders of magnitude under the cap and an unranged query returns all of it.
//
// ── F5_TEARDOWN_SCALE, 2026-11-22: THE POPULATION IS THIS RUN'S OWN ───────
//
// SUPERSEDED REASONING LEFT VISIBLE (Verification 29). This test used to read
// "the population here is the REAL one: every tag in the ledger", and built
// it from FIXED tag names (a1deep, a1keep, a1pad1..3) plus the heaviest tag
// the ledger held. Measured at Phase 0 (F5_TEARDOWN_SCALE_PHASE_0_REPORT.md):
//
//   - the population was HISTORY: a1deep matched 3,594 revision rows over
//     2,396 records, every one of them soft deleted by earlier runs;
//   - the second tag was ANOTHER PROBE'S (`score-success`, 4,452 rows), and
//     this test swept it every run: the 66-record defect's shape, in the test
//     written to prevent it;
//   - and the cost was about 45 whole-table statements a run, because no
//     index serves `payload->>name`, so every page reads all of
//     record_revisions (170,909 rows) whatever the tag matches. One of them
//     crossed the statement timeout on 2026-11-22 (51,709ms), a stall of the
//     fixtures.mjs:490 class.
//
// The claim needs none of that. It needs ONE tag whose population is over the
// cap, a record reached only by the tag branch, deep in the order tearDown
// pages by. So the test builds exactly that, under tags no other run can
// carry, and removes it afterwards (ruling D1). It passes on an EMPTY estate
// by construction, and reads no ledger.
//
// THIS REDUCES STALL EXPOSURE; IT DOES NOT REMOVE IT. Every page is still a
// whole-table scan. A future red here is investigated as a stall, never
// retried (ruling D6).
//
// ── 2026-11-24: THE INDEX IS IN, AND THE TWO SENTENCES ABOVE ARE HISTORY ──
//
// `record_revisions_payload_name_trgm_idx` (migration 20261123000001, GIN,
// gin_trgm_ops on payload->>'name') was applied by John on 2026-11-24. Every
// tag filter in this file is a prefix ilike the index serves, so a page is a
// bitmap index scan plus heap visits for the MATCHED rows, not a read of the
// whole table. John's EXPLAIN: the P1 statement 4,506ms before, 265.8ms after.
// "No index serves payload->>name" and "every page is still a whole-table
// scan" were true when written and are left above as the record (Verification
// 29). What grows now is a tag's MATCHED SET, which is why this test's tags
// are per run. Ruling D6 is unchanged: a red here is investigated, never
// retried.
//
// ── 2026-11-24, LATER: LIKE, NOT ILIKE (ruling F1) ────────────────────────
//
// "A page is a bitmap index scan plus heap visits for the MATCHED rows" is
// not true of an ORDERED page, and is left above as the record. John's
// EXPLAIN of score-success's first page: the planner walks the primary key
// for ORDER BY id and runs the filter on every row it passes (38,484 removed
// by filter, no disk reads), 6,613ms with ilike, 280ms with like on the same
// plan. Every tag filter in this file, the purge included, is now a
// case-sensitive prefix like.
const PAD = 1500
const CANDIDATES = 30

test('tearDown reaches a record beyond row 1,000 of its own tag population', async () => {
  const { admin, tearDown, TAG_CHUNK_SIZE } = await import('../fixtures.mjs')
  const { unrangedForCalibration } = await import('../lib/unbounded-selects.mjs')
  const db = admin()
  const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
  const exactCount = async (q, w) => {
    const { count, error, status } = await q
    if (error) throw new Error(`${w}: status ${status} ${error.message}`)
    return count
  }
  const owner = JSON.parse((await import('fs')).readFileSync(
    '/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8')).user.id

  // ── PER-RUN TAGS. No other run can carry one, so history cannot match ──
  const RUN = stamp()
  const TAG = `a1deep-${RUN}`
  const KEEP = `a1keep-${RUN}`
  const THIRD = `a1third-${RUN}`
  const RUN_TAGS = [TAG, KEEP, THIRD]
  // The one tag filter tearDown also uses (ruling G3).
  const or = tagOr
  const created = new Set()

  // Built directly, as this file's `tagged()` builds every fixture: a record
  // the test account owns, its tag in the payload name. Many revisions on one
  // record is a state the system produces (every PATCH appends one); building
  // 1,500 by hand is the cost of not waiting for it.
  const newRecords = async (n, w) => {
    const rows = must(await db.from('records').insert(Array.from({ length: n }, () => ({
      record_type: 'opportunity', status: 'Qualification', owner_id: owner,
    }))).select('id'), w)
    assert.equal(rows.length, n, `${w}: inserted ${rows.length} of ${n}`)
    for (const r of rows) created.add(r.id)
    return rows.map((r) => r.id)
  }
  const newRevisions = async (rows, w) => {
    for (let i = 0; i < rows.length; i += 500) {
      const got = must(await db.from('record_revisions').insert(rows.slice(i, i + 500)).select('id'), w)
      assert.equal(got.length, rows.slice(i, i + 500).length, `${w}: revisions short`)
    }
  }
  const name = (t) => ({ name: `${t} Opportunity` })

  // The tag population, enumerated in the order tearDown pages by. Its own
  // loop, NOT pagedSelect: pagedSelect retries a stall, and this test must
  // not (ruling D6, "never add retries").
  const enumerate = async (ts, w) => {
    const out = []
    for (let from = 0; ; from += 1000) {
      const d = must(await db.from('record_revisions').select('id, record_id')
        .or(or(ts)).order('id', { ascending: true }).range(from, from + 999), w)
      out.push(...d)
      if (d.length < 1000) break
    }
    return out
  }

  // The purge runs whatever happens, and a purge failure never hides the
  // body's own failure: both are reported.
  let bodyErr = null
  try {
    const [pad] = await newRecords(1, 'pad')
    await newRevisions(Array.from({ length: PAD }, (_, i) => ({
      record_id: pad, revision_number: i + 1, payload: name(TAG), created_by: owner,
    })), 'pad revisions')
    const candidates = await newRecords(CANDIDATES, 'candidates')
    await newRevisions(candidates.map((id) => ({
      record_id: id, revision_number: 1, payload: name(TAG), created_by: owner,
    })), 'candidate revisions')
    const [kept, third] = await newRecords(2, 'control and third')
    await newRevisions([
      { record_id: kept, revision_number: 1, payload: name(KEEP), created_by: owner },
      { record_id: third, revision_number: 1, payload: name(THIRD), created_by: owner },
    ], 'control revisions')

    // ── CONDITION 1: THE POPULATION IS OVER THE CAP, AND IT IS OURS ──────
    const population = await exactCount(db.from('record_revisions')
      .select('id', { count: 'exact', head: true }).or(or([TAG])), 'population')
    assert.ok(population > 1000,
      `the population is ${population} (exact count), at or under the cap, so this test cannot see the defect`)
    assert.equal(population, PAD + CANDIDATES,
      'the tag matches rows this run did not write, so the population is not only ours')
    console.log(`    population: ${population} rows (exact count), this run's own tag ${TAG}, cap 1000`)

    // ── CONDITION 2: THE DEPTH IS CHOSEN AFTER THE FACT, NOT HOPED FOR ───
    //
    // Ids are random uuids, so where a candidate lands is not known until the
    // population is enumerated. Thirty candidates against a 1,500-row pad:
    // the chance that none lands past row 1,000 is about 0.656^30, 3e-6, and
    // that case FAILS, stated, rather than redrawing.
    const ordered = await enumerate([TAG], 'ordered')
    assert.equal(ordered.length, population, 'the enumeration did not walk every row')
    const depth = (id) => ordered.findIndex((r) => r.record_id === id)
    const pick = candidates.find((id) => depth(id) > 1000)
    assert.ok(pick, `no candidate of ${CANDIDATES} landed past row 1,000 of ${ordered.length}`)
    const index = depth(pick)
    console.log(`    fixture at index ${index} of ${ordered.length} (paged, full enumeration)`)
    assert.ok(index > 1000, `the chosen record sits at index ${index}, inside the first page`)

    // ── CONDITION 3: ONLY THE TAG BRANCH CAN REACH IT ─────────────────────
    //
    // A record the test account still OWNS is found by the owner-scoped
    // candidate branch and never needs the tag query. Handing it away is what
    // puts it under the branch being tested. Raw update rather than handOver(),
    // because the ledger is the other route to a handed record and would mask
    // the branch under test.
    const other = must(await db.from('track_approvers').select('user_id')
      .eq('record_type', 'opportunity').neq('user_id', owner).limit(1), 'other owner')[0]?.user_id
    assert.ok(other, 'a second owner must exist for this test to mean anything')
    for (const id of [pick, kept]) {
      must(await db.from('records').update({ owner_id: other }).eq('id', id).select('id'), `hand ${id}`)
    }

    // ── THE HEADROOM GUARD, ON THIS RUN'S OWN TAGS ────────────────────────
    //
    // It times one page of the statement tearDown's tag branch actually runs:
    // a TAG_CHUNK_SIZE-tag OR, ordered by id, one 1,000-row page, over this
    // run's own tags (1,532 matched rows, every run).
    //
    // SUPERSEDED, LEFT VISIBLE (Verification 29). Before the index this block
    // said "every page reads the whole table, so the timing still measures the
    // term that grows", and carried a second probe, a no-match ilike, as the
    // whole-table SCAN TERM, multiplied by a cold factor of 6. After the index
    // that probe is an index lookup that finds nothing: it measured the network
    // and passed whatever happened. Re-aimed 2026-11-24 on John's ruling:
    //
    // 1. HEADROOM. The MINIMUM of SAMPLES (noise is strictly additive, the F5
    //    timeout fix round), times COLD_FACTOR, must sit under the timeout with
    //    MARGIN to spare.
    //
    //    COLD_FACTOR IS MEASURED, NOT CARRIED. Post-index, through PostgREST,
    //    the same statement shape (one tag, ordered, one page), first touch of
    //    a historical fixture tag against the minimum of six warm repeats
    //    (.verify/f5-teardown-scale/p8-cold-warm.all.txt, 2026-11-24):
    //
    //        cfanyprobe 1.29   a1deep 2.01   R38GATE 2.08   a1pad2 2.10
    //        a1pad3 2.26       tqlay 2.65    a1pad1 2.74    a1keep 3.47
    //
    //    ~~Maximum 3.47, so COLD_FACTOR is 4.~~ SUPERSEDED by the F2 re-measure
    //    below. The old 6 was taken before the index, against whole-table
    //    scans; P7 measured that regime at about 13x.
    //
    //    ~~WHAT THIS DOES NOT COVER. score-success's first touch was cancelled
    //    by the 8s timeout. It reads as the GIN index itself being cold after
    //    idle.~~ WRONG, and left visible (Verification 29). John's EXPLAIN:
    //    no disk reads at all. The planner walks the primary key for ORDER BY
    //    id and runs the ilike on every row it passes, and ilike costs about
    //    24x like there (cause C2). The filter is now like (ruling F1).
    //
    //    F2, THE RE-MEASURE WITH LIKE, 2026-11-24 05:04 UTC, after the GIN
    //    pending list was turned off and flushed (20261124000001), the same
    //    eight tags plus score-success, first touch over the minimum of six
    //    warm repeats (.verify/f5-teardown-scale/f2-cold-warm-like.txt):
    //
    //        tqlay 1.11        R38GATE 1.28   cfanyprobe 1.54   a1pad3 2.03
    //        a1pad1 2.13       a1keep 2.13    a1deep 2.77       a1pad2 2.95
    //        score-success 4.32 (first 1,219ms, warm min 282ms)
    //
    //    No statement crossed 8s. Maximum 4.32, so COLD_FACTOR is 5.
    //
    // 2. THE INDEX SERVES THE FILTER. The no-match lookup now asks the
    //    question it can answer: its server-side cost over a one-row primary
    //    key read must stay under INDEX_SLACK_MS. Indexed it is about zero
    //    (min 115ms against rtt 118ms); forced off the index (an OR with an
    //    unindexed branch, a whole-table read) it was about 200ms over rtt. A
    //    dropped or unusable index fails here by name, where the headroom
    //    bound alone would let a warm 400ms seq scan through.
    const TIMEOUT_MS = 8000
    const COLD_FACTOR = 5
    const MARGIN = 1.5
    const CEILING = Math.round(TIMEOUT_MS / COLD_FACTOR / MARGIN)
    const INDEX_SLACK_MS = 100
    const SAMPLES = 5
    assert.equal(RUN_TAGS.length, TAG_CHUNK_SIZE,
      'the probe must use the same chunk size the code does, or it times a statement nobody runs')
    const minOf = async (n, q, w) => {
      const ms = []
      for (let i = 0; i < n; i++) {
        const t0 = Date.now()
        const { error } = await q()
        if (error) throw new Error(`${w}: ${error.message}`)
        ms.push(Date.now() - t0)
      }
      return { ms, min: Math.min(...ms) }
    }
    const probe = await minOf(SAMPLES, () => db.from('record_revisions')
      .select('id, record_id').or(or(RUN_TAGS)).order('id', { ascending: true }).range(0, 999), 'headroom probe')
    const rtt = await minOf(SAMPLES, () => db.from('record_revisions')
      .select('id').order('id', { ascending: true }).range(0, 0), 'rtt probe')
    // RE-AIMED TO THE CLAIM, ruling G1 (John, 2026-11-24): the lookup is the
    // OR-FORM tearDown issues, TAG_CHUNK_SIZE no-match terms. It was a direct
    // single-term like (before that, ilike), which no fixture code issues.
    // After F1 that direct form, ordered by id, alternated between the trigram
    // index and a primary-key walk: min 116ms, about half of 20 samples at 300
    // to 680ms, one at 4,223ms. This guard fired on it (202ms over rtt) and was
    // right about that statement. The or-form, measured with one term and with
    // three: min 0ms over rtt in both runs, the 5-sample statistic -19 to +23ms
    // (.verify/f5-teardown-scale/g1-orform-measure.txt). The 100ms slack stands.
    const NO_MATCH = Array.from({ length: TAG_CHUNK_SIZE }, (_, i) => `zzzz-headroom-no-match-${i}-`)
    const lookup = await minOf(SAMPLES, () => db.from('record_revisions').select('id, record_id')
      .or(or(NO_MATCH))
      .order('id', { ascending: true }).range(0, 999), 'index lookup probe')
    const scanned = await exactCount(db.from('record_revisions')
      .select('id', { count: 'exact', head: true }).or(or(RUN_TAGS)), 'headroom population')
    const overRtt = lookup.min - rtt.min
    console.log(`    headroom: this run's ${RUN_TAGS.length} tags, ${scanned} rows, ${SAMPLES} samples `
      + `[${probe.ms.join(', ')}] min ${probe.min}ms, ceiling ${CEILING}ms `
      + `(${TIMEOUT_MS}ms / ${COLD_FACTOR}x cold / ${MARGIN}x margin)`)
    console.log(`    index: no-match lookup min ${lookup.min}ms [${lookup.ms.join(', ')}], `
      + `rtt min ${rtt.min}ms [${rtt.ms.join(', ')}], over rtt ${overRtt}ms, slack ${INDEX_SLACK_MS}ms`)
    assert.ok(scanned > 1000, `the headroom probe matched ${scanned} rows; it must fetch a full page`)
    assert.ok(probe.min < CEILING,
      `HEADROOM: the MINIMUM of ${SAMPLES} samples was ${probe.min}ms warm, past the ${CEILING}ms ceiling. `
      + `Samples: [${probe.ms.join(', ')}]. Noise is strictly additive, so every sample was genuinely `
      + `this slow. Do NOT step TAG_CHUNK_SIZE down; find what made the statement more expensive.`)
    assert.ok(overRtt < INDEX_SLACK_MS,
      `INDEX: the no-match tag lookup costs ${overRtt}ms over a one-row pk read (lookup min ${lookup.min}ms, `
      + `rtt min ${rtt.min}ms), past ${INDEX_SLACK_MS}ms. An indexed lookup costs about nothing; this one is `
      + `reading the table. Check record_revisions_payload_name_trgm_idx exists and is used.`)

    // ── THE COUNTERFACTUAL: the unranged query the defect shipped cannot see it
    //
    // WRAPPED IN THE GUARD'S OWN DECLARED EXEMPTION, not allowlisted, and NOT
    // ALIASED: the exemption is recognised by the literal name. It must stay
    // unranged, because capping at 1000 is what proves the defect was real.
    const firstPage = must(await unrangedForCalibration(
      db.from('record_revisions').select('id, record_id')
        .or(or([TAG])).order('id', { ascending: true })), 'firstPage')
    assert.equal(firstPage.length, 1000, 'the unranged query no longer caps at 1000; re-derive this test')
    assert.ok(!firstPage.some((r) => r.record_id === pick),
      'the fixture is inside the unranged page after all, so the two arms are not distinguishable')
    console.log(`    unranged query returns ${firstPage.length} rows and does NOT contain the fixture`)

    // ── THE SWEEP SET IS ONLY THIS RUN'S TAGS (I7, mandatory) ─────────────
    const sweep = [TAG]
    assert.deepEqual(sweep.filter((t) => !RUN_TAGS.includes(t)), [],
      'the sweep set carries a tag this run did not create: this test would sweep another run\'s records')
    const { removed } = await tearDown(sweep)
    assert.deepEqual(removed.filter((r) => !created.has(r.id)).map((r) => r.id), [],
      'tearDown removed a record this run did not create')

    const after = must(await db.from('records').select('id, deleted_at')
      .in('id', [pick, kept]), 'after')
    const state = (id) => after.find((r) => r.id === id)?.deleted_at
    assert.ok(state(pick), `the record at index ${index} of ${ordered.length} was NOT swept`)
    assert.equal(state(kept), null, 'the control was swept though its tag was excluded')

    // BOTH DIRECTIONS. The control was spared because it was untagged, not
    // because it was unreachable, and sweeping it now is what tells them apart.
    await tearDown([KEEP, THIRD])
    const final = must(await db.from('records').select('id, deleted_at').eq('id', kept), 'final')
    assert.ok(final[0].deleted_at, 'the control could not be swept even when named')
  } catch (e) { bodyErr = e }
  try {
    await purgeRun(db, owner, RUN_TAGS, created)
  } catch (purgeErr) {
    if (bodyErr) throw new Error(`${bodyErr.message}\n  AND THE PURGE FAILED: ${purgeErr.message}`)
    throw purgeErr
  }
  if (bodyErr) throw bodyErr
})

// ── RULING D1: THE TEST HARD-PURGES ITS OWN ROWS, AND ONLY THEM ──────────
//
// Verification 11 says fixtures are soft deleted. This departs from its
// LETTER for test-owned fixture rows only (DESIGN_PRINCIPLES, F5 teardown
// scale): soft-deleted fixture history is the cost every tag statement pays,
// because every page reads the whole table, and this test alone would add
// ~1,530 revision rows a run. tearDown above performs the claim, soft delete,
// asserted; this removes what is left of it.
//
// RE-TAKEN ON A NEW PREMISE, John 2026-11-24 (Verification 29). The sentence
// above, "every page reads the whole table", stopped being true when the
// trigram index was applied. The purge stays for a different reason: rows
// left soft deleted grow the table for every reader that still reads it
// whole, and grow the MATCHED SET of any tag that is reused, which is now
// what an indexed tag statement pays for.
//
// BOTH FILTERS ARE IN THE QUERY. A row goes only if it carries one of this
// run's tags AND belongs to the test account. The set is enumerated from the
// database and must EQUAL the set this run created: a matching row the run did
// not create stops the purge rather than widening it.
const RESTRICT_CHILDREN = [
  ['approvals', 'record_id'], ['audit_log', 'record_id'],
  ['record_contacts', 'record_id'], ['record_contacts', 'contact_id'],
  ['deal_sheet_versions', 'record_id'], ['transition_requests', 'record_id'],
  ['records', 'parent_record_id'], ['records', 'account_id'],
  ['records', 'parent_account_id'], ['records', 'installer_account_id'],
]
const CASCADE_CHILDREN = [
  ['record_freshness', 'record_id'], ['opportunity_details', 'record_id'],
  ['roles', 'record_id'], ['document_details', 'record_id'], ['track_approvers', 'record_id'],
  ['opportunity_details', 'converted_from_test_bed_id'],
]
async function purgeRun(db, owner, runTags, created) {
  const must = ({ data, error }, w) => { if (error) throw new Error(`purge ${w}: ${error.message}`); return data }
  const count = async (q, w) => {
    const { count: n, error, status } = await q
    if (error) throw new Error(`purge ${w}: status ${status} ${error.message}`)
    return n
  }
  const or = tagOr(runTags)
  const chunks = (xs) => Array.from({ length: Math.ceil(xs.length / 150) }, (_, i) => xs.slice(i * 150, i * 150 + 150))

  // 1. The run's records, from the DATABASE by tag.
  const tagged = new Set()
  for (let from = 0; ; from += 1000) {
    const d = must(await db.from('record_revisions').select('id, record_id')
      .or(or).eq('created_by', owner).order('id', { ascending: true }).range(from, from + 999), 'enumerate')
    d.forEach((r) => tagged.add(r.record_id))
    if (d.length < 1000) break
  }
  const strangers = [...tagged].filter((id) => !created.has(id))
  if (strangers.length) {
    throw new Error(`purge STOPPED: ${strangers.length} records carry this run's tags and were not `
      + 'created by it. Not widening the purge (ruling D1).')
  }
  const ids = [...created]
  if (!ids.length) return

  // 2. Handed-away records come back to the test account, so the owner
  // filter below can be applied rather than waived.
  for (const c of chunks(ids)) {
    must(await db.from('records').update({ owner_id: owner }).in('id', c).neq('owner_id', owner).select('id'), 'hand back')
  }
  let owned = 0
  for (const c of chunks(ids)) {
    owned += await count(db.from('records').select('id', { count: 'exact', head: true })
      .in('id', c).eq('owner_id', owner), 'owned')
  }
  if (owned !== ids.length) throw new Error(`purge STOPPED: ${owned} of ${ids.length} records are the test account's`)

  // 3. Every RESTRICT child is enumerated. The fixtures write none of them;
  // one that holds a row was written by something else, and the purge stops.
  for (const [table, col] of RESTRICT_CHILDREN) {
    let n = 0
    for (const c of chunks(ids)) n += await count(db.from(table).select('*', { count: 'exact', head: true }).in(col, c), `${table}.${col}`)
    if (n) throw new Error(`purge STOPPED: ${table}.${col} holds ${n} rows naming this run's records. Not purged (ruling D1).`)
  }

  // 4. Revisions, then records. Both filters in each statement.
  for (const c of chunks(ids)) {
    must(await db.from('record_revisions').delete().in('record_id', c)
      .eq('created_by', owner).or(or).select('id'), 'revisions')
  }
  for (const c of chunks(ids)) {
    const gone = must(await db.from('records').delete().in('id', c).eq('owner_id', owner).select('id'), 'records')
    assert.equal(gone.length, c.length, `purge: deleted ${gone.length} of ${c.length} records`)
  }

  // 5. ZERO ROWS OF THIS RUN REMAIN, in every table it wrote and every child.
  const left = []
  const tagRows = await count(db.from('record_revisions').select('id', { count: 'exact', head: true }).or(or), 'tag rows')
  if (tagRows) left.push(`record_revisions by tag: ${tagRows}`)
  for (const [table, col] of [['records', 'id'], ['record_revisions', 'record_id'], ...RESTRICT_CHILDREN, ...CASCADE_CHILDREN]) {
    let n = 0
    for (const c of chunks(ids)) n += await count(db.from(table).select('*', { count: 'exact', head: true }).in(col, c), `left ${table}.${col}`)
    if (n) left.push(`${table}.${col}: ${n}`)
  }
  assert.deepEqual(left, [], `the purge left rows of this run behind: ${left.join('; ')}`)
  console.log(`    purge: ${ids.length} records and their revisions removed; 0 rows of this run's tags remain`)
}

// ── THE A1 RESIDUAL, ruled at the Phase 0 close ───────────────────────────
//
// A1's calibration proved the paging helper on `record_revisions` and
// `records`. The report said so, and said the other tables teardown touches
// are paged by the same helper but were not separately exercised at supra-cap
// volume. That is an argument from shared code, and this estate has been
// caught by exactly that argument before - the sibling surfaces round exists
// because a security claim rested on "the policies are shared, so the shapes
// carry".
//
// `transition_requests` is the choice because it is the only OTHER table
// teardown touches whose population is over the cap: 2,370 rows against
// track_approvers' 5. Exercising the helper on a table of five would prove
// nothing, which is R2's population clause in a different costume.
test('the paging helper returns a whole supra-cap table, not its first page', async () => {
  const { admin, pagedSelect, pagedSelectIn } = await import('../fixtures.mjs')
  const { unrangedForCalibration } = await import('../lib/unbounded-selects.mjs')
  const db = admin()
  const { count: exact, error } = await db.from('transition_requests')
    .select('id', { count: 'exact', head: true })
  assert.equal(error, null, `count failed: ${error?.message}`)
  assert.ok(exact > 1000,
    `transition_requests holds ${exact} rows, at or under the cap, so this proves nothing`)

  const all = await pagedSelect(() => db.from('transition_requests').select('id'), 'all requests')
  console.log(`    pagedSelect: ${all.length} of ${exact} (exact count), cap 1000`)
  assert.equal(all.length, exact, 'the helper returned less than the table holds')
  assert.equal(new Set(all.map((r) => r.id)).size, all.length,
    'the helper returned a row twice, which is what paging without a stable ORDER BY does')

  // The unranged counterfactual, asserted rather than assumed - and it must
  // STAY unranged, because it is what proves the cap is real. Wrapped in the
  // guard's own declared exemption rather than allowlisted: a deliberate
  // unranged read is a different thing from an overlooked one, and the code
  // should say which it is.
  const { data: onePage } = await unrangedForCalibration(
    db.from('transition_requests').select('id'))
  assert.equal(onePage.length, 1000, 'the unranged query no longer caps at 1000; re-derive this test')

  // And the `.in()` chunker, which fails on URL LENGTH rather than on the cap:
  // a different limit, the same class. IN_CHUNK is 150, so this needs more
  // than 150 ids to exercise more than one chunk.
  const ids = all.slice(0, 400).map((r) => r.id)
  const back = await pagedSelectIn('transition_requests', 'id', 'id', ids, 'chunked')
  console.log(`    pagedSelectIn: ${back.length} rows over ${ids.length} ids in chunks of 150`)
  assert.equal(back.length, ids.length, 'the chunker lost rows across chunk boundaries')
  assert.equal(new Set(back.map((r) => r.id)).size, ids.length, 'the chunker returned a row twice')
})
