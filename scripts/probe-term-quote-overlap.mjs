#!/usr/bin/env node
// TERM_QUOTES: the Term quote tab's layout, in every state, at every width
// (John's THEN: "overlap sweep 1240..1920 step 40, the Term quote tab in each
// state, Payment terms with factoring on included").
//
//   node scripts/probe-term-quote-overlap.mjs [tag]            1240, 1440, 1920 (the gate)
//   node scripts/probe-term-quote-overlap.mjs [tag] --sweep    1240 to 1920 in 40px steps
//
// The detector is the estate's own, scripts/lib/ink-overlap.mjs, which names
// nothing: an overprint is two ink atoms intersecting on both axes, and a
// shrunk item is a grid or flex child below its own min-content width. Plus
// one claim it does not make: the pane scrolls nothing sideways.
//
// The states, on ONE tagged record moved through them in order:
//   draft      the pricing step, a saved draft version
//   reopened   the banner, from a TAGGED FIXTURE draft whose stored snapshot
//              differs from today's (seeded by the service role; live settings
//              are read, never written)
//   payment    Payment terms with PO factoring on (unsaved, screen state)
//   quote      the Quote step
//   inactive   the tab when Commercials is the method
//   won        Closed Won (admin stage write and an approved raise, declared)
// Measure first, capture second (Verification 4): the captures at 1240 and
// 1920 are taken after every measurement, with the tab scrolled into view.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { inkOverlaps, shrunkBelowContent } from './lib/ink-overlap.mjs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { readTermState } from '../src/lib/term-params.js'

const args = process.argv.slice(2)
const TAG = args.find((a) => !a.startsWith('--')) ?? 'tqlay'
const SWEEP = args.includes('--sweep')
const WIDTHS = SWEEP ? Array.from({ length: 18 }, (_, i) => 1240 + i * 40) : [1240, 1440, 1920]
const SHOT_DIR = '.verify/term-quotes'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }

const puppeteer = await loadPuppeteer('probe-term-quote-overlap.mjs')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const db = admin()
const today = await readTermState(db)
const QUOTE = { units: { safesight: 60, air_quality: 4, hemir: 1 }, termMonths: 120, paymentStructure: 'opex' }
const opp = await freshOpportunity(TAG, { pricingMethod: null })
const latest = async () => must(await db.from('record_revisions').select('payload, revision_number').eq('record_id', opp.oppId)
  .order('revision_number', { ascending: false }).limit(1).single(), 'latest revision')
