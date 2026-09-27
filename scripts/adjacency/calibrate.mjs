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
  /* ── RE-POINTED BY R-US1, AND ITS OLD MECHANISM NO LONGER EXISTS ────────
     This injected `minmax(0, 1fr)` into `.product-grid--full`, the eight-track
     template of the MERGED grid. R-US1 retires that template with the merge, so
     the anchor matched nothing and THE HARNESS REFUSED THE RUN rather than
     scoring a sweep against a fault it never applied.

     The claim is unchanged: a panel sized to its container instead of its
     content. Post-split that is the CARD taking the panel's width, so the
     injection unpins the card and lets the row track stretch. Two edits,
     because the card's own `max-content` and the row's track are two locks on
     the same claim - which is the lesson the previous version of this injection
     recorded. */
  { id: 'A2 the panel-sized stretch REGROWN (both locks)', kind: 'live', file: CSS,
    /* AND A THIRD LOCK, BECAUSE TWO WERE NOT ENOUGH AND THE SILENCE SAID SO.
       Unpinning the card and its track let the CARD stretch and changed no gap:
       R-US4 pins the COLUMNS from the registry, so the figures stayed where
       they were and the slack sat empty to the right. The original A2 defect
       needs the columns back on `auto` as well, which is the state where a
       heading decides a column and the panel decides the heading. */
    find: ['  padding: 14px 16px;\n  width: max-content;\n  align-content: start;',
      '  grid-template-columns: max-content max-content;\n  grid-template-rows: auto auto auto repeat(4, auto) auto;',
      '.product-grid .ig-total { border-bottom: none; }'],
    put: ['  padding: 14px 16px;\n  width: auto;\n  align-content: start;',
      '  grid-template-columns: minmax(0, 1fr) max-content;\n  grid-template-rows: auto auto auto repeat(4, auto) auto;',
      '.product-grid .ig-total { border-bottom: none; }\n'
        + '#deal-product-grid { grid-template-columns: minmax(0, 1fr) auto auto auto !important; }'],
    /* RE-POINTED AT THE ASSERTION THAT NOW CATCHES THIS FIRST. A2 fired on the
       CONTAINMENT check rather than on A1's growth clause, which is correct
       rather than a miss: post-split a panel-sized card overflows its panel
       before its label-to-figure gap has grown past the allowance, so the
       containment check is what a reader would hit first. The verdict was
       FIRED-ELSEWHERE, which is the harness telling me the injection is real
       and my expectation was pointed at the wrong line. */
    expect: 'R-US4 every panel' },

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
  /* RE-POINTED: W2 split `.deal-field` and `.po-row` into separate rules when
     the repayment row began stacking at every width, so the old anchor matched
     nothing and the harness REFUSED THE RUN rather than scoring a sweep against
     a fault it never applied. Breaking the two-column shape on the rate and
     term rows is what leaves their right edges disagreeing now. */
  { id: 'A6 one row leaves the shared edge', kind: 'live', file: CSS,
    find: '#deal-factoring-fields .deal-field {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 12px;\n  align-items: center;\n}',
    put: '#deal-factoring-fields .deal-field {\n  display: flex;\n  gap: 12px;\n  align-items: center;\n}',
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

  /* ── W2's SECOND SITE: THE LABEL FORCED BACK INTO ITS CONTROL ───────────
     The repayment row returns to the two-column shape A6 gave it, where the
     292px control takes the card and leaves the label about 4px. The label
     does not shrink, it OVERFLOWS, so this injection tests the half of the
     check that measures INK rather than boxes: box against box, this state
     reads clean while "REPAYMENT METHOD" prints through "STRAIGHT-LINE". */
  { id: 'W2 the label forced back into its control', kind: 'live', file: CSS,
    find: '#deal-factoring-fields .po-row {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n  gap: 6px;\n}',
    put: '#deal-factoring-fields .po-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 12px;\n  align-items: center;\n}',
    expect: 'W2 no box on the schedule stack intersects' },

  /* ── W1: THE HALVES STACKED AGAIN ─────────────────────────────────────── */
  { id: 'W1 the two halves STACKED again', kind: 'live', file: CSS,
    find: '.units-row {\n  display: grid;\n  grid-template-columns: max-content max-content;',
    put: '.units-row {\n  display: block;\n  grid-template-columns: max-content max-content;',
    expect: 'W1 the milestone table sits RIGHT' },

  /* ── R-US4: THE HEADING UN-CAPPED REGROWS THE WIDTH ────────────────────
     `!important` because the width comes from an INLINE style the hook writes,
     and only a stylesheet declaration marked important outranks one. This puts
     the grid back on `auto` tracks, where a heading's max-content decides the
     column, which is the 228px-for-a-70px-box state R-US4 ended. */
  { id: 'R-US4 the heading un-capped regrows the column', kind: 'live', file: CSS,
    find: '.product-grid .ig-total { border-bottom: none; }',
    put: '.product-grid .ig-total { border-bottom: none; }\n'
      + '#deal-product-grid, #deal-install-panel { grid-template-columns: auto auto auto auto !important; }',
    expect: 'R-US4' },

  /* ── THE CONTAINMENT CHECK ITSELF, on a container made too small ───────── */
  { id: 'R-US4 a container overflowed by its own content', kind: 'live', file: CSS,
    find: '.ur-contractor { grid-column: 1 / -1; grid-row: 3 / -1; width: max-content; }',
    put: '.ur-contractor { grid-column: 1 / -1; grid-row: 3 / -1; width: 900px; }',
    expect: 'R-US4 every panel' },

  /* ── R-US3: A ROW UNPAIRED ACROSS THE TWO CARDS ────────────────────────
     The pairing is structural now - the two halves share a subgrid track - so
     this is the injection that proves the claim did not become a tautology
     when it became a construction. */
  { id: 'R-US3 a row UNPAIRED across the cards', kind: 'live', file: CSS,
    find: '.units-row .ig-head { grid-row: 3; }',
    put: '.units-row .ig-head { grid-row: 3; }\n'
      + '[data-testid^="ig-rate-"] { position: relative; top: 9px; }',
    expect: 'N2 every row PAIRS' },

  /* ── R-ADJ1: THE ACCEPTED OVERFLOW TURNED THE WRONG WAY ────────────────
     The ruling turned on WHICH WAY the card spills, so the guard is calibrated
     on direction rather than only on size. */
  { id: 'R-ADJ1 the overflow forced LEFTWARD', kind: 'live', file: CSS,
    find: '#deal-factoring-fields .po-row > #deal-factoring-method-toggle { align-self: flex-end; }',
    put: '#deal-factoring-fields .po-row > #deal-factoring-method-toggle { align-self: flex-end !important; }',
    expect: 'R-ADJ1 the factoring card' },

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
