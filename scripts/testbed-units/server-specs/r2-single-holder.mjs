// R2 removed: the route accepts a second contact into a held role again.
import { freshTestBed, tearDown } from '../../fixtures.mjs'
import { api } from '../../api-client.mjs'
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data }))
  .catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })

export default {
  id: 'R2 removed: a second contact in a held role is accepted again',
  file: 'src/routes/test-beds.js',
  find: "    if (held?.length) {",
  replace: "    if (false && held?.length) {",
  probe: 'scripts/testbed-units/probe-p4-r2.mjs',
  run: 'p4-r2',
  expect: [
    'a SECOND contact in the held role is refused 409',
    'the DATABASE still holds ONE contact for that role, the first',
  ],
  // What the server does RIGHT NOW, so the run shows the injection took.
  live: async () => {
    const tag = `TBUNITS-R2CAL-${Date.now()}`
    const fx = await freshTestBed(tag)
    try {
      const industry = (await call('GET', '/industries')).data[0].id
      const mk = async (label) => {
        const c = (await call('POST', '/contacts', { name: `${tag} ${label}`, company: `${tag} Holdings`,
          email: `${tag.toLowerCase()}-${label.toLowerCase()}@example.invalid`, mobile: '+65 9000 0001',
          industry_id: industry, source: 'Direct Outreach', jobRole: 'Head of Infrastructure',
          city: 'Singapore', country: 'Singapore', region: 'Asia Pacific' })).data
        await call('POST', `/contacts/${c.id}/link-account`, { account_id: fx.accountId })
        return c.id
      }
      const role = 'Client Commercial Buyer'
      const a = await mk('A'); const b = await mk('B')
      await call('POST', `/test-beds/${fx.bedId}/buyer-contacts`, { role, contact_id: a })
      const second = await call('POST', `/test-beds/${fx.bedId}/buyer-contacts`, { role, contact_id: b })
      return { secondContactSameRole: second.status, error: second.data?.error ?? null }
    } finally { await tearDown(tag) }
  },
}
