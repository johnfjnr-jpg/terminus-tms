// Calibration for the rebuilt Test Bed accounting state walk, Round 7 Phase 2.
// Verified-snapshot harness: full-path keys, snapshot round-tripped before any
// injection, restore compared byte-for-byte after each, final reverted run.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-accounting.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })
const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))
const snapshot = (f) => {
  const b = fs.readFileSync(path.join(ROOT, f))
  if (!b.length) { console.error(`REFUSED: ${f} empty`); process.exit(2) }
  fs.writeFileSync(key(f), b)
  if (!fs.readFileSync(key(f)).equals(b)) { console.error(`REFUSED: ${f} snapshot`); process.exit(2) }
  return b
}
const restore = (f, o) => {
  fs.writeFileSync(path.join(ROOT, f), o)
  if (!fs.readFileSync(path.join(ROOT, f)).equals(o)) { console.error(`STOP: restore of ${f}`); process.exit(2) }
}

const A = 'scripts/tests/test-bed-accounting.test.mjs'
const H = 'frontend-react/src/testbed/TestBedHost.tsx'

const INJECTIONS = [
  { name: 'a LOGIC-ONLY capability is claimed as rendered', file: A,
    find: "  { cap: 'scoring', state: 'logic-only' },\n",
    replace: '',
    expect: 'the capabilities the React surface does not render are EXACTLY the recorded ones' },

  { name: 'a RENDERED capability is dropped from the host, so it regresses', file: H,
    find: "import { NotesHistory } from '../contact/NotesHistory'",
    replace: "import { NotesHistory } from './notesShim'",
    expect: 'declared module EXISTS' },

  { name: 'the walk stops being TRANSITIVE, so every hop past the panel is lost', file: A,
    find: '      const r = resolveFrom(f, m[1])\n      if (r) q.push(r)',
    replace: '      const r = resolveFrom(f, m[1])\n      if (r && f === \'testbed/TestBedHost.tsx\') q.push(r)',
    expect: 'the walk did not follow a second hop' },

  { name: 'the walk starts from a file that does not exist, so it returns nothing', file: A,
    find: "  const q = ['testbed/TestBedHost.tsx']",
    replace: "  const q = ['testbed/NoSuchHost.tsx']",
    expect: 'the walk did not start' },

  { name: 'a declared module is a typo, and the state silently reads absent', file: A,
    find: "  'cost-preview': { modules: ['testbed/costPreview.ts'],",
    replace: "  'cost-preview': { modules: ['testbed/costPreviewX.ts'],",
    expect: 'declared modules that do not exist' },

  { name: 'the swap gate is inverted while the debt list is non-empty', file: A,
    find: "  assert.equal(takeable, false,",
    replace: "  assert.equal(takeable, true,",
    expect: 'and the swap is takeable only when that set is EMPTY' },
]

const run = () => {
  try {
    execFileSync('node', ['--test', A], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { failed: 0, out: '' }
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '')
    const m = out.match(/[#ℹ] fail (\d+)/)
    return { failed: m ? Number(m[1]) : -1, out }
  }
}

const originals = new Map()
for (const i of INJECTIONS) if (!originals.has(i.file)) originals.set(i.file, snapshot(i.file))

let detected = 0
for (const inj of INJECTIONS) {
  const original = originals.get(inj.file)
  const text = original.toString('utf8')
  const hits = text.split(inj.find).length - 1
  if (hits !== 1) { console.error(`REFUSED: anchor for "${inj.name}" appears ${hits} times`); restore(inj.file, original); process.exit(2) }
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
for (const [f, b] of originals) {
  const same = fs.readFileSync(path.join(ROOT, f)).equals(b)
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${f}`)
  if (!same) process.exitCode = 2
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
