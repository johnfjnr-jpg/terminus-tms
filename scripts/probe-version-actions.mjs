// ── THE APPROVAL CONTROL APPEARS WHERE IT CAN ACT, AND NOWHERE ELSE ──────
//
// Walk, 2026-09-03. A pricing approval can never succeed before Proposal: the
// version gate begins at Proposal exit and there is nobody to ask before it.
// Ruled: hide the control and its explanation rather than disable them, because
// a control that cannot act AT THIS STAGE is clutter, unlike one disabled for a
// reason that clears where you stand.
//
// SAVE VERSION AND ISSUE STAY AT EVERY STAGE, which is half the claim and the
// half a "does the button hide" check would miss: early pricing work is
// legitimate and only the approval request is Proposal-onward.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const puppeteer = await loadPuppeteer('version-actions')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const db = admin()
const TAG = process.argv[2] ?? 'R41ACT'
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE))

const { oppId } = await freshOpportunity(TAG)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const inputs = { targetMargin: 30, ssNew: 10, duration: 36 }
const draft = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs, rates: priced(inputs), reason: 'actions probe', expected_revision: await rev() })).data
await api('POST', `/deal-sheet-versions/${draft.id}/issue`, {})

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })

const open = async () => {
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.waitForFunction(() => !!document.getElementById('btn-save-version'), { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && !p.classList.contains('hidden') && getComputedStyle(p).visibility === 'visible'
  }, { timeout: 20000 })
  // Wait on the gate's answer being KNOWN, not on a delay: the control's
  // visibility is decided by oppStageTracks, which loads after first render.
  await page.waitForFunction(() => window.oppVersionGateApplies?.() !== null, { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 300))
}
const shot = () => page.evaluate(() => {
  const vis = (id) => {
    const e = document.getElementById(id)
    if (!e) return 'absent'
    const cs = getComputedStyle(e)
    return (e.classList.contains('hidden') || cs.display === 'none' || cs.visibility === 'hidden')
      ? 'hidden' : 'shown'
  }
  const row = document.getElementById('btn-save-version')?.parentElement
  const btns = [...(row?.querySelectorAll('button') ?? [])]
    .filter((b) => getComputedStyle(b).display !== 'none' && !b.classList.contains('hidden'))
  const ys = [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().y)))]
  return {
    save: vis('btn-save-version'), issue: vis('btn-issue-version'),
    ask: vis('btn-request-pricing-approval'), state: vis('pricing-approval-state'),
    approvalView: vis('btn-open-approval'),
    visibleButtons: btns.length, lines: ys.length,
    gate: window.oppVersionGateApplies?.(),
  }
})

// ── AT QUALIFICATION ─────────────────────────────────────────────────────
await open()
let s = await shot()
record('at Qualification the approval control is ABSENT',
  s.ask === 'hidden', `ask=${s.ask}, gateApplies=${s.gate}`)
record('and so is its explanation', s.state === 'hidden', `state=${s.state}`)
record('Save version and Issue are still there',
  s.save === 'shown' && s.issue === 'shown', `save=${s.save} issue=${s.issue}`)
record('the action row is ONE line with three buttons',
  s.lines === 1 && s.visibleButtons === 3, `${s.visibleButtons} buttons on ${s.lines} line(s)`)

// ── AT PROPOSAL ──────────────────────────────────────────────────────────
const { error } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
if (error) throw error
await open()
s = await shot()
record('at Proposal the approval control APPEARS',
  s.ask === 'shown', `ask=${s.ask}, gateApplies=${s.gate}`)
record('Save version and Issue are still there too',
  s.save === 'shown' && s.issue === 'shown', `save=${s.save} issue=${s.issue}`)
record('the action row is ONE line with four buttons',
  s.lines === 1 && s.visibleButtons === 4, `${s.visibleButtons} buttons on ${s.lines} line(s)`)

// ── AND IT FUNCTIONS, not merely renders ─────────────────────────────────
const enabled = await page.evaluate(() => {
  const b = document.getElementById('btn-request-pricing-approval')
  return { disabled: b.disabled, label: b.textContent.trim() }
})
record('the control is usable, with an issued version to point at',
  !enabled.disabled && /Request approval of V/.test(enabled.label), `"${enabled.label}"`)
await page.evaluate(() => document.getElementById('btn-request-pricing-approval').click())
let raised = null
for (let i = 0; i < 25 && !raised; i++) {
  const { data, error: e } = await db.from('transition_requests')
    .select('id, kind, status').eq('record_id', oppId).eq('kind', 'review').eq('status', 'open').maybeSingle()
  if (e) throw e
  raised = data
  if (!raised) await new Promise((r) => setTimeout(r, 400))
}
record('clicking it actually raises the request', !!raised, raised ? `request ${raised.id.slice(0, 8)}` : 'NONE')

// ── ITEM 2'S ACTUAL CLAIM: THE SENTENCE MUST NOT SPLIT THE ROW ───────────
//
// The button count on one line was ALREADY true before this change at 1440,
// so a check on that alone would have passed on the defect. What cost the
// vertical space was the state sentence sitting BETWEEN two buttons: with text
// in it, "V1 is awaiting approval." pushed "Approval view" onto a second line.
// Raising the request above is what puts text in it, so this is measured in the
// state that exhibits the fault rather than in the empty one.
await page.evaluate(() => window.oppRefreshVersionActions?.())
await page.waitForFunction(() =>
  (document.getElementById('pricing-approval-state')?.textContent ?? '').trim().length > 0,
  { timeout: 15000 }).catch(() => null)
const withText = await page.evaluate(() => {
  const row = document.getElementById('btn-save-version')?.parentElement
  const btns = [...(row?.querySelectorAll('button') ?? [])]
    .filter((b) => getComputedStyle(b).display !== 'none' && !b.classList.contains('hidden'))
  const st = document.getElementById('pricing-approval-state')
  return {
    lines: [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().y)))].length,
    buttons: btns.length,
    text: (st?.textContent ?? '').trim(),
    stateInRow: !!row && !!st && row.contains(st),
    rowH: row ? Math.round(row.getBoundingClientRect().height) : null,
  }
})
record('the state sentence is NOT inside the button row',
  !withText.stateInRow, `text="${withText.text.slice(0, 40)}"`)
record('and with that sentence present the row is still ONE line',
  withText.lines === 1, `${withText.buttons} buttons on ${withText.lines} line(s), row ${withText.rowH}px`)

// AT 1240, WHICH IS WHERE IT ACTUALLY BIT. Measured: at 1440 the sentence did
// not split the row even before this change, so a check at one width would have
// passed on the defect. Verification 15 - a criterion measured at one viewport
// stops describing the thing it was written about, and the walk runs narrow.
await page.setViewport({ width: 1240, height: 1000 })
await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
await page.waitForFunction(() => {
  const b = document.getElementById('btn-save-version')
  return b && b.getBoundingClientRect().width > 0
}, { timeout: 20000 })
await new Promise((r) => setTimeout(r, 400))
const narrow = await page.evaluate(() => {
  const row = document.getElementById('btn-save-version')?.parentElement
  const btns = [...(row?.querySelectorAll('button') ?? [])]
    .filter((b) => getComputedStyle(b).display !== 'none' && !b.classList.contains('hidden'))
  return {
    lines: [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().y)))].length,
    buttons: btns.length,
    rowH: row ? Math.round(row.getBoundingClientRect().height) : null,
  }
})
record('at 1240 the action row is still ONE line with the sentence present',
  narrow.lines === 1, `${narrow.buttons} buttons on ${narrow.lines} line(s), row ${narrow.rowH}px`)

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
