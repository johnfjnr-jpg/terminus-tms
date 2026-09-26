// ── CALIBRATION FOR M1 TO M11 ───────────────────────────────────────────
//
// Verification 9. Each injection names the TEST it must turn red; a run red on
// some OTHER test scores FIRED-ELSEWHERE, which is not a pass.
//
// Verification 44 is the harness's own discipline: full-path snapshot keys,
// the snapshot asserted before the first injection, a byte comparison after
// every one, an in-flight marker, and every stop path restores.
//
// Verification 48: a failed run with NO failing assertion is STOPPED, never
// scored - an earlier round's harness scored one and the verdict was about a
// probe that had died.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/polish/snapshots`
const MARKER = `${SNAP}/IN-FLIGHT`
mkdirSync(SNAP, { recursive: true })
const key = (p) => p.replaceAll('/', '_')
const abs = (p) => `${ROOT}/${p}`
const S5 = 'frontend-react/src/deal/section5.tsx'
const CSS = 'frontend/style.css'
const INTAKE = 'frontend-react/src/deal/intake.tsx'
const INST = 'frontend-react/src/deal/installation.ts'

const INJECTIONS = [
  { id: 'M1 the order CAPEX then OPEX', kind: 'suite', file: S5,
    find: "              flank={{ left: 'CAPEX', right: 'OPEX',",
    put: "              flank={{ left: 'OPEX', right: 'CAPEX',",
    expect: 'M1a' },
  { id: 'M1 `on` meaning OPEX', kind: 'suite', file: S5,
    find: '              on={opexOn} title={mode.title}',
    put: '              on={!opexOn} title={mode.title}',
    expect: 'M1b' },
  { id: 'M3 the Contract Duration readout', kind: 'suite', file: S5,
    find: '            <span className="label">Contract Duration</span>',
    put: '            <span className="label">Recovery period</span>',
    expect: 'M3a' },
  { id: 'M6 chosen versus defaulted', kind: 'suite', file: INST,
    find: "    recoveryGroup: s === 'twoPhase' && structureWasChosen(ui),",
    put: "    recoveryGroup: s === 'twoPhase',",
    expect: 'M6c' },
  { id: 'M7 invoicing sitting beneath the money', kind: 'suite', file: S5,
    find: '          <div className="ring-radio-group" id="deal-invoicing-toggle">',
    put: '          <div className="ring-radio-group" id="deal-invoicing-toggleX">',
    expect: 'M7a' },
  { id: 'M8 the two catalog cells', kind: 'suite', file: INTAKE,
    find: '            <span className="unit-card-cost" data-testid={`${f.id}-hostingCost`}>{rate(rates, f.hosting)}</span>',
    put: '',
    expect: 'M8' },
  { id: 'M10 the method order', kind: 'suite', file: S5,
    find: "                flank={{ left: 'STRAIGHT-LINE', right: 'DECLINING BALANCE',",
    put: "                flank={{ left: 'DECLINING BALANCE', right: 'STRAIGHT-LINE',",
    expect: 'M10a' },
  { id: 'M11 absent rather than hidden', kind: 'suite', file: S5,
    find: '        {fx.on ? (\n          <div className="po-field" id="deal-factoring-fields">',
    put: '        {true ? (\n          <div className={`po-field${fx.on ? \'\' : \' hidden\'}`} id="deal-factoring-fields">',
    expect: 'M11a' },
  // ── CSS: NO READER IN THE SUITE. jsdom loads no stylesheet, so a silent
  // verdict on any of these would mean the guard is decorative.
  { id: 'M1 the knob travelling to the active side', kind: 'live', file: CSS,
    find: '.deal-toggle--flanked::after { left: 4px; width: 10px; height: 10px; transform: translate(0, -50%); }\n.deal-toggle--flanked.is-on::after { transform: translate(22px, -50%); }',
    put: '.deal-toggle--flanked::after { left: 4px; width: 10px; height: 10px; transform: translate(22px, -50%); }\n.deal-toggle--flanked.is-on::after { transform: translate(0, -50%); }',
    expect: 'M1 the knob is at the' },
  { id: 'M1 the active label highlight', kind: 'live', file: CSS,
    find: '.deal-toggle-side[data-active="true"] { color: var(--green); }',
    put: '',
    expect: 'M1 the ACTIVE label is highlighted' },
  { id: 'M2 the card sitting immediately right', kind: 'live', file: CSS,
    find: '  grid-template-columns: minmax(0, max-content) minmax(190px, 25%);\n  justify-content: start;',
    put: '  grid-template-columns: minmax(0, 1fr) minmax(190px, 25%);',
    expect: 'M2 the factoring card sits at the standard 20px gap' },
  { id: 'M4 the radios sharing one row', kind: 'live', file: CSS,
    find: '#deal-structure-toggle { margin-bottom: 18px; }',
    put: '#deal-structure-toggle { margin-bottom: 18px; display: flex; flex-direction: column; }',
    expect: 'M4 the radios share ONE ROW' },
  { id: 'M9 the rate box being sized for its value', kind: 'live', file: CSS,
    find: '.po-factoring-panel #deal-factoring-ratePct { width: 76px; text-align: right; }',
    put: '.po-factoring-panel #deal-factoring-ratePct { width: 300px; text-align: right; }',
    expect: 'M9 the rate box is sized for' },
]
const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run died mid-injection.`); process.exit(2)
}
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
      console.error(`The marker is LEFT in place on purpose. Restore from ${SNAP}.`)
      process.exit(3)
    }
  }
}
const run = (kind) => {
  const out = `${ROOT}/.verify/polish/cal-run.txt`
  const env = { ...process.env, C_FAST: '1' }
  try {
    let text = String(execSync('npx vitest run src/__tests__/polish.test.tsx src/__tests__/deal-intake.test.tsx',
      { cwd: `${ROOT}/frontend-react`, stdio: ['ignore', 'pipe', 'pipe'] }))
    if (kind === 'live') {
      text += String(execSync('node --env-file=.env scripts/polish/probe-live.mjs',
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
    // Every runner's spelling of a failure: counting one of them reports zero
    // failures on a failing suite, which reads exactly like a clean run.
    const failCount = (text.match(/FAIL |× |✖ /g) ?? []).length
    if (failed && failCount === 0) {
      console.error(`\nSTOP: ${inj.id} FAILED with no failing assertion in ${ms}ms.`)
      console.error(`The run produced no result, so it cannot be scored. See .verify/polish/cal-run.txt`)
      restore('a run that produced no result'); rmSync(MARKER, { force: true }); process.exit(6)
    }
    const q = inj.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const named = new RegExp(`(FAIL|×|✖)\\s.*${q}`).test(text)
    const verdict = !failed ? 'SILENT' : named ? 'FIRED' : 'FIRED-ELSEWHERE'
    results.push({ ...inj, verdict, ms, failCount })
    console.log(`  ${verdict.padEnd(15)} ${inj.id.padEnd(46)} expects ${inj.expect}   ${failCount} failing, ${ms}ms`)
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
