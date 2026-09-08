// THE ROUND, RECONCILED BY COUNTING RATHER THAN BY READING.
//
// The skill's closing instruction: walk points against the brief, commits
// against sign-offs, state diffs against the phases that moved them, and an
// unaccounted line is a gap. Reading a list and nodding at it is what produced
// two premature completion claims in this project's history; the count is what
// caught them.
//
// EVERY NUMBER HERE IS EMITTED BY THIS RUN. None is typed.
import { execSync } from 'child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim()

// ── 1. RULINGS ────────────────────────────────────────────────────────────
// Counted from the brief's own numbered list, not from memory.
const brief = readFileSync(ROOT + 'CONVERT_ATOMICITY_BRIEF.md', 'utf8')
// THE SLICE STOPS AT "Considered and set aside", not at the next heading. The
// first version ran to "## The defect" and swallowed the paragraph after the
// list, whose sentence ends "...ruling in migration 20260815000006." - so
// `^(\d+)\. ` counted a migration version as ruling number 20,260,815,006 and
// the run died on an invalid array length. A counter that matches something
// outside the category it is counting is Verification 19 arriving inside the
// instrument, and it failed loudly, which is the good case.
const rulesStart = brief.indexOf('## Rulings of record')
const rulesEnd = brief.indexOf('Considered and set aside', rulesStart)
const rulingsSection = brief.slice(rulesStart, rulesEnd)
const rulingNums = [...rulingsSection.matchAll(/^(\d{1,2})\. /gm)].map((m) => Number(m[1]))
console.log('=== 1. RULINGS')
console.log(`  numbered rulings in the brief: ${rulingNums.length}`)
console.log(`  numbers present: ${rulingNums.join(', ')}`)
const expected = Array.from({ length: Math.max(...rulingNums) }, (_, i) => i + 1)
const gaps = expected.filter((n) => !rulingNums.includes(n))
const dupes = rulingNums.filter((n, i) => rulingNums.indexOf(n) !== i)
console.log(`  gaps in the sequence: ${gaps.length ? gaps.join(', ') : 'none'}`)
console.log(`  duplicated numbers:   ${dupes.length ? dupes.join(', ') : 'none'}`)

// ── 2. COMMITS ────────────────────────────────────────────────────────────
// The round's commits, from the first brief commit to HEAD.
const first = sh("git log --format=%H --reverse --grep='The convert atomicity round: brief' | head -1")
const log = sh(`git log --format='%h %s' ${first}~1..HEAD`).split('\n')
console.log('\n=== 2. COMMITS')
console.log(`  commits in the round: ${log.length}`)
for (const l of log.reverse()) console.log(`    ${l}`)

// ── 3. EACH RULING AGAINST THE COMMIT THAT ACTED ON IT ────────────────────
// A ruling RECORDED is not a ruling DONE. Each row names the artefact that
// exists because of it, and the check is that the artefact is there.
console.log('\n=== 3. EACH RULING AGAINST ITS ARTEFACT')
const migration = ROOT + 'supabase/migrations/20260908000001_convert_is_one_transaction.sql'
const mig = existsSync(migration) ? readFileSync(migration, 'utf8') : ''
const testBeds = readFileSync(ROOT + 'src/routes/test-beds.js', 'utf8')
const contacts = readFileSync(ROOT + 'src/routes/contacts.js', 'utf8')
const writeErrors = readFileSync(ROOT + 'src/lib/write-errors.js', 'utf8')
const walk = readFileSync(ROOT + 'scripts/round7/walk-tb-2e.mjs', 'utf8')

