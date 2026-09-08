// R11: the evidence rows deleted, as a counted data change.
//
// Ids before, a per-id result, and a residue re-count that must show ZERO probe
// artefacts anywhere - including walk65's opportunity 29e98c46 back to exactly
// its own versions.
//
// DEPENDENTS ARE CHECKED BEFORE ANYTHING IS DELETED. approvals carries a
// request_id and deal_sheet_versions can be referenced by a frozen_version_id,
// so a blind delete could be refused or could orphan something. Build
// discipline 8: enumerate what the actor writes, not what the first check
// happens to name.
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const db = admin()
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const V_HYGIENE = '5f1517b2-27df-41af-bb10-9261f70e146c'   // on walk65's REAL record
const V_ISSUED  = 'e975b27e-204c-451b-8956-d9f6ac4a3ddb'
const REQ       = '0197a77d-cc1e-4add-8c49-687611ce98b7'
const REC_A     = 'a7178858-cfca-4dc5-9409-e82ee727f44e'
const REC_B     = 'e70d0755-1702-42fd-93c6-78ab64789e9a'
const WALK_REC  = '29e98c46-9377-4790-99b3-2045323f9265'

console.log('=== IDS BEFORE')
for (const id of [V_HYGIENE, V_ISSUED]) {
  const { data: v } = await db.from('deal_sheet_versions')
    .select('id, record_id, major, minor, status, created_by_email').eq('id', id).maybeSingle()
  console.log(`  version ${id}  ${v ? `V${v.major}.${v.minor} ${v.status} on ${v.record_id} by ${v.created_by_email}` : 'ALREADY GONE'}`)
}
const { data: r0 } = await db.from('transition_requests')
  .select('id, record_id, status, from_stage, to_stage').eq('id', REQ).maybeSingle()
console.log(`  request ${REQ}  ${r0 ? `${r0.from_stage} -> ${r0.to_stage} ${r0.status} on ${r0.record_id}` : 'ALREADY GONE'}`)
for (const id of [REC_A, REC_B]) {
  const { data: r } = await db.from('records').select('id, status, deleted_at, owner_id').eq('id', id).maybeSingle()
  console.log(`  record  ${id}  ${r ? `${r.status} deleted=${!!r.deleted_at}` : 'ALREADY GONE'}`)
}

console.log('\n=== DEPENDENTS, checked before anything is deleted')
const { count: apprOnReq } = await db.from('approvals').select('id', { count: 'exact', head: true }).eq('request_id', REQ)
console.log(`  approvals referencing the request : ${apprOnReq ?? 0}`)
const { count: reqOnVersion } = await db.from('transition_requests')
  .select('id', { count: 'exact', head: true }).in('frozen_version_id', [V_HYGIENE, V_ISSUED])
console.log(`  transition_requests freezing either version : ${reqOnVersion ?? 0}`)
if ((apprOnReq ?? 0) > 0 || (reqOnVersion ?? 0) > 0) {
  console.log('  STOP: a dependent exists. Deleting would orphan or be refused; report first.')
  process.exit(2)
}

console.log('\n=== DELETING, per-id result')
const results = []
const del = async (table, id, label) => {
  const { error } = await db.from(table).delete().eq('id', id)
  const { data: back } = await db.from(table).select('id').eq('id', id).maybeSingle()
  const gone = !error && !back
  results.push({ label, gone, error: error?.message })
  console.log(`  ${gone ? 'OK  ' : 'FAIL'}  ${label}  ${id}${error ? '  ' + error.message : ''}`)
}
// Children first, then the records that carried them.
await del('deal_sheet_versions', V_HYGIENE, 'version created by a non-owner (walk65 real record)')
await del('deal_sheet_versions', V_ISSUED, 'version ISSUED by a non-owner')
await del('transition_requests', REQ, 'request raised by a non-owner')
const now = new Date().toISOString()
for (const [id, label] of [[REC_A, 'probe record that carried the issued version'], [REC_B, 'probe record that carried the request']]) {
  const { error } = await db.from('records').update({ deleted_at: now }).eq('id', id)
  const { data: back } = await db.from('records').select('deleted_at').eq('id', id).single()
  const gone = !error && !!back?.deleted_at
  results.push({ label, gone, error: error?.message })
  console.log(`  ${gone ? 'OK  ' : 'FAIL'}  ${label}  ${id}  (soft, per Verification 11)`)
}

console.log('\n=== RESIDUE, RE-QUERIED: zero probe artefacts anywhere')
const { data: walkVersions } = await db.from('deal_sheet_versions')
  .select('id, major, minor, status, created_by_email').eq('record_id', WALK_REC).order('created_at')
console.log(`  walk65's opportunity ${WALK_REC}: ${walkVersions.length} version(s)`)
for (const v of walkVersions) console.log(`    V${v.major}.${v.minor} ${v.status}  by ${v.created_by_email}`)
const mineOnWalk = walkVersions.filter((v) => v.created_by_email === 'john+test@terminustechnologies.io').length
console.log(`  of which created by this probe account: ${mineOnWalk}`)

const { count: anyVersionsByMe } = await db.from('deal_sheet_versions')
  .select('id', { count: 'exact', head: true }).eq('created_by', ME)
const { count: anyRequestsByMe } = await db.from('transition_requests')
  .select('id', { count: 'exact', head: true }).eq('requested_by', ME)
const { data: liveMine } = await db.from('records').select('id').eq('owner_id', ME).is('deleted_at', null)
const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const other = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid').id
const { data: liveHanded } = await db.from('records').select('id')
  .eq('owner_id', other).is('deleted_at', null).gte('created_at', '2026-09-08')

console.log(`  deal_sheet_versions created by this account, anywhere : ${anyVersionsByMe ?? 0}`)
console.log(`  transition_requests raised by this account, anywhere  : ${anyRequestsByMe ?? 0}`)
console.log(`  live records owned by this account                    : ${liveMine?.length ?? '?'}`)
console.log(`  live probe-account records from today                 : ${liveHanded?.length ?? '?'}`)

const failed = results.filter((r) => !r.gone)
const clean = mineOnWalk === 0 && (anyVersionsByMe ?? 0) === 0 && (anyRequestsByMe ?? 0) === 0
  && (liveMine?.length ?? 1) === 0 && (liveHanded?.length ?? 1) === 0 && !failed.length
console.log(`\n  ${results.filter((r) => r.gone).length}/${results.length} deleted, zero probe artefacts = ${clean}`)
process.exit(clean ? 0 : 1)
