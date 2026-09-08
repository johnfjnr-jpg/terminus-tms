// THE ROUND, RECONCILED BY COUNTING. Every number emitted by this run.
import { execSync } from 'child_process'
import { readFileSync, existsSync, readdirSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim()

const brief = readFileSync(ROOT + 'RECORD_CREATION_ATOMICITY_BRIEF.md', 'utf8')
// The slice stops at the section heading after the list, not at the next
// heading generally: the convert round's counter swallowed a migration version
// from the paragraph below its list and reported a ruling numbered twenty
// billion. Bounded to two digits for the same reason.
const s0 = brief.indexOf('## Rulings of record')
const s1 = brief.indexOf('## The defect', s0)
const nums = [...brief.slice(s0, s1).matchAll(/^R(\d{1,2})\. /gm)].map((m) => Number(m[1]))
console.log('=== 1. RULINGS')
console.log(`  numbered rulings: ${nums.length}  -> ${nums.join(', ')}`)
const gaps = Array.from({ length: Math.max(...nums) }, (_, i) => i + 1).filter((n) => !nums.includes(n))
console.log(`  gaps: ${gaps.length ? gaps.join(', ') : 'none'}   duplicates: ${nums.filter((n, i) => nums.indexOf(n) !== i).join(', ') || 'none'}`)
console.log(`  superseded and left visible: ${/SUPERSEDES R1/.test(brief) ? 'R1, by R6' : 'NONE FOUND'}`)

console.log('\n=== 2. COMMITS')
const first = sh("git log --format=%H --reverse --grep='The record creation atomicity round: brief' | head -1")
const log = sh(`git log --format='%h %s' --reverse ${first}~1..HEAD`).split('\n')
log.forEach((l, i) => console.log(`  ${String(i + 1).padStart(2)}. ${l}`))
console.log(`  total: ${log.length}`)

console.log('\n=== 3. EACH RULING AGAINST ITS ARTEFACT')
const routes = readFileSync(ROOT + 'src/routes/records.js', 'utf8')
const app = readFileSync(ROOT + 'frontend/app.js', 'utf8')
const state = readFileSync(ROOT + 'CURRENT_STATE.md', 'utf8')
const SL = String.fromCharCode(47)
const ROWS = [
  ['R1  scope was POST /records  (SUPERSEDED by R6, reasoning left visible)',
    /R1\.\s+Scope: POST/.test(brief) && /SUPERSEDES R1/.test(brief)],
  ['R2  audit rollback  (moot: no function was written, R6)',
    sh(`git diff --name-only ${first}~1..HEAD -- supabase/migrations`).length === 0],
  ['R3  docs-only commits may ride a green gate, named as such',
    /rides on the green gate/.test(sh(`git log --format=%B ${first}~1..HEAD`))],
  ['R4  the three product rulings recorded',
    /Reference code on soft\s+delete/.test(brief) && /Must-differ on a score\s+reason/.test(brief) && /Unqualified to Parked/.test(brief)],
  ['R5  method: investigation first, phases stop, nothing pushes',
    existsSync(ROOT + 'RECORD_CREATION_PHASE_0_REPORT.md')],
  ['R6  both routes deleted',
    !new RegExp(`app\\.post\\('${SL}records'`).test(routes) && !new RegExp(`app\\.get\\('${SL}records'`).test(routes)],
  ['R6  the TODO M2 died with the route', !/TODO M2/.test(routes)],
  ['R6  the generated route table lost exactly those two rows',
    !new RegExp(`\\| (GET|POST) \\| \`${SL}api${SL}records\` \\|`).test(state) && /\| `\/api\/records\//.test(state)],
  ['R7  the future generic path recorded, and nothing built speculatively',
    /built NEW\s+at that time/.test(brief) && sh(`git diff --name-only ${first}~1..HEAD -- supabase/migrations`).length === 0],
  ['the amended live comment says the route is retired',
    /GET \/api\/records WAS RETIRED/.test(app)],
  ['the superseded probe refuses rather than returning garbage',
    /SUPERSEDED: POST/.test(readFileSync(ROOT + 'scripts/record-creation/invariant-census.mjs', 'utf8'))],
]
let done = 0
for (const [label, ok] of ROWS) { if (ok) done++; console.log(`  ${ok ? 'DONE   ' : 'MISSING'} ${label}`) }
console.log(`  ${done}/${ROWS.length}`)

console.log('\n=== 4. PHASES AGAINST REPORTS')
const phases = brief.match(/^## Phase [^\n]*/gm) ?? []
console.log(`  phase headings in the brief: ${phases.length}  (${phases.map((p) => p.replace('## ', '').split(':')[0]).join(', ')})`)
console.log('  BUT the brief was written for a FIX and R6 re-ruled it to a RETIREMENT,')
console.log('  so Phase 1 became the retirement and Phase 2 the close. Phases 1 and 2 of')
console.log('  the brief as written were never run and never will be. Build discipline 7:')
console.log('  the brief is not a reliable source for the count.')
const SIGNED = ['Phase 0', 'Phase 1 (retirement)', 'Phase 2 (close)']
console.log(`  phases actually run: ${SIGNED.length}  (${SIGNED.join(', ')})`)
const reports = readdirSync(ROOT).filter((f) => /^RECORD_CREATION_.*\.md$/.test(f)).sort()
console.log(`  round documents on disk: ${reports.length}  ${reports.join(', ')}`)

console.log('\n=== 5. THE ROUND SHIPPED NO MIGRATION AND NO NEW ROUTE')
console.log(`  migrations added:   ${sh(`git diff --name-only ${first}~1..HEAD -- supabase/migrations`) || '(none)'}`)
console.log(`  net lines in src/:  ${sh(`git diff --shortstat ${first}~1..HEAD -- src/`)}`)
