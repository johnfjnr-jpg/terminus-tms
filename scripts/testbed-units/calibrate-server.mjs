// ── CALIBRATE A SERVER-SIDE REFUSAL. Test Bed units ─────────────────────
//
// scripts/testbed-core/calibrate-live.mjs REFUSES a server-only injection, and
// correctly: it requires the injected source to change the served BUNDLE, or the
// thing it runs is not the thing it built. A route change never touches the
// bundle, so a route rule needs this harness, with the same discipline: verified
// snapshot, injection, the defect proven live, the probe run and scored on its
// NAMED checks, then a byte-identical restore and the rule proven live again.
// The dev server runs under --watch, so writing the file reloads it.
//
// Generalised from calibrate-r3-server.mjs, which did this for R3 alone.
//
// UNWIRED. Run: node --env-file=.env scripts/testbed-units/calibrate-server.mjs <spec> <scratch-dir>
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const [, , specPath, scratch] = process.argv
if (!specPath || !scratch) { console.error('usage: calibrate-server.mjs <spec> <scratch-dir>'); process.exit(2) }
const spec = (await import(pathToFileURL(resolve(ROOT, specPath)).href)).default
const FILE = `${ROOT}/${spec.file}`
const SNAP = `${scratch}/${spec.file.replaceAll('/', '_')}.snapshot`
const MARK = `${scratch}/SERVER-CALIBRATION-IN-FLIGHT`
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

if (existsSync(MARK)) { console.error(`a previous server calibration did not finish; restore from ${scratch} first`); process.exit(3) }
const original = readFileSync(FILE, 'utf8')
if (original.split(spec.find).length !== 2) { console.error('the anchor is not unique in the file'); process.exit(3) }
writeFileSync(SNAP, original)
if (!existsSync(SNAP) || sha(SNAP) !== sha(FILE)) { console.error('the snapshot did not land'); process.exit(3) }
const before = sha(FILE)
console.log(`snapshot verified, sha ${before.slice(0, 12)}`)
writeFileSync(MARK, new Date().toISOString())

let fired = false
try {
  writeFileSync(FILE, original.replace(spec.find, spec.replace))
  await wait(spec.restartMs ?? 4000)
  console.log(`INJECTED, the server's answer now: ${JSON.stringify(await spec.live())}`)
  const r = spawnSync('node', ['--env-file=.env', spec.probe], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, TBUNITS_RUN: `${spec.run}-injected` }, timeout: 580000 })
  const out = `${r.stdout}${r.stderr}`
  writeFileSync(`${scratch}/${spec.run}-injected.txt`, out)
  for (const l of out.split('\n').filter((l) => /  (PASS|FAIL)  |checks PASS/.test(l))) console.log(`   ${l.trim()}`)
  const fails = out.split('\n').filter((l) => l.includes('  FAIL  '))
  fired = spec.expect.every((e) => fails.some((l) => l.includes(e)))
  console.log(`probe on the injected server: exit ${r.status}, ${fails.length} failed check(s)`)
  console.log(`${fired ? 'FIRED ' : 'SILENT'}  ${spec.id}: ${spec.expect.map((e) => `"${e}"`).join(' + ')}`)
} finally {
  writeFileSync(FILE, original)
  const after = sha(FILE)
  console.log(`restored: sha ${after.slice(0, 12)}, byte-identical: ${after === before}`)
  if (after !== before) { console.error('RESTORE MISMATCH, stopping with the marker in place'); process.exit(4) }
  await wait(spec.restartMs ?? 4000)
  console.log(`AFTER RESTORE, the server's answer: ${JSON.stringify(await spec.live())}`)
  unlinkSync(MARK)
  console.log('marker removed')
}
process.exit(fired ? 0 : 1)
