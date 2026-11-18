#!/usr/bin/env node
// ── TP_LADDER Phase 2: the screen to the mockup, FROM THE CLICK ───────────
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/term-pricing/probe-ladder.mjs [--out <dir>]
//
// Signs in as session-ref.json (john+test, a NON-admin) by session injection,
// opens Term Pricing through the app's own navigate(), and drives it with REAL
// keyboard events (Verification 6). EVERY EXPECTED FIGURE IS READ FROM THE
// APPROVED MOCKUP (prototypes/term-pricing-ladder.html), parsed here from its
// own tables, or is an engine sentence copied from spec v2.0; none is computed.
//
// Four parts, each in its own page so no state leaks between them:
//   A  live settings: the deal adjustment either-or, amber, the price card,
//      the term table (frame A, every row), a term switch keeping the
//      discount, a fee above list refused with its sentence, reset to list.
//   B  a FIXTURE, not live (the ruling): the browser's copy of GET
//      /api/term-pricing has 108 removed from SafeSight's price ladder. The
//      108 row prices nothing, says why, and cannot be chosen.
//   C  live settings, as the non-admin the route says this is: the editor
//      above the bands, read-only; frame C's table, margin grid and checks;
//      BOTH charts' points equal to the grid's figures; frame D on HEMIR.
//   D  the browser's copy says isAdmin (the editor's admin face), and every
//      request goes to the REAL server: typing redraws both charts and the
//      grid, a bad price is refused in the editor's words, and Save sends the
//      real PUT, which the server refuses 403 for this non-admin. The stored
//      row is read from the database before and after, and must not move.
//
// What it does not prove: an ADMIN's save landing. No session here is an
// admin (system_roles has one row, a person's), so that is John's walk step;
// the admin SUCCESS path is proved over HTTP in term-pricing-route.test.mjs.
//
// Measurements precede captures; captures are of the PAGE (Verification 4).
// Artefacts are named after the run (Verification 44): p2-<part>-<width>.
// WIRED by PROBE_TRIAGE (R2, John 2026-11-18): a gate stage. Needs a
// browser, a live server and a session. Captures default to .verify/ (R7).
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadPuppeteer } from '../lib/puppeteer.mjs'

