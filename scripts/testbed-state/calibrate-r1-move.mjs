// ── R1 PART 2 CALIBRATION: the card move ─────────────────────────────────
//
// Three claims, three injections, each asserted to fire on ITS OWN assertion
// rather than merely to turn the run red (Verification 9's borrowed clause).
//
// The harness snapshots actual bytes keyed by FULL PATH (Verification 44),
// refuses to start if a previous run left its in-flight marker behind, and
// byte-compares every restore before continuing.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(process.argv[2] ?? '.')
const SP = resolve(process.argv[3])
const MARKER = `${SP}/IN_FLIGHT`

mkdirSync(SP, { recursive: true })
if (existsSync(MARKER)) {
  console.error(`REFUSING: a previous run left ${MARKER}.`)
  console.error(`Restore the sources from ${SP} by hand, then delete the marker.`)
  process.exit(2)
}

const key = (rel) => `${SP}/${rel.replaceAll('/', '_')}`
const FILES = [
  'frontend-react/src/testbed/TestBedPanel.tsx',
  'frontend-react/src/testbed/TestBedHost.tsx',
  'frontend-react/src/testbed/CommercialsCards.tsx',
]
for (const rel of FILES) {
  const snap = key(rel)
  mkdirSync(dirname(snap), { recursive: true })
  writeFileSync(snap, readFileSync(`${ROOT}/${rel}`))
  if (!existsSync(snap) || readFileSync(snap).length === 0) {
    console.error(`NO SNAPSHOT for ${rel} - refusing to inject`); process.exit(2)
  }
}
writeFileSync(MARKER, new Date(0).toISOString())

const restore = () => {
  for (const rel of FILES) {
    writeFileSync(`${ROOT}/${rel}`, readFileSync(key(rel)))
    if (!readFileSync(`${ROOT}/${rel}`).equals(readFileSync(key(rel)))) {
      console.error(`RESTORE MISMATCH on ${rel} - stopping dead`); process.exit(3)
    }
  }
}

