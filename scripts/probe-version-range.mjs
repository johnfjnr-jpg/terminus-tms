// ── W4: THE VERSION PANEL STAYS USABLE AS MINOR VERSIONS ACCUMULATE ──────
//
// 2026-09-03. The panel was capped at 460px and listed every version. A deal
// re-priced through a negotiation accumulates minor versions faster than
// anything else on this screen, and each row carries a reason, an author, a
// timestamp and an approval line, so a narrow cap turns the history into a
// column of wrapped text.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const puppeteer = await loadPuppeteer('version-range')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const TAG = process.argv[2] ?? 'R41RANGE'
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE))

const { oppId } = await freshOpportunity(TAG)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const TOTAL = 12
for (let i = 0; i < TOTAL; i++) {
  const inputs = { targetMargin: 30 + i, ssNew: 10, duration: 36 }
  await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs, rates: priced(inputs), reason: `repricing pass ${i + 1}`, expected_revision: await rev() })
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
await page.waitForFunction(() => !!document.getElementById('deal-version-panel'), { timeout: 25000 })
await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
// Visibility, not geometry: a hidden panel still has layout.
await page.waitForFunction(() => {
  const p = document.getElementById('opp-tab-commercial')
  return p && !p.classList.contains('hidden') && getComputedStyle(p).visibility === 'visible'
}, { timeout: 20000 })
await page.waitForFunction(() =>
  document.querySelectorAll('#deal-version-list .ds-row').length > 0, { timeout: 20000 })

const state = () => page.evaluate(() => ({
  rows: document.querySelectorAll('#deal-version-list .ds-row').length,
  width: Math.round(document.getElementById('deal-version-panel').getBoundingClientRect().width),
  rangeShown: !document.getElementById('deal-version-range')?.classList.contains('hidden'),
  active: document.querySelector('#deal-version-range button.active')?.dataset.range ?? null,
  note: (document.getElementById('deal-version-range-note')?.innerText ?? '').trim(),
  labels: [...document.querySelectorAll('#deal-version-list .ds-label')].map(e => e.textContent.trim().split(/\s+/)[0]),
}))

let s = await state()
record('the panel runs full width, not capped at 460', s.width > 600, `${s.width}px`)
record('it opens on the last 5 of 12', s.rows === 5 && s.active === '5', `${s.rows} rows, active=${s.active}`)
record('and SAYS what is not listed', /7 older versions are not listed/.test(s.note), `"${s.note}"`)
record('the 5 shown are the NEWEST, not the oldest',
  s.labels[0] === 'V0.12' && s.labels[4] === 'V0.8', `${s.labels[0]} .. ${s.labels[4]}`)

await page.evaluate(() => document.querySelector('#deal-version-range button[data-range="10"]')?.click())
await new Promise((r) => setTimeout(r, 400))
s = await state()
record('Last 10 shows ten', s.rows === 10 && s.active === '10', `${s.rows} rows`)
record('and still says two are missing', /2 older versions are not listed/.test(s.note), `"${s.note}"`)

await page.evaluate(() => document.querySelector('#deal-version-range button[data-range="all"]')?.click())
await new Promise((r) => setTimeout(r, 400))
s = await state()
record('All shows every version', s.rows === TOTAL && s.active === 'all', `${s.rows} rows`)
record('and stops claiming anything is hidden', !/not listed/.test(s.note), `"${s.note}"`)

// ── THE CONTROL IS NOT OFFERED WHERE IT COULD DO NOTHING ─────────────────
const { oppId: few } = await freshOpportunity(`${TAG}FEW`)
const rev2 = async () => (await api('GET', `/opportunities/${few}`)).data?.latest_revision_number
for (let i = 0; i < 3; i++) {
  const inputs = { targetMargin: 30 + i, ssNew: 10, duration: 36 }
  await api('POST', `/opportunities/${few}/deal-sheet-versions`,
    { inputs, rates: priced(inputs), reason: `pass ${i + 1}`, expected_revision: await rev2() })
}
await page.evaluate((id) => navigate('opportunity-detail', id), few)
await page.waitForFunction(() =>
  document.querySelectorAll('#deal-version-list .ds-row').length === 3, { timeout: 20000 })
s = await state()
record('with only three versions the range control is not offered',
  !s.rangeShown && s.rows === 3, `shown=${s.rangeShown}, ${s.rows} rows`)

// ── THREE WIDTHS, because removing a max-width is a layout change ────────
// Verification 10. Reasoning that a full-width card in normal flow cannot
// overflow is reasoning, and this project has been caught by that before.
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
await page.waitForFunction(() =>
  document.querySelectorAll('#deal-version-list .ds-row').length > 0, { timeout: 20000 })
for (const w of [1240, 1920, 3440]) {
  await page.setViewport({ width: w, height: 1000 })
  // THE TAB REVERTS ON A VIEWPORT CHANGE, and a display:none ancestor gives
  // every descendant a zero box. The first version of this loop read 0px at
  // 1920 and 3440 and called it a layout failure; a zero here is the absence of
  // a measurement, not a narrow panel.
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const el = document.getElementById('deal-version-panel')
    return el && el.getBoundingClientRect().width > 0
  }, { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 400))
  const m = await page.evaluate(() => {
    const el = document.getElementById('deal-version-panel')
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), overflow: document.body.scrollWidth > document.body.clientWidth,
             fitsParent: r.right <= el.parentElement.getBoundingClientRect().right + 1 }
  })
  record(`at ${w} the panel fits its container and the page does not scroll sideways`,
    !m.overflow && m.fitsParent && m.w > 300, `panel ${m.w}px, overflow=${m.overflow}`)
}

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
