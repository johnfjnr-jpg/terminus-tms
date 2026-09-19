// R3's LIVE PROOF: a follow-up task written to an Opportunity over HTTP and
// read back from the DATABASE.
//
// Verification 40: the route is exercised FROM OUTSIDE, as the signed-in user,
// on the SUCCESS path, asserting the NEW BEHAVIOUR rather than the status.
// Everything in `npm run test:db` reaches Postgres through the service key,
// which has BYPASSRLS and never enters a route, so only HTTP can measure this.
//
// AND THE DISCRIMINATOR, WITHOUT WHICH THE SUCCESS PROVES NOTHING. If the route
// accepted any key at all, a 200 on `followUpDate` would say nothing about the
// allowlist. So the same probe sends a key that is NOT on the list and requires
// it to be REFUSED, and requires the refusal to NAME that key rather than merely
// being a 400: a refusal for another reason is not evidence (Verification 14).
//
// A 2xx IS NOT A WRITE, so the record is fingerprinted before and after and the
// values are read back from the database rather than from the response that
// claimed to have written them.
//
// UNWIRED: needs a live server and a signed-in session. Run:
//   node scripts/opportunity/probe-r3-followup.mjs
import { api, ApiError } from '../api-client.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const TAG = 'r3-followup'
const db = admin()
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }

const results = []
const check = (pass, label, detail = '') => {
  results.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const state = async (id) => {
  const rev = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'revision')
  return { revision: rev[0]?.revision_number ?? 0, payload: rev[0]?.payload ?? {} }
}

const opp = await freshOpportunity(TAG)
console.log(`opportunity ${opp.oppId}\n`)

try {
  const before = await state(opp.oppId)
  check(!before.payload.followUpDate && !before.payload.followUpDescription,
    'the fixture starts with NO follow-up, so the write below is not vacuous',
    `date=${JSON.stringify(before.payload.followUpDate)} desc=${JSON.stringify(before.payload.followUpDescription)}`)

  const DATE = '2026-11-03'
  const DESC = 'Chase the signed order form'

  const res = await api('PATCH', `/opportunities/${opp.oppId}`, {
    payload: { followUpDate: DATE, followUpDescription: DESC },
    expected_revision: before.revision,
  })
  check(true, 'the route ACCEPTED the two follow-up keys', `status ${res.status ?? '2xx'}`)

  const after = await state(opp.oppId)
  check(after.revision > before.revision,
    'the record MOVED, so this was a write and not a read that answered 2xx',
    `revision ${before.revision} -> ${after.revision}`)
  check(after.payload.followUpDate === DATE,
    'followUpDate reads back from the DATABASE as written',
    `${JSON.stringify(after.payload.followUpDate)}`)
  check(after.payload.followUpDescription === DESC,
    'followUpDescription reads back from the DATABASE as written',
    `${JSON.stringify(after.payload.followUpDescription)}`)

  // THE DISCRIMINATOR. The allowlist must still be an allowlist.
  let refused = null
  try {
    await api('PATCH', `/opportunities/${opp.oppId}`, {
      payload: { followUpDateX: 'nonsense' },
      expected_revision: after.revision,
    })
  } catch (e) { refused = e }
  check(refused instanceof ApiError && refused.status === 400,
    'a key OUTSIDE the allowlist is still REFUSED, so acceptance above means something',
    refused ? `status ${refused.status}` : 'it was ACCEPTED, so the allowlist is not an allowlist')
  const body = JSON.stringify(refused?.body ?? refused?.data ?? {})
  check(body.includes('followUpDateX'),
    'and the refusal NAMES the offending key, so it is not a 400 for another reason',
    body.slice(0, 120))

  // The Contact's Nurture gate must not have followed the keys across.
  const oppGates = must(await db.from('stage_gate_rules')
    .select('id, from_stage, to_stage, requirement_detail')
    .eq('record_type', 'opportunity').eq('requirement_type', 'payload_field_required'), 'gate rules')
  const followUpGates = oppGates.filter(r => String(r.requirement_detail?.field ?? '').startsWith('followUp'))
  check(followUpGates.length === 0,
    'NO opportunity gate rule requires a follow-up field, so the Contact rule did not travel',
    `${oppGates.length} payload_field_required rules on opportunity, ${followUpGates.length} naming followUp*`)
} finally {
  await tearDown(TAG)
  const left = must(await db.from('records').select('id, deleted_at').eq('reference_code', opp.referenceCode ?? '__none__'), 'teardown recheck')
  console.log(`\nteardown: re-queried by tag, ${left.filter(r => !r.deleted_at).length} live records remain under this fixture`)
}

const failed = results.filter(r => !r).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
