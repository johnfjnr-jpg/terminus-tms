import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const opps = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
const ids = opps.map((o) => o.id)
const links = must(await db.from('record_contacts').select('record_id').in('record_id', ids), 'links')
const by = {}
for (const l of links) by[l.record_id] = (by[l.record_id] ?? 0) + 1
const best = Object.entries(by).sort((a, b) => b[1] - a[1])[0]
console.log(`opportunities carrying key contacts: ${Object.keys(by).length}`)
if (best) console.log(`most linked: ${opps.find((o) => o.id === best[0])?.reference_code} ${best[0]} -> ${best[1]} link(s)`)
