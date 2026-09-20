// R-O7 CALIBRATION, PURE SIDE. Sixteen tests went green on their first run,
// which is the tell rather than the proof: a suite written after the change
// agrees with the change. Each injection below removes one behaviour the
// ruling asked for and names the test that must notice.
//
// ANCHORED ON TEST NAMES, not the exit code. An injection that breaks the file
// also exits non-zero, and would score as FIRED with nothing having run.
//
// HARNESS DISCIPLINE (Verification 44): full-path keys, in-flight marker,
// snapshot asserted before injecting, bytes compared after every injection,
// and every stop path restores.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk4/snap-o7`
const MARKER = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

const CALC = `${ROOT}/src/lib/deal-calculator.js`
const INPUTS = `${ROOT}/src/lib/deal-inputs.js`
const BRIDGE = `${ROOT}/src/lib/approval-page.js`
const FILES = [CALC, INPUTS, BRIDGE]
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

const run = () => {
  try { return execFileSync('npm', ['test'], { cwd: ROOT, encoding: 'utf8', timeout: 180000 }) }
  catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
const verdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  if (!line) return { seen: false, red: false, line: `(the test "${name}" never ran)` }
  return { seen: true, red: line.includes('✖'), line: line.trim().slice(0, 96) }
}

const INJECTIONS = [
  {
    what: 'buildCostGroup ignores the override and always prices from the margin',
    file: CALC,
    from: 'const rawPrice = overridden ? Math.round(priceOverride) : priceFromCost(cost, marginPct);',
    to: 'const rawPrice = priceFromCost(cost, marginPct);',
    fires: 'a price override REPLACES the margin price',
  },
  {
    what: 'the implied margin is read off the INPUT margin instead of being derived',
    file: CALC,
    from: 'impliedMarginPct: rawPrice > 0 ? (1 - cost / rawPrice) * 100 : null,',
    to: 'impliedMarginPct: marginPct,',
    fires: 'the implied margin is derived from the override',
  },
  {
    what: 'a zero price reports a margin of zero rather than an absence',
    file: CALC,
    from: 'impliedMarginPct: rawPrice > 0 ? (1 - cost / rawPrice) * 100 : null,',
    to: 'impliedMarginPct: rawPrice > 0 ? (1 - cost / rawPrice) * 100 : 0,',
    fires: 'a zero price has NO margin to state',
  },
  {
    what: 'the fee is used as the type total instead of being multiplied by units',
    file: INPUTS,
    from: 'return Number.isFinite(n) ? n * units : null',
    to: 'return Number.isFinite(n) ? n : null',
    fires: "the fee is multiplied by THAT TYPE'S unit count",
  },
  {
    what: 'a blank fee is coerced to a price of zero',
    file: INPUTS,
    from: "if (fee === undefined || fee === null || fee === '') return null",
    to: 'if (fee === undefined || fee === null) return null',
    fires: 'a BLANK fee is an absence',
  },
  {
    what: 'the mode is ignored, so recorded fees price even in margin mode',
    file: INPUTS,
    from: "const perUnitMode = (payload.hostingPriceMode ?? 'margin') === 'perUnit'",
    to: 'const perUnitMode = true',
    fires: 'switching the mode back to margin ignores the fees',
  },
  {
    what: 'the two override keys leave the approval bridge',
    file: BRIDGE,
    from: "      'hostingPriceMode', 'hostingUnitFees'],",
    to: '      ],',
    fires: 'but a PRICED key no step claims still is',
  },
  {
    what: 'the cost-only Test Bed path stops dropping the override',
    file: CALC,
    from: 'const atCost = (li) => ({ ...li, marginPct: 0, priceOverride: null });',
    to: 'const atCost = (li) => ({ ...li, marginPct: 0 });',
    fires: null,   // EXPECTED SILENT, and explained below rather than ignored.
  },
]

console.log('── HEALTHY ───────────────────────────────────────────────────')
let out = run()
const healthyRed = out.split('\n').filter((l) => l.includes('✖')).length
console.log(`   failing tests on the healthy tree: ${healthyRed}`)
if (healthyRed > 0) stop(3, 'the suite is red before any injection; nothing below means anything')

const results = []
for (const inj of INJECTIONS) {
  const src = readFileSync(inj.file, 'utf8')
  if (!src.includes(inj.from)) stop(3, `anchor not found for: ${inj.what}`)
  if (src.split(inj.from).length - 1 !== 1) stop(3, `anchor is not unique for: ${inj.what}`)
  writeFileSync(inj.file, src.replace(inj.from, inj.to))
  const o = run()
  const v = inj.fires ? verdict(o, inj.fires) : { seen: true, red: false, line: '' }
  const anyRed = o.split('\n').filter((l) => l.includes('✖')).length
  writeFileSync(inj.file, original.get(inj.file))
  if (inj.fires) {
    console.log(`\n${v.red ? 'FIRED ' : 'SILENT'}  ${inj.what}`)
    console.log(`        ${v.line}`)
    results.push([inj.what, v.seen && v.red])
  } else {
    // Verification 51: a silence is a finding and must be EXPLAINED, not
    // ignored. This one is expected: no caller of calculateTestBedCost passes
    // a priceOverride today, so removing the guard changes nothing that runs.
    // It is kept because the guarantee is the docblock's, not the caller's -
    // Architecture 8 - and the silence is what proves there is no test for it.
    console.log(`\n${anyRed > 0 ? 'FIRED ' : 'SILENT'}  ${inj.what}`)
    console.log('        EXPECTED SILENT: no caller passes an override into the cost-only path,')
    console.log('        so this guard is Architecture 8 rather than a live fix. Named, not ignored.')
    results.push([`${inj.what} (expected silent, and is)`, anyRed === 0])
  }
}

restore()
console.log('\n── REVERTED ──────────────────────────────────────────────────')
out = run()
const backRed = out.split('\n').filter((l) => l.includes('✖')).length
console.log(`   failing tests after the revert: ${backRed}`)
results.push(['green again after the revert', backRed === 0])

console.log('')
for (const [what, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
