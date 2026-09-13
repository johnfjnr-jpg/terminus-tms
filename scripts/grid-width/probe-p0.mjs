// ── PHASE 0: WHAT THE NEW LEAD GRID ACTUALLY DOES ────────────────────────
//
// Round A asserted the content was SCROLLABLE and passed. This measures the
// OUTCOMES instead: how wide the modal is against the viewport, how many
// columns a person can see without scrolling, whether a scroll bar has any
// rendered height, and where the container is scrolled to on open.
//
// READ-ONLY. It opens a modal and types nothing.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('grid-width/probe-p0.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/gridw/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }

const browser = await puppeteer.launch({ headless: 'new' })
const results = {}
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })

  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1100 })
    // Fresh load per width: Verification 7's clause, a measurement taken on
    // a tree an earlier iteration already mutated is not a measurement.
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction(() => !!document.getElementById('btn-new-contact'), { timeout: 20000 })
    await page.evaluate(() => document.getElementById('btn-new-contact').click())
    // Wait on RENDERED CONTENT the grid alone can produce, never on the
    // modal losing `hidden` - the modal exists either way.
    await page.waitForFunction(() =>
      document.querySelectorAll('[data-testid^="nlg-th-"]').length >= 15, { timeout: 20000 })
    await new Promise((r) => setTimeout(r, 600))

    const m = await page.evaluate(() => {
      const panel = document.querySelector('#new-contact-form .modal-panel')
      const scroll = document.querySelector('.new-lead-scroll')
      const table = document.querySelector('.new-lead-table')
      const ths = [...document.querySelectorAll('[data-testid^="nlg-th-"]')]
      const sb = scroll.getBoundingClientRect()

      // (a) COLUMNS FULLY VISIBLE: a column counts only when its WHOLE width
      // lies inside the scroll container's viewport. Not "exists", not
      // "intersects" - a half-cut column is not readable.
      const fully = ths.filter((th) => {
        const r = th.getBoundingClientRect()
        return r.left >= sb.left - 0.5 && r.right <= sb.right + 0.5
      })

      // (b) THE SCROLL BAR'S RENDERED HEIGHT. offsetHeight includes the
      // scrollbar gutter; clientHeight does not. A platform OVERLAY
      // scrollbar consumes ZERO and is invisible until you scroll.
      const barH = scroll.offsetHeight - scroll.clientHeight
      const barW = scroll.offsetWidth - scroll.clientWidth

      const cs = getComputedStyle(scroll)
      return {
        viewport: window.innerWidth,
        panelWidth: Math.round(panel.getBoundingClientRect().width),
        panelPctOfViewport: Math.round(panel.getBoundingClientRect().width / window.innerWidth * 100),
        scrollClientWidth: scroll.clientWidth,
        scrollContentWidth: scroll.scrollWidth,
        tableWidth: Math.round(table.getBoundingClientRect().width),
        overflows: scroll.scrollWidth > scroll.clientWidth,
        scrollLeftOnOpen: scroll.scrollLeft,
        columnsTotal: ths.length,
        columnsFullyVisible: fully.length,
        firstVisible: fully[0]?.dataset.testid ?? null,
        lastVisible: fully[fully.length - 1]?.dataset.testid ?? null,
        nameFullyVisible: fully.some((t) => t.dataset.testid === 'nlg-th-name'),
        horizontalBarHeightPx: barH,
        verticalBarWidthPx: barW,
        overflowX: cs.overflowX, overflowY: cs.overflowY,
        scrollbarWidthProp: cs.scrollbarWidth ?? '(unsupported)',
      }
    })
    results[w] = m

    const panel = await page.$('#new-contact-form .modal-panel')
    await panel.screenshot({ path: `${OUT}p0-modal-${w}.png` })
    await page.screenshot({ path: `${OUT}p0-page-${w}.png` })
    const bytes = statSync(`${OUT}p0-modal-${w}.png`).size
    if (bytes < 1000) { console.error(`capture at ${w} is ${bytes} bytes, not evidence`); process.exit(2) }

    console.log(`=== ${w} ===`)
    for (const [k, v] of Object.entries(m)) console.log(`  ${k.padEnd(22)} ${v}`)
    console.log(`  screenshot ${bytes} bytes\n`)
  }
} finally { await browser.close() }

console.log('=== THE THREE CLAIMS, AS THEY STAND TODAY ===')
for (const [w, m] of Object.entries(results)) {
  console.log(`  ${w}: modal ${m.panelWidth}px = ${m.panelPctOfViewport}% of viewport`)
  console.log(`        (a) ${m.columnsFullyVisible}/${m.columnsTotal} columns fully visible`)
  console.log(`        (b) horizontal scroll bar rendered height: ${m.horizontalBarHeightPx}px`)
  console.log(`        (c) NAME fully visible: ${m.nameFullyVisible}   scrollLeft on open: ${m.scrollLeftOnOpen}`)
}
