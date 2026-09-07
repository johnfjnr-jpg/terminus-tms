// Calibration for Round 7 Phase 2c: the view-population gate.
//
// The instrument this session added says the swap is NOT takeable. A gate that
// blocks a swap has to be shown capable of the other answer, and of noticing
// when the population moves. Verification 9.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2c.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })
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

const A = 'scripts/tests/test-bed-accounting.test.mjs'
const S = 'scripts/round7/tb-view-surface.mjs'

const INJECTIONS = [
  { name: 'a GAP is quietly reclassified as covered in the enumeration', file: S,
    find: "  renderTbClosedPanel: 'GAP: the terminal tab CONTENT',",
    replace: "  renderTbClosedPanel: 'react: nothing, this is an injection',",
    expect: 'the app.js view gaps are EXACTLY the recorded ones' },

  { name: 'a NEW gap appears in app.js and nobody records it', file: S,
    find: "  refreshTbStagePanels: 'GAP: re-loading the open stage after a write',",
    replace: "  refreshTbStagePanels: 'GAP: re-loading the open stage after a write',\n  wireTbNextStageButton2: 'GAP: injected',",
    expect: 'the app.js view gaps are EXACTLY the recorded ones' },

  { name: 'the recorded list drops an entry the enumeration still carries', file: A,
    find: "  'renderTbClosedPanel', 'renderTbStageApprovals', 'confirmStageDocument',",
    replace: "  'renderTbStageApprovals', 'confirmStageDocument',",
    expect: 'the app.js view gaps are EXACTLY the recorded ones' },

  { name: 'the view gate is inverted while the gaps are non-empty', file: A,
    find: "  assert.notEqual(VIEW_GAPS.length, 0,",
    replace: "  assert.equal(VIEW_GAPS.length, 0,",
    expect: 'THE SWAP IS NOT TAKEABLE while the app.js view gaps are non-empty' },

  { name: 'the gap parser matches nothing, so an empty set reads clean', file: A,
    find: "  const gaps = [...block.matchAll(/^\\s{2}([A-Za-z0-9_$]+):\\s*'GAP:/gm)].map((m) => m[1]).sort()",
    replace: "  const gaps = []",
    expect: 'no gaps parsed, so this assertion is vacuous' },

  { name: 'a declared gap is renamed, so the existence check must fire', file: A,
    find: "  'tbDocKey', 'tbNextStageState', 'currentTestBed', 'tbDetailStages',",
    replace: "  'tbDocKeyX', 'tbNextStageState', 'currentTestBed', 'tbDetailStages',",
    expect: 'declared gaps no longer in app.js' },
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
  const fired = r.failed > 0 && r.out.includes(inj.expect)
  if (fired) detected++
  else silent.push({ name: inj.name, failed: r.failed })
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
if (silent.length) {
  console.log('\nSILENT, classified per the Verification 51 caveat:')
  for (const s of silent) {
    console.log(`  ${s.failed === 0 ? 'ZERO failures  -> a MISSING ASSERTION' : `${s.failed} failed -> the MATCHER missed`}  ${s.name}`)
  }
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
