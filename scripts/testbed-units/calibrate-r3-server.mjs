// ── R3's SERVER REFUSAL, CALIBRATED. Test Bed units Phase 2 ─────────────
//
// scripts/testbed-core/calibrate-live.mjs REFUSES a server-only injection, and
// correctly: it requires the injected source to change the served BUNDLE, or the
// thing it runs is not the thing it built. A route change never touches the
// bundle, so R3 needs its own harness with the same discipline.
//
// UNWIRED. Run with the browser variables set, because it runs the live probe:
//   TBUNITS_RUN is set by this script; pass a scratch directory as argv[2].
//   node --env-file=.env scripts/testbed-units/calibrate-r3-server.mjs <scratch-dir>
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const ROOT = '/Users/johnfryatt/terminus-tms'
const FILE = `${ROOT}/src/routes/test-beds.js`
const SNAP = `${process.argv[2]}/${FILE.replaceAll('/', '_')}.snapshot`
const MARK = `${process.argv[2]}/R3-IN-FLIGHT`
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const FIND = "    if (!Object.keys(unitPatch).length && !('state' in body)) {"
const INJECT = "    if (false && !Object.keys(unitPatch).length && !('state' in body)) {"
if (existsSync(MARK)) { console.error('a previous R3 calibration did not finish; restore from the snapshot first'); process.exit(3) }
const original = readFileSync(FILE, 'utf8')
if (!original.includes(FIND)) { console.error('the R3 refusal is not in the file as expected'); process.exit(3) }
writeFileSync(SNAP, original)
if (!existsSync(SNAP) || sha(SNAP) !== sha(FILE)) { console.error('the snapshot did not land'); process.exit(3) }
const before = sha(FILE)
console.log(`snapshot verified, sha ${before.slice(0, 12)}`)
writeFileSync(MARK, new Date().toISOString())

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const probeWrapped = async () => {
  const { api } = await import(`${ROOT}/scripts/api-client.mjs`)
  const { freshTestBed, tearDown, admin } = await import(`${ROOT}/scripts/fixtures.mjs`)
  const tag = `TBUNITS-R3CAL-${Date.now()}`
  const fx = await freshTestBed(tag)
  const db = admin()
  try {
    const rev = (await api('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
    await api('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: 1 }, expected_revision: rev })
    await api('POST', `/test-beds/${fx.bedId}/units/derive`, {})
    const unit = (await api('GET', `/test-beds/${fx.bedId}/units`)).data[0]
    const res = await api('PATCH', `/test-beds/${fx.bedId}/units/${unit.id}`,
      { payload: { serial: 'SN-CAL' }, expected_revision: unit.revision_number ?? null })
      .then((r) => ({ status: r.status, data: r.data }))
      .catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
    const { data: revs } = await db.from('record_revisions').select('revision_number')
      .eq('record_id', unit.id).order('revision_number', { ascending: false }).limit(1)
    return { status: res.status, error: res.data?.error ?? null, unitRevision: revs?.[0]?.revision_number ?? null }
  } finally { await tearDown(tag) }
}

try {
  writeFileSync(FILE, original.replace(FIND, INJECT))
  await wait(4000) // node --watch restarts the dev server on the write
  const injected = await probeWrapped()
  console.log(`INJECTED (R3 disabled): a wrapped body -> ${JSON.stringify(injected)}`)
  const run = spawnSync('node', ['--env-file=.env', 'scripts/testbed-units/probe-p2-b4.mjs'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, TBUNITS_RUN: 'p2-r3-injected' }, timeout: 580000 })
  const out = `${run.stdout}${run.stderr}`
  const fails = out.split('\n').filter((l) => l.includes('  FAIL  '))
  const want = ['a wrapped body is REFUSED 400, not answered 200', 'and no revision is appended for it', 'an unknown key is REFUSED 400']
  console.log(`probe on the injected server: exit ${run.status}`)
  for (const l of out.split('\n').filter((l) => /  (PASS|FAIL)  |checks PASS/.test(l))) console.log(`   ${l.trim()}`)
  const fired = want.every((w) => fails.some((l) => l.includes(w)))
  console.log(`${fired ? 'FIRED ' : 'SILENT'}  R3 removed: ${want.map((w) => `"${w}"`).join(' + ')}`)
} finally {
  writeFileSync(FILE, original)
  const after = sha(FILE)
  console.log(`restored: sha ${after.slice(0, 12)}, byte-identical to the snapshot: ${after === before}`)
  if (after !== before) { console.error('RESTORE MISMATCH, stopping with the marker in place'); process.exit(3) }
  await wait(4000)
  const healthy = await probeWrapped()
  console.log(`AFTER RESTORE (R3 live again): a wrapped body -> ${JSON.stringify(healthy)}`)
  unlinkSync(MARK)
  console.log('marker removed')
}
