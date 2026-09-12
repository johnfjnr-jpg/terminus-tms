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
// ── THE NAME VOCABULARY, AND ITS KNOWN LIMIT ────────────────────────────
//
// This is the one part of the census enumerated BY NAME, and Verification 19
// says a name used as an enumeration fails by silent omission. It did: the
// first version had no `asOf`, and `ApprovalBlocks.tsx` renders `{c.asOf}`
// raw. That site was found by a GREP run to check a false positive, not by
// this scan, and it is recorded in the Phase 1 report as such.
//
// Broadened here with every date-ish spelling the estate actually uses,
// measured from the schema and the payload keys rather than guessed. THE
// LIMIT STANDS AND IS STATED: a timestamp field named something this list
// does not contain is invisible to the census, and the defence against that
// is the module - a field routed through it cannot render raw whatever it is
// called, which is why R7 is a module and not a sweep.
const TS = String.raw`(?:[A-Za-z_$][\w$]*_at|[a-z][\w$]*At|[a-z][\w$]*Date|[a-z][\w$]*From`
  + String.raw`|as_of|asOf|effective_from|effectiveFrom|timestamp|\bat|\bwhen|\bsince|\buntil)\b`
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

// ── CALIBRATION, ON A SYNTHETIC POSITIVE ────────────────────────────────
//
// THE FIRST VERSION OF THIS ANCHORED ON REAL DEFECTS AND WAS KILLED BY THE
// FIX. It required NotesHistory's `{n.at}` and app.js's `toLocaleDateString`
// to be found; Phase 1 removed both, so the census refused to report on the
// very tree that proves it. Verification 9's clause exactly: a calibration
// anchored on the defect it watches stops being calibrated the day that
// defect is fixed - and it is recorded here rather than quietly re-pointed,
// because the failure is the evidence the rule is right.
//
// The anchors are now SYNTHETIC and cannot rot: the scan is run over text
// this file constructs, so the positives exist whatever the estate does.
// The strings are ASSEMBLED rather than written as literals, so this file
// cannot satisfy its own scan - Verification 39's Round 8 remedy, because an
// exemption list rots and an absent string cannot.
const AT = ['.', 'a', 't'].join('')
const SYNTH_RAW = `<span>{n${AT}}</span>`
const SYNTH_FMT = `const f = (d) => d.toLocale${'Date'}String('en-GB')`
const scanLine = (line, table) => table.some(([re]) => re.test(line))
const KNOWN_RAW = scanLine(SYNTH_RAW, SITE)
const KNOWN_FMT = scanLine(SYNTH_FMT, DECL)
// A comment naming a render site must NOT satisfy the scan.
const probe = stripJs(`// ${SYNTH_RAW} is a raw render\nconst x = 1\n`)
const PROSE_EXCLUDED = !scanLine(probe, SITE)
// And the stripper must not eat real code, which is the half that gets skipped.
const STRIPPER_KEEPS_CODE = stripJs(`const u = 'https://x'\n${SYNTH_RAW}\n`).includes(AT)

// ── R7's PROOF: EVERY DISPLAY SITE IS ROUTED, AND NONE IS RAW ───────────
//
// THE FIRST CLASSIFIER WAS WRONG AND REPORTED NINE FALSE POSITIVES. It read
// only the FIRST interpolation on a line, so `${state}${d?.decided_at ?
// formatDate(...)}` was judged on `${state}`; and it counted things that
// never reach a person - a React `key=`, and a server route's JSON body.
// Recorded rather than quietly replaced: an instrument whose output needs a
// person to explain away nine rows is not evidence, it is a list.
//
// THE CORRECTED RULE, and each clause is a measurement rather than a name:
//   - EVERY interpolation on the line is examined, not the first.
//   - A `key=` prop is not a render. React never paints it.
//   - A server route's JSON is not a render. Population is the two frontends
//     plus approval-page.js, which builds HTML server-side.
//   - An interpolation carrying a timestamp read and NO CALL is raw.
const DISPLAY = (f) => f.startsWith('frontend') || f.endsWith('approval-page.js')
const TS_READ = new RegExp(String.raw`\.${TS}`)
const interpolations = (line) => [...line.matchAll(/\$\{([^{}]*)\}/g)].map((m) => m[1])
  .concat([...line.matchAll(/(?<![$])\{([^{}]*)\}/g)].map((m) => m[1]))
