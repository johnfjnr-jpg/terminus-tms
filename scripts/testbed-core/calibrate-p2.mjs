// ── ROUND A PHASE 2: CALIBRATE EVERY NEW CHECK, BOTH DIRECTIONS ──────────
//
// Same harness as calibrate-p1.mjs, pointed at Phase 2's behaviours (2.1 to
// 2.6). Each injection breaks ONE behaviour in the source, runs the scoring
// test files, and is scored by WHICH named test failed, never by exit code.
// The silent direction is the final reverted run of the whole React suite.
//
// Protections (Verification 44): refuses to start over an in-flight marker;
// byte snapshots keyed by full path; an anchor must occur exactly once; the
// injection must land before anything is measured; bytes compared after every
// restore, stopping dead on a mismatch.
//
// UNWIRED: it rewrites source while it runs.
// Run: node scripts/testbed-core/calibrate-p2.mjs > .verify/tb-core/p2-calibrate.txt 2>&1
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const FE = `${ROOT}/frontend-react`
const WORK = `${ROOT}/.verify/tb-core/calib-p2`
const MARKER = `${WORK}/IN-FLIGHT`
const TEST_FILES = [
  'src/__tests__/testbed-scoring.test.tsx',
  'src/__tests__/testbed-exit-criteria.test.tsx',
  'src/__tests__/testbed-scoring-units.test.ts',
]
const stop = (msg) => { console.error(`\nSTOPPED: ${msg}`); process.exit(3) }

const HOST = `${FE}/src/testbed/TestBedHost.tsx`
const SCORING = `${FE}/src/testbed/scoring.ts`
const PANEL = `${FE}/src/testbed/StagePanel.tsx`
const TABS = `${FE}/src/testbed/StageTabs.tsx`
const QS = `${FE}/src/testbed/QualificationScore.tsx`

