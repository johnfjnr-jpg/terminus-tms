#!/usr/bin/env node
// ── TP_LADDER Phase 1: CALIBRATION OF THE v2.0 TESTS, EACH INJECTION NAMED ──
//
//   node scripts/term-pricing/calibrate-ladder.mjs
//
// Every new or changed check in the v2.0 engine, settings and route is shown
// FIRING on an injected fault, anchored on the TEST NAME it must fail, not on
// the exit code (Verification 9's clause: read WHICH assertion failed). The
// harness (Verification 44): snapshots every file it touches, keyed by full
// path, and asserts the snapshot exists before injecting; writes an in-flight
// marker and REFUSES to start if one is present; compares the restored bytes
// after EVERY injection and stops dead on a mismatch; restores on every stop
// path, not only the normal one; and ends with a final reverted run, which
// must be all green. Each anchor must match exactly once. UNWIRED: run at the
// phase report and recorded there.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const SNAP = join(ROOT, '.scratch/calibrate-ladder')
const MARKER = join(SNAP, 'IN_FLIGHT')
const TESTS = ['scripts/tests/term-pricing.test.mjs', 'scripts/tests/term-pricing-settings.test.mjs', 'scripts/tests/term-pricing-route.test.mjs']
const E = 'src/lib/term-pricing.js', S = 'src/lib/term-pricing-settings.js', R = 'src/routes/term-pricing.js'

