#!/usr/bin/env node
// ── THE CALIBRATION SWEEP FOR THE COMMERCIALS RECOVERY ───────────────────
//
// CLAUDE.md Verification 9: a suite green on its first run proves nothing, and
// that is exactly the signature of tests written to agree with the component
// they were derived from. Each injection below removes ONE behaviour and the
// sweep requires the NAMED test to go red.
//
// ── IT ANCHORS ON THE TEST NAME, NOT ON THE EXIT CODE ────────────────────
//
// Verification 9's own clause: an injection can kill a probe six lines before
// the check it was written for, and a red run looks identical either way. So
// each case names the test it must falsify, and the verdict reads WHICH test
// failed. The failure COUNT is printed beside every verdict, because a SILENT
// verdict with a non-zero count means the matcher missed rather than that the
// claim is unasserted (Verification 51).
//
// ── AND IT PROTECTS THE WORK IT IS POINTED AT ────────────────────────────
//
// Verification 44, from two harnesses that destroyed the uncommitted work they
// were calibrating in consecutive phases:
//
//   - the snapshot is verified to EXIST before anything is injected;
//   - the restore is compared BYTE FOR BYTE after every injection, and a
//     mismatch stops the run dead rather than compounding;
//   - an IN-FLIGHT marker is written before the first injection and removed
//     only after the last clean restore, so a killed run cannot have its
//     mutation snapshotted as the original by the next one;
//   - snapshots are keyed on the FULL PATH with separators replaced, because
//     this repository mirrors basenames across directories on purpose;
//   - an anchor that is not unique in its file is refused.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = join(ROOT, '.scratch', 'calibrate-recovery')
const INFLIGHT = join(SNAP, 'IN_FLIGHT')

const SRC = 'frontend-react/src/testbed/'
const F = {
  rows: `${SRC}costBreakdown.ts`,
  score: `${SRC}QualificationScore.tsx`,
  tabs: `${SRC}SubTabs.tsx`,
  comm: `${SRC}CommercialsCards.tsx`,
  cards: `${SRC}CostBreakdownCards.tsx`,
  host: `${SRC}TestBedHost.tsx`,
}

const SUITES = {
  rows: 'src/__tests__/cost-breakdown.test.ts',
  rest: 'src/__tests__/testbed-recovery.test.tsx',
  view: 'src/__tests__/testbed-view-surface.test.tsx',
}

/**
 * Each case: the file, a UNIQUE anchor, its replacement, the suite to run and
 * the EXACT test name that must fail.
 */
