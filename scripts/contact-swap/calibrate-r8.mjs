// Calibration for the R8 swap. Node rather than shell: V44's clause, a
// snapshot harness must not depend on word-splitting, which cost this estate
// nine cumulative injections once.
//
// The harness verifies its own snapshot BEFORE injecting and compares bytes
// AFTER every injection, stopping dead on a mismatch, and writes an IN-FLIGHT
// marker so a killed run cannot bless its own wreckage as the next baseline.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SP = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/0a84a38b-2e9e-4092-bcb4-85f9dfb560c7/scratchpad/cal-r8'
mkdirSync(SP, { recursive: true })
const FLIGHT = `${SP}/IN-FLIGHT`
if (existsSync(FLIGHT)) {
  console.error(`A PREVIOUS RUN DID NOT FINISH. Restore from ${SP} by hand before re-running.`)
  process.exit(2)
}

const FILES = [
  'frontend-react/src/contact/ContactPanel.tsx',
  'frontend-react/src/leads/FieldGrid.tsx',
]
// Keyed on the FULL PATH, not the basename (V44): this repository mirrors
// names across directories on purpose.
const snapPath = (f) => `${SP}/${f.replaceAll('/', '_')}`
for (const f of FILES) {
  const bytes = readFileSync(`${ROOT}/${f}`)
  writeFileSync(snapPath(f), bytes)
  if (!existsSync(snapPath(f)) || readFileSync(snapPath(f)).length !== bytes.length) {
    console.error(`SNAPSHOT FAILED for ${f} - stopping before any injection`)
    process.exit(2)
  }
}
console.log(`snapshots verified: ${FILES.length}\n`)
writeFileSync(FLIGHT, 'running')

const restore = () => {
  for (const f of FILES) {
    writeFileSync(`${ROOT}/${f}`, readFileSync(snapPath(f)))
    if (!readFileSync(`${ROOT}/${f}`).equals(readFileSync(snapPath(f)))) {
      console.error(`RESTORE MISMATCH on ${f} - STOPPING`); process.exit(3)
    }
  }
}
const runSuite = () => {
  // A REAL FILE, not /dev/stdout: the json reporter answers EAGAIN there and
  // the run then LOOKS red while exiting 0. Caught on the baseline, which is
  // why the baseline is run at all.
  const rep = `${SP}/report.json`
  const r = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${rep}`],
    { cwd: `${ROOT}/frontend-react`, encoding: 'utf8', maxBuffer: 1 << 28 })
  // EXIT CODE governs, never a parsed count: V16's corollary, a line format is
  // a second thing to be right about and it is invisible when wrong. The JSON
  // is read only to NAME which assertion fired (V9's clause).
  const failed = []
  try {
    for (const t of JSON.parse(readFileSync(rep, 'utf8')).testResults ?? []) {
      for (const a of t.assertionResults ?? []) if (a.status === 'failed') failed.push(a.title)
    }
  } catch { /* the exit code still governs */ }
  return { ok: r.status === 0, failed }
}

const INJECTIONS = [
  { f: FILES[0], from: 'valueOf={(k) => rows.valueOf(k)}', to: 'valueOf={() => \'\'}',
    what: 'the grid stops reading the record' },
  { f: FILES[0], from: 'onChange={(k, v) => rows.setDraft(k, v)}', to: 'onChange={() => {}}',
    what: 'typing no longer reaches the draft store' },
  { f: FILES[0], from: 'className="lead-complete-group pg-card"', to: 'className="lead-complete-group"',
    what: 'the field card loses the estate frame' },
  { f: FILES[1], from: "${tinted?.has(f.key) ? ' field-blocked' : ''}", to: '${\'\'}',
    what: 'a refused qualify stops tinting' },
  { f: FILES[0], from: 'missing={outstanding}', to: 'missing={new Set()}',
    what: 'the server\'s outstanding marks are suppressed' },
  { f: FILES[0], from: 'disabled={!rows.canEdit}', to: 'disabled={false}',
    what: 'the door stops reaching the always-open inputs' },
]

console.log('baseline:')
const base = runSuite()
console.log(`  suite ${base.ok ? 'GREEN' : 'RED'}${base.ok ? '' : ' - fix before calibrating'}\n`)
if (!base.ok) { restore(); unlinkSync(FLIGHT); process.exit(2) }

const results = []
for (const inj of INJECTIONS) {
  const p = `${ROOT}/${inj.f}`
  const src = readFileSync(p, 'utf8')
  if (!src.includes(inj.from)) {
    console.log(`  SKIP (anchor absent): ${inj.what}`); results.push({ ...inj, verdict: 'ANCHOR' }); continue
  }
  if (src.split(inj.from).length - 1 > 2) {
    console.log(`  REFUSED (anchor not unique enough): ${inj.what}`); results.push({ ...inj, verdict: 'AMBIGUOUS' }); continue
  }
  writeFileSync(p, src.replaceAll(inj.from, inj.to))
  const r = runSuite()
  console.log(`  ${r.ok ? 'SILENT' : 'FIRED '}  ${inj.what}`)
  if (!r.ok) console.log(`            failing: ${r.failed.slice(0, 3).join(' | ') || '(exit code only)'}`)
  results.push({ ...inj, verdict: r.ok ? 'SILENT' : 'FIRED', failed: r.failed })
  restore()
}

console.log('\nfinal reverted run:')
const final = runSuite()
console.log(`  suite ${final.ok ? 'GREEN' : 'RED'}`)
for (const f of FILES) {
  const same = readFileSync(`${ROOT}/${f}`).equals(readFileSync(snapPath(f)))
  console.log(`  ${f}: ${same ? 'byte-identical' : '*** DIFFERS ***'}`)
}
unlinkSync(FLIGHT)
const silent = results.filter((r) => r.verdict === 'SILENT')
console.log(`\n${results.filter((r) => r.verdict === 'FIRED').length}/${results.length} fired`)
if (silent.length) {
  console.log('SILENT, and each needs explaining (V51):')
  for (const s of silent) console.log(`  - ${s.what}`)
}
