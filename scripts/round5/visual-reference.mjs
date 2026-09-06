// ── ROUND 5 PHASE 2 ITEM 4: THE SURFACE AT THREE WIDTHS ─────────────────
//
// React and vanilla captured on the SAME record at each width, in the same
// exercised states. The vanilla is reached by un-hiding #ref-vanilla and
// calling its own render, which is what the load-order revert produces.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = process.env.SHOTS ?? '/tmp/ref-shots'
mkdirSync(OUT, { recursive: true })
const WIDTHS = [1240, 1920, 3440]
const SAA = 'commAddressSameAsAccount'
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 190) })
const puppeteer = await loadPuppeteer('visual-reference')
let browser = null
const { oppId } = await freshOpportunity('R5VIS')

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const arrive = async () => {
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
    await settle()
  }
  const shoot = async (name, width, sel) => {
    const el = await page.$(sel)
    if (!el) { check(`CAPTURE ${name}@${width}: the surface is on screen`, false, `no ${sel}`); return null }
    await el.scrollIntoView()
    await settle()
    const box = await el.boundingBox()
    // Verification 4 as refined: confirm the element is INSIDE the capture.
    if (!box || box.width < 200 || box.height < 60) {
      check(`CAPTURE ${name}@${width}: usable size`, false, JSON.stringify(box)); return null
    }
    await el.screenshot({ path: `${OUT}/${name}__${width}.png` })
    return box
  }

  const sizes = {}
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 1000 })
    await arrive()

    // ── THE REACT SURFACE, IN FOUR EXERCISED STATES ────────────────────
    sizes[`react-rest@${width}`] = await shoot('react-at-rest', width, '#ref-root')

    // rows open + the bar counting
    for (const n of ['country', 'lead', 'estClose']) {
      await page.evaluate((x) => document.querySelector(
        `#ref-root [data-testid="display-${x}"]`)?.scrollIntoView({ block: 'center' }), n)
      await settle()
      await page.click(`#ref-root [data-testid="display-${n}"]`)
      await settle()
    }
    await page.click('#ref-root [data-testid="input-country"]')
    await page.keyboard.type('Malaysia', { delay: 5 })
    await settle()
    const barText = await page.evaluate(() =>
      document.querySelector('#ref-root [data-testid="dirty-count"]')?.textContent ?? null)
    check(`the bar counts at ${width}`, /\d/.test(barText ?? ''), String(barText))
    await shoot('react-rows-open', width, '#ref-root')

    // same-as-account both branches
    await arrive()
    await shoot('react-saa-off', width, '#ref-root')
    await page.evaluate((s) => document.querySelector(
      `#ref-root [data-testid="input-${s}"]`)?.scrollIntoView({ block: 'center' }), SAA)
    await settle()
    await page.click(`#ref-root [data-testid="input-${SAA}"]`)
    await settle()
    const roOn = await page.evaluate(() =>
      document.querySelectorAll('#ref-root [data-readonly="true"]').length)
    check(`same-as-account ON swaps six rows at ${width}`, roOn === 11, String(roOn))
    await shoot('react-saa-on', width, '#ref-root')

    // ── THE VANILLA, SAME RECORD, SAME WIDTH ───────────────────────────
    //
    // Un-hiding #ref-vanilla and calling the vanilla's own render is what the
    // load-order revert produces, without editing the tree.
    await arrive()
    const vanillaRan = await page.evaluate(async (id) => {
      const v = document.getElementById('ref-vanilla')
      if (!v) return 'no #ref-vanilla'
      document.getElementById('ref-root')?.classList.add('hidden')
      v.classList.remove('hidden')
      // The vanilla module is not loaded (its tag is commented), so fetch and
      // evaluate it the way the restored script tag would.
      if (typeof window.__vanillaRefLoaded === 'undefined') {
        const src = await (await fetch('/opportunity-reference.js')).text()
        const blob = new Blob([src], { type: 'text/javascript' })
        await import(/* @vite-ignore */ URL.createObjectURL(blob))
        window.__vanillaRefLoaded = true
      }
      window.loadOpportunityDetail(id)
      return 'ok'
    }, oppId)
    check(`the VANILLA rendered for comparison at ${width}`, vanillaRan === 'ok', String(vanillaRan))
    if (vanillaRan === 'ok') {
      // Wait on the vanilla's OWN markup being populated, and on the sweep
      // having run - the rows exist before the record render finishes.
      await page.waitForFunction(() =>
        document.querySelectorAll('#ref-vanilla .ref-field-display').length > 5
        && !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading'),
      { timeout: 20000 }).catch(() => {})
      await settle()
      sizes[`vanilla-rest@${width}`] = await shoot('vanilla-at-rest', width, '#ref-vanilla')
      // The two deliberate divergences, MEASURED on the same record.
      const div = await page.evaluate(() => ({
        vanillaReadOnlyTabStops: [...document.querySelectorAll(
          '#ref-vanilla .ref-field-display.readonly')].filter((e) => e.getAttribute('tabindex') !== null).length,
        vanillaBarShowsCount: /\d/.test(
          (document.getElementById('ref-save-all')?.textContent ?? '')
          + (document.getElementById('ref-cancel-all')?.textContent ?? '')),
      }))
      check(`DIVERGENCE 1 at ${width}: the vanilla read-only rows DO carry tab stops`,
        div.vanillaReadOnlyTabStops > 0, `${div.vanillaReadOnlyTabStops} of them`)
      check(`DIVERGENCE 2 at ${width}: the vanilla bar shows NO count`,
        div.vanillaBarShowsCount === false, String(div.vanillaBarShowsCount))
    }
  }

  for (const [k, b] of Object.entries(sizes)) {
    if (!b) continue
    check(`${k} has a usable width`, b.width >= 300, String(Math.round(b.width)))
  }
  check('no page errors across the capture', errs.length === 0, errs.slice(0, 2).join(' | '))
  writeFileSync(`${OUT}/sizes.json`, JSON.stringify(sizes, null, 2))
} catch (err) {
  R.push({ n: 'VISUAL THREW: ' + String(err.message).slice(0, 150), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
}
const failed = R.filter((r) => !r.p)
console.log(`\nVISUAL: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
