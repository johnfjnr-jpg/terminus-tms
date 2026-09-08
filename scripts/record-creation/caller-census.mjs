// PHASE 0 ITEM 1: every caller of POST /records across the estate.
//
// READ-ONLY. Nothing here writes anything.
//
// ─────────────────────────────────────────────────────────────
// WHAT MAKES THIS HARDER THAN A GREP
// ─────────────────────────────────────────────────────────────
//
// `/records` is a PREFIX of a dozen other routes - /records/:id/approvals,
// /records/:id/pulse, /records/:id/transition - so a naive search for the
// string reports every one of them as a caller of this route. The census has
// to separate the EXACT path from the prefix, and it has to do it in four
// layers that reach the API four different ways:
//
//   frontend/app.js        api(method, path, body)
//   the React tree         services.api(method, path, body)  -> window.api
//   scripts and probes     api(method, path, body)  from scripts/api-client.mjs
//   anything else          a raw fetch to /api/records
//
// Verification 41's clause: grep the name as a STRING as well as a path, and
// cover probes, tests and scripts as well as screens. A caller the census does
// not ask about is a caller the round does not know it has.
//
// Comments stripped through the estate's own stripper first (Verification 39),
// because this file and several others discuss the route in prose.
import { stripJs } from '../lib/strip-comments.mjs'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const files = execSync("git ls-files '*.js' '*.mjs' '*.ts' '*.tsx' '*.html'", { cwd: ROOT })
  .toString().trim().split('\n')

// Any call of the shape ( 'POST' , '/records' ) with the path EXACTLY /records,
// in single, double or backtick quotes, with arbitrary whitespace.
const EXACT_POST = /['"`]POST['"`]\s*,\s*['"`]\/records['"`]/g
// The same, but any /records/... path, so the census can report what it is
// deliberately NOT counting rather than being silently narrow.
const PREFIX_POST = /['"`]POST['"`]\s*,\s*['"`]\/records\/[^'"`]*['"`]/g
// A raw fetch, which no layer uses today but which the census must still ask
// about, or its absence is unmeasured rather than measured.
const RAW_FETCH = /fetch\s*\(\s*[^)]*\/api\/records\b/g

const rows = []
const prefixRows = []
const rawRows = []
let scanned = 0
for (const f of files) {
  let src
  try { src = readFileSync(ROOT + f, 'utf8') } catch { continue }
  scanned++
  const s = f.endsWith('.html') ? src : stripJs(src)
  const lines = s.split('\n')
  lines.forEach((l, i) => {
    for (const m of l.matchAll(new RegExp(EXACT_POST.source, 'g'))) {
      rows.push({ f, line: i + 1, text: l.trim().slice(0, 140) })
    }
    for (const m of l.matchAll(new RegExp(PREFIX_POST.source, 'g'))) {
      prefixRows.push({ f, line: i + 1, path: m[0] })
    }
    for (const m of l.matchAll(new RegExp(RAW_FETCH.source, 'g'))) {
      rawRows.push({ f, line: i + 1, text: l.trim().slice(0, 120) })
    }
  })
}

console.log(`=== CALLER CENSUS: POST /records, over ${scanned} tracked files`)
console.log(`  exact POST '/records' call sites: ${rows.length}`)
for (const r of rows) console.log(`    ${r.f}:${r.line}\n      ${r.text}`)
console.log(`\n  deliberately NOT counted, POST to a /records/... subpath: ${prefixRows.length}`)
const byPath = new Map()
for (const p of prefixRows) {
  const k = p.path.replace(/['"`]POST['"`]\s*,\s*/, '')
  byPath.set(k, (byPath.get(k) ?? 0) + 1)
}
for (const [k, n] of [...byPath].sort()) console.log(`    ${n}x  ${k}`)
console.log(`\n  raw fetch to /api/records: ${rawRows.length}`)
for (const r of rawRows) console.log(`    ${r.f}:${r.line}  ${r.text}`)

// ── CALIBRATION, both directions, per Verification 9 ──────────────────────
console.log('\n=== CALIBRATION')
const count = (src, re) => (stripJs(src).match(new RegExp(re.source, 'g')) ?? []).length
const cases = [
  ["a real call", "await api('POST', '/records', { record_type: 'x' })", EXACT_POST, 1],
  ["the same in a comment", "// await api('POST', '/records', {})", EXACT_POST, 0],
  ["a subpath must NOT count as this route", "api('POST', '/records/' + id + '/approvals', {})", EXACT_POST, 0],
  ["a template subpath must not either", 'api("POST", `/records/${id}/pulse`)', EXACT_POST, 0],
  ["but the subpath detector sees it", "api('POST', '/records/abc/approvals', {})", PREFIX_POST, 1],
  ["double quotes and odd spacing still count", 'api( "POST" ,  "/records" , b)', EXACT_POST, 1],
  ["a GET is not a POST", "api('GET', '/records')", EXACT_POST, 0],
]
let ok = true
for (const [name, src, re, want] of cases) {
  const got = count(src, re)
  const pass = got === want
  ok = ok && pass
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} expected ${want}, got ${got}`)
}
console.log(`  ALL PASS = ${ok}`)

// ── THE POSITIVE CONTROL ON THE REAL CORPUS ──────────────────────────────
//
// Verification 12/13/17/25 collapsed, and its population clause is the half
// that bites here: the calibration above ran on synthetic strings, and a zero
// on the real estate is only evidence once the instrument has produced a
// NON-ZERO on that same estate. There is no real POST /records call to find -
// that is the finding - so the control changes the PATH to routes that do
// exist and shows the identical machinery finding them.
console.log('\n=== POSITIVE CONTROL, same instrument, same files, a path that exists')
for (const path of ['/test-beds', '/accounts', '/contacts', '/records']) {
  const re = new RegExp(`['"\`]POST['"\`]\\s*,\\s*['"\`]${path.replace('/', '\\/')}['"\`]`, 'g')
  let n = 0
  const where = []
  for (const f of files) {
    let src; try { src = readFileSync(ROOT + f, 'utf8') } catch { continue }
    const hits = (stripJs(src).match(re) ?? []).length
    if (hits) { n += hits; where.push(`${f}(${hits})`) }
  }
  console.log(`  POST ${path.padEnd(12)} ${String(n).padStart(3)} call site(s)   ${where.slice(0, 4).join(' ')}${where.length > 4 ? ' ...' : ''}`)
}

// ── AND THE INDIRECTION CHECK ────────────────────────────────────────────
//
// A zero from a pattern that requires the method and the path to be ADJACENT
// is blind to `const p = '/records'; api('POST', p)`. So: every occurrence of
// the exact literal anywhere, whatever surrounds it.
console.log('\n=== EVERY occurrence of the exact literal /records, in any position')
const LITERAL = /['"`]\/records['"`]/g
let lit = 0
for (const f of files) {
  let src; try { src = readFileSync(ROOT + f, 'utf8') } catch { continue }
  const s = f.endsWith('.html') ? src : stripJs(src)
  s.split('\n').forEach((l, i) => {
    if (new RegExp(LITERAL.source).test(l)) { lit++; console.log(`  ${f}:${i + 1}  ${l.trim().slice(0, 130)}`) }
  })
}
console.log(`  total: ${lit}`)
