// ── ROUND 6 PHASE 0: THE EST. CLOSE DATE WRITE PATH, LIVE ────────────────
//
// The jsdom suite asserts what the host HANDS the shell dialogue. This asserts
// what the SERVER ends up holding, which is the claim that matters: before this
// phase a person could type a date, press Save, and have it discarded silently.
//
// Verification 40: the success path is exercised over HTTP as the signed-in
// user, asserting the NEW BEHAVIOUR rather than a status. A suite made of
// refusals is satisfied by a route that refuses everything.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })
const puppeteer = await loadPuppeteer('walk-close-date')
let browser = null
const { oppId } = await freshOpportunity('R6CLOSE')

const iso = (daysFromNow) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}
const FIRST = iso(120)
const MOVED = iso(200)

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  if (await page.evaluate(() => !document.getElementById('view-auth')?.classList.contains('hidden'))) {
    throw new Error('NOT SIGNED IN')
  }
  await page.waitForFunction(() => typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  const open = async () => {
    await page.evaluate((x) => navigate('opportunity-detail', x), oppId)
    await page.waitForFunction(() => {
      const root = document.getElementById('ref-root')
      const v = document.getElementById('view-opportunity-detail')
      return root?.querySelector('[data-field]') && v && !v.classList.contains('is-loading')
    }, { timeout: 30000 })
    await page.evaluate(() => document.querySelector('[data-opp-tab="reference"]')?.click())
    await settle()
  }

  // A CONTROLLED INPUT IS DRIVEN WITH REAL KEYSTROKES. Verification 6's write
  // clause: a synthetic .value write is deduped by React's value tracker, so
  // the DOM shows the text while the component's state never received it.
  const typeDate = async (value) => {
    await page.evaluate(() => document.querySelector('[data-testid="display-estClose"]')?.click())
    await settle()
    await page.waitForSelector('[data-testid="input-estClose"]', { timeout: 5000 })
    await page.focus('[data-testid="input-estClose"]')
    await page.evaluate(() => {
      const i = document.querySelector('[data-testid="input-estClose"]')
      i.select?.()
    })
    await page.type('[data-testid="input-estClose"]', value.split('-').join(''))
    await settle()
  }
  const pressSave = async () => {
    await page.evaluate(() => document.querySelector('[data-testid="save-all"]')?.click())
    await settle()
  }
  const dialogueOpen = () => page.evaluate(() => {
    const f = document.getElementById('change-reason-form')
    return !!f && !f.classList.contains('hidden') && f.offsetParent !== null
  })
  const stored = async () => (await api('GET', `/opportunities/${oppId}`))?.opportunity_details?.forecast_close_date ?? null
  const moves = async () => (await api('GET', `/opportunities/${oppId}`))?.payload?.closeMoves ?? 0

  // ── 1. THE STARTING STATE, so the first-recording branch is reachable ──
  await open()
  check('0. a fresh opportunity holds no forecast close date', (await stored()) === null, `stored=${await stored()}`)

  // ── 2. FIRST RECORDING: no dialogue, and the server holds it ───────────
  await typeDate(FIRST)
  const beforeFirst = await page.$eval('[data-testid="input-estClose"]', (e) => e.value)
  check('1. the date reached the controlled input', beforeFirst === FIRST, `typed=${FIRST} read=${beforeFirst}`)
  await pressSave()
  check('2. a FIRST recording opens no dialogue', !(await dialogueOpen()))
  await page.waitForFunction(() => !document.querySelector('[data-testid="save-all"]')
    || document.querySelector('[data-testid="edit-bar"]')?.hasAttribute('hidden'), { timeout: 15000 }).catch(() => {})
  const afterFirst = await stored()
  check('3. THE SERVER HOLDS IT. This is the whole defect: before this phase '
    + 'the value was discarded', afterFirst === FIRST, `stored=${afterFirst} expected=${FIRST}`)
  check('4. and a first recording is NOT counted as a move', (await moves()) === 0, `closeMoves=${await moves()}`)

  // ── 3. A MOVE: the dialogue opens and nothing is written until confirmed ──
  await open()
  await typeDate(MOVED)
  await pressSave()
  check('5. a MOVE opens the reason dialogue', await dialogueOpen())
  check('6. and writes NOTHING before the reason is given', (await stored()) === FIRST,
    `stored=${await stored()} should still be ${FIRST}`)

  // ── 4. THE REASON-REQUIRED BRANCH, walked ──────────────────────────────
  await page.evaluate(() => {
    const i = document.getElementById('change-reason-input')
    if (i) i.value = ''
    document.getElementById('change-reason-confirm')?.click()
  })
  await settle()
  check('7. an EMPTY reason is refused and the dialogue stays open', await dialogueOpen())
  const emptyMsg = await page.evaluate(() =>
    document.getElementById('change-reason-error')?.textContent
    ?? document.getElementById('change-reason-form')?.textContent ?? '')
  check('8. and it says why', /reason/i.test(emptyMsg), emptyMsg.slice(0, 120))
  check('9. still nothing written', (await stored()) === FIRST, `stored=${await stored()}`)

  // ── 5. CONFIRMED WITH A REASON ─────────────────────────────────────────
  await page.focus('#change-reason-input')
  await page.type('#change-reason-input', 'Customer pushed the tender by two months')
  await page.evaluate(() => document.getElementById('change-reason-confirm')?.click())
  await page.waitForFunction(() => {
    const f = document.getElementById('change-reason-form')
    return !f || f.classList.contains('hidden') || f.offsetParent === null
  }, { timeout: 20000 }).catch(() => {})
  await settle()
  const afterMove = await stored()
  check('10. THE MOVE IS HELD BY THE SERVER', afterMove === MOVED, `stored=${afterMove} expected=${MOVED}`)
  check('11. and the move IS counted', (await moves()) === 1, `closeMoves=${await moves()}`)
  const notes = (await api('GET', `/opportunities/${oppId}`))?.payload?.notes ?? []
  check('12. the reason is written into the record as prose',
    notes.some((n) => /pushed the tender/i.test(n?.text ?? String(n))),
    JSON.stringify(notes[0] ?? null).slice(0, 160))

  check('99. no page errors and no 5xx', errs.length === 0, errs.join(' | '))
} finally {
  if (browser) await browser.close()
  await tearDown()
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
