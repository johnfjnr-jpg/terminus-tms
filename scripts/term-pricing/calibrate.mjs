#!/usr/bin/env node
// ── CALIBRATION: the term pricing goldens and the R-TP1 isolation guard ───
//
//   node scripts/term-pricing/calibrate.mjs
//
// Each injection names the TEST it must fail, and the verdict reads WHICH test
// failed rather than whether the run failed (Verification 9: an injection can
// kill a run without reaching the check it was written for). One negative
// injection must come back with nothing failing: a commented-out import is
// prose, and the guard must not fire on it (Verification 39).
//
// Harness discipline (Verification 44): snapshots keyed by full path and
// asserted to exist before any injection; an in-flight marker refused on the
// next run; restored bytes compared after EVERY injection, stopping dead on a
// mismatch; every stop path restores; a final reverted run must be all green.
//
// The engine's name is assembled from parts so this file never contains an
// import of it and cannot satisfy the isolation scan it calibrates.
//
// UNWIRED: a calibration harness, run by hand when the engine, its goldens or
// the isolation guard change. It mutates source, so it must never be a gate
// stage. The two suites it calibrates ARE wired, under `npm test`.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = new URL('../../', import.meta.url).pathname
const NAME = ['term', 'pricing'].join('-')
const ENGINE = `src/lib/${NAME}.js`
const DEALCALC = 'src/lib/deal-calculator.js'
const DEALINPUTS = 'src/lib/deal-inputs.js'
const TESTS = [`scripts/tests/${NAME}.test.mjs`, `scripts/tests/${NAME}-isolation.test.mjs`]
const TOUCHED = [ENGINE, DEALCALC, DEALINPUTS]

