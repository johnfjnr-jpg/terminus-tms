#!/usr/bin/env node
// ── TP_MANUAL: the manual ladder comparison, from the click ──────────────
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/probe-manual.mjs [--out <dir>]
//
// Signs in as session-ref.json (john+test, a NON-admin, so M-3 is measured on
// the account the ruling is about) by session injection, opens Term Pricing
// through the app's own navigate(), and drives the card with REAL keyboard
// events (Verification 6). Every expected figure and sentence is COPIED from
// spec v1.9 section 11.5 (MG-1 to MG-4, MG-4 as corrected by C2), the brief's
// rulings or the approved mockup, never computed here.
//
// The spec's settings are passed IN TEST, in the browser's copy of the real
// GET: 90% margins, PROFIT_STEP 0, MARGIN_FLOOR 25, the seed bands, the
// default TERMS and ANCHOR_TERM 36. The live rows hold these today; passing
// them means an admin's later change cannot move a golden. The catalog costs
// are the live ones, and the note's figures are asserted, so a catalog change
// shows as a failure rather than as a wrong golden.
//
// Claims: the empty state (C11); the mockup state, MG-1, with its chips, its
// amber rows and its note (M-4 to M-6, C3, C6, C8); MG-2, MG-3, MG-4; a price
// refused with the field error and treated as blank (M-7, C9); a switch of
// tab keeps the prices and a return to the screen clears them while the units
// stay (M-2, C5); Fill from calculated and Clear (M-4); and the card sends no
// request at all (M-2: comparison only).
//
// Artefacts are named after the run (Verification 44): manual-<state>-<width>.
// A thrown run still prints a verdict, so a calibration reads a failure with
// its cause rather than a run that produced nothing.
//
// UNWIRED: needs a browser, a live server and a session.

import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-manual.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : `${ROOT}prototypes/term-pricing-manual-ladder/built`
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
mkdirSync(OUT, { recursive: true })

let failures = 0
process.on('uncaughtException', (e) => {
  console.log(`FAIL  the probe ran to its end  [${e.message}]`)
  console.log(`\n${failures + 1} FAILED (manual)`)
  process.exit(1)
})
const check = (ok, claim, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`)
}
const want = (got, exp, claim) => check(JSON.stringify(got) === JSON.stringify(exp), claim, JSON.stringify(got))

// ── Spec 11.5, copied ──
const TERMS = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]
const MG1_PRICES = {
  12: '2,500.00', 24: '1,500.00', 36: '1,100.00', 48: '900.00', 60: '800.00',
  72: '700.00', 84: '620.00', 96: '560.00', 108: '520.00', 120: '500.00',
}
// TYPED WITHOUT COMMAS: the estate's numeric-input guard (app.js,
// NUMERIC_INPUT_SELECTOR) strips every character but digits and the first point
// from a decimal field as it is typed, so a person cannot type a comma here. A
// comma reaches the field only through Fill, which is where C9 is measured.
const MG1_TYPED = Object.fromEntries(Object.entries(MG1_PRICES).map(([t, v]) => [t, v.replace(/,/g, '')]))
// term, calculated, difference, vs 36, margin, profit, client total, check
const MG1 = [
  ['12 months', '8,666.67', '−71.2%', '+127.3%', '65.3%', '19,600.00', '30,000.00', '✓'],
  ['24 months', '5,333.33', '−71.9%', '+36.4%', '64.4%', '23,200.00', '36,000.00', '✓'],
  ['36 months', '4,222.22', '−73.9%', 'list', '61.6%', '24,400.00', '39,600.00', '✓'],
  ['48 months', '3,216.67', '−72.0%', '−18.2%', '59.3%', '25,600.00', '43,200.00', '✓'],
  ['60 months', '2,613.33', '−69.4%', '−27.3%', '58.3%', '28,000.00', '48,000.00', '✓'],
  ['72 months', '2,211.11', '−68.3%', '−36.4%', '55.6%', '28,000.00', '50,400.00', '✓'],
  ['84 months', '1,923.81', '−67.8%', '−43.6%', '52.4%', '27,280.00', '52,080.00', '⚠ Profit below 72 months'],
  ['96 months', '1,708.33', '−67.2%', '−49.1%', '49.4%', '26,560.00', '53,760.00', '⚠ Profit below 84 months'],
  ['108 months', '1,540.74', '−66.2%', '−52.7%', '47.3%', '26,560.00', '56,160.00', '✓'],
  ['120 months', '1,406.67', '−64.5%', '−54.5%', '46.7%', '28,000.00', '60,000.00', '✓'],
]
const SEED = [{ from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' }]
const IN_TEST = {
  TERMS, ANCHOR_TERM: 36, PROFIT_STEP: '0.00', MARGIN_FLOOR: '25',
  ANCHOR_MARGIN: { safesight: '90', air_quality: '90', hemir: '90' },
  SHORT_TERM_MARGIN: { safesight: '90', air_quality: '90', hemir: '90' },
  VOLUME_BANDS_BY_PRODUCT: { safesight: SEED, air_quality: SEED, hemir: SEED },
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
page.on('pageerror', (e) => check(false, 'the page throws nothing', e.message))
await page.setViewport({ width: 1240, height: 1100 })

await page.evaluateOnNewDocument((inTest) => {
  const real = window.fetch
  window.fetch = async (...a) => {
    const url = String(a[0]?.url ?? a[0])
    const res = await real(...a)
    if (!/\/api\/term-pricing(\?|$)/.test(url) || !res.ok) return res
    const body = await res.clone().json()
    return new Response(JSON.stringify({ ...body, settings: { ...body.settings, ...inTest } }), { status: res.status, headers: res.headers })
  }
}, IN_TEST)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('#view-term-pricing [data-testid="tp-manual"]'), { timeout: 15000 })

// From here every request the page makes is recorded: the card sends none (M-2).
const writes = []
page.on('request', (r) => { if (r.method() !== 'GET' && /\/api\//.test(r.url())) writes.push(`${r.method()} ${r.url()}`) })

const V = '#view-term-pricing'
const tid = (t) => `${V} [data-testid="${t}"]`
const text = (t) => page.$eval(tid(t), (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null)
const present = async (t) => !!(await page.$(tid(t)))
const value = (t) => page.$eval(tid(t), (e) => e.value).catch(() => null)
// A row as a person reads it: the input's value stands in for its cell, and a
// missing row FAILS its claim rather than crashing the probe.
const manualRows = () => page.$$eval(`${V} [data-testid="tp-manual-table"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c, i) => (i === 1
  ? c.querySelector('input')?.value ?? ''
  : i === 8 ? [...c.querySelectorAll('.tp-manual-flag')].map((f) => f.textContent.trim()).join(' | ') || c.textContent.trim()
    : c.textContent.trim()))))
