// R10: the approved teardown, executed as a LISTED, COUNTED data change.
//
// Ids before, a per-id result, and a residue re-count afterwards that must read
// exactly the three evidence rows. Verification 11: confirm a teardown by
// RE-QUERYING, never by trusting its own result.
//
// ── TWO RECORDS ARE HELD BACK, AND SAYING SO IS THE POINT ─────────────────
//
// Two of the fifteen probe-account opportunities CARRY EVIDENCE ROWS that R2
// and R10 both keep:
//   a7178858  carries e975b27e, the version a non-owner ISSUED
//   e70d0755  carries 0197a77d, the request a non-owner raised that moved it
// Soft-deleting their parent records would leave the evidence attached to
// deleted records - kept in name and gutted in context. They are excluded, and
// their disposition goes to the close with the rows they carry.
//
// SOFT DELETE for records, per Verification 11 - `records` carries ON DELETE
// RESTRICT from three tables. The stray VERSION is a hard delete because
// deal_sheet_versions has no deleted_at, and it is ruled.
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const db = admin()
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const STRAY_VERSION = '8d1f8b18-ee67-4153-80b1-1cb05300a04c'
const EVIDENCE_VERSIONS = ['5f1517b2-27df-41af-bb10-9261f70e146c', 'e975b27e-204c-451b-8956-d9f6ac4a3ddb']
const EVIDENCE_REQUEST = '0197a77d-cc1e-4add-8c49-687611ce98b7'
const HOLD_BACK = ['a7178858-cfca-4dc5-9409-e82ee727f44e', 'e70d0755-1702-42fd-93c6-78ab64789e9a']

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const other = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid').id

// ── IDS BEFORE ───────────────────────────────────────────────────────────
const { data: mine } = await db.from('records').select('id, record_type, status')
  .eq('owner_id', ME).is('deleted_at', null).order('record_type')
const { data: handed } = await db.from('records').select('id, record_type, status')
  .eq('owner_id', other).is('deleted_at', null).gte('created_at', '2026-09-08').order('created_at')

console.log('=== IDS BEFORE')
console.log(`  owned by the test account : ${mine.length}`)
for (const r of mine) console.log(`    ${r.id}  ${r.record_type}`)
console.log(`  handed to the probe account today : ${handed.length}`)
for (const r of handed) console.log(`    ${r.id}  ${r.record_type}  ${r.status}${HOLD_BACK.includes(r.id) ? '   <- HELD BACK, carries evidence' : ''}`)
console.log(`  stray version : ${STRAY_VERSION}`)

const toDelete = [...mine, ...handed.filter((r) => !HOLD_BACK.includes(r.id))]
console.log(`\n=== DELETING ${toDelete.length} records (soft), holding back ${HOLD_BACK.length}`)

// ── PER-ID RESULT ────────────────────────────────────────────────────────
const now = new Date().toISOString()
let ok = 0, failed = []
for (const r of toDelete) {
  const { error } = await db.from('records').update({ deleted_at: now }).eq('id', r.id)
  const { data: back } = await db.from('records').select('deleted_at').eq('id', r.id).single()
  const done = !error && !!back?.deleted_at
  if (done) ok++; else failed.push(`${r.id}: ${error?.message ?? 'deleted_at still null'}`)
  console.log(`  ${done ? 'OK  ' : 'FAIL'}  ${r.id}  ${r.record_type}`)
}
console.log(`  ${ok}/${toDelete.length} soft-deleted`)

const { error: vErr } = await db.from('deal_sheet_versions').delete().eq('id', STRAY_VERSION)
const { data: vBack } = await db.from('deal_sheet_versions').select('id').eq('id', STRAY_VERSION).maybeSingle()
console.log(`  ${!vErr && !vBack ? 'OK  ' : 'FAIL'}  ${STRAY_VERSION}  stray version, hard delete (no deleted_at on this table)`)

// ── RESIDUE RE-COUNT: must read exactly the three evidence rows ──────────
console.log('\n=== RESIDUE, RE-QUERIED')
const { data: leftMine } = await db.from('records').select('id, record_type').eq('owner_id', ME).is('deleted_at', null)
const { data: leftHanded } = await db.from('records').select('id, record_type').eq('owner_id', other)
  .is('deleted_at', null).gte('created_at', '2026-09-08')
console.log(`  live records owned by the test account : ${leftMine?.length ?? '?'}`)
console.log(`  live probe-account records from today  : ${leftHanded?.length ?? '?'}  ${(leftHanded ?? []).map((r) => r.id.slice(0, 8)).join(' ')}`)

console.log('\n=== THE THREE EVIDENCE ROWS, confirmed present')
let evidence = 0
for (const id of EVIDENCE_VERSIONS) {
  const { data: v } = await db.from('deal_sheet_versions').select('id, record_id, major, minor, status').eq('id', id).maybeSingle()
  if (v) evidence++
  console.log(`  ${v ? 'PRESENT' : 'MISSING'}  version ${id}  ${v ? `V${v.major}.${v.minor} ${v.status} on ${v.record_id}` : ''}`)
}
const { data: tr } = await db.from('transition_requests').select('id, record_id, status, from_stage, to_stage').eq('id', EVIDENCE_REQUEST).maybeSingle()
if (tr) evidence++
console.log(`  ${tr ? 'PRESENT' : 'MISSING'}  request ${EVIDENCE_REQUEST}  ${tr ? `${tr.from_stage} -> ${tr.to_stage} ${tr.status} on ${tr.record_id}` : ''}`)
console.log(`\n  evidence rows intact: ${evidence}/3`)
console.log(`  stray version gone  : ${!vBack}`)
console.log(`  failures            : ${failed.length}${failed.length ? '\n    ' + failed.join('\n    ') : ''}`)
process.exit(evidence === 3 && !vBack && !failed.length ? 0 : 1)
