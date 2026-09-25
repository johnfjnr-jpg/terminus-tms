import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } })
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
for (const t of ['record_revisions', 'records', 'deal_sheet_versions']) {
  const d = must(await db.from(t).select('*').limit(1), t)
  console.log(`${t}:`, Object.keys(d[0] ?? {}).join(', '))
}