const run = () => {
  try {
    return execFileSync('npx', ['vitest', 'run', 'src/__tests__/testbed-draft-survival.test.tsx'],
      { cwd: `${ROOT}/frontend-react`, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}

const patch = (rel, from, to) => {
  const p = `${ROOT}/${rel}`
  const src = readFileSync(p, 'utf8')
  if (!src.includes(from)) { console.error(`ANCHOR NOT FOUND in ${rel}`); restore(); process.exit(4) }
  if (src.split(from).length > 2) { console.error(`ANCHOR NOT UNIQUE in ${rel}`); restore(); process.exit(4) }
  writeFileSync(p, src.replace(from, to))
}

// Each injection names the assertion MESSAGE it must produce. Anchoring on the
// message rather than on the exit code is what separates "the right check
// fired" from "something went red".
const CASES = [
  {
    name: 'the cards are ALSO left on Reference',
    apply: () => patch('frontend-react/src/testbed/TestBedPanel.tsx',
      '      {/* R1: Sensor Counts and Commercials MOVED',
      '      <CommercialsCards rows={rows} fields={fields} />\n      {/* R1: Sensor Counts and Commercials MOVED'),
    also: () => patch('frontend-react/src/testbed/TestBedPanel.tsx',
      "import { FieldRow } from '../field-row/FieldRow'",
      "import { FieldRow } from '../field-row/FieldRow'\nimport { CommercialsCards } from './CommercialsCards'"),
    expect: 'Sensor Counts is STILL on Reference',
  },
  {
    name: 'the Commercials slot goes back to null',
    apply: () => patch('frontend-react/src/testbed/TestBedHost.tsx',
      '        commercials={\n          <CommercialsCards rows={rows} fields={testBedDescriptors(source)}\n            costBreakdown={costBreakdownNode} />}',
      '        commercials={null}'),
    expect: 'did not arrive, or arrived twice',
  },
  {
    name: 'the moved cards get a store of their own',
    apply: () => patch('frontend-react/src/testbed/CommercialsCards.tsx',
      'export function CommercialsCards({ rows, fields, costBreakdown }: {',
      'import { useFieldRows as mkRows } from \'../field-row/useFieldRows\'\nexport function CommercialsCards({ rows: _ignored, fields, costBreakdown }: {'),
    also: () => patch('frontend-react/src/testbed/CommercialsCards.tsx',
      '  const row = (name: string) => {',
      '  const rows = mkRows(fields)\n  const row = (name: string) => {'),
    expect: 'the moved card has its OWN store',
  },
  {
    // THE PRE-FIX STATE EXACTLY: the bar back inside the Reference panel and
    // gone from the host. Reference keeps a bar; Commercials has none, which
    // is the defect a live probe caught and no assertion here could see.
    name: 'the edit bar goes back inside the Reference panel',
    apply: () => patch('frontend-react/src/testbed/TestBedHost.tsx',
      '      <EditBar rows={rows} onSave={(c) => { void onSave(c) }} saveId="tb-react-save-all" />',
      ''),
    also: () => {
      patch('frontend-react/src/testbed/TestBedPanel.tsx',
        "import { FieldRow } from '../field-row/FieldRow'",
        "import { FieldRow } from '../field-row/FieldRow'\nimport { EditBar } from '../field-row/EditBar'")
      patch('frontend-react/src/testbed/TestBedPanel.tsx',
        '      {/* R1: THE EDIT BAR MOVED TO THE HOST',
        '      <EditBar rows={rows} onSave={() => {}} saveId="tb-react-save-all" />\n      {/* R1: THE EDIT BAR MOVED TO THE HOST')
    },
    expect: 'the moved cost rows have NO WAY TO SAVE',
  },
  {
    // R2: the allowlist widening is the whole write path. Take the two keys
    // back out and the route refuses again - which the suite must see, not
    // only the probe.
    name: 'the follow-up keys leave the panel (no third cell)',
    apply: () => patch('frontend-react/src/testbed/TestBedPanel.tsx',
      '        {followUp}\n', ''),
    // ANCHORED ON THE FIRST ASSERTION IN THE TEST, not the one the injection
    // is "about". A test aborts at its first failure, so a matcher taken from
    // a later assertion reports SILENT on an injection that fired
    // (Verification 51's caveat). This one read SILENT with 2 failures until
    // it was re-anchored, which is the tell the caveat names.
    expect: 'no follow-up card, or two of them',
  },
  {
    name: 'the follow-up save goes to the CONTACTS route',
    apply: () => patch('frontend-react/src/testbed/TestBedHost.tsx',
      "const r = await shell.api('PATCH', `/api/test-beds/${bed.id}`, {\n      payload: next,",
      "const r = await shell.api('PATCH', `/api/contacts/${bed.id}`, {\n      payload: next,"),
    expect: 'the save did not fire, or went to the wrong route',
  },
  {
    name: 'the Summary row keeps its 170px label column',
    apply: () => patch('frontend-react/src/testbed/TestBedPanel.tsx',
      "{row('summary', '')}", "{row('summary')}"),
    // jsdom has no layout, so the ONE-LINE claim is a live-probe claim and
    // this injection is expected SILENT here. Recorded rather than hidden:
    // probe-r2-live.mjs was calibrated on it separately and read 4 lines at
    // 58px injected, 1 line at 228px fixed.
    expect: '__EXPECTED_SILENT__',
    silentIsCorrect: true,
  },
]

let failures = 0
for (const c of CASES) {
  c.apply(); if (c.also) c.also()
  const t0 = Date.now()
  const out = run()
  const ms = Date.now() - t0
  const fired = out.includes(c.expect)
  const anyFail = /Tests\s+\d+ failed/.test(out)
  const failCount = (out.match(/Tests\s+(\d+) failed/) ?? [, '0'])[1]
  console.log(`${fired ? 'FIRED  ' : 'SILENT '} ${c.name}`)
  console.log(`         ${ms}ms, ${failCount} assertion(s) failed, matched on: "${c.expect}"`)
  // A SILENT verdict with a non-zero failure count means the injection fired
  // and the MATCHER missed (Verification 51's caveat), which is a different
  // finding from an unasserted claim. Print enough to tell them apart.
  if (!fired && anyFail) {
    console.log('         NOTE: something failed but not the named assertion. Matcher, not silence:')
    for (const l of out.split('\n').filter((l) => l.includes('AssertionError'))) console.log(`           ${l.trim()}`)
  }
  if (c.silentIsCorrect) {
    console.log('         declared SILENT by design: jsdom has no layout. Calibrated live instead.')
  } else if (!fired) failures++
  restore()
}

const out = run()
const reverted = /Tests\s+10 passed/.test(out)
console.log(`\nreverted run: ${reverted ? '10/10 pass' : 'NOT CLEAN'}`)
if (!reverted) { console.log(out.split('\n').slice(-25).join('\n')); failures++ }
for (const rel of FILES) {
  const same = readFileSync(`${ROOT}/${rel}`).equals(readFileSync(key(rel)))
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${rel}`)
  if (!same) failures++
}
rmSync(MARKER)
process.exit(failures ? 1 : 0)
