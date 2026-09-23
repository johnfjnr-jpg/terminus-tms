// C2: EVERY NEW CLAIM, INJECTED AND WATCHED
//
// Verification 9. The new writable key gets TWO injections, one per
// allowlist, because this round learned the hard way that there are two and
// that removing either produces a different silence:
//
//   - drop it from the CLIENT list and the key is never sent, so the record
//     simply never carries it;
//   - drop it from the SERVER list and the whole save is refused, so nothing
//     the person typed lands at all.
//
// Both read as "the edit did not work" and they are different faults.
//
// Snapshots keyed by full path, asserted present before injecting, every
// restore compared byte for byte, an in-flight marker refusing a run that
// finds a killed one's wreckage, and `stop()` restores before it exits
// because `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/dealsheet/snap-c2`
mkdirSync(SNAP, { recursive: true })
const MARKER = `${SNAP}/IN-FLIGHT`
const key = (f) => f.replaceAll('/', '_')
if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists; a previous run was killed mid-injection.`)
  process.exit(3)
}
const FILES = [
  'src/lib/deal-calculator.js',
  'src/lib/rate-resolution.js',
  'src/routes/opportunities.js',
  'frontend-react/src/deal/payload.ts',
  'frontend-react/src/deal/statement.ts',
]
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
const PURE = 'npm test'
const LIVE = 'node --env-file=.env scripts/dealsheet/probe-c2-editing.mjs'
const firedOn = (out, name) => {
  const lines = out.split('\n')
  const hit = lines.find((l) => l.includes(name) && /FAIL|×|✖/.test(l))
  return { fired: !!hit, reds: lines.filter((l) => /FAIL|×|✖/.test(l.trim())).length,
    line: (hit ?? '').trim().slice(0, 118) }
}

console.log('── HEALTHY ──')
if (run(UNIT).code !== 0) stop(3, 'the statement suite is RED before any injection')
console.log('   18/18, green')

const INJ = [
  { what: 'R-C2b: hwWarranty becomes overridable',
    file: 'src/lib/deal-calculator.js',
    from: "  'hwSs', 'hwAqm', 'hwHemir',\n  'inLump',",
    to: "  'hwSs', 'hwAqm', 'hwHemir', 'hwWarranty',\n  'inLump',",
    // THE MATCHER NAMES THE TEST THE INJECTION ACTUALLY FALSIFIES, which is
    // not the one it was written for. Making hwWarranty overridable does not
    // move the warranty on a fixture that sets no warranty override, so "THE
    // WARRANTY PROVISION IS UNTOUCHED" stays green and correctly so. The test
    // that fires is the one passing `hwWarranty: 500000` and expecting the
    // pricing to ignore it. Verification 51: a silence is the finding only
    // after the matcher has been cleared.
    cmd: PURE, name: 'hwWarranty is not an overridable line', build: false },

  { what: 'R-C2b: the either-or goes away, the margin stays an editor',
    file: 'frontend-react/src/deal/statement.ts',
    from: '      r.overridden ? null : `deal-margin-${r.key}`,',
    to: '      `deal-margin-${r.key}`,',
    cmd: UNIT, name: 'an overridden hardware PRICE moves the line', build: false },

  // THE INJECTION MUST VIOLATE THE CLAIM THE TEST MAKES. The first one added
  // `ssUnitCost` to OVERRIDABLE_RATE_KEYS, which leaves it in
  // CATALOG_ONLY_RATE_KEYS as well - so the disjointness this test asserts,
  // between the catalog list and the WRITABLE ALLOWLIST, was never broken. It
  // went red seventeen ways for an unrelated reason (a key in both rate lists)
  // and the named check stayed green, which is how a badly aimed injection
  // reads as a missing detector.
  { what: 'R-C2a: a catalog rate joins the writable allowlist',
    file: 'frontend-react/src/deal/payload.ts',
    from: "  'ssExisting', 'ssNew', 'aqm', 'hemir', 'installResp', 'lumpSumCost',",
    to: "  'ssExisting', 'ssNew', 'aqm', 'hemir', 'installResp', 'lumpSumCost', 'ssUnitCost',",
    cmd: PURE, name: 'no catalog-only rate is in the writable allowlist', build: false },

  { what: 'the NEW KEY drops out of the SERVER allowlist, so the save is refused',
    file: 'src/routes/opportunities.js',
    from: "    'targetMargin', 'marginOverrides', 'priceOverrides',",
    to: "    'targetMargin', 'marginOverrides',",
    cmd: LIVE, name: 'Save landed as the next revision', build: false },

  { what: 'the NEW KEY drops out of the CLIENT allowlist, so it is never sent',
    file: 'frontend-react/src/deal/payload.ts',
    from: "  'priceOverrides',\n] as const",
    to: "] as const",
    cmd: LIVE, name: 'DB READ-BACK: priceOverrides.hwSs stored', build: true },
]

const results = [['healthy: the statement suite is green before any injection', true]]
for (const inj of INJ) {
  const src = readFileSync(`${ROOT}/${inj.file}`, 'utf8')
  const n = src.split(inj.from).length - 1
  if (n !== 1) stop(3, `anchor appears ${n} times, not once: ${inj.what}`)
  writeFileSync(`${ROOT}/${inj.file}`, src.replace(inj.from, inj.to))
  if (inj.build && run('npm run build:react').code !== 0) stop(3, `the bundle would not build under: ${inj.what}`)
  // The dev server runs under --watch, so a src/ change is live by the time
  // the probe runs; a moment is given for the reload rather than assumed.
  run('sleep 2')
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
run('sleep 2')
const back = run(UNIT)
results.push(['green again after the revert', back.code === 0])
console.log(`   ${back.code === 0 ? '18/18, green' : 'STILL RED'}`)
console.log('')
for (const [w, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
const bad = verify()
if (bad) { console.error(`\nRESTORE MISMATCH on ${bad}`); process.exit(4) }
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
