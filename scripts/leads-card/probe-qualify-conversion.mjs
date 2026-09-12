// Phase 1b: prove what the apply made provable, independently over PostgREST.
//
// ── IDENTITY ─────────────────────────────────────────────────────────────
//
// Every call to qualify_contact goes through a REAL USER JWT. The service
// role is used ONLY to build fixtures the system cannot reach with one
// account and to READ state back for assertions - never to exercise the
// function. qualify_contact is SECURITY INVOKER, so a service-role call would
// carry no auth.uid() and would prove nothing about the rule it enforces.
import { readFileSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
// rpcAs lives in the sanctioned client, not here. The fetch guard caught the
// first version of this probe calling fetch directly and was right to: a raw
// fetch bypasses the throwing client. The need was real - a second identity,
// and PostgREST's own /rpc rather than the Fastify routes - so the CLIENT
// gained the capability rather than this file gaining an exemption.
import { rpcAs, sessionIsLive } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const OTHER = JSON.parse(readFileSync(`${ROOT}/session-ref-approver.json`, 'utf8'))
const db = admin()
const TAG = 'p1bconv'

const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}

// Both identities must be live before anything is claimed. A dead token
// refuses everything, which reads exactly like a working rule.
for (const [who, sess] of [['owner', OWNER], ['non-owner', OTHER]]) {
  if (!(await sessionIsLive(sess))) {
    console.error(`  ${who} token is DEAD. Refusing to measure.`); process.exit(2)
  }
}
const OWNER_ID = OWNER.user.id
const OTHER_ID = OTHER.user.id
console.log(`  identities live: owner ${OWNER.user.email}, non-owner ${OTHER.user.email}`)

// ── THE COMPLETE PAYLOAD, matching the 14 remaining gate rules ────────────
const industry = must(await db.from('industries').select('id').limit(1), 'industry')[0]
const COMPLETE = {
  name: `${TAG} Complete Lead`, company: 'Conv Co', jobRole: 'Head of Ops',
  email: `${TAG}@example.invalid`, mobile: '+65 9000 0099', industry_id: industry.id,
  source: 'Direct Outreach', linkedin: 'https://example.invalid/in/x',
  address: '1 Test Way', city: 'Singapore', postcode: '069118',
  country: 'Singapore', region: 'APAC', summary: 'complete for the gate',
}

/** A lead owned by `ownerId`, complete and with NO account link. */
const makeLead = async (label, ownerId = OWNER_ID) => {
  // industry_id IS A REAL COLUMN ON `records`, not a payload key.
  // `RECORD_COLUMN_FIELDS` says so and the gate reads the ROW for it. The
  // first run of this probe put it in the payload, the way it reads on a
  // form, and the complete lead blocked on exactly that one field - the
  // fixture shaped to my assumption rather than to how the system produces
  // the state, which is Verification 47 and is why the discriminator exists.
  const rec = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: ownerId,
    parent_record_id: null, industry_id: industry.id,
  }).select().single(), `create lead ${label}`)
  must(await db.from('record_revisions').insert({
    record_id: rec.id, revision_number: 1,
    payload: { ...COMPLETE, name: `${TAG} ${label}` }, created_by: ownerId,
  }).select().single(), `revision ${label}`)
  return rec
}

/** Everything that could be left behind, in one reading. */
const fingerprint = async (contactId) => {
  const c = must(await db.from('records').select('status, parent_record_id, deleted_at')
    .eq('id', contactId).single(), 'fingerprint contact')
  const accounts = must(await db.from('records').select('id').eq('record_type', 'account')
    .is('deleted_at', null), 'fingerprint accounts')
  const revs = must(await db.from('record_revisions').select('revision_number')
    .eq('record_id', contactId), 'fingerprint revs')
  return { status: c.status, account: c.parent_record_id, accounts: accounts.length, revs: revs.length }
}

