// ── R2's CENSUS: EVERY PLACE A TIMESTAMP REACHES A PERSON ────────────────
//
// R2's anti-rework requirement turns on ONE question: is there one formatter
// or many? A grep for `formatDate` answers a question about NAMES. This asks
// a question about STRUCTURE, because Verification 19 records that a name
// used as an enumeration fails by silent omission, and the whole point of R2
// is the instance nobody listed.
//
// TWO PASSES, because either alone is blind:
//   (a) DECLARATIONS - every function that turns a date into display text.
//   (b) RENDER SITES  - every timestamp-valued read that reaches output,
//       whether or not a formatter is anywhere near it. This is the pass
//       that finds a RAW render, which is the defect R2 names.
//
// Comment-stripped per Verification 39, and calibrated in both directions at
// the end: a known-present raw render must be FOUND, and a comment naming one
// must NOT satisfy the scan.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { stripJs, stripHtml } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const SCAN = ['frontend', 'frontend-react/src', 'src']
const SKIP = /node_modules|__tests__|\.test\.|dist|coverage/

const files = []
const walk = (d) => {
  for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
    const rel = join(d, e.name)
    if (SKIP.test(rel)) continue
    if (e.isDirectory()) walk(rel)
    else if (/\.(js|mjs|ts|tsx|html)$/.test(e.name)) files.push(rel)
  }
}
SCAN.forEach(walk)

const strip = (src, f) => (extname(f) === '.html' ? stripHtml(src) : stripJs(src))

// ── (a) DECLARATIONS ────────────────────────────────────────────────────
// A formatter is any site converting a date-ish value into display text.
// Enumerated by the CONVERSION, not by the name: toLocaleDate/Time/String on
// a Date, a slice of an ISO string, or an Intl.DateTimeFormat.
const DECL = [
  [/toLocaleDateString\s*\(/, 'toLocaleDateString'],
  [/toLocaleTimeString\s*\(/, 'toLocaleTimeString'],
  [/new\s+Intl\.DateTimeFormat/, 'Intl.DateTimeFormat'],
  [/\.slice\(\s*0\s*,\s*10\s*\)/, 'ISO slice(0,10)'],
  [/\.slice\(\s*0\s*,\s*16\s*\)/, 'ISO slice(0,16)'],
  [/\.split\(\s*['"]T['"]\s*\)/, "split('T')"],
  [/\.replace\(\s*['"]T['"]/, "replace('T')"],
]

// ── (b) RENDER SITES ────────────────────────────────────────────────────
// A timestamp-valued identifier: the estate's own naming, measured rather
// than assumed - `*_at`, `*At`, `*Date`, `as_of`, `timestamp`, and the bare
// `at` the notes model uses.
const TS = String.raw`(?:[A-Za-z_$][\w$]*_at|[a-z][\w$]*At|[a-z][\w$]*Date|as_of|timestamp|\bat)\b`
// Reaching a person: JSX interpolation, a template literal, or an assignment
// to textContent/innerHTML.
const SITE = [
  [new RegExp(String.raw`\{[^{}]*\.${TS}[^{}]*\}`), 'JSX / template interpolation'],
  [new RegExp(String.raw`\$\{[^{}]*\.${TS}[^{}]*\}`), 'template literal'],
  [new RegExp(String.raw`(?:textContent|innerHTML)\s*=[^\n]*\.${TS}`), 'DOM write'],
]

const decls = []
const sites = []
for (const f of files) {
  const src = strip(readFileSync(join(ROOT, f), 'utf8'), f)
  src.split('\n').forEach((line, i) => {
    for (const [re, kind] of DECL) if (re.test(line)) decls.push({ f, n: i + 1, kind, line: line.trim() })
    for (const [re, kind] of SITE) if (re.test(line)) { sites.push({ f, n: i + 1, kind, line: line.trim() }); break }
  })
}

// ── CALIBRATION, BOTH DIRECTIONS ────────────────────────────────────────
const found = (list, file, needle) => list.some((x) => x.f.endsWith(file) && x.line.includes(needle))
const KNOWN_RAW = found(sites, 'NotesHistory.tsx', 'n.at')
const KNOWN_FMT = found(decls, 'app.js', 'toLocaleDateString')
// A comment naming a render site must NOT satisfy the scan.
const probe = stripJs('// <span>{n.at}</span> is a raw render\nconst x = 1\n')
const PROSE_EXCLUDED = !/\{[^{}]*\.at[^{}]*\}/.test(probe)

const out = { decls, sites, calibration: { KNOWN_RAW, KNOWN_FMT, PROSE_EXCLUDED }, filesScanned: files.length }
writeFileSync(join(ROOT, 'scripts/lead-card-ui/census-timestamps.json'), JSON.stringify(out, null, 2))

console.log(`files scanned: ${files.length}`)
console.log(`CALIBRATION  known raw render found: ${KNOWN_RAW}  known formatter found: ${KNOWN_FMT}  prose excluded: ${PROSE_EXCLUDED}`)
if (!KNOWN_RAW || !KNOWN_FMT || !PROSE_EXCLUDED) { console.log('\nCALIBRATION FAILED - the census is not evidence'); process.exit(1) }
console.log(`\n=== (a) DATE-TO-DISPLAY CONVERSIONS: ${decls.length} ===`)
for (const d of decls) console.log(`  ${d.f}:${d.n}  [${d.kind}]  ${d.line.slice(0, 96)}`)
console.log(`\n=== (b) TIMESTAMP RENDER SITES: ${sites.length} ===`)
for (const s of sites) console.log(`  ${s.f}:${s.n}  [${s.kind}]  ${s.line.slice(0, 96)}`)
