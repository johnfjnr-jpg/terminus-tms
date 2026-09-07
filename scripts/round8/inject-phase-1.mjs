// Calibration for Round 8 Phase 1: the door, record-read.
//
// Uses session 2's hardened harness verbatim: the .in-flight marker that
// refuses to snapshot the wreckage of a killed run, and the expectHang stop
// that never scores a run which produced no parseable result.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-1.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })
const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))

// ── A KILLED HARNESS MUST NOT BE INVISIBLE. Round 7 Phase 2d session 2 ──
//
// THIS HARNESS DESTROYED THE WORK IT WAS CALIBRATING, on its first run, and it
// is the third instance of that shape in this project (Verification 44).
//
// The mechanism, and it is specific to a sweep that deliberately injects a
// HANG: injections 1-14 each fail in a few seconds, so the run raced through
// them, applied the last one - which removes a guard against an infinite render
// loop - and hung. The shell killed the whole process at its own two-minute
// wall, so the restore never ran and the mutation stayed on disk.
//
// THE SECOND RUN THEN SNAPSHOTTED THE MUTATION AS THE ORIGINAL and faithfully
// restored it after every injection. The damage was not merely left: it was
// blessed. The only reason it surfaced is that the suite hung afterwards, which
// is luck rather than a control.
//
// The marker is the control. It is written before the first injection and
// removed after the final revert, so a run that finds one knows the previous
// run died mid-injection and REFUSES rather than snapshotting the wreckage.
const MARKER = path.join(SNAP, '.in-flight')
if (fs.existsSync(MARKER)) {
  console.error('REFUSED: a previous run of this harness did not finish.')
  console.error('  Its snapshots are in ' + SNAP + ' and the tree may still carry an injection.')
  console.error('  Restore each file from its snapshot, then delete ' + MARKER)
  process.exit(2)
}
const snapshot = (f) => {
  const b = fs.readFileSync(path.join(ROOT, f))
  if (!b.length) { console.error(`REFUSED: ${f} is empty`); process.exit(2) }
  fs.writeFileSync(key(f), b)
  if (!fs.readFileSync(key(f)).equals(b)) { console.error(`REFUSED: ${f} snapshot`); process.exit(2) }
  return b
}
const restore = (f, o) => {
  fs.writeFileSync(path.join(ROOT, f), o)
  if (!fs.readFileSync(path.join(ROOT, f)).equals(o)) { console.error(`STOP: restore of ${f}`); process.exit(2) }
}

const O = 'src/lib/ownership.js'
const A = 'frontend/app.js'
const V = 'frontend-react/src/testbed/viewLoad.ts'
const H = 'frontend/index.html'

const INJECTIONS = [
  { name: 'the derivation inverts, locking the owner out of their own record', file: O,
    find: '  return !!ownerId && !!viewerId && ownerId !== viewerId',
    replace: '  return !!ownerId && !!viewerId && ownerId === viewerId',
    expect: 'an OWNED record refuses nothing' },

  { name: 'the derivation stops needing an owner, so an unowned record locks', file: O,
    find: '  return !!ownerId && !!viewerId && ownerId !== viewerId',
    replace: '  return ownerId !== viewerId',
    expect: 'an absent id on either side is NOT not-mine' },

  { name: 'a cleared view falls back to its last owner', file: O,
    find: '    clear(view) { owners.delete(view) },',
    replace: '    clear(view) { void view },',
    expect: 'a cleared view kept its owner' },

  { name: 'THE DOOR OPENS FOR EVERYBODY', file: O,
    find: 'export function canEditRecord(ownerId, viewerId) {\n  return !notMine(ownerId, viewerId)',
    replace: 'export function canEditRecord() {\n  return true',
    expect: 'an UNOWNED record refuses CLICK, ENTER, SPACE and SEED' },

  { name: 'THE DOOR READS THE CLASS AGAIN, which a swap can retire', file: A,
    find: "  'test-bed-detail': () => ownedByMe('test-bed-detail'),",
    replace: "  'test-bed-detail': () => !document.getElementById('view-test-bed-detail')\n    ?.classList.contains('is-not-mine'),",
    expect: 'THE DOOR DOES NOT READ is-not-mine' },

  { name: 'the Opportunity door stops asking the record', file: A,
    find: "  'opportunity-detail': () => ownedByMe('opportunity-detail'),",
    replace: "  'opportunity-detail': () => true,",
    expect: 'opportunity-detail does not answer through the shared derivation' },

  { name: 'the register keeps the previous record owner, never clearing', file: O,
    find: '    set(view, ownerId) { owners.set(view, ownerId ?? null) },',
    replace: '    set(view, ownerId) { if (!owners.has(view)) owners.set(view, ownerId ?? null) },',
    expect: 'THE REGISTER OVERWRITES' },

  { name: 'the shell stops publishing the shared derivation', file: H,
    find: "  window.canEditRecord = canEditRecord\n  window.createViewOwners = createViewOwners",
    replace: '  // not published',
    expect: 'the shell does not publish the derivation' },

  { name: 'the React tree defines its own notMine again', file: V,
    find: "export { notMine } from '../../../src/lib/ownership.js'",
    replace: 'export function notMine(o, v) { return !!o && !!v && o !== v }',
    expect: 'the React tree defines its own notMine instead of reading the shared one' },

  { name: 'the stylesheet loses the read-only treatment', file: 'frontend/style.css',
    find: '.is-not-mine input, .is-not-mine textarea, .is-not-mine select { pointer-events: none; opacity: 0.45; }',
    replace: '.is-not-mine-DISABLED input { opacity: 0.45; }',
    expect: 'the class SURVIVES as presentation' },
]