// The columns a golden names: term, calculated, difference, vs, margin, profit, total, check.
const golden = (rows) => rows.map((r) => [r[0], r[2], r[3], r[4], r[5], r[6], r[7], r[8]])
const chips = () => page.$$eval(`${V} [data-testid="tp-manual-chips"] .tp-manual-chip`, (cs) => cs.map((c) => [c.classList.contains('is-warn') ? 'warn' : 'ok', c.textContent.replace(/\s+/g, ' ').trim()]))
const settle = () => page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))
async function type(t, v) {
  await page.focus(tid(t))
  await page.$eval(tid(t), (e) => e.select())
  await page.keyboard.press('Backspace')
  if (v) await page.keyboard.type(v)
  const got = await value(t)
  if (got !== v) throw new Error(`typing into ${t}: wanted ${JSON.stringify(v)}, the field holds ${JSON.stringify(got)}`)
  await settle()
}
async function typeAll(prices) { for (const t of TERMS) await type(`tp-manual-price-${t}`, prices[t] ?? '') }
async function atWidths(name) {
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1100 })
    await settle()
    // Measure first, capture second (Verification 4).
    const over = await page.evaluate(() => [...document.querySelectorAll('#view-term-pricing [data-testid="tp-manual"], #view-term-pricing [data-testid="tp-manual"] table')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1).length)
    check(over === 0, `${name} at ${w}: nothing in the card overflows its box`, String(over))
    await page.$eval(tid('tp-manual'), (e) => e.scrollIntoView({ block: 'start' }))
    const r = await page.$eval(tid('tp-manual'), (e) => { const b = e.getBoundingClientRect(); return { top: b.top, h: b.height } })
    check(r.h > 300 && r.top < 1100, `capture ${name}-${w}: the card is inside the captured region`, `top ${Math.round(r.top)}, height ${Math.round(r.h)}`)
    await page.screenshot({ path: `${OUT}/manual-${name}-${w}.png` })
  }
  await page.setViewport({ width: 1240, height: 1100 })
  await settle()
}

// ── M-3: the session is a non-admin, and the card is there and usable ──
check((await text('tp-settings-toggle')) !== null, 'the settings card is present')
await page.click(tid('tp-settings-toggle'))
await page.waitForSelector(tid('tp-bands'), { timeout: 6000 })
check(((await text('tp-bands')) ?? '').includes('Only an admin can change these.'), 'M-3: this session is a NON-admin (the band editor says so)')
await page.click(tid('tp-settings-toggle'))

