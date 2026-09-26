import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const recs = must(await db.from('records').select('id, reference_code')
  .in('reference_code', ['TT-SGP-MANUFI-005', 'TT-SGP-SMARTC-003']), 'records')
for (const r of recs) {
  const revs = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', r.id).order('revision_number', { ascending: false }).limit(1), 'revs')
  const p = revs[0].payload
  console.log(`\n${r.reference_code}  rev ${revs[0].revision_number}`)
  for (const k of ['ssExisting','ssNew','aqm','hemir','duration','targetMargin','warrantyPct',
    'structure','paymentMode','installResp','lumpCost','priceOverrides','marginOverrides']) {
    if (k in p) console.log(`   ${k.padEnd(16)} ${JSON.stringify(p[k])}`)
  }
  console.log(`   all keys: ${Object.keys(p).sort().join(', ')}`)
}
