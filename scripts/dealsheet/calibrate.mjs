// C1: THE GUARDS, INJECTED AND WATCHED
//
// Verification 9: a detector not proven capable of failing is not evidence,
// and the equality suite was GREEN ON ITS FIRST RUN, which is the tell for a
// test written to agree with the code beside it.
//
// ── ONE CALIBRATION IS NOT HERE, BECAUSE IT WAS OBSERVED ────────────────
//
// The column-alignment check fired on a REAL defect and returned to green on
// the real fix: drift 327px at 1440 and 227px at 1240 while `.stmt-row` was
// `.ds-row` and inherited the approval page's `display: flex`, then 0px at
// both widths after the rename. That is both directions on the system under
// test, watched rather than constructed, and re-injecting it would measure
// the harness rather than the change.
//
// Snapshots keyed by FULL PATH, asserted present before injecting, every
// restore compared byte for byte, an in-flight marker refusing a run that
// finds a killed one's wreckage, and `stop()` restores before it exits
// because `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/dealsheet/snap`
mkdirSync(SNAP, { recursive: true })
const MARKER = `${SNAP}/IN-FLIGHT`
const key = (f) => f.replaceAll('/', '_')
if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists; a previous run was killed mid-injection.`)
  process.exit(3)
}
const FILES = ['frontend-react/src/deal/statement.ts', 'frontend-react/src/deal/DealStatement.tsx']
const orig = {}
for (const f of FILES) {
  orig[f] = readFileSync(`${ROOT}/${f}`, 'utf8')
  writeFileSync(`${SNAP}/${key(f)}`, orig[f])
}
for (const f of FILES) if (!existsSync(`${SNAP}/${key(f)}`)) { console.error(`no snapshot for ${f}`); process.exit(3) }
writeFileSync(MARKER, new Date().toISOString())

const restore = () => { for (const f of FILES) writeFileSync(`${ROOT}/${f}`, orig[f]) }
const verify = () => FILES.find((f) => readFileSync(`${ROOT}/${f}`, 'utf8') !== orig[f]) ?? null
const run = (cmd) => {
  try { return { out: execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env }), code: 0 } }
  catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 } }
}
const stop = (code, why) => {
  restore(); run('npm run build:react')
  const bad = verify()
  if (bad) { console.error(`RESTORE FAILED on ${bad}; marker kept`); process.exit(4) }
  unlinkSync(MARKER); console.error(why); process.exit(code)
}

const UNIT = 'cd frontend-react && npx vitest run src/__tests__/deal-statement.test.ts'
const LIVE = 'node --env-file=.env scripts/dealsheet/probe-c1-statement.mjs'
// READS WHICH CHECK FAILED, never the exit code: an injection that kills a
// run early goes red without reaching the assertion it was written for.
const firedOn = (out, name) => {
  const lines = out.split('\n')
  const hit = lines.find((l) => l.includes(name) && /FAIL|×/.test(l))
  return { fired: !!hit, reds: lines.filter((l) => /FAIL|×/.test(l)).length, line: (hit ?? '').trim().slice(0, 110) }
}

console.log('── HEALTHY ──')
if (run(UNIT).code !== 0) stop(3, 'the equality suite is RED before any injection')
console.log('   11/11, green')

const INJ = [
  { what: 'the installation line reads the HARDWARE group',
    file: 'frontend-react/src/deal/statement.ts',
    from: '  const inPrice = installGroup.rawTotalPrice',
    to: '  const inPrice = hardwareGroup.rawTotalPrice',
    cmd: UNIT, name: 'MONEY IN equals the one-off and hosting rows', build: false },

  { what: 'the margin accent is computed here instead of by marginPresentation',
    file: 'frontend-react/src/deal/statement.ts',
    from: '  const mp = marginPresentation(result.achievedMargin, payload) as { text: string, state: string, note: string }',
    to: '  const mp = { text: `${result.achievedMargin.toFixed(1)}%`, state: result.achievedMargin >= 30 ? \'on-target\' : \'under-target\', note: \'\' }',
    cmd: UNIT, name: 'the margin accent is marginPresentation', build: false },

  { what: 'a drawer gains an editable input, so C1 stops being read-only',
    file: 'frontend-react/src/deal/DealStatement.tsx',
    from: '              {r.cells.map((c, j) => <td key={j}>{c}</td>)}',
    to: '              {r.cells.map((c, j) => <td key={j}><input readOnly value={c} /></td>)}',
    cmd: LIVE, name: 'C1 IS READ-ONLY', build: true },
]

const results = [['healthy: the equality suite is green before any injection', true]]
for (const inj of INJ) {
  const src = readFileSync(`${ROOT}/${inj.file}`, 'utf8')
  const n = src.split(inj.from).length - 1
  if (n !== 1) stop(3, `anchor appears ${n} times, not once: ${inj.what}`)
  writeFileSync(`${ROOT}/${inj.file}`, src.replace(inj.from, inj.to))
  if (inj.build && run('npm run build:react').code !== 0) stop(3, `the bundle would not build under: ${inj.what}`)
  const v = firedOn(run(inj.cmd).out, inj.name)
  restore()
  if (run('npm run build:react').code !== 0) stop(4, `the bundle would not rebuild after: ${inj.what}`)
  const bad = verify()
  if (bad) stop(4, `restore mismatch on ${bad} after: ${inj.what}`)
  console.log(`\n${v.fired ? 'FIRED ' : 'SILENT'}  ${inj.what}   [${v.reds} red]`)
  console.log(`        ${v.line || '(the named check did not go red)'}`)
  results.push([inj.what, v.fired])
}

console.log('\n── REVERTED ──')
const back = run(UNIT)
results.push(['green again after the revert', back.code === 0])
console.log(`   ${back.code === 0 ? '11/11, green' : 'STILL RED'}`)
console.log('')
for (const [w, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
const bad = verify()
if (bad) { console.error(`\nRESTORE MISMATCH on ${bad}`); process.exit(4) }
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
