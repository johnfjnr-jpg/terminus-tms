import { readFileSync, readdirSync } from 'fs'
import path from 'path'
const { stripJs } = await import('/Users/johnfryatt/terminus-tms/scripts/lib/strip-comments.mjs')
const ROOT = '/Users/johnfryatt/terminus-tms'
// Exact counts, taken live in the previous step and pasted as DATA, not as a
// claim about size: any table here can cross the cap later.
const OVER = new Set(['records','record_revisions','approvals','audit_log','transition_requests',
  'deal_sheet_versions','record_contacts','opportunity_details','reference_number_counters'])
const files = []
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name!=='node_modules') walk(p); continue }
  if (/\.(mjs|js)$/.test(e.name)) files.push(p) } }
walk(path.join(ROOT,'scripts'))
const rel = (f) => path.relative(ROOT, f)
const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`,'utf8'))
const gate = stripJs(readFileSync(`${ROOT}/scripts/verify-all.mjs`,'utf8'))
const suiteText = Object.entries(pkg.scripts).map(([,v])=>v).join(' ')
const isLive = (r) => gate.includes(path.basename(r)) || suiteText.includes(path.basename(r))
const CHAIN = /\.from\(\s*['"`]([\w.]+)['"`]\s*\)\s*\n?\s*\.select\(([\s\S]{0,400}?)(?=\n\s*(?:const|let|var|if|for|return|await|\}|$))/g
const BOUND = /\.range\(|\.limit\(|\.single\(|\.maybeSingle\(|head:\s*true/
const FILTER = /\.eq\(|\.in\(|\.is\(|\.ilike\(|\.or\(|\.gte\(|\.lte\(|\.gt\(|\.lt\(|\.not\(/
let liveOver = 0, liveOverNoFilter = 0, liveSmall = 0
const detail = []
for (const f of files) {
  const r = rel(f); if (!isLive(r)) continue
  const src = stripJs(readFileSync(f,'utf8'))
  for (const m of src.matchAll(CHAIN)) {
    if (BOUND.test(m[0])) continue
    const t = m[1], filtered = FILTER.test(m[0])
    if (!OVER.has(t)) { liveSmall++; continue }
    liveOver++; if (!filtered) { liveOverNoFilter++; detail.push([r, t]) }
  }
}
console.log(`LIVE unbounded selects on an OVER-CAP table:        ${liveOver}`)
console.log(`  of those with NO filter at all (whole table):     ${liveOverNoFilter}`)
console.log(`LIVE unbounded selects on a table under the cap:    ${liveSmall}`)
console.log(`\nthe unfiltered ones, which read a whole large table:`)
for (const [r,t] of detail) console.log(`   ${t.padEnd(22)} ${r}`)
if (!detail.length) console.log('   none')