let browser
try {
  // The record's quote and a draft, through the routes (the system's path).
  let r = await latest()
  must({ error: (await api('PATCH', `/opportunities/${opp.oppId}`, { payload: { termQuote: QUOTE }, expected_revision: r.revision_number })).status === 200 ? null : { message: 'termQuote PATCH' } }, 'quote')
  r = await latest()
  const draft = (await api('POST', `/opportunities/${opp.oppId}/deal-sheet-versions`, { kind: 'term_quote', inputs: QUOTE, reason: `${TAG} draft`, expected_revision: r.revision_number })).data

  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1240, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${REF}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  const open = async () => {
    await page.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await page.waitForFunction(() => (window.__oppLoadsInFlight?.() ?? 1) === 0
      && !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading'), { timeout: 30000 })
    await page.click('#opp-detail-tabs [data-opp-tab="term"]')
    await page.waitForFunction(() => !document.getElementById('opp-tab-term')?.classList.contains('hidden'), { timeout: 10000 })
  }
  const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))))

  const measure = async (state, ready) => {
    const ok = await page.waitForFunction(ready, { timeout: 20000 }).then(() => true, () => false)
    check(`${state}: the state is on screen`, ok)
    if (!ok) return
    const bad = []
    for (const w of WIDTHS) {
      await page.setViewport({ width: w, height: 1000 }); await settle()
      const ink = await page.evaluate(inkOverlaps, '#opp-tab-term')
      const shrunk = await page.evaluate(shrunkBelowContent, '#opp-tab-term')
      const side = await page.evaluate(() => { const p = document.getElementById('opp-tab-term'); return p.scrollWidth - p.clientWidth })
      if (ink.missing || ink.atoms < 5) bad.push(`${w}: only ${ink.atoms} atoms`)
      if (ink.hits.length) bad.push(`${w}: ${ink.hits.length} overprint(s) ${JSON.stringify(ink.hits.slice(0, 2))}`)
      if ((shrunk.hits ?? shrunk).length) bad.push(`${w}: shrunk ${JSON.stringify((shrunk.hits ?? shrunk).slice(0, 2))}`)
      if (side > 1) bad.push(`${w}: the pane scrolls ${side}px sideways`)
    }
    check(`${state}: no overprint, nothing below its content, no sideways scroll at ${WIDTHS.length} width(s)`, bad.length === 0, bad.slice(0, 3).join(' | '))
    for (const w of [1240, 1920]) {
      await page.setViewport({ width: w, height: 1000 }); await settle()
      await page.$eval('#opp-tab-term', (e) => e.scrollIntoView({ block: 'start' })); await settle()
      await page.screenshot({ path: `${SHOT_DIR}/${TAG}-${state}-${w}.png` })
    }
    await page.setViewport({ width: 1240, height: 1000 })
  }
  mkdirSync(SHOT_DIR, { recursive: true })

  await open()
  await measure('draft', () => !!document.querySelector('#opp-tab-term [data-testid="tp-breakdown-card"]') && !!document.querySelector('#opp-tab-term [data-testid="tq-version"]'))

  // The tagged fixture draft: today's parameters with ONE value moved.
  const stored = structuredClone(today.params)
  const cents = Math.round(Number(stored.PRICE_LADDER_BY_PRODUCT.safesight['120']) * 100) + 1000
  stored.PRICE_LADDER_BY_PRODUCT.safesight['120'] = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
  r = await latest()
  must(await db.rpc('insert_deal_sheet_version', {
    p_record_id: opp.oppId, p_expected_revision: r.revision_number, p_reason: `${TAG} FIXTURE draft, stored snapshot differs from today's`,
    p_inputs: QUOTE, p_rates: { params: stored, fixture: TAG }, p_sections: [], p_batch_id: null,
    p_created_by: session.user.id, p_created_by_email: null, p_kind: 'term_quote',
  }), 'fixture draft')
  await open()
  await measure('reopened', () => !!document.querySelector('#opp-tab-term [data-testid="tq-reopened"]'))

  await page.click('#opp-tab-term [data-testid="tp-tab-payment"]')
  await page.waitForSelector('#opp-tab-term [data-testid="tp-factoring-toggle"]', { timeout: 10000 })
  await page.click('#opp-tab-term [data-testid="tp-factoring-toggle"]')
  await page.waitForSelector('#opp-tab-term [data-testid="tp-fx-rate"]', { timeout: 10000 })
  await page.focus('#opp-tab-term [data-testid="tp-fx-rate"]'); await page.keyboard.type('1.0')
  await measure('payment', () => !!document.querySelector('#opp-tab-term [data-testid="tp-cf-lowest"]'))

  await page.click('#opp-tab-term [data-testid="tp-tab-quote"]')
  await measure('quote', () => !!document.querySelector('#opp-tab-term [data-testid="tp-panel-quote"]'))

  r = await latest()
  await api('PATCH', `/opportunities/${opp.oppId}`, { payload: { pricingMethod: 'commercials' }, expected_revision: r.revision_number })
  await open()
  await measure('inactive', () => !!document.querySelector('#opp-tab-term [data-testid="pm-inactive"]'))
  r = await latest()
  await api('PATCH', `/opportunities/${opp.oppId}`, { payload: { pricingMethod: 'term_quote' }, expected_revision: r.revision_number })

  // The win: an issued version, an approved raise into Closed Won, the stage.
  r = await latest()
  const v = (await api('POST', `/opportunities/${opp.oppId}/deal-sheet-versions`, { kind: 'term_quote', inputs: { ...QUOTE, termMonths: 96 }, reason: `${TAG} to win`, expected_revision: r.revision_number })).data
  await api('POST', `/deal-sheet-versions/${v.id}/issue`, {})
  const issued = must(await db.from('deal_sheet_versions').select('id, revision_number').eq('id', v.id).single(), 'issued')
  const rec = must(await db.from('records').select('status').eq('id', opp.oppId).single(), 'record')
  must(await db.from('transition_requests').insert({
    record_id: opp.oppId, record_type: 'opportunity', from_stage: rec.status, to_stage: 'Closed Won', kind: 'transition', status: 'approved',
    frozen_revision: issued.revision_number, frozen_version_id: issued.id, requested_by: session.user.id,
    closed_by: session.user.id, closed_at: new Date().toISOString(), close_reason: `${TAG}: the win, admin fixture`,
  }).select('id').single(), 'approved raise')
  must(await db.from('records').update({ status: 'Closed Won' }).eq('id', opp.oppId).select('id').single(), 'the win')
  await open()
  await measure('won', () => !!document.querySelector('#opp-tab-term [data-testid="tq-won-version"]'))
  check('the draft fixture was a term version', draft?.kind === 'term_quote')
} finally {
  await browser?.close()
  await tearDown(TAG)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