const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })
const INJECTIONS = [
  // 2.1
  I('2.1a the original starvation: no criteria for any stage', HOST,
    'scoringCriteria: (stage) => criteriaForStage(allCriteria, stage),', 'scoringCriteria: () => [],',
    ["Qualification offers every criterion"]),
  I('2.1b every criterion on every stage', HOST,
    'scoringCriteria: (stage) => criteriaForStage(allCriteria, stage),', 'scoringCriteria: () => allCriteria,',
    ['Site Assessment offers only its own']),
  // 2.2
  I('2.2a series from nowhere (the POST-only series)', HOST,
    'series: (key) => orderedSeries(record.payload, key),', 'series: () => [],',
    ["each row carries the payload's own entry count"]),
  I('2.2b the reducer trusts stored order', QS,
    "return [...series].sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')))", 'return [...series]',
    ['the reducer orders by `at`']),
  // 2.3
  I('2.3a the old batch key: criterion_key', SCORING,
    '= { criterion: c.criterion_key, score: Number(draft) }', '= { criterion_key: c.criterion_key, score: Number(draft) } as never',
    ['the bodies are { criterion, score, reason? }']),
  I('2.3b the reason is never sent', SCORING,
    '    if (reason) body.reason = reason\n', '',
    ['the bodies are { criterion, score, reason? }']),
  I('2.3c drafting order instead of panel order', SCORING,
    '  for (const c of criteria) {\n    const draft = s.drafts[c.criterion_key]',
    '  for (const c of Object.keys(s.drafts).map((k) => criteria.find((x) => x.criterion_key === k)).filter(Boolean) as Criterion[]) {\n    const draft = s.drafts[c.criterion_key]',
    ['sent in panel order']),
  I('2.3d the run continues past a refusal', SCORING,
    "    if (!r.ok) return { recorded, failed: { key: c.criterion_key, error: r.error ?? 'unknown error' }, refused: false }",
    '    if (!r.ok) continue',
    ['the FIRST refusal stops the run']),
  I('2.3e recorded scores stay drafted', TABS,
    'setScores((s) => clearRecorded(s, out.recorded))', 'setScores((s) => s)',
    ['a recorded score stands']),
  I('2.3f everything is cleared, even what was refused', TABS,
    'setScores((s) => clearRecorded(s, out.recorded))', 'setScores(() => NO_DRAFTS)',
    ['a recorded score stands']),
  I('2.3g the message names keys, not criteria', SCORING,
    'const nameOf = (k: string) => criteria.find((c) => c.criterion_key === k)?.name ?? k', 'const nameOf = (k: string) => k',
    ['the FIRST refusal stops the run', 'a refusal on the FIRST entry']),
  I('2.3h door removed from the score path', SCORING,
    '  if (!deps.canEdit()) return { recorded: [], failed: null, refused: true }\n', '',
    ['the DOOR: on a record you may not edit, nothing is sent']),
  I('2.3i the button is live with nothing drafted', PANEL,
    'disabled={!!blocking || !anyDraft || busy}', 'disabled={!!blocking || busy}',
    ['with NOTHING drafted']),
  I('2.3j no record reload after scoring', HOST,
    'if (!out.refused) { await load(); refreshStage() }', 'if (!out.refused) { refreshStage() }',
    ['the RECORD is re-read']),
  // 2.4
  I('2.4a measurability on every stage', SCORING,
    "return !!exit?.requirements?.some((r) => r.requirement_type === 'payload_field_required'",
    "return true || !!exit?.requirements?.some((r) => r.requirement_type === 'payload_field_required'",
    ['on Site Assessment, whose requirements do not name it']),
  I('2.4b door removed from measurability', SCORING,
    '  if (!deps.canEdit()) return { sent: false, error: null }\n', '',
    ['the choice sends nothing']),
  I('2.4c the choice is sent as a string', PANEL,
    "void onMeasurability(v === 'yes')", 'void onMeasurability(v as never)',
    ['a choice saves AT ONCE']),
  I('2.4d no record reload after measurability', HOST,
    'if (r.sent && !r.error) { await load(); refreshStage() }', 'if (r.sent && !r.error) { refreshStage() }',
    ['a choice saves AT ONCE']),
  I('2.4e the current confirmation is not shown', PANEL,
    "{measCurrent ? (measCurrent.value ? 'Yes' : 'No') : 'Not confirmed'}</span>", "{'Not confirmed'}</span>",
    ["shows the payload's current confirmation"]),
  // 2.5
  I('2.5a no current value', PANEL,
    "{current && current.value !== undefined ? String(current.value) : 'Not scored'}</span>", "{'Not scored'}</span>",
    ['the current value sits beside the name']),
  I('2.5b the asks line shows the name', PANEL,
    'data-testid={`tb-score-asks-${key}`}>{c.asks}</p>', 'data-testid={`tb-score-asks-${key}`}>{c.name}</p>',
    ['the asks line is the stored question']),
  I('2.5c no no-wording marking', PANEL,
    "className={wording(l.value, l.description) ? 'tb-score-anchor' : 'tb-score-anchor tb-score-anchor--nowording'}",
    'className="tb-score-anchor"',
    ['the definitions list EVERY level']),
  // 2.5d FIRST RUN SILENT, and correctly: every captured criterion IS at version
  // 1, so "Version 1" was the right output. Aimed now at the derived v2 case.
  I('2.5d the version line is wrong', PANEL,
    'Version {String(c.current_version)}</p>', 'Version 1</p>',
    ['resolves wording against its OWN version']),
  I('2.5e no auto-open on a draft', PANEL,
    "const anchors = anchorsOpen[key] ?? (draft !== '')", 'const anchors = anchorsOpen[key] ?? false',
    ['OPEN while a draft is pending']),
  I('2.5f a made close does not survive the next focus', PANEL,
    'setAnchorsOpen((o) => (o[key] === undefined ? { ...o, [key]: true } : o))', 'setAnchorsOpen((o) => ({ ...o, [key]: true }))',
    ['a close the person made survives']),
  I('2.5g history oldest first', PANEL,
    '{[...s].reverse().map((e, i) => {', '{[...s].map((e, i) => {',
    ['history is newest FIRST']),
  I('2.5h history resolved against the CURRENT version', PANEL,
    "anchorSet(c, e.anchorVersion)[String(e.value)] : undefined", "anchorSet(c, c.current_version)[String(e.value)] : undefined",
    ['resolves wording against its OWN version']),
  I('2.5i the current reason only inside history', PANEL,
    '{current && (current.comment || current.reason)', '{open && current && (current.comment || current.reason)',
    ['a single entry shows its reason WITHOUT a history control']),
  I('2.5j the lock disables nothing', PANEL,
    'disabled={!!blocking && !isBlocking}', 'disabled={false}',
    ['the LOCK holds']),
  I('2.5k the lock disables the blocking criterion too', PANEL,
    'disabled={!!blocking && !isBlocking}', 'disabled={!!blocking}',
    ['the LOCK holds']),
  I('2.5l the handler takes a draft past the lock', SCORING,
    '  if (awaiting && awaiting !== key) return s\n', '',
    ['the HANDLER refuses']),
  I('2.5m focus does not move into the reason box', PANEL,
    '    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }\n', '',
    ['the LOCK holds']),
  I('2.5n the lock note names the key', PANEL,
    'Add the Reason for {blockingName} before scoring anything else.', 'Add the Reason for {blocking} before scoring anything else.',
    ['the LOCK holds']),
  I('2.5o measurability stays live under the lock', PANEL,
    'disabled={!!blocking || measBusy}', 'disabled={measBusy}',
    ['the LOCK holds']),
  I('2.5p required reads as optional', PANEL,
    "(required ? 'Reason (required)' : 'Reason (optional)')", "'Reason (optional)'",
    ['labels: optional at a free first score']),
  I('2.5q clearing a draft keeps its reason', SCORING,
    "  if (value === '') { delete drafts[key]; delete reasons[key] } else drafts[key] = value",
    "  if (value === '') { delete drafts[key] } else drafts[key] = value",
    ['clearing a draft drops its reason']),
  I('2.5r the history toggle loses aria-expanded (the door would kill it)', PANEL,
    '<button type="button" className="btn-text" aria-expanded={open}', '<button type="button" className="btn-text"',
    ['history is newest FIRST']),
  // 2.5s FIRST RUN FIRED ELSEWHERE: storing '' on clear still releases the lock,
  // because '' is no level and a fresh record has no revision. Aimed now at a
  // clear that keeps the drafted LEVEL, which must hold the lock.
  I('2.5s clearing does not clear the drafted level', SCORING,
    "  if (value === '') { delete drafts[key]; delete reasons[key] } else drafts[key] = value",
    "  if (value === '') { delete reasons[key] } else drafts[key] = value",
    ['the LOCK releases both ways', 'clearing a draft drops its reason']),
  // 2.6
  I('2.6a a server-met row is marked', PANEL,
    "const isPending = (r: ExitRequirement) => !r.met && typeof r.field === 'string'",
    "const isPending = (r: ExitRequirement) => typeof r.field === 'string'",
    ['a SERVER-MET row is never marked']),
  I('2.6b the drafts never reach the exit panel', TABS,
    "pending={new Set(Object.keys(scores.drafts).filter((k) => scores.drafts[k] !== ''))} />", 'pending={new Set()} />',
    ['choosing a score marks its row']),
  I('2.6c no "unsaved" word', PANEL,
    '? <span className="tb-crit-pending-tag" data-testid="tb-crit-pending-tag">unsaved</span> : null)', '? null : null)',
    ['gets the dot, the dashed box', 'choosing a score marks its row']),
  I('2.6d no pending box', PANEL,
    "(pend ? 'tb-crit-box tb-crit-box--pending' : 'tb-crit-box')", "'tb-crit-box'",
    ['gets the dot, the dashed box']),
]

