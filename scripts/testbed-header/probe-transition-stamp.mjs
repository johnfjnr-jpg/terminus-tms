// R10: CAN THE TRANSITION WRITE CARRY A PAYLOAD KEY?
//
// The ruling requires this MEASURED, not assumed, because Verification 46 says
// a write added to a heavily-guarded table inherits every guard on it, and
// `records` carries refuse_write_while_frozen, the append advisory lock, two
// freshness touches and a probability trigger.
//
// WHAT THE SOURCE SAYS, before the live run:
//   5 triggers on `records`, ZERO on `record_revisions`
//   refuse_write_while_frozen HAS a resolver for record_revisions but NO
//     trigger attaches it
//   WORKFLOW_RECORD_TYPES = ['opportunity'], so a Test Bed never has an open
//     transition request and is never frozen
//
// Three source facts pointing one way is an argument. This is the measurement.
import { api as apiCall } from '../api-client.mjs'
import { admin, freshTestBed, tearDown } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const TAG = process.env.STAMP_TAG ?? 'stampproof'
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}

const me0 = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8')).user.id
const { bedId } = await freshTestBed(TAG)
console.log(`  fixture bed ${bedId.slice(0, 8)}\n`)

const stages = must(await db.from('stage_definitions').select('stage_name,sort_order')
  .eq('record_type', 'test_bed').order('sort_order'), 'stages')
const live = stages.find((s) => s.stage_name === 'Installation and Commissioning')
const next = stages.find((s) => s.sort_order === live.sort_order + 1)
must(await db.from('records').update({ status: live.stage_name }).eq('id', bedId).select('id'), 'stage')
console.log(`  parked at ${live.stage_name}; going live means moving to ${next.stage_name}`)

// ── THE FIVE EXIT CRITERIA, SATISFIED SO THE TRANSITION ACTUALLY SUCCEEDS ──
//
// The first run of this probe stamped fine and the transition was refused 422
// on unmet gates - which proves the stamp and NOT the thing R10 asked for. A
// gate refusal is the gate working; the claim is about a SUCCESSFUL
// transition carrying the key.
//
// Built by admin write per Verification 47's clause: one account cannot reach
// this state, since two stage approvals are required and the requester may not
// approve their own.
const accounts = must(await db.from('records').select('id').eq('record_type', 'account')
  .is('deleted_at', null).limit(1), 'account')
const bedRev = must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', bedId).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
must(await db.from('records').update({ installer_account_id: accounts[0].id }).eq('id', bedId).select('id'), 'installer')
await db.rpc('append_record_revision', { p_record_id: bedId,
  p_patch: { installer_account_id: accounts[0].id }, p_created_by: me0, p_remove: [], p_expected_revision: null })

// EVERY INSERT'S ERROR IS CHECKED. The first attempt at this block used
// `contact_record_id`, a `role_id`, and a `scope` column approvals does not
// have - and checked NONE of the three errors, so all three failed silently
// and the transition kept refusing while the probe reported the fixture built.
// Verification 8, in a probe written after promoting it.
const role = must(await db.from('contact_roles').select('id,label').ilike('label', '%Tech Team%').limit(1), 'role')
const contact = must(await db.from('records').select('id').eq('record_type', 'contact')
  .is('deleted_at', null).limit(1), 'contact')
must(await db.from('record_contacts').insert({
  record_id: bedId, contact_id: contact[0].id,
  role: role[0]?.label ?? 'Test Bed Tech Team', role_id: role[0]?.id ?? null, created_by: me0,
}).select('id'), 'contact link')

const doc = must(await db.from('records').insert({
  record_type: 'document', status: 'approved', owner_id: me0, parent_record_id: bedId,
  // records_document_kind_required: a document row must declare its kind.
  // Found by CHECKING the insert's error, which the first version did not.
  document_kind: 'terminus',
  // The checker matches the document NAME on `variant`, not on a payload key:
  //   .eq('document_kind','terminus').eq('variant', docName).eq('status', reqStatus)
  // Read from the checker rather than guessed, after two rounds of guessing.
  variant: 'Site Installation Document',
}).select('id').single(), 'document')
must(await db.rpc('append_record_revision', { p_record_id: doc.id,
  p_patch: { name: 'Site Installation Document', document_type: 'Site Installation Document' },
  p_created_by: me0, p_remove: [], p_expected_revision: null }), 'document revision')

for (const track of ['Commercial', 'Technical']) {
  must(await db.from('approvals').insert({
    // `approvals` has no record_type column, and had no scope column either.
    // Both were in the first version and both failed silently.
    record_id: bedId, track, stage: live.stage_name,
    decision: 'approved', approver_id: me0, revision_number: bedRev.revision_number,
  }).select('id'), `approval ${track}`)
}
console.log('  five exit criteria satisfied by admin write')

const before = must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', bedId).order('revision_number', { ascending: false }).limit(1), 'before')[0]
const months = Number(before.payload?.testBedDuration ?? 6)
console.log(`  revision before ${before.revision_number}, duration ${months} months\n`)

const t = await call('POST', `/records/${bedId}/transition`, { to_stage: next.stage_name })
console.log(`  POST /records/:id/transition -> ${t.status}`)
// THE FAILURE DETAIL CARRIES THE CAUSE'S OWN ANSWER. Iterating against a
// truncated message is how three rebuilds get spent on the wrong criterion.
for (const b of (t.data?.blocking ?? [])) console.log(`      STILL BLOCKING: ${JSON.stringify(b).slice(0, 96)}`)

const goLive = new Date()
const end = new Date(goLive); end.setMonth(end.getMonth() + months)
const iso = (d) => d.toISOString().slice(0, 10)
const me = me0

const stamped = await db.rpc('append_record_revision', {
  p_record_id: bedId,
  p_patch: { testBedGoLiveDate: iso(goLive), estGoLiveDate: iso(end) },
  p_created_by: me, p_remove: [], p_expected_revision: null,
})
console.log(`  append_record_revision       -> ${stamped.error ? 'ERROR ' + stamped.error.message.slice(0, 66) : 'ok'}`)

const after = must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', bedId).order('revision_number', { ascending: false }).limit(1), 'after')[0]
const rec = must(await db.from('records').select('status').eq('id', bedId), 'rec')[0]

console.log(`\n  status now        : ${rec.status}`)
console.log(`  revision now      : ${after.revision_number}  (was ${before.revision_number})`)
console.log(`  testBedGoLiveDate : ${after.payload?.testBedGoLiveDate ?? '(absent)'}`)
console.log(`  estGoLiveDate     : ${after.payload?.estGoLiveDate ?? '(absent)'}   = go-live + ${months} months`)

const ok = t.status >= 200 && t.status < 300
  && rec.status === next.stage_name
  && after.revision_number > before.revision_number
  && after.payload?.estGoLiveDate === iso(end)
console.log(`\n  TRANSITION AND STAMP BOTH LANDED: ${ok}`)
await tearDown(TAG)
process.exit(ok ? 0 : 1)
