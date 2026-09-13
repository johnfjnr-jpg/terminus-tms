// ── CALIBRATION: one injection per claim, on the real files ──────────────
//
// Verification 9. And Verification 9's LEADS clause: anchor on WHICH check
// failed, never on the exit code - an injection that kills the probe some
// other way goes red and proves nothing.
//
// Verification 44's harness clauses: snapshot by FULL PATH, assert the
// snapshot exists before injecting, compare bytes after every injection,
// an in-flight marker so a killed run cannot bless its wreckage, and a
// final reverted run.
//
// The probe is HEADED and slow, so this is minutes per injection. That is
// the price of measuring claim (b) at all.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = join(process.env.TMPDIR ?? '/tmp', 'gridw-calib')
const FLIGHT = join(SNAP, 'IN_FLIGHT')
const FILES = ['frontend/style.css', 'frontend-react/src/leads/NewLeadGrid.tsx']
const key = (f) => f.replaceAll('/', '_')

if (existsSync(FLIGHT)) {
  console.error(`REFUSING: a previous run was killed mid-injection.`)
  console.error(`Restore from ${SNAP}, then delete ${FLIGHT}.`); process.exit(2)
}
mkdirSync(SNAP, { recursive: true })
const original = new Map()
for (const f of FILES) {
  const b = readFileSync(join(ROOT, f))
  writeFileSync(join(SNAP, key(f)), b)
  if (!existsSync(join(SNAP, key(f)))) { console.error(`no snapshot for ${f}`); process.exit(2) }
  original.set(f, b)
}
console.log(`snapshotted ${FILES.length} files by full path, all present\n`)

const INJECTIONS = [
  { claim: '(a) the modal is NEAR-FULL-WIDTH at 3440',
    why: 'the 1480px cap restored - the exact state Phase 0 measured',
    file: 'frontend/style.css',
    from: '  width: 95vw;\n  max-width: 95vw;', to: '  max-width: min(1480px, 96vw);' },

  { claim: '(b) the scroll bar has REAL RENDERED HEIGHT, not an overlay',
    why: 'the scrollbar height removed, so the platform overlay returns',
    file: 'frontend/style.css',
    from: '.new-lead-scroll::-webkit-scrollbar { height: 12px; width: 12px; }',
    to:   '.new-lead-scroll::-webkit-scrollbar { height: 0; width: 0; }' },

  { claim: '(c) NAME is visible again after the reopen',
    why: 'the horizontal axis reset removed - Round A\'s exact blind spot',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: '      scrollRef.current.scrollLeft = 0\n', to: '' },
]

const build = () => { try { execFileSync('npm', ['run', 'build:react'], { cwd: ROOT, stdio: 'pipe' }) } catch {} }
const run = () => {
  const t = Date.now()
  let out = ''
  try {
    out = execFileSync('node', ['scripts/grid-width/probe-p1.mjs'],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
        env: { ...process.env, PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer' } })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  return { out, ms: Date.now() - t }
}
const restore = () => {
  for (const f of FILES) writeFileSync(join(ROOT, f), original.get(f))
  for (const f of FILES) if (!readFileSync(join(ROOT, f)).equals(original.get(f))) {
    console.error(`RESTORE MISMATCH on ${f}. Stopping rather than compounding.`); process.exit(2) }
  build()
}

build()
const base = run()
const baseFails = (base.out.match(/^  FAIL/gm) ?? []).length
if (baseFails !== 0) { console.error(`baseline has ${baseFails} failures; nothing below would mean anything.`); process.exit(2) }
console.log(`baseline: 0 failures, ${base.ms}ms\n`)

writeFileSync(FLIGHT, 'injecting')
let silent = 0
for (const inj of INJECTIONS) {
  const path = join(ROOT, inj.file)
  const src = readFileSync(path, 'utf8')
  const hits = src.split(inj.from).length - 1
  if (hits !== 1) { console.error(`ANCHOR NOT UNIQUE (${hits}) for "${inj.claim}". Refusing to guess.`)
    restore(); rmSync(FLIGHT); process.exit(2) }
  writeFileSync(path, src.replace(inj.from, inj.to))
  build()
  const r = run()
  // ANCHORED ON THE CLAIM'S OWN TEXT, not the exit code.
  const fired = r.out.includes(`FAIL  ${inj.claim}`)
  const totalFails = (r.out.match(/^  FAIL/gm) ?? []).length
  restore()
  if (!fired) silent++
  console.log(`${fired ? 'FIRED ' : 'SILENT'}  ${inj.claim}`)
  console.log(`        ${inj.why}`)
  console.log(`        ${totalFails} checks failed in that run, ${r.ms}ms\n`)
}
const final = run()
rmSync(FLIGHT)
const finalFails = (final.out.match(/^  FAIL/gm) ?? []).length
console.log(`reverted run: ${finalFails} failures, ${final.ms}ms`)
for (const f of FILES) if (!readFileSync(join(ROOT, f)).equals(original.get(f))) {
  console.error(`byte mismatch: ${f}`); process.exit(2) }
console.log(`all ${FILES.length} files byte-identical to their snapshots`)
console.log(`\n${INJECTIONS.length - silent}/${INJECTIONS.length} fired, ${silent} silent`)
process.exit(silent || finalFails ? 1 : 0)
