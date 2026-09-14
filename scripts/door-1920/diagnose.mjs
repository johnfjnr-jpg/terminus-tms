// ── WHY DOES THE UNOWNED RECORD NOT SETTLE AT 1920? ─────────────────────
//
// The gate's readonly-view probe failed at 1920 only, 1240 passing in the
// same run, and its own fourth line says the view never settled - so the
// three door failures above it are readings of an unrendered page. The
// capture confirms it: nav sidebar, no record content.
//
// That argues probe rather than door. THE STAGE GUARDS NON-OWNER WRITE
// AUTHORISATION, so it gets measured.
//
// This samples EVERY CLAUSE of the settle condition over a generous window
// and reports which one fails to become true, then measures the door in
// whatever state the page reaches. Read-only: it navigates and observes.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('door-1920/diagnose.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/door1920/`
mkdirSync(OUT, { recursive: true })
const session = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const NOT_MINE = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const WINDOW_MS = Number(process.env.WINDOW_MS ?? 60000)

const browser = await puppeteer.launch({ headless: 'new' })
const results = {}
try {
  for (const width of [1240, 1920]) {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 900 })
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v) => localStorage.setItem(k, v),
      'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
    await page.reload({ waitUntil: 'networkidle0' })
    const t0 = Date.now()
    await page.evaluate((rid) => navigate('opportunity-detail', rid), NOT_MINE)

    // Sample every clause independently, so "did not settle" becomes "THIS
    // clause never became true" rather than a single boolean.
    const samples = []
    let settledAt = null
    while (Date.now() - t0 < WINDOW_MS) {
      const s = await page.evaluate((wantId) => {
        const v = document.getElementById('view-opportunity-detail')
        const named = ['ref-display-name', 'detail-company']
          .map((i) => document.getElementById(i))
          .map((el) => (el ? el.textContent.trim().length : -1))
        return {
          viewExists: !!v,
          isLoading: !!v && v.classList.contains('is-loading'),
          recordIdPresent: !!document.querySelector(`[data-record-id="${wantId}"]`),
          namedLens: named,
          controls: v ? v.querySelectorAll('input, textarea, select').length : -1,
          isNotMine: !!v && v.classList.contains('is-not-mine'),
        }
      }, NOT_MINE)
      s.at = Date.now() - t0
      samples.push(s)
      // The probe's own condition: all clauses true AND count stable x4.
      const last4 = samples.slice(-4)
      const allTrue = (x) => x.viewExists && !x.isLoading && x.recordIdPresent
        && x.namedLens.some((n) => n > 0)
      if (settledAt === null && last4.length === 4 && last4.every(allTrue)
        && new Set(last4.map((x) => x.controls)).size === 1) settledAt = s.at
      if (settledAt !== null && s.at > settledAt + 3000) break
      await new Promise((r) => setTimeout(r, 300))
    }

    const first = (pred) => samples.find(pred)?.at ?? null
    const last = samples[samples.length - 1]
    const door = await page.evaluate(() => {
      const v = document.getElementById('view-opportunity-detail')
      if (!v) return { noView: true }
      const btn = document.getElementById('opp-close-lost-btn')
        || [...v.querySelectorAll('button')].find((b) => /closed lost/i.test(b.textContent))
      const typeable = [...v.querySelectorAll('input, textarea, select')]
        .filter((e) => !e.disabled && !e.readOnly && e.offsetParent !== null).length
      return {
        isNotMine: v.classList.contains('is-not-mine'),
        controls: v.querySelectorAll('input, textarea, select').length,
        typeable,
        closeLostFound: !!btn,
        closeLostDisabled: btn ? (btn.disabled || btn.getAttribute('aria-disabled') === 'true'
          || btn.closest('.is-not-mine') !== null) : null,
      }
    })
    await page.screenshot({ path: `${OUT}door-${width}-not-mine.png` })

    results[width] = {
      samples: samples.length, settledAt,
      firstViewExists: first((x) => x.viewExists),
      firstRecordId: first((x) => x.recordIdPresent),
      firstNotLoading: first((x) => x.viewExists && !x.isLoading),
      firstNamed: first((x) => x.namedLens.some((n) => n > 0)),
      lastControls: last?.controls, lastNamedLens: last?.namedLens,
      door,
    }
    await page.close()
  }
} finally { await browser.close() }

console.log(`  window ${WINDOW_MS}ms, record ${NOT_MINE}\n`)
for (const [w, r] of Object.entries(results)) {
  console.log(`=== ${w} ===`)
  console.log(`  samples taken                  : ${r.samples}`)
  console.log(`  first: view exists             : ${r.firstViewExists ?? 'NEVER'}ms`)
  console.log(`  first: is-loading cleared      : ${r.firstNotLoading ?? 'NEVER'}ms`)
  console.log(`  first: data-record-id present  : ${r.firstRecordId ?? 'NEVER'}ms`)
  console.log(`  first: a name element has text : ${r.firstNamed ?? 'NEVER'}ms`)
  console.log(`  SETTLED (all clauses + stable) : ${r.settledAt ?? 'NEVER'}${r.settledAt ? 'ms' : ''}`)
  console.log(`  last control count             : ${r.lastControls}`)
  console.log(`  last name lengths [ref, detail]: ${JSON.stringify(r.lastNamedLens)}`)
  console.log(`  THE DOOR, in the state reached :`)
  console.log(`     is-not-mine applied         : ${r.door.isNotMine}`)
  console.log(`     controls / typeable         : ${r.door.controls} / ${r.door.typeable}`)
  console.log(`     Mark Closed Lost found      : ${r.door.closeLostFound}`)
  console.log(`     ...and blocked              : ${r.door.closeLostDisabled}`)
  console.log()
}
writeFileSync(`${OUT}diagnose.json`, JSON.stringify(results, null, 1))
