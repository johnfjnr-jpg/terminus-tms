// create_opportunity_from_contact: the second function's own proofs.
//
// The Phase 1 probe exercised convert_test_bed only. Ruling 7 asks that BOTH
// functions be verified to resolve, and a function that resolves is not a
// function that works: the contact path has FIVE inserts rather than four, and
// the fifth - the record_contacts link - carries a constraint written for
// something else (record_contacts_one_role_source, num_nonnulls(role, role_id,
// role_other) = 1). Verification 46: a new writer inherits every guard already
// on the table.
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `ctfn-${process.argv[2] ?? 'run'}`
const R = []
const check = (name, pass, detail = '') => {
  R.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`)
}

const ENV = Object.fromEntries(readFileSync('.env', 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const SESSION = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const asUser = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SESSION.access_token}` } },
})
const asAnon = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } })

const PAYLOAD = { name: `${TAG} deal`, company_name: `${TAG} Holdings`, customerLead: `${TAG} person` }

// Everything the five inserts touch, counted for one opportunity id.
async function rowsFor(oppId) {
  const db = admin()
  const one = async (t, col, val) => ((await db.from(t).select(col, { count: 'exact', head: true }).eq(col, val)).count ?? 0)
  return {
    record: oppId ? (await db.from('records').select('id', { count: 'exact', head: true }).eq('id', oppId)).count ?? 0 : 0,
    revisions: oppId ? await one('record_revisions', 'record_id', oppId) : 0,
    details: oppId ? await one('opportunity_details', 'record_id', oppId) : 0,
    links: oppId ? await one('record_contacts', 'record_id', oppId) : 0,
    audits: oppId ? await one('audit_log', 'record_id', oppId) : 0,
  }
}
const countFor = async (contactId) =>
  (await admin().from('audit_log').select('id', { count: 'exact', head: true })
    .eq('record_id', contactId).eq('action', 'created_opportunity')).count ?? 0

