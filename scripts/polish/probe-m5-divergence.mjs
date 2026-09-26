// ── M5: DOES THE SCREEN'S DEFAULT AGREE WITH THE STORED PAYLOAD? ────────
//
// The screen already defaults an absent structure to Two-phase
// (`uiFromPayload`: `(p.structure as string) || 'twoPhase'`), measured live.
// The STORED payload has no structure at all, and every server-side reader -
// the approval page, a frozen version snapshot - derives from that payload.
//
// `deal-calculator.js` gives an absent structure `recov = null` and a two-phase
// one `recov = recoveryMonths`. So the two readings can only differ where a
// recovery period is SET, which is the case this measures.
//
// UNWIRED: needs the service key.
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { catalogToRates, resolveCurrentBatches } from '../../src/lib/base-costs.js'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const rows = must(await db.from('base_cost_batches').select('*').limit(500), 'bc')
const rates = catalogToRates(resolveCurrentBatches(rows, new Date().toISOString().slice(0, 10))).rates
const derive = (p) => calculateDeal(buildDealInputs(p, { testBedCost: 0, rates: resolveRates(p, rates).rates }))
const flat = (o, pre = '', out = {}) => { for (const [k, v] of Object.entries(o ?? {})) {
  const key = pre ? `${pre}.${k}` : k
  if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = Array.isArray(v) ? JSON.stringify(v) : v }; return out }

const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit', invoicing: 'annual',
}
for (const recoveryMonths of [null, 12]) {
  const storedShape = { ...base, ...(recoveryMonths === null ? {} : { recoveryMonths }) }   // NO structure key
  const screenShape = { ...storedShape, structure: 'twoPhase' }                              // what the screen computes
  const a = flat(derive(storedShape)), bb = flat(derive(screenShape))
  const keys = [...new Set([...Object.keys(a), ...Object.keys(bb)])]
  const moved = keys.filter((k) => String(a[k]) !== String(bb[k]))
  console.log(`\n── recoveryMonths ${recoveryMonths === null ? 'UNSET' : recoveryMonths} ──`)
  console.log(`   stored (no structure)  recov=${a['cashFlow.recov']}  contractNet=${a['totals.contractNet']}  minCash=${a['cashFlow.minCash']}`)
  console.log(`   screen (twoPhase)      recov=${bb['cashFlow.recov']}  contractNet=${bb['totals.contractNet']}  minCash=${bb['cashFlow.minCash']}`)
  console.log(`   VALUES THAT DIFFER: ${moved.length}${moved.length ? '  [' + moved.join(', ') + ']' : ''}`)
}
