import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 140) })
const puppeteer = await loadPuppeteer('vanwalk')
let browser = null
const { oppId } = await freshOpportunity('R5REV')
try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })
  await page.evaluate((x) => navigate('opportunity-detail', x), oppId)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    return document.querySelectorAll('#ref-vanilla .ref-field-display').length > 5
      && v && !v.classList.contains('is-loading')
  }, { timeout: 30000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="reference"]')?.click())
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await settle()

  const shape = await page.evaluate(() => ({
    vanillaRows: document.querySelectorAll('#ref-vanilla .ref-field-display').length,
    reactRows: document.querySelectorAll('#ref-root [data-field]').length,
    vanillaHidden: document.getElementById('ref-vanilla')?.classList.contains('hidden'),
  }))
  check('THE VANILLA REFERENCE IS LIVE, and React never mounted',
    shape.vanillaRows > 20 && shape.reactRows === 0 && shape.vanillaHidden === false,
    JSON.stringify(shape))

  // Its own write path: open a row, type, save, read back from the server.
  await page.evaluate(() => document.getElementById('ref-display-country')?.scrollIntoView({ block: 'center' }))
  await settle()
  await page.click('#ref-display-country')
  await settle()
  check('a vanilla row opens', await page.evaluate(() =>
    !document.getElementById('ref-edit-country')?.classList.contains('hidden')))
  await page.click('#ref-input-country')
  await page.keyboard.type('Vietnam', { delay: 10 })
  await settle()
  check('and the vanilla edit bar woke', await page.evaluate(() =>
    document.getElementById('ref-save-all')?.classList.contains('tab-action-idle') === false))
  await page.evaluate(() => document.getElementById('ref-save-all')?.scrollIntoView({ block: 'center' }))
  await settle()
  await page.click('#ref-save-all')
  let saved = null
  for (let i = 0; i < 40; i++) {
    saved = (await api('GET', `/opportunities/${oppId}`)).data
    if (String(saved.payload.country ?? '') === 'Vietnam') break
    await new Promise((r) => setTimeout(r, 500))
  }
  check('THE VANILLA WRITE PATH ROUND-TRIPPED', String(saved?.payload?.country) === 'Vietnam',
    String(saved?.payload?.country))
  check('no page errors under the vanilla', errs.length === 0, errs.slice(0, 2).join(' | '))
} catch (e) {
  R.push({ n: 'THREW: ' + String(e.message).slice(0, 130), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
}
const failed = R.filter((r) => !r.p)
console.log(`\nVANILLA REFERENCE: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
