// ── FINDING 1'S PROBE, PROVED CAPABLE OF FAILING ────────────────────────
// Verification 9. Each injection removes one part of the fix, rebuilds the
// bundle the browser actually loads, and runs reason-survives.mjs.
//
// Verified-snapshot harness per Verification 44: full-path keys, the snapshot
// asserted to exist and match BEFORE anything is injected, the restore
// compared byte-for-byte AFTER every injection with a stop on mismatch, and a
// final reverted run. Node rather than a shell, and every anchor required to
// be unique.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = process.env.SNAP
mkdirSync(SNAP, { recursive: true })
const key = (rel) => SNAP + '/' + rel.replaceAll('/', '_')

const CARD = 'frontend-react/src/versions/VersionCard.tsx'
const MAIN = 'frontend-react/src/main.tsx'

const INJECTIONS = [
  { name: 'the clear moves back to the END of the chain',
    claim: 'the box is cleared at SUBMIT, so nothing late wipes what was typed since',
    file: CARD,
    from: `    setReason('')
    try {
      await onSave(submitted)
      setFeedback({ text: 'Version taken.', ok: true })`,
    to:   `    try {
      await onSave(submitted)
      setReason('')
      setFeedback({ text: 'Version taken.', ok: true })` },

  { name: 'the refusal restores the reason unconditionally',
    claim: 'a refusal gives the reason back only into a box nobody has started using',
    file: CARD,
    from: `      setReason((current) => (current === '' ? submitted : current))`,
    to:   `      setReason(submitted)` },

  { name: 'the re-entrancy ref is removed',
    claim: 'two clicks in one tick take no second version',
    file: CARD,
    from: `    if (savingRef.current) return
    savingRef.current = true`,
    to:   `    if (saving) return` },

  { name: 'the button is never disabled during the save',
    claim: 'the button is held for the whole save chain',
    file: CARD,
    from: `            disabled={saving}
            onClick={() => { void save() }}>{saving ? 'Saving...' : 'Save version'}</button>`,
    to:   `            onClick={() => { void save() }}>{saving ? 'Saving...' : 'Save version'}</button>` },

  { name: 'init re-renders the tree for a record already on screen',
    claim: 'init is idempotent when the opportunity has not changed',
    file: MAIN,
    from: `  if (versionRoot && versionOppId === opportunityId) {`,
    to:   `  if (false && versionRoot && versionOppId === opportunityId) {` },
]

const FILES = [...new Set(INJECTIONS.map((i) => i.file))]
const original = new Map()
for (const rel of FILES) {
  const src = ROOT + rel
  if (!existsSync(src)) throw new Error(`SNAPSHOT: ${rel} does not exist`)
  const bytes = readFileSync(src)
  writeFileSync(key(rel), bytes)
  original.set(rel, bytes)
}
for (const rel of FILES) {
  if (!existsSync(key(rel))) throw new Error(`SNAPSHOT NOT WRITTEN for ${rel}`)
  if (readFileSync(key(rel)).length !== original.get(rel).length) {
    throw new Error(`SNAPSHOT SIZE MISMATCH for ${rel}`)
  }
  console.log(`snapshot verified  ${rel}  ${original.get(rel).length}B`)
}
if (new Set(FILES.map(key)).size !== FILES.length) throw new Error('SNAPSHOT KEY COLLISION')

