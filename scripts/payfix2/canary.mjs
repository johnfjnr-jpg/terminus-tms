import { createClient } from '@supabase/supabase-js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { catalogToRates, resolveCurrentBatches } from '../../src/lib/base-costs.js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const rows = must(await db.from('base_cost_batches').select('*'), 'bc')
const rates = catalogToRates(resolveCurrentBatches(rows, new Date().toISOString().slice(0, 10))).rates
const derive = (p) => calculateDeal(buildDealInputs(p, { testBedCost: 0, rates: resolveRates(p, rates).rates }))
const flat = (o, pre = '', out = {}) => { for (const [k, v] of Object.entries(o ?? {})) {
  const key = pre ? `${pre}.${k}` : k
  if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = Array.isArray(v) ? JSON.stringify(v) : v } ; return out }
const recs = must(await db.from('records').select('id, reference_code')
  .in('reference_code', ['TT-SGP-MANUFI-005', 'TT-SGP-SMARTC-003']), 'r')
for (const r of recs) {
  const p = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', r.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0].payload
  const base = flat(derive(p))
  const keys = Object.keys(base)
  console.log(`\n${r.reference_code}  (${keys.length} derived values)`)
  console.log(`   keys: ${keys.join(', ')}`)
  const canaries = {
    'targetMargin 30 -> 35': { ...p, targetMargin: 35 },
    'ssExisting +10': { ...p, ssExisting: Number(p.ssExisting) + 10 },
    'duration +12': { ...p, duration: Number(p.duration) + 12 },
    'warrantyPct 2 -> 9': { ...p, warrantyPct: 9 },
    'structure -> twoPhase': { ...p, structure: 'twoPhase', recoveryMonths: 12 },
    'paymentMode -> opex (THE MIGRATION)': { ...p, paymentMode: 'opex' },
  }
  for (const [name, mutated] of Object.entries(canaries)) {
    const after = flat(derive(mutated))
    const moved = keys.filter((k) => String(base[k]) !== String(after[k]))
    console.log(`   ${String(moved.length).padStart(3)} moved   ${name}${moved.length && moved.length < 20 ? '   [' + moved.join(', ') + ']' : ''}`)
  }
}
