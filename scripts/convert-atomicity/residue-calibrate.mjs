// Phase 0, pass 3: the calibrations pass 1 could not run, and the two
// measurements the brief's three counts cannot make. READ-ONLY, no writes.
//
// WHY THIS PASS EXISTS. Pass 1's C3 came back FIRED = false, and pass 1's C3b
// was skipped entirely because it was written as `if (groups.size)` over a
// population that turned out to be empty. That is Verification 14's commonest
// shape - an assertion inside a guard on its own population - committed by the
// calibration harness itself. A skipped calibration prints nothing and reads
// exactly like one that passed.
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
const records = await fetchAll('records', 'id, record_type, status, owner_id, created_at, deleted_at, parent_record_id, variant, document_kind', 'id')
const details = await fetchAll('opportunity_details', 'record_id, converted_from_test_bed_id, created_at', 'record_id')
const revisions = await fetchAll('record_revisions', 'record_id', 'id')
const audits = await fetchAll('audit_log', 'record_id, record_type, action, actor_id, timestamp, detail', 'id')
const docDetails = await fetchAll('document_details', 'record_id', 'record_id')

const byId = new Map(records.map(r => [r.id, r]))
const hasRevision = new Set(revisions.map(r => r.record_id))
const hasDocDetail = new Set(docDetails.map(d => d.record_id))
const converted = details.filter(d => d.converted_from_test_bed_id)

// ── C3b, RE-RUN on a population that is not empty ───────────────────────
// The live-conversion grouping has zero members, so the > 1 threshold cannot
// be shown firing on it. The nearest population that is not empty is the same
// grouping WITHOUT the deleted_at exclusion: 70 groups, every one at count 1.
// Duplicating one row in memory must move exactly one group over the limit.
log('')
log('=== C3b (re-run) the > 1 threshold, on the deleted-inclusive grouping')
const group = rows => {
  const g = new Map()
  for (const d of rows) {
    const k = d.converted_from_test_bed_id
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(d)
  }
  return g
}
const base = group(converted)
const baseOver = [...base.entries()].filter(([, v]) => v.length > 1)
log(`  baseline: ${base.size} bed(s) grouped, ${baseOver.length} over the limit of 1`)
const victimBed = [...base.keys()][0]
const injected = group([...converted, { ...base.get(victimBed)[0] }])
const injOver = [...injected.entries()].filter(([, v]) => v.length > 1)
log(`  injected a duplicate conversion row for bed ${victimBed}`)
log(`  -> ${injOver.length} bed(s) over the limit, names that bed = ${injOver.some(([k]) => k === victimBed)}`)
log(`  FIRED = ${injOver.length === baseOver.length + 1 && injOver.some(([k]) => k === victimBed)}`)

// ── C3 restated ─────────────────────────────────────────────────────────
log('')
log('=== C3 (restated) what P0.3\'s zero rests on')
const liveConv = converted.filter(d => !byId.get(d.record_id)?.deleted_at)
log(`  conversion rows whose opportunity is LIVE = ${liveConv.length}`)
log(`  therefore beds with >= 1 live conversion = ${new Set(liveConv.map(d => d.converted_from_test_bed_id)).size}`)
log(`  P0.3 asks for beds with > 1 of a set whose size is ${liveConv.length}. The zero is TRUE BY ABSENCE.`)

// ── P0.B ────────────────────────────────────────────────────────────────
// The measurement the brief's three counts cannot make. If insert 3 fails, the
// details row is what is missing, so nothing in opportunity_details can see
// the conversion at all. The audit_log row on the BED is the only independent
// witness that a conversion happened - and it is written last, so it is
// present only when inserts 1-3 all landed. A bed with a
// converted_to_opportunity audit row and no details row naming it is the
// insert-3 failure, and it is invisible to P0.1 whenever the opportunity was
// later deleted or never identified.
log('')
log('=== P0.B beds audited as converted, cross-checked against the details rows')
const convAudits = audits.filter(a => a.action === 'converted_to_opportunity')
log(`  audit_log rows with action=converted_to_opportunity = ${convAudits.length}`)
const bedsInDetails = new Set(converted.map(d => d.converted_from_test_bed_id))
const auditedBeds = new Set(convAudits.map(a => a.record_id))
log(`  distinct beds named by those audit rows = ${auditedBeds.size}`)
log(`  distinct beds named by opportunity_details = ${bedsInDetails.size}`)
const auditedNoDetail = [...auditedBeds].filter(b => !bedsInDetails.has(b))
const detailNoAudit = [...bedsInDetails].filter(b => !auditedBeds.has(b))
log(`  P0.B COUNT audited-as-converted with NO details row naming them = ${auditedNoDetail.length}`)
for (const b of auditedNoDetail) {
  const bed = byId.get(b)
  const a = convAudits.filter(x => x.record_id === b)
  log(`      bed id=${b} ${bed ? `${bed.deleted_at ? 'SOFT-DELETED' : 'LIVE'} status=${bed.status} created_at=${bed.created_at}` : 'BED RECORD MISSING'}`)
  for (const one of a) log(`        audit ${one.timestamp} actor=${one.actor_id} -> opportunity ${one.detail?.opportunity_id} ${byId.has(one.detail?.opportunity_id) ? (byId.get(one.detail.opportunity_id).deleted_at ? 'SOFT-DELETED' : 'LIVE') : 'RECORD MISSING'}`)
}
log(`  the inverse, details rows with no audit row on the bed = ${detailNoAudit.length}`)
const multiAudited = [...auditedBeds].filter(b => convAudits.filter(x => x.record_id === b).length > 1)
log(`  beds audited as converted MORE THAN ONCE = ${multiAudited.length}`)
for (const b of multiAudited) {
  const n = convAudits.filter(x => x.record_id === b)
  log(`      bed id=${b} audited ${n.length} times: ${n.map(x => `${x.timestamp} -> ${x.detail?.opportunity_id}`).join(' | ')}`)
}

