import { createClient } from '@supabase/supabase-js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { catalogToRates, resolveCurrentBatches } from '../../src/lib/base-costs.js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const rows = must(await db.from('base_cost_batches').select('*'), 'bc')
console.log(`base_cost_batches rows: ${rows.length}`)
const resolved = resolveCurrentBatches(rows, new Date().toISOString().slice(0, 10))
console.log(`resolveCurrentBatches -> ${Array.isArray(resolved) ? resolved.length + ' products' : typeof resolved}`)
const rates = catalogToRates(resolved).rates
console.log(`catalogToRates().rates -> ${Object.keys(rates).length} keys: ${JSON.stringify(rates).slice(0, 240)}`)
const recs = must(await db.from('records').select('id, reference_code')
  .in('reference_code', ['TT-SGP-MANUFI-005', 'TT-SGP-SMARTC-003']), 'r')
for (const r of recs) {
  const p = must(await db.from('record_revisions').select('payload')
    .eq('record_id', r.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0].payload
  const res = resolveRates(p, rates)
  const out = calculateDeal(buildDealInputs(p, { testBedCost: 0, rates: res.rates }))
  console.log(`\n${r.reference_code}`)
  console.log(`   resolveRates missing: ${JSON.stringify(res.missing ?? res.missingKeys ?? '(none reported)').slice(0, 160)}`)
  console.log(`   costIncomplete   ${out.costIncomplete}`)
  console.log(`   totalUnits       ${out.hardware.totalUnits}`)
  console.log(`   hardwareCost     ${out.hardware.hardwareCost}`)
  console.log(`   oneOffPrice      ${out.totals.oneOffPrice}`)
  console.log(`   contractNet      ${out.totals.contractNet}`)
  console.log(`   achievedMargin   ${out.achievedMargin}`)
}
