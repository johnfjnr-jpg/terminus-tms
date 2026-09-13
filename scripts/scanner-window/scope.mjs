// ── PHASE 0: HOW MANY CHAINS IS THE SCANNER ALREADY BLIND TO? ────────────
//
// The scanner matches `.from('x').select(` then up to 400 characters, then
// a lookahead for the next statement keyword. If no keyword lies within
// 400, the WHOLE chain fails to match and the select is silently not
// counted.
//
// So: find every chain START independently of the window, and measure the
// distance from it to the terminator the scanner requires. Anything past
// 400 is a select the guard cannot see TODAY.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { stripJs } from '../lib/strip-comments.mjs'
import { gateRunFiles } from '../lib/unbounded-selects.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const WINDOW = 400
// The chain START only - no window, no terminator. This is what the scanner
// is looking for before its window can lose it.
const START = /\.from\(\s*['"`]([\w.]+)['"`]\s*\)\s*\n?\s*\.select\(/g
const TERM = /\n\s*(?:const|let|var|if|for|return|await|\}|$)/
const BOUND = /\.range\(|\.limit\(|\.single\(|\.maybeSingle\(|head:\s*true/

const files = gateRunFiles()
const rows = []
for (const f of files) {
  const src = stripJs(readFileSync(f, 'utf8'))
  for (const m of src.matchAll(START)) {
    const after = src.slice(m.index + m[0].length)
    const t = TERM.exec(after)
    const dist = t ? m[0].length + t.index : Infinity
    const body = after.slice(0, t ? t.index : 400)
    rows.push({
      file: path.relative(ROOT, f), table: m[1], dist,
      bounded: BOUND.test(m[0] + body),
      visible: dist <= WINDOW,
    })
  }
}

const blind = rows.filter((r) => !r.visible)
const blindUnbounded = blind.filter((r) => !r.bounded)
const near = rows.filter((r) => r.visible && r.dist > WINDOW * 0.6)

console.log(`=== SCOPE, across ${files.length} gate-run files ===`)
console.log(`  chain starts found (window-independent) : ${rows.length}`)
console.log(`  the scanner can SEE (terminator <= ${WINDOW}) : ${rows.length - blind.length}`)
console.log(`  ** BLIND TODAY (terminator > ${WINDOW})      : ${blind.length} **`)
console.log(`     of those, genuinely UNBOUNDED           : ${blindUnbounded.length}`)
console.log(`  within 60-100% of the window (one comment away): ${near.length}\n`)

if (blind.length) {
  console.log('  THE BLIND ONES:')
  for (const r of blind.sort((a, b) => b.dist - a.dist))
    console.log(`    ${r.dist === Infinity ? '  no terminator' : String(r.dist).padStart(6) + ' chars'}  ${r.bounded ? 'bounded  ' : 'UNBOUNDED'}  ${r.file}::${r.table}`)
}
if (near.length) {
  console.log('\n  THE NEAR ONES (would blind on one more comment):')
  for (const r of near.sort((a, b) => b.dist - a.dist).slice(0, 12))
    console.log(`    ${String(r.dist).padStart(6)} chars  ${r.bounded ? 'bounded  ' : 'UNBOUNDED'}  ${r.file}::${r.table}`)
}
