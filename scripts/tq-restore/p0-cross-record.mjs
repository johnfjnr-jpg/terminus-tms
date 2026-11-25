#!/usr/bin/env node
// TQ_RESTORE Phase 0, a side measurement the P3 readings raised: does the
// Commercials form show record A's values on record B when B is opened after
// A in one page? Two Commercials-priced fixtures, A at 10 units and B at 20,
// set through the route. READ lines only; nothing is saved from the screen.
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/tq-restore/p0-cross-record.mjs [tag]
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { api } from '../api-client.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { readFileSync } from 'node:fs'

const TAG = process.argv[2] ?? `tqx${Date.now().toString(36)}`
const read = (name, value) => console.log(`READ ${name}: ${JSON.stringify(value)}`)
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const db = admin()
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const puppeteer = await loadPuppeteer('tq-restore p0-cross-record')
const rev = async (id) => must(await db.from('record_revisions').select('revision_number, payload').eq('record_id', id)
  .order('revision_number', { ascending: false }).limit(1).single(), 'rev')
let browser
const TA = `${TAG}a`, TB = `${TAG}b`
try {
  const A = await freshOpportunity(TA), B = await freshOpportunity(TB)
  await api('PATCH', `/opportunities/${A.oppId}`, { payload: { ssNew: 10, duration: 36 }, expected_revision: (await rev(A.oppId)).revision_number })
  await api('PATCH', `/opportunities/${B.oppId}`, { payload: { ssNew: 20, duration: 48 }, expected_revision: (await rev(B.oppId)).revision_number })
  const pick = (p) => ({ ssNew: p.ssNew, duration: p.duration })
  read('records', { A: pick((await rev(A.oppId)).payload), B: pick((await rev(B.oppId)).payload) })
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1240, height: 1000 })
  const patches = []
  page.on('request', (q) => { if (q.method() === 'PATCH') patches.push(new URL(q.url()).pathname) })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${REF}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  const open = async (id, name) => {
    await page.evaluate((i) => navigate('opportunity-detail', i), id)
    await page.waitForFunction((n) => (window.__oppLoadsInFlight?.() ?? 1) === 0 && !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading')
      && (document.getElementById('view-opportunity-detail')?.innerText ?? '').includes(n), { timeout: 30000 }, name)
    await page.click('#opp-detail-tabs [data-opp-tab="commercial"]')
    await new Promise((r) => setTimeout(r, 2000))
    return page.evaluate(() => ({ ssNew: document.getElementById('deal-ssNew')?.value ?? null, saveDisabled: document.getElementById('btn-save-deal')?.disabled ?? null, unsaved: !!document.querySelector('[data-testid="stmt-unsaved"]') }))
  }
  read('A opened first', await open(A.oppId, `${TA} Opportunity`))
  read('B opened second', await open(B.oppId, `${TB} Opportunity`))
  read('A opened third', await open(A.oppId, `${TA} Opportunity`))
  // THE SAVE: on B, opened after A, a person changes ONE field (units to 21)
  // and saves. What lands on B's record for the field nobody touched?
  read('B opened fourth', await open(B.oppId, `${TB} Opportunity`))
  read('B screen duration before the edit', await page.evaluate(() => document.getElementById('deal-duration')?.value ?? null))
  await page.click('#deal-ssNew'); await page.keyboard.press('End')
  const len = await page.$eval('#deal-ssNew', (el) => el.value.length)
  for (let i = 0; i < len; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('21'); await page.keyboard.press('Tab')
  await page.waitForFunction(() => !document.getElementById('btn-save-deal')?.disabled, { timeout: 10000 })
  await page.click('#btn-save-deal')
  for (let i = 0; i < 40; i++) { if ((await rev(B.oppId)).payload.ssNew === 21) break; await new Promise((r) => setTimeout(r, 500)) }
  read('records after the save on B', { A: pick((await rev(A.oppId)).payload), B: pick((await rev(B.oppId)).payload) })
  await page.reload({ waitUntil: 'networkidle0' })
  read('B after a full page reload', await open(B.oppId, `${TB} Opportunity`))
  read('PATCHes sent by the page', patches)
} finally {
  await browser?.close()
  await tearDown(TA)
  await tearDown(TB)
}
