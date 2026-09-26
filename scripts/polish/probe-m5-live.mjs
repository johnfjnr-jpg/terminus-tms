// ── M5 PHASE 0, THE SECOND HALF: WHAT RENDERS TODAY ─────────────────────
//
// The eight live records all price at contractNet 0 because none has units
// entered, so "0 derived values move" is true and is a weak reading on its own
// (Verification 14: a comparison reached with nothing on either side). The
// calibration answers that - ssExisting +10 moves 21 to 29 of 49 on those same
// records, so the comparator discriminates on this population - but it says
// nothing about what a person SEES.
//
// So this builds the state with UNITS: capex, no structure key, real counts.
// That is the shape M5 is actually about, and it is unreachable through the
// screen today because saving writes `effectiveStructure(ui)`, which defaults.
// Built directly for that reason, and said so (Verification 47).
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('polish/probe-m5-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/polish/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'polishm5'
const { oppId } = await freshOpportunity(TAG)

// No `structure` key at all, and no paymentMode, which is the live shape.
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
} })
const back = await api('GET', `/opportunities/${oppId}`)
const stored = back?.payload ?? back?.record?.payload ?? {}
console.log(`stored structure: ${JSON.stringify(stored.structure ?? null)}   `
  + `paymentMode: ${JSON.stringify(stored.paymentMode ?? null)}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.setViewport({ width: 1440, height: 1900 })
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
  await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
  const r = await p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const sched = [...document.querySelectorAll(
      '[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')].filter(vis)[0]
    return {
      mode: document.querySelector('[data-testid="deal-payment-mode-toggle"]')?.textContent?.trim(),
      radios: [...document.querySelectorAll('#deal-structure-toggle [data-structure]')]
        .map((e) => ({ v: e.dataset.structure, active: e.classList.contains('active') })),
      scheduleHeading: sched ? (sched.querySelector('.label')?.textContent?.trim()
        ?? sched.textContent.trim().slice(0, 60)) : null,
      recoveryShown: vis(document.querySelector('#deal-recovery-group')),
      recoveryReadout: vis(document.querySelector('#deal-recovery-readonly')),
    }
  })
  console.log(`\n── what a CAPEX record with NO structure key renders TODAY ──`)
  console.log(`   mode control        ${r.mode}`)
  console.log(`   structure radios    ${JSON.stringify(r.radios)}`)
  console.log(`   schedule heading    ${JSON.stringify(r.scheduleHeading)}`)
  console.log(`   recovery input      ${r.recoveryShown}`)
  console.log(`   recovery readout    ${r.recoveryReadout}`)
  const selected = r.radios.filter((x) => x.active).map((x) => x.v)
  console.log(`\n   SELECTED: ${selected.length ? selected.join(',') : 'NOTHING IS SELECTED'}`)
  await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
  await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
  await p.screenshot({ path: `${OUT}m5-today-1440.png` })
  console.log(`   photograph ${OUT}m5-today-1440.png`)
} finally { await b.close(); await tearDown(TAG) }
