// Phase 0 of the convert atomicity round: the residue probe.
//
// READ-ONLY. This script performs no writes of any kind: every Supabase call
// below is a .select(). It measures what the unguarded multi-insert creation
// paths have already left behind, and proposes nothing.
//
// THE INSTRUMENT IS THE SERVICE-ROLE CLIENT, deliberately. A census taken
// through a user client is a census of what RLS shows that user, which is a
// different population from "what is in the table" and would report a smaller
// number for a reason unrelated to the truth. `admin` is imported from
// scripts/fixtures.mjs rather than rebuilt here: Round 41 W6, one reader of
// the key (Verification 20).
//
// COVERAGE IS ASSERTED, NOT ASSUMED. Verification 17's paged-API species:
// PostgREST caps a select at its configured limit, and a probe that reads
// 1000 of 8237 rows discriminates perfectly over the part it can see and is
// blind to the rest. Every fetch below pages explicitly AND compares its own
// row count against the server's `count: 'exact'` for the same filter,
// stopping dead on a mismatch.
//
// EVERY NUMBER IS EMITTED BY THE RUN and written to a file which is then read.
// Nothing here is hand-typed into the report.
import { admin } from '../fixtures.mjs'
import { writeFileSync } from 'fs'

const OUT = process.argv[2]
if (!OUT) throw new Error('usage: node residue-probe.mjs <output-file>')

const db = admin()
const L = []
const log = s => { L.push(s); console.log(s) }
const num = {}

// Pages a whole table under one filter, and proves it read the whole thing.
// Returns the rows. Throws rather than returning a short read, because a short
// read is the failure mode that reports a clean census.
async function fetchAll(table, columns, orderKey, filter = q => q) {
  const { count, error: cErr } = await filter(db.from(table).select(columns, { count: 'exact', head: true }))
  if (cErr) throw new Error(`${table} exact count failed: ${cErr.message}`)

  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table).select(columns))
      .order(orderKey, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table} page at ${from} failed: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }

  if (rows.length !== count) {
    throw new Error(`${table}: paged ${rows.length} rows, server counts ${count}. Short read; census refused.`)
  }
  log(`  coverage  ${table.padEnd(20)} paged ${rows.length} == server exact count ${count}`)
  return rows
}

log('=== POPULATIONS (each proved complete against the server\'s own count)')
const records = await fetchAll('records', 'id, record_type, status, owner_id, created_at, deleted_at, reference_code, account_id', 'id')
const details = await fetchAll('opportunity_details', 'record_id, converted_from_test_bed_id, test_bed_cost, probability_pct, created_at', 'record_id')
const revisions = await fetchAll('record_revisions', 'record_id', 'id')
const audits = await fetchAll('audit_log', 'record_id, record_type, action', 'id')

num.records = records.length
num.opportunity_details = details.length
num.record_revisions = revisions.length
num.audit_log = audits.length

const byId = new Map(records.map(r => [r.id, r]))
const detailFor = new Map(details.map(d => [d.record_id, d]))
const hasRevision = new Set(revisions.map(r => r.record_id))
const opportunities = records.filter(r => r.record_type === 'opportunity')
num.opportunities = opportunities.length
log(`  population  opportunities = ${opportunities.length} of ${records.length} records`)

const state = r => `${r.deleted_at ? 'SOFT-DELETED' : 'LIVE'} status=${r.status}`
const row = r => `      id=${r.id} type=${r.record_type} created_at=${r.created_at} owner=${r.owner_id} ${state(r)}`

// ── P0.1 ────────────────────────────────────────────────────────────────
// Opportunity records with no opportunity_details row. A failure between
// insert 2 and insert 3 of the convert route leaves exactly this.
log('')
log('=== P0.1 Opportunity records with no opportunity_details row')
const p01 = opportunities.filter(o => !detailFor.has(o.id))
num.p01 = p01.length
log(`  COUNT = ${p01.length}`)
for (const o of p01) {
  log(row(o))
  log(`        has_revision=${hasRevision.has(o.id)} audit_actions=${audits.filter(a => a.record_id === o.id).map(a => a.action).join(',') || '(none)'}`)
}

