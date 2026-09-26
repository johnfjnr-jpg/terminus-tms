// ── PHASE 0: THE BEFORE STATE FOR M2, M8, M9 AND M10 ────────────────────
//
// M2 asks for the gap measured BEFORE and after, at 1440, 1240 and a wide
// viewport. M8 asks whether two added columns fit at 1440 and 1240 without
// clipping, which needs the Units and Installation cards' current widths and
// their intrinsic content widths.
//
// INTRINSIC WIDTHS ARE MEASURED BY CLONING INTO AN OFFSCREEN `max-content`
// HOST. `scrollWidth` on a block is its LAID-OUT width, not its intrinsic one,
// and reading it twice for two elements returns the column width twice - a
// fault this estate committed a round ago and recorded.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('polish/probe-p0-layout.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/polish/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'polishp0'
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, installResp: 'Terminus Contractor - Per Unit',
  structure: 'twoPhase', paymentMode: 'capex',
  factoring: { enabled: true, ratePct: 2, termMonths: 36, method: 'straight' },
} })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1920, 1440, 1240]) {
    await p.setViewport({ width, height: 1900 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.waitForFunction(() => /Invoicing/.test(
      document.querySelector('#deal-payment-rail')?.textContent ?? ''), { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 800)))
    const r = await p.evaluate(() => {
      const host = document.createElement('div')
      host.style.cssText = 'position:absolute;left:-9999px;top:0;width:max-content'
      document.body.appendChild(host)
      const intrinsic = (el) => { if (!el) return null
        host.innerHTML = ''; const c = el.cloneNode(true); c.style.width = 'max-content'
        c.classList.remove('hidden'); host.appendChild(c)
        const w = Math.ceil(host.getBoundingClientRect().width); host.innerHTML = ''; return w }
      const box = (s) => { const e = document.querySelector(s); if (!e) return null
        const q = e.getBoundingClientRect()
        return { left: Math.round(q.left), right: Math.round(q.right), w: Math.round(q.width), top: Math.round(q.top) } }
      const pay = box('.payment-terms-panel'), fac = box('.po-factoring-panel')
      const region = document.querySelector('.deal-payment-region')
      const cs = region ? getComputedStyle(region) : null
      // The estate's own standard gap, taken from other grids rather than
      // invented: read what the sibling sections actually use.
      const gaps = {}
      for (const sel of ['.deal-payment-region', '.detail-grid', '.deal-section .grid-2', '#deal-hybrid-group:not(.hidden)']) {
        const e = document.querySelector(sel)
        if (e) gaps[sel] = getComputedStyle(e).gap || getComputedStyle(e).columnGap
      }
      const out = {
        payment: pay, factoring: fac,
        gapBetween: pay && fac ? fac.left - pay.right : null,
        regionDisplay: cs?.display ?? null, regionGap: cs?.gap ?? null,
        regionCols: cs?.gridTemplateColumns ?? null,
        gaps,
        unitsCard: box('#deal-units-card') ?? box('.units-card'),
        install: box('#deal-install-panel') ?? box('.installation-panel'),
        unitsIntrinsic: intrinsic(document.querySelector('#deal-units-card') ?? document.querySelector('.units-card')),
        factoringFields: [...document.querySelectorAll('#deal-factoring-fields input')]
          .map((e) => ({ id: e.id, w: Math.round(e.getBoundingClientRect().width) })),
        methodToggle: box('#deal-factoring-method-toggle'),
        methodButtons: [...document.querySelectorAll('#deal-factoring-method-toggle button')]
          .map((e) => ({ m: e.dataset.method, active: e.classList.contains('active'),
            w: Math.round(e.getBoundingClientRect().width) })),
      }
      host.remove()
      return out
    })
    console.log(`\n═════ ${width} ═════`)
    console.log(`  payment card   ${JSON.stringify(r.payment)}`)
    console.log(`  factoring card ${JSON.stringify(r.factoring)}`)
    console.log(`  M2 GAP BETWEEN THEM: ${r.gapBetween}px`)
    console.log(`  region display=${r.regionDisplay} gap=${r.regionGap} cols=${r.regionCols}`)
    console.log(`  gaps in use: ${JSON.stringify(r.gaps)}`)
    console.log(`  units card   ${JSON.stringify(r.unitsCard)}  intrinsic ${r.unitsIntrinsic}`)
    console.log(`  install      ${JSON.stringify(r.install)}`)
    console.log(`  M9 factoring inputs ${JSON.stringify(r.factoringFields)}`)
    console.log(`  M10 method toggle ${JSON.stringify(r.methodToggle)} ${JSON.stringify(r.methodButtons)}`)
    if (width === 1440) {
      await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
      await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
      await p.screenshot({ path: `${OUT}p0-before-${width}.png` })
      console.log(`  photograph ${OUT}p0-before-${width}.png`)
    }
  }
} finally { await b.close(); await tearDown(TAG) }
