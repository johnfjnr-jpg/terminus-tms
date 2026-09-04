// ── U2, U3/U4, U11: the version panel's controls follow the record ───────
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
const puppeteer = await loadPuppeteer('usability-batch')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const db = admin()
const TAG = process.argv[2] ?? 'R41UB'
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE))
const INPUTS = { targetMargin: 30, ssNew: 10, duration: 36 }

const { oppId } = await freshOpportunity(TAG)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })

const openCommercials = async () => {
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.waitForFunction(() => !!document.getElementById('btn-save-version'), { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && !p.classList.contains('hidden') && getComputedStyle(p).visibility === 'visible'
  }, { timeout: 20000 })
  // The gate's answer must be KNOWN before reading control visibility.
  await page.waitForFunction(() => window.oppVersionGateApplies?.() !== null, { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 400))
}
const vis = (id) => page.evaluate((x) => {
  const e = document.getElementById(x)
  if (!e) return 'absent'
  const cs = getComputedStyle(e)
  return (e.classList.contains('hidden') || cs.display === 'none') ? 'hidden' : 'shown'
}, id)

// ── U3/U4 AT QUALIFICATION ───────────────────────────────────────────────
await openCommercials()
record('U3: at Qualification the Issue-major control is ABSENT', (await vis('btn-issue-version')) === 'hidden',
  `issue=${await vis('btn-issue-version')}`)
record('U3: Save version stays available for draft/minor work',
  (await vis('btn-save-version')) === 'shown', `save=${await vis('btn-save-version')}`)
record('U4: the approval request is absent too, as before',
  (await vis('btn-request-pricing-approval')) === 'hidden')

// ── U2: A SECTION'S OWN SAVE ─────────────────────────────────────────────
const u2 = await page.evaluate(() => {
  const before = document.querySelectorAll('.latch-row .section-save').length
  const el = document.getElementById('deal-warrantyPct') || document.getElementById('deal-targetMargin')
  if (!el) return { before, after: -1, id: null }
  el.focus(); el.value = String(Number(el.value || 0) + 3)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  const saves = [...document.querySelectorAll('.latch-row .section-save')]
  return { before, after: saves.length, id: el.id,
    section: saves[0]?.closest('.deal-section')?.id ?? null,
    inSameSection: saves[0]?.closest('.deal-section') === el.closest('.deal-section') }
})
record('U2: no section save before anything is edited', u2.before === 0, `${u2.before} shown`)
record('U2: editing a field puts a Save on THAT section\'s title line',
  u2.after === 1 && u2.inSameSection, `${u2.after} save(s), section=${u2.section}, same=${u2.inSameSection}`)

// ── AT PROPOSAL the official acts appear ─────────────────────────────────
await page.evaluate(() => location.reload())
await page.waitForFunction(() => !!document.getElementById('app-shell'), { timeout: 25000 })
const { error: mv } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
if (mv) throw mv
await openCommercials()
record('U3: at Proposal the Issue-major control APPEARS', (await vis('btn-issue-version')) === 'shown',
  `issue=${await vis('btn-issue-version')}`)

// ── U11: a newer DRAFT blocks the approval request ───────────────────────
const d1 = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: INPUTS, rates: priced(INPUTS), reason: 'first', expected_revision: await rev() })).data
await api('POST', `/deal-sheet-versions/${d1.id}/issue`, {})
await openCommercials()
const readyState = await page.evaluate(() => {
  const b = document.getElementById('btn-request-pricing-approval')
  return { disabled: b?.disabled, label: b?.textContent.trim() }
})
record('U11 control: with only an issued major, the request is available',
  readyState.disabled === false, `"${readyState.label}"`)

const inputs2 = { ...INPUTS, targetMargin: 34 }
await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: inputs2, rates: priced(inputs2), reason: 'a newer draft', expected_revision: await rev() })
await openCommercials()
const blocked = await page.evaluate(() => {
  const b = document.getElementById('btn-request-pricing-approval')
  return { disabled: b?.disabled, title: b?.title ?? '',
    state: (document.getElementById('pricing-approval-state')?.textContent ?? '').trim() }
})
record('U11: a draft newer than the issued major BLOCKS the approval request',
  blocked.disabled === true, `disabled=${blocked.disabled}`)
record('U11: and says why, naming the draft',
  /is a draft/.test(blocked.state) && /Issue it/.test(blocked.state), `"${blocked.state.slice(0, 72)}"`)

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