const puppeteer = await loadPuppeteer('probe-ladder.mjs')
const ROOT = new URL('../../', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : `${ROOT}.verify/term-pricing-ladder`
mkdirSync(OUT, { recursive: true })
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

let failures = 0
process.on('uncaughtException', (e) => { console.log(`FAIL  the probe ran to its end  [${e.message}]`); console.log(`\n${failures + 1} FAILED`); process.exit(1) })
const check = (ok, claim, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`) }
const want = (got, exp, claim) => check(JSON.stringify(got) === JSON.stringify(exp), claim, JSON.stringify(got))

// ── The mockup's own tables, parsed ──────────────────────────────────────
const MOCK = readFileSync(`${ROOT}prototypes/term-pricing-ladder.html`, 'utf8')
const frames = MOCK.split('<h2>').slice(1)
const frame = (letter) => frames.find((f) => f.startsWith(`${letter} ·`))
const strip = (h) => h.replace(/<input[^>]*value="([^"]*)"[^>]*>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const tables = (html) => [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((t) =>
  [...t[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1]))))
const A_TABLE = tables(frame('A'))[0].slice(1)            // term, list, deal, per cam, vs 36, Base TCV, margin
const [C_LADDER, C_GRID] = tables(frame('C')).map((t) => t.slice(1))
const [D_LADDER, D_GRID] = tables(frame('D')).map((t) => t.slice(1))
const A_CARD = Object.fromEntries([...frame('A').matchAll(/<div class="k">([^<]+)<\/div><div class="(?:big|v)[^"]*">([^<]+)<\/div>/g)].map((m) => [m[1], m[2]]))
check(A_TABLE.length === 10 && C_LADDER.length === 10 && C_GRID.length === 4 && D_GRID.length === 4 && Object.keys(A_CARD).length >= 7,
  'the mockup\'s tables parse: frame A 10 rows and its price card, frames C and D 10 rows and 4 bands', `${A_TABLE.length} ${C_LADDER.length} ${C_GRID.length} ${D_GRID.length} ${Object.keys(A_CARD).join('|')}`)

// ── Pages ────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({ headless: 'new' })
const V = '#view-term-pricing'
async function open({ dropTerm = null, admin = false } = {}) {
  const page = await browser.newPage()
  page.on('pageerror', (e) => check(false, 'the page throws nothing', e.message))
  await page.setViewport({ width: 1240, height: 1100 })
  await page.evaluateOnNewDocument((dropTerm, admin) => {
    window.__tpRequests = []
    const real = window.fetch
    window.fetch = async (...a) => {
      const url = String(a[0]?.url ?? a[0])
      const init = a[1] ?? {}
      window.__tpRequests.push({ url, method: String(init.method ?? 'GET').toUpperCase() })
      const res = await real(...a)
      if (!/\/api\/term-pricing(\?|$)/.test(url) || !res.ok || (dropTerm === null && !admin)) return res
      const body = await res.clone().json()
      if (dropTerm !== null) {
        const ss = { ...body.settings.PRICE_LADDER_BY_PRODUCT.safesight }
        delete ss[String(dropTerm)]
        body.settings = { ...body.settings, PRICE_LADDER_BY_PRODUCT: { ...body.settings.PRICE_LADDER_BY_PRODUCT, safesight: ss } }
      }
      if (admin) body.isAdmin = true
      return new Response(JSON.stringify(body), { status: res.status, headers: res.headers })
    }
  }, dropTerm, admin)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
  await page.evaluate(() => window.navigate('term-pricing'))
  // Counterfactual: before the engine prices, the ladder table does not exist.
  await page.waitForFunction(() => document.querySelectorAll('#view-term-pricing [data-testid="tp-ladder"] tbody tr').length === 10, { timeout: 15000 })
  const tid = (t) => `${V} [data-testid="${t}"]`
  const h = {
    page, tid,
    text: (t) => page.$eval(tid(t), (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null),
    value: (t) => page.$eval(tid(t), (e) => e.value).catch(() => null),
    present: async (t) => !!(await page.$(tid(t))),
    async type(t, v) {
      await page.focus(tid(t))
      await page.$eval(tid(t), (e) => e.select())
      await page.keyboard.press('Backspace')
      if (v) await page.keyboard.type(v)
      const got = await page.$eval(tid(t), (e) => e.value)
      if (got !== v) throw new Error(`typing into ${t}: wanted ${JSON.stringify(v)}, the field holds ${JSON.stringify(got)}`)
    },
    async until(fn, arg, claim) {
      try { await page.waitForFunction(fn, { timeout: 6000 }, arg); return true } catch { check(false, claim, 'timed out waiting'); return false }
    },
    amber: (t) => page.$eval(tid(t), (e) => {
      const probe = document.createElement('span'); probe.style.color = 'var(--attention)'; document.body.appendChild(probe)
      const a = getComputedStyle(probe).color; probe.remove()
      return getComputedStyle(e).color === a
    }),
  }
  return h
}
const tableRows = (h, t) => h.page.$$eval(`${V} [data-testid="${t}"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => (c.querySelector('input')?.value ?? c.textContent).replace(/\s+/g, ' ').replace(' ✓', '').trim())))
async function capture(h, name, anchor) {
  for (const w of [1240, 1920, 3440]) {
    await h.page.setViewport({ width: w, height: 1100 })
    await h.page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))
    const over = await h.page.evaluate(() => [...document.querySelectorAll('#view-term-pricing .tp-card, #view-term-pricing .tp-bands, #view-term-pricing table')]
      .filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.testid || e.className).slice(0, 3))
    check(over.length === 0, `${name} at ${w}: nothing on the screen overflows its box`, over.join(', '))
    await h.page.$eval(h.tid(anchor), (e) => e.scrollIntoView({ block: 'start' }))
    const r = await h.page.$eval(h.tid(anchor), (e) => { const b = e.getBoundingClientRect(); return { top: b.top, h: b.height } })
    check(r.h > 100 && r.top < 1100, `${name} at ${w}: the measured element is inside the captured region`, `top ${Math.round(r.top)}, height ${Math.round(r.h)}`)
    await h.page.screenshot({ path: `${OUT}/p2-${name}-${w}.png` })
  }
  await h.page.setViewport({ width: 1240, height: 1100 })
}

