// ── R4/R7: A POLL TICK UPDATES IN PLACE ──────────────────────────────────
//
// The exit-criteria panel used to vanish and come back on every poll tick that
// detected a change: renderOppStageTabs removed and recreated every stage panel,
// and a recreated panel is EMPTY until the criteria arrive one round trip later.
// Measured before the fix, sampling every 40ms: content 207 chars -> 0 -> 207,
// while the panel COUNT never dropped.
//
// THREE PROPERTIES, ASSERTED TOGETHER, because this file has now produced three
// separate faults by changing one of them and not checking the others:
//
//   1. the panel must not blank across a tick          (the flicker itself)
//   2. the selected tab must survive                   (X1's property)
//   3. the read-only sweep must not sit behind a new await, and no wait here
//      may be on a proxy for what the assertion reads  (the two faults the
//      R8 change introduced in this same file)
//
// The third is asserted from SOURCE, because it is a property of the ordering
// rather than of a rendered screen.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-panel-stability.mjs')
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { stripComments } from './lib/strip-comments.mjs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

// ── 3. THE ORDERING PROPERTIES, from source ──────────────────────────────
const app = stripComments(readFileSync(new URL('../frontend/app.js', import.meta.url).pathname, 'utf8'), 'js')
// Positions in the whole file rather than in a fixed-size slice: renderOppDetail
// is long, and a 6000-character window silently ended before the lines being
// compared, which made the first version of this check compare -1 against -1.
const sweepAt = app.indexOf("applyReadOnlyControls('view-opportunity-detail'")
const gateFetchAt = app.indexOf("/api/records/${opp.id}/stage-approvals")
record('the read-only sweep runs BEFORE the awaited gate fetch',
  sweepAt > -1 && gateFetchAt > -1 && sweepAt < gateFetchAt,
  sweepAt < gateFetchAt
    ? 'locked before any round trip'
    : 'a fetch before the sweep leaves another user\'s record interactive while it runs')

const { oppId } = await freshOpportunity('R41PANEL')
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]))
await page.setViewport({ width: 1600, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
await page.waitForFunction(() => document.querySelectorAll('[data-opp-stage-panel]').length > 0, { timeout: 25000 })

// Open a stage tab and WAIT FOR ITS CRITERIA, which is the state the assertions
// below read - not a proxy set earlier in the same render.
await page.evaluate(() => {
  const t = [...document.querySelectorAll('[data-opp-stage-tab]')][0]
  if (t) t.click()
})
await page.waitForFunction(() =>
  (document.querySelector('[id^="opp-stage-criteria-"]')?.textContent.trim().length ?? 0) > 0,
  { timeout: 20000 })

const tabBefore = await page.evaluate(() => document.querySelector('[data-opp-tab].active')?.dataset.oppTab ?? null)
const interval = await page.evaluate(() => window.OPP_PULSE_INTERVAL_MS)
record('the poll interval is in the ruled 3-4s band', interval >= 3000 && interval <= 4000, `${interval}ms`)

// Sample the panel's CONTENT continuously across a tick that re-reads.
await page.evaluate(() => {
  window.__samples = []
  // Held by reference, so "is this the same node" is answerable after the tick.
  window.__panelNode = document.querySelector('[id^="opp-stage-criteria-"]')
  window.__panelSame = true
  window.__w = setInterval(() => {
    const el = document.querySelector('[id^="opp-stage-criteria-"]')
    window.__samples.push(el ? el.textContent.trim().length : -1)
    if (el !== window.__panelNode) window.__panelSame = false
  }, 30)
})
const before = await page.evaluate(() => ({ ...window.__oppPulseStats }))
// A change made OUTSIDE this session, so the POLL is what reacts to it.
await api('PATCH', `/opportunities/${oppId}`, {
  payload: { targetMargin: 41 },
  expected_revision: (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number,
})
await page.waitForFunction((n) => window.__oppPulseStats.rereads > n, { timeout: 30000 }, before.rereads)
await new Promise((r) => setTimeout(r, 2000))
const samples = await page.evaluate(() => { clearInterval(window.__w); return window.__samples })

const blanked = samples.filter((n) => n <= 0).length
record('the panel NEVER blanks across a poll tick', blanked === 0,
  `${samples.length} samples, ${blanked} empty, sizes ${JSON.stringify([...new Set(samples)].slice(0, 5))}`)

// ── AND THE ELEMENT ITSELF SURVIVES, WHICH IS WHAT RECONCILE CHANGES ─────
//
// The content check above passes with OR without the reconcile, and that is a
// fact about the measurement rather than about the fix: the criteria and lens
// helpers CACHE, so on a warm screen the refill resolves in a microtask and the
// empty window is shorter than any sampler can see. Calibrated by disabling the
// reconcile - the content check stayed green, so it cannot tell the two states
// apart and proves nothing on its own.
//
// What the reconcile actually changes is whether the panel is DESTROYED. Node
// identity is the discriminating measure: a reconciled panel is the same
// element before and after, a rebuilt one is a different element that happened
// to refill quickly. It is also the property that matters beyond the flicker -
// a replaced node loses scroll position, focus and selection inside it.
const survived = await page.evaluate(() => window.__panelSame === true)
record('the panel ELEMENT survives the tick, rather than being replaced',
  survived, survived ? 'same node before and after' : 'the panel was destroyed and recreated')

// ── THE DETERMINISTIC MEASURE, and it is the one that can fail ───────────
//
// SAMPLING IS THE WRONG INSTRUMENT HERE and the calibration proved it: with the
// reconcile disabled, a 30ms sampler across a poll tick still reported no blank
// and no replacement, because the criteria and lens helpers cache and the refill
// lands between two samples on a warm screen.
//
// Measured immediately after an AWAITED re-render instead, there is nothing to
// race: with the reconcile off the node is different AND its content is 0; with
// it on the node is the same and the content is intact. Same claim, an
// instrument that can actually see it.
const direct = await page.evaluate(async (id) => {
  const before = document.querySelector('[id^="opp-stage-criteria-"]')
  const lenBefore = before?.textContent.trim().length ?? -1
  await loadOpportunityDetail(id)
  const after = document.querySelector('[id^="opp-stage-criteria-"]')
  return { same: before === after, lenBefore, lenAfter: after?.textContent.trim().length ?? -1 }
}, oppId)
record('a re-render keeps the panel node AND its content, measured synchronously',
  direct.same && direct.lenAfter > 0,
  `same node ${direct.same}, content ${direct.lenBefore} -> ${direct.lenAfter}`)

const tabAfter = await page.evaluate(() => document.querySelector('[data-opp-tab].active')?.dataset.oppTab ?? null)
record('the selected tab survives the tick, X1\'s property held',
  tabAfter === tabBefore, `${tabBefore} -> ${tabAfter}`)
record('no page errors', errors.length === 0, errors.join(' | ') || 'none')

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
