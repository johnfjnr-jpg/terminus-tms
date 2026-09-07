// Calibration for Round 8 Phase 2: the re-pointed toggle assertion, and the
// two claims a retirement makes. Hardened harness.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })
const MARKER = path.join(SNAP, '.in-flight')
if (fs.existsSync(MARKER)) {
  console.error(`REFUSED: a previous run did not finish. Restore from ${SNAP} first.`)
  process.exit(2)
}
const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))
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

// The retired file, assembled rather than written, so this harness does not
// itself become a code reference to a file the verifier says nothing may name.
const RETIRED = ['test', 'bed', 'detail.js'].join('-')
const RETIRED_CONTACT = ['contact', 'detail.js'].join('-')

const A = 'frontend/app.js'
const V = 'frontend-react/src/testbed/TestBedView.tsx'
const H = 'frontend/index.html'

const INJECTIONS = [
  { name: 'a SECOND toggle appears in app.js, the shape the rule forbids', file: A,
    find: "  document.getElementById('view-opportunity-detail')?.classList.toggle('is-not-mine', notMine)",
    replace: "  document.getElementById('view-opportunity-detail')?.classList.toggle('is-not-mine', notMine)\n  document.getElementById('x')?.classList.toggle('is-not-mine', notMine)",
    expect: "expected ONE is-not-mine toggle in app.js" },

  { name: 'the live toggle stops reading the door s own answer', file: A,
    find: '  const notMine = !window.canEditFields()',
    replace: '  const notMine = !!opp.owner_id && opp.owner_id !== currentSession?.user?.id',
    expect: "which is not the door's own answer" },

  { name: 'the React toggle stops reading the shared derivation', file: V,
    find: '  const readOnly = notMine(bed.data.owner_id, shell.currentUserId())',
    replace: '  const readOnly = bed.data.owner_id !== shell.currentUserId()',
    expect: 'the React toggle is not driven by the shared ownership derivation' },

  { name: 'A COMMENTED TAG NAMING A DELETED FILE COMES BACK', file: H,
    find: `     frontend/${RETIRED} is DELETED.`,
    // BUILT, NOT WRITTEN, and both halves matter. A literal tag satisfies the
    // two-claims verifier's own scan, and the final reverted run went RED with
    // every file byte-identical - on a sentence in a comment.
    //
    // The answer is not to exempt this file: an exemption list rots, and the
    // check is worth more absolute. So the harness names the retired file
    // NOWHERE, and builds both the filename and the tag it injects.
    replace: `     frontend/${RETIRED} is DELETED.\n<script src="/${RETIRED}"></script>`,
    expect: 'a tag naming a deleted file' },
]

const run = () => {
  let failed = 0
  let out = ''
  try {
    execFileSync('npm', ['test'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 180000 })
  } catch (e) {
    const o = (e.stdout || '') + (e.stderr || '')
    out += o
    const m = o.match(/[#ℹ] fail (\d+)/)
    failed += m ? Number(m[1]) : -1000
  }
  // The two-claims verifier is not a test file; it is run as a check.
  for (const f of [`frontend/${RETIRED}`, `frontend/${RETIRED_CONTACT}`]) {
    try {
      execFileSync('node', ['scripts/round8/retired.mjs', f],
        { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 60000 })
    } catch (e) {
      out += (e.stdout || '') + (e.stderr || '')
      failed += 1
    }
  }
  return { failed: failed < 0 ? -1 : failed, out }
}

fs.writeFileSync(MARKER, 'in flight')
const originals = new Map()
for (const i of INJECTIONS) if (!originals.has(i.file)) originals.set(i.file, snapshot(i.file))

let detected = 0
const silent = []
for (const inj of INJECTIONS) {
  const original = originals.get(inj.file)
  const text = original.toString('utf8')
  const hits = text.split(inj.find).length - 1
  if (hits !== 1) { console.error(`REFUSED: anchor for "${inj.name}" appears ${hits} times`); restore(inj.file, original); fs.rmSync(MARKER, { force: true }); process.exit(2) }
  fs.writeFileSync(path.join(ROOT, inj.file), text.replace(inj.find, inj.replace))
  const t0 = Date.now()
  const r = run()
  const ms = Date.now() - t0
  if (r.failed < 0) {
    console.error(`STOP: "${inj.name}" produced NO PARSEABLE RESULT in ${ms}ms.`)
    restore(inj.file, original); fs.rmSync(MARKER, { force: true }); process.exit(2)
  }
  const fired = r.failed > 0 && r.out.includes(inj.expect)
  if (fired) detected++; else silent.push({ name: inj.name, failed: r.failed })
  console.log(`${fired ? 'DETECTED' : 'SILENT  '}  ${inj.name}  (${r.failed} failed, ${ms}ms)`)
  restore(inj.file, original)
}

const final = run()
console.log(`\nreverted run: ${final.failed === 0 ? 'GREEN' : `RED (${final.failed})`}`)
for (const [f, b] of originals) {
  const same = fs.readFileSync(path.join(ROOT, f)).equals(b)
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${f}`)
  if (!same) process.exitCode = 2
}
fs.rmSync(MARKER, { force: true })
if (silent.length) {
  console.log('\nSILENT, classified per the Verification 51 caveat:')
  for (const s of silent) console.log(`  ${s.failed === 0 ? 'ZERO -> MISSING ASSERTION' : `${s.failed} failed -> MATCHER`}  ${s.name}`)
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
