// R9: document_details, proven live in both directions.
//
// It was the one GAP in the entitlement map with no live proof - closed on a
// source reading of `record_id IN (SELECT id FROM public.records)`, which is
// satisfied by every row for every authenticated caller because records_select
// has been team-wide since 20260812000004. Ruled: it does not ship on that.
//
// THE ROUTE IS THE REAL ONE. POST /test-beds/:id/complete-document finds or
// creates the document record for a (bed, document_type) pair and upserts
// document_details with the location. Called twice: once while the document
// record is mine, once after it has been handed to somebody else.
//
// `approve: false` on the second call is deliberate and load-bearing. With
// approve true the route first UPDATEs the document record's status, which
// records_update refuses on its own - and the run would then prove
// records_update rather than document_details. Verification 14: the refusal
// has to be the one the claim is about.
import { api as apiCall } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const TAG = `wadoc-${process.argv[2] ?? 'r1'}`
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const db = admin()
const R = []
const check = (n, pass, d = '') => { R.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}${d ? '  -> ' + d : ''}`) }
const ownershipShaped = (r) => r.status === 403 || /belongs to another user|only its owner/i.test(JSON.stringify(r.data ?? {}))

try {
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const other = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id

  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', { name: `${TAG} Acct`, industry_id: industry.id, billingCountry: 'Singapore' })
  const bed = await body('POST', '/test-beds', {
    name: `${TAG} bed`, account_id: account.id, industry_id: industry.id,
    country_code: 'SG', client_organisation: `${TAG} Org`,
  })

  // ── DIRECTION ONE: the owner's write must succeed ──────────────────────
  const first = await call('POST', `/test-beds/${bed.id}/complete-document`,
    { document_type: `${TAG}-doc`, document_location: 'https://example.invalid/one', approve: false })
  check('1. the OWNER may write document_details', first.status >= 200 && first.status < 300, `${first.status}`)

  const { data: doc } = await db.from('records').select('id, owner_id, variant')
    .eq('parent_record_id', bed.id).eq('record_type', 'document').eq('variant', `${TAG}-doc`).single()
  const { data: det } = await db.from('document_details').select('record_id, document_location')
    .eq('record_id', doc.id).maybeSingle()
  check('2. and the row is there, with the location', det?.document_location === 'https://example.invalid/one',
    JSON.stringify(det?.document_location))
  check('3. the document record is mine at this point', doc.owner_id === ME, `owner ${doc.owner_id}`)

  // ── DIRECTION TWO: hand the DOCUMENT record over, write again ──────────
  await db.from('records').update({ owner_id: other }).eq('id', doc.id)
  const { data: after } = await db.from('records').select('owner_id').eq('id', doc.id).single()
  check('4. the document record now belongs to somebody else', after.owner_id === other, `owner ${after.owner_id}`)

  const second = await call('POST', `/test-beds/${bed.id}/complete-document`,
    { document_type: `${TAG}-doc`, document_location: 'https://example.invalid/TWO-must-be-refused', approve: false })
  const { data: detAfter } = await db.from('document_details').select('document_location').eq('record_id', doc.id).maybeSingle()
  console.log(`    write as NON-OWNER -> ${second.status}  ${JSON.stringify(second.data).slice(0, 120)}`)
  check('5. the NON-OWNER write is refused', second.status >= 400, `${second.status}`)
  check('6. and refused ON OWNERSHIP, not by some other precondition', ownershipShaped(second),
    JSON.stringify(second.data).slice(0, 100))
  check('7. and the stored location did not change', detAfter?.document_location === 'https://example.invalid/one',
    JSON.stringify(detAfter?.document_location))
} catch (e) {
  check('99. the probe ran to completion', false, e.message)
}
const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
process.exit(pass === R.length ? 0 : 1)
