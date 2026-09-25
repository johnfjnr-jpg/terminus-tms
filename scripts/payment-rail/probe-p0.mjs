// ── PHASE 0: THE RAIL'S WIDTH FROM ITS CONTENT, AND WHAT IS LEFT ────────
//
// R-PT2 sizes the rail from labels plus secondary lines with no clipping, so
// this measures the text rather than guessing a column width. The proposed rail
// is built offscreen with the real fonts and the real strings and measured.
//
// Then the money content: what each mode actually needs beside it.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payment-rail/probe-p0.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payment-rail/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'railp0'
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
  const land = async (width) => {
    await p.setViewport({ width, height: 1800 })
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
  const measure = () => p.evaluate(() => {
    // THE PROPOSED RAIL, BUILT OFFSCREEN with the real fonts and strings, so the
    // width comes from the content R-PT2 names rather than from a guess.
    const rows = [
      ['Single phase', 'recovery over full term'],
      ['Two-phase', 'hardware recovery then hosting'],
      ['Hybrid', 'milestone + hosting'],
    ]
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;display:inline-block;white-space:nowrap'
    const card = document.querySelector('.payment-card')
    for (const [label, note] of rows) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:10px'
      const ring = document.createElement('span'); ring.style.cssText = 'width:14px;height:14px;flex:0 0 14px'
      const txt = document.createElement('div')
      const l = document.createElement('div'); l.textContent = label
      l.style.cssText = 'font-size:13px;white-space:nowrap'
      const n = document.createElement('div'); n.textContent = note
      n.style.cssText = 'font-size:11px;white-space:nowrap'
      txt.appendChild(l); txt.appendChild(n); row.appendChild(ring); row.appendChild(txt)
      probe.appendChild(row)
    }
    card.appendChild(probe)
    const railNatural = Math.ceil(probe.getBoundingClientRect().width)
    probe.remove()

    const nat = (sel) => { const e = document.querySelector(sel); return e ? Math.ceil(e.scrollWidth) : null }
    const box = (sel) => {
      const e = document.querySelector(sel); if (!e) return null
      const r = e.getBoundingClientRect()
      return { w: Math.round(r.width), top: Math.round(r.top) }
    }
    const card2 = document.querySelector('.payment-card')
    return {
      railNatural,
      cardInner: card2 ? Math.round(card2.clientWidth - 32) : null,
      opexTable: nat('#deal-opex-table'),
      yearTable: nat('#deal-year-schedule table') ?? nat('#deal-year-schedule'),
      yearSlot: nat('#deal-opex-year-slot'),
      radios: box('#deal-structure-toggle'),
      switchTop: box('.opex-switch')?.top ?? null,
      // WHERE THE MONEY STARTS TODAY, in each mode: the top-alignment claim is
      // about this number being the same in both.
      moneyTopCapex: box('#deal-year-schedule')?.top ?? null,
      hybridGrid: nat('#deal-hybrid-group'),
    }
  })

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await land(width)
    let m = await measure()
    console.log(`  card inner width      ${m.cardInner}`)
    console.log(`  RAIL natural width    ${m.railNatural}  (labels + secondary lines, no wrap)`)
    console.log(`  CAPEX: yearly table   ${m.yearTable}   money starts at y=${m.moneyTopCapex}`)
    console.log(`  CAPEX: radios block   ${JSON.stringify(m.radios)}`)
    console.log(`  hybrid group natural  ${m.hybridGrid}`)
    console.log(`  rail + yearly         ${m.railNatural + (m.yearTable ?? 0) + 24} against ${m.cardInner}`)
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
    await p.screenshot({ path: `${OUT}p0-capex-${width}.png` })

    await p.click('[data-testid="deal-payment-mode-toggle"]')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
    m = await measure()
    const opexNeeds = (m.opexTable ?? 0) + (m.yearSlot ?? 0) + 24
    console.log(`  OPEX: per-unit ${m.opexTable}  yearly ${m.yearSlot}  together ${opexNeeds}`)
    console.log(`  rail + OPEX content   ${m.railNatural + opexNeeds + 24} against ${m.cardInner}`)
    console.log(`  VERDICT 1440/1240     ${m.railNatural + opexNeeds + 24 <= (m.cardInner ?? 0)
      ? 'rail + both tables fit' : 'rail + both tables DO NOT fit, the two tables must stack beside the rail'}`)
    console.log(`  rail + widest table   ${m.railNatural + Math.max(m.opexTable ?? 0, m.yearSlot ?? 0) + 24} against ${m.cardInner}`)
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
    await p.screenshot({ path: `${OUT}p0-opex-${width}.png` })
    console.log(`  captured p0-capex-${width}.png and p0-opex-${width}.png`)
  }
} finally { await b.close(); await tearDown(TAG) }
