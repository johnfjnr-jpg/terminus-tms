// ── R-PT3: THE MIGRATION, AS AN EXPLICIT REVISION EACH ──────────────────
//
// John's ruling, 2026-09-26: the two live records migrate their CURRENT
// structure to OPEX as an EXPLICIT revision each, visible in the revision log,
// reason recorded, no other record touched, count re-verified before writing.
//
// WHAT THE PATCH ACTUALLY IS. Both records store `structure: 'single'` and NO
// `paymentMode` at all, defaulting through `String(payload.paymentMode ??
// 'capex')`. So the migration WRITES `paymentMode: 'opex'` for the first time
// and leaves `structure` exactly as it is: OPEX IS the single-phase mode, and
// `effectiveStructure` returns `'single'` for it. The stored structure key is
// therefore migrated by being made explicit rather than by being changed, and
// Phase 0 measured that this moves 0 of 49 derived values on each record.
//
// `created_by` IS THE ACCOUNT THAT EXECUTES THE WRITE, not the record's owner
// and not John. Attributing it to the owner would say they made a change they
// did not make; the reason note names John's ruling as the authority. The brief
// is silent on this, so it is an implementation decision taken with the
// recommendation and recorded here, revisitable.
//
// DRY RUN BY DEFAULT. Pass `--write` to write.
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { catalogToRates, resolveCurrentBatches } from '../../src/lib/base-costs.js'

const WRITE = process.argv.includes('--write')
const RULED = ['TT-SGP-MANUFI-005', 'TT-SGP-SMARTC-003']
const EXECUTOR = '266a2812-9213-484f-a7fc-e8506241a2ed'          // john+test@terminustechnologies.io
const EXECUTOR_EMAIL = 'john+test@terminustechnologies.io'
const REASON = 'Payment structure migrated to OPEX. Single phase is no longer offered for new '
  + 'pricing (John\'s ruling R-PT3, 2026-09-26); OPEX is the single-phase mode and prices this '
  + 'deal identically. Issued versions keep their own frozen structure and are untouched.'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const stop = (m) => { console.error(`\nSTOP: ${m}`); process.exit(2) }
const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16)

const pagedAll = async (table, sel, tweak = (q) => q) => {
  const out = []
  for (let from = 0; ; from += 1000) {
    const rows = must(await tweak(db.from(table).select(sel)).range(from, from + 999), table)
    out.push(...rows); if (rows.length < 1000) break
  }
  return out
}

// ── 1. THE COUNT, RE-VERIFIED, OVER THE WHOLE POPULATION ────────────────
const { count: liveTotal } = await db.from('records').select('id', { count: 'exact', head: true })
  .eq('record_type', 'opportunity').is('deleted_at', null)
const live = await pagedAll('records', 'id, reference_code, owner_id',
  (q) => q.eq('record_type', 'opportunity').is('deleted_at', null))
if (live.length !== liveTotal) stop(`the scan examined ${live.length} of ${liveTotal} live opportunities`)
const allRevs = await pagedAll('record_revisions', 'record_id, revision_number, payload',
  (q) => q.in('record_id', live.map((x) => x.id)))
const latest = new Map()
for (const r of allRevs) {
  const prev = latest.get(r.record_id)
  if (!prev || r.revision_number > prev.revision_number) latest.set(r.record_id, r)
}
const capexSingle = live.filter((r) => {
  const p = latest.get(r.id)?.payload ?? {}
  return String(p.paymentMode ?? 'capex') === 'capex' && p.structure === 'single'
})
console.log(`${live.length} of ${liveTotal} live opportunities walked`)
console.log(`CAPEX single phase: ${capexSingle.length}  [${capexSingle.map((r) => r.reference_code).sort().join(', ')}]`)
const found = capexSingle.map((r) => r.reference_code).sort()
if (found.length !== RULED.length || found.some((c, i) => c !== [...RULED].sort()[i])) {
  stop(`the population is NOT the ruled set. ruled [${RULED}] found [${found}]. `
    + 'The ruling names two specific records; anything else needs a fresh ruling.')
}
console.log('the population is exactly the ruled set\n')

// ── 2. A FINGERPRINT OF EVERYTHING THAT MUST NOT MOVE ───────────────────
const fingerprint = async () => {
  const revs = await pagedAll('record_revisions', 'record_id, revision_number',
    (q) => q.in('record_id', live.map((x) => x.id)))
  const top = new Map()
  for (const r of revs) top.set(r.record_id, Math.max(top.get(r.record_id) ?? 0, r.revision_number))
  const versions = must(await db.from('deal_sheet_versions')
    .select('id, record_id, major, minor, status, inputs, issued_at').in('record_id', live.map((x) => x.id)), 'versions')
  return {
    revisionTops: [...top].sort().map(([k, v]) => `${k}:${v}`).join(','),
    versions: versions.sort((a, b) => a.id.localeCompare(b.id))
      .map((v) => `${v.id}:${v.status}:${hash(v.inputs)}:${v.issued_at ?? ''}`).join(','),
  }
}
const before = await fingerprint()

