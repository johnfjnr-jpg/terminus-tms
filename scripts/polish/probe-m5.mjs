// ── M5 PHASE 0: WHAT DOES A CAPEX RECORD WITH NO STRUCTURE PRICE AS? ────
//
// The finding says 8 live records are capex with no structure key, and stops
// the round if defaulting them to Two-phase would alter any live record's
// derived figures or touch any issued version's meaning.
//
// WHAT `structure: undefined` DOES TODAY, read from source before measuring:
// `deal-calculator.js` computes `recov = structure === 'single' ? months :
// structure === 'twoPhase' ? (recoveryMonths or null) : null`. An absent
// structure takes the final branch, so recov is null. `schedule.ts` asks only
// whether the structure IS hybrid, so an absent one buckets hardware and
// hosting together exactly as two-phase does.
//
// SO THE DIFFERENCE, IF ANY, IS THE RECOVERY PERIOD, and that is what this
// measures rather than assumes.
//
// AND THERE IS A SECOND QUESTION THE FINDING IMPLIES: the SCREEN already
// defaults. `uiFromPayload` does `(p.structure as string) || 'twoPhase'`, so
// these records already RENDER as Two-phase while their stored payload has no
// structure at all. If the client and the server derivations disagree today,
// that is a live divergence and belongs in the report whatever M5 decides.
//
// UNWIRED: needs the service key and the live database.
import { createClient } from '@supabase/supabase-js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { catalogToRates, resolveCurrentBatches } from '../../src/lib/base-costs.js'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const pagedAll = async (table, sel, tweak = (q) => q) => {
  const out = []
  for (let from = 0; ; from += 1000) {
    const rows = must(await tweak(db.from(table).select(sel)).range(from, from + 999), table)
    out.push(...rows); if (rows.length < 1000) break
  }
  return out
}

const { count: liveTotal } = await db.from('records').select('id', { count: 'exact', head: true })
  .eq('record_type', 'opportunity').is('deleted_at', null)
const live = await pagedAll('records', 'id, reference_code, status',
  (q) => q.eq('record_type', 'opportunity').is('deleted_at', null))
if (live.length !== liveTotal) throw new Error(`scanned ${live.length} of ${liveTotal}`)
console.log(`${live.length} of ${liveTotal} live opportunities walked`)

const latest = new Map()
for (const r of await pagedAll('record_revisions', 'record_id, revision_number, payload',
  (q) => q.in('record_id', live.map((x) => x.id)))) {
  const prev = latest.get(r.record_id)
  if (!prev || r.revision_number > prev.revision_number) latest.set(r.record_id, r)
}
const targets = live.filter((r) => {
  const p = latest.get(r.id)?.payload ?? {}
  return String(p.paymentMode ?? 'capex') === 'capex' && (p.structure === undefined || p.structure === null || p.structure === '')
})
console.log(`\nCAPEX with NO structure key: ${targets.length}  (the finding says 8)`)

const catalogRows = must(await db.from('base_cost_batches').select('*').limit(500), 'base costs')
const rates = catalogToRates(resolveCurrentBatches(catalogRows, new Date().toISOString().slice(0, 10))).rates
const derive = (p) => calculateDeal(buildDealInputs(p, { testBedCost: 0, rates: resolveRates(p, rates).rates }))
const flat = (o, pre = '', out = {}) => { for (const [k, v] of Object.entries(o ?? {})) {
  const key = pre ? `${pre}.${k}` : k
  if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = Array.isArray(v) ? JSON.stringify(v) : v }; return out }

const versions = must(await db.from('deal_sheet_versions')
  .select('record_id, major, minor, status, inputs').in('record_id', targets.map((t) => t.id)), 'versions')

let anyMoved = 0, anyIssuedTouched = 0
console.log('\n── what each prices as TODAY, and what Two-phase would change ──')
for (const t of targets) {
  const p = latest.get(t.id).payload
  const today = derive(p)
  const withDefault = derive({ ...p, structure: 'twoPhase' })
  const a = flat(today), bb = flat(withDefault)
  const keys = [...new Set([...Object.keys(a), ...Object.keys(bb)])]
  const moved = keys.filter((k) => String(a[k]) !== String(bb[k]))
  const vs = versions.filter((v) => v.record_id === t.id)
  const issued = vs.filter((v) => v.status === 'issued')
  if (moved.length) anyMoved++
  if (issued.length) anyIssuedTouched++
  console.log(`\n  ${t.reference_code}  ${t.status}`)
  console.log(`     recoveryMonths stored: ${JSON.stringify(p.recoveryMonths ?? null)}   duration: ${JSON.stringify(p.duration ?? null)}`)
  console.log(`     today  recov=${today.cashFlow.recov}  contractNet=${today.totals.contractNet}  margin=${today.achievedMargin?.toFixed?.(2)}`)
  console.log(`     twoPh  recov=${withDefault.cashFlow.recov}  contractNet=${withDefault.totals.contractNet}  margin=${withDefault.achievedMargin?.toFixed?.(2)}`)
  console.log(`     DERIVED VALUES THAT MOVE: ${moved.length}${moved.length ? '  [' + moved.slice(0, 10).join(', ') + ']' : ''}`)
  console.log(`     versions: ${vs.length ? vs.map((v) => `V${v.major}.${v.minor}/${v.status}`).join(' ') : 'none'}`
    + `   ISSUED: ${issued.length}`)
  for (const v of issued) {
    console.log(`        issued V${v.major}.${v.minor} frozen structure=${JSON.stringify(v.inputs?.structure ?? null)}`)
  }
}

// CALIBRATION: the comparator must be shown able to see a difference on this
// very population, or "0 moved" is a reading from an instrument never shown
// reaching non-zero.
console.log('\n── calibration: can the comparator see a difference on these records? ──')
for (const t of targets.slice(0, 3)) {
  const p = latest.get(t.id).payload
  const a = flat(derive(p))
  const canary = flat(derive({ ...p, ssExisting: Number(p.ssExisting ?? 0) + 10 }))
  const moved = Object.keys(a).filter((k) => String(a[k]) !== String(canary[k]))
  console.log(`  ${t.reference_code}: ssExisting +10 moves ${moved.length} of ${Object.keys(a).length}`)
}

console.log(`\n${'='.repeat(64)}`)
console.log(`records whose DERIVED FIGURES would move: ${anyMoved}`)
console.log(`records in this set carrying ISSUED versions: ${anyIssuedTouched}`)
console.log(anyMoved || anyIssuedTouched
  ? '*** M5 STOP CONDITION MET: report before building. ***'
  : 'M5 stop condition NOT met: the default alters no derived figure and no issued version.')
