// Phase 0, pass 4: attribution. READ-ONLY, no writes.
//
// The three counts say how many rows are in a SHAPE. They do not say what put
// them there, and the disposition question is entirely about what put them
// there. Verification 19: "residue" is a category name, so every member is
// checked against the name.
//
// THE FOUR FAILURE SIGNATURES of the convert route, derived from the route's
// own control flow (src/routes/test-beds.js:1502-1560) rather than from the
// brief's prose. Each insert returns on error, so a failure at position N
// leaves the writes before it and none after it:
//
//   insert 1 records            fails -> no record at all.        INVISIBLE
//   insert 2 record_revisions   fails -> record, no rev, no det, no audit
//   insert 3 opportunity_details fails -> record, rev, no det, no audit
//   insert 4 audit_log          fails -> record, rev, det, no audit
//
// So an audit row PRESENT with the details row ABSENT is not producible by the
// route in either direction, and P0.B's 16 need a different explanation.
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
const records = await fetchAll('records', 'id, record_type, status, owner_id, created_at, deleted_at', 'id')
const details = await fetchAll('opportunity_details', 'record_id, converted_from_test_bed_id', 'record_id')
const revisions = await fetchAll('record_revisions', 'record_id', 'id')
const audits = await fetchAll('audit_log', 'record_id, record_type, action, actor_id, timestamp, detail', 'id')

