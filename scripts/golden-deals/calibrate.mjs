// Calibration for scripts/golden-deals-check, per Verification 9 and 44.
//
// Snapshots keyed on the FULL PATH, asserted present before any injection,
// in-flight marker so a killed run cannot bless its wreckage, restore compared
// byte for byte after EVERY injection, and a final reverted run.
//
// SCORED ON WHICH CHECK FIRED, not on the exit code. Verification 9's clause: a
// red run and a red run look the same, and an injection that kills the harness
// early reports FIRED while proving nothing.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const SP = process.env.TMS_SCRATCH ?? mkdtempSync(join(tmpdir(), 'tms-golden-cal-'))
const MARKER = `${SP}/GOLDENS-CALIBRATION-IN-FLIGHT`

// EVERY FILE ANY CASE TOUCHES. `scripts/golden-deals-check` was added
// 2026-09-29 with the case that injects into it, and the pair is the reason
// `inject` now refuses an unsnapshotted file: adding the case without the file
// made the harness CRASH mid-sweep, after four successful injections, with the
// in-flight marker still set. It happened to be harmless because the throw came
// before any write, and "happened to be" is not a property a fault-injection
// harness may rely on.
const FILES = [
  `${ROOT}/scripts/golden-deals/deals.mjs`,
  `${ROOT}/src/lib/deal-calculator.js`,
  `${ROOT}/scripts/golden-deals/expectations.json`,
  `${ROOT}/scripts/golden-deals-check`,
]
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

const run = () => {
  const t0 = Date.now()
  try {
    const out = execFileSync('node', ['scripts/golden-deals-check'], { cwd: ROOT, encoding: 'utf8' })
    return { code: 0, out, ms: Date.now() - t0 }
  } catch (e) { return { code: e.status ?? -1, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - t0 } }
}

/** Replace exactly once, or refuse: an anchor that moved is how five of six failed edits failed. */
const inject = (file, anchor, replacement) => {
  // REFUSE RATHER THAN CRASH. A case naming a file outside FILES has no
  // snapshot, so nothing could restore it: the sweep stops, restores what it
  // does hold, and says which file is missing.
  if (!original.has(file)) {
    restoreAll(); unlinkSync(MARKER)
    console.error(`REFUSING: ${file} is injected into but is not in FILES, so it has no snapshot.`)
    process.exit(3)
  }
  const src = original.get(file).toString('utf8')
  const hits = src.split(anchor).length - 1
  if (hits !== 1) { restoreAll(); unlinkSync(MARKER); console.error(`anchor x${hits} in ${file}, need 1`); process.exit(3) }
  writeFileSync(file, src.replace(anchor, replacement))
}

