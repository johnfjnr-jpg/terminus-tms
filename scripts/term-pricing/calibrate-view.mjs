#!/usr/bin/env node
// ── TERM PRICING: calibration of the screen probe's claims ─────────────────
//
//   node scripts/term-pricing/calibrate-view.mjs <scratch dir> [id ...]
//
// Each injection into TermPricingView.tsx must make its NAMED probe claim fail
// (Verification 9: the verdict reads WHICH claim failed), in the probe mode
// that holds that claim. A probe run that dies without a verdict STOPS the
// harness rather than counting as silence (Verification 48): TP_CAPEX's first
// W3 run did exactly that. Snapshot taken and checked before any injection,
// restore compared byte for byte after each, a rebuild, and a final reverted
// run of every mode used (Verification 44).
//
// TP_TABS: W1 to W4 RE-POINTED (their TP_CAPEX anchors are the single page's,
// which T-1 retires), and T1 to T16 added, one per TP_TABS claim (M4).
// SUPERSEDED, QUOTED NOT DELETED: W4 "the CAPEX ladder keeps the OPEX
// columns", whose claim (C-10) v1.7's C2 reverses; W4 now injects the reverse.
//
// UNWIRED: it mutates a source file and rebuilds the bundle, so it must never
// be a gate stage. Run by hand when the view changes; needs a browser, a live
// server and a session.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const ROOT = new URL('../../', import.meta.url).pathname
const VIEW = ROOT + 'frontend-react/src/term-pricing/TermPricingView.tsx'
const BUNDLE = ROOT + 'frontend-react/dist/terminus-react.js'
const SP = process.argv[2]
const ONLY = process.argv.slice(3)
if (!SP) { console.log('usage: calibrate-view.mjs <scratch dir> [id ...]'); process.exit(2) }
const snap = readFileSync(VIEW), snapBundle = readFileSync(BUNDLE)
writeFileSync(`${SP}/view.snapshot`, snap)
if (!existsSync(`${SP}/view.snapshot`) || !readFileSync(`${SP}/view.snapshot`).equals(snap)) { console.log('STOP: no snapshot'); process.exit(2) }
const build = () => spawnSync('npm', ['run', 'build:react'], { cwd: ROOT, encoding: 'utf8' }).status
const probe = (mode) => spawnSync('node', ['--env-file=.env', 'scripts/term-pricing/probe-screen.mjs', ...(mode ? [mode] : []), '--spec', '--out', `${SP}/calshots`],
  { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer', TP_RUN: 'cal' } })
const verdictOf = (r) => { const out = (r.stdout ?? '') + (r.stderr ?? ''); const sum = /ALL PASS|\d+ FAILED/.test(r.stdout ?? ''); return { out, sum } }
const INJ = [
  // ── W1 to W4, RE-POINTED ──
  { id: 'W1', mode: '--capex', why: 'the deal-value tag shows under Published too (C-3)',
    find: "{q.cpiMode === 'locked' && <span className=\"tp-tag tp-tag-go\" data-testid=\"tp-q-deal-tag\">Deal value</span>}",
    put: '{<span className="tp-tag tp-tag-go" data-testid="tp-q-deal-tag">Deal value</span>}', expect: 'C-3 Published: no deal-value tag' },
  { id: 'W2', mode: '--capex', why: 'Subscription before CAPEX in the schedule',
    find: '{capex ? <><td>{dash(r.capexCents)}</td><td>{dash(r.subscriptionCents)}</td></> : <td>{money(r.netCents)}</td>}',
    put: '{capex ? <><td>{dash(r.subscriptionCents)}</td><td>{dash(r.capexCents)}</td></> : <td>{money(r.netCents)}</td>}', expect: 'G-C2 the payment schedule' },
  { id: 'W3', mode: '--tabs', why: 'the price card loses its APPROVAL tag',
    find: '<h2 className="tp-h2">The price <span className="tp-tag tp-tag-go" data-testid="tp-approval-tag">Approval</span></h2>',
    put: '<h2 className="tp-h2">The price</h2>', expect: 'the price card carries APPROVAL' },
  { id: 'W4', mode: '', why: 'the CAPEX ladder drops to C-10\'s two columns (C2)',
    find: "<th>Term</th><th>Monthly fee (yr 1)</th><th>SafeSight / cam / mo</th>",
    put: "<th>Term</th>{capex ? null : <><th>Monthly fee (yr 1)</th></>}<th>SafeSight / cam / mo</th>", expect: 'C2 under CAPEX the ladder shows every column' },
  // ── TP_TABS, one per claim ──
  { id: 'T1', mode: '--tabs', why: 'switching tabs resets the milestones (T-1)',
    find: "    if (t === 'payment' || tab === 'payment') setPaymentSeen(true)\n",
    put: "    if (t === 'payment' || tab === 'payment') setPaymentSeen(true)\n    if (t !== 'payment') setMilestones([DEFAULT_MILESTONE])\n", expect: 'T-1 every Payment terms field survives' },
  { id: 'T2', mode: '--tabs', why: 'a finished tab never shows its tick (T-1)',
    find: 'const done = !on && (', put: 'const done = false && (', expect: 'T-1 Next opens Payment terms, and the finished Pricing tab shows a tick' },
  { id: 'T3', mode: '--tabs', why: 'the Quote tab opens while the quote is not ready (T-4)',
    find: "    if (t === 'quote' && !ready) return\n", put: '', expect: 'T-4 clicking the blocked Quote tab leaves Payment terms open' },
  { id: 'T4', mode: '--tabs', why: 'the CAPEX sections render under OPEX (T-3)',
    find: '{/* T-3: under CAPEX only; ABSENT from the DOM under OPEX. */}\n          {capex && (',
    put: '{/* T-3: under CAPEX only; ABSENT from the DOM under OPEX. */}\n          {(capex || true) && (', expect: 'T-3 under OPEX tp-sec-amount is ABSENT' },
  { id: 'T5', mode: '--tabs', why: 'a row\'s amount waits for the allocation to complete (T-4)',
    find: "{row && row.cents !== null ? money(row.cents) : '-'}", put: "{row && row.cents !== null && alloc?.status === 'complete' ? money(row.cents) : '-'}",
    expect: "T-4 the row's amount shows on the first keystroke" },
  { id: 'T6', mode: '--tabs', why: 'no "Not yet scheduled" row, so the breakdown stops tying (T-4)',
    find: "{alloc.status === 'incomplete' && alloc.unscheduledCents !== null && alloc.unscheduledCents > 0n && (",
    put: '{false && (', expect: 'T4-G1 the breakdown' },
  { id: 'T7', mode: '--tabs', why: 'the readiness card does not name what is missing (T-4)',
    find: '? `Allocate the remaining ${sharePct(alloc.unallocated.share)} (${money(alloc.unallocated.cents)}) of CAPEX to a milestone.`',
    put: "? 'The quote is not ready.'", expect: 'T-4 the quote is NOT READY' },
  { id: 'T8', mode: '--tabs', why: 'the default schedule is fitted like the tax detail (T-5)',
    find: "${showTax ? ' tp-schedule-fit' : ''}", put: " tp-schedule-fit", expect: 'T-5 the default schedule uses the standard figure size' },
  { id: 'T9', mode: '--tabs', why: 'Final TCV appears on the Pricing tab (T-6)',
    find: 'This is the figure the deal is approved on. Payment terms change when the client pays, never this price.',
    put: 'This is the figure the deal is approved on. Payment terms change when the client pays, never this price. Final TCV follows.', expect: 'T-6 the Pricing tab shows Base only' },
  { id: 'T10', mode: '--tabs', why: 'a band row\'s Base TCV is its monthly figure (C1)',
    find: '<td>{money(b.monthlyCents)}</td><td>{money(b.tcvNetCents)}</td>', put: '<td>{money(b.monthlyCents)}</td><td>{money(b.monthlyCents)}</td>', expect: 'T-2 (c) B-1 to B-6' },
  { id: 'T11', mode: '--tabs', why: 'the ladder ignores the keyboard (N1)',
    find: ' onKeyDown={(e) => onLadderKey(e, r.termMonths)}', put: '', expect: 'N1 Enter on a focused ladder row chooses it' },
  { id: 'T12', mode: '--tabs', why: 'the profit card drops gross profit per product (N4)',
    find: '<td>{productLabel(l.product)}</td><td>{money(l.tcvNetCents)}</td><td>{money(l.grossProfitCents)}</td><td>{pct(l.grossMargin)}</td>',
    put: '<td>{productLabel(l.product)}</td><td>{money(l.tcvNetCents)}</td><td></td><td>{pct(l.grossMargin)}</td>', expect: 'T29 and T30 per product on Base' },
  { id: 'T13', mode: '--tabs', why: 'the OPEX schedule carries the CAPEX columns (C3)',
    find: '{capex ? <><th>CAPEX</th><th>Subscription</th></> : <th>Monthly fee</th>}', put: '<><th>CAPEX</th><th>Subscription</th></>',
    expect: 'C3 under OPEX the default schedule' },
  { id: 'T14', mode: '--tabs', why: 'the header strip does not follow the basis (T-1)',
    find: 'data-testid="tp-head-basis">{capex ? \'CAPEX\' : \'OPEX\'}', put: 'data-testid="tp-head-basis">{\'OPEX\'}', expect: 'T-1 the header strip follows the basis' },
  { id: 'T15', mode: '--tabs', why: 'the WHT borne rows are gone from the profit card (N5)',
    find: '{q.base.tax.whtBorneCents > 0n && (', put: '{false && (', expect: 'N5 T30 WHT borne' },
  { id: 'T16', mode: '--capex', why: 'over 100% the readiness card does not use the engine\'s words (C5)',
    find: "(result && 'refusal' in result && result.refusal) || 'The milestone shares total more than 100%.'", put: "'The milestone shares total more than 100%.'",
    expect: 'G-C4 100.1% is refused in the engine' },
].filter((j) => !ONLY.length || ONLY.includes(j.id))
const results = []
try {
  for (const j of INJ) {
    const before = readFileSync(VIEW, 'utf8')
    if (before.split(j.find).length !== 2) throw new Error(`${j.id}: anchor found ${before.split(j.find).length - 1} times`)
    writeFileSync(VIEW, before.replace(j.find, j.put))
    if (readFileSync(VIEW, 'utf8') === before) throw new Error(`${j.id}: did not land`)
    if (build() !== 0) throw new Error(`${j.id}: build failed`)
    const t0 = Date.now()
    const { out, sum } = verdictOf(probe(j.mode))
    if (!sum) throw new Error(`${j.id}: the probe produced no verdict (it died after ${Date.now() - t0}ms), so this is not silence: ${out.split('\n').filter((l) => /Error/.test(l)).slice(0, 2).join(' | ')}`)
    const fired = out.split('\n').some((l) => l.startsWith('FAIL') && l.includes(j.expect))
    const fails = out.split('\n').filter((l) => l.startsWith('FAIL')).length
    console.log(`${j.id} ${fired ? 'FIRED' : 'SILENT'} fails=${fails} ${Date.now() - t0}ms ${j.why} [${j.mode || 'default'}; expects: ${j.expect}]`)
    results.push(fired)
    writeFileSync(VIEW, snap)
    if (!readFileSync(VIEW).equals(snap)) throw new Error(`${j.id}: restore not byte-identical`)
  }
} finally {
  writeFileSync(VIEW, snap)
  build()
}
for (const mode of [...new Set(INJ.map((j) => j.mode))]) {
  const { out } = verdictOf(probe(mode))
  console.log(`reverted ${mode || 'default'}: probe ${out.trim().split('\n').at(-1)}`)
}
console.log(`view identical ${readFileSync(VIEW).equals(snap)}, bundle identical ${readFileSync(BUNDLE).equals(snapBundle)}`)
console.log(`${results.filter(Boolean).length}/${results.length} FIRED`)