const SUITES = ['src/__tests__/door-record-read.test.tsx']

// The app.js, index.html and stylesheet injections are invisible to vitest, so
// the node door test runs alongside and the two results are combined.
const NODE_TESTS = ['scripts/tests/ownership.test.mjs']
// ONE HARNESS, TWO RUNNERS: the door lives in three files vitest cannot see.
const run = () => {
  let failed = 0
  let out = ''
  try {
    execFileSync('npx', ['vitest', 'run', ...SUITES, '--testTimeout=8000'],
      { cwd: path.join(ROOT, 'frontend-react'), encoding: 'utf8', stdio: 'pipe', timeout: 30000 })
  } catch (e) {
    const o = (e.stdout || '') + (e.stderr || '')
    out += o
    const m = o.match(/Tests\s+(\d+) failed/)
    failed += m ? Number(m[1]) : -1000
  }
  try {
    execFileSync('node', ['--test', ...NODE_TESTS],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 30000 })
  } catch (e) {
    const o = (e.stdout || '') + (e.stderr || '')
    out += o
    const m = o.match(/[#\u2139] fail (\d+)/)
    failed += m ? Number(m[1]) : -1000
  }
  return { failed: failed < 0 ? -1 : failed, out }
}

const originals = new Map()
for (const i of INJECTIONS) if (!originals.has(i.file)) originals.set(i.file, snapshot(i.file))
fs.writeFileSync(MARKER, new Date(0).toISOString())

let detected = 0
const silent = []
for (const inj of INJECTIONS) {
  const original = originals.get(inj.file)
  const text = original.toString('utf8')
  const hits = text.split(inj.find).length - 1
  if (hits !== 1) { console.error(`REFUSED: anchor for "${inj.name}" appears ${hits} times in ${inj.file}`); restore(inj.file, original); process.exit(2) }
  fs.writeFileSync(path.join(ROOT, inj.file), text.replace(inj.find, inj.replace))
  const t0 = Date.now()
  const r = run()
  const ms = Date.now() - t0
  const noResult = r.failed < 0
  if (noResult && !inj.expectHang) {
    // Verification 48. A stage that produced no result has not run, and
    // scoring it either way is a guess.
    console.error(`STOP: "${inj.name}" produced NO PARSEABLE RESULT in ${ms}ms.`)
    console.error('  Neither DETECTED nor SILENT is knowable. Restoring and stopping.')
    restore(inj.file, original)
    fs.rmSync(MARKER, { force: true })
    process.exit(2)
  }
  const fired = inj.expectHang ? noResult : (r.failed > 0 && r.out.includes(inj.expect))
  if (fired) detected++
  else silent.push({ name: inj.name, failed: r.failed })
  console.log(`${fired ? 'DETECTED' : 'SILENT  '}  ${inj.name}`
    + `  (${inj.expectHang ? 'hung as declared' : `${r.failed} failed`}, ${ms}ms)`)
  restore(inj.file, original)
}

const final = run()
console.log(`\nreverted run: ${final.failed === 0 ? 'GREEN' : `RED (${final.failed} failed)`}`)
for (const [f, b] of originals) {
  const same = fs.readFileSync(path.join(ROOT, f)).equals(b)
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${f}`)
  if (!same) process.exitCode = 2
}
if (silent.length) {
  console.log('\nSILENT, classified per the Verification 51 caveat:')
  for (const s of silent) {
    console.log(`  ${s.failed === 0 ? 'ZERO failures  -> a MISSING ASSERTION' : `${s.failed} failed -> the MATCHER missed`}  ${s.name}`)
  }
}
// Removed only after every file has been compared to its snapshot above.
if (process.exitCode !== 2) fs.rmSync(MARKER, { force: true })
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
