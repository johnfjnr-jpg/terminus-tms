#!/usr/bin/env node
// ── QUOTE_PANEL E3: the Quote panel, in the approved pictures' two states ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/photograph-quote.mjs
//
// The states John's pictures show (prototypes/term-pricing-quote/):
//   OPEX   120 SafeSight, 40 AQ, 2 HEMIR; 60 months; OPEX; GST 9; no WHT
//   CAPEX  the same units; 60 months; CAPEX; escalator 3% from year 2;
//          WHT 10% borne; GST 9
// Captures the Quote card at 1240 and 1920 into
// prototypes/term-pricing-quote/built/, beside the approved files. Measures
// nothing: probe-screen.mjs --qp and probe-overlap.mjs carry the claims.
//
// v1.3's ten-term TERMS is written into the browser's copy of the GET
// response, as on the other Term Pricing probes; the live setting is John's.
//
// UNWIRED: needs a browser, a live server and a session.
import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('photograph-quote.mjs')
const ROOT = new URL('../../', import.meta.url).pathname
const OUT = `${ROOT}prototypes/term-pricing-quote/built`
mkdirSync(OUT, { recursive: true })
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1240, height: 1100 })
await page.evaluateOnNewDocument(() => {
  const real = window.fetch
  window.fetch = async (...a) => {
    const res = await real(...a)
    if (!/\/api\/term-pricing(\?|$)/.test(String(a[0]?.url ?? a[0])) || !res.ok) return res
    const body = await res.clone().json()
    return new Response(JSON.stringify({ ...body, settings: { ...body.settings, TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] } }), { status: res.status, headers: res.headers })
  }
})
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('[data-testid="tp-term-60"]'), { timeout: 15000 })
const tid = (t) => `[data-testid="${t}"]`
async function type(t, value) {
  await page.focus(tid(t)); await page.$eval(tid(t), (e) => e.select()); await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
  const got = await page.$eval(tid(t), (e) => e.value)
  if (got !== value) throw new Error(`typing into ${t}: wanted ${value}, holds ${got}`)
}
const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
await type('tp-units-safesight', '120'); await type('tp-units-air_quality', '40'); await type('tp-units-hemir', '2')
await page.click(tid('tp-term-60'))
for (const state of ['opex', 'capex']) {
  if (state === 'capex') {
    await page.click(tid('tp-capex'))
    await type('tp-escalator', '3')
    await page.waitForFunction((s) => !document.querySelector(s)?.disabled, {}, tid('tp-escalator-start'))
    await page.select(tid('tp-escalator-start'), '2')
    await type('tp-wht', '10')
  }
  await page.waitForFunction((want) => document.querySelector('[data-testid="tp-q-tcv"]')?.textContent.trim() === want, { timeout: 8000 },
    state === 'opex' ? '22,018,611.00' : '23,379,957.72')
  for (const width of [1240, 1920]) {
    await page.setViewport({ width, height: 1100 })
    const h = await page.evaluate(() => document.querySelector('.app-content-scroll')?.scrollHeight ?? 1100)
    await page.setViewport({ width, height: Math.max(1100, h + 40) })
    await page.evaluate(() => document.activeElement?.blur()); await page.mouse.move(1, 1); await settle()
    const r = await page.$eval('#view-term-pricing [aria-label="Quote"]', (e) => { const b = e.getBoundingClientRect(); return { x: b.x - 12, y: b.y - 12, width: b.width + 24, height: b.height + 24 } })
    const file = `${OUT}/built-${state}-${width}.png`
    await page.screenshot({ path: file, clip: r })
    console.log(`SHOT  ${file.slice(ROOT.length)}  ${Math.round(r.width)}x${Math.round(r.height)}`)
    await page.setViewport({ width, height: 1100 })
  }
}
await browser.close()
