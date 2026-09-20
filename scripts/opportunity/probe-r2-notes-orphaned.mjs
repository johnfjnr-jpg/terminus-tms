// R2, second finding: is there NOTES DATA on opportunities that no surface
// renders since the retirement?
//
// `opportunity-reference.js` wrote `ref-notes-list`. That markup now sits inside
// the retired `#ref-vanilla` block, and no React card replaced it: ReferencePanel
// renders five cards and none is Notes. So the CAPABILITY died with the file,
// which a census of what renders cannot see, because what renders is correct.
//
// V8: every read destructures `error` and throws.
// V17: the scan asserts it walked the whole population rather than assuming it.
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const exact = async (t) => {
  const r = await db.from('records').select('id', { count: 'exact', head: true })
    .eq('record_type', t).is('deleted_at', null)
  if (r.error) throw new Error(r.error.message)
  return r.count
}
const walk = async (t, total) => {
  const rows = []
  for (let from = 0; from < total; from += 1000) {
    rows.push(...must(await db.from('records').select('id')
      .eq('record_type', t).is('deleted_at', null).range(from, from + 999), t))
  }
  if (rows.length !== total) throw new Error(`walked ${rows.length} of ${total}, so a clean result would mean nothing`)
  return rows
}
const latest = async (id) => {
  const r = must(await db.from('record_revisions').select('payload')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'rev')
  return r.length ? (r[0].payload || {}) : null
}

for (const type of ['opportunity', 'contact', 'test_bed']) {
  const total = await exact(type)
  const rows = await walk(type, total)
  let withNotes = 0, entries = 0
  for (const r of rows) {
    const p = await latest(r.id)
    const n = p?.notes
    if (Array.isArray(n) && n.length) { withNotes++; entries += n.length }
  }
  console.log(`${type.padEnd(12)} live ${String(total).padStart(3)}  walked ${String(rows.length).padStart(3)}  carrying notes: ${String(withNotes).padStart(3)}  total entries: ${entries}`)
}
console.log('\nThe contact and test_bed figures are the CALIBRATION: both render a')
console.log('Notes History today, so a non-zero there is what gives the opportunity')
console.log('number its meaning, whichever way it falls.')
