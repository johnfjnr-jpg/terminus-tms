// The re-pointing plan, per test file, classified by STRUCTURE - what it
// imports - rather than by name (V19: an exception enumerated by name fails
// on the unrecorded instance). Counts are emitted by this run, never typed
// (V20).
import { readFileSync } from 'node:fs'
import { stripComments } from '../lib/strip-comments.mjs'

// What retires (R5): ContactHost and ContactPanel. Everything else is a
// disposition question answered below, not an assumption.
const RETIRING = ['contact/ContactHost', 'contact/ContactPanel']

const FILES = [
  'contact-blocking.test.ts', 'contact-capabilities.test.tsx',
  'contact-link-account.test.tsx', 'contact-surface.test.tsx', 'contact-view.test.tsx',
]
let total = 0
const rows = []
for (const b of FILES) {
  const p = `frontend-react/src/__tests__/${b}`
  const code = stripComments(readFileSync(p, 'utf8'), 'js')
  const cases = (code.match(/^\s*(it|test)\(/gm) || []).length
  total += cases
  const imports = [...code.matchAll(/from '\.\.\/([^']+)'/g)].map((m) => m[1])
  const touchesRetiring = imports.filter((i) => RETIRING.some((r) => i.startsWith(r)))
  rows.push({ b, cases, imports, touchesRetiring })
}
console.log('file'.padEnd(34) + 'cases'.padStart(6) + '  imports a RETIRING module')
for (const r of rows) {
  console.log(r.b.padEnd(34) + String(r.cases).padStart(6) +
    (r.touchesRetiring.length ? `  YES  ${r.touchesRetiring.join(', ')}` : '  no'))
}
const mustRepoint = rows.filter((r) => r.touchesRetiring.length)
console.log(`\nTOTAL CASES: ${total}`)
console.log(`  MUST RE-POINT (import a retiring module): ${mustRepoint.reduce((n, r) => n + r.cases, 0)} cases in ${mustRepoint.length} files`)
console.log(`  disposition needed (do not import one)  : ${total - mustRepoint.reduce((n, r) => n + r.cases, 0)} cases in ${rows.length - mustRepoint.length} files`)

console.log('\n=== THE BRIEF SAYS 15. MEASURED: ===')
console.log(`  test CASES across the five contact files : ${total}`)
console.log(`  cases importing a retiring module        : ${mustRepoint.reduce((n, r) => n + r.cases, 0)}`)
console.log(`  contact-blocking.test.ts alone           : ${rows.find(r => r.b.startsWith('contact-blocking')).cases}  <- the only 15 in the population`)

// CALIBRATION: the classifier must move when the input moves.
console.log('\n=== CALIBRATION ===')
const fake = `import { X } from '../contact/ContactHost'\ntest('a', () => {})`
const fi = [...stripComments(fake, 'js').matchAll(/from '\.\.\/([^']+)'/g)].map((m) => m[1])
console.log(`  a file importing ContactHost is flagged   : ${fi.some(i => RETIRING.some(r => i.startsWith(r))) ? 'PASS' : 'FAIL'}`)
const fake2 = `import { X } from '../contact/notes'\ntest('a', () => {})`
const fi2 = [...stripComments(fake2, 'js').matchAll(/from '\.\.\/([^']+)'/g)].map((m) => m[1])
console.log(`  a file importing contact/notes is NOT     : ${!fi2.some(i => RETIRING.some(r => i.startsWith(r))) ? 'PASS' : 'FAIL'}`)
const commented = `// import { X } from '../contact/ContactHost'\ntest('a', () => {})`
const ci = [...stripComments(commented, 'js').matchAll(/from '\.\.\/([^']+)'/g)].map((m) => m[1])
console.log(`  a COMMENTED import does not satisfy it   : ${ci.length === 0 ? 'PASS' : 'FAIL'}`)
