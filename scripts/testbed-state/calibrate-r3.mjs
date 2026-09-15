// ── R3 CALIBRATION: the route-level claims ───────────────────────────────
//
// The differ itself is covered by scripts/tests/payload-audit.test.mjs, which
// is pure. These are the claims that only exist once the differ is WIRED into
// a route, and the only instrument that can see them is the live probe.
//
// EVERY INJECTION RESTARTS THE SERVER. It runs without --watch, so an
// injection measured against the old process would report the healthy result
// and read exactly like a calibrated detector.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync, execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(process.argv[2] ?? '.')
const SP = resolve(process.argv[3])
const MARKER = `${SP}/IN_FLIGHT`
mkdirSync(SP, { recursive: true })
if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists. Restore by hand from ${SP}, then delete it.`)
  process.exit(2)
}

const FILES = ['src/lib/payload-audit.js', 'src/routes/contacts.js', 'src/routes/test-beds.js']
const key = (rel) => `${SP}/${rel.replaceAll('/', '_')}`
for (const rel of FILES) {
  mkdirSync(dirname(key(rel)), { recursive: true })
  writeFileSync(key(rel), readFileSync(`${ROOT}/${rel}`))
  if (!existsSync(key(rel)) || readFileSync(key(rel)).length === 0) {
    console.error(`NO SNAPSHOT for ${rel}`); process.exit(2)
  }
}
writeFileSync(MARKER, 'in flight')

const restore = () => {
  for (const rel of FILES) {
    writeFileSync(`${ROOT}/${rel}`, readFileSync(key(rel)))
    if (!readFileSync(`${ROOT}/${rel}`).equals(readFileSync(key(rel)))) {
      console.error(`RESTORE MISMATCH on ${rel} - stopping dead`); process.exit(3)
    }
  }
}

const restart = () => {
  try { execSync(`pkill -f "node --env-file=.env src/server.js"`, { stdio: 'ignore' }) } catch { /* none running */ }
  execSync('sleep 2')
  execSync(`cd ${ROOT} && nohup node --env-file=.env src/server.js > ${SP}/server.log 2>&1 &`, { stdio: 'ignore' })
  execSync('sleep 4')
}

const runProbe = () => {
  try {
    return execFileSync('node', ['scripts/testbed-state/probe-r3-split.mjs'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}

const patch = (rel, from, to) => {
  const p = `${ROOT}/${rel}`
  const src = readFileSync(p, 'utf8')
  if (!src.includes(from)) { console.error(`ANCHOR NOT FOUND in ${rel}`); restore(); restart(); process.exit(4) }
  if (src.split(from).length > 2) { console.error(`ANCHOR NOT UNIQUE in ${rel}`); restore(); restart(); process.exit(4) }
  writeFileSync(p, src.replace(from, to))
}

const CASES = [
  {
    name: 'the route logs the PATCH instead of the diff',
    apply: () => patch('src/lib/payload-audit.js',
      '    if (same(from, to)) continue\n', ''),
    expect: 'FAILED: it is a DIFF, not the patch',
  },
  {
    name: 'notes stop being exempt, so the array lands in the audit',
    apply: () => patch('src/lib/payload-audit.js',
      "export const NOT_AUDITED = new Set(['notes'])",
      'export const NOT_AUDITED = new Set([])'),
    expect: 'FAILED: no audit row anywhere carries a copy of the notes array',
  },
  {
    name: 'the contact route stops writing the audit row at all',
    apply: () => patch('src/routes/contacts.js',
      "          action: FIELDS_CHANGED,\n          actor_id: request.user.id,",
      "          action: 'something_else',\n          actor_id: request.user.id,"),
    expect: 'FAILED: exactly ONE fields_changed row was written',
  },
]

let failures = 0
for (const c of CASES) {
  c.apply()
  restart()
  const t0 = Date.now()
  const out = runProbe()
  const ms = Date.now() - t0
  // A RUN THAT PRODUCED NO VERDICT IS NOT A SILENT DETECTOR, IT IS NO RUN.
  // Scoring it as silence is how an expired token or a dead server reads as
  // three successful calibrations (Verification 48). Stop dead instead.
  const verdict = out.match(/(\d+)\/(\d+) pass/)
  if (!verdict) {
    console.error(`\nSTOPPING: "${c.name}" produced no verdict line in ${ms}ms.`)
    console.error(out.split('\n').slice(-25).join('\n'))
    restore(); restart()
    rmSync(MARKER)
    process.exit(5)
  }
  const fired = out.includes(c.expect)
  const failLine = out.split('\n').filter((l) => l.includes('FAILED:')).map((l) => l.trim())
  console.log(`${fired ? 'FIRED  ' : 'SILENT '} ${c.name}`)
  console.log(`         ${ms}ms, ${verdict[0]}, ${failLine.length} failed check(s)`)
  for (const l of failLine.slice(0, 3)) console.log(`           ${l}`)
  // A SILENT verdict with failures means the injection fired and the matcher
  // missed, which is a different finding from an unasserted claim.
  if (!fired && failLine.length) console.log('         NOTE: it failed, but not on the named check. Matcher, not silence.')
  if (!fired) failures++
  restore()
  restart()
}

const out = runProbe()
const clean = out.includes('28/28 pass')
console.log(`\nreverted run: ${clean ? '28/28 pass' : 'NOT CLEAN'}`)
if (!clean) { console.log(out.split('\n').slice(-20).join('\n')); failures++ }
for (const rel of FILES) {
  const same = readFileSync(`${ROOT}/${rel}`).equals(readFileSync(key(rel)))
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${rel}`)
  if (!same) failures++
}
rmSync(MARKER)
process.exit(failures ? 1 : 0)
