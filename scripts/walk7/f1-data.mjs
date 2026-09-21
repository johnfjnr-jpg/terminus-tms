import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const opps = must(await db.from('records').select('id, reference_code, account_id, status')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
const contacts = must(await db.from('records').select('id, reference_code, parent_record_id, status')
  .eq('record_type', 'contact').is('deleted_at', null).limit(500), 'contacts')

const byAccount = {}
for (const c of contacts) if (c.parent_record_id) (byAccount[c.parent_record_id] ??= []).push(c)

console.log(`live opportunities: ${opps.length}`)
console.log(`live contacts: ${contacts.length}, of which carrying an account: ${contacts.filter(c => c.parent_record_id).length}`)
console.log(`accounts holding at least one contact: ${Object.keys(byAccount).length}`)

const withAcc = opps.filter(o => o.account_id)
console.log(`\nopportunities carrying an account_id: ${withAcc.length} of ${opps.length}`)
const usable = withAcc.filter(o => (byAccount[o.account_id] ?? []).length > 0)
console.log(`opportunities whose ACCOUNT HAS CONTACTS: ${usable.length}`)
for (const o of usable.slice(0, 6)) {
  console.log(`  ${o.reference_code}  ${o.status.padEnd(20)}  account ${o.account_id}  -> ${byAccount[o.account_id].length} contacts`)
}
if (usable[0]) console.log(`\nPICK: ${usable[0].id}  ${usable[0].reference_code}  account ${usable[0].account_id}  expects ${byAccount[usable[0].account_id].length} contacts`)
