// ── PHASE 0 FOR L3: CAN THE TWO TABLES SHARE A ROW? ─────────────────────
//
// The instruction gives an estimate from last round - roughly 450 to 500px for
// the OPEX table and 270px for the invoiced-fee table inside a 637px panel at
// 1240 - and says to MEASURE before deciding. So this reads what the two
// actually occupy at their natural widths, at both widths, rather than trusting
// arithmetic on remembered numbers.
//
// The measure is the one the decision needs: the sum of the two NATURAL widths
// against the room the panel has. Shrinking type or clipping figures to force a
// fit is explicitly refused, so a sum that does not fit is a stacked layout.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opex-layout/probe-p0-widths.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opex-layout/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'opexlay0'
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
  paymentMode: 'opex', structure: 'single',
} })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1700 })
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
    const g = await p.evaluate(() => {
      const w = (sel) => {
        const e = document.querySelector(sel)
        if (!e) return null
        const r = e.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) }
      }
      // THE NATURAL WIDTH, not the laid-out one: a table inside a block box
      // reports the box. `scrollWidth` on the table itself is what it needs.
      const nat = (sel) => {
        const e = document.querySelector(sel)
        return e ? Math.round(e.scrollWidth) : null
      }
      const panel = document.querySelector('.payment-terms-panel')
      const card = document.querySelector('.payment-card')
      const cs = card ? getComputedStyle(card) : null
      return {
        panel: w('.payment-terms-panel'),
        card: w('.payment-card'),
        cardPadding: cs ? `${cs.paddingLeft} / ${cs.paddingRight}` : null,
        opexTable: w('#deal-opex-table'), opexNatural: nat('#deal-opex-table'),
        yearTable: w('#deal-year-schedule'), yearNatural: nat('#deal-year-schedule'),
        yearInner: nat('#deal-year-schedule table'),
        radios: w('#deal-structure-toggle'),
        room: panel && card ? Math.round(card.getBoundingClientRect().width) : null,
      }
    })
    const sum = (g.opexNatural ?? 0) + (g.yearInner ?? g.yearNatural ?? 0)
    console.log(`\n══════ ${width} ══════`)
    console.log(`  panel            ${JSON.stringify(g.panel)}`)
    console.log(`  card (inner)     ${JSON.stringify(g.card)}  padding ${g.cardPadding}`)
    console.log(`  OPEX table       laid out ${g.opexTable?.w}  natural ${g.opexNatural}`)
    console.log(`  invoiced-fee     laid out ${g.yearTable?.w}  natural ${g.yearNatural}  inner table ${g.yearInner}`)
    console.log(`  SUM of naturals  ${sum}  against card width ${g.card?.w}`)
    console.log(`  VERDICT          ${sum <= (g.card?.w ?? 0) ? 'THEY FIT side by side' : 'THEY DO NOT FIT, stack at this width'}`)
    console.log(`  tops: opex ${g.opexTable?.top}  year ${g.yearTable?.top}  (the stagger L3 removes)`)
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    await p.screenshot({ path: `${OUT}p0-${width}.png` })
    console.log(`  captured p0-${width}.png ${statSync(`${OUT}p0-${width}.png`).size} bytes`)
  }
} finally { await b.close(); await tearDown(TAG) }
