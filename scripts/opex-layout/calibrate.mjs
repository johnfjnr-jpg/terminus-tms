// ── CALIBRATION: EVERY NEW GUARD SHOWN FIRING, AND ON ITS OWN ASSERTION ──
//
// Verification 9. A guard not proven capable of failing is not evidence, and
// Verification 9's own clause is that a calibration reads WHICH assertion
// failed rather than whether the run failed: an injection that kills the probe
// six lines early prints the same red as one that falsifies the claim.
//
// So every injection names the TEST it must turn red, and a run that goes red
// on some other test is scored FIRED-ELSEWHERE, which is not a pass.
//
// ── THE HARNESS'S OWN DISCIPLINE, Verification 44 ────────────────────────
//
// Snapshots keyed on the FULL PATH, never the basename: this repository
// mirrors names across directories on purpose. The snapshot is asserted to
// exist BEFORE anything is injected, the restore is compared BYTE FOR BYTE
// after every injection, and an in-flight marker refuses a run that begins on
// somebody else's wreckage. Written in Node rather than a shell because zsh
// does not word-split an unquoted variable and a harness that silently
// snapshots nothing is the one piece of tooling nobody tests.
//
// Every stop path between the first injection and the final restore is itself
// a restore path: `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/opex-layout/snapshots`
const MARKER = `${SNAP}/IN-FLIGHT`
mkdirSync(SNAP, { recursive: true })

const key = (p) => p.replaceAll('/', '_')
const abs = (p) => `${ROOT}/${p}`

const INJECTIONS = [
  { id: 'M1 the two labels and their order',
    file: 'frontend-react/src/deal/section5.tsx',
    find: '            <span className="opex-switch-label" data-testid="deal-mode-label-opex"',
    put: '            <span className="opex-switch-label" data-testid="deal-mode-label-opexX"',
    expect: 'L1a' },
  { id: 'M2 the active marking',
    file: 'frontend-react/src/deal/section5.tsx',
    find: "              data-active={opexOn ? 'true' : 'false'}>OPEX</span>",
    put: "              data-active={'false'}>OPEX</span>",
    expect: 'L1b' },
  { id: 'M3 the accessible name the moved label made necessary',
    file: 'frontend-react/src/deal/section5.tsx',
    find: "              aria-label={`Payment mode, currently ${opexOn ? 'OPEX' : 'CAPEX'}`}",
    put: "              aria-label={''}",
    expect: 'L1c' },
  { id: 'M4 the radios being ABSENT under OPEX',
    file: 'frontend-react/src/deal/section5.tsx',
    find: '          {opexOn ? null : (\n            <div className="ring-radio-group" id="deal-structure-toggle" role="radiogroup">',
    put: '          {false ? null : (\n            <div className="ring-radio-group" id="deal-structure-toggle" role="radiogroup">',
    expect: 'L2b' },
  { id: 'M5 the radios RETURNING under CAPEX',
    file: 'frontend-react/src/deal/section5.tsx',
    find: '          {opexOn ? null : (\n            <div className="ring-radio-group" id="deal-structure-toggle" role="radiogroup">',
    put: '          {true ? null : (\n            <div className="ring-radio-group" id="deal-structure-toggle" role="radiogroup">',
    expect: 'L2a' },
  { id: 'M6 the yearly table moving into the row',
    file: 'frontend-react/src/deal/section5.tsx',
    find: '            {opexOn ? <div id="deal-opex-year-slot">{yearSchedule}</div> : null}',
    put: '            {null}',
    expect: 'L3a' },
]

const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run died mid-injection.`)
  console.error(`Restore from ${SNAP} by hand before running this again.`)
  process.exit(2)
}

const original = {}
for (const f of FILES) {
  const src = readFileSync(abs(f), 'utf8')
  original[f] = src
  writeFileSync(`${SNAP}/${key(f)}`, src)
  if (!existsSync(`${SNAP}/${key(f)}`)) {
    console.error(`REFUSING: the snapshot of ${f} does not exist after writing it`)
    process.exit(2)
  }
}
writeFileSync(MARKER, new Date().toISOString())

const restore = (what) => {
  for (const f of FILES) {
    writeFileSync(abs(f), readFileSync(`${SNAP}/${key(f)}`, 'utf8'))
    if (readFileSync(abs(f), 'utf8') !== original[f]) {
      console.error(`STOP: ${f} did not restore byte for byte after ${what}`)
      console.error(`The marker is LEFT in place on purpose. Restore from ${SNAP}.`)
      process.exit(3)
    }
  }
}

// The runner's own output is captured to a file and the file is read, never
// piped through a filter whose result is not yet known.
const run = () => {
  const out = `${ROOT}/.verify/opex-layout/cal-run.txt`
  try {
    const a = execSync('npm test', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const b = execSync('npm run test:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    writeFileSync(out, `${a}${b}`)
    return { failed: false, text: 'PASSED' }
  } catch (e) {
    const text = `${e.stdout ?? ''}${e.stderr ?? ''}`
    writeFileSync(out, text)
    return { failed: true, text }
  }
}

const results = []
try {
  for (const inj of INJECTIONS) {
    const src = original[inj.file]
    const n = src.split(inj.find).length - 1
    if (n !== 1) {
      console.error(`STOP: ${inj.id} anchor matches ${n} times in ${inj.file}, not once`)
      restore('a refused anchor')
      rmSync(MARKER, { force: true })
      process.exit(4)
    }
    writeFileSync(abs(inj.file), src.replace(inj.find, inj.put))
    // CONFIRM THE EDIT LANDED BEFORE MEASURING. An edit that fails plus a run
    // that proceeds is indistinguishable from a run on the edited file.
    if (readFileSync(abs(inj.file), 'utf8') === src) {
      console.error(`STOP: ${inj.id} did not change ${inj.file}`)
      restore('an edit that did not land')
      rmSync(MARKER, { force: true })
      process.exit(5)
    }
    const t0 = Date.now()
    const { failed, text } = run()
    const ms = Date.now() - t0
    // WHICH assertion failed, not whether the run failed.
    const named = new RegExp(`${inj.expect}[:b]`).test(text) || text.includes(`> ${inj.expect}`)
    const verdict = !failed ? 'SILENT'
      : named ? 'FIRED'
      : 'FIRED-ELSEWHERE'
    results.push({ ...inj, verdict, ms })
    console.log(`  ${verdict.padEnd(15)} ${inj.id.padEnd(40)} expects ${inj.expect}  ${ms}ms`)
    restore(inj.id)
  }
} finally {
  restore('the sweep')
  rmSync(MARKER, { force: true })
}

// THE FINAL REVERTED RUN. It has been the sole witness four times in this
// estate, twice catching a harness that had become part of what it measured.
console.log('\nreverted run:')
const t0 = Date.now()
const final = run()
console.log(`  ${final.failed ? 'RED' : 'GREEN'}  ${Date.now() - t0}ms`)

const fired = results.filter((r) => r.verdict === 'FIRED').length
console.log(`\n${fired} of ${results.length} injections fired on their OWN named assertion`)
if (fired !== results.length || final.failed) process.exit(1)
