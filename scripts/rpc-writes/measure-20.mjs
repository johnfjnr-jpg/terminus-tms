// ── IS THE CONCURRENT RPC WRITE PATH INTERMITTENT OR CONSISTENT? ─────────
//
// The pagedSelect treatment, applied to the path that is now failing.
// Replicates `record-revision.test.mjs`'s atomicity test exactly: N genuinely
// concurrent `append_record_revision` RPCs via Promise.all, which is what
// produced `TypeError: fetch failed`.
//
// Changes nothing, retries nothing, and reports the distribution.
//
// DATA COST, stated rather than discovered: ONE record and N x RUNS
// revisions - 800 on the defaults, against a 103,384-row table. The record
// is created through the harness so it carries a tag, and is soft-deleted at
// the end per Verification 11. Revisions are not deleted.
import { adminClient, newRunTag, resolveOwnerId, Fixtures } from '../verify-harness.mjs'

const db = adminClient()
const N = Number(process.env.N ?? 40)
const RUNS = Number(process.env.RUNS ?? 20)
const tag = newRunTag('rpcwrite')
// `resolveOwnerId` takes the client; `Fixtures` takes (db, tag). Both read
// from the harness rather than being reimplemented - the first draft guessed
// the signatures and the harness threw before writing anything, which is the
// cheap end of getting a fixture wrong.
const ownerId = await resolveOwnerId(db)
const fx = new Fixtures(db, tag)

console.log(`  ${RUNS} runs of ${N} genuinely concurrent append_record_revision RPCs`)
console.log(`  tag ${tag}, data cost ~${N * RUNS} revisions on one record\n`)

// createRecord takes no payload - the NAME lives on the first revision, which
// is what tagsToSweep reads. Seeded the way the test does it.
const rec = await fx.createRecord({ record_type: 'opportunity', status: 'Qualification', owner_id: ownerId })
const recordId = rec.id
{
  const { error } = await db.from('record_revisions')
    .insert({ record_id: recordId, revision_number: 1,
      payload: { name: `${tag} Opportunity` }, created_by: ownerId })
  if (error) throw new Error(`seed revision failed: ${error.message}`)
}

const append = async (i) => {
  const t0 = Date.now()
  try {
    const { error } = await db.rpc('append_record_revision',
      { p_record_id: recordId, p_patch: { [`k${i}`]: i }, p_created_by: ownerId })
    return { ms: Date.now() - t0, err: error?.message ?? null }
  } catch (e) { return { ms: Date.now() - t0, err: `THROWN ${String(e).slice(0, 60)}` } }
}

let badRuns = 0
const allFails = []
try {
  for (let r = 1; r <= RUNS; r++) {
    const t0 = Date.now()
    const results = await Promise.all(Array.from({ length: N }, (_, i) => append(i)))
    const ms = Date.now() - t0
    const fails = results.filter((x) => x.err)
    if (fails.length) { badRuns++; allFails.push(...fails.map((f) => f.err)) }
    const times = results.map((x) => x.ms).sort((a, b) => a - b)
    console.log(`  run ${String(r).padStart(2)}: ${N} concurrent in ${String(ms).padStart(5)}ms  `
      + `per-call med ${String(times[Math.floor(N / 2)]).padStart(5)}ms max ${String(times[N - 1]).padStart(6)}ms  `
      + `FAILED ${fails.length}${fails.length ? `  <- ${fails[0].err.slice(0, 50)}` : ''}`)
  }
} finally {
  const { error } = await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', recordId)
  const { data: check } = await db.from('records').select('deleted_at').eq('id', recordId).maybeSingle()
  console.log(`\n  teardown: record soft-deleted, re-queried deleted_at = ${check?.deleted_at ? 'set' : 'NOT SET'}`
    + `${error ? ` (error: ${error.message})` : ''}`)
}

console.log(`\n=== VERDICT over ${RUNS} runs ===`)
console.log(`  runs with at least one failed write : ${badRuns} of ${RUNS}`)
if (allFails.length) {
  const kinds = [...new Set(allFails.map((f) => f.split(':')[0].slice(0, 40)))]
  console.log(`  total failed calls                  : ${allFails.length} of ${N * RUNS}`)
  console.log(`  distinct error kinds                : ${kinds.join(' | ')}`)
}
console.log(badRuns === 0 ? '\n  NEVER FAILED in this window.'
  : badRuns === RUNS ? '\n  FAILED EVERY RUN - consistent, a real defect.'
  : `\n  FAILED ${badRuns} of ${RUNS} - INTERMITTENT under concurrency.`)