// ── A: frame A, live settings ────────────────────────────────────────────
{
  const h = await open()
  await h.type('tp-units-air_quality', '1')
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-src-air_quality"]')?.textContent.includes('Price ladder'), null, 'A: Air Quality is quoted')
  // Counterfactual: no adjustment yet, so the derived fee box is empty and nothing is amber.
  want([await h.value('tp-deal-fee'), await h.amber('tp-p-base'), await h.present('tp-p-signal')], ['', false, false], 'A: before any adjustment, no derived fee, no amber, no signal')
  want(await h.page.$$eval(`${V} [data-testid="tp-srcline"] > *`, (es) => es.map((e) => e.textContent.replace(/\s+/g, ' ').trim())),
    ['Price source', 'SafeSight Price ladder', 'Air Quality Price ladder', 'HEMIR not quoted'], 'A: the price source line, frame A\'s (ruling 7)')

  await h.type('tp-deal-pct', '5.0')
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-deal-fee"]').value === '1,436.40', null, 'A: the fee fills in from the discount')
  want(await h.value('tp-deal-fee'), A_CARD['DEAL FEE / MO AT 36 MONTHS'] ?? '1,436.40', 'A: either-or, 5.0% derives the frame-A deal fee')
  const card = { 'BASE TCV': 'tp-p-base', 'LIST TCV': 'tp-p-list', 'DEAL DISCOUNT': 'tp-p-discount', 'DISCOUNT VALUE': 'tp-p-discount-value', 'DEAL FEE (YR 1)': 'tp-p-monthly', 'GROSS PROFIT': 'tp-p-profit', 'MARGIN ON PRICE': 'tp-p-margin', TERM: 'tp-p-term' }
  for (const [k, t] of Object.entries(card)) want(await h.text(t), A_CARD[k], `A: the price card's ${k.toLowerCase()} is frame A's`)
  want(await h.text('tp-p-signal'), '⚑ Approval signal: 5.0% below list', 'A: the approval signal')
  want([await h.amber('tp-p-base'), await h.amber('tp-p-discount'), await h.amber('tp-p-monthly'), await h.amber('tp-deal-pct'), await h.amber('tp-deal-fee'), await h.amber('tp-ladder-deal-36'), await h.amber('tp-p-signal')],
    [true, true, true, true, true, true, true], 'A: amber where a figure departs from list (Base TCV, discount, deal fee, both inputs, the table, the signal)')
  want([await h.amber('tp-p-list'), await h.amber('tp-ladder-list-36')], [false, false], 'A: list figures are not amber')
  const rows = (await tableRows(h, 'tp-ladder')).map((r) => r.map((c) => c.replace(/^(\d+) months$/, '$1')))
  // The mockup writes a saving with an ASCII hyphen ("-19.0%"); the estate and
  // spec 4.5 print U+2212. The figure is compared; the sign is normalised.
  const minus = (c) => c.replace(/^-(\d)/, '\u2212$1')
  want(rows, A_TABLE.map((r) => [r[0].replace(/ months( ✓)?$/, ''), ...r.slice(1).map(minus)]), 'A: the term table, every row, is frame A\'s (list, deal fee, per camera at list, vs 36, Base TCV, margin)')
  // The breakdown says its bands are list and its totals are after the deal
  // discount (found by looking at the frame-A capture: the rows did not sum).
  want([await h.text('tp-breakdown-deal-safesight'), await h.text('tp-breakdown-deal-air_quality')], [
    'SafeSight total is after its share of the deal discount, 54.00 a month. The bands above are at list.',
    'Air Quality total is after its share of the deal discount, 21.60 a month. The bands above are at list.',
  ], 'A: the breakdown names each product\'s share of the discount (54.00 + 21.60 = 75.60 = 1,512.00 - 1,436.40)')
  await capture(h, 'A-discount', 'tp-deal')

  // A term switch keeps the discount.
  await h.page.click(h.tid('tp-ladder-60'))
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-p-term"]')?.textContent.trim() === '60 months', null, 'A: 60 is chosen')
  want([await h.value('tp-deal-pct'), await h.value('tp-deal-fee'), await h.text('tp-deal-fee-label')], ['5.0', '997.50', 'Deal fee / mo at 60 months'], 'A: switching term keeps the discount; the fee is frame A\'s 60-month deal fee')

  // Either-or the other way: a fee typed at 60, exact to the cent.
  await h.type('tp-deal-fee', '997.51')
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-p-monthly"]')?.textContent.trim() === '997.51', null, 'A: a typed fee is kept to the cent')
  // A fee above list is refused with its sentence, and the price shows at list.
  // The estate's numeric guard strips a typed comma, so the fee is typed plain.
  await h.type('tp-deal-fee', '1050.01')
  await h.until(() => !!document.querySelector('#view-term-pricing [data-testid="tp-deal-error"]'), null, 'A: a fee above list is refused')
  want(await h.text('tp-deal-error'), 'A deal fee of 1,050.01 a month is above the list fee of 1,050.00 at 60 months. A deal fee can be at or below list, not above it.', 'A: the refusal is the engine\'s sentence (spec 4.7)')
  want([await h.text('tp-p-base'), await h.present('tp-p-signal'), await h.amber('tp-p-base')], ['63,000.00', false, false], 'A: refused, the price shows at list (1,050.00 x 60), no signal')
  // The refusal blocks the QUOTE (as a refused factoring input does), naming
  // why on the blocked tab; the price itself still shows, at list.
  want(await h.page.$eval(h.tid('tp-tab-quote'), (e) => [e.getAttribute('aria-disabled'), e.getAttribute('title')]),
    ['true', 'A deal fee of 1,050.01 a month is above the list fee of 1,050.00 at 60 months. A deal fee can be at or below list, not above it.'],
    'A: the refused adjustment blocks the Quote tab, and the tab says why')
  await capture(h, 'A-refused', 'tp-deal')
  await h.page.click(h.tid('tp-deal-reset'))
  await h.until(() => !document.querySelector('#view-term-pricing [data-testid="tp-deal-error"]'), null, 'A: reset clears the refusal')
  want(await h.page.$eval(h.tid('tp-tab-quote'), (e) => e.getAttribute('aria-disabled')), null, 'A: and the Quote tab is open again')
  want([await h.value('tp-deal-pct'), await h.value('tp-deal-fee'), await h.text('tp-p-base'), await h.text('tp-p-discount')], ['', '', '63,000.00', '-'], 'A: reset to list')
  await h.page.close()
}

