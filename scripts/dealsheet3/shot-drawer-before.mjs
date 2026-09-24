// THE DRAWER FROM JOHN'S SCREENSHOT, BEFORE ANY FIX.
//
// The census table says 22 boxes are blank beside a derived value. This is the
// picture of the one he reported, so the claim is readable rather than only
// counted (Verification 4). The element is scrolled into view and the capture
// is asserted non-empty before it is treated as evidence.
//
// MEASURE FIRST, CAPTURE SECOND, and the page rather than the element: a
// Puppeteer element capture suppresses the scrollbar and does not put it back.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('dealsheet3/shot-drawer-before.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/dealsheet3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'ds3shot'
const STAGE = process.env.C_STAGE ?? 'before'

const fx = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${fx.oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 24, installResp: 'Terminus Contractor - Lump Sum',
  lumpSumCost: 200000, whtPct: 15, gstPct: 9, grossUp: true,
} })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1400 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${fx.oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
    await p.evaluate(() => {
      const x = document.querySelector('[data-testid="stmt-expand-all"]')
      if (x && x.textContent.trim() === 'Expand all') x.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
    // MEASURE BEFORE CAPTURING. The claim is about these boxes, so their state
    // is read from the DOM and printed, and the picture is the corroboration.
    const state = await p.evaluate(() => {
      const ids = ['deal-margin-hwSs', 'deal-price-hwSs', 'deal-margin-hwAqm', 'deal-price-hwAqm',
        'deal-margin-hwHemir', 'deal-price-hwHemir']
      const boxes = ids.map((i) => {
        const e = document.querySelector(`[data-testid="stmt-edit-${i}"]`)
        return e ? `${i}="${e.value}"` : `${i} ABSENT`
      })
      const row = document.querySelector('[data-testid="stmt-edit-deal-margin-hwSs"]')
      row?.scrollIntoView({ block: 'center' })
      const total = [...document.querySelectorAll('.stmt td')]
        .map((t) => t.textContent.trim()).filter((t) => /^\$?[\d,]{6,}$/.test(t)).slice(0, 4)
      return { boxes, total }
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    console.log(`${width}: ${state.boxes.join('  ')}`)
    console.log(`${width}: money on the statement ${state.total.join(', ')}`)
    const f = `${OUT}drawer-${STAGE}-${width}.png`
    await p.screenshot({ path: f })
    const bytes = statSync(f).size
    console.log(`${width}: ${f} ${bytes} bytes${bytes < 20000 ? '   <-- SUSPECT, too small to hold a screen' : ''}`)
  }
} finally { await b.close(); await tearDown(TAG) }
