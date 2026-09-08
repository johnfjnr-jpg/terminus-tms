// Both switched routes, exercised from OUTSIDE over HTTP as the signed-in user,
// on the SUCCESS path, asserting the carried fields by name.
//
// ─────────────────────────────────────────────────────────────
// DERIVED FROM THE BRIEF, NOT FROM THE CODE BEING REPLACED
// ─────────────────────────────────────────────────────────────
//
// Ruling 11 is explicit about this and so is the skill. The assertions below
// come from the brief's Phase 2 sentence:
//
//   "Behaviour preserved exactly except the two ruled changes (atomicity,
//    audit rollback): same status codes, same error shapes, same response
//    bodies, same carried fields (account_id, reference_code, test_bed_cost,
//    customerLead mapping, defaults at creation per Round 41 item 1)."
//
// Each carried field named there is one assertion here. Nothing was read out of
// the old route bodies to write them, which is what stops a test from agreeing
// with whatever the code happens to do (Verification 47).
//
// ─────────────────────────────────────────────────────────────
// WHY OVER HTTP AND WHY ON THE SUCCESS PATH
// ─────────────────────────────────────────────────────────────
//
// Verification 40. Every route a boundary MODIFIES is exercised from outside
// over HTTP, as the signed-in user, observing the NEW behaviour on the SUCCESS
// path. The commit that rule came from destructured a variable it never
// declared and threw a ReferenceError while BUILDING the 201 for a write that
// had already committed - invisible to every unit test, found by a person four
// hours later. Both routes here were rewritten around exactly that line.
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `rtpres-${process.argv[2] ?? 'run'}`
const SESSION = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const R = []
const check = (name, pass, detail = '') => {
  R.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`)
}

// Round 41 item 1's initial values, named here rather than imported, because a
// test that imports the thing under test agrees with it by construction.
const DEFAULTS = { targetMargin: 30, warrantyPct: 2, duration: 36, bidCurrency: 'USD', proposalCurrency: 'USD' }

async function revisionOf(oppId) {
  const { data } = await admin().from('record_revisions')
    .select('revision_number, payload, created_by').eq('record_id', oppId).order('revision_number')
  return data ?? []
}
const auditActions = async (id) =>
  ((await admin().from('audit_log').select('action').eq('record_id', id)).data ?? []).map((a) => a.action)

try {
  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account`, industry_id: industry.id, billingCountry: 'Singapore',
  })

  // ══ THE CONVERT ROUTE ══════════════════════════════════════════════════
  console.log('\n-- POST /test-beds/:id/convert')
  const bed = await body('POST', '/test-beds', {
    name: `${TAG} bed`, account_id: account.id, industry_id: industry.id, country_code: 'SG',
    client_organisation: `${TAG} Client Org`,
  })
  // accumulated_cost and initialLead are what two of the carried fields come
  // from, and PATCH /test-beds/:id takes them inside `payload` - measured from
  // the route rather than guessed, after the first run of this probe sent them
  // flat and got 400 "request body must contain payload or industry_id".
  // Verification 47's caller-side clause: read the route before writing the
  // call, and exercise it.
  //
  // AND accumulated_cost IS NOT SETTABLE FROM THAT ENDPOINT AT ALL: it answers
  // 400 with disallowed: ["accumulated_cost"], because the cost is derived from
  // the bed's units rather than typed. So the assertion below does not plant a
  // number and check for it. It reads the bed's OWN revision payload and
  // asserts the response equals it - which is what "carried" means, and is a
  // stronger claim than equality with a value the probe chose.
  await apiCall('PATCH', `/test-beds/${bed.id}`, {
    payload: { initialLead: `${TAG} lead person` },
  })
  const { data: bedRev } = await admin().from('record_revisions')
    .select('payload').eq('record_id', bed.id).order('revision_number', { ascending: false }).limit(1).single()
  const bedCost = bedRev?.payload?.accumulated_cost ?? null

  const missing = await apiCall('POST', `/test-beds/${bed.id}/convert`, {},
    { expect: 400, because: 'the brief says the error shapes are preserved, and this one is 400' })
  check('C1. a missing name is still 400 with the same error shape',
    missing.status === 400 && missing.data?.error === 'opportunity_name is required',
    JSON.stringify(missing.data))

  const conv = await apiCall('POST', `/test-beds/${bed.id}/convert`, { opportunity_name: `${TAG} deal` })
  check('C2. the success path answers 201', conv.status === 201, `${conv.status}`)
  const opp = conv.data
  check('C3. the response body is the new record', !!opp?.id && opp.record_type === 'opportunity',
    `${opp?.id} ${opp?.record_type}`)
  check('C4. carried: account_id', opp?.account_id === account.id, `${opp?.account_id}`)
  check('C5. carried: reference_code, the bed\'s own, unchanged',
    opp?.reference_code === bed.reference_code, `${opp?.reference_code} vs ${bed.reference_code}`)
  check('C6. carried: converted_from_test_bed_id on the response body',
    opp?.converted_from_test_bed_id === bed.id, `${opp?.converted_from_test_bed_id}`)
  check('C7. carried: test_bed_cost equals the bed\'s own accumulated_cost',
    (opp?.test_bed_cost ?? null) === (bedCost ?? null)
    || Number(opp?.test_bed_cost) === Number(bedCost),
    `response ${opp?.test_bed_cost} vs bed payload ${bedCost}`)
  check('C8. the stage is Qualification and the owner is the caller',
    opp?.status === 'Qualification' && opp?.owner_id === SESSION.user.id, `${opp?.status}`)

  const cRev = await revisionOf(opp.id)
  check('C9. exactly one revision, numbered 1, created by the caller',
    cRev.length === 1 && cRev[0].revision_number === 1 && cRev[0].created_by === SESSION.user.id,
    `${cRev.length} revision(s)`)
  check('C10. carried: the customerLead MAPPING, initialLead -> customerLead',
    cRev[0]?.payload?.customerLead === `${TAG} lead person`, `${cRev[0]?.payload?.customerLead}`)
  check('C11. carried: company_name from the bed\'s client_organisation',
    cRev[0]?.payload?.company_name === `${TAG} Client Org`, `${cRev[0]?.payload?.company_name}`)
  check('C12. defaults at creation, all five, per Round 41 item 1',
    Object.entries(DEFAULTS).every(([k, v]) => cRev[0]?.payload?.[k] === v),
    JSON.stringify(Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, cRev[0]?.payload?.[k]]))))
  const { data: det } = await admin().from('opportunity_details')
    .select('probability_pct, converted_from_test_bed_id, test_bed_cost').eq('record_id', opp.id).single()
  check('C13. the details row carries the probability default, the bed and the cost',
    det?.converted_from_test_bed_id === bed.id && det?.probability_pct !== null
    && ((det?.test_bed_cost ?? null) === (bedCost ?? null)
        || Number(det?.test_bed_cost) === Number(bedCost)),
    JSON.stringify(det))
  const cAud = await auditActions(bed.id)
  check('C14. both audit rows: one on the bed, one on the opportunity',
    cAud.includes('converted_to_opportunity')
    && (await auditActions(opp.id)).includes('created_from_test_bed'),
    JSON.stringify(cAud))

  // ══ THE CONTACT ROUTE ══════════════════════════════════════════════════
  console.log('\n-- POST /contacts/:id/create-opportunity')
  const contact = await body('POST', '/contacts', {
    name: `${TAG} contact person`, company: `${TAG} Holdings`, email: `${TAG}@example.invalid`,
    mobile: '+65 9000 0001', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  await body('POST', `/contacts/${contact.id}/link-account`, { account_id: account.id })

  // ── QUALIFIED, BY DIRECT WRITE, AND SAID SO ────────────────────────────
  //
  // loadQualifiedContact refuses 422 unless status is 'Qualified', which is
  // correct and is route behaviour this probe must not bypass by disabling. It
  // is reached through the transition engine and its gate criteria, which is a
  // large amount of unrelated setup for a test about what the CREATION route
  // carries.
  //
  // Verification 47's own clause: where the system cannot reach the state
  // cheaply with one account, build it directly and SAY SO. Two things make it
  // safe rather than a shortcut. The value written is one the system itself
  // produces - 'Qualified' is a real contact stage, not a fabricated string -
  // and the route reads the status and has no opinion about how the record
  // arrived at it. Direct precedent: the migration's Round 4 wrote `status` the
  // same way for the same reason.
  const { error: qErr } = await admin().from('records')
    .update({ status: 'Qualified' }).eq('id', contact.id)
  if (qErr) throw new Error(`could not qualify the fixture contact: ${qErr.message}`)
  const { data: qCheck } = await admin().from('records').select('status').eq('id', contact.id).single()
  check('K0. the fixture contact is Qualified, which the route requires',
    qCheck?.status === 'Qualified', `${qCheck?.status}`)

  const noName = await apiCall('POST', `/contacts/${contact.id}/create-opportunity`, {},
    { expect: 400, because: 'the name is required and the error shape is preserved' })
  check('K1. a missing name is still 400 with the same error shape',
    noName.status === 400 && noName.data?.error === 'name is required', JSON.stringify(noName.data))

  const made = await apiCall('POST', `/contacts/${contact.id}/create-opportunity`, { name: `${TAG} from contact` })
  check('K2. the success path answers 201', made.status === 201, `${made.status}`)
  const kOpp = made.data
  check('K3. the response body is the new record, and nothing more',
    !!kOpp?.id && kOpp.record_type === 'opportunity' && kOpp.converted_from_test_bed_id === undefined,
    `${kOpp?.id}`)
  check('K4. carried: account_id, from the contact\'s own Account link',
    kOpp?.account_id === account.id, `${kOpp?.account_id}`)
  check('K5. carried: reference_code was issued for this path',
    typeof kOpp?.reference_code === 'string' && kOpp.reference_code.length > 0, `${kOpp?.reference_code}`)
  check('K6. the stage is Qualification and the owner is the caller',
    kOpp?.status === 'Qualification' && kOpp?.owner_id === SESSION.user.id, `${kOpp?.status}`)

  const kRev = await revisionOf(kOpp.id)
  check('K7. exactly one revision, numbered 1, created by the caller',
    kRev.length === 1 && kRev[0].revision_number === 1 && kRev[0].created_by === SESSION.user.id,
    `${kRev.length} revision(s)`)
  check('K8. carried: customerLead is the contact\'s own name',
    kRev[0]?.payload?.customerLead === `${TAG} contact person`, `${kRev[0]?.payload?.customerLead}`)
  check('K9. carried: company_name is the Account name',
    kRev[0]?.payload?.company_name === `${TAG} Account`, `${kRev[0]?.payload?.company_name}`)
  check('K10. defaults at creation, all five, per Round 41 item 1',
    Object.entries(DEFAULTS).every(([k, v]) => kRev[0]?.payload?.[k] === v),
    JSON.stringify(Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, kRev[0]?.payload?.[k]]))))
  const { data: link } = await admin().from('record_contacts')
    .select('contact_id, role, role_id, role_other').eq('record_id', kOpp.id).single()
  check('K11. the buyer link is written, in the shape linkContact wrote it',
    link?.contact_id === contact.id && link.role === 'commercial buyer'
    && link.role_id === null && link.role_other === null, JSON.stringify(link))
  check('K12. both audit rows: one on the contact, one on the opportunity',
    (await auditActions(contact.id)).includes('created_opportunity')
    && (await auditActions(kOpp.id)).includes('created_from_contact'),
    JSON.stringify(await auditActions(contact.id)))
} catch (e) {
  check('99. the probe ran to completion', false, e.message)
} finally {
  await tearDown()
  const { data: left } = await admin().from('records').select('id')
    .eq('owner_id', SESSION.user.id).is('deleted_at', null)
  console.log(`\nRESIDUE live records owned by the test account: ${left?.length ?? '?'}`)
  check('Z1. teardown leaves nothing live', (left?.length ?? -1) === 0, `${left?.length}`)
}

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
process.exit(pass === R.length ? 0 : 1)
