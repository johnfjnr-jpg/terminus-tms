// Calibration for Round 7 Phase 1b item 2: the scoring capability and units.
//
// Same verified-snapshot harness as the item 1 sweep (Verification 44: full-path
// keys, snapshot asserted non-empty and round-tripped before anything is
// injected, restore compared byte-for-byte after EVERY injection with a stop on
// mismatch, unique anchors, final reverted run).
//
// Matchers anchor on TEST NAMES rather than on assertion messages, per the
// Verification 51 caveat this round added: a test aborts on its first failing
// assertion, so a matcher taken from a later assertion never appears and the
// injection reads SILENT when it in fact fired.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-1b-item2.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })

const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))
const snapshot = (f) => {
  const bytes = fs.readFileSync(path.join(ROOT, f))
  if (!bytes.length) { console.error(`REFUSED: ${f} is empty`); process.exit(2) }
  fs.writeFileSync(key(f), bytes)
  if (!fs.readFileSync(key(f)).equals(bytes)) { console.error(`REFUSED: snapshot of ${f} did not round-trip`); process.exit(2) }
  return bytes
}
const restore = (f, original) => {
  fs.writeFileSync(path.join(ROOT, f), original)
  if (!fs.readFileSync(path.join(ROOT, f)).equals(original)) { console.error(`STOP: restore of ${f} did not match`); process.exit(2) }
}

const S = 'frontend-react/src/testbed/units.ts'
const C = 'frontend-react/src/testbed/scoring.ts'