const restore = (rel) => {
  writeFileSync(ROOT + rel, readFileSync(key(rel)))
  if (!readFileSync(ROOT + rel).equals(original.get(rel))) {
    throw new Error(`RESTORE MISMATCH on ${rel} - STOPPING`)
  }
}
const build = () => execSync('npm run build:react', { cwd: ROOT, stdio: 'pipe' })
const suite = () => {
  const started = Date.now()
  try {
    const out = execSync('npm --prefix frontend-react run test',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { green: true, out, ms: Date.now() - started }
  } catch (e) {
    return { green: false, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - started }
  }
}
const suiteLine = (out) => (out.match(/Tests {2}.*$/m) ?? ['<no result>'])[0].trim()
const probe = () => {
  const started = Date.now()
  try {
    const out = execSync('node --env-file=.env scripts/round4/reason-survives.mjs',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
        env: { ...process.env, RUNS: process.env.RUNS ?? '2' } })
    return { green: true, out, ms: Date.now() - started }
  } catch (e) {
    return { green: false, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - started }
  }
}
const verdictLine = (out) => (out.match(/REASON SURVIVES: \d+\/\d+/) ?? ['<no result>'])[0]
const firstFails = (out) => out.split('\n').filter((l) => l.includes('FAIL')).slice(0, 3)
  .map((l) => l.trim().slice(0, 105))

console.log('\nBASELINE')
build()
const baseSuite = suite()
console.log(`  suite  ${baseSuite.green ? 'GREEN' : '*** NOT GREEN ***'}  ${suiteLine(baseSuite.out)}`)
if (!baseSuite.green) { console.log(firstFails(baseSuite.out).join('\n')); process.exit(1) }
const base = probe()
console.log(`  probe  ${base.green ? 'GREEN' : '*** NOT GREEN ***'}  ${verdictLine(base.out)}  ${base.ms}ms`)
if (!base.green) { console.log(firstFails(base.out).join('\n')); process.exit(1) }
// Verification 48: a run that produced no result is not a run.
const BASE_MS = base.ms

const results = []
for (const inj of INJECTIONS) {
  const src = readFileSync(ROOT + inj.file, 'utf8')
  const hits = src.split(inj.from).length - 1
  if (hits !== 1) {
    results.push({ ...inj, verdict: hits === 0 ? 'ANCHOR NOT FOUND' : `ANCHOR NOT UNIQUE (${hits})`, lines: [] })
    restore(inj.file)
    continue
  }
  writeFileSync(ROOT + inj.file, src.replace(inj.from, inj.to))
  const u = suite()
  build()
  const r = probe()
  const noResult = !/REASON SURVIVES: /.test(r.out)
  const by = [!u.green && 'react suite', !r.green && 'browser probe'].filter(Boolean)
  results.push({ ...inj,
    verdict: noResult ? 'NO RESULT (harness)' : by.length ? 'DETECTED' : 'SILENT',
    by: by.join(' + '),
    line: `suite ${suiteLine(u.out)} | probe ${verdictLine(r.out)}`,
    ms: r.ms, lines: firstFails(u.green ? r.out : u.out) })
  restore(inj.file)
}

console.log('\nFINAL REVERTED RUN')
build()
const finalSuite = suite()
const final = probe()
console.log(`  suite  ${finalSuite.green ? 'GREEN' : '*** NOT GREEN ***'}  ${suiteLine(finalSuite.out)}`)
console.log(`  probe  ${final.green ? 'GREEN' : '*** REVERTED RUN NOT GREEN ***'}  ${verdictLine(final.out)}`)
for (const rel of FILES) {
  console.log(`  ${readFileSync(ROOT + rel).equals(original.get(rel)) ? 'identical' : '*** DIFFERS ***'}  ${rel}`)
}

console.log('\n── CALIBRATION ────────────────────────────────────────────────')
console.log(`  baseline ran in ${BASE_MS}ms; a run far under that has not run`)
for (const r of results) {
  console.log(`\n${r.verdict.padEnd(20)} ${r.name}${r.by ? `  [caught by: ${r.by}]` : ''}`)
  console.log(`  claim   ${r.claim}`)
  if (r.line) console.log(`  probe   ${r.line}  ${r.ms}ms`)
  for (const l of r.lines) console.log(`          ${l}`)
}
const bad = results.filter((r) => r.verdict !== 'DETECTED')
console.log(`\n${results.length - bad.length}/${results.length} detected`)
if (bad.length) {
  console.log('\nNOT DETECTED - each names a claim with no detector (Verification 51):')
  for (const b of bad) console.log(`  ${b.verdict}: ${b.claim}`)
}