const INJECTIONS = [
  { id: 'L8: a missing term borrows the compare term\'s price', file: E,
    find: `  const price = ladder[T]\n  if (!price) {`, put: `  const price = ladder[T] ?? ladder[p.compareTerm]\n  if (!price) {`, expect: 'LG-7' },
  { id: 'A1: a product with no ladder borrows SafeSight\'s', file: E,
    find: `  const ladder = p.priceLadder[product]\n  if (!ladder) {`, put: `  const ladder = p.priceLadder[product] ?? p.priceLadder.safesight\n  if (!ladder) {`, expect: 'A1: a product with no price ladder' },
  { id: 'Q1: the compare term hard-coded to 36', file: E,
    find: `const compareFeeOf = (p, product) => p.priceLadder[product]?.[p.compareTerm] ?? null`, put: `const compareFeeOf = (p, product) => p.priceLadder[product]?.[36] ?? null`, expect: 'Q1:' },
  { id: 'A6: the grid profit check removed', file: E,
    find: `      if (prev && c.profitCents < prev.profitCents) {`, put: `      if (false && prev && c.profitCents < prev.profitCents) {`, expect: 'LG-6' },
  { id: 'A6: equal read as a fall (client total)', file: E,
    find: `      if (prev && c.tcvCents < prev.tcvCents) {`, put: `      if (prev && c.tcvCents <= prev.tcvCents) {`, expect: 'A6: the grid reads' },
  { id: 'A6: the grid restarts at a gap', file: E,
    find: `      if (!c.priced) continue\n      if (c.belowFloor)`, put: `      if (!c.priced) { prev = null; continue }\n      if (c.belowFloor)`, expect: 'A6: the grid reads' },
  { id: 'A6: the editor\'s "vs" read against band 1 for every band', file: E,
    find: `    const cmpCell = r.cells.find((c) => c.termMonths === p.compareTerm && c.priced)`,
    put: `    const cmpCell = rows[0].cells.find((c) => c.termMonths === p.compareTerm && c.priced)`, expect: 'A6, frame C' },
  { id: 'A6: the typed prices ignored', file: E,
    find: `  if (prices !== undefined) {\n    ladder = {}`, put: `  if (false) {\n    ladder = {}`, expect: 'A6: the grid reads' },
  // The first injection here removed a branch returning the typed fee at its
  // own term; it came back SILENT because the branch was redundant (the exact
  // ratio already prices back to the fee) and the branch was removed. This is
  // the fault the claim is actually about: the derived discount snapped to 0.1%.
  { id: 'A4: a typed fee snapped to a one-decimal discount', file: E,
    find: `  const ratio = sub(ONE, frac(feeCents, listCents))`,
    put: `  const ratio = frac(roundHalfUp(mul(sub(ONE, frac(feeCents, listCents)), fromInt(1000)), 0), 1000n)`, expect: 'DA-3' },
  { id: 'A4: CPI years left undiscounted', file: E,
    find: `c - (k === 0 ? share : roundHalfUp(mul(fromCents(share), factor(k + 1)), 2))`, put: `c - (k === 0 ? share : 0n)`, expect: 'DA-6' },
  { id: 'A4: the whole discount on the first line', file: E,
    find: `      const share = i < lines.length - 1\n        ? roundHalfUp(div(mul(fromCents(discountCents), fromCents(l.listMonthlyCents)), fromCents(listMonthlyCents)), 2)\n        : discountCents - allocated`,
    put: `      const share = i === 0 ? discountCents : 0n`, expect: 'DA-3' },
  { id: 'A4: a fee above list allowed', file: E,
    find: `  if (feeCents > listCents) {`, put: `  if (false) {`, expect: 'DA-4' },
  { id: 'A4: a two-decimal discount accepted', file: E,
    find: `const DEAL_PCT = /^\\d+(\\.\\d)?$/`, put: `const DEAL_PCT = /^\\d+(\\.\\d{1,2})?$/`, expect: 'DA-4' },
  { id: 'A4: the approval signal always on', file: E,
    find: `    approvalSignal: !!adj,`, put: `    approvalSignal: true,`, expect: 'FA-8' },
  { id: 'A4: per camera priced on the deal fee, not list', file: E,
    find: `    return roundHalfUp(div(fromCents(line.listMonthlyCents), fromInt(line.units)), 2)`, put: `    return roundHalfUp(div(fromCents(line.monthlyByYear[0]), fromInt(line.units)), 2)`, expect: 'DA-2' },
  { id: 'Q1: "vs" read on the deal fee, not list', file: E,
    find: `savingVsCompare: compare ? sub(ONE, frac(q.dealDiscount.listMonthlyCents, compare.dealDiscount.listMonthlyCents)) : null,`,
    put: `savingVsCompare: compare ? sub(ONE, frac(q.monthlyTotalCents, compare.monthlyTotalCents)) : null,`, expect: 'DA-3' },
  { id: '3.3: three decimals accepted', file: E,
    find: `const LADDER_PRICE = /^\\d+(\\.\\d{1,2})?$/`, put: `const LADDER_PRICE = /^\\d+(\\.\\d{1,3})?$/`, expect: '3.3 validateLadder' },
  { id: '3.3: a stray term accepted', file: E,
    find: `    if (!list.includes(Number(k)) || !/^\\d+$/.test(k)) {`, put: `    if (false) {`, expect: '3.3 validateLadder' },
  { id: '3.3: a price of 0 accepted', file: E,
    find: `return LADDER_PRICE.test(s) && cmp(parseDecimal(s), ZERO) > 0 ? s : null`, put: `return LADDER_PRICE.test(s) && cmp(parseDecimal(s), ZERO) >= 0 ? s : null`, expect: 'A1, 3.3: a stored price' },
  { id: 'L8: termLadder throws instead of a missing row', file: E,
    find: `      if (!NO_LADDER_CODES.includes(e?.code)) throw e`, put: `      throw e`, expect: 'LG-7' },
  { id: 'FA-8 only: a quote output the spec cases do not read', file: E,
    find: `    cashYear1Cents: cashYear1(final.schedule),`, put: `    cashYear1Cents: cashYear1(final.schedule) + 1n,`, expect: 'FA-8' },
  { id: 'A1: the price ladder not required by the loader', file: S,
    find: `  'TERMS', 'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT',\n`, put: `  'TERMS', 'COMPARE_TERM',\n`, expect: 'a missing setting is refused' },
  { id: 'P3: the settings save writes the price ladder', file: S,
    find: `export const OWN_ROUTE_KEYS = ['PRICE_LADDER_BY_PRODUCT']`, put: `export const OWN_ROUTE_KEYS = []`, expect: 'an invalid change is refused' },
  { id: 'A7: a product the catalog does not price is accepted', file: S,
    find: `    throw new TermPricingError('BAD_PRODUCT', \`No catalog product \${JSON.stringify(product)} to set a price ladder for.\`)`, put: `    void 0`, expect: 'A6, 3.3: an invalid price ladder' },
  { id: 'A6: the price ladder route lets a non-admin through', file: R,
    find: `      request.log.error({ err }, 'term pricing: read before price ladder write failed')\n      return reply.code(err.status ?? 500).send({ error: err.message })\n    }\n\n    if (!state.isAdmin) {`,
    put: `      request.log.error({ err }, 'term pricing: read before price ladder write failed')\n      return reply.code(err.status ?? 500).send({ error: err.message })\n    }\n\n    if (false) {`, expect: 'A6 refusals' },
  { id: 'A7: the route writes the wrong key', file: R,
    find: `if (!await writeKeys(db, request, reply, ['PRICE_LADDER_BY_PRODUCT'], merged)) return reply`, put: `if (!await writeKeys(db, request, reply, ['VOLUME_BANDS_BY_PRODUCT'], merged)) return reply`, expect: 'A7 success' },
]

