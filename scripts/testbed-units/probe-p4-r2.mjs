// ── TEST BED UNITS PHASE 4 (ruling R2): A BUYER ROLE IS SINGLE-HOLDER ────
//
// Phase 0 reproduced the defect: Alpha linked as Commercial Buyer, then Beta
// accepted into the SAME role, 201, and GET returned both. R2 rules one contact
// per role per Test Bed, refused 409 before the insert with the role named.
//
// Both directions on an owned tagged fixture:
//   the second contact in a held role is REFUSED, with the role in the sentence
//   the same contact again keeps its existing refusal
//   a DIFFERENT role is still accepted (the refusal is not "the route is shut")
//   the database holds one contact per role throughout, and after a reload
//   unlinked roles are untouched
//
// UNWIRED: builds live records. Run:
//   TBUNITS_RUN=<label> node --env-file=.env scripts/testbed-units/probe-p4-r2.mjs
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const RUN = process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBUNITS_RUN is required'); process.exit(2) }
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = `TBUNITS-P4-${Date.now()}`
const COMM = 'Client Commercial Buyer', TECH = 'Client Technical Buyer'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })

let fx
try {
  fx = await freshTestBed(TAG)
  const industry = (await call('GET', '/industries')).data[0].id
  const mk = async (label) => {
    const c = (await call('POST', '/contacts', {
      name: `${TAG} ${label}`, company: `${TAG} Holdings`, email: `${TAG.toLowerCase()}-${label.toLowerCase()}@example.invalid`,
      mobile: '+65 9000 0001', industry_id: industry, source: 'Direct Outreach', jobRole: 'Head of Infrastructure',
      city: 'Singapore', country: 'Singapore', region: 'Asia Pacific' })).data
    await call('POST', `/contacts/${c.id}/link-account`, { account_id: fx.accountId })
    return c.id
  }
  const alpha = await mk('Alpha'); const beta = await mk('Beta')
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}`)
  const link = (role, cid) => call('POST', `/test-beds/${fx.bedId}/buyer-contacts`, { role, contact_id: cid })
  const rowsFor = async (role) => must(await db.from('record_contacts').select('contact_id,role')
    .eq('record_id', fx.bedId).eq('role', role), `rows ${role}`)

  const first = await link(COMM, alpha)
  check(first.status === 201, 'the FIRST contact in a free role is accepted', String(first.status))
  check((await rowsFor(COMM)).length === 1, 'one row for that role')

  // THE DEFECT, as Phase 0 reproduced it.
  const second = await link(COMM, beta)
  const afterSecond = await rowsFor(COMM)
  check(second.status === 409, 'a SECOND contact in the held role is refused 409', `${second.status} ${JSON.stringify(second.data)}`)
  check(new RegExp(COMM).test(second.data?.error ?? ''), 'and the refusal NAMES the role', second.data?.error ?? 'no message')
  check(afterSecond.length === 1 && afterSecond[0].contact_id === alpha, 'the DATABASE still holds ONE contact for that role, the first', JSON.stringify(afterSecond))

  const same = await link(COMM, alpha)
  check(same.status === 409, 'the same contact again keeps its refusal', `${same.status} ${JSON.stringify(same.data)}`)
  check((await rowsFor(COMM)).length === 1, 'and still one row')

  // NOT "the route is shut": a free role still accepts.
  const other = await link(TECH, beta)
  check(other.status === 201, 'a DIFFERENT role still accepts a contact', String(other.status))
  check((await rowsFor(TECH)).length === 1, 'one row for the second role')

  const bed = (await call('GET', `/test-beds/${fx.bedId}`)).data
  const buyers = bed.buyer_contacts ?? []
  const perRole = Object.fromEntries([COMM, TECH].map((r) => [r, buyers.filter((b) => b.role === r).length]))
  check(perRole[COMM] === 1 && perRole[TECH] === 1, 'after a reload the route reports one contact per role', JSON.stringify(perRole))
  const audit = must(await db.from('audit_log').select('action').eq('record_id', fx.bedId).eq('action', 'buyer_contact_linked'), 'audit')
  check(audit.length === 2, 'exactly two links were recorded, so the refusals wrote nothing', `${audit.length} audit rows`)
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  if (fx) {
    const t = await tearDown(TAG)
    console.log(`\nteardown: removed ${t.removed.length} (${t.removed.map((r) => r.record_type).join(',')}), remaining ${t.remaining}`)
  }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
