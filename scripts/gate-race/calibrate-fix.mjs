// ── BOTH HALVES OF R3, AND THE SECOND IS THE POINT ───────────────────────
//
// The forced race no longer turns INVARIANT 2 or 4 red. On its own that is
// worthless: a probe that cannot reproduce might be FIXED or might be
// BLIND, and the two read identically (Verification 9).
//
// So:
//   A. A REAL orphan - a rule on a CONFIGURED record_type naming a stage
//      that does not exist - must STILL turn INVARIANT 2 red. That proves
//      the fix closed the race without blinding the invariant.
//   B. Widening the predicate to swallow a configured type must turn the
//      COVERAGE ASSERTION red. That proves the guard on the guard is real.
//
// Data is cleaned up on every path and verified by re-query; source is
// snapshotted by full path, restored, and compared byte-for-byte
// (Verification 44).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const INV2 = 'INVARIANT 2: no gate rule names a stage absent from stage_definitions'
const COVER = 'the fixture exclusion spares every CONFIGURED record type'

const run = () => {
  let out = ''
  try {
    out = execFileSync('node', ['--test', '--env-file-if-exists=.env',
      'scripts/tests/config-invariants.test.mjs'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  return {
    inv2: out.includes(`✖ ${INV2}`),
    cover: out.includes(`✖ ${COVER}`),
    fails: Number((out.match(/^# fail (\d+)/m) ?? [, '0'])[1]),
  }
}

let ok = true
const say = (label, got, want) => {
  const pass = got === want
  if (!pass) ok = false
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}   got ${got}, expected ${want}`)
}

// ── A. A REAL ORPHAN MUST STILL FIRE ─────────────────────────────────────
console.log('=== A. SENSITIVITY: a REAL orphan on a CONFIGURED record type ===')
const configured = [...new Set(must(await db.from('stage_definitions').select('record_type'), 'sd')
  .map((s) => s.record_type))]
const victim = configured.includes('test_bed') ? 'test_bed' : configured[0]
console.log(`  using the configured record type "${victim}" - NOT a fixture type`)
let realOrphan = null
try {
  const base = run()
  say('clean: INVARIANT 2 quiet', base.inv2, false)

  const row = must(await db.from('stage_gate_rules').insert({
    record_type: victim, variant: null,
    from_stage: 'Qualification', to_stage: 'A Stage That Does Not Exist',
    requirement_type: 'payload_field_required', requirement_detail: { field: 'name' },
  }).select('id').single(), 'insert real orphan')
  realOrphan = row.id
  console.log(`  injected a genuine orphan: ${row.id}  ${victim} Qualification -> "A Stage That Does Not Exist"`)

  const during = run()
  say('REAL orphan present: INVARIANT 2 RED', during.inv2, true)
} finally {
  if (realOrphan) {
    const { error } = await db.from('stage_gate_rules').delete().eq('id', realOrphan)
    if (error) console.error(`  *** CLEANUP FAILED ${realOrphan}: ${error.message}`)
    const left = must(await db.from('stage_gate_rules').select('id').eq('id', realOrphan), 'recheck')
    console.log(`  cleanup: re-queried by id, ${left.length} rows remain (expected 0)`)
    if (left.length) process.exit(2)
  }
}
const after = run()
say('orphan removed: INVARIANT 2 quiet again', after.inv2, false)

// ── B. THE GUARD ON THE GUARD ────────────────────────────────────────────
console.log('\n=== B. THE COVERAGE ASSERTION: widen the exclusion to swallow a real type ===')
const MOD = 'scripts/lib/fixture-record-types.mjs'
const SNAP = join(process.env.TMPDIR ?? '/tmp', 'gaterace-calib')
mkdirSync(SNAP, { recursive: true })
const snapPath = join(SNAP, MOD.replaceAll('/', '_'))
const original = readFileSync(join(ROOT, MOD))
writeFileSync(snapPath, original)
if (!existsSync(snapPath)) { console.error('no snapshot; refusing to inject'); process.exit(2) }
try {
  const src = original.toString('utf8')
  const anchor = "export const FIXTURE_RECORD_TYPE_PREFIX = 'harness_'"
  if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique; refusing to guess'); process.exit(2) }
  writeFileSync(join(ROOT, MOD), src.replace(anchor, `export const FIXTURE_RECORD_TYPE_PREFIX = '${victim.slice(0, 4)}'`))
  console.log(`  widened the prefix to "${victim.slice(0, 4)}", which swallows the configured type "${victim}"`)
  const bad = run()
  say('widened exclusion: the COVERAGE ASSERTION RED', bad.cover, true)
} finally {
  writeFileSync(join(ROOT, MOD), original)
  if (!readFileSync(join(ROOT, MOD)).equals(original)) { console.error('RESTORE MISMATCH'); process.exit(2) }
  console.log('  restored, byte-identical to the snapshot')
}
const final = run()
say('reverted: everything quiet', final.fails, 0)

console.log(`\n  ${ok ? 'BOTH HALVES HOLD: the race is closed AND the invariant is not blinded.'
                      : '*** A HALF FAILED. Do not read the fix as proven. ***'}`)
process.exit(ok ? 0 : 1)
