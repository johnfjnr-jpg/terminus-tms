#!/usr/bin/env node
// ── TP_CAPEX: calibration of the screen probe's --capex claims ─────────────
//
//   node scripts/term-pricing/calibrate-view.mjs <scratch dir>
//
// Each injection into TermPricingView.tsx must make its NAMED probe claim fail
// (Verification 9: the verdict reads WHICH claim failed). A probe run that dies
// without a verdict STOPS the harness rather than counting as silence
// (Verification 48): the first W3 run did exactly that. Snapshot taken and
// checked before any injection, restore compared byte for byte after each, a
// rebuild, and a final reverted run (Verification 44).
//
// UNWIRED: it mutates a source file and rebuilds the bundle, so it must never
// be a gate stage. Run by hand when the CAPEX view changes; needs a browser, a
// live server and a session.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const ROOT = new URL('../../', import.meta.url).pathname
const VIEW = ROOT + 'frontend-react/src/term-pricing/TermPricingView.tsx'
const BUNDLE = ROOT + 'frontend-react/dist/terminus-react.js'
const SP = process.argv[2]
if (!SP) { console.log('usage: calibrate-view.mjs <scratch dir>'); process.exit(2) }
const snap = readFileSync(VIEW), snapBundle = readFileSync(BUNDLE)
writeFileSync(`${SP}/view.snapshot`, snap)
if (!existsSync(`${SP}/view.snapshot`) || !readFileSync(`${SP}/view.snapshot`).equals(snap)) { console.log('STOP: no snapshot'); process.exit(2) }
const build = () => spawnSync('npm', ['run', 'build:react'], { cwd: ROOT, encoding: 'utf8' }).status
const probe = () => spawnSync('node', ['--env-file=.env', 'scripts/term-pricing/probe-screen.mjs', '--capex', '--spec', '--out', `${SP}/calshots`],
  { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer', TP_RUN: 'cal' } })
const verdictOf = (r) => { const out = (r.stdout ?? '') + (r.stderr ?? ''); const sum = /ALL PASS|\d+ FAILED/.test(r.stdout ?? ''); return { out, sum } }
const INJ = [
  { id: 'W1', why: 'the deal value ignores Locked', find: "{q.cpiMode === 'locked' ? 'Final TCV' : 'Base TCV'}", put: "{'Base TCV'}", expect: 'S4 deal value Final TCV, CPI LOCKED' },
  { id: 'W2', why: 'Subscription before CAPEX in the schedule', find: '<td>{dash(r.capexCents)}</td><td>{dash(r.subscriptionCents)}</td>', put: '<td>{dash(r.subscriptionCents)}</td><td>{dash(r.capexCents)}</td>', expect: 'G-C1 the payment schedule reads the mockup' },
  { id: 'W3', why: 'the APPROVAL tag moves to Final TCV', find: '<div className="tp-label">Base TCV <span className="tp-tag tp-tag-go" data-testid="tp-approval-tag">Approval</span></div>', put: '<div className="tp-label">Base TCV</div>', expect: 'S1 the APPROVAL tag sits on Base TCV' },
  { id: 'W4', why: 'the CAPEX ladder keeps the OPEX columns', find: '{capex ? <th>OPEX / cam / mo</th> :', put: '{false ? <th>OPEX / cam / mo</th> :', expect: 'C-10 the ladder is Term and OPEX / cam / mo' },
]
const results = []
try {
  for (const j of INJ) {
    const before = readFileSync(VIEW, 'utf8')
    if (before.split(j.find).length !== 2) throw new Error(`${j.id}: anchor not unique`)
    writeFileSync(VIEW, before.replace(j.find, j.put))
    if (readFileSync(VIEW, 'utf8') === before) throw new Error(`${j.id}: did not land`)
    if (build() !== 0) throw new Error(`${j.id}: build failed`)
    const { out, sum } = verdictOf(probe())
    if (!sum) throw new Error(`${j.id}: the probe produced no verdict (it died), so this is not silence: ${out.split('\n').filter((l) => /Error/.test(l)).slice(0, 2).join(' | ')}`)
    const fired = out.split('\n').some((l) => l.startsWith('FAIL') && l.includes(j.expect))
    const fails = out.split('\n').filter((l) => l.startsWith('FAIL')).length
    console.log(`${j.id} ${fired ? 'FIRED' : 'SILENT'} fails=${fails} ${j.why} [expects: ${j.expect}]`)
    results.push(fired)
    writeFileSync(VIEW, snap)
    if (!readFileSync(VIEW).equals(snap)) throw new Error(`${j.id}: restore not byte-identical`)
  }
} finally {
  writeFileSync(VIEW, snap)
  build()
}
const { out } = verdictOf(probe())
console.log(`reverted: view identical ${readFileSync(VIEW).equals(snap)}, bundle identical ${readFileSync(BUNDLE).equals(snapBundle)}, probe ${out.trim().split('\n').at(-1)}`)
console.log(`${results.filter(Boolean).length}/${results.length} FIRED`)