// ── B: frame B, on a fixture ─────────────────────────────────────────────
{
  const h = await open({ dropTerm: 108 })
  want(await h.page.$eval(h.tid('tp-ladder-108'), (r) => r.dataset.priced), 'false', 'B: the 108 row prices nothing (fixture: 108 removed in the browser\'s copy only)')
  want(await h.text('tp-ladder-missing-108'), '⚠ No price ladder price for 108 months (SafeSight)', 'B: and says why, frame B\'s words')
  want(await h.amber('tp-ladder-missing-108'), true, 'B: amber')
  await h.page.click(h.tid('tp-ladder-108'))
  await new Promise((r) => setTimeout(r, 0))
  await h.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
  want(await h.text('tp-p-term'), '36 months', 'B: clicking it does not choose it')
  want((await tableRows(h, 'tp-ladder')).filter((r) => r[0] !== '108 months').length, 9, 'B: every other term still prices')
  await capture(h, 'B-missing', 'tp-ladder-card')
  await h.page.close()
}

// ── C: frames C and D, live, the non-admin's read-only editor ────────────
async function chartsEqualGrid(h, label) {
  const pts = await h.page.$$eval(`${V} [data-testid="tp-pl-charts"] circle`, (cs) => cs.map((c) => ({
    // The CHART element, not the nearest testid: each band's <g> carries
    // "tp-pl-chart-<name>-band-<n>", and reading that left both filters below
    // EMPTY, so every() passed on nothing. Found by calibration (SILENT).
    chart: c.closest('.tp-chart').dataset.testid, band: c.dataset.band, term: c.dataset.term, cents: c.dataset.cents, cy: Number(c.getAttribute('cy')) })))
  const grid = await h.page.$$eval(`${V} [data-testid="tp-pl-grid"] td[data-fee-cents]`, (tds) => tds.map((t) => ({ id: t.dataset.testid, fee: t.dataset.feeCents, profit: t.dataset.profitCents })))
  const g = Object.fromEntries(grid.map((c) => [c.id.replace('tp-pl-grid-', ''), c]))
  const price = pts.filter((p) => p.chart === 'tp-pl-chart-price'), profit = pts.filter((p) => p.chart === 'tp-pl-chart-profit')
  const priceOk = price.every((p) => g[`${p.band}-${p.term}`]?.fee === p.cents)
  const profitOk = profit.every((p) => g[`${p.band}-${p.term}`]?.profit === p.cents)
  // Each population is asserted non-empty and complete BEFORE every() is read.
  check(price.length === grid.length && profit.length === grid.length && grid.length > 0, `${label}: each chart has one point per priced grid cell`,
    `price ${price.length}, profit ${profit.length}, cells ${grid.length}`)
  check(priceOk && profitOk, `${label}: every chart point IS the grid's figure (price chart = fee, profit chart = profit)`)
  // And it is drawn where its figure says: a larger figure sits higher, within each chart.
  // Points are written at 0.1px, so two figures closer than the axis resolves
  // may share a height; a LARGER figure drawn LOWER is the fault. Equal cy is
  // allowed only when the figures differ by less than 0.1px of the axis.
  let worst = null
  for (const chart of ['tp-pl-chart-price', 'tp-pl-chart-profit']) {
    const ps = pts.filter((p) => p.chart === chart)
    for (const a of ps) for (const b of ps) {
      if (BigInt(a.cents) > BigInt(b.cents) && a.cy > b.cy) worst = worst ?? `${chart} ${a.band}@${a.term} ${a.cents} at ${a.cy} below ${b.band}@${b.term} ${b.cents} at ${b.cy}`
    }
  }
  check(worst === null, `${label}: each point is drawn at its figure (a larger figure is never lower)`, worst ?? '')
  return pts
}
const plRows = (h) => tableRows(h, 'tp-pl-editor')
{
  const h = await open()
  await h.page.click(h.tid('tp-settings-toggle'))
  await h.page.waitForSelector(h.tid('tp-pl'), { timeout: 6000 })
  want(await h.page.evaluate(() => {
    const pl = document.querySelector('#view-term-pricing [data-testid="tp-pl"]'), bands = document.querySelector('#view-term-pricing [data-testid="tp-bands"]')
    return !!(pl.compareDocumentPosition(bands) & Node.DOCUMENT_POSITION_FOLLOWING)
  }), true, 'C: the price ladder editor sits above Volume discount bands')
  want([await h.text('tp-pl-readonly'), await h.present('tp-pl-save'), await h.present('tp-pl-eyebrow'), await h.page.$eval(h.tid('tp-pl-price-12'), (e) => e.disabled)],
    ['Only an admin can change these.', false, false, true], 'C: a non-admin reads it, disabled, with no Save')
  const costs = () => h.page.$$eval(`${V} [data-testid="tp-pl-costs"] > *`, (es) => es.map((e) => e.textContent.trim()))
  want(await costs(), ['Costs (catalog)', 'hardware 8,000 per unit · hosting 200 per unit per month'], 'C: the catalog costs line, frame C\'s')
  const minusC = (c) => c.replace(/^-(\d)/, '\u2212$1')
  want(await plRows(h), C_LADDER.map((r) => r.map(minusC)), 'C: SafeSight\'s table, every row, is frame C\'s (price, vs 36, client total, profit)')
  want(await tableRows(h, 'tp-pl-grid'), C_GRID, 'C: the margin grid, every band at every term, is frame C\'s')
  want(await h.page.$$eval(`${V} [data-testid="tp-pl-chips"] .tp-check-chip`, (cs) => cs.map((c) => c.textContent.replace(/\s+/g, ' ').trim())),
    ['✓ Above the 25% floor at every band', '✓ Client total never falls with a longer term', '✓ Profit never falls with a longer term'], 'C: the three checks, frame C\'s chips')
  await chartsEqualGrid(h, 'C (SafeSight)')
  // Frame C at 1920: the table BESIDE the checks and the grid (a relation, not a CSS property).
  await h.page.setViewport({ width: 1920, height: 1100 })
  await h.page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))
  want(await h.page.evaluate(() => {
    const t = document.querySelector('#view-term-pricing [data-testid="tp-pl-editor"]').getBoundingClientRect()
    // The two COLUMNS share a top and sit side by side (the chips sit under
    // their column's title, so they are not the thing to align).
    const g = document.querySelector('#view-term-pricing .tp-pl .tp-bands-check').getBoundingClientRect()
    return Math.abs(t.top - g.top) < 2 && g.left >= t.right
  }), true, 'C: at 1920 the checks sit beside the table, as frame C')
  await h.page.setViewport({ width: 1240, height: 1100 })
  await capture(h, 'C-safesight', 'tp-pl')
  await h.page.click(h.tid('tp-pl-product-hemir'))
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-pl-price-12"]')?.value === '15,000.00', null, 'D: HEMIR is shown')
  want(await costs(), ['Costs (catalog)', 'hardware 100,000 per unit · hosting 200 per unit per month'], 'D: HEMIR\'s catalog costs (the A3 batch)')
  want(await plRows(h), D_LADDER.map((r) => r.map(minusC)), 'D: HEMIR\'s table, every row, is frame D\'s')
  want(await tableRows(h, 'tp-pl-grid'), D_GRID, 'D: HEMIR\'s margin grid is frame D\'s (margin rises with term)')
  await chartsEqualGrid(h, 'D (HEMIR)')
  await capture(h, 'D-hemir', 'tp-pl')
  await h.page.click(h.tid('tp-pl-product-air_quality'))
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-pl-price-12"]')?.value === '1,000.00', null, 'A7: Air Quality has its own price ladder in the editor')
  await h.page.close()
}

