#!/usr/bin/env node
// ── TERM_PRICING Phase 3: the screen, from the click (E2, E3's screen half) ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/probe-screen.mjs [--flow] [--out <dir>]
//
// Signs in as session-ref.json (john+test, a NON-admin) by session injection,
// opens Term Pricing through the app's own navigate(), and drives the inputs
// with REAL keyboard events (Verification 6: a synthetic value write is
// deduped by React). Every expected figure is COPIED from docs/pricing-spec.md
// (v1.2.3), never computed here.
//
// Default run (E2): T1 with the ladder against table 10.1; T6; T15 with the
// A1 assertion that the selected CAPEX row equals the quote card; T23; T16;
// the no-units refusal; an invalid-units refusal. Then screenshots of the
// ladder, quote and schedule under OPEX (T6) and CAPEX (T15) at 1240 and 1920,
// MEASURED FIRST and captured second (Verification 4).
//
// --flow (E3, run while probe-live.mjs --hold has ANCHOR_MARGIN at 80%): the
// screen's opening quote, T1's inputs, must price at the 80% figures, and the
// non-admin's settings must show 80 and be read-only.
//
// UNWIRED: needs a browser, a live server and a session.

import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-screen.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'
const FLOW = process.argv.includes('--flow')
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : `${ROOT}prototypes/term-pricing/screens`
const RUN = process.env.TP_RUN ?? 'p3'
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]

