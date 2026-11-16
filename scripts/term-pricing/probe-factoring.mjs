#!/usr/bin/env node
// ── TERM_FACTORING Phase 3: PO factoring and the cash flow, from the click ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/probe-factoring.mjs [--out <dir>]
//
// Signs in as session-ref.json (a non-admin) by session injection, opens Term
// Pricing through the app's own navigate(), and drives every input with REAL
// keyboard events and clicks (Verification 6). Every expected figure is COPIED
// from docs/pricing-spec.md v1.10 section 11.6 (FA-3 to FA-7), never computed
// here. The spec's 90% margins are passed IN TEST into the browser's copy of
// the real GET response (the live SafeSight margin is John's data and differs);
// the catalog costs are the route's own, and the first claim checks them.
//
// Claims: factoring off is ABSENT, not hidden; the refusals in words and the
// Quote tab blocked by them; FA-3 Absorb and FA-4 Pass through on the factoring
// card, the Pricing tab, the Quote tab and its profit card; no client figure
// card carries a factoring word, under either treatment; the advance override
// and its note; FA-6 CAPEX; FA-7's cash flow rows and headline; and, at 1240,
// 1440 and 1920, no overflow and no overprint, with page captures taken AFTER
// every measurement (Verification 4), beside captures of the mockup.
//
// UNWIRED: needs a browser, a live server and a signed-in session, as
// probe-screen.mjs. Run at the TERM_FACTORING Phase 3 report.

import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('term-pricing/probe-factoring.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : `${ROOT}prototypes/term-factoring/built`
const SPEC_MARGINS = { safesight: '90', air_quality: '90', hemir: '90' }
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]

