// ── CALIBRATION: EVERY NEW GUARD OF THE ADJACENCY ROUND, BOTH DIRECTIONS ──
//
// John's ruling 2026-09-26 names the six: A1 a stretched row, A2 a regrown
// stretch, A4 a stacked label, A5 misplaced radios, A6 a broken edge, and a
// regrown dead selector.
//
// Verification 44's discipline throughout: snapshots keyed on the full path and
// verified before injecting, restores compared byte for byte after every
// injection, an in-flight marker that refuses a run starting on wreckage, and
// the final reverted run that has caught a broken harness four times.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/adjacency/snapshots`
const MARKER = `${SNAP}/IN-FLIGHT`
mkdirSync(SNAP, { recursive: true })
const key = (p) => p.replaceAll('/', '_')
const abs = (p) => `${ROOT}/${p}`
const CSS = 'frontend/style.css'
const ANCHOR = '.product-grid .ig-total { border-bottom: none; }'

const INJECTIONS = [
  /* A1: a GOOD row stretched. The result tier's cap is what brought the Profit
     row inside the bound, so removing it puts the row back over the backstop. */
  /* A GOOD ROW STRETCHED, AND THE FIRST TWO VERSIONS OF THIS WERE TOO WEAK.
     Removing the RESULT TIER's own cap took the statement's worst row to 570px
     at 1920, under the 600px backstop, so the guard correctly did not fire:
     the 671 and 731 readings that prompted R-ADJ2 come from states this sweep
     does not walk. The cap FAMILY's primary member is `.stmt`'s own 980px, and
     removing that lets the whole statement track the panel, which is the shape
     A1 exists to name: the gap both exceeds the backstop and GROWS with
     width. */
  { id: 'A1 a good row STRETCHED (the statement cap)', kind: 'live', file: CSS,
    find: '.stmt { margin-top: 4px; max-width: 980px; }',
    put: '.stmt { margin-top: 4px; }',
    expect: 'A1' },

  /* A2: the stretch regrown. `width: max-content` is what stops the grid
     taking the panel, so removing it is the defect coming back. */
  /* THE FIRST VERSION OF THIS INJECTION WAS TOO WEAK AND CAME BACK SILENT,
     AND THE GUARD WAS RIGHT NOT TO FIRE. It restored `minmax(0, 1fr)` on the
     FOUR-column template only and dropped `width: max-content`. The state under
     test shows the install half, so `.product-grid--full`'s `repeat(8, auto)`
     was still in force: the slack split eight ways and the gap grew 76px,
     inside the 100px allowance. The original defect needed the 1fr on the
     product column of the template ACTUALLY IN USE, which takes all of it. */
  { id: 'A2 the panel-sized stretch REGROWN (both locks)', kind: 'live', file: CSS,
    find: ['  grid-template-columns: auto auto auto auto;\n  width: max-content;\n  max-width: 100%;',
      '.product-grid--full {\n  grid-template-columns: repeat(8, auto);\n}',
      '  grid-template-columns: max-content max-content;\n  justify-content: start;'],
    put: ['  grid-template-columns: minmax(0, 1fr) auto auto auto;\n  max-width: 100%;',
      '.product-grid--full {\n  grid-template-columns: minmax(0, 1fr) repeat(7, auto);\n}',
      '  grid-template-columns: minmax(0, 1fr) max-content;\n  justify-content: start;'],
    expect: 'A1 no row' },

  /* A4: the label put back on one line with its value. */
  /* AND THIS ONE WAS TOO WEAK BY EXACTLY ONE PIXEL OF THRESHOLD. Turning the
     stack into a row left `gap: 6px` in force, and A4 fails BELOW 6px, so the
     injection produced the tightest layout the guard still calls acceptable.
     The defect it reproduces is a label TOUCHING its value, so the gap goes
     too. */
  { id: 'A4 the label UNSTACKED onto its value', kind: 'live', file: CSS,
    find: '#deal-intake-head .deal-field {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 6px;\n}',
    put: '#deal-intake-head .deal-field {\n  display: flex;\n  flex-direction: row;\n  align-items: flex-start;\n  gap: 0;\n}',
    expect: 'A4 no label touches its value' },

  /* A5: the radios moved off the schedule they change. */
  { id: 'A5 the radios MISPLACED below the schedule', kind: 'live', file: CSS,
    find: '.opex-tables > .a5-invoicing { grid-column: 2; grid-row: 1; align-self: end; }',
    put: '.opex-tables > .a5-invoicing { grid-column: 1; grid-row: 1; align-self: end; }',
    expect: 'A5 the radios sit OVER' },

  /* A6: one row stops sharing the card's two-column shape. */
  { id: 'A6 one row leaves the shared edge', kind: 'live', file: CSS,
    find: '#deal-factoring-fields .deal-field,\n#deal-factoring-fields .po-row {',
    put: '#deal-factoring-fields .po-row {',
    expect: 'A6' },

  /* ── W2: THE OVERPRINT FORCED BACK ─────────────────────────────────────
     The heading returns to the radios' row, which is exactly the state this
     round found: two boxes in one grid cell, printing over each other. It is
     also the calibration that matters most here, because the assertion it
     proves is the one that REPLACED a check which passed while the screen was
     wrong. */
  { id: 'W2 the heading forced back into the radios row', kind: 'live', file: CSS,
    find: '.opex-tables > .opex-year-head {\n  grid-column: 2;\n  grid-row: 2;',
    put: '.opex-tables > .opex-year-head {\n  grid-column: 2;\n  grid-row: 1;',
    expect: 'W2 no box on the schedule stack intersects' },

  /* ── W1: THE HALVES STACKED AGAIN ─────────────────────────────────────── */
  { id: 'W1 the two halves STACKED again', kind: 'live', file: CSS,
    find: '.units-row {\n  display: grid;\n  grid-template-columns: max-content max-content;',
    put: '.units-row {\n  display: block;\n  grid-template-columns: max-content max-content;',
    expect: 'W1 the milestone table sits RIGHT' },

  /* THE METHOD FIX ITSELF: a dead selector regrown. */
  { id: 'a DEAD SELECTOR regrown', kind: 'suite', file: CSS,
    find: ANCHOR,
    put: `${ANCHOR}\n.zz-phantom-nothing-renders-this { color: red; }`,
    expect: 'no NEW stylesheet selector' },
]
const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

