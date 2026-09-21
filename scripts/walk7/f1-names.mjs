import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const cs = must(await db.from('records').select('id, reference_code, payload:record_revisions(payload)')
  .eq('record_type', 'contact').is('deleted_at', null).limit(500), 'contacts')
console.log(`live contacts: ${cs.length}`)
