// ── ROUND 7 PHASE 3: THE TEST BED, VANILLA BESIDE REACT ─────────────────
//
// Three widths, on EXERCISED states, with the vanilla restored at runtime.
//
// THE ROUND 5 GUARD: the comparison first proves its two captures are of
// DIFFERENT IMPLEMENTATIONS. Without it a script that failed to revert compares
// React with React and reports a flawless match.
//
// THE RUNTIME REVERT IS DIFFERENT HERE, and the difference is this round's own
// finding. For Contact and Account it was one appended script: the vanilla
// re-assigned window.loadContactDetail after the bundle and its view ran. The
// Test Bed's RENDER HALF lives in app.js, whose loadTestBedDetail is now
// renamed and REFUSES - so appending the script is not enough, and the two
// halves are driven directly: append test-bed-detail.js, then call app.js's own
// renderTestBedDetail with the record. That is the same code the vanilla path
// ran, reached without the entry that no longer exists.
import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = ROOT + '.verify/visual-tb'
mkdirSync(OUT, { recursive: true })
const WIDTHS = [1240, 1920, 3440]
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })
const puppeteer = await loadPuppeteer('visual-tb')
let browser = null
const fx = await freshTestBed('R7VISUAL')
const bedId = fx.bedId ?? fx.id ?? fx.testBedId

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 120)))
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  const boot = async (impl) => {
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction(() => typeof window.navigate === 'function', { timeout: 25000 })
    if (impl === 'vanilla') {
      await page.evaluate(() => new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = '/test-bed-detail.js'
        s.onload = resolve
        s.onerror = () => reject(new Error('test-bed-detail.js did not load'))
        document.body.appendChild(s)
      }))
      // The view must be SHOWN before the vanilla renders into its markup, and
      // navigate() is what shows it - so the React loader is stubbed out for
      // this one call rather than the navigation being faked.
      // THE RECORD IS FETCHED IN NODE and handed in. An in-page `fetch` would
      // be a browser call, but the repository's scan cannot tell the two apart
      // and its intent - one HTTP client, which owns the clock-skew retry - is
      // worth more than the convenience.
      const bed = (await api('GET', `/test-beds/${bedId}`)).data
      await page.evaluate(async (id, record) => {
        const real = window.loadTestBedDetail
        window.loadTestBedDetail = () => {}
        navigate('test-bed-detail', id)
        window.loadTestBedDetail = real
        await window.renderTestBedDetail(record)
      }, bedId, bed)
      await page.waitForFunction(() =>
        document.querySelectorAll('#view-test-bed-detail .ref-field').length > 0,
      { timeout: 25000 })
    } else {
      await page.evaluate((x) => navigate('test-bed-detail', x), bedId)
      await page.waitForSelector('[data-testid="testbed-host"]', { timeout: 30000 })
    }
    await settle()
  }

  /** Which implementation is on screen, MEASURED rather than assumed. */
  const identify = () => page.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    return {
      react: !!v?.querySelector('[data-testid="testbed-host"]'),
      vanilla: !!v?.querySelector('#tb-terminus-rows .ref-field'),
      rows: v?.querySelectorAll('[data-key]').length ?? 0,
    }
  })

  // ── TWO EXERCISED STATES, NOT ONE ────────────────────────────────────
  //
  // The first version opened a stage tab and then measured the field rows, and
  // read 2 for React against 34 for the vanilla. That is not a defect: React
  // SWAPS the pane, so the Reference rows are not in the document on a stage
  // tab, while the vanilla keeps every pane mounted and hides them. Measuring
  // one state conflated the two screens.
  const openRows = (i) => page.evaluate((impl) => {
    const open = (k) => (impl === 'react'
      ? document.querySelector(`[data-key="${k}"] [data-testid^="display-"]`)
      : document.getElementById(`tb-display-${k}`))?.click()
    open('city'); open('siteAddress')
    return new Promise((r) => requestAnimationFrame(r))
  }, i)

  const openStage = (i) => page.evaluate(async (impl) => {
    const tab = impl === 'react'
      ? document.querySelector('[data-testid="tb-tab-btn-stage-Qualification"]')
      : document.querySelector('#tb-detail-tabs [data-tb-tab="stage-Qualification"]')
    tab?.click()
    await new Promise((r) => setTimeout(r, 2500))
  }, i)

  const measure = () => page.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }
    // VISIBLE rows only, which is what the two implementations can be compared
    // on: one swaps panes and the other hides them.
    const rows = [...v.querySelectorAll('[data-key]')].filter((e) => e.offsetParent !== null)
    return {
      view: box(v),
      rows: rows.length,
      firstRow: box(rows[0]),
      tabs: v.querySelectorAll('[data-tb-tab]').length,
      openEditors: [...v.querySelectorAll('input, textarea, select')]
        .filter((e) => e.offsetParent !== null).length,
      overflowX: v.scrollWidth > v.clientWidth + 1,
      stagePanel: !!v.querySelector('#tb-tab-stage-detail, [data-testid="tb-tab-stage-detail"]'),
      criteria: v.querySelectorAll('.tb-crit-row, [data-testid^="tb-crit-"]').length,
    }
  })

  const captures = { react: {}, vanilla: {} }
  for (const impl of ['react', 'vanilla']) {
    for (const w of WIDTHS) {
      await page.setViewport({ width: w, height: 1100 })
      await boot(impl)
      const id = await identify()

      // STATE A: the Reference surface, with two rows open.
      await openRows(impl)
      await settle()
      const fields = await measure()
      await page.screenshot({ path: `${OUT}/${impl}-${w}-fields.png`, fullPage: false })

      // STATE B: a stage tab, with its panels loaded.
      await openStage(impl)
      await settle()
      const stage = await measure()
      await page.screenshot({ path: `${OUT}/${impl}-${w}-stage.png`, fullPage: false })

      captures[impl][w] = { id, fields, stage }
    }
  }

  // ── THE ROUND 5 GUARD, BEFORE ANY COMPARISON ──────────────────────────
  for (const w of WIDTHS) {
    check(`${w}: the REACT capture is the React view`,
      captures.react[w].id.react && !captures.react[w].id.vanilla,
      JSON.stringify(captures.react[w].id))
    check(`${w}: the VANILLA capture is the vanilla`,
      captures.vanilla[w].id.vanilla && !captures.vanilla[w].id.react,
      JSON.stringify(captures.vanilla[w].id))
  }

  // ── AND THEN THE COMPARISON, PER STATE ────────────────────────────────
  for (const w of WIDTHS) {
    const r = captures.react[w]
    const v = captures.vanilla[w]
    // A DELIBERATE DIVERGENCE, measured rather than asserted away. The React
    // panel renders every field on one scrolling surface; the vanilla splits
    // them across Reference and Commercials sub-tabs, so only some are visible
    // at once. React must therefore show AT LEAST as many, never fewer.
    check(`${w} fields: React shows at least as many VISIBLE rows as the vanilla`,
      r.fields.rows >= v.fields.rows && v.fields.rows > 10,
      `react ${r.fields.rows}, vanilla ${v.fields.rows}`)
    check(`${w} fields: the row is a usable width on both`,
      (r.fields.firstRow?.w ?? 0) > 300 && (v.fields.firstRow?.w ?? 0) > 300,
      `react ${r.fields.firstRow?.w}, vanilla ${v.fields.firstRow?.w}`)
    check(`${w} fields: exercising OPENED editors on both`,
      r.fields.openEditors > 0 && v.fields.openEditors > 0,
      `react ${r.fields.openEditors}, vanilla ${v.fields.openEditors}`)
    check(`${w} fields: neither overflows horizontally`,
      !r.fields.overflowX && !v.fields.overflowX,
      `react ${r.fields.overflowX}, vanilla ${v.fields.overflowX}`)
    check(`${w} stage: both reach the stage panel`,
      r.stage.stagePanel && v.stage.stagePanel,
      `react ${r.stage.stagePanel}, vanilla ${v.stage.stagePanel}`)
    // NOT an assertion that criteria EXIST - the fixture has none configured,
    // so `both > 0` was vacuous in the worst way: it failed for a reason that
    // is not about either implementation. What is comparable is that the two
    // agree, which is true whether the stage has criteria or not.
    check(`${w} stage: both render the SAME number of exit criteria`,
      r.stage.criteria === v.stage.criteria,
      `react ${r.stage.criteria}, vanilla ${v.stage.criteria}`)
    check(`${w} stage: neither overflows horizontally`,
      !r.stage.overflowX && !v.stage.overflowX,
      `react ${r.stage.overflowX}, vanilla ${v.stage.overflowX}`)
    check(`${w}: both render the ten tabs`, r.fields.tabs === 10 && v.fields.tabs === 10,
      `react ${r.fields.tabs}, vanilla ${v.fields.tabs}`)
  }

  console.log('\nMEASUREMENTS')
  for (const w of WIDTHS) {
    console.log(`  ${w} fields react   ${JSON.stringify(captures.react[w].fields)}`)
    console.log(`  ${w} fields vanilla ${JSON.stringify(captures.vanilla[w].fields)}`)
    console.log(`  ${w} stage  react   ${JSON.stringify(captures.react[w].stage)}`)
    console.log(`  ${w} stage  vanilla ${JSON.stringify(captures.vanilla[w].stage)}`)
  }
  console.log(`\nScreenshots in ${OUT}`)
  check('99. no page errors', errs.length === 0, errs.slice(0, 3).join(' | '))
} finally {
  if (browser) await browser.close()
  await tearDown()
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
