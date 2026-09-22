// K2, K3 and K4's GUARDS, CALIBRATED. All three probes went green on their
// first complete run, which is the tell rather than the proof.
//
// ANCHORED ON THE NAMED CHECK, never the exit code: an injection that kills a
// probe early also exits non-zero and would score as FIRED with the check it
// was written for never having run.
//
// HARNESS DISCIPLINE: full-path keys, in-flight marker, snapshot asserted
// before injecting, bytes compared after every injection, and every stop path
// restores because `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk9/snap`; mkdirSync(SNAP, { recursive: true })
const MARKER = `${SNAP}/IN_FLIGHT`
const CSS = `${ROOT}/frontend/style.css`
const KC = `${ROOT}/frontend-react/src/reference/KeyContacts.tsx`
const BUNDLE = `${ROOT}/frontend-react/dist/terminus-react.js`
const FILES = [CSS, KC, BUNDLE]
const keyFor = (f) => `${SNAP}/${f.replaceAll('/', '_')}`

if (existsSync(MARKER)) { console.error(`REFUSING: ${MARKER} exists`); process.exit(3) }
const orig = new Map()
for (const f of FILES) {
  const b = readFileSync(f); writeFileSync(keyFor(f), b)
  if (!existsSync(keyFor(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
  orig.set(f, b)
}
writeFileSync(MARKER, new Date().toISOString())
const restore = () => {
  for (const f of FILES) writeFileSync(f, readFileSync(keyFor(f)))
  for (const f of FILES) if (Buffer.compare(readFileSync(f), orig.get(f)) !== 0) {
    console.error(`RESTORE MISMATCH ${f}; marker left`); process.exit(4)
  }
}
const stop = (c, w) => { console.error(w); restore(); unlinkSync(MARKER); process.exit(c) }
const ENV = { ...process.env,
  PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
  PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` }
const build = () => {
  try { execFileSync('npm', ['--prefix', `${ROOT}/frontend-react`, 'run', 'build'],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); return true }
  catch (e) { console.error('BUILD FAILED', String(e.stdout ?? e).slice(-200)); return false }
}
const probe = (name) => {
  try { return execFileSync('node', ['--env-file=.env', `${ROOT}/scripts/walk9/${name}`],
    { cwd: ROOT, encoding: 'utf8', timeout: 420000, env: ENV }) }
  catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
const verdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  const reds = out.split('\n').filter((l) => l.trim().startsWith('FAIL')).length
  if (!line) return { red: false, reds, line: `(the check "${name}" never ran; ${reds} red)` }
  return { red: line.trim().startsWith('FAIL'), reds, line: line.trim().slice(0, 108) }
}

const INJ = [
  { what: 'the contacts table goes back to taking the whole card', file: CSS, rebuild: false,
    from: '.kc-table { width: auto; border-collapse: collapse; }',
    to: '.kc-table { width: 100%; border-collapse: collapse; }',
    probe: 'probe-k2-k4.mjs',
    // ANCHORED ON THE CURRENT NAME. This read "sized to its content" while the
    // check had been renamed to "sized to its CONTENT" in the same round, so
    // the matcher missed it and scored SILENT while ten checks went red.
    fires: 'K2 the table is sized to its CONTENT, not to the card at 1440' },
  { what: 'the stance cell stops being one row', file: CSS, rebuild: false,
    from: 'td.kc-stance {\n  display: flex;',
    to: 'td.kc-stance {\n  display: table-cell;',
    probe: 'probe-k2-k4.mjs',
    fires: 'K4 the stance controls share ONE row at 1440' },
  // THE SAME INJECTION, READ FOR ITS OTHER EFFECT. In a `table-cell` the base
  // rule's `select { width: 100% }` applies against the cell, so the stance
  // control stretches - which is the state K2 is about. One injection, two
  // named checks, because it really does break both.
  { what: 'the stance cell stops being one row (read for the select\'s size)',
    file: CSS, rebuild: false,
    from: 'td.kc-stance {\n  display: flex;',
    to: 'td.kc-stance {\n  display: table-cell;',
    probe: 'probe-k2-k4.mjs',
    fires: 'K2 the stance select is sized to its longest option at 1440' },
  { what: 'the add picker goes back to filling the row', file: CSS, rebuild: false,
    from: '.kc-add [data-testid="kc-add-contact"] { flex: 0 1 220px; }',
    to: '.kc-add [data-testid="kc-add-contact"] { flex: 1 1 auto; }',
    probe: 'probe-k2-k4.mjs',
    fires: 'K2 the add picker does not eat the row at 1440' },
  // K3: the x removes on a single click again, which is the state measured
  // before this round. The CANCEL check is the one that must fire: it is the
  // assertion that the dialogue PREVENTS the loss.
  { what: 'the x removes immediately again, with no dialogue', file: KC, rebuild: true,
    from: '                  onClick={() => setConfirming(l)}',
    to: '                  onClick={() => { void remove(l.id) }}',
    probe: 'probe-k3-dialogue.mjs',
    fires: 'K3 the x OPENS a confirmation rather than removing at 1440' },
]

console.log('── HEALTHY ───────────────────────────────────────────────────')
for (const n of ['probe-k2-k4.mjs', 'probe-k3-dialogue.mjs']) {
  const reds = probe(n).split('\n').filter((l) => l.trim().startsWith('FAIL')).length
  console.log(`   ${n}: ${reds} failing`)
  if (reds > 0) stop(3, `${n} is red before any injection; nothing below means anything`)
}
const results = [['healthy: both guards are silent', true]]
for (const inj of INJ) {
  const src = readFileSync(inj.file, 'utf8')
  if (src.split(inj.from).length - 1 !== 1) stop(3, `anchor not unique: ${inj.what}`)
  writeFileSync(inj.file, src.replace(inj.from, inj.to))
  if (Buffer.compare(readFileSync(inj.file), orig.get(inj.file)) === 0) {
    stop(3, `the file did not move: ${inj.what}`)
  }
  if (inj.rebuild) {
    if (!build()) stop(3, `the injected tree does not build: ${inj.what}`)
    if (Buffer.compare(readFileSync(BUNDLE), orig.get(BUNDLE)) === 0) {
      stop(3, `the bundle did not move, so the probe would measure the old code: ${inj.what}`)
    }
  }
  const v = verdict(probe(inj.probe), inj.fires)
  writeFileSync(inj.file, orig.get(inj.file))
  if (inj.rebuild && !build()) stop(4, 'the restored tree does not build')
  console.log(`\n${v.red ? 'FIRED ' : 'SILENT'}  ${inj.what}   [${v.reds} red]`)
  console.log(`        ${v.line}`)
  results.push([inj.what, v.red])
}
restore()
if (!build()) stop(4, 'the restored tree does not build')
console.log('\n── REVERTED ──────────────────────────────────────────────────')
let back = 0
for (const n of ['probe-k2-k4.mjs', 'probe-k3-dialogue.mjs']) {
  const reds = probe(n).split('\n').filter((l) => l.trim().startsWith('FAIL')).length
  console.log(`   ${n}: ${reds} failing`); back += reds
}
results.push(['both green again after the revert', back === 0])
console.log('')
for (const [w, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