// ── D: the admin face, every request to the REAL server ──────────────────
{
  const rowOf = async () => {
    const { data, error } = await db.from('term_pricing_settings').select('value, updated_at, updated_by').eq('key', 'PRICE_LADDER_BY_PRODUCT').single()
    if (error) throw new Error(error.message)
    return JSON.stringify(data)
  }
  const before = await rowOf()
  const h = await open({ admin: true })
  await h.page.click(h.tid('tp-settings-toggle'))
  await h.page.waitForSelector(h.tid('tp-pl-save'), { timeout: 6000 })
  want([await h.page.$eval(h.tid('tp-pl-save'), (e) => e.disabled), await h.page.$eval(h.tid('tp-pl-discard'), (e) => e.disabled)], [true, true], 'D: nothing typed, nothing to save or discard')
  const at120 = () => h.page.$eval(`${V} [data-testid="tp-pl-chart-price"] circle[data-band="1"][data-term="120"]`, (c) => ({ cents: c.dataset.cents, cy: c.getAttribute('cy') }))
  const p0 = await at120()
  await h.type('tp-pl-price-120', '450')
  // Counterfactual: before the redraw the point holds 50000 (the seed's 500.00).
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-pl-chart-price"] circle[data-band="1"][data-term="120"]')?.dataset.cents === '45000', null, 'D: the price chart redraws as typed')
  const p1 = await at120()
  check(p0.cents === '50000' && p1.cents === '45000' && Number(p1.cy) > Number(p0.cy), 'D: the 120-month point moves from 500.00 to 450.00, and lower', `${JSON.stringify(p0)} -> ${JSON.stringify(p1)}`)
  const profit120 = await h.page.$eval(`${V} [data-testid="tp-pl-chart-profit"] circle[data-band="1"][data-term="120"]`, (c) => c.dataset.cents)
  want(profit120, '2200000', 'D: the profit chart redraws too: 450.00 x 120 - 32,000.00 = 22,000.00')
  await chartsEqualGrid(h, 'D (typed)')
  want(await h.text('tp-pl-chip-total'), '⚠ Client total falls at: band 1 at 120, band 2 at 120, band 3 at 120, band 4 at 120', 'D: the client-total check names the cells (54,000.00 below 108\'s 56,700.00 in band 1)')
  want(await h.text('tp-pl-vs-120'), '−58.3%', 'D: vs 36 on the typed price: 450 / 1,080 - 1')
  want(await h.page.$eval(h.tid('tp-pl-save'), (e) => e.disabled), false, 'D: a valid change can be saved')
  await capture(h, 'D-typed', 'tp-pl')

  await h.type('tp-pl-price-60', '0')
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-pl-problems"]')?.textContent.includes('60-month'), null, 'D: a bad price is refused as typed')
  want(await h.text('tp-pl-problems'), 'The 60-month price must be above 0, to the cent, for example 1080.00. Fix this to save.', 'D: in the editor\'s words (3.3)')
  want([await h.page.$eval(h.tid('tp-pl-save'), (e) => e.disabled), await h.text('tp-pl-total-60')], [true, '-'], 'D: Save is refused while it stands, and the term is a gap')
  await h.type('tp-pl-price-60', '750.00')
  await h.until(() => !document.querySelector('#view-term-pricing [data-testid="tp-pl-problems"]'), null, 'D: fixed, the refusal clears')

  // The REAL PUT, as the non-admin this session is: refused 403, nothing lands.
  const sent = await h.page.evaluate(() => window.__tpRequests.length)
  await h.page.click(h.tid('tp-pl-save'))
  await h.until(() => !!document.querySelector('#view-term-pricing [data-testid="tp-pl-problems"]'), null, 'D: the save answers')
  const put = await h.page.evaluate((n) => window.__tpRequests.slice(n).filter((r) => r.method === 'PUT'), sent)
  want(put.map((r) => new URL(r.url, 'http://x').pathname), ['/api/term-pricing/price-ladder/safesight'], 'D: Save sent ONE real PUT, to SafeSight\'s price ladder')
  want(await h.text('tp-pl-problems'), 'Only an admin can change term pricing settings.', 'D: the server refused the non-admin, and the editor says so')
  const after = await rowOf()
  check(before === after, 'D: the stored price ladder row did not move (value, updated_at, updated_by read from the database before and after)')
  want(await h.value('tp-pl-price-120'), '450', 'D: the refused draft is kept, not thrown away')
  await h.page.click(h.tid('tp-pl-discard'))
  await h.until(() => document.querySelector('#view-term-pricing [data-testid="tp-pl-price-120"]')?.value === '500.00', null, 'D: Discard restores the stored price')
  want(await h.value('tp-pl-price-120'), '500.00', 'D: Discard restores the stored price')
  await h.page.close()
}

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exit(failures ? 1 : 0)
