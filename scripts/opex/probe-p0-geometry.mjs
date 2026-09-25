// ── PHASE 0(a): THE PANEL'S LEFT-HAND GEOMETRY, BEFORE ANYTHING IS BUILT ─
//
// R-OX2 puts the OPEX table in the space G7 reclaimed. This measures what is
// actually there at both widths, so the table is sized from the room rather
// than from a guess, and so the before/after pair exists.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opex/probe-p0-geometry.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opex/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'opexp0'
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
} })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1600 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2000)))
    const g = await p.evaluate(() => {
      const box = (sel) => {
        const e = document.querySelector(sel)
        if (!e) return null
        const r = e.getBoundingClientRect()
        return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }
      }
      const region = box('.deal-payment-region')
      const panel = box('.payment-terms-panel')
      const cols = [...document.querySelectorAll('.deal-payment-region > *')].map((e) => {
        const r = e.getBoundingClientRect()
        return { cls: e.className, left: Math.round(r.left), w: Math.round(r.width) }
      })
      // The FACTORING toggle, whose dress R-OX1 names.
      const fx = document.querySelector('#deal-po-factoring-toggle, [role="switch"]')
      return {
        region, panel, cols,
        freeToRightOfPanel: region && panel ? region.right - panel.right : null,
        toggle: fx ? { id: fx.id, cls: fx.className, label: fx.textContent.trim(),
          w: Math.round(fx.getBoundingClientRect().width) } : null,
      }
    })
    console.log(`\n══════ ${width} ══════`)
    console.log(`  region  ${JSON.stringify(g.region)}`)
    console.log(`  panel   ${JSON.stringify(g.panel)}`)
    console.log(`  free space to the right of the panel: ${g.freeToRightOfPanel}px`)
    for (const c of g.cols) console.log(`    column  ${String(c.w).padStart(5)}px at ${c.left}  ${c.cls}`)
    console.log(`  the switch to copy: ${JSON.stringify(g.toggle)}`)
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    await p.screenshot({ path: `${OUT}p0-payment-${width}.png` })
    console.log(`  captured p0-payment-${width}.png ${statSync(`${OUT}p0-payment-${width}.png`).size} bytes`)
  }
} finally { await b.close(); await tearDown(TAG) }
