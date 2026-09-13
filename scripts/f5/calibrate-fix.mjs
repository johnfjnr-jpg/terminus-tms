// ── BOTH HALVES: it stops FALSE-failing, and it still catches a REAL one ─
//
// A guard that stops false-failing and also stops catching regressions is
// not a fix. So:
//
//   A. STABILITY - run the test N times and show it green, on a connection
//      whose individual samples routinely cross the ceiling. The run log
//      prints every sample, so "green" is visible as "the minimum held
//      while individual draws went over".
//   B. SENSITIVITY - inject a GENUINE cost increase into the measured
//      statement, not a lowered threshold (Verification 47), and show the
//      minimum moves past the ceiling and the assertion fires.
//
// The injection is a real statement: 33 leading-wildcard tags, payload
// selected, sorted by a non-indexed expression, 10,000 rows. Measured at
// 1145ms minimum against the baseline's ~357ms - a 3x increase with every
// sample over the ceiling.
//
// Verification 44: snapshot by full path, verify it exists, restore and
// compare bytes, and an in-flight marker.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const FILE = 'scripts/tests/teardown-scoping.test.mjs'
const SNAP = join(process.env.TMPDIR ?? '/tmp', 'f5-calib')
const FLIGHT = join(SNAP, 'IN_FLIGHT')
const MARKER = "the heaviest chunk's MINIMUM"

if (existsSync(FLIGHT)) {
  console.error(`REFUSING: a previous run was killed mid-injection. Restore from ${SNAP}.`)
  process.exit(2)
}
mkdirSync(SNAP, { recursive: true })
const snapPath = join(SNAP, FILE.replaceAll('/', '_'))
const original = readFileSync(join(ROOT, FILE))
writeFileSync(snapPath, original)
if (!existsSync(snapPath)) { console.error('no snapshot; refusing to inject'); process.exit(2) }

const run = () => {
  const t = Date.now()
  let out = ''
  try {
    out = execFileSync('node', ['--test', '--env-file-if-exists=.env', FILE],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  const head = /headroom:[^\n]*/.exec(out)?.[0] ?? ''
  const samples = (/\[([\d, ]+)\]/.exec(head)?.[1] ?? '').split(',').map((x) => Number(x.trim())).filter(Boolean)
  return {
    fired: out.includes(MARKER),
    fails: Number((out.match(/^# fail (\d+)/m) ?? [, '0'])[1]),
    head, samples, ms: Date.now() - t,
  }
}

// ── A. STABILITY ─────────────────────────────────────────────────────────
const N = Number(process.argv[2] ?? 8)
console.log(`=== A. STABILITY: ${N} runs of the real test ===`)
let green = 0, drawsOver = 0, totalDraws = 0
for (let i = 1; i <= N; i++) {
  const r = run()
  if (r.fails === 0) green++
  const over = r.samples.filter((s) => s >= 889).length
  drawsOver += over; totalDraws += r.samples.length
  console.log(`  run ${String(i).padStart(2)}: ${r.fails === 0 ? 'GREEN' : `RED (${r.fails})`}  `
    + `samples [${r.samples.join(', ')}] min ${Math.min(...r.samples)}ms  `
    + `${over} of ${r.samples.length} draws over 889ms   ${r.ms}ms`)
}
console.log(`\n  ${green} of ${N} runs green`)
console.log(`  ${drawsOver} of ${totalDraws} INDIVIDUAL DRAWS were over the ceiling`)
console.log(drawsOver > 0
  ? `  -> the old single-draw probe would have failed on any run containing one.`
  : `  -> no draw crossed in this window, so stability here is weak evidence; the`
    + `\n     earlier runs that DID contain crossings are the stronger reading.`)

// ── B. SENSITIVITY ───────────────────────────────────────────────────────
console.log(`\n=== B. SENSITIVITY: a REAL cost increase, not a lowered threshold ===`)
writeFileSync(FLIGHT, 'injecting')
let fired = false
try {
  const src = original.toString('utf8')
  const anchor = `      .select('id, record_id').or(ledgerOr).order('id', { ascending: true }).range(0, 999)`
  if (src.split(anchor).length - 1 !== 1) {
    console.error(`anchor not unique (${src.split(anchor).length - 1}); refusing to guess`)
    rmSync(FLIGHT); process.exit(2)
  }
  const heavy = `      .select('id, record_id, payload')`
    + `.or(weighed.map((w) => \`payload->>name.ilike.*\${w.t}*\`).join(','))`
    + `.order('payload->>name', { ascending: true }).range(0, 9999)`
  writeFileSync(join(ROOT, FILE), src.replace(anchor, heavy))
  console.log('  injected: 33 leading-wildcard tags, payload selected, non-indexed sort, 10k rows')
  console.log('  (measured at 1145ms minimum against a ~357ms baseline - a real 3x increase)')
  const r = run()
  fired = r.fired
  console.log(`  ${r.head}`)
  console.log(`  the MINIMUM assertion fired: ${r.fired}   (must be TRUE)`)
} finally {
  writeFileSync(join(ROOT, FILE), original)
  if (!readFileSync(join(ROOT, FILE)).equals(original)) { console.error('RESTORE MISMATCH'); process.exit(2) }
  rmSync(FLIGHT)
  console.log('  restored, byte-identical to the snapshot')
}

const final = run()
console.log(`\n  reverted run: ${final.fails === 0 ? 'GREEN' : `RED (${final.fails})`}`)
const ok = green === N && fired && final.fails === 0
console.log(`\n  ${ok ? 'BOTH HALVES HOLD: it stops false-failing AND still catches a real regression.'
                     : '*** A HALF FAILED. ***'}`)
process.exit(ok ? 0 : 1)
