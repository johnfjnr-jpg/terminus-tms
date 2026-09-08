// The function's own proofs: RLS under INVOKER both ways, atomicity by
// measurement, PT422, PT404, and R5 again at the function rather than the route.
//
// ─────────────────────────────────────────────────────────────
// THIS PROBE CANNOT RUN UNTIL THE MIGRATION IS APPLIED
// ─────────────────────────────────────────────────────────────
//
// CLAUDE.md rule 14's environment fact, re-verified for this round rather than
// recalled: this session reaches Postgres only through PostgREST. There is no
// psql, no supabase CLI, no pg or postgres module, and .env carries a URL and
// two keys and no connection string. A migration therefore cannot be applied or
// even parse-checked here; the Supabase dashboard is the first parser it meets.
//
// So this file is written, committed and UNRUN, and it says so on its first
// line of output. It stops with a named message rather than a wall of failures
// when the functions are absent - Verification 48's shape: a run that produced
// no result must not be scored.
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `cvfn-${process.argv[2] ?? 'run'}`
const R = []
const check = (name, pass, detail = '') => {
  R.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`)
}

const ENV = Object.fromEntries(readFileSync('.env', 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const SESSION = JSON.parse(readFileSync('session-ref.json', 'utf8'))

// The caller the routes use: the publishable key WITH the user's JWT, so
// auth.uid() is the signed-in user and every policy applies to them.
const asUser = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SESSION.access_token}` } },
})
// The caller nothing should be able to convert as: the publishable key and NO
// JWT, so auth.uid() is null. A SECURITY DEFINER function would have written
// every row for this caller.
const asAnon = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } })

const PAYLOAD = { name: `${TAG} deal`, company_name: `${TAG} Holdings`, customerLead: null }

async function rowsFor(bedId) {
  const db = admin()
  const { data: ds } = await db.from('opportunity_details')
    .select('record_id').eq('converted_from_test_bed_id', bedId)
  const ids = (ds ?? []).map((d) => d.record_id)
  const { data: revs } = ids.length
    ? await db.from('record_revisions').select('record_id').in('record_id', ids)
    : { data: [] }
  const { data: auds } = await db.from('audit_log')
    .select('id, action').eq('record_id', bedId).eq('action', 'converted_to_opportunity')
  return { details: ids.length, revisions: (revs ?? []).length, bedAudits: (auds ?? []).length }
}

async function liveConversions(bedId) {
  const { data } = await admin().from('opportunity_details')
    .select('record_id, records!opportunity_details_record_id_fkey(deleted_at)')
    .eq('converted_from_test_bed_id', bedId)
  return { all: data.length, live: data.filter((d) => !d.records?.deleted_at).length }
}

