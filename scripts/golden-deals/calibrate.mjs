// Calibration for scripts/golden-deals-check, per Verification 9 and 44.
//
//   node scripts/golden-deals/calibrate.mjs
//
// Snapshots keyed on the FULL PATH, asserted present before any injection,
// in-flight marker so a killed run cannot bless its wreckage, restore compared
// byte for byte after EVERY case, every stop path restores before it exits,
// and a final reverted run.
//
// SCORED ON WHICH CHECK FIRED, not on the exit code. Verification 9's clause: a
// red run and a red run look the same, and an injection that kills the harness
// early reports FIRED while proving nothing.
//
// ── REBUILT 2026-11-15, GOLDEN_STATUS ROUND. IT HAD BEEN DEAD SINCE ee177d8 ──
//
// The previous version could not run from 2026-09-30: G5 made the G1 coupling
// anchor `structure: 'single'` occur twice, and the status cases anchored on a
// file-wide `"status": "CONFIRMED"` that R-TL1a's recompute had removed. The
// gate's comment went on saying "five injections, five fired" for six weeks.
// Verification 9, twice over: a calibration anchored on the state it watches
// stops being calibrated the day that state changes, and a detector nothing
// schedules rots while its silence reads like its success.
//
// So anchors are now either (a) built from the deal they target, carrying that
// deal's own title or id so they cannot match another deal, or (b) checked for
// uniqueness by `inject`, which refuses rather than guessing.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const SP = process.env.TMS_SCRATCH ?? mkdtempSync(join(tmpdir(), 'tms-golden-cal-'))
const MARKER = `${SP}/GOLDENS-CALIBRATION-IN-FLIGHT`