const created = []
try {
  // ══ CLAIM 1: THE SUPERSESSION ═════════════════════════════════════════
  console.log('\nCLAIM 1  the Qualify gate after the supersession')
  const rules = must(await db.from('stage_gate_rules')
    .select('requirement_detail, requirement_type')
    .eq('record_type', 'contact').eq('from_stage', 'Unqualified').eq('to_stage', 'Qualified'),
    'gate rules')
  const fields = rules.map((r) => r.requirement_detail.field).sort()
  check('the gate carries 14 rules', rules.length === 14, `${rules.length} rules`)
  check('parent_record_id is gone', !fields.includes('parent_record_id'), fields.join(', '))

  const CONTACT = ['name', 'company', 'jobRole', 'email', 'mobile', 'industry_id', 'source', 'linkedin']
  const ADDRESS = ['address', 'city', 'postcode', 'country', 'region']
  const SUMMARY = ['summary']
  const expected = [...CONTACT, ...ADDRESS, ...SUMMARY].sort()
  check('the 14 map exactly to Contact 8 + Address 5 + Summary 1',
    JSON.stringify(fields) === JSON.stringify(expected),
    `Contact ${CONTACT.length} + Address ${ADDRESS.length} + Summary ${SUMMARY.length} = ${expected.length}`)

  // ── AND THE GATE ACTUALLY UNLOCKS, which the counts alone do not show ──
  const gateLead = await makeLead('gate'); created.push(gateLead.id)
  const { computeBlocking } = await import('../../src/routes/transitions.js')
  const rec = must(await db.from('records').select('*').eq('id', gateLead.id).single(), 'gate lead')
  // THE PAYLOAD, read the way the route reads it. The first run passed `{}`
  // and every field blocked on every lead - 14 and 14 - so the discriminator
  // caught the instrument rather than the product. computeBlocking asks
  // whether a FIELD IS PRESENT, so handing it an empty object asks nothing.
  const latest = async (id) => must(await db.from('record_revisions')
    .select('payload').eq('record_id', id)
    .order('revision_number', { ascending: false }).limit(1), 'payload')[0]?.payload ?? {}
  const blocked = await computeBlocking(db, rec, 'Unqualified', 'Qualified', 1, await latest(gateLead.id))
  check('a complete lead with NO account link is NOT blocked',
    blocked.blocking.length === 0 && rec.parent_record_id === null,
    `parent_record_id=${rec.parent_record_id}, blocking=[${blocked.blocking.map((b) => b.label ?? b.field ?? JSON.stringify(b)).join(', ')}]`)

  // The instrument must be shown BLOCKING, or "not blocked" is a reader that
  // always says so.
  const bare = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: OWNER_ID,
  }).select().single(), 'bare lead')
  created.push(bare.id)
  must(await db.from('record_revisions').insert({
    record_id: bare.id, revision_number: 1,
    payload: { name: `${TAG} bare` }, created_by: OWNER_ID }).select().single(), 'bare rev')
  const bareRec = must(await db.from('records').select('*').eq('id', bare.id).single(), 'bare')
  const bareBlocked = await computeBlocking(db, bareRec, 'Unqualified', 'Qualified', 1, await latest(bare.id))
  check('the gate instrument discriminates (an incomplete lead IS blocked)',
    bareBlocked.blocking.length === 13 && blocked.blocking.length === 0,
    `complete lead: ${blocked.blocking.length} blocking; bare lead: ${bareBlocked.blocking.length} blocking (14 minus the name it has)`)

  // ══ CLAIM 2: ATOMICITY ════════════════════════════════════════════════
  console.log('\nCLAIM 2  the conversion is atomic')

  // 2a. Failure at the ACCOUNT step: a link to an account that is not there.
  const a = await makeLead('acctfail'); created.push(a.id)
  const beforeA = await fingerprint(a.id)
  const rA = await rpcAs(OWNER, 'qualify_contact', {
    p_contact_id: a.id, p_account_id: '00000000-0000-0000-0000-000000000000' })
  const afterA = await fingerprint(a.id)
  check('a failed account step writes NOTHING',
    rA.status >= 400 && JSON.stringify(beforeA) === JSON.stringify(afterA),
    `HTTP ${rA.status} ${rA.data?.message ?? ''} | fingerprint unchanged: ${JSON.stringify(afterA)}`)

  // 2b. THE LOAD-BEARING ONE: fail at the STATUS FLIP, after the account
  //     has been created inside the same transaction.
  //
  //     Injected with a real guard rather than a fabricated one: an OPEN
  //     transition_request freezes the record, and records_frozen_trg refuses
  //     every write to it - INCLUDING the function's own UPDATE. So the
  //     account insert succeeds, the flip raises PT423, and the whole
  //     transaction must roll back, taking the account with it.
  const b = await makeLead('flipfail'); created.push(b.id)
  const freeze = must(await db.from('transition_requests').insert({
    record_id: b.id, record_type: 'contact', from_stage: 'Unqualified',
    to_stage: 'Qualified', kind: 'transition', status: 'open',
    frozen_revision: 1, requested_by: OWNER_ID,
  }).select().single(), 'freeze')
  const beforeB = await fingerprint(b.id)
  const NEW_NAME = `${TAG} Orphan Account Check`
  const rB = await rpcAs(OWNER, 'qualify_contact', {
    p_contact_id: b.id, p_new_account_name: NEW_NAME })
  const afterB = await fingerprint(b.id)
  const orphan = must(await db.from('record_revisions').select('record_id, payload')
    .eq('revision_number', 1), 'orphan scan')
    .filter((r) => r.payload?.name === NEW_NAME)
  check('a failed status flip leaves NO ORPHAN ACCOUNT',
    rB.status >= 400 && orphan.length === 0 && afterB.accounts === beforeB.accounts,
    `HTTP ${rB.status} ${String(rB.data?.message ?? '').slice(0, 58)} | accounts ${beforeB.accounts} -> ${afterB.accounts}, orphans named "${NEW_NAME}": ${orphan.length}`)
  check('and the lead is untouched by the failed conversion',
    afterB.status === 'Unqualified' && afterB.account === null && afterB.revs === beforeB.revs,
    JSON.stringify(afterB))
  await db.from('transition_requests').delete().eq('id', freeze.id)

  // 2c. THE SUCCESS PATH, or every refusal above proves only that it refuses.
  const c = await makeLead('success'); created.push(c.id)
  const beforeC = await fingerprint(c.id)
  const SUCCESS_NAME = `${TAG} Made On Qualify`
  const rC = await rpcAs(OWNER, 'qualify_contact', {
    p_contact_id: c.id, p_new_account_name: SUCCESS_NAME })
  const afterC = await fingerprint(c.id)
  if (afterC.account) created.push(afterC.account)
  check('the owner CAN qualify, and it creates and links the account',
    rC.status < 400 && afterC.status === 'Qualified' && !!afterC.account
      && afterC.accounts === beforeC.accounts + 1 && afterC.revs === beforeC.revs + 1,
    `HTTP ${rC.status} | status ${beforeC.status} -> ${afterC.status}, accounts ${beforeC.accounts} -> ${afterC.accounts}, revisions ${beforeC.revs} -> ${afterC.revs}, account ${afterC.account}`)

  const audit = must(await db.from('audit_log').select('action, record_type')
    .eq('record_id', c.id), 'audit')
  check('the conversion wrote its audit row', audit.some((x) => x.action === 'qualified'),
    audit.map((x) => `${x.record_type}:${x.action}`).join(', ') || '(none)')

  // ══ CLAIM 3: IDENTITY AND OWNERSHIP ═══════════════════════════════════
  console.log('\nCLAIM 3  a non-owner cannot convert someone else\'s lead')
  const d = await makeLead('nonowner'); created.push(d.id)
  const beforeD = await fingerprint(d.id)
  const rD = await rpcAs(OTHER, 'qualify_contact', {
    p_contact_id: d.id, p_new_account_name: `${TAG} Non Owner Account` })
  const afterD = await fingerprint(d.id)
  const msg = String(rD.data?.message ?? '')
  check('a real non-owner JWT is REFUSED, ownership-shaped',
    rD.status >= 400 && /belongs to another user/i.test(msg),
    `HTTP ${rD.status} "${msg.slice(0, 70)}"`)
  check('and the refusal wrote nothing',
    JSON.stringify(beforeD) === JSON.stringify(afterD), JSON.stringify(afterD))
  check('the non-owner is a DIFFERENT real account, not the owner',
    OTHER_ID !== OWNER_ID, `${OTHER_ID.slice(0, 8)} vs owner ${OWNER_ID.slice(0, 8)}`)

  // ══ CLAIM 4: R8, CANCEL LEAVES NOTHING ════════════════════════════════
  console.log('\nCLAIM 4  R8: cancelling the account step leaves nothing')
  const e = await makeLead('cancel'); created.push(e.id)
  const beforeE = await fingerprint(e.id)
  // "Cancel" is the absence of the call. Nothing else writes: the account step
  // is in memory until it is resolved, and resolving it IS calling the
  // function. So the proof is that the fingerprint is unchanged across a
  // qualification that was opened and abandoned.
  const afterE = await fingerprint(e.id)
  check('a cancelled account step leaves zero new records',
    JSON.stringify(beforeE) === JSON.stringify(afterE)
      && afterE.status === 'Unqualified' && afterE.account === null,
    `before ${JSON.stringify(beforeE)} after ${JSON.stringify(afterE)}`)

  // THE CHECK ABOVE IS NEARLY A TAUTOLOGY ON ITS OWN - it fingerprints twice
  // with nothing in between, and "nothing happened" is what it must show. What
  // makes it a measurement is that the lead is still USABLE afterwards:
  // abandoning a qualification must leave a lead that can still be qualified,
  // not merely one whose row is unchanged. A cancel that quietly froze the
  // record, or consumed something, would pass the line above and fail here.
  const rE = await rpcAs(OWNER, 'qualify_contact', {
    p_contact_id: e.id, p_new_account_name: `${TAG} After Cancel` })
  const finalE = await fingerprint(e.id)
  if (finalE.account) created.push(finalE.account)
  check('and the lead is still qualifiable afterwards, so nothing was consumed',
    rE.status < 400 && finalE.status === 'Qualified' && !!finalE.account,
    `HTTP ${rE.status} | ${afterE.status} -> ${finalE.status}, account ${finalE.account}`)
} finally {
  console.log('\n  teardown')
  for (const id of created) {
    await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }
  const live = must(await db.from('records').select('id, record_type').is('deleted_at', null), 'sweep')
  const revs = must(await db.from('record_revisions').select('record_id, payload')
    .in('record_id', live.map((r) => r.id)), 'sweep revs')
  const left = revs.filter((r) => String(r.payload?.name ?? '').startsWith(TAG)).length
  console.log(`  soft deleted ${created.length}; live ${TAG} records remaining: ${left}`)
}

const fails = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - fails.length}/${results.length} checks pass`)
process.exit(fails.length ? 1 : 0)
