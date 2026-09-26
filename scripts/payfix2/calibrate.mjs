// ── CALIBRATION FOR R-PT3 AND F5/F3 OPTION A ────────────────────────────
//
// Verification 9: a guard not proven capable of failing is not evidence. Each
// injection names the TEST it must turn red; a run red on some OTHER test
// scores FIRED-ELSEWHERE, which is not a pass.
//
// Verification 44 is the harness's discipline: full-path keys, the snapshot
// asserted before the first injection, a byte comparison after every one, an
// in-flight marker, and every stop path is a restore path.
//
// Verification 48: a failed run with NO failing assertion is STOPPED, never
// scored. The previous round's harness scored one, at 39,027ms against a
// 15,000ms normal, and the verdict was about a probe that had died.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/payfix2/snapshots`
const MARKER = `${SNAP}/IN-FLIGHT`
mkdirSync(SNAP, { recursive: true })
const key = (p) => p.replaceAll('/', '_')
const abs = (p) => `${ROOT}/${p}`

const INJECTIONS = [
  { id: 'R-PT3 Single phase gone from the rail',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: "const STRUCTURES = [\n  { value: 'twoPhase',",
    put: "const STRUCTURES = [\n  { value: 'single', label: 'Single phase', note: 'recovery over full term' },\n  { value: 'twoPhase',",
    expect: 'R1' },
  { id: 'R-PT3 single offered NOWHERE',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: "  { value: 'hybrid', label: 'Hybrid', note: 'milestone + hosting' },\n]",
    put: "  { value: 'hybrid', label: 'Hybrid', note: 'milestone + hosting' },\n  { value: 'single', label: 'One phase', note: 'x' },\n]",
    expect: 'R2' },
  { id: 'R-PT3 OPEX still means single',
    kind: 'suite', file: 'frontend-react/src/deal/payload.ts',
    find: "  return ui.paymentMode === 'opex' ? 'single' : ui.structure",
    put: "  return ui.paymentMode === 'opex' ? 'twoPhase' : ui.structure",
    expect: 'R3' },
  { id: 'F3 the ONE render (the old double restored)',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: '              {opexOn || hybridOn ? null : <div id="deal-capex-year-slot">{yearSchedule}</div>}',
    put: '              {opexOn ? null : <div id="deal-capex-year-slot">{yearSchedule}</div>}',
    expect: 'F3a' },
  { id: 'F3 the Hybrid render living in the grid',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: '              <div id="deal-hybrid-schedule">{hybridOn ? yearSchedule : null}</div>',
    put: '              <div id="deal-hybrid-schedule">{null}</div>',
    expect: 'F3b' },
  // ── CSS: NO READER IN THE SUITE, so a silent verdict here would mean the
  // guard is decorative. jsdom loads no stylesheet.
  { id: 'F5 SIDE BY SIDE (the grid itself)',
    kind: 'live', file: 'frontend/style.css',
    find: '#deal-hybrid-group:not(.hidden) {\n  display: grid;',
    put: '#deal-hybrid-group:not(.hidden) {\n  display: block;',
    expect: 'F5 SIDE BY SIDE' },
  { id: 'F5 TOP-ALIGNED',
    kind: 'live', file: 'frontend/style.css',
    find: '  justify-content: start;\n  gap: 20px;\n  margin-top: 22px;\n  align-items: start;',
    put: '  justify-content: start;\n  gap: 20px;\n  margin-top: 22px;\n  align-items: end;',
    expect: 'F5 TOP-ALIGNED' },
]
const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run died mid-injection.`)
  process.exit(2)
}
const original = {}
for (const f of FILES) {
  const src = readFileSync(abs(f), 'utf8')
  original[f] = src
  writeFileSync(`${SNAP}/${key(f)}`, src)
  if (!existsSync(`${SNAP}/${key(f)}`)) {
    console.error(`REFUSING: the snapshot of ${f} does not exist after writing it`); process.exit(2)
  }
}
writeFileSync(MARKER, new Date().toISOString())
const restore = (what) => {
  for (const f of FILES) {
    writeFileSync(abs(f), readFileSync(`${SNAP}/${key(f)}`, 'utf8'))
    if (readFileSync(abs(f), 'utf8') !== original[f]) {
      console.error(`STOP: ${f} did not restore byte for byte after ${what}`)
      console.error(`The marker is LEFT in place on purpose. Restore from ${SNAP}.`)
      process.exit(3)
    }
  }
}
const run = (kind) => {
  const out = `${ROOT}/.verify/payfix2/cal-run.txt`
  const env = { ...process.env, C_FAST: '1' }
  try {
    let text = String(execSync('npx vitest run src/__tests__/payment-fix-2.test.tsx',
      { cwd: `${ROOT}/frontend-react`, stdio: ['ignore', 'pipe', 'pipe'] }))
    if (kind === 'live') {
      text += String(execSync('node --env-file=.env scripts/payfix2/probe-live.mjs',
        { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }))
    }
    writeFileSync(out, text)
    return { failed: false, text }
  } catch (e) {
    const text = `${e.stdout ?? ''}${e.stderr ?? ''}`
    writeFileSync(out, text)
    return { failed: true, text }
  }
}
const results = []
try {
  for (const inj of INJECTIONS) {
    const src = original[inj.file]
    const n = src.split(inj.find).length - 1
    if (n !== 1) {
      console.error(`STOP: ${inj.id} anchor matches ${n} times in ${inj.file}, not once`)
      restore('a refused anchor'); rmSync(MARKER, { force: true }); process.exit(4)
    }
    writeFileSync(abs(inj.file), src.replace(inj.find, inj.put))
    if (readFileSync(abs(inj.file), 'utf8') === src) {
      console.error(`STOP: ${inj.id} did not change ${inj.file}`)
      restore('an edit that did not land'); rmSync(MARKER, { force: true }); process.exit(5)
    }
    if (inj.kind === 'live') execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const t0 = Date.now()
    const { failed, text } = run(inj.kind)
    const ms = Date.now() - t0
    // Every runner's spelling of a failure. Counting one of them would report
    // zero failures on a failing suite, which reads like a clean calibration.
    const failCount = (text.match(/FAIL |× |✖ /g) ?? []).length
    if (failed && failCount === 0) {
      console.error(`\nSTOP: ${inj.id} FAILED with no failing assertion in ${ms}ms.`)
      console.error(`The run produced no result, so it cannot be scored. See .verify/payfix2/cal-run.txt`)
      restore('a run that produced no result'); rmSync(MARKER, { force: true }); process.exit(6)
    }
    const q = inj.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const named = new RegExp(`(FAIL|×|✖)\\s.*${q}`).test(text)
    const verdict = !failed ? 'SILENT' : named ? 'FIRED' : 'FIRED-ELSEWHERE'
    results.push({ ...inj, verdict, ms, failCount })
    console.log(`  ${verdict.padEnd(15)} ${inj.id.padEnd(42)} expects ${inj.expect}`
      + `   ${failCount} failing, ${ms}ms`)
    restore(inj.id)
  }
} finally {
  restore('the sweep')
  rmSync(MARKER, { force: true })
}
execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
console.log('\nreverted run:')
const t0 = Date.now()
const final = run('live')
console.log(`  ${final.failed ? 'RED' : 'GREEN'}  ${Date.now() - t0}ms`)
const fired = results.filter((r) => r.verdict === 'FIRED').length
console.log(`\n${fired} of ${results.length} injections fired on their OWN named assertion`)
if (fired !== results.length || final.failed) process.exit(1)