const INJECTIONS = [
  // ── S: counts and units ──────────────────────────────────────────────
  { name: 'S5: the inverse is HAND-WRITTEN instead of derived, and drifts', file: S,
    find: 'export const COUNT_KEY_FOR_UNIT_TYPE: Record<string, string> = Object.fromEntries(\n  Object.entries(COUNT_KEY_TO_UNIT_TYPE).map(([key, type]) => [type, key]))',
    replace: "export const COUNT_KEY_FOR_UNIT_TYPE: Record<string, string> = {\n  SafeSight: 'safesightCameras', 'Air Quality': 'airQualitySensors', HEMIR: 'hemirSensors2' }",
    expect: 'S5 the two mappings are PROVEN INVERSE' },

  { name: 'S2: the shortfall is clamped on the TOTAL, so a surplus cancels a gap', file: S,
    find: '  const missing = planned.reduce(\n    (t, p) => t + Math.max(0, p.n - units.filter((u) => u.type === p.type).length), 0)',
    replace: '  const missing = Math.max(0, planned.reduce(\n    (t, p) => t + (p.n - units.filter((u) => u.type === p.type).length), 0))',
    expect: 'S2 the shortfall is clamped PER TYPE' },

  { name: 'S2: the count is read as a number without the string coercion', file: S,
    find: '    n: Number(payload[key]) || 0,',
    replace: '    n: (payload[key] as number) || 0,',
    expect: 'S2 a count and its units can DISAGREE' },

  { name: 'S4: the lock asks EVERY unit instead of ANY', file: S,
    find: '  return !!type && units.some((u) => u.type === type)',
    replace: '  return !!type && units.every((u) => u.type === type)',
    expect: 'S4 a count whose units exist is LOCKED' },

  { name: 'S4: an unknown count key locks the row', file: S,
    find: '  const type = COUNT_KEY_TO_UNIT_TYPE[countKey]\n  return !!type && units.some',
    replace: '  const type = COUNT_KEY_TO_UNIT_TYPE[countKey]\n  return !type || units.some',
    expect: 'S4 an unknown count key locks nothing' },

  { name: 'S1: the payload count list is hardcoded and misses one', file: S,
    find: 'export const TB_COUNT_KEYS = Object.keys(COUNT_KEY_TO_UNIT_TYPE)',
    replace: "export const TB_COUNT_KEYS = ['safesightCameras', 'airQualitySensors']",
    expect: 'S1 the counts are PAYLOAD keys' },

  { name: 'S3: derive collapses onto the units READ route', file: S,
    find: 'export const DERIVE_ROUTE = (id: string) => `/api/test-beds/${id}/units/derive`',
    replace: 'export const DERIVE_ROUTE = (id: string) => `/api/test-beds/${id}/units`',
    expect: 'S3 derive is its own route' },

  { name: 'S7: the tab map is written a SECOND time and drifts', file: S,
    find: 'export const UNIT_TYPE_FOR_TAB_KEY: Record<string, string> = COUNT_KEY_TO_UNIT_TYPE',
    replace: "export const UNIT_TYPE_FOR_TAB_KEY: Record<string, string> = {\n  safesightCameras: 'SafeSight', airQualitySensors: 'Air Quality', hemirSensors: 'Hemir' }",
    expect: 'S7 the tab-to-type map is DERIVED' },

  { name: 'S7: the pane stops filtering, so every type renders in every tab', file: S,
    find: '  return units.filter((u) => u.type === type)',
    replace: '  return [...units]',
    expect: 'S7 a pane is per unit TYPE' },

  // ── C: scoring ───────────────────────────────────────────────────────
  { name: 'C5: the save stops blocking on a missing reason', file: C,
    find: "    if (!String(reasons[key] ?? '').trim()) return key",
    replace: "    if (String(reasons[key] ?? '') === '\\u0000') return key",
    expect: 'C5 the SAVE is blocked' },

  { name: 'C5: whitespace is accepted as a reason', file: C,
    find: "    if (!String(reasons[key] ?? '').trim()) return key",
    replace: "    if (!String(reasons[key] ?? '')) return key",
    expect: 'C5 whitespace is not a reason' },

  { name: 'C5: a draft with no criterion is treated as one', file: C,
    find: '    if (!crit) continue',
    replace: '    if (!crit) return key',
    expect: 'C5 a draft for something that is not a criterion is ignored' },

  { name: 'C1: levels are invented when the criterion carries none', file: C,
    find: '  return Array.isArray(crit?.levels) ? crit.levels : []',
    replace: '  return Array.isArray(crit?.levels) ? crit.levels : [{ value: 1 }]',
    expect: 'C1 levels come from the criterion' },

  { name: 'C6: the entry lock never engages', file: C,
    find: '  return recorded.has(key)',
    replace: '  return recorded.has(key) && false',
    expect: 'C6 entry LOCKS once recorded' },

  { name: 'C7: disclosure MUTATES the caller set, making it state', file: C,
    find: '  const next = new Set(open)',
    replace: '  const next = open as Set<string>',
    expect: 'C7 anchors and history are DISCLOSURE' },

  { name: 'C8: measurability folds onto the score route', file: C,
    find: 'export const MEASURABILITY_ROUTE = (id: string) => `/api/test-beds/${id}/measurability`',
    replace: 'export const MEASURABILITY_ROUTE = (id: string) => `/api/test-beds/${id}/scores`',
    expect: 'C8 measurability is a SECOND route' },

  { name: 'C9: the summary reads the OLDEST entry as latest', file: C,
    find: '  return { latest: series[0] ?? null, count: series.length }',
    replace: '  return { latest: series[series.length - 1] ?? null, count: series.length }',
    expect: 'C9 ONE reduction of the series' },

  { name: 'C2: recording does not clear the draft', file: C,
    find: '  for (const key of keys) { delete drafts[key]; recorded.add(key) }',
    replace: '  for (const key of keys) { recorded.add(key) }',
    expect: 'a recorded score CLEARS its draft' },

  { name: 'C2: recording clears EVERY draft, not only the recorded keys', file: C,
    find: '  const drafts = { ...state.drafts }\n  const recorded = new Set(state.recorded)',
    replace: '  const drafts: Record<string, string> = {}\n  const recorded = new Set(state.recorded)',
    expect: 'a recorded score CLEARS its draft' },

  { name: 'C2: setting a draft RECORDS it', file: C,
    find: '  return { drafts: { ...state.drafts, [key]: value }, recorded: state.recorded }',
    replace: '  return { drafts: { ...state.drafts, [key]: value }, recorded: new Set([...state.recorded, key]) }',
    expect: 'setting a draft does not record it' },

  { name: 'C2: the draft store is mutated in place', file: C,
    find: '  return { drafts: { ...state.drafts, [key]: value }, recorded: state.recorded }',
    replace: '  ;(state.drafts as Record<string, string>)[key] = value\n  return { drafts: state.drafts, recorded: state.recorded }',
    expect: 'the draft state is not mutated in place' },
]

const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', 'src/__tests__/testbed-scoring-units.test.ts'],
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
