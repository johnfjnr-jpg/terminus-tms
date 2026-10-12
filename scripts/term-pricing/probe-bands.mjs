#!/usr/bin/env node
// ── TP_BANDS: the band editor, from the click ────────────────────────────
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/probe-bands.mjs [--admin] [--out <dir>]
//
// Signs in as session-ref.json (john+test, a NON-admin) by session injection,
// opens Term Pricing through the app's own navigate(), expands Settings, and
// drives the band editor with REAL keyboard events (Verification 6). Every
// expected figure and sentence is COPIED from spec v1.8 (3.1, 3.2, 10.2, 10.3,
// 10.4, 11.4) or the approved mockup, never computed here.
//
// Modes:
//   (default)  the NON-ADMIN view, as the route answers it: read-only, no
//              eyebrow, "Only an admin can change these.", every product
//              readable, the grid and the fee table on the seed (10.2, 10.3).
//              Then, over HTTP as the same user, the bands save is refused 403
//              and the stored row's fingerprint does not move.
//   --admin    RULING 0.1 (b): isAdmin is passed IN TEST, in the browser's copy
//              of the real GET, and the bands PUT is answered in the browser,
//              never sent: the probe proves the editor up to the request it
//              sends. Mockup 4a (six bands, BG-3, a floor breach and its
//              warning, Save enabled), mockup 4b (the overlap, "?", the
//              refusal sentence, Save disabled, both "Fix" states), drafts
//              surviving a switch of product and of tab, Discard, the limits
//              at 2 and 6, and a quote priced on the configured bands (BG-1).
//              A real admin save is NOT driven from the click (ruling 0.1):
//              that is John's walk step.
//
// In both modes the spec's 90% margins are passed IN TEST (the live rows hold
// 90 today, so this changes nothing unless an admin changes them), and in
// --admin MARGIN_FLOOR is passed at 73%, named where it is used, so 4a's single
// breach is reachable on spec settings.
//
// Artefacts are named after the run (Verification 44): bands-<mode>-<width>.
//
// UNWIRED: needs a browser, a live server and a session.

