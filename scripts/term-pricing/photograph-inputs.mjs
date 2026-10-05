#!/usr/bin/env node
// ── TP_INPUTS E4: the Inputs card, photographed in the approved pictures' state ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/photograph-inputs.mjs
//
// Puts the screen in the state John's approved pictures show
// (prototypes/term-pricing-inputs/inputs-*.png): 1 SafeSight, 36 months, CAPEX,
// escalator blank, GST 9; Split WHT off with WHT 0, and Split WHT on at 5 and
// 10 with Gross up on. Then captures the Inputs card at 1240, 1440, 1600 and
// 1920 into prototypes/term-pricing-inputs/built/, beside the approved files.
//
// v1.3's ten-term TERMS is written into the browser's copy of the GET
// response, as the pictures show ten terms; the live setting is John's.
// Measures nothing: probe-overlap.mjs and probe-screen.mjs carry the claims.
//
// UNWIRED: needs a browser, a live server and a session.

import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('photograph-inputs.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = `${ROOT}prototypes/term-pricing-inputs/built`
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
    return new Response(JSON.stringify({ ...body, settings: { ...body.settings, TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] } }),
      { status: res.status, headers: res.headers })
  }
})
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('[data-testid="tp-term-108"]'), { timeout: 15000 })

const tid = (t) => `[data-testid="${t}"]`
async function type(t, value) {
  await page.focus(tid(t)); await page.$eval(tid(t), (e) => e.select()); await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
  const got = await page.$eval(tid(t), (e) => e.value)
  if (got !== value) throw new Error(`typing into ${t}: wanted ${value}, holds ${got}`)
}
async function sw(t, on) {
  if ((await page.$eval(tid(t), (e) => e.getAttribute('aria-checked'))) !== String(on)) await page.click(tid(t))
  await page.waitForFunction((s, v) => document.querySelector(s)?.getAttribute('aria-checked') === String(v), {}, tid(t), on)
}
const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))

await page.click(tid('tp-term-36'))
await page.click(tid('tp-capex'))
for (const split of [false, true]) {
  await sw('tp-wht-split', split)
  if (split) { await type('tp-wht-hw', '5'); await type('tp-wht-saas', '10'); await sw('tp-wht-grossup', true) }
  for (const width of [1240, 1440, 1600, 1920]) {
    await page.setViewport({ width, height: 1100 })
    // The resting state, as the pictures show it: a click leaves the switch
    // focused, and the focus ring read as a white "on" border in the first run.
    await page.evaluate(() => document.activeElement?.blur())
    // And the pointer: it stays where it last clicked, so the last switch
    // clicked showed its :hover border (white) instead of its resting "on".
    await page.mouse.move(1, 1)
    await settle()
    const gross = await page.$eval('[data-testid="tp-wht-grossup"]', (e) => ({ on: e.getAttribute('aria-checked'), border: getComputedStyle(e).borderTopColor, hover: e.matches(':hover'), focus: e.matches(':focus') }))
    console.log(`      Gross up at ${width}: ${JSON.stringify(gross)}`)
    // Page capture clipped to the card (an element capture suppresses the
    // scroll container's bar: Verification 4).
    const r = await page.$eval('#view-term-pricing [aria-label="Inputs"]', (e) => { const b = e.getBoundingClientRect(); return { x: b.x - 12, y: b.y - 12, width: b.width + 24, height: b.height + 24 } })
    const file = `${OUT}/built-${width}-split-${split ? 'on' : 'off'}.png`
    await page.screenshot({ path: file, clip: r })
    console.log(`SHOT  ${file.slice(ROOT.length)}  ${Math.round(r.width)}x${Math.round(r.height)}`)
  }
}
await browser.close()
