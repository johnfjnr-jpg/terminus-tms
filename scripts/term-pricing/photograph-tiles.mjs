#!/usr/bin/env node
// ── TILE_FIT E3: the summary tiles, before and after ──────────────────────
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/photograph-tiles.mjs <before|after>
//
// John's state: the demo deal (120 SafeSight, 40 AQ, 2 HEMIR), CAPEX, 120
// months, split WHT 5% / 10% grossed up: seven tiles. And the OPEX five-tile
// state: the same units, 60 months, no WHT. The tile row is captured (a page
// capture clipped to the row) at 1240, 1600 and 1920 into
// prototypes/term-pricing-tiles/, with each figure's computed size logged.
// "before" is taken on main's tree, checked out read-only for it.
//
// UNWIRED: needs a browser, a live server and a session.
import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('photograph-tiles.mjs')
const ROOT = new URL('../../', import.meta.url).pathname
const TAG = process.argv[2] ?? 'after'
const OUT = `${ROOT}prototypes/term-pricing-tiles`
mkdirSync(OUT, { recursive: true })
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const b = await puppeteer.launch({ headless: 'new' })
const page = await b.newPage()
await page.setViewport({ width: 1240, height: 1100 })
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('[data-testid="tp-term-120"]'), { timeout: 15000 })
const tid = (t) => `[data-testid="${t}"]`
const type = async (t, v) => { await page.focus(tid(t)); await page.$eval(tid(t), (e) => e.select()); await page.keyboard.press('Backspace'); if (v) await page.keyboard.type(v) }
const sw = async (t, on) => { if ((await page.$eval(tid(t), (e) => e.getAttribute('aria-checked'))) !== String(on)) await page.click(tid(t)) }
const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
await type('tp-units-safesight', '120'); await type('tp-units-air_quality', '40'); await type('tp-units-hemir', '2')
for (const state of ['opex5', 'john']) {
  if (state === 'opex5') { await page.click(tid('tp-term-60')); await page.click(tid('tp-opex')) }
  else { await page.click(tid('tp-term-120')); await page.click(tid('tp-capex')); await sw('tp-wht-split', true); await type('tp-wht-hw', '5'); await type('tp-wht-saas', '10'); await sw('tp-wht-grossup', true) }
  for (const width of [1240, 1600, 1920]) {
    await page.setViewport({ width, height: 1100 })
    await page.evaluate(() => document.activeElement?.blur()); await page.mouse.move(1, 1); await settle()
    const row = '#view-term-pricing [aria-label="Quote"] .tp-figures'
    await page.$eval(row, (e) => e.scrollIntoView({ block: 'center' })); await settle()
    const info = await page.$eval(row, (e) => ({ n: e.children.length, wrapped: e.classList.contains('tp-figures--wrap'),
      sizes: [...e.querySelectorAll('.tp-v')].map((v) => getComputedStyle(v).fontSize).join(' ') }))
    const r = await page.$eval(row, (e) => { const x = e.getBoundingClientRect(); return { x: x.x - 10, y: x.y - 10, width: x.width + 20, height: x.height + 20 } })
    await page.screenshot({ path: `${OUT}/${TAG}-${state}-${width}.png`, clip: r })
    console.log(`${TAG} ${state} ${width}: ${info.n} tiles, ${info.wrapped ? 'wrapped' : 'one row'}, sizes ${info.sizes}`)
  }
}
await b.close()
