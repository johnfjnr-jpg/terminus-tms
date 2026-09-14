// P2: the attribute-vs-visibility family, measured against THIS round's
// population. V4's clause: an attribute assertion is not a visibility
// assertion. `display:flex` on an element hidden by the `hidden` ATTRIBUTE
// overrides the UA's `[hidden]{display:none}` and the element renders, while
// every test reading the attribute passes.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments, kindOf } from '../lib/strip-comments.mjs'

const SELF = 'p2-visibility.mjs'
const walk = (d, o = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|dist/.test(p)) walk(p, o) }
    else if (/\.(tsx?|mjs)$/.test(e.name) && !e.name.endsWith(SELF)) o.push(p)
  }
  return o
}
// The ATTRIBUTE reads - what the family does wrong.
const ATTR = [
  /hasAttribute\(\s*['"]hidden['"]\s*\)/,
  /toHaveAttribute\(\s*['"]hidden['"]/,
  /getAttribute\(\s*['"]hidden['"]\s*\)/,
  /\.hidden\s*===/, /\.hidden\s*\)/, /\.hidden\b(?!\s*=[^=])/,
  /\[hidden\]/,
]
// The COMPUTED reads - what the family should do instead.
const COMPUTED = [
  /getComputedStyle/, /toBeVisible\(/, /offsetParent/,
  /getBoundingClientRect/, /checkVisibility\(/,
]

const files = [...walk('frontend-react/src'), ...walk('scripts')]
const rows = []
for (const f of files) {
  const code = f.endsWith('.json') ? readFileSync(f, 'utf8') : stripComments(readFileSync(f, 'utf8'), kindOf(f))
  const a = ATTR.reduce((n, r) => n + (code.match(new RegExp(r, 'g')) || []).length, 0)
  const c = COMPUTED.reduce((n, r) => n + (code.match(new RegExp(r, 'g')) || []).length, 0)
  if (a > 0) rows.push({ f, a, c })
}
rows.sort((x, y) => y.a - x.a)
console.log('FILES ASSERTING THE `hidden` ATTRIBUTE')
console.log('attr'.padStart(5) + 'computed'.padStart(10) + '  file')
for (const r of rows) console.log(String(r.a).padStart(5) + String(r.c).padStart(10) + (r.c === 0 ? '  BLIND  ' : '  mixed  ') + r.f)
console.log(`\ntotal files: ${rows.length}   blind (no computed read at all): ${rows.filter(r => r.c === 0).length}`)

const contact = rows.filter((r) => /contact/i.test(r.f))
console.log(`\nOF THOSE, IN THIS ROUND'S POPULATION (contact*): ${contact.length}`)
for (const r of contact) console.log(`  ${r.f}  attr=${r.a} computed=${r.c}`)

// CALIBRATION, both ways.
console.log('\n=== CALIBRATION ===')
const bad = `expect(el.hasAttribute('hidden')).toBe(true)`
const good = `expect(getComputedStyle(el).display).toBe('none')`
const hitBad = ATTR.some((r) => r.test(bad))
const hitGood = ATTR.some((r) => r.test(good))
console.log(`  an ATTRIBUTE assertion is flagged : ${hitBad ? 'PASS' : 'FAIL'}`)
console.log(`  a COMPUTED assertion is not      : ${!hitGood ? 'PASS' : 'FAIL'}`)
console.log(`  self excluded by name            : ${files.some(f => f.endsWith(SELF)) ? 'FAIL' : 'PASS'}`)
