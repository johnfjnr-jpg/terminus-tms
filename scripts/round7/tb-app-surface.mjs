// What does app.js do for the Test Bed VIEW?
//
// The accounting instrument's scope is test-bed-detail.js's 136 names. The tab
// strip, the stage-panel loader and the panel-state helpers live in app.js, and
// Phase 2b built React counterparts for all of them. Before the swap, measure
// what app.js still owns.
import { readFileSync } from 'node:fs'
import { topLevelNames } from '../lib/top-level-names.mjs'

const src = readFileSync('frontend/app.js', 'utf8')
const lines = src.split('\n')
const names = topLevelNames(src).sort((a, b) => a.line - b.line)

// A name is Test-Bed-view code if its body mentions the view, its ids, or the
// record type. Measured, not guessed.
const MARKERS = /\btb[A-Z]|view-test-bed-detail|test-bed-detail|TestBed|test_bed|currentTestBed|#tb-|'tb-|"tb-/
const rows = []
for (let i = 0; i < names.length; i++) {
  const start = names[i].line
  const end = i + 1 < names.length ? names[i + 1].line - 1 : lines.length
  const body = lines.slice(start - 1, end).join('\n')
  if (MARKERS.test(names[i].name) || MARKERS.test(body)) {
    rows.push({ name: names[i].name, form: names[i].form, n: end - start + 1, line: start })
  }
}
rows.sort((a, b) => b.n - a.n)
const total = rows.reduce((t, r) => t + r.n, 0)
console.log(`frontend/app.js: ${lines.length} lines, ${names.length} top-level names`)
console.log(`Test-Bed-view code: ${rows.length} names, ${total} lines\n`)
for (const r of rows) console.log(`  ${String(r.n).padStart(4)}  ${r.name}  (${r.form}, :${r.line})`)