// ── M-4, C7: placement, below the term ladder and above the breakdown ──
const order = await page.evaluate(() => {
  const at = (t) => document.querySelector(`#view-term-pricing [data-testid="${t}"]`)?.getBoundingClientRect()
  const l = at('tp-ladder-card'); const m = at('tp-manual'); const b = at('tp-breakdown-card')
  return l && m && b ? { below: m.top >= l.bottom - 1, above: m.bottom <= b.top + 1, left: Math.abs(m.left - l.left) < 2 } : null
})
want(order, { below: true, above: true, left: true }, 'M-4, C7: the card sits directly below the term ladder, in its column, above the breakdown')
want(await text('tp-manual-title'), 'Compare a manual ladder · SafeSight per camera', 'M-4: the title')
want([await text('tp-manual-fill'), await text('tp-manual-clear')], ['Fill from calculated', 'Clear'], 'M-4: the two buttons')
want(await page.$$eval(`${V} [data-testid="tp-manual-table"] thead th`, (h) => h.map((x) => x.textContent.trim())),
  ['Term', 'Your price / mo', 'Calculated, 1 camera', 'Difference', 'vs 36 months', 'Margin', 'Profit / camera', 'Client total', 'Check'],
  'M-5, C4, C6: the columns, "vs" naming ANCHOR_TERM and Calculated naming one camera')

// ── C11: the empty state ──
check(!(await present('tp-manual-chips')), 'C11: no chips until a price is entered')
want(golden(await manualRows()), MG1.map((r) => [r[0], r[1], '', '', '', '', '', '']),
  'C11: every term shows Calculated (MG-1\'s column), and nothing else')
want(await text('tp-manual-note'),
  'One SafeSight camera, first volume band (0%), Base figures with no CPI. Cost per camera = 8,000.00 hardware + 200.00 a month hosting. "Calculated" uses the live settings. A blank price skips that term.',
  'C6, C8: the note, its figures derived')
await atWidths('empty')

// ── MG-1: the mockup state, typed ──
await typeAll(MG1_TYPED)
await page.click(tid('tp-manual-title')); await settle()
want((await manualRows()).map((r) => r[1]), TERMS.map((t) => MG1_PRICES[t]), 'M-5: a price typed without commas reads in money format once the field is left')
want(golden(await manualRows()), MG1, 'MG-1: every column at every term, from the click')
want(await chips(), [
  ['ok', '✓At or above the 25% floor at every priced term'],
  ['ok', '✓Client total never falls with a longer term'],
  ['warn', '⚠Profit falls at 2 terms (84, 96)'],
], 'MG-1, C3: the three chips, in order, with their marks')
const tint = await page.evaluate(() => {
  const bg = (t) => getComputedStyle(document.querySelector(`#view-term-pricing [data-testid="${t}"] td`)).backgroundColor
  return { flagged: [bg('tp-manual-84'), bg('tp-manual-96')], plain: bg('tp-manual-72') }
})
check(tint.flagged[0] === tint.flagged[1] && tint.flagged[0] !== tint.plain, 'M-6: flagged rows (84, 96) are tinted and an unflagged row is not', JSON.stringify(tint))
const flagColour = await page.$eval(`${V} [data-testid="tp-manual-check-84"] .tp-manual-flag`, (e) => getComputedStyle(e).color).catch(() => null)
const okColour = await page.$eval(`${V} [data-testid="tp-manual-check-72"] .tp-ok`, (e) => getComputedStyle(e).color).catch(() => null)
check(!!flagColour && !!okColour && flagColour !== okColour, 'M-6: a flag reads in amber, not in the tick\'s colour', `${flagColour} vs ${okColour}`)
await atWidths('mg1')

// ── M-2, T-1: a switch of tab keeps the prices ──
await page.click(tid('tp-tab-payment')); await page.waitForSelector(tid('tp-panel-payment'))
await page.click(tid('tp-tab-pricing')); await page.waitForSelector(tid('tp-manual'), { timeout: 6000 })
want((await manualRows()).map((r) => r[1]), TERMS.map((t) => MG1_PRICES[t]), 'M-2: a switch of tab keeps every price')

// ── MG-2: a blank 72 ──
await type('tp-manual-price-72', '')
const r72 = (await manualRows())[5]
want([r72[2], ...r72.slice(3)], ['2,211.11', '', '', '', '', '', ''], 'MG-2, M-7: a blank 72 keeps its Calculated and shows no figures and no check')
want((await manualRows())[6][8], '⚠ Profit below 60 months', 'MG-2: the 84 row compares against 60')
// ── M-7, C9: a price refused for its term, and blank to the checks ──
await type('tp-manual-price-72', '1.234')
want([await page.$eval(tid('tp-manual-price-72'), (e) => e.getAttribute('aria-invalid')), await text('tp-manual-err-72')],
  ['true', 'Enter a monthly price above 0, to the cent.'], 'M-7, C9: three decimals are refused with the field error, marked invalid')
