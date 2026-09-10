// R7 part 2: execute the 21 over-cap instances and measure their REAL result
// sets. Every count is head:true count:'exact' and is EMITTED by this run.
//
// A select is CLEARED when its result set cannot approach the cap. Three
// grounds, and they are not equal:
//   BOUNDED BY A FIXTURE  the filter is an id or id-list this run created, so
//                         the population is the fixture's size, not a table's
//   MEASURED UNDER        the filter is statically evaluable and the exact
//                         count is far below 1,000
//   AT RISK               the count is within reach of the cap, or grows with
//                         the estate rather than with a fixture
import { admin } from '/Users/johnfryatt/terminus-tms/scripts/fixtures.mjs'
const db = admin()
const exact = async (q, what) => {
  const { count, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return count
}
const CAP = 1000
const rows = []
const measure = async (key, what, q) => {
  const n = await exact(q, key)
  rows.push({ key, what, n })
}

// scripts/tests/config-invariants.test.mjs
await measure('config-invariants::records::1', 'every LIVE record',
  db.from('records').select('id', { count: 'exact', head: true }).is('deleted_at', null))
await measure('config-invariants::records::0', 'live documents',
  db.from('records').select('id', { count: 'exact', head: true })
    .eq('record_type', 'document').is('deleted_at', null))
// scripts/probe-stage-probability.mjs
await measure('probe-stage-probability::records::2', 'live opportunities',
  db.from('records').select('id', { count: 'exact', head: true })
    .eq('record_type', 'opportunity').is('deleted_at', null))
// scripts/tests/gates.test.mjs
await measure('gates::approvals::0', 'approvals carrying a stage',
  db.from('approvals').select('id', { count: 'exact', head: true }).not('stage', 'is', null))
// scripts/tests/version-atomicity.test.mjs
await measure('version-atomicity::deal_sheet_versions::0', 'versions with a null revision_number',
  db.from('deal_sheet_versions').select('id', { count: 'exact', head: true })
    .is('revision_number', null))

// The one with the same shape as teardown's own `revs`: revisions OF the live
// records, so it grows with BOTH the record count and the revisions each.
const live = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('records').select('id')
    .is('deleted_at', null).order('id').range(from, from + 999)
  if (error) throw new Error(`live ids: ${error.message}`)
  live.push(...data); if (data.length < 1000) break
}
let revs = 0
for (let i = 0; i < live.length; i += 150) {
  revs += await exact(db.from('record_revisions').select('id', { count: 'exact', head: true })
    .in('record_id', live.slice(i, i + 150).map((r) => r.id)), 'revs')
}
rows.push({ key: 'config-invariants::record_revisions::0', what: 'revisions OF every live record', n: revs })

console.log(`  cap ${CAP}\n`)
console.log('  count   verdict     instance')
console.log('  ' + '-'.repeat(76))
for (const r of rows.sort((a, b) => b.n - a.n)) {
  const verdict = r.n > CAP ? 'OVER  <<<<' : r.n > CAP * 0.5 ? 'AT RISK' : 'under'
  console.log(`  ${String(r.n).padStart(6)}  ${verdict.padEnd(10)}  ${r.key}  (${r.what})`)
}
console.log(`\n  measured ${rows.length} statically evaluable instances; the remainder are`)
console.log('  bounded by a fixture id or id-list created by the run that queries them.')
