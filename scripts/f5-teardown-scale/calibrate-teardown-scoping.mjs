#!/usr/bin/env node
// F5_TEARDOWN_SCALE ruling D5: calibrate the rebuilt page-cap test in
// scripts/tests/teardown-scoping.test.mjs, I1 to I7, plus the starved-estate
// run and a final reverted run.
//
//   node scripts/f5-teardown-scale/calibrate-teardown-scoping.mjs
//
// EVERY INJECTION LANDS IN A TEMP COPY OF HEAD, never in the tree
// (Verification 44). The copy is `git archive HEAD`, with node_modules
// symlinked. Its fixtures.mjs resolves its ledger to the COPY's own .scratch,
// which does not exist, so every run here is also a STARVED-ESTATE run: no
// fixture tag ledger, nothing to borrow.
//
// A VERDICT IS READ FROM THE NAMED ASSERTION, NOT THE EXIT CODE (Verification
// 9 and 51). FIRED means the run failed AND its output carries the text of the
// assertion that injection was written to trip. A run that fails on anything
// else is reported as WRONG-REASON, not FIRED.
//
// The harness snapshots each file's bytes before an injection, refuses an
// anchor that is not unique, confirms the injection changed the file, and
// compares the restored bytes after each run, stopping dead on a mismatch.
// An in-flight marker sits in the copy until the last restore is proved.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { admin } from '../fixtures.mjs'

const REPO = '/Users/johnfryatt/terminus-tms'
const TEST = 'scripts/tests/teardown-scoping.test.mjs'
const FIX = 'scripts/fixtures.mjs'
const OUT = process.env.CAL_OUT ?? join(REPO, '.verify', 'f5-teardown-scale')
const RUN_ID = Date.now().toString(36)
mkdirSync(OUT, { recursive: true })

const dirty = execFileSync('git', ['status', '--porcelain', '--', TEST, FIX], { cwd: REPO, encoding: 'utf8' }).trim()
if (dirty) { console.error(`refused: uncommitted changes to files this calibration measures:\n${dirty}`); process.exit(2) }

const COPY = mkdtempSync(join(tmpdir(), 'f5-td-cal-'))
execFileSync('sh', ['-c', `git -C "${REPO}" archive HEAD | tar -x -C "${COPY}"`])
symlinkSync(join(REPO, 'node_modules'), join(COPY, 'node_modules'))
for (const f of [TEST, FIX]) {
  const head = execFileSync('git', ['show', `HEAD:${f}`], { cwd: REPO })
  if (!head.equals(readFileSync(join(COPY, f)))) { console.error(`refused: the copy of ${f} is not HEAD's`); process.exit(2) }
}
if (existsSync(join(COPY, '.scratch', 'fixture-tags.json'))) {
  console.error('refused: the copy carries a fixture tag ledger, so it is not a starved estate'); process.exit(2)
}
const MARKER = join(COPY, '.calibration-in-flight')
writeFileSync(MARKER, RUN_ID)

const PAGE = '1,000 of its own tag population'
const INJECTIONS = [
  { id: 'I1', what: 'the tag branch stops at row 1,000 (one unranged page)', file: FIX,
    edits: [["    taggedRevs.push(...await pagedSelect(\n      () => db.from('record_revisions').select('id, record_id').or(or), `taggedRevs[${i}]`))",
      "    taggedRevs.push(...(await db.from('record_revisions').select('id, record_id').or(or).order('id', { ascending: true })).data)"]],
    expect: 'was NOT swept' },
  { id: 'I2', what: 'pagedSelect returns after page 0', file: FIX,
    edits: [['    if (data.length < PAGE_SIZE) return rows', '    return rows']],
    expect: 'was NOT swept' },
  { id: 'I3', what: 'the pad shrinks to 900 rows', file: TEST,
    edits: [['const PAD = 1500', 'const PAD = 900']],
    expect: 'at or under the cap, so this test cannot see the defect' },
  { id: 'I4', what: 'WRONGLY PASSING: the pick takes a shallow candidate', file: TEST,
    edits: [['const pick = candidates.find((id) => depth(id) > 1000)', 'const pick = candidates.find((id) => depth(id) <= 1000)']],
    expect: 'inside the first page' },
  { id: 'I5', what: 'tag scope widened: a1deep-X also matches a1keep-X (the control)', file: FIX,
    edits: [["const or = tags.slice(i, i + TAG_CHUNK).map((t) => `payload->>name.ilike.${t}%`).join(',')",
      "const or = tags.slice(i, i + TAG_CHUNK).flatMap((t) => [t, t.replace(/^a1deep-/, 'a1keep-')]).map((t) => `payload->>name.ilike.${t}%`).join(',')"]],
    expect: 'the control was swept though its tag was excluded' },
  { id: 'I6', what: 'the purge skips its deletes', file: TEST,
    edits: [['  // 4. Revisions, then records. Both filters in each statement.', '  // 4. I6: deletes skipped\n  if (false) {'],
      ['  // 5. ZERO ROWS', '  }\n  // 5. ZERO ROWS']],
    expect: 'the purge left rows of this run behind', residue: true },
  { id: 'I7', what: "a foreign tag ('score-success') added to the sweep set", file: TEST,
    edits: [['const sweep = [TAG]', "const sweep = [TAG, 'score-success']"]],
    expect: 'the sweep set carries a tag this run did not create' },
]

