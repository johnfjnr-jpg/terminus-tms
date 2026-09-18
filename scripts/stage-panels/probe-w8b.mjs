// ── W8b (W1 PROMOTED): THE SAVE BAR STAYS IN SIGHT ──────────────────────
//
// The claim is about a PERSON's viewport, not about a CSS property: with an
// unsaved change on a long page, the bar is on screen wherever they are
// (Verification 4's mechanism clause - asserting `position: sticky` would pass
// on a bar parked anywhere).
//
// Proven on TWO surfaces, because the rule is on the shared edit-bar class and
// a claim about "estate-wide" that is measured on one surface is a claim about
// one surface.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-w8b.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, freshOpportunity, tearDown } from '../fixtures.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-w8b.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-W8B-${Date.now()}`
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const evidence = {}
let fx, opp
try {
  fx = await freshTestBed(TAG)
  opp = await freshOpportunity(`${TAG}-C`)

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })

    // The scroller is the app's own, not the window: the estate scrolls an
    // inner container, and scrolling the window would move nothing
    // (Verification 18's third blindness, recorded on this very surface).
    const measure = async (view, label) => {
      const m = await page.evaluate((v) => {
        const bar = document.querySelector(`${v} [data-testid="edit-bar"]`)
        if (!bar || bar.hidden) return { present: false }
        const scroller = (() => {
          let el = bar.parentElement
          while (el && el !== document.body) {
            const cs = getComputedStyle(el)
            if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 40) return el
            el = el.parentElement
          }
          return document.scrollingElement
        })()
        return { present: true, scrollable: scroller.scrollHeight - scroller.clientHeight, tag: scroller.tagName }
      }, view)
      if (!m.present) return { ...m, label }
      // Scroll to the bottom of whatever actually scrolls, then read the bar
      // against the VIEWPORT.
      const after = await page.evaluate((v) => {
        const bar = document.querySelector(`${v} [data-testid="edit-bar"]`)
        let el = bar.parentElement
        let scroller = document.scrollingElement
        while (el && el !== document.body) {
          const cs = getComputedStyle(el)
          if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 40) { scroller = el; break }
          el = el.parentElement
        }
        scroller.scrollTop = Math.round((scroller.scrollHeight - scroller.clientHeight) / 2)
        const r = bar.getBoundingClientRect()
        return {
          top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
          vh: innerHeight, sticky: getComputedStyle(bar).position,
          scrolled: Math.round(scroller.scrollTop), scrollable: Math.round(scroller.scrollHeight - scroller.clientHeight),
        }
      }, view)
      return { ...after, present: true, label }
    }

    // ── THE TEST BED ─────────────────────────────────────────────────
    const V = '#view-test-bed-detail'
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
    await page.click(`${V} [data-testid="tb-tab-btn-commercials"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="display-airQualitySensors"]`), { timeout: 20000 }, V)
    await page.click(`${V} [data-testid="display-airQualitySensors"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-field="airQualitySensors"] input`), { timeout: 10000 }, V)
    await page.type(`${V} [data-field="airQualitySensors"] input`, '4')
    await page.click(`${V} [data-testid="tb-detail-name"]`)
    await page.waitForFunction((v) => { const b = document.querySelector(`${v} [data-testid="edit-bar"]`); return b && !b.hidden }, { timeout: 10000 }, V)
    const tb = await measure(V, 'Test Bed')
    evidence.testBed = tb
    console.log(`\n=== the Test Bed ===\n  ${JSON.stringify(tb)}`)
    check(tb.present, 'Test Bed: a change exists, so there is a bar to keep in sight')
    check(tb.scrollable > 200, 'Test Bed: the page is genuinely long, so the claim is not vacuous',
      `${tb.scrollable}px of scroll`)
    check(tb.bottom <= tb.vh + 2 && tb.top >= 0,
      'Test Bed: with the page scrolled into its middle, the bar is still ON SCREEN',
      `bar ${tb.top}-${tb.bottom} in a ${tb.vh}px viewport, scrolled ${tb.scrolled}`)
    await page.screenshot({ path: `${OUT}w8b-testbed-1440.png` })

    // ── THE ACCOUNT, the same shared bar on another surface ───────────
    //
    // NOT the Contact, and the reason is a measured finding rather than a
    // convenience: `ContactPanel` deliberately does NOT render the shared
    // EditBar - ruling A1 moved its Save and Discard into the header row, and
    // the component says so at the site. Measured live before this changed:
    // the contact surface renders ZERO `edit-bar` elements. So the shared bar
    // serves the Test Bed, the Account and Reference, and a claim about it
    // measured on the Contact would be measuring something else.
    //
    // RELOAD FIRST, dropping the Test Bed's draft. Navigating away from a dirty
    // record correctly raises the discard dialogue, which swallowed the
    // navigation and read as the next surface failing to load: the probe was
    // being refused by a control doing its job.
    const C = '#view-account-detail'
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('account-detail', id), fx.accountId)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="account-view"]`), { timeout: 30000 }, C)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
    const field = await page.evaluate((c) => document.querySelector(`${c} [data-testid^="display-"]:not([data-testid$="-header"])`)?.getAttribute('data-testid') ?? null, C)
    evidence.accountField = field
    check(!!field, 'Account: there is an editable row to dirty', String(field))
    await page.click(`${C} [data-testid="${field}"]`)
    const name = String(field).replace('display-', '')
    await page.waitForFunction((c, n) => document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] select, ${c} [data-field="${n}"] textarea`), { timeout: 10000 }, C, name)
    // DRIVE WHATEVER EDITOR THIS ROW HAS. The first version typed into an
    // `input` and the row it happened to pick was a SELECT, so nothing was
    // dirtied and the edit bar never appeared: the probe reported the bar
    // missing when what was missing was the change (Verification 14 - the
    // failure detail must carry the cause's own answer).
    const kind = await page.evaluate((c, n) => {
      const el = document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] select, ${c} [data-field="${n}"] textarea`)
      return el ? el.tagName.toLowerCase() : null
    }, C, name)
    evidence.accountEditor = kind
    if (kind === 'select') {
      const opt = await page.evaluate((c, n) => {
        const sel = document.querySelector(`${c} [data-field="${n}"] select`)
        const other = [...sel.options].find((o) => o.value !== sel.value && o.value !== '')
        return other ? other.value : null
      }, C, name)
      check(!!opt, 'Account: the row offers a second value to choose', String(opt))
      if (opt) await page.select(`${C} [data-field="${name}"] select`, opt)
    } else {
      await page.type(`${C} [data-field="${name}"] ${kind}`, 'x')
    }
    await page.click(`${C} [data-testid="account-view"]`)
    await page.waitForFunction((c) => { const b = document.querySelector(`${c} [data-testid="edit-bar"]`); return b && !b.hidden }, { timeout: 10000 }, C)
    const ct = await measure(C, 'Account')
    evidence.account = ct
    console.log(`\n=== the Account ===\n  ${JSON.stringify(ct)}`)
    check(ct.present, 'Account: a change exists, so there is a bar to keep in sight')
    check(ct.bottom <= ct.vh + 2 && ct.top >= 0,
      'Account: the SAME shared bar is on screen there too, which is what estate-wide means',
      `bar ${ct.top}-${ct.bottom} in a ${ct.vh}px viewport, scrolled ${ct.scrolled}`)
    await page.screenshot({ path: `${OUT}w8b-account-1440.png` })
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  for (const t of [TAG, `${TAG}-C`]) { const r = await tearDown(t); console.log(`teardown ${t}: removed ${r.removed.length}, remaining ${r.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
