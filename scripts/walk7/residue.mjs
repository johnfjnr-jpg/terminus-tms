// Residue by OWNER rather than by tag (V11): a browser-driven fixture leaves
// an ordinary record owned by an account that is neither a probe user nor the
// business, so a tag sweep cannot see it. Exact count first, then assert the
// scan walked all of it (V17).
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const { count: total } = await db.from('records').select('id', { count: 'exact', head: true }).is('deleted_at', null)
let rows = [], from = 0
for (;;) {
  const page = must(await db.from('records').select('id, record_type, reference_code, owner_id, created_at')
    .is('deleted_at', null).order('id').range(from, from + 999), 'records')
  rows = rows.concat(page); if (page.length < 1000) break; from += 1000
}
if (rows.length !== total) throw new Error(`scan saw ${rows.length} of ${total}; a clean result would mean nothing`)
console.log(`live records: ${rows.length} of ${total} walked`)
const { data: us } = await db.auth.admin.listUsers()
const email = Object.fromEntries((us?.users ?? []).map((u) => [u.id, u.email]))
const byOwner = {}
for (const r of rows) byOwner[r.owner_id] = (byOwner[r.owner_id] ?? 0) + 1
console.log('\nby owner:')
for (const [o, n] of Object.entries(byOwner).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${email[o] ?? '(not an auth user)'}`)
}
const cut = new Date(Date.now() - 5 * 3600 * 1000).toISOString()
const recent = rows.filter((r) => r.created_at > cut)
console.log(`\nlive records created in the last five hours: ${recent.length}`)
for (const r of recent) console.log(`  ${r.record_type}  ${r.reference_code}  ${email[r.owner_id] ?? r.owner_id}  ${r.created_at}`)
