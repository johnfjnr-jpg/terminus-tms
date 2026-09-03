// ── A FAILED POLL SAYS SO ─────────────────────────────────────────────────
//
// Walk 2026-09-04, ruled. `if (!r.ok) return` made a failed poll
// indistinguishable from a record where nothing changed - uncounted, unlogged,
// silent - which is why four investigations into P1 found no mechanism. The
// failure erased its own evidence.
//
// THREE STATES, ALL ASSERTED. One failure must NOT surface, or the message
// becomes noise people learn to ignore; two consecutive MUST; and any success
// must clear it, or the screen carries a stale accusation about itself.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const puppeteer = await loadPuppeteer('pulse-stall')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const { oppId } = await freshOpportunity(process.argv[2] ?? 'R41STALL')

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })

// The interception is installed BEFORE the record loads, so the toggle is the
// only thing deciding whether a poll succeeds.
let failPulse = false
let pulseAttempts = 0
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (/\/api\/records\/[^/]+\/pulse/.test(req.url())) {
    pulseAttempts += 1
    if (failPulse) return req.respond({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: 'injected failure' }) })
  }
  req.continue()
})

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
await page.waitForFunction(() => !!document.getElementById('opp-pulse-stall'), { timeout: 25000 })

const state = () => page.evaluate(() => {
  const el = document.getElementById('opp-pulse-stall')
  return {
    shown: !!el && !el.classList.contains('hidden') && el.innerHTML.length > 0,
    text: (el?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
    failures: window.__oppPulseFailures?.(),
  }
})
// Wait on the FAILURE COUNT, never on a delay: the poll interval and the load
// time both vary, and a fixed wait would report whichever state it happened to
// catch. Verification 6.
const waitForFailures = (n) => page.waitForFunction(
  (want) => (window.__oppPulseFailures?.() ?? 0) >= want, { timeout: 40000 }, n)

// ── AT REST, nothing to say ──────────────────────────────────────────────
await page.waitForFunction(() => (window.__oppPulseStats?.polls ?? 0) >= 1, { timeout: 30000 })
let s = await state()
record('a working poll says nothing', !s.shown && s.failures === 0, `failures=${s.failures}`)

// ── ONE FAILURE MUST NOT SURFACE ─────────────────────────────────────────
failPulse = true
await waitForFailures(1)
s = await state()
record('ONE failure does NOT surface: a blip is not a stall',
  !s.shown && s.failures === 1, `failures=${s.failures}, shown=${s.shown}`)

// ── TWO CONSECUTIVE MUST ─────────────────────────────────────────────────
await waitForFailures(2)
await new Promise((r) => setTimeout(r, 250))
s = await state()
record('TWO consecutive failures surface the stall', s.shown && s.failures >= 2,
  `failures=${s.failures}`)
record('and it says SINCE WHEN, which is what a screenshot carries',
  /Not updating since \d\d:\d\d:\d\d/.test(s.text), `"${s.text.slice(0, 76)}"`)
record('it offers the remedy that already exists',
  await page.evaluate(() => !!document.querySelector('#opp-pulse-stall button')), 'a Refresh control')

// ── A SUCCESS CLEARS IT ──────────────────────────────────────────────────
failPulse = false
await page.waitForFunction(() => (window.__oppPulseFailures?.() ?? 1) === 0, { timeout: 40000 })
await new Promise((r) => setTimeout(r, 250))
s = await state()
record('one success clears the stall', !s.shown && s.failures === 0, `failures=${s.failures}`)

record('the poll was genuinely exercised, not merely observed',
  pulseAttempts >= 4, `${pulseAttempts} pulse requests`)

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
