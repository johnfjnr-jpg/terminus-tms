// Calibrating the tag-scoped tearDown, both directions.
//
// HARNESS DISCIPLINE (Verification 44), because a fault-injection harness is
// the one tool guaranteed to be pointed at uncommitted work:
//   - byte snapshot of every file it will touch, keyed by FULL PATH, asserted
//     to exist before anything is injected;
//   - byte comparison of the restore after EVERY injection, stopping dead on
//     mismatch rather than compounding;
//   - an in-flight marker, so a killed run cannot have its own damage
//     snapshotted as the original by the next run;
//   - a final reverted full run. That line has caught a broken harness four
//     times in this estate and is never skipped.
//   - NEVER git checkout as the restore: it reverts to the last COMMIT, and a
//     mid-phase tree is not the last commit.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = process.env.SNAPDIR
const INFLIGHT = `${SNAP}/IN_FLIGHT`
const FILES = ['scripts/fixtures.mjs']
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const key = (f) => `${SNAP}/${f.replace(/\//g, '_')}`

mkdirSync(SNAP, { recursive: true })
if (existsSync(INFLIGHT)) {
  console.error(`REFUSING: ${INFLIGHT} exists, so a previous run died mid-injection.`)
  console.error(`Restore from ${SNAP} by hand before running again, or the wreckage`)
  console.error('gets snapshotted as the original.')
  process.exit(2)
}
for (const f of FILES) {
  writeFileSync(key(f), readFileSync(`${ROOT}/${f}`))
  if (!existsSync(key(f))) { console.error(`snapshot failed for ${f}`); process.exit(2) }
}
const ORIG = Object.fromEntries(FILES.map((f) => [f, sha(`${ROOT}/${f}`)]))
writeFileSync(INFLIGHT, new Date().toISOString())

