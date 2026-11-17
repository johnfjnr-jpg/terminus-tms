#!/usr/bin/env node
// ── FROZEN_FIGURES R-FF4: A CLOSED WON DEAL'S PRICING CANNOT CHANGE ────────
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/probe-closed-won-pricing-click.mjs
//
// John's Phase 0 sign-off: pricing edits to a Closed Won record are REFUSED,
// server and client, with "This deal is Closed Won; its pricing is the won
// version's and cannot change." Non-pricing fields stay editable. "The refusal
// must reach the person (Commercials factoring B1 lesson): prove it from the
// click." The shape is probe-factoring-term-refusal-click.mjs's.
//
// THE FIXTURE'S STAGE IS AN ADMIN WRITE, AND SAYS SO (Verification 47's
// clause). One account cannot reach Closed Won through the system: the
// approvals on the way need a second person. The refusal reads the record's
// status and nothing about how it arrived there. Pricing is set first, through
// the route, while the record is still open, as the system would have it.
//
//   (a) the click: the ruled sentence shows in #deal-feedback, in the error
//       treatment; (b) no revision landed and the stored units are unchanged;
//   (b2) NO PATCH LEFT THE BROWSER, the claim only the client half makes;
//   (c) the server half over HTTP: a pricing PATCH is refused 409 with the
//       same sentence, and the record's fingerprint does not move;
//   (d) a non-pricing edit LANDS (the fingerprint moves), and so does one that
//       resends a saved price unchanged beside it;
//   (e) the headline says no approved version was won, on the detail screen.
//
// Every measurement precedes every capture. UNWIRED: needs a live server, a
// session and a browser. Run at the FROZEN_FIGURES build report.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { CLOSED_WON_PRICING_REFUSAL } from '../src/lib/pricing-keys.js'
import { NO_WON_VERSION_NOTE } from '../src/lib/opportunity-headline.js'

const TAG = process.argv[2] ?? 'ffwonclick'
const SHOT_DIR = 'prototypes/frozen-figures'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const rev = async (id) => (await api('GET', `/records/${id}/pulse`)).data.revision_number
const detail = async (id) => (await api('GET', `/opportunities/${id}`)).data ?? {}
// The fingerprint (Verification 40's clause): a 2xx is not a write, and a
// refusal is only proved by nothing having moved.
const fingerprint = async (db, id) => {
  const r = must(await db.from('records').select('status, updated_at').eq('id', id).single(), 'records')
  const { count } = await db.from('record_revisions').select('id', { count: 'exact', head: true }).eq('record_id', id)
  return JSON.stringify({ ...r, revisions: count, latest: await rev(id) })
}

