#!/usr/bin/env node
// ── PER_CAMERA_AND_CAPEX_P0 A3: the term ladder with "Per camera / mo" ────
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/photograph-ladder.mjs
//
// The demo deal (120 SafeSight, 40 AQ, 2 HEMIR), OPEX, 60 months selected,
// at 1240, 1600 and 1920, in two states:
//   spec  the spec's 90% margins passed IN TEST, into the browser's copy of
//         the real GET response only (T31's figures);
//   live  the live settings as they stand.
// Each width is MEASURED before it is captured (Verification 4: measure first,
// capture second), and the capture is a page capture clipped to the card.
//
// UNWIRED: needs a browser, a live server and a session.
import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('photograph-ladder.mjs')
const ROOT = new URL('../../', import.meta.url).pathname
const OUT = `${ROOT}prototypes/term-pricing-percam`
mkdirSync(OUT, { recursive: true })
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const SPEC_MARGINS = { safesight: '90', air_quality: '90', hemir: '90' }

const b = await puppeteer.launch({ headless: 'new' })
for (const state of ['spec', 'live']) {
  const page = await b.newPage()
  await page.setViewport({ width: 1240, height: 1100 })
  if (state === 'spec') {
    await page.evaluateOnNewDocument((m) => {
      const real = window.fetch
      window.fetch = async (...a) => {
        const res = await real(...a)
        if (!/\/api\/term-pricing(\?|$)/.test(String(a[0]?.url ?? a[0])) || !res.ok) return res
        const body = await res.clone().json()
        return new Response(JSON.stringify({ ...body, settings: { ...body.settings, ANCHOR_MARGIN: m, SHORT_TERM_MARGIN: m } }),
          { status: res.status, headers: res.headers })
      }
    }, SPEC_MARGINS)
  }
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
  await page.evaluate(() => window.navigate('term-pricing'))
  await page.waitForFunction(() => document.querySelector('[data-testid="tp-term-60"]'), { timeout: 15000 })
  const tid = (t) => `[data-testid="${t}"]`
  const type = async (t, v) => {
    await page.focus(tid(t)); await page.$eval(tid(t), (e) => e.select()); await page.keyboard.press('Backspace'); if (v) await page.keyboard.type(v)
    const got = await page.$eval(tid(t), (e) => e.value)
    if (got !== v) throw new Error(`typing into ${t}: wanted ${v}, holds ${got}`)
  }
  const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
  await type('tp-units-safesight', '120'); await type('tp-units-air_quality', '40'); await type('tp-units-hemir', '2')
  await page.click(tid('tp-opex')); await page.click(tid('tp-term-60'))
  // Wait on the state itself: the 120-month per-camera cell carries a figure.
  await page.waitForFunction((s) => /\d/.test(document.querySelector(s)?.textContent ?? ''), { timeout: 6000 }, tid('tp-ladder-percam-120'))
  const card = '#view-term-pricing section[aria-label="Term ladder"]'
  for (const width of [1240, 1600, 1920]) {
    await page.setViewport({ width, height: 1100 })
    await page.evaluate(() => document.activeElement?.blur()); await page.mouse.move(1, 1); await settle()
    await page.$eval(card, (e) => e.scrollIntoView({ block: 'center' })); await settle()
    const m = await page.$eval(card, (c) => {
      const t = c.querySelector('table'), cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect()
      const heads = [...t.tHead.rows[0].cells].map((h) => h.textContent.trim())
      const pc = heads.indexOf('Per camera / mo')
      const clipped = [...t.querySelectorAll('td, th')].filter((x) => x.scrollWidth > x.clientWidth + 1).length
      return {
        heads, pc,
        percam: [...t.tBodies[0].rows].map((r) => `${r.cells[0].textContent.trim().replace(' months', '')}: ${r.cells[pc]?.textContent.trim()}`),
        tableInsideCard: tr.left >= cr.left - 0.5 && tr.right <= cr.right + 0.5,
        cardOverflow: c.scrollWidth > c.clientWidth + 1, clippedCells: clipped,
        oneLineRows: [...t.tBodies[0].rows].every((r) => r.getBoundingClientRect().height < 2 * parseFloat(getComputedStyle(r.cells[0]).fontSize) + 16),
      }
    })
    const r = await page.$eval(card, (e) => { const x = e.getBoundingClientRect(); return { x: Math.max(0, x.x - 10), y: Math.max(0, x.y - 10), width: x.width + 20, height: x.height + 20 } })
    await page.screenshot({ path: `${OUT}/ladder-${state}-${width}.png`, clip: r })
    console.log(`${state} ${width}: heads ${JSON.stringify(m.heads)}; table inside card ${m.tableInsideCard}; card overflow ${m.cardOverflow}; clipped cells ${m.clippedCells}; one-line rows ${m.oneLineRows}`)
    if (width === 1240) console.log(`  per camera: ${m.percam.join('; ')}`)
  }
  await page.close()
}
await b.close()