const CASES = [
  // ── L1 ────────────────────────────────────────────────────────────────
  { name: 'total is FIRST', file: F.rows, suite: SUITES.rows,
    mustFail: 'TOTAL COST IS THE FIRST ROW of the summary card',
    from: `        { label: 'Total Cost', value: b.totalCost, weight: 'total' },
        { label: 'Hardware', value: g.hardwareGroup.rawTotalCost, weight: 'summary' },`,
    to: `        { label: 'Hardware', value: g.hardwareGroup.rawTotalCost, weight: 'summary' },
        { label: 'Total Cost', value: b.totalCost, weight: 'total' },` },

  { name: 'no warranty row', file: F.rows, suite: SUITES.rows,
    mustFail: 'renders none even when the engine reports a warranty cost',
    from: `        { label: 'Hardware subtotal', value: g.hardwareGroup.rawTotalCost, weight: 'subtotal' },`,
    to: `        ...(b.hardware.warrantyCost > 0 ? [{ label: \`Warranty (\${b.hardware.warrantyUnits} units)\`, value: rowCost(g.hardwareGroup, 'hwWarranty'), weight: 'item' as const }] : []),
        { label: 'Hardware subtotal', value: g.hardwareGroup.rawTotalCost, weight: 'subtotal' },` },

  { name: 'labels quote the DRAFT', file: F.rows, suite: SUITES.rows,
    mustFail: 'follows the draft when the draft changes, on the SAME breakdown',
    from: `  const unit = (count: string, rate: string) => \`\${Number(count) || 0} × \${money(Number(rate) || 0)}\``,
    to: `  const unit = (_count: string, rate: string) => \`\${b.hardware.totalUnits} × \${money(Number(rate) || 0)}\`` },

  { name: 'cost not price', file: F.rows, suite: SUITES.rows,
    mustFail: 'renders no *Price figure anywhere',
    from: `  group.rows.find((r) => r.key === key)?.rawCost ?? 0`,
    to: `  group.rows.find((r) => r.key === key)?.rawPrice ?? 0` },

  { name: 'summary has no dividers', file: F.rows, suite: SUITES.rows,
    mustFail: 'gives the summary card NO dividing subtotals',
    from: `        { label: 'Installation', value: g.installGroup.rawTotalCost, weight: 'summary' },`,
    to: `        { label: 'Installation', value: g.installGroup.rawTotalCost, weight: 'subtotal' },` },

  { name: 'hosting subtotal is PER MONTH', file: F.rows, suite: SUITES.rows,
    mustFail: 'gives the hosting card its PER MONTH subtotal, not the term',
    from: `        { label: 'Hosting subtotal / month', value: b.hostingMonthCost, weight: 'subtotal' },`,
    to: `        { label: 'Hosting subtotal / month', value: b.hostingTermCost, weight: 'subtotal' },` },

  { name: 'isBreakdown refuses junk', file: F.rows, suite: SUITES.rows,
    mustFail: 'refuses the shapes a broken or absent response produces',
    from: `  if (typeof v !== 'object' || v === null) return false`,
    to: `  if (true) return true
  if (typeof v !== 'object' || v === null) return false` },

  // ── L2 ────────────────────────────────────────────────────────────────
  { name: 'score reads the PAYLOAD', file: F.score, suite: SUITES.rest,
    mustFail: 'reads the RECORD PAYLOAD, which is where scores are stored',
    from: `  const raw = payload?.[key]`,
    to: `  const raw = (undefined as unknown[] | undefined)` },

  { name: 'current score is the LATEST', file: F.score, suite: SUITES.rest,
    mustFail: 'shows the CURRENT score, which is the latest by `at`',
    from: `  return sorted[sorted.length - 1] ?? null`,
    to: `  return sorted[0] ?? null` },

  { name: 'the card carries no control', file: F.score, suite: SUITES.rest,
    mustFail: 'carries NO control: the card says where scoring happens instead',
    from: `            <span className="tb-score-name">{c.name ?? c.criterion_key}</span>`,
    to: `            <button type="button" className="tb-score-name">{c.name ?? c.criterion_key}</button>` },

  // ── L3 ────────────────────────────────────────────────────────────────
  { name: 'hosting names its unit', file: F.comm, suite: SUITES.rest,
    mustFail: 'each rate card NAMES ITS UNIT, which the flat card did not',
    from: `    title: 'Hosting Cost Rates ($ / unit / month)',`,
    to: `    title: 'Hosting Cost Rates',` },

  { name: 'only hosting is per month', file: F.comm, suite: SUITES.rest,
    mustFail: 'hosting is the ONLY per-month card',
    from: `    title: 'Installation Cost Rates ($ / unit)',`,
    to: `    title: 'Installation Cost Rates ($ / unit / month)',` },

  { name: 'the retired testid is GONE', file: F.comm, suite: SUITES.rest,
    mustFail: 'the RETIRED testid is gone, and the retained one is not',
    from: `    testId: 'tb-card-rates-hardware',`,
    to: `    testId: 'tb-card-commercials',` },

  // ── L4 ────────────────────────────────────────────────────────────────
  { name: 'only the open pane renders', file: F.tabs, suite: SUITES.rest,
    mustFail: 'renders ONLY the open pane, which is what keeps History lazy',
    from: `      {open
        ? (`,
    to: `      {tabs.map((t) => t.content)}
      {open
        ? (` },

  { name: 'roving tabindex', file: F.tabs, suite: SUITES.rest,
    mustFail: 'the ROVING TABINDEX puts exactly one tab in the page tab sequence',
    from: `            tabIndex={t.key === current ? 0 : -1}`,
    to: `            tabIndex={0}` },

  { name: 'arrow keys move selection', file: F.tabs, suite: SUITES.rest,
    mustFail: 'ARROW KEYS move the selection, wrapping at both ends',
    from: `    if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }`,
    to: `    if (false) { e.preventDefault(); move(1) }` },

  { name: 'the estate tab treatment', file: F.tabs, suite: SUITES.rest,
    mustFail: "carries the estate's own tab treatment, not a new one",
    from: `            className={t.key === current ? 'detail-tab sub-tab active' : 'detail-tab sub-tab'}`,
    to: `            className={t.key === current ? 'tb-subtab tb-subtab-on' : 'tb-subtab'}` },

  // ── THE LIVE DEFECT THIS ROUND FOUND ──────────────────────────────────
  //
  // Puts the draft reporting back where it was - an effect in the Reference
  // panel, which unmounts on a tab switch - which is exactly the state that
  // shipped last round and that no test could see.
  { name: 'preview fires from ANY tab', file: F.host, suite: SUITES.view,
    mustFail: 'typing a sensor count on COMMERCIALS schedules a preview',
    from: `  useEffect(() => { onDraftsChange(rows.changes) }, [rows.changes, onDraftsChange])`,
    to: `  // injected: reporting removed, as it was before the fix` },

  // ── L1's render ───────────────────────────────────────────────────────
  { name: 'marker in the card TITLE', file: F.cards, suite: SUITES.rest,
    mustFail: "the unsaved marker rides in the SUMMARY CARD'S OWN TITLE",
    from: `            {unsaved && c.testId === 'tb-cost-card-summary'
              ? <span className="tb-cost-unsaved" data-testid="tb-cost-preview-marker">unsaved</span>
              : null}
          </p>`,
    to: `          </p>
          {unsaved && c.testId === 'tb-cost-card-summary'
            ? <span className="tb-cost-unsaved" data-testid="tb-cost-preview-marker">unsaved</span>
            : null}` },
]