// P0.B calibration: the cross-check must be able to report a nonzero. Withhold
// one real bed from the details side and confirm the anti-join names it.
const cbVictim = [...bedsInDetails][0]
const cbSet = new Set(bedsInDetails); cbSet.delete(cbVictim)
const cb = [...auditedBeds].filter(b => !cbSet.has(b))
log(`  CALIBRATION withholding bed ${cbVictim} from the details side`)
log(`  -> reports ${cb.length}, names it = ${cb.includes(cbVictim)}`)
log(`  FIRED = ${cb.length === auditedNoDetail.length + (auditedBeds.has(cbVictim) ? 1 : 0) && (!auditedBeds.has(cbVictim) || cb.includes(cbVictim))}`)

// ── P0.C ────────────────────────────────────────────────────────────────
// P0.2's criterion has a shape. Both document creation paths in
// src/routes/test-beds.js insert into records and then into document_details,
// and NEITHER writes a record_revisions row. So "a record with no revision" is
// the normal state of a document, and counting documents under P0.2 counts a
// design decision as residue. Measured rather than read off the two routes.
log('')
log('=== P0.C the P0.2 criterion checked against the document record type')
const docs = records.filter(r => r.record_type === 'document')
const docsNoRev = docs.filter(r => !hasRevision.has(r.id))
const docsLive = docs.filter(r => !r.deleted_at)
const docsLiveNoRev = docsLive.filter(r => !hasRevision.has(r.id))
log(`  document records = ${docs.length}, without a revision = ${docsNoRev.length} (${(100 * docsNoRev.length / docs.length).toFixed(1)}%)`)
log(`  LIVE document records = ${docsLive.length}, without a revision = ${docsLiveNoRev.length} (${(100 * docsLiveNoRev.length / docsLive.length).toFixed(1)}%)`)
log(`  the 84 with a revision, by owner/kind:`)
const withRev = docs.filter(r => hasRevision.has(r.id))
const t = new Map()
for (const r of withRev) { const k = `${r.document_kind ?? 'null'} / ${r.deleted_at ? 'deleted' : 'LIVE'}`; t.set(k, (t.get(k) ?? 0) + 1) }
for (const [k, n] of t) log(`      ${String(n).padStart(4)}  ${k}`)
log(`  LIVE documents with no revision, do they carry a document_details row:`)
log(`      with document_details = ${docsLiveNoRev.filter(r => hasDocDetail.has(r.id)).length}`)
log(`      without                = ${docsLiveNoRev.filter(r => !hasDocDetail.has(r.id)).length}`)
log(`  LIVE documents with no revision, by kind and parent:`)
const t2 = new Map()
for (const r of docsLiveNoRev) {
  const k = `${r.document_kind ?? 'null'} / parent ${byId.get(r.parent_record_id)?.record_type ?? 'MISSING'} ${byId.get(r.parent_record_id)?.deleted_at ? '(deleted)' : '(live)'}`
  t2.set(k, (t2.get(k) ?? 0) + 1)
}
for (const [k, n] of t2) log(`      ${String(n).padStart(4)}  ${k}`)

// ── P0.2 restated, with the document type set aside ─────────────────────
log('')
log('=== P0.2 (restated) excluding the record type that has no revision by design')
const p02 = records.filter(r => !hasRevision.has(r.id))
const p02NoDocs = p02.filter(r => r.record_type !== 'document')
const p02NoDocsLive = p02NoDocs.filter(r => !r.deleted_at)
log(`  all records with no revision            = ${p02.length}`)
log(`  excluding document                      = ${p02NoDocs.length}`)
log(`  of those, LIVE                          = ${p02NoDocsLive.length}`)
for (const r of p02NoDocsLive) log(`      id=${r.id} type=${r.record_type} status=${r.status} created_at=${r.created_at} owner=${r.owner_id}`)

writeFileSync(OUT, L.join('\n') + '\n')
console.log(`\nwritten to ${OUT}`)
