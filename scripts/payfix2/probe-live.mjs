// ── R-PT3 AND F5/F3 OPTION A: THE LIVE PROOF ────────────────────────────
//
// Claims are RELATIONSHIPS between two elements, never CSS properties.
// "Side by side, top-aligned, at full card width" is three relationships and
// is asserted as three, because a `display: grid` assertion would pass on a
// grid parked anywhere (Verification 4).
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payfix2/probe-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payfix2/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'payfix2live'
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const { oppId } = await freshOpportunity(TAG)
const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, installResp: 'Terminus Contractor - Per Unit',
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
  const land = async (width, id = oppId) => {
    await p.setViewport({ width, height: 1900 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${id}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.waitForFunction(() => /Invoicing/.test(
      document.querySelector('#deal-payment-rail')?.textContent ?? ''), { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 700)))
  }
  const read = () => p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const all = [...document.querySelectorAll(
      '[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')]
    const sched = all.find(vis)
    // The milestones COLUMN, not its 14px header row: the header is not the
    // thing being placed, and a threshold larger than its subject can never be
    // met. That fault cost three attempts in the previous round.
    const msHead = [...document.querySelectorAll('.ms-grid-head')].find(vis)
    const ms = msHead?.parentElement ?? null
    const card = document.querySelector('.payment-card') ?? document.querySelector('.payment-terms-panel')
    const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height } }
    return {
      renders: all.length, visible: all.filter(vis).length,
      schedWhere: sched ? (sched.closest('#deal-hybrid-group') ? 'hybrid-grid'
        : sched.closest('#deal-payment-content') ? 'content-column' : 'elsewhere') : null,
      structures: [...document.querySelectorAll('#deal-payment-rail [data-structure]')]
        .map((e) => e.dataset.structure),
      anySingleOffered: !!document.querySelector('[data-structure="single"]'),
      ms: rect(ms), sched: rect(sched), card: rect(card),
      railBottom: rect(document.querySelector('#deal-payment-rail'))?.bottom ?? null,
      hybridTop: rect(document.querySelector('#deal-hybrid-group'))?.top ?? null,
      overflow: (() => { const g = document.querySelector('#deal-hybrid-group')
        return g ? Math.max(0, Math.ceil(g.scrollWidth - g.clientWidth)) : 0 })(),
    }
  })
  const shot = async (name) => {
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
    await p.screenshot({ path: `${OUT}${name}.png` })
    return `${OUT}${name}.png`
  }

  const COMBOS = [['capex', 'twoPhase'], ['capex', 'hybrid'], ['opex', 'twoPhase'], ['opex', 'hybrid']]
  for (const width of [1440, 1240]) {
    for (const [mode, structure] of COMBOS) {
      await api('PATCH', `/opportunities/${oppId}`, { payload: { ...base, structure, paymentMode: mode } })
      await land(width)
      const r = await read()
      const opex = mode === 'opex'
      const hybrid = !opex && structure === 'hybrid'
      console.log(`\n── ${width}  ${mode.toUpperCase()} / ${structure} ──`)

      // ── F3: EXACTLY ONE RENDER, IN EVERY STRUCTURE AND MODE ───────────
      check(r.renders === 1, `F3 exactly ONE schedule in the DOM (${r.renders})`)
      check(r.visible === 1, `F3 exactly ONE visible (${r.visible})`)
      check(r.schedWhere === (hybrid ? 'hybrid-grid' : 'content-column'),
        `F3 the one render is in the ${hybrid ? 'hybrid grid' : 'content column'} (${r.schedWhere})`)

      // ── R-PT3: SINGLE PHASE IS NOT OFFERED ────────────────────────────
      check(!r.anySingleOffered, 'R-PT3 Single phase is offered nowhere on the surface')
      if (!opex) {
        check(JSON.stringify(r.structures) === JSON.stringify(['twoPhase', 'hybrid']),
          `R-PT3 CAPEX offers exactly Two-phase and Hybrid (${JSON.stringify(r.structures)})`)
      }

      // ── F5 OPTION A: THREE RELATIONSHIPS ──────────────────────────────
      if (hybrid && r.ms && r.sched) {
        const vOv = Math.min(r.ms.bottom, r.sched.bottom) - Math.max(r.ms.top, r.sched.top)
        const hOv = Math.min(r.ms.right, r.sched.right) - Math.max(r.ms.left, r.sched.left)
        check(vOv >= Math.min(r.ms.h, r.sched.h) * 0.5 && hOv <= 0,
          `F5 SIDE BY SIDE: vertical overlap ${Math.round(vOv)}px, horizontal ${Math.round(hOv)}px`)
        check(Math.abs(r.ms.top - r.sched.top) <= 24,
          `F5 TOP-ALIGNED: ${Math.round(r.ms.top)} against ${Math.round(r.sched.top)}`)
        // FULL CARD WIDTH: the pair spans the card, not the content column.
        const span = r.sched.right - r.ms.left
        check(r.card !== null && span > (r.card.w * 0.75),
          `F5 FULL CARD WIDTH: the pair spans ${Math.round(span)}px of a ${Math.round(r.card?.w ?? 0)}px card`)
        check(r.hybridTop !== null && r.railBottom !== null && r.hybridTop >= r.railBottom - 2,
          `F5 BELOW THE RAIL ROW: grid top ${Math.round(r.hybridTop)}, rail bottom ${Math.round(r.railBottom)}`)
        check(r.overflow === 0, `F5 no overflow (${r.overflow}px)`)
      }
      console.log(`    photograph ${await shot(`live-${width}-${mode}-${structure}`)}`)
    }
  }
} finally { await b.close(); await tearDown(TAG) }
console.log(`\n${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
