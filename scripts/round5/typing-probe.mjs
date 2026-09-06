// ── ROUND 5 PHASE 3 ITEM 1c: TYPING, EVERY EDITOR KIND, LIVE ────────────
//
// The caret needs layout, so this is the half jsdom cannot do. It asserts the
// text arrives IN ORDER and the caret ADVANCES, on every editor kind rather
// than only the textarea that happened to show a symptom.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 190) })
const puppeteer = await loadPuppeteer('typing-probe')
let browser = null
const { oppId } = await freshOpportunity('R5TYPE')

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() =>
    typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })
  await page.evaluate((x) => navigate('opportunity-detail', x), oppId)
  await page.waitForFunction(() => {
    const r = document.getElementById('ref-root')
    const v = document.getElementById('view-opportunity-detail')
    return r?.querySelector('[data-field]') && v && !v.classList.contains('is-loading')
  }, { timeout: 30000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="reference"]')?.click())
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  await settle()

  // Free-text rows: the text must arrive IN ORDER and the caret must ADVANCE.
  for (const [name, text] of [['country', 'Malaysia'], ['summary', 'the exec summary'],
    ['customerLead', 'Wei Lin'], ['duration', '48']]) {
    await page.evaluate((x) => document.querySelector(
      `#ref-root [data-testid="display-${x}"]`)?.scrollIntoView({ block: 'center' }), name)
    await settle()
    await page.click(`#ref-root [data-testid="display-${name}"]`)
    await settle()
    const sel = `#ref-root [data-testid="input-${name}"]`
    await page.click(sel)
    await page.evaluate((s) => {
      const el = document.querySelector(s)
      el.setSelectionRange?.(0, el.value.length)
    }, sel)
    await page.keyboard.press('Backspace')
    await settle()
    await page.evaluate((s) => { document.querySelector(s).__stamp = 'orig' }, sel)

    const carets = []
    for (const ch of text) {
      await page.keyboard.type(ch, { delay: 15 })
      carets.push(await page.evaluate((s) => document.querySelector(s)?.selectionStart, sel))
    }
    await settle()
    const got = await page.evaluate((s) => ({
      value: document.querySelector(s)?.value,
      sameNode: document.querySelector(s)?.__stamp === 'orig',
    }), sel)
    check(`${name}: the text arrives IN ORDER`, got.value === text,
      `typed "${text}", holds "${got.value}"`)
    const advancing = carets.every((c, i) => i === 0 || c === null || c > carets[i - 1])
    check(`${name}: and the caret ADVANCES`, advancing, `carets ${carets.join(',')}`)
    check(`${name}: and the editor is the SAME DOM node throughout`, got.sameNode === true)
  }

  // A select is not typed into, but it must survive a change without being
  // rebuilt - the same mechanism, a different control.
  await page.evaluate(() => document.querySelector(
    '#ref-root [data-testid="display-lead"]')?.scrollIntoView({ block: 'center' }))
  await settle()
  await page.click('#ref-root [data-testid="display-lead"]')
  await settle()
  await page.evaluate(() => { document.querySelector('#ref-root [data-testid="input-lead"]').__stamp = 'orig' })
  const opts = await page.evaluate(() =>
    [...document.querySelectorAll('#ref-root [data-testid="input-lead"] option')].map((o) => o.value))
  await page.select('#ref-root [data-testid="input-lead"]', opts[1])
  await settle()
  check('lead (select): survives a change as the same DOM node',
    await page.evaluate(() =>
      document.querySelector('#ref-root [data-testid="input-lead"]').__stamp === 'orig'))

  // A date row likewise.
  await page.evaluate(() => document.querySelector(
    '#ref-root [data-testid="display-actualClose"]')?.scrollIntoView({ block: 'center' }))
  await settle()
  await page.click('#ref-root [data-testid="display-actualClose"]')
  await settle()
  await page.evaluate(() => { document.querySelector('#ref-root [data-testid="input-actualClose"]').__stamp = 'orig' })
  await page.evaluate(() => {
    const el = document.querySelector('#ref-root [data-testid="input-actualClose"]')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '2027-01-31')
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
  check('actualClose (date): survives a change as the same DOM node',
    await page.evaluate(() =>
      document.querySelector('#ref-root [data-testid="input-actualClose"]').__stamp === 'orig'))

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
} catch (err) {
  R.push({ n: 'THREW: ' + String(err.message).slice(0, 150), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('id').eq('owner_id', uid).is('deleted_at', null)
  R.push({ n: 'RESIDUE: no live records', p: !q.error && q.data.length === 0,
    d: String(q.data?.length ?? '?') })
}
const failed = R.filter((r) => !r.p)
console.log(`\nTYPING: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
process.exit(failed.length ? 1 : 0)
