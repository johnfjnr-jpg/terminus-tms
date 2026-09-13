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
const purge = async (ids) => {
  await db.from('record_revisions').delete().in('record_id', ids)
  await db.from('records').delete().in('id', ids)
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
// A page-sized population goes green while proving nothing, and that shape is
// what produced the finding in the first place.
//
// So the population here is the REAL one: every tag in the ledger, which is
// what a no-argument tearDown() sweeps, plus this test's own fixture.
test('tearDown reaches a record beyond row 1,000 of its own tag population', async () => {
  const { admin, freshOpportunity, tearDown, tagsToSweep } = await import('../fixtures.mjs')
  const db = admin()
  const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
  const TAG = 'a1deep'
  const KEEP = 'a1keep'
  const or = (ts) => ts.map((t) => `payload->>name.ilike.${t}%`).join(',')
  const exactCount = async (q, w) => {
    const { count, error } = await q
    if (error) throw new Error(`${w}: ${error.message}`)
    return count
  }

  const kept = await freshOpportunity(KEEP)
  // `deep` is chosen, not hoped for - see the retry below, which exists because
  // the first version of this test was FLAKY IN THE GATE.
  let deep = await freshOpportunity(TAG)
  const extras = []

  // ── BOTH ARE HANDED AWAY, AND THAT IS WHAT PUTS THEM UNDER THE TAG BRANCH ─
  //
  // The first version of this test left them owned by the test account, and the
  // page-cap injection came back SILENT. The reason is the whole shape of the
  // defect: a record the test account still OWNS is found by the owner-scoped
  // candidate branch and never needs the tag query at all. The tag branch only
  // decides the fate of records that have LEFT that set - which is exactly the
  // population it was built for, and exactly the 25 handed-away opportunities
  // the previous round found sitting live.
  //
  // Raw update rather than handOver(), deliberately: the ledger is the other
  // way a handed-away record is reached, and using it here would mask the very
  // branch under test.
  const other = must(await db.from('track_approvers').select('user_id')
    .eq('record_type', 'opportunity').limit(1), 'other owner')[0].user_id
  for (const id of [deep.oppId, kept.oppId]) {
    must(await db.from('records').update({ owner_id: other }).eq('id', id).select('id'), `hand ${id}`)
  }

  // ── THE SWEEP SET IS BUILT TO EXCEED THE CAP, NOT HOPED TO ──────────────
  //
  // Two earlier drafts failed here and both failures are the reason this is
  // constructed rather than taken. Probing the ledger's first 25 tags missed
  // the fixture's own tag entirely, which reported as index -1 and READS as
  // "inside the first page". Probing the chunk the fixture's tag falls in gave
  // a population of 29, because a tag appended seconds ago sits among other
  // recent small ones while the mass is in the old tags.
  //
  // So: the fixture's tag, plus the heaviest historical tags, until the
  // population is over the cap. Every count here is EXACT (head + count), never
  // a select's length, because a select's length IS the cap.
  const ledger = tagsToSweep().filter((t) => t !== TAG && t !== KEEP)
  const weighed = []
  for (const t of ledger) {
    weighed.push({ t, n: await exactCount(db.from('record_revisions')
      .select('id', { count: 'exact', head: true }).ilike('payload->>name', `${t}%`), `weigh ${t}`) })
  }
  weighed.sort((a, b) => b.n - a.n)
  const sweep = [TAG]
  let total = 0
  for (const { t, n } of weighed) {
    if (total > 1000 || sweep.length >= 25) break
    sweep.push(t); total += n
  }
  const population = await exactCount(db.from('record_revisions')
    .select('id', { count: 'exact', head: true }).or(or(sweep)), 'population')
  assert.ok(population > 1000,
    `the population is ${population} (exact count), at or under the cap, so this test cannot see the defect`)
  assert.ok(sweep.length <= 25, 'the sweep set must fit one chunk, or it is not the query under test')
  assert.ok(!sweep.includes(KEEP), 'the control must not be in the sweep set')
  // EMITTED, not typed. Any number describing a run comes out of the run
  // (Verification 20), and the first commit of this work quoted a population
  // figure the run had never printed.
  console.log(`    population: ${population} rows (exact count) over ${sweep.length} tags, cap 1000`)

  // ── F5: HEADROOM AGAINST THE STATEMENT TIMEOUT, ASSERTED ───────────────
  //
  // This test failed the LEADS CARD POLISH round's own closing gate, and its
  // FAILING duration had climbed 15,957 to 19,887ms across two rounds while
  // the passing case stayed flat at ~6.3s. Nothing in the suite was watching
  // that number, so it passed for two rounds while getting worse.
  //
  // The cause was a scan carrying a whole JSON payload off every row to
  // discard it - 7,879ms for one page, against 1,308ms without, measured on
  // the live table. Dropping it is the fix; THIS is what stops the same thing
  // happening again silently as the table keeps growing.
  //
  // Asserted against a stated ceiling rather than left as a printed number,
  // because a printed number is what nobody was watching.
  // ── THE CEILING IS DERIVED, NOT PICKED ─────────────────────────────────
  //
  // The statement that failed was COLD - the first scan of a fresh process
  // against a cold cache, which is exactly what a gate run does. Measured on
  // the same query, cold 7,879ms against warm ~1,300ms: a factor of about 6.
  //
  // A test cannot reliably produce a cold cache, so it measures WARM and
  // requires that warm times the observed cold factor, with margin, still
  // clears the timeout. That is what makes this a headroom assertion rather
  // than "it passed today".
  const TIMEOUT_MS = 8000
  const COLD_FACTOR = 6
  const MARGIN = 1.5
  const CEILING = Math.round(TIMEOUT_MS / COLD_FACTOR / MARGIN)

  // ── THE GUARD TIMES THE QUERY THAT ACTUALLY FAILED ─────────────────────
  //
  // The first version of this watched `pageTiming`, the slowest page any scan
  // in the process had run. It read 205ms with the defect deliberately
  // reinjected and PASSED - because this test's own teardown sweeps two tags
  // over 5,525 rows, while the statement that timed out was tearDown's
  // full-ledger scan: a 25-tag OR over 24,443 rows. Verification 25 exactly -
  // the right measurement on far too small a population, and the calibration
  // is what caught it rather than the reading looking wrong.
  //
  // So the guard runs ONE page of the real shape and times that.
  // THE SAME CHUNK SIZE THE CODE USES, imported rather than retyped: a guard
  // that times a statement the code never runs is measuring nothing. 25 was
  // what tearDown used when this failed; TAG_CHUNK is now the lever that was
  // turned, so the guard follows it.
  // THE HEAVIEST CHUNK, not the first. `weighed` above already has every tag
  // with its exact row count, so the worst statement tearDown will actually
  // run is the TAG_CHUNK_SIZE heaviest tags together. Timing the first six
  // measured 407 rows and proved nothing about the chunk that matters.
  const ledgerTags = weighed.slice(0, TAG_CHUNK_SIZE).map((w) => w.t)
  const ledgerOr = ledgerTags.map((t) => `payload->>name.ilike.${t}%`).join(',')

  // ── ONE DRAW OF A 3.7x DISTRIBUTION IS NOT A MEASUREMENT ───────────────
  //
  // SUPERSEDED REASONING LEFT VISIBLE, because the premise failed rather
  // than a preference changing (Verification 29). This probe used to time
  // the statement ONCE and assert that single reading under the ceiling,
  // and its failure message said "the failing case climbs while the passing
  // one stays flat" - a table-growth diagnosis that three rounds acted on,
  // stepping TAG_CHUNK_SIZE 25 -> 6 -> 3.
  //
  // MEASURED, and it is not table growth. Decomposed at 99,599 rows the
  // statement is ~408ms idle: ~147ms network round trip, ~126ms scan, and
  // ~135ms returning 1000 rows. ONLY the 126ms grows with the table, so
  // doubling the table reaches ~534ms - still under the ceiling. Table
  // growth cannot produce the 1178ms that turned a gate red.
  //
  // What does: 25 samples of a SINGLE INDEXED ROW swing 133ms to 498ms,
  // a 3.7x spread, and the distribution is not stationary. The chunk
  // inherits that. A single draw asserted against a fixed ceiling crosses
  // it a few percent of the time forever, whatever the chunk size is - and
  // the chunk size was never the lever: 1 tag costs 314ms and 8 cost 567ms
  // against a floor of ~150ms, so stepping down saves tens of milliseconds
  // and adds statements that each pay the floor again.
  //
  // So the probe samples N times and asserts the MINIMUM.
  //
  // WHY THE MINIMUM AND NOT THE MEDIAN, which was tried first and measured
  // insufficient: the connection's noise is STRICTLY ADDITIVE. Jitter,
  // scheduling and contention can only make a statement take LONGER than its
  // true cost; nothing makes it faster. So min(N) is a lower bound on the
  // real cost and an unbiased-from-above estimator of it, while the median
  // still carries whatever the distribution was doing during those seconds.
  //
  // Measured: a median of 5 read 945ms for a 16-tag chunk and 314ms for a
  // 24-tag chunk that walks MORE rows - non-monotonic, because the
  // distribution shifted between the two. The minima over the same runs were
  // far better behaved.
  //
  // This SHARPENS the guard rather than loosening it. A real cost increase
  // raises the floor, and the floor is exactly what the minimum measures;
  // jitter raises only the upper samples, which the minimum ignores.
  const SAMPLES = 5
  const timings = []
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = Date.now()
    const { error: probeErr } = await db.from('record_revisions')
      .select('id, record_id').or(ledgerOr).order('id', { ascending: true }).range(0, 999)
    if (probeErr) throw new Error(`headroom probe: ${probeErr.message}`)
    timings.push(Date.now() - t0)
  }
  const sorted = [...timings].sort((a, b) => a - b)
  const probeMs = sorted[0]
  const worstMs = sorted[SAMPLES - 1]

  // ── AND THE COLD-TAIL GUARD, ON THE TERM THAT ACTUALLY MULTIPLIES ──────
  //
  // The 6x cold factor is a DISK-CACHE effect: it multiplies the SCAN, not
  // the network round trip and not the fetch of 1000 rows. Applying it to a
  // jitter-inflated total overstates the risk; applying it to the scan term
  // measures the real one. This times a full scan that returns NOTHING, so
  // it is floor + scan with the fetch removed, and asserts that cold it
  // still clears the statement timeout with the same margin.
  const scanTimings = []
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = Date.now()
    const { error: scanErr } = await db.from('record_revisions').select('id, record_id')
      .ilike('payload->>name', 'zzzz-headroom-no-match-%')
      .order('id', { ascending: true }).range(0, 999)
    if (scanErr) throw new Error(`scan-term probe: ${scanErr.message}`)
    scanTimings.push(Date.now() - t0)
  }
  const scanMs = [...scanTimings].sort((a, b) => a - b)[0]
  const COLD_BOUND = Math.round(TIMEOUT_MS / MARGIN)

  const scanned = await exactCount(db.from('record_revisions')
    .select('id', { count: 'exact', head: true }).or(ledgerOr), 'headroom population')

  console.log(`    headroom: the HEAVIEST chunk, ${scanned} rows (${ledgerTags.length} tags), `
    + `${SAMPLES} samples [${timings.join(', ')}] min ${probeMs}ms worst ${worstMs}ms, ceiling ${CEILING}ms`)
  console.log(`    cold tail: scan term min ${scanMs}ms x ${COLD_FACTOR} cold = `
    + `${scanMs * COLD_FACTOR}ms, bound ${COLD_BOUND}ms (${TIMEOUT_MS}ms / ${MARGIN}x margin)`)

  assert.equal(ledgerTags.length, TAG_CHUNK_SIZE,
    'the probe must use the same chunk size the code does, or it times a statement nobody runs')
  assert.ok(scanned > 0,
    `the headroom probe matched ${scanned} rows; an empty scan is not a measurement`)

  // A. THE REGRESSION GUARD. Median, not one draw.
  assert.ok(probeMs < CEILING,
    `the heaviest chunk's MINIMUM of ${SAMPLES} samples was ${probeMs}ms warm over ${scanned} rows `
    + `in ${ledgerTags.length} tags, past the ${CEILING}ms ceiling. Samples: [${timings.join(', ')}].\n`
    + `A MINIMUM over the ceiling is a REAL cost increase, not jitter: noise is strictly additive, `
    + `so every one of the ${SAMPLES} samples was genuinely this slow. Do NOT step TAG_CHUNK_SIZE `
    + `down: measured, tag count is not the `
    + `lever (1 tag 314ms, 8 tags 567ms, floor ~150ms). Find what made the statement more expensive.`)

  // B. THE COLD-TAIL GUARD, on the growing term.
  assert.ok(scanMs * COLD_FACTOR < COLD_BOUND,
    `the SCAN TERM minimum is ${scanMs}ms warm; times the ${COLD_FACTOR}x cold factor that is `
    + `${scanMs * COLD_FACTOR}ms against a ${COLD_BOUND}ms bound (${TIMEOUT_MS}ms statement timeout `
    + `/ ${MARGIN}x margin). THIS is the term that grows with the table, and it has now grown enough `
    + `to threaten the statement timeout on a cold cache. Samples: [${scanTimings.join(', ')}].`)

  // ── WHERE THE FIXTURE FALLS IN THE ORDER THE FIX PAGES BY ───────────────
  //
  // Ordered by `id`, which is unique: range paging over a non-unique order can
  // return a row twice or skip it, which is a correctness fault the cap was
  // hiding rather than a second opinion about it.
  const ordered = []
  for (let from = 0; ; from += 1000) {
    const d = must(await db.from('record_revisions').select('id, record_id')
      .or(or(sweep)).order('id', { ascending: true }).range(from, from + 999), 'ordered')
    ordered.push(...d)
    if (d.length < 1000) break
  }
  // ── THE DEPTH IS CHOSEN, NOT HOPED FOR ─────────────────────────────────
  //
  // A record's id is a random uuid and the population is ordered by it, so a
  // single fixture lands in the first 1,000 of ~5,000 about one run in five.
  // The FIRST version of this test created one and asserted its depth, and it
  // duly failed in the gate at index 997 of 5,045 - correctly refusing to prove
  // anything, which is the right failure and still a red gate one run in five.
  //
  // So: create until one lands deep. Every extra carries the same tag and is
  // swept by the same tearDown below, so the retry costs fixtures, not residue.
  // Six attempts leaves a false failure at about one run in fifteen thousand.
  let index = ordered.findIndex((r) => r.record_id === deep.oppId)
  for (let attempt = 1; index >= 0 && index <= 1000 && attempt < 6; attempt++) {
    extras.push(deep)
    deep = await freshOpportunity(TAG)
    must(await db.from('records').update({ owner_id: other }).eq('id', deep.oppId).select('id'), 'hand deep')
    ordered.length = 0
    for (let from = 0; ; from += 1000) {
      const d = must(await db.from('record_revisions').select('id, record_id')
        .or(or(sweep)).order('id', { ascending: true }).range(from, from + 999), 'ordered')
      ordered.push(...d)
      if (d.length < 1000) break
    }
    index = ordered.findIndex((r) => r.record_id === deep.oppId)
  }
  console.log(`    fixture at index ${index} of ${ordered.length} (paged, full enumeration)` +
    `${extras.length ? `, after ${extras.length} shallow draw${extras.length > 1 ? 's' : ''}` : ''}`)
  assert.ok(index >= 0, 'the fixture is not in the population at all; the sweep set is wrong')
  assert.ok(index > 1000,
    `six draws all landed inside the first page (last at ${index} of ${ordered.length}); ` +
    'the population may have shrunk below the cap')

  // The counterfactual, asserted rather than assumed: the unranged query the
  // defect shipped genuinely cannot see this record.
  // WRAPPED IN THE GUARD'S OWN DECLARED EXEMPTION, not allowlisted, for the
  // reason the sibling case lower in this file already records: a deliberate
  // unranged read is a different thing from an overlooked one, and the code
  // should say which it is.
  //
  // This query MUST stay unranged - the assertion below is that it caps at
  // 1000, which is what proves the defect was real. Bounding it destroys the
  // evidence.
  //
  // It became visible to the scanner only when the scanner stopped losing
  // chains whose body ran past its window. It was unbounded the whole time;
  // nothing could see it, and it was not in the allowlist because it had
  // never been found.
  // NOT ALIASED. The exemption is recognised by the literal name
  // `unrangedForCalibration` appearing before the `.from(`, so importing it
  // as a shorter alias silently voids it - which this round did on its first
  // attempt and the guard caught, correctly, by still flagging the select.
  const { unrangedForCalibration } = await import('../lib/unbounded-selects.mjs')
  const firstPage = must(await unrangedForCalibration(
    db.from('record_revisions').select('id, record_id')
      .or(or(sweep)).order('id', { ascending: true })), 'firstPage')
  assert.equal(firstPage.length, 1000, 'the unranged query no longer caps at 1000; re-derive this test')
  assert.ok(!firstPage.some((r) => r.record_id === deep.oppId),
    'the fixture is inside the unranged page after all, so the two arms are not distinguishable')
  console.log(`    unranged query returns ${firstPage.length} rows and does NOT contain the fixture`)

  await tearDown(sweep)

  const after = must(await db.from('records').select('id, deleted_at')
    .in('id', [deep.oppId, kept.oppId]), 'after')
  const state = (id) => after.find((r) => r.id === id)?.deleted_at
  assert.ok(state(deep.oppId), `the record at index ${index} of ${ordered.length} was NOT swept`)
  assert.equal(state(kept.oppId), null, 'the control was swept though its tag was excluded')

  // BOTH DIRECTIONS. The control was spared because it was untagged, not
  // because it was unreachable, and sweeping it now is what tells them apart.
  await tearDown([KEEP])
  const final = must(await db.from('records').select('id, deleted_at').eq('id', kept.oppId), 'final')
  assert.ok(final[0].deleted_at, 'the control could not be swept even when named')
})

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
