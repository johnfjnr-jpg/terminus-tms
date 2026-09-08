// Phase 0, pass 2: the residue BROKEN DOWN. READ-ONLY, no writes.
//
// Pass 1 produced three counts. Two of them are large and one of them is a
// zero whose calibration did NOT fire, and none of those three numbers can be
// dispositioned as it stands: "585 opportunities with no details row" is a
// disposition question only once it is known how many are live, who owns them,
// and whether the shape is even reachable from the convert path.
//
// Verification 19: a category name is a finding. "Residue" is a category name
// here, so every member of it is checked against the name rather than counted
// under it.
import { admin } from '../fixtures.mjs'
import { writeFileSync } from 'fs'

const OUT = process.argv[2]
const db = admin()
const L = []
const log = s => { L.push(s); console.log(s) }

async function fetchAll(table, columns, orderKey, filter = q => q) {
  const { count, error: cErr } = await filter(db.from(table).select(columns, { count: 'exact', head: true }))
  if (cErr) throw new Error(`${table} exact count: ${cErr.message}`)
  const PAGE = 1000, rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table).select(columns)).order(orderKey, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table} page ${from}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  if (rows.length !== count) throw new Error(`${table}: paged ${rows.length}, server counts ${count}`)
  log(`  coverage ${table.padEnd(20)} ${rows.length} == ${count}`)
  return rows
}

log('=== POPULATIONS')
const records = await fetchAll('records', 'id, record_type, status, owner_id, created_at, deleted_at, reference_code, account_id', 'id')
const details = await fetchAll('opportunity_details', 'record_id, converted_from_test_bed_id, test_bed_cost, created_at', 'record_id')
const revisions = await fetchAll('record_revisions', 'record_id', 'id')

const byId = new Map(records.map(r => [r.id, r]))
const hasDetail = new Set(details.map(d => d.record_id))
const hasRevision = new Set(revisions.map(r => r.record_id))

// WHO OWNS WHAT. Verification 11: residue is every live record no person owns,
// so the owners must be named before any count of "residue" means anything.
log('')
log('=== OWNERS (from auth.users via the admin API, not from a written-down list)')
const emailFor = new Map()
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`listUsers: ${error.message}`)
  for (const u of data.users) emailFor.set(u.id, u.email ?? '(no email)')
  if (data.users.length < 1000) break
}
log(`  auth.users = ${emailFor.size}`)
const ownerCounts = new Map()
for (const r of records) ownerCounts.set(r.owner_id, (ownerCounts.get(r.owner_id) ?? 0) + 1)
for (const [id, n] of [...ownerCounts.entries()].sort((a, b) => b[1] - a[1])) {
  log(`  ${id}  ${String(n).padStart(6)} records  ${emailFor.get(id) ?? '(NOT IN auth.users)'}`)
}