const SNAP = join(process.env.TP_CALIBRATE_DIR || join(tmpdir(), 'tp-calibrate'))
const MARKER = join(SNAP, 'IN_FLIGHT')
const key = (f) => f.replace(/\//g, '__')

const IMPORT = (what, from) => ['im', 'port'].join('') + ` { ${what} } from '${from}'\n`

const INJECTIONS = [
  { id: 'J1', file: ENGINE, why: 'rounding truncates instead of half-up',
    find: '  if ((num % x.d) * 2n >= x.d) q += 1n\n', put: '', expect: '10.2 band fees at 12 months' },
  { id: 'J2', file: ENGINE, why: 'TCV re-summed from unrounded list fees (tie rule broken)',
    find: 'tcvNetCents += monthlyTotalByYear[k - 1] * BigInt(monthsInYear(k))',
    put: 'tcvNetCents += roundHalfUp(mul(lines.reduce((s, l) => add(s, mul(l.listFee, fromInt(l.units))), ZERO), fromInt(monthsInYear(k))), 2)',
    expect: 'T1 1 unit, 36' },
  { id: 'J3', file: ENGINE, why: 'anchor margin not per product',
    find: 'const am = p.anchorMargin[product]', put: 'const am = p.anchorMargin.safesight ?? p.anchorMargin[product]',
    expect: 'flow: ANCHOR_MARGIN is per product' },
  { id: 'J4', file: ENGINE, why: 'steps_above hard-coded to the default list',
    find: 'p.terms.indexOf(T) - p.terms.indexOf(p.anchorTerm)', put: 'p.terms.indexOf(T) - 2',
    expect: 'flow: TERMS decides' },
  { id: 'J5', file: ENGINE, why: 'escalator chained from the previous rounded year',
    find: 'feeByYear.push(roundHalfUp(mul(fromCents(fee1), factor(k)), 2))',
    put: 'feeByYear.push(k === 1 ? fee1 : roundHalfUp(mul(fromCents(feeByYear[k - 2]), add(ONE, escalator)), 2))',
    expect: 'T16 1 unit, 60, escalator 3%' },
  { id: 'J6', file: ENGINE, why: 'CAPEX upfront at cost, hardware margin ignored',
    find: 'div(mul(fromInt(l.units), l.hwCostPerUnit), sub(ONE, p.hwUpfrontMargin))',
    put: 'mul(fromInt(l.units), l.hwCostPerUnit)', expect: 'T15 T6 as capex' },
  { id: 'J7', file: ENGINE, why: 'WHT charged on the fee including GST',
    // Re-pointed in TERM_PRICING_2: the line tax moved into taxLine(netCents, r).
    find: 'const whtCents = roundHalfUp(mul(fromCents(invoiceCents), r), 2)',
    put: 'const whtCents = roundHalfUp(mul(add(fromCents(invoiceCents), mul(fromCents(invoiceCents), gst)), r), 2)',
    expect: 'GST is added on top' },
  { id: 'J8', file: ENGINE, why: 'gross-up ignored',
    find: 'grossUp && cmp(r, ZERO) > 0', put: 'false && cmp(r, ZERO) > 0', expect: 'T20 T6, WHT 10%, gross-up ON' },
  { id: 'J9', file: ENGINE, why: 'JS numbers accepted as money',
    find: "  if (typeof value === 'bigint') return frac(value)\n",
    put: "  if (typeof value === 'bigint') return frac(value)\n  if (typeof value === 'number') value = String(value)\n",
    expect: 'money and percentages given as JS numbers are refused' },
  { id: 'J10', file: ENGINE, why: 'margin floor flag constant',
    find: 'belowMarginFloor: cmp(grossMargin, p.marginFloor) < 0,', put: 'belowMarginFloor: true,',
    expect: 'T19 T6 with MARGIN_FLOOR 90%' },
  { id: 'J11', file: ENGINE, why: 'margin display truncates',
    find: '  const scaled = roundHalfUp(mul(ratio, HUNDRED), places)\n',
    put: '  const h = mul(ratio, HUNDRED)\n  const scaled = (h.n * 10n ** BigInt(places)) / h.d\n',
    expect: '10.3 worst-case margin at 36 months' },
  { id: 'J12', file: ENGINE, why: 'short terms priced on the anchor margin',
    find: 'return div(costAt(cost, T), sub(ONE, sm))', put: 'return div(costAt(cost, T), sub(ONE, am))',
    expect: 'flow: SHORT_TERM_MARGIN per product' },
  { id: 'J13', file: ENGINE, why: 'PROFIT_STEP ignored',
    find: 'mul(p.profitStep, fromInt(stepsAbove))', put: 'ZERO', expect: 'flow: PROFIT_STEP' },
  { id: 'J14', file: ENGINE, why: 'bands pooled across product lines',
    find: 'splitIntoBands(p, units).filter',
    put: 'splitIntoBands(p, units + (product === \'TEST-B\' ? 120 : 0)).filter',
    expect: 'T14 T6 + T13 on one deal' },
  // ── Phase 2 rulings (M4: injections only for the new claims) ──
  { id: 'J15', file: ENGINE, why: 'CAPEX service fee flat under an escalator (Q1)',
    find: 'serviceByYear.push(roundHalfUp(mul(s, factor(k)), 2))', put: 'serviceByYear.push(roundHalfUp(s, 2))',
    expect: 'T22 T6 as capex with escalator 3%' },
  { id: 'J16', file: ENGINE, why: 'margin after WHT ignores the WHT borne (Q4)',
    find: 'frac(grossProfitCents - totals.whtBorneCents, tcvNetCents)', put: 'grossMargin',
    expect: 'POSITION (Q4' },
  { id: 'J17', file: ENGINE, why: 'identical years no longer merge into one run',
    find: 'if (last && last.netCents === feeByYear[k - 1]) last.toMonth = to', put: 'if (false) last.toMonth = to',
    expect: 'T15 T6 as capex' },
  // ── Mockup approval A1 and A3 (M4: injections only for the new claims) ──
  { id: 'J18', file: ENGINE, why: 'the refusal hard-codes "A" (A3)',
    find: '`${a[0].toUpperCase()}${a.slice(1)} ${T}-month term', put: '`A ${T}-month term',
    expect: 'T17 1 unit, 18 months' },
  { id: 'J19', file: ENGINE, why: 'the article ignores eleven and eighteen (A3)',
    find: " || lead === 11 || lead === 18 ? 'an' : 'a'", put: " ? 'an' : 'a'",
    expect: 'A3: the article' },
  { id: 'J20', file: ENGINE, why: 'the CAPEX ladder compares the OPEX fee (A1)',
    find: 'const feeOf = (q) => (q.capex ? q.capex.monthlyServiceCents : q.monthlyTotalCents)',
    put: 'const feeOf = (q) => q.monthlyTotalCents', expect: 'A1: under CAPEX' },
  // ── TERM_PRICING_2, spec v1.3 (M4: injections only for the new claims) ──
  { id: 'J21', file: ENGINE, why: 'the escalator start year is ignored (B6)',
    find: '(k < startYear ? ONE : pow(add(ONE, escalator), k - startYear + 1))', put: 'pow(add(ONE, escalator), k - 1)',
    expect: 'T27 1 unit, 60, escalator 3% from year 3' },
  { id: 'J22', file: ENGINE, why: 'the start year is off by one (B6)',
    find: 'k - startYear + 1))', put: 'k - startYear))', expect: 'T27 1 unit, 60, escalator 3% from year 3' },
  { id: 'J23', file: ENGINE, why: 'a start year below 2 is accepted (B6)',
    find: ' || startYear < 2) {', put: ') {', expect: 'B6: a start year below 2' },
  { id: 'J24', file: ENGINE, why: 'CAPEX ignores the split rates (B4)',
    find: "row.kind === 'upfront' ? whtHw : whtSaas", put: 'wht', expect: 'T24 T6 as capex, split WHT' },
  { id: 'J25', file: ENGINE, why: 'a split OPEX month is not two lines (B4)',
    find: "structure === 'opex' && split ?", put: 'false ?', expect: 'T25 T6 as opex, split WHT' },
  { id: 'J26', file: ENGINE, why: 'the service line ignores the escalator (B4)',
    find: 'const serviceCents = row.netCents - hardwareLineCents', put: 'const serviceCents = monthlyTotalByYear[0] - hardwareLineCents',
    expect: 'B4 (POSITION): with an escalator' },
  { id: 'J27', file: ENGINE, why: 'an unsplit OPEX month is split anyway, moving T20 (B4)',
    find: "structure === 'opex' && split ?", put: "structure === 'opex' && (split || cmp(wht, ZERO) > 0) ?",
    expect: 'B4: with Split WHT OFF' },
  { id: 'J28', file: ENGINE, why: 'GST on the invoice total, not per line (B4)',
    find: "gstCents = sum('gstCents')", put: "gstCents = roundHalfUp(mul(fromCents(sum('invoiceCents')), gst), 2)",
    expect: 'B4 (POSITION): GST is added per line' },
  { id: 'J29', file: ENGINE, why: 'a negative service line is invoiced (spec 13)',
    find: 'if (serviceCents < 0n) {', put: 'if (false) {', expect: 'B4 (POSITION, spec 13)' },
  { id: 'J30', file: ENGINE, why: 'a negative WHT rate is accepted (B3)',
    find: "if (cmp(r, ZERO) < 0 || cmp(r, ONE) >= 0) throw new TermPricingError('BAD_TAX'",
    put: "if (cmp(r, ONE) >= 0) throw new TermPricingError('BAD_TAX'", expect: 'B3: every WHT rate' },
  { id: 'J31', file: ENGINE, why: 'the split rates are not validated (B3)',
    find: "split ? whtRate(input.whtHwPct, 'WHT on hardware') : wht", put: "split ? pctToRatio(input.whtHwPct || '0', 'hw') : wht",
    expect: 'B3: every WHT rate' },
  // ── L1, layout approval (M4) ──
  { id: 'J32', file: ENGINE, why: 'the gross-up tile reads the WHT, which is not zero when WHT is borne (L1)',
    find: 'grossUpCents: totals.invoicedCents - totals.netCents,', put: 'grossUpCents: totals.whtCents,',
    expect: 'L1 TCV (net) + WHT gross-up + GST' },
  { id: 'J33', file: ENGINE, why: 'the gross-up is never computed (L1)',
    find: 'grossUpCents: totals.invoicedCents - totals.netCents,', put: 'grossUpCents: 0n,',
    expect: 'L1 the split-on capture' },
  // ── R-TP1, one import each way, as the brief requires ──
  { id: 'K1', file: ENGINE, why: 'the engine imports the deal-sheet engine',
    prepend: IMPORT('calculateTax', './deal-calculator.js'), expect: 'R-TP1 (1)' },
  { id: 'K2', file: DEALCALC, why: 'the deal-sheet engine imports the term pricing engine',
    prepend: IMPORT('priceQuote', `./${NAME}.js`), expect: 'R-TP1 (2)' },
  { id: 'K3', file: DEALINPUTS, why: 'a dynamic import from deal-sheet pricing code',
    append: `\nexport const __tp = () => ${['im', 'port'].join('')}('./${NAME}.js')\n`, expect: 'R-TP1 (2)' },
  { id: 'K4', file: ENGINE, why: 'the engine reaches the network',
    // The network call is assembled from parts: written whole, this harness would
    // trip the estate's own direct-call scan in api-client.test.mjs.
    append: `\nexport const __net = () => ${['fet', 'ch'].join('')}('/x')\n`, expect: 'R-TP1 (3)' },
  { id: 'K5', file: ENGINE, why: 'float rounding in the engine',
    append: '\nexport const __f = (x) => Math.round(x)\n', expect: 'R-TP1 (3)' },
  { id: 'N1', file: ENGINE, why: 'NEGATIVE: an import inside a comment is prose and must not fire',
    prepend: '// ' + IMPORT('calculateTax', './deal-calculator.js'), expect: null },
]

const read = (f) => readFileSync(join(ROOT, f))
const snapPath = (f) => join(SNAP, key(f))

function stop(msg, code = 2) {
  const restored = restoreAll()
  console.error(`STOP: ${msg}`)
  console.error(restored ? 'All files restored and byte-identical to their snapshots.' : `RESTORE FAILED: snapshots kept in ${SNAP}`)
  if (restored) rmSync(MARKER, { force: true })
  process.exitCode = code
  throw new Error('stopped')
}

function restoreAll() {
  let ok = true
  for (const f of TOUCHED) {
    if (!existsSync(snapPath(f))) { ok = false; continue }
    const orig = readFileSync(snapPath(f))
    writeFileSync(join(ROOT, f), orig)
    if (!read(f).equals(orig)) ok = false
  }
  return ok
}

function runTests() {
  const t0 = Date.now()
  const r = spawnSync('node', ['--test', ...TESTS], { cwd: ROOT, encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  const failed = [...out.matchAll(/^✖ (.+) \([\d.]+ms\)$/gm)].map((m) => m[1])
  const pass = Number(out.match(/^ℹ pass (\d+)/m)?.[1] ?? NaN)
  const fail = Number(out.match(/^ℹ fail (\d+)/m)?.[1] ?? NaN)
  return { status: r.status, failed: [...new Set(failed)], pass, fail, ms: Date.now() - t0 }
}

function main() {
  if (existsSync(MARKER)) {
    console.error(`REFUSED: ${MARKER} exists, so a previous run did not finish its restore.`)
    console.error(`Restore the files from ${SNAP} by hand, compare, then delete the marker.`)
    process.exitCode = 3
    return
  }
  mkdirSync(SNAP, { recursive: true })
  for (const f of TOUCHED) writeFileSync(snapPath(f), read(f))
  for (const f of TOUCHED) {
    if (!existsSync(snapPath(f)) || !readFileSync(snapPath(f)).equals(read(f))) {
      console.error(`STOP: snapshot of ${f} missing or different`); process.exitCode = 2; return
    }
  }

  const base = runTests()
  if (base.status !== 0 || base.fail !== 0 || !(base.pass > 0)) {
    console.error(`STOP: the baseline is not green (pass ${base.pass}, fail ${base.fail})`); process.exitCode = 2; return
  }
  console.log(`baseline: pass ${base.pass}, fail ${base.fail}, ${base.ms}ms`)

  writeFileSync(MARKER, new Date().toISOString())
  const results = []
  try {
    for (const inj of INJECTIONS) {
      const before = read(inj.file).toString('utf8')
      let after
      if (inj.find) {
        const n = before.split(inj.find).length - 1
        if (n !== 1) stop(`${inj.id}: anchor found ${n} times in ${inj.file}`)
        after = before.replace(inj.find, inj.put)
      } else if (inj.prepend) after = inj.prepend + before
      else after = before + inj.append
      writeFileSync(join(ROOT, inj.file), after)
      if (read(inj.file).toString('utf8') === before) stop(`${inj.id}: the injection did not land`)

      const r = runTests()
      if (!Number.isFinite(r.pass) && !Number.isFinite(r.fail)) stop(`${inj.id}: the run produced no result (${r.ms}ms)`)
      let verdict
      if (inj.expect === null) verdict = r.fail === 0 ? 'SILENT (correct)' : `FIRED WRONGLY: ${r.failed.join(' | ')}`
      else verdict = r.failed.some((n) => n.startsWith(inj.expect)) ? 'FIRED' : `SILENT (failed: ${r.failed.join(' | ') || 'none'})`
      results.push({ ...inj, verdict, failCount: r.fail, ms: r.ms })
      console.log(`${inj.id.padEnd(4)} ${verdict.padEnd(18)} fail=${r.fail} ${r.ms}ms  ${inj.why}  [expects: ${inj.expect ?? 'nothing'}]`)

      writeFileSync(join(ROOT, inj.file), readFileSync(snapPath(inj.file)))
      for (const f of TOUCHED) {
        if (!read(f).equals(readFileSync(snapPath(f)))) stop(`${inj.id}: ${f} is not byte-identical after restore`)
      }
    }
  } catch (e) {
    if (e.message !== 'stopped') { stop(`harness error: ${e.message}`) }
    return
  }

  const final = runTests()
  const identical = TOUCHED.every((f) => read(f).equals(readFileSync(snapPath(f))))
  rmSync(MARKER, { force: true })
  console.log(`reverted: pass ${final.pass}, fail ${final.fail}, ${final.ms}ms; files byte-identical: ${identical}`)
  const bad = results.filter((r) => (r.expect === null ? !r.verdict.startsWith('SILENT') : r.verdict !== 'FIRED'))
  console.log(`${results.length - bad.length}/${results.length} injections behaved as expected`)
  if (bad.length || final.fail !== 0 || !identical) process.exitCode = 1
}

try { main() } catch (e) { if (e.message !== 'stopped') throw e }
