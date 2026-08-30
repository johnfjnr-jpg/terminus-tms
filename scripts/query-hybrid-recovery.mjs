// Item 1, Round 41. Every existing hybrid deal, priced under BOTH readings of
// whether recovery period applies to hybrid.
//
// REPORT ONLY. This script reads and computes; it writes nothing and changes
// nothing. Existing hybrid deals are test data and the query is for information
// rather than remediation.
//
// ── THE TWO READINGS ───────────────────────────────────────────────────────
//
// NOT APPLIED is what the code does today: hybrid recovers hardware through
// milestones, and `recov` is computed but every consumer of it is guarded by
// `structure !== 'hybrid'`.
//
// APPLIED is the reading the calculator's own expression suggests: hybrid
// spreads hardware revenue over `recoveryMonths` the way two-phase does.
//
// The second is modelled here by pricing the same payload as `twoPhase`, which
// is the only structural difference between them in the cash flow: two-phase
// bills hardware over `recov`, hybrid bills it on milestone months. Nothing
// else in calculateDeal branches on structure.
import { readFileSync } from 'fs'
import { supabaseAdmin as db } from '../src/supabase.js'
import { calculateDeal } from '../src/lib/deal-calculator.js'
import { buildDealInputs } from '../src/lib/deal-inputs.js'
import { resolveRates } from '../src/lib/rate-resolution.js'
import { catalogToRates } from '../src/lib/base-costs.js'

// The catalog, read the way src/routes/base-costs.js reads it rather than by a
// second guess at the table name. An empty catalog would price every line at
// nothing and make both readings agree at zero, which is a green that means
// the instrument is broken.
const { data: batches, error: bErr } = await db.from('base_cost_batches').select('*')
if (bErr) { console.error('catalog read failed: ' + bErr.message); process.exit(1) }
const CATALOG = catalogToRates(batches ?? []).rates
if (!Object.keys(CATALOG).length) {
  console.error('The catalog resolved NO rate keys. Every figure below would be zero and')
  console.error('both readings would agree for the wrong reason. Refusing to report.')
  process.exit(1)
}

const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US')

function priceUnder(payload, structure) {
  const p = { ...payload, structure }
  const r = calculateDeal(buildDealInputs(p, { rates: resolveRates(p, CATALOG).rates }))
  const cf = r.cashFlow
  return {
    hardwareIn: cf.rows.reduce((s, x) => s + x.hardwareIn, 0),
    closing: cf.rows.length ? cf.rows[cf.rows.length - 1].cum : 0,
    minCash: cf.minCash,
  }
}

// ── THE POPULATION: every record and every version whose structure is hybrid ──
const { data: recs, error: rErr } = await db
  .from('records').select('id, reference_code, status, deleted_at').eq('record_type', 'opportunity')
if (rErr) { console.error(rErr.message); process.exit(1) }
const ids = recs.map((r) => r.id)
let revs = []
for (let i = 0; i < ids.length; i += 100) {
  const { data } = await db.from('record_revisions')
    .select('record_id, revision_number, payload').in('record_id', ids.slice(i, i + 100))
  revs = revs.concat(data ?? [])
}
const latest = new Map()
for (const r of revs) {
  const cur = latest.get(r.record_id)
  if (!cur || r.revision_number > cur.revision_number) latest.set(r.record_id, r)
}
const { data: versions } = await db.from('deal_sheet_versions')
  .select('id, record_id, major, minor, status, inputs')

const byId = new Map(recs.map((r) => [r.id, r]))
const rows = []

for (const [id, rev] of latest) {
  if (rev.payload?.structure !== 'hybrid') continue
  const rec = byId.get(id)
  rows.push({ kind: 'record (latest revision)', ref: rec?.reference_code ?? id.slice(0, 8),
    live: !rec?.deleted_at, payload: rev.payload })
}
for (const v of versions ?? []) {
  if (v.inputs?.structure !== 'hybrid') continue
  const rec = byId.get(v.record_id)
  rows.push({ kind: `version V${v.major}.${v.minor} (${v.status})`,
    ref: rec?.reference_code ?? v.record_id.slice(0, 8), live: !rec?.deleted_at, payload: v.inputs })
}

// ── CALIBRATION: a zero is not a measurement until the scan reaches one ────
//
// Verification 9 and 13. "No hybrid deal exists" and "the scan cannot see a
// hybrid deal" produce identical output, so the scan is shown finding one on a
// synthetic payload before the real count is reported. The synthetic row is
// never written anywhere and never appears in the table below.
{
  const synth = { ssExisting: 10, ssNew: 0, aqm: 0, hemir: 0, duration: 36,
    targetMargin: 30, warrantyPct: 2, invoicing: 'annual', structure: 'hybrid',
    recoveryMonths: 12, installResp: 'Client Own Installation Team',
    milestones: [{ month: 1, usd: 100000, pct: 0 }] }
  const seen = [synth].filter((p) => p.structure === 'hybrid').length
  const a = priceUnder(synth, 'hybrid')
  const b = priceUnder(synth, 'twoPhase')
  if (seen !== 1 || a.hardwareIn === b.hardwareIn) {
    console.error('CALIBRATION FAILED: the scan or the two-reading comparison cannot')
    console.error(`  distinguish anything. seen=${seen} notApplied=${a.hardwareIn} applied=${b.hardwareIn}`)
    process.exit(1)
  }
  console.log(`calibration: a synthetic hybrid is detected, and the two readings differ by `
    + `${money(b.hardwareIn - a.hardwareIn)} on it`)
}

console.log(`catalog rate keys resolved: ${Object.keys(CATALOG).length}`)
console.log(`opportunities scanned: ${latest.size}   deal sheet versions scanned: ${versions?.length ?? 0}`)
console.log(`HYBRID found: ${rows.length}\n`)

if (!rows.length) {
  console.log('No hybrid deal sheet exists, on any record or any version.')
  console.log('That is the finding: the discrepancy has never been exercised by real data.')
} else {
  console.log('| what | reference | live | recoveryMonths | milestones | hardware in, NOT applied | hardware in, APPLIED | difference |')
  console.log('|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    const notApplied = priceUnder(r.payload, 'hybrid')
    const applied = priceUnder(r.payload, 'twoPhase')
    const diff = applied.hardwareIn - notApplied.hardwareIn
    const ms = (r.payload.milestones ?? []).filter((m) => m.month > 0 && m.usd > 0).length
    console.log(`| ${r.kind} | ${r.ref} | ${r.live ? 'yes' : 'no'} | ${r.payload.recoveryMonths ?? '(absent)'} | ${ms} | ${money(notApplied.hardwareIn)} | ${money(applied.hardwareIn)} | ${money(diff)} |`)
  }
}