const byId = new Map(records.map(r => [r.id, r]))
const hasDetail = new Set(details.map(d => d.record_id))
const hasRevision = new Set(revisions.map(r => r.record_id))
const auditsOn = new Map()
for (const a of audits) {
  if (!auditsOn.has(a.record_id)) auditsOn.set(a.record_id, [])
  auditsOn.get(a.record_id).push(a)
}
const emailFor = new Map()
for (let page = 1; ; page++) {
  const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 })
  for (const u of data.users) emailFor.set(u.id, u.email ?? '(no email)')
  if (data.users.length < 1000) break
}
const who = id => emailFor.get(id) ?? `${id} (NOT IN auth.users)`
const tally = (rows, key) => {
  const m = new Map()
  for (const r of rows) { const k = key(r); m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

// ── The 585, attributed by what created them ────────────────────────────
// An opportunity created by EITHER conversion route carries an audit row that
// names the route: created_from_test_bed or created_from_contact. One created
// by a fixture writing to `records` directly carries neither. That audit row is
// written AFTER the details row, so it is present only when the details insert
// succeeded - which makes "no details AND a creation audit" impossible from
// the route and "no details AND no creation audit" the only shape the route
// can leave.
log('')
log('=== P0.1 the 585, attributed by creation audit')
const opportunities = records.filter(r => r.record_type === 'opportunity')
const p01 = opportunities.filter(o => !hasDetail.has(o.id))
const creationAction = o => {
  const a = (auditsOn.get(o.id) ?? []).map(x => x.action)
  if (a.includes('created_from_test_bed')) return 'created_from_test_bed'
  if (a.includes('created_from_contact')) return 'created_from_contact'
  if (a.length) return `other audit: ${[...new Set(a)].sort().join(',')}`
  return 'NO AUDIT ROW AT ALL'
}
for (const [k, n] of tally(p01, creationAction)) log(`  ${String(n).padStart(5)}  ${k}`)
log('  cross-tabulated with whether a revision landed:')
for (const [k, n] of tally(p01, o => `${creationAction(o)} | revision=${hasRevision.has(o.id)}`)) log(`  ${String(n).padStart(5)}  ${k}`)
log('  the same for the WHOLE opportunity population, as the baseline:')
for (const [k, n] of tally(opportunities, creationAction)) log(`  ${String(n).padStart(5)}  ${k}`)

// ── The 16 of P0.B, attributed ──────────────────────────────────────────
log('')
log('=== P0.B the 16, attributed')
const convAudits = audits.filter(a => a.action === 'converted_to_opportunity')
const bedsInDetails = new Set(details.filter(d => d.converted_from_test_bed_id).map(d => d.converted_from_test_bed_id))
const auditedBeds = [...new Set(convAudits.map(a => a.record_id))]
const gap = auditedBeds.filter(b => !bedsInDetails.has(b))
log(`  count = ${gap.length}`)
log('  by audit date and actor:')
const gapAudits = convAudits.filter(a => gap.includes(a.record_id))
for (const [k, n] of tally(gapAudits, a => `${a.timestamp.slice(0, 10)}  ${who(a.actor_id)}`).sort()) log(`    ${String(n).padStart(4)}  ${k}`)
log('  per audit row: does the named opportunity exist, and does it hold ANY details row:')
for (const a of gapAudits.sort((x, y) => x.timestamp.localeCompare(y.timestamp))) {
  const oid = a.detail?.opportunity_id
  const o = oid ? byId.get(oid) : null
  log(`    ${a.timestamp}  bed=${a.record_id.slice(0, 8)}  opp=${oid ? oid.slice(0, 8) : 'null'}  ${o ? (o.deleted_at ? 'deleted' : 'LIVE') : 'RECORD GONE'}  details=${oid ? hasDetail.has(oid) : 'n/a'}  revision=${oid ? hasRevision.has(oid) : 'n/a'}  actor=${who(a.actor_id)}`)
}

// ── The shape the route CAN leave, isolated ─────────────────────────────
log('')
log('=== THE ROUTE-PRODUCIBLE SHAPES, isolated')
const shape2 = p01.filter(o => !hasRevision.has(o.id) && !(auditsOn.get(o.id) ?? []).length)
const shape3 = p01.filter(o => hasRevision.has(o.id) && !(auditsOn.get(o.id) ?? []).length)
const shape4 = opportunities.filter(o => hasDetail.has(o.id) && hasRevision.has(o.id)
  && !(auditsOn.get(o.id) ?? []).some(a => a.action === 'created_from_test_bed' || a.action === 'created_from_contact'))
log(`  insert-2 signature (record, no revision, no details, no audit) = ${shape2.length}, LIVE = ${shape2.filter(r => !r.deleted_at).length}`)
log(`  insert-3 signature (record, revision, no details, no audit)    = ${shape3.length}, LIVE = ${shape3.filter(r => !r.deleted_at).length}`)
log(`  insert-4 signature (record, revision, details, no creation audit) = ${shape4.length}, LIVE = ${shape4.filter(r => !r.deleted_at).length}`)
log('  ...but every one of those shapes is ALSO what a fixture that writes records directly leaves,')
log('  so the shapes are an upper bound on conversion residue, not a measurement of it.')
log('  by owner, insert-3 signature:')
for (const [k, n] of tally(shape3, r => who(r.owner_id))) log(`    ${String(n).padStart(5)}  ${k}`)
log('  by owner, insert-4 signature:')
for (const [k, n] of tally(shape4, r => who(r.owner_id))) log(`    ${String(n).padStart(5)}  ${k}`)
log('  insert-4 signature, LIVE rows in full:')
const s4live = shape4.filter(r => !r.deleted_at)
if (!s4live.length) log('    (none)')
for (const r of s4live) log(`    id=${r.id} status=${r.status} created_at=${r.created_at} owner=${who(r.owner_id)}`)

// ── The one number that decides the disposition ─────────────────────────
log('')
log('=== LIVE RECORDS IN ANY OF THE THREE SHAPES, OWNED BY A REAL PERSON')
const REAL = [...emailFor.entries()].filter(([, e]) => e.endsWith('@terminustechnologies.io') && !e.includes('+test')).map(([id]) => id)
log(`  accounts treated as a real person: ${REAL.map(who).join(', ')}`)
log(`  (every other account is a probe, a walk account, or a +test address; named, not assumed)`)
for (const [, e] of [...emailFor.entries()]) log(`    seen: ${e}`)
const suspects = [...new Set([...shape2, ...shape3, ...shape4])].filter(r => !r.deleted_at && REAL.includes(r.owner_id))
log(`  COUNT = ${suspects.length}`)
for (const r of suspects) log(`    id=${r.id} type=${r.record_type} status=${r.status} created_at=${r.created_at}`)

writeFileSync(OUT, L.join('\n') + '\n')
console.log(`\nwritten to ${OUT}`)
