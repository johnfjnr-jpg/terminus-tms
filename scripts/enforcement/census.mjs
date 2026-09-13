// ── PHASE 0: WHICH CONTROLS ARE ENFORCED, AND WHICH ARE REMEMBERED? ──────
//
// A CONTROL is something the process trusts to catch a fault. ENFORCED means
// something FORCES its use - a gate stage, a suite, a hook. REMEMBERED means
// it works and runs only when somebody thinks of it.
//
// Scoped to what is mechanically decidable (R3). Three populations, each
// with an unambiguous membership test:
//
//   A. `scripts/tests/*.test.mjs`  - a test file either IS or IS NOT named
//      by a package.json test script. No judgement.
//   B. `scripts/check-*.mjs`       - the naming convention the estate uses
//      for a standing check.
//   C. `scripts/lib/*.mjs` guards  - a guard module is enforced only if some
//      wired test imports it.
//
// What is OUT of scope and said so: whether a DOCUMENT is maintained.
// `INTERACTION_STANDARDS.md` is instance 1 of the pattern and nothing here
// can see it - the staleness test watches identifiers, not upkeep.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const verifyAll = readFileSync(join(ROOT, 'scripts/verify-all.mjs'), 'utf8')
const hook = existsSync(join(ROOT, '.githooks/pre-commit'))
  ? readFileSync(join(ROOT, '.githooks/pre-commit'), 'utf8') : ''
const preCommit = existsSync(join(ROOT, 'scripts/pre-commit-suites.mjs'))
  ? readFileSync(join(ROOT, 'scripts/pre-commit-suites.mjs'), 'utf8') : ''

const suiteText = Object.values(pkg.scripts ?? {}).join(' ')
const runnerText = [suiteText, verifyAll, hook, preCommit].join('\n')
const enforcedBy = (base) => {
  const where = []
  if (suiteText.includes(base)) where.push('package.json')
  if (verifyAll.includes(base)) where.push('verify-all')
  if (hook.includes(base) || preCommit.includes(base)) where.push('pre-commit')
  return where
}

const ls = (d) => { try { return readdirSync(join(ROOT, d)) } catch { return [] } }

console.log('=== A. TEST FILES: is each one named by a suite? ===')
const tests = ls('scripts/tests').filter((f) => f.endsWith('.test.mjs'))
const unrunTests = tests.filter((f) => enforcedBy(f).length === 0)
console.log(`  scripts/tests/*.test.mjs : ${tests.length}`)
console.log(`  ENFORCED (named by a suite): ${tests.length - unrunTests.length}`)
console.log(`  ** REMEMBERED / UNRUN     : ${unrunTests.length} **`)
for (const t of unrunTests) console.log(`      ${t}`)

console.log('\n=== B. STANDING CHECKS by naming convention ===')
const checks = ls('scripts').filter((f) => /^(check|verify|guard)-.*\.(mjs|js)$/.test(f))
for (const c of checks) {
  const w = enforcedBy(c)
  console.log(`  ${w.length ? 'ENFORCED  ' : '** REMEMBERED **'}  scripts/${c}${w.length ? `   (${w.join(', ')})` : ''}`)
}

console.log('\n=== C. GUARD MODULES: is each imported by something WIRED? ===')
const libs = ls('scripts/lib').filter((f) => f.endsWith('.mjs'))
const wiredFiles = []
const walk = (d) => { for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
  const p = `${d}/${e.name}`
  if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue }
  if (/\.(mjs|js)$/.test(e.name) && enforcedBy(e.name).length) wiredFiles.push(p) } }
walk('scripts')
const wiredSrc = wiredFiles.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n')
for (const l of libs) {
  const imported = wiredSrc.includes(l)
  console.log(`  ${imported ? 'ENFORCED  ' : '** REMEMBERED **'}  scripts/lib/${l}`)
}

console.log('\n=== OUT OF SCOPE, said rather than omitted ===')
console.log('  Whether a DOCUMENT is maintained. INTERACTION_STANDARDS.md is')
console.log('  instance 1 of this pattern and nothing mechanical can see it:')
console.log('  the staleness test watches identifiers, not upkeep.')
console.log('  Whether edits ROUTE through edit.mjs - measured separately, since')
console.log('  the question is noise, not existence.')
