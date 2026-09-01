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
// ── THIS CLAIM WAS RESTATED WHEN X1 SUPERSEDED IT, not weakened quietly ──
//
// It read "the visible panel names the stage the record is NOW in", which was
// D's proxy for "not blank". X1 rules that a deliberately-selected tab is
// preserved across a re-render, and a transition IS a re-render: the person was
// on Qualification, the record moved to Solution Alignment, and keeping them on
// Qualification is now the correct behaviour rather than a regression.
//
// So the transition case asserts what D was actually about - a POPULATED panel,
// no blank - and the selection claim is the four cases below, which is where it
// belongs.
//
// AND THE LANDING MECHANISM IS A SEPARATE, UNUSED THING. oppLandOnTabAfterLoad
// exists and would outrank the restore, and `requestTransition` does not set
// it: only the assessment panel's `land:` hook does. Whether raising a
// transition should land the person on the new stage is a decision, not a
// defect, and it is recorded here rather than assumed either way.
record('and the panel that is visible is POPULATED, not an empty frame',
  after.visible.every((v) => v.chars > 50),
  `visible ${JSON.stringify(after.visible)}`)
record('no uncaught error was thrown', errors.length === 0, errors.join(' | ') || 'none')

// ═════════════════════════════════════════════════════════════
// A DELIBERATE SELECTION SURVIVES A RE-RENDER. Round 41 fourth walk, X1
// ═════════════════════════════════════════════════════════════
//
// THE FIRST VERSION OF THIS PROBE ASSERTED THE WRONG HALF. It required that A
// panel be visible after a transition, which the D fix satisfied by selecting
// the record's current stage every time - including over a tab the person had
// deliberately opened. It passed 6/6 while the walk could not keep a tab open.
//
// Verification 27: the measure is what the person experiences. "A panel is
// visible" is a property of the document; "the tab I opened is still open" is
// the task.
//
// FOUR RE-RENDER PATHS, because the transition path was 2 of 13 triggers and
// the walk hit the others. The common act in every one is
// loadOpportunityDetail, so the claim is asserted against each path that a
// single identity can actually drive, and the one it cannot is named.
const tabKeys = () => page.evaluate(() => ({
  active: [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
    .filter((b) => b.classList.contains('active')).map((b) => b.dataset.oppTab),
  visible: [...document.querySelectorAll('#view-opportunity-detail .detail-tab-panel')]
    .filter((p) => !p.classList.contains('hidden')).map((p) => p.id),
}))

// Open a stage tab that is NOT the record's current stage. That is the whole
// discriminator: selecting the current stage would pass against a build that
// ignores the selection entirely.
const other = await page.evaluate(() => {
  const cur = [...document.querySelectorAll('[data-opp-stage-tab]')]
    .find((t) => t.classList.contains('opp-stage-tab--current'))?.dataset.oppStageTab
  const t = [...document.querySelectorAll('[data-opp-stage-tab]')]
    .find((x) => x.dataset.oppStageTab !== cur && !/closed/i.test(x.dataset.oppStageTab))
  if (t) t.click()
  return t?.dataset.oppStageTab ?? null
})
await new Promise((r) => setTimeout(r, 2500))
const chosen = await tabKeys()
record('a tab other than the record\'s stage can be opened',
  chosen.active.length === 1 && /^stage-/.test(chosen.active[0]),
  `opened "${other}", active ${JSON.stringify(chosen.active)}`)

const survives = async (label, act) => {
  await act()
  await new Promise((r) => setTimeout(r, 3500))
  const now = await tabKeys()
  record(`the selection survives: ${label}`,
    now.active.length === 1 && now.active[0] === chosen.active[0],
    `was ${JSON.stringify(chosen.active)}, now ${JSON.stringify(now.active)}, visible ${JSON.stringify(now.visible)}`)
}

// 1. A PLAIN RE-RENDER. What decideRequest, withdrawRequest and every other
// path ultimately do. Driven directly because the paths below differ only in
// what they write first.
await survives('a plain re-render', () =>
  page.evaluate((id) => loadOpportunityDetail(id), oppId))

// 2. WITHDRAW. Requester-only, so a single identity CAN drive it: raise as the
// owner, withdraw as the owner.
await survives('withdrawRequest', async () => {
  await api('POST', `/records/${oppId}/transition-requests`, { to_stage: 'Proposal', kind: 'transition' })
    .catch(() => {})
  const reqs = (await api('GET', `/records/${oppId}/transition-requests`)).data ?? []
  const open = reqs.find((r) => r.status === 'open')
  if (open) await api('POST', `/transition-requests/${open.id}/withdraw`, { reason: 'probe' })
  await page.evaluate((id) => loadOpportunityDetail(id), oppId)
})

// 3. THE REFERENCE SAVE, through the screen's own handler rather than the API,
// because the claim is about what the SCREEN does after its own save.
await survives('a Reference field save', () =>
  page.evaluate(async () => {
    window.openRefField('summary', true)
    const box = document.getElementById('ref-input-summary')
    if (box) { box.value = 'probe edit ' + document.title.length; box.dispatchEvent(new Event('input', { bubbles: true })) }
    document.getElementById('ref-save-all')?.click()
  }))

// 4. A KEY-CONTACT change, the third family the walk named.
await survives('a key-contact change', async () => {
  const contacts = (await api('GET', '/contacts')).data ?? []
  const roles = (await api('GET', '/contact-roles')).data ?? []
  const c = contacts[0]
  if (c && roles[0]) {
    await api('POST', `/opportunities/${oppId}/key-contacts`, { contact_id: c.id, role_id: roles[0].id })
      .catch(() => {})
  }
  await page.evaluate((id) => loadOpportunityDetail(id), oppId)
})

// 5. decideRequest CANNOT BE DRIVEN BY ONE IDENTITY, and that is stated rather
// than skipped: a requester may never approve their own request, so completing
// a decision needs a second person. What IS assertable is that it re-renders
// through the same loader every case above exercises, so the claim transfers.
const src = readFileSync(new URL('../frontend/app.js', import.meta.url).pathname, 'utf8')
// Sliced to the next top-level window.* declaration rather than to a named one:
// the first draft assumed withdrawRequest followed decideRequest, and it does
// not, so the slice was empty and the check reported "uncovered" about a
// function it had never read. A probe that fails for the wrong reason is worse
// than one that passes for the wrong reason, because it gets believed.
const start = src.indexOf('window.decideRequest =')
const rest = src.slice(start + 20)
const nextDecl = rest.search(/\nwindow\.[a-zA-Z]+ =/)
const decide = nextDecl > 0 ? src.slice(start, start + 20 + nextDecl) : src.slice(start)
record('decideRequest re-renders through the same loader these cases cover',
  /loadOpportunityDetail\(recordId\)/.test(decide),
  decide.includes('loadOpportunityDetail') ? 'yes' : 'NO - it re-renders some other way and is uncovered')

await browser.close()
const { removed } = await tearDown()
record('teardown', true, `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
