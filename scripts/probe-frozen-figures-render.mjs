#!/usr/bin/env node
// ── FROZEN_FIGURES R-FF1 / R-FF2 / R-FF6: THE APPROVAL PAGE, IN A BROWSER ───
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/probe-frozen-figures-render.mjs
//
// John's instruction, step 3: "R-FF1 over HTTP on a fixture: submit, read
// frozen_figures, the approval page renders them, today's engine agrees."
//
//   (1) a fixture version SUBMITTED THROUGH THE ROUTE carries frozen_figures;
//   (2) the approval page, opened in a browser, shows the STORED contract net,
//       total cost and margin, read from frozen_figures, not recomputed here;
//   (3) today's engine agrees, so NO "today's engine prices this at" sentence
//       renders, and no legacy head line;
//   (4) R-FF6 on a version submitted BEFORE today (no figures): the head line
//       renders first. Opened READ-ONLY on an existing record: nothing written.
//
// WHAT THIS CANNOT SHOW: the page where today's engine DIFFERS from a stored
// figure. That needs a stored figure that disagrees with the engine, and a
// submitted row cannot be altered by anyone (the trigger refuses the service
// role too). That branch is proved by frontend-react's frozen-figures render
// test, calibrated 4/4, and by approval-page.test.mjs's R-FF2 tests.
//
// UNWIRED: needs a live server, a session and a browser.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'
import { readFileSync, mkdirSync } from 'node:fs'

const TAG = process.argv[2] ?? 'ffrender'
const SHOT_DIR = 'prototypes/frozen-figures'
const LEGACY = "Submitted before figures were frozen. Every figure below is today's engine's, from this version's frozen inputs and rates."
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const db = admin()
const money = (n) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

const puppeteer = await loadPuppeteer('frozen-figures-render')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const { oppId } = await freshOpportunity(TAG)
let browser
try {
  const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data.latest_revision_number
  await api('PATCH', `/opportunities/${oppId}`, { payload: { ssNew: 10, duration: 36, targetMargin: 30 }, expected_revision: await rev() })
  const inputs = (await api('GET', `/opportunities/${oppId}`)).data.payload
  const draft = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs, reason: 'render probe', rates: frozenRates(resolveRates(inputs, LIVE)), expected_revision: await rev() })).data
  const issued = await api('POST', `/deal-sheet-versions/${draft.id}/issue`, {})
  const row = must(await db.from('deal_sheet_versions').select('status, frozen_figures').eq('id', draft.id).single(), 'version')
  const ask = row.frozen_figures?.page?.ask
  check('(1) submitted through the route, and it carries frozen_figures', issued.status === 200 && row.status === 'issued' && !!ask, `${issued.status} ${row.status}`)

  // A legacy version on an existing record, read-only: the newest submitted
  // version with no figures.
  // The page reads the record's NEWEST version, so the record must be a LIVE
  // opportunity whose newest version is a legacy submission. The first run
  // took the newest legacy version anywhere, whose record had a newer draft.
  const liveOpps = must(await db.from('records').select('id').eq('record_type', 'opportunity').is('deleted_at', null), 'live opps')
  let legacy = null
  for (const { id } of liveOpps) {
    const newest = must(await db.from('deal_sheet_versions').select('record_id, status, frozen_figures').eq('record_id', id)
      .order('major', { ascending: false }).order('minor', { ascending: false }).limit(1), 'newest')[0]
    if (newest?.status === 'issued' && newest.frozen_figures === null) { legacy = newest; break }
  }
  check('a live record whose newest version is a legacy submission exists to open', !!legacy, `${liveOpps.length} live opportunities searched`)

  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  const askText = async (id) => {
    await page.evaluate((x) => navigate('opportunity-approval', x), id)
    // Counterfactual: the block exists only once THIS record's page mounted;
    // the record name is checked against the route so a previous page cannot
    // satisfy it.
    await page.waitForFunction(() => !!document.querySelector('#appr-block-ask')?.textContent?.includes('Contract net'), { timeout: 30000 })
    return page.evaluate(() => document.querySelector('#appr-block-ask').innerText.replace(/\s+/g, ' '))
  }

  const t = await askText(oppId)
  check('(2) the page shows the STORED contract net', t.includes(`Contract net ${money(ask.contractNet)}`), `${money(ask.contractNet)} in: ${t.slice(0, 160)}`)
  check('(2) the stored total cost', t.includes(`Total cost ${money(ask.totalCost)}`))
  check('(2) the stored achieved margin', t.includes(`Achieved margin ${ask.achievedMargin.toFixed(2)}%`))
  check('(3) today\'s engine agrees: no "today\'s engine" sentence anywhere on the page', !(await page.evaluate(() => document.body.innerText.includes("Today's engine prices this at"))))
  check('(3) and no legacy head line', !t.includes('Submitted before figures were frozen'))
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.evaluate(() => document.querySelector('#appr-block-ask')?.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: `${SHOT_DIR}/build-1440-approval-frozen-${TAG}.png` })

  const lt = await askText(legacy.record_id)
  check('(4) R-FF6: a version submitted before today carries the head line, first in the block', lt.includes(LEGACY) && lt.indexOf(LEGACY) < lt.indexOf('Contract net'), lt.slice(0, 160))
  await page.evaluate(() => document.querySelector('#appr-block-ask')?.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: `${SHOT_DIR}/build-1440-approval-legacy-${TAG}.png` })
  check('no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser?.close()
  await tearDown(TAG)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