const softDelete = async (id) => {
  const { error } = await admin().from('records')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

let bedId
try {
  // ── STOP RATHER THAN SCORE, if the migration is not applied ────────────
  const probe = await asUser().rpc('convert_test_bed', {
    p_bed_id: '00000000-0000-0000-0000-000000000000',
    p_payload: {}, p_max_conversions: null, p_probability_pct: null, p_test_bed_cost: null,
  })
  if (probe.error?.code === 'PGRST202') {
    console.log('\nSTOP: public.convert_test_bed does not exist in the schema cache.')
    console.log('The migration 20260908000001_convert_is_one_transaction.sql has not been applied.')
    console.log('This session cannot apply it: no psql, no supabase CLI, no pg module, no')
    console.log('connection string. Apply it, then re-run this probe.')
    process.exit(3)
  }
  check('0. an unknown bed raises PT404, not a null-propagating insert',
    probe.error?.code === 'PT404', `${probe.error?.code} ${probe.error?.message}`)

  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account`, industry_id: industry.id, billingCountry: 'Singapore',
  })
  // Uncoded, for the same reason probe-convert-race uses one: a carried
  // reference_code makes the unique index refuse a second conversion, which
  // would mask the rule under test.
  const bed = await body('POST', '/test-beds', {
    name: `${TAG} bed`, account_id: account.id, client_organisation: `${TAG} Holdings`,
  })
  bedId = bed.id

  // ── RLS UNDER INVOKER, THE REFUSAL, REBUILT ────────────────────────────
  //
  // THE FIRST VERSION OF THIS SECTION PASSED FOR THE WRONG REASON, and it is
  // recorded here rather than quietly corrected. It asserted only that the
  // anonymous call errored. It did: with PT404, because records_select is
  // `auth.uid() is not null`, so an unidentified caller cannot SEE the bed and
  // the function raises before reaching any insert. A real refusal, and not
  // the one the assertion claimed - Verification 17, a probe that fires and
  // measures the wrong thing.
  //
  // AND THE HONEST FINDING UNDERNEATH IT: under the current policy set, no
  // AUTHENTICATED caller can be refused by these five insert policies through
  // these functions, because the functions derive owner_id, created_by and
  // actor_id from auth.uid() rather than accepting them. Every policy is
  // satisfied by construction. That is Architecture rule 12 working, and it
  // means "shown REFUSING at an insert" is not constructible for a signed-in
  // user without changing policy or data.
  //
  // SO THE PROOF IS A CONTRAST, AND THE DELTA IS THE ENFORCEMENT. The same
  // call, same bed, same arguments, made two ways:
  //
  //   publishable key, no JWT   RLS ON      auth.uid() null
  //   service key,     no JWT   RLS BYPASSED auth.uid() null
  //
  // The service-role call is a faithful stand-in for what a SECURITY DEFINER
  // version of this function would do, because bypassing RLS is exactly the
  // privilege a definer function would have brought. If the two calls fail at
  // DIFFERENT STAGES, the difference between them is RLS, and RLS is therefore
  // in force for the invoker call.
  const before = await rowsFor(bedId)
  const anon = await asAnon().rpc('convert_test_bed', {
    p_bed_id: bedId, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: null, p_test_bed_cost: null,
  })
  const bypass = await admin().rpc('convert_test_bed', {
    p_bed_id: bedId, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: null, p_test_bed_cost: null,
  })
  const afterAnon = await rowsFor(bedId)
  check('1a. an unidentified caller under RLS is stopped at the READ, before any insert',
    anon.error?.code === 'PT404', `${anon.error?.code} ${anon.error?.message?.slice(0, 60)}`)
  check('1b. the same call with RLS BYPASSED gets PAST the read and dies at the first INSERT',
    bypass.error?.code === '23502', `${bypass.error?.code} ${bypass.error?.message?.slice(0, 70)}`)
  check('1c. DISCRIMINATES: the two failed at different stages, and the delta is RLS',
    !!anon.error && !!bypass.error && anon.error.code !== bypass.error.code,
    `RLS on -> ${anon.error?.code}, RLS bypassed -> ${bypass.error?.code}`)
  check('1d. and neither wrote anything at all',
    afterAnon.details === before.details
    && afterAnon.revisions === before.revisions
    && afterAnon.bedAudits === before.bedAudits,
    `${JSON.stringify(before)} -> ${JSON.stringify(afterAnon)}`)

  // ── ATOMICITY, POSITION 1: THE RECORDS INSERT ITSELF ──────────────────
  //
  // Reachable through the finding carried as ruling 8. A Test Bed with a
  // reference_code has that code copied onto its Opportunity, and
  // records_reference_code_record_type_key UNIQUE (reference_code,
  // record_type) is not partial on deleted_at - so once one Opportunity holds
  // the code, a second insert of it raises 23505 at the FIRST statement.
  //
  // A weak atomicity proof on its own, since nothing precedes insert 1 to roll
  // back. It is here for the other half: it proves the function RAISES rather
  // than proceeding, and it reproduces ruling 8's finding at the function
  // rather than only at the route.
  const codedBed = await body('POST', '/test-beds', {
    name: `${TAG} coded bed`, account_id: account.id,
    industry_id: industry.id, country_code: 'SG', client_organisation: `${TAG} Holdings`,
  })
  const firstCoded = await asUser().rpc('convert_test_bed', {
    p_bed_id: codedBed.id, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: null, p_test_bed_cost: null,
  })
  check('2a. a coded bed converts once and the Opportunity carries the bed\'s code',
    !firstCoded.error && firstCoded.data?.reference_code === codedBed.reference_code,
    `${firstCoded.error?.code ?? ''} ${firstCoded.data?.reference_code} vs ${codedBed.reference_code}`)
  await softDelete(firstCoded.data?.id)
  const b1 = await rowsFor(codedBed.id)
  const collide = await asUser().rpc('convert_test_bed', {
    p_bed_id: codedBed.id, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: null, p_test_bed_cost: null,
  })
  const a1 = await rowsFor(codedBed.id)
  check('2b. ATOMICITY at insert 1: the count says the bed is free, the unique index raises 23505',
    collide.error?.code === '23505', `${collide.error?.code} ${collide.error?.message?.slice(0, 60)}`)
  check('2c. and it left ZERO new rows (ruling 8 reproduced at the function)',
    a1.details === b1.details && a1.revisions === b1.revisions && a1.bedAudits === b1.bedAudits,
    `${JSON.stringify(b1)} -> ${JSON.stringify(a1)}`)

  // ── ATOMICITY, MEASURED AT INSERT 3 ────────────────────────────────────
  //
  // opportunity_details.probability_pct carries CHECK (probability_pct >= 0 AND
  // <= 100), so 999 fails the THIRD insert with 23514 after the record and its
  // revision have already been written. No code injection: a real constraint on
  // a real column, which is the only injection point the five tables offer
  // (record_revisions.payload and audit_log have no check to violate).
  //
  // The general claim - that ANY failure at ANY position rolls the whole thing
  // back - is structural rather than measurable: neither function has an
  // EXCEPTION block, so nothing can commit part of itself. That is asserted by
  // scripts/tests/convert-atomicity.test.mjs and calibrated in both directions.
  // This is the instance that shows the structure doing its job.
  const b3 = await rowsFor(bedId)
  const bad = await asUser().rpc('convert_test_bed', {
    p_bed_id: bedId, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: 999, p_test_bed_cost: null,
  })
  const a3 = await rowsFor(bedId)
  check('3a. a failure at insert 3 raises', bad.error?.code === '23514', `${bad.error?.code} ${bad.error?.message?.slice(0, 80)}`)
  check('3b. ATOMICITY at insert 3: ZERO rows across every touched table, after two had been written',
    a3.details === b3.details && a3.revisions === b3.revisions && a3.bedAudits === b3.bedAudits,
    `${JSON.stringify(b3)} -> ${JSON.stringify(a3)}`)

  // ── THE SUCCESS PATH, ALL FOUR INSERTS, AS AN ORDINARY CALLER ──────────
  //
  // Verification 40: a gate made of refusals is satisfied by a route that
  // refuses everything. Every proof above is a refusal, so this is the one that
  // says the function works at all.
  const ok = await asUser().rpc('convert_test_bed', {
    p_bed_id: bedId, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: 10, p_test_bed_cost: 1234.56,
  })
  check('5. RLS UNDER INVOKER: an ordinary caller writes all four rows',
    !ok.error && !!ok.data?.id, ok.error ? `${ok.error.code} ${ok.error.message}` : `opportunity ${ok.data?.id}`)
  const oppA = ok.data?.id
  const a5 = await rowsFor(bedId)
  check('6. and every one of the four landed', a5.details === 1 && a5.revisions === 1 && a5.bedAudits === 1,
    JSON.stringify(a5))
  check('7. the response carries the two fields the route appends today',
    ok.data?.converted_from_test_bed_id === bedId && Number(ok.data?.test_bed_cost) === 1234.56,
    JSON.stringify({ c: ok.data?.converted_from_test_bed_id, t: ok.data?.test_bed_cost }))

  // ── PT422, AND ITS MESSAGE ─────────────────────────────────────────────
  const limited = await asUser().rpc('convert_test_bed', {
    p_bed_id: bedId, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: null, p_test_bed_cost: null,
  })
  check('8. DISCRIMINATES: the limit refuses with PT422, not PT409 and not a raw error',
    limited.error?.code === 'PT422', `${limited.error?.code} ${limited.error?.message}`)
  check('9. and the message is the one the route already sends',
    limited.error?.message === 'This Test Bed has already been converted to an Opportunity',
    JSON.stringify(limited.error?.message))

  // ── R5 AT THE FUNCTION ─────────────────────────────────────────────────
  await softDelete(oppA)
  const cD = await liveConversions(bedId)
  check('10. after the soft delete: 1 row naming the bed, 0 live', cD.all === 1 && cD.live === 0,
    JSON.stringify(cD))
  const again = await asUser().rpc('convert_test_bed', {
    p_bed_id: bedId, p_payload: PAYLOAD, p_max_conversions: 1,
    p_probability_pct: null, p_test_bed_cost: null,
  })
  check('11. DISCRIMINATES: the dead conversion is excluded, so this succeeds',
    !again.error && !!again.data?.id, again.error ? `${again.error.code} ${again.error.message}` : `opportunity ${again.data?.id}`)
  const cE = await liveConversions(bedId)
  check("12. and the bed holds R5's fixture at the function: 1 live + 1 dead",
    cE.all === 2 && cE.live === 1, JSON.stringify(cE))

  // ── A NULL LIMIT MEANS NO LIMIT ────────────────────────────────────────
  //
  // Verification 24: a defaulted or nullable parameter hides an incomplete
  // change until a second value exercises it. Every call above passes 1.
  const unlimited = await asUser().rpc('convert_test_bed', {
    p_bed_id: bedId, p_payload: PAYLOAD, p_max_conversions: null,
    p_probability_pct: null, p_test_bed_cost: null,
  })
  check('13. a null max_conversions means no limit, exercised with a value other than 1',
    !unlimited.error && !!unlimited.data?.id,
    unlimited.error ? `${unlimited.error.code} ${unlimited.error.message}` : `opportunity ${unlimited.data?.id}`)
  // ── THE FOURTH NAMED PROOF, AND THE HALF THAT IS NOT TRUE YET ─────────
  //
  // "The limit refusal maps to the route's 422, not a 500." The function's half
  // is proved above: it raises PT422 with the route's own message. The MAPPING
  // half cannot be true yet, because the routes do not call the function until
  // Phase 2 and sendWriteError has no PT422 branch - so a PT422 reaching it
  // today falls through to 500.
  //
  // Measured on the source rather than asserted, through the estate's stripper
  // so a comment naming PT422 cannot satisfy it.
  const { stripJs } = await import('../lib/strip-comments.mjs')
  const writeErrors = stripJs(readFileSync('src/lib/write-errors.js', 'utf8'))
  check('14. PT422 has NO route mapping yet, so Phase 2 must add one or the limit answers 500',
    !writeErrors.includes('PT422'),
    `write-errors.js mentions PT422 in code: ${writeErrors.includes('PT422')}`)
} catch (e) {
  check('99. the probe ran to completion', false, e.message)
} finally {
  await tearDown()
  const { data: left } = await admin().from('records').select('id')
    .eq('owner_id', SESSION.user.id).is('deleted_at', null)
  console.log(`\nRESIDUE live records owned by the test account: ${left?.length ?? '?'}`)
  if (bedId) {
    const after = await liveConversions(bedId)
    console.log(`RESIDUE bed ${bedId}: ${after.live} live of ${after.all} conversion rows`)
    check('15. teardown leaves zero live conversions', after.live === 0, JSON.stringify(after))
  }
}

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
process.exit(pass === R.length ? 0 : 1)
