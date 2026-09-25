// ── PHASE 0b: WHAT HAPPENS TO AN OVERRIDE WHEN A COUNT CHANGES, TODAY ────
//
// John's third finding: a fundamental input change must revert pricing to the
// derived calculation. This measures what the screen does NOW, before any
// build, driving the real controls and reading the record back.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('approve-path/probe-p0-overrides.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
mkdirSync(`${ROOT}/.verify/approve-path/`, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'apath0b'
const DEAL = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
}
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: DEAL })
const payload = async () => (await admin().from('record_revisions').select('payload')
  .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1)).data?.[0]?.payload ?? {}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.setViewport({ width: 1440, height: 1400 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
  await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
      .find((x) => x.textContent.trim() === 'Commercials')
    el?.click()
  })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1800)))
  await p.evaluate(() => {
    const x = document.querySelector('[data-testid="stmt-expand-all"]')
    if (x && x.textContent.trim() === 'Expand all') x.click()
  })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))

  const type = async (sel, text) => {
    await p.click(sel)
    await p.keyboard.press('End')
    for (let i = 0; i < 10; i += 1) await p.keyboard.press('Backspace')
    if (text) await p.keyboard.type(text)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
  }
  const save = async () => {
    await p.click('[data-testid="stmt-save"]')
    await p.waitForFunction(() => !document.querySelector('[data-testid="stmt-unsaved"]'), { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 800)))
  }
  const amber = () => p.evaluate(() => [...document.querySelectorAll('.stmt-edit')]
    .filter((e) => e.dataset.override === 'true')
    .map((e) => `${e.getAttribute('data-testid')?.replace('stmt-edit-deal-', '')}=${e.value}`))

  // AN ABSOLUTE override (a price), a FEE override, and a MARGIN override.
  await type('[data-testid="stmt-edit-deal-price-hwSs"]', '500000')
  await type('[data-testid="stmt-edit-deal-hofee-hoSs"]', '99')
  await type('[data-testid="stmt-edit-deal-margin-hwAqm"]', '44')
  await save()
  const before = await payload()
  console.log('\n════ WITH THREE OVERRIDES STORED ════')
  console.log(`  priceOverrides    ${JSON.stringify(before.priceOverrides ?? {})}`)
  console.log(`  hostingUnitFees   ${JSON.stringify(before.hostingUnitFees ?? {})}`)
  console.log(`  marginOverrides   ${JSON.stringify(before.marginOverrides ?? {})}`)
  console.log(`  amber on screen   ${(await amber()).join(', ')}`)

  // NOW A FUNDAMENTAL INPUT: the SafeSight existing-infra unit count.
  console.log('\n════ NOW CHANGE A UNIT COUNT: ssExisting 20 -> 35 ════')
  await type('[data-testid="stmt-edit-deal-ssExisting"]', '35')
  await save()
  const after = await payload()
  console.log(`  ssExisting        ${after.ssExisting}`)
  console.log(`  priceOverrides    ${JSON.stringify(after.priceOverrides ?? {})}`)
  console.log(`  hostingUnitFees   ${JSON.stringify(after.hostingUnitFees ?? {})}`)
  console.log(`  marginOverrides   ${JSON.stringify(after.marginOverrides ?? {})}`)
  console.log(`  amber on screen   ${(await amber()).join(', ')}`)
  const kept = JSON.stringify(after.priceOverrides ?? {}) === JSON.stringify(before.priceOverrides ?? {})
  console.log(`\n  VERDICT: the absolute overrides ${kept ? 'SURVIVED the count change' : 'were cleared'}`)
} finally { await b.close(); await tearDown(TAG) }