// ── SNAPSHOT, KEYED ON THE FULL PATH ─────────────────────────────────────
const snapPath = (f) => join(SNAP, f.replaceAll('/', '_'))
const read = (f) => readFileSync(join(ROOT, f), 'utf8')
const write = (f, s) => writeFileSync(join(ROOT, f), s)

if (existsSync(INFLIGHT)) {
  console.error(`REFUSING TO RUN: ${INFLIGHT} exists.`)
  console.error('A previous sweep was killed mid-injection, so the working tree may')
  console.error(`carry its mutation. Restore from ${SNAP} by hand, then delete the marker.`)
  console.error('Snapshotting now would bless the damage as the original.')
  process.exit(2)
}

rmSync(SNAP, { recursive: true, force: true })
mkdirSync(SNAP, { recursive: true })

const FILES = [...new Set(CASES.map((c) => c.file))]
for (const f of FILES) {
  writeFileSync(snapPath(f), read(f))
  if (!existsSync(snapPath(f))) {
    console.error(`FATAL: snapshot for ${f} was not written. Nothing injected.`)
    process.exit(2)
  }
}
// Every anchor must be unique in its file BEFORE anything is touched.
for (const c of CASES) {
  const n = read(c.file).split(c.from).length - 1
  if (n !== 1) {
    console.error(`FATAL: anchor for "${c.name}" occurs ${n} times in ${c.file}, needs exactly 1.`)
    process.exit(2)
  }
}
writeFileSync(INFLIGHT, new Date().toISOString())

const runSuite = (suite) => {
  const r = spawnSync('npm', ['--prefix', 'frontend-react', 'run', 'test', '--',
    '--run', suite, '--reporter=verbose'],
  { cwd: ROOT, encoding: 'utf8', shell: false })
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}

const failCount = (out) => {
  const m = out.match(/Tests\s+(?:(\d+) failed)/)
  return m ? Number(m[1]) : 0
}
/** Did the NAMED test fail, rather than merely something failing? */
const named = (out, testName) =>
  out.split('\n').some((l) => /(×|✕|FAIL)/.test(l) && l.includes(testName))

const results = []
for (const c of CASES) {
  const original = read(c.file)
  write(c.file, original.split(c.from).join(c.to))
  if (read(c.file) === original) {
    console.error(`FATAL: injection "${c.name}" changed nothing. Aborting.`)
    write(c.file, readFileSync(snapPath(c.file), 'utf8'))
    rmSync(INFLIGHT, { force: true })
    process.exit(2)
  }
  const out = runSuite(c.suite)
  const fails = failCount(out)
  const hit = named(out, c.mustFail)

  // RESTORE, THEN COMPARE BYTE FOR BYTE, THEN CONTINUE.
  write(c.file, readFileSync(snapPath(c.file), 'utf8'))
  if (read(c.file) !== original) {
    console.error(`FATAL: ${c.file} did not restore byte-for-byte after "${c.name}".`)
    console.error(`Stopping rather than compounding. Snapshots: ${SNAP}`)
    process.exit(2)
  }
  results.push({ ...c, fails, hit })
  console.log(`${hit ? 'FIRED  ' : 'SILENT '} ${c.name.padEnd(32)} failures=${fails}`)
}

rmSync(INFLIGHT, { force: true })

// ── THE REVERTED RUN. It has been the sole witness four times ────────────
const clean = [...new Set(CASES.map((c) => c.suite))].map((s) => ({ s, out: runSuite(s) }))
const dirty = clean.filter(({ out }) => failCount(out) > 0)

console.log('\n' + '='.repeat(66))
const silent = results.filter((r) => !r.hit)
for (const r of silent) {
  console.log(`SILENT: "${r.name}" -> expected "${r.mustFail}" to fail, ${r.fails} failed.`)
  console.log(r.fails > 0
    ? '        Non-zero failures: the MATCHER missed, not a missing assertion.'
    : '        ZERO failures: nothing asserts this claim (Verification 51).')
}
for (const { s, out } of dirty) console.log(`REVERTED RUN STILL RED: ${s}, ${failCount(out)} failing.`)
console.log(`${results.filter((r) => r.hit).length}/${results.length} fired, ` +
  `${dirty.length === 0 ? 'reverted clean' : 'REVERTED DIRTY'}`)
process.exit(silent.length === 0 && dirty.length === 0 ? 0 : 1)
