// ── PHASE 0: IS THE COST DRIVEN BY TAG COUNT, OR BY TABLE SIZE? ──────────
//
// The whole round turns on this. `TAG_CHUNK_SIZE` has been stepped down
// twice on the assumption that fewer tags per statement means less work per
// statement. If `payload->>name ilike '<tag>%'` is not index-backed, every
// statement scans the WHOLE table whatever the tag count - and the lever
// does nothing except multiply the number of full scans.
//
// Verification 26: that is an inference and needs its own measurement.
// Read-only. It runs SELECTs and writes nothing.
import { admin, TAG_CHUNK_SIZE, tagsToSweep } from '../fixtures.mjs'

const db = admin()
const exactCount = async (q, what) => {
  const { count, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return count
}

const total = await exactCount(db.from('record_revisions')
  .select('id', { count: 'exact', head: true }), 'total revisions')
console.log(`  record_revisions holds ${total} rows`)
console.log(`  TAG_CHUNK_SIZE is currently ${TAG_CHUNK_SIZE}\n`)

// NO ARGUMENT. `tagsToSweep(x)` treats x as an EXPLICIT tag set, so passing
// `db` returned `[db]` and every measurement below it was of one object
// stringified into an ilike. Caught by the output printing
// `[object Object]=0` - Verification 14's shape: a zero from a query that
// could never match.
const tags = tagsToSweep()
console.log(`  tags to sweep: ${tags.length}`)

const weighed = []
for (const t of tags) {
  const n = await exactCount(db.from('record_revisions')
    .select('id', { count: 'exact', head: true }).ilike('payload->>name', `${t}%`), `weigh ${t}`)
  weighed.push({ t, n })
}
weighed.sort((a, b) => b.n - a.n)
console.log(`  heaviest tags: ${weighed.slice(0, 6).map((w) => `${w.t}=${w.n}`).join(' ')}\n`)

const timeChunk = async (n) => {
  const chosen = weighed.slice(0, n).map((w) => w.t)
  const or = chosen.map((t) => `payload->>name.ilike.${t}%`).join(',')
  // Warm once, then three readings, median kept: one reading cannot separate
  // cost from variance, which is this round's whole question (R3).
  await db.from('record_revisions').select('id, record_id').or(or)
    .order('id', { ascending: true }).range(0, 999)
  const runs = []
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    const { error } = await db.from('record_revisions').select('id, record_id').or(or)
      .order('id', { ascending: true }).range(0, 999)
    if (error) throw new Error(`chunk ${n}: ${error.message}`)
    runs.push(Date.now() - t0)
  }
  runs.sort((a, b) => a - b)
  const rows = await exactCount(db.from('record_revisions')
    .select('id', { count: 'exact', head: true }).or(or), `rows for ${n}`)
  return { n, rows, median: runs[1], runs }
}

console.log('=== COST vs TAG COUNT (rows matched grows with tags; does time?) ===')
console.log('  tags   rows matched   median ms   all three')
for (const n of [1, 2, 3, 4, 6, 8]) {
  if (n > weighed.length) continue
  const r = await timeChunk(n)
  console.log(`  ${String(r.n).padStart(4)}   ${String(r.rows).padStart(12)}   ${String(r.median).padStart(9)}   ${r.runs.join(', ')}`)
}

console.log('\n=== THE CONTROL: does a ZERO-row match still cost a full scan? ===')
const t0 = Date.now()
await db.from('record_revisions').select('id, record_id')
  .ilike('payload->>name', 'zzzz-no-such-tag-%')
  .order('id', { ascending: true }).range(0, 999)
const miss = Date.now() - t0
const t1 = Date.now()
await db.from('record_revisions').select('id, record_id')
  .order('id', { ascending: true }).range(0, 999)
const plain = Date.now() - t1
console.log(`  ilike matching ZERO rows : ${miss}ms   <- a full scan returning nothing`)
console.log(`  no filter, first 1000    : ${plain}ms   <- index order, no scan`)
console.log(miss > plain * 3
  ? '  THE ILIKE IS NOT INDEX-BACKED: a zero-row match costs a full table scan,\n  so TAG_CHUNK_SIZE is NOT the lever - it only multiplies the number of scans.'
  : '  the ilike appears index-backed, or the table is small enough not to matter.')
