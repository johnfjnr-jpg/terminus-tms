// ── PHASE 0 FOR F3 AND F5 ───────────────────────────────────────────────
//
// F3: count the hosting schedule's RENDERS per structure, live, in every
// combination rather than the one that was reported.
// F5: measure whether the milestone table and the hosting schedule can share a
// row beside the rail at 1240. The standing rule forbids shipping an
// unrequested arrangement, so if they cannot, the round stops and photographs.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payment-fix/probe-p0.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payment-fix/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'payfixp0'
const { oppId } = await freshOpportunity(TAG)
const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
  milestones: [
    { month: 1, label: 'Contract start', pct: 40 },
    { month: 6, label: 'Hardware delivered to site', pct: 30 },
    { month: 12, label: 'Installation complete', pct: 30 },
  ],
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const land = async (width) => {
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
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2200)))
  }
  const read = () => p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    // EVERY render of the hosting schedule, and whether a person can see it.
    const all = [...document.querySelectorAll('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')]
    const content = document.querySelector('#deal-payment-content')
    const nat = (s) => { const e = document.querySelector(s); return e ? Math.ceil(e.scrollWidth) : null }
    const grid = document.querySelector('#deal-hybrid-group .ms-grid, #deal-hybrid-group table, #deal-hybrid-group')
    return {
      renders: all.length,
      visible: all.filter(vis).length,
      where: all.map((e) => ({ id: e.getAttribute('data-testid'),
        parent: e.parentElement?.id || e.parentElement?.className || '?', seen: vis(e) })),
      contentW: content ? Math.round(content.clientWidth) : null,
      hostingNat: nat('#deal-capex-year-slot') ?? nat('#deal-opex-year-slot'),
      hybridVisible: vis(document.querySelector('#deal-hybrid-group')),
      milestoneNat: grid ? Math.ceil(grid.scrollWidth) : null,
      ringXs: [...document.querySelectorAll('#deal-payment-rail [data-structure] .ring-radio-ring')]
        .map((e) => Math.round(e.getBoundingClientRect().left)),
      invoicingInRail: !!document.querySelector('#deal-payment-rail #deal-invoicing-toggle'),
      factoringCls: document.querySelector('[data-testid="deal-factoring-toggle"]')?.className ?? null,
      modeCls: document.querySelector('[data-testid="deal-payment-mode-toggle"]')?.className ?? null,
    }
  })

  for (const width of [1440, 1240]) {
    console.log(`\n══════════════ ${width} ══════════════`)
    for (const structure of ['twoPhase', 'single', 'hybrid']) {
      await api('PATCH', `/opportunities/${oppId}`, { payload: { ...base, structure, paymentMode: 'capex' } })
      await land(width)
      const r = await read()
      console.log(`  CAPEX ${structure.padEnd(9)} schedule rendered ${r.renders}, VISIBLE ${r.visible}`
        + `   ${r.where.map((w) => `${w.id}@${String(w.parent).slice(0, 22)}${w.seen ? '*' : ''}`).join(' ')}`)
      if (structure === 'hybrid') {
        console.log(`      content ${r.contentW}px | hosting ${r.hostingNat}px + milestones ${r.milestoneNat}px`
          + ` = ${(r.hostingNat ?? 0) + (r.milestoneNat ?? 0) + 24}`)
        console.log(`      VERDICT ${(r.hostingNat ?? 0) + (r.milestoneNat ?? 0) + 24 <= (r.contentW ?? 0)
          ? 'they CAN share the row beside the rail' : 'they CANNOT share the row beside the rail'}`)
        await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
        await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
        await p.screenshot({ path: `${OUT}p0-hybrid-${width}.png` })
      }
      if (structure === 'twoPhase') {
        console.log(`      ring x positions ${JSON.stringify(r.ringXs)}  (F2 wants one gutter)`)
        console.log(`      invoicing in the rail: ${r.invoicingInRail}  (F4 wants true)`)
        console.log(`      factoring class "${r.factoringCls}"`)
        console.log(`      mode class      "${r.modeCls}"   (F1 wants the same component)`)
      }
    }
    await api('PATCH', `/opportunities/${oppId}`, { payload: { ...base, structure: 'single', paymentMode: 'opex' } })
    await land(width)
    const r = await read()
    console.log(`  OPEX  ${''.padEnd(9)} schedule rendered ${r.renders}, VISIBLE ${r.visible}`)
  }
} finally { await b.close(); await tearDown(TAG) }
