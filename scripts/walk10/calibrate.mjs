// THE MICRO-ROUND'S GUARD, CALIBRATED. Snapshot by full path, in-flight
// marker, bytes compared after every injection, verdict read from the NAMED
// check rather than the exit code, and a final reverted run.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk10/snap`; mkdirSync(SNAP, { recursive: true })
const MARKER = `${SNAP}/IN_FLIGHT`
const CSS = `${ROOT}/frontend/style.css`
const KC = `${ROOT}/frontend-react/src/reference/KeyContacts.tsx`
const FU = `${ROOT}/frontend-react/src/contact/FollowUpTask.tsx`
const BUNDLE = `${ROOT}/frontend-react/dist/terminus-react.js`
const FILES = [CSS, KC, FU, BUNDLE]
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
const probe = () => {
  try { return execFileSync('node', ['--env-file=.env', `${ROOT}/scripts/walk10/probe-header-align.mjs`],
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
  { what: 'ITEM 1: the stance controls may shrink again', file: CSS, rebuild: false,
    from: '.kc-stance select { flex: 0 0 auto; width: 118px; }',
    to: '.kc-stance select { }',
    fires: "ITEM 1 every row's stance select is the SAME width at 1440" },
  { what: 'ITEM 1: the cells stop being table-cells', file: CSS, rebuild: false,
    from: '.kc-table td { padding: 6px 8px 6px 0;',
    to: '.kc-table td { display: block; padding: 6px 8px 6px 0;',
    fires: 'ITEM 1 every cell is a real table-cell, so ONE column system governs at 1440' },
  { what: 'ITEM 2: the Add button loses the estate treatment', file: KC, rebuild: true,
    from: '<button type="button" className="btn-sm" data-testid="kc-add" disabled={busy}',
    to: '<button type="button" data-testid="kc-add" disabled={busy}',
    fires: "ITEM 2 the Add button wears the estate's treatment at 1440" },
  { what: 'ITEM 3: a duplicated id comes back', file: FU, rebuild: true,
    from: '            type="date"\n            data-testid="cd-followUpDate"',
    to: '            type="date"\n            id="cd-followUpDate"\n            data-testid="cd-followUpDate"',
    fires: 'ITEM 3 no id is duplicated anywhere in the document at 1440' },
]
console.log('── HEALTHY ───────────────────────────────────────────────────')
const h = probe().split('\n').filter((l) => l.trim().startsWith('FAIL')).length
console.log(`   ${h} failing`)
if (h > 0) stop(3, 'the guard is red before any injection; nothing below means anything')
const results = [['healthy: the guard is silent', true]]
for (const inj of INJ) {
  const src = readFileSync(inj.file, 'utf8')
  if (src.split(inj.from).length - 1 !== 1) stop(3, `anchor not unique: ${inj.what}`)
  writeFileSync(inj.file, src.replace(inj.from, inj.to))
  if (Buffer.compare(readFileSync(inj.file), orig.get(inj.file)) === 0) stop(3, `the file did not move: ${inj.what}`)
  if (inj.rebuild) {
    if (!build()) stop(3, `the injected tree does not build: ${inj.what}`)
    if (Buffer.compare(readFileSync(BUNDLE), orig.get(BUNDLE)) === 0) {
      stop(3, `the bundle did not move, so the probe would measure the old code: ${inj.what}`)
    }
  }
  const v = verdict(probe(), inj.fires)
  writeFileSync(inj.file, orig.get(inj.file))
  if (inj.rebuild && !build()) stop(4, 'the restored tree does not build')
  console.log(`\n${v.red ? 'FIRED ' : 'SILENT'}  ${inj.what}   [${v.reds} red]`)
  console.log(`        ${v.line}`)
  results.push([inj.what, v.red])
}
restore()
if (!build()) stop(4, 'the restored tree does not build')
console.log('\n── REVERTED ──────────────────────────────────────────────────')
const back = probe().split('\n').filter((l) => l.trim().startsWith('FAIL')).length
console.log(`   ${back} failing`)
results.push(['green again after the revert', back === 0])
console.log('')
for (const [w, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
