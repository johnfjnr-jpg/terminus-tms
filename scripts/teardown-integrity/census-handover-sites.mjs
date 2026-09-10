import { readFileSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
const { stripJs } = await import('/Users/johnfryatt/terminus-tms/scripts/lib/strip-comments.mjs')
const ROOT = '/Users/johnfryatt/terminus-tms'
const files = []
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name)
  if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue }
  if (/\.(mjs|js)$/.test(e.name)) files.push(p) } }
walk(path.join(ROOT, 'scripts'))
const rel = (f) => path.relative(ROOT, f)
const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'))
const suiteText = Object.entries(pkg.scripts).map(([, v]) => v).join(' ')
const gateText = stripJs(readFileSync(`${ROOT}/scripts/verify-all.mjs`, 'utf8'))

const hits = files.filter((f) => /update\(\s*\{[^}]*owner_id\s*:/.test(stripJs(readFileSync(f, 'utf8'))))
console.log(`raw owner_id update sites: ${hits.length}\n`)
console.log('verdict           tagged?  file')
console.log('-'.repeat(88))
let live = 0, hist = 0
for (const f of hits.sort()) {
  const r = rel(f), base = path.basename(f)
  const src = stripJs(readFileSync(f, 'utf8'))
  const inGate = gateText.includes(base)
  const inSuite = suiteText.includes(base)
  // Does the handed record come from a fixture helper (so it carries a tag the
  // teardown can find), or is it an ad-hoc record with no tag at all?
  // CORRECTED. A first pass looked for fixtures.mjs's helpers and reported
  // seven sites as untagged. Every one of them has its OWN local fixture
  // helper that writes a tag-prefixed name, so the scan was measuring which
  // helper a file imports rather than whether its records carry a tag.
  // Verification 19: the category name needed the same evidence as a finding.
  const tagged = /fresh(Opportunity|TestBed|Contact|Account)/.test(src)
    || /name:\s*`\$\{\s*TAG/.test(src)
  const roundDir = /scripts\/(round\d|convert-atomicity|write-auth|sibling-surfaces|create-from|ui-hygiene|testbed-header|record-creation)\//.test(r)
  const verdict = inGate ? 'LIVE gate stage' : inSuite ? 'LIVE in a suite'
    : r === 'scripts/fixtures.mjs' ? 'THE HELPER'
    : roundDir ? 'HISTORICAL' : 'unclassified'
  if (verdict.startsWith('LIVE')) live++; else if (verdict === 'HISTORICAL') hist++
  console.log(`${verdict.padEnd(17)} ${(tagged ? 'yes' : 'NO ').padEnd(8)} ${r}`)
}
console.log(`\nLIVE: ${live}   HISTORICAL (round-scoped): ${hist}   helper: 1`)
