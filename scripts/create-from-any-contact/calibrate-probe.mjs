#!/usr/bin/env node
// ── CALIBRATION OF scripts/probe-create-from-any-contact.mjs, BOTH WAYS ────
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/create-from-any-contact/calibrate-probe.mjs
//
// CREATE_FROM_ANY_CONTACT R9: each injection is read by the CHECK IT NAMES,
// never by the exit code alone (Verification 9's clause: a red run whose
// failure is somewhere else has calibrated nothing). Then a REVERTED run must
// read every check green.
//
// NEVER THE SERVED TREE (PROBE_TRIAGE R2, Verification 44). Committed HEAD is
// extracted into an OS temp directory, served on its own port, and every
// injection lands there. The probe itself runs from this checkout (its
// session, .env and fixtures), pointed at the copy by TMS_BASE, so browser and
// API both measure the injected code. The copy's bytes are snapshotted before
// any injection, restored after each, and compared; a mismatch stops dead.
//
// Committed HEAD, not the working tree: a calibration of uncommitted work
// measures something nobody can name afterwards. The script refuses a dirty
// tree for the files it injects.
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { get } from 'node:http'
import { join } from 'node:path'

const REPO = new URL('../../', import.meta.url).pathname
const PORT = Number(process.env.CAL_PORT ?? 3013)
const BASE = `http://localhost:${PORT}`
const OUT = join(REPO, '.verify/create-from-any-contact/calibration')
mkdirSync(OUT, { recursive: true })

const INJECTED_FILES = ['frontend/app.js', 'frontend/style.css', 'src/routes/contacts.js', 'src/routes/test-beds.js']
const dirty = execFileSync('git', ['status', '--porcelain', '--', ...INJECTED_FILES, 'scripts/probe-create-from-any-contact.mjs'], { cwd: REPO, encoding: 'utf8' }).trim()
if (dirty) { console.error(`refused: uncommitted changes to files this calibration measures:\n${dirty}`); process.exit(2) }

const COPY = mkdtempSync(join(tmpdir(), 'cfany-cal-'))
execFileSync('sh', ['-c', `git -C "${REPO}" archive HEAD | tar -x -C "${COPY}"`])
symlinkSync(join(REPO, 'node_modules'), join(COPY, 'node_modules'))
writeFileSync(join(COPY, '.env'), readFileSync(join(REPO, '.env')))
const ORIGINAL = Object.fromEntries(INJECTED_FILES.map((f) => [f, readFileSync(join(COPY, f), 'utf8')]))
for (const f of INJECTED_FILES) {
  if (ORIGINAL[f] !== execFileSync('git', ['show', `HEAD:${f}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })) {
    console.error(`refused: the copy of ${f} is not HEAD's`); process.exit(2)
  }
}
console.log(`copy of HEAD at ${COPY}, served on :${PORT}`)

let server = null
const stopServer = async () => {
  if (!server) return
  const s = server; server = null
  s.kill('SIGTERM')
  await new Promise((r) => { s.once('exit', r); setTimeout(r, 5000) })
}
const startServer = async () => {
  await stopServer()
  server = spawn(process.execPath, ['--env-file=.env', 'src/server.js'], { cwd: COPY, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'pipe'] })
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    // node:http, not fetch: the estate's scripts reach a server through the
    // throwing api-client, and this is a readiness poll of the static root.
    const ok = await new Promise((res) => { const q = get(BASE + '/', (r) => { r.resume(); res(r.statusCode === 200) }); q.on('error', () => res(false)) })
    if (ok) return
  }
  throw new Error('the copy server did not answer within 30s')
}

const inject = (file, from, to) => {
  const src = readFileSync(join(COPY, file), 'utf8')
  const n = src.split(from).length - 1
  if (n !== 1) throw new Error(`anchor in ${file} found ${n} times, not once: ${from.slice(0, 80)}`)
  const next = src.replace(from, to)
  writeFileSync(join(COPY, file), next)
  if (readFileSync(join(COPY, file), 'utf8') !== next || next === src) throw new Error(`injection into ${file} did not land`)
}
const restoreAll = () => {
  for (const f of INJECTED_FILES) {
    writeFileSync(join(COPY, f), ORIGINAL[f])
    if (readFileSync(join(COPY, f), 'utf8') !== ORIGINAL[f]) throw new Error(`restore of ${f} did not read back identical: STOP`)
  }
}