// ── 3. THE DERIVED FIGURES, SO INERTNESS IS RE-CHECKED ON THE REAL WRITE ─
const catalogRows = must(await db.from('base_cost_batches').select('*'), 'base costs')
const rates = catalogToRates(resolveCurrentBatches(catalogRows, new Date().toISOString().slice(0, 10))).rates
const derive = (p) => calculateDeal(buildDealInputs(p, { testBedCost: 0, rates: resolveRates(p, rates).rates }))
const flat = (o, pre = '', out = {}) => { for (const [k, v] of Object.entries(o ?? {})) {
  const key = pre ? `${pre}.${k}` : k
  if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = Array.isArray(v) ? JSON.stringify(v) : v }; return out }

const plan = []
for (const r of capexSingle) {
  const cur = latest.get(r.id)
  const p = cur.payload
  if (p.paymentMode !== undefined) stop(`${r.reference_code} already carries paymentMode=${p.paymentMode}`)
  if (p.structure !== 'single') stop(`${r.reference_code} structure is ${p.structure}, not single`)
  plan.push({ ...r, revision: cur.revision_number, payload: p, derivedBefore: flat(derive(p)) })
}
for (const t of plan) {
  console.log(`${t.reference_code}  rev ${t.revision} -> ${t.revision + 1}`)
  console.log(`   patch: paymentMode = "opex"   (structure stays "single")`)
  console.log(`   note : ${REASON.slice(0, 92)}...`)
}
if (!WRITE) { console.log('\nDRY RUN. Nothing written. Pass --write to write.'); process.exit(0) }

// ── 4. THE WRITE, ONE EXPLICIT REVISION EACH ────────────────────────────
console.log('\n── WRITING ──')
for (const t of plan) {
  const note = { text: REASON, at: new Date().toISOString(), by: EXECUTOR_EMAIL }
  const { data, error } = await db.rpc('append_record_revision', {
    p_record_id: t.id,
    p_patch: { paymentMode: 'opex', notes: [note, ...(t.payload.notes ?? [])] },
    p_created_by: EXECUTOR,
    p_remove: [],
    p_expected_revision: t.revision,
  })
  if (error) stop(`${t.reference_code}: ${error.message}`)
  console.log(`   ${t.reference_code} -> revision ${data?.revision_number ?? '(not returned)'}`)
}

// ── 5. READ BACK FROM THE DATABASE, NEVER FROM THE WRITE'S OWN ANSWER ───
console.log('\n── READ-BACK, from the database ──')
let bad = 0
for (const t of plan) {
  const rows = must(await db.from('record_revisions').select('revision_number, payload, created_by')
    .eq('record_id', t.id).order('revision_number', { ascending: false }).limit(1), 'read-back')
  const r = rows[0]
  const p = r.payload
  const ok = (c, w) => { if (c) console.log(`   ok   ${t.reference_code} ${w}`); else { bad++; console.log(`   FAIL ${t.reference_code} ${w}`) } }
  ok(r.revision_number === t.revision + 1, `revision advanced ${t.revision} -> ${r.revision_number}`)
  ok(p.paymentMode === 'opex', `paymentMode is "${p.paymentMode}"`)
  ok(p.structure === 'single', `structure is still "${p.structure}"`)
  ok(r.created_by === EXECUTOR, `created_by is the executing account`)
  ok((p.notes ?? [])[0]?.text === REASON, 'the reason is the first note in the log')
  ok((p.notes ?? []).length === (t.payload.notes ?? []).length + 1,
    `notes ${(t.payload.notes ?? []).length} -> ${(p.notes ?? []).length}, nothing lost`)
  const after = flat(derive(p))
  const moved = Object.keys(t.derivedBefore).filter((k) => String(t.derivedBefore[k]) !== String(after[k]))
  ok(moved.length === 0, `0 of ${Object.keys(after).length} derived values moved${moved.length ? ': ' + moved.join(', ') : ''}`)
}

// ── 6. NOTHING ELSE MOVED ───────────────────────────────────────────────
const after = await fingerprint()
const expectedTops = before.revisionTops.split(',').map((e) => {
  const [id, n] = e.split(':')
  return plan.some((t) => t.id === id) ? `${id}:${Number(n) + 1}` : e
}).join(',')
console.log('\n── NOTHING ELSE MOVED ──')
console.log(`   ${after.revisionTops === expectedTops ? 'ok  ' : 'FAIL'} exactly the two records advanced, every other revision top unchanged`)
if (after.revisionTops !== expectedTops) bad++
console.log(`   ${after.versions === before.versions ? 'ok  ' : 'FAIL'} every deal sheet version byte-identical, issued ones included`)
if (after.versions !== before.versions) bad++
console.log(bad ? `\n${bad} CHECKS FAILED` : '\nall read-back checks passed')
process.exit(bad ? 1 : 0)
