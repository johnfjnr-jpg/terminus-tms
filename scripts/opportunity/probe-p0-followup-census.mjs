// Q2: does any Opportunity carry a follow-up task today?
//
// V8: every read destructures `error` and THROWS. No `?? []` anywhere, because
// a null wearing a default prints as a zero that reads like a measurement.
//
// V17's paged-API clause, and it fired on this probe's OWN first run: the
// first version read `.select()` with no range and printed "1000 total", which
// is exactly PostgREST's default cap and therefore a truncated page rather
// than a count. The coverage claim is now an ASSERTION rather than a property
// of how the query happens to be written: take the EXACT count first, then
// require the rows walked to equal it.
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const exactCount = async (build) => {
  const r = await build(db.from('records').select('id', { count: 'exact', head: true }))
  if (r.error) throw new Error(`count: ${r.error.message}`)
  return r.count
}
const pagedSelect = async (build, total, what) => {
  const rows = []
  for (let from = 0; from < total; from += 1000) {
    rows.push(...must(await build(db.from('records').select('id, status, deleted_at')).range(from, from + 999), what))
  }
  if (rows.length !== total) throw new Error(`${what}: walked ${rows.length} of ${total}, so a clean result would mean nothing`)
  return rows
}

const liveOf = (t) => (q) => q.eq('record_type', t).is('deleted_at', null)

const oppTotal = await exactCount((q) => q.eq('record_type', 'opportunity'))
const oppLive = await exactCount(liveOf('opportunity'))
console.log(`opportunity records: ${oppTotal} total, ${oppLive} live, ${oppTotal - oppLive} soft-deleted`)

const live = await pagedSelect(liveOf('opportunity'), oppLive, 'live opportunities')
console.log(`  scan examined ${live.length} of ${oppLive}, asserted equal`)

const latestPayload = async (id) => {
  const rev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), `revision ${id}`)
  return rev.length ? (rev[0].payload || {}) : null
}

let withDate = 0, withDesc = 0, noRevision = 0
for (const r of live) {
  const p = await latestPayload(r.id)
  if (p === null) { noRevision++; continue }
  if (p.followUpDate) withDate++
  if (p.followUpDescription) withDesc++
}
console.log(`  followUpDate present:        ${withDate}`)
console.log(`  followUpDescription present: ${withDesc}`)
console.log(`  live records with no revision at all: ${noRevision}`)

// CALIBRATION (V13): the same reader, on the record type that DOES carry the
// keys. A zero from an instrument never shown reaching one is not a measurement.
const cLive = await exactCount(liveOf('contact'))
const contacts = await pagedSelect(liveOf('contact'), cLive, 'live contacts')
let cDate = 0
for (const r of contacts) { const p = await latestPayload(r.id); if (p && p.followUpDate) cDate++ }
console.log(`\nCALIBRATION on contacts, the type that uses the keys:`)
console.log(`  live contacts walked: ${contacts.length} of ${cLive};  followUpDate present: ${cDate}`)
console.log(cDate > 0
  ? '  the reader CAN see a follow-up, so the opportunity zero is a measurement'
  : '  WARNING: the reader has never returned non-zero, so the zero above means nothing')
