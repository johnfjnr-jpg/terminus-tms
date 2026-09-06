// ── ROUND 5 PHASE 0, ITEMS 6, 7 and 9 ───────────────────────────────────
// Inbound references classified; coupled tests and probes classified by the
// Round 3 scheme; and the retirement preconditions enumerated.
//
// Verification 41's STRINGS clause: the surface's name is searched as a
// STRING across the whole repository, not only as an import or a path,
// because a claim living in a data structure has the failure mode of a
// comment and the authority of code.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const sh = (c) => { try { return execSync(c, { cwd: ROOT, encoding: 'utf8' }) } catch { return '' } }

// CALIBRATION: the search must find a known-present hit and miss a known-absent one.
const known = sh(`grep -rn "initOpportunityReferencePanel" frontend/ | head -3`)
if (!known.trim()) throw new Error('CALIBRATION FAILED: known-present string not found')
// THE ABSENT TOKEN IS BUILT AT RUNTIME, never written literally: this file
// lives under scripts/, which the search covers, so a literal would be found
// in this very line and the negative calibration would fail on itself.
// Verification 39 from the calibration side.
const ABSENT = ["zzz", "NoSuch", "Thing", "ZZZ"].join("")
if (sh(`grep -rn "${ABSENT}" frontend/ src/ scripts/`).trim()) {
  throw new Error("CALIBRATION FAILED: absent string found")
}
console.log('search calibrated\n')

// ── ITEM 6: INBOUND REFERENCES, CLASSIFIED ──────────────────────────────
const SURFACE = 'opportunity-reference'
const raw = sh(`grep -rn "${SURFACE}" --include="*.js" --include="*.mjs" --include="*.html" --include="*.css" --include="*.ts" --include="*.tsx" --include="*.json" frontend/ src/ scripts/ frontend-react/src/ package.json 2>/dev/null`)
// THIS ROUND'S OWN INVESTIGATION SCRIPTS ARE NOT INBOUND REFERENCES.
// They name the surface because they are measuring it, and counting them
// would inflate the very number this item exists to establish.
const lines = raw.split('\n').filter(Boolean).filter((l) => !l.startsWith('scripts/round5/'))
const bucket = { self: [], markup: [], appjs: [], otherModule: [], test: [], style: [], react: [] }
for (const l of lines) {
  const file = l.slice(0, l.indexOf(':'))
  if (file.endsWith(`frontend/${SURFACE}.js`)) bucket.self.push(l)
  else if (file.endsWith('index.html')) bucket.markup.push(l)
  else if (file.endsWith('frontend/app.js')) bucket.appjs.push(l)
  else if (file.endsWith('.css')) bucket.style.push(l)
  else if (file.startsWith('scripts/')) bucket.test.push(l)
  else if (file.startsWith('frontend-react/')) bucket.react.push(l)
  else bucket.otherModule.push(l)
}
console.log('── ITEM 6: INBOUND REFERENCES to "opportunity-reference" ───────')
let total = 0
for (const [k, v] of Object.entries(bucket)) { total += v.length; console.log(`  ${k.padEnd(14)} ${String(v.length).padStart(3)}`) }
console.log(`  ${'TOTAL'.padEnd(14)} ${String(total).padStart(3)}   (Round 0 counted 40)`)
for (const [k, v] of Object.entries(bucket)) {
  if (!v.length || k === 'self') continue
  console.log(`\n  ${k}:`)
  for (const l of v) console.log('    ' + l.slice(0, 130))
}

// ── ITEM 7: COUPLED TESTS AND PROBES, Round 3's scheme ──────────────────
console.log('\n── ITEM 7: COUPLED TESTS AND PROBES ────────────────────────────')
const testFiles = []
const walk = (d) => {
  for (const e of readdirSync(ROOT + d)) {
    const p = d + '/' + e
    if (statSync(ROOT + p).isDirectory()) walk(p)
    else if (/\.(mjs|ts|tsx)$/.test(e)) testFiles.push(p)
  }
}
walk('scripts'); walk('frontend-react/src')
const coupled = []
for (const f of testFiles) {
  if (f.startsWith('scripts/round5')) continue
  const code = readCode(new URL(f, 'file://' + ROOT))
  const rawTxt = readFileSync(ROOT + f, 'utf8')
  const inCode = code.includes('opportunity-reference')
  const inProse = !inCode && rawTxt.includes('opportunity-reference')
  if (!inCode && !inProse) continue
  // Round 3's scheme: behaviour (runs it), source-shape (reads the file),
  // stylesheet (asserts a CSS rule), prose (a claim only).
  let kind = 'prose-only'
  if (inCode) {
    if (/readCode|readFileSync/.test(code) && /opportunity-reference/.test(code)) kind = 'source-shape'
    if (/style\.css|stylesheet/.test(code)) kind = 'stylesheet'
    if (/puppeteer|page\.|goto\(/.test(code)) kind = 'behaviour'
  }
  coupled.push({ f, kind, inCode })
}
for (const c of coupled) console.log(`  ${c.kind.padEnd(14)} ${c.inCode ? 'CODE ' : 'prose'} ${c.f}`)
console.log(`  ${coupled.length} coupled files`)

// ── ITEM 9: RETIREMENT PRECONDITIONS ────────────────────────────────────
console.log('\n── ITEM 9: RETIREMENT PRECONDITIONS ────────────────────────────')
// opportunity-deal-versions.js retired at the Round 5 close and is off this
// list. deal-feedback.js is imported only by opportunity-deal.js now, so it
// retires with it.
for (const target of ['opportunity-deal.js', 'deal-feedback.js']) {
  const name = target.replace('.js', '')
  const hits = sh(`grep -rn "${target}" --include="*.js" --include="*.mjs" --include="*.html" --include="*.css" --include="*.ts" --include="*.tsx" --include="*.json" frontend/ src/ scripts/ frontend-react/src/ package.json 2>/dev/null`)
    .split('\n').filter(Boolean).filter((l) => !l.startsWith(`frontend/${target}:`))
  const codeHits = []
  for (const l of hits) {
    const file = l.slice(0, l.indexOf(':'))
    if (file.endsWith('.html') || file.endsWith('.css')) continue
    try {
      const c = readCode(new URL(file, 'file://' + ROOT))
      if (c.includes(target)) codeHits.push(l)
    } catch { /* unreadable */ }
  }
  const liveHtml = readFileSync(ROOT + 'frontend/index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  console.log(`\n  ${target}`)
  console.log(`    loaded by live markup : ${liveHtml.includes(target)}`)
  console.log(`    mentions in repo      : ${hits.length}`)
  console.log(`    mentions in CODE      : ${codeHits.length}${codeHits.length ? ' <- these must be retired with it' : ''}`)
  const byFile = {}
  for (const l of codeHits) {
    const f = l.slice(0, l.indexOf(":"))
    byFile[f] = (byFile[f] ?? 0) + 1
  }
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(3)}x  ${f}`)
  }
}
const parity = 'frontend-react/src/__tests__/deal-payload-parity.test.ts'
console.log(`\n  the parity suite: ${parity}`)
console.log(`    exists: ${(() => { try { statSync(ROOT + parity); return true } catch { return false } })()}`)
