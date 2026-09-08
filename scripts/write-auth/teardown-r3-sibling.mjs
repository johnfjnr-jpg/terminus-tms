// R3: the seven artefacts the corrected counter surfaced, deleted and counted.
//
// ── ONE DISCREPANCY IN THE BRIEF, REPORTED NOT RESOLVED QUIETLY ───────────
//
// R3 names "the withdrawn request of 2026-09-02 on walk65's live record
// 29e98c46". The request b3a352f7 is on e5f8f1de, not 29e98c46. 29e98c46 is a
// different walk65 record - the one that carried version 5f1517b2, deleted
// under R11 last round, and it is already clean at one version.
//
// Both are walk65's, both live, so the ruling's INTENT is unambiguous: the
// 2026-09-02 withdrawn request goes. The id is what this acts on and the
// mismatch is reported. CLAUDE.md's own instruction about a generated file
// disagreeing with a hand-written one applies to a brief disagreeing with a
// measurement: the disagreement is a finding.
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const db = admin()
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const VERSIONS = [
  '43eac07b-348b-4d3c-948c-2b80deee092e',
  '6ff9679b-c5b4-4038-8fbd-1c5344cb3d1e',
  'db800360-32d8-4a86-80d6-45a84cd56975',
  'f145da62-2509-4988-ae29-fd91604f015e',
  'f86d42fb-a5aa-4526-9a05-836b7cfcacf0',
]
const REQUESTS = [
  'b839633b-0e63-4dfd-9549-365a3c126405',  // on 6e706cc5, record already soft-deleted
  'b3a352f7-8a79-4f40-b603-dc6030641cba',  // on e5f8f1de, walk65 LIVE, requested_at 2026-09-02
]

console.log('=== IDS BEFORE')
for (const id of VERSIONS) {
  const { data: v } = await db.from('deal_sheet_versions')
    .select('id, record_id, major, minor, status').eq('id', id).maybeSingle()
  const { data: r } = v ? await db.from('records').select('owner_id, deleted_at').eq('id', v.record_id).maybeSingle() : { data: null }
  console.log(`  version ${id.slice(0, 8)}  ${v ? `V${v.major}.${v.minor} ${v.status} on ${v.record_id.slice(0, 8)} recDeleted=${!!r?.deleted_at}` : 'ALREADY GONE'}`)
}
for (const id of REQUESTS) {
  const { data: q } = await db.from('transition_requests')
    .select('id, record_id, status, requested_at').eq('id', id).maybeSingle()
  const { data: r } = q ? await db.from('records').select('owner_id, deleted_at').eq('id', q.record_id).maybeSingle() : { data: null }
  console.log(`  request ${id.slice(0, 8)}  ${q ? `${q.status} ${q.requested_at?.slice(0, 10)} on ${q.record_id.slice(0, 8)} recDeleted=${!!r?.deleted_at}` : 'ALREADY GONE'}`)
}

console.log('\n=== DEPENDENTS, before anything is deleted')
const { count: appr } = await db.from('approvals').select('id', { count: 'exact', head: true }).in('request_id', REQUESTS)
const { count: froz } = await db.from('transition_requests').select('id', { count: 'exact', head: true }).in('frozen_version_id', VERSIONS)
console.log(`  approvals referencing either request        : ${appr ?? 0}`)
console.log(`  transition_requests freezing any of the five: ${froz ?? 0}`)
if ((appr ?? 0) || (froz ?? 0)) { console.log('  STOP: a dependent exists. Reporting rather than orphaning.'); process.exit(2) }

console.log('\n=== DELETING, per-id result')
const results = []
const del = async (table, id) => {
  const { error } = await db.from(table).delete().eq('id', id)
  const { data: back } = await db.from(table).select('id').eq('id', id).maybeSingle()
  const gone = !error && !back
  results.push({ id, gone })
  console.log(`  ${gone ? 'OK  ' : 'FAIL'}  ${table.padEnd(20)} ${id}${error ? '  ' + error.message : ''}`)
}
for (const id of VERSIONS) await del('deal_sheet_versions', id)
for (const id of REQUESTS) await del('transition_requests', id)
console.log(`  ${results.filter((r) => r.gone).length}/${results.length} deleted`)

// ── THE CORRECTED COUNTER, RE-RUN. It must read zero. ────────────────────
//
// The one that matters: rows this account wrote on records it does NOT own.
// The first version of it asked "any row ever by this account" and read 3,165,
// which is every fixture since Milestone 1 and answers nothing.
console.log('\n=== THE CORRECTED COUNTER, RE-RUN')
async function pageAll(t, cols, order, f = (q) => q) {
  const { count } = await f(db.from(t).select(cols, { count: 'exact', head: true }))
  const rows = []
  for (let i = 0; ; i += 1000) {
    const { data } = await f(db.from(t).select(cols)).order(order, { ascending: true }).range(i, i + 999)
    rows.push(...data)
    if (data.length < 1000) break
  }
  if (rows.length !== count) throw new Error(`${t}: paged ${rows.length} of ${count}`)
  return rows
}
const recs = await pageAll('records', 'id, owner_id', 'id')
const ownerOf = new Map(recs.map((r) => [r.id, r.owner_id]))
const vers = await pageAll('deal_sheet_versions', 'id, record_id', 'id', (q) => q.eq('created_by', ME))
const reqs = await pageAll('transition_requests', 'id, record_id', 'id', (q) => q.eq('requested_by', ME))
const vAlien = vers.filter((v) => ownerOf.get(v.record_id) && ownerOf.get(v.record_id) !== ME)
const rAlien = reqs.filter((r) => ownerOf.get(r.record_id) && ownerOf.get(r.record_id) !== ME)
console.log(`  versions written by this account on records it does not own : ${vAlien.length}`)
for (const v of vAlien) console.log(`    ${v.id} on ${v.record_id}`)
console.log(`  requests raised by this account on records it does not own  : ${rAlien.length}`)
for (const r of rAlien) console.log(`    ${r.id} on ${r.record_id}`)
console.log(`  (scanned ${vers.length} versions and ${reqs.length} requests by this account, against ${recs.length} records)`)

const clean = vAlien.length === 0 && rAlien.length === 0 && results.every((r) => r.gone)
console.log(`\n  ZERO on both counters = ${clean}`)
process.exit(clean ? 0 : 1)
