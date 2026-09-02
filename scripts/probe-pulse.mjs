// ── F4: THE SCREEN STAYS CURRENT IN A TWO-SESSION WORKFLOW ────────────────
//
// The three claims F4 was ruled on, each measured in a real browser rather
// than reasoned about:
//
//   1. a change made OUTSIDE this session reaches the screen within one poll
//      interval, with NO manual refresh, and the screen follows the record's
//      stage rather than the tab it was on
//   2. a record left open in a HIDDEN tab issues no polls
//   3. an UNCHANGED record triggers no re-render
//
// The second session is the API, not a second browser. That is the same fact
// under test - a write this session did not make - and it removes a whole
// browser, a second sign-in and the timing that comes with them. What it cannot
// cover is a second person's UI, which nothing here claims.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-pulse.mjs')
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const SESSION_USER_ID = session.user.id
const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const TAG = process.argv[2] ?? 'R41PULSE'
const { oppId } = await freshOpportunity(`${TAG}P`)
// Qualification's exit criterion, satisfied up front so the stage move below
// tests the SCREEN following a transition rather than the gate refusing one.
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {}).catch(() => {})

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]))
await page.setViewport({ width: 1600, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
await page.waitForFunction(() => document.querySelectorAll('[data-opp-stage-tab]').length > 0,
  { timeout: 25000 })

const interval = await page.evaluate(() => window.OPP_PULSE_INTERVAL_MS ?? null)
const stats = () => page.evaluate(() => ({ ...window.__oppPulseStats }))
const freshOf = () => page.evaluate(() => window.__oppFreshnessAt())
const held = () => page.evaluate(() => ({
  stage: window.__oppCurrentStage?.() ?? null,
  revision: window.__oppLoadedRevision?.() ?? null,
}))

record('the interval is exposed as one constant', Number.isInteger(interval), `${interval}ms`)
// ── THE BAND WAS RE-RULED. R4/R7, 2026-09-02 ────────────────────────────
//
// F4 ruled 5-10s and this asserted it. The walk then reported the two-session
// move as feeling slow, and the measurement agreed: the interval is what a
// person waits, because a tick is one small request and only a CHANGED record
// costs a re-read. Re-ruled to 3-4s.
//
// The property is unchanged and is what this line protects: the interval is ONE
// NAMED CONSTANT in a deliberate band, not a number somebody tuned in place.
record('it is in the ruled 3-4s band', interval >= 3000 && interval <= 4000, `${interval}ms`)

// ── CLAIM 3: an UNCHANGED record triggers no re-render ────────────────────
const before = await stats()
await page.waitForFunction((n) => window.__oppPulseStats.polls > n, { timeout: 30000 }, before.polls)
await new Promise((r) => setTimeout(r, interval + 1500))
const quiet = await stats()
record('an unchanged record polls', quiet.polls > before.polls, `polls ${before.polls} -> ${quiet.polls}`)
record('an unchanged record triggers NO re-read', quiet.rereads === before.rereads,
  `rereads ${before.rereads} -> ${quiet.rereads}`)

// ── CLAIM 1: a change made outside this session reaches the screen ────────
const startStage = (await held()).stage
const atChange = await stats()
// The write the browser did not make. A payload PATCH is the cheapest change
// that moves the revision without a stage move.
await api('PATCH', `/opportunities/${oppId}`, {
  payload: { targetMargin: 41 },
  expected_revision: (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number,
})
// Wrapped, so a failure reads as a named FAIL rather than a puppeteer stack.
// `record(..., true)` was also wrong on its own terms: it asserted nothing, and
// would have reported a pass for any outcome the wait did not throw on.
let sawChange = true
try {
  await page.waitForFunction((n) => window.__oppPulseStats.rereads > n, { timeout: 30000 }, atChange.rereads)
} catch { sawChange = false }
record('a change made OUTSIDE this session re-reads, with no manual refresh', sawChange,
  sawChange ? `rereads ${atChange.rereads} -> ${(await stats()).rereads}`
    : 'no re-read in 30s: the poll cannot see a payload write')

// ── CLAIM 1b: a STAGE move makes the screen follow the record ─────────────
await page.evaluate(() => {
  const t = [...document.querySelectorAll('[data-opp-stage-tab]')][0]
  if (t) t.click()
})
const tabBefore = await page.evaluate(() => document.querySelector('[data-opp-tab].active')?.dataset.oppTab ?? null)
const stageBefore = (await held()).stage
const atStage = await stats()
// ── A REAL TRANSITION THROUGH THE ROUTE, and a BACKWARD one on purpose ────
//
// A forward move on an Opportunity needs the approval workflow, which is three
// identities and a different probe's job. A backward move is a real transition
// through the same route, writes a revision the same way, and is ungated
// (transitions.js marks a regression `gated: false`), so it exercises exactly
// what this claim is about - the record's stage changing underneath a session
// that did not make the change - without standing up an approval quorum.
// The stage list read from the SCREEN's own tabs, which are generated from the
// record's stage definitions. Reading it here rather than from a table keeps
// the probe on the same source the assertion is about.
const names = await page.evaluate(() =>
  [...document.querySelectorAll('[data-opp-stage-panel]')].map((p) => p.getAttribute('data-opp-stage-panel')))
const here = names.indexOf(stageBefore)
const target = here >= 0 && names[here + 1] ? names[here + 1] : names.find((n) => n !== stageBefore)
if (!target) throw new Error(`no stage to move to; record is at ${stageBefore} of ${names.join(', ')}`)
await api('POST', `/records/${oppId}/transition`, { to_stage: target })

// ── WAIT ON THE STATE, NEVER ON THE COUNTER. Verification 7 ──────────────
//
// The first version waited on `rereads > n`. That counter increments BEFORE
// the reload it counts, so the wait resolved mid-flight and the probe read the
// stage the screen was still showing. It reported a working feature as broken,
// which is the same instrument fault from the other direction. The condition
// below is the claim itself and only the new state can satisfy it: the held
// stage was `stageBefore` before the transition and can only read `target`
// after the re-render has finished.
// A TIMEOUT IS A FAILURE, AND IT SHOULD READ AS ONE. Left to throw, the
// calibration exits 1 with a puppeteer stack and no sentence saying which claim
// broke. Verification 16's spirit: the moment you most need the output is the
// moment a raw stack is least useful.
let followed = true
try {
  await page.waitForFunction((want) => window.__oppCurrentStage() === want, { timeout: 30000 }, target)
} catch { followed = false }
const after = await held()
// ── THE TAB IS A SEPARATE CLAIM AND NEEDS ITS OWN WAIT ──────────────────
//
// `currentOppStage` is assigned near the top of the render and the landing tab
// is applied about twenty lines later, so the stage wait above is satisfied
// while the tab is still the old one. It passed only because the gap used to be
// too small to observe; adding one request to the render widened it and the
// probe started reporting a working feature as broken.
//
// Verification 7: a condition the unfinished state also satisfies is not a wait.
const targetKeyWanted = `stage-${target.replace(/[^a-zA-Z0-9_-]+/g, '-')}`
try {
  await page.waitForFunction((k) =>
    document.querySelector('[data-opp-tab].active')?.dataset.oppTab === k,
  { timeout: 15000 }, targetKeyWanted)
} catch { /* reported by the assertion below, with what it actually reads */ }
const tabAfter = await page.evaluate(() => document.querySelector('[data-opp-tab].active')?.dataset.oppTab ?? null)
record('the held stage follows the record, with NO manual refresh', followed && after.stage === target,
  followed ? `${stageBefore} -> ${after.stage}`
    : `still ${after.stage} after 30s; wanted ${target}. The poll cannot see a transition.`)
// THE POINT OF F4. X1 restores the tab you were on, which is right for an
// ordinary re-render and wrong for one that crossed a stage change. The tab
// must follow the record instead. The key format is the app's own, taken from
// the tab that exists rather than re-derived here: a second spelling of
// oppStageTabKey would be a second reader of it.
const targetKey = await page.evaluate((want) =>
  [...document.querySelectorAll('[data-opp-stage-panel]')]
    .find((p) => p.getAttribute('data-opp-stage-panel') === want)?.id?.replace(/^opp-tab-/, '') ?? null, target)
record('and the OPEN TAB follows it too, rather than the X1 restore', tabAfter === targetKey,
  `tab ${tabBefore} -> ${tabAfter} (wanted ${targetKey})`)

// ── CLAIM 2: a hidden tab issues no polls ─────────────────────────────────
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true })
  Object.defineProperty(document, 'hidden', { get: () => true, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
const atHide = await stats()
await new Promise((r) => setTimeout(r, interval * 2 + 1500))
const hidden = await stats()
record('a record left open in a HIDDEN tab issues no polls', hidden.polls === atHide.polls,
  `polls ${atHide.polls} -> ${hidden.polls} across ${((interval * 2 + 1500) / 1000).toFixed(1)}s`)

// And it resumes, or the pause would be a stop.
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true })
  Object.defineProperty(document, 'hidden', { get: () => false, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForFunction((n) => window.__oppPulseStats.polls > n, { timeout: 20000 }, hidden.polls)
record('and it resumes immediately when the tab comes back', true,
  `polls ${hidden.polls} -> ${(await stats()).polls}`)

// ── THE EVENT THE OLD POLL WAS BLIND TO. G2/G3 ───────────────────────────
//
// An approval touches neither the stage nor the revision, so the previous
// comparison could not see it: measured on a live approver screen, an approval
// landed and the screen re-read 0 times in 16 seconds. This is that exact case,
// now driven against the trigger-maintained freshness.
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { get: () => false, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
const baselineFresh = await freshOf()
record('the screen holds the freshness it was rendered at', !!baselineFresh, String(baselineFresh))

const atAppr = await stats()
const { error: apprErr } = await admin().from('approvals').insert({
  record_id: oppId, revision_number: 1, stage: (await held()).stage, track: 'Commercial',
  approver_id: SESSION_USER_ID, decision: 'approved', comment: 'pulse calibration',
  decided_at: new Date().toISOString(),
})
let sawApproval = true
try {
  await page.waitForFunction((n) => window.__oppPulseStats.rereads > n, { timeout: 30000 }, atAppr.rereads)
} catch { sawApproval = false }
record('an APPROVAL landing re-reads the screen, with no manual refresh',
  sawApproval && !apprErr,
  apprErr ? `(the approval write failed: ${apprErr.message.slice(0, 50)})`
    : sawApproval ? `rereads ${atAppr.rereads} -> ${(await stats()).rereads}`
      : 'no re-read in 30s; the poll is blind to an approval again')

record('no page errors', errors.length === 0, errors.join(' | ') || 'none')

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
