// ── P6: THE THREE STATES, DRIVEN LIVE AND READ BACK ──────────────────────
//
// John's walk 2026-09-27 asked for all three driven live rather than asserted
// in a unit test. The grammar is proved pure in `version-label.test.mjs`; what
// is proved HERE is that the record actually reaches each state and that the
// server's derivation reports it.
//
// THE FIXTURE IS BUILT THE WAY THE SYSTEM BUILDS IT (Verification 47): a real
// version through the real route, a real edit through the real PATCH, and the
// field read from the real GET rather than computed a second way here.
//
// UNWIRED: needs a live server and a signed-in session.
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../../src/lib/rate-resolution.js'
import { mkdirSync, writeFileSync } from 'node:fs'

/* THE VERSION ROUTE REQUIRES THE RATES ITS SCREEN PRICED AGAINST, and it is
   right to: a version records what it was priced against so the server can
   confirm they still agree with the catalog. `.rates`, not the wrapper -
   `catalogToRates` returns `{ rates, missing, batches }` and this estate has
   twice reported a green run after passing the whole object. */
const LIVE_RATES = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (inputs) => frozenRates(resolveRates(inputs, LIVE_RATES))

const OUT = '/Users/johnfryatt/terminus-tms/.verify/adjustments/'
mkdirSync(OUT, { recursive: true })
const TAG = process.env.C_TAG ?? 'adjwv'
const lines = []
const say = (s) => { lines.push(s); console.log(s) }
let pass = 0, fail = 0
const check = (ok, what) => {
  if (ok) { pass++; say(`    ok   ${what}`) } else { fail++; say(`    FAIL ${what}`) }
}

const BASE = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, whtPct: 15, gstPct: 8,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 250000,
  paymentMode: 'capex', structure: 'twoPhase',
}

const { oppId } = await freshOpportunity(TAG)
// `.data`, because `api()` returns the envelope. Reading the wrapper gave
// `undefined` for every field and would have reported the no-version state as
// a pass in all three.
const headline = async () => (await api('GET', `/opportunities/${oppId}`)).data?.working_version ?? null
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number ?? 1

try {
  say(`P6 working version, live   opportunity ${oppId}`)

  // ── NO VERSION AT ALL ──────────────────────────────────────────────────
  await api('PATCH', `/opportunities/${oppId}`, { payload: BASE })
  const none = await headline()
  check(none === null,
    `a record with no version reports nothing to name (got ${JSON.stringify(none)})`)

  // ── STATE 2: DRAFT SAVED, UNCHANGED SINCE ──────────────────────────────
  // Saved first, because the other two states are reached FROM a saved
  // version rather than constructed independently.
  const v = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs: BASE, reason: 'initial pricing', rates: priced(BASE),
      expected_revision: await rev() })).data
  const vid = v?.id
  const draftLabel = await headline()
  say(`  after saving a draft            ${JSON.stringify(draftLabel)}`)
  check(/^V\d+(\.\d+)?$/.test(draftLabel ?? ''),
    'draft saved, unchanged since: the bare label, no suffix')

  // ── STATE 3: DRAFT SAVED, EDITED SINCE ─────────────────────────────────
  // The edit MOVES PRICING, because `pricingChanged` is what the field reads
  // and a change it cannot see is not an edit as far as this claim goes.
  await api('PATCH', `/opportunities/${oppId}`,
    { payload: { ...BASE, targetMargin: 41 } })
  const edited = await headline()
  say(`  after editing the record        ${JSON.stringify(edited)}`)
  check(edited === `${draftLabel} - Under Edit`,
    `draft saved, edited since: "${draftLabel} - Under Edit"`)

  // ── STATE 1: ISSUED, EDITED SINCE, NO DRAFT SAVED ──────────────────────
  // Issuing the draft makes it a major; the record is then edited again, so
  // the latest version is ISSUED and the record has moved past it.
  await api('PATCH', `/opportunities/${oppId}`, { payload: BASE })
  if (vid) {
    await api('POST', `/deal-sheet-versions/${vid}/issue`, {})
    const issuedClean = await headline()
    say(`  after issuing it               ${JSON.stringify(issuedClean)}`)
    await api('PATCH', `/opportunities/${oppId}`,
      { payload: { ...BASE, targetMargin: 44 } })
    const issuedEdited = await headline()
    say(`  after editing past the issue   ${JSON.stringify(issuedEdited)}`)
    check(/ - Under Edit - Not saved$/.test(issuedEdited ?? ''),
      `issued, edited since, no draft saved: "<label> - Under Edit - Not saved"`)
    // AND THE THREE ARE DIFFERENT, or the field says the same thing in every
    // state and none of the assertions above mean anything.
    check(new Set([draftLabel, edited, issuedEdited]).size === 3,
      'the three states read differently from one another')
  } else {
    check(false, 'the version route returned no id, so the issued states were not reached')
  }
} finally {
  say(`\n${pass} of ${pass + fail} checks passed`)
  writeFileSync(`${OUT}working-version.txt`, lines.join('\n') + '\n')
  await tearDown(TAG)
}
process.exit(fail ? 1 : 0)