const tally = (rows, key) => {
  const m = new Map()
  for (const r of rows) { const k = key(r); m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const who = r => emailFor.get(r.owner_id) ?? r.owner_id
const live = r => !r.deleted_at

// ── P0.2 broken down first: it is the largest number and the one most likely
// to be a category error rather than a defect.
log('')
log('=== P0.2 records with no record_revisions row, BY TYPE')
log('  type                    total   no-revision   pct   of which LIVE')
for (const [t, n] of tally(records, r => r.record_type)) {
  const of = records.filter(r => r.record_type === t)
  const miss = of.filter(r => !hasRevision.has(r.id))
  log(`  ${t.padEnd(22)} ${String(n).padStart(6)} ${String(miss.length).padStart(12)} ${String((100 * miss.length / n).toFixed(1)).padStart(6)}% ${String(miss.filter(live).length).padStart(14)}`)
}
const p02 = records.filter(r => !hasRevision.has(r.id))
log(`  TOTAL no-revision = ${p02.length}, of which LIVE = ${p02.filter(live).length}`)
log('  by owner:')
for (const [o, n] of tally(p02, who)) log(`    ${String(n).padStart(6)}  ${o}`)
log('  LIVE ones by owner and type:')
for (const [k, n] of tally(p02.filter(live), r => `${r.record_type} / ${who(r)}`)) log(`    ${String(n).padStart(6)}  ${k}`)
log('  LIVE ones by created_at month:')
for (const [k, n] of tally(p02.filter(live), r => r.created_at.slice(0, 7)).sort()) log(`    ${k}  ${n}`)

// ── P0.1
log('')
log('=== P0.1 opportunities with no opportunity_details row')
const opportunities = records.filter(r => r.record_type === 'opportunity')
const p01 = opportunities.filter(o => !hasDetail.has(o.id))
log(`  opportunities = ${opportunities.length}, no details = ${p01.length}, of which LIVE = ${p01.filter(live).length}`)
log('  by owner:')
for (const [o, n] of tally(p01, who)) log(`    ${String(n).padStart(6)}  ${o}`)
log('  by (live?, has_revision?):')
for (const [k, n] of tally(p01, r => `${live(r) ? 'LIVE' : 'deleted'} / revision=${hasRevision.has(r.id)}`)) log(`    ${String(n).padStart(6)}  ${k}`)
log('  by created_at month:')
for (const [k, n] of tally(p01, r => r.created_at.slice(0, 7)).sort()) log(`    ${k}  ${n}`)
log('  THE LIVE ONES, in full (these are the only rows a disposition can be about):')
const p01live = p01.filter(live)
if (!p01live.length) log('    (none)')
for (const o of p01live) {
  log(`    id=${o.id} status=${o.status} created_at=${o.created_at} owner=${who(o)} revision=${hasRevision.has(o.id)} ref=${o.reference_code ?? 'null'} account=${o.account_id ?? 'null'}`)
}

// ── P0.3, and the empty-population question the failed C3 calibration raised.
log('')
log('=== P0.3 and the population its zero rests on')
const converted = details.filter(d => d.converted_from_test_bed_id)
log(`  opportunity_details carrying converted_from_test_bed_id = ${converted.length}`)
const distinctBeds = new Set(converted.map(d => d.converted_from_test_bed_id))
log(`  distinct source Test Beds named = ${distinctBeds.size}`)
const oppLive = converted.filter(d => byId.get(d.record_id) && !byId.get(d.record_id).deleted_at)
const oppDeleted = converted.filter(d => byId.get(d.record_id)?.deleted_at)
const oppMissing = converted.filter(d => !byId.has(d.record_id))
log(`  of those rows: opportunity LIVE = ${oppLive.length}, opportunity SOFT-DELETED = ${oppDeleted.length}, opportunity record MISSING = ${oppMissing.length}`)
const bedLive = [...distinctBeds].filter(b => byId.get(b) && !byId.get(b).deleted_at)
const bedDeleted = [...distinctBeds].filter(b => byId.get(b)?.deleted_at)
const bedMissing = [...distinctBeds].filter(b => !byId.has(b))
log(`  of those beds:  bed LIVE = ${bedLive.length}, bed SOFT-DELETED = ${bedDeleted.length}, bed record MISSING = ${bedMissing.length}`)
const perBed = new Map()
for (const d of converted) perBed.set(d.converted_from_test_bed_id, (perBed.get(d.converted_from_test_bed_id) ?? 0) + 1)
log(`  conversions per bed, all rows regardless of deleted_at:`)
for (const [k, n] of tally([...perBed.values()].map(v => ({ v })), r => `${r.v} conversion(s)`)) log(`    ${String(n).padStart(6)} bed(s) with ${k}`)
log('  by owner of the converted opportunity:')
for (const [o, n] of tally(converted.map(d => byId.get(d.record_id)).filter(Boolean), who)) log(`    ${String(n).padStart(6)}  ${o}`)
log('  by created_at month of the details row:')
for (const [k, n] of tally(converted, d => d.created_at.slice(0, 7)).sort()) log(`    ${k}  ${n}`)

writeFileSync(OUT, L.join('\n') + '\n')
console.log(`\nwritten to ${OUT}`)
