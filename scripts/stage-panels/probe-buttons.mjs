// ── THE TWO ACTIONS, AT 1440 ────────────────────────────────────────────
//
// The finding was found by LOOKING and can only be confirmed by looking: both
// rendered as white browser defaults on a dark screen. So the measurement is
// the CONTRAST of the control against the page, read from the live screen, and
// the screenshot is opened beside it.
//
// UNWIRED. Run: TBSP_RUN=<label> ... node --env-file=.env scripts/stage-panels/probe-buttons.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-buttons.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-BTN-${Date.now()}`
const V = '#view-test-bed-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })

    const m = await page.evaluate((v) => {
      const read = (sel) => {
        const el = document.querySelector(`${v} [data-testid="${sel}"]`)
        if (!el) return null
        const cs = getComputedStyle(el)
        return { cls: el.className, bg: cs.backgroundColor, color: cs.color, border: cs.borderTopWidth }
      }
      // The PAGE's own ground, so "white on dark" is measured against the thing
      // it sits on rather than against a remembered colour.
      const page = getComputedStyle(document.querySelector(v)).backgroundColor
      return { next: read('tb-next-stage-btn'), convert: read('tb-convert-trigger'), page }
    }, V)
    evidence.buttons = m
    console.log(`\n=== the two actions at 1440 ===\n  ${JSON.stringify(m, null, 1)}`)

    // A browser default is an opaque near-white fill. The estate's controls are
    // not: whatever their treatment, they are not a white block on a dark page.
    const white = (c) => /^rgba?\((2[0-4]\d|25[0-5]),\s*(2[0-4]\d|25[0-5]),\s*(2[0-4]\d|25[0-5])/.test(c ?? '')
    check(!!m.next, 'the Next Stage control is on screen')
    check(!!m.next && /btn-primary/.test(m.next.cls), 'Next Stage carries the estate\'s primary treatment', m.next?.cls)
    check(!!m.next && !white(m.next.bg), 'and is no longer a white block on a dark page', m.next?.bg)
    check(!!m.convert, 'the Convert control is on screen')
    check(!!m.convert && /btn-ghost/.test(m.convert.cls), 'Convert carries the estate\'s ghost treatment, as the vanilla had it', m.convert?.cls)
    check(!!m.convert && !white(m.convert.bg), 'and is no longer a white block either', m.convert?.bg)
    await page.screenshot({ path: `${OUT}buttons-1440.png` })
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  if (fx) { const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length}, remaining ${t.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
