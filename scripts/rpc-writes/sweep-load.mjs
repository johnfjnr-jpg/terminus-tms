// ── EVERY CONCURRENT LOAD A TEST FIRES, AND WHAT SCALE IT ASSUMES ────────
//
// THE FIRST VERSION OF THIS SWEEP UNDER-REPORTED. It resolved `const N` by
// the FIRST declaration in the file, so a file holding `N = 3` and `N = 25`
// reported both sites as 3 - and the 25 survived the round that was meant to
// find it. Caught by grepping `const N` directly rather than trusting the
// sweep's own output.
//
// So N is resolved from the NEAREST PRECEDING declaration, and the sweep
// prints the raw declaration count beside the site count so the two can be
// reconciled: if they disagree, the resolution is wrong again.
//
// THE SCALE, from DESIGN_PRINCIPLES: an internal tool for a small team, up
// to 5 people, low concurrency. Worst case is roughly 5 simultaneous
// operations and that is rare. A load of 3-6 is realistic with margin; 25
// and 40 were fiction.
import { readFileSync, readdirSync } from 'node:fs'
import { stripComments } from '../lib/strip-comments.mjs'

const REALISTIC_MAX = 5
const MARGIN = 2          // a safety factor over the worst case is legitimate
const CEILING = REALISTIC_MAX * MARGIN

const d = 'scripts/tests'
const files = readdirSync(d).filter((f) => f.endsWith('.test.mjs'))
let sites = 0, decls = 0
const over = []

for (const f of files) {
  const src = stripComments(readFileSync(`${d}/${f}`, 'utf8'), 'js')
  decls += [...src.matchAll(/const\s+N\s*=\s*\d+/g)].length
  for (const m of src.matchAll(/Promise\.all\s*\(\s*Array\.from\s*\(\s*\{\s*length:\s*([A-Za-z0-9_]+)/g)) {
    sites++
    let n = m[1]
    if (!/^\d+$/.test(n)) {
      // NEAREST PRECEDING declaration, not the first in the file.
      const before = src.slice(0, m.index)
      const all = [...before.matchAll(new RegExp(`const\\s+${n}\\s*=\\s*(\\d+)`, 'g'))]
      n = all.length ? Number(all[all.length - 1][1]) : null
    } else n = Number(n)
    const line = src.slice(0, m.index).split('\n').length
    const verdict = n === null ? 'UNRESOLVED' : n > CEILING ? 'OVER SCALE' : 'realistic'
    if (n === null || n > CEILING) over.push(`${f}:${line} = ${n}`)
    console.log(`  ${String(n ?? '?').padStart(4)} concurrent  ${verdict.padEnd(11)} ${f}:${line}`)
  }
}

console.log(`\n  Promise.all concurrency sites : ${sites}`)
console.log(`  'const N = <number>' declarations: ${decls}`)
console.log(`  scale ceiling used              : ${CEILING}  (${REALISTIC_MAX} users x ${MARGIN} margin)`)
console.log(over.length
  ? `\n  OVER SCALE OR UNRESOLVED:\n    ${over.join('\n    ')}`
  : `\n  Every concurrent load is within ${CEILING}. Nothing to lower.`)