if (existsSync(MARKER)) { console.error(`REFUSING: ${MARKER} exists`); process.exit(2) }
const original = {}
for (const f of FILES) {
  const src = readFileSync(abs(f), 'utf8')
  original[f] = src
  writeFileSync(`${SNAP}/${key(f)}`, src)
  if (!existsSync(`${SNAP}/${key(f)}`)) { console.error(`REFUSING: snapshot of ${f} missing`); process.exit(2) }
}
writeFileSync(MARKER, new Date().toISOString())
const restore = (what) => {
  for (const f of FILES) {
    writeFileSync(abs(f), readFileSync(`${SNAP}/${key(f)}`, 'utf8'))
    if (readFileSync(abs(f), 'utf8') !== original[f]) {
      console.error(`STOP: ${f} did not restore byte for byte after ${what}`)
      console.error(`The marker is LEFT in place. Restore from ${SNAP}.`)
      process.exit(3)
    }
  }
}
const run = (kind) => {
  const out = `${ROOT}/.verify/adjacency/cal-run.txt`
  const env = { ...process.env, C_FAST: '1' }
  try {
    let text = String(execSync('node --test scripts/tests/dead-selectors.test.mjs',
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }))
    if (kind === 'live') {
      text += String(execSync('node --env-file=.env scripts/adjacency/probe-gaps.mjs',
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
    /* ── AN INJECTION MAY NEED MORE THAN ONE EDIT, because a claim can be
       protected by more than one mechanism. A2 went SILENT once W1 wrapped the
       product grid in a `max-content` track: the grid is content-sized by its
       PARENT as well as by itself, so removing its own `width: max-content` no
       longer lets it stretch. The guard was right; the injection was removing
       one of two locks. Each pair is still anchored EXACTLY ONCE. */
    const src = original[inj.file]
    const pairs = Array.isArray(inj.find)
      ? inj.find.map((f, i) => [f, inj.put[i]])
      : [[inj.find, inj.put]]
    let next = src
    for (const [f, put] of pairs) {
      const n = next.split(f).length - 1
      if (n !== 1) {
        console.error(`STOP: ${inj.id} anchor matches ${n} times in ${inj.file}, not once`)
        restore('a refused anchor'); rmSync(MARKER, { force: true }); process.exit(4)
      }
      next = next.replace(f, put)
    }
    writeFileSync(abs(inj.file), next)
    if (readFileSync(abs(inj.file), 'utf8') === src) {
      console.error(`STOP: ${inj.id} did not change ${inj.file}`)
      restore('an edit that did not land'); rmSync(MARKER, { force: true }); process.exit(5)
    }
    execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const t0 = Date.now()
    const { failed, text } = run(inj.kind)
    const ms = Date.now() - t0
    const failCount = (text.match(/FAIL |✖ /g) ?? []).length
    if (failed && failCount === 0) {
      console.error(`\nSTOP: ${inj.id} FAILED with no failing assertion in ${ms}ms.`)
      restore('a run that produced no result'); rmSync(MARKER, { force: true }); process.exit(6)
    }
    const q = inj.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const named = new RegExp(`(FAIL|✖)\\s.*${q}`).test(text)
    const verdict = !failed ? 'SILENT' : named ? 'FIRED' : 'FIRED-ELSEWHERE'
    results.push({ ...inj, verdict, ms, failCount })
    console.log(`  ${verdict.padEnd(15)} ${inj.id.padEnd(46)} ${failCount} failing, ${ms}ms`)
    restore(inj.id)
  }
} finally {
  restore('the sweep')
  rmSync(MARKER, { force: true })
}
execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
console.log('\nreverted run:')
const t0 = Date.now()
const final = run('live')
console.log(`  ${final.failed ? 'RED' : 'GREEN'}  ${Date.now() - t0}ms`)
const fired = results.filter((r) => r.verdict === 'FIRED').length
console.log(`\n${fired} of ${results.length} injections fired on their OWN named assertion`)
if (fired !== results.length || final.failed) process.exit(1)