import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { api } from '../api-client.mjs'
const puppeteer = await loadPuppeteer('probe-bands.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'
const ADMIN = process.argv.includes('--admin')
const MODE = ADMIN ? 'admin' : 'reader'
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : `${ROOT}prototypes/term-pricing-bands/built`
const SPEC_MARGINS = { safesight: '90', air_quality: '90', hemir: '90' }
const FLOOR_IN_TEST = '73'
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (ok, claim, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`)
}
const want = (got, exp, claim) => check(JSON.stringify(got) === JSON.stringify(exp), claim, JSON.stringify(got))

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
page.on('pageerror', (e) => check(false, 'the page throws nothing', e.message))
await page.setViewport({ width: 1240, height: 1100 })

// The browser's copy of GET /api/term-pricing gets the in-test settings; under
// --admin a bands PUT is recorded and answered here, as the route answers it
// (the state after the write), and later GETs carry what it "saved".
await page.evaluateOnNewDocument((admin, margins, floor) => {
  const rec = { saves: [], bands: {} }
  window.__tpBands = rec
  const real = window.fetch
  const shape = (body) => ({
    ...body,
    isAdmin: admin ? true : body.isAdmin,
    settings: {
      ...body.settings, ANCHOR_MARGIN: margins, SHORT_TERM_MARGIN: margins,
      ...(admin ? { MARGIN_FLOOR: floor } : {}),
      VOLUME_BANDS_BY_PRODUCT: { ...body.settings.VOLUME_BANDS_BY_PRODUCT, ...rec.bands },
    },
  })
  window.fetch = async (...a) => {
    const url = String(a[0]?.url ?? a[0])
    const init = a[1] ?? {}
    const method = String(init.method ?? 'GET').toUpperCase()
    if (admin && method === 'PUT' && /\/api\/term-pricing\/bands\//.test(url)) {
      const body = JSON.parse(init.body)
      const product = decodeURIComponent(url.split('/').pop())
      rec.saves.push({ url, method, product, body })
      rec.bands[product] = body.bands.map((b) => ({ from: Number(b.from), discountPct: b.discountPct }))
      const got = await real('/api/term-pricing', { headers: init.headers })
      return new Response(JSON.stringify(shape(await got.json())), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const res = await real(...a)
    if (!/\/api\/term-pricing(\?|$)/.test(url) || !res.ok) return res
    return new Response(JSON.stringify(shape(await res.clone().json())), { status: res.status, headers: res.headers })
  }
}, ADMIN, SPEC_MARGINS, FLOOR_IN_TEST)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('#view-term-pricing [data-testid="tp-ladder"]'), { timeout: 15000 })

const V = '#view-term-pricing'
const tid = (t) => `${V} [data-testid="${t}"]`
const text = (t) => page.$eval(tid(t), (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null)
const present = async (t) => !!(await page.$(tid(t)))
const rows = (t) => page.$$eval(`${V} [data-testid="${t}"] tbody tr`, (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent.trim())))
const head = (t) => page.$$eval(`${V} [data-testid="${t}"] thead th`, (h) => h.map((x) => x.textContent.trim()))
async function type(t, value) {
  await page.focus(tid(t))
  await page.$eval(tid(t), (e) => e.select())
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
  const got = await page.$eval(tid(t), (e) => e.value)
  if (got !== value) throw new Error(`typing into ${t}: wanted ${JSON.stringify(value)}, the field holds ${JSON.stringify(got)}`)
}
async function until(fn, arg, claim) {
  try { await page.waitForFunction(fn, { timeout: 6000 }, arg); return true }
  catch { check(false, claim, 'timed out waiting'); return false }
}
const editorRows = () => page.$$eval(`${V} [data-testid="tp-bands-editor"] tbody tr`, (rs) => rs.map((r) => {
  const c = [...r.cells]
  const val = (td) => td.querySelector('input')?.value ?? td.textContent.trim()
  return [c[0].textContent.trim(), val(c[1]), c[2].textContent.trim(), val(c[3])]
}))
const disabled = (t) => page.$eval(tid(t), (e) => e.disabled).catch(() => null)
async function product(key, label) {
  await page.click(tid(`tp-bands-product-${key}`))
  await until((want) => document.querySelector('#view-term-pricing [data-testid="tp-bands-editor"] .tp-sec-title')?.textContent.trim() === want,
    `${label} bands`, `the editor shows ${label}`)
}
// Measure, then capture the PAGE, never the element (Verification 4's last clause).
async function capture(name) {
  await page.$eval(tid('tp-bands'), (e) => e.scrollIntoView({ block: 'start' }))
  const r = await page.$eval(tid('tp-bands'), (e) => { const b = e.getBoundingClientRect(); return { top: b.top, h: b.height } })
  check(r.h > 200 && r.top < 1100, `capture ${name}: the editor is inside the captured region`, `top ${Math.round(r.top)}, height ${Math.round(r.h)}`)
  await page.screenshot({ path: `${OUT}/bands-${MODE}-${name}.png` })
}
async function atWidths(name) {
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1100 })
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))
    const over = await page.evaluate(() => [...document.querySelectorAll('#view-term-pricing [data-testid="tp-bands"] table, #view-term-pricing [data-testid="tp-bands"]')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1).length)
    check(over === 0, `${name} at ${w}: nothing in the editor overflows its box`, String(over))
    await capture(`${name}-${w}`)
  }
  await page.setViewport({ width: 1240, height: 1100 })
}

// ── Open Settings ──
await page.click(tid('tp-settings-toggle'))
await page.waitForSelector(tid('tp-bands'), { timeout: 6000 })
check(!(await present('tp-set-BAND.0')), 'ruling 0.5: the Settings card\'s band discount boxes are retired')
check(!(await page.$eval(V, (v) => v.textContent.includes('How bands differ by product'))), 'ruling 0.4: the example card is not built')

if (!ADMIN) {
  // ── RULING 0.7: the non-admin view ──
  check(!(await present('tp-bands-eyebrow')), '0.7: no eyebrow for a non-admin')
  want(await text('tp-bands-readonly'), 'Only an admin can change these.', '0.7: the read-only sentence')
  for (const t of ['tp-bands-save', 'tp-bands-discard', 'tp-bands-add', 'tp-bed-remove-2'])
    check(!(await present(t)), `0.7: a non-admin has no ${t}`)
  const inputs = await page.$$eval(`${V} [data-testid="tp-bands-editor"] input`, (is) => is.map((i) => i.disabled))
  // Four bands: three starts (band 1's is fixed text) and four discounts.
  check(inputs.length === 3 + 4 && inputs.every(Boolean), '0.7: every band input is shown and disabled', JSON.stringify(inputs))
  // 3.1, the seed, as everyone reads it.
  want(await editorRows(), [['1', '1', '9', '0.0'], ['2', '10', '49', '5.0'], ['3', '50', '199', '10.0'], ['4', '200', 'and above', '15.0']],
    'TB-1, 3.1: SafeSight reads the seed bands, To derived')
  // 10.3, copied: the 0% and 15% columns at 36, 60, 84 and 120.
  const g = await rows('tp-bands-grid')
  const at = (r, T) => g[r][1 + [12, 24, 36, 48, 60, 72, 84, 96, 108, 120].indexOf(T)]
  want([36, 60, 84, 120].map((T) => at(0, T)), ['90.0', '87.2', '84.7', '81.0'], '10.4 = 10.3: band 1 (0%) worst-case margins')
  want([36, 60, 84, 120].map((T) => at(3, T)), ['88.2', '85.0', '81.9', '77.7'], '10.4 = 10.3: band 4 (15%) worst-case margins')
  want(await head('tp-bands-grid'), ['Band', '12', '24', '36', '48', '60', '72', '84', '96', '108', '120'], 'TB-7: every term in TERMS')
  // 10.2, copied: every band at 36, 60, 84 and 120 (ruling 0.3).
  want(await rows('tp-bands-fee-table'), [
    ['1 · 0%', '4,222.22', '2,613.33', '1,923.81', '1,406.67'],
    ['2 · 5%', '4,011.11', '2,482.67', '1,827.62', '1,336.33'],
    ['3 · 10%', '3,800.00', '2,352.00', '1,731.43', '1,266.00'],
    ['4 · 15%', '3,588.89', '2,221.33', '1,635.24', '1,195.67'],
  ], '0.3, 10.2: the fee table shows every band')
  check(!(await present('tp-bands-warn')), '10.4: no warning at the 25% floor on the seed')
  want(await text('tp-bands-margin').then((t) => t?.match(/floor \d+%/)?.[0]), 'floor 25%', '10.4: the floor shown is MARGIN_FLOOR')
  // Every product is readable.
  await product('hemir', 'HEMIR')
  want((await editorRows()).map((r) => r[1]), ['1', '10', '50', '200'], 'TB-8: a non-admin reads HEMIR\'s bands')
  await product('air_quality', 'Air Quality')
  want((await editorRows()).map((r) => r[1]), ['1', '10', '50', '200'], 'TB-8: a non-admin reads Air Quality\'s bands')
  await product('safesight', 'SafeSight')
  await atWidths('readonly')

  // ── Over HTTP as the same user: refused, and nothing moved (Verification 40, 2xx is not a write) ──
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
  const fp = async () => {
    const { data, error } = await db.from('term_pricing_settings').select('value, updated_at').eq('key', 'VOLUME_BANDS_BY_PRODUCT').single()
    if (error) throw new Error(`fingerprint: ${error.message}`)
    return JSON.stringify(data)
  }
  const before = await fp()
  // The estate's throwing client: any status but the 403 stated here throws.
  const res = await api('PUT', '/term-pricing/bands/safesight', { bands: [{ from: 1, discountPct: '0' }, { from: 5, discountPct: '50' }] },
    { expect: 403, because: 'john+test has no system_roles admin row, so the bands save must refuse it (TB-8)' })
  check(res.data?.error === 'Only an admin can change term pricing settings.', 'TB-8: the bands save refuses a non-admin, over HTTP',
    `${res.status} ${res.data?.error}`)
  check(before.length > 10 && (await fp()) === before, 'TB-8: the stored bands row did not move')
  const get = (await api('GET', '/term-pricing')).data
  want([get.isAdmin, Object.keys(get.settings.VOLUME_BANDS_BY_PRODUCT ?? {}).sort()], [false, ['air_quality', 'hemir', 'safesight']],
    'TB-8: everyone reads; the route serves bands per product')
} else {
  // ── ADMIN, in test (ruling 0.1 b) ──
  want(await text('tp-bands-eyebrow'), 'Term Pricing · Settings · Admin edits', '0.7: the admin eyebrow')
  check(!(await present('tp-bands-readonly')), '0.7: no read-only sentence for an admin')
  check(await present('tp-settings-save'), '0.5: Save settings remains for every other key')
  check(await disabled('tp-bands-save') === true, 'Save bands is disabled with nothing changed')

  // ── Mockup 4a: SafeSight on six bands ──
  await page.click(tid('tp-bands-add'))
  await type('tp-bed-from-5', '500'); await type('tp-bed-disc-5', '20.0')
  await page.click(tid('tp-bands-add'))
  await type('tp-bed-from-6', '1000'); await type('tp-bed-disc-6', '30.0')
  want(await editorRows(), [['1', '1', '9', '0.0'], ['2', '10', '49', '5.0'], ['3', '50', '199', '10.0'],
    ['4', '200', '499', '15.0'], ['5', '500', '999', '20.0'], ['6', '1000', 'and above', '30.0']], '4a, TB-3: six bands, To derived as typed')
  want([await text('tp-bands-add'), await disabled('tp-bands-add')], ['+ Add band (6 of 6)', true], '4a, TB-2: Add is disabled at 6')
  // BG-3, copied: band 6 (30%) at 12, 36, 60 and 120.
  const g = await rows('tp-bands-grid')
  const at = (T) => g[5][1 + [12, 24, 36, 48, 60, 72, 84, 96, 108, 120].indexOf(T)]
  want([12, 36, 60, 120].map(at), ['85.7', '85.7', '81.8', '72.9'], 'BG-3: band 6 margins, from the click')
  want((await rows('tp-bands-fee-table')).map((r) => r[0]), ['1 · 0%', '2 · 5%', '3 · 10%', '4 · 15%', '5 · 20%', '6 · 30%'], '0.3: the fee table shows all six bands')
  // The 84-month fee for the 30% band is not printed in the spec; 36, 60 and 120 are (BG-3).
  const fee6 = (await rows('tp-bands-fee-table'))[5]
  want([fee6[1], fee6[2], fee6[4]], ['2,955.56', '1,829.33', '984.67'], 'BG-3: band 6 fees at 36, 60 and 120, from the click')
  // 10.4 at a 73% floor (passed in test): exactly one cell flagged, and the ruled warning.
  const flagged = await page.$$eval(`${V} [data-testid="tp-bands-grid"] td[data-below="true"]`, (ts) => ts.map((t) => t.dataset.testid))
  want(flagged, ['tp-bgrid-6-120'], '10.4: exactly one cell below the 73% floor')
  want(await text('tp-bands-warn'), '1 term breaches the 73% floor. Band 6 (1,000 units and above, 30%) at 120 months: fee 984.67, margin 72.9%. You can still save. A quote is flagged for approval only when its whole-deal margin falls below the floor.',
    '0.2: the warning, in the ruled wording')
  check(await disabled('tp-bands-save') === false, 'TB-7: a breach warns and does not block: Save bands is enabled')
  await atWidths('4a')

  // ── Save: the request the editor sends (ruling 0.1 b) ──
  await page.click(tid('tp-bands-save'))
  await until(() => document.querySelector('#view-term-pricing [data-testid="tp-bands-message"]'), null, 'the save reports')
  const saves = await page.evaluate(() => window.__tpBands.saves)
  want(saves.map((s) => [s.method, s.url.replace(/^https?:\/\/[^/]+/, '')]), [['PUT', '/api/term-pricing/bands/safesight']], '0.5: one PUT, for the shown product only')
  want(saves[0]?.body, { bands: [{ from: '1', discountPct: '0' }, { from: '10', discountPct: '5' }, { from: '50', discountPct: '10' },
    { from: '200', discountPct: '15' }, { from: '500', discountPct: '20' }, { from: '1000', discountPct: '30' }] }, '0.5: the request carries the six bands as typed, in the stored discount form')
  want(await text('tp-bands-message'), 'Saved. Every quote priced from now on uses these SafeSight bands.', 'the save is reported')
  check(await disabled('tp-bands-save') === true && await disabled('tp-bands-discard') === true, 'after the save the editor is clean')
  want((await editorRows()).length, 6, 'the six bands remain after the reload')

  // ── TB-9 and BG-1: a quote priced on the configured bands ──
  await type('tp-units-safesight', '1000')
  await page.click(tid('tp-ladder-60'))
  await until(() => document.querySelectorAll('#view-term-pricing [data-testid^="tp-band-safesight-"]').length === 6, null, 'the breakdown shows six SafeSight bands')
  const bd = await page.$$eval(`${V} [data-testid^="tp-band-safesight-"]`, (rs) => rs.map((r) => [r.cells[3].textContent.trim(), r.cells[4].textContent.trim()]))
  want(bd, [['9', '2,613.33'], ['40', '2,482.67'], ['150', '2,352.00'], ['300', '2,221.33'], ['500', '2,090.67'], ['1', '1,829.33']], 'BG-1, TB-9: units and fees per band, from the click')
  want([await text('tp-p-monthly'), await text('tp-p-base'), await text('tp-p-margin')], ['2,189,190.10', '131,351,406.00', '84.8%'], 'BG-1: monthly, Base TCV and margin')
  await page.click(tid('tp-tab-quote'))
  await page.waitForSelector(tid('tp-panel-quote'), { timeout: 6000 })
  check((await page.$eval(tid('tp-panel-quote'), (p) => p.textContent)).includes('131,351,406.00'), 'TB-9: the Quote tab carries the Base TCV priced on the configured bands')
  await page.click(tid('tp-tab-pricing'))
  await page.waitForSelector(tid('tp-bands'), { timeout: 6000 })

  // ── Mockup 4b: HEMIR, a rule broken while typing ──
  await product('hemir', 'HEMIR')
  await type('tp-bed-from-2', '2'); await type('tp-bed-from-3', '5'); await type('tp-bed-from-4', '4')
  want(await editorRows(), [['1', '1', '1', '0.0'], ['2', '2', '4', '5.0'], ['3', '5', '?', '10.0'], ['4', '4', 'and above', '15.0']], '4b: band 3\'s To is "?"')
  want(await page.$eval(tid('tp-bed-from-4'), (e) => e.getAttribute('aria-invalid')), 'true', '4b: band 4\'s start is marked invalid')
  want(await text('tp-bands-problems'), 'Band 4 must start above 5, where band 3 starts. Bands cannot overlap. Fix this to save.', '4b, TB-6: the refusal sentence, verbatim')
  check(await disabled('tp-bands-save') === true, '4b, TB-6: Save bands is disabled while a rule is broken')
  const fixOf = (t) => page.$eval(tid(t), (e) => [e.querySelector('.tp-sec-title')?.textContent.trim(), e.querySelector('.tp-bands-fix')?.textContent.trim(), !!e.querySelector('table')])
  want([await fixOf('tp-bands-margin'), await fixOf('tp-bands-fees')], [
    ['Margin check · worst case per band', 'Fix the band rules to see the margin check.', false],
    ['Fee per unit per month · HEMIR', 'Fix the band rules to see the margin check.', false]], '4b, 0.4: the grid and the fee table both show the Fix state, with no figures')
  check(!(await present('tp-bands-warn')) && !(await present('tp-bands-rules')), '4b: no warning and no rules list while invalid')
  want([await text('tp-bands-add'), await disabled('tp-bands-add')], ['+ Add band (4 of 6)', false], '4b: Add is enabled at 4')
  await atWidths('4b')

  // Drafts survive a switch of product and of tab (T-1).
  await product('safesight', 'SafeSight')
  await product('hemir', 'HEMIR')
  want((await editorRows()).map((r) => r[1]), ['1', '2', '5', '4'], 'T-1: HEMIR\'s draft survives a switch of product')
  await page.click(tid('tp-tab-payment')); await page.waitForSelector(tid('tp-panel-payment'))
  await page.click(tid('tp-tab-pricing')); await page.waitForSelector(tid('tp-bands'), { timeout: 6000 })
  await product('hemir', 'HEMIR')
  want((await editorRows()).map((r) => r[1]), ['1', '2', '5', '4'], 'T-1: and a switch of tab')

  // Fixed, the rule clears and BG-2's set prices its grid.
  await type('tp-bed-from-4', '10')
  await until(() => !document.querySelector('#view-term-pricing [data-testid="tp-bands-problems"]'), null, 'the refusal clears once fixed')
  want(await editorRows(), [['1', '1', '1', '0.0'], ['2', '2', '4', '5.0'], ['3', '5', '9', '10.0'], ['4', '10', 'and above', '15.0']], 'BG-2\'s bands, To derived')
  check(await disabled('tp-bands-save') === false && await present('tp-bands-grid'), 'fixed: Save is enabled and the grid returns')

  // Discard returns the shown product to what is stored.
  await page.click(tid('tp-bands-discard'))
  want((await editorRows()).map((r) => r[1]), ['1', '10', '50', '200'], 'Discard returns HEMIR to its stored bands')

  // The lower limit: at 2 bands every ✕ is disabled (TB-2).
  await page.click(tid('tp-bed-remove-4')); await page.click(tid('tp-bed-remove-3'))
  want((await editorRows()).length, 2, 'two ✕ clicks leave two bands')
  check(await disabled('tp-bed-remove-2') === true, 'TB-2: ✕ is disabled at 2 bands')
  await atWidths('2bands')
  await page.click(tid('tp-bands-discard'))

  // A refusal from the server is shown in the editor's own place. Answered in
  // the browser with the route's own 400 shape, as the route test proves it.
  await page.evaluate(() => {
    const real = window.fetch
    window.fetch = async (...a) => (String(a[1]?.method ?? '').toUpperCase() === 'PUT'
      ? new Response(JSON.stringify({ error: 'Band 2\'s discount must be below 100%. Fix this to save.', code: 'BAD_BANDS',
          problems: [{ band: 2, field: 'discountPct', message: 'Band 2\'s discount must be below 100%. Fix this to save.' }] }), { status: 400 })
      : real(...a))
  })
  await type('tp-bed-disc-2', '6.0')
  await page.click(tid('tp-bands-save'))
  await until(() => /below 100%/.test(document.querySelector('#view-term-pricing [data-testid="tp-bands-problems"]')?.textContent ?? ''), null, 'a server refusal is shown')
  want(await text('tp-bands-problems'), 'Band 2\'s discount must be below 100%. Fix this to save.', 'TB-6: the server\'s sentence is shown where the editor\'s would be')
}

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`} (${MODE})`)
process.exitCode = failures ? 1 : 0