const runProbe = (tag) => new Promise((resolve) => {
  const t0 = Date.now()
  const p = spawn(process.execPath, ['--env-file=.env', 'scripts/probe-create-from-any-contact.mjs', tag], { cwd: REPO, env: { ...process.env, TMS_BASE: BASE }, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { out += d })
  p.on('exit', (code) => {
    writeFileSync(join(OUT, `${tag}.txt`), out)
    const fails = [...out.matchAll(/^FAIL  (.*?)(?:  \[|$)/gm)].map((m) => m[1])
    const passes = [...out.matchAll(/^PASS  /gm)].length
    const total = out.match(/(\d+)\/(\d+) checks passed/)
    resolve({ code, fails, passes, total: total ? Number(total[2]) : null, ms: Date.now() - t0 })
  })
})

// Each injection, and the checks it must fail, by their numbered names.
const INJECTIONS = [
  { name: 'door exemption removed', file: 'frontend/app.js', from: "  '[data-creates-own-record]',\n].join(', ')", to: "].join(', ')",
    expect: ['1. detail opportunity', '1. detail test-bed', '5b.'] },
  { name: 'create-test-bed writes a contact-keyed audit row', file: 'src/routes/contacts.js',
    from: "    await db.from('audit_log').insert([\n      { record_id: record.id, record_type: 'test_bed', action: 'created_from_contact'",
    to: "    await db.from('audit_log').insert([\n      { record_id: contact.id, record_type: 'contact', action: 'created_test_bed', actor_id: request.user.id, detail: { test_bed_id: record.id } },\n      { record_id: record.id, record_type: 'test_bed', action: 'created_from_contact'",
    expect: ['3. list test-bed', '3. detail test-bed'] },
  { name: 'create-opportunity writes a contact-keyed audit row', file: 'src/routes/contacts.js',
    from: '    return reply.code(201).send(opp)',
    to: "    await db.from('audit_log').insert({ record_id: contact.id, record_type: 'contact', action: 'created_opportunity', actor_id: request.user.id, detail: { opportunity_id: opp.id } })\n    return reply.code(201).send(opp)",
    expect: ['3. list opportunity', '3. detail opportunity'] },
  { name: 'create-test-bed writes on the Account', file: 'src/routes/contacts.js',
    from: "    await db.from('audit_log').insert([\n      { record_id: record.id, record_type: 'test_bed', action: 'created_from_contact'",
    to: "    await db.from('audit_log').insert([\n      { record_id: contact.parent_record_id, record_type: 'account', action: 'calibration_injected', actor_id: request.user.id, detail: {} },\n      { record_id: record.id, record_type: 'test_bed', action: 'created_from_contact'",
    expect: ['4. list test-bed', '4. detail test-bed'] },
  { name: 'both create routes refuse at the route', multi: [
      { file: 'src/routes/contacts.js', from: "app.post('/contacts/:id/create-test-bed', async (request, reply) => {\n", to: "app.post('/contacts/:id/create-test-bed', async (request, reply) => {\n    return sendRefusal(reply)\n" },
      { file: 'src/routes/contacts.js', from: "app.post('/contacts/:id/create-opportunity', async (request, reply) => {\n", to: "app.post('/contacts/:id/create-opportunity', async (request, reply) => {\n    return sendRefusal(reply)\n" }],
    expect: ['1. list opportunity', '1. list test-bed', '1. detail opportunity', '1. detail test-bed'] },
  { name: 'the contact PATCH answers 200 without its ownership refusal', file: 'src/routes/contacts.js',
    from: '    const columnUpdate = {}', to: '    return reply.send({ id: record.id })\n    const columnUpdate = {}',
    expect: ['5a.'] },
  { name: 'the contact screen\'s field rows are no longer doored', file: 'frontend/style.css',
    from: '.is-not-mine .field-row-display,\n', to: '.is-not-mine .field-row-display-calibration,\n',
    expect: ['5b.'] },
  { name: 'Test Bed convert answers 201 for a non-owner', file: 'src/routes/test-beds.js',
    from: "app.post('/test-beds/:id/convert', async (request, reply) => {\n", to: "app.post('/test-beds/:id/convert', async (request, reply) => {\n    return reply.code(201).send({ id: null })\n",
    expect: ['5c.'] },
]

let fired = 0
const lines = []
try {
  for (const [i, inj] of INJECTIONS.entries()) {
    for (const s of inj.multi ?? [inj]) inject(s.file, s.from, s.to)
    await startServer()
    const r = await runProbe(`cfanycal${i + 1}`)
    restoreAll()
    // A run that produced no result is a STOP, never a score (Verification 48).
    if (r.total === null && r.fails.length === 0) throw new Error(`injection ${i + 1} (${inj.name}): the probe produced no result (exit ${r.code}, ${r.ms}ms). See ${OUT}/cfanycal${i + 1}.txt`)
    const missed = inj.expect.filter((e) => !r.fails.some((f) => f.startsWith(e)))
    const extra = r.fails.filter((f) => !inj.expect.some((e) => f.startsWith(e)))
    const ok = missed.length === 0
    if (ok) fired++
    const line = `${ok ? 'FIRED ' : 'SILENT'}  ${i + 1}. ${inj.name}: failed ${r.fails.length} (${r.ms}ms)` +
      (missed.length ? `\n         MISSED ${missed.join('; ')}` : '') + (extra.length ? `\n         also failed: ${extra.join('; ')}` : '')
    lines.push(line); console.log(line)
  }
  await startServer()
  const rev = await runProbe('cfanycalrev')
  const green = rev.code === 0 && rev.fails.length === 0 && rev.total > 0 && rev.passes === rev.total
  const line = `${green ? 'GREEN ' : 'RED   '}  reverted: ${rev.passes}/${rev.total} checks passed (${rev.ms}ms)${rev.fails.length ? `\n         failed: ${rev.fails.join('; ')}` : ''}`
  lines.push(line); console.log(line)
  console.log(`\n${fired}/${INJECTIONS.length} FIRED by their named checks, reverted ${green ? 'green' : 'NOT green'}`)
  process.exitCode = fired === INJECTIONS.length && green ? 0 : 1
} catch (e) {
  console.error(`STOP: ${e.message}`)
  try { restoreAll() } catch (e2) { console.error(e2.message) }
  process.exitCode = 3
} finally {
  await stopServer()
  rmSync(COPY, { recursive: true, force: true })
}