want((await manualRows())[6][8], '⚠ Profit below 60 months', 'M-7: a refused price is blank to the checks (84 still against 60)')
await type('tp-manual-price-72', '0')
want(await text('tp-manual-err-72'), 'Enter a monthly price above 0, to the cent.', 'M-7: zero is refused')
await type('tp-manual-price-72', '700')
check(!(await present('tp-manual-err-72')) && (await page.$eval(tid('tp-manual-price-72'), (e) => e.getAttribute('aria-invalid'))) === null,
  'C9: a valid price clears the error and the invalid mark')
want((await manualRows())[6][8], '⚠ Profit below 72 months', 'and 84 compares against 72 again')

// ── MG-3: a blank 36 ──
await type('tp-manual-price-36', '')
want((await manualRows()).filter((r) => r[1] !== '').map((r) => r[4]), Array(9).fill('-'), 'MG-3: with 36 blank, every vs 36 shows "-"')
await type('tp-manual-price-36', '1100.00')

// ── MG-4: 120 at 300.00, all three flags (C2) ──
await type('tp-manual-price-120', '300.00')
const r120 = (await manualRows())[9]
want([r120[5], r120[6], r120[7]], ['11.1%', '4,000.00', '36,000.00'], 'MG-4: margin, profit and client total')
want(await page.$$eval(`${V} [data-testid="tp-manual-check-120"] .tp-manual-flag`, (fs) => fs.map((f) => f.textContent.trim())),
  ['⚠ Below the floor', '⚠ Client total below 108 months', '⚠ Profit below 108 months'], 'MG-4, C2: three flags, one per line, in the ruled order')
const lines = await page.$$eval(`${V} [data-testid="tp-manual-check-120"] .tp-manual-flag`, (fs) => fs.map((f) => Math.round(f.getBoundingClientRect().top)))
check(lines.length === 3 && lines[0] < lines[1] && lines[1] < lines[2], 'C2: each flag on its own line, measured', JSON.stringify(lines))
want(await chips(), [
  ['warn', '⚠Below the 25% floor at 1 term (120)'],
  ['warn', '⚠Client total falls at 1 term (120)'],
  ['warn', '⚠Profit falls at 3 terms (84, 96, 120)'],
], 'MG-4, C3: the chips name the terms')
await atWidths('mg4')

// ── M-4: Fill from calculated ──
await page.click(tid('tp-manual-fill'))
await page.waitForFunction(() => document.querySelector('#view-term-pricing [data-testid="tp-manual-price-12"]')?.value === '8,666.67', { timeout: 6000 }).catch(() => {})
const filled = await manualRows()
want(filled.map((r) => r[1]), MG1.map((r) => r[1]), 'M-4: Fill copies each term\'s Calculated into its input')
want(filled.map((r) => r[3]), Array(10).fill('0.0%'), 'M-4: and every Difference then reads 0.0%')
want(filled.map((r) => r[8]).every((c) => c !== '' && !c.includes('Enter')), true, 'C9: the filled values carry commas and every one is accepted as a price')
check(await present('tp-manual-chips'), 'chips show once prices are entered')

// ── M-4: Clear ──
await page.click(tid('tp-manual-clear'))
await page.waitForFunction(() => document.querySelector('#view-term-pricing [data-testid="tp-manual-price-12"]')?.value === '', { timeout: 6000 }).catch(() => {})
want((await manualRows()).map((r) => r[1]), Array(10).fill(''), 'M-4: Clear empties every input')
check(!(await present('tp-manual-chips')), 'C11: and the chips go')

// ── M-2, C5: leaving Term Pricing clears the prices, and nothing else ──
await typeAll(MG1_TYPED)
await type('tp-units-safesight', '5')
await page.evaluate(() => window.navigate('leads'))
await page.waitForFunction(() => document.getElementById('view-term-pricing').classList.contains('hidden'), { timeout: 6000 })
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => !document.getElementById('view-term-pricing').classList.contains('hidden')
  && document.querySelector('#view-term-pricing [data-testid="tp-manual"]'), { timeout: 15000 })
await settle()
want((await manualRows()).map((r) => r[1]), Array(10).fill(''), 'M-2, C5: a return to Term Pricing finds every price cleared')
want(await value('tp-units-safesight'), '5', 'C5: nothing else changes (the units survive the return, as before)')
check(!(await present('tp-manual-chips')), 'C11: and no chips')

// ── M-2: comparison only ──
want(writes, [], 'M-2: the card sent no write request in any of the above')

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`} (manual)`)
process.exitCode = failures === 0 ? 0 : 1