let failures = 0
let passes = 0
const check = (ok, claim, detail = '') => {
  if (ok) passes++; else failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`)
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
page.on('pageerror', (e) => check(false, 'the page throws nothing', e.message))
await page.setViewport({ width: 1240, height: 1100 })
await page.evaluateOnNewDocument((over) => {
  const real = window.fetch
  window.fetch = async (...a) => {
    const res = await real(...a)
    if (!/\/api\/term-pricing(\?|$)/.test(String(a[0]?.url ?? a[0])) || !res.ok) return res
    const body = await res.clone().json()
    return new Response(JSON.stringify({ ...body, settings: { ...body.settings, ...over } }), { status: res.status, headers: res.headers })
  }
}, { ANCHOR_MARGIN: SPEC_MARGINS, SHORT_TERM_MARGIN: SPEC_MARGINS })
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
async function type(t, value) {
  await page.focus(tid(t))
  await page.$eval(tid(t), (e) => e.select())
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
  const got = await page.$eval(tid(t), (e) => e.value)
  if (got !== value) throw new Error(`typing into ${t}: wanted ${JSON.stringify(value)}, the field holds ${JSON.stringify(got)}`)
}
async function expectText(t, expected, claim) {
  try {
    await page.waitForFunction((sel, want) => document.querySelector(sel)?.textContent.trim() === want, { timeout: 6000 }, tid(t), expected)
    check(true, claim, expected)
  } catch { check(false, claim, `expected ${expected}, saw ${await text(t)}`) }
}
async function expectContains(t, part, claim) {
  try {
    await page.waitForFunction((sel, want) => document.querySelector(sel)?.textContent.includes(want), { timeout: 6000 }, tid(t), part)
    check(true, claim, part)
  } catch { check(false, claim, `expected to contain ${part}, saw ${await text(t)}`) }
}
const checked = (t) => page.$eval(tid(t), (e) => e.getAttribute('aria-checked')).catch(() => null)
const toggle = async (t, on) => {
  if ((await checked(t)) !== String(on)) await page.click(tid(t))
  await page.waitForFunction((s, v) => document.querySelector(s)?.getAttribute('aria-checked') === String(v), {}, tid(t), on)
}
async function tab(name) {
  await page.click(tid(`tp-tab-${name}`))
  await page.waitForSelector(tid(`tp-panel-${name}`), { timeout: 6000 })
}
const pick = async (t) => { await page.click(tid(`tp-ladder-${t}`)); await expectText('tp-p-term', `${t} months`, `the ${t}-month row is chosen`) }
// The cash flow grid as a person reads it: the months, then each row's label and cells.
const grid = () => page.evaluate((v) => {
  const g = document.querySelector(`${v} [data-testid="tp-cashflow"] .cf-grid`)
  if (!g) return null
  const rows = [...g.querySelectorAll('.cf-row')]
  const cells = (r) => [...r.querySelectorAll('.cf-cell')].map((c) => c.textContent.trim())
  return { months: cells(rows[0]), rows: rows.slice(1).map((r) => [r.querySelector('.cf-label').textContent.trim(), cells(r)]) }
}, V)
const cfCell = (g, label, month) => {
  const row = g?.rows.find(([l]) => l === label)
  const i = g?.months.indexOf(String(month))
  return row && i >= 0 ? row[1][i] : null
}
// R-TF7: no client figure card names factoring. Each tab's client cards are
// NAMED and must be present: the first version skipped a card that was not on
// the tab it ran on, so under OPEX Pass through it never read "What the client
// pays" at all, and calibration A found it (Verification 14: a check guarded
// by its own population passes by never running).
const CLIENT_CARDS = { payment: ['tp-pays'], quote: ['tp-figures', 'tp-schedule-card'] }
async function clientCardsSilent(when) {
  const onTab = (await present('tp-panel-payment')) ? 'payment' : (await present('tp-panel-quote')) ? 'quote' : null
  check(!!onTab, `R-TF7 ${when}: run on a tab that holds client figures`, String(onTab))
  for (const c of CLIENT_CARDS[onTab] ?? []) {
    const t = await text(c)
    check(t !== null, `R-TF7 ${when}: the ${c} card is present to be read`)
    check(t !== null && !/factor/i.test(t), `R-TF7 ${when}: the ${c} card carries no factoring word`, t && /factor/i.test(t) ? t.slice(0, 120) : '')
  }
}

// Layout, measured BEFORE any capture (Verification 4): no page overflow, no
// clipped figure in the factoring card or the grid, and no two text boxes in
// the factoring card overlapping (overprint). And the mockup's geometry: the
// four inputs share one row where the card is wide enough for four columns.
const measure = () => page.evaluate((v) => {
  const view = document.querySelector(v)
  const card = view.querySelector('[data-testid="tp-factoring"]')
  const cf = view.querySelector('[data-testid="tp-cashflow"]')
  const boxes = card ? [...card.querySelectorAll('.tp-label, .tp-v, .tp-small, input, .deal-toggle-pair, .deal-toggle, h2')]
    // A flanked toggle is ONE box (its labels and track belong together).
    .filter((e) => e.getClientRects().length && (e.matches('.deal-toggle-pair') || !e.closest('.deal-toggle-pair')))
    .map((e) => ({ e, r: e.getBoundingClientRect() })) : []
  const leaves = boxes.filter(({ e }) => !boxes.some((o) => o.e !== e && e.contains(o.e)))
  const overlaps = []
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i].r, b = leaves[j].r
    if (leaves[i].e.contains(leaves[j].e) || leaves[j].e.contains(leaves[i].e)) continue
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    if (x > 1 && y > 1) overlaps.push(`${leaves[i].e.textContent.trim().slice(0, 24) || leaves[i].e.tagName} / ${leaves[j].e.textContent.trim().slice(0, 24) || leaves[j].e.tagName}`)
  }
  const clipped = [...(card?.querySelectorAll('.tp-v, .tp-label, .tp-small') ?? []), ...(cf?.querySelectorAll('.cf-cell, .tp-v') ?? [])]
    .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim())
  // Named, not counted, so a failure says WHAT crossed the edge and by how much.
  const edge = card ? card.getBoundingClientRect().right : 0
  const escapes = card ? [...card.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > edge + 1)
    .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}${e.dataset.testid ? `[${e.dataset.testid}]` : ''} +${Math.round(e.getBoundingClientRect().right - edge)}px`) : []
  const fields = card ? [...card.querySelectorAll('.tp-fx-field')].map((f) => Math.round(f.getBoundingClientRect().top)) : []
  const cardWidth = card ? Math.round(card.getBoundingClientRect().width) : 0
  return {
    pageOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    overlaps, clipped, escapes, fieldRows: new Set(fields).size, fieldCount: fields.length, cardWidth,
  }
}, V)

async function layout(name, width) {
  await page.setViewport({ width, height: 1100 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const m = await measure()
  check(!m.pageOverflowX && m.overlaps.length === 0 && m.clipped.length === 0 && m.escapes.length === 0,
    `${name} at ${width}: no page overflow, no overprint, no clipped figure, nothing past the card's edge`, JSON.stringify(m))
  if (m.fieldCount) {
    // The mockup's four inputs in one row (grid of 4); two rows only where the
    // view is narrow enough for the scoped rule to take two columns.
    check(m.fieldRows === 1 || (m.fieldRows === 2 && m.cardWidth < 800), `${name} at ${width}: the four inputs sit in one row, as the mockup (two below the narrow width)`, `${m.fieldRows} rows at card width ${m.cardWidth}`)
  }
  const h = await page.evaluate(() => document.querySelector('.app-content-scroll').scrollHeight)
  await page.setViewport({ width, height: Math.max(1100, h + 40) })
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: `${OUT}/p3-${width}-${name}.png` })
  await page.setViewport({ width: 1240, height: 1100 })
}

