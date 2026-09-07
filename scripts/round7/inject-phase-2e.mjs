// Calibration for Round 7 Phase 2e: the swap and A12.
//
// Uses session 2's hardened harness verbatim: the .in-flight marker that
// refuses to snapshot the wreckage of a killed run, and the expectHang stop
// that never scores a run which produced no parseable result.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2e.mjs <scratch-dir>'); process.exit(2) }
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

const R = 'frontend-react/src/field-row/FieldRow.tsx'
const U = 'frontend-react/src/field-row/useFieldRows.ts'
const A = 'frontend/app.js'
const H = 'frontend/index.html'
const V = 'frontend-react/src/testbed/TestBedView.tsx'

const INJECTIONS = [
  // ── A12, across four surfaces ────────────────────────────────────────
  { name: 'A12: the tab stop comes back regardless of the door', file: R,
    find: '        tabIndex={rows.canEdit ? 0 : undefined}',
    replace: '        tabIndex={0}',
    expect: 'NO row is a tab stop when the door refuses' },

  { name: 'A12: NO row is a tab stop, door or no door', file: R,
    find: '        tabIndex={rows.canEdit ? 0 : undefined}',
    replace: '        tabIndex={undefined}',
    expect: 'EVERY row is a tab stop when the door is open' },

  { name: 'A12: the door answer inverts, so the owner loses their stops', file: U,
    find: '  const canEdit = shell.canEditFields()',
    replace: '  const canEdit = !shell.canEditFields()',
    expect: 'EVERY row is a tab stop when the door is open' },

  { name: 'A12: dropping the stop also drops the row, so it stops READING', file: R,
    find: '      <div\n        className="field-row-display"\n        data-testid={`display-${field.name}`}\n        hidden={open}',
    replace: '      <div\n        className="field-row-display"\n        data-testid={`display-${field.name}`}\n        hidden={open || !rows.canEdit}',
    expect: 'and a refused row STILL READS' },

  { name: 'behaviour 7: a read-only row gains a stop', file: R,
    find: '      <div className="field-row" data-field={field.name} data-readonly="true">',
    replace: '      <div className="field-row" data-field={field.name} data-readonly="true" tabIndex={0}>',
    expect: "read-only rows are never stops, door or no door" },

  // ── the swap ─────────────────────────────────────────────────────────
  { name: 'THE VANILLA TAG IS RESTORED, so the swap is reverted', file: H,
    find: '\n<script src="/test-bed-detail.js"></script>\n     ─',
    replace: '\n     ─',
    expect: 'the vanilla Test Bed tag is GONE' },

  { name: "the door's registry line is dropped, so every row refuses", file: A,
    find: "  'test-bed-detail': () => {",
    replace: "  'test-bed-detail-DROPPED': () => {",
    expect: 'the door is WIRED for the Test Bed view' },

  { name: 'the door reads a second derivation instead of the shell class', file: A,
    find: "    const v = document.getElementById('view-test-bed-detail')\n    return !!v && !v.classList.contains('is-not-mine')",
    replace: '    return true',
    expect: 'the door is WIRED for the Test Bed view' },

  { name: 'the superseded path goes QUIET instead of refusing', file: A,
    find: "  throw new Error('loadTestBedDetail is superseded by the React Test Bed view. '",
    replace: "  if (false) throw new Error('loadTestBedDetail is superseded. '",
    expect: 'THE OLD PATH REFUSES rather than going quiet' },

  { name: 'the guarded entry goes, so a missing bundle is a ReferenceError', file: A,
    find: 'function loadTestBedDetailOrSayWhyNot(id) {',
    replace: 'function loadTestBedDetailOrSayWhyNotRenamed(id) {',
    expect: 'the guarded entry is gone' },

  { name: 'the landing accessor stops clearing, so a later load inherits it', file: A,
    find: '  const stage = tbLandOnStageAfterLoad\n  tbLandOnStageAfterLoad = null\n  return stage',
    replace: '  return tbLandOnStageAfterLoad',
    expect: 'the accessor no longer clears on read' },

  { name: 'the landing accessor is not published at all', file: A,
    find: 'window.takeTestBedLanding = function () {',
    replace: 'const takeTestBedLandingUnpublished = function () {',
    expect: 'the shell publishes the landing accessor' },

  // ── the view ─────────────────────────────────────────────────────────
  { name: 'the view stops re-reading on navigation, so a stale record serves', file: V,
    find: '  useEffect(() => { if (navToken !== undefined) void refetch() }, [navToken, refetch])',
    replace: '  useEffect(() => { void 0 }, [navToken, refetch])',
    expect: 'a second visit RE-READS the record rather than serving the cache' },

  { name: 'detailLoaded is memoised, so a cached record keeps is-loading', file: V,
    find: '  useEffect(() => { if (settled) shell.detailLoaded(VIEW) })',
    replace: '  useEffect(() => { if (settled) shell.detailLoaded(VIEW) }, [settled, shell])',
    expect: 'settles the view on EVERY navigation' },

  { name: 'THE PENDING STATE STOPS UNMOUNTING THE HOST, which is what resets it', file: V,
    // Replaces the key injection. The key was measured redundant - the early
    // return on `isPending` is what unmounts the host on a record change - so
    // this injects against the mechanism that actually does the work.
    find: '  if (bed.isPending) {',
    replace: '  if (false) {',
    expect: 'a failed load says Not found rather than a loading line for ever' },
]

const SUITES = [
  'src/__tests__/a12-four-surfaces.test.tsx',
  'src/__tests__/testbed-view-nav.test.tsx',
]

// The app.js and index.html injections are not seen by vitest, so they are
// scored against the NODE suite instead. One harness, two runners.
const NODE_TESTS = [
  'scripts/tests/live-form.test.mjs',
]
// ONE HARNESS, TWO RUNNERS. The app.js and index.html injections are invisible
// to vitest, so the node suite runs alongside it and the two results are
// combined - a run is a failure if either runner failed, and the output both
// matchers see is the concatenation.
const run = () => {
  let failed = 0
  let out = ''
  try {
    execFileSync('npx', ['vitest', 'run', ...SUITES, '--testTimeout=8000'],
      { cwd: path.join(ROOT, 'frontend-react'), encoding: 'utf8', stdio: 'pipe', timeout: 20000 })
  } catch (e) {
    const o = (e.stdout || '') + (e.stderr || '')
    out += o
    const m = o.match(/Tests\s+(\d+) failed/)
    failed += m ? Number(m[1]) : -1000
  }
  try {
    execFileSync('node', ['--test', ...NODE_TESTS],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 20000 })
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
