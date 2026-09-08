// Every migration that writes to supabase_migrations.schema_migrations.
//
// ─────────────────────────────────────────────────────────────
// WHY
// ─────────────────────────────────────────────────────────────
//
// A self-recording ledger insert breaks `supabase db push`. Measured live
// 2026-09-08 on 20260908000001: 23505 at statement 7, the whole migration
// rolled back, neither function created. The CLI writes the ledger row itself
// AFTER running the file, in the same transaction, with an insert carrying no
// conflict clause - so it is the CLI's insert that collides with the row the
// file already wrote, and the file's own `on conflict do nothing` protects the
// file's statement and can do nothing about the CLI's.
//
// Architecture rule 10 calls the pattern "safe under both paths". That premise
// is false, so every file carrying it is a file `db push` cannot apply.
//
// ─────────────────────────────────────────────────────────────
// THE STRIPPER'S SHAPE, NAMED
// ─────────────────────────────────────────────────────────────
//
// The estate's stripSql deliberately does not reach inside a dollar-quoted
// body, because `$$ -- inside a plpgsql body $$` is code to Postgres and
// CLAUDE.md Verification 39 names it as one of the things a stripper must not
// eat. Measured in Phase 1, not assumed.
//
// So a ledger insert mentioned in a COMMENT INSIDE a `do $$ ... $$` block would
// survive stripping and read as a hit. Every hit below is printed with its line
// so it can be read rather than counted, and the raw and stripped counts are
// both reported: a file whose raw count exceeds its stripped count is one where
// the difference is prose.
import { stripSql } from '../lib/strip-comments.mjs'
import { readFileSync, readdirSync } from 'fs'

const DIR = new URL('../../supabase/migrations/', import.meta.url).pathname
const NEEDLE = /supabase_migrations\.schema_migrations/
const WRITE = /insert\s+into\s+supabase_migrations\.schema_migrations/i

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
const hits = []
let rawTotal = 0, strippedTotal = 0

for (const f of files) {
  const raw = readFileSync(DIR + f, 'utf8')
  if (!NEEDLE.test(raw)) continue
  const stripped = stripSql(raw)
  const rawN = (raw.match(new RegExp(WRITE.source, 'gi')) ?? []).length
  const strippedN = (stripped.match(new RegExp(WRITE.source, 'gi')) ?? []).length
  rawTotal += rawN
  strippedTotal += strippedN
  const lines = []
  stripped.split('\n').forEach((l, i) => { if (WRITE.test(l)) lines.push(`${i + 1}: ${l.trim()}`) })
  hits.push({ f, rawN, strippedN, lines })
}

console.log(`=== LEDGER-INSERT CENSUS over ${files.length} migration files`)
console.log(`   mentioning supabase_migrations.schema_migrations at all: ${hits.length} file(s)`)
console.log(`   INSERT statements: ${strippedTotal} after stripping, ${rawTotal} raw\n`)
if (!hits.length) console.log('   (none)')
for (const h of hits) {
  const verdict = h.strippedN > 0 ? 'WRITES THE LEDGER' : 'mentions it in prose only'
  console.log(`   ${h.f}`)
  console.log(`     ${verdict}  (stripped ${h.strippedN}, raw ${h.rawN})`)
  for (const l of h.lines) console.log(`       line ${l}`)
}

// ── CALIBRATION, both directions, on real files ─────────────────────────
// Verification 9 and 39: a scan that returns a short list is indistinguishable
// from one that did not run, and prose must not satisfy it.
console.log('\n=== CALIBRATION')
const known = files.find((f) => f.startsWith('20260829000007'))
const knownRaw = known ? readFileSync(DIR + known, 'utf8') : null
const countIn = (s) => (stripSql(s).match(new RegExp(WRITE.source, 'gi')) ?? []).length
if (knownRaw) {
  const n = countIn(knownRaw)
  console.log(`   known-positive ${known}: ${n} write(s)   FIRED = ${n > 0}`)
  const commented = knownRaw.replace(/^insert into supabase_migrations\.schema_migrations/mi,
    '-- insert into supabase_migrations.schema_migrations')
  console.log(`   the same file with that insert commented out: ${countIn(commented)}   FIRED = ${countIn(commented) === n - 1}`)
} else {
  console.log('   STOP: 20260829000007 is not in the directory, so the known positive is missing')
  process.exit(2)
}
const prose = '-- insert into supabase_migrations.schema_migrations (version) values (\'x\');\nselect 1;\n'
console.log(`   a comment describing the insert: ${countIn(prose)}   SILENT = ${countIn(prose) === 0}`)
const real = "insert into supabase_migrations.schema_migrations (version) values ('x') on conflict do nothing;\n"
console.log(`   the real statement:              ${countIn(real)}   FIRED  = ${countIn(real) === 1}`)
