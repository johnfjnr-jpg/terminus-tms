// ── CALIBRATION FOR F1, F2 AND F4 ───────────────────────────────────────
//
// Verification 9: a guard not proven capable of failing is not evidence. Every
// injection below names the TEST it must turn red, and a run that goes red on
// some OTHER test scores FIRED-ELSEWHERE, which is not a pass: an injection
// that kills a probe six lines early prints the same colour as one that
// falsifies the claim.
//
// Verification 44 is the harness's own discipline. Snapshots keyed on the FULL
// PATH, never the basename, because this estate mirrors names across
// directories on purpose. The snapshot is asserted to exist BEFORE anything is
// injected, the restore is compared byte for byte after EVERY injection, and an
// in-flight marker refuses a run that starts on somebody else's wreckage.
// Written in Node because zsh does not word-split an unquoted variable, and a
// harness that silently snapshots nothing is the one tool nobody tests.
//
// Every stop path between the first injection and the final restore is a
// restore path: `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/payment-fix/snapshots`
const MARKER = `${SNAP}/IN-FLIGHT`
mkdirSync(SNAP, { recursive: true })
const key = (p) => p.replaceAll('/', '_')
const abs = (p) => `${ROOT}/${p}`

// `live` injections need the bundle rebuilt and the browser driven; `suite`
// ones are settled by vitest alone, which is minutes cheaper.
const INJECTIONS = [
  { id: 'F1 one shared component',
    kind: 'suite', file: 'frontend-react/src/deal/DealToggle.tsx',
    find: '      className={`btn-ghost deal-toggle${on ? \' is-on\' : \'\'}`}',
    put: '      className={`btn-ghost deal-toggle${on ? \' is-on\' : \'\'}`} data-deal-toggle={undefined}',
    expect: 'F1a' },
  { id: 'F1 no second dress on the mode control',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: '                <DealToggle id="deal-payment-mode-toggle" testid="deal-payment-mode-toggle"',
    put: '                <DealToggle id="deal-payment-mode-toggle" testid="deal-payment-mode-toggleX"',
    expect: 'F1a' },
  { id: 'F1 the state named inside the button',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: "    label: opexOn ? 'OPEX' : 'CAPEX',",
    put: "    label: opexOn ? 'OPEX mode' : 'CAPEX mode',",
    expect: 'F1c' },
  { id: 'F4 invoicing living in the rail',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: '              <div className="ring-radio-group ring-radio-column" id="deal-invoicing-toggle">',
    put: '              <div className="ring-radio-group ring-radio-column" id="deal-invoicing-toggleX">',
    expect: 'F4a' },
  { id: 'F4 exactly one invoicing group',
    kind: 'suite', file: 'frontend-react/src/deal/section5.tsx',
    find: '              {/* F4: the hybrid invoicing group is gone. One control in the\n                  rail writes the choice for every structure. */}',
    put: '              <div className="ring-radio-group" id="deal-hybrid-invoicing-toggle">\n                {INVOICING.map((o) => (\n                  <RingRadio key={o.value} attr="data-invoicing" value={o.value} label={o.label}\n                    active={ui.invoicing === o.value} onPick={() => setUi({ invoicing: o.value })} />\n                ))}\n              </div>',
    expect: 'F4b' },
  /* ── THE RE-POINTED PURE ASSERTIONS ────────────────────────────────────
     Two gate suites were red against this change and were re-pointed rather
     than relaxed. A re-pointed assertion is a NEW assertion and gets the same
     treatment as one: proven capable of failing, on its own name. */
  { id: 'F1 section5 not writing the treatment itself',
    kind: 'pure', file: 'frontend-react/src/deal/section5.tsx',
    find: '              <div className="ring-radio-group ring-radio-column" id="deal-invoicing-toggle">',
    put: '              <div className="btn-ghost deal-toggle ring-radio-column" id="deal-invoicing-toggle">',
    expect: 'W-E: gross up takes the factoring treatment' },
  { id: 'F4 the retired containers staying retired',
    kind: 'pure', file: 'frontend-react/src/deal/section5.tsx',
    find: '          <div id="deal-hybrid-group"',
    put: '          <div id="deal-year-schedule" />\n          <div id="deal-hybrid-group"',
    expect: 'FINDING 3: a year cell may not be given less room' },
  // ── THE TWO THAT ONLY A BROWSER CAN SETTLE ────────────────────────────
  // Both are CSS. jsdom loads no stylesheet, so neither claim has ANY reader
  // in the suite: a silent verdict here would mean the guard is decorative.
  { id: 'F2 the one gutter',
    kind: 'live', file: 'frontend/style.css',
    find: '  flex-direction: column;\n  align-items: flex-start;\n  gap: 12px;\n}',
    put: '  flex-direction: column;\n  gap: 12px;\n}',
    expect: 'F2 ONE GUTTER' },
  { id: 'F4 the heading belonging to its own group',
    kind: 'live', file: 'frontend/style.css',
    find: '  display: flex;\n  flex-direction: column;\n  gap: 22px;\n}',
    put: '  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}',
    expect: 'the INVOICING heading belongs to its own group' },
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

// Captured to a file and the file is read. Never a filter over a run whose
// result is not yet known.
const run = (kind) => {
  const out = `${ROOT}/.verify/payment-fix/cal-run.txt`
  const env = { ...process.env, C_FAST: '1' }
  try {
    let text = ''
    if (kind === 'pure') {
      text += String(execSync('npm run test', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }))
    } else {
      text += String(execSync('npx vitest run src/__tests__/payment-fix.test.tsx',
        { cwd: `${ROOT}/frontend-react`, stdio: ['ignore', 'pipe', 'pipe'] }))
    }
    if (kind === 'live') {
      text += String(execSync('node --env-file=.env scripts/payment-fix/probe-live.mjs',
        { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }))
    }
    writeFileSync(out, text)
    return { failed: false, text }
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
      restore('a refused anchor'); rmSync(MARKER, { force: true }); process.exit(4)
    }
    writeFileSync(abs(inj.file), src.replace(inj.find, inj.put))
    // CONFIRM THE EDIT LANDED BEFORE MEASURING. An edit that failed plus a run
    // that proceeded is indistinguishable from a run on the edited file.
    if (readFileSync(abs(inj.file), 'utf8') === src) {
      console.error(`STOP: ${inj.id} did not change ${inj.file}`)
      restore('an edit that did not land'); rmSync(MARKER, { force: true }); process.exit(5)
    }
    if (inj.kind === 'live') execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const t0 = Date.now()
    const { failed, text } = run(inj.kind)
    const ms = Date.now() - t0
    // WHICH assertion failed, not whether the run failed. And the failure count
    // is printed beside the verdict: a SILENT verdict with a non-zero count is
    // the matcher missing, not a missing detector.
    // `node --test` prints `✖`, vitest prints `×` and `FAIL `. Counting
    // ONE of them would report zero failures on a suite that is failing, which
    // reads exactly like a clean calibration (Verification 16's corollary).
    const failCount = (text.match(/FAIL |× |✖ /g) ?? []).length
    /* THE MATCHER MUST KNOW EVERY RUNNER'S SPELLING OF A FAILURE, and the
       first version did not: it looked for vitest's `×` and `FAIL ` only,
       so the two `node --test` injections scored FIRED-ELSEWHERE while both
       were falsifying exactly the assertion they named. `node --test` marks a
       failure with `✖`.

       Verification 51's caveat: before a verdict blames a missing detector,
       confirm the matcher saw the run. Both had a NON-ZERO failure count, which
       is the tell that the injection fired and the matcher missed. */
    const q = inj.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const named = new RegExp(`(FAIL|×|✖)\\s.*${q}`).test(text)
    /* ── A RUN THAT PRODUCED NO RESULT IS STOPPED, NEVER SCORED ──────────
       Verification 48. This harness scored one: the F2 injection came back
       FIRED-ELSEWHERE with ZERO failure lines in 39,027ms against a ~15,000ms
       normal. Re-run alone, the same injection failed on exactly its own named
       assertion - `F2 ONE GUTTER ... spread 28.7px` - so the verdict was about
       a probe that had DIED, not about a guard that missed.

       A failed run with no failure lines at all is not a weak result. It is no
       result, and reading it as one is how an environment fault gets recorded
       as a finding about the product. */
    if (failed && failCount === 0) {
      console.error(`\nSTOP: ${inj.id} FAILED with no failing assertion in ${ms}ms.`)
      console.error('The run produced no result, so it cannot be scored. Output:')
      console.error(`  ${ROOT}/.verify/payment-fix/cal-run.txt`)
      restore('a run that produced no result'); rmSync(MARKER, { force: true }); process.exit(6)
    }
    const verdict = !failed ? 'SILENT' : named ? 'FIRED' : 'FIRED-ELSEWHERE'
    results.push({ ...inj, verdict, ms, failCount })
    console.log(`  ${verdict.padEnd(15)} ${inj.id.padEnd(42)} expects ${inj.expect}`
      + `   ${failCount} failing, ${ms}ms`)
    restore(inj.id)
  }
} finally {
  restore('the sweep')
  rmSync(MARKER, { force: true })
}

// THE FINAL REVERTED RUN. It has been the sole witness four times in this
// estate, twice catching a harness that had become part of what it measures.
execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
console.log('\nreverted run:')
const t0 = Date.now()
const final = run('live')
console.log(`  ${final.failed ? 'RED' : 'GREEN'}  ${Date.now() - t0}ms`)

const fired = results.filter((r) => r.verdict === 'FIRED').length
console.log(`\n${fired} of ${results.length} injections fired on their OWN named assertion`)
if (fired !== results.length || final.failed) process.exit(1)
