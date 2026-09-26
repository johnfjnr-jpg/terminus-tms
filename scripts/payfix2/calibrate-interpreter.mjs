// ── CALIBRATING THE RULING'S OWN PROOF STEP ─────────────────────────────
//
// R-PT3 asks for proof that the interpreter outlives the option. A proof that
// cannot fail is not a proof (Verification 9), so this removes the meaning of
// `single` from the calculator and requires the probe to notice.
//
// IT RUNS ITS OWN SERVER ON ITS OWN PORT. Port 3000 is held by a process
// started WITHOUT `--watch`, so an injected `src/` change would not reach it
// and the probe would measure the code that had just been replaced - and would
// PASS, which is rule 9's stale-server clause exactly. Restarting the estate's
// dev server to prove a point is the worse trade, so the calibration starts a
// second one and points the probe at it.
//
// Verification 44: full-path snapshot, asserted before injecting, compared
// byte for byte after, in-flight marker, and every stop path restores.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync, spawn } from 'node:child_process'
import { connect } from 'node:net'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/payfix2/snapshots`
const MARKER = `${SNAP}/IN-FLIGHT-INTERP`
mkdirSync(SNAP, { recursive: true })
const FILE = 'src/lib/deal-calculator.js'
const key = FILE.replaceAll('/', '_')
const abs = `${ROOT}/${FILE}`
const PORT = 3111
const BASE = `http://127.0.0.1:${PORT}`

const FIND = "  const recov = structure === 'single' ? months"
const PUT = "  const recov = structure === 'singlePhaseRETIRED' ? months"

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run died mid-injection.`)
  process.exit(2)
}
const original = readFileSync(abs, 'utf8')
writeFileSync(`${SNAP}/${key}`, original)
if (!existsSync(`${SNAP}/${key}`)) { console.error('REFUSING: snapshot missing after write'); process.exit(2) }
writeFileSync(MARKER, new Date().toISOString())
const restore = (what) => {
  writeFileSync(abs, readFileSync(`${SNAP}/${key}`, 'utf8'))
  if (readFileSync(abs, 'utf8') !== original) {
    console.error(`STOP: ${FILE} did not restore byte for byte after ${what}`)
    console.error(`The marker is LEFT in place on purpose. Restore from ${SNAP}.`)
    process.exit(3)
  }
}

let server = null
const stopServer = async () => {
  if (!server) return
  server.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 900))
  server = null
}
const startServer = async () => {
  server = spawn('node', ['--env-file=.env', 'src/server.js'],
    { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] })
  /* WAIT ON REAL STATE: the port ACCEPTING, not a fixed delay.
     A TCP connect rather than a `fetch`, for two reasons. The estate's own
     guard refuses a bare `fetch` in a script because it bypasses the throwing
     client and makes a non-2xx silent, and it was right to refuse this one.
     And readiness is a LISTENER question rather than an HTTP one: Fastify binds
     after its routes are registered, so accepting a connection is the thing
     being waited for. */
  const accepting = () => new Promise((resolve) => {
    const sock = connect({ port: PORT, host: '127.0.0.1' })
    const done = (ok) => { sock.destroy(); resolve(ok) }
    sock.once('connect', () => done(true))
    sock.once('error', () => done(false))
    sock.setTimeout(1000, () => done(false))
  })
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 250))
    if (await accepting()) return true
  }
  return false
}
const runProbe = () => {
  try {
    const out = execSync('node --env-file=.env scripts/payfix2/probe-interpreter.mjs',
      { cwd: ROOT, env: { ...process.env, C_BASE: BASE }, stdio: ['ignore', 'pipe', 'pipe'] })
    return { failed: false, text: String(out) }
  } catch (e) { return { failed: true, text: `${e.stdout ?? ''}${e.stderr ?? ''}` } }
}

const results = []
try {
  // ── 1. THE INJECTED RUN. It must FAIL, and on its OWN named assertion.
  writeFileSync(abs, original.replace(FIND, PUT))
  if (readFileSync(abs, 'utf8') === original) {
    console.error('STOP: the injection did not change the file'); restore('a no-op edit')
    rmSync(MARKER, { force: true }); process.exit(5)
  }
  if (original.split(FIND).length - 1 !== 1) {
    console.error('STOP: the anchor is not unique'); restore('a refused anchor')
    rmSync(MARKER, { force: true }); process.exit(4)
  }
  if (!(await startServer())) {
    console.error('STOP: the injected server never listened'); await stopServer()
    restore('a server that never started'); rmSync(MARKER, { force: true }); process.exit(6)
  }
  const t0 = Date.now()
  const injected = runProbe()
  const ms = Date.now() - t0
  await stopServer()
  const failCount = (injected.text.match(/FAIL /g) ?? []).length
  // Verification 48: a failed run with NO failing assertion has not run.
  if (injected.failed && failCount === 0) {
    console.error(`STOP: the injected run failed with no failing assertion in ${ms}ms`)
    console.error(injected.text.slice(-1200))
    restore('a run that produced no result'); rmSync(MARKER, { force: true }); process.exit(7)
  }
  const named = /FAIL .*single still recovers over the FULL TERM/.test(injected.text)
  results.push({ id: 'the meaning of `single` in the calculator',
    verdict: !injected.failed ? 'SILENT' : named ? 'FIRED' : 'FIRED-ELSEWHERE', failCount, ms })
  for (const line of injected.text.split('\n').filter((l) => l.includes('FAIL '))) {
    console.log(`    ${line.trim()}`)
  }
} finally {
  await stopServer()
  restore('the sweep')
  rmSync(MARKER, { force: true })
}

console.log('')
for (const r of results) console.log(`  ${r.verdict.padEnd(15)} ${r.id}   ${r.failCount} failing, ${r.ms}ms`)

// ── 2. THE REVERTED RUN, against a server built from the restored source.
console.log('\nreverted run:')
if (!(await startServer())) { console.error('  the reverted server never listened'); process.exit(6) }
const final = runProbe()
await stopServer()
const okLine = final.text.split('\n').find((l) => /checks passed/.test(l)) ?? ''
console.log(`  ${final.failed ? 'RED' : 'GREEN'}   ${okLine.trim()}`)
const fired = results.filter((r) => r.verdict === 'FIRED').length
console.log(`\n${fired} of ${results.length} injections fired on their OWN named assertion`)
process.exit(fired === results.length && !final.failed ? 0 : 1)