function run(label, pattern) {
  const args = ['--test', '--test-concurrency=1']
  if (pattern) args.push(`--test-name-pattern=${pattern}`)
  args.push(join(COPY, TEST))
  const t0 = Date.now()
  const r = spawnSync('node', args, { cwd: COPY, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const ms = Date.now() - t0
  const text = `${r.stdout}\n${r.stderr}`
  writeFileSync(join(OUT, `${RUN_ID}-${label}.txt`), text)
  const n = (k) => Number((text.match(new RegExp(`ℹ ${k} (\\d+)`)) ?? [])[1] ?? NaN)
  return { code: r.status, ms, text, pass: n('pass'), fail: n('fail') }
}

// The residue a run of THIS test can leave: rows under the per-run tag shapes.
const db = admin()
const TAG_SHAPES = ['a1deep-', 'a1keep-', 'a1third-']
const shapeOr = TAG_SHAPES.map((t) => `payload->>name.ilike.${t}%`).join(',')
async function residue() {
  const { count, error, status } = await db.from('record_revisions')
    .select('id', { count: 'exact', head: true }).or(shapeOr)
  if (error) throw new Error(`residue count: status ${status} ${error.message}`)
  return count
}
// Only for I6, whose whole point is a purge that did not delete. Removes the
// rows of the ONE run named in its output, revisions then records, and proves
// zero remain. The purge's own census ran before the skipped deletes, so no
// RESTRICT child holds a row.
async function cleanUpRun(text) {
  const run = (text.match(/this run's own tag a1deep-([a-z0-9]+)/) ?? [])[1]
  if (!run) throw new Error('I6 cleanup: no run tag in the output, so nothing can be named to remove')
  const tags = TAG_SHAPES.map((t) => `${t}${run}`)
  const or = tags.map((t) => `payload->>name.ilike.${t}%`).join(',')
  const ids = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('record_revisions').select('id, record_id').or(or)
      .order('id', { ascending: true }).range(from, from + 999)
    if (error) throw new Error(`I6 cleanup enumerate: ${error.message}`)
    data.forEach((r) => ids.add(r.record_id))
    if (data.length < 1000) break
  }
  const list = [...ids]
  for (let i = 0; i < list.length; i += 150) {
    const { error } = await db.from('record_revisions').delete().in('record_id', list.slice(i, i + 150)).or(or)
    if (error) throw new Error(`I6 cleanup revisions: ${error.message}`)
  }
  for (const id of list) {
    const { error } = await db.from('records').delete().eq('id', id)
    if (error) throw new Error(`I6 cleanup record ${id}: ${error.message}`)
  }
  return list.length
}

const results = []
let stopped = null
for (const inj of INJECTIONS) {
  const path = join(COPY, inj.file)
  const before = readFileSync(path)
  let text = before.toString('utf8')
  for (const [a, b] of inj.edits) {
    const n = text.split(a).length - 1
    if (n !== 1) { stopped = `${inj.id}: anchor occurs ${n} times`; break }
    text = text.replace(a, b)
  }
  if (stopped) break
  writeFileSync(path, text)
  if (readFileSync(path).equals(before)) { stopped = `${inj.id}: the injection did not change the file`; break }
  const r = run(inj.id, PAGE)
  writeFileSync(path, before)
  if (!readFileSync(path).equals(before)) { stopped = `${inj.id}: RESTORE MISMATCH on ${inj.file}`; break }
  let cleaned = null
  if (inj.residue) cleaned = await cleanUpRun(r.text)
  const left = await residue()
  const fired = r.code !== 0 && r.text.includes(inj.expect)
  const verdict = fired ? 'FIRED' : (r.code !== 0 ? 'WRONG-REASON' : 'SILENT')
  results.push({ ...inj, verdict, r, left, cleaned })
  console.log(`${inj.id}  ${verdict.padEnd(12)} ${String(r.ms).padStart(6)}ms  pass ${r.pass} fail ${r.fail}  `
    + `residue after ${left}${cleaned != null ? ` (cleaned ${cleaned} records)` : ''}  ${inj.what}`)
  console.log(`      expected: "${inj.expect}"`)
  if (left) { stopped = `${inj.id}: ${left} residue rows remain after the run`; break }
}

if (!stopped) {
  // THE STARVED-ESTATE RUN AND THE REVERTED RUN ARE ONE RUN: the whole file,
  // on the untouched copy, with no ledger anywhere.
  for (const f of [TEST, FIX]) {
    const head = execFileSync('git', ['show', `HEAD:${f}`], { cwd: REPO })
    if (!head.equals(readFileSync(join(COPY, f)))) { stopped = `final: the copy of ${f} is not HEAD's`; break }
  }
}
if (!stopped) {
  const r = run('reverted-starved', null)
  const left = await residue()
  const ok = r.code === 0 && r.fail === 0 && r.pass === 6 && !existsSync(join(COPY, '.scratch', 'fixture-tags.json'))
  console.log(`REVERTED (starved estate, whole file)  ${ok ? 'GREEN' : 'NOT GREEN'}  ${r.ms}ms  pass ${r.pass} fail ${r.fail}  residue ${left}`)
  for (const l of r.text.split('\n').filter((x) => /population:|fixture at index|purge:|beyond row 1,000/.test(x))) console.log(`      ${l.trim()}`)
  if (!ok || left) stopped = 'the reverted run is not green, or left residue'
}

if (stopped) {
  console.log(`STOPPED: ${stopped}. Copy left at ${COPY} with its in-flight marker.`)
  process.exit(3)
}
rmSync(MARKER)
const firedAll = results.length === INJECTIONS.length && results.every((x) => x.verdict === 'FIRED')
console.log(`${results.filter((x) => x.verdict === 'FIRED').length}/${INJECTIONS.length} FIRED by their named assertions; transcripts in ${OUT}/${RUN_ID}-*.txt`)
rmSync(COPY, { recursive: true, force: true })
process.exit(firedAll ? 0 : 1)
