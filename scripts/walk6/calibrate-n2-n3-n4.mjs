// N2, N3 AND N4'S GUARDS, CALIBRATED. Both probes went green on their first
// complete run, which is the tell rather than the proof. Each injection below
// removes one ruled behaviour and names the check that must notice.
//
// ANCHORED ON THE NAMED CHECK, never the exit code: an injection that kills a
// probe early also exits non-zero and would score as FIRED with the check it
// was written for never having run.
//
// N4 IS A COMPARISON, so its injections change the TEST BED side only. An
// injection that changed the shared rule would move both banners and the
// comparison would still hold - which is the shape of a check that cannot
// fail, and is exactly what "one rule, not a copied literal" has to be proven
// against.
//
// HARNESS DISCIPLINE: full-path keys, in-flight marker, snapshot asserted
// before injecting, bytes compared after every injection, and every stop path
// restores because `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk6/snap-n234`
const MARKER = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

const CSS = `${ROOT}/frontend/style.css`
const HTML = `${ROOT}/frontend/index.html`
const FILES = [CSS, HTML]
const keyFor = (f) => `${SNAP}/${f.replaceAll('/', '_')}`

if (existsSync(MARKER)) { console.error(`REFUSING: ${MARKER} exists`); process.exit(3) }
const original = new Map()
for (const f of FILES) {
  const b = readFileSync(f); writeFileSync(keyFor(f), b)
  if (!existsSync(keyFor(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
  original.set(f, b)
}
writeFileSync(MARKER, new Date().toISOString())
const restore = () => {
  for (const f of FILES) writeFileSync(f, readFileSync(keyFor(f)))
  for (const f of FILES) if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) {
    console.error(`RESTORE MISMATCH ${f}; marker left`); process.exit(4)
  }
}
const stop = (c, w) => { console.error(w); restore(); unlinkSync(MARKER); process.exit(c) }
const probe = (name) => {
  try {
    return execFileSync('node', [`${ROOT}/scripts/walk6/${name}`], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000,
      env: { ...process.env,
        PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
        PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` },
    })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
const verdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  const reds = out.split('\n').filter((l) => l.trim().startsWith('FAIL')).length
  if (!line) return { seen: false, red: false, reds, line: `(the check "${name}" never ran; ${reds} other checks failed)` }
  return { seen: true, red: line.trim().startsWith('FAIL'), reds, line: line.trim().slice(0, 112) }
}

const N2 = 'probe-n2-install.mjs'
const N34 = 'probe-n3-n4.mjs'

const INJECTIONS = [
  // ── N2 ────────────────────────────────────────────────────────────────
  // RE-AIMED. This first went at the select's own size and came back SILENT
  // with the whole probe green, because `#deal-installResp` carries its own
  // width: the columns reverted and the control did not. The dead space that
  // opens is BETWEEN the two controls, so that is the check that can see it.
  { what: 'the installation grid goes back to two equal halves', file: CSS, probe: N2,
    from: '#deal-section-2 .form-grid {\n  grid-template-columns: max-content minmax(0, max-content);',
    to: '#deal-section-2 .form-grid {\n  grid-template-columns: 1fr 1fr;',
    fires: 'N2 the two controls sit next to each other at 1440' },
  // AND THE OVERFLOW THIS ROUND CAUSED AND FIXED: a plain `max-content`
  // second column sizes to the 320px note and runs 64px past the section's
  // right edge at 1240.
  { what: 'the second column stops being allowed to shrink', file: CSS, probe: N2,
    from: 'grid-template-columns: max-content minmax(0, max-content);',
    to: 'grid-template-columns: max-content max-content;',
    fires: 'N2 and the content stays inside the row at 1240' },
  { what: 'the lump sum field loses its width', file: CSS, probe: N2,
    from: '#deal-lumpCost { width: 104px; }',
    to: '#deal-lumpCost { }',
    fires: 'N2 the lump sum field is sized to a nine-figure amount at 1440' },

  // ── N3. The order claim, injected by putting the band back where it was.
  // The two containers are adjacent, so one replace moves both.
  { what: 'the band goes back below the stats banner', file: HTML, probe: N34,
    from: '    <div id="opp-band-root"></div>\n',
    to: '',
    fires: 'N3 the band still renders, so the ordering checks are not vacuous at 1440' },
  { what: 'the band renders AFTER the banner instead of before it', file: HTML, probe: N34,
    from: '    <div id="opp-band-root"></div>\n\n    <!-- ── THE HEADLINE FIGURES.',
    to: '    <!-- ── THE HEADLINE FIGURES.',
    after: { from: '    <div id="opp-headline" class="opp-headline"></div>\n',
             to: '    <div id="opp-headline" class="opp-headline"></div>\n    <div id="opp-band-root"></div>\n' },
    fires: 'N3 and ABOVE the stats banner at 1440' },

  // ── N4. THE TEST BED SIDE ONLY, so the comparison is what fails.
  { what: 'the Test Bed banner stops sharing the border rule', file: CSS, probe: N34,
    from: '.opp-headline,\n.stats-grid--testbed {',
    to: '.opp-headline,\n.stats-grid--testbed-DISCONNECTED {',
    fires: 'N4 the Test Bed banner takes the SAME border at 1440' },
  { what: 'the Test Bed banner keeps the border and loses the cell ground', file: CSS, probe: N34,
    from: '.opp-headline > *,\n.stats-grid--testbed > * {',
    to: '.opp-headline > *,\n.stats-grid--testbed-DISCONNECTED > * {',
    fires: 'N4 and its cells paint the same ground, or the banner is one solid block' },
  { what: 'the Test Bed banner goes back to a 24px gap', file: CSS, probe: N34,
    from: '.stats-grid--testbed {\n  grid-template-columns: 1fr 1fr 1.4fr 1fr 1fr;',
    to: '.stats-grid--testbed {\n  gap: 24px;\n  grid-template-columns: 1fr 1fr 1.4fr 1fr 1fr;',
    fires: 'N4 and the same gap, which is what makes the rules visible at 1440' },
]

console.log('── HEALTHY ───────────────────────────────────────────────────')
const healthy = {}
for (const name of [N2, N34]) {
  const o = probe(name)
  healthy[name] = o.split('\n').filter((l) => l.trim().startsWith('FAIL')).length
  console.log(`   ${name}: ${healthy[name]} failing checks`)
  if (healthy[name] > 0) stop(3, `${name} is red before any injection; nothing below means anything`)
}

const results = [['healthy: both guards are silent', true]]
for (const inj of INJECTIONS) {
  let src = readFileSync(inj.file, 'utf8')
  if (!src.includes(inj.from)) stop(3, `anchor not found: ${inj.what}`)
  if (src.split(inj.from).length - 1 !== 1) stop(3, `anchor is not unique: ${inj.what}`)
  src = src.replace(inj.from, inj.to)
  if (inj.after) {
    if (src.split(inj.after.from).length - 1 !== 1) stop(3, `second anchor is not unique: ${inj.what}`)
    src = src.replace(inj.after.from, inj.after.to)
  }
  writeFileSync(inj.file, src)
  if (Buffer.compare(readFileSync(inj.file), original.get(inj.file)) === 0) {
    stop(3, `the file did not move, so the probe would measure the old code: ${inj.what}`)
  }
  const v = verdict(probe(inj.probe), inj.fires)
  writeFileSync(inj.file, original.get(inj.file))
  console.log(`\n${v.red ? 'FIRED ' : 'SILENT'}  ${inj.what}   [${v.reds} red]`)
  console.log(`        ${v.line}`)
  results.push([inj.what, v.seen && v.red])
}

restore()
console.log('\n── REVERTED ──────────────────────────────────────────────────')
let back = 0
for (const name of [N2, N34]) {
  const n = probe(name).split('\n').filter((l) => l.trim().startsWith('FAIL')).length
  console.log(`   ${name}: ${n} failing checks`)
  back += n
}
results.push(['both green again after the revert', back === 0])

console.log('')
for (const [what, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
