// Phase 2: POST /contacts/:id/qualify, exercised over HTTP as the signed-in
// user on the SUCCESS path as well as the refusals. Verification 40: a gate
// made entirely of refusals is satisfied by a route that refuses everything.
import { api, ApiError } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'

const db = admin()
const TAG = 'p2route'
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}`); if (d) console.log(`        ${d}`) }
const attempt = async (m, p, b) => {
  try { const r = await api(m, p, b); return { ok: true, status: r.status, data: r.data } }
  catch (e) { if (e instanceof ApiError) return { ok: false, status: e.status, data: e.body }; throw e }
}

const OWNER = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))).user.id
const industry = must(await db.from('industries').select('id').limit(1), 'industry')[0]
const COMPLETE = {
  company: 'Route Co', jobRole: 'Head of Ops', email: `${TAG}@example.invalid`,
  mobile: '+65 9000 0111', source: 'Direct Outreach', linkedin: 'https://example.invalid/in/x',
  address: '1 Route Way', city: 'Singapore', postcode: '069118',
  country: 'Singapore', region: 'APAC', summary: 'complete',
}
const makeLead = async (label, payload = COMPLETE) => {
  const rec = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: OWNER,
    parent_record_id: null, industry_id: industry.id,
  }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({
    record_id: rec.id, revision_number: 1,
    payload: { ...payload, name: `${TAG} ${label}` }, created_by: OWNER,
  }).select().single(), `rev ${label}`)
  return rec
}
const state = async (id) => {
  const r = must(await db.from('records').select('status, parent_record_id').eq('id', id).single(), 'state')
  const accounts = must(await db.from('records').select('id').eq('record_type', 'account').is('deleted_at', null), 'accts')
  return { ...r, accounts: accounts.length }
}
const created = []
try {
  // 1. INCOMPLETE -> 422 carrying the SERVER'S blocking list
  const inc = await makeLead('incomplete', { company: 'X' }); created.push(inc.id)
  const r1 = await attempt('POST', `/contacts/${inc.id}/qualify`, { new_account_name: `${TAG} Never` })
  const names = (r1.data?.blocking ?? []).map((b) => b.field ?? b.label ?? JSON.stringify(b))
  check('an incomplete lead is refused 422 with the server\'s own blocking list',
    r1.status === 422 && names.length > 0,
    `HTTP ${r1.status}, ${names.length} blocking: ${names.slice(0, 6).join(', ')}...`)
  const after1 = await state(inc.id)
  check('and the refusal wrote nothing', after1.status === 'Unqualified' && after1.parent_record_id === null,
    JSON.stringify(after1))

  // 2. COMPLETE + create-new -> converts, ONE call
  const ok = await makeLead('complete'); created.push(ok.id)
  const before = await state(ok.id)
  const r2 = await attempt('POST', `/contacts/${ok.id}/qualify`,
    { new_account_name: `${TAG} New Account`, account_details: { billing: { country: 'Singapore' } } })
  const after2 = await state(ok.id)
  if (after2.parent_record_id) created.push(after2.parent_record_id)
  check('a complete lead qualifies, account created and linked',
    r2.status === 200 && after2.status === 'Qualified' && !!after2.parent_record_id
      && after2.accounts === before.accounts + 1,
    `HTTP ${r2.status} | ${before.status} -> ${after2.status}, accounts ${before.accounts} -> ${after2.accounts}, account ${after2.parent_record_id}`)
  check('the response carries what the function returned, not a fabricated body',
    r2.data?.account_created === true && r2.data?.status === 'Qualified' && !!r2.data?.revision_number,
    JSON.stringify(r2.data))

  // 3. COMPLETE + link-existing -> links, creates NO new account
  const ok2 = await makeLead('linkexisting'); created.push(ok2.id)
  const before3 = await state(ok2.id)
  const r3 = await attempt('POST', `/contacts/${ok2.id}/qualify`, { account_id: after2.parent_record_id })
  const after3 = await state(ok2.id)
  check('linking an EXISTING account creates no new one',
    r3.status === 200 && after3.parent_record_id === after2.parent_record_id
      && after3.accounts === before3.accounts,
    `HTTP ${r3.status} | accounts ${before3.accounts} -> ${after3.accounts}, linked ${after3.parent_record_id === after2.parent_record_id}`)

  // 4. Both or neither shape -> 400 before anything is touched
  const bad = await makeLead('badshape'); created.push(bad.id)
  const r4 = await attempt('POST', `/contacts/${bad.id}/qualify`, {})
  const r5 = await attempt('POST', `/contacts/${bad.id}/qualify`,
    { account_id: after2.parent_record_id, new_account_name: 'both' })
  check('neither shape and both shapes are each refused 400',
    r4.status === 400 && r5.status === 400, `neither: ${r4.status}, both: ${r5.status}`)

  // 5. ALREADY QUALIFIED -> refused
  const r6 = await attempt('POST', `/contacts/${ok.id}/qualify`, { new_account_name: 'again' })
  check('an already-Qualified lead is refused', r6.status >= 400,
    `HTTP ${r6.status} ${r6.data?.error ?? ''}`)
} finally {
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').is('deleted_at', null), 'sweep')
  const revs = must(await db.from('record_revisions').select('payload').in('record_id', live.map((r) => r.id)), 'revs')
  console.log(`\n  soft deleted ${created.length}; live ${TAG} remaining: ${revs.filter((r) => String(r.payload?.name ?? '').startsWith(TAG)).length}`)
}
const f = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - f.length}/${results.length} checks pass`)
process.exit(f.length ? 1 : 0)
