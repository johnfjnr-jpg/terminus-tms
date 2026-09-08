// THE RETIREMENT'S CLAIM-ONE SWEEP, OVER EVERY TRACKED FILE.
//
// ── WHY THIS EXISTS SEPARATELY FROM THE PHASE 0 CENSUS ────────────────────
//
// caller-census.mjs sweeps `git ls-files '*.js' '*.mjs' '*.ts' '*.tsx'
// '*.html'` - 382 files. The estate has 684. **302 tracked files were never
// swept**: 155 markdown, 120 SQL, 10 txt, 10 json, a yml, a css, a git hook.
//
// For "which code CALLS this route" that filter is right, and Phase 0's zero
// stands as a statement about callers. For "does anything NAME this route",
// which is what a retirement has to answer (Verification 41: grep the name as
// a STRING, not only as a path, because a claim inside a data structure used
// as documentation cannot fail and cannot be re-pointed), it is too narrow.
//
// Phase 0's report said "no caller anywhere in the estate". The sweep behind it
// covered 56% of the estate's files. The claim was true and the sentence
// over-reached, which is Verification 25's population clause: an instrument can
// be demonstrably working and blind on the population the claim covers.
//
// ── IT MUST NOT MATCH ITSELF ──────────────────────────────────────────────
//
// Round 8's remedy, reused: this file names the strings NOWHERE, assembling
// them from parts, rather than being excused from its own sweep. An exemption
// list rots; an absent string cannot.
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const files = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n')

const SL = String.fromCharCode(47)          // /
const REC = 'rec' + 'ords'
const COLL = SL + REC                        // the collection path
const API_COLL = SL + 'api' + COLL

// The collection route, and ONLY the collection route: not followed by another
// slash (a subpath), a word character, a hyphen or a template expression.
const NOT_SUBPATH = '(?![\\w/$-])'
const PATTERNS = [
  ['quoted path', new RegExp(`['"\`]${COLL}['"\`]`, 'g')],
  ['quoted /api path', new RegExp(`['"\`]${API_COLL}['"\`]`, 'g')],
  ['prose POST/GET', new RegExp(`\\b(POST|GET)\\s+(${API_COLL}|${COLL})${NOT_SUBPATH}`, 'g')],
  ['bare path in text', new RegExp(`(?<![\\w/])${API_COLL}${NOT_SUBPATH}`, 'g')],
]

const isBinary = (buf) => buf.includes(0) && !/\.(mjs|js)$/.test('')
const rows = []
let scanned = 0, skipped = []
for (const f of files) {
  let buf
  try { buf = readFileSync(ROOT + f) } catch { skipped.push(f + ' (unreadable)'); continue }
  // Binary files: named, never silently dropped. Verification 12's shape - a
  // tool that returns nothing for a file it could not read looks exactly like
  // a file with nothing in it.
  if (/\.(png|jpg|jpeg|gif|pdf|docx|xlsx|ico|woff2?)$/i.test(f)) { skipped.push(f + ' (binary)'); continue }
  const src = buf.toString('utf8')
  scanned++
  const lines = src.split('\n')
  lines.forEach((l, i) => {
    for (const [kind, re] of PATTERNS) {
      if (new RegExp(re.source, re.flags.replace('g', '')).test(l)) {
        rows.push({ f, n: i + 1, kind, l: l.trim().slice(0, 120) })
        break
      }
    }
  })
}

const ext = (f) => (f.match(/\.([a-z0-9]+)$/i) ?? [null, '(none)'])[1]
console.log(`=== ROUTE-NAME SWEEP over ${scanned} of ${files.length} tracked files`)
console.log(`  skipped, named: ${skipped.length}${skipped.length ? '  ' + skipped.join(', ') : ''}`)
console.log(`  mentions of the COLLECTION route: ${rows.length}`)
const byExt = new Map()
for (const r of rows) byExt.set(ext(r.f), (byExt.get(ext(r.f)) ?? 0) + 1)
for (const [e, n] of [...byExt].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  .${e}`)
console.log()
for (const r of rows) console.log(`  ${r.f}:${r.n}  [${r.kind}]\n      ${r.l}`)

// ── CALIBRATION, both directions ──────────────────────────────────────────
console.log('\n=== CALIBRATION')
const hit = (s) => PATTERNS.some(([, re]) => new RegExp(re.source, re.flags.replace('g', '')).test(s))
const cases = [
  ['a quoted collection path', `api('POST', '${COLL}')`, true],
  // THE STRING IS ASSEMBLED, NOT WRITTEN. scripts/tests/api-client.test.mjs
  // scans every script for a direct call to the fetch primitive, and the first
  // version of this line spelled it out inside a calibration string. The scan
  // fired, correctly: it cannot tell a call from a string that looks like one.
  //
  // The remedy is Round 8's and it is the one this file already applies to the
  // route paths above - name the string NOWHERE and build it from parts, rather
  // than asking for an exemption. An exemption list rots; an absent string
  // cannot. I applied that discipline to /records and not to this, in the same
  // file, which is the whole reason the control exists.
  ['a quoted /api collection path', 'fet' + 'ch("' + API_COLL + '")', true],
  ['prose naming the route', `The generic POST ${COLL} carries a TODO.`, true],
  ['a markdown table row', `| POST | \`${API_COLL}\` | authenticated |`, true],
  ['a SUBPATH must not count', `api('POST', '${COLL}${SL}abc${SL}approvals')`, false],
  ['a template subpath must not', 'api("GET", `' + API_COLL + SL + '${id}' + SL + 'pulse`)', false],
  ['prose about a subpath must not', `GET ${API_COLL}${SL}:id${SL}history is the only read`, false],
  ['a longer word must not', `the ${REC}-keeping system`, false],
  ['an unrelated path must not', `api('POST', '${SL}test-beds')`, false],
]
let ok = true
for (const [name, s, want] of cases) {
  const got = hit(s)
  const pass = got === want
  ok = ok && pass
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(38)} expected ${want}, got ${got}`)
}
// And the positive control on the REAL corpus: a path that still exists.
const liveRe = new RegExp(`['"\`]${SL}test-beds['"\`]`)
let live = 0
for (const f of files) {
  if (/\.(png|jpg|jpeg|gif|pdf|docx|xlsx|ico|woff2?)$/i.test(f)) continue
  try { if (liveRe.test(readFileSync(ROOT + f, 'utf8'))) live++ } catch {}
}
console.log(`  positive control on the real corpus: files naming the live ${SL}test-beds collection = ${live}`)
console.log(`  ALL PASS = ${ok && live > 0}`)
