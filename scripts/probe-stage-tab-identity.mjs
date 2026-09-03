// ── THE TAB STRIP MUST AGREE WITH THE RECORD IT IS SHOWING ───────────────
//
// Round 41, W3, 2026-09-03. The walk saw a Qualification record whose progress
// chevron read Qualification while the tab strip's current-stage dot sat on
// Proposal. Not a leak and not stage-gating: the dot carried the PREVIOUSLY
// VIEWED record's stage.
//
// The cause was this session's own reconcile in renderOppStageTabs. Its
// signature is the stage LIST, identical for every opportunity, so navigating
// between records always takes the reconcile path - which returned before
// re-marking the dot.
//
// THREE PROPERTIES, ASSERTED TOGETHER, because fixing one of them has broken
// another twice in this project: the dot follows the record, a deliberate
// selection survives a re-render (X1), and a transition lands on the new stage.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { admin } from './fixtures.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const puppeteer = await loadPuppeteer('stage-tab-identity')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const db = admin()
const pick = async (stage) => {
  const { data, error } = await db.from('records').select('id, reference_code, status')
    .eq('record_type', 'opportunity').is('deleted_at', null).eq('status', stage).limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`no live opportunity at ${stage} to measure against`)
  return data
}
const A = await pick('Proposal')
const B = await pick('Qualification')

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })

const strip = () => page.evaluate(() => ({
  dot: [...document.querySelectorAll('#opp-detail-tabs .detail-tab[data-opp-stage-tab]')]
    .filter((b) => b.querySelector('.opp-tab-current-dot')).map((b) => b.dataset.oppStageTab),
  active: document.querySelector('#opp-detail-tabs .detail-tab.active')?.dataset.oppTab ?? '(none)',
  activeStage: document.querySelector('#opp-detail-tabs .detail-tab.active')?.dataset.oppStageTab ?? null,
}))
const go = async (rec) => {
  await page.evaluate((id) => navigate('opportunity-detail', id), rec.id)
  // Wait on the reference code being on screen, then on the strip carrying a
  // dot at all. Counterfactual: mid-load the strip has no generated tabs, so
  // this is not already true of the previous record's view.
  await page.waitForFunction((r) => document.body.innerText.includes(r), { timeout: 25000 }, rec.reference_code)
  await page.waitForFunction(() =>
    document.querySelectorAll('#opp-detail-tabs .detail-tab[data-opp-stage-tab]').length > 0, { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 1200))
}

// ── 1. THE DOT FOLLOWS THE RECORD ────────────────────────────────────────
await go(B)
let s = await strip()
record('the dot is on the record\'s own stage, arriving fresh',
  s.dot.length === 1 && s.dot[0] === B.status, `dot=[${s.dot}] record=${B.status}`)

await go(A)
s = await strip()
record('the dot FOLLOWS to the next record\'s stage',
  s.dot.length === 1 && s.dot[0] === A.status,
  `dot=[${s.dot}] record=${A.status}  (this is the walk defect: it kept "${B.status}")`)

await go(B)
s = await strip()
record('and back again, so it is not simply latching once',
  s.dot.length === 1 && s.dot[0] === B.status, `dot=[${s.dot}] record=${B.status}`)

// ── 2. THE SELECTED TAB NEVER NAMES A STAGE THE RECORD IS NOT IN ─────────
record('the selected tab is the record\'s stage or Reference, never a wrong stage',
  s.active === 'reference' || s.activeStage === B.status,
  `active=${s.active} activeStage=${s.activeStage} record=${B.status}`)

// ── 3. X1: A DELIBERATE SELECTION SURVIVES A RE-RENDER ───────────────────
await page.evaluate(() => {
  [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
    .find((b) => b.dataset.oppStageTab === 'Negotiating')?.click()
})
await new Promise((r) => setTimeout(r, 900))
const chosen = await strip()
record('a deliberate selection takes effect', chosen.activeStage === 'Negotiating', `active=${chosen.active}`)

await page.evaluate((id) => loadOpportunityDetail(id), B.id)
await page.waitForFunction(() =>
  document.querySelectorAll('#opp-detail-tabs .detail-tab[data-opp-stage-tab]').length > 0, { timeout: 25000 })
await new Promise((r) => setTimeout(r, 1200))
const afterRerender = await strip()
record('X1: the deliberate selection SURVIVES a re-render',
  afterRerender.activeStage === 'Negotiating', `active=${afterRerender.active}`)
record('and the dot still names the record, not the chosen tab',
  afterRerender.dot.length === 1 && afterRerender.dot[0] === B.status,
  `dot=[${afterRerender.dot}] selected=${afterRerender.activeStage}`)

// ── 4. A TRANSITION LANDS ON THE NEW STAGE ───────────────────────────────
// THE REAL PATH, not the flag on its own. landOppOnStage records where to land
// and loadOpportunityDetail applies it on the next render, which is why the
// first version of this check failed against working code: it set the landing
// and never rendered. oppRereadFollowingStage is the single re-read path the
// poll and the manual Refresh both use.
await page.evaluate(async (id) => {
  if (window.oppRereadFollowingStage) return window.oppRereadFollowingStage(id, 'Solution Alignment')
  window.landOppOnStage?.('Solution Alignment')
  return loadOpportunityDetail(id)
}, B.id)
await page.waitForFunction(() =>
  document.querySelectorAll('#opp-detail-tabs .detail-tab[data-opp-stage-tab]').length > 0, { timeout: 25000 })
await new Promise((r) => setTimeout(r, 1200))
const landed = await strip()
record('a transition lands the strip on the new stage',
  landed.activeStage === 'Solution Alignment', `active=${landed.active}`)

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