let failures = 0
const check = (ok, claim, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`)
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1240, height: 1100 })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('#view-term-pricing [data-testid="tp-ladder"]'), { timeout: 15000 })

const V = '#view-term-pricing'
const tid = (t) => `${V} [data-testid="${t}"]`
const text = (t) => page.$eval(tid(t), (e) => e.textContent.trim()).catch(() => null)
// Select the field's whole content, then delete and type with REAL keys, so
// React receives genuine input events. The first version used a triple click,
// which did not select the content here: "1" plus a typed "120" became 1,120
// units, and the figures that followed were self-consistent and wrong. Each
// write is now read back before anything is measured (Verification 44's
// write-side clause: confirm the edit landed).
async function type(t, value) {
  await page.focus(tid(t))
  await page.$eval(tid(t), (e) => e.select())
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
  const got = await page.$eval(tid(t), (e) => e.value)
  if (got !== value) throw new Error(`typing into ${t}: wanted ${JSON.stringify(value)}, the field holds ${JSON.stringify(got)}`)
}
// Wait on the asserted state itself; on timeout report what was there.
async function expectText(t, expected, claim) {
  try {
    await page.waitForFunction((sel, want) => document.querySelector(sel)?.textContent.trim() === want, { timeout: 6000 }, tid(t), expected)
    check(true, claim, expected)
  } catch {
    check(false, claim, `expected ${expected}, saw ${await text(t)}`)
  }
}
const ladderRows = () => page.$$eval(`${V} [data-testid="tp-ladder"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
const scheduleRows = () => page.$$eval(`${V} [data-testid="tp-schedule"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
const linesRows = () => page.$$eval(`${V} .tp-lines tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
const measure = () => page.evaluate(() => {
  const view = document.getElementById('view-term-pricing')
  const over = [...view.querySelectorAll('.tp-card, .tp-figures, table')].filter((e) => e.scrollWidth > e.clientWidth + 1).length
  const figs = new Set([...view.querySelectorAll('.tp-figures > div')].map((d) => Math.round(d.getBoundingClientRect().top))).size
  // LEGIBILITY, not only placement: a figure split over two lines passed every
  // other check here and was found by opening the screenshot (Verification 4).
  // A figure is one line when its height is under 1.6 of its font size, and it
  // must not overflow its cell.
  const broken = [...view.querySelectorAll('.tp-v')].filter((v) => {
    const fs = parseFloat(getComputedStyle(v).fontSize)
    return v.getBoundingClientRect().height > fs * 1.6 || v.scrollWidth > v.parentElement.clientWidth
  }).map((v) => v.textContent)
  return { pageOverflowX: document.documentElement.scrollWidth > window.innerWidth, overflowingBlocks: over, figureRows: figs, brokenFigures: broken }
})
async function capture(name, width) {
  // Measure first, then grow the viewport to the scroll container's content
  // so the PAGE capture holds the whole screen (the app scrolls an inner
  // container, so fullPage alone captures one viewport: Verification 18).
  const m = await measure()
  check(!m.pageOverflowX && m.overflowingBlocks === 0 && m.figureRows === 1 && m.brokenFigures.length === 0, `${name} at ${width}: no overflow, quote figures in one row, no figure broken or clipped`, JSON.stringify(m))
  const h = await page.evaluate(() => document.querySelector('.app-content-scroll').scrollHeight)
  await page.setViewport({ width, height: Math.max(1100, h + 40) })
  await page.waitForFunction(() => true)
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: `${OUT}/${RUN}-${width}-${name}.png` })
  await page.setViewport({ width, height: 1100 })
}

if (FLOW) {
  // T1's inputs at ANCHOR_MARGIN 80%: 15,200 x 0.8 / 0.2 = 60,800; 76,000 / 36
  // = 2,111.11; x 36 = 75,999.96 (the spec's section 11 flow line, derived from
  // the spec's own formulas).
  await expectText('tp-q-monthly', '2,111.11', 'E3 on screen: the opening quote prices at ANCHOR_MARGIN 80%')
  await expectText('tp-q-tcv', '75,999.96', 'E3 on screen: TCV at 80%')
  await page.click(tid('tp-settings-toggle'))
  await page.waitForSelector(tid('tp-set-ANCHOR_MARGIN.safesight'))
  const v = await page.$eval(tid('tp-set-ANCHOR_MARGIN.safesight'), (e) => [e.value, e.disabled])
  check(v[0] === '80' && v[1] === true, "the non-admin's settings show 80 and are read-only", JSON.stringify(v))
  check(!(await page.$(tid('tp-settings-save'))), 'and the non-admin has no Save')
  await capture('flow-80', 1240)
} else {
  // T1 is the screen's opening state.
  await expectText('tp-q-tcv', '151,999.92', 'T1 TCV')
  await expectText('tp-q-margin', '90.0%', 'T1 margin')
  const t101 = [
    ['12 months', '8,666.67', '+105.3%', '104,000.04', '90.0%'], ['24 months', '5,333.33', '+26.3%', '127,999.92', '90.0%'],
    ['36 months', '4,222.22', 'list', '151,999.92', '90.0%'], ['48 months', '3,216.67', '−23.8%', '154,400.16', '88.6%'],
    ['60 months', '2,613.33', '−38.1%', '156,799.80', '87.2%'], ['72 months', '2,211.11', '−47.6%', '159,199.92', '85.9%'],
    ['84 months', '1,923.81', '−54.4%', '161,600.04', '84.7%'], ['96 months', '1,708.33', '−59.5%', '163,999.68', '83.4%'],
    ['120 months', '1,406.67', '−66.7%', '168,800.40', '81.0%'],
  ]
  const lad = await ladderRows()
  check(JSON.stringify(lad) === JSON.stringify(t101), 'the ladder at 1 unit reads table 10.1 row for row (fee, vs 36, TCV, margin)', lad.length + ' rows')

  // T6
  await type('tp-units-safesight', '120')
  await page.click(tid('tp-term-60'))
  await expectText('tp-q-tcv', '17,389,126.20', 'T6 TCV')
  await expectText('tp-q-margin', '86.2%', 'T6 margin')
  const sel6 = await page.$eval(`${V} tr.tp-ladder.on`, (r) => [...r.cells].map((c) => c.textContent.trim()))
  check(sel6[0] === '60 months' && sel6[3] === '17,389,126.20' && sel6[4] === '86.2%', 'the selected ladder row is 60 months and equals the quote card', JSON.stringify(sel6))
  await capture('opex-T6', 1240)

  // T15 (A1)
  await page.click(tid('tp-capex'))
  await expectText('tp-q-upfront', '1,200,000.00', 'T15 upfront')
  await expectText('tp-q-monthly', '269,818.77', 'T15 monthly service fee')
  await expectText('tp-q-tcv', '17,389,126.20', 'T15 TCV ties')
  const sched15 = await scheduleRows()
  check(sched15.length === 2 && sched15[0][0] === 'Upfront (hardware)' && sched15[0][2] === '1,200,000.00'
    && sched15[1][0] === 'Months 1 to 60' && sched15[1][1] === '60' && sched15[1][2] === '269,818.77', 'T15 schedule: upfront then 60 x service fee', JSON.stringify(sched15.map((r) => r.slice(0, 3))))
  const head = await page.$$eval(`${V} [data-testid="tp-ladder"] thead th`, (t) => t.map((x) => x.textContent.trim()))
  check(head[1] === 'Upfront' && head[2] === 'Monthly service fee (year 1)', 'A1: under CAPEX the ladder shows Upfront and Monthly service fee (year 1)', JSON.stringify(head))
  const sel15 = await page.$eval(`${V} tr.tp-ladder.on`, (r) => [...r.cells].map((c) => c.textContent.trim()))
  const card = [await text('tp-q-upfront'), await text('tp-q-monthly'), await text('tp-q-tcv'), await text('tp-q-margin')]
  check(!!sel15[1] && sel15[1] === card[0] && sel15[2] === card[1] && sel15[4] === card[2] && sel15[5] === card[3],
    'A1: the selected CAPEX row EQUALS the quote card (upfront, service fee, TCV, margin)', `${JSON.stringify(sel15)} vs ${JSON.stringify(card)}`)
  check((await linesRows()).length > 0 && (await page.$eval(`${V} .tp-split .tp-label`, (e) => e.textContent.trim())) === 'Pricing basis (OPEX fees)', 'under CAPEX the lines table reads "Pricing basis (OPEX fees)"')
  await capture('capex-T15', 1240)

  // T23
  await page.click(tid('tp-opex'))
  await type('tp-units-air_quality', '30')
  await expectText('tp-q-tcv', '19,079,808.60', 'T23 TCV')
  await expectText('tp-q-margin', '86.2%', 'T23 margin')
  const lines23 = await linesRows()
  const aqBands = lines23.filter((r) => r[0].startsWith('units')).slice(-2).map((r) => [r[0], r[2]])
  check(JSON.stringify(aqBands) === JSON.stringify([['units 1 to 9 at 0% off', '973.33'], ['units 10 to 49 at 5% off', '924.67']]), 'T23 AQ band fees 973.33 and 924.67', JSON.stringify(aqBands))
  const cost23 = await page.$$eval(`${V} .tp-split > div:last-child tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
  check(cost23.some((r) => r[0] === 'Hardware and hosting cost' && r[1] === '2,640,000.00'), 'T23 cost 2,640,000.00')

  // T16
  await type('tp-units-air_quality', '0')
  await type('tp-units-safesight', '1')
  await type('tp-escalator', '3')
  await expectText('tp-q-tcv', '166,494.36', 'T16 TCV')
  await expectText('tp-q-margin', '88.0%', 'T16 margin')
  const sched16 = (await scheduleRows()).map((r) => r[2])
  check(JSON.stringify(sched16) === JSON.stringify(['2,613.33', '2,691.73', '2,772.48', '2,855.66', '2,941.33']), 'T16 year fees', JSON.stringify(sched16))

  // Errors: no units (T18), and invalid units.
  await type('tp-escalator', '')
  await type('tp-units-safesight', '0')
  await expectText('tp-error', 'Enter at least one unit of at least one product.', 'T18 on screen: no units is refused in words')
  check(!(await page.$(tid('tp-ladder'))), 'and no ladder or quote is shown beside the refusal')
  // An invalid PERCENTAGE, typed. The units field cannot be given a non-digit
  // here: it carries inputMode="numeric" and this headless Chrome drops "."
  // and letters at the browser, measured key by key with defaultPrevented
  // false on every one, while GST and the escalator accept "2.5x". So the
  // typed refusal is proven on GST, and the units refusal stays a unit test.
  await type('tp-units-safesight', '1')
  await type('tp-gst', '9x')
  await expectText('tp-error', 'GST must be a percentage, for example 9.', 'an invalid GST is refused in words')
  await type('tp-gst', '9')

  // 1920: the same two states, measured then captured.
  await page.setViewport({ width: 1920, height: 1100 })
  await type('tp-units-safesight', '120')
  await page.click(tid('tp-term-60'))
  await expectText('tp-q-tcv', '17,389,126.20', 'T6 at 1920')
  await capture('opex-T6', 1920)
  await page.click(tid('tp-capex'))
  await expectText('tp-q-upfront', '1,200,000.00', 'T15 at 1920')
  await capture('capex-T15', 1920)
}

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
