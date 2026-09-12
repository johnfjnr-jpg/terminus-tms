// F6 calibration: prove every gate-verdict claim can FAIL.
//
// Harness discipline per Verification 44: snapshots keyed on FULL PATH,
// asserted to exist before injecting; restored bytes compared after EVERY
// injection with a hard stop on mismatch; an IN_FLIGHT marker so a killed run
// cannot have its wreckage snapshotted as the original; a final reverted run.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/leads-card/f6-snapshots`
const INFLIGHT = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

if (existsSync(INFLIGHT)) {
  console.error(`REFUSING: ${INFLIGHT} exists, so a previous run was killed mid-injection.`)
  process.exit(2)
}

const key = (f) => f.replaceAll('/', '_')
const FILES = ['scripts/lib/gate-verdict.mjs', 'scripts/verify-all.mjs']
const ORIGINAL = new Map()
for (const f of FILES) {
  const b = readFileSync(`${ROOT}/${f}`)
  writeFileSync(`${SNAP}/${key(f)}`, b)
  if (!existsSync(`${SNAP}/${key(f)}`)) throw new Error(`snapshot of ${f} missing`)
  ORIGINAL.set(f, b)
}
console.log(`  snapshotted ${FILES.length} files, keyed on full path`)

// EXIT CODE, not a line format. A runner printing "fail N" where a matcher
// looks for "not ok" reports zero failures while tests are failing.
const run = () => {
  const t0 = Date.now()
  try {
    execFileSync('node', ['--test', 'scripts/tests/gate-verdict.test.mjs'],
      { cwd: ROOT, encoding: 'utf8', timeout: 60000 })
    return { code: 0, ms: Date.now() - t0 }
  } catch (e) { return { code: e.status ?? -1, ms: Date.now() - t0, out: `${e.stdout ?? ''}` } }
}

const restore = (f) => {
  writeFileSync(`${ROOT}/${f}`, ORIGINAL.get(f))
  if (!readFileSync(`${ROOT}/${f}`).equals(ORIGINAL.get(f))) {
    console.error(`RESTORE MISMATCH on ${f} - stopping dead`); process.exit(3)
  }
}

const INJECTIONS = [
  { name: 'THE ORIGINAL FAULT: a skipped run claims every stage passed',
    file: 'scripts/lib/gate-verdict.mjs',
    from: '  lines.push(`${ran} of ${stageCount} stages passed, ${skipped} NOT RUN.`)',
    to:   '  lines.push(`All ${stageCount} stages passed.`)' },
  { name: 'a round close stops failing on a skipped required stage',
    file: 'scripts/lib/gate-verdict.mjs',
    from: "      return { lines, exitCode: 1 }\n    }",
    to:   "      return { lines, exitCode: 0 }\n    }" },
  { name: 'an ORDINARY run starts failing too, losing the recorded reason',
    file: 'scripts/lib/gate-verdict.mjs',
    from: '    if (roundClose) {', to: '    if (true) {' },
  { name: 'the door stage loses required: true',
    file: 'scripts/verify-all.mjs',
    from: "    required: true,\n    name: 'HTTP readonly-view probe',",
    to:   "    name: 'HTTP readonly-view probe'," },
  { name: 'the gate stops reading --round-close',
    file: 'scripts/verify-all.mjs',
    from: "process.argv.includes('--round-close')", to: 'false' },
]

writeFileSync(INFLIGHT, 'in flight')
const verdicts = []
try {
  for (const inj of INJECTIONS) {
    const src = ORIGINAL.get(inj.file).toString('utf8')
    const n = src.split(inj.from).length - 1
    if (n !== 1) { console.error(`ANCHOR NOT UNIQUE for "${inj.name}": ${n}`); process.exit(4) }
    writeFileSync(`${ROOT}/${inj.file}`, src.replace(inj.from, inj.to))
    if (readFileSync(`${ROOT}/${inj.file}`).equals(ORIGINAL.get(inj.file))) {
      console.error(`INJECTION DID NOT LAND: ${inj.name}`); process.exit(5)
    }
    const r = run()
    const fired = r.code !== 0
    verdicts.push({ ...inj, fired })
    console.log(`  ${fired ? 'FIRED ' : 'SILENT'}  ${inj.name}  (exit ${r.code}, ${r.ms}ms)`)
    if (!fired) writeFileSync(`${ROOT}/.verify/leads-card/f6-silent-${verdicts.length}.txt`, r.out ?? '(no output)')
    restore(inj.file)
  }
} finally {
  for (const f of FILES) restore(f)
  rmSync(INFLIGHT, { force: true })
}

console.log('\n  FINAL REVERTED RUN')
const final = run()
console.log(`  exit ${final.code}, ${final.ms}ms`)
const silent = verdicts.filter((v) => !v.fired)
console.log(`\n  ${verdicts.length - silent.length}/${verdicts.length} injections fired`)
for (const v of silent) console.log(`  SILENT: ${v.name}`)
process.exit(silent.length === 0 && final.code === 0 ? 0 : 1)
