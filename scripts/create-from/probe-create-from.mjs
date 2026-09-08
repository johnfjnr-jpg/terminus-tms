// PHASE 0 ITEM 2: the unexercised create-from instances, probed as a non-owner.
//
// Same discipline as the probe round: two fixtures per path, the OWNER run
// gates whether the non-owner result counts, and the refusal REASON is asserted
// rather than the status class.
//
// STOP RULE: a landing INSIDE the create-from shape is a finding recorded with
// its id. A landing OUTSIDE the shape would be a different defect and is a stop.
import { api as apiCall } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `cf-${process.argv[2] ?? 'r0'}`
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const db = admin()
const rnd = () => Math.random().toString(36).slice(2, 7)
const ROWS = []
const FINDINGS = []
const own = (r) => r.status === 403 || /belongs to another user|only its owner/i.test(JSON.stringify(r.data ?? {}))

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid').id
const industry = (await body('GET', '/industries'))[0]
const mkAccount = async () => (await body('POST', '/accounts', { name: `${TAG}-${rnd()} Acct`, industry_id: industry.id, billingCountry: 'Singapore' })).id
const mkBed = async () => (await body('POST', '/test-beds', {
  name: `${TAG}-${rnd()} bed`, account_id: await mkAccount(), industry_id: industry.id,
  country_code: 'SG', client_organisation: `${TAG} Org`,
})).id
const hand = async (id) => { await db.from('records').update({ owner_id: OTHER }).eq('id', id) }

async function probe(name, build, attempt, countNew) {
  let o = null, x = null, note = '', created = null
  try {
    o = await attempt(await build())
    const f = await build()
    await hand(f.id)
    const before = await countNew(f)
    x = await attempt(f)
    const after = await countNew(f)
    created = after - before
  } catch (e) { note = 'fixture error: ' + e.message.slice(0, 90) }
  const ownerOk = o && o.status >= 200 && o.status < 300
  let verdict
  if (note) verdict = `NOT PROBED (${note})`
  else if (!ownerOk) verdict = `NOT PROBED (owner ${o?.status}: ${JSON.stringify(o?.data).slice(0, 70)})`
  else if (created > 0 || (x.status >= 200 && x.status < 300)) {
    verdict = 'LANDED (create-from: a finding, in scope)'
    FINDINGS.push({ name, id: x.data?.id ?? '(no id)', created, data: JSON.stringify(x.data).slice(0, 120) })
  } else if (!own(x)) verdict = `REFUSED, NOT ON OWNERSHIP (${x.status})`
  else verdict = 'MATCH'
  ROWS.push({ name, o: o?.status ?? '-', x: x?.status ?? '-', created, verdict })
  console.log(`  ${verdict.padEnd(44)} ${name.padEnd(40)} owner ${String(o?.status ?? '-').padEnd(4)} non-owner ${String(x?.status ?? '-').padEnd(4)} new rows ${created ?? '-'}`)
}

const docsOn = async (f) => (await db.from('records').select('id', { count: 'exact', head: true })
  .eq('parent_record_id', f.id).eq('record_type', 'document')).count ?? 0
const unitsOn = async (f) => (await db.from('records').select('id', { count: 'exact', head: true })
  .eq('parent_record_id', f.id).eq('record_type', 'unit')).count ?? 0

console.log(`me ${ME}\nother ${OTHER}\n=== THE UNEXERCISED CREATE-FROM INSTANCES`)

await probe('POST /test-beds/:id/customer-documents',
  async () => ({ id: await mkBed() }),
  (f) => call('POST', `/test-beds/${f.id}/customer-documents`, { name: `${TAG} doc ${rnd()}`, url: `https://example.invalid/${rnd()}` }),
  docsOn)

await probe('POST /test-beds/:id/complete-document',
  async () => ({ id: await mkBed() }),
  (f) => call('POST', `/test-beds/${f.id}/complete-document`, { document_type: `${TAG}-${rnd()}`, document_location: `https://example.invalid/${rnd()}`, approve: false }),
  docsOn)

await probe('POST /test-beds/:id/units/derive',
  async () => { const b = await mkBed(); await call('PATCH', `/test-beds/${b}`, { payload: { safesightCameras: 2 } }); return { id: b } },
  (f) => call('POST', `/test-beds/${f.id}/units/derive`, {}),
  unitsOn)

console.log('\n=== RESULTS')
for (const r of ROWS) console.log(`  ${r.verdict.padEnd(44)} ${r.name.padEnd(40)} ${r.o} / ${r.x}`)
if (FINDINGS.length) {
  console.log('\n=== LANDINGS INSIDE THE CREATE-FROM SHAPE (findings, recorded)')
  for (const f of FINDINGS) console.log(`    ${f.name}\n      id ${f.id}   new rows on the source: ${f.created}\n      ${f.data}`)
}
