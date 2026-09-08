// Calibration of scripts/tests/create-from-ownership.test.mjs, both directions.
// Every injection is a mutated COPY; src/ is only ever read.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const TEST = ROOT + 'scripts/tests/create-from-ownership.test.mjs'
const FILES = ['src/routes/contacts.js', 'src/routes/test-beds.js', 'src/routes/transition-requests.js']
const before = Object.fromEntries(FILES.map((f) => [f, createHash('sha256').update(readFileSync(ROOT + f)).digest('hex')]))

function run(mutate, label, expectFail, matcher) {
  const dir = mkdtempSync(join(tmpdir(), 'cf-cal-'))
  mkdirSync(join(dir, 'src/routes'), { recursive: true })
  mkdirSync(join(dir, 'scripts/lib'), { recursive: true })
  cpSync(ROOT + 'src/routes', join(dir, 'src/routes'), { recursive: true })
  cpSync(ROOT + 'scripts/lib', join(dir, 'scripts/lib'), { recursive: true })
  mutate(dir)
  const r = spawnSync('node', ['--test', TEST], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CREATE_FROM_ROOT: dir + '/' } })
  const out = r.stdout + r.stderr
  const fail = Number((out.match(/^. fail (\d+)$/m) ?? [])[1] ?? -1)
  const pass = Number((out.match(/^. pass (\d+)$/m) ?? [])[1] ?? -1)
  if (fail < 0) { console.log(`  STOP  ${label}: no parseable result`); console.log(out.slice(-600)); process.exit(2) }
  const fired = expectFail ? fail > 0 : fail === 0
  const named = !matcher || out.includes(matcher)
  console.log(`  ${fired && named ? 'FIRED ' : 'SILENT'} ${label}  (pass ${pass}, fail ${fail})`)
  if (fired && !named) console.log(`         fired, but not on "${matcher}"`)
  return fired && named
}
const edit = (dir, f, from, to) => {
  const path = join(dir, f); const s = readFileSync(path, 'utf8')
  if (!s.includes(from)) { console.log(`  STOP: anchor missing in ${f}`); process.exit(2) }
  writeFileSync(path, s.replace(from, to))
}

console.log('DIRECTION ONE: each claim, falsified')
const R = []
R.push(run((d) => edit(d, 'src/routes/contacts.js', "industry_id, owner_id')", "industry_id')"),
  'the shared loader stops selecting owner_id', true, 'READ an owner'))
R.push(run((d) => edit(d, 'src/routes/test-beds.js', ".select('id, owner_id')\n      .eq('id', request.params.id)\n      .eq('record_type', 'test_bed')\n      .maybeSingle()", ".select('id')\n      .eq('id', request.params.id)\n      .eq('record_type', 'test_bed')\n      .maybeSingle()"),
  'a bed select stops fetching owner_id', true, 'READ an owner'))
R.push(run((d) => edit(d, 'src/routes/test-beds.js', "if (bed.owner_id !== request.user.id) return sendRefusal(reply)", "if (false) return sendRefusal(reply)"),
  'a guard is removed', true, 'exactly the four'))
R.push(run((d) => edit(d, 'src/routes/test-beds.js', "app.get('/test-beds/:id/lifecycle-documents', async (request, reply) => {", "app.get('/test-beds/:id/lifecycle-documents', async (request, reply) => {\n    if (bed.owner_id !== request.user.id) return sendRefusal(reply)"),
  'THE NEAR-MISS: a GET route gains the guard', true, 'NO GET ROUTE'))
R.push(run((d) => edit(d, 'src/routes/transition-requests.js', "app.post('/transition-requests/:id/approvals', async (request, reply) => {", "app.post('/transition-requests/:id/approvals', async (request, reply) => {\n    if (rec.owner_id !== request.user.id) return sendRefusal(reply)"),
  'R7: a sweep guards the exempt approvals path', true, 'EXEMPT'))
console.log('\nDIRECTION TWO: the untouched tree is green')
R.push(run(() => {}, 'the untouched sources pass', false))

const after = Object.fromEntries(FILES.map((f) => [f, createHash('sha256').update(readFileSync(ROOT + f)).digest('hex')]))
const untouched = FILES.every((f) => before[f] === after[f])
console.log(`\nsrc/routes unchanged by the harness: ${untouched}`)
if (!untouched) { console.log('THE HARNESS MODIFIED src/. STOP.'); process.exit(2) }
console.log(`${R.filter(Boolean).length}/${R.length} calibrations behaved as required`)
process.exit(R.every(Boolean) ? 0 : 1)
