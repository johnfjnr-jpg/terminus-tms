// PHASE 0 ITEM 1. The instrument is recorded with the count, per the Round 2
// close-out rule: readCode (comments stripped), the repository walked, every
// hit classified by WHAT it reads the name as.
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { readCode } from '/Users/johnfryatt/terminus-tms/scripts/lib/strip-comments.mjs'
const R = '/Users/johnfryatt/terminus-tms/'
const TARGET = 'opportunity-deal-versions.js'
const files = []
const walk = (d) => { for (const f of readdirSync(R + d)) {
  if (['node_modules', '.git', 'dist', '.verify'].includes(f) || f.startsWith('.')) continue
  const p = d + '/' + f
  if (statSync(R + p).isDirectory()) walk(p)
  else if (/\.(ts|tsx|js|mjs|html|md)$/.test(f)) files.push(p) } }
for (const d of ['frontend', 'frontend-react/src', 'scripts', 'src']) walk(d)

const rows = []
for (const f of files) {
  if (f.endsWith(TARGET)) continue
  const raw = readFileSync(R + f, 'utf8')
  if (!raw.includes(TARGET)) continue
  let live = raw
  try { live = readCode(new URL(f, 'file://' + R)) } catch { /* md has no kind */ }
  const inCode = live.includes(TARGET)
  const kind = f.endsWith('.md') ? 'documentation'
    : f.endsWith('.html') ? 'markup (script tag)'
    : !inCode ? 'comment only'
    : f.includes('/tests/') ? 'test: reads the file'
    : f.includes('scripts/') ? 'probe or script'
    : 'source'
  // For test files, name the blocks so the ledger is per-claim.
  let blocks = []
  if (kind.startsWith('test')) {
    blocks = live.split(/\ntest\(/).slice(1).filter((b) => b.includes(TARGET))
      .map((b) => (b.match(/^'([^']+)'/) || b.match(/^"([^"]+)"/) || [])[1] ?? '<unnamed>')
  }
  rows.push({ f, kind, hits: (raw.match(new RegExp(TARGET, 'g')) || []).length, blocks })
}
const by = {}
for (const r of rows) (by[r.kind] ??= []).push(r)
console.log(`FILES MENTIONING ${TARGET}: ${rows.length}\n`)
for (const k of Object.keys(by).sort()) {
  console.log(`== ${k}  (${by[k].length} files, ${by[k].reduce((a, r) => a + r.hits, 0)} mentions)`)
  for (const r of by[k]) {
    console.log(`   ${r.f}  x${r.hits}`)
    for (const b of r.blocks) console.log(`      block: ${b}`)
  }
  console.log()
}
