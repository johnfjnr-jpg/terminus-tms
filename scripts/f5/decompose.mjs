// Decompose the chunk statement's cost: network round trip, full-table scan,
// and rows returned. Only one of those grows with the table, and which one it
// is decides between the derivation fix and the structural one.
import { admin, tagsToSweep } from '../fixtures.mjs'
const db = admin()
const med = async (fn, n = 5) => {
  const r = []
  await fn()
  for (let i = 0; i < n; i++) { const t = Date.now(); await fn(); r.push(Date.now() - t) }
  return r.sort((a, b) => a - b)[Math.floor(n / 2)]
}
const total = (await db.from('record_revisions').select('id', { count: 'exact', head: true })).count
console.log(`  record_revisions: ${total} rows\n`)

const netFloor = await med(() => db.from('record_revisions').select('id').limit(1))
console.log(`  A. NETWORK FLOOR      single indexed row        ${netFloor}ms`)

const scanOnly = await med(() => db.from('record_revisions').select('id, record_id')
  .ilike('payload->>name', 'zzzz-no-such-tag-%').order('id', { ascending: true }).range(0, 999))
console.log(`  B. FULL SCAN, 0 rows  ilike matching nothing    ${scanOnly}ms`)

const tags = tagsToSweep()
const weighed = []
for (const t of tags) weighed.push({ t, n: (await db.from('record_revisions')
  .select('id', { count: 'exact', head: true }).ilike('payload->>name', `${t}%`)).count })
weighed.sort((a, b) => b.n - a.n)
const or3 = weighed.slice(0, 3).map((w) => `payload->>name.ilike.${w.t}%`).join(',')
const chunk3 = await med(() => db.from('record_revisions').select('id, record_id').or(or3)
  .order('id', { ascending: true }).range(0, 999))
console.log(`  C. THE REAL CHUNK     3 heaviest tags, 1000 rows ${chunk3}ms`)

console.log(`\n  decomposition:`)
console.log(`     network round trip            ~${netFloor}ms   (does NOT grow with the table)`)
console.log(`     scan cost above the floor     ~${scanOnly - netFloor}ms   (GROWS LINEARLY with the table)`)
console.log(`     returning 1000 rows           ~${chunk3 - scanOnly}ms   (bounded by .range, does NOT grow)`)
console.log(`\n  the gate-2 failure measured 1178ms against this ${chunk3}ms idle median.`)
console.log(`  the gate runs TEN test files concurrently against this same database.`)
