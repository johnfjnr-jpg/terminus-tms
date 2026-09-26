import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
// BOUNDED. An unbounded select takes PostgREST's first 1,000 rows and says
// nothing about it, and the estate's guard refused this file for exactly that.
// Two reference codes cannot return more than two rows, so the bound is the
// claim rather than a ceiling: a third row would be a finding.
const recs = must(await db.from('records').select('id, reference_code, owner_id, status')
  .in('reference_code', ['TT-SGP-MANUFI-005', 'TT-SGP-SMARTC-003']).limit(2), 'records')
if (recs.length !== 2) throw new Error(`expected exactly 2 records, got ${recs.length}`)
for (const r of recs) {
  // Bounded, and the bound is asserted rather than assumed: if a record ever
  // carries more than 50 transition requests the count is the finding.
  const tr = must(await db.from('transition_requests').select('id, status, from_stage, to_stage')
    .eq('record_id', r.id).limit(50), 'transition_requests')
  if (tr.length === 50) throw new Error(`${r.reference_code} hit the 50-row bound, so the scan may be partial`)
  const open = tr.filter((t) => !['approved', 'rejected', 'withdrawn', 'closed'].includes(t.status))
  const revs = must(await db.from('record_revisions').select('revision_number, created_by, created_at')
    .eq('record_id', r.id).order('revision_number', { ascending: false }).limit(3), 'revs')
  console.log(`\n${r.reference_code}  owner ${r.owner_id}  status ${r.status}`)
  console.log(`   transition requests: ${tr.length} total, statuses [${[...new Set(tr.map((t) => t.status))].join(', ')}]`)
  console.log(`   OPEN (would freeze): ${open.length}`)
  console.log('   last 3 revisions:')
  for (const v of revs) console.log(`      rev ${v.revision_number}  by ${v.created_by}  ${v.created_at}`)
}
// who are the real accounts?
const ids = [...new Set(recs.map((r) => r.owner_id))]
const { data: users, error } = await db.auth.admin.listUsers()
if (error) console.log('listUsers error:', error.message)
else {
  console.log('\n── auth.users ──')
  for (const u of users.users) console.log(`   ${u.id}  ${u.email}`)
}
console.log('\nowners in play:', ids.join(', '))