const puppeteer = await loadPuppeteer('closed-won-pricing-click')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const db = admin()
const opp = await freshOpportunity(TAG)
let browser
try {
  let r = await rev(opp.oppId)
  const set = await api('PATCH', `/opportunities/${opp.oppId}`, { payload: { ssNew: 10, duration: 36 }, expected_revision: r })
  check('the fixture priced through the route while open', set.status === 200, `status ${set.status}`)
  must(await db.from('records').update({ status: 'Closed Won' }).eq('id', opp.oppId).select('id').single(), 'stage write')
  const d0 = await detail(opp.oppId)
  check('the fixture is Closed Won with 10 new units', d0.status === 'Closed Won' && d0.payload?.ssNew === 10, `${d0.status} ${d0.payload?.ssNew}`)

  // ── (e) THE HEADLINE, FROM THE ROUTE ───────────────────────────────────
  check('(e) the route says no approved version was won', d0.headline_note === NO_WON_VERSION_NOTE && d0.headline_source === 'live', JSON.stringify([d0.headline_source, d0.headline_note]))

  // ── (c) THE SERVER HALF ────────────────────────────────────────────────
  let fp = await fingerprint(db, opp.oppId)
  // The answer is RECORDED, never thrown on: a refusal that does not happen
  // must reach the check below and fail there (found by calibration: an
  // expect-409 threw on the 200 and the check was never reached).
  const refused = await api('PATCH', `/opportunities/${opp.oppId}`, { payload: { ssNew: 11 }, expected_revision: await rev(opp.oppId) },
    { expect: 409, because: 'R-FF4: a Closed Won pricing change is refused' })
    .catch((e) => ({ status: e.status, data: e.body?.got ?? e.body }))
  check('(c) a pricing PATCH is refused 409 with the ruled sentence', refused.status === 409 && refused.data?.error === CLOSED_WON_PRICING_REFUSAL, `${refused.status} ${JSON.stringify(refused.data)}`)
  check('(c) and nothing moved', (await fingerprint(db, opp.oppId)) === fp)

  // ── (d) NON-PRICING EDITS LAND ─────────────────────────────────────────
  fp = await fingerprint(db, opp.oppId)
  const note = await api('PATCH', `/opportunities/${opp.oppId}`, { payload: { summary: `${TAG} won summary` }, expected_revision: await rev(opp.oppId) })
  const fp2 = await fingerprint(db, opp.oppId)
  check('(d) a non-pricing edit lands: 200 and the fingerprint moved', note.status === 200 && fp2 !== fp && (await detail(opp.oppId)).payload?.summary === `${TAG} won summary`, `${note.status}`)
  const resend = await api('PATCH', `/opportunities/${opp.oppId}`, { payload: { ssNew: 10, summary: `${TAG} again` }, expected_revision: await rev(opp.oppId) })
  check('(d) resending a saved price beside it is not a change, and lands', resend.status === 200 && (await fingerprint(db, opp.oppId)) !== fp2, `${resend.status} ${JSON.stringify(resend.data?.error ?? '')}`)

  // ── (a) THE CLICK ──────────────────────────────────────────────────────
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const patches = []
  page.on('request', (q) => { if (q.method() === 'PATCH' && q.url().includes(`/opportunities/${opp.oppId}`)) patches.push(q.url()) })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
  // (e) on the screen: the note renders under the headline. Counterfactual:
  // absent on every stage but Closed Won, and before the record has loaded.
  const noteShown = await page.waitForFunction((t) => document.querySelector('[data-testid="opp-headline-note"]')?.textContent === t, { timeout: 30000 }, NO_WON_VERSION_NOTE).then(() => true, () => false)
  check('(e) the headline note renders on the detail screen', noteShown)
  // A RELATIONSHIP, not a property (Verification 4): the first build put the
  // note INSIDE the figure grid, where it became a cell and wrapped the strip
  // to two rows with every check above still green.
  const geo = await page.evaluate(() => {
    const grid = document.getElementById('opp-headline'), note = document.querySelector('[data-testid="opp-headline-note"]')
    const tops = [...grid.children].map((c) => Math.round(c.getBoundingClientRect().top))
    return { inGrid: grid.contains(note), visible: !!note && note.offsetParent !== null, cells: tops.length,
      oneRow: tops.length > 1 && new Set(tops).size === 1,
      gap: Math.round(note.getBoundingClientRect().top - grid.getBoundingClientRect().bottom) }
  })
  check('(e) the note is visible, OUTSIDE the grid, directly below it', geo.visible && !geo.inGrid && geo.gap >= 0 && geo.gap < 24, JSON.stringify(geo))
  check('(e) and the headline figures share ONE row', geo.oneRow, JSON.stringify(geo))
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  // Counterfactual: the input carries the stored 10 only once the panel has
  // mounted and hydrated.
  await page.waitForFunction(() => document.getElementById('deal-ssNew')?.value === '10', { timeout: 30000 })
  await page.waitForFunction(() => !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading'), { timeout: 30000 })
  r = await rev(opp.oppId)
  await page.click('#deal-ssNew')
  await page.keyboard.press('End')
  const len = await page.$eval('#deal-ssNew', (el) => el.value.length)
  for (let i = 0; i < len; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('12')
  await page.keyboard.press('Tab')
  await page.waitForFunction(() => !document.getElementById('btn-save-deal')?.disabled, { timeout: 10000 })
  await page.click('#btn-save-deal')
  const shown = await page.waitForFunction(() => (document.getElementById('deal-feedback')?.textContent ?? '').trim().length > 0, { timeout: 8000 }).then(() => true, () => false)
  const fb = await page.evaluate(() => {
    const el = document.getElementById('deal-feedback')
    return { text: el?.textContent?.trim() ?? null, cls: el?.className ?? null, visible: !!el && el.offsetParent !== null }
  })
  check('(a) the ruled sentence shows in the save feedback', shown && fb.text === CLOSED_WON_PRICING_REFUSAL && fb.visible, `shown ${shown}, ${JSON.stringify(fb)}`)
  check('(a) and it wears the error treatment', fb.cls === 'msg-error', JSON.stringify(fb.cls))
  const after = await detail(opp.oppId)
  check('(b) no revision landed and the stored units are still 10', (await rev(opp.oppId)) === r && after.payload?.ssNew === 10, `revision ${r}, ssNew ${after.payload?.ssNew}`)
  check('(b2) no PATCH left the browser: the client refused before the write', patches.length === 0, `${patches.length}`)
  check('no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.evaluate(() => document.getElementById('deal-feedback')?.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${SHOT_DIR}/build-1440-won-refusal-${TAG}.png` })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => document.querySelector('[data-testid="opp-headline-note"]')?.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${SHOT_DIR}/build-1440-won-headline-${TAG}.png` })
} finally {
  await browser?.close()
  await tearDown(TAG)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