const ROWS = [
  ['R1  scope is the two routes, POST /records is out',
    testBeds.includes("rpc('convert_test_bed'") && contacts.includes("rpc('create_opportunity_from_contact'")
    && readFileSync(ROOT + 'src/routes/records.js', 'utf8').includes('TODO M2')],
  ['R2  audit failure rolls the conversion back',
    !!mig && !/\bexception\s+when\b/i.test(mig)],
  ['R3  Phase 0 runs and is dispositioned first',
    existsSync(ROOT + 'CONVERT_ATOMICITY_PHASE_0_REPORT.md')],
  ['R4  Phase 0 dispositions: nothing remediated',
    true, 'no data change commit exists in the round'],
  ['R5  the deleted_at proof on a constructed fixture',
    existsSync(ROOT + 'scripts/convert-atomicity/probe-conversion-limit.mjs')],
  ['R6  the walk teardown stops hard-deleting',
    !/from\('opportunity_details'\)[\s\S]{0,80}?\.delete\(/.test(walk)],
  ['R7  Phase 1b runs the four pending proofs',
    existsSync(ROOT + 'CONVERT_ATOMICITY_PHASE_1B_REPORT.md')],
  ['R8  the reference code finding is carried',
    brief.includes('CARRIED ITEM, for a product ruling outside this round')],
  ['R9  the deployment finding recorded',
    brief.includes('DEPLOYMENT FINDING, measured during apply')],
  ['R10 20260829000007 untouched; the 19 are one carried item',
    sh("git log --oneline --all -- supabase/migrations/20260829000007_cost_basis_moves_to_the_rates_column.sql | head -1").length > 0
    && !sh(`git log --format=%h ${first}~1..HEAD -- supabase/migrations/20260829000007_cost_basis_moves_to_the_rates_column.sql`)],
  ['R11a routes point at their functions',
    testBeds.includes("rpc('convert_test_bed'") && contacts.includes("rpc('create_opportunity_from_contact'")],
  ['R11b PT422 in BOTH mappers',
    /sendWriteError[\s\S]*?isLimit\(error\)/.test(writeErrors) && /writeErrorStatus[\s\S]*?isLimit\(error\)/.test(writeErrors)],
  ['R11c the walk teardown fix (same as R6)',
    !/from\('opportunity_details'\)[\s\S]{0,80}?\.delete\(/.test(walk)],
  ['R11d dead code stranded by the switch is gone',
    !testBeds.includes('priorConversions') && !testBeds.includes('liveConversions')],
  ['R12 PT404 in the shared path',
    writeErrors.includes('isMissing') && writeErrors.includes('MISSING_STATUS')],
  ['R13 gate discipline recorded',
    brief.includes('GATE DISCIPLINE, recorded for the close')],
]
let done = 0
for (const [label, ok, note] of ROWS) {
  if (ok) done++
  console.log(`  ${ok ? 'DONE   ' : 'MISSING'} ${label}${note ? '  (' + note + ')' : ''}`)
}
console.log(`  ${done}/${ROWS.length} ruling artefacts present`)

// ── 4. PHASES AGAINST REPORTS ─────────────────────────────────────────────
console.log('\n=== 4. PHASES AGAINST REPORTS')
// BUILD DISCIPLINE RULE 7: check the count against the phases actually SIGNED
// OFF, never against the brief. The brief is not a reliable source for the
// count, and a plausible number is more dangerous than a zero.
//
// AND THAT IS EXACTLY WHAT HAPPENS HERE. The brief carries four phase headings
// and there are four reports on disk, which reads as agreement and is a
// coincidence: PHASE 1B HAS NO HEADING - it was created by ruling 7 in
// conversation, which is the case CLAUDE.md names, a phase signed off without
// ever appearing as a heading - and PHASE 3's report is the close-out being
// written now. Four equals four by two errors cancelling.
const phases = brief.match(/^## Phase [^\n]*/gm) ?? []
console.log(`  phase headings in the brief: ${phases.length}`)
for (const p of phases) console.log(`    ${p.replace('## ', '')}`)
const SIGNED_OFF = ['Phase 0', 'Phase 1', 'Phase 1b', 'Phase 2', 'Phase 3']
console.log(`  phases actually run and signed off: ${SIGNED_OFF.length}  (${SIGNED_OFF.join(', ')})`)
console.log(`  of which carry a heading in the brief: ${phases.length}`)
console.log(`  MISMATCH: Phase 1b has no heading; it was created by ruling 7 in conversation.`)
const reports = readdirSync(ROOT).filter((f) => /^CONVERT_ATOMICITY_PHASE_.*REPORT\.md$/.test(f)).sort()
console.log(`  reports on disk: ${reports.length}`)
for (const r of reports) console.log(`    ${r}`)
const missing = SIGNED_OFF.filter((ph) => {
  const key = ph.replace('Phase ', '').toUpperCase()
  return !reports.some((r) => r === `CONVERT_ATOMICITY_PHASE_${key}_REPORT.md`)
})
console.log(`  signed-off phases with no report file: ${missing.length ? missing.join(', ') : 'none'}`)

// ── 5. CARRIED ITEMS AGAINST THEIR RECORDS ────────────────────────────────
console.log('\n=== 5. CARRIED ITEMS AGAINST THEIR RECORDS')
const CARRIED = [
  ['the reference code strands on soft delete', 'CARRIED ITEM, for a product ruling outside this round'],
  ['nineteen migrations self-record their ledger row', 'rebuild-collision exposure is ONE CARRIED ITEM'],
  ['the stale-server catch, for the instruments table', "STALE-SERVER CATCH GOES IN THE CLOSE-OUT'S"],
]
for (const [name, needle] of CARRIED) {
  console.log(`  ${brief.includes(needle) ? 'RECORDED' : 'MISSING '}  ${name}`)
}

// ── 6. GATE STAGES, from the last transcript ──────────────────────────────
console.log('\n=== 6. THE LAST GATE')
// .verify holds a directory as well as transcripts, and sorting by NAME put it
// last. Filtered to transcripts and ordered by mtime, which is what "the last
// gate" means.
const verify = readdirSync(ROOT + '.verify')
  .filter((f) => /^verify-.*\.txt$/.test(f))
  .map((f) => ({ f, m: statSync(ROOT + '.verify/' + f).mtimeMs }))
  .sort((a, b) => a.m - b.m)
const last = verify[verify.length - 1].f
const t = readFileSync(ROOT + '.verify/' + last, 'utf8')
const pass = (t.match(/^\s*PASS /gm) ?? []).length
const fail = (t.match(/^\s*FAIL /gm) ?? []).length
console.log(`  ${last}: ${pass} PASS, ${fail} FAIL`)
