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
// TP_BANDS: an injection may name its probe. probe-bands.mjs passes the spec's
// margins itself, so it takes no --spec.
const probe = (mode, script = 'probe-screen.mjs') => spawnSync('node', ['--env-file=.env', `scripts/term-pricing/${script}`, ...(mode ? [mode] : []),
  ...(script === 'probe-screen.mjs' ? ['--spec'] : []), '--out', `${SP}/calshots`],
  { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer', TP_RUN: 'cal' } })
const BANDS = 'probe-bands.mjs'
const MANUAL = 'probe-manual.mjs'
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
  // ── TP_BANDS, spec v1.8 (M4: one per new view claim), on probe-bands.mjs ──
  { id: 'B1', script: BANDS, mode: '--admin', why: 'an admin is told only an admin can change these (0.7)',
    find: '{!admin && <p className="tp-small tp-muted" data-testid="tp-bands-readonly">', put: '{<p className="tp-small tp-muted" data-testid="tp-bands-readonly">',
    expect: '0.7: no read-only sentence for an admin' },
  { id: 'B2', script: BANDS, mode: '', why: 'a non-admin can type a discount (0.7, TB-8)',
    find: 'value={r.discountPct} disabled={!admin}', put: 'value={r.discountPct} disabled={false}', expect: '0.7: every band input is shown and disabled' },
  { id: 'B3', script: BANDS, mode: '', why: 'a non-admin sees the admin eyebrow (0.7)',
    find: '{admin && <div className="tp-small tp-muted" data-testid="tp-bands-eyebrow">', put: '{<div className="tp-small tp-muted" data-testid="tp-bands-eyebrow">',
    expect: '0.7: no eyebrow for a non-admin' },
  // RE-AIMED: first aimed at the view's `to ?? '?'`, it came back SILENT
  // because the "?" is the ENGINE'S (validateBands, calibrated by Y11) and the
  // fallback was dead; the fallback is removed. The view's own fault would be a
  // second reader deriving To from the typed starts, which shows 3, not "?".
  { id: 'B4', script: BANDS, mode: '--admin', why: 'the view derives To itself, so an invalid next start shows a number, not "?" (3.2)',
    find: '{to === null ? \'and above\' : String(to)}', put: '{to === null ? \'and above\' : String(rows[i + 1] ? Number(rows[i + 1].from) - 1 : \'\')}',
    expect: '4b: band 3' },
  { id: 'B5', script: BANDS, mode: '--admin', why: 'Save bands is enabled while a rule is broken (TB-6)',
    find: 'disabled={!dirty || !v.ok || saving}', put: 'disabled={!dirty || saving}', expect: '4b, TB-6: Save bands is disabled' },
  { id: 'B6', script: BANDS, mode: '--admin', why: 'a floor breach blocks the save (TB-7: it warns only)',
    find: 'disabled={!dirty || !v.ok || saving}', put: 'disabled={!dirty || !v.ok || saving || (grid.ok && grid.breaches.length > 0)}',
    expect: 'TB-7: a breach warns and does not block' },
  { id: 'B7', script: BANDS, mode: '--admin', why: 'the warning carries the mockup\'s false sentence (0.2)',
    find: 'You can still save. A quote is flagged for approval only when its whole-deal margin falls below the floor.',
    put: 'You can still save; quotes in this band and term will show the floor flag for approval.', expect: '0.2: the warning' },
  { id: 'B8', script: BANDS, mode: '--admin', why: 'the fee table shows the mockup\'s bands 1, 4 and 6 only (0.3)',
    find: '<tr key={r.band} data-testid={`tp-bfee-row-${r.band}`}>', put: '[1, 4, 6].includes(r.band) && <tr key={r.band} data-testid={`tp-bfee-row-${r.band}`}>',
    expect: '0.3: the fee table shows all six bands' },
  { id: 'B9', script: BANDS, mode: '--admin', why: 'the invalid state hides the cards\' sentence (0.4)',
    find: '<div className="tp-small tp-muted tp-bands-fix">Fix the band rules to see the margin check.</div>', put: '<div className="tp-small tp-muted tp-bands-fix"></div>',
    expect: '4b, 0.4' },
  { id: 'B10', script: BANDS, mode: '--admin', why: 'the save drops the last band from the request (0.5)',
    find: 'const bands = typed.map((b) => ({', put: 'const bands = typed.slice(0, -1).map((b) => ({', expect: '0.5: the request carries the six bands' },
  { id: 'B11', script: BANDS, mode: '--admin', why: 'after a save the editor waits for a refetch, reading dirty (found by the probe)',
    find: '    if (r.data?.settings) onSaved(r.data)\n', put: '', expect: 'after the save the editor is clean' },
  { id: 'B12', script: BANDS, mode: '--admin', why: 'a switch of product throws the draft away (T-1)',
    find: 'onChoose={(p) => { onProduct(p); setMessage(null) }}', put: 'onChoose={(p) => { onProduct(p); setMessage(null); setDrafts((d) => { const n = { ...d }; delete n[p]; return n }) }}',
    expect: 'T-1: HEMIR\'s draft survives a switch of product' },
  { id: 'B13', script: BANDS, mode: '--admin', why: 'Add is live at 6 bands (TB-2)',
    find: 'disabled={rows.length >= MAX_BANDS_SHOWN}', put: 'disabled={false}', expect: '4a, TB-2: Add is disabled at 6' },
  { id: 'B14', script: BANDS, mode: '--admin', why: 'the remove control is live at 2 bands (TB-2)',
    find: 'disabled={rows.length <= 2}', put: 'disabled={false}', expect: 'TB-2: ✕ is disabled at 2 bands' },
  { id: 'B15', script: BANDS, mode: '--admin', why: 'a server refusal is not shown (TB-6: the server is the authority)',
    find: "const shownErrors = message?.kind === 'error' ? (message.problems?.length ? message.problems : [message.text]) : v.problems.map((p) => p.message)",
    put: 'const shownErrors = v.problems.map((p) => p.message)', expect: 'TB-6: the server\'s sentence is shown' },
  // ── TP_MANUAL: one per probe-manual.mjs claim the view owns (M4). The engine's
  // claims (the checks, the anchor, the note's figures) are Z1 to Z14 in
  // calibrate.mjs. Not injected here, and why: "vs {ANCHOR_TERM}" (the probe
  // runs at the anchor 36, so a hard-coded 36 cannot differ; Z7 owns it) and
  // Calculated at one camera (the probe's units are 1; Z1 owns it).
  { id: 'M1', script: MANUAL, mode: '', why: 'a return to Term Pricing keeps the prices (M-2, C5)',
    find: 'const manualPrices = manualState.token === navToken ? manualState.prices : NO_PRICES',
    put: 'const manualPrices = manualState.prices', expect: 'M-2, C5: a return to Term Pricing finds every price cleared' },
  { id: 'M2', script: MANUAL, mode: '', why: 'a switch of tab clears the prices (M-2)',
    find: "    if (t === 'quote' && !ready) return\n", put: "    if (t === 'quote' && !ready) return\n    setManualState({ token: navToken, prices: {} })\n",
    expect: 'M-2: a switch of tab keeps every price' },
  { id: 'M3', script: MANUAL, mode: '', why: 'the chips show before any price is entered (C11)',
    find: '{s.priced > 0 && (', put: '{s.priced >= 0 && (', expect: 'C11: no chips until a price is entered' },
  { id: 'M4', script: MANUAL, mode: '', why: 'Fill copies nothing (M-4)',
    find: "r.calculatedCents === null ? '' : money(r.calculatedCents)])))}", put: "''])))}", expect: "M-4: Fill copies each term's Calculated" },
  { id: 'M5', script: MANUAL, mode: '', why: 'Clear clears nothing (M-4)',
    find: 'onClear={() => setManualPrices({})}', put: 'onClear={() => {}}', expect: 'M-4: Clear empties every input' },
  { id: 'M6', script: MANUAL, mode: '', why: 'the flags share one line (C2)',
    find: 'flags.map((f) => <div key={f.kind} className="tp-manual-flag">⚠ {f.message}</div>)',
    put: '<div className="tp-manual-flag">⚠ {flags.map((f) => f.message).join(\'; \')}</div>', expect: 'MG-4, C2: three flags, one per line' },
  { id: 'M7', script: MANUAL, mode: '', why: 'a flagged row is not tinted (M-6)',
    find: "className={flags.length ? 'tp-manual-flagged' : undefined}", put: 'className={undefined}', expect: 'M-6: flagged rows (84, 96) are tinted' },
  { id: 'M8', script: MANUAL, mode: '', why: 'a typed price never takes money format (M-5)',
    find: "onBlur={() => { if (r.status === 'priced' && r.priceCents !== undefined && money(r.priceCents) !== prices[t]) onPrice(t, money(r.priceCents)) }} />",
    put: 'onBlur={() => {}} />', expect: 'M-5: a price typed without commas reads in money format' },
  { id: 'M9', script: MANUAL, mode: '', why: 'a refused price shows no field error (M-7, C9)',
    find: "{r.status === 'invalid' && <div className=\"tp-error tp-manual-err\"", put: "{false && <div className=\"tp-error tp-manual-err\"",
    expect: 'M-7, C9: three decimals are refused' },
  { id: 'M10', script: MANUAL, mode: '', why: 'a refused price is not marked invalid (C9)',
    find: "aria-invalid={r.status === 'invalid' || undefined}", put: 'aria-invalid={undefined}', expect: 'M-7, C9: three decimals are refused' },
  { id: 'M11', script: MANUAL, mode: '', why: 'the card sends a request (M-2: comparison only). A POST to a path that does not exist: 404, nothing written',
    find: 'onClear={() => setManualPrices({})}', put: "onClear={() => { void shell.api('POST', '/api/term-pricing/manual-calibration', {}); setManualPrices({}) }}",
    expect: 'M-2: the card sent no write request' },
  { id: 'M12', script: MANUAL, mode: '', why: 'a zero difference carries a sign (C10)',
    find: "  if (s === '0.0' || s === '-0.0') return '0.0%'\n", put: '', expect: 'M-4: and every Difference then reads 0.0%' },
  { id: 'M13', script: MANUAL, mode: '', why: 'the Calculated column is headed as the ladder\'s (C6)',
    find: '<th>Calculated, 1 camera</th>', put: '<th>Calculated / mo</th>', expect: 'M-5, C4, C6: the columns' },
  { id: 'M14', script: MANUAL, mode: '', why: 'the empty state shows figures (C11): an unpriced row shows its check',
    find: "{!priced ? '' : flags.length", put: "{!priced ? '✓' : flags.length", expect: 'C11: every term shows Calculated' },
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
    const { out, sum } = verdictOf(probe(j.mode, j.script))
    if (!sum) throw new Error(`${j.id}: the probe produced no verdict (it died after ${Date.now() - t0}ms), so this is not silence: ${out.split('\n').filter((l) => /Error/.test(l)).slice(0, 2).join(' | ')}`)
    const fired = out.split('\n').some((l) => l.startsWith('FAIL') && l.includes(j.expect))
    const fails = out.split('\n').filter((l) => l.startsWith('FAIL')).length
    console.log(`${j.id} ${fired ? 'FIRED' : 'SILENT'} fails=${fails} ${Date.now() - t0}ms ${j.why} [${j.script ?? 'probe-screen.mjs'} ${j.mode || 'default'}; expects: ${j.expect}]`)
    results.push(fired)
    writeFileSync(VIEW, snap)
    if (!readFileSync(VIEW).equals(snap)) throw new Error(`${j.id}: restore not byte-identical`)
  }
} finally {
  writeFileSync(VIEW, snap)
  build()
}
for (const key of [...new Set(INJ.map((j) => `${j.script ?? 'probe-screen.mjs'}|${j.mode}`))]) {
  const [script, mode] = key.split('|')
  const { out } = verdictOf(probe(mode, script))
  console.log(`reverted ${script} ${mode || 'default'}: probe ${out.trim().split('\n').at(-1)}`)
}
console.log(`view identical ${readFileSync(VIEW).equals(snap)}, bundle identical ${readFileSync(BUNDLE).equals(snapBundle)}`)
console.log(`${results.filter(Boolean).length}/${results.length} FIRED`)
