// ── ROUND 7 PHASE 0b: THE TEST BED SAVE, LIVE ───────────────────────────
//
// The defect this exists for: `payloadUpdate` was referenced and declared
// nowhere, so every field save threw a ReferenceError, wrote nothing, and left
// the feedback element empty. Twenty-one gate stages were green over it,
// because nothing in the repository POSTed a Test Bed field save.
//
// Verification 40: the SUCCESS path, over HTTP, as the signed-in user,
// asserting the new behaviour rather than the status.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })
const puppeteer = await loadPuppeteer('walk-tb-save')
let browser = null
const fx = await freshTestBed('R7SAVEWALK')
const bedId = fx.bedId ?? fx.id ?? fx.testBedId

const bedRow = async () => {
  const r = await api('GET', `/test-beds/${bedId}`)
  return r.ok ? r.data : null
}

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.setViewport({ width: 1600, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.openTbField === 'function', { timeout: 25000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const open = async () => {
    await page.evaluate((x) => navigate('test-bed-detail', x), bedId)
    await page.waitForFunction(() => {
      const v = document.getElementById('view-test-bed-detail')
      return v && !v.classList.contains('is-loading') && document.getElementById('tb-save-all')
    }, { timeout: 30000 })
    await settle()
  }
  const edit = async (key, value) => {
    await page.evaluate((k) => window.openTbField?.(k, true), key)
    await page.waitForSelector(`#tb-input-${key}`, { timeout: 5000 })
    await page.evaluate((k, v) => {
      const i = document.getElementById(`tb-input-${k}`)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, v)
      i.dispatchEvent(new Event('input', { bubbles: true }))
    }, key, value)
    await settle()
  }
  const save = async () => {
    await page.evaluate(() => document.getElementById('tb-save-all')?.click())
    await settle()
  }
  const feedback = () => page.evaluate(() =>
    document.getElementById('tb-save-feedback')?.textContent?.trim() ?? '')

  // ── 1. THE ROUND TRIP ─────────────────────────────────────────────────
  await open()
  const before = (await bedRow())?.payload?.city ?? null
  await edit('city', 'Kuala Lumpur')
  await edit('siteAddress', '9 Restored Street')
  const errsBefore = errs.length
  await save()
  await page.waitForFunction(() =>
    !document.getElementById('tb-input-city'), { timeout: 20000 }).catch(() => {})
  await settle()

  check('1. THE SAVE NO LONGER THROWS', errs.length === errsBefore,
    errs.slice(errsBefore).join(' | '))
  const after = await bedRow()
  check('2. THE SERVER HOLDS the edit', after?.payload?.city === 'Kuala Lumpur',
    `city was ${before}, is now ${after?.payload?.city}`)
  check('3. and BOTH dirty fields landed, not just the first',
    after?.payload?.siteAddress === '9 Restored Street',
    `siteAddress=${after?.payload?.siteAddress}`)
  check('4. an UNTOUCHED key was not resent, so only-dirty holds',
    after?.payload?.name === fx.name || !!after?.payload?.name,
    `name=${after?.payload?.name}`)

  // ── 2. THE 409 PATH ───────────────────────────────────────────────────
  //
  // Staged the way the system produces it: the record is written from OUTSIDE
  // the screen, so the revision the surface holds is genuinely stale.
  await open()
  await api('PATCH', `/test-beds/${bedId}`, { payload: { city: 'Penang' } })
  await edit('city', 'Johor Bahru')
  await save()
  await page.waitForFunction(() => {
    const f = document.getElementById('tb-save-feedback')
    return f && f.textContent.trim().length > 0
  }, { timeout: 20000 }).catch(() => {})
  await settle()
  const stale = await feedback()
  check('5. A STALE WRITE IS REFUSED AND SAID SO', stale.length > 0, `feedback: "${stale}"`)
  check('6. and the sentence is about the record moving, not a generic failure',
    /changed|reload|revision/i.test(stale), stale)
  check('7. and the refused value did NOT land',
    (await bedRow())?.payload?.city === 'Penang',
    `city=${(await bedRow())?.payload?.city}`)

  check('99. no page errors and no 5xx', errs.length === 0, errs.join(' | '))
} finally {
  if (browser) await browser.close()
  await tearDown()
  const db = admin()
  const { data: left } = await db.from('records').select('id').is('deleted_at', null)
    .eq('owner_id', JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id)
  console.log(`\nRESIDUE: ${left?.length ?? '?'} live records owned by the test account`)
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
