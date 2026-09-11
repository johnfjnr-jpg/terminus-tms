// Calibrating P1 item 5's build, both directions.
//
// THE SERVER IS RESTARTED AROUND EVERY INJECTION, and that is the whole reason
// this harness is more than a file edit. src/server.js runs WITHOUT --watch, so
// an injection into src/ that is not followed by a restart is measured against
// the code it replaced - and it would come back GREEN, because the old route
// satisfies almost every assertion the new one does. CLAUDE.md rule 9's
// stale-server clause: a probe cannot notice this, which inverts the usual
// remedy. There is no keystroke to press and no cache to bypass.
//
// Harness discipline per Verification 44: byte snapshot keyed by FULL PATH,
// asserted present before injecting, bytes compared after EVERY injection with
// a hard stop, an in-flight marker so a killed run cannot bless its wreckage,
// and a final reverted run.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { api, ApiError } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = process.env.SNAPDIR
if (!SNAP) { console.error('REFUSING: SNAPDIR is unset, so there is nowhere to snapshot to.'); process.exit(2) }
const INFLIGHT = `${SNAP}/IN_FLIGHT`
const FILES = ['src/routes/contacts.js']
const key = (f) => `${SNAP}/${f.replace(/\//g, '_')}`
const sha = (f) => createHash('sha256').update(readFileSync(`${ROOT}/${f}`)).digest('hex')

mkdirSync(SNAP, { recursive: true })
if (existsSync(INFLIGHT)) {
  console.error(`REFUSING: ${INFLIGHT} exists, so a previous run died mid-injection.`)
  console.error(`Restore from ${SNAP} by hand, or the wreckage gets snapshotted as the original.`)
  process.exit(2)
}
for (const f of FILES) {
  writeFileSync(key(f), readFileSync(`${ROOT}/${f}`))
  if (!existsSync(key(f))) { console.error(`snapshot failed for ${f}`); process.exit(2) }
}
const ORIG = Object.fromEntries(FILES.map((f) => [f, sha(f)]))
writeFileSync(INFLIGHT, new Date().toISOString())

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let child = null

async function restartServer() {
  try { execFileSync('pkill', ['-f', 'node --env-file=.env src/server.js']) } catch { /* none running */ }
  await sleep(1500)
  child = spawn('node', ['--env-file=.env', 'src/server.js'], { cwd: ROOT, detached: true, stdio: 'ignore' })
  child.unref()
  // Wait on the server ANSWERING, never on a fixed delay (Verification 6).
  //
  // THROUGH THE SHARED CLIENT, per scripts/tests/api-client.test.mjs, and the
  // liveness test is what the client throws. An ApiError means the server
  // REPLIED - even a 401 is a reply, and it is the reply an unauthenticated
  // poll should get - so it counts as up. Anything else is the connection
  // failing, which is not up.
  for (let i = 0; i < 40; i++) {
    try {
      await api('GET', '/industries')
      return true
    } catch (e) {
      if (e instanceof ApiError) return true
    }
    await sleep(500)
  }
  return false
}

function runProbe() {
  const t0 = Date.now()
  let out = ''
  let code = 0
  try {
    out = execFileSync('node', ['--env-file=.env', 'scripts/leads/probe-followup-task.mjs'],
      { cwd: ROOT, encoding: 'utf8', timeout: 180000 })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}`; code = e.status ?? 1 }
  return { code, out, ms: Date.now() - t0 }
}
const restore = (label) => {
  for (const f of FILES) {
    writeFileSync(`${ROOT}/${f}`, readFileSync(key(f)))
    if (sha(f) !== ORIG[f]) { console.error(`\nSTOP: restore of ${f} mismatched after "${label}"`); process.exit(3) }
  }
}
const edit = (f, from, to) => {
  const p = `${ROOT}/${f}`
  const s = readFileSync(p, 'utf8')
  if (s.split(from).length - 1 !== 1) { console.error(`anchor not unique in ${f}`); process.exit(2) }
  writeFileSync(p, s.replace(from, to))
}

const INJECTIONS = [
  { name: 'followUpDescription is removed from the writable-key allowlist',
    expect: 'is writable on Unqualified',
    go: () => edit('src/routes/contacts.js',
      "    'followUpDate', 'followUpDescription',", "    'followUpDate',") },
  // THE SECOND INJECTION HAD TO BE REWRITTEN, and the first attempt is recorded
  // because it looked reasonable and proved nothing. It added a stray key to
  // the writable allowlist, which does not make a write append a note, so the
  // assertion could not fail and came back SILENT. Verification 51's caveat:
  // before a silence names an unasserted claim, confirm the INJECTION fired.
  // It had not - the harness was wrong, not the detector.
  //
  // This one produces the actual defect: the route folds a note into the
  // follow-up write, which is the Nurture reason and the task re-merged - the
  // exact shape item 5 exists to keep apart.
  { name: 'the follow-up write also appends a note (the reason and task re-merged)',
    expect: 'adds NO note',
    go: () => edit('src/routes/contacts.js',
      "      const { data: newRevision, error: revErr } = await appendRecordRevision(",
      "      if (typeof payload.followUpDate === 'string') {\n" +
      "        payload.notes = [{ text: `Follow up on ${payload.followUpDate}.`,\n" +
      "          at: new Date().toISOString(), by: request.user.email }, ...(payload.notes ?? [])]\n" +
      "      }\n" +
      "      const { data: newRevision, error: revErr } = await appendRecordRevision(") },
]

if (!await restartServer()) { console.error('server did not come up for the baseline'); restore('baseline'); rmSync(INFLIGHT); process.exit(2) }
const base = runProbe()
console.log(`  healthy    exit ${base.code}  ${base.ms}ms  ${base.code === 0 ? 'GREEN' : 'NOT GREEN - stopping'}`)
if (base.code !== 0) { console.log(base.out.slice(-600)); restore('baseline'); rmSync(INFLIGHT); process.exit(2) }

let allFired = true
for (const inj of INJECTIONS) {
  inj.go()
  if (!await restartServer()) { console.error(`server did not come up for "${inj.name}"`); restore(inj.name); rmSync(INFLIGHT); process.exit(2) }
  const r = runProbe()
  const fired = r.code !== 0 && r.out.includes(`FAIL  ${inj.expect}`.replace('FAIL  ', 'FAIL  '))
  const named = r.out.split('\n').some((l) => l.startsWith('  FAIL') && l.includes(inj.expect))
  const ok = r.code !== 0 && named
  console.log(`  ${ok ? 'FIRED  ' : r.code === 0 ? 'SILENT ' : 'FIRED-ELSEWHERE'}  exit ${r.code}  ${String(r.ms).padStart(6)}ms  ${inj.name}`)
  if (!ok) { allFired = false; console.log(`           expected a FAIL line naming: ${inj.expect}`) }
  restore(inj.name)
}
if (!await restartServer()) { console.error('server did not come up for the reverted run'); rmSync(INFLIGHT); process.exit(2) }
const end = runProbe()
console.log(`  reverted   exit ${end.code}  ${end.ms}ms  ${end.code === 0 ? 'GREEN' : 'RED'}`)
let identical = true
for (const f of FILES) if (sha(f) !== ORIG[f]) { identical = false; console.log(`  ${f} NOT byte-identical`) }
console.log(`\n  ${INJECTIONS.length} injections; all fired: ${allFired}; files byte-identical: ${identical}`)
rmSync(INFLIGHT)
process.exit(allFired && end.code === 0 && identical ? 0 : 1)
