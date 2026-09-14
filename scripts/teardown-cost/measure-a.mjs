// ── PROBLEM A: is the per-page cost a function of table size, or load? ───
//
// F5's lesson applied to the statement F5 did not measure. One draw of a
// heavy-tailed quantity tells you nothing, so this takes a DISTRIBUTION,
// and it varies the population so a GROWTH CURVE is visible rather than
// inferred.
//
// Read-only: it runs the same SELECTs tearDown runs and writes nothing.
import { admin, tagsToSweep } from '../fixtures.mjs'

const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const cnt = async (q, w) => { const { count, error } = await q
  if (error) throw new Error(`${w}: ${error.message}`); return count }

const total = await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true }), 'total')
const tags = tagsToSweep()
console.log(`  record_revisions : ${total} rows`)
console.log(`  tags to sweep    : ${tags.length}\n`)

const weighed = []
for (const t of tags) weighed.push({ t, n: await cnt(db.from('record_revisions')
  .select('id', { count: 'exact', head: true }).ilike('payload->>name', `${t}%`), t) })
weighed.sort((a, b) => b.n - a.n)

const PAGE = 1000
// Exactly what tearDown runs: the same OR over a chunk of tags, paged.
const timePage = async (tagSet, from) => {
  const or = tagSet.map((t) => `payload->>name.ilike.${t}%`).join(',')
  const t0 = Date.now()
  const { error } = await db.from('record_revisions').select('id, record_id').or(or)
    .order('id', { ascending: true }).range(from, from + PAGE - 1)
  return { ms: Date.now() - t0, error: error?.message ?? null }
}

// ── THE DISTRIBUTION, on the real chunk, page 0 ─────────────────────────
const CHUNK = 3
const chunk = weighed.slice(0, CHUNK).map((w) => w.t)
const chunkRows = await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true })
  .or(chunk.map((t) => `payload->>name.ilike.${t}%`).join(',')), 'chunk rows')
console.log(`=== A1. DISTRIBUTION: page 0 of the heaviest ${CHUNK}-tag chunk (${chunkRows} rows) ===`)
const runs = []
for (let i = 0; i < 15; i++) { const r = await timePage(chunk, 0); runs.push(r.ms)
  if (r.error) console.log(`     error: ${r.error}`) }
const s = [...runs].sort((a, b) => a - b)
console.log(`  15 samples: min ${s[0]}  p50 ${s[7]}  p90 ${s[13]}  max ${s[14]}`)
console.log(`  over the 8000ms statement timeout: ${runs.filter((x) => x >= 8000).length} of 15\n`)

// ── THE GROWTH CURVE: cost against the population scanned ───────────────
console.log(`=== A2. GROWTH CURVE: cost vs rows matched ===`)
console.log(`  tags  rows matched   min    p50    max   (5 samples each)`)
for (const n of [1, 3, 8, 16, 33]) {
  if (n > weighed.length) continue
  const set = weighed.slice(0, n).map((w) => w.t)
  const rows = await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true })
    .or(set.map((t) => `payload->>name.ilike.${t}%`).join(',')), `rows ${n}`)
  const r = []
  for (let i = 0; i < 5; i++) r.push((await timePage(set, 0)).ms)
  const q = [...r].sort((a, b) => a - b)
  console.log(`  ${String(n).padStart(4)}  ${String(rows).padStart(11)}   ${String(q[0]).padStart(4)}   ${String(q[2]).padStart(4)}   ${String(q[4]).padStart(4)}`)
}

// ── DEEP PAGES: does cost rise with the OFFSET? ─────────────────────────
// A keyset-ordered range with a large offset makes Postgres walk and discard
// everything before it. If cost climbs with `from`, the scan is O(offset)
// and paging the whole population is quadratic - which no ceiling fixes.
console.log(`\n=== A3. DEEP PAGES: cost against the page OFFSET (heaviest chunk) ===`)
console.log(`  offset   min    p50    max   (3 samples each)`)
for (const from of [0, 1000, 3000, 6000, 9000]) {
  if (from >= chunkRows) continue
  const r = []
  for (let i = 0; i < 3; i++) r.push((await timePage(chunk, from)).ms)
  const q = [...r].sort((a, b) => a - b)
  console.log(`  ${String(from).padStart(6)}   ${String(q[0]).padStart(4)}   ${String(q[1]).padStart(4)}   ${String(q[2]).padStart(4)}`)
}
