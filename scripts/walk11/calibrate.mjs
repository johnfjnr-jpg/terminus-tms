// WALK 11: EVERY NEW CLAIM, INJECTED AND WATCHED
//
// Verification 9: a detector not proven capable of failing is not evidence.
// Verification 51: a SILENT injection is the finding, not a weaker result.
//
// ── THE HARNESS'S OWN SAFETY, and it has destroyed work twice in this estate
//
// Snapshots are keyed by FULL PATH with separators replaced, because this
// repository mirrors basenames across directories on purpose. The snapshot is
// asserted to exist before anything is injected, every restore is compared
// BYTE FOR BYTE, and an in-flight marker refuses a run that finds the wreckage
// of a killed one rather than snapshotting it as the original.
//
// EVERY STOP PATH IS A RESTORE PATH: `stop()` restores from the snapshot bytes
// before it exits, because `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk11/snap`
mkdirSync(SNAP, { recursive: true })
const MARKER = `${SNAP}/IN-FLIGHT`
const key = (f) => f.replaceAll('/', '_')

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run was killed mid-injection.`)
  console.error(`Restore the files from ${SNAP} by hand, then remove the marker.`)
  process.exit(3)
}

const FILES = [
  'frontend-react/src/deal/payload.ts',
  'frontend-react/src/deal/section4.tsx',
  'frontend-react/src/reference/KeyContacts.tsx',
]
const orig = {}
for (const f of FILES) {
  orig[f] = readFileSync(`${ROOT}/${f}`, 'utf8')
  writeFileSync(`${SNAP}/${key(f)}`, orig[f])
}
for (const f of FILES) {
  if (!existsSync(`${SNAP}/${key(f)}`)) {
    console.error(`no snapshot for ${f}; refusing to inject`); process.exit(3)
  }
}
writeFileSync(MARKER, new Date().toISOString())

const restore = () => { for (const f of FILES) writeFileSync(`${ROOT}/${f}`, orig[f]) }
const verify = () => {
  for (const f of FILES) {
    if (readFileSync(`${ROOT}/${f}`, 'utf8') !== orig[f]) return f
  }
  return null
}
const stop = (code, why) => {
  restore()
  const bad = verify()
  if (bad) { console.error(`RESTORE FAILED on ${bad}; marker kept at ${MARKER}`); process.exit(4) }
  unlinkSync(MARKER)
  console.error(why)
  process.exit(code)
}

const run = (cmd) => {
  try { return { out: execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), code: 0 } }
  catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 } }
}

// THE VERDICT READS WHICH CHECK FAILED, never the exit code alone. An
// injection that kills a run early goes red without ever reaching the
// assertion it was written for, and a red run and a red run look identical.
const firedOn = (out, name) => {
  const lines = out.split('\n')
  const hit = lines.find((l) => l.includes(name) && /FAIL|×|✖|not ok/.test(l))
  const anyRed = lines.filter((l) => /FAIL|×|✖/.test(l)).length
  return { fired: !!hit, anyRed, line: (hit ?? '').trim().slice(0, 108) }
}

const PURE = 'npm test'
const REACT = 'cd frontend-react && npx vitest run src/__tests__/deal-section4.test.tsx src/__tests__/reference-surface.test.tsx'
const BUILD = 'npm run build:react'

console.log('── HEALTHY ──')
const h1 = run(PURE), h2 = run(REACT)
if (h1.code !== 0 || h2.code !== 0) stop(3, 'red BEFORE any injection; nothing can be calibrated from here')
console.log('   pure and the two react suites are green')

const INJ = [
  { what: 'D3 the allowlist drops inLump, so the margin cannot be written',
    file: 'frontend-react/src/deal/payload.ts',
    from: "'inAqm', 'inHemir', 'inLump', 'hoSs'", to: "'inAqm', 'inHemir', 'hoSs'",
    cmd: PURE, name: 'all twelve per-line margin inputs exist' },

  { what: 'D3 the line reads the HARDWARE group instead of the install group',
    file: 'frontend-react/src/deal/section4.tsx',
    from: 'const ig = isHardware ? result?.groups?.installGroup : undefined',
    to: 'const ig = isHardware ? result?.groups?.hardwareGroup : undefined',
    cmd: REACT, name: 'D3c the price is the TARGET-margin derivation' },

  { what: 'D3 the card total stops including the installation line',
    file: 'frontend-react/src/deal/section4.tsx',
    from: 'const totalPrice = plus(group?.rawTotalPrice, ig?.rawTotalPrice)',
    to: 'const totalPrice = group?.rawTotalPrice',
    cmd: REACT, name: 'D3d the card TOTAL includes the installation line' },

  { what: 'D3 the lump-sum box is rendered on EVERY path, two writers again',
    file: 'frontend-react/src/deal/section4.tsx',
    from: '{isLumpSum ? (', to: '{true ? (',
    cmd: REACT, name: 'D3e PER UNIT: the margin is a READOUT' },

  { what: 'D1 the feedback goes back to the retired vocabulary',
    file: 'frontend-react/src/reference/KeyContacts.tsx',
    from: "r.ok ? 'Saved.' : 'Could not save that.'",
    to: "r.ok ? 'Recorded.' : 'Could not record that.'",
    cmd: REACT, name: 'D1c a saved stance reports Saved' },

  { what: 'D1 the stance note loses its accessible name',
    file: 'frontend-react/src/reference/KeyContacts.tsx',
    from: '                  aria-label={`Stance note for ${l.contact_name}, saved with the stance`}\n',
    to: '',
    cmd: REACT, name: 'D1b the stance note says what it is' },
]

const results = [['healthy: every suite green before any injection', true]]
for (const inj of INJ) {
  const src = readFileSync(`${ROOT}/${inj.file}`, 'utf8')
  const n = src.split(inj.from).length - 1
  if (n !== 1) stop(3, `anchor appears ${n} times, not once: ${inj.what}`)
  writeFileSync(`${ROOT}/${inj.file}`, src.replace(inj.from, inj.to))
  const r = run(inj.cmd)
  const v = firedOn(r.out, inj.name)
  restore()
  const bad = verify()
  if (bad) stop(4, `restore mismatch on ${bad} after: ${inj.what}`)
  console.log(`\n${v.fired ? 'FIRED ' : 'SILENT'}  ${inj.what}`)
  console.log(`        [${v.anyRed} red line(s)]  ${v.line || '(the named check did not go red)'}`)
  results.push([inj.what, v.fired])
}

console.log('\n── REVERTED ──')
const b1 = run(PURE), b2 = run(REACT)
results.push(['green again after the revert', b1.code === 0 && b2.code === 0])
run(BUILD)   // leave the bundle matching the restored source

console.log('')
for (const [w, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
const passed = results.filter(([, ok]) => ok).length
const bad = verify()
if (bad) { console.error(`\nRESTORE MISMATCH on ${bad}`); process.exit(4) }
unlinkSync(MARKER)
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
