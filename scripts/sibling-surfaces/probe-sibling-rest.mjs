// R6: the probe resumes to complete the table.
//
// Same rule as before: the OWNER run gates whether the non-owner result counts,
// two fixtures per path, and the refusal REASON is asserted rather than the
// status class. The stop rule stays armed for a NEW landing; the three already
// ruled under R5 are findings and are not re-run here.
import { api as apiCall } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `sib2-${process.argv[2] ?? 'r0'}`
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const db = admin()
const ROWS = []
const LANDED = []
const ownershipShaped = (r) => r.status === 403 || /belongs to another user|only its owner/i.test(JSON.stringify(r.data ?? {}))
const rnd = () => Math.random().toString(36).slice(2, 7)

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid').id
const industry = (await body('GET', '/industries'))[0]
// ACTIVE, filtered. The first run took the first row and drew a 422 'has been
// retired and cannot be assigned' - a refusal about the role, not ownership.
const roleId = (await db.from('contact_roles').select('id').eq('active', true).limit(1).single()).data.id

const mkAccount = async () => (await body('POST', '/accounts', { name: `${TAG}-${rnd()} Acct`, industry_id: industry.id, billingCountry: 'Singapore' })).id
const mkContact = async (accountId) => {
  const c = await body('POST', '/contacts', {
    jobRole: 'Head of Ops',
    name: `${TAG}-${rnd()} person`, company: `${TAG} Ltd`, email: `${TAG}-${rnd()}@example.invalid`,
    mobile: '+65 9000 0006', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  if (accountId) await body('POST', `/contacts/${c.id}/link-account`, { account_id: accountId })
  await db.from('records').update({ status: 'Qualified' }).eq('id', c.id)
  return c.id
}
const mkBed = async (accountId) => (await body('POST', '/test-beds', {
  name: `${TAG}-${rnd()} bed`, account_id: accountId, industry_id: industry.id,
  country_code: 'SG', client_organisation: `${TAG} Org`,
})).id
// mkContact returns the ID, not the record. The first run read c.id off a
// string and posted to /contacts/undefined/, which 404s - a NOT PROBED row that
// said nothing about the route.
const mkOpp = async () => { const a = await mkAccount(); const c = await mkContact(a)
  return (await body('POST', `/contacts/${c}/create-opportunity`, { name: `${TAG} opp ${rnd()}` })).id }
const hand = async (id) => { await db.from('records').update({ owner_id: OTHER }).eq('id', id) }

async function probe(name, build, attempt, expectMatch = 'owner-only') {
  let o = null, x = null, note = ''
  try {
    o = await attempt(await build())
    const f2 = await build()
    await hand(f2.handId ?? f2.id)
    if (f2.unitId) await hand(f2.unitId)
    x = await attempt(f2)
  } catch (e) { note = 'fixture error: ' + e.message.slice(0, 90) }
  const ownerOk = o && o.status >= 200 && o.status < 300
  let verdict, detail
  if (note) { verdict = 'NOT PROBED'; detail = note }
  else if (!ownerOk) { verdict = 'NOT PROBED'; detail = `owner run ${o?.status}: ${JSON.stringify(o?.data).slice(0, 80)}` }
  else if (x.status >= 200 && x.status < 300) {
    if (expectMatch === 'team') { verdict = 'MATCH (team-editable)'; detail = 'permitted by design, and now proven' }
    else { verdict = '*** NEW LANDING ***'; LANDED.push({ name, id: x.data?.id ?? '(none)', data: JSON.stringify(x.data).slice(0, 130) }); detail = `non-owner got ${x.status}` }
  } else if (expectMatch === 'team') { verdict = 'GAP vs the map'; detail = `the map says team-editable; got ${x.status}` }
  else if (!ownershipShaped(x)) { verdict = 'REFUSED, NOT ON OWNERSHIP'; detail = `${x.status} ${JSON.stringify(x.data).slice(0, 70)}` }
  else { verdict = 'MATCH'; detail = '' }
  ROWS.push({ name, owner: o?.status ?? '-', other: x?.status ?? '-', verdict, detail })
  console.log(`  ${verdict.padEnd(24)} ${name.padEnd(40)} owner ${String(o?.status ?? '-').padEnd(4)} non-owner ${String(x?.status ?? '-').padEnd(4)} ${detail}`)
}

console.log(`me ${ME}\nother ${OTHER}\n=== THE REMAINING PATHS`)

// PATCH /accounts/:id - corrected body. websiteUrl is in ACCOUNT_WRITABLE_KEYS.
await probe('PATCH /accounts/:id',
  async () => ({ id: await mkAccount() }),
  (f) => call('PATCH', `/accounts/${f.id}`, { payload: { websiteUrl: `https://example.invalid/${rnd()}` } }),
  'team')

// tech-team, past its precondition. installer_account_id is READ by routes and
// set by none, so it is written directly - Verification 47's clause, and the
// unsettability is itself reported.
await probe('POST /test-beds/:id/tech-team',
  async () => {
    const acc = await mkAccount(); const bed = await mkBed(acc)
    await db.from('records').update({ installer_account_id: acc }).eq('id', bed)
    return { id: bed, contact: await mkContact(acc) }
  },
  (f) => call('POST', `/test-beds/${f.id}/tech-team`, { contact_id: f.contact }))

// scores
await probe('POST /test-beds/:id/scores',
  async () => ({ id: await mkBed(await mkAccount()) }),
  (f) => call('POST', `/test-beds/${f.id}/scores`, // Read from scoring_criteria rather than guessed: the first run named a key
    // that is not a test_bed criterion and drew a 400 on both sides.
    // The key is `criterion`, not `criterion_key` - read from score-entry.js
    // rather than guessed a second time.
    // `score`, a whole number 1-5, not a level label. Read from the route's own
    // refusal rather than guessed a third time.
    { criterion: 'scoreClientCommitment', score: 4, reason: `${TAG} ${rnd()}` }))

// units/:unitId - a unit is derived first, as the system does.
await probe('PATCH /test-beds/:id/units/:unitId',
  async () => {
    const bed = await mkBed(await mkAccount())
    // safesightCameras is a real UNIT_TYPE_COUNT_KEY; sensorCount is not, so the
    // first run derived nothing and the row said nothing about the route.
    await call('PATCH', `/test-beds/${bed}`, { payload: { safesightCameras: 2 } })
    await call('POST', `/test-beds/${bed}/units/derive`, {})
    const { data: u } = await db.from('records').select('id').eq('parent_record_id', bed).eq('record_type', 'unit').limit(1).maybeSingle()
    // THE UNIT IS HANDED OVER WITH THE BED. Units are records in their own
    // right, owned by whoever derived them, so handing the bed alone left the
    // unit mine and records_update permitted the write CORRECTLY - the first
    // run read that as a landing and it was the fixture.
    return { id: bed, unit: u?.id, handId: bed, unitId: u?.id }
  },
  (f) => f.unit ? call('PATCH', `/test-beds/${f.id}/units/${f.unit}`, { state: 'Installed' })
                : { status: 0, data: { error: 'no unit was derived' } })

// key-contacts and its DELETE
// THE CONTACT MUST BE ON THE OPPORTUNITY'S OWN ACCOUNT. The route refuses 422
// "Contact is not linked to this Opportunity's Account" otherwise, which is a
// real rule and was refusing both sides of the first three runs.
const mkOppWithAccount = async () => {
  const acc = await mkAccount(); const c = await mkContact(acc)
  const opp = (await body('POST', `/contacts/${c}/create-opportunity`, { name: `${TAG} opp ${rnd()}` })).id
  return { opp, acc }
}
await probe('POST /opportunities/:id/key-contacts',
  async () => { const { opp, acc } = await mkOppWithAccount(); return { id: opp, contact: await mkContact(acc) } },
  (f) => call('POST', `/opportunities/${f.id}/key-contacts`, { contact_id: f.contact, role_id: roleId }))

await probe('DELETE /opportunities/:id/key-contacts/:linkId',
  async () => {
    const { opp, acc } = await mkOppWithAccount(); const c = await mkContact(acc)
    const link = await call('POST', `/opportunities/${opp}/key-contacts`, { contact_id: c, role_id: roleId })
    const { data: l } = await db.from('record_contacts').select('id').eq('record_id', opp).limit(1).maybeSingle()
    return { id: opp, link: l?.id, ok: link.status }
  },
  (f) => f.link ? // A body, because a bodyless DELETE through this client drew
    // FST_ERR_CTP_EMPTY_JSON_BODY on both sides.
    call('DELETE', `/opportunities/${f.id}/key-contacts/${f.link}`, {})
                : { status: 0, data: { error: 'no link was created' } })

console.log('\n=== RESULTS')
for (const r of ROWS) console.log(`  ${r.verdict.padEnd(24)} ${r.name.padEnd(40)} ${String(r.owner).padEnd(6)} ${r.other}`)
if (LANDED.length) {
  console.log('\n*** STOP: a NEW non-owner write landed ***')
  for (const l of LANDED) console.log(`    ${l.name}  id ${l.id}\n      ${l.data}`)
  process.exit(2)
}
console.log('\nno NEW non-owner write landed')