if (existsSync(MARKER)) stop(`${MARKER} exists: a previous run was killed. Restore from ${WORK}/snapshots and delete the marker.`)
mkdirSync(`${WORK}/snapshots`, { recursive: true })
const files = [...new Set(INJECTIONS.map((i) => i.file))]
const snap = new Map()
for (const f of files) {
  const bytes = readFileSync(f)
  snap.set(f, bytes)
  const copy = `${WORK}/snapshots/${f.replaceAll('/', '_')}`
  writeFileSync(copy, bytes)
  if (!readFileSync(copy).equals(bytes)) stop(`snapshot of ${f} did not write`)
}
writeFileSync(MARKER, new Date().toISOString())
console.log(`snapshotted ${files.length} files; marker written`)

const runTests = (label) => {
  const out = `${WORK}/${label.replace(/[^A-Za-z0-9]+/g, '_')}.json`
  rmSync(out, { force: true })
  const t0 = Date.now()
  const r = spawnSync('npx', ['vitest', 'run', ...TEST_FILES, '--reporter=json', `--outputFile=${out}`], { cwd: FE, encoding: 'utf8' })
  const ms = Date.now() - t0
  if (!existsSync(out)) return { ms, exit: r.status, failed: null, raw: `${r.stdout}${r.stderr}`.slice(-800) }
  const j = JSON.parse(readFileSync(out, 'utf8'))
  const all = j.testResults.flatMap((f) => f.assertionResults)
  return { ms, exit: r.status, total: all.length, failed: all.filter((a) => a.status !== 'passed').map((a) => a.title),
    suiteError: j.testResults.map((f) => f.message).filter(Boolean).join(' | ') }
}

