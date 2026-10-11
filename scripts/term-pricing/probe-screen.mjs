#!/usr/bin/env node
// ── TERM PRICING: the screen, from the click ─────────────────────────────
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/probe-screen.mjs [mode] [--spec] [--out <dir>]
//
// Signs in as session-ref.json (john+test, a NON-admin) by session injection,
// opens Term Pricing through the app's own navigate(), and drives the inputs
// with REAL keyboard events (Verification 6: a synthetic value write is
// deduped by React). Every expected figure is COPIED from docs/pricing-spec.md
// or from the approved mockup's own text, never computed here; where a check
// needs a relation (a sum, a tie), it is written as the relation.
//
// RE-POINTED by TP_TABS (John, 2026-10-11): the screen is three tabs, 1
// Pricing, 2 Payment terms, 3 Quote. Each claim is now asserted on the tab
// that holds it: the price on Pricing, the inputs on Payment terms, the quote's
// figures on Quote. A tab's panel is rendered only while it is open, so a
// check that reads the wrong tab FAILS rather than reading a hidden copy.
//
// Modes:
//   (default)  T1 with the ladder against table 10.1; T6; N1 the ladder from the
//              keyboard; T15; C2 the ladder whatever the basis; T23; T16; the
//              refusals in words, and the Quote tab and Next blocked by them.
//   --flow     E3 (run while probe-live.mjs --hold has ANCHOR_MARGIN at 80%).
//   --tp2      T24 to T28 (spec v1.3 TERMS passed in test).
//   --pc       T31 per camera; FLIPPED again by v1.7 (C2): under CAPEX the
//              ladder shows every column.
//   --capex    G-C1 to G-C6 and C-9 (b), from the click, on the tabs.
//   --tabs     TP_TABS: the approved mockup's five states, labels and figures
//              from its HTML exports (prototypes/term-pricing-tabs/html/), T4-G1
//              and B-1 to B-6 copied from spec v1.7, T30 from the click (it
//              absorbs --qp, below), every tab under OPEX and CAPEX, tab state
//              surviving a switch, the blocked Quote tab, and a 3440 capture.
//   --spec     the spec's 90% margins passed IN TEST (see below).
//
// RETIRED by TP_TABS, QUOTED NOT DELETED: `--qp` (QUOTE_PANEL's two pictures of
// the one-panel quote, which T-5 supersedes). Its figures are kept: T29 and
// T30, the GST lines and D4's titles are asserted by --tabs on the Quote tab.
//
// UNWIRED: needs a browser, a live server and a session.

import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-screen.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'
const FLOW = process.argv.includes('--flow')
// TERM_PRICING_2 (--tp2): the 108-month case runs with spec v1.3's TERMS
// passed IN TEST: written into the browser's copy of the real GET response and
// nowhere else. Every other byte is the route's.
const TP2 = process.argv.includes('--tp2')
const PC = process.argv.includes('--pc')
const CAPEXM = process.argv.includes('--capex')
const TABS = process.argv.includes('--tabs')
// --spec (PER_CAMERA_AND_CAPEX_P0, POSITION): the live ANCHOR_MARGIN for
// SafeSight was set to 50 by John's account on 2026-10-07, so every spec
// figure this probe copies (90% throughout, spec section 3) is a different
// deal from the live one. The live row is John's data and is not written back.
// With --spec the spec's margins are passed IN TEST, into the browser's copy
// of the real GET response and nowhere else. Without it the live settings.
const SPEC = process.argv.includes('--spec')
const SPEC_MARGINS = { safesight: '90', air_quality: '90', hemir: '90' }
const TERMS_V13 = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : `${ROOT}prototypes/term-pricing-tabs/built`
const RUN = process.env.TP_RUN ?? 'tabs'
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]

