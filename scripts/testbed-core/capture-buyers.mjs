// ── ROUND A PHASE 3: THE BUYER-LINK RESPONSES, CAPTURED FROM THE ROUTES ──
//
// The buyer rows' tests are driven only by what this writes, built the way the
// system builds the state, against tagged fixtures:
//   bedBefore        GET /test-beds/:id with no buyer linked
//   contacts         GET /contacts, FILTERED to this run's own fixture contacts
//                    (the list holds the business's contacts too, and none of
//                    theirs may reach a committed file)
//   linked           POST /test-beds/:id/buyer-contacts, a contact of the bed's
//                    own Account: the real 201 body
//   bedAfter         GET /test-beds/:id with that role linked
//   refusals         real bodies: a contact of ANOTHER Account (422), a contact
//                    deleted through its own route (404), and a second link to
//                    a role already linked
//
// UNWIRED: it writes a fixture file.
// Run: node --env-file=.env scripts/testbed-core/capture-buyers.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const OUT = `${ROOT}/frontend-react/src/__tests__/fixtures/buyers-live.json`
const TAG = `TBCORE-P3CAP-${Date.now()}`
const why = 'captured as a real refusal body for the buyer-link tests'

const contact = async (label, accountId) => {
  const industry = (await api('GET', '/industries')).data[0].id
  const c = (await api('POST', '/contacts', {
    name: `${TAG} ${label}`, company: `${TAG} Holdings`, email: `${TAG.toLowerCase()}-${label.toLowerCase()}@example.invalid`,
    mobile: '+65 9000 0001', industry_id: industry, source: 'Direct Outreach', jobRole: 'Head of Infrastructure',
    city: 'Singapore', country: 'Singapore', region: 'Asia Pacific',
  })).data
  await api('POST', `/contacts/${c.id}/link-account`, { account_id: accountId })
  return c.id
}

const out = { source: 'scripts/testbed-core/capture-buyers.mjs', capturedAt: new Date().toISOString(), refusals: {} }
try {
  const fx = await freshTestBed(TAG)
  const industry = (await api('GET', '/industries')).data[0].id
  const other = (await api('POST', '/accounts', { name: `${TAG} Other Account`, industry_id: industry, billingCountry: 'Singapore' })).data
  const own1 = await contact('Alpha', fx.accountId)
  const own2 = await contact('Bravo', fx.accountId)
  const foreign = await contact('Foreign', other.id)
  const gone = await contact('Gone', fx.accountId)

  out.bedBefore = (await api('GET', `/test-beds/${fx.bedId}`)).data
  const del = await api('DELETE', `/contacts/${gone}`, {})
  const all = (await api('GET', '/contacts')).data
  out.contacts = all.filter((c) => [own1, own2, foreign].includes(c.id))
  const role = 'Client Commercial Buyer'
  const linked = await api('POST', `/test-beds/${fx.bedId}/buyer-contacts`, { role, contact_id: own1 })
  out.linked = { status: linked.status, body: linked.data, request: { role, contact_id: own1 } }
  out.bedAfter = (await api('GET', `/test-beds/${fx.bedId}`)).data

  const refuse = async (name, body) => {
    const r = await api('POST', `/test-beds/${fx.bedId}/buyer-contacts`, body, { expect: undefined })
      .catch((e) => ({ status: e.status, data: e.body }))
    out.refusals[name] = { status: r.status, body: r.data, request: body }
  }
  await refuse('foreignAccount', { role: 'Client Technical Buyer', contact_id: foreign })
  await refuse('deletedContact', { role: 'Client Legal Buyer', contact_id: gone })
  // NOT A REFUSAL, measured: the route ACCEPTS a second contact in a role that
  // is already linked (201). The screen prevents it by rendering a linked role
  // read-only, as the vanilla did; the server behaviour is a finding for the list.
  const second = await api('POST', `/test-beds/${fx.bedId}/buyer-contacts`, { role, contact_id: own2 })
  out.secondLinkSameRole = { status: second.status, body: second.data, request: { role, contact_id: own2 } }
  out.bedAfterSecond = (await api('GET', `/test-beds/${fx.bedId}`)).data

  out.ids = { bed: fx.bedId, account: fx.accountId, own: [own1, own2], foreign, gone }
  console.log(`deleted contact through its route: ${del.status}`)
  console.log(`contacts captured: ${out.contacts.length} (fixture contacts only)`)
  console.log(`linked: ${out.linked.status} ${JSON.stringify(out.linked.body)}`)
  console.log(`bedBefore.buyer_contacts: ${JSON.stringify(out.bedBefore.buyer_contacts)}`)
  console.log(`bedAfter.buyer_contacts: ${JSON.stringify(out.bedAfter.buyer_contacts)}`)
  console.log(`second link, same role: ${out.secondLinkSameRole.status}; buyer_contacts now ${out.bedAfterSecond.buyer_contacts.length}`)
  for (const [k, v] of Object.entries(out.refusals)) console.log(`refusal ${k}: ${v.status} ${JSON.stringify(v.body)}`)
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote ${OUT}`)
} finally {
  const r = await tearDown(TAG)
  console.log('teardown', r.removed.map((x) => x.record_type).join(','), 'remaining', r.remaining)
}
