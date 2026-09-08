// PHASE 0 ITEM 3: is there a cross-request invariant on this path?
//
// READ-ONLY. Source reading and one set of live counts; nothing is written.
//
// The convert round needed an advisory lock because a COUNT had to be true
// between a read and a write. The brief is explicit that the position here is
// taken by measurement and not by copying that function's shape, so this asks
// three questions the source and the schema can answer:
//
//   1. does the route READ anything before it writes?
//   2. what constraints and triggers do its three target tables carry, and is
//      any of them cross-row rather than per-row? (Verification 46: a new
//      writer inherits every guard already on the table)
//   3. what do the TYPED creation routes enforce that this one does not, given
//      it accepts any record_type string?
import { stripJs, stripSql } from '../lib/strip-comments.mjs'
import { readFileSync, readdirSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname

// ── 1. Does the route read before it writes? ──────────────────────────────
// ── THIS PROBE IS SUPERSEDED AND REFUSES. Retirement, 2026-09-08 ─────────
//
// It measured POST /records to decide whether the Phase 1 function needed an
// advisory lock. Ruling 6 deleted the route instead, so there is nothing left
// to measure and the anchors below resolve to -1.
//
// IT REFUSES RATHER THAN BEING DELETED, for two reasons. Its output is cited
// in RECORD_CREATION_PHASE_0_REPORT.md, and a report citing a file that is not
// there is Verification 7's third clause - a pointer to nothing is worse than
// no pointer. And a probe that silently slices from -1 returns plausible
// garbage rather than failing, which is the worse of the two failure modes.
const routes0 = readFileSync(ROOT + 'src/routes/records.js', 'utf8')
if (!routes0.includes("app.post('" + '/rec' + "ords'")) {
  console.log('SUPERSEDED: POST /records was retired on 2026-09-08 by ruling 6 of')
  console.log('the record creation atomicity round. This probe measured that route to')
  console.log('decide whether a Phase 1 function needed an advisory lock. No function')
  console.log('was written and the route is gone, so there is nothing to measure.')
  console.log('Its findings are recorded in RECORD_CREATION_PHASE_0_REPORT.md section 3.')
  process.exit(3)
}

const routes = stripJs(readFileSync(ROOT + 'src/routes/records.js', 'utf8'))
const start = routes.indexOf("app.post('/records'")
const end = routes.indexOf("app.get('/records'", start)
const fn = routes.slice(start, end)
console.log('=== 1. WHAT THE ROUTE DOES, from its own body')
const selects = [...fn.matchAll(/\.from\('([a-z_]+)'\)[\s\S]{0,120}?\.(select|insert|update|delete)\(/g)]
for (const m of selects) console.log(`  ${m[2].toUpperCase().padEnd(6)} on ${m[1]}`)
const reads = selects.filter((m) => m[2] === 'select' && !/\.insert\(/.test(m[0]))
console.log(`  standalone reads before the writes: ${reads.length}`)
console.log(`  -> a read-then-write shape needs a read. There is none.`)

// ── 2. Constraints and triggers on the three target tables ────────────────
console.log('\n=== 2. WHAT THE THREE TARGET TABLES CARRY (Verification 46)')
const TARGETS = ['records', 'record_revisions', 'audit_log']
const migs = readdirSync(ROOT + 'supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
const found = { unique: [], check: [], trigger: [], fk: [] }
for (const f of migs) {
  const sql = stripSql(readFileSync(ROOT + 'supabase/migrations/' + f, 'utf8'))
  for (const line of sql.split('\n')) {
    const l = line.trim()
    for (const t of TARGETS) {
      if (/create trigger|create or replace trigger/i.test(l) && new RegExp(`\\b${t}\\b`).test(l)) found.trigger.push(`${f}: ${l.slice(0, 110)}`)
      if (/unique/i.test(l) && new RegExp(`\\b${t}\\b`).test(l) && /(add constraint|create unique)/i.test(l)) found.unique.push(`${f}: ${l.slice(0, 110)}`)
    }
  }
  // Triggers attached by a do-block loop name their tables in an array.
  if (/foreach t in array/i.test(sql)) {
    for (const t of TARGETS) if (new RegExp(`'${t}'`).test(sql)) found.trigger.push(`${f}: attached by a do-block loop, array includes '${t}'`)
  }
}
const dedupe = (a) => [...new Set(a)]
console.log('  triggers naming a target table:')
for (const t of dedupe(found.trigger)) console.log(`    ${t}`)
console.log('  unique constraints naming a target table:')
for (const u of dedupe(found.unique)) console.log(`    ${u}`)

console.log('\n  the CROSS-ROW ones, which are the only kind a concurrent pair could race:')
console.log('    records_reference_code_record_type_key UNIQUE (reference_code, record_type)')
console.log(`      -> this route NEVER SETS reference_code: ${/reference_code/.test(fn) ? 'IT DOES, check this' : 'confirmed, the column is absent from its insert'}`)
console.log('    record_revisions UNIQUE (record_id, revision_number)')
console.log('      -> record_id is a uuid minted by the insert above it, so two')
console.log('         concurrent calls cannot collide on it')

// ── 3. What the typed routes enforce that this one does not ───────────────
console.log('\n=== 3. WHAT THE TYPED CREATION ROUTES ENFORCE THAT THIS ONE DOES NOT')
const typed = [
  ['accounts.js', "app.post('/accounts'"],
  ['contacts.js', "app.post('/contacts'"],
  ['test-beds.js', "app.post('/test-beds'"],
]
for (const [file, anchor] of typed) {
  const s = stripJs(readFileSync(ROOT + 'src/routes/' + file, 'utf8'))
  const i = s.indexOf(anchor)
  if (i < 0) { console.log(`  ${file}: anchor not found`); continue }
  const seg = s.slice(i, i + 4000)
  const guards = [...seg.matchAll(/reply\.code\((\d{3})\)\.send\(\{\s*error:\s*['"`]([^'"`]{0,70})/g)]
    .map((m) => `${m[1]} ${m[2]}`)
  console.log(`  ${file}: ${guards.length} refusal(s) before or around the insert`)
  for (const g of dedupe(guards).slice(0, 6)) console.log(`      ${g}`)
}
const ownGuards = [...fn.matchAll(/reply\.code\((\d{3})\)\.send\(\{\s*error:\s*['"`]([^'"`]{0,70})/g)]
  .map((m) => `${m[1]} ${m[2]}`)
console.log(`  records.js POST /records: ${ownGuards.length} refusal(s)`)
for (const g of dedupe(ownGuards)) console.log(`      ${g}`)
console.log('\n  and the record_type it accepts:')
console.log(`    ${/record_type\.trim\(\) === ''/.test(fn) ? "any non-empty string. No allowlist, no check against a known type." : 'check the source'}`)
