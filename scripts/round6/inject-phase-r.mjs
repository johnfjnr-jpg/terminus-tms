// Calibration for the three row claims moved out of commercials-wiring.test.mjs
// in Round 6 Phase R. Verification 9: an assertion not proven capable of
// failing is not evidence.
//
// Verified-snapshot harness per Verification 44: full-path keys, the snapshot
// asserted to exist and be non-empty BEFORE anything is injected, the restore
// compared byte-for-byte after EVERY injection with a stop on mismatch, and a
// unique-anchor requirement so an injection cannot land twice.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-r.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })

const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))

const snapshot = (f) => {
  const src = path.join(ROOT, f)
  const bytes = fs.readFileSync(src)
  if (!bytes.length) { console.error(`REFUSED: ${f} is empty`); process.exit(2) }
  fs.writeFileSync(key(f), bytes)
  const back = fs.readFileSync(key(f))
  if (!back.equals(bytes)) { console.error(`REFUSED: snapshot of ${f} did not round-trip`); process.exit(2) }
  return bytes
}
const restore = (f, original) => {
  fs.writeFileSync(path.join(ROOT, f), original)
  const now = fs.readFileSync(path.join(ROOT, f))
  if (!now.equals(original)) { console.error(`STOP: restore of ${f} did not match`); process.exit(2) }
}

const INJECTIONS = [
  { name: 'the GST row loses its label',
    file: 'frontend-react/src/deal/rows.ts',
    find: '`GST at ${gst.pct}%, passed through`', replace: "'Tax, passed through'",
    expect: 'GST HAS A ROW' },
  { name: 'the hosting price label drops its period',
    file: 'src/lib/deal-inputs.js',
    find: '`Hosting price over ${months} months`', replace: "'Hosting price'",
    expect: 'HOSTING PERIOD' },
  { name: 'both withholding lines take the same label',
    file: 'frontend-react/src/deal/rows.ts',
    find: "full(grossUp ? 'Withholding tax, grossed up and recovered from the customer' : 'Withholding tax absorbed by Terminus',",
    replace: 'full(wht.deductedLabel,',
    expect: 'DIFFERENT money' },
  { name: 'a rate box prefills a zero nobody entered',
    file: 'frontend-react/src/deal/payload.ts',
    find: "const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))",
    replace: "const str = (v: unknown): string => (v === null || v === undefined ? '0' : String(v))",
    expect: 'prefill a value nobody entered' },
]

const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', 'src/__tests__/deal-panel.test.tsx'],
      { cwd: path.join(ROOT, 'frontend-react'), encoding: 'utf8', stdio: 'pipe' })
    return { failed: 0, out: '' }
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '')
    const m = out.match(/Tests\s+(\d+) failed/)
    return { failed: m ? Number(m[1]) : -1, out }
  }
}

const originals = new Map()
for (const inj of INJECTIONS) if (!originals.has(inj.file)) originals.set(inj.file, snapshot(inj.file))

let detected = 0
for (const inj of INJECTIONS) {
  const original = originals.get(inj.file)
  const text = original.toString('utf8')
  const hits = text.split(inj.find).length - 1
  if (hits !== 1) { console.error(`REFUSED: anchor for "${inj.name}" appears ${hits} times in ${inj.file}, needs exactly 1`); restore(inj.file, original); process.exit(2) }
  fs.writeFileSync(path.join(ROOT, inj.file), text.replace(inj.find, inj.replace))
  const t0 = Date.now()
  const r = run()
  const ms = Date.now() - t0
  const fired = r.failed > 0 && r.out.includes(inj.expect)
  if (fired) detected++
  console.log(`${fired ? 'DETECTED' : 'SILENT  '}  ${inj.name}  (${r.failed} failed, ${ms}ms)`)
  restore(inj.file, original)
}

const final = run()
console.log(`\nreverted run: ${final.failed === 0 ? 'GREEN' : `RED (${final.failed} failed)`}`)
for (const [f, bytes] of originals) {
  const same = fs.readFileSync(path.join(ROOT, f)).equals(bytes)
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${f}`)
  if (!same) process.exitCode = 2
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
