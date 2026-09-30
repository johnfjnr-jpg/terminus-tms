// ── R-TL2 SERVER SIDE: THE INERT MARGIN IS DROPPED ON SAVE ──────────────
//
// John's ruling 2026-09-30. Where one OPEX row stores both a fee and a margin,
// the margin is dropped on save. The fee already wins pricing under R-O7, so
// the margin is INERT - and this probe ASSERTS that inertness rather than
// asserting it in prose, because "dropping it changes nothing" is the whole
// justification for dropping it rather than refusing the save.
//
// Proved over HTTP, as the signed-in user, on the SUCCESS path (Verification
// 40): a suite of refusals is satisfied by a route that refuses everything.
//
// UNWIRED: needs a live server and a session.
import { freshOpportunity, tearDown, admin, handOver } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates, resolveCurrentBatches } from '../src/lib/base-costs.js'
import { resolveRates } from '../src/lib/rate-resolution.js'
import { buildDealInputs } from '../src/lib/deal-inputs.js'
import { calculateDeal } from '../src/lib/deal-calculator.js'
import { opexRows } from '../src/lib/opex.js'

const TAG = 'TL2EITHER'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const { oppId } = await freshOpportunity(TAG)
const get = async () => (await api('GET', `/opportunities/${oppId}`)).data
const rev = async () => (await get())?.latest_revision_number

/** The shape the defect lives in: OPEX, Lump Sum, a fee AND a margin on ss. */
const BOTH = {
  paymentMode: 'opex', structure: 'single',
  ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
  duration: 60, targetMargin: 30, warrantyPct: 0,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
  invoicing: 'monthly',
  opexUnitFees: { ss: 500 },
  opexUnitMargins: { ss: 0, aq: 41 },
}

// ── FIRST, THE INERTNESS, LOCALLY. If dropping the margin moved a figure,
// dropping it would be a pricing change and the ruling's own reasoning would
// not hold. Measured before the save, so the claim is checked rather than
// repeated.
{
  const { data: batches } = await admin().from('base_cost_batches').select('*')
  const current = resolveCurrentBatches(batches ?? [], new Date().toISOString().slice(0, 10))
  const RATES = catalogToRates(current).rates
  const price = (p) => {
    const { rates } = resolveRates(p, RATES)
    return opexRows(calculateDeal(buildDealInputs(p, { testBedCost: 0, rates })), p, rates)
  }
  const withMargin = price(BOTH)
  const without = price({ ...BOTH, opexUnitMargins: { aq: 41 } })
  const same = withMargin.every((r, i) => r.contractTotal === without[i].contractTotal
    && r.monthlyFee === without[i].monthlyFee)
  check(same, 'the margin beside a fee is INERT: dropping it moves no figure',
    withMargin.map((r, i) => `${r.key} ${r.contractTotal} vs ${without[i].contractTotal}`).join(' | '))
}

// ── THE SAVE DROPS IT ──────────────────────────────────────────────────
await api('PATCH', `/opportunities/${oppId}`, { payload: BOTH, expected_revision: await rev() })
const after = await get()
const savedFees = after?.payload?.opexUnitFees ?? {}
const savedMargins = after?.payload?.opexUnitMargins ?? {}

check(savedFees.ss === 500, 'the FEE survives the save', JSON.stringify(savedFees))
check(!('ss' in savedMargins), 'and the inert margin on that row is DROPPED',
  JSON.stringify(savedMargins))
// THE OTHER ROW'S MARGIN IS UNTOUCHED. A drop that took every margin would
// pass the assertion above and destroy a decision on a different row.
check(savedMargins.aq === 41, 'while ANOTHER row keeps its margin', JSON.stringify(savedMargins))

// ── AND A ROW WITH ONLY A MARGIN IS LEFT ALONE ─────────────────────────
await api('PATCH', `/opportunities/${oppId}`, {
  payload: { ...BOTH, opexUnitFees: {}, opexUnitMargins: { ss: 22, aq: 41 } },
  expected_revision: await rev(),
})
const marginOnly = (await get())?.payload?.opexUnitMargins ?? {}
check(marginOnly.ss === 22 && marginOnly.aq === 41,
  'a margin with NO fee beside it is kept', JSON.stringify(marginOnly))

// ── THE NON-OWNER CHECK ────────────────────────────────────────────────
//
// The point is not that a stranger is refused: it is that they are refused for
// OWNERSHIP, above this rule, so R-TL2 can never be what lets one through.
{
  const db = admin()
  const { data: someone } = await db.from('track_approvers')
    .select('user_id').eq('record_type', 'opportunity').limit(1).maybeSingle()
  if (!someone?.user_id) {
    check(false, 'a real second identity was available for the non-owner check',
      'no track_approvers row: the non-owner half did NOT run')
  } else {
    const { oppId: theirs } = await freshOpportunity(`${TAG}NB`)
    const theirRev = (await api('GET', `/opportunities/${theirs}`)).data?.latest_revision_number
    await handOver(theirs, someone.user_id)
    const refused = await api('PATCH', `/opportunities/${theirs}`,
      { payload: BOTH, expected_revision: theirRev },
      { expect: 403, because: 'a non-owner is refused on OWNERSHIP, above the R-TL2 drop' })
    check(refused?.status === 403, 'a NON-OWNER cannot save at all', `status ${refused?.status}`)
    const why = String(refused?.data?.error ?? '')
    check(/another user|owner/i.test(why),
      'and is refused for OWNERSHIP, not by the either-or rule', why.slice(0, 70))
    await tearDown(`${TAG}NB`)
  }
}

await tearDown(TAG)
const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} R-TL2 server checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
