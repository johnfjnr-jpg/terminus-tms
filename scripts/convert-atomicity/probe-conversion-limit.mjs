// R5: the deleted_at exclusion, proved in BOTH directions on a constructed
// fixture, because no row in the database can exercise it.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS PROBE EXISTS
// ─────────────────────────────────────────────────────────────
//
// Phase 0 finding F1. Every one of the 70 recorded conversions in this database
// has both its Test Bed and its Opportunity soft-deleted, and every bed was
// converted exactly once. So the live-conversion count has NEVER been non-zero,
// P0.3's zero was true by absence, and the deleted_at exclusion has nothing in
// the data to exercise it. A rule with no live case is an assertion, not a
// control (Verification 9).
//
// ─────────────────────────────────────────────────────────────
// WHAT DISCRIMINATES, AND WHAT ONLY LOOKS LIKE IT DOES
// ─────────────────────────────────────────────────────────────
//
// max_conversions is 1. With one live conversion the count is 1 and the answer
// is 422; with one live and one dead counted wrongly the count is 2 and the
// answer is STILL 422. That step cannot tell a correct count from a wrong one,
// and it is the obvious step to write.
//
// The two that DO discriminate are the two this probe turns on:
//
//   A live  -> convert must be REFUSED. The live one IS counted.
//   A dead  -> convert must SUCCEED.    The dead one is NOT counted.
//
// Each step also reads the count directly, so a 422 arriving for some other
// reason cannot be read as the rule holding (Verification 14: an assertion
// about an EFFECT carries the CAUSE's own answer).
//
// ─────────────────────────────────────────────────────────────
// THE FIXTURE IS BUILT THE WAY THE SYSTEM PRODUCES THE STATE, WITH ONE
// DELIBERATE EXCEPTION, STATED
// ─────────────────────────────────────────────────────────────
//
// The Account, the Test Bed and every conversion are made through the real API
// as the signed-in user. The soft delete is not, because THERE IS NO ROUTE THAT
// DELETES AN OPPORTUNITY: enumerated with the comment stripper, the whole API
// has three DELETE routes and they are a Contact, a key-contact link and a
// customer document. Nothing can soft-delete an Opportunity.
//
// That is Verification 47's own clause - where the system cannot reach the
// state with one account, build it directly and say so - and it is why F1
// happened at all. The value written is the one the system itself writes
// (`deleted_at = now()`, exactly what tearDown and the Contact delete route
// write), and the count reads deleted_at with no opinion about how it got
// there.
//
// It is also a FINDING in its own right: the rule the migration must preserve
// protects a state the application has no way to create.
import { api as apiCall } from '../api-client.mjs'

// api-client returns the ENVELOPE {status, ok, data}, and every call below that
// wants the record wants the body. Unwrapped once here rather than remembered
// at fourteen call sites: the first run of this probe died on `industry.id` of
// an envelope, which is the same shape fixtures.mjs already solved this way.
const api = async (m, p, b, o) => apiCall(m, p, b, o)
const body = async (m, p, b) => (await apiCall(m, p, b)).data
import { admin, tearDown } from '../fixtures.mjs'