const files = [...new Set(INJECTIONS.map((i) => i.file))]
const key = (f) => join(SNAP, f.replaceAll('/', '__'))
const snap = new Map()
const restoreAll = () => {
  for (const f of files) {
    writeFileSync(join(ROOT, f), snap.get(f))
    if (readFileSync(join(ROOT, f), 'utf8') !== snap.get(f)) throw new Error(`RESTORE MISMATCH ${f}`)
  }
}
const stop = (msg, code = 3) => {
  try { restoreAll(); unlinkSync(MARKER); console.log(`restored byte-identical; marker removed`) } catch (e) { console.log(`RESTORE FAILED, marker kept: ${e.message}`) }
  console.log(`STOPPED: ${msg}`)
  process.exit(code)
}

mkdirSync(SNAP, { recursive: true })
if (existsSync(MARKER)) { console.log(`REFUSING: ${MARKER} exists. A previous run did not finish; restore from ${SNAP} by hand first.`); process.exit(4) }
for (const f of files) {
  const bytes = readFileSync(join(ROOT, f), 'utf8')
  writeFileSync(key(f), bytes)
  if (!existsSync(key(f)) || readFileSync(key(f), 'utf8') !== bytes) { console.log(`snapshot of ${f} did not land`); process.exit(5) }
  snap.set(f, bytes)
}
writeFileSync(MARKER, new Date().toISOString())
process.on('SIGINT', () => stop('interrupted'))

const run = () => {
  const t0 = Date.now()
  let out = ''
  try { out = execFileSync(process.execPath, ['--test', ...TESTS], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }) }
  catch (e) { out = String(e.stdout ?? '') + String(e.stderr ?? '') }
  const n = (k) => Number(out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm'))?.[1] ?? -1)
  return { out, tests: n('tests'), fail: n('fail'), ms: Date.now() - t0 }
}

const results = []
try {
  for (const inj of INJECTIONS) {
    const cur = snap.get(inj.file)
    const count = cur.split(inj.find).length - 1
    if (count !== 1) stop(`${inj.id}: anchor matched ${count} times in ${inj.file}`)
    writeFileSync(join(ROOT, inj.file), cur.replace(inj.find, () => inj.put))
    if (readFileSync(join(ROOT, inj.file), 'utf8') === cur) stop(`${inj.id}: the injection did not land`)
    const r = run()
    writeFileSync(join(ROOT, inj.file), cur)
    if (readFileSync(join(ROOT, inj.file), 'utf8') !== cur) stop(`${inj.id}: RESTORE MISMATCH`)
    if (r.tests < 150) stop(`${inj.id}: the run did not run the suite (${r.tests} tests, ${r.ms}ms)`)
    const failed = [...r.out.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]).filter((n) => n !== 'failing tests:')
    const fired = failed.some((n) => n.startsWith(inj.expect))
    results.push({ id: inj.id, verdict: fired ? 'FIRED' : 'SILENT', expect: inj.expect, fail: r.fail, ms: r.ms })
    console.log(`${fired ? 'FIRED ' : 'SILENT'}  ${inj.id}  [expect "${inj.expect}"; ${r.fail} failing; ${r.ms}ms]${fired ? '' : `  failed instead: ${[...new Set(failed)].slice(0, 4).join(' | ')}`}`)
  }
  restoreAll()
  const final = run()
  console.log(`\nfinal reverted run: ${final.tests} tests, ${final.fail} failing (${final.ms}ms)`)
  unlinkSync(MARKER)
  const silent = results.filter((r) => r.verdict === 'SILENT').length
  console.log(`${results.length - silent}/${results.length} FIRED; ${silent} SILENT`)
  process.exit(final.fail === 0 && silent === 0 ? 0 : 1)
} catch (e) {
  stop(`unexpected: ${e.message}`)
}
