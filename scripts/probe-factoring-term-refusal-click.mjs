#!/usr/bin/env node
// ── COMMERCIALS_FACTORING B1: R-CF2'S CLIENT HALF, FROM THE CLICK ───────────
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/probe-factoring-term-refusal-click.mjs
//
// John's Phase 2 sign-off, B1. The server half of R-CF2 is proved over HTTP by
// probe-factoring-term-refusal.mjs. This drives the CLIENT half the way a person
// meets it: on a record this probe creates and tears down by tag, type a
// factoring term equal to the contract duration into the Commercials screen and
// press Save changes. Then:
//
//   (a) the ruled sentence shows in the save feedback (#deal-feedback);
//   (b) no revision landed, and the stored term is unchanged;
//   (b2) NO PATCH LEFT THE BROWSER. This is the one claim only the client half
//        makes. Without it the probe passes with the client check deleted or
//        moved after the write, because the server refuses with the same
//        sentence and nothing lands either way. Verification 9's injection
//        (move the check after the write) is answered by this line.
//   (c) the field shows the refusal state, not a saved value: it still holds the
//        typed term and the panel is still dirty (Save changes enabled), so the
//        screen does not present the refused term as saved;
//   (d) a valid term then saves: the revision moves, 35 is stored, the refusal
//        sentence is gone and the panel is clean.
//
// Every measurement precedes every capture (Verification 4's capture clause).
//
// UNWIRED: needs a live server, a session and a browser. Run at the
// COMMERCIALS_FACTORING Phase 3 report; its calibration run is recorded there.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'

const TAG = process.argv[2] ?? 'cfb1click'
const SHOT_DIR = 'prototypes/commercials-factoring'
const SENTENCE = (n, T) => `The factoring term must be a whole number of months from 1 to ${n}, so every repayment falls inside the ${T}-month contract.`
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const rev = async (id) => (await api('GET', `/records/${id}/pulse`)).data.revision_number
const stored = async (id) => (await api('GET', `/opportunities/${id}`)).data?.payload ?? {}

const puppeteer = await loadPuppeteer('factoring-term-refusal-click')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const opp = await freshOpportunity(TAG)
let browser
try {
  // The starting state through the route, as the system builds it: a 36-month
  // contract with a valid 12-month facility.
  let r = await rev(opp.oppId)
  await api('PATCH', `/opportunities/${opp.oppId}`, {
    payload: { duration: 36, factoring: { enabled: true, ratePct: 2, termMonths: 12, method: 'straight' } },
    expected_revision: r,
  })
  const p0 = await stored(opp.oppId)
  check('the fixture holds a 12-month facility on a 36-month contract', p0.duration === 36 && p0.factoring?.termMonths === 12, JSON.stringify(p0.factoring))

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
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  // Counterfactual: the input exists only once the panel has mounted with
  // factoring ON and the stored 12 hydrated; before that it is absent or empty.
  await page.waitForFunction(() => document.getElementById('deal-factoring-termMonths')?.value === '12', { timeout: 30000 })
  // A PROBE FAULT, found on the first run and kept named: the view wears
  // `is-loading` while it settles, and a click then lands on the view rather
  // than the input (elementFromPoint read DIV#view-opportunity-detail), so the
  // typing went nowhere and Save never enabled. Wait for the view to settle.
  await page.waitForFunction(() => !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading'), { timeout: 30000 })

  const typeTerm = async (v) => {
    // Real keys throughout (Verification 6's write clause). A triple-click did
    // not select the text here, so the old value is deleted key by key.
    await page.click('#deal-factoring-termMonths')
    await page.keyboard.press('End')
    const len = await page.$eval('#deal-factoring-termMonths', (el) => el.value.length)
    for (let i = 0; i < len; i++) await page.keyboard.press('Backspace')
    await page.keyboard.type(v)
    await page.keyboard.press('Tab')
  }
  const saveEnabled = () => page.evaluate(() => !document.getElementById('btn-save-deal')?.disabled)

  // ── THE REFUSAL ─────────────────────────────────────────────────────────
  r = await rev(opp.oppId)
  await typeTerm('36')
  await page.waitForFunction(() => !document.getElementById('btn-save-deal')?.disabled, { timeout: 10000 })
  await page.click('#btn-save-deal')
  // Wait on the state the refusal must produce. If it never comes, the
  // timeout is the finding and the other checks still run.
  const shown = await page.waitForFunction(() => (document.getElementById('deal-feedback')?.textContent ?? '').trim().length > 0, { timeout: 8000 })
    .then(() => true, () => false)
  const fb = await page.evaluate(() => {
    const el = document.getElementById('deal-feedback')
    return { text: el?.textContent?.trim() ?? null, cls: el?.className ?? null, visible: !!el && el.offsetParent !== null }
  })
  check('(a) the ruled sentence shows in the save feedback', shown && fb.text === SENTENCE(35, 36) && fb.visible, `shown ${shown}, text ${JSON.stringify(fb.text)}, class ${JSON.stringify(fb.cls)}`)
  check('(a) and it wears the error treatment', fb.cls === 'msg-error', JSON.stringify(fb.cls))
  const afterRev = await rev(opp.oppId)
  const afterTerm = (await stored(opp.oppId)).factoring?.termMonths
  check('(b) no revision landed, and the stored term is still 12', afterRev === r && afterTerm === 12, `revision ${r} -> ${afterRev}, stored ${afterTerm}`)
  check('(b2) no PATCH left the browser: the client refused before the write', patches.length === 0, `${patches.length} PATCH request(s)`)
  const fieldNow = await page.$eval('#deal-factoring-termMonths', (el) => el.value)
  check('(c) the field still holds the refused 36, not the saved 12', fieldNow === '36', `field ${JSON.stringify(fieldNow)}`)
  check('(c) and the panel is still dirty: Save changes stays enabled', await saveEnabled())
  check('no uncaught page error from the refusal', pageErrors.length === 0, pageErrors.join(' | '))
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.evaluate(() => document.getElementById('deal-feedback')?.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${SHOT_DIR}/p3-b1-1440-refusal-${TAG}.png` })

  // ── A VALID TERM THEN SAVES ─────────────────────────────────────────────
  r = await rev(opp.oppId)
  await typeTerm('35')
  await page.click('#btn-save-deal')
  let landed = r
  for (let i = 0; i < 60 && landed === r; i++) { await new Promise((s) => setTimeout(s, 250)); landed = await rev(opp.oppId) }
  check('(d) a valid 35 saves: the revision moved', landed === r + 1, `revision ${r} -> ${landed}`)
  check('(d) and 35 is stored', (await stored(opp.oppId)).factoring?.termMonths === 35)
  const clean = await page.waitForFunction(() => document.getElementById('btn-save-deal')?.disabled === true, { timeout: 10000 }).then(() => true, () => false)
  check('(d) the panel is clean after the save', clean)
  const fbAfter = await page.evaluate(() => (document.getElementById('deal-feedback')?.textContent ?? '').trim())
  check('(d) the refusal sentence no longer shows', fbAfter !== SENTENCE(35, 36), JSON.stringify(fbAfter))
  check('(d) exactly one PATCH, the valid one', patches.length === 1, `${patches.length}`)
} finally {
  await browser?.close()
  await tearDown(TAG)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
