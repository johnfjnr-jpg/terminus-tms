// ── PHASE 0(a): WHERE THE ZERO COMES FROM, MEASURED ─────────────────────
//
// Read from source: the route builds its catalog argument as
//   catalog: { batches, missing, asOf }
// and `buildApprovalPage` opens with
//   resolveRates(payload, catalog.rates ?? {})
// so the derivation runs against an EMPTY rate table. `currentRates` returns
// `rates` and the object literal drops it.
//
// That is a reading. This is the measurement: the live route's own answer for a
// real record, beside the same derivation run with the real catalog.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { api } from '../api-client.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const REF = process.env.C_REF ?? 'TT-SGP-MANUFI-004'

const rec = must(await db.from('records').select('id, reference_code').eq('reference_code', REF).single(), 'record')
const latest = must(await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', rec.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
const versions = must(await db.from('deal_sheet_versions')
  .select('id, major, minor, status, inputs, rates, reason, created_by_email, revision_number')
  .eq('record_id', rec.id).order('major', { ascending: false }).order('minor', { ascending: false }), 'versions')
const issued = versions.find((v) => v.status === 'issued') ?? versions[0]

console.log(`\n════ ${REF} ════`)
// WHAT THE PAGE ANSWERS TODAY, over HTTP, as the signed-in user.
const page = (await api('GET', `/opportunities/${rec.id}/approval-page`)).data
console.log('\n── the approval page, as the route answers it ──')
console.log(`  contract net      ${page?.ask?.contractNet}`)
console.log(`  total cost        ${page?.ask?.totalCost}`)
console.log(`  achieved margin   ${page?.ask?.achievedMargin}`)
console.log(`  units             ${page?.ask?.units}`)
console.log(`  term              ${page?.ask?.termMonths}`)

// THE SAME DERIVATION WITH THE REAL CATALOG, over the record's own payload.
const live = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const withCatalog = calculateDeal(buildDealInputs(latest.payload,
  { testBedCost: 0, rates: resolveRates(latest.payload, live).rates }))
console.log('\n── the same derivation, with the real catalog ──')
console.log(`  contract net      ${withCatalog.totals.contractNet}`)
console.log(`  total cost        ${withCatalog.totalDealCostAll}`)
console.log(`  achieved margin   ${withCatalog.achievedMargin}`)

// AND OVER THE FROZEN SNAPSHOT, which is what the round is asked to render.
const frozen = issued?.rates?.rates ?? {}
const overSnapshot = calculateDeal(buildDealInputs(issued?.inputs ?? {},
  { testBedCost: 0, rates: resolveRates(issued?.inputs ?? {}, frozen).rates }))
console.log(`\n── the same derivation, over V${issued?.major}.${issued?.minor}'s frozen snapshot ──`)
console.log(`  contract net      ${overSnapshot.totals.contractNet}`)
console.log(`  total cost        ${overSnapshot.totalDealCostAll}`)
console.log(`  achieved margin   ${overSnapshot.achievedMargin}`)

// THE ZERO'S ORIGIN, DEMONSTRATED: the same call with an empty rate table.
const empty = calculateDeal(buildDealInputs(latest.payload,
  { testBedCost: 0, rates: resolveRates(latest.payload, {}).rates }))
console.log('\n── the same derivation with an EMPTY rate table, which is what the page does ──')
console.log(`  contract net      ${empty.totals.contractNet}`)
console.log(`  total cost        ${empty.totalDealCostAll}`)
console.log(`  achieved margin   ${empty.achievedMargin}`)
console.log(`\n  the page and the empty-rate run agree: `
  + `${Number(page?.ask?.contractNet) === Number(empty.totals.contractNet)}`)
console.log(`  the record's payload carries a unit cost: `
  + `${['ssUnitCost', 'aqUnitCost', 'hemirUnitCost'].some((k) => latest.payload?.[k] != null)}`)
