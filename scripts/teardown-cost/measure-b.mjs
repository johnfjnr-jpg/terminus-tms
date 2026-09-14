// ── PROBLEM B: the root, plus the thing A1 cannot see ───────────────────
//
// A1 measured ONE page at ~400-900ms with 0 of 15 over the 8s timeout. But
// tearDown does not run one page. It runs a page per chunk per offset, and
// the MAXIMUM of many draws from a heavy-tailed distribution crosses a
// ceiling that the median is nowhere near.
//
// So: count the statements a full sweep actually makes, and measure the
// growth that makes that count rise every run.
import { admin, tagsToSweep, TAG_CHUNK_SIZE } from '../fixtures.mjs'

const db = admin()
const cnt = async (q, w) => { const { count, error } = await q
  if (error) throw new Error(`${w}: ${error.message}`); return count }

const tags = tagsToSweep()
const total = await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true }), 'total')

console.log('=== B1. HOW MANY STATEMENTS DOES ONE SWEEP MAKE? ===')
const PAGE = 1000
let statements = 0, scanned = 0
for (let i = 0; i < tags.length; i += TAG_CHUNK_SIZE) {
  const set = tags.slice(i, i + TAG_CHUNK_SIZE)
  const rows = await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true })
    .or(set.map((t) => `payload->>name.ilike.${t}%`).join(',')), 'chunk')
  const pages = Math.max(1, Math.ceil(rows / PAGE))
  statements += pages
  scanned += rows
}
console.log(`  tags ${tags.length}, chunk size ${TAG_CHUNK_SIZE} -> ${Math.ceil(tags.length / TAG_CHUNK_SIZE)} chunks`)
console.log(`  rows matched across all chunks : ${scanned}`)
console.log(`  PAGED STATEMENTS PER SWEEP     : ${statements}`)
console.log(`  at a p90 of ~900ms that is ~${Math.round(statements * 0.9)}s of statement time per sweep,`)
console.log(`  and ${statements} independent draws against one 8000ms ceiling.\n`)

console.log('=== B2. THE TABLE, AND WHAT IS IN IT ===')
const live = await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true })
  .in('record_id', []), 'noop')
const recs = await cnt(db.from('records').select('id', { count: 'exact', head: true }), 'records all')
const liveRecs = await cnt(db.from('records').select('id', { count: 'exact', head: true }).is('deleted_at', null), 'records live')
const delRecs = recs - liveRecs
console.log(`  record_revisions          : ${total}`)
console.log(`  records total             : ${recs}   live ${liveRecs}   soft-deleted ${delRecs}`)
console.log(`  revisions per record avg  : ${(total / Math.max(1, recs)).toFixed(1)}`)

// How much of the revision table belongs to SOFT-DELETED records? That is
// accumulation the product never reads and the sweep always scans.
const delIds = []
let from = 0
while (true) {
  const { data, error } = await db.from('records').select('id').not('deleted_at', 'is', null)
    .order('id', { ascending: true }).range(from, from + 999)
  if (error) throw new Error(`deleted ids: ${error.message}`)
  delIds.push(...data.map((r) => r.id))
  if (data.length < 1000) break
  from += 1000
}
let delRevs = 0
for (let i = 0; i < delIds.length; i += 150) {
  delRevs += await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true })
    .in('record_id', delIds.slice(i, i + 150)), 'del revs')
}
console.log(`  revisions on SOFT-DELETED records : ${delRevs}  (${Math.round(delRevs / total * 100)}% of the table)`)
console.log(`  -> scanned by every sweep, read by nothing\n`)

console.log('=== B3. CAN THE SCAN BE BOUNDED SO IT IS NOT O(table)? ===')
// The sweep matches on payload->>name ilike, which cannot use an index and
// has no relation to the tag's OWN records. The alternative is to find the
// RECORDS by tag first - a much smaller table - then take their revisions by
// record_id, which is indexed.
const t0 = Date.now()
const byName = await cnt(db.from('record_revisions').select('id', { count: 'exact', head: true })
  .ilike('payload->>name', `${tags[0]}%`), 'by name')
const nameMs = Date.now() - t0
const t1 = Date.now()
const recIds = []
const { data: rs, error: rErr } = await db.from('records').select('id')
  .ilike('reference_code', `%${tags[0]}%`).limit(1000)
if (!rErr) recIds.push(...rs.map((r) => r.id))
const recMs = Date.now() - t1
console.log(`  tag "${tags[0]}"`)
console.log(`    revisions matched by payload->>name ilike : ${byName} rows in ${nameMs}ms  (scans record_revisions)`)
console.log(`    records matched by reference_code        : ${recIds.length} rows in ${recMs}ms  (scans records, ${recs} rows)`)
console.log(`  records is ${Math.round(total / Math.max(1, recs))}x smaller than record_revisions,`)
console.log(`  and record_revisions.record_id is indexed - so records-first is the bounded shape.`)
