// Calibration for the grid/cell reconciliation test. Three injections, each the
// real fault the test exists to catch, plus the healthy run at both ends.
//
// Harness discipline per the skill and Verification 44: snapshots keyed by FULL
// PATH (this estate mirrors basenames on purpose), the snapshot asserted to
// exist BEFORE anything is injected, bytes compared after EVERY injection with
// a hard stop on mismatch, an in-flight marker so a killed run cannot bless its
// own wreckage as the next run's baseline, and a final reverted run.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/0a84a38b-2e9e-4092-bcb4-85f9dfb560c7/scratchpad/grid-cal'
const INFLIGHT = `${SNAP}/IN_FLIGHT`
const key = (f) => `${SNAP}/${f.replaceAll('/', '_')}`

const FILES = ['frontend-react/src/testbed/headerStats.ts', 'frontend/style.css',
  'frontend-react/src/__tests__/testbed-header-stats.test.tsx']

if (existsSync(INFLIGHT)) {
  console.error(`REFUSING: a previous run died mid-injection. Restore from ${SNAP} by hand.`)
  process.exit(2)
}
mkdirSync(SNAP, { recursive: true })
for (const f of FILES) writeFileSync(key(f), readFileSync(resolve(ROOT, f)))
for (const f of FILES) if (!existsSync(key(f))) { console.error(`no snapshot for ${f}`); process.exit(2) }
writeFileSync(INFLIGHT, 'injecting')

const run = () => {
  const t0 = Date.now()
  let out = ''
  let code = 0
  try {
    out = execSync('npx vitest run src/__tests__/testbed-header-stats.test.tsx 2>&1',
      { cwd: `${ROOT}/frontend-react`, encoding: 'utf8' })
  } catch (e) { out = (e.stdout ?? '') + (e.stderr ?? ''); code = e.status ?? 1 }
  return { code, out, ms: Date.now() - t0 }
}
const restore = () => {
  for (const f of FILES) writeFileSync(resolve(ROOT, f), readFileSync(key(f)))
  for (const f of FILES) {
    if (!readFileSync(resolve(ROOT, f)).equals(readFileSync(key(f)))) {
      console.error(`RESTORE MISMATCH on ${f} - stopping dead`); process.exit(3)
    }
  }
}
const patch = (f, from, to) => {
  const p = resolve(ROOT, f)
  const s = readFileSync(p, 'utf8')
  if (!s.includes(from)) { console.error(`anchor not found in ${f}: ${from.slice(0, 50)}`); process.exit(2) }
  if (s.split(from).length - 1 !== 1) { console.error(`anchor not UNIQUE in ${f}`); process.exit(2) }
  writeFileSync(p, s.replace(from, to))
}

const INJECTIONS = [
  { name: 'a SIXTH cell, the grid untouched  (the real fault)',
    expect: 'declares one column per cell',
    go: () => patch(FILES[0], "      { label: 'Contracted end', value: date(payload?.estGoLiveDate), overdue },",
      "      { label: 'Contracted end', value: date(payload?.estGoLiveDate), overdue },\n      { label: 'Sixth', value: 'x' },") },
  { name: 'the grid drops back to FOUR columns, the cells untouched',
    expect: 'declares one column per cell',
    go: () => patch(FILES[1], 'grid-template-columns: 1fr 1fr 1.4fr 1fr 1fr;',
      'grid-template-columns: 1fr 1fr 1.4fr 1fr;') },
  { name: 'the scan reads the file RAW, so prose satisfies it  (Verification 39)',
    expect: 'reads the RULE',
    go: () => patch(FILES[2], 'const css = stripCss(raw)', 'const css = raw') },
]

const base = run()
console.log(`  healthy      exit ${base.code}  ${base.ms}ms  ${base.code === 0 ? 'GREEN' : 'RED - stopping'}`)
if (base.code !== 0) { restore(); rmSync(INFLIGHT); process.exit(2) }

let allFired = true
for (const inj of INJECTIONS) {
  inj.go()
  const r = run()
  const fired = r.code !== 0 && r.out.includes(inj.expect)
  console.log(`  ${fired ? 'FIRED  ' : 'SILENT '}  exit ${r.code}  ${String(r.ms).padStart(5)}ms  ${inj.name}`)
  if (!fired) { allFired = false; console.log(`            expected the failure to name: ${inj.expect}`) }
  restore()
}
const end = run()
console.log(`  reverted     exit ${end.code}  ${end.ms}ms  ${end.code === 0 ? 'GREEN' : 'RED'}`)
rmSync(INFLIGHT)
process.exit(allFired && end.code === 0 ? 0 : 1)