// ── P0.2 ────────────────────────────────────────────────────────────────
// Records of ANY type with no record_revisions row. A failure between insert 1
// and insert 2 of any multi-insert creation path leaves exactly this: a ghost
// record with no payload at all.
log('')
log('=== P0.2 Records (any type) with no record_revisions row')
const p02 = records.filter(r => !hasRevision.has(r.id))
num.p02 = p02.length
log(`  COUNT = ${p02.length}`)
for (const r of p02) {
  log(row(r))
  log(`        has_details=${detailFor.has(r.id)} audit_actions=${audits.filter(a => a.record_id === r.id).map(a => a.action).join(',') || '(none)'}`)
}

// ── P0.3 ────────────────────────────────────────────────────────────────
// Test Beds with more than one LIVE conversion. Counting only rows whose
// opportunity record has deleted_at null, per the brief and per the route's
// own liveConversions filter.
log('')
log('=== P0.3 Test Beds with more than one LIVE conversion')
const converted = details.filter(d => d.converted_from_test_bed_id)
num.converted_details = converted.length
log(`  population  opportunity_details carrying converted_from_test_bed_id = ${converted.length}`)

function groupLive(rows) {
  const g = new Map()
  for (const d of rows) {
    const opp = byId.get(d.record_id)
    if (opp?.deleted_at) continue          // the deleted_at exclusion
    if (!opp) continue                     // an orphan detail row; counted separately below
    const k = d.converted_from_test_bed_id
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(d)
  }
  return g
}
const groups = groupLive(converted)
num.beds_with_live_conversion = groups.size
const over = [...groups.entries()].filter(([, v]) => v.length > 1)
num.p03 = over.length
log(`  beds with at least one live conversion = ${groups.size}`)
log(`  COUNT (beds with more than one) = ${over.length}`)
for (const [bedId, ds] of over) {
  const bed = byId.get(bedId)
  log(`      bed id=${bedId} ${bed ? state(bed) : 'BED RECORD MISSING'} live conversions=${ds.length}`)
  for (const d of ds) log(`        -> opportunity ${d.record_id} ${byId.has(d.record_id) ? state(byId.get(d.record_id)) : 'RECORD MISSING'} created_at=${d.created_at}`)
}

// The same grouping WITHOUT the deleted_at exclusion, so the report can say
// what work the exclusion is doing rather than assert that it matters.
const allGroups = new Map()
for (const d of converted) {
  const k = d.converted_from_test_bed_id
  if (!allGroups.has(k)) allGroups.set(k, [])
  allGroups.get(k).push(d)
}
const overAll = [...allGroups.entries()].filter(([, v]) => v.length > 1)
num.p03_ignoring_deleted = overAll.length
log(`  the same count IGNORING deleted_at = ${overAll.length}  (the exclusion changes the answer by ${overAll.length - over.length})`)
for (const [bedId, ds] of overAll) {
  log(`      bed id=${bedId} total conversions=${ds.length} of which live=${ds.filter(d => !byId.get(d.record_id)?.deleted_at).length}`)
}

// ── P0.A, beyond the brief's three ──────────────────────────────────────
// The brief's own defect statement names a failure at insert 4: "converts with
// no audit trail and still returns 201". Ruling 2 changes that behaviour, so
// whether any such residue EXISTS is what says whether the ruling is
// retrospective as well as forward-looking. Cheap on populations already read.
log('')
log('=== P0.A (beyond the brief\'s three) conversions with no audit trail')
const auditKey = new Set(audits.map(a => `${a.record_id}|${a.action}`))
const missingAudit = converted.filter(d => !auditKey.has(`${d.record_id}|created_from_test_bed`))
num.p0A = missingAudit.length
log(`  converted opportunities with no created_from_test_bed audit row = ${missingAudit.length}`)
for (const d of missingAudit) {
  const o = byId.get(d.record_id)
  log(o ? row(o) : `      opportunity ${d.record_id} HAS NO RECORD`)
}
const orphanDetails = details.filter(d => !byId.has(d.record_id))
num.orphan_detail_rows = orphanDetails.length
log(`  opportunity_details rows whose record_id names no record = ${orphanDetails.length}`)

// ── CALIBRATION ─────────────────────────────────────────────────────────
// Verification 12/13/17/25, collapsed: before trusting a null reading, make
// the instrument produce a non-null one ON THE SAME POPULATION the claim
// covers. Every calibration below runs the REAL detector over the REAL rows
// with one element withheld in memory. Nothing is written to the database.
log('')
log('=== CALIBRATION (each detector shown producing a non-null reading on the real population)')

