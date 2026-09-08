// The race: two genuinely concurrent converts of one Test Bed.
//
// ─────────────────────────────────────────────────────────────
// WHAT THIS MEASURES, BEFORE AND AFTER
// ─────────────────────────────────────────────────────────────
//
// The max-conversions check is read-then-write with no constraint behind it, so
// two concurrent requests both read zero live conversions and both commit. That
// is independent of atomicity: making the four writes one transaction does not
// close it, and the advisory lock in convert_test_bed is what does.
//
// BEFORE the migration this probe is expected to record MORE THAN ONE 201, and
// that is the defect being demonstrated rather than a failure of the probe.
// AFTER it, exactly one 201 and the rest 422. The probe reports the count and
// says which world it is in; it does not decide for you.
//
// ─────────────────────────────────────────────────────────────
// THE FLAKE TELL, FROM THE MIGRATION CLOSE-OUT (carried item 6)
// ─────────────────────────────────────────────────────────────
//
// A concurrency proof that finishes implausibly fast did not run: the requests
// were serialised by something outside the system under test and the result
// describes that instead. So this probe records each request's own start and
// end, computes the overlap, and REFUSES to report a verdict when the requests
// did not actually overlap. Verification 48's shape, applied to a race rather
// than to a gate stage.
//
// ─────────────────────────────────────────────────────────────
// AN UNCODED BED, DELIBERATELY, AND IT IS NOT A CONVENIENCE
// ─────────────────────────────────────────────────────────────
//
// A Test Bed carrying a reference_code has that code copied onto its
// Opportunity, and records_reference_code_record_type_key is UNIQUE
// (reference_code, record_type). So a second concurrent conversion of a CODED
// bed is refused 23505 -> 409 by the unique index, which would look exactly
// like the limit working and would be nothing of the kind.
//
// That is worth stating as a finding on its own: today the only thing stopping
// a double conversion of a coded Test Bed is a unique index whose refusal says
// "That would duplicate a value this record already has", and an uncoded bed
// has no such backstop at all.
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `cvrace-${process.argv[2] ?? 'run'}`
const N = Number(process.argv[3] ?? 4)
const R = []
const check = (name, pass, detail = '') => {
  R.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`)
}

const SESSION = JSON.parse(readFileSync('session-ref.json', 'utf8'))

// ONE INSTRUMENT, TWO TARGETS. Verification 20: the before and the after must
// be the same reader, or the comparison is between two probes rather than
// between two worlds.
//
//   --via=route     the routes as they stand today. This is the BEFORE
//                   baseline, and it stays valid until Phase 2 switches them.
//   --via=function  convert_test_bed over RPC, concurrently. This is the AFTER
//                   proof, and it is the only one available before Phase 2
//                   because the routes do not call the function yet.
//
// THROUGH THE THROWING CLIENT for the route, not a raw fetch.
// scripts/tests/api-client.test.mjs caught the first version of this probe
// calling fetch directly within the minute: its own note says adding a script
// to its allowlist is a decision and forgetting one is a failure, and this was
// neither - it was a third way of talking to the API. ApiError carries .status
// and .body, so a refusal is still a value.
const VIA = (process.argv[4] ?? 'route').replace(/^--via=/, '')
if (!['route', 'function'].includes(VIA)) throw new Error(`--via must be route or function, got ${VIA}`)

const ENV = Object.fromEntries(readFileSync('.env', 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const asUser = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SESSION.access_token}` } },
})

// Normalised to the same three outcomes whichever target is used, so the
// counting code below cannot tell them apart and cannot drift between them.
async function convertRaw(bedId, name, payload) {
  const started = performance.now()
  if (VIA === 'function') {
    const r = await asUser().rpc('convert_test_bed', {
      p_bed_id: bedId, p_payload: payload, p_max_conversions: 1,
      p_probability_pct: null, p_test_bed_cost: null,
    })
    return {
      created: !r.error && !!r.data?.id,
      refused: r.error?.code === 'PT422',
      code: r.error?.code ?? '201',
      data: r.error ? { error: r.error.message } : r.data,
      started, ended: performance.now(),
    }
  }
  try {
    const r = await apiCall('POST', `/test-beds/${bedId}/convert`, { opportunity_name: name })
    return { created: r.status === 201, refused: false, code: String(r.status), data: r.data, started, ended: performance.now() }
  } catch (e) {
    if (e.name !== 'ApiError') throw e
    return { created: false, refused: e.status === 422, code: String(e.status), data: e.body, started, ended: performance.now() }
  }
}

