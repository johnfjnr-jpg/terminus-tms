// Does the reason survive repeated saves on ONE page, with NO viewport change?
// That is the difference between a defect a person meets and an artefact of a
// harness that resizes the window between captures.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const puppeteer = await loadPuppeteer('repeat-save')
let browser = null
const { oppId } = await freshOpportunity('R4REP')
{ const db = admin(); await db.from('records').update({ status: 'Proposal' }).eq('id', oppId) }
const rows = []
try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.evaluateOnNewDocument(() => {
    window.__mounts = 0
    let real = null
    Object.defineProperty(window, 'initOpportunityDealVersions', {
      configurable: true, get: () => real,
      set: (fn) => { real = (...a) => { window.__mounts++; return fn(...a) } },
    })
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const r = document.getElementById('deal-version-root')
    return r?.querySelector('#deal-version-panel') && (r.innerText ?? '').trim().length > 20
  }, { timeout: 30000 })
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  for (let n = 1; n <= 6; n++) {
    const was = await page.evaluate(() => document.getElementById('deal-ssExisting')?.value)
    await page.click('#deal-ssExisting')
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta')
    await page.type('#deal-ssExisting', String((Number(was) || 0) + 3), { delay: 1 })
    await settle()
    const REASON = `round ${n}: the rate card moved and the margin was held`
    await page.click('#deal-version-reason')
    await page.type('#deal-version-reason', REASON, { delay: 1 })
    await settle()
    const before = await page.evaluate(() => ({
      box: document.querySelector('#deal-version-root #deal-version-reason')?.value ?? '',
      mounts: window.__mounts,
      cardMounts: window.__cardMounts,
    }))
    await page.evaluate(() => document.querySelector('#deal-version-root #btn-save-version')?.click())
    await page.waitForFunction(() => {
      const p = document.querySelector('#deal-version-root #deal-version-feedback')
      return p && !p.className.includes('hidden') && (p.textContent ?? '').length > 0
    }, { timeout: 20000 }).catch(() => {})
    await settle()
    const fb = await page.evaluate(() => {
      const p = document.querySelector('#deal-version-root #deal-version-feedback')
      return { text: p?.textContent ?? '<none>', cls: p?.className ?? '' }
    })
    rows.push({ n, mounts: `${before.mounts}/${before.cardMounts}`, boxLen: before.box.length,
      ok: fb.cls.includes('msg-success'), text: fb.text.slice(0, 70) })
    await new Promise((r) => setTimeout(r, 1200))
  }
} catch (e) {
  rows.push({ n: '-', mounts: '-', boxLen: '-', ok: false, text: 'THREW ' + String(e.message).slice(0, 60) })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
}
console.log('\nSIX SAVES, ONE PAGE, NO VIEWPORT CHANGE')
console.log(' save  init/card  boxLen  result')
for (const r of rows) {
  console.log(`  ${String(r.n).padEnd(4)} ${String(r.mounts).padEnd(7)} ${String(r.boxLen).padEnd(7)} `
    + `${r.ok ? 'ok  ' : 'FAIL'} ${r.text}`)
}
console.log(rows.every((r) => r.ok)
  ? '\nALL SIX SUCCEEDED: repeated saves alone do not reproduce it.'
  : '\nREPRODUCED WITHOUT A VIEWPORT CHANGE: a person meets this.')
