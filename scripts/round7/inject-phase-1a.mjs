// Calibration for Round 7 Phase 1a: the Test Bed field surface. One injection
// per family, and the two the Phase 0 findings named restore the VANILLA defect
// so the fix is shown to be a fix rather than a rewrite that happens to pass.
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

const DESC = 'frontend-react/src/testbed/descriptors.ts'
const PREV = 'frontend-react/src/testbed/costPreview.ts'
const BOUNDS = 'frontend-react/src/testbed/dateBounds.ts'
const ROWS = 'frontend-react/src/field-row/useFieldRows.ts'
const HOST = 'frontend-react/src/testbed/TestBedHost.tsx'

const INJECTIONS = [
  // ── THE CENSUS ────────────────────────────────────────────────────────
  { name: 'the two server-computed keys become ROWS',
    file: DESC,
    find: "    { name: 'summary', label: 'Summary', value: str(p.summary), editor: 'textarea',",
    replace: "    { name: 'estCostPerUnit', label: 'Estimated Cost per Unit', value: str(p.estCostPerUnit) },\n    { name: 'summary', label: 'Summary', value: str(p.summary), editor: 'textarea',",
    expect: '28 plain field rows' },

  { name: 'the duration suffix reaches the VALUE',
    file: DESC,
    find: "      value: str(p.testBedDuration), inputMode: 'numeric', suffix: 'months' },",
    replace: "      value: str(p.testBedDuration) + ' months', inputMode: 'numeric', suffix: 'months' },",
    expect: 'the duration carries its suffix' },

  // ── THE DOOR ──────────────────────────────────────────────────────────
  { name: 'THE VANILLA DEFECT RESTORED: the row stops consulting the door',
    file: ROWS,
    find: '    if (!shell.canEditFields()) return false',
    replace: '    if (false) return false',
    expect: 'opened a row on a record that is not mine' },

  // ── THE COST PREVIEW ──────────────────────────────────────────────────
  { name: 'THE VANILLA DEFECT RESTORED: the ordering guard is removed',
    file: PREV,
    find: '    if (token <= latestApplied || token !== issued) return',
    replace: '    if (false) return',
    expect: 'a stale response was applied over a newer one' },

  { name: 'THE VANILLA DEFECT RESTORED: `||` semantics, so a cleared field falls back',
    file: PREV,
    find: '  const draft = drafts[key]\n  if (draft !== undefined) return draft',
    replace: '  const draft = drafts[key]\n  if (draft) return draft',
    expect: 'a cleared field fell back to its stored value' },

  { name: 'a refused preview leaves the wrong number on screen',
    file: PREV,
    find: '    onResult(result.ok ? (result.data ?? null) : null)',
    replace: '    onResult(result.data ?? null)',
    expect: 'a failed preview left a wrong number wearing the unsaved marker' },

  { name: 'a clean set still asks the server',
    file: PREV,
    find: '    if (!costFieldsDirty(drafts, stored)) { onResult(null); return }',
    replace: '    if (false) { onResult(null); return }',
    expect: 'a clean set still asked the server' },

  // ── THE DATE BOUNDS ───────────────────────────────────────────────────
  { name: 'an unset go-live imposes an EMPTY ceiling nobody can satisfy',
    file: BOUNDS,
    find: '      ...(goLive ? { max: goLive } : {}),',
    replace: '      max: goLive,',
    expect: 'an UNSET go-live imposes no ceiling at all' },

  // ── THE SAVE PATH ─────────────────────────────────────────────────────
  { name: 'the save starts carrying the server-computed keys',
    file: HOST,
    find: "    if ((PAYLOAD_ONLY_KEYS as readonly string[]).includes(k)) continue",
    replace: '    void 0',
    expect: 'THE TWO SERVER-COMPUTED KEYS CANNOT REACH IT' },

  { name: 'a buyer change starts riding the batched payload',
    file: HOST,
    find: "    if (k.startsWith('buyer-')) continue // its own route, not this payload",
    replace: '    void 0',
    expect: 'a BUYER change does not ride the payload' },
]
const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run',
      'src/__tests__/testbed-descriptors.test.ts', 'src/__tests__/testbed-cost-preview.test.ts',
      'src/__tests__/testbed-door.test.tsx', 'src/__tests__/testbed-save.test.tsx'],
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
