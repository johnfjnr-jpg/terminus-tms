// THE CALIBRATION CASES FOR scripts/golden-deals-check, in a module of their
// own so two things can read them: calibrate.mjs, which injects them, and
// scripts/tests/calibration-anchors.test.mjs, which runs under npm test and
// asserts every anchor still occurs exactly once in its target file.
//
// WHY THE SECOND READER EXISTS. calibrate.mjs is not a gate stage, so when G5
// made case 3's anchor occur twice (ee177d8) nothing ran it and nothing said
// so for six weeks (Verification 9: a detector nothing schedules rots, and its
// silence reads like its success). The anchor test is cheap enough to be in
// the pure suite, so an anchor that stops being unique, or stops existing, is
// a red pure stage on the commit that broke it. Ruled by John 2026-11-16,
// GOLDEN_STATUS Phase 2 sign-off.
//
// The cases are BUILT, not declared, because some anchors are derived from the
// committed expectations (a deal's title, its hash, a G2 figure whose line is
// unique). Both readers therefore see exactly the anchors a run would inject.
import { readFileSync } from 'node:fs'

export class CalibrationPrecondition extends Error {}

// EVERY FILE ANY CASE TOUCHES, INCLUDING THE ONES A RUN WRITES. compute.mjs
// writes expectations.json and GOLDEN_DEALS.md, so both are snapshotted even
// though no anchor names the markdown: a compute case that left it changed
// would otherwise survive the sweep.
export const paths = (ROOT) => ({
  deals: `${ROOT}/scripts/golden-deals/deals.mjs`,
  calc: `${ROOT}/src/lib/deal-calculator.js`,
  expect: `${ROOT}/scripts/golden-deals/expectations.json`,
  harness: `${ROOT}/scripts/golden-deals-check`,
  md: `${ROOT}/GOLDEN_DEALS.md`,
  gate: `${ROOT}/scripts/verify-all.mjs`,
})

/**
 * @param P          paths(ROOT)
 * @param expectSrc  the committed expectations.json, as text
 * @param run        { harness, compute, echoTest, gate }, each () => { code, out, ms }.
 *                   The anchor test passes stubs: it never runs a case.
 * Throws CalibrationPrecondition when the committed state is not the one the
 * cases were written for.
 */
export function buildCases(P, expectSrc, run) {
  const { harness, compute, echoTest, gate } = run
  // ── ANCHORS BUILT FROM THE DEAL THEY TARGET ──────────────────────────────
  const E = JSON.parse(expectSrc)
  const titleLine = (id) => `    "${id}": {\n      "title": ${JSON.stringify(E.deals[id].title)},\n`
  const need = (cond, msg) => { if (!cond) throw new CalibrationPrecondition(msg) }
  need(E.deals.G2?.status === 'CONFIRMED' && E.deals.G3?.status === 'CONFIRMED' && E.deals.G4?.status === 'CONFIRMED',
    'the cases below expect G2, G3 and G4 CONFIRMED. If that has legitimately changed, re-point them.')
  need(E.deals.G1?.status === 'PROVISIONAL' && E.deals.G5?.status === 'PROVISIONAL',
    'the cases below expect G1 and G5 PROVISIONAL. If that has legitimately changed, re-point them.')
  const conf = (id) => `      "status": "CONFIRMED",\n      "confirmedBy": "John Fryatt",\n      "confirmedOn": "2026-09-28",\n      "confirmedFiguresSha256": "${E.deals[id].confirmedFiguresSha256}",\n`
  const prov = '      "status": "PROVISIONAL",\n'
  // One G2 figure whose line is unique in the whole file, for the R-GS5 case.
  const g2Figure = (() => {
    const src = expectSrc
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
  return { CASES, E }
}
