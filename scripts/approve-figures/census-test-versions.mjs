// ── PHASE 0(b): WHOSE VERSIONS SIT ON WHICH RECORDS ─────────────────────
//
// The zero was found on a REAL record carrying a version authored by a walk
// account with the reason "test reason 2". So the question is not that record
// alone: it is whether test versions sit on records the business would call
// its own, across the whole estate.
//
// MEASURE AND REPORT ONLY. Disposal is John's ruling, not this round's action.
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const users = (await db.auth.admin.listUsers()).data.users
const email = Object.fromEntries(users.map((u) => [u.id, u.email]))

// WHO IS A REAL PERSON. Stated rather than inferred, because this is the line
// the whole census rests on and a wrong one would file a real version as test
// residue or the reverse.
const BUSINESS = new Set(['john@terminustechnologies.io', 'johnf.jnr@gmail.com'])
const kind = (e) => {
  if (!e) return 'unknown'
  if (BUSINESS.has(e)) return 'business'
  if (e.endsWith('@terminus-probe.invalid')) return 'probe'
  if (e.includes('+test')) return 'agent harness'
  if (e.includes('walk')) return 'walk account'
  return 'other'
}

const versions = must(await db.from('deal_sheet_versions')
  .select('id, record_id, major, minor, status, reason, created_by, created_by_email, created_at'), 'versions')
const recIds = [...new Set(versions.map((v) => v.record_id))]
// CHUNKED: a single `.in()` over every id builds a URL the server refuses, and
// the failure arrives as a bare "fetch failed" rather than as anything about
// length.
const recs = []
for (let i = 0; i < recIds.length; i += 50) {
  recs.push(...must(await db.from('records').select('id, reference_code, owner_id, deleted_at, status')
    .in('id', recIds.slice(i, i + 50)), 'records'))
}
const byId = Object.fromEntries(recs.map((r) => [r.id, r]))

console.log(`\n${versions.length} versions across ${recIds.length} records\n`)

console.log('── versions by AUTHOR ──')
const byAuthor = {}
for (const v of versions) {
  const e = v.created_by_email ?? email[v.created_by] ?? 'unknown'
  byAuthor[e] = (byAuthor[e] ?? 0) + 1
}
for (const [e, n] of Object.entries(byAuthor).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${e.padEnd(40)} ${kind(e)}`)
}

console.log('\n── versions by the RECORD OWNER they sit on ──')
const byOwner = {}
for (const v of versions) {
  const e = email[byId[v.record_id]?.owner_id] ?? 'unknown'
  byOwner[e] = (byOwner[e] ?? 0) + 1
}
for (const [e, n] of Object.entries(byOwner).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${e.padEnd(40)} ${kind(e)}`)
}

// THE ONE THAT MATTERS: a non-business author on a BUSINESS-owned record.
console.log('\n── NON-BUSINESS versions sitting on BUSINESS-OWNED records ──')
const crossed = versions.filter((v) => {
  const owner = email[byId[v.record_id]?.owner_id]
  const author = v.created_by_email ?? email[v.created_by]
  return BUSINESS.has(owner) && !BUSINESS.has(author)
})
if (!crossed.length) console.log('  none')
for (const v of crossed) {
  const r = byId[v.record_id]
  console.log(`  ${r.reference_code}  V${v.major}.${v.minor}/${v.status}  by ${v.created_by_email}  "${v.reason}"`)
}

// AND VERSIONS WHOSE REASON READS AS A TEST, whoever wrote them.
console.log('\n── versions whose REASON reads as a test, on any record ──')
const TESTY = /\btest\b|\bqwe|\basdf|\bfoo\b|\bbar\b|^\s*x+\s*$|\b1234\b/i
const testy = versions.filter((v) => TESTY.test(v.reason ?? ''))
if (!testy.length) console.log('  none')
for (const v of testy) {
  const r = byId[v.record_id]
  const owner = email[r?.owner_id] ?? 'unknown'
  console.log(`  ${r?.reference_code ?? '?'}  V${v.major}.${v.minor}/${v.status}  "${v.reason}"`)
  console.log(`      author ${v.created_by_email} (${kind(v.created_by_email)}), record owned by ${owner} (${kind(owner)})`)
}

console.log('\n── ISSUED versions, which are the ones an approval is held against ──')
for (const v of versions.filter((x) => x.status === 'issued')) {
  const r = byId[v.record_id]
  const owner = email[r?.owner_id] ?? 'unknown'
  console.log(`  ${r?.reference_code ?? '?'}  V${v.major}.${v.minor}  "${v.reason}"  by ${kind(v.created_by_email)}, record ${kind(owner)}`)
}
