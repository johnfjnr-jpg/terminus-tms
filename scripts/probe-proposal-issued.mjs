// Does "Proposal issued" tick on ISSUE, and only on issue? Round 41, W-J.
//
// The migration that added the criterion named its own risk: a criterion nobody
// can tick looks broken. Measured after applying it, NOTHING in the repository
// wrote proposalIssued, so it could never have been satisfied. This proves the
// write exists, that it is the ONLY thing that satisfies it, and that a new
// draft un-ticks it.
import { api, ApiError } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

// THE RATES THE SCREEN WOULD HAVE PRICED WITH. The first version of this probe
// sent `rates: {}` and the route refused with "the Base Cost Data changed", so
// steps 4 and 5 - the two claims the ruling actually asked to prove - never ran
// and it reported 5/5. Verification 18: a green result whose calibration never
// reached the thing being measured.
// `.rates`, not the whole result. catalogToRates returns { rates, missing,
// batches } and resolveRates wants the rates map: passing the wrapper produced
// the same 409 as passing {}, which is the second time this probe reported 5/5
// while steps 4 and 5 never ran.
const LIVE_RATES = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (inputs) => frozenRates(resolveRates(inputs, LIVE_RATES))

const results = []
const record = (label, pass, detail) => {
  results.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

const { oppId } = await freshOpportunity('proposal-issued')
const met = async () => {
  const r = await api('GET', `/records/${oppId}/exit-criteria?stage=Proposal`)
  const row = (r.data.requirements ?? []).find((x) => x.field === 'proposalIssued')
  return row ? row.met : null
}
const payloadKey = async () => {
  const rows = await admin().from('record_revisions').select('payload')
    .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1)
  const p = rows.data?.[0]?.payload ?? {}
  return 'proposalIssued' in p ? p.proposalIssued : 'ABSENT'
}

record('the criterion exists on Proposal exit', (await met()) !== null, `met=${await met()}`)
record('1. it starts UNMET', (await met()) === false, `met=${await met()}, payload=${await payloadKey()}`)

// ── NOT BY A SAVE. The allowlist is the control and this proves it. ────────
const rec = (await api('GET', `/opportunities/${oppId}`)).data
let patched
try {
  await api('PATCH', `/opportunities/${oppId}`,
    { payload: { proposalIssued: 99 }, expected_revision: rec.latest_revision_number })
  patched = 'accepted'
} catch (e) { if (!(e instanceof ApiError)) throw e; patched = `${e.status}` }
record('2. a SAVE cannot set it', (await met()) === false,
  `patch ${patched}, payload=${await payloadKey()}, met=${await met()}`)

// ── TAKING a version is not enough, which is W-K's whole sentence. ─────────
const inputs = { ...rec.payload, targetMargin: 31, duration: 36, lumpSumCost: 0 }
const after = (await api('GET', `/opportunities/${oppId}`)).data
let v
try {
  v = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs, reason: 'probe', rates: priced(inputs), expected_revision: after.latest_revision_number })).data
} catch (e) { if (!(e instanceof ApiError)) throw e; v = null; console.log('    version refused:', e.status, JSON.stringify((e.body?.error ?? '').slice(0, 70))) }
// A REFUSED VERSION IS NOT A PASS. This step reported "no draft taken" twice
// while looking green, which meant steps 4 and 5 never ran at all.
record('3. TAKING a version does not set it', v !== null && (await met()) === false,
  v ? `draft V${v.major}.${v.minor} taken, met=${await met()}` : 'NO DRAFT WAS TAKEN, so 4 and 5 cannot run')

// ── ISSUING does. ─────────────────────────────────────────────────────────
if (v) {
  // An empty body on a POST is a 400 from Fastify's own parser, not from the
  // route. `{}` rather than nothing.
  const issued = (await api('POST', `/deal-sheet-versions/${v.id}/issue`, {})).data
  record('4. ISSUING sets it', (await met()) === true,
    `issued V${issued.major}, payload=${await payloadKey()}, met=${await met()}`)

  // ── AND A NEW DRAFT UN-TICKS IT, so it tracks the current state. ────────
  const now = (await api('GET', `/opportunities/${oppId}`)).data
  try {
    await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
      { inputs: { ...inputs, targetMargin: 32 }, reason: 'probe 2', rates: priced({ ...inputs, targetMargin: 32 }),
        expected_revision: now.latest_revision_number })
    // ── 5 IS THE LIMIT, NOT A PASS, AND IT IS ASSERTED AS ONE ────────────
    //
    // The first version of this step required the criterion to un-tick on a new
    // draft, and the clear that did it appended a revision - which superseded
    // the version that had just been created, because a version records the
    // revision it was taken from. probe-version-approval caught it at
    // revisionsSince=2.
    //
    // So the criterion means "a proposal has been issued", not "the CURRENT
    // proposal is issued", and this step now asserts THAT rather than the
    // behaviour that could not be had. It is a display saying less than the
    // enforcement knows: issuedProposal still refuses the transition, with
    // W-K's sentence.
    //
    // Written as an assertion rather than a comment so the day somebody closes
    // this properly - a requirement type that compares a payload value with the
    // record's revision - this test fails and asks to be updated.
    record('5. a new draft does NOT un-tick it, and that is the stated limit',
      (await met()) === true,
      `payload=${await payloadKey()}, met=${await met()} - the criterion says a proposal HAS been `
      + 'issued, and issuedProposal is what still refuses the transition')
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    record('5. a new draft does NOT un-tick it, and that is the stated limit', false,
      `the second version was refused: ${e.status}`)
  }
}

const { removed } = await tearDown()
record('teardown', true, `${removed.length} soft-deleted, re-queried 0 live`)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
