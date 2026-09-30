// ── H2: SUBMITTING A VERSION WITH NO FROZEN RATES IS REFUSED ─────────────
//
// Proved FROM THE CLICK, over HTTP, as the signed-in user, both directions:
// the refusal fires on a version with an empty rates column and is SILENT on a
// healthy one taken from current pricing (Verification 9).
//
// AND THE REFUSAL HOLDS FOR EVERY IDENTITY. John's ruling asks for a real
// non-owner check, because a guard that only refuses the owner is not a guard:
// the ownership refusal sits ABOVE this one in the route, so a non-owner must
// still be refused, and the interesting half is that they are refused for
// OWNERSHIP rather than for rates. Asserting the REASON, not the status, is
// Verification 14's clause about an alarm firing for the wrong reason.
//
// UNWIRED: needs a live server and session. Recorded as unwired with the reason.
import { freshOpportunity, tearDown, admin, handOver } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const TAG = 'H2RATES'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const { oppId } = await freshOpportunity(TAG)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const mk = async (inputs, reason) => (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs, rates: frozenRates(resolveRates(inputs, LIVE)), reason, expected_revision: await rev() })).data
const submit = (id, opts) => api('POST', `/deal-sheet-versions/${id}/issue`, {}, opts)

// ── THE HEALTHY DIRECTION FIRST, so a refusal that fires on everything is
// visible as such rather than read as the guard working.
const good = await mk({ targetMargin: 30 }, 'priced from the live catalog')
const okRes = await submit(good.id)
check(okRes?.ok === true, 'a version WITH frozen rates submits normally', `status ${okRes?.status}`)

// ── THE EMPTY ONE. Built by admin write, because the route now REFUSES to
// create one and that refusal is a different control. Verification 47's clause:
// where the system cannot reach a state with one account, build it directly and
// say so. The value written is one the system itself produced - 14 real rows
// carry exactly this shape.
const empty = await mk({ targetMargin: 31 }, 'about to have its rates emptied')
const { error: upErr } = await admin().from('deal_sheet_versions')
  .update({ rates: {} }).eq('id', empty.id)
if (upErr) throw new Error(`could not build the fixture: ${upErr.message}`)
const { data: readBack } = await admin().from('deal_sheet_versions')
  .select('rates').eq('id', empty.id).maybeSingle()
check(Object.keys(readBack?.rates ?? {}).length === 0,
  'the fixture genuinely has an empty rates column', JSON.stringify(readBack?.rates))

const bad = await submit(empty.id, { expect: 409, because: 'H2 refuses a version with no frozen rates' })
check(bad?.status === 409, 'submitting it is REFUSED with 409', `status ${bad?.status}`)
// THE REASON, not the status. A 409 for "already submitted" would pass a
// status-only check while proving nothing about this guard.
const said = String(bad?.data?.error ?? '')
check(/no frozen rates/i.test(said), 'and the refusal names the frozen rates', said.slice(0, 90))

// ── AND IT STAYS A DRAFT. A refusal that half-applied would be worse than none.
const { data: after } = await admin().from('deal_sheet_versions')
  .select('status, major, minor').eq('id', empty.id).maybeSingle()
// COMPARED WITH WHAT IT WAS, not with a guessed V0.x. The first submission in
// this probe creates V1.0, so the next draft is V1.1 - asserting `major === 0`
// was a hand-derived expectation and it was wrong about the fixture rather than
// about the product (Verification 20: express the expectation, never restate it).
check(after?.status === 'draft' && after?.major === empty.major && after?.minor === empty.minor,
  'the refused version is untouched, still a draft at the number it had',
  `was V${empty.major}.${empty.minor}, now V${after?.major}.${after?.minor}/${after?.status}`)

await tearDown(TAG)
const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} H2 checks passed`)
process.exitCode = pass === checks.length ? 0 : 1

// ── AND THE REFUSAL HOLDS FOR EVERY IDENTITY ────────────────────────────
//
// John's ruling asks for a real non-owner check. The point is NOT that a
// non-owner also gets a 409: it is that they are refused for OWNERSHIP, which
// sits above this guard in the route, so H2 can never be the thing that lets a
// stranger through. Asserting the REASON separates the two refusals; a
// status-only check would read both as "refused" and prove neither.
//
// A REAL SECOND IDENTITY, taken from track_approvers, because owner_id carries
// a foreign key and refuses a fabricated uuid (Verification 47's clause).
{
  const db = admin()
  const { data: someone } = await db.from('track_approvers')
    .select('user_id').eq('record_type', 'opportunity').limit(1).maybeSingle()
  const otherOwner = someone?.user_id ?? null
  if (!otherOwner) {
    // REPORTED, not silently skipped. A check that quietly does not run is the
    // silence this estate has been caught by (Verification 51).
    check(false, 'a real second identity was available for the non-owner check',
      'no track_approvers row: the non-owner half did NOT run')
  } else {
    const { oppId: otherOpp } = await freshOpportunity(`${TAG}NB`)
    const oRev = async () => (await api('GET', `/opportunities/${otherOpp}`)).data?.latest_revision_number
    const theirs = (await api('POST', `/opportunities/${otherOpp}/deal-sheet-versions`, {
      inputs: { targetMargin: 32 }, rates: frozenRates(resolveRates({ targetMargin: 32 }, LIVE)),
      reason: 'theirs', expected_revision: await oRev(),
    })).data
    await db.from('deal_sheet_versions').update({ rates: {} }).eq('id', theirs.id)
    await handOver(otherOpp, otherOwner)

    const refused = await submit(theirs.id,
      { expect: 403, because: 'a non-owner is refused on OWNERSHIP, above the H2 guard' })
    check(refused?.status === 403, 'a NON-OWNER is refused', `status ${refused?.status}`)
    const why = String(refused?.data?.error ?? '')
    check(!/no frozen rates/i.test(why),
      'and refused for OWNERSHIP, not for the rates: H2 is never what admits a stranger',
      why.slice(0, 80))
    await tearDown(`${TAG}NB`)
  }
}

const pass2 = checks.filter(Boolean).length
console.log(`\nFINAL ${pass2}/${checks.length} H2 checks passed`)
process.exitCode = pass2 === checks.length ? 0 : 1
