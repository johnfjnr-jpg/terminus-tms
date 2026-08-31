// What the SCREEN does when a transition succeeds. Round 41 walk item D.
//
// ── THE GAP THIS FILLS, ENUMERATED BEFORE IT WAS WRITTEN ──────────────────
//
// Two probes perform a transition - probe-commercial-gate and
// probe-zero-track-transition - and both are headless HTTP: they assert the
// record moved and the request closed, which are database facts. Seven browser
// probes exist and NOT ONE performs a transition; they measure a screen in a
// state somebody else put it in.
//
// So no stage of the gate has ever looked at this screen after a transition
// completed, and item D - the stage area going blank on success - was invisible
// to all seven of them. CLAUDE.md Verification 40 is about a ROUTE's success
// path; this is the same argument one layer up, for a SCREEN's.
//
// ── WHAT IT ASSERTS, AND WHY IT IS NOT "THE PAGE HAS CONTENT" ─────────────
//
// Verification 27: the measure is what the person experiences. After a
// successful transition a person is looking at the stage area, so the claim is
// that a stage panel is VISIBLE and names the stage the record is now in. The
// whole view still holding 54,722 characters is a property of the document and
// is true while the thing they were reading is gone.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-transition-render.mjs')
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const results = []
function record(label, pass, detail) {
  results.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

const { oppId } = await freshOpportunity('transition-render')
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {})

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]))
await page.setViewport({ width: 1600, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)

// Verification 7: the stage tabs are generated from the record's own stage list,
// so their presence is false before the record loads and true only after.
await page.waitForFunction(() =>
  document.querySelectorAll('[data-opp-stage-tab]').length > 0, { timeout: 25000 })

// Put a panel on screen, so there is something for the transition to take away.
await page.evaluate(() => {
  const t = [...document.querySelectorAll('[data-opp-stage-tab]')].find((x) => /qualification/i.test(x.textContent))
  if (t) t.click()
})
await page.waitForFunction(() =>
  [...document.querySelectorAll('[data-opp-stage-panel]')].some((p) => !p.classList.contains('hidden')),
  { timeout: 15000 })

const snap = () => page.evaluate(() => {
  const panels = [...document.querySelectorAll('[data-opp-stage-panel]')]
  const visible = panels.filter((p) => !p.classList.contains('hidden'))
  return {
    panels: panels.length,
    visible: visible.map((p) => ({ stage: p.getAttribute('data-opp-stage-panel'), chars: p.textContent.trim().length })),
  }
})

const before = await snap()
record('before: a stage panel is on screen', before.visible.length === 1,
  JSON.stringify(before.visible))

// The real handler the stage-request control calls. Qualification requires no
// approval tracks, so this executes on raise: the "request executed" outcome.
await page.evaluate((id) => window.requestTransition(id, 'Solution Alignment'), oppId)
await new Promise((r) => setTimeout(r, 6000))

const rec = (await api('GET', `/opportunities/${oppId}`)).data
record('the transition succeeded', rec.status === 'Solution Alignment', `record is in "${rec.status}"`)

const after = await snap()
record('AFTER a successful transition, a stage panel is still on screen',
  after.visible.length >= 1,
  `${after.panels} panels exist, ${after.visible.length} visible: ${JSON.stringify(after.visible)}`)
record('and the visible panel names the stage the record is NOW in',
  after.visible.some((v) => v.stage === rec.status),
  `visible ${JSON.stringify(after.visible.map((v) => v.stage))}, record in "${rec.status}"`)
record('no uncaught error was thrown', errors.length === 0, errors.join(' | ') || 'none')

await browser.close()
const { removed } = await tearDown()
record('teardown', true, `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
