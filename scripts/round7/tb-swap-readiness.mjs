// ── IS THE TEST BED SWAP TAKEABLE? ──────────────────────────────────────
//
// Round 7 Phase 2, and it is the report behind the answer "no".
//
// It reads the capability map and the import walk from the same places the
// accounting test does, so this cannot disagree with the gate (Verification 20).
// What it adds is SIZE: how much of the vanilla each capability is, which is
// what says whether a gap is a session or a round.
import { readFileSync } from 'node:fs'
import { topLevelNames } from '../lib/top-level-names.mjs'
import { reactSources, reachedFrom, stateOf, capabilityMap } from '../lib/react-reach.mjs'

const CAPS = capabilityMap(readFileSync('scripts/tests/test-bed-accounting.test.mjs', 'utf8'))
if (Object.keys(CAPS).length !== 20) {
  console.error(`REFUSED: parsed ${Object.keys(CAPS).length} capabilities, expected 20`)
  process.exit(2)
}

const SRC = reactSources()
const reached = reachedFrom(SRC, 'testbed/TestBedHost.tsx')
if (!reached.has('testbed/TestBedPanel.tsx')) {
  console.error('REFUSED: the import walk did not reach the panel, so it did not run')
  process.exit(2)
}

const vanilla = readFileSync('frontend/test-bed-detail.js', 'utf8')
const total = vanilla.split('\n').length
const names = topLevelNames(vanilla).sort((a, b) => a.line - b.line)
const capOf = new Map()
for (const [c, v] of Object.entries(CAPS)) for (const n of v.names) capOf.set(n, c)

const lines = {}
for (let i = 0; i < names.length; i++) {
  const end = i + 1 < names.length ? names[i + 1].line - 1 : total
  const c = capOf.get(names[i].name) ?? '(unclaimed)'
  lines[c] = (lines[c] ?? 0) + (end - names[i].line + 1)
}

const buckets = { rendered: [], 'logic-only': [], absent: [] }
for (const [cap, v] of Object.entries(CAPS)) {
  buckets[stateOf(v.modules, SRC, reached)].push({ cap, n: lines[cap] ?? 0 })
}

console.log(`frontend/test-bed-detail.js: ${total} lines, ${names.length} top-level names\n`)
let lost = 0
for (const [state, rows] of Object.entries(buckets)) {
  rows.sort((a, b) => b.n - a.n)
  const sum = rows.reduce((t, r) => t + r.n, 0)
  if (state !== 'rendered') lost += sum
  console.log(`${state.toUpperCase()}  (${rows.length} capabilities, ${sum} vanilla lines)`)
  for (const r of rows) console.log(`    ${String(r.n).padStart(4)}  ${r.cap}`)
  console.log()
}
const takeable = buckets['logic-only'].length + buckets.absent.length === 0
console.log(takeable
  ? 'THE SWAP IS TAKEABLE: every capability renders.'
  : `THE SWAP IS NOT TAKEABLE: it would take ${lost} vanilla lines off a live screen.`)
