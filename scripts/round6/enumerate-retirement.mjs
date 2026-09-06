// ── ROUND 6 PHASE R ITEM 1: THE RETIREMENT, SIZED BY SANDBOX DELETION ───
//
// Verification 44's harness discipline: full-path keys, the snapshot asserted
// to EXIST and match in size BEFORE anything is deleted, the restore compared
// byte-for-byte AFTER, and a stop on mismatch. Node rather than a shell.
//
// Round 5 Phase 3b's lesson, promoted into the Round 6 brief: a retirement is
// sized by what the deletion BREAKS, never by a mention count. The two are
// different numbers - 44 mentions against 31 failures across 8 files - and
// only the second is a work list.
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = process.env.SNAP
if (!SNAP) throw new Error('SNAP is required')
mkdirSync(SNAP, { recursive: true })
const key = (rel) => SNAP + '/' + rel.replaceAll('/', '_')

const TARGETS = process.env.TARGETS
  ? process.env.TARGETS.split(',')
  : ['frontend/contact-detail.js']

// ── SNAPSHOT, VERIFIED ──────────────────────────────────────────────────
const original = new Map()
for (const rel of TARGETS) {
  if (!existsSync(ROOT + rel)) throw new Error(`SNAPSHOT: ${rel} does not exist`)
  const b = readFileSync(ROOT + rel)
  writeFileSync(key(rel), b)
  original.set(rel, b)
}
for (const rel of TARGETS) {
  if (!existsSync(key(rel))) throw new Error(`SNAPSHOT NOT WRITTEN for ${rel}`)
  if (readFileSync(key(rel)).length !== original.get(rel).length) {
    throw new Error(`SNAPSHOT SIZE MISMATCH for ${rel}`)
  }
  console.log(`snapshot verified  ${rel}  ${original.get(rel).length}B`)
}
if (new Set(TARGETS.map(key)).size !== TARGETS.length) throw new Error('SNAPSHOT KEY COLLISION')

const run = () => {
  const started = Date.now()
  try {
    const out = execSync('npm test 2>&1 && npm --prefix frontend-react run test 2>&1',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { green: true, out, ms: Date.now() - started }
  } catch (e) { return { green: false, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - started } }
}
const failures = (out) => [...new Set([
  ...[...out.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1].trim()),
  ...[...out.matchAll(/^\s*×\s+(.+?)\s+\d+ms$/gm)].map((m) => m[1].trim()),
])].filter((n) => n !== 'failing tests:')

console.log('\nBASELINE')
const base = run()
console.log(`  ${base.green ? 'GREEN' : '*** NOT GREEN ***'}  ${base.ms}ms`)
if (!base.green) { console.log(failures(base.out).slice(0, 6).join('\n')); process.exit(1) }

for (const rel of TARGETS) unlinkSync(ROOT + rel)
const after = run()

// Which FILE each failure came from, so the work list groups the way the work does.
const byFile = {}
for (const block of after.out.split(/(?=^ℹ tests )/m)) { /* per-run summaries */ }
const fileOf = {}
{
  let current = null
  for (const line of after.out.split('\n')) {
    const m = line.match(/^\s*[❯›]?\s*(scripts\/tests\/[\w.-]+\.mjs|src\/__tests__\/[\w.-]+\.tsx?)/)
    if (m) current = m[1]
    const f = line.match(/^✖ (.+?) \(\d/) || line.match(/^\s*×\s+(.+?)\s+\d+ms$/)
    if (f && current) fileOf[f[1].trim()] ??= current
  }
}

for (const rel of TARGETS) {
  writeFileSync(ROOT + rel, readFileSync(key(rel)))
  if (!readFileSync(ROOT + rel).equals(original.get(rel))) {
    throw new Error(`RESTORE MISMATCH on ${rel} - STOPPING`)
  }
  console.log(`\nrestore verified   ${rel}  byte-identical`)
}
const final = run()
console.log(`FINAL RESTORED RUN  ${final.green ? 'GREEN' : '*** NOT GREEN ***'}`)

const list = failures(after.out)
console.log(`\n── THE WORK LIST: ${list.length} failing tests ──────────────────────`)
const grouped = {}
for (const n of list) (grouped[fileOf[n] ?? '<file unknown>'] ??= []).push(n)
for (const [f, names] of Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${f}  (${names.length})`)
  for (const n of names) console.log(`  - ${n}`)
}
writeFileSync(SNAP + '/worklist.json', JSON.stringify({ list, grouped }, null, 2))
console.log(`\nwritten to ${SNAP}/worklist.json`)
