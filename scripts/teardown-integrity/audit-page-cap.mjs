// Phase 0 item 2: every select that can be truncated by the page cap.
//
// A select is BOUNDED if its chain carries .range(, .limit(, .single(,
// .maybeSingle(, or head:true (a count returns no rows). Anything else takes
// PostgREST's first 1,000 and says nothing about it.
//
// Comments stripped first, per Verification 39: this estate writes a great deal
// of prose ABOUT queries, and a scan reading raw would match the documentation
// of the very bug it is hunting.
import { readFileSync, readdirSync } from 'fs'
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
const gate = stripJs(readFileSync(`${ROOT}/scripts/verify-all.mjs`, 'utf8'))
const suiteText = Object.entries(pkg.scripts).map(([, v]) => v).join(' ')

// A chain runs from `.from(` to the end of the statement. Statements here end
// at a newline that is not a continuation, which is good enough because this
// codebase writes one query per statement.
const CHAIN = /\.from\(\s*['"`]([\w.]+)['"`]\s*\)\s*\n?\s*\.select\(([\s\S]{0,400}?)(?=\n\s*(?:const|let|var|if|for|return|await|\}|$))/g
const BOUND = /\.range\(|\.limit\(|\.single\(|\.maybeSingle\(|head:\s*true/

const byFile = new Map()
let total = 0, unbounded = 0
for (const f of files) {
  const src = stripJs(readFileSync(f, 'utf8'))
  for (const m of src.matchAll(CHAIN)) {
    total++
    const chain = m[0]
    if (BOUND.test(chain)) continue
    unbounded++
    const r = rel(f)
    if (!byFile.has(r)) byFile.set(r, [])
    byFile.get(r).push(m[1])
  }
}
const isLive = (r) => gate.includes(path.basename(r)) || suiteText.includes(path.basename(r))
const rows = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
console.log(`select chains found:      ${total}`)
console.log(`of those UNBOUNDED:       ${unbounded}`)
console.log(`files carrying them:      ${byFile.size}\n`)
let liveN = 0, liveFiles = 0
console.log('runner   n   file (tables)')
console.log('-'.repeat(84))
for (const [r, tables] of rows) {
  const live = isLive(r)
  if (live) { liveFiles++; liveN += tables.length }
  console.log(`${(live ? 'LIVE' : '  - ').padEnd(8)} ${String(tables.length).padStart(2)}  ${r}  (${[...new Set(tables)].join(', ').slice(0, 44)})`)
}
console.log(`\nIN CODE THE GATE RUNS: ${liveN} unbounded selects across ${liveFiles} files`)
console.log(`IN HISTORICAL SCRIPTS: ${unbounded - liveN} across ${byFile.size - liveFiles} files`)