const TAG = `cvlimit-${process.argv[2] ?? 'run'}`
const R = []
const check = (name, pass, detail = '') => {
  R.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`)
}

// The live-conversion count, computed the way the enforcement computes it, so
// the probe and the rule cannot disagree about what they are counting
// (Verification 43: a display reads what the enforcement reads).
async function liveConversions(bedId) {
  const db = admin()
  const { data, error } = await db
    .from('opportunity_details')
    .select('record_id, records!opportunity_details_record_id_fkey(deleted_at)')
    .eq('converted_from_test_bed_id', bedId)
  if (error) throw error
  return {
    all: data.length,
    live: data.filter((d) => !d.records?.deleted_at).length,
    dead: data.filter((d) => d.records?.deleted_at).length,
  }
}

async function softDelete(oppId) {
  const db = admin()
  const { error } = await db.from('records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', oppId)
  if (error) throw error
  const { data } = await db.from('records').select('deleted_at').eq('id', oppId).single()
  if (!data?.deleted_at) throw new Error(`soft delete of ${oppId} did not take`)
}

let beds = []
try {
  const { data: cc } = await admin().from('conversion_criteria')
    .select('condition').eq('from_record_type', 'test_bed').eq('to_record_type', 'opportunity').single()
  const MAX = cc.condition?.max_conversions
  console.log(`\nmax_conversions read from conversion_criteria = ${MAX}`)
  check('0. the limit is 1, so one live conversion is the boundary', MAX === 1, `max_conversions=${MAX}`)

  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account`, industry_id: industry.id, billingCountry: 'Singapore',
  })

  // ── TWO BEDS, AND THE SECOND ONE IS WHY THE FIRST RUN OF THIS PROBE
  //    STOPPED AT STEP D ─────────────────────────────────────────────────
  //
  // A Test Bed created with an industry AND a country is issued a
  // reference_code, and the convert route carries that code onto the new
  // Opportunity unchanged (Milestone 5, deliberate). records carries
  // records_reference_code_record_type_key UNIQUE (reference_code,
  // record_type), which is NOT partial on deleted_at - so once one Opportunity
  // holds a bed's code, a SECOND one can never be created from that bed, alive
  // or dead.
  //
  // A Test Bed created without an industry or a country is issued no code at
  // all (POST /test-beds: `if (industry_id && country_code)`), the carry-over
  // copies null, and nulls do not collide. That bed can reach the state the
  // deleted_at exclusion is about.
  //
  // Both are states the system produces. Running both is what separates "the
  // rule does not work" from "the rule works and something above it makes the
  // state unreachable", and those are different findings with different fixes.
  const coded = await body('POST', '/test-beds', {
    name: `${TAG} coded bed`, account_id: account.id,
    industry_id: industry.id, country_code: 'SG',
    client_organisation: `${TAG} Holdings`,
  })
  const plain = await body('POST', '/test-beds', {
    name: `${TAG} uncoded bed`, account_id: account.id,
    client_organisation: `${TAG} Holdings`,
  })
  beds = [coded.id, plain.id]
  console.log(`fixture: coded bed ${coded.id} ref=${coded.reference_code}`)
  console.log(`fixture: uncoded bed ${plain.id} ref=${plain.reference_code}\n`)
  check('1. the two fixtures differ in exactly the property under test',
    !!coded.reference_code && !plain.reference_code,
    `coded=${coded.reference_code} uncoded=${plain.reference_code}`)

  // ══ BED 2, THE UNCODED ONE: R5 IN BOTH DIRECTIONS ══════════════════════
  console.log('\n-- the uncoded bed: R5, both directions')
  const c0 = await liveConversions(plain.id)
  check('2. a fresh bed has no conversions', c0.all === 0, JSON.stringify(c0))

  const a = await body('POST', `/test-beds/${plain.id}/convert`, { opportunity_name: `${TAG} P-A` })
  const pA = a.id
  const cA = await liveConversions(plain.id)
  check('3. the first conversion succeeds', !!pA, `opportunity ${pA}`)
  check('4. and the count sees it as LIVE', cA.live === 1 && cA.dead === 0, JSON.stringify(cA))

  // DISCRIMINATING STEP ONE: the live one IS counted.
  const b = await api('POST', `/test-beds/${plain.id}/convert`, { opportunity_name: `${TAG} P-B` },
    { expect: 422, because: 'one LIVE conversion exists and max_conversions is 1' })
  check('5. DISCRIMINATES: a second conversion is REFUSED 422 while the first is live',
    b.status === 422, `${b.status} ${JSON.stringify(b.data)}`)
  const cB = await liveConversions(plain.id)
  check('6. and the refusal wrote nothing', cB.all === 1 && cB.live === 1, JSON.stringify(cB))

  await softDelete(pA)
  const cC = await liveConversions(plain.id)
  check('7. after the soft delete: 1 row naming the bed, 0 of them live',
    cC.all === 1 && cC.live === 0 && cC.dead === 1, JSON.stringify(cC))

  // DISCRIMINATING STEP TWO: the dead one is NOT counted. A row still names
  // this bed; if the count read the ROW rather than the LIVE row this answers
  // 422 and the exclusion is decoration.
  const d = await body('POST', `/test-beds/${plain.id}/convert`, { opportunity_name: `${TAG} P-D` })
  const pD = d.id
  const cD = await liveConversions(plain.id)
  check('8. DISCRIMINATES: converting again SUCCEEDS once the first is dead',
    !!pD, `opportunity ${pD}`)
  check("9. and the bed now holds R5's named fixture: 1 live + 1 soft-deleted conversion",
    cD.all === 2 && cD.live === 1 && cD.dead === 1, JSON.stringify(cD))

  // Non-discriminating by construction, and said so: 1 >= 1 and 2 >= 1 both
  // refuse, so this cannot tell a correct count from one that counts the dead
  // row too. It is here only to show the rule did not stop applying.
  const e = await api('POST', `/test-beds/${plain.id}/convert`, { opportunity_name: `${TAG} P-E` },
    { expect: 422, because: 'the replacement conversion is live, so the limit applies again' })
  check('10. the limit applies again to the live replacement (does NOT discriminate)',
    e.status === 422, `${e.status}`)

  // ══ BED 1, THE CODED ONE: WHERE THE RULE CANNOT BE REACHED ═════════════
  console.log('\n-- the coded bed: the finding')
  const ca = await body('POST', `/test-beds/${coded.id}/convert`, { opportunity_name: `${TAG} C-A` })
  const cOppA = ca.id
  check('11. the first conversion of a coded bed succeeds', !!cOppA, `opportunity ${cOppA}`)
  check('12. and it carries the bed\'s reference_code, as Milestone 5 intends',
    ca.reference_code === coded.reference_code, `${ca.reference_code} vs ${coded.reference_code}`)

  await softDelete(cOppA)
  const cc2 = await liveConversions(coded.id)
  check('13. soft-deleted, so the conversion count says the bed is free',
    cc2.all === 1 && cc2.live === 0, JSON.stringify(cc2))

  // THE FINDING. The count says free; the unique constraint says taken.
  const cb = await api('POST', `/test-beds/${coded.id}/convert`, { opportunity_name: `${TAG} C-B` },
    { expect: 409, because: 'FINDING: records_reference_code_record_type_key is not partial on deleted_at, so the dead Opportunity still holds the bed\'s code' })
  check('14. FINDING: the bed the count calls free is REFUSED 409 by the unique constraint',
    cb.status === 409, `${cb.status} ${JSON.stringify(cb.data)}`)
  const cc3 = await liveConversions(coded.id)
  check('15. and the refused conversion wrote nothing to opportunity_details',
    cc3.all === 1 && cc3.live === 0, JSON.stringify(cc3))
} catch (e) {
  check('99. the probe ran to completion', false, e.message)
} finally {
  await tearDown()
  // Verification 11: confirm teardown by RE-QUERYING, never by trusting its own
  // result, and confirm with the Phase 0 detector that this probe left none of
  // the residue the round exists to detect.
  const db = admin()
  const { readFileSync } = await import('fs')
  const uid = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
  const { data: leftLive } = await db.from('records').select('id, record_type')
    .eq('owner_id', uid).is('deleted_at', null)
  console.log(`\nRESIDUE live records owned by the test account: ${leftLive?.length ?? '?'}`)
  let residue = 0
  for (const b of beds) {
    const after = await liveConversions(b)
    console.log(`RESIDUE bed ${b}: ${after.live} live of ${after.all} conversion rows`)
    residue += after.live
  }
  check('16. teardown leaves zero LIVE conversions on either fixture bed', residue === 0,
    `${residue} live`)
}

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
process.exit(pass === R.length ? 0 : 1)
