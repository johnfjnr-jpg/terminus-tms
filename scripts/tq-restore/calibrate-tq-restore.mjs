#!/usr/bin/env node
// TQ_RESTORE calibration (the PROBE ruling and P6, John 2026-11-25): each
// injection ALONE, in the product source the dev server serves, read by the
// probe's NAMED check (Verification 9's clause), never by the exit code.
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/tq-restore/calibrate-tq-restore.mjs
//
// THE CLAIMS, each an injection that must FIRE its named check:
//   UNKEYED       the deal panel unkeyed                     -> X1
//   UNREG_COMM    the Commercials form not registered        -> GUARD Commercials
//   UNREG_TERM    the Term quote tab not registered          -> GUARD Term quote
//   RESTORE_WRITE a term Restore that PATCHes the record     -> TR-1 nothing written
//   TERM_ALLKINDS the term list without its kind filter      -> LIST term only
//   COMM_ALLKINDS the Commercials list without its filter    -> LIST Commercials only
//   WON_RESTORE   Restore offered on a Closed Won deal       -> WON
//   reverted      the tree as committed                      -> every check passes
// Where an injection must leave the OTHER tab's guard green, that is asserted
// too, so an unregistered source is shown to be the cause.
//
// IN THE WORKING TREE, BECAUSE THE SERVER SERVES IT (rule 9): a temp copy is
// not what the browser loads. So the harness does what Verification 44
// requires of a harness pointed at served source:
// - refuses to start on a dirty tree or a leftover in-flight marker;
// - snapshots every file it touches by FULL PATH and asserts the snapshot;
// - refuses an anchor that does not occur exactly once;
// - rebuilds, and proves the SERVED bundle changed before measuring;
// - restores after EVERY injection, compares bytes, rebuilds, and proves the
//   served bundle is the baseline again, stopping dead on any mismatch;
// - every stop path restores first (process.exit runs no finally);
// - ends with a full reverted run.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO = '/Users/johnfryatt/terminus-tms'
const OUT = join(REPO, '.verify', 'tq-restore')
const MARKER = join(REPO, '.verify', 'tq-restore', 'CALIBRATION-IN-FLIGHT')
const RUN = Date.now().toString(36)
mkdirSync(OUT, { recursive: true })
const md5 = (b) => createHash('md5').update(b).digest('hex')
if (!process.env.PUPPETEER_PATH) { console.error('refused: no PUPPETEER_PATH'); process.exit(2) }
if (existsSync(MARKER)) { console.error(`refused: ${MARKER} exists; a previous run did not restore. Restore from git HEAD and remove it.`); process.exit(2) }
const dirty = execFileSync('git', ['-C', REPO, 'status', '--porcelain', '--', 'frontend-react/src', 'frontend', 'src', 'frontend-react/dist']).toString().trim()
if (dirty) { console.error(`refused: the served tree is not clean:\n${dirty}`); process.exit(2) }

const MAIN = 'frontend-react/src/main.tsx'
const TQ = 'frontend-react/src/term-quote/TermQuoteTab.tsx'
const VC = 'frontend-react/src/versions/VersionCard.tsx'
const VCH = 'frontend-react/src/versions/VersionCardHost.tsx'
const BUNDLE = 'frontend-react/dist/terminus-react.js'
const FILES = [MAIN, TQ, VC, VCH, BUNDLE]
const snap = new Map(FILES.map((f) => [f, readFileSync(join(REPO, f))]))
for (const f of FILES) if (!snap.get(f)?.length) { console.error(`refused: no snapshot of ${f}`); process.exit(2) }
const served = () => execFileSync('curl', ['-s', 'http://localhost:3000/app/terminus-react.js']).toString()
const BASE = md5(served())
if (BASE !== md5(snap.get(BUNDLE))) { console.error('refused: the served bundle is not the committed build'); process.exit(2) }
writeFileSync(MARKER, RUN)

