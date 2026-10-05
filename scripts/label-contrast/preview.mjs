#!/usr/bin/env node
// ── LABEL_CONTRAST Phase 1: before and after, photographed and measured ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/label-contrast/preview.mjs
//
// "after" is scripts/label-contrast/proposal.css injected in the browser;
// nothing on disk changes. Term Pricing (Settings open, Split WHT and Gross
// up on) and the Commercials tab of an OPEX fixture, at 1240 and 1920. Each
// state is MEASURED FIRST (overprint and shrink, the shared detector), then
// captured as a page (Verification 4).
//
// UNWIRED: needs a browser, a live server and a session.
import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { inkOverlaps, shrunkBelowContent } from '../lib/ink-overlap.mjs'
const puppeteer = await loadPuppeteer('label-contrast/preview.mjs')
const ROOT = new URL('../../', import.meta.url).pathname
const OUT = `${ROOT}prototypes/label-contrast`
mkdirSync(OUT, { recursive: true })
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
// --css <file> previews a different proposal; --tag names its captures.
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const PROPOSAL = readFileSync(arg('--css', `${ROOT}scripts/label-contrast/proposal.css`), 'utf8')
const LABEL = arg('--tag', 'after')
const { freshOpportunity, tearDown } = await import('../fixtures.mjs')
const { api } = await import('../api-client.mjs')
const TAG = 'lc1A'
const settle = (p) => p.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
const browser = await puppeteer.launch({ headless: 'new' })
let bad = 0
try {
  const { oppId } = await freshOpportunity(TAG)
  const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
  await api('PATCH', `/opportunities/${oppId}`, { expected_revision: rev, payload: {
    paymentMode: 'opex', structure: 'single', ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
    duration: 60, warrantyPct: 0, installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
    invoicing: 'monthly', targetMargin: 30 } })
  // "before" is captured ONLY on the default run. A run previewing another
  // proposal (--css) re-captured "before" from whatever build was serving,
  // and once Phase 2 had landed that overwrote the committed pre-change
  // captures with pictures of the changed screen (Verification 44's time
  // axis). The journal guard refused the commit that would have kept them.
  const states = process.argv.includes('--css') ? ['after'] : ['before', 'after']
  for (const state of states) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1240, height: 1100 })
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
    if (state === 'after') await page.addStyleTag({ content: PROPOSAL })
    const shoot = async (screen, root) => {
      for (const width of [1240, 1920]) {
        await page.setViewport({ width, height: 1100 })
        await settle(page)
        const ink = await page.evaluate(inkOverlaps, root)
        const sh = await page.evaluate(shrunkBelowContent, root)
        const ok = !ink.missing && ink.hits.length === 0 && sh.hits.length === 0
        if (!ok) bad++
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${state} ${screen} ${width}: ${ink.atoms} atoms, ${ink.hits.length} overprints, ${sh.hits.length} shrunk${ok ? '' : '\n        ' + [...ink.hits, ...sh.hits].slice(0, 6).join('\n        ')}`)
        const h = await page.evaluate(() => document.querySelector('.app-content-scroll')?.scrollHeight ?? 1100)
        await page.setViewport({ width, height: Math.max(1100, h + 40) })
        await settle(page)
        await page.mouse.move(1, 1)
        await page.screenshot({ path: `${OUT}/lc-${state === 'after' ? LABEL : state}-${screen}-${width}.png` })
        await page.setViewport({ width, height: 1100 })
      }
    }
    await page.evaluate(() => window.navigate('term-pricing'))
    await page.waitForFunction(() => document.querySelector('[data-testid="tp-ladder"]'), { timeout: 15000 })
    await page.click('[data-testid="tp-settings-toggle"]')
    await page.click('[data-testid="tp-wht-split"]')
    await page.click('[data-testid="tp-wht-grossup"]')
    await shoot('term-pricing', '#view-term-pricing')
    await page.evaluate((id) => window.navigate('opportunity-detail', id), oppId)
    await page.waitForFunction(() => { const v = document.getElementById('view-opportunity-detail'); return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading') }, { timeout: 25000 })
    await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await page.waitForFunction(() => !!document.querySelector('[data-testid="deal-opex-table"]'), { timeout: 25000 })
    await shoot('commercials', '#view-opportunity-detail')
    await page.close()
  }
} finally {
  await tearDown(TAG)
  await browser.close()
}
console.log(bad ? `\n${bad} state(s) with an overprint or a shrink` : '\nno overprint or shrink in any state')
