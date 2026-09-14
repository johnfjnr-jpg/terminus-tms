// P2 extended to the shape the family takes in a REACT test. `hidden` is one
// spelling. In jsdom the commoner one is PRESENCE standing in for VISIBILITY:
// V4's own sentence is "presence is not legibility, and no assertion can tell
// them apart".
import { readFileSync } from 'node:fs'
import { stripComments } from '../lib/strip-comments.mjs'

const FILES = [
  'contact-blocking.test.ts', 'contact-capabilities.test.tsx',
  'contact-link-account.test.tsx', 'contact-surface.test.tsx', 'contact-view.test.tsx',
]
const PRESENCE = [/toBeInTheDocument\(/, /toBeTruthy\(/, /toBeNull\(/, /queryBy\w+\(/, /getBy\w+\(/]
const VISIBLE  = [/toBeVisible\(/, /toBeDisabled\(/, /getComputedStyle/, /\.hidden\b/, /offsetParent/]

console.log('file'.padEnd(34) + 'presence'.padStart(9) + 'visible'.padStart(9))
let tot = { p: 0, v: 0 }
for (const b of FILES) {
  const f = `frontend-react/src/__tests__/${b}`
  const c = stripComments(readFileSync(f, 'utf8'), 'js')
  const p = PRESENCE.reduce((n, r) => n + (c.match(new RegExp(r, 'g')) || []).length, 0)
  const v = VISIBLE.reduce((n, r) => n + (c.match(new RegExp(r, 'g')) || []).length, 0)
  tot.p += p; tot.v += v
  console.log(b.padEnd(34) + String(p).padStart(9) + String(v).padStart(9))
}
console.log('TOTAL'.padEnd(34) + String(tot.p).padStart(9) + String(tot.v).padStart(9))

console.log('\n=== WHAT jsdom CAN AND CANNOT ANSWER ===')
console.log('  jsdom performs NO LAYOUT. getComputedStyle returns declared values only,')
console.log('  offsetParent/getBoundingClientRect are stubs, and jest-dom toBeVisible()')
console.log('  reads the `hidden` attribute and INLINE style - not a stylesheet rule.')
console.log('  So V4\'s remedy (assert the COMPUTED property) is only PARTLY available')
console.log('  in this population. A stylesheet cascade defeating `hidden` - the exact')
console.log('  defect the family shipped - IS NOT DETECTABLE IN jsdom AT ALL.')
