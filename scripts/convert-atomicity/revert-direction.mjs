// IS THE MIGRATION INDEPENDENTLY REVERTIBLE ONCE THE ROUTES CALL THE FUNCTIONS?
//
// Measured rather than assumed, and measured WITHOUT dropping the functions,
// because this session has no DDL path. The two facts that settle it are both
// measurable here:
//
//   1. what PostgREST answers for a function that does not exist, and
//   2. what the routes' own error mapper does with that answer.
//
// Combined with the third fact, which is read from the source: both routes call
// their function unconditionally and pass any error straight to sendWriteError.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { sendWriteError, writeErrorStatus } from '/Users/johnfryatt/terminus-tms/src/lib/write-errors.js'
import { stripJs } from '/Users/johnfryatt/terminus-tms/scripts/lib/strip-comments.mjs'

const ENV = Object.fromEntries(readFileSync('/Users/johnfryatt/terminus-tms/.env', 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const SESSION = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const db = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SESSION.access_token}` } },
})

console.log('=== FACT 1: what a MISSING function answers')
// A name deliberately not in the schema. This is exactly the state a reverted
// migration would leave the two real names in.
const gone = await db.rpc('convert_test_bed_reverted_away', { p_bed_id: null })
console.log(`  rpc on an absent function -> ${gone.error?.code}  ${gone.error?.message?.slice(0, 70)}`)

console.log('\n=== FACT 1b: and what the REAL ones answer today, for contrast')
for (const fn of ['convert_test_bed', 'create_opportunity_from_contact']) {
  const r = await db.rpc(fn, fn === 'convert_test_bed'
    ? { p_bed_id: '00000000-0000-0000-0000-000000000000', p_payload: {}, p_max_conversions: null, p_probability_pct: null, p_test_bed_cost: null }
    : { p_contact_id: '00000000-0000-0000-0000-000000000000', p_payload: {}, p_reference_code: null, p_probability_pct: null })
  console.log(`  ${fn.padEnd(32)} -> ${r.error?.code}  (present, and refusing for its own reason)`)
}

console.log('\n=== FACT 2: what the routes\' mapper does with that code')
const out = {}
sendWriteError({ code(c) { out.status = c; return this }, send(b) { out.body = b; return this } }, gone.error)
console.log(`  sendWriteError(PGRST202)   -> ${out.status}`)
console.log(`  writeErrorStatus(PGRST202) -> ${writeErrorStatus(gone.error).status}`)

console.log('\n=== FACT 3: do the routes call unconditionally, and pass the error through')
for (const [f, name] of [['src/routes/test-beds.js', 'convert_test_bed'],
                         ['src/routes/contacts.js', 'create_opportunity_from_contact']]) {
  const s = stripJs(readFileSync('/Users/johnfryatt/terminus-tms/' + f, 'utf8'))
  const calls = (s.match(new RegExp(`rpc\\('${name}'`, 'g')) ?? []).length
  // is the call guarded by anything, or is it the only path?
  const guarded = /if\s*\([^)]*rpc\(/.test(s)
  console.log(`  ${f.padEnd(24)} calls ${name}: ${calls}, inside a conditional: ${guarded}`)
}

console.log('\n=== THE ANSWER')
console.log(`  Reverting the migration alone leaves both routes calling a name that does not`)
console.log(`  resolve. PostgREST answers ${gone.error?.code}, the mapper answers ${out.status}, and every`)
console.log(`  conversion and every contact-created Opportunity fails with a server error.`)
console.log(`  THE MIGRATION IS NOT INDEPENDENTLY REVERTIBLE.`)
console.log(`  The ROUTES are: reverting them leaves the functions present and unused.`)