let failures = 0
const check = (ok, claim, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`)
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
page.on('pageerror', (e) => check(false, 'the page throws nothing', e.message))
await page.setViewport({ width: 1240, height: 1100 })
if (TP2 || SPEC || TABS) {
  const over = {
    ...(TP2 || TABS ? { TERMS: TERMS_V13 } : {}),
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
const present = async (t) => !!(await page.$(tid(t)))
// Select the field's whole content, then delete and type with REAL keys, so
// React receives genuine input events. Each write is read back before anything
// is measured (Verification 44's write-side clause: confirm the edit landed).
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
const want = (got, exp, claim) => check(JSON.stringify(got) === JSON.stringify(exp), claim, JSON.stringify(got))
const rows = (t) => page.$$eval(`${V} [data-testid="${t}"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
const head = (t) => page.$$eval(`${V} [data-testid="${t}"] thead th`, (h) => h.map((x) => x.textContent.trim()))
const ladderRows = () => rows('tp-ladder')
const scheduleRows = () => rows('tp-schedule')
const cents = (s) => BigInt(String(s).replace(/[,.]/g, ''))
const pressed = (t) => page.$eval(tid(t), (e) => e.getAttribute('aria-pressed') === 'true').catch(() => false)
const sw = async (id, on) => {
  if ((await page.$eval(tid(id), (e) => e.getAttribute('aria-checked'))) !== String(on)) await page.click(tid(id))
  await page.waitForFunction((s, v) => document.querySelector(s)?.getAttribute('aria-checked') === String(v), {}, tid(id), on)
}
// T-1: a tab is opened by its own button, and the wait is on THAT panel: the
// previous panel cannot satisfy it (Verification 7, the counterfactual).
async function tab(name) {
  await page.click(tid(`tp-tab-${name}`))
  await page.waitForSelector(tid(`tp-panel-${name}`), { timeout: 6000 })
}
// The tab strip as a person reads it: each tab's mark (number or tick) and label.
const tabStrip = () => page.$$eval(`${V} [role="tab"]`, (ts) => ts.map((t) => [t.querySelector('.tp-tab-num')?.textContent.trim(),
  [...t.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(), t.getAttribute('aria-selected') === 'true']))
// The quote's tile row, label (with any tag) and figure.
const tiles = () => page.$$eval(`${V} [data-testid="tp-figures"] > div`, (ds) => ds.map((d) => [d.querySelector('.tp-label')?.textContent.trim(), d.querySelector('.tp-v')?.textContent.trim(), d.querySelector('.tp-v ~ div')?.textContent.trim()]))
const lines = (t) => page.$$eval(`${V} [data-testid="${t}"] .tp-line`, (ls) => ls.map((l) => [...l.children].map((c) => c.textContent.trim())))
const measure = () => page.evaluate(() => {
  const view = document.getElementById('view-term-pricing')
  const over = [...view.querySelectorAll('.tp-card, .tp-figures, table, .tp-sec')].filter((e) => e.scrollWidth > e.clientWidth + 1).length
  // TILE_FIT's F3 wraps a row that cannot fit at the floor into two rows of
  // equal tiles. So the claim is one row, or exactly two when marked wrapped.
  const figRow = view.querySelector('.tp-figures')
  const tops = new Set([...view.querySelectorAll('.tp-figures > div')].map((d) => Math.round(d.getBoundingClientRect().top))).size
  const figs = !figRow ? 1 : tops === 2 && figRow.classList.contains('tp-figures--wrap') ? 1 : tops
  // LEGIBILITY, not only placement (Verification 4): a figure is one line when
  // its height is under 1.6 of its font size, and it does not overflow its cell.
  const broken = [...view.querySelectorAll('.tp-v')].filter((v) => {
    const fs = parseFloat(getComputedStyle(v).fontSize)
    return v.getBoundingClientRect().height > fs * 1.6 || v.scrollWidth > v.parentElement.clientWidth
  }).map((v) => v.textContent)
  return { pageOverflowX: document.documentElement.scrollWidth > window.innerWidth, overflowingBlocks: over, figureRows: figs, brokenFigures: broken }
})
async function capture(name, width) {
  // Measure first, then grow the viewport to the scroll container's content
  // so the PAGE capture holds the whole screen (Verification 18), and never
  // photograph the element whose geometry is the claim (Verification 4).
  await page.setViewport({ width, height: 1100 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const m = await measure()
  check(!m.pageOverflowX && m.overflowingBlocks === 0 && m.figureRows === 1 && m.brokenFigures.length === 0, `${name} at ${width}: no overflow, the tiles in one row (or F3's two), no figure broken or clipped`, JSON.stringify(m))
  const h = await page.evaluate(() => document.querySelector('.app-content-scroll').scrollHeight)
  await page.setViewport({ width, height: Math.max(1100, h + 40) })
  await page.waitForFunction(() => true)
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: `${OUT}/${RUN}-${width}-${name}.png` })
  await page.setViewport({ width: 1240, height: 1100 })
}
const demo = async () => { await type('tp-units-safesight', '120'); await type('tp-units-air_quality', '40'); await type('tp-units-hemir', '2') }
const pick = async (t) => { await page.click(tid(`tp-ladder-${t}`)); await expectText('tp-p-term', `${t} months`, `the ${t}-month row is chosen`) }

if (FLOW) {
  // T1's inputs at ANCHOR_MARGIN 80%: 15,200 x 0.8 / 0.2 = 60,800; 76,000 / 36
  // = 2,111.11; x 36 = 75,999.96 (the spec's section 11 flow line).
  await expectText('tp-p-monthly', '2,111.11', 'E3 on screen: the opening price at ANCHOR_MARGIN 80%')
  await expectText('tp-p-base', '75,999.96', 'E3 on screen: Base TCV at 80%')
  await page.click(tid('tp-settings-toggle'))
  await page.waitForSelector(tid('tp-set-ANCHOR_MARGIN.safesight'))
  const v = await page.$eval(tid('tp-set-ANCHOR_MARGIN.safesight'), (e) => [e.value, e.disabled])
  check(v[0] === '80' && v[1] === true, "the non-admin's settings show 80 and are read-only", JSON.stringify(v))
  check(!(await present('tp-settings-save')), 'and the non-admin has no Save')
  await capture('flow-80', 1240)
} else if (TP2) {
  // T26: 1 unit, 108 months (TERMS passed in test).
  await pick(108)
  await expectText('tp-p-base', '166,399.92', 'T26 Base TCV at 108 months')
  await expectText('tp-p-margin', '82.2%', 'T26 margin')
  const row108 = await page.$eval(tid('tp-ladder-108'), (r) => [...r.cells].map((c) => c.textContent.trim()))
  check(row108[2] === '1,540.74' && row108[3] === '−63.5%', 'the ladder carries 108: per camera 1,540.74, vs 36 −63.5% (table 10.1)', JSON.stringify(row108))

  // T27 (spec v1.6): 1 unit, 60, CPI LOCKED 3% from year 3.
  await pick(60)
  await tab('payment')
  await page.click(tid('tp-cpi-locked'))
  await page.waitForSelector(tid('tp-escalator'))
  await type('tp-escalator', '3')
  await page.waitForFunction((s) => document.querySelector(s) && !document.querySelector(s).disabled, {}, tid('tp-escalator-start'))
  await page.select(tid('tp-escalator-start'), '3')
  await tab('quote')
  await expectText('tp-q-final', '162,558.36', 'T27 Final TCV')
  await expectText('tp-q-base', '156,799.80', 'T27 Base TCV')
  await expectText('tp-q-margin', 'Margin 87.2%', 'T27 margin, on Base')
  await expectText('tp-q-deal-tag', 'Deal value', 'T27 deal value is Final TCV under Locked')
  want((await scheduleRows()).map((r) => [r[0], r[1]]), [['1 to 24', '2,613.33'], ['25 to 36', '2,691.73'], ['37 to 48', '2,772.48'], ['49 to 60', '2,855.66'], ['Total', '162,558.36']],
    'T27 year fees 2,613.33 / 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 (years 1 and 2 one run)')

  // T28 (spec v1.6): T6 as capex, CPI PUBLISHED 3% from year 3.
  await tab('pricing'); await type('tp-units-safesight', '120')
  await tab('payment')
  await page.click(tid('tp-basis-capex'))
  await page.click(tid('tp-cpi-published'))
  await tab('quote')
  await expectText('tp-q-final', '17,983,678.32', 'T28 Final TCV (projected)')
  await expectText('tp-q-base', '17,389,126.20', 'T28 Base TCV')
  await expectText('tp-q-capex', '1,200,000.00', 'T28 CAPEX')
  check(!(await present('tp-q-deal-tag')), 'T28 no deal-value tag under Published: the deal value is Base TCV')
  want((await scheduleRows()).slice(0, -1).map((r) => r.slice(0, 3)), [['0', '1,200,000.00', '-'], ['1 to 24', '-', '269,818.77'], ['25 to 36', '-', '277,913.33'],
    ['37 to 48', '-', '286,250.73'], ['49 to 60', '-', '294,838.26']], 'T28 subscription by year 269,818.77 / 269,818.77 / 277,913.33 / 286,250.73 / 294,838.26')

  // T24: T6 as capex, split WHT hardware 5% / SaaS 10%, gross-up OFF, no CPI.
  await tab('payment')
  await page.click(tid('tp-cpi-none'))
  await page.click(tid('tp-wht-split'))
  await type('tp-wht-hw', '5'); await type('tp-wht-saas', '10')
  await sw('tp-wht-grossup', false)
  check(!(await present('tp-wht')), 'B4: with Split chosen, the single WHT input is not there')
  await tab('quote')
  await sw('tp-tax-detail', true)
  const s24 = await scheduleRows()
  // With tax detail on: Months | CAPEX | Subscription | Invoice | pre-GST | GST | incl. GST | WHT | receives.
  check(s24[0][0] === '0' && s24[0][1] === '1,200,000.00' && s24[0][7] === '60,000.00' && s24[0][8] === '1,140,000.00', 'T24 WHT on the CAPEX invoice 60,000.00, Terminus receives 1,140,000.00', JSON.stringify(s24[0]))
  const sub24 = s24.find((r) => r[0] === '1 to 60')
  check(!!sub24 && sub24[2] === '269,818.77' && sub24[7] === '26,981.88' && sub24[8] === '242,836.89', 'T24 WHT per subscription invoice 26,981.88, Terminus receives 242,836.89', JSON.stringify(sub24))
  await expectText('tp-profit-wht', 'WHT borne by Terminus (whole deal)-1,678,912.80', 'T24 total WHT borne 1,678,912.80, on the profit card (N5)')
  const tot24 = s24.at(-1)
  // L1, on the tax detail's Total row (N6): TCV (net) + WHT gross-up + GST =
  // TCV incl. GST, where the gross-up is what the invoices carry above their
  // nets. With gross-up off the invoices ARE the nets.
  check(tot24[0] === 'Total' && tot24[3] === tot24[4] && cents(tot24[4]) + cents(tot24[5]) === cents(tot24[6]), 'L1 T24: no gross-up, and invoiced + GST = TCV incl. GST', JSON.stringify(tot24))

  // T25: T6 as opex, split WHT 5% / 10%, gross-up ON, GST 0.
  await tab('payment')
  await page.click(tid('tp-basis-opex'))
  await sw('tp-wht-grossup', true)
  await type('tp-gst', '0')
  await tab('quote')
  const s25 = await scheduleRows()
  // OPEX with tax detail: Months | Monthly fee | Invoice | pre-GST | GST | incl. GST | WHT | receives.
  check(s25[0][0] === '1 to 60' && s25[0][3] === '320,851.26', 'T25 invoice total 320,851.26', JSON.stringify(s25[0]))
  want([s25[1][0], s25[1][2], s25[1][3], s25[1][6], s25[1][7]], ['Hardware line', '20,000.00', '21,052.63', '1,052.63', '20,000.00'],
    'T25 hardware line 20,000.00 -> invoice 21,052.63, WHT 1,052.63, receives 20,000.00')
  want([s25[2][0], s25[2][2], s25[2][3], s25[2][6], s25[2][7]], ['SaaS line', '269,818.77', '299,798.63', '29,979.86', '269,818.77'],
    'T25 SaaS line 269,818.77 -> invoice 299,798.63, WHT 29,979.86, receives 269,818.77')
  const tot25 = s25.at(-1)
  check(tot25[0] === 'Total' && cents(tot25[3]) > cents(tot25[2]) && cents(tot25[3]) + cents(tot25[4]) === cents(tot25[5]), 'L1 T25: a gross-up on the invoices, and invoiced + GST = TCV incl. GST', JSON.stringify(tot25))

  // T-3: the WHT choice swaps the fields IN PLACE, beside the choice. Measured
  // on the field's GROUP (its label and input together): "Hardware %" and
  // "WHT %" are labels of different lengths, so the inputs themselves cannot
  // line up, and the first run of this check, written on the inputs, failed for
  // exactly that reason (the input sat 42px further right). The claim is that
  // the first rate field takes the same place, not that two labels are equal.
  await tab('payment')
  const box = (t) => page.$eval(tid(t), (e) => { const r = (e.closest('label') ?? e).getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top) } }).catch(() => null)
  const [hwOn, saasOn] = [await box('tp-wht-hw'), await box('tp-wht-saas')]
  await page.click(tid('tp-wht-single'))
  const [single, hwGone] = [await box('tp-wht'), await box('tp-wht-hw')]
  // Vertically within 1px: the row centres items of different heights, and the
  // second run read 750 against 751 for the same place.
  check(!!hwOn && !!saasOn && !!single && single.l === hwOn.l && Math.abs(single.t - hwOn.t) <= 1 && hwGone === null,
    'T-3 Single rate: one WHT field, in the hardware field\'s place', JSON.stringify({ hwOn, saasOn, single }))
  await page.click(tid('tp-wht-split'))
  want([await box('tp-wht-hw'), await box('tp-wht-saas'), await present('tp-wht')], [hwOn, saasOn, false], 'T-3 Split again: both fields back in place, the typed rates kept, the single field gone')
  await page.click(tid('tp-wht-none'))
  check(!(await present('tp-wht-grossup')) && !(await present('tp-wht-hw')), 'T-3 None: no rate fields and no Gross up')
  await tab('quote')
  check((await scheduleRows()).every((r) => r[6] === '0.00'), 'T-3 None: no WHT on any invoice, Total included')
  await capture('tp2-T25', 1240)
} else if (PC) {
  // ── PER_CAMERA_AND_CAPEX_P0 A1: T31 from the click, COPIED from spec v1.5.
  const T31 = [['12', '8,009.44'], ['24', '4,928.89'], ['36', '3,902.04'], ['48', '2,972.74'], ['60', '2,415.16'],
    ['72', '2,043.44'], ['84', '1,777.92'], ['96', '1,578.79'], ['108', '1,423.90'], ['120', '1,299.99']]
  const percam = async () => (await ladderRows()).map((r) => [r[0].replace(/ months.*/, ''), r[2]])
  await demo()
  await expectText('tp-ladder-percam-120', '1,299.99', 'T31 settled (120 months)')
  const h = await head('tp-ladder')
  check(h[1] === 'Monthly fee (yr 1)' && h[2] === 'SafeSight / cam / mo', 'A1 the per-camera column sits directly after the monthly fee column (T-2 labels)', JSON.stringify(h))
  want(await percam(), T31, 'T31 per camera at every term, from the click')
  await capture('pc-opex-T31', 1240)
  await type('tp-units-safesight', '0')
  await expectText('tp-ladder-percam-60', '-', 'A1 per camera reads "-" with 0 SafeSight units')
  check((await percam()).every(([, d]) => d === '-') && (await percam()).length === T31.length, 'A1 every row reads "-" with 0 SafeSight units')
  // FLIPPED AGAIN by v1.7 (C2): the ladder shows every column whatever the
  // basis. SUPERSEDED, QUOTED NOT DELETED (TP_CAPEX, C-10): "under CAPEX the
  // ladder is Term and OPEX / cam / mo only".
  await type('tp-units-safesight', '120')
  await tab('payment'); await page.click(tid('tp-basis-capex')); await tab('pricing')
  want(await head('tp-ladder'), ['Term', 'Monthly fee (yr 1)', 'SafeSight / cam / mo', 'vs 36 months', 'Base TCV', 'Margin'], 'C2 under CAPEX the ladder shows every column')
  want(await percam(), T31, 'C2 the per-camera column under CAPEX is T31, unchanged')
  check(!(await page.evaluate(() => [...document.querySelectorAll('#view-term-pricing [data-testid="tp-ladder"] th')].some((t) => /upfront|service|capex/i.test(t.textContent)))),
    'no CAPEX column (upfront, service fee) on the ladder')
  await capture('pc-capex-T31', 1240)
} else if (CAPEXM) {
  // ── TP_CAPEX: G-C1 to G-C6, from the click, RE-POINTED to the tabs. Figures
  // COPIED from spec v1.6 11.1, never computed here.
  const brk = async () => rows('tp-monthly')
  await demo(); await pick(60)
  await tab('payment')
  await page.click(tid('tp-basis-capex'))
  check(!(await present('tp-capex-amount')) && await pressed('tp-capex-hardware') && await pressed('tp-capex-hybrid'), 'G-C1 defaults: Hardware and Milestones (Hybrid)')
  await expectText('tp-capex-hardware', 'Hardware 1,550,000.00', 'G-C1 the Hardware button shows its value, 1,550,000.00 (T-3)')
  want(await page.$eval(tid('tp-ms-0'), (r) => [r.querySelector('select').value, ...[...r.querySelectorAll('input')].map((i) => i.value)]), ['Contract start', '0', '100'],
    'G-C1 the default row: Contract start, month 0, 100%')
  want(await page.$eval(tid('tp-ms-key-0'), (s) => [...s.options].map((o) => o.value)),
    ['Contract start', 'Hardware delivered to site', 'Installation complete', 'Commissioning', 'Go live', 'Final acceptance'], 'C-11 the dropdown is the shared milestone list')
  await expectText('tp-ms-amount-0', '1,550,000.00', 'G-C1 row amount')
  await expectText('tp-ms-allocated', 'Allocated100%1,550,000.00', 'G-C1 Allocated 100%')
  check(!(await present('tp-ms-remaining')), 'G-C1 nothing still to allocate')
  await expectText('tp-subscription-note', '(22,018,611.00 − 1,550,000.00) ÷ 60 months · month 60 is 341,143.32', 'G-C1 the subscription line')
  want(await brk(), [['0 · Contract start', '1,550,000.00', '-', '1,550,000.00'], ['1 to 59', '-', '341,143.52', '341,143.52'], ['60', '-', '341,143.32', '341,143.32'],
    ['Total', '1,550,000.00', '20,468,611.00', '22,018,611.00']], 'G-C1 the monthly breakdown')
  await tab('quote')
  await expectText('tp-q-cash1', '5,643,722.24', 'G-C1 cash in year 1')
  await expectText('tp-q-cash1-note', 'OPEX would be 4,403,722.20', 'G-C1 against OPEX year 1')
  await expectText('tp-q-capex-note', 'Contract start, month 0', 'G-C1 the CAPEX tile note')
  check(!(await present('tp-q-final')), 'T-6 with no CPI there is no Final TCV tile')

  // G-C2: Custom 1,000,000.00; 30 / 40 / 30 at months 0, 3, 6. On the way, G-C4's
  // 99.9% and 100.1%, from the click.
  await tab('payment')
  await page.click(tid('tp-capex-custom'))
  check((await page.$eval(tid('tp-capex-amount'), (e) => e.value)) === '1,550,000.00', 'Custom opens on the hardware value, so it opens on a quote (POSITION 5)')
  await type('tp-capex-amount', '1000000.00')
  await type('tp-ms-share-0', '30')
  await page.click(tid('tp-ms-add')); await page.waitForSelector(tid('tp-ms-1'))
  check((await page.$eval(tid('tp-ms-key-1'), (s) => s.value)) === 'Hardware delivered to site', 'a new row takes the first unused milestone')
  check(await page.$eval(tid('tp-ms-key-1'), (s) => s.querySelector('option[value="Contract start"]').disabled), 'a milestone used on another row cannot be chosen twice')
  await type('tp-ms-month-1', '3'); await type('tp-ms-share-1', '40')
  await page.click(tid('tp-ms-add')); await page.waitForSelector(tid('tp-ms-2'))
  await page.select(tid('tp-ms-key-2'), 'Commissioning')
  await type('tp-ms-month-2', '6'); await type('tp-ms-share-2', '29.9')
  await expectText('tp-ready-reason', 'Allocate the remaining 0.1% (1,000.00) of CAPEX to a milestone.', 'G-C4 99.9% is not a quote: the readiness card names what is missing')
  check(await page.$eval(tid('tp-next-payment'), (b) => b.disabled) && (await page.$eval(tid('tp-tab-quote'), (b) => b.getAttribute('aria-disabled'))) === 'true',
    'G-C4 99.9%: Next and the Quote tab are blocked')
  await type('tp-ms-share-2', '30.1')
  await expectText('tp-ready-reason', 'The milestone shares total 100.1%, 0.1% (1,000.00) over. They must total exactly 100%.', 'G-C4 100.1% is refused in the engine\'s words, with the excess named (C5)')
  await expectText('tp-ms-over', 'Over 100% by0.1%1,000.00', 'C5 the over-allocation row')
  check(!(await present('tp-monthly')), 'over 100%: no breakdown, it could not tie')
  await type('tp-ms-share-2', '30')
  for (const [i, a] of [[0, '300,000.00'], [1, '400,000.00'], [2, '300,000.00 carries rounding']]) await expectText(`tp-ms-amount-${i}`, a, `G-C2 milestone ${i + 1} amount`)
  await expectText('tp-warn-funds', 'Below hardware cost (1,240,000.00): Terminus funds 240,000.00 of hardware. The quote is allowed.', 'G-C2 warning (a): Terminus funds 240,000.00 (the mockup\'s words)')
  await expectText('tp-subscription-note', '(22,018,611.00 − 1,000,000.00) ÷ 60 months · month 60 is 350,310.38', 'G-C2 the subscription line')
  check(!(await present('tp-ready')), 'G-C2 complete: no readiness card')
  await tab('quote')
  await expectText('tp-q-cash1', '5,203,722.16', 'G-C2 cash in year 1')
  await expectText('tp-q-capex-note', '3 milestones', 'G-C2 the CAPEX tile note')
  want((await scheduleRows()).map((r) => r.slice(0, 4)), [['0', '300,000.00', '-', '300,000.00'], ['1 to 2', '-', '350,310.18', '350,310.18'], ['3', '400,000.00', '350,310.18', '750,310.18'],
    ['4 to 5', '-', '350,310.18', '350,310.18'], ['6', '300,000.00', '350,310.18', '650,310.18'], ['7 to 59', '-', '350,310.18', '350,310.18'],
    ['60', '-', '350,310.38', '350,310.38'], ['Total', '1,000,000.00', '21,018,611.00', '22,018,611.00']], 'G-C2 the payment schedule')

  // G-C3: Hardware, Monthly instalments over 12 months.
  await tab('payment')
  await page.click(tid('tp-capex-hardware'))
  await page.click(tid('tp-capex-two_phase'))
  check((await page.$eval(tid('tp-capex-recovery'), (e) => e.value)) === '12' && await pressed('tp-spread-12'), 'G-C3 Spread over defaults to 12, and the 12 pick shows it')
  await expectText('tp-capex-instalments', '129,166.67a month for months 1 to 11 · month 12 is 129,166.63 (carries the rounding)', 'G-C3 the instalments')
  await tab('quote')
  await expectText('tp-q-cash1', '5,643,722.24', 'G-C3 cash in year 1')
  await expectText('tp-q-capex-note', '129,166.67 a month, months 1 to 12', 'G-C3 the CAPEX tile note')
  want((await scheduleRows()).map((r) => r.slice(0, 4)), [['1 to 11', '129,166.67', '341,143.52', '470,310.19'], ['12', '129,166.63', '341,143.52', '470,310.15'],
    ['13 to 59', '-', '341,143.52', '341,143.52'], ['60', '-', '341,143.32', '341,143.32'], ['Total', '1,550,000.00', '20,468,611.00', '22,018,611.00']], 'G-C3 the payment schedule')
  // Verification 24: a pick other than the default is USED. 24 months: the
  // engine test's POSITION figures (64,583.33 for months 1 to 23, 64,583.41).
  await tab('payment')
  await page.click(tid('tp-spread-24'))
  check((await page.$eval(tid('tp-capex-recovery'), (e) => e.value)) === '24', 'the 24 pick writes 24 into the months field')
  await expectText('tp-capex-instalments', '64,583.33a month for months 1 to 23 · month 24 is 64,583.41 (carries the rounding)', 'Spread over 24 is priced')
  await type('tp-capex-recovery', '61')
  await expectText('tp-ready-reason', 'The recovery period must be a whole number of months from 1 to 60.', 'G-C4 R > T is refused, in words')
  await type('tp-capex-recovery', '12')

  // G-C5: CPI locked at 3% from year 2, on the default.
  await page.click(tid('tp-capex-hybrid'))
  await page.click(tid('tp-ms-remove-2')); await page.click(tid('tp-ms-remove-1'))
  await type('tp-ms-share-0', '100')
  await page.click(tid('tp-cpi-locked'))
  await page.waitForSelector(tid('tp-escalator'))
  await type('tp-escalator', '3')
  await page.waitForFunction((s) => !document.querySelector(s)?.disabled, {}, tid('tp-escalator-start'))
  await page.select(tid('tp-escalator-start'), '2')
  await expectText('tp-monthly-cpi', 'Base figures, before the annual increase. The invoiced figures, with the CPI, are on Quote.', 'C4 the Payment terms breakdown is Base, and says so under a CPI')
  await expectText('tp-pays-note', 'Final TCV: Base TCV plus the CPI uplift of 1,265,516.25.', 'G-C5 What the client pays names the uplift')
  await tab('quote')
  await expectText('tp-q-final', '23,284,127.25', 'G-C5 Final TCV')
  await expectText('tp-q-deal-tag', 'Deal value', 'G-C5 Locked: Final TCV is the deal value')
  await expectText('tp-profit-uplift', 'CPI uplift (not in approval)1,265,516.25', 'G-C5 the CPI uplift, not in approval')
  want((await scheduleRows()).map((r) => r.slice(0, 4)), [['0', '1,550,000.00', '-', '1,550,000.00'], ['1 to 12', '-', '341,143.52', '341,143.52'], ['13 to 24', '-', '351,377.83', '351,377.83'],
    ['25 to 36', '-', '361,919.16', '361,919.16'], ['37 to 48', '-', '372,776.74', '372,776.74'], ['49 to 59', '-', '383,960.04', '383,960.04'],
    ['60', '-', '383,959.81', '383,959.81'], ['Total', '1,550,000.00', '21,734,127.25', '23,284,127.25']], 'G-C5 the Final schedule')
  await tab('payment'); await page.click(tid('tp-cpi-published')); await tab('quote')
  check(!(await present('tp-q-deal-tag')), 'C-3 Published: no deal-value tag')
  await expectText('tp-q-final-note', 'CPI published 3% from year 2, projected', 'C-3 Published: Final TCV is a projection')
  await tab('payment'); await page.click(tid('tp-cpi-none'))
  check(!(await present('tp-escalator')) && !(await present('tp-escalator-start')), 'Q14 under None the rate and start year are not there')

  // G-C6: split WHT straddling the hardware value.
  await page.click(tid('tp-capex-custom'))
  await type('tp-capex-amount', '2000000.00')
  await type('tp-gst', '0')
  await page.click(tid('tp-wht-split'))
  await type('tp-wht-hw', '5'); await type('tp-wht-saas', '10')
  await expectText('tp-split-note', 'Split WHT: hardware rate on CAPEX payments up to the hardware value (1,550,000.00); any CAPEX above that, and all subscription, at the SaaS rate.', 'N10 the Split WHT rule, under Tax when Split is chosen')
  check(!(await present('tp-warn-funds')), 'G-C6 warning (a) does not fire')
  await tab('quote'); await sw('tp-tax-detail', true)
  const s6 = (await scheduleRows()).map((r) => [r[0], r[3], r[7], r[8]])
  want(s6.slice(0, 3), [['0', '2,000,000.00', '122,500.00', '1,877,500.00'], ['Hardware line', '1,550,000.00', '77,500.00', s6[1]?.[3]], ['SaaS line', '450,000.00', '45,000.00', s6[2]?.[3]]],
    'G-C6 month 0: a hardware line of 1,550,000.00 (WHT 77,500.00) and a SaaS line of 450,000.00 (WHT 45,000.00)')
  want(s6.slice(3, 5).map((r) => [r[0], r[2]]), [['1 to 59', '33,364.35'], ['60', '33,364.33']], 'G-C6 subscription WHT 33,364.35 each, 33,364.33 month 60')
  check(s6.at(-1)?.[0] === 'Total' && s6.at(-1)?.[2] === '2,124,360.98', 'G-C6 total WHT 2,124,360.98', JSON.stringify(s6.at(-1)))
  await capture('capex-gc6-straddle', 1240)
  await sw('tp-tax-detail', false)

  // C-9 (b): the subscription below the deal's monthly hosting cost warns.
  // POSITION, from spec v1.6: (22,018,611.00 - 21,000,000.00) / 60 = 16,976.85
  // against hosting 120 x 200 + 40 x 100 + 2 x 500 = 29,000.00 a month.
  await tab('payment')
  await page.click(tid('tp-wht-none')); await type('tp-gst', '9')
  await type('tp-capex-amount', '21000000.00')
  await expectText('tp-warn-hosting', 'The subscription of 16,976.85 a month is below the deal\'s monthly hosting cost of 29,000.00. The quote is allowed.', 'C-9 (b) shown, never refused')
  check(!(await present('tp-ready')), 'C-9 (b) the quote is still ready')
  await type('tp-capex-amount', '22018611.00')
  await expectText('tp-ready-reason', 'The CAPEX amount must be above 0 and below Base TCV (22,018,611.00).', 'G-C4 CAPEX = Base TCV is refused, in words')
} else if (TABS) {
  // ── TP_TABS: THE APPROVED MOCKUP'S FIVE STATES, FROM THE CLICK ──────────
  // prototypes/term-pricing-tabs/html/<state>/*.dc.html (the text reference;
  // the PNGs are the visual one). Labels and figures are the HTML's, cited by
  // line; T4-G1 and B-1 to B-6 are spec v1.7's. Run with --spec.
  const S1 = 'html/1/Main.dc.html', S2a = 'html/2a/Payment_OPEX.dc.html', S2b = 'html/2b/Payment_CAPEX.dc.html'
  const S2c = 'html/2c/Payment_Instalments.dc.html', S3 = 'html/3/Quote.dc.html'
  const shot = async (name) => { for (const w of [1240, 1600, 1920]) await capture(name, w) }

  // ── State 1: Pricing (S1). ──────────────────────────────────────────────
  await demo(); await pick(60)
  await expectText('tp-head-base', '22,018,611.00', `T-1 the header strip's Base TCV (${S1}:46)`)
  await expectText('tp-head-basis', 'OPEX', `T-1 the header strip's Payment basis (${S1}:47)`)
  await expectText('tp-head-sub', 'USD before tax', 'N12 the subtitle names the currency from the settings')
  want(await tabStrip(), [['1', 'Pricing', true], ['2', 'Payment terms', false], ['3', 'Quote', false]], `T-1 three tabs, Pricing open (${S1}:50)`)
  want(await page.$$eval(`${V} [data-testid="tp-units"] .tp-unit span`, (s) => s.map((x) => x.textContent.trim())), ['SafeSight', 'Air Quality', 'HEMIR'], `T-2 (a) the units strip (${S1}:56)`)
  want(await head('tp-ladder'), ['Term', 'Monthly fee (yr 1)', 'SafeSight / cam / mo', 'vs 36 months', 'Base TCV', 'Margin'], `T-2 (b) the ladder's columns (${S1}:58)`)
  want(await ladderRows(), [
    ['12 months', '1,240,333.15', '8,009.44', '+108.9%', '14,883,997.80', '89.3%'], ['24 months', '755,291.85', '4,928.89', '+27.2%', '18,127,004.40', '89.3%'],
    ['36 months', '593,611.16', '3,902.04', 'list', '21,370,001.76', '89.3%'], ['48 months', '451,964.40', '2,972.74', '−23.9%', '21,694,291.20', '87.9%'],
    ['60 months ✓', '366,976.85', '2,415.16', '−38.2%', '22,018,611.00', '86.5%'], ['72 months', '310,318.28', '2,043.44', '−47.7%', '22,342,916.16', '85.1%'],
    ['84 months', '269,847.79', '1,777.92', '−54.5%', '22,667,214.36', '83.8%'], ['96 months', '239,494.82', '1,578.79', '−59.7%', '22,991,502.72', '82.5%'],
    ['108 months', '215,887.29', '1,423.90', '−63.6%', '23,315,827.32', '81.2%'], ['120 months', '197,000.65', '1,299.99', '−66.8%', '23,640,078.00', '80.0%']],
  `T-2 (b) every term, the 60-month row chosen (${S1}:59-68)`)
  await expectText('tp-ladder-note', 'Click a row to quote it. Longer terms lower the monthly fee and raise total profit.', `the ladder's note (${S1}:70)`)
  await expectText('tp-breakdown-head', 'Price breakdown · 60 months', `T-2 (c) the breakdown's head (${S1}:71)`)
  want(await head('tp-breakdown'), ['Product', 'Band', 'Discount', 'Units', 'Fee / unit / mo', 'Monthly', 'Base TCV', 'Margin'], `T-2 (c) the breakdown's columns; no List fee (N3) (${S1}:73)`)
  want(await rows('tp-breakdown'), [
    ['SafeSight', '1 to 9', '0%', '9', '2,613.33', '23,519.97', '1,411,198.20', '87.2%'],
    ['', '10 to 49', '5%', '40', '2,482.67', '99,306.80', '5,958,408.00', '86.6%'],
    ['', '50 to 199', '10%', '71', '2,352.00', '166,992.00', '10,019,520.00', '85.8%'],
    ['SafeSight total', '', '', '120', '', '289,818.77', '17,389,126.20', '86.2%'],
    ['Air Quality', '1 to 9', '0%', '9', '973.33', '8,759.97', '525,598.20', '86.3%'],
    ['', '10 to 49', '5%', '31', '924.67', '28,664.77', '1,719,886.20', '85.6%'],
    ['Air Quality total', '', '', '40', '', '37,424.74', '2,245,484.40', '85.7%'],
    ['HEMIR', '1 to 9', '0%', '2', '19,866.67', '39,733.34', '2,384,000.40', '89.1%'],
    ['HEMIR total', '', '', '2', '', '39,733.34', '2,384,000.40', '89.1%'],
    ['Deal', '', '', '162', '', '366,976.85', '22,018,611.00', '86.5%']],
  `T-2 (c) B-1 to B-6 on the band rows (spec v1.7), the subtotals and the Deal row (${S1}:74-83)`)
  // C1: the product rows are the sums of their bands, read off the screen.
  const br = await rows('tp-breakdown')
  check(cents(br[0][6]) + cents(br[1][6]) + cents(br[2][6]) === cents(br[3][6]) && cents(br[4][6]) + cents(br[5][6]) === cents(br[6][6]), 'C1 each product\'s Base TCV is the sum of its bands, on screen')
  await expectText('tp-approval-tag', 'Approval', `the price card carries APPROVAL (${S1}:88)`)
  want([await text('tp-p-base'), await text('tp-p-monthly'), await text('tp-p-term'), await text('tp-p-profit'), await text('tp-p-margin')],
    ['22,018,611.00', '366,976.85', '60 months', '19,038,611.00', '86.5%'], `T-2 the price card's figures (${S1}:89-94)`)
  want(await page.$$eval(`${V} [data-testid="tp-price"] .tp-price-grid .tp-label`, (l) => l.map((x) => x.textContent.trim())), ['Monthly fee (yr 1)', 'Term', 'Gross profit', 'Margin on price'], `T-2 the price card's labels (${S1}:91-94)`)
  await expectText('tp-p-floor', '✓ Above the 25% margin floor', `T-2, N7 the margin floor status (${S1}:96)`)
  await expectText('tp-next-pricing', 'Next: Payment terms →', `T-1 Pricing ends with Next (${S1}:99)`)
  // T-6: Base only on Pricing. The words are read off the open panel.
  check(!(await page.$eval(tid('tp-panel-pricing'), (p) => /Final TCV|Deal value|DEAL VALUE/.test(p.textContent))), 'T-6 the Pricing tab shows Base only: no Final TCV, no Deal value')
  // T-2: margins are on screen for this NON-admin (no role-based hiding).
  check((await ladderRows()).every((r) => /%$/.test(r[5])), 'T-2 everyone sees margins: the non-admin reads the ladder\'s margin column')
  // N1: the ladder from the keyboard. Focus a row, press Enter, and the term
  // follows; Space too.
  await page.focus(tid('tp-ladder-48')); await page.keyboard.press('Enter')
  await expectText('tp-p-term', '48 months', 'N1 Enter on a focused ladder row chooses it')
  await page.focus(tid('tp-ladder-60')); await page.keyboard.press('Space')
  await expectText('tp-p-term', '60 months', 'N1 Space on a focused ladder row chooses it')
  await shot('s1-pricing')

  // ── State 2a: Payment terms, OPEX (S2a). ──────────────────────────────────
  await page.click(tid('tp-next-pricing'))
  await page.waitForSelector(tid('tp-panel-payment'))
  await type('tp-gst', '0')
  want(await tabStrip(), [['✓', 'Pricing', false], ['2', 'Payment terms', true], ['3', 'Quote', false]], `T-1 Next opens Payment terms, and the finished Pricing tab shows a tick (${S2a}:9)`)
  want(await page.$$eval(`${V} .tp-sec-title`, (t) => t.map((x) => x.textContent.trim())), ['Payment basis', 'Annual increase', 'Tax'], `T-3 the OPEX sections, in order (${S2a}:13-21)`)
  for (const t of ['tp-sec-amount', 'tp-sec-paid', 'tp-sec-subscription', 'tp-sec-breakdown']) check(!(await present(t)), `T-3 under OPEX ${t} is ABSENT from the DOM`)
  want([await pressed('tp-basis-opex'), await text('tp-basis-opex'), await text('tp-basis-capex')], [true, 'OPEX', 'CAPEX'], `T-3 Payment basis OPEX | CAPEX, OPEX by default (${S2a}:14)`)
  check(!(await page.$eval(tid('tp-panel-payment'), (p) => p.textContent.includes('Pricing basis'))), 'T-3 the label is "Payment basis", not "Pricing basis"')
  want(await page.$$eval(`${V} .tp-sec-note`, (t) => t.map((x) => x.textContent.trim())), ['How the client pays the price set in Pricing.', 'CPI uplift on the monthly fee. Never changes the approved price.', 'Applied to each invoice.'],
    `the sections' notes (${S2a}:13, 17, 21)`)
  check((await page.$eval(tid('tp-sec-basis'), (s) => s.textContent)).includes('OPEX: one monthly fee for the whole term. CAPEX: part of the price paid earlier from a capital budget, the rest as a monthly subscription.'),
    `the basis note (${S2a}:15)`)
  await expectText('tp-cpi-note', 'Published CPI: projected at an assumed rate. Locked rate: a negotiated fixed rate, written into the contract.', `the CPI note (${S2a}:19)`)
  want([await text('tp-cpi-none'), await text('tp-cpi-published'), await text('tp-cpi-locked'), await pressed('tp-cpi-none')], ['None', 'Published CPI', 'Locked rate', true], `T-3 Annual increase (${S2a}:18)`)
  want([await text('tp-wht-none'), await text('tp-wht-single'), await text('tp-wht-split'), await pressed('tp-wht-none')], ['None', 'Single rate', 'Split', true], `T-3 Withholding tax None | Single rate | Split (${S2a}:24)`)
  want(await lines('tp-pays'), [['Monthly fee', '366,976.85'], ['Months', '60'], ['Total', '22,018,611.00']], `What the client pays, OPEX (${S2a}:30-32)`)
  await expectText('tp-pays-note', 'Equals Base TCV: no annual increase applied.', `(${S2a}:33)`)
  check(!(await present('tp-ready')) && !(await page.$eval(tid('tp-next-payment'), (b) => b.disabled)), 'the OPEX quote is ready: no readiness card, Next open')
  await expectText('tp-next-payment', 'Next: Quote →', `(${S2a}:35)`)
  await shot('s2a-opex')
  // Every tab under OPEX: the Quote.
  await tab('quote')
  want((await tiles()).map((t) => t[0]), ['Base TCV Approval', 'Monthly fee (yr 1)', 'Cash in year 1'], 'T-5 OPEX tiles: Base TCV, Monthly fee yr 1, Cash in year 1 (no CPI, no CAPEX)')
  want(await head('tp-schedule'), ['Months', 'Monthly fee', 'Invoice'], 'C3 under OPEX the default schedule is Months | Monthly fee | Invoice')
  want(await scheduleRows(), [['1 to 60', '366,976.85', '366,976.85'], ['Total', '22,018,611.00', '22,018,611.00']], 'the OPEX schedule, one run, tying to Base TCV')
  await shot('opex-quote')
  await tab('payment')

  // ── State 2b: Payment terms, CAPEX, milestones being entered (S2b). ──────
  await page.click(tid('tp-basis-capex'))
  await expectText('tp-head-basis', 'CAPEX', `T-1 the header strip follows the basis (${S2b}:6)`)
  want(await page.$$eval(`${V} .tp-sec-title`, (t) => t.map((x) => x.textContent.trim())), ['Payment basis', 'CAPEX amount', 'How CAPEX is paid', 'Monthly subscription', 'Monthly breakdown', 'Annual increase', 'Tax'],
    `T-3 the CAPEX sections, in order (${S2b}:13-48)`)
  await expectText('tp-capex-hardware', 'Hardware 1,550,000.00', `T-3 Hardware shows its value on the button (${S2b}:17)`)
  await page.click(tid('tp-capex-custom'))
  await type('tp-capex-amount', '1000000.00')
  await type('tp-ms-share-0', '50')
  await page.click(tid('tp-ms-add')); await page.waitForSelector(tid('tp-ms-1'))
  await page.select(tid('tp-ms-key-1'), 'Installation complete')
  await type('tp-ms-month-1', '4')
  // T-4: the amount shows AS SOON AS the share is typed: one keystroke, read.
  await page.focus(tid('tp-ms-share-1')); await page.keyboard.type('3')
  await expectText('tp-ms-amount-1', '30,000.00', 'T-4 the row\'s amount shows on the first keystroke of its share (3%)')
  await page.keyboard.type('0')
  await expectText('tp-ms-amount-1', '300,000.00', `T4-G1 Installation complete 30% = 300,000.00 (${S2b}:24)`)
  await expectText('tp-ms-amount-0', '500,000.00', `T4-G1 Contract start 50% = 500,000.00 (${S2b}:23)`)
  await expectText('tp-ms-allocated', 'Allocated80%800,000.00', `T4-G1 allocated 80% = 800,000.00 (${S2b}:25)`)
  await expectText('tp-ms-remaining', 'Still to allocate20%200,000.00', `T4-G1 unallocated 20% = 200,000.00, amber (${S2b}:26)`)
  check(await page.$eval(tid('tp-ms-remaining'), (r) => r.classList.contains('tp-amber') && getComputedStyle(r.cells[0]).color === getComputedStyle(document.documentElement).getPropertyValue('--attention').trim().replace(/^#(..)(..)(..)$/, (m, a, b, c) => `rgb(${parseInt(a, 16)}, ${parseInt(b, 16)}, ${parseInt(c, 16)})`)),
    'T-4 "Still to allocate" is painted in the attention amber')
  await expectText('tp-ms-add', '+ Add milestone (2 of 5)', `(${S2b}:28)`)
  check((await page.$eval(tid('tp-sec-paid'), (s) => s.textContent)).includes('Amounts calculate as you type each share.'), `(${S2b}:28)`)
  await expectText('tp-warn-funds', 'Below hardware cost (1,240,000.00): Terminus funds 240,000.00 of hardware. The quote is allowed.', `the funding warning (${S2b}:18)`)
  await expectText('tp-subscription', '350,310.18(22,018,611.00 − 1,000,000.00) ÷ 60 months · month 60 is 350,310.38', `T4-G1 the subscription and its formula (${S2b}:32)`)
  want(await head('tp-monthly'), ['Months', 'CAPEX milestone', 'Subscription', 'Monthly invoice'], `T-3 the breakdown's columns (${S2b}:35)`)
  want(await rows('tp-monthly'), [['0 · Contract start', '500,000.00', '-', '500,000.00'], ['1 to 3', '-', '350,310.18', '350,310.18'],
    ['4 · Installation complete', '300,000.00', '350,310.18', '650,310.18'], ['5 to 59', '-', '350,310.18', '350,310.18'], ['60', '-', '350,310.38', '350,310.38'],
    ['Not yet scheduled', '200,000.00', '', '200,000.00'], ['Total', '1,000,000.00', '21,018,611.00', '22,018,611.00']],
  `T4-G1 the breakdown: m0 500,000.00, m4 650,310.18, Not yet scheduled 200,000.00, the Total tying to Base TCV (${S2b}:36-42)`)
  want(await lines('tp-pays'), [['CAPEX', '1,000,000.00'], ['Subscription', '350,310.18 × 60'], ['Total', '22,018,611.00']], `What the client pays (${S2b}:54-56)`)
  await expectText('tp-ready', 'Quote not readyAllocate the remaining 20% (200,000.00) of CAPEX to a milestone.', `T-4 the quote is NOT READY, and the card names what is missing (${S2b}:59)`)
  check(await page.$eval(tid('tp-next-payment'), (b) => b.disabled), `T-4 Next is blocked (${S2b}:60)`)
  check((await page.$eval(tid('tp-tab-quote'), (b) => [b.getAttribute('aria-disabled'), b.title]).then(([d, t]) => d === 'true' && t === 'Allocate the remaining 20% (200,000.00) of CAPEX to a milestone.')),
    'T-4 the Quote tab is blocked, with the reason')
  await page.click(tid('tp-tab-quote'))
  check(await present('tp-panel-payment') && !(await present('tp-panel-quote')), 'T-4 clicking the blocked Quote tab leaves Payment terms open')
  check(!(await page.$eval(tid('tp-panel-payment'), (p) => /Final TCV|Deal value/.test(p.textContent))), 'T-6 Payment terms shows no Final TCV and no Deal value')
  await shot('s2b-capex-milestones')
  // T-1: tab state survives switching tabs, read back field by field.
  const fieldState = () => page.evaluate(() => [...document.querySelectorAll('#view-term-pricing [data-testid="tp-panel-payment"] input, #view-term-pricing [data-testid="tp-panel-payment"] select')].map((e) => `${e.dataset.testid}=${e.value}`))
  const before = await fieldState()
  await tab('pricing')
  check((await text('tp-p-base')) === '22,018,611.00' && (await text('tp-p-term')) === '60 months', 'T-1 the Pricing tab is as left (and the price unmoved by the CAPEX in progress)')
  await tab('payment')
  want(await fieldState(), before, 'T-1 every Payment terms field survives a trip to Pricing and back')
  check(before.length >= 8, `T-1 the comparison covers the panel's fields (${before.length})`)
  // A blank share: the row shows no amount and the status is incomplete.
  await page.click(tid('tp-ms-add')); await page.waitForSelector(tid('tp-ms-2'))
  await expectText('tp-ms-amount-2', '-', 'T-4 a row with no share yet has no amount')
  await expectText('tp-ms-amount-1', '300,000.00', 'T-4 and the other rows keep theirs')
  await page.click(tid('tp-ms-remove-2'))

  // ── State 2c: Payment terms, CAPEX, monthly instalments over 12 (S2c). ──
  await page.click(tid('tp-capex-hardware'))
  await page.click(tid('tp-capex-two_phase'))
  want([await text('tp-capex-two_phase'), await text('tp-capex-hybrid')], ['Monthly instalments', 'Milestones'], `T-3 How CAPEX is paid: the term-pricing labels (${S2c}:20)`)
  check((await page.$eval(tid('tp-sec-paid'), (s) => s.textContent)).includes('Spread over a set number of months, alongside the subscription.'), `(${S2c}:19)`)
  want(await page.$$eval(`${V} [aria-label="Spread over"] button`, (b) => b.map((x) => [x.textContent.trim(), x.getAttribute('aria-pressed')])),
    [['6', 'false'], ['12', 'true'], ['18', 'false'], ['24', 'false'], ['36', 'false']], `T-3 Spread over 6 | 12 | 18 | 24 | 36, 12 by default (${S2c}:21)`)
  check((await page.$eval(tid('tp-sec-paid'), (s) => s.textContent)).includes('months (1 to 60)'), `the months field says its range (${S2c}:21)`)
  await expectText('tp-capex-instalments', '129,166.67a month for months 1 to 11 · month 12 is 129,166.63 (carries the rounding)', `the instalment and the last month (${S2c}:22)`)
  await expectText('tp-subscription', '341,143.52(22,018,611.00 − 1,550,000.00) ÷ 60 months · month 60 is 341,143.32', `(${S2c}:26)`)
  want(await head('tp-monthly'), ['Months', 'CAPEX instalment', 'Subscription', 'Monthly invoice'], `(${S2c}:29)`)
  want(await rows('tp-monthly'), [['1 to 11', '129,166.67', '341,143.52', '470,310.19'], ['12', '129,166.63', '341,143.52', '470,310.15'], ['13 to 59', '-', '341,143.52', '341,143.52'],
    ['60', '-', '341,143.32', '341,143.32'], ['Total', '1,550,000.00', '20,468,611.00', '22,018,611.00']], `the breakdown (${S2c}:30-34)`)
  want(await lines('tp-pays'), [['CAPEX', '129,166.67 × 12'], ['Subscription', '341,143.52 × 60'], ['Months 1 to 12', '470,310.19'], ['From month 13', '341,143.52'], ['Total', '22,018,611.00']],
    `What the client pays (${S2c}:46-50)`)
  check(!(await present('tp-ready')) && !(await page.$eval(tid('tp-next-payment'), (b) => b.disabled)), 'ready: Next open')
  await shot('s2c-capex-instalments')
  // C11: at a 12-month term the picks above it are disabled.
  await tab('pricing'); await pick(12); await tab('payment')
  want(await page.$$eval(`${V} [aria-label="Spread over"] button`, (b) => b.map((x) => x.disabled)), [false, false, true, true, true], 'C11 at 12 months the picks above the term are disabled')
  await tab('pricing'); await pick(60); await tab('payment')

  // ── State 3: Quote, CAPEX Hardware, CPI locked 3% (S3). ──────────────────
  // The default milestone row: Contract start, month 0, 100%.
  await page.click(tid('tp-capex-hybrid'))
  await page.click(tid('tp-ms-remove-1'))
  await type('tp-ms-share-0', '100')
  await page.click(tid('tp-cpi-locked'))
  await type('tp-escalator', '3')
  await page.waitForFunction((s) => !document.querySelector(s)?.disabled, {}, tid('tp-escalator-start'))
  await page.select(tid('tp-escalator-start'), '2')
  await page.click(tid('tp-next-payment'))
  await page.waitForSelector(tid('tp-panel-quote'))
  want(await tabStrip(), [['✓', 'Pricing', false], ['✓', 'Payment terms', false], ['3', 'Quote', true]], `T-1 both finished tabs ticked, Quote open (${S3}:9)`)
  want(await tiles(), [['Base TCV Approval', '22,018,611.00', 'Margin 86.5%'], ['Final TCV Deal value', '23,284,127.25', 'CPI locked 3% from year 2'],
    ['CAPEX', '1,550,000.00', 'Contract start, month 0'], ['Subscription (yr 1)', '341,143.52', 'a month, rising 3% a year'], ['Cash in year 1', '5,643,722.24', 'OPEX would be 4,403,722.20']],
  `T-5 the tiles, labels, figures and notes (${S3}:12-16)`)
  want(await head('tp-schedule'), ['Months', 'CAPEX', 'Subscription', 'Invoice'], `T-5 four columns by default (${S3}:22)`)
  want(await scheduleRows(), [['0', '1,550,000.00', '-', '1,550,000.00'], ['1 to 12', '-', '341,143.52', '341,143.52'], ['13 to 24', '-', '351,377.83', '351,377.83'],
    ['25 to 36', '-', '361,919.16', '361,919.16'], ['37 to 48', '-', '372,776.74', '372,776.74'], ['49 to 59', '-', '383,960.04', '383,960.04'],
    ['60', '-', '383,959.81', '383,959.81'], ['Total', '1,550,000.00', '21,734,127.25', '23,284,127.25']], `the schedule (${S3}:23-30)`)
  await expectText('tp-schedule-note', 'Tax detail adds GST, WHT and the amount received per invoice as extra columns.', `(${S3}:32)`)
  await expectText('tp-tax-detail', 'Show tax detail', `(${S3}:21)`)
  // T-5: the default view is NOT fitted and takes the standard figure size.
  check(await page.$eval(tid('tp-schedule'), (t) => !t.classList.contains('tp-schedule-fit') && getComputedStyle(t.querySelector('td:nth-child(2)')).fontSize === getComputedStyle(document.documentElement).getPropertyValue('--numeric-cell-size').trim()),
    'T-5 the default schedule uses the standard figure size, unfitted')
  want(await head('tp-profit'), ['Product', 'Base TCV', 'Gross profit', 'Margin'], 'N4 (amended) the profit card: Product | Base TCV | Gross profit | Margin')
  want(await rows('tp-profit'), [['SafeSight', '17,389,126.20', '14,989,126.20', '86.2%'], ['Air Quality', '2,245,484.40', '1,925,484.40', '85.7%'],
    ['HEMIR', '2,384,000.40', '2,124,000.40', '89.1%'], ['Deal', '22,018,611.00', '19,038,611.00', '86.5%']], `T29 and T30 per product on Base (${S3}:38-41)`)
  await expectText('tp-profit-gross', '19,038,611.00', `gross profit (${S3}:43)`)
  await expectText('tp-profit-uplift', 'CPI uplift (not in approval)1,265,516.25', `the CPI uplift, not in approval (${S3}:44)`)
  await shot('s3-quote-locked')
  await capture('s3-quote-locked', 3440)
  // T-5 Show tax detail adds today's columns, fitted.
  await sw('tp-tax-detail', true)
  want(await head('tp-schedule'), ['Months', 'CAPEX', 'Subscription', 'Invoice', 'Invoice (pre-GST)', 'GST', 'Invoice incl. GST', 'WHT', 'Terminus receives'], 'T-5 tax detail adds GST, WHT and received')
  check(await page.$eval(tid('tp-schedule'), (t) => t.classList.contains('tp-schedule-fit')), 'T-5 only the tax-detail view is fitted')
  // T30 from the click (absorbs --qp): WHT 10% borne, GST 9%.
  await tab('payment'); await type('tp-gst', '9'); await page.click(tid('tp-wht-single')); await type('tp-wht', '10'); await tab('quote')
  const s30 = await scheduleRows()
  want([s30[0][7], s30[0][8], s30[1][7], s30[1][8]], ['155,000.00', '1,395,000.00', '34,114.35', '307,029.17'], 'T30 month 0 and the year-1 subscription invoice: WHT and received')
  want([s30.at(-1)[0], s30.at(-1)[5], s30.at(-1)[6], s30.at(-1)[7]], ['Total', '2,095,571.38', '25,379,698.63', '2,328,412.62'], 'T30 with GST 9%: Final GST, TCV incl. GST, WHT on the Final invoices')
  await expectText('tp-profit-wht', 'WHT borne by Terminus (whole deal)-2,201,860.98', 'N5 T30 WHT borne on the Base schedule')
  await expectText('tp-profit-after-wht', 'Gross profit after WHT, margin 76.5%16,836,750.02', 'N5 T30 gross profit after WHT and its margin')
  // N8, D4: the schedule's subtitle states the treatment, every wording.
  const title = async (w, claim) => expectText('tp-schedule-title', w, claim)
  await title('60 months, CAPEX, CPI locked 3% from year 2, WHT 10% borne', 'D4 one rate, borne')
  await tab('payment'); await sw('tp-wht-grossup', true); await tab('quote')
  await title('60 months, CAPEX, CPI locked 3% from year 2, WHT 10% grossed up', 'D4 one rate, grossed up')
  await tab('payment'); await page.click(tid('tp-wht-split')); await type('tp-wht-hw', '5'); await type('tp-wht-saas', '10'); await tab('quote')
  await title('60 months, CAPEX, CPI locked 3% from year 2, split WHT 5% hardware / 10% SaaS, grossed up', 'D4 split, grossed up')
  await tab('payment'); await sw('tp-wht-grossup', false); await tab('quote')
  await title('60 months, CAPEX, CPI locked 3% from year 2, split WHT 5% hardware / 10% SaaS, borne', 'D4 split, borne')
  await shot('s3-quote-taxdetail')
  await tab('payment'); await page.click(tid('tp-wht-none')); await page.click(tid('tp-cpi-published')); await tab('quote')
  await title('60 months, CAPEX, CPI published 3% from year 2', 'C-3 Published names itself; no WHT, nothing about WHT')
  await tab('payment'); await page.click(tid('tp-cpi-none')); await tab('quote')
  await title('60 months, CAPEX', 'C-3 None: nothing about the CPI')
  check(!(await present('tp-q-final')) && !(await present('tp-profit-uplift')), 'T-6 with no CPI: no Final TCV tile, no uplift line')
  await sw('tp-tax-detail', false)
  // Every tab under CAPEX: Pricing unchanged by the basis.
  await tab('pricing')
  await expectText('tp-p-base', '22,018,611.00', 'Pricing under CAPEX: the same Base TCV (the price is set by OPEX)')
  await shot('capex-pricing')
}

if (!FLOW && !TP2 && !PC && !CAPEXM && !TABS) {
  // ── Default: T1, T6, N1, T15, C2, T23, T16, the refusals. ─────────────────
  await expectText('tp-p-base', '151,999.92', 'T1 Base TCV')
  await expectText('tp-p-margin', '90.0%', 'T1 margin')
  const t101 = [
    ['12 months', '8,666.67', '+105.3%', '104,000.04', '90.0%'], ['24 months', '5,333.33', '+26.3%', '127,999.92', '90.0%'],
    ['36 months ✓', '4,222.22', 'list', '151,999.92', '90.0%'], ['48 months', '3,216.67', '−23.8%', '154,400.16', '88.6%'],
    ['60 months', '2,613.33', '−38.1%', '156,799.80', '87.2%'], ['72 months', '2,211.11', '−47.6%', '159,199.92', '85.9%'],
    ['84 months', '1,923.81', '−54.4%', '161,600.04', '84.7%'], ['96 months', '1,708.33', '−59.5%', '163,999.68', '83.4%'],
    // Spec v1.3 table 10.1: the live TERMS has carried 108 since John's admin
    // change on 2026-10-03, so the opening ladder has ten rows.
    ['108 months', '1,540.74', '−63.5%', '166,399.92', '82.2%'],
    ['120 months', '1,406.67', '−66.7%', '168,800.40', '81.0%'],
  ]
  // At one SafeSight unit the per-camera column IS the fee (section 4.5 over
  // one unit), so it is the table's own fee column, not a new figure.
  want(await ladderRows(), t101.map((r) => [r[0], r[1], r[1], ...r.slice(2)]), 'the ladder at 1 unit reads table 10.1 row for row (fee, per camera, vs 36, TCV, margin), 36 chosen')

  // T6
  await type('tp-units-safesight', '120')
  await pick(60)
  await expectText('tp-p-base', '17,389,126.20', 'T6 Base TCV')
  await expectText('tp-p-margin', '86.2%', 'T6 margin')
  const sel6 = await page.$eval(`${V} tr.tp-ladder.on`, (r) => [...r.cells].map((c) => c.textContent.trim()))
  check(sel6[0] === '60 months ✓' && sel6[4] === '17,389,126.20' && sel6[5] === '86.2%' && sel6[2] === '2,415.16', 'the chosen ladder row is 60 months and equals the price card; per camera 2,415.16', JSON.stringify(sel6))
  // N1: the keyboard.
  await page.focus(tid('tp-ladder-48')); await page.keyboard.press('Enter')
  await expectText('tp-p-term', '48 months', 'N1 Enter chooses a focused ladder row')
  await pick(60)
  await capture('opex-T6', 1240)

  // T15 (spec v1.6, figures unchanged): CAPEX Hardware on the default row.
  await tab('payment'); await page.click(tid('tp-basis-capex')); await tab('quote')
  await expectText('tp-q-capex', '1,200,000.00', 'T15 CAPEX')
  await expectText('tp-q-capex-note', 'Contract start, month 0', 'T15 the default row pays at contract start')
  await expectText('tp-q-monthly', '269,818.77', 'T15 subscription')
  await expectText('tp-q-base', '17,389,126.20', 'T15 Base TCV')
  const sched15 = await scheduleRows()
  want(sched15.slice(0, 2), [['0', '1,200,000.00', '-', '1,200,000.00'], ['1 to 60', '-', '269,818.77', '269,818.77']], 'T15 schedule: CAPEX at month 0, then 60 x subscription')
  const tot15 = sched15.at(-1) ?? []
  check(tot15[0] === 'Total' && tot15[1] === '1,200,000.00' && tot15[3] === '17,389,126.20' && cents(tot15[1]) + cents(tot15[2]) === cents(tot15[3]),
    'T15 the Total row: CAPEX + subscription = TCV 17,389,126.20', JSON.stringify(tot15))
  // C2 (v1.7): the ladder is the same whatever the basis.
  await tab('pricing')
  want(await head('tp-ladder'), ['Term', 'Monthly fee (yr 1)', 'SafeSight / cam / mo', 'vs 36 months', 'Base TCV', 'Margin'], 'C2 under CAPEX the ladder shows every column')
  check(JSON.stringify(await page.$eval(`${V} tr.tp-ladder.on`, (r) => [...r.cells].map((c) => c.textContent.trim()))) === JSON.stringify(sel6), 'C2 the chosen row reads the same under CAPEX as under OPEX')
  await capture('capex-T15', 1240)

  // T23 (spec v1.2.3): 120 SafeSight + 30 AQ, OPEX.
  await tab('payment'); await page.click(tid('tp-basis-opex')); await tab('pricing')
  await type('tp-units-air_quality', '30')
  await expectText('tp-p-base', '19,079,808.60', 'T23 Base TCV')
  await expectText('tp-p-margin', '86.2%', 'T23 margin')
  const aq = (await rows('tp-breakdown')).filter((r) => r[1] && r[1] !== '' && (r[0] === 'Air Quality' || r[0] === '')).slice(-2).map((r) => [r[1], r[2], r[4]])
  want(aq, [['1 to 9', '0%', '973.33'], ['10 to 49', '5%', '924.67']], 'T23 AQ band fees 973.33 and 924.67')
  // T23's cost is 2,640,000.00: the gross profit is Base TCV less it.
  check(cents(await text('tp-p-profit')) === cents('19,079,808.60') - cents('2,640,000.00'), 'T23 cost 2,640,000.00 (gross profit = Base TCV - cost)', await text('tp-p-profit'))

  // T16 (spec v1.6): 1 unit, 60, CPI PUBLISHED 3%.
  await type('tp-units-air_quality', '0'); await type('tp-units-safesight', '1')
  await tab('payment'); await page.click(tid('tp-cpi-published')); await page.waitForSelector(tid('tp-escalator')); await type('tp-escalator', '3')
  await tab('quote')
  await expectText('tp-q-final', '166,494.36', 'T16 Final TCV (projected)')
  await expectText('tp-q-base', '156,799.80', 'T16 Base TCV')
  await expectText('tp-q-margin', 'Margin 87.2%', 'T16 margin, on Base')
  check(!(await present('tp-q-deal-tag')), 'T16 the deal value is Base TCV under Published (no tag)')
  want((await scheduleRows()).slice(0, -1).map((r) => r[1]), ['2,613.33', '2,691.73', '2,772.48', '2,855.66', '2,941.33'], 'T16 year fees')
  await tab('pricing')
  await expectText('tp-breakdown-head', 'Price breakdown · 60 months · year-1 fees', 'N11 with a CPI the breakdown says its fees are year 1\'s')

  // Errors: no units (T18), and an invalid GST.
  await tab('payment'); await page.click(tid('tp-cpi-none')); await tab('pricing')
  await type('tp-units-safesight', '0')
  await expectText('tp-error', 'Enter at least one unit of at least one product.', 'T18 on screen: no units is refused in words')
  check(!(await present('tp-ladder')) && !(await present('tp-price')), 'no ladder or price beside the refusal')
  check(await page.$eval(tid('tp-next-pricing'), (b) => b.disabled), 'and Next is blocked')
  // An invalid PERCENTAGE, typed (the units field drops non-digits at the
  // browser under inputMode="numeric", measured key by key in TERM_PRICING).
  await type('tp-units-safesight', '1')
  await tab('payment')
  await type('tp-gst', '9x')
  await expectText('tp-ready-reason', 'GST must be a percentage, for example 9.', 'an invalid GST is refused in words, on the readiness card')
  check((await page.$eval(tid('tp-tab-quote'), (b) => b.getAttribute('aria-disabled'))) === 'true' && await page.$eval(tid('tp-next-payment'), (b) => b.disabled), 'and the Quote tab and Next are blocked')
  await type('tp-gst', '9')

  // 1920: the same states, measured then captured.
  await tab('pricing'); await type('tp-units-safesight', '120'); await pick(60)
  await capture('opex-T6', 1920)
  await tab('payment'); await page.click(tid('tp-basis-capex')); await tab('quote')
  await expectText('tp-q-capex', '1,200,000.00', 'T15 at 1920')
  await capture('capex-T15', 1920)
}

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
