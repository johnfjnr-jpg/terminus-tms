#!/usr/bin/env node
// ── TP_LADDER Phase 2: CALIBRATION OF probe-ladder.mjs, EACH CLAIM NAMED ──
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/term-pricing/calibrate-ladder-view.mjs
//
// Each injection into TermPricingView.tsx must make its NAMED probe claim FAIL
// (Verification 9: read WHICH claim failed, not the exit code). The bundle is
// rebuilt after each injection and after each restore, and the restored source
// AND the rebuilt bundle are compared byte for byte with the originals; a
// mismatch stops dead. A probe run that ends without a verdict stops the
// harness (Verification 48). An in-flight marker refuses a second run over the
// wreck of a first, and every stop path restores (Verification 44). Ends with a
// final reverted probe run, which must be ALL PASS. UNWIRED: run at the phase
// report and recorded there.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const SNAP = join(ROOT, '.scratch/calibrate-ladder-view')
const MARKER = join(SNAP, 'IN_FLIGHT')
const V = 'frontend-react/src/term-pricing/TermPricingView.tsx'
const BUNDLE = 'frontend-react/dist/terminus-react.js'

const INJECTIONS = [
  { id: 'the profit chart drawn from the client total', find: `series={series('profitCents')}`, put: `series={series('tcvCents' as 'profitCents')}`,
    expect: 'C (SafeSight): every chart point IS the grid\'s figure' },
  { id: 'the derived fee not shown (either-or broken)', find: `value={dealMode === 'fee' && dealFeeTerm === term ? dealFee : dealMode !== 'none' && deal && signal ? money(deal.dealMonthlyCents) : ''}`,
    put: `value={dealMode === 'fee' ? dealFee : ''}`, expect: 'A: the fee fills in from the discount' },
  { id: 'the deal card swallows the refusal', find: `{dealError && <p className="tp-error" role="alert" data-testid="tp-deal-error">{dealError}</p>}`,
    put: `{null}`, expect: 'A: a fee above list is refused' },
  { id: 'a term switch drops the discount', find: `  const chooseTerm = (t: number) => {
    setTerm(t)`, put: `  const chooseTerm = (t: number) => {
    setDealMode('none')
    setTerm(t)`, expect: 'A: switching term keeps the discount' },
  { id: 'the deal fee column not amber', find: `<td className={signal ? 'tp-amber-fig' : undefined} data-testid={\`tp-ladder-deal-\${r.termMonths}\`}>`,
    put: `<td data-testid={\`tp-ladder-deal-\${r.termMonths}\`}>`, expect: 'A: amber where a figure departs from list' },
  { id: 'a no-price row can be chosen', find: `<tr key={r.termMonths} className="tp-ladder tp-ladder-missing" data-testid={\`tp-ladder-\${r.termMonths}\`} data-priced="false" aria-disabled="true">`,
    put: `<tr key={r.termMonths} className="tp-ladder tp-ladder-missing" data-testid={\`tp-ladder-\${r.termMonths}\`} data-priced="false" aria-disabled="true" onClick={() => chooseTerm(r.termMonths)}>`,
    expect: 'B: clicking it does not choose it' },
  { id: 'the editor\'s grid ignores what is typed', find: `    try { return bandMarginGrid(product, bands, buildParams(state.settings, state.costs), rows) }`,
    put: `    try { return bandMarginGrid(product, bands, buildParams(state.settings, state.costs)) }`, expect: 'D: the price chart redraws as typed' },
  { id: 'Save sends to the bands route', find: `'PUT', \`/api/term-pricing/price-ladder/\${product}\`, { prices: rows })`,
    put: `'PUT', \`/api/term-pricing/bands/\${product}\`, { prices: rows })`, expect: 'D: Save sent ONE real PUT' },
  { id: 'the editor below the bands', find: `          {ladder}
          {bands}`, put: `          {bands}
          {ladder}`, expect: 'C: the price ladder editor sits above Volume discount bands' },
]

const read = (f) => readFileSync(join(ROOT, f))
const build = () => execFileSync('npm', ['run', 'build:react'], { cwd: ROOT, stdio: 'pipe' })
mkdirSync(SNAP, { recursive: true })
if (existsSync(MARKER)) { console.log(`REFUSING: ${MARKER} exists; restore by hand from ${SNAP} first.`); process.exit(4) }
const src0 = read(V), bundle0 = read(BUNDLE)
writeFileSync(join(SNAP, V.replaceAll('/', '__')), src0)
writeFileSync(join(SNAP, BUNDLE.replaceAll('/', '__')), bundle0)
if (!read(V).equals(readFileSync(join(SNAP, V.replaceAll('/', '__'))))) { console.log('snapshot did not land'); process.exit(5) }
writeFileSync(MARKER, new Date().toISOString())
const restore = () => {
  writeFileSync(join(ROOT, V), src0)
  build()
  if (!read(V).equals(src0)) throw new Error('RESTORE MISMATCH: source')
  if (!read(BUNDLE).equals(bundle0)) throw new Error('RESTORE MISMATCH: the rebuilt bundle differs from the original')
}
const stop = (msg) => {
  try { writeFileSync(join(ROOT, V), src0); writeFileSync(join(ROOT, BUNDLE), bundle0); unlinkSync(MARKER); console.log('restored the snapshot bytes; marker removed') }
  catch (e) { console.log(`RESTORE FAILED, marker kept: ${e.message}`) }
  console.log(`STOPPED: ${msg}`); process.exit(3)
}
const probe = () => {
  let out = ''
  try { out = execFileSync(process.execPath, ['--env-file=.env', 'scripts/term-pricing/probe-ladder.mjs', '--out', join(SNAP, 'shots')], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env: process.env }) }
  catch (e) { out = String(e.stdout ?? '') + String(e.stderr ?? '') }
  if (!/ALL PASS|\d+ FAILED/.test(out)) stop(`a probe run ended without a verdict:\n${out.slice(-800)}`)
  return out
}
let silent = 0
try {
  for (const inj of INJECTIONS) {
    const s = src0.toString('utf8')
    const n = s.split(inj.find).length - 1
    if (n !== 1) stop(`${inj.id}: anchor matched ${n} times`)
    writeFileSync(join(ROOT, V), s.replace(inj.find, () => inj.put))
    try { build() } catch (e) { stop(`${inj.id}: the injected build failed: ${String(e.stderr ?? e.message).slice(0, 400)}`) }
    const out = probe()
    restore()
    const failed = [...out.matchAll(/^FAIL {2}(.+?)(?: {2}\[|$)/gm)].map((m) => m[1])
    const fired = failed.some((f) => f.startsWith(inj.expect))
    if (!fired) silent++
    console.log(`${fired ? 'FIRED ' : 'SILENT'}  ${inj.id}  [expect "${inj.expect}"; ${failed.length} failing]${fired ? '' : `  failed instead: ${failed.slice(0, 3).join(' | ')}`}`)
  }
  const final = probe()
  const ok = /ALL PASS/.test(final)
  console.log(`\nfinal reverted run: ${ok ? 'ALL PASS' : final.match(/\d+ FAILED/)?.[0]}; source and bundle byte-identical to the originals`)
  unlinkSync(MARKER)
  console.log(`${INJECTIONS.length - silent}/${INJECTIONS.length} FIRED; ${silent} SILENT`)
  process.exit(ok && !silent ? 0 : 1)
} catch (e) { stop(e.message) }
