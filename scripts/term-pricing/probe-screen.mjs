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
// TERM_PRICING_2 (--tp2): T24 to T28 from the click. The live TERMS setting is
// John's to change after the push, so the 108-month case runs with spec v1.3's
// TERMS passed IN TEST: written into the browser's copy of the real GET
// response and nowhere else. Every other byte is the route's.
const TP2 = process.argv.includes('--tp2')
// QUOTE_PANEL (--qp): the approved pictures' two states, from the click.
const QP = process.argv.includes('--qp')
// PER_CAMERA_AND_CAPEX_P0 (--pc): spec v1.5's T31 from the click, the "-" at
// zero SafeSight units. TP_CAPEX (C-10) FLIPS its CAPEX half: the OPEX
// per-camera column shows under CAPEX, and it is the only figure column.
const PC = process.argv.includes('--pc')
// TP_CAPEX (--capex): the approved mockup's four states from the click
// (prototypes/term-pricing-capex.html), with G-C1 to G-C6 copied from spec
// v1.6 section 11.1, never computed here. Run with --spec: the demo deal's
// figures are the spec's 90% margins.
const CAPEXM = process.argv.includes('--capex')
// --spec (PER_CAMERA_AND_CAPEX_P0, POSITION): the live ANCHOR_MARGIN for
// SafeSight was set to 50 by John's account on 2026-10-07, after the TILE_FIT
// push, so every spec figure this probe copies (90% throughout, spec section
// 3) is now a different deal from the live one. The live row is John's data
// and is not written back. With --spec the spec's margins are passed IN TEST,
// into the browser's copy of the real GET response and nowhere else, the same
// way --tp2 passes TERMS. Without --spec the probe reads the live settings.
const SPEC = process.argv.includes('--spec')
const SPEC_MARGINS = { safesight: '90', air_quality: '90', hemir: '90' }
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
if (TP2 || SPEC) {
  const over = {
    ...(TP2 ? { TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] } : {}),
    ...(SPEC ? { ANCHOR_MARGIN: SPEC_MARGINS, SHORT_TERM_MARGIN: SPEC_MARGINS } : {}),
  }
  await page.evaluateOnNewDocument((over) => {
    const real = window.fetch
    window.fetch = async (...a) => {
      const res = await real(...a)
      if (!/\/api\/term-pricing(\?|$)/.test(String(a[0]?.url ?? a[0])) || !res.ok) return res
      const body = await res.clone().json()
      return new Response(JSON.stringify({ ...body, settings: { ...body.settings, ...over } }),
        { status: res.status, headers: res.headers })
    }
  }, over)
}
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
// RE-POINTED by QUOTE_PANEL: `.tp-lines` now marks the pricing, profit and
// schedule tables of the one panel, so the band rows are read from the pricing
// table by its test id. Columns: band, units, list fee, discount, fee, monthly.
const linesRows = () => page.$$eval(`${V} [data-testid="tp-pricing"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
const measure = () => page.evaluate(() => {
  const view = document.getElementById('view-term-pricing')
  const over = [...view.querySelectorAll('.tp-card, .tp-figures, table')].filter((e) => e.scrollWidth > e.clientWidth + 1).length
  // TP_CAPEX: under CAPEX the quote carries up to nine tiles, and TILE_FIT's F3
  // wraps a row that cannot fit at the floor into two rows of equal tiles. So
  // the claim is one row, or exactly two rows when the row is marked wrapped.
  const figRow = view.querySelector('.tp-figures')
  const tops = new Set([...view.querySelectorAll('.tp-figures > div')].map((d) => Math.round(d.getBoundingClientRect().top))).size
  const figs = tops === 2 && figRow?.classList.contains('tp-figures--wrap') ? 1 : tops
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
} else if (TP2) {
  const sw = async (id, on) => {
    if ((await page.$eval(tid(id), (e) => e.getAttribute('aria-checked'))) !== String(on)) await page.click(tid(id))
    await page.waitForFunction((s, v) => document.querySelector(s)?.getAttribute('aria-checked') === String(v), {}, tid(id), on)
  }
  const sched = () => scheduleRows()
  const foot = async (what) => {
    const c = async (t) => { const s = await text(t); return s == null ? 0n : BigInt(s.replace(/[,.]/g, '')) }
    const [tcv, up, gst, incl] = [await c('tp-q-tcv'), await c('tp-q-grossup'), await c('tp-q-gst'), await c('tp-q-tcvincl')]
    check(tcv > 0n && incl > 0n && tcv + up + gst === incl, `L1 ${what}: TCV (net) + WHT gross-up + GST = TCV incl. GST`, `${tcv} + ${up} + ${gst} vs ${incl}`)
  }

  // T26: 1 unit, 108 months (TERMS passed in test).
  await page.click(tid('tp-term-108'))
  await expectText('tp-q-tcv', '166,399.92', 'T26 TCV at 108 months')
  await expectText('tp-q-margin', '82.2%', 'T26 margin')
  const row108 = await page.$eval(tid('tp-ladder-108'), (r) => [...r.cells].map((c) => c.textContent.trim()))
  // RE-POINTED by PER_CAMERA_AND_CAPEX_P0: cell 2 is now per camera.
  check(row108[1] === '1,540.74' && row108[3] === '−63.5%', 'the ladder carries 108: fee 1,540.74, vs 36 −63.5% (table 10.1)', JSON.stringify(row108))

  // T27 (spec v1.6): 1 unit, 60, CPI LOCKED 3% from year 3, through the CPI
  // mode, the rate and the start-year select.
  await page.click(tid('tp-term-60'))
  await page.click(tid('tp-cpi-locked'))
  await page.waitForSelector(tid('tp-escalator'))
  await type('tp-escalator', '3')
  await page.waitForFunction((s) => document.querySelector(s) && !document.querySelector(s).disabled, {}, tid('tp-escalator-start'))
  await page.select(tid('tp-escalator-start'), '3')
  await expectText('tp-q-tcv', '162,558.36', 'T27 Final TCV')
  await expectText('tp-p-base', '156,799.80', 'T27 Base TCV')
  await expectText('tp-q-margin', '87.2%', 'T27 margin, on Base')
  await expectText('tp-p-deal', 'Final TCVCPI locked', 'T27 deal value is Final TCV under Locked')
  const s27 = (await sched()).map((r) => [r[0], r[2]])
  check(JSON.stringify(s27) === JSON.stringify([['Months 1 to 24', '2,613.33'], ['Months 25 to 36', '2,691.73'], ['Months 37 to 48', '2,772.48'], ['Months 49 to 60', '2,855.66']]),
    'T27 year fees 2,613.33 / 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 (years 1 and 2 one run)', JSON.stringify(s27))

  // T28 (spec v1.6): T6 as capex, CPI PUBLISHED 3% from year 3.
  await type('tp-units-safesight', '120')
  await page.click(tid('tp-capex'))
  await page.click(tid('tp-cpi-published'))
  await expectText('tp-q-tcv', '17,983,678.32', 'T28 Final TCV (projected)')
  await expectText('tp-p-base', '17,389,126.20', 'T28 Base TCV')
  await expectText('tp-q-capex', '1,200,000.00', 'T28 CAPEX')
  await expectText('tp-p-deal', 'Base TCV', 'T28 deal value is Base TCV under Published')
  const s28 = (await sched()).map((r) => [r[0], r[1], r[2]])
  check(JSON.stringify(s28.slice(0, -1)) === JSON.stringify([['0', '1,200,000.00', '-'], ['1 to 24', '-', '269,818.77'], ['25 to 36', '-', '277,913.33'],
    ['37 to 48', '-', '286,250.73'], ['49 to 60', '-', '294,838.26']]),
  'T28 subscription by year 269,818.77 / 269,818.77 / 277,913.33 / 286,250.73 / 294,838.26', JSON.stringify(s28))

  // T24: T6 as capex, split WHT hardware 5% / service 10%, gross-up OFF, no CPI.
  await page.click(tid('tp-cpi-none'))
  await sw('tp-wht-split', true)
  await sw('tp-wht-grossup', false)
  await type('tp-wht-hw', '5')
  await type('tp-wht-saas', '10')
  check(!(await page.$(tid('tp-wht'))), 'B4: with Split WHT on, the single WHT input is hidden')
  // RE-POINTED by TP_CAPEX: the CAPEX schedule leads with Months | CAPEX |
  // Subscription | Invoice, so WHT is cell 7 and Terminus receives cell 8.
  await page.waitForFunction((s) => [...document.querySelectorAll(s)].some((r) => r.cells[7]?.textContent.trim() === '60,000.00'), { timeout: 6000 }, `${V} [data-testid="tp-schedule"] tbody tr`).catch(() => {})
  const s24 = await sched()
  check(s24[0][0] === '0' && s24[0][1] === '1,200,000.00' && s24[0][7] === '60,000.00' && s24[0][8] === '1,140,000.00', 'T24 WHT on the CAPEX invoice 60,000.00, Terminus receives 1,140,000.00', JSON.stringify(s24[0]))
  check(s24[1][0] === '1 to 60' && s24[1][2] === '269,818.77' && s24[1][7] === '26,981.88' && s24[1][8] === '242,836.89', 'T24 WHT per subscription invoice 26,981.88, Terminus receives 242,836.89', JSON.stringify(s24[1]))
  // RE-POINTED by QUOTE_PANEL: the Profit table is gone; WHT borne is the
  // profit table's whole-deal row, shown negative in the gross profit column.
  const prof24 = await page.$$eval(`${V} [data-testid="tp-profit-wht"]`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
  check(prof24.length === 1 && prof24[0][0] === 'WHT borne by Terminus (whole deal)' && prof24[0][4] === '-1,678,912.80', 'T24 total WHT borne 1,678,912.80', JSON.stringify(prof24))
  check(!(await page.$(tid('tp-q-grossup'))), 'L1: with Gross up off there is no WHT gross-up tile')
  await foot('T24')

  // T25: T6 as opex, split WHT 5% / 10%, gross-up ON, GST 0.
  await page.click(tid('tp-opex'))
  await sw('tp-wht-grossup', true)
  await type('tp-gst', '0')
  await page.waitForFunction((s) => document.querySelector(s)?.textContent.trim() === '320,851.26', { timeout: 6000 }, `${V} [data-testid="tp-sched-monthly-1"] td:nth-child(4)`).catch(() => {})
  const s25 = await sched()
  check(s25[0][0] === 'Months 1 to 60' && s25[0][3] === '320,851.26', 'T25 invoice total 320,851.26', JSON.stringify(s25[0]))
  check(JSON.stringify([s25[1][0], s25[1][2], s25[1][3], s25[1][6], s25[1][7]]) === JSON.stringify(['Hardware line', '20,000.00', '21,052.63', '1,052.63', '20,000.00']),
    'T25 hardware line 20,000.00 -> invoice 21,052.63, WHT 1,052.63, receives 20,000.00', JSON.stringify(s25[1]))
  // I5 (TP_INPUTS): the schedule names the line "SaaS line".
  check(JSON.stringify([s25[2][0], s25[2][2], s25[2][3], s25[2][6], s25[2][7]]) === JSON.stringify(['SaaS line', '269,818.77', '299,798.63', '29,979.86', '269,818.77']),
    'T25 service line 269,818.77 -> invoice 299,798.63, WHT 29,979.86, receives 269,818.77', JSON.stringify(s25[2]))
  check(!!(await page.$(tid('tp-q-grossup'))), 'L1: with Gross up on the WHT gross-up tile is shown')
  await foot('T25')

  // TP_INPUTS E3: Split WHT swaps the fields IN PLACE. Off, the single WHT
  // field takes the hardware field's place in the same tax row; on again, both
  // return and T25 still reads.
  const box = (t) => page.$eval(tid(t), (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top) } }).catch(() => null)
  const rowTop = () => page.$eval(tid('tp-tax-row'), (e) => Math.round(e.getBoundingClientRect().top))
  const [hwOn, saasOn, topOn] = [await box('tp-wht-hw'), await box('tp-wht-saas'), await rowTop()]
  await sw('tp-wht-split', false)
  const [single, topOff, hwGone] = [await box('tp-wht'), await rowTop(), await box('tp-wht-hw')]
  check(!!hwOn && !!saasOn && !!single && single.l === hwOn.l && single.t === hwOn.t && topOff === topOn && hwGone === null,
    'E3 Split WHT off: one WHT field, in the hardware field\'s place, same tax row', JSON.stringify({ hwOn, saasOn, single, topOn, topOff }))
  await sw('tp-wht-split', true)
  const [hwBack, saasBack] = [await box('tp-wht-hw'), await box('tp-wht-saas')]
  check(JSON.stringify(hwBack) === JSON.stringify(hwOn) && JSON.stringify(saasBack) === JSON.stringify(saasOn) && !(await page.$(tid('tp-wht'))),
    'E3 Split WHT on again: both fields back in place, the single field gone', JSON.stringify({ hwBack, saasBack }))
  await page.waitForFunction((s) => document.querySelector(s)?.textContent.trim() === '320,851.26', { timeout: 6000 }, `${V} [data-testid="tp-sched-monthly-1"] td:nth-child(4)`).catch(() => {})
  const s25b = await sched()
  check(s25b[0][3] === '320,851.26' && s25b[1][3] === '21,052.63' && s25b[2][0] === 'SaaS line' && s25b[2][3] === '299,798.63',
    'E3 T25 still reads with split on and gross-up on after the swap', JSON.stringify(s25b.slice(0, 3).map((r) => [r[0], r[3]])))
  await capture('tp2-T25', 1240)
} else if (PC) {
  // ── PER_CAMERA_AND_CAPEX_P0 A1: T31 from the click. Every expected figure
  // is COPIED from spec v1.5's T31, never computed here.
  const T31 = [['12', '8,009.44'], ['24', '4,928.89'], ['36', '3,902.04'], ['48', '2,972.74'], ['60', '2,415.16'],
    ['72', '2,043.44'], ['84', '1,777.92'], ['96', '1,578.79'], ['108', '1,423.90'], ['120', '1,299.99']]
  await type('tp-units-safesight', '120'); await type('tp-units-air_quality', '40'); await type('tp-units-hemir', '2')
  await expectText('tp-ladder-percam-120', '1,299.99', 'T31 settled (120 months)')
  const head = await page.$$eval(`${V} [data-testid="tp-ladder"] thead th`, (t) => t.map((x) => x.textContent.trim()))
  check(head[1] === 'Monthly fee (year 1)' && head[2] === 'Per camera / mo', 'A1 "Per camera / mo" sits directly after the monthly fee column', JSON.stringify(head))
  const got = await page.$$eval(`${V} [data-testid="tp-ladder"] tbody tr`, (rs) => rs.map((r) => [r.cells[0].textContent.trim().replace(' months', ''), r.cells[2].textContent.trim()]))
  check(JSON.stringify(got) === JSON.stringify(T31), 'T31 per camera at every term, from the click', JSON.stringify(got))
  await capture('pc-opex-T31', 1240)
  // Zero SafeSight units: every row reads "-", and the rest of the ladder still prices.
  await type('tp-units-safesight', '0')
  await expectText('tp-ladder-percam-60', '-', 'A1 per camera reads "-" with 0 SafeSight units')
  const dash = await page.$$eval(`${V} [data-testid="tp-ladder"] tbody tr`, (rs) => rs.map((r) => r.cells[2].textContent.trim()))
  check(dash.length === T31.length && dash.every((d) => d === '-'), 'A1 every row reads "-" with 0 SafeSight units', JSON.stringify(dash))
  // FLIPPED by TP_CAPEX (C-10): under CAPEX the ladder is Term and the OPEX
  // per-camera fee ONLY, the same T31 figures. SUPERSEDED, QUOTED NOT
  // DELETED: "A1 under CAPEX the column is not shown".
  await type('tp-units-safesight', '120')
  await page.click(tid('tp-capex'))
  await page.waitForFunction((s) => document.querySelector(s)?.textContent.includes('OPEX / cam / mo'), { timeout: 6000 }, `${V} [data-testid="tp-ladder"] thead`)
  const capHead = await page.$$eval(`${V} [data-testid="tp-ladder"] thead th`, (t) => t.map((x) => x.textContent.trim()))
  check(JSON.stringify(capHead) === JSON.stringify(['Term', 'OPEX / cam / mo']), 'C-10 under CAPEX the ladder is Term and OPEX / cam / mo only', JSON.stringify(capHead))
  const capGot = await page.$$eval(`${V} [data-testid="tp-ladder"] tbody tr`, (rs) => rs.map((r) => [r.cells[0].textContent.trim().replace(' months', ''), r.cells[1].textContent.trim()]))
  check(JSON.stringify(capGot) === JSON.stringify(T31), 'C-10 the OPEX per-camera column shows under CAPEX, T31 unchanged', JSON.stringify(capGot))
  check(!(await page.$(`${V} [data-testid="tp-ladder"] th`).then((h) => h && h.evaluate(() => [...document.querySelectorAll('#view-term-pricing [data-testid="tp-ladder"] th')].some((t) => /upfront|service/i.test(t.textContent))))),
    'C-10 no CAPEX column (upfront, service fee) on the ladder')
  await capture('pc-capex-T31', 1240)
} else if (CAPEXM) {
  // ── TP_CAPEX: THE APPROVED MOCKUP'S FOUR STATES, FROM THE CLICK ─────────
  // prototypes/term-pricing-capex.html, John 2026-10-10. Figures COPIED from
  // spec v1.6 11.1 (G-C1 to G-C6) and from the mockup's own text, never
  // computed here. The demo deal: 120 SafeSight, 40 AQ, 2 HEMIR, 60 months.
  const rows4 = async () => (await scheduleRows()).map((r) => r.slice(0, 4))
  const want = (got, exp, claim) => check(JSON.stringify(got) === JSON.stringify(exp), claim, JSON.stringify(got))
  const sw = async (id, on) => {
    if ((await page.$eval(tid(id), (e) => e.getAttribute('aria-checked'))) !== String(on)) await page.click(tid(id))
    await page.waitForFunction((s, v) => document.querySelector(s)?.getAttribute('aria-checked') === String(v), {}, tid(id), on)
  }
  const T31 = [['12 months', '8,009.44'], ['24 months', '4,928.89'], ['36 months', '3,902.04'], ['48 months', '2,972.74'], ['60 months', '2,415.16'],
    ['72 months', '2,043.44'], ['84 months', '1,777.92'], ['96 months', '1,578.79'], ['108 months', '1,423.90'], ['120 months', '1,299.99']]
  await type('tp-units-safesight', '120'); await type('tp-units-air_quality', '40'); await type('tp-units-hemir', '2')
  await page.click(tid('tp-term-60'))
  await page.click(tid('tp-capex'))

  // ── State 1: the default. Hardware, Hybrid 100% at month 0, no CPI (G-C1).
  await expectText('tp-q-cash1', '5,643,722.24', 'G-C1 cash in year 1')
  await expectText('tp-q-cash1-note', 'vs OPEX 4,403,722.20', 'G-C1 against OPEX year 1')
  await expectText('tp-p-base', '22,018,611.00', 'S1 Base TCV')
  await expectText('tp-p-base-note', 'No CPI · margin 86.5% on Base', 'S1 Base note')
  // The tag's TEXT alone would pass on a tag moved to Final TCV: assert its
  // place, the cell that holds Base TCV's figure (Q6: approval follows Base).
  // A missing tag must FAIL this check, not end the run (the view calibration's
  // first W3 run died here with no verdict, which reads as silence).
  check(await page.$eval(tid('tp-approval-tag'), (t) => t.textContent.trim() === 'Approval' && !!t.closest('.tp-price > div')?.querySelector('[data-testid="tp-p-base"]')).catch(() => false),
    'S1 the APPROVAL tag sits on Base TCV')
  await expectText('tp-p-final', '22,018,611.00', 'S1 Final TCV')
  await expectText('tp-p-final-note', 'Same as Base: no CPI applied', 'S1 Final note')
  await expectText('tp-p-opex', '366,976.85', 'S1 OPEX monthly fee (year 1), reference')
  await expectText('tp-p-deal', 'Base TCV', 'S1 deal value Base TCV')
  await expectText('tp-p-deal-note', 'Pipeline value', 'Q6 the deal value card reads "Pipeline value"')
  await expectText('tp-price-lock', 'locked: CAPEX changes timing only', 'S1 the price lock chip')
  check((await page.$eval(tid('tp-capex-hardware'), (e) => e.getAttribute('aria-pressed'))) === 'true'
    && (await page.$eval(tid('tp-capex-hybrid'), (e) => e.getAttribute('aria-pressed'))) === 'true', 'S1 defaults: Hardware and Hybrid')
  check(JSON.stringify(await page.$eval(tid('tp-capex-amount'), (e) => [e.value, e.disabled])) === JSON.stringify(['1,550,000.00', true]), 'G-C1 CAPEX amount 1,550,000.00, read-only under Hardware')
  await expectText('tp-capex-amount-note', 'Hardware including markup (cost / (1 − 20%)). Default.', 'S1 the amount note')
  check(JSON.stringify(await page.$eval(tid('tp-ms-0'), (r) => [r.querySelector('select').value, ...[...r.querySelectorAll('input')].map((i) => i.value)])) === JSON.stringify(['Contract start', '0', '100']),
    'S1 the default row: Contract start, month 0, 100%')
  const options = await page.$eval(tid('tp-ms-key-0'), (s) => [...s.options].map((o) => o.value))
  want(options, ['Contract start', 'Hardware delivered to site', 'Installation complete', 'Commissioning', 'Go live', 'Final acceptance'],
    'C-11 the dropdown is the shared milestone list')
  await expectText('tp-ms-amount-0', '1,550,000.00', 'S1 row amount')
  await expectText('tp-ms-status', '✓ Shares total exactly 100%', 'S1 shares status')
  await expectText('tp-ms-add', '+ Add milestone (1 of 5)', 'S1 add button')
  await expectText('tp-subscription-note', '(22,018,611.00 − 1,550,000.00) / 60 = 341,143.52 a month; month 60 = 341,143.32', 'G-C1 the subscription line')
  await expectText('tp-q-capex', '1,550,000.00', 'S1 CAPEX tile'); await expectText('tp-q-capex-note', 'month 0, on signature', 'S1 CAPEX tile note')
  await expectText('tp-q-subscription', '341,143.52', 'S1 subscription tile')
  await expectText('tp-q-tcv', '22,018,611.00', 'S1 TCV tile'); await expectText('tp-q-tcv-note', 'ties exactly', 'S1 "ties exactly"')
  want(await rows4(), [['0', '1,550,000.00', '-', '1,550,000.00'], ['1 to 59', '-', '341,143.52', '341,143.52'], ['60', '-', '341,143.32', '341,143.32'],
    ['Total', '1,550,000.00', '20,468,611.00', '22,018,611.00']], 'G-C1 the payment schedule reads the mockup, Total row included')
  want(await page.$$eval(`${V} [data-testid="tp-schedule"] thead th`, (t) => t.slice(0, 4).map((x) => x.textContent.trim())), ['Months', 'CAPEX', 'Subscription', 'Invoice (each month)'],
    'C-13 the four mockup columns lead the schedule')
  want(await ladderRows(), T31, 'C-10 the ladder is Term and OPEX / cam / mo, T31')
  // The HEAD as well as the rows: the view calibration's W4 kept the OPEX heads
  // over the per-camera rows and the rows alone could not see it.
  want(await page.$$eval(`${V} [data-testid="tp-ladder"] thead th`, (t) => t.map((x) => x.textContent.trim())), ['Term', 'OPEX / cam / mo'],
    'C-10 the ladder is Term and OPEX / cam / mo: the head')
  await expectText('tp-schedule-note', 'Default under CAPEX: Hardware amount, Hybrid, one milestone at 100% on signature. CAPEX plus the subscription ties to Base TCV 22,018,611.00 exactly before the CPI; the last instalment, milestone and month carry the rounding.', 'S1 the schedule note')
  check(!(await page.evaluate(() => document.getElementById('view-term-pricing').textContent.includes('Mockup figures use'))), 'Q11 the mockup\'s margin banner is not built')
  check(!!(await page.$(tid('tp-rules'))) && (await text('tp-rules-tax')).includes('installation and annual invoicing') && !(await text('tp-rules-tax')).includes('PO factoring'),
    'Q13 the tax note names installation and annual invoicing only; PO factoring stays')
  for (const w of [1240, 1600, 1920]) { await page.setViewport({ width: w, height: 1100 }); await capture('capex-s1-default', w) }
  await page.setViewport({ width: 1240, height: 1100 })

  // ── State 2: Custom 1,000,000.00; Contract start / Hardware delivered / Commissioning (G-C2).
  await page.click(tid('tp-capex-custom'))
  check((await page.$eval(tid('tp-capex-amount'), (e) => [e.value, e.disabled]))[1] === false, 'S2 the amount is editable under Custom')
  await type('tp-capex-amount', '1000000.00')
  await type('tp-ms-share-0', '30')
  await page.click(tid('tp-ms-add'))
  await page.waitForSelector(tid('tp-ms-1'))
  check((await page.$eval(tid('tp-ms-key-1'), (s) => s.value)) === 'Hardware delivered to site', 'S2 a new row takes the first unused milestone')
  check(await page.$eval(tid('tp-ms-key-1'), (s) => s.querySelector('option[value="Contract start"]').disabled), 'S2 a milestone used on another row cannot be chosen twice')
  await type('tp-ms-month-1', '3'); await type('tp-ms-share-1', '40')
  await page.click(tid('tp-ms-add'))
  await page.waitForSelector(tid('tp-ms-2'))
  await page.select(tid('tp-ms-key-2'), 'Commissioning')
  await type('tp-ms-month-2', '6'); await type('tp-ms-share-2', '29.9')
  // G-C4 from the click: 99.9% is refused, in words, and only the quote goes.
  await expectText('tp-ms-status', 'The milestone shares total 99.9%. They must total exactly 100%.', 'G-C4 shares of 99.9% are refused, in words')
  check(!(await page.$(tid('tp-price'))) && !!(await page.$(tid('tp-capex-card'))) && !!(await page.$(tid('tp-ladder'))),
    'G-C4 the refusal removes the price and quote; the CAPEX card and the ladder stay to fix it')
  await type('tp-ms-share-2', '30')
  await expectText('tp-q-cash1', '5,203,722.16', 'G-C2 cash in year 1')
  for (const [i, a] of [[0, '300,000.00'], [1, '400,000.00'], [2, '300,000.00']]) await expectText(`tp-ms-amount-${i}`, i === 2 ? `${a} carries rounding` : a, `G-C2 milestone ${i + 1} amount`)
  await expectText('tp-warn-funds', 'CAPEX 1,000,000.00 is below hardware cost 1,240,000.00: Terminus funds 240,000.00 of hardware. Quote allowed.', 'G-C2 warning (a): Terminus funds 240,000.00')
  await expectText('tp-subscription-note', '(22,018,611.00 − 1,000,000.00) / 60 = 350,310.18 a month; month 60 = 350,310.38', 'G-C2 the subscription line')
  await expectText('tp-q-capex-note', '3 milestones', 'S2 CAPEX tile note')
  want(await rows4(), [['0', '300,000.00', '-', '300,000.00'], ['1 to 2', '-', '350,310.18', '350,310.18'], ['3', '400,000.00', '350,310.18', '750,310.18'],
    ['4 to 5', '-', '350,310.18', '350,310.18'], ['6', '300,000.00', '350,310.18', '650,310.18'], ['7 to 59', '-', '350,310.18', '350,310.18'],
    ['60', '-', '350,310.38', '350,310.38'], ['Total', '1,000,000.00', '21,018,611.00', '22,018,611.00']], 'G-C2 the payment schedule reads the mockup')
  await expectText('tp-schedule-note', 'A milestone in a subscription month adds to that month\'s invoice. CAPEX plus the subscription ties to Base TCV 22,018,611.00 exactly before the CPI; the last instalment, milestone and month carry the rounding.', 'S2 the schedule note')
  for (const w of [1240, 1600, 1920]) { await page.setViewport({ width: w, height: 1100 }); await capture('capex-s2-custom', w) }
  await page.setViewport({ width: 1240, height: 1100 })

  // ── State 3: Hardware over 12 months, Two-phase (G-C3).
  await page.click(tid('tp-capex-hardware'))
  await page.click(tid('tp-capex-two-phase'))
  check((await page.$eval(tid('tp-capex-recovery'), (e) => e.value)) === '12', 'S3 the recovery period defaults to 12')
  await expectText('tp-capex-instalments', '129,166.67 × 11, month 12 = 129,166.63 (carries rounding)', 'G-C3 the instalments')
  await expectText('tp-q-capex', '129,166.67', 'S3 CAPEX / month tile'); await expectText('tp-q-capex-note', 'months 1 to 12', 'S3 tile note')
  await expectText('tp-q-cash1', '5,643,722.24', 'G-C3 cash in year 1')
  want(await rows4(), [['1 to 11', '129,166.67', '341,143.52', '470,310.19'], ['12', '129,166.63', '341,143.52', '470,310.15'],
    ['13 to 59', '-', '341,143.52', '341,143.52'], ['60', '-', '341,143.32', '341,143.32'], ['Total', '1,550,000.00', '20,468,611.00', '22,018,611.00']],
  'G-C3 the payment schedule reads the mockup')
  await expectText('tp-schedule-note', 'Phase 1 (months 1 to 12): CAPEX instalment plus subscription. Phase 2 (months 13 to 60): subscription only. CAPEX plus the subscription ties to Base TCV 22,018,611.00 exactly before the CPI; the last instalment, milestone and month carry the rounding.', 'S3 the schedule note')
  for (const w of [1240, 1600, 1920]) { await page.setViewport({ width: w, height: 1100 }); await capture('capex-s3-two-phase', w) }
  await page.setViewport({ width: 1240, height: 1100 })
  // G-C4 from the click: R past the term is refused.
  await type('tp-capex-recovery', '61')
  await expectText('tp-error', 'The recovery period must be a whole number of months from 1 to 60.', 'G-C4 R > T is refused, in words')
  await type('tp-capex-recovery', '12')

  // ── State 4: CPI locked at 3% from year 2, on the default (G-C5).
  await page.click(tid('tp-capex-hybrid'))
  await page.click(tid('tp-ms-remove-2')); await page.click(tid('tp-ms-remove-1'))
  await type('tp-ms-share-0', '100')
  await page.click(tid('tp-cpi-locked'))
  await page.waitForSelector(tid('tp-escalator'))
  await type('tp-escalator', '3')
  await page.waitForFunction((s) => !document.querySelector(s)?.disabled, {}, tid('tp-escalator-start'))
  await page.select(tid('tp-escalator-start'), '2')
  await expectText('tp-p-final', '23,284,127.25', 'G-C5 Final TCV')
  await expectText('tp-p-final-note', 'Base + CPI uplift 1,265,516.25', 'S4 the uplift')
  await expectText('tp-p-base', '22,018,611.00', 'S4 Base TCV unmoved')
  await expectText('tp-p-base-note', 'No CPI · margin 86.5% on Base', 'S4 Base note')
  await expectText('tp-p-deal', 'Final TCVCPI locked', 'S4 deal value Final TCV, CPI LOCKED')
  await expectText('tp-p-deal-note', 'Client signs for Final TCV', 'S4 deal value note')
  await expectText('tp-subscription-note', 'Base 341,143.52 a month, then +3% a year from year 2. CAPEX does not escalate.', 'S4 the subscription line')
  await expectText('tp-cpi-note', 'Locked rate: a negotiated fixed figure, for example the average of the last 5 years. Final TCV is contractual and becomes the deal value. Applies to the subscription only; CAPEX payments never escalate.', 'S4 the Locked note')
  await expectText('tp-q-uplift', '1,265,516.25', 'S4 CPI uplift tile')
  await expectText('tp-q-tcv-note', 'deal value (locked)', 'S4 Final TCV tile note')
  want(await rows4(), [['0', '1,550,000.00', '-', '1,550,000.00'], ['1 to 12', '-', '341,143.52', '341,143.52'], ['13 to 24', '-', '351,377.83', '351,377.83'],
    ['25 to 36', '-', '361,919.16', '361,919.16'], ['37 to 48', '-', '372,776.74', '372,776.74'], ['49 to 59', '-', '383,960.04', '383,960.04'],
    ['60', '-', '383,959.81', '383,959.81'], ['Total', '1,550,000.00', '21,734,127.25', '23,284,127.25']], 'G-C5 the Final schedule reads the mockup')
  for (const w of [1240, 1600, 1920]) { await page.setViewport({ width: w, height: 1100 }); await capture('capex-s4-locked', w) }
  await page.setViewport({ width: 1240, height: 1100 })
  await page.click(tid('tp-cpi-published'))
  await expectText('tp-p-deal', 'Base TCV', 'C-3 Published: deal value is Base TCV')
  await expectText('tp-p-final-note', 'Base + CPI uplift 1,265,516.25, projected', 'C-3 Published: Final TCV is a projection')
  await page.click(tid('tp-cpi-none'))
  check(!(await page.$(tid('tp-escalator'))) && !(await page.$(tid('tp-escalator-start'))), 'Q14 under None the rate and start year are hidden')

  // ── G-C6: split WHT straddling the hardware value, from the click.
  await page.click(tid('tp-capex-custom'))
  await type('tp-capex-amount', '2000000.00')
  await type('tp-gst', '0')
  await sw('tp-wht-split', true); await sw('tp-wht-grossup', false)
  await type('tp-wht-hw', '5'); await type('tp-wht-saas', '10')
  await page.waitForFunction((s) => document.querySelector(s)?.cells[7]?.textContent.trim() === '122,500.00', { timeout: 6000 }, tid('tp-sched-0')).catch(() => {})
  const s6 = (await scheduleRows()).map((r) => [r[0], r[3], r[7], r[8]])
  want(s6.slice(0, 3), [['0', '2,000,000.00', '122,500.00', '1,877,500.00'], ['Hardware line', '1,550,000.00', '77,500.00', s6[1]?.[3]], ['SaaS line', '450,000.00', '45,000.00', s6[2]?.[3]]],
    'G-C6 month 0: a hardware line of 1,550,000.00 (WHT 77,500.00) and a SaaS line of 450,000.00 (WHT 45,000.00)')
  want(s6.slice(3, 5).map((r) => [r[0], r[2]]), [['1 to 59', '33,364.35'], ['60', '33,364.33']], 'G-C6 subscription WHT 33,364.35 each, 33,364.33 month 60')
  check(s6.at(-1)?.[0] === 'Total' && s6.at(-1)?.[2] === '2,124,360.98', 'G-C6 total WHT 2,124,360.98', JSON.stringify(s6.at(-1)))
  check(!(await page.$(tid('tp-warn-funds'))), 'G-C6 warning (a) does not fire')
  // Found by opening the G-C6 screenshot: the note called a Custom amount the
  // Hardware default. It says what is set, and never "Default" on a Custom one.
  check((await text('tp-schedule-note')).startsWith('One milestone pays the whole CAPEX amount.'), 'G-C6 the schedule note does not call a Custom amount the Hardware default', await text('tp-schedule-note'))
  await capture('capex-gc6-straddle', 1240)
  await sw('tp-wht-split', false); await type('tp-gst', '9')

  // ── C-9 (b): the subscription below the deal's monthly hosting cost warns.
  // POSITION, from spec v1.6: (22,018,611.00 - 21,000,000.00) / 60 = 16,976.85
  // against hosting 120 x 200 + 40 x 100 + 2 x 500 = 29,000.00 a month.
  await type('tp-capex-amount', '21000000.00')
  await expectText('tp-warn-hosting', 'The subscription of 16,976.85 a month is below the deal\'s monthly hosting cost of 29,000.00. Quote allowed.', 'C-9 (b) shown, never refused')
  check(!!(await page.$(tid('tp-q-tcv'))), 'C-9 (b) the quote still prices')
  // C-4 from the click: CAPEX equal to Base TCV is refused.
  await type('tp-capex-amount', '22018611.00')
  await expectText('tp-error', 'The CAPEX amount must be above 0 and below Base TCV (22,018,611.00).', 'G-C4 CAPEX = Base TCV is refused, in words')
} else if (QP) {
  // ── QUOTE_PANEL E2: the approved pictures' two states, from the click ──
  // Every expected figure is COPIED from the pictures (prototypes/
  // term-pricing-quote/) and spec v1.4's T29 and T30, never computed here.
  const rows = (t) => page.$$eval(`${V} [data-testid="${t}"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
  const cents = (s) => BigInt(String(s).replace(/[,.]/g, ''))
  const sumCol = (rs, i) => rs.reduce((t, r) => t + cents(r[i]), 0n)
  await type('tp-units-safesight', '120'); await type('tp-units-air_quality', '40'); await type('tp-units-hemir', '2')
  await page.click(tid('tp-term-60'))

  // OPEX picture.
  await expectText('tp-q-tcv', '22,018,611.00', 'QP OPEX TCV (net)')
  await expectText('tp-q-monthly', '366,976.85', 'QP OPEX monthly total (year 1)')
  await expectText('tp-q-gst', '1,981,675.20', 'QP OPEX GST')
  await expectText('tp-q-tcvincl', '24,000,286.20', 'QP OPEX TCV incl. GST')
  await expectText('tp-q-margin', '86.5%', 'QP OPEX margin')
  check((await text('tp-pricing-head')) === 'Pricing by product and band', 'QP OPEX heading "Pricing by product and band"')
  const pr = await rows('tp-pricing')
  check(JSON.stringify(pr) === JSON.stringify([
    ['SafeSight', '120', '', '', '', '289,818.77'], ['units 1 to 9', '9', '2,613.33', '0%', '2,613.33', '23,519.97'],
    ['units 10 to 49', '40', '2,613.33', '5%', '2,482.67', '99,306.80'], ['units 50 to 199', '71', '2,613.33', '10%', '2,352.00', '166,992.00'],
    ['AQ', '40', '', '', '', '37,424.74'], ['units 1 to 9', '9', '973.33', '0%', '973.33', '8,759.97'], ['units 10 to 49', '31', '973.33', '5%', '924.67', '28,664.77'],
    ['HEMIR', '2', '', '', '', '39,733.34'], ['units 1 to 9', '2', '19,866.67', '0%', '19,866.67', '39,733.34'], ['Total per month', '162', '', '', '', '366,976.85']]),
    'QP OPEX pricing by product and band reads the picture row for row', JSON.stringify(pr))
  const pf = await rows('tp-profit')
  check(JSON.stringify(pf) === JSON.stringify([
    ['SafeSight', '120', '17,389,126.20', '2,400,000.00', '14,989,126.20', '86.2%'], ['AQ', '40', '2,245,484.40', '320,000.00', '1,925,484.40', '85.7%'],
    ['HEMIR', '2', '2,384,000.40', '260,000.00', '2,124,000.40', '89.1%'], ['Total', '162', '22,018,611.00', '2,980,000.00', '19,038,611.00', '86.5%']]),
    'QP OPEX profit by product reads T29 and the picture, and no WHT rows', JSON.stringify(pf))
  const prods = pf.filter((r) => r[0] !== 'Total')
  check(sumCol(prods, 2) === cents(await text('tp-q-tcv')) && sumCol(prods, 2) === cents(pf.at(-1)[2]) && sumCol(prods, 3) === cents(pf.at(-1)[3]) && sumCol(prods, 4) === cents(pf.at(-1)[4]),
    'QP OPEX the product rows sum to the deal tile and the Total row (TCV, cost, profit)')
  const sc = await scheduleRows()
  check(JSON.stringify(sc) === JSON.stringify([['Months 1 to 60', '60', '366,976.85', '366,976.85', '33,027.92', '400,004.77', '0.00', '366,976.85']]),
    'QP OPEX payment schedule reads the picture', JSON.stringify(sc))
  check(cents(pr.at(-1)[5]) === cents(sc[0][2]), 'QP OPEX the band table total equals the schedule\'s year-1 net fee')
  check(!(await page.$(tid('tp-escalator-note'))), 'QP OPEX no escalator, so no escalator note')

  // CAPEX picture, RE-ISSUED by TP_CAPEX from spec v1.6's T30 (the rulings):
  // CAPEX Hardware, Hybrid Contract start m0 100%, CPI LOCKED 3% from year 2,
  // single WHT 10% borne, GST 9%. Every figure COPIED from the rulings. The
  // v1.4 picture's figures (23,379,957.72, upfront 1,550,000.04, the Upfront
  // tile) are superseded and stay in spec 11.2.
  await page.click(tid('tp-capex'))
  await page.click(tid('tp-cpi-locked'))
  await page.waitForSelector(tid('tp-escalator'))
  await type('tp-escalator', '3')
  await page.waitForFunction((s) => !document.querySelector(s)?.disabled, {}, tid('tp-escalator-start'))
  await page.select(tid('tp-escalator-start'), '2')
  await type('tp-wht', '10')
  await expectText('tp-q-tcv', '23,284,127.25', 'QP CAPEX Final TCV')
  await expectText('tp-p-base', '22,018,611.00', 'QP CAPEX Base TCV')
  await expectText('tp-p-final', '23,284,127.25', 'QP CAPEX price card Final TCV')
  await expectText('tp-p-final-note', 'Base + CPI uplift 1,265,516.25', 'QP CAPEX the uplift')
  await expectText('tp-q-uplift', '1,265,516.25', 'QP CAPEX CPI uplift tile')
  await expectText('tp-q-capex', '1,550,000.00', 'QP CAPEX the CAPEX tile')
  await expectText('tp-q-subscription', '341,143.52', 'QP CAPEX subscription year 1')
  await expectText('tp-q-gst', '2,095,571.38', 'QP CAPEX Final GST')
  await expectText('tp-q-tcvincl', '25,379,698.63', 'QP CAPEX Final TCV incl. GST')
  await expectText('tp-q-margin', '86.5%', 'QP CAPEX margin, on Base')
  await expectText('tp-q-after-wht', 'Margin on price after WHT: 76.5%', 'QP CAPEX margin after WHT, on the Base schedule')
  await expectText('tp-p-deal', 'Final TCVCPI locked', 'QP CAPEX deal value is Final TCV')
  check((await text('tp-pricing-head')) === 'Pricing basis (OPEX fees, year 1)', 'QP CAPEX heading "Pricing basis (OPEX fees, year 1)"')
  // Scoped to the Quote card: the first run's `.tp-h2 .tp-hint` matched the
  // Term ladder's hint, which comes first on the page.
  check((await page.$eval(`${V} [aria-label="Quote"] .tp-h2 .tp-hint`, (e) => e.textContent.trim())) === '60 months, CAPEX, CPI locked 3% from year 2, WHT 10% borne', 'QP CAPEX title reads the picture')
  check((await text('tp-escalator-note')) === 'The CPI raises the subscription 3% a year from year 2; CAPEX payments never escalate. The payment schedule shows each year\'s figures.', 'QP CAPEX CPI note')
  const pf2 = await rows('tp-profit')
  check(JSON.stringify(pf2) === JSON.stringify([
    ['SafeSight', '120', '17,389,126.20', '2,400,000.00', '14,989,126.20', '86.2%'], ['AQ', '40', '2,245,484.40', '320,000.00', '1,925,484.40', '85.7%'],
    ['HEMIR', '2', '2,384,000.40', '260,000.00', '2,124,000.40', '89.1%'], ['Total', '162', '22,018,611.00', '2,980,000.00', '19,038,611.00', '86.5%'],
    ['WHT borne by Terminus (whole deal)', '', '', '', '-2,201,860.98', ''], ['Gross profit after WHT', '', '', '', '16,836,750.02', '76.5%']]),
  'QP CAPEX profit by product reads T30 on Base, WHT whole-deal and on the Base schedule', JSON.stringify(pf2))
  const prods2 = pf2.slice(0, 3)
  check(sumCol(prods2, 2) === cents(await text('tp-p-base')) && sumCol(prods2, 4) === cents(pf2[3][4]),
    'QP CAPEX the product rows sum to Base TCV and the Total row')
  const sc2 = (await scheduleRows()).map((r) => [r[0], r[1], r[2], r[7], r[8]])
  check(JSON.stringify(sc2.slice(0, 7)) === JSON.stringify([
    ['0', '1,550,000.00', '-', '155,000.00', '1,395,000.00'], ['1 to 12', '-', '341,143.52', '34,114.35', '307,029.17'],
    ['13 to 24', '-', '351,377.83', sc2[2]?.[3], sc2[2]?.[4]], ['25 to 36', '-', '361,919.16', sc2[3]?.[3], sc2[3]?.[4]],
    ['37 to 48', '-', '372,776.74', sc2[4]?.[3], sc2[4]?.[4]], ['49 to 59', '-', '383,960.04', sc2[5]?.[3], sc2[5]?.[4]],
    ['60', '-', '383,959.81', sc2[6]?.[3], sc2[6]?.[4]]]),
  'QP CAPEX the Final schedule reads T30: CAPEX m0, the subscription by year, month 0 and year-1 WHT', JSON.stringify(sc2))
  check(sc2[7]?.[0] === 'Total' && sc2[7]?.[3] === '2,328,412.62', 'QP CAPEX WHT on the Final invoices 2,328,412.62', JSON.stringify(sc2[7]))
  // The separate cards are gone: one Quote panel holds all four sections.
  check(!(await page.$(`${V} [aria-label="Payment schedule"]`)) && !!(await page.$(`${V} [aria-label="Quote"] [data-testid="tp-schedule"]`)),
    'QP the payment schedule lives in the Quote panel; the separate card is gone')
  // D3, RE-ISSUED by TP_CAPEX: the CAPEX schedule note ties CAPEX and the
  // subscription to Base TCV. SUPERSEDED, QUOTED NOT DELETED: "Upfront ... the
  // same TCV as OPEX; the upfront carries any rounding residue."
  check((await text('tp-schedule-note')).includes('CAPEX plus the subscription ties to Base TCV 22,018,611.00 exactly before the CPI; the last instalment, milestone and month carry the rounding.'),
    'D3 the CAPEX schedule note ties to Base TCV')
  // D2: "WHT borne" stays the schedule's WHT head when WHT is borne.
  check((await page.$$eval(`${V} [data-testid="tp-schedule"] thead th`, (t) => t.map((x) => x.textContent.trim())))[7] === 'WHT borne', 'D2 the schedule head reads "WHT borne"')
  // D1, RETIRED by TP_CAPEX (C-13), QUOTED NOT DELETED: "the CAPEX Upfront
  // tile is kept". The tiles are now the mockup's, then today's tax tiles.
  const tileLabels = await page.$$eval(`${V} [data-testid="tp-figures"] > div > .tp-label`, (t) => t.map((x) => x.textContent.trim()))
  check(JSON.stringify(tileLabels) === JSON.stringify(['CAPEX', 'Subscription yr 1', 'Cash in year 1', 'CPI uplift', 'Final TCV', 'GST', 'TCV incl. GST', 'Margin on price']),
    'C-13 the CAPEX tiles lead (CAPEX, Subscription, Cash in year 1, the uplift, Final TCV), today\'s tax and margin tiles follow', JSON.stringify(tileLabels))
  await capture('qp-capex', 1240)
  // D4: every title wording, pinned (the borne one is checked above).
  const hint = () => page.$eval(`${V} [aria-label="Quote"] .tp-h2 .tp-hint`, (e) => e.textContent.trim())
  const sw = async (id, on) => {
    if ((await page.$eval(tid(id), (e) => e.getAttribute('aria-checked'))) !== String(on)) await page.click(tid(id))
    await page.waitForFunction((s, v) => document.querySelector(s)?.getAttribute('aria-checked') === String(v), {}, tid(id), on)
  }
  const pinned = async (want, claim) => {
    try { await page.waitForFunction((s, w) => document.querySelector(s)?.textContent.trim() === w, { timeout: 6000 }, `${V} [aria-label="Quote"] .tp-h2 .tp-hint`, want); check(true, claim, want) }
    catch { check(false, claim, `expected ${want}, saw ${await hint()}`) }
  }
  await sw('tp-wht-grossup', true)
  await pinned('60 months, CAPEX, CPI locked 3% from year 2, WHT 10% grossed up', 'D4 one rate, gross-up: ", WHT 10% grossed up"')
  await sw('tp-wht-split', true)
  await type('tp-wht-hw', '5'); await type('tp-wht-saas', '10')
  await pinned('60 months, CAPEX, CPI locked 3% from year 2, split WHT 5% hardware / 10% SaaS, grossed up', 'D4 split, gross-up')
  await sw('tp-wht-grossup', false)
  await pinned('60 months, CAPEX, CPI locked 3% from year 2, split WHT 5% hardware / 10% SaaS, borne', 'D4 split, borne')
  await sw('tp-wht-split', false); await type('tp-wht', '')
  await pinned('60 months, CAPEX, CPI locked 3% from year 2', 'D4 no WHT: nothing about WHT in the title')
  await page.click(tid('tp-cpi-published'))
  await pinned('60 months, CAPEX, CPI published 3% from year 2', 'C-3 Published names itself in the title')
  await page.click(tid('tp-cpi-none'))
  await pinned('60 months, CAPEX', 'C-3 None: nothing about the CPI in the title')
} else {
  // T1 is the screen's opening state.
  await expectText('tp-q-tcv', '151,999.92', 'T1 TCV')
  await expectText('tp-q-margin', '90.0%', 'T1 margin')
  const t101 = [
    ['12 months', '8,666.67', '+105.3%', '104,000.04', '90.0%'], ['24 months', '5,333.33', '+26.3%', '127,999.92', '90.0%'],
    ['36 months', '4,222.22', 'list', '151,999.92', '90.0%'], ['48 months', '3,216.67', '−23.8%', '154,400.16', '88.6%'],
    ['60 months', '2,613.33', '−38.1%', '156,799.80', '87.2%'], ['72 months', '2,211.11', '−47.6%', '159,199.92', '85.9%'],
    ['84 months', '1,923.81', '−54.4%', '161,600.04', '84.7%'], ['96 months', '1,708.33', '−59.5%', '163,999.68', '83.4%'],
    // Spec v1.3 table 10.1: the live TERMS has carried 108 since John's admin
    // change on 2026-10-03, so the opening ladder has ten rows.
    ['108 months', '1,540.74', '−63.5%', '166,399.92', '82.2%'],
    ['120 months', '1,406.67', '−66.7%', '168,800.40', '81.0%'],
  ]
  // RE-POINTED by PER_CAMERA_AND_CAPEX_P0: under OPEX the ladder carries "Per
  // camera / mo" after the fee. At one SafeSight unit it IS the fee (section
  // 4.5 over one unit), so it is the table's own fee column, not a new figure.
  const t101pc = t101.map((r) => [r[0], r[1], r[1], ...r.slice(2)])
  const lad = await ladderRows()
  check(JSON.stringify(lad) === JSON.stringify(t101pc), 'the ladder at 1 unit reads table 10.1 row for row (fee, per camera, vs 36, TCV, margin)', lad.length + ' rows')

  // T6
  await type('tp-units-safesight', '120')
  await page.click(tid('tp-term-60'))
  await expectText('tp-q-tcv', '17,389,126.20', 'T6 TCV')
  await expectText('tp-q-margin', '86.2%', 'T6 margin')
  const sel6 = await page.$eval(`${V} tr.tp-ladder.on`, (r) => [...r.cells].map((c) => c.textContent.trim()))
  // RE-POINTED by PER_CAMERA_AND_CAPEX_P0: TCV and margin moved one cell right.
  check(sel6[0] === '60 months' && sel6[4] === '17,389,126.20' && sel6[5] === '86.2%', 'the selected ladder row is 60 months and equals the quote card', JSON.stringify(sel6))
  // T6 per camera is the monthly total over 120 units: 289,818.77 / 120 = 2,415.1564, half-up 2,415.16 (T31's 60-month figure).
  check(sel6[2] === '2,415.16', 'T6 per camera 2,415.16', JSON.stringify(sel6))
  await capture('opex-T6', 1240)

  // T15, RE-ISSUED by TP_CAPEX (spec v1.6: figures unchanged): the CAPEX
  // amount is the Hardware figure, paid by the default Hybrid row, and the
  // subscription carries no residue.
  await page.click(tid('tp-capex'))
  await expectText('tp-q-capex', '1,200,000.00', 'T15 CAPEX')
  await expectText('tp-q-capex-note', 'month 0, on signature', 'T15 the default Hybrid row pays on signature')
  await expectText('tp-q-subscription', '269,818.77', 'T15 subscription')
  await expectText('tp-q-tcv', '17,389,126.20', 'T15 TCV ties')
  const sched15 = await scheduleRows()
  check(JSON.stringify(sched15.slice(0, 2).map((r) => r.slice(0, 4))) === JSON.stringify([['0', '1,200,000.00', '-', '1,200,000.00'], ['1 to 60', '-', '269,818.77', '269,818.77']]),
    'T15 schedule: CAPEX at month 0, then 60 x subscription', JSON.stringify(sched15.map((r) => r.slice(0, 4))))
  // The Total row ties: CAPEX + subscription = TCV, read off the screen
  // rather than a subtraction typed here (Verification 20).
  const c15 = (s) => BigInt(String(s).replace(/[,.]/g, ''))
  const tot15 = sched15.at(-1) ?? []
  check(tot15[0] === 'Total' && tot15[1] === '1,200,000.00' && tot15[3] === '17,389,126.20' && c15(tot15[1]) + c15(tot15[2]) === c15(tot15[3]),
    'T15 the Total row: CAPEX + subscription = TCV 17,389,126.20', JSON.stringify(tot15))
  // A1, RETIRED by TP_CAPEX (C-10), QUOTED NOT DELETED: "the selected CAPEX row
  // EQUALS the quote card (upfront, service fee, TCV, margin)". The CAPEX
  // ladder is Term and the OPEX per-camera fee only.
  const head = await page.$$eval(`${V} [data-testid="tp-ladder"] thead th`, (t) => t.map((x) => x.textContent.trim()))
  check(JSON.stringify(head) === JSON.stringify(['Term', 'OPEX / cam / mo']), 'C-10 under CAPEX the ladder shows Term and OPEX / cam / mo', JSON.stringify(head))
  const sel15 = await page.$eval(`${V} tr.tp-ladder.on`, (r) => [...r.cells].map((c) => c.textContent.trim()))
  check(JSON.stringify(sel15) === JSON.stringify(['60 months', '2,415.16']), 'C-10 the selected CAPEX row is 60 months at the OPEX per-camera fee (T31)', JSON.stringify(sel15))
  // RE-POINTED by QUOTE_PANEL: the heading is the panel's, and it says "year 1".
  check((await linesRows()).length > 0 && (await text('tp-pricing-head')) === 'Pricing basis (OPEX fees, year 1)', 'under CAPEX the pricing table reads "Pricing basis (OPEX fees, year 1)"')
  await capture('capex-T15', 1240)

  // T23
  await page.click(tid('tp-opex'))
  await type('tp-units-air_quality', '30')
  await expectText('tp-q-tcv', '19,079,808.60', 'T23 TCV')
  await expectText('tp-q-margin', '86.2%', 'T23 margin')
  const lines23 = await linesRows()
  const aqBands = lines23.filter((r) => r[0].startsWith('units')).slice(-2).map((r) => [r[0], r[3], r[4]])
  check(JSON.stringify(aqBands) === JSON.stringify([['units 1 to 9', '0%', '973.33'], ['units 10 to 49', '5%', '924.67']]), 'T23 AQ band fees 973.33 and 924.67', JSON.stringify(aqBands))
  // RE-POINTED by QUOTE_PANEL: the deal's cost is the profit table's Total row.
  const cost23 = await page.$$eval(`${V} [data-testid="tp-profit-total"]`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
  check(cost23.length === 1 && cost23[0][3] === '2,640,000.00', 'T23 cost 2,640,000.00', JSON.stringify(cost23))

  // T16, RE-ISSUED by TP_CAPEX (spec v1.6): CPI PUBLISHED 3%.
  await type('tp-units-air_quality', '0')
  await type('tp-units-safesight', '1')
  await page.click(tid('tp-cpi-published'))
  await page.waitForSelector(tid('tp-escalator'))
  await type('tp-escalator', '3')
  await expectText('tp-q-tcv', '166,494.36', 'T16 Final TCV (projected)')
  await expectText('tp-p-base', '156,799.80', 'T16 Base TCV')
  await expectText('tp-q-margin', '87.2%', 'T16 margin, on Base')
  await expectText('tp-p-deal', 'Base TCV', 'T16 deal value is Base TCV under Published')
  const sched16 = (await scheduleRows()).map((r) => r[2])
  check(JSON.stringify(sched16) === JSON.stringify(['2,613.33', '2,691.73', '2,772.48', '2,855.66', '2,941.33']), 'T16 year fees', JSON.stringify(sched16))

  // Errors: no units (T18), and invalid units.
  await page.click(tid('tp-cpi-none'))
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
  await expectText('tp-q-capex', '1,200,000.00', 'T15 at 1920')
  await capture('capex-T15', 1920)
}

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