const rows = []
try {
  const base = runTests('baseline')
  if (base.failed === null || base.failed.length) stop(`baseline is not green: ${JSON.stringify(base)}`)
  console.log(`baseline: ${base.total} tests across ${TEST_FILES.length} files, 0 failed, ${base.ms}ms`)
  for (const inj of INJECTIONS) {
    const now = readFileSync(inj.file)
    if (!now.equals(snap.get(inj.file))) stop(`${inj.file} differs from its snapshot before ${inj.id}`)
    const text = now.toString('utf8')
    const count = text.split(inj.find).length - 1
    if (count !== 1) stop(`anchor for ${inj.id} occurs ${count} times, not once`)
    writeFileSync(inj.file, text.replace(inj.find, inj.replace))
    if (readFileSync(inj.file, 'utf8') === text) stop(`injection ${inj.id} did not change the file`)
    let res
    try { res = runTests(inj.id) } finally {
      writeFileSync(inj.file, snap.get(inj.file))
      if (!readFileSync(inj.file).equals(snap.get(inj.file))) stop(`restore of ${inj.file} after ${inj.id} is not byte-identical`)
    }
    if (res.failed === null) stop(`${inj.id} produced no result in ${res.ms}ms (exit ${res.exit}): ${res.raw}`)
    const hit = inj.expect.filter((e) => res.failed.some((t) => t.includes(e)))
    const verdict = res.failed.length === 0 ? 'SILENT'
      : (inj.expect.length && hit.length === inj.expect.length ? 'FIRED' : 'FIRED-ELSEWHERE')
    rows.push({ id: inj.id, verdict, failed: res.failed })
    console.log(`${verdict.padEnd(16)} ${inj.id}  expected ${hit.length}/${inj.expect.length}, ${res.failed.length} failed, ${res.ms}ms`)
    for (const t of res.failed) console.log(`                   x ${t}`)
    if (res.suiteError) console.log(`                   suite error: ${res.suiteError.slice(0, 200)}`)
  }
} finally {
  for (const [f, bytes] of snap) {
    if (!readFileSync(f).equals(bytes)) writeFileSync(f, bytes)
    if (!readFileSync(f).equals(bytes)) { console.error(`FINAL RESTORE FAILED for ${f}; marker left`); process.exit(4) }
  }
  rmSync(MARKER, { force: true })
  console.log('all targets byte-identical to their snapshots; marker removed')
}

const t0 = Date.now()
const full = spawnSync('npx', ['vitest', 'run'], { cwd: FE, encoding: 'utf8' })
const summary = `${full.stdout}${full.stderr}`.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ')
console.log(`\nREVERTED full React suite: exit ${full.status}, ${Date.now() - t0}ms  ${summary.trim()}`)
const notFired = rows.filter((r) => r.verdict !== 'FIRED')
console.log(`\n${rows.length - notFired.length}/${rows.length} FIRED on their named tests; not: ${notFired.map((r) => `${r.id}=${r.verdict}`).join(', ') || 'none'}`)
process.exit(full.status === 0 && notFired.length === 0 ? 0 : 1)
