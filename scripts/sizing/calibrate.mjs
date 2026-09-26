// ── CALIBRATION: S1's GUARD, PROVEN IN BOTH DIRECTIONS ──────────────────
//
// S1 asks for it by name: "Calibrate by oversizing one field and undersizing
// another." Both directions matter because the band has two edges and a guard
// that only catches one of them is half a guard.
//
// Verification 44's discipline throughout; Verification 48 stops a run that
// produced no result rather than scoring it.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/sizing/snapshots`
const MARKER = `${SNAP}/IN-FLIGHT`
mkdirSync(SNAP, { recursive: true })
const key = (p) => p.replaceAll('/', '_')
const abs = (p) => `${ROOT}/${p}`
const CSS = 'frontend/style.css'
const S5 = 'frontend-react/src/deal/section5.tsx'
const REG = 'src/lib/field-formats.js'
const ANCHOR = '.po-factoring-panel #deal-factoring-ratePct,\n.po-factoring-panel #deal-factoring-termMonths { text-align: right; }'

const INJECTIONS = [
  { id: 'S1 OVERSIZED: a field made too wide', kind: 'live', file: CSS,
    find: ANCHOR,
    put: `${ANCHOR}\n#deal-ssExisting { width: 200px !important; }`,
    expect: 'S1 every numeric input within 100-135%' },
  { id: 'S1 UNDERSIZED: a field made too narrow', kind: 'live', file: CSS,
    find: ANCHOR,
    put: `${ANCHOR}\n#deal-targetMargin { width: 9px !important; }`,
    expect: 'S1 every numeric input within 100-135%' },
  { id: 'S1 the registry being consulted at all', kind: 'live', file: REG,
    find: 'export const FIELD_PADDING_PX = 4',
    put: 'export const FIELD_PADDING_PX = 40',
    expect: 'S1 every numeric input within 100-135%' },
  { id: 'N5 the track and knob being the factoring one\'s', kind: 'live', file: CSS,
    find: '.btn-ghost.deal-toggle--flanked { padding-left: 36px; width: auto; }',
    put: '.btn-ghost.deal-toggle--flanked { padding-left: 36px; width: auto; }\n'
      + '.deal-toggle--flanked::before { width: 40px; height: 16px; }',
    expect: 'N5 the mode TRACK equals the factoring track' },
  /* THE FIRST VERSION OF THIS INJECTION WAS MALFORMED and came back SILENT:
     it inserted `.x{}` INSIDE the `:root` block, which is invalid CSS the
     parser simply discards, so nothing changed and the silence said nothing
     about the guard. Verification 51's caveat - before a silence names a
     missing detector, confirm the injection actually fired.

     This one restores the outlier the round removed: the Units card's own 9px,
     which is the exact regression S2 exists to catch. */
  { id: 'S2 the one field-label token', kind: 'live', file: CSS,
    find: ANCHOR,
    put: `${ANCHOR}\n.unit-card label { font-size: 9px; }`,
    expect: 'S2 the Units and Installation LABEL fonts are equal' },
  { id: 'N6 invoicing rendering above the money', kind: 'suite', file: S5,
    find: '          <div className="ring-radio-group" id="deal-invoicing-toggle">',
    put: '          <div className="ring-radio-group" id="deal-invoicing-toggleX">',
    expect: 'N6a' },
]
const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

if (existsSync(MARKER)) { console.error(`REFUSING: ${MARKER} exists`); process.exit(2) }
const original = {}
for (const f of FILES) {
  const src = readFileSync(abs(f), 'utf8')
  original[f] = src
  writeFileSync(`${SNAP}/${key(f)}`, src)
  if (!existsSync(`${SNAP}/${key(f)}`)) { console.error(`REFUSING: snapshot of ${f} missing`); process.exit(2) }
}
writeFileSync(MARKER, new Date().toISOString())
const restore = (what) => {
  for (const f of FILES) {
    writeFileSync(abs(f), readFileSync(`${SNAP}/${key(f)}`, 'utf8'))
    if (readFileSync(abs(f), 'utf8') !== original[f]) {
      console.error(`STOP: ${f} did not restore byte for byte after ${what}`)
      console.error(`The marker is LEFT in place. Restore from ${SNAP}.`)
      process.exit(3)
    }
  }
}
const run = (kind) => {
  const out = `${ROOT}/.verify/sizing/cal-run.txt`
  const env = { ...process.env, C_FAST: '1' }
  try {
    let text = String(execSync('npx vitest run src/__tests__/polish.test.tsx src/__tests__/field-formats.test.ts',
      { cwd: `${ROOT}/frontend-react`, stdio: ['ignore', 'pipe', 'pipe'] }))
    if (kind === 'live') {
      text += String(execSync('node --env-file=.env scripts/sizing/probe-live.mjs',
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
    execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const t0 = Date.now()
    const { failed, text } = run(inj.kind)
    const ms = Date.now() - t0
    const failCount = (text.match(/FAIL |× |✖ /g) ?? []).length
    if (failed && failCount === 0) {
      console.error(`\nSTOP: ${inj.id} FAILED with no failing assertion in ${ms}ms.`)
      restore('a run that produced no result'); rmSync(MARKER, { force: true }); process.exit(6)
    }
    const q = inj.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const named = new RegExp(`(FAIL|×|✖)\\s.*${q}`).test(text)
    const verdict = !failed ? 'SILENT' : named ? 'FIRED' : 'FIRED-ELSEWHERE'
    results.push({ ...inj, verdict, ms, failCount })
    console.log(`  ${verdict.padEnd(15)} ${inj.id.padEnd(48)} ${failCount} failing, ${ms}ms`)
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
