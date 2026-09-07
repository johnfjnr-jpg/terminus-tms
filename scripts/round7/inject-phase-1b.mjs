// Calibration for Round 7 Phase 1b: the four load-bearing behaviours. Each
// injection removes the property the vanilla has a RECORDED REASON for, so each
// asserts a ruling rather than an implementation detail.
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

const Q = 'frontend-react/src/testbed/unitQueue.ts'
const U = 'frontend-react/src/testbed/useCases.ts'
const B = 'frontend-react/src/testbed/exitCriteria.ts'
const R = 'frontend-react/src/testbed/scoreReason.ts'

const INJECTIONS = [
  { name: 'Q3: the revision is read at ENQUEUE instead of at execution',
    file: Q,
    find: '      const held = deps.unitById(unitId)',
    replace: '      const held = enqueuedHeld',
    expect: 'every queued write carried the revision from enqueue time' },

  { name: 'Q1: ONE GLOBAL QUEUE, so two rows serialise against each other',
    file: Q,
    find: "    let q = queues.get(unitId)\n    if (!q) { q = { chain: Promise.resolve(), pending: 0, failures: new Map() }; queues.set(unitId, q) }",
    replace: "    let q = queues.get('GLOBAL')\n    if (!q) { q = { chain: Promise.resolve(), pending: 0, failures: new Map() }; queues.set('GLOBAL', q) }",
    expect: 'one queue PER ROW' },

  { name: 'Q5: failures become burst-scoped, so a later success erases a refusal',
    file: Q,
    find: '      q.failures.delete(field)',
    replace: '      q.failures.clear()',
    expect: 'a later success erased an earlier refusal' },

  { name: 'Q6: the row names the MOST RECENT failure instead of the first',
    file: Q,
    find: "      message: q.failures.size ? [...q.failures.values()][0] : 'Saved',",
    replace: "      message: q.failures.size ? [...q.failures.values()].at(-1) : 'Saved',",
    expect: 'the row named the most recent failure' },

  { name: 'Q7: a thrown link breaks the chain',
    file: Q,
    find: "    }).catch(() => {\n      // Q7: THE CHAIN MUST NOT BREAK. A rejected link would silently stop\n      // every later write for this row.\n      q.failures.set(field, 'Save failed')\n    })",
    replace: "    })",
    expect: 'Q7 a THROWN link does not break the chain' },

  { name: 'Q4: the response is not adopted, so the next link reads a stale unit',
    file: Q,
    find: '      if (result.data) deps.onUnit(result.data)',
    replace: '      void result',
    expect: 'the local unit is REPLACED by the response' },

  { name: 'U: a blank use case is written anyway',
    file: U,
    find: '  if (!t) return null',
    replace: '  if (false) return null',
    expect: 'a blank addition is refused before any write' },

  { name: 'B1: THE TICK BECOMES A BOOLEAN, which the gate reads as PRESENT',
    file: B,
    find: '  return { [field]: currentlyMet ? null : at }',
    replace: '  return { [field]: currentlyMet ? null : true }',
    expect: 'B1 a tick writes an ISO TIMESTAMP, never a boolean' },

  { name: 'B2: isTicked stops agreeing with the gate about `false`',
    file: B,
    find: "  return !(value === undefined || value === null || value === '')",
    replace: '  return value === true || (typeof value === "string" && value !== "")',
    expect: 'a stored false read as unticked here but as PRESENT to the gate' },

  { name: 'R1: the level stops deciding, and a hardcoded list decides instead',
    file: R,
    find: '  return !!level?.reason_required || series.length > 0',
    replace: '  return score <= 2 || series.length > 0',
    expect: 'the LEVEL says whether a reason is required' },

  { name: 'R4: MUST-DIFFER REMOVED, so the same reason is accepted again',
    file: R,
    find: '  if (last && given === last) {',
    replace: '  if (false) {',
    expect: 'the same reason was accepted for a different level' },

  { name: 'R4: it compares against the OLDEST reason instead of the newest',
    file: R,
    find: '  const last = norm(series[0]?.reason)',
    replace: '  const last = norm(series[series.length - 1]?.reason)',
    expect: 'R4 it compares against the MOST RECENT recorded reason' },
]
const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', 'src/__tests__/testbed-queue.test.ts'],
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