try {
  // Resolve check first, and STOP rather than score if it is absent.
  const probe = await asUser().rpc('create_opportunity_from_contact', {
    p_contact_id: '00000000-0000-0000-0000-000000000000',
    p_payload: {}, p_reference_code: null, p_probability_pct: null,
  })
  if (probe.error?.code === 'PGRST202') {
    console.log('\nSTOP: public.create_opportunity_from_contact does not resolve.')
    process.exit(3)
  }
  check('1. the function resolves, and an unknown contact raises PT404',
    probe.error?.code === 'PT404', `${probe.error?.code} ${probe.error?.message}`)

  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account`, industry_id: industry.id, billingCountry: 'Singapore',
  })
  const contact = await body('POST', '/contacts', {
    jobRole: 'Head of Ops',
    name: `${TAG} person`, company: `${TAG} Holdings`, email: `${TAG}@example.invalid`,
    mobile: '+65 9000 0000', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  await body('POST', `/contacts/${contact.id}/link-account`, { account_id: account.id })

  // ── RLS, THE SAME CONTRAST THE CONVERT PROBE USES ──────────────────────
  // RLS on and no identity: stopped at the read. RLS bypassed: past the read,
  // dead at the first insert on owner_id NOT NULL. The delta is RLS.
  const anon = await asAnon().rpc('create_opportunity_from_contact', {
    p_contact_id: contact.id, p_payload: PAYLOAD, p_reference_code: null, p_probability_pct: null,
  })
  const bypass = await admin().rpc('create_opportunity_from_contact', {
    p_contact_id: contact.id, p_payload: PAYLOAD, p_reference_code: null, p_probability_pct: null,
  })
  check('2a. an unidentified caller under RLS is stopped at the READ',
    anon.error?.code === 'PT404', `${anon.error?.code}`)
  check('2b. with RLS BYPASSED the same call reaches the first INSERT and dies there',
    bypass.error?.code === '23502', `${bypass.error?.code} ${bypass.error?.message?.slice(0, 60)}`)
  check('2c. DISCRIMINATES: different stages, so the delta between them is RLS',
    anon.error?.code !== bypass.error?.code, `${anon.error?.code} vs ${bypass.error?.code}`)
  check('2d. and neither wrote an audit row on the contact', (await countFor(contact.id)) === 0,
    `${await countFor(contact.id)} created_opportunity rows`)

  // ── ATOMICITY at insert 3, after TWO have been written ─────────────────
  const before = await countFor(contact.id)
  const bad = await asUser().rpc('create_opportunity_from_contact', {
    p_contact_id: contact.id, p_payload: PAYLOAD, p_reference_code: null, p_probability_pct: 999,
  })
  check('3a. a failure at insert 3 raises', bad.error?.code === '23514',
    `${bad.error?.code} ${bad.error?.message?.slice(0, 60)}`)
  check('3b. ATOMICITY: no audit row was written and no opportunity survived',
    (await countFor(contact.id)) === before, `${await countFor(contact.id)} vs ${before}`)

  // ── THE SUCCESS PATH: ALL FIVE INSERTS ─────────────────────────────────
  const ok = await asUser().rpc('create_opportunity_from_contact', {
    p_contact_id: contact.id, p_payload: PAYLOAD, p_reference_code: 'TT-XX-PROBE-001', p_probability_pct: 10,
  })
  check('4. RLS UNDER INVOKER: an ordinary caller creates the Opportunity',
    !ok.error && !!ok.data?.id, ok.error ? `${ok.error.code} ${ok.error.message}` : ok.data?.id)
  const rows = await rowsFor(ok.data?.id)
  check('5. ALL FIVE inserts landed, including the record_contacts link',
    rows.record === 1 && rows.revisions === 1 && rows.details === 1 && rows.links === 1 && rows.audits === 1,
    JSON.stringify(rows))

  // The link's shape, because record_contacts_one_role_source is a constraint
  // written for a different purpose that this insert inherits.
  const { data: link } = await admin().from('record_contacts')
    .select('contact_id, role, role_id, role_other, created_by').eq('record_id', ok.data.id).single()
  check('6. the link is the shape linkContact writes, satisfying one_role_source',
    link?.role === 'commercial buyer' && link.role_id === null && link.role_other === null
    && link.contact_id === contact.id && link.created_by === SESSION.user.id,
    JSON.stringify(link))

  // The account carried from the contact's own parent_record_id, derived
  // inside rather than accepted (Architecture rule 12).
  const { data: opp } = await admin().from('records')
    .select('account_id, reference_code, owner_id, status').eq('id', ok.data.id).single()
  check('7. account_id is DERIVED from the contact, not passed by the caller',
    opp?.account_id === account.id, `${opp?.account_id} vs ${account.id}`)
  check('8. reference_code IS a parameter, because issuing one increments a counter',
    opp?.reference_code === 'TT-XX-PROBE-001', opp?.reference_code)
  check('9. owner is the caller and the stage is Qualification',
    opp?.owner_id === SESSION.user.id && opp?.status === 'Qualification',
    `${opp?.owner_id === SESSION.user.id} ${opp?.status}`)

  // Both audit rows, one on each record.
  const { data: auds } = await admin().from('audit_log')
    .select('record_id, record_type, action').in('record_id', [contact.id, ok.data.id])
  const actions = (auds ?? []).map((a) => `${a.record_type}:${a.action}`).sort()
  check('10. both audit rows were written, one on each record',
    actions.includes('contact:created_opportunity') && actions.includes('opportunity:created_from_contact'),
    JSON.stringify(actions))
} catch (e) {
  check('99. the probe ran to completion', false, e.message)
} finally {
  await tearDown()
  const { data: left } = await admin().from('records').select('id')
    .eq('owner_id', SESSION.user.id).is('deleted_at', null)
  console.log(`\nRESIDUE live records owned by the test account: ${left?.length ?? '?'}`)
  check('11. teardown leaves nothing live', (left?.length ?? -1) === 0, `${left?.length}`)
}

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
process.exit(pass === R.length ? 0 : 1)
