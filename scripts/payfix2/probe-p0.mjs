// ── PHASE 0 FOR R-PT3: MEASURE BEFORE ANYTHING IS WRITTEN ───────────────
//
// John's ruling requires the count re-verified before writing, and it rests on
// "same economics". THAT IS A CLAIM, SO IT IS MEASURED HERE RATHER THAN
// INHERITED from the earlier round's wording.
//
// The three questions:
//   1. is the population still exactly the two records the census named?
//   2. do those two carry any OPEX fee or margin override? If they do, the
//      allocation in deal-inputs is NOT a no-op and the migration reprices a
//      live deal.
//   3. derived side by side, does every figure agree between paymentMode
//      'capex' and 'opex' on each record's own current payload?
//
// UNWIRED: needs the service key and the live database.
import { createClient } from '@supabase/supabase-js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { catalogToRates, resolveCurrentBatches } from '../../src/lib/base-costs.js'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } })
// Verification 8: destructure `error` and throw. A `?? []` here turns a failed
// read into a zero that reads exactly like a measurement.
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
const pagedAll = async (table, sel, tweak = (q) => q) => {
  const out = []
  for (let from = 0; ; from += 1000) {
    const rows = must(await tweak(db.from(table).select(sel)).range(from, from + 999), table)
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

// ── THE POPULATION, AND ITS COVERAGE IS ASSERTED RATHER THAN ASSUMED ─────
const { count: liveTotal } = await db.from('records')
  .select('id', { count: 'exact', head: true })
  .eq('record_type', 'opportunity').is('deleted_at', null)
const live = await pagedAll('records', 'id, reference_code, status, owner_id',
  (q) => q.eq('record_type', 'opportunity').is('deleted_at', null))
if (live.length !== liveTotal) {
  throw new Error(`the scan examined ${live.length} of ${liveTotal} live opportunities, `
    + 'so a clean result would mean nothing')
}
console.log(`${live.length} live opportunities, and the scan walked all ${liveTotal} of them`)

const latest = new Map()
for (const r of await pagedAll('record_revisions', 'record_id, revision_number, payload',
  (q) => q.in('record_id', live.map((x) => x.id)))) {
  const prev = latest.get(r.record_id)
  if (!prev || r.revision_number > prev.revision_number) latest.set(r.record_id, r)
}

const byCombo = new Map()
const hits = []
for (const r of live) {
  const p = latest.get(r.id)?.payload ?? {}
  const mode = String(p.paymentMode ?? 'capex')
  const structure = p.structure ?? '(none)'
  const k = `${mode} / ${structure}`
  byCombo.set(k, (byCombo.get(k) ?? 0) + 1)
  if (mode === 'capex' && structure === 'single') {
    hits.push({ ...r, payload: p, revision: latest.get(r.id).revision_number })
  }
}
console.log('\n── every live opportunity by mode and structure ──')
for (const [k, n] of [...byCombo].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`)

console.log(`\n── CAPEX SINGLE PHASE, RE-VERIFIED: ${hits.length} ──`)
const RULED = ['TT-SGP-SMARTC-003', 'TT-SGP-MANUFI-005']
const found = hits.map((h) => h.reference_code).sort()
console.log(`  ruled: ${RULED.join(', ')}`)
console.log(`  found: ${found.join(', ')}`)
const sameSet = found.length === RULED.length && found.every((c, i) => c === [...RULED].sort()[i])
console.log(`  THE POPULATION IS ${sameSet ? 'UNCHANGED since the census' : 'DIFFERENT - STOP AND REPORT'}`)

// ── VERSIONS, SO THE ISSUED ONES ARE NAMED BEFORE ANYTHING MOVES ─────────
const versions = must(await db.from('deal_sheet_versions')
  .select('record_id, major, minor, status, inputs, revision_number')
  .in('record_id', hits.map((h) => h.id)), 'versions')
console.log('\n── versions on those records ──')
for (const h of hits) {
  const vs = versions.filter((v) => v.record_id === h.id)
    .sort((a, b) => b.major - a.major || b.minor - a.minor)
  console.log(`  ${h.reference_code}  rev ${h.revision}  ${h.status}`)
  for (const v of vs) {
    console.log(`      V${v.major}.${v.minor}/${v.status}  frozen structure=${
      v.inputs?.structure ?? '(none)'}  paymentMode=${v.inputs?.paymentMode ?? '(none)'}`)
  }
}
const issued = versions.filter((v) => v.status === 'issued')
console.log(`  ISSUED versions across that set: ${issued.length}`)

// ── IS THE MIGRATION ECONOMICALLY INERT? DERIVED, NOT ARGUED ────────────
const catalogRows = must(await db.from('base_cost_batches').select('*'), 'base costs')
const asOf = new Date().toISOString().slice(0, 10)
// `catalogToRates` returns { rates, missing, batches }, NOT the flat map. The
// first version of this passed the WRAPPER, so every rate lookup missed and the
// calculator priced hardware at 0 on both records - the same shape as the
// approval-page zeros defect, reproduced here in the instrument.
const rates = catalogToRates(resolveCurrentBatches(catalogRows, asOf)).rates
const derive = (payload) => {
  const res = resolveRates(payload, rates)
  return calculateDeal(buildDealInputs(payload, { testBedCost: 0, rates: res.rates }))
}
const flat = (o, pre = '', out = {}) => {
  for (const [k, v] of Object.entries(o ?? {})) {
    const key = pre ? `${pre}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out)
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v
  }
  return out
}
console.log('\n── IS THE MIGRATION ECONOMICALLY INERT? ──')
for (const h of hits) {
  const feeKeys = Object.keys(h.payload.opexUnitFees ?? {})
  const marginKeys = Object.keys(h.payload.opexUnitMargins ?? {})
  console.log(`\n  ${h.reference_code}`)
  console.log(`    opexUnitFees: ${feeKeys.length ? feeKeys.join(',') : 'NONE'}`
    + `   opexUnitMargins: ${marginKeys.length ? marginKeys.join(',') : 'NONE'}`)
  const before = flat(derive(h.payload))
  const after = flat(derive({ ...h.payload, paymentMode: 'opex' }))
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const diffs = keys.filter((k) => String(before[k]) !== String(after[k]))
  console.log(`    ${keys.length} derived values compared`)
  if (diffs.length === 0) console.log('    IDENTICAL: the migration moves no figure')
  else for (const k of diffs.slice(0, 20)) console.log(`    DIFFERS ${k}: ${before[k]} -> ${after[k]}`)
  // CALIBRATION: the comparator must be able to SEE a difference, or
  // "identical" is a reading from an instrument never shown reaching non-zero.
  const canary = flat(derive({ ...h.payload, targetMargin: Number(h.payload.targetMargin ?? 30) + 5 }))
  const canaryDiffs = keys.filter((k) => String(before[k]) !== String(canary[k]))
  console.log(`    calibration: a 5-point margin change moves ${canaryDiffs.length} of these values`)
}
