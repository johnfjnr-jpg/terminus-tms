// The diagnostic settled at ~4.85s against a 25s timeout, so "the condition
// is too tight" does not explain the gate failure. The obvious difference:
// the diagnostic used a FRESH page per width; the probe drives ONE page
// through all six combinations in order.
//
// This replicates the probe's exact sequence and times every step, so the
// 1920/not-mine step can be compared with the same step in isolation.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('door-1920/replicate.mjs')
import { readFileSync } from 'node:fs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const session = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const NOT_MINE = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const MINE = process.env.PROBE_MINE ?? null
const APPROVING = process.env.PROBE_APPROVING ?? null

// Only NOT_MINE is known here; the other two ids live in the probe's env.
// Where they are absent the sequence still exercises the thing that matters:
// FOUR navigations on ONE page, with 1920/not-mine as the fourth.
const ids = [['not mine', NOT_MINE], ['mine', MINE ?? NOT_MINE], ['approver', APPROVING ?? NOT_MINE]]

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  for (const width of [1240, 1920]) {
    for (const [label, id] of ids) {
      await page.setViewport({ width, height: 900 })
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
      await page.evaluate((k, v) => localStorage.setItem(k, v),
        'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
      await page.reload({ waitUntil: 'networkidle0' })
      const t0 = Date.now()
      await page.evaluate((rid) => navigate('opportunity-detail', rid), id)
      const ready = await page.waitForFunction((wantId) => {
        const v = document.getElementById('view-opportunity-detail')
        if (!v || v.classList.contains('is-loading')) return false
        if (!document.querySelector(`[data-record-id="${wantId}"]`)) return false
        const named = ['ref-display-name', 'detail-company']
          .map((i) => document.getElementById(i))
          .some((el) => el && el.textContent.trim().length > 0)
        if (!named) return false
        const n = v.querySelectorAll('input, textarea, select').length
        window.__settle = (window.__settle && window.__settle.n === n)
          ? { n, hits: window.__settle.hits + 1 } : { n, hits: 1 }
        return window.__settle.hits >= 4
      }, { timeout: 25000, polling: 300 }, id).then(() => true).catch(() => false)
      const ms = Date.now() - t0
      const st = await page.evaluate(() => {
        const v = document.getElementById('view-opportunity-detail')
        return { controls: v ? v.querySelectorAll('input, textarea, select').length : -1,
                 isNotMine: !!v && v.classList.contains('is-not-mine') }
      })
      console.log(`  ${String(width).padEnd(5)} ${label.padEnd(9)} settled=${String(ready).padEnd(5)} `
        + `${String(ms).padStart(6)}ms  controls=${String(st.controls).padStart(4)}  is-not-mine=${st.isNotMine}`)
    }
  }
} finally { await browser.close() }
