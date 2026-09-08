// PHASE 0 ITEM 1: every write policy in the schema, in its FINAL state.
//
// ── THE MIGRATIONS ARE THE AUTHORITATIVE SOURCE, AND THAT IS A LIMIT ──────
//
// pg_policies is not in `public`, so PostgREST does not expose it and this
// session cannot read the live policy set. Measured, not assumed:
//   pg_policies -> PGRST205,  rpc list_policies -> PGRST202
//
// So this replays the migration directory in filename order and reports the
// LAST statement that touched each (table, command, policy name). A naive grep
// reports every policy ever written, including ones later dropped - and this
// estate has at least one that matters: records_select was owner-scoped in
// 20260801000000 and replaced with `auth.uid() is not null` in 20260812000004.
// Reading the first would invert the answer.
//
// EVERY CLAIM HERE IS SOURCE-DERIVED. Where a policy's shape decides a verdict
// in the entitlement map, the map says whether it was also proven live.
import { stripSql } from '../lib/strip-comments.mjs'
import { readFileSync, readdirSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const DIR = ROOT + 'supabase/migrations/'
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

// key: table|command|name  ->  { action: 'create'|'drop', body, file }
const state = new Map()
const order = []

// STATEMENTS ARE APPLIED IN FILE ORDER, NOT CREATES-THEN-DROPS.
//
// The first version of this collected every CREATE in a file and then every
// DROP, which inverts the estate's commonest idiom: `drop policy X; create
// policy X;` in one migration to replace it. That marked 23 policies as dropped
// and left 24 alive, and records_select - the very policy whose replacement
// this census exists to catch - came out DROPPED.
//
// Caught because the number was implausible for an estate this size, which is
// the only reason a parse bug of this shape ever gets caught: it produces a
// clean-looking answer.
const CREATE_RE = /create\s+policy\s+"?([^"\s]+)"?\s+on\s+(?:public\.)?(\w+)\s+for\s+(\w+)([\s\S]*?);/gi
const DROP_RE = /drop\s+policy\s+(?:if\s+exists\s+)?"?([^"\s]+)"?\s+on\s+(?:public\.)?(\w+)/gi

for (const f of files) {
  const sql = stripSql(readFileSync(DIR + f, 'utf8'))
  const events = []
  for (const m of sql.matchAll(new RegExp(CREATE_RE.source, 'gi'))) {
    events.push({ at: m.index, kind: 'create', name: m[1], table: m[2], cmd: m[3].toLowerCase(), body: m[4].trim().replace(/\s+/g, ' ') })
  }
  for (const m of sql.matchAll(new RegExp(DROP_RE.source, 'gi'))) {
    events.push({ at: m.index, kind: 'drop', name: m[1], table: m[2] })
  }
  events.sort((a, b) => a.at - b.at)
  for (const e of events) {
    if (e.kind === 'create') {
      const key = `${e.table}|${e.cmd}|${e.name}`
      state.set(key, { action: 'create', table: e.table, cmd: e.cmd, name: e.name, body: e.body, file: f })
      order.push(key)
    } else {
      for (const k of [...state.keys()]) {
        const st = state.get(k)
        if (st.table === e.table && st.name === e.name) state.set(k, { ...st, action: 'drop', file: f })
      }
    }
  }
}

// ── CLASSIFY BY SHAPE ────────────────────────────────────────────────────
//
// The four shapes the brief names, decided from the predicate text rather than
// from the policy's name - a name asserting a property is Verification 19's
// case, and this estate has been caught by one before.
function shapeOf(body) {
  const b = body.toLowerCase()
  const ownerViaRecord = /auth\.uid\(\)\s*=\s*\(\s*select\s+owner_id\s+from\s+(?:public\.)?records/.test(b)
  const ownerDirect = /auth\.uid\(\)\s*=\s*owner_id/.test(b)
  const identity = /auth\.uid\(\)\s*=\s*(created_by|actor_id|approver_id|user_id|requested_by|created_by)/.test(b)
  const openAuth = /auth\.uid\(\)\s+is\s+not\s+null/.test(b)
  const gate = /status\s*=\s*'|exists\s*\(/.test(b)
  if (ownerViaRecord || ownerDirect) return 'OWNERSHIP'
  if (identity) return 'IDENTITY'
  if (openAuth && gate) return 'GATE+OPEN'
  if (openAuth) return 'OPEN(any authenticated)'
  if (gate) return 'GATE'
  return 'OTHER'
}

const WRITE = new Set(['insert', 'update', 'delete', 'all'])
const live = [...state.values()].filter((s) => s.action === 'create')
const writes = live.filter((s) => WRITE.has(s.cmd))

console.log(`=== POLICY CENSUS over ${files.length} migration files, replayed in order`)
console.log(`  policy statements that survive as CREATE : ${live.length}`)
console.log(`  of which WRITE policies (insert/update/delete/all) : ${writes.length}`)
console.log(`  dropped and not recreated                : ${[...state.values()].filter((s) => s.action === 'drop').length}`)

const byTable = new Map()
for (const w of writes) {
  if (!byTable.has(w.table)) byTable.set(w.table, [])
  byTable.get(w.table).push(w)
}
console.log('\n=== WRITE POLICIES BY TABLE, with the shape read from the predicate')
for (const [t, ps] of [...byTable].sort()) {
  console.log(`\n  ${t}`)
  for (const p of ps.sort((a, b) => a.cmd.localeCompare(b.cmd))) {
    console.log(`    ${p.cmd.toUpperCase().padEnd(7)} ${shapeOf(p.body).padEnd(24)} "${p.name}"   (${p.file})`)
    console.log(`      ${p.body.slice(0, 170)}`)
  }
}

// ── TABLES WITH NO WRITE POLICY AT ALL ───────────────────────────────────
// RLS denies by default, so a table with RLS on and no write policy is
// closed - which is a FINDING in the map's favour, not a gap. Named rather
// than left to inference.
console.log('\n=== TABLES WITH RLS ENABLED AND NO SURVIVING WRITE POLICY (deny by default)')
const rlsOn = new Set()
for (const f of files) {
  const sql = stripSql(readFileSync(DIR + f, 'utf8'))
  for (const m of sql.matchAll(/alter\s+table\s+(?:public\.)?(\w+)\s+enable\s+row\s+level\s+security/gi)) rlsOn.add(m[1])
}
const noWrite = [...rlsOn].filter((t) => !byTable.has(t)).sort()
console.log(`  ${noWrite.length} of ${rlsOn.size} RLS-enabled tables: ${noWrite.join(', ')}`)
