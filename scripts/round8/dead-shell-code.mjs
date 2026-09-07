// ── ROUND 8 PHASE 0 ITEM 2: THE DEAD SHELL CODE, BY DELETION ────────────
//
// "Sandbox-deletion evidence for every dead, not a grep." Each name is DELETED
// from app.js on its own, the pure suite is run, and the result recorded. A
// name whose deletion changes nothing is dead; one that breaks something is not.
//
// Verification 44's harness discipline, and Round 7's addition: an in-flight
// marker, so a killed run cannot poison the next run's baseline.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { topLevelNames } from '../lib/top-level-names.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const APP = ROOT + 'frontend/app.js'
const SNAP = process.env.SNAP
if (!SNAP) throw new Error('SNAP is required')
mkdirSync(SNAP, { recursive: true })
const MARKER = SNAP + '/.in-flight'
if (existsSync(MARKER)) {
  console.error(`REFUSED: a previous run did not finish. Restore app.js from ${SNAP} first.`)
  process.exit(2)
}

const ORIGINAL = readFileSync(APP)
if (!ORIGINAL.length) { console.error('REFUSED: app.js is empty'); process.exit(2) }
writeFileSync(SNAP + '/frontend_app.js', ORIGINAL)
if (!readFileSync(SNAP + '/frontend_app.js').equals(ORIGINAL)) {
  console.error('REFUSED: snapshot did not round-trip'); process.exit(2)
}
const restore = () => {
  writeFileSync(APP, ORIGINAL)
  if (!readFileSync(APP).equals(ORIGINAL)) { console.error('STOP: restore mismatch'); process.exit(2) }
}

// The candidates are Round 7's own enumeration: every app.js name it
// dispositioned as having a React counterpart.
const enumSrc = readFileSync(ROOT + 'scripts/round7/tb-view-surface.mjs', 'utf8')
const block = enumSrc.slice(enumSrc.indexOf('const VIEW = {'),
  enumSrc.indexOf('\n}\n', enumSrc.indexOf('const VIEW = {')))
const CANDIDATES = [...block.matchAll(/^\s{2}([A-Za-z0-9_$]+):\s*'react:/gm)].map((m) => m[1])
if (CANDIDATES.length < 15) {
  console.error(`REFUSED: parsed ${CANDIDATES.length} candidates, expected 20+`)
  process.exit(2)
}

const text = ORIGINAL.toString('utf8')
const lines = text.split('\n')
const names = topLevelNames(text).sort((a, b) => a.line - b.line)

/** The line range a top-level name occupies: its own line to the next one's. */
const rangeOf = (name) => {
  const i = names.findIndex((n) => n.name === name)
  if (i < 0) return null
  const start = names[i].line
  const end = i + 1 < names.length ? names[i + 1].line - 1 : lines.length
  return { start, end, n: end - start + 1 }
}

const runSuite = () => {
  try {
    execFileSync('npm', ['test'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 180000 })
    return { failed: 0, out: '' }
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '')
    const m = out.match(/[#ℹ] fail (\d+)/)
    return { failed: m ? Number(m[1]) : -1, out }
  }
}

writeFileSync(MARKER, 'in flight')
const base = runSuite()
console.log(`BASELINE: ${base.failed === 0 ? 'GREEN' : `RED (${base.failed})`}\n`)
if (base.failed !== 0) {
  console.error('REFUSED: the baseline is not green, so no deletion can be read')
  restore(); rmSync(MARKER, { force: true }); process.exit(2)
}

const results = []
for (const name of CANDIDATES) {
  const r = rangeOf(name)
  if (!r) { results.push({ name, n: 0, verdict: 'NOT IN app.js', tests: [] }); continue }
  const cut = lines.slice(0, r.start - 1).concat(lines.slice(r.end)).join('\n')
  writeFileSync(APP, cut)
  const res = runSuite()
  const failing = [...res.out.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1])
  results.push({
    name, n: r.n,
    verdict: res.failed === 0 ? 'DEAD' : res.failed < 0 ? 'NO RESULT' : `BREAKS ${res.failed}`,
    tests: [...new Set(failing)].slice(0, 4),
  })
  restore()
  console.log(`  ${String(r.n).padStart(4)}  ${name.padEnd(28)} ${results.at(-1).verdict}`
    + (results.at(-1).tests.length ? '  <- ' + results.at(-1).tests[0].slice(0, 70) : ''))
}

restore()
const final = runSuite()
console.log(`\nreverted run: ${final.failed === 0 ? 'GREEN' : `RED (${final.failed})`}`)
console.log(`app.js byte-identical: ${readFileSync(APP).equals(ORIGINAL)}`)
rmSync(MARKER, { force: true })

const dead = results.filter((r) => r.verdict === 'DEAD')
const breaks = results.filter((r) => r.verdict.startsWith('BREAKS'))
console.log(`\nDEAD (delete): ${dead.length} names, ${dead.reduce((t, r) => t + r.n, 0)} lines`)
console.log(`BREAKS something: ${breaks.length} names`)
for (const b of breaks) console.log(`  ${b.name}: ${b.verdict}  ${b.tests.join('; ')}`)
writeFileSync(SNAP + '/dead-shell.json', JSON.stringify(results, null, 1))
