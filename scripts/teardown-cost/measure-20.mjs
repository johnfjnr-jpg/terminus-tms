// ── THE DECIDING MEASUREMENT: intermittent or consistent? ────────────────
//
// Runs the taggedRevs scan EXACTLY as tearDown runs it - same chunking, same
// OR of ilike, same pagedSelect ordering and range - 20 times against
// today's table. Changes nothing, retries nothing.
//
// A teardown fails if ANY ONE of its paged statements exceeds the 8000ms
// statement timeout, so the per-RUN verdict is "did any statement cross",
// and the per-STATEMENT distribution is reported beside it.
import { admin, tagsToSweep, TAG_CHUNK_SIZE } from '../fixtures.mjs'

const db = admin()
const TIMEOUT = 8000
const PAGE = 1000
const MAX_PAGES = 40
const tags = tagsToSweep()
const RUNS = Number(process.env.RUNS ?? 20)

const total = (await db.from('record_revisions').select('id', { count: 'exact', head: true })).count
console.log(`  record_revisions: ${total} rows, ${tags.length} tags, chunk ${TAG_CHUNK_SIZE}`)
console.log(`  statement timeout ${TIMEOUT}ms\n`)

const runOnce = async () => {
  const stmts = []
  let failed = null
  for (let i = 0; i < tags.length; i += TAG_CHUNK_SIZE) {
    const or = tags.slice(i, i + TAG_CHUNK_SIZE).map((t) => `payload->>name.ilike.${t}%`).join(',')
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE
      const t0 = Date.now()
      const { data, error } = await db.from('record_revisions').select('id, record_id').or(or)
        .order('id', { ascending: true }).range(from, from + PAGE - 1)
      const ms = Date.now() - t0
      stmts.push(ms)
      if (error) { failed = failed ?? `taggedRevs[${i}] page ${page} (${ms}ms): ${error.message}`; break }
      if (data.length < PAGE) break
    }
    if (failed) break
  }
  return { stmts, failed }
}

const runs = []
for (let r = 1; r <= RUNS; r++) {
  const { stmts, failed } = await runOnce()
  const s = [...stmts].sort((a, b) => a - b)
  const over = stmts.filter((x) => x >= TIMEOUT).length
  runs.push({ over, failed, max: s[s.length - 1], med: s[Math.floor(s.length / 2)], n: stmts.length })
  console.log(`  run ${String(r).padStart(2)}: ${stmts.length} statements  `
    + `med ${String(s[Math.floor(s.length / 2)]).padStart(5)}ms  max ${String(s[s.length - 1]).padStart(6)}ms  `
    + `over ${TIMEOUT}ms: ${over}${failed ? `   FAILED: ${failed.slice(0, 70)}` : ''}`)
}

const bad = runs.filter((r) => r.failed || r.over > 0).length
const all = runs.flatMap((r) => [r.max])
const sorted = [...all].sort((a, b) => a - b)
console.log(`\n=== VERDICT over ${RUNS} runs ===`)
console.log(`  runs where a statement crossed ${TIMEOUT}ms or errored : ${bad} of ${RUNS}`)
console.log(`  per-run MAX statement: min ${sorted[0]}  median ${sorted[Math.floor(sorted.length / 2)]}  max ${sorted[sorted.length - 1]}`)
console.log(`  per-run median statement: ${runs.map((r) => r.med).sort((a, b) => a - b)[Math.floor(RUNS / 2)]}ms`)
console.log(bad === 0 ? '\n  NEVER CROSSED in this window.'
  : bad === RUNS ? '\n  CROSSED EVERY RUN - consistent, not environmental.'
  : `\n  CROSSED ${bad} of ${RUNS} - INTERMITTENT.`)