// C1: P0.1's anti-join, with one real opportunity's details row withheld.
const c1Victim = opportunities.find(o => detailFor.has(o.id))
if (!c1Victim) throw new Error('C1 cannot run: no opportunity has a details row')
const c1Set = new Map(detailFor); c1Set.delete(c1Victim.id)
const c1 = opportunities.filter(o => !c1Set.has(o.id))
num.c1 = c1.length
log(`  C1  P0.1 detector, withholding the details row of ${c1Victim.id}`)
log(`      -> reports ${c1.length} row(s): ${c1.map(o => o.id).join(', ')}`)
log(`      FIRED = ${c1.length === p01.length + 1 && c1.some(o => o.id === c1Victim.id)}`)

// C1b: the same detector aimed at a population it must find in bulk. Non-
// opportunity records have no opportunity_details row by construction, so a
// working anti-join must report all of them. A detector that reports zero here
// is not detecting; it is broken.
const c1b = records.filter(r => r.record_type !== 'opportunity' && !detailFor.has(r.id))
num.c1b = c1b.length
log(`  C1b P0.1 detector over non-opportunity records (all of which must lack a details row)`)
log(`      -> reports ${c1b.length} of ${records.length - opportunities.length}`)
log(`      FIRED = ${c1b.length === records.length - opportunities.length && c1b.length > 0}`)

// C2: P0.2's anti-join, with one real record's revision withheld.
const c2Victim = records.find(r => hasRevision.has(r.id))
if (!c2Victim) throw new Error('C2 cannot run: no record has a revision')
const c2Set = new Set(hasRevision); c2Set.delete(c2Victim.id)
const c2 = records.filter(r => !c2Set.has(r.id))
num.c2 = c2.length
log(`  C2  P0.2 detector, withholding the revisions of ${c2Victim.id}`)
log(`      -> reports ${c2.length} row(s), includes the victim = ${c2.some(r => r.id === c2Victim.id)}`)
log(`      FIRED = ${c2.length === p02.length + 1 && c2.some(r => r.id === c2Victim.id)}`)

// C3: P0.3's grouping, threshold lowered from >1 to >=1. This is the positive
// case the brief's query is a filtered view of: if the grouping can see beds
// with one conversion, the same grouping can see beds with two.
const c3 = [...groups.entries()].filter(([, v]) => v.length >= 1)
num.c3 = c3.length
log(`  C3  P0.3 grouping at threshold >= 1 instead of > 1`)
log(`      -> reports ${c3.length} bed(s) with at least one live conversion`)
log(`      FIRED = ${c3.length > 0}`)

// C3b: the > 1 branch itself, with one real group's row duplicated in memory.
// C3 proves the grouping sees rows; this proves the THRESHOLD fires.
if (groups.size) {
  const [k, v] = [...groups.entries()][0]
  const c3bRows = [...converted, { ...v[0] }]
  const c3bGroups = groupLive(c3bRows)
  // the duplicate shares record_id, so re-count by array length not by set
  const c3b = [...c3bGroups.entries()].filter(([, vv]) => vv.length > 1)
  num.c3b = c3b.length
  log(`  C3b P0.3 threshold, duplicating one live conversion row of bed ${k}`)
  log(`      -> reports ${c3b.length} bed(s) over the limit, includes that bed = ${c3b.some(([kk]) => kk === k)}`)
  log(`      FIRED = ${c3b.length === over.length + 1 && c3b.some(([kk]) => kk === k)}`)
}

// C4: the coverage assertion itself. fetchAll throws on a short read; prove
// that it can, by asking for a deliberately capped page and comparing.
{
  const { count } = await db.from('record_revisions').select('record_id', { count: 'exact', head: true })
  const { data: capped } = await db.from('record_revisions').select('record_id').limit(1000)
  num.c4_server_count = count
  num.c4_single_page = capped.length
  log(`  C4  the short-read the coverage assertion exists to catch`)
  log(`      one unpaged select returns ${capped.length}; the server counts ${count}`)
  log(`      FIRED = ${capped.length < count}  (a probe without paging would have read ${(100 * capped.length / count).toFixed(1)}% of this table)`)
}

log('')
log('=== NUMBERS')
for (const [k, v] of Object.entries(num)) log(`  ${k} = ${v}`)

writeFileSync(OUT, L.join('\n') + '\n')
console.log(`\nwritten to ${OUT}`)
