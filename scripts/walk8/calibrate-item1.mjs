// ITEM 1'S GUARD, CALIBRATED. The probe went green on its first complete run.
// Snapshot by full path, in-flight marker, bytes compared after, and the
// verdict read from the NAMED check rather than the exit code.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk8/snap-item1`; mkdirSync(SNAP, { recursive: true })
const MARKER = `${SNAP}/IN_FLIGHT`
const CSS = `${ROOT}/frontend/style.css`
const keyFor = (f) => `${SNAP}/${f.replaceAll('/', '_')}`
if (existsSync(MARKER)) { console.error('REFUSING: in-flight marker exists'); process.exit(3) }
const orig = readFileSync(CSS); writeFileSync(keyFor(CSS), orig)
if (!existsSync(keyFor(CSS))) { console.error('no snapshot'); process.exit(3) }
writeFileSync(MARKER, new Date().toISOString())
const restore = () => {
  writeFileSync(CSS, readFileSync(keyFor(CSS)))
  if (Buffer.compare(readFileSync(CSS), orig) !== 0) { console.error('RESTORE MISMATCH; marker left'); process.exit(4) }
}
const probe = () => {
  try { return execFileSync('node', [`${ROOT}/scripts/walk8/probe-tax-line.mjs`], {
    cwd: ROOT, encoding: 'utf8', timeout: 300000,
    env: { ...process.env,
      PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
      PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` } }) }
  catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
const verdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  const reds = out.split('\n').filter((l) => l.trim().startsWith('FAIL')).length
  if (!line) return { red: false, reds, line: `(the check "${name}" never ran; ${reds} red)` }
  return { red: line.trim().startsWith('FAIL'), reds, line: line.trim().slice(0, 110) }
}
const FIRES = "ITEM 1 ONE LINE at 1440"
console.log('── HEALTHY ──')
const h = probe().split('\n').filter((l) => l.trim().startsWith('FAIL')).length
console.log(`   failing checks: ${h}`)
if (h > 0) { restore(); unlinkSync(MARKER); console.error('red before injection'); process.exit(3) }

const INJ = [
  { what: 'the Tax card stops spanning the track list',
    from: '.terms-cards .pg-card--wide { grid-column: 1 / -1; }',
    to: '.terms-cards .pg-card--wide { }' },
]
const results = [['healthy: the guard is silent', true]]
for (const inj of INJ) {
  const src = readFileSync(CSS, 'utf8')
  if (src.split(inj.from).length - 1 !== 1) { restore(); unlinkSync(MARKER); console.error(`anchor not unique: ${inj.what}`); process.exit(3) }
  writeFileSync(CSS, src.replace(inj.from, inj.to))
  const v = verdict(probe(), FIRES)
  writeFileSync(CSS, orig)
  console.log(`\n${v.red ? 'FIRED ' : 'SILENT'}  ${inj.what}   [${v.reds} red]`)
  console.log(`        ${v.line}`)
  results.push([inj.what, v.red])
}
restore()
console.log('\n── REVERTED ──')
const back = probe().split('\n').filter((l) => l.trim().startsWith('FAIL')).length
console.log(`   failing checks: ${back}`)
results.push(['green again after the revert', back === 0])
console.log('')
for (const [w, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