try {
  // ── T6's units and term (spec 11.6: SafeSight 120, 60 months, OPEX) ────
  await type('tp-units-safesight', '120')
  await pick(60)
  await tab('payment')

  // ── OFF: absent, not hidden ──────────────────────────────────────────
  check(await present('tp-factoring'), 'the PO factoring card is on Payment terms (R-TF1)')
  check((await checked('tp-factoring-toggle')) === 'false', 'factoring starts OFF')
  for (const t of ['tp-fx-advance', 'tp-fx-rate', 'tp-fx-term', 'tp-fx-method', 'tp-fx-treatment']) {
    check(!(await present(t)), `off: ${t} is absent from the DOM, not hidden (Commercials rule)`)
  }
  let g = await grid()
  check(JSON.stringify(g?.rows.map(([l]) => l)) === JSON.stringify(['Hardware procurement', 'Client payments', 'Hosting and service costs', 'Net', 'Running balance']),
    'off: the cash flow has no factoring rows', JSON.stringify(g?.rows.map(([l]) => l)))
  await expectText('tp-cf-lowest', '−694,181.23 at M1', 'off: the lowest balance is FA-7\'s without-factoring figure')
  await clientCardsSilent('with factoring off')

  // ── ON, rate blank: refused in words, Quote blocked (ruling 6) ─────────
  await toggle('tp-factoring-toggle', true)
  await page.waitForSelector(tid('tp-fx-rate'))
  await expectText('tp-fx-error', 'Enter the factoring rate, % per month. A blank rate is not 0.', 'a blank rate is refused, in words, not read as 0')
  check((await page.$eval(tid('tp-tab-quote'), (e) => e.getAttribute('aria-disabled'))) === 'true', 'and the Quote tab is blocked while it is refused')
  await expectText('tp-fx-hardware', 'Hardware cost: 120 × 8,000.00', 'the catalog cost the route serves is SafeSight 8,000.00 (FA-3 rests on it)')
  check((await page.$eval(tid('tp-fx-advance'), (e) => e.value)) === '960,000.00', 'the advance defaults to the hardware cost, 960,000.00 (R-TF3)')

  // ── FA-3, Absorb ─────────────────────────────────────────────────────
  await type('tp-fx-rate', '1.0')
  await expectText('tp-fx-cost', '62,400.00', 'FA-3: the factoring cost F')
  await expectText('tp-fx-fee', '289,818.77', 'FA-3: Absorb, the monthly fee unchanged')
  await expectText('tp-fx-margin', '86.2% → 85.8%', 'FA-3: margin before and after finance')
  await expectText('tp-fx-profit', '14,989,126.20 → 14,926,726.20', 'FA-3: profit before and after finance')
  check(!(await present('tp-fx-error')), 'the refusal is gone once the rate is entered')
  // FA-7: the cash flow.
  g = await grid()
  check(JSON.stringify(g?.rows.map(([l]) => l)) === JSON.stringify(['Hardware procurement', 'Factoring advance', 'Client payments', 'Hosting and service costs', 'Factoring principal', 'Factoring interest', 'Net', 'Running balance']),
    'on: the eight rows of R-TF8, principal and interest separate (ruling 4)', JSON.stringify(g?.rows.map(([l]) => l)))
  check(g?.months[0] === '1', 'OPEX: the grid starts at month 1 (no month 0)', g?.months[0])
  const m1 = ['Client payments', 'Hosting and service costs', 'Hardware procurement', 'Factoring advance', 'Factoring principal', 'Net'].map((l) => cfCell(g, l, 1))
  check(JSON.stringify(m1) === JSON.stringify(['289,818.77', '−24,000.00', '−960,000.00', '960,000.00', '-', '265,818.77']), 'FA-7 month 1: procurement and advance in month 1, no repayment yet', JSON.stringify(m1))
  const m2 = ['Factoring principal', 'Factoring interest', 'Net', 'Running balance'].map((l) => cfCell(g, l, 2))
  check(JSON.stringify(m2) === JSON.stringify(['−80,000.00', '−9,600.00', '176,218.77', '442,037.54']), 'FA-7 month 2: repayments start the month after the advance', JSON.stringify(m2))
  const m13 = ['Factoring interest', 'Net', 'Running balance'].map((l) => cfCell(g, l, 13))
  check(JSON.stringify(m13) === JSON.stringify(['−800.00', '185,018.77', '2,433,244.01']), 'FA-7 month 13', JSON.stringify(m13))
  check(cfCell(g, 'Running balance', 60) === '14,926,726.20', 'FA-7 month 60 balance = profit after finance', cfCell(g, 'Running balance', 60))
  await expectText('tp-cf-lowest', '265,818.77 at M1', 'FA-7 headline: lowest balance with factoring')
  await expectText('tp-cf-lowest-without', '−694,181.23 at M1', 'FA-7 headline: without factoring (the model run twice)')
  await expectText('tp-cf-payback', 'M1', 'FA-7: payback with factoring')
  await expectText('tp-cf-payback-without', '(without factoring M4)', 'FA-7: payback without factoring, ruling 5')
  await clientCardsSilent('under Absorb, Payment terms')
  await layout('payment-absorb', 1240)
  // The Pricing tab: the approval figures are after finance under Absorb (spec 4.3).
  await tab('pricing')
  await expectText('tp-p-base', '17,389,126.20', 'FA-3 on Pricing: Base TCV unchanged')
  await expectText('tp-p-margin', '85.8%', 'FA-3 on Pricing: the margin the floor reads, after finance (ruling 2)')
  await expectContains('tp-p-factoring', 'Before it: 14,989,126.20, 86.2%', 'FA-3 on Pricing: before finance, reported beside it (spec 9.3)')
  // The Quote tab: the internal profit card carries the factoring cost (R-TF7).
  await tab('quote')
  const profitHead = await page.$$eval(`${tid('tp-profit')} thead th`, (h) => h.map((x) => x.textContent.trim()))
  check(profitHead.includes('Factoring'), 'Absorb: the internal profit by product shows the factoring cost (R-TF7)', JSON.stringify(profitHead))
  const ss = await page.$eval(tid('tp-profit-safesight'), (r) => [...r.cells].map((c) => c.textContent.trim()))
  check(JSON.stringify(ss) === JSON.stringify(['SafeSight', '17,389,126.20', '−62,400.00', '14,926,726.20', '85.8%']), 'FA-3 per product on the profit card', JSON.stringify(ss))
  await expectContains('tp-profit-before-factoring', '14,989,126.20', 'FA-3: profit before factoring on the profit card')
  await clientCardsSilent('under Absorb')
  await layout('quote-absorb', 1240)

  // ── FA-4, Pass through ───────────────────────────────────────────────
  await tab('payment')
  await toggle('tp-fx-treatment', true)
  await expectText('tp-fx-fee', '289,818.77 → 290,859.17', 'FA-4: the fee rises by the pass-through')
  await expectText('tp-fx-margin', '86.2% → 85.9%', 'FA-4: the margin dips')
  await expectText('tp-fx-profit', '14,989,126.20 (unchanged)', 'FA-4: profit unchanged')
  await expectText('tp-pays-monthly', '290,859.17', 'FA-4: What the client pays carries the higher fee')
  await clientCardsSilent('under Pass through, Payment terms')
  for (const w of [1240, 1440, 1920]) await layout('payment-pass', w)
  await tab('pricing')
  await expectText('tp-p-base', '17,451,526.20', 'FA-4 on Pricing: Base TCV carries the pass-through (the approval value)')
  await expectContains('tp-breakdown-pt-safesight', '8.67 per unit per month beside the bands, month 60 adjusted by −24.00', 'FA-4: the one text line under the product (Phase 2 sign-off)')
  const band1 = await page.$eval(tid('tp-band-safesight-1'), (r) => r.cells[4].textContent.trim())
  check(band1 === '2,613.33', 'FA-4: the band fee is untouched', band1)
  for (const w of [1240, 1440, 1920]) await layout('pricing-pass', w)
  await tab('quote')
  const sched = await page.$$eval(`${tid('tp-schedule')} tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
  check(JSON.stringify(sched.slice(0, 2).map((r) => [r[0], r[1]])) === JSON.stringify([['1 to 59', '290,859.17'], ['60', '290,835.17']]),
    'FA-4: the schedule, months 1 to 59, and month 60 carrying the remainder', JSON.stringify(sched.slice(0, 2)))
  await expectContains('tp-profit-pass-through', '62,400.00', 'FA-4: the profit card names the cost passed through at cost')
  await clientCardsSilent('under Pass through')
  for (const w of [1240, 1440, 1920]) await layout('quote-pass', w)

  // ── The advance override and its note (R-TF3) ────────────────────────
  await tab('payment')
  await toggle('tp-fx-treatment', false)
  await type('tp-fx-advance', '1000000')
  await expectText('tp-fx-above', 'The advance is above the hardware cost of 960,000.00. The quote is allowed.', 'an advance above the hardware cost shows the note')
  await expectText('tp-fx-cost', '65,000.00', 'and F follows it (1,000,000.00 at 1.0% over 12 months, straight: 0.01 x 1,000,000 x 13 / 2)')
  await type('tp-fx-advance', '0')
  await expectText('tp-fx-cost', '0.00', 'an advance of 0 is allowed, and costs nothing')
  check(!(await present('tp-fx-above')), 'and carries no note')
  await type('tp-fx-advance', '')
  await expectText('tp-fx-cost', '62,400.00', 'cleared, the advance is the hardware cost again')

  // ── Ruling 3: the term limit, refused in words ───────────────────────
  await type('tp-fx-term', '60')
  await expectContains('tp-fx-error', 'from 1 to 59, so every repayment falls inside the 60-month contract', 'a factoring term of T is refused, naming T - 1')
  check((await page.$eval(tid('tp-tab-quote'), (e) => e.getAttribute('aria-disabled'))) === 'true', 'and blocks the Quote tab')
  await type('tp-fx-term', '12')
  check(!(await present('tp-fx-error')), '12 months prices again')

  // ── FA-6: the demo deal as CAPEX G-C1, Pass through ──────────────────
  await tab('pricing')
  await type('tp-units-air_quality', '40')
  await type('tp-units-hemir', '2')
  await tab('payment')
  await page.click(tid('tp-basis-capex'))
  await toggle('tp-fx-treatment', true)
  await expectText('tp-fx-hardware', 'Hardware cost: 1,240,000.00 (SafeSight 120 × 8,000.00, Air Quality 40 × 2,000.00, HEMIR 2 × 100,000.00)', 'the hardware note per product, summed (R-TF3)')
  await expectText('tp-fx-cost', '80,600.00', 'FA-5: F on the demo deal')
  await expectContains('tp-subscription', '342,487.38', 'FA-6: the subscription carries the pass-through')
  await expectContains('tp-subscription-note', 'plus 1,343.86 recovered at cost · month 60 is 342,455.58', 'FA-6: outside CPI, month 60 carrying the remainder')
  await expectText('tp-pays-subscription', '342,487.38 × 60', 'FA-6: What the client pays')
  g = await grid()
  check(g?.months[0] === '0' && cfCell(g, 'Client payments', 0) === '1,550,000.00', 'CAPEX: month 0 appears, the CAPEX payment received before procurement (Phase 1 item 3)', JSON.stringify([g?.months[0], cfCell(g, 'Client payments', 0)]))
  await expectText('tp-cf-lowest', '1,550,000.00 at M0', 'CAPEX G-C1: the lowest balance is month 0')
  await clientCardsSilent('under CAPEX Pass through')
  for (const w of [1240, 1440, 1920]) await layout('payment-capex-pass', w)
  await tab('quote')
  await clientCardsSilent('on the CAPEX quote')
  await layout('quote-capex-pass', 1440)

  // ── Off again: absent again ──────────────────────────────────────────
  await tab('payment')
  await toggle('tp-factoring-toggle', false)
  for (const t of ['tp-fx-rate', 'tp-fx-term', 'tp-fx-method']) check(!(await present(t)), `switched off again: ${t} is absent`)
  g = await grid()
  check(!g?.rows.some(([l]) => /Factoring/.test(l)), 'and the cash flow has no factoring rows')
  await expectContains('tp-subscription', '341,143.52', 'and G-C1\'s subscription is back (factoring off moves nothing)')

  // ── The mockup, captured at the same widths, for the side-by-side ───
  const mock = await browser.newPage()
  for (const w of [1240, 1440, 1920]) {
    await mock.setViewport({ width: w, height: 1200 })
    await mock.goto(`file://${ROOT}prototypes/term-factoring-mockup.html`, { waitUntil: 'networkidle0' })
    await mock.screenshot({ path: `${OUT}/mockup-${w}.png`, fullPage: true })
  }
} catch (e) {
  check(false, 'the probe ran to the end', e.message)
}
await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}: ${passes} passed, ${failures} failed`)
process.exit(failures ? 1 : 0)