const rawParts = (line) => {
  const stripped = line.replace(/key=\{[^{}]*\{?[^{}]*\}?[^{}]*\}/g, '')
  return interpolations(stripped)
    // An OBJECT LITERAL is not a render. `{ rates, missing, asOf: x.as_of }`
    // is a value being assembled, and the brace that holds it is not JSX.
    // Detected by the property colon rather than by the file it is in.
    .filter((e) => !/^[\s\w$]+:/.test(e.trim()) && !/,\s*[\w$]+\s*:/.test(e))
    .filter((e) => TS_READ.test(e) && !e.includes('('))
}
// ── "ROUTED" MEANT "CONTAINS A CALL", WHICH IS TOO WEAK ─────────────────
//
// A site doing its OWN date shaping inline - `${String(x.effectiveFrom)
// .slice(0, 10)}` - contains a call, so the first version of this classifier
// scored it ROUTED. It is not routed: it is a second implementation, which
// is the exact thing R7 exists to remove, and the census would have reported
// "0 raw" over the top of it.
//
// Found in approval-page.js by a grep run for a different reason, which is
// the second time this census has been corrected by a grep rather than by
// itself. Its shape is stated as a limit in the Phase 1 report rather than
// claimed closed.
const SELF_FORMATTING = DECL.map(([re]) => re)
const selfFormats = (expr) => SELF_FORMATTING.some((re) => re.test(expr))
const isRaw = (s) => DISPLAY(s.f)
  && (rawParts(s.line).length > 0
      || interpolations(s.line).some((e) => TS_READ.test(e) && selfFormats(e)))
const raw = sites.filter(isRaw)
const routed = sites.filter((s) => DISPLAY(s.f) && !isRaw(s))

// ── THE CLASSIFIER IS ITSELF CALIBRATED, BOTH DIRECTIONS ────────────────
// Verification 9: a detector not proven capable of failing is not evidence,
// and this one has already been wrong once. Synthetic lines, so the anchors
// cannot be retired by a later fix.
const CLS = [
  [`<span>{n${AT}}</span>`, true, 'a bare read is raw'],
  [`<span>{formatTimestamp(n${AT})}</span>`, false, 'a routed read is not'],
  ['`${x.name ?? "y"}${d.decided_at ? formatDate(d.decided_at) : ""}`', false,
    'the SECOND interpolation is the one that matters'],
  [`key={\`\${n${AT}}-\${i}\`}`, false, 'a React key is not a render'],
  ['return { rates, missing, asOf: r.data?.as_of ?? null }', false,
    'an object literal is not a render'],
  [`<span>Resolved as at {c.asOf}.</span>`, true,
    'asOf is in the vocabulary - the omission that let a real site through'],
]
const CLS2 = CLS.concat([
  ['`cost basis dated ${String(x.effectiveFrom).slice(0, 10)}`', true,
    'shaping a date INLINE is a second implementation, not routing'],
  ['`approved ${formatDate(t.decided_at)}`', false, 'a module call is routing'],
])
const clsResults = CLS2.map(([line, expectRaw, why]) =>
  [isRaw({ f: 'frontend/x.js', line }) === expectRaw, why])
const CLASSIFIER_OK = clsResults.every(([ok]) => ok)

const out = { decls, sites, raw, routed,
  calibration: { KNOWN_RAW, KNOWN_FMT, PROSE_EXCLUDED, STRIPPER_KEEPS_CODE, CLASSIFIER_OK },
  filesScanned: files.length }
writeFileSync(join(ROOT, 'scripts/lead-card-ui/census-timestamps.json'), JSON.stringify(out, null, 2))

console.log(`files scanned: ${files.length}`)
console.log(`CALIBRATION  synthetic raw seen: ${KNOWN_RAW}  synthetic formatter seen: ${KNOWN_FMT}`
  + `  prose excluded: ${PROSE_EXCLUDED}  stripper keeps code: ${STRIPPER_KEEPS_CODE}`)
for (const [ok, why] of clsResults) console.log(`  classifier  ${ok ? 'ok  ' : 'FAIL'}  ${why}`)
if (!KNOWN_RAW || !KNOWN_FMT || !PROSE_EXCLUDED || !STRIPPER_KEEPS_CODE || !CLASSIFIER_OK) {
  console.log('\nCALIBRATION FAILED - the census is not evidence'); process.exit(1) }
console.log(`\n=== (a) DATE-TO-DISPLAY CONVERSIONS: ${decls.length} ===`)
for (const d of decls) console.log(`  ${d.f}:${d.n}  [${d.kind}]  ${d.line.slice(0, 96)}`)
console.log(`\n=== (b) TIMESTAMP RENDER SITES: ${sites.length} ===`)
for (const s of sites.filter((x) => DISPLAY(x.f))) console.log(`  ${isRaw(s) ? 'RAW   ' : 'routed'} ${s.f}:${s.n}  ${s.line.slice(0, 92)}`)
console.log(`\n=== R7: ${routed.length} routed, ${raw.length} RAW ===`)
for (const s of raw) console.log(`  RAW  ${s.f}:${s.n}  ${s.line.slice(0, 96)}`)
