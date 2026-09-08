// PHASE 0 ITEM 2: which record types have ever been created through POST
// /records, and which of them carry a revision-number-1 row.
//
// READ-ONLY. Every call is a .select().
//
// ─────────────────────────────────────────────────────────────
// THE FINGERPRINT, AND WHY THERE IS ONE
// ─────────────────────────────────────────────────────────────
//
// Four routes write audit_log with action 'created', and each writes a
// DIFFERENT detail shape. Enumerated from the source, comment-stripped, rather
// than recalled:
//
//   src/routes/accounts.js:242    detail: { name }
//   src/routes/contacts.js:227    detail: { name, company }
//   src/routes/records.js:129     detail: { initial_status }   <-- this route
//   src/routes/test-beds.js:302   detail: { name }
//
// `initial_status` is written by POST /records and by nothing else in the
// estate, so an audit row carrying that key is a record this route created.
// That is the only instrument available: the records table itself records no
// provenance, and the route has no caller to instrument.
import { admin } from '../fixtures.mjs'
import { stripJs } from '../lib/strip-comments.mjs'
import { readFileSync, readdirSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const db = admin()

// ── The fingerprint's uniqueness, re-measured rather than asserted ────────
console.log('=== THE FINGERPRINT: who writes detail.initial_status?')
let writers = 0
for (const f of readdirSync(ROOT + 'src/routes')) {
  const s = stripJs(readFileSync(ROOT + 'src/routes/' + f, 'utf8'))
  const n = (s.match(/initial_status/g) ?? []).length
  if (n) { writers++; console.log(`  src/routes/${f}: ${n} occurrence(s)`) }
}
console.log(`  files writing it: ${writers}  (must be 1 for the fingerprint to be sound)`)

async function fetchAll(table, columns, orderKey, filter = (q) => q) {
  const { count, error: cErr } = await filter(db.from(table).select(columns, { count: 'exact', head: true }))
  if (cErr) throw new Error(`${table}: ${cErr.message}`)
  const PAGE = 1000, rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table).select(columns))
      .order(orderKey, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table} page ${from}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  if (rows.length !== count) throw new Error(`${table}: paged ${rows.length}, server counts ${count}`)
  console.log(`  coverage ${table.padEnd(18)} ${rows.length} == ${count}`)
  return rows
}

console.log('\n=== POPULATIONS')
const created = await fetchAll('audit_log', 'record_id, record_type, action, actor_id, timestamp, detail',
  'id', (q) => q.eq('action', 'created'))
const records = await fetchAll('records', 'id, record_type, status, owner_id, created_at, deleted_at', 'id')
const revisions = await fetchAll('record_revisions', 'record_id, revision_number', 'id')

const byId = new Map(records.map((r) => [r.id, r]))
const revsFor = new Map()
for (const r of revisions) {
  if (!revsFor.has(r.record_id)) revsFor.set(r.record_id, [])
  revsFor.get(r.record_id).push(r.revision_number)
}

const thisRoute = created.filter((a) => a.detail && Object.prototype.hasOwnProperty.call(a.detail, 'initial_status'))
console.log(`\n=== RECORDS CREATED THROUGH POST /records`)
console.log(`  audit rows with action='created'            : ${created.length}`)
console.log(`  of which carry detail.initial_status        : ${thisRoute.length}`)

const tally = (rows, key) => {
  const m = new Map()
  for (const r of rows) { const k = key(r); m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
console.log('\n  the OTHER creation audits, by detail shape, so the fingerprint is bounded:')
for (const [k, n] of tally(created.filter((a) => !thisRoute.includes(a)),
  (a) => Object.keys(a.detail ?? {}).sort().join('+') || '(empty detail)')) {
  console.log(`    ${String(n).padStart(6)}  detail keys: ${k}`)
}

if (!thisRoute.length) {
  console.log('\n  NONE. No record in this database was created through POST /records.')
} else {
  console.log('\n  by record_type, and whether a revision numbered 1 exists:')
  const rows = thisRoute.map((a) => {
    const rec = byId.get(a.record_id)
    const revs = revsFor.get(a.record_id) ?? []
    return {
      id: a.record_id, type: a.record_type, ts: a.timestamp, actor: a.actor_id,
      live: rec ? !rec.deleted_at : null, exists: !!rec,
      hasRev1: revs.includes(1), revCount: revs.length,
      initial_status: a.detail.initial_status,
    }
  })
  for (const [k, n] of tally(rows, (r) => `${r.type}  rev1=${r.hasRev1}  live=${r.live}`)) {
    console.log(`    ${String(n).padStart(6)}  ${k}`)
  }
  console.log('\n  every row, since the population is small enough to list:')
  for (const r of rows.sort((a, b) => a.ts.localeCompare(b.ts))) {
    console.log(`    ${r.ts}  ${String(r.type).padEnd(14)} rev1=${r.hasRev1} revs=${r.revCount} exists=${r.exists} live=${r.live} status=${JSON.stringify(r.initial_status)}`)
  }
}

// ── THE DOCUMENT QUESTION, ITEM 2's NAMED CASE ────────────────────────────
console.log('\n=== DO DOCUMENTS ARRIVE THROUGH THIS ROUTE?')
const docs = records.filter((r) => r.record_type === 'document')
const docAudits = thisRoute.filter((a) => a.record_type === 'document')
console.log(`  document records in the database        : ${docs.length}`)
console.log(`  of them created through POST /records   : ${docAudits.length}`)
console.log(`  (the convert round's F3 measured that documents carry no revision by`)
console.log(`   design; this asks the different question of whether they come this way)`)

// ── AND THE GENERAL SHAPE, for the function to preserve ───────────────────
console.log('\n=== REVISION-1 BY TYPE ACROSS THE WHOLE ESTATE, for context')
console.log('  type                    total   with a revision numbered 1   pct')
for (const [t, n] of tally(records, (r) => r.record_type).filter(([t]) => !t.startsWith('harness_'))) {
  const of = records.filter((r) => r.record_type === t)
  const with1 = of.filter((r) => (revsFor.get(r.id) ?? []).includes(1)).length
  console.log(`  ${t.padEnd(22)} ${String(n).padStart(6)} ${String(with1).padStart(28)} ${String((100 * with1 / n).toFixed(1)).padStart(6)}%`)
}
const harness = records.filter((r) => r.record_type.startsWith('harness_'))
const hWith1 = harness.filter((r) => (revsFor.get(r.id) ?? []).includes(1)).length
console.log(`  ${String(new Set(harness.map((r) => r.record_type)).size + ' harness_* types').padEnd(22)} ${String(harness.length).padStart(6)} ${String(hWith1).padStart(28)} ${String((100 * hWith1 / (harness.length || 1)).toFixed(1)).padStart(6)}%`)