const build = () => execFileSync('npm', ['run', 'build:react'], { cwd: REPO, stdio: 'pipe' })
const restoreAll = () => {
  for (const [f, b] of snap) writeFileSync(join(REPO, f), b)
  for (const [f, b] of snap) if (md5(readFileSync(join(REPO, f))) !== md5(b)) return `${f} did not restore byte for byte`
  build()
  if (md5(readFileSync(join(REPO, BUNDLE))) !== md5(snap.get(BUNDLE))) return 'the rebuilt bundle is not the committed one'
  if (md5(served()) !== BASE) return 'the served bundle is not the baseline after the restore'
  return null
}
const stop = (why) => {
  const r = restoreAll()
  if (r) { console.log(`STOPPED: ${why}. AND THE RESTORE FAILED: ${r}. Marker left at ${MARKER}; restore from git HEAD.`); process.exit(4) }
  rmSync(MARKER)
  console.log(`STOPPED: ${why}. Restored and verified byte for byte.`); process.exit(3)
}
const inject = (file, anchor, replacement) => {
  const src = readFileSync(join(REPO, file), 'utf8')
  const n = src.split(anchor).length - 1
  if (n !== 1) stop(`anchor occurs ${n} times in ${file}: ${anchor.slice(0, 70)}`)
  const out = src.replace(anchor, replacement)
  writeFileSync(join(REPO, file), out)
  if (readFileSync(join(REPO, file), 'utf8') !== out || out === src) stop(`the injection into ${file} did not land`)
}
const probe = (only, tag) => new Promise((resolve) => {
  const t0 = Date.now()
  const p = spawn(process.execPath, ['--env-file=.env', 'scripts/probe-tq-restore-click.mjs', tag], { cwd: REPO, env: { ...process.env, ...(only ? { ONLY: only } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] })
  let text = ''
  p.stdout.on('data', (d) => { text += d }); p.stderr.on('data', (d) => { text += d })
  p.on('exit', (code) => resolve({ code, text, ms: Date.now() - t0 }))
})
const failed = (t, name) => new RegExp(`^FAIL  ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(t)
const passed = (t, name) => new RegExp(`^PASS  ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(t)

const RUNS = [
  { id: 'UNKEYED', only: 'X1', edits: [[MAIN, '            key={opp.id}\n', '']],
    want: (t) => failed(t, "X1: record B opened after A shows B's own 20 units and 48 months"), expect: "FAIL X1: record B opened after A shows B's own..." },
  { id: 'UNREG_COMM', only: 'GUARD', edits: [[MAIN, "    shellServices.registerDirtySource('commercials', () => seam.hasUnsavedChanges())\n", '']],
    want: (t) => failed(t, 'GUARD Commercials: navigating to another record asks') && passed(t, 'GUARD Term quote: navigating to another record asks'),
    expect: 'FAIL GUARD Commercials: navigating..., while GUARD Term quote passes' },
  { id: 'UNREG_TERM', only: 'GUARD', edits: [[TQ, "  useEffect(() => shell.registerDirtySource('term_quote', () => editedRef.current), [shell])\n", '']],
    want: (t) => failed(t, 'GUARD Term quote: navigating to another record asks') && passed(t, 'GUARD Commercials: navigating to another record asks'),
    expect: 'FAIL GUARD Term quote: navigating..., while GUARD Commercials passes' },
  { id: 'RESTORE_WRITE', only: 'TR', edits: [[TQ, '      seam.populateForm(d.inputs ?? {})\n', '      seam.populateForm(d.inputs ?? {})\n      await patch(opp.id, { payload: { termQuote: d.inputs } })\n']],
    want: (t) => failed(t, 'TR-1: and nothing written'), expect: 'FAIL TR-1: and nothing written' },
  { id: 'TERM_ALLKINDS', only: 'LIST', edits: [[TQ, "versions={versions.filter((v) => v.kind === 'term_quote')}", 'versions={versions}']],
    want: (t) => failed(t, "LIST: the Term quote tab lists the record's term versions only"), expect: "FAIL LIST: the Term quote tab lists the record's term versions only" },
  { id: 'COMM_ALLKINDS', only: 'LIST', edits: [[VC, "  const listed = versions.filter((v) => (v.kind ?? 'commercials') === 'commercials')\n", '  const listed = versions\n']],
    want: (t) => failed(t, 'LIST: the Commercials tab lists Commercials versions only'), expect: 'FAIL LIST: the Commercials tab lists Commercials versions only' },
  { id: 'WON_RESTORE', only: 'WON', edits: [[VCH, '      canRestore={!won}\n', '      canRestore\n']],
    want: (t) => failed(t, 'WON: a Closed Won Commercials deal lists its versions and offers no Restore'), expect: 'FAIL WON: a Closed Won Commercials deal ... offers no Restore' },
  { id: 'reverted', only: null, edits: [],
    want: (t, code) => code === 0 && /^(\d+)\/\1 checks passed$/m.test(t), expect: 'exit 0, every check passed' },
]

let good = 0
for (const run of RUNS) {
  for (const [f, a, r] of run.edits) inject(f, a, r)
  if (run.edits.length) {
    try { build() } catch (e) { stop(`${run.id}: the injected source did not build: ${String(e.stderr ?? e).slice(0, 300)}`) }
    if (md5(served()) === BASE) stop(`${run.id}: the served bundle did not change, so the injection is not live`)
  }
  const tag = `tqcal${RUN}${run.id.toLowerCase().replace(/_/g, '')}`
  const r = await probe(run.only, tag)
  writeFileSync(join(OUT, `cal-${RUN}-${run.id}.txt`), r.text)
  // A run that printed no result did not run (Verification 48): stop, never score it.
  if (!/\d+\/\d+ checks passed/.test(r.text)) stop(`${run.id}: no result line after ${r.ms}ms, so it did not run`)
  const ok = run.want(r.text, r.code)
  if (ok) good++
  console.log(`${run.id.padEnd(14)} ${ok ? 'AS EXPECTED' : 'NOT AS EXPECTED'}  exit ${r.code}  ${r.ms}ms  (${run.only ?? 'all'})`)
  console.log(`               expected: ${run.expect}`)
  for (const l of r.text.split('\n').filter((x) => /^FAIL|checks passed/.test(x))) console.log(`               ${l.slice(0, 220)}`)
  if (run.edits.length) { const bad = restoreAll(); if (bad) { console.log(`STOPPED: ${run.id}: ${bad}. Marker left.`); process.exit(4) } }
  if (!ok) stop(`${run.id} not as expected`)
}
const bad = restoreAll()
if (bad) { console.log(`STOPPED at the end: ${bad}. Marker left.`); process.exit(4) }
rmSync(MARKER)
console.log(`${good}/${RUNS.length} as expected; transcripts in ${OUT}/cal-${RUN}-*.txt`)