const CASES = [
  {
    name: 'ONE RATE IN ONE DEAL: G4 install override 1650 -> 1655',
    file: `${ROOT}/scripts/golden-deals/deals.mjs`,
    anchor: '    inSsExisting: 1650,',
    put: '    inSsExisting: 1655,',
    // Must name G4 figures and must NOT name G1, G2 or G3: a perturbation
    // confined to one deal that reported all four would be measuring nothing.
    expect: (o) => /FAIL {2}G4 \d+ figure\(s\) moved/.test(o)
      && /rates\.inSsExisting\.value: expected 1650, got 1655/.test(o)
      && /PASS {2}G1 all/.test(o) && /PASS {2}G2 all/.test(o) && /PASS {2}G3 all/.test(o),
  },
  {
    name: 'THE RATE CARD: catalog ssUnitCost 8000 -> 8001',
    file: `${ROOT}/scripts/golden-deals/deals.mjs`,
    anchor: '  ssUnitCost: 8000,',
    put: '  ssUnitCost: 8001,',
    // The catalog guard must catch it FIRST and name the rate, rather than
    // leaving four deals to report hundreds of moved figures each.
    expect: (o) => /FAIL {2}the rate card has changed: ssUnitCost/.test(o),
  },
  {
    name: "THE COUPLING: G1 loses structure: 'single'",
    file: `${ROOT}/scripts/golden-deals/deals.mjs`,
    anchor: "    structure: 'single',",
    put: '',
    expect: (o) => /FAIL {2}G1 is an OPEX deal whose structure is not single/.test(o),
  },
  {
    name: 'THE PHASE 0 DEFECT REINTRODUCED: contractor milestones read a stored usd',
    file: `${ROOT}/src/lib/deal-calculator.js`,
    anchor: '      .map((x) => ({ ...x, usd: milestoneUsd(x.pct, contractorBase) }))\n',
    put: '',
    // The pairwise VACUITY guard is the one that must fire: with the defect back
    // the seven equalities all hold and the timing stops moving.
    expect: (o) => /FAIL {2}G2 staging moved NOTHING at all/.test(o)
      && /FAIL {2}G2 does not stage its contractor schedule/.test(o),
  },
  // ── THE CONFIRMATION GUARD, RE-POINTED AND WIDENED. 2026-09-29 ─────────
  //
  // This was ONE case anchored on `"status": "PROVISIONAL",` and flipping it to
  // CONFIRMED. That anchor no longer exists: John confirmed the figures on
  // 2026-09-28 and the file now says CONFIRMED legitimately.
  //
  // Verification 9's clause exactly: A CALIBRATION ANCHORED ON THE STATE IT
  // WATCHES STOPS BEING CALIBRATED THE DAY THAT STATE CHANGES. Left alone it
  // would have failed on a missing anchor, which at least refuses loudly; the
  // worse version is an anchor that still matches something and no longer means
  // anything.
  //
  // AND THE ROUND THAT SATISFIES A GUARD IS THE ROUND MOST LIKELY TO DISABLE
  // IT. The name-and-date requirement exists because a bare hand-flip once left
  // the suite green with its warning gone. This round performs that flip
  // legitimately, so the refusal is re-proved rather than assumed, on BOTH
  // fields rather than the one that happened to be tested.
  {
    name: 'CONFIRMED WITHOUT A NAME: confirmedBy removed',
    file: `${ROOT}/scripts/golden-deals/expectations.json`,
    anchor: '  "confirmedBy": "John Fryatt",\n',
    put: '',
    expect: (o) => /FAIL {2}the expectations say CONFIRMED and do not say by whom or when/.test(o),
  },
  {
    name: 'CONFIRMED WITHOUT A DATE: confirmedOn removed',
    file: `${ROOT}/scripts/golden-deals/expectations.json`,
    anchor: '  "confirmedOn": "2026-09-28",\n',
    put: '',
    expect: (o) => /FAIL {2}the expectations say CONFIRMED and do not say by whom or when/.test(o),
  },
  {
    // The third branch of the status check, which nothing had ever exercised:
    // a status that is neither of the two words. Without this the branch is a
    // claim rather than a control.
    name: 'AN UNKNOWN STATUS',
    file: `${ROOT}/scripts/golden-deals/expectations.json`,
    anchor: '  "status": "CONFIRMED",',
    put: '  "status": "SIGNED OFF",',
    expect: (o) => /FAIL {2}the expectations carry an unknown status "SIGNED OFF"/.test(o),
  },
  {
    // AND THE MESSAGE ITSELF IS A CLAIM. With the status confirmed, a green run
    // must SAY so: a suite that went quiet on confirmation would leave a reader
    // unable to tell a checked baseline from an unchecked one.
    name: 'THE CONFIRMED MESSAGE: the green run must state it',
    file: `${ROOT}/scripts/golden-deals-check`,
    anchor: "  console.log('PRICING MAY NOT MOVE WITHOUT THIS SUITE GOING RED. A change that moves any')\n",
    put: '',
    expect: (o) => !/PRICING MAY NOT MOVE WITHOUT THIS SUITE GOING RED/.test(o),
  },
]

console.log('=== 0. HEALTHY ===')
const healthy = run()
console.log(`exit ${healthy.code}  ${healthy.ms}ms  ${/^PASS: /m.test(healthy.out) ? 'GREEN' : 'NOT GREEN'}`)
if (healthy.code !== 0) { console.log(healthy.out); restoreAll(); unlinkSync(MARKER); console.error('healthy run is not green, refusing to calibrate'); process.exit(3) }

let allFired = true
for (const [i, c] of CASES.entries()) {
  inject(c.file, c.anchor, c.put)
  const r = run()
  const fired = c.expect(r.out)
  if (!fired) allFired = false
  console.log(`\n=== ${i + 1}. ${c.name} ===`)
  console.log(`exit ${r.code}  ${r.ms}ms  ${fired ? 'FIRED as expected' : '*** DID NOT FIRE THE EXPECTED CHECK ***'}`)
  for (const line of r.out.split('\n').filter((l) => /FAIL/.test(l))) console.log(`   ${line.trim()}`)
  if (!fired) console.log(r.out)
  restoreAll()
}

console.log('\n=== FINAL REVERTED RUN ===')
const rev = run()
const green = rev.code === 0 && /^PASS: /m.test(rev.out)
let identical = true
for (const f of FILES) if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) identical = false
console.log(`exit ${rev.code}  ${rev.ms}ms  ${green ? 'GREEN' : 'NOT GREEN'}   bytes identical: ${identical}`)

unlinkSync(MARKER)
console.log(`\n${allFired && green && identical ? `CALIBRATED: ${CASES.length} of ${CASES.length} fired, reverted green, every file byte-identical.` : 'CALIBRATION FAILED.'}`)
process.exit(allFired && green && identical ? 0 : 1)