const run = () => {
  const started = Date.now()
  let out = ''
  try {
    out = execFileSync('node', ['--test', '--env-file-if-exists=.env',
      'scripts/tests/teardown-scoping.test.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  const ms = Date.now() - started
  const m = out.match(/^. fail (\d+)/m)
  // Verification 48: a run that produced no parseable result has NOT run, and
  // must never be scored as "failed, therefore the injection was caught".
  if (!m) return { fail: null, ms, out }
  return { fail: Number(m[1]), ms, out }
}

const restore = (label) => {
  for (const f of FILES) {
    writeFileSync(`${ROOT}/${f}`, readFileSync(key(f)))
    if (sha(`${ROOT}/${f}`) !== ORIG[f]) {
      console.error(`\nSTOP: restore of ${f} did not match after "${label}".`)
      console.error(`Snapshot is at ${key(f)}. Not continuing.`)
      process.exit(2)
    }
  }
}

const inject = (f, from, to, label) => {
  const p = `${ROOT}/${f}`
  const src = readFileSync(p, 'utf8')
  const n = src.split(from).length - 1
  if (n !== 1) {
    console.error(`\nSTOP: anchor for "${label}" occurs ${n} times in ${f}; it must be unique.`)
    restore(label); rmSync(INFLIGHT, { force: true }); process.exit(2)
  }
  writeFileSync(p, src.replace(from, to))
}

const R = []
const claim = (label, f, from, to) => {
  inject(f, from, to, label)
  const r = run()
  restore(label)
  const fired = r.fail === null ? null : r.fail > 0
  R.push({ label, fired, fail: r.fail, ms: r.ms })
  const verdict = fired === null ? 'NO RESULT (did not run)' : fired ? 'FIRED ' : 'SILENT'
  console.log(`  ${verdict}  ${label.padEnd(52)} fail=${r.fail}  ${r.ms}ms`)
  // WHICH assertion fired, not merely that one did. A count says the injection
  // was caught; the message says it was caught by the claim it was aimed at.
  if (fired) {
    const why = (r.out.match(/^\s*(?:not ok \d+ - |.*Error: |.*AssertionError.*\n\s*)(.+)$/m)
      || r.out.match(/^\s*error: '?(.+?)'?$/m) || [])[1]
    const name = (r.out.match(/^not ok \d+ - (.+)$/m) || [])[1]
    if (name) console.log(`          test: ${name.trim().slice(0, 78)}`)
    if (why) console.log(`          why:  ${why.trim().slice(0, 78)}`)
  }
}

console.log('DIRECTION ONE: each claim, falsified\n')

// 1. THE DEFECT ITSELF, reinstated: owner as the delete selector.
claim('THE 66-RECORD DEFECT: sweep by owner again', 'scripts/fixtures.mjs',
  '  const direct = [...candidates.filter((r) => mine(r.id)), ...handedRows]',
  '  const direct = [...candidates, ...handedRows]')

// 2. The sweep stops working at all.
claim('the sweep stops matching its own tag', 'scripts/fixtures.mjs',
  '  const direct = [...candidates.filter((r) => mine(r.id)), ...handedRows]',
  '  const direct = []')

// 3. The refusal is removed. The FIRST attempt edited a different line of the
// error message than the test matches, so the throw still fired with a
// matching message and the injection was a no-op that read as a missing
// detector. Verification 51: confirm the injection fired before a silence is
// allowed to name an unasserted claim. This one removes the guard itself.
claim('the no-tag refusal is removed', 'scripts/fixtures.mjs',
  '  if (!tags.length) {\n    throw new Error(',
  '  if (false) {\n    throw new Error(')

// 4. The descendant rule is removed.
claim('the unnamed-child rule is removed', 'scripts/fixtures.mjs',
  '  const children = candidates.filter((r) => !directIds.has(r.id)\n    && r.parent_record_id && directIds.has(r.parent_record_id))',
  '  const children = []')

// 5. THE END-OF-TEARDOWN RE-QUERY, reinstated owner-wide. Added at the Phase 0
// sign-off: the re-query WAS rescoped in act 1, but nothing had been shown
// firing on it, so its coverage was a claim rather than a measurement. An
// owner-wide re-query throws the moment another round has a live fixture,
// which is exactly the state the test constructs.
claim('the re-query goes back to owner-wide', 'scripts/fixtures.mjs',
  "  const { data: still, error: stillErr } = live.length\n    ? await db.from('records').select('id, record_type')\n        .in('id', live.map((r) => r.id)).is('deleted_at', null)\n    : { data: [], error: null }",
  "  const { data: still, error: stillErr } = await db.from('records')\n    .select('id, record_type').eq('owner_id', TEST_USER_ID).is('deleted_at', null)")

// 6. P2.5: the handed-away discovery removed. A record handed to another owner
// leaves the owner-scoped candidate set, and without this branch teardown
// cannot reach it - which is how 38 records survived one round and one
// survived each of P2.3's first two runs.
// The injection must remove the BEHAVIOUR and leave valid code. A first
// version produced `0.filter is not a function`, so the test failed because
// the file was broken rather than because the discovery was gone - an
// injection firing for the wrong reason proves nothing, exactly as a refusal
// for the wrong reason does.
claim('the handed-away discovery is removed', 'scripts/fixtures.mjs',
  '  const reachIds = [...new Set([...taggedIds, ...ledgered])]\n    .filter((id) => !candidates.some((c) => c.id === id))',
  '  const reachIds = []')

console.log('\nDIRECTION TWO: the untouched tree is green\n')
const clean = run()
console.log(`  ${clean.fail === 0 ? 'PASS  ' : 'FAIL  '}  the reverted tree passes${' '.repeat(29)}fail=${clean.fail}  ${clean.ms}ms`)

let ok = true
for (const f of FILES) {
  const same = sha(`${ROOT}/${f}`) === ORIG[f]
  console.log(`\n  ${f} byte-identical to its snapshot: ${same}`)
  if (!same) ok = false
}
rmSync(INFLIGHT, { force: true })

const fired = R.filter((r) => r.fired === true).length
const silent = R.filter((r) => r.fired === false)
const noresult = R.filter((r) => r.fired === null)
console.log(`\n  ${fired}/${R.length} injections fired, ${silent.length} silent, ${noresult.length} produced no result`)
for (const s of silent) console.log(`    SILENT, and a silence names a claim nothing asserts: ${s.label}`)
process.exit(ok && fired === R.length && clean.fail === 0 ? 0 : 1)