async function conversions(bedId) {
  const { data, error } = await admin()
    .from('opportunity_details')
    .select('record_id, records!opportunity_details_record_id_fkey(deleted_at)')
    .eq('converted_from_test_bed_id', bedId)
  if (error) throw error
  return { all: data.length, live: data.filter((d) => !d.records?.deleted_at).length }
}

let bedId
try {
  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account`, industry_id: industry.id, billingCountry: 'Singapore',
  })
  const bed = await body('POST', '/test-beds', {
    name: `${TAG} bed`, account_id: account.id, client_organisation: `${TAG} Holdings`,
  })
  bedId = bed.id
  check('1. the bed carries no reference_code, so no unique index can mask the race',
    !bed.reference_code, `ref=${bed.reference_code}`)

  // Fired without awaiting between them. Promise.all is what makes them
  // concurrent; the interval arithmetic below is what proves they were.
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) => convertRaw(bedId, `${TAG} #${i + 1}`,
      { name: `${TAG} #${i + 1}`, company_name: `${TAG} Holdings`, customerLead: null })))

  const latestStart = Math.max(...results.map((r) => r.started))
  const earliestEnd = Math.min(...results.map((r) => r.ended))
  const overlapMs = earliestEnd - latestStart
  const slowest = Math.max(...results.map((r) => r.ended - r.started))
  console.log(`\n  via ${VIA}: ${N} requests, slowest ${slowest.toFixed(0)}ms, mutual overlap ${overlapMs.toFixed(0)}ms`)
  for (const [i, r] of results.entries()) {
    console.log(`    #${i + 1}  ${r.code}  ${(r.ended - r.started).toFixed(0)}ms  ${JSON.stringify(r.data?.error ?? r.data?.id ?? null)}`)
  }

  // THE FLAKE TELL. Every request must have been in flight at the same instant,
  // or the run measured serialisation somewhere else and its verdict is void.
  check('2. all requests were genuinely in flight together', overlapMs > 0,
    `mutual overlap ${overlapMs.toFixed(0)}ms across ${N} requests`)
  if (overlapMs <= 0) {
    throw new Error('the requests did not overlap; this run measured nothing about concurrency')
  }

  const created = results.filter((r) => r.created)
  const refused422 = results.filter((r) => r.refused)
  const other = results.filter((r) => !r.created && !r.refused)
  const c = await conversions(bedId)

  console.log(`\n  created=${created.length}  refused-with-the-limit=${refused422.length}  other=${other.length}`)
  console.log(`  conversion rows written: ${c.all}, live: ${c.live}`)

  // The verdict, stated as which world the run is in rather than as pass/fail,
  // because the same probe is the before AND the after measurement.
  if (created.length > 1) {
    console.log(`\n  VERDICT: THE RACE IS LIVE. ${created.length} of ${N} concurrent converts`)
    console.log('  committed against a limit of 1. This is the pre-migration world.')
  } else if (created.length === 1 && refused422.length === N - 1) {
    console.log(`\n  VERDICT: THE RACE IS CLOSED. 1 of ${N} committed, ${refused422.length} refused 422.`)
  } else {
    console.log(`\n  VERDICT: NEITHER SHAPE. ${created.length} created, ${refused422.length} refused,`)
    console.log(`  ${other.length} answered something else. Read the per-request lines above.`)
  }

  check('3. exactly one conversion committed', created.length === 1,
    `${created.length} of ${N} created`)
  check('4. every other request was refused BY THE LIMIT, not by a duplicate key or a raw error',
    refused422.length === N - 1 && other.length === 0,
    `refused=${refused422.length} other=${other.map((r) => r.code).join(',') || 'none'}`)
  check('5. and the database holds exactly one live conversion', c.live === 1,
    `${c.live} live of ${c.all} rows`)
} catch (e) {
  check('99. the probe ran to completion', false, e.message)
} finally {
  await tearDown()
  const { data: left } = await admin().from('records').select('id')
    .eq('owner_id', SESSION.user.id).is('deleted_at', null)
  console.log(`\nRESIDUE live records owned by the test account: ${left?.length ?? '?'}`)
  if (bedId) {
    const after = await conversions(bedId)
    console.log(`RESIDUE bed ${bedId}: ${after.live} live of ${after.all} conversion rows`)
    check('6. teardown leaves zero live conversions', after.live === 0, JSON.stringify(after))
  }
}

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
process.exit(pass === R.length ? 0 : 1)
