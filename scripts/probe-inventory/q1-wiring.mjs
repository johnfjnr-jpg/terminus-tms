// ── Q1: WHICH PROBES IS NOTHING RUNNING? ─────────────────────────────────
//
// Verification 9's newest clause: a detector nothing schedules rots, and
// every other clause in that rule begins by EXECUTING the thing, so none of
// them can see this.
//
// The population is enumerated from disk; the wired set is enumerated from
// what package.json and verify-all.mjs actually execute. Anything in the
// first and not the second is unrun.
//
// CALIBRATED BOTH WAYS BEFORE ANY NUMBER IS REPORTED (R2).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p, out) }
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p)
  }
  return out
}

// ── THE POPULATION ───────────────────────────────────────────────────────
// Only files that ASSERT something. A library, a fixture helper or a
// generator is not a detector and its absence from a gate is not rot.
const ASSERTS = /\b(assert|check\(|expect\(|process\.exit\(1\)|FAIL|throw new Error)/
const all = walk(join(ROOT, 'scripts')).map((f) => relative(ROOT, f))

// A LIBRARY IS NOT A DETECTOR, AND THE DIFFERENCE IS STRUCTURAL RATHER THAN
// A NAME (Verification 19: enumerate by structure, never by a list).
//
// The first draft counted anything containing `assert` or `throw new Error`,
// which swept in `api-client.mjs`, `fixtures.mjs` and `create-test-user.js` -
// libraries whose throws are error handling, not verdicts. A library is
// IMPORTED by something else; a detector is only ever EXECUTED. So: a file
// any other file imports is excluded from the population.
const sources = new Map(all.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]))
const importedBy = new Map()
for (const [f, src] of sources) {
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+\.(?:mjs|js))['"]/g)) {
    const target = m[1].split('/').pop()
    importedBy.set(target, (importedBy.get(target) ?? 0) + 1)
  }
}
const isLibrary = (f) => (importedBy.get(f.split('/').pop()) ?? 0) > 0
const asserting = all.filter((f) => ASSERTS.test(sources.get(f)))
const libraries = asserting.filter(isLibrary)
const population = asserting.filter((f) => !isLibrary(f))

// ── THE WIRED SET, from what actually executes ───────────────────────────
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const verifyAll = readFileSync(join(ROOT, 'scripts/verify-all.mjs'), 'utf8')
const hook = (() => { try { return readFileSync(join(ROOT, '.githooks/pre-commit'), 'utf8') } catch { return '' } })()
const preCommit = (() => { try { return readFileSync(join(ROOT, 'scripts/pre-commit-suites.mjs'), 'utf8') } catch { return '' } })()
const runnerText = [...Object.values(pkg.scripts ?? {}), verifyAll, hook, preCommit].join('\n')

const wired = new Set()
for (const f of all) {
  const rel = relative(ROOT, join(ROOT, f))
  const base = rel.split('/').pop()
  // Named as a path, or as a bare basename, in anything that runs things.
  if (runnerText.includes(rel) || new RegExp(`[\\s'"\`/]${base.replace('.', '\\.')}`).test(runnerText))
    wired.add(rel)
}

const unwired = population.filter((f) => !wired.has(f))

// ── CALIBRATION (R2), BOTH DIRECTIONS, ON KNOWN CASES ────────────────────
// KNOWN WIRED: named explicitly in package.json's test:db.
// KNOWN UNWIRED: the Round B probe, which was dead two rounds because
// nothing ran it. If it is now wired, the calibration says so and picks
// another - it must never silently pass.
const KNOWN_WIRED = 'scripts/tests/config-invariants.test.mjs'
const KNOWN_UNWIRED = 'scripts/leads/probe-gated-fields-reachable.mjs'
const inPop = (f) => population.includes(f)
const cal = {
  knownWiredPresent: inPop(KNOWN_WIRED),
  knownWiredFlagged: unwired.includes(KNOWN_WIRED),
  knownUnwiredPresent: inPop(KNOWN_UNWIRED),
  knownUnwiredFlagged: unwired.includes(KNOWN_UNWIRED),
}
console.log('=== Q1 CALIBRATION ===')
console.log(`  known WIRED   ${KNOWN_WIRED}`)
console.log(`     in population: ${cal.knownWiredPresent}   flagged unwired: ${cal.knownWiredFlagged}  (must be FALSE)`)
console.log(`  known UNWIRED ${KNOWN_UNWIRED}`)
console.log(`     in population: ${cal.knownUnwiredPresent}   flagged unwired: ${cal.knownUnwiredFlagged}  (must be TRUE)`)
const ok = cal.knownWiredPresent && !cal.knownWiredFlagged && cal.knownUnwiredPresent && cal.knownUnwiredFlagged
console.log(ok
  ? '  CALIBRATED: the sweep separates wired from unwired on both known cases.\n'
  : '  *** NOT CALIBRATED. The numbers below mean nothing until this is fixed. ***\n')

console.log('=== Q1 RESULT ===')
console.log(`  files under scripts/          : ${all.length}`)
console.log(`  of those, ASSERT something    : ${asserting.length}`)
console.log(`  minus LIBRARIES (imported)    : -${libraries.length}`)
console.log(`  = the DETECTOR population     : ${population.length}`)
console.log(`  wired to a runner             : ${population.length - unwired.length}`)
console.log(`  UNWIRED - nothing runs these  : ${unwired.length}\n`)
const byDir = {}
for (const f of unwired) { const d = f.split('/').slice(0, -1).join('/'); (byDir[d] ??= []).push(f) }
for (const [d, fs] of Object.entries(byDir).sort((a,b)=>b[1].length-a[1].length)) {
  console.log(`  ${d}  (${fs.length})`)
  for (const f of fs) console.log(`      ${f.split('/').pop()}`)
}
if (!ok) process.exit(2)