// EVERY FILE ANY CASE TOUCHES, INCLUDING THE ONES A RUN WRITES. compute.mjs
// writes expectations.json and GOLDEN_DEALS.md, so both are snapshotted even
// though no anchor names the markdown: a compute case that left it changed
// would otherwise survive the sweep.
const P = {
  deals: `${ROOT}/scripts/golden-deals/deals.mjs`,
  calc: `${ROOT}/src/lib/deal-calculator.js`,
  expect: `${ROOT}/scripts/golden-deals/expectations.json`,
  harness: `${ROOT}/scripts/golden-deals-check`,
  md: `${ROOT}/GOLDEN_DEALS.md`,
  gate: `${ROOT}/scripts/verify-all.mjs`,
}
const FILES = Object.values(P)
const snapPath = (f) => `${SP}/snap_${f.slice(1).replace(/\//g, '_')}`

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, a previous run did not restore.`)
  process.exit(3)
}
const original = new Map()
for (const f of FILES) {
  const bytes = readFileSync(f)
  original.set(f, bytes)
  writeFileSync(snapPath(f), bytes)
  if (!existsSync(snapPath(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
}
writeFileSync(MARKER, FILES.join('\n'))

const restoreAll = () => {
  for (const f of FILES) {
    writeFileSync(f, original.get(f))
    if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) {
      console.error(`RESTORE MISMATCH on ${f}. Marker left in place deliberately.`)
      process.exit(3)
    }
  }
}
// EVERY STOP RESTORES FIRST. process.exit does not run a finally (Verification
// 44's Test Bed units clause), so a stop is itself a restore path.
const stop = (msg) => { restoreAll(); unlinkSync(MARKER); console.error(msg); process.exit(3) }

const exec = (bin, args) => {
  const t0 = Date.now()
  try {
    const out = execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out, ms: Date.now() - t0 }
  } catch (e) { return { code: e.status ?? -1, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - t0 } }
}
const harness = () => exec('node', ['scripts/golden-deals-check'])
const compute = () => exec('node', ['scripts/golden-deals/compute.mjs'])
const echoTest = () => exec('node', ['--test', 'scripts/tests/stage-echo.test.mjs'])
const gate = () => exec('node', ['scripts/verify-all.mjs'])

/** Replace exactly once in the CURRENT bytes, or stop. */
const inject = (file, anchor, replacement) => {
  if (!original.has(file)) stop(`REFUSING: ${file} is injected into but is not in FILES, so it has no snapshot.`)
  const src = readFileSync(file, 'utf8')
  const hits = src.split(anchor).length - 1
  if (hits !== 1) stop(`anchor x${hits} in ${file}, need 1:\n${anchor}`)
  writeFileSync(file, src.replace(anchor, replacement))
  // THE WRITE SIDE: confirm the edit landed before anything measures it.
  if (readFileSync(file, 'utf8') === src) stop(`injection into ${file} did not change it`)
}

// ── ANCHORS BUILT FROM THE DEAL THEY TARGET ──────────────────────────────
const E = JSON.parse(original.get(P.expect).toString('utf8'))
const titleLine = (id) => `    "${id}": {\n      "title": ${JSON.stringify(E.deals[id].title)},\n`
const need = (cond, msg) => { if (!cond) stop(`PRECONDITION: ${msg}`) }
need(E.deals.G2?.status === 'CONFIRMED' && E.deals.G3?.status === 'CONFIRMED' && E.deals.G4?.status === 'CONFIRMED',
  'the cases below expect G2, G3 and G4 CONFIRMED. If that has legitimately changed, re-point them.')
need(E.deals.G1?.status === 'PROVISIONAL' && E.deals.G5?.status === 'PROVISIONAL',
  'the cases below expect G1 and G5 PROVISIONAL. If that has legitimately changed, re-point them.')
const conf = (id) => `      "status": "CONFIRMED",\n      "confirmedBy": "John Fryatt",\n      "confirmedOn": "2026-09-28",\n      "confirmedFiguresSha256": "${E.deals[id].confirmedFiguresSha256}",\n`
const prov = '      "status": "PROVISIONAL",\n'
// One G2 figure whose line is unique in the whole file, for the R-GS5 case.
const g2Figure = (() => {
  const src = original.get(P.expect).toString('utf8')
  for (const [k, v] of Object.entries(E.deals.G2.figures)) {
    if (typeof v !== 'number') continue
    const line = `        ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`
    if (src.split(line).length - 1 === 1) return { k, v, line }
  }
  return null
})()
need(g2Figure, 'no G2 numeric figure has a unique line')

const PASS = (id) => new RegExp(`PASS {2}${id} all \\d+ figures exact`)
const has = (re) => (o) => re.test(o)
const all = (...fs) => (o) => fs.every((f) => f(o))
const not = (f) => (o) => !f(o)

const CASES = [
  {
    name: 'ONE RATE IN ONE DEAL: G4 install override 1650 -> 1655',
    edits: [[P.deals, '    inSsExisting: 1650,', '    inSsExisting: 1655,']],
    // Must name G4 and must NOT name any other deal: a perturbation confined to
    // one deal that reported several would be measuring nothing.
    expect: all(has(/FAIL {2}G4 \d+ figure\(s\) moved/), has(/rates\.inSsExisting\.value: expected 1650, got 1655/),
      has(PASS('G1')), has(PASS('G2')), has(PASS('G3')), has(PASS('G5'))),
  },
  {
    name: 'THE RATE CARD: catalog ssUnitCost 8000 -> 8001',
    edits: [[P.deals, '  ssUnitCost: 8000,', '  ssUnitCost: 8001,']],
    expect: has(/FAIL {2}the rate card has changed: ssUnitCost/),
  },
  {
    name: "THE COUPLING: G1 loses structure: 'single' (G1-only anchor)",
    edits: [[P.deals, "    structure: 'single',\n    ssExisting: 18, ssNew: 6,", '    ssExisting: 18, ssNew: 6,']],
    expect: has(/FAIL {2}G1 is an OPEX deal whose structure is not single/),
  },
  {
    name: 'THE PHASE 0 DEFECT REINTRODUCED: contractor milestones read a stored usd',
    edits: [[P.calc, '      .map((x) => ({ ...x, usd: milestoneUsd(x.pct, contractorBase) }))\n', '']],
    expect: all(has(/FAIL {2}G2 staging moved NOTHING at all/), has(/FAIL {2}G2 does not stage its contractor schedule/)),
  },
  // ── THE PER-DEAL STATUS CHECKS, ONE CASE EACH, EACH NAMING ONE DEAL ─────
  // and each asserting the OTHER confirmed deals still pass, so a check that
  // reported every deal for one deal's fault would not read as calibrated.
  {
    name: 'CHECK 1: a file-wide status reintroduced',
    edits: [[P.expect, '  "catalog": {\n', '  "status": "CONFIRMED",\n  "catalog": {\n']],
    expect: has(/FAIL {2}the expectations carry a file-wide status/),
  },
  {
    name: 'CHECK 2: G1 records no status',
    edits: [[P.expect, titleLine('G1') + prov, titleLine('G1')]],
    expect: all(has(/FAIL {2}G1 records no status/), has(/PASS {2}G5 PROVISIONAL/)),
  },
  {
    name: 'CHECK 3: G4 carries an unknown status',
    edits: [[P.expect, titleLine('G4') + '      "status": "CONFIRMED",\n', titleLine('G4') + '      "status": "SIGNED OFF",\n']],
    expect: all(has(/FAIL {2}G4 carries an unknown status "SIGNED OFF"/), has(/PASS {2}G2 CONFIRMED/), has(/PASS {2}G3 CONFIRMED/)),
  },
  {
    name: 'CHECK 4a: G3 CONFIRMED without a name',
    edits: [[P.expect, titleLine('G3') + conf('G3'), titleLine('G3') + conf('G3').replace('      "confirmedBy": "John Fryatt",\n', '')]],
    expect: all(has(/FAIL {2}G3 says CONFIRMED and does not say by whom or when/), has(/PASS {2}G2 CONFIRMED/), has(/PASS {2}G4 CONFIRMED/)),
  },
  {
    name: 'CHECK 4b: G3 CONFIRMED without a date',
    edits: [[P.expect, titleLine('G3') + conf('G3'), titleLine('G3') + conf('G3').replace('      "confirmedOn": "2026-09-28",\n', '')]],
    expect: all(has(/FAIL {2}G3 says CONFIRMED and does not say by whom or when/), has(/PASS {2}G2 CONFIRMED/), has(/PASS {2}G4 CONFIRMED/)),
  },
  {
    name: 'CHECK 5: G5 PROVISIONAL carrying a confirmer',
    edits: [[P.expect, titleLine('G5') + prov, titleLine('G5') + prov + '      "confirmedBy": "John Fryatt",\n']],
    expect: all(has(/FAIL {2}G5 is PROVISIONAL but carries confirmedBy/), has(/PASS {2}G1 PROVISIONAL/)),
  },
  {
    name: 'CHECK 6a (R-GS5): G2 CONFIRMED without confirmedFiguresSha256',
    edits: [[P.expect, `      "confirmedFiguresSha256": "${E.deals.G2.confirmedFiguresSha256}",\n`, '']],
    expect: all(has(/FAIL {2}G2 says CONFIRMED and records no confirmedFiguresSha256/), has(/PASS {2}G3 CONFIRMED/), has(/PASS {2}G4 CONFIRMED/)),
  },
  {
    // The case R-GS5 names: a hand edit of one G2 figure, CONFIRMED fields left
    // alone. Two checks must fire and both must name G2: the figure no longer
    // matches the engine, and the figures no longer hash to the confirmation.
    name: `CHECK 6b (R-GS5): one G2 figure hand-edited, CONFIRMED left (${g2Figure.k})`,
    edits: [[P.expect, g2Figure.line, g2Figure.line.replace(`: ${JSON.stringify(g2Figure.v)},`, `: ${JSON.stringify(g2Figure.v + 1)},`)]],
    expect: all(has(/FAIL {2}G2 says CONFIRMED but its figures are not the figures that were confirmed/),
      has(/FAIL {2}G2 1 figure\(s\) moved/), has(/PASS {2}G3 CONFIRMED/), has(/PASS {2}G4 CONFIRMED/)),
  },
  // ── R-GS4: THE MESSAGE AND THE BLOCK ────────────────────────────────────
  {
    name: 'R-GS4: the pricing message removed from the harness; the echo test must name it',
    edits: [[P.harness, "console.log('PRICING MAY NOT MOVE WITHOUT THIS SUITE GOING RED. A change that moves any')\n", '']],
    run: echoTest,
    expect: has(/✖ the REAL harness prints the block, with one row per deal and the R-GS4 message inside it/),
  },
  {
    // END TO END THROUGH THE REAL GATE, cut to the one stage so it takes
    // seconds. The cut is itself an injection and is restored with the rest.
    name: 'R-GS4 GATE (healthy): the gate echoes the per-deal table and the message',
    edits: [[P.gate, 'function runGate() {\n', "function runGate() {\n  STAGES.splice(0, STAGES.length, ...STAGES.filter((s) => s.name === 'golden deals'))\n"]],
    run: gate,
    // A healthy case, so "fired" means the positive witness was SEEN.
    expect: all(has(/PASS {2}golden deals/), has(/── golden deals, echoed from the stage's own output/),
      has(/^ {4}G2 +1065 +CONFIRMED +John Fryatt 2026-09-28$/m), has(/^ {4}G1 +906 +PROVISIONAL/m),
      has(/^ {2}PRICING MAY NOT MOVE WITHOUT THIS SUITE GOING RED/m), not(has(/ECHO MISSING/))),
    healthy: true,
  },
  {
    name: 'R-GS4 GATE: the harness stops printing its block; a PASSING stage must turn red',
    edits: [
      [P.gate, 'function runGate() {\n', "function runGate() {\n  STAGES.splice(0, STAGES.length, ...STAGES.filter((s) => s.name === 'golden deals'))\n"],
      [P.harness, "console.log('GOLDEN STATUS')\n", ''],
    ],
    run: gate,
    expect: all(has(/FAIL {2}golden deals/), has(/ECHO MISSING: the stage printed no "GOLDEN STATUS" block, so a passing stage is failed/)),
  },
  {
    name: 'R-GS4 GATE: a RED harness still has its table echoed',
    edits: [
      [P.gate, 'function runGate() {\n', "function runGate() {\n  STAGES.splice(0, STAGES.length, ...STAGES.filter((s) => s.name === 'golden deals'))\n"],
      [P.deals, '    inSsExisting: 1650,', '    inSsExisting: 1655,'],
    ],
    run: gate,
    expect: all(has(/FAIL {2}golden deals/), has(/^ {4}G4 +984 +CONFIRMED/m), not(has(/ECHO MISSING/))),
  },
  // ── THE COMPUTE RULE, AS THE BRIEF STATES IT ───────────────────────────
  // Change one G3 input. The harness is red on G3's moved figures and on no
  // other deal. Recompute: G3 resets to PROVISIONAL with no confirmation
  // fields, G2 and G4 stay CONFIRMED with their hashes, G1 and G5 stay
  // PROVISIONAL, and the harness is green again. Restored afterwards.
  {
    name: 'COMPUTE RULE: one G3 input moved (aqm 5 -> 6), then recompute',
    edits: [[P.deals, '    ssExisting: 26, ssNew: 11, aqm: 5, hemir: 0,', '    ssExisting: 26, ssNew: 11, aqm: 6, hemir: 0,']],
    run: () => {
      const before = harness()
      const comp = compute()
      const after = harness()
      const x = JSON.parse(readFileSync(P.expect, 'utf8'))
      const fields = (id) => Object.keys(x.deals[id]).filter((k) => k !== 'figures' && k !== 'title').join(',')
      const lines = [
        `harness before recompute: exit ${before.code}`,
        ...before.out.split('\n').filter((l) => /^ {2}(PASS|FAIL) {2}G\d (all|\d+ figure)/.test(l)),
        `compute: exit ${comp.code}`,
        ...comp.out.split('\n').filter((l) => /^ {2}G\d {2}(KEPT|RESET)/.test(l)),
        // Both sides must EXIST before they are compared (Verification 14): the
        // first version printed sha-unchanged on G1 and G5, where both are absent.
        ...['G1', 'G2', 'G3', 'G4', 'G5'].map((id) => {
          const a = x.deals[id].confirmedFiguresSha256, b = E.deals[id].confirmedFiguresSha256
          return `after: ${id} ${fields(id)} ${x.deals[id].status}${a && b && a === b ? ' sha-unchanged' : ''}`
        }),
        `harness after recompute: exit ${after.code}`,
        ...after.out.split('\n').filter((l) => /^ {2}G\d +\d+ +(PROVISIONAL|CONFIRMED)/.test(l)),
      ]
      return { code: before.code, out: lines.join('\n') + '\n', ms: before.ms + comp.ms + after.ms }
    },
    expect: all(
      has(/harness before recompute: exit 1/), has(/FAIL {2}G3 \d+ figure\(s\) moved/),
      has(/PASS {2}G1 all/), has(/PASS {2}G2 all/), has(/PASS {2}G4 all/), has(/PASS {2}G5 all/),
      has(/^ {2}G3 {2}RESET {2}PROVISIONAL {2}figures changed$/m),
      has(/^ {2}G2 {2}KEPT {3}CONFIRMED/m), has(/^ {2}G4 {2}KEPT {3}CONFIRMED/m),
      has(/^ {2}G1 {2}KEPT {3}PROVISIONAL/m), has(/^ {2}G5 {2}KEPT {3}PROVISIONAL/m),
      has(/^after: G3 status PROVISIONAL$/m),
      has(/^after: G2 status,confirmedBy,confirmedOn,confirmedFiguresSha256 CONFIRMED sha-unchanged$/m),
      has(/^after: G4 status,confirmedBy,confirmedOn,confirmedFiguresSha256 CONFIRMED sha-unchanged$/m),
      has(/^after: G1 status PROVISIONAL$/m), has(/^after: G5 status PROVISIONAL$/m),
      has(/harness after recompute: exit 0/), has(/^ {2}G3 +\d+ +PROVISIONAL +-$/m)),
  },
]

console.log('=== 0. HEALTHY ===')
const healthy = harness()
console.log(`exit ${healthy.code}  ${healthy.ms}ms  ${/^PASS: /m.test(healthy.out) ? 'GREEN' : 'NOT GREEN'}`)
if (healthy.code !== 0) { console.log(healthy.out); stop('healthy run is not green, refusing to calibrate') }

let allFired = true
for (const [i, c] of CASES.entries()) {
  for (const [f, a, p] of c.edits) inject(f, a, p)
  const r = (c.run ?? harness)()
  const fired = c.expect(r.out)
  if (!fired) allFired = false
  console.log(`\n=== ${i + 1}. ${c.name} ===`)
  console.log(`exit ${r.code}  ${r.ms}ms  ${fired ? (c.healthy ? 'WITNESSED as expected' : 'FIRED as expected') : '*** DID NOT FIRE THE EXPECTED CHECK ***'}`)
  for (const line of r.out.split('\n').filter((l) => /FAIL|ECHO MISSING|KEPT|RESET|^after:|✖/.test(l))) console.log(`   ${line.trim()}`)
  if (!fired) console.log(r.out)
  restoreAll()
}

console.log('\n=== FINAL REVERTED RUN ===')
const rev = harness()
const green = rev.code === 0 && /^PASS: /m.test(rev.out)
let identical = true
for (const f of FILES) if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) identical = false
console.log(`exit ${rev.code}  ${rev.ms}ms  ${green ? 'GREEN' : 'NOT GREEN'}   bytes identical: ${identical}`)

unlinkSync(MARKER)
console.log(`\n${allFired && green && identical ? `CALIBRATED: ${CASES.length} of ${CASES.length} fired, reverted green, every file byte-identical.` : 'CALIBRATION FAILED.'}`)
process.exit(allFired && green && identical ? 0 : 1)
