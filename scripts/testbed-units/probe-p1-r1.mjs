// ── TEST BED UNITS PHASE 1 (audit R1), LIVE: A READ NEVER WRITES ─────────
//
// Owned tagged fixture, counts set through the API (SafeSight 2, Air Quality 1,
// HEMIR 0), zero units:
//   A  open the Installation and Commissioning tab: ZERO non-GET requests from
//      the page (any origin), units still 0 in the database, and the button
//      offered, visible and reachable. Screenshot at 1440 with the pane in view.
//   B  click "Create the missing units": exactly one derive POST, 3 units in the
//      database, and the pane reads them back.
// Calibrated by live-specs/p1-r1.mjs (derive re-wired to tab open).
//
// UNWIRED: builds live records and drives a browser.
// Run: TBUNITS_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-units/probe-p1-r1.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('testbed-units/probe-p1-r1.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBUNITS_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-units/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBUNITS-P1-${Date.now()}`
const V = '#view-test-bed-detail'
const INSTALL = 'Installation and Commissioning'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const unitsOf = async (bedId) => must(await db.from('records').select('id,status')
  .eq('record_type', 'unit').eq('parent_record_id', bedId).is('deleted_at', null), 'units')
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

let fx
try {
  fx = await freshTestBed(TAG)
  const rev = (await api('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  await api('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: 2, airQualitySensors: 1, hemirSensors: 0 }, expected_revision: rev })
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}; units at start ${(await unitsOf(fx.bedId)).length}`)
  const browser = await puppeteer.launch({ headless: 'new' })
  const net = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000 })
    page.on('request', (r) => net.push({ method: r.method(), url: r.url(), req: r, done: false }))
    page.on('requestfinished', (r) => { const e = net.find((n) => n.req === r); if (e) { e.done = true; e.status = r.response()?.status() } })
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })

    console.log('\n=== A opening the Installation tab ===')
    const mark = net.length
    await page.click(`${V} [data-testid="tb-tab-btn-stage-${INSTALL}"]`)
    // The units pane's own read is what proves the tab really loaded: wait on its
    // text, which the pane renders only after GET /units answers.
    await page.waitForFunction((v) => /planned, \d+ built/.test(document.querySelector(`${v} [data-testid="tb-units-sub"]`)?.textContent ?? ''), { timeout: 20000 }, V)
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 })
    await frames(page)
    const opened = net.slice(mark)
    const nonGet = opened.filter((n) => n.method !== 'GET' && n.method !== 'OPTIONS')
    const derives = opened.filter((n) => n.url.includes('/units/derive'))
    // The tab-open path is the stage LOADER, and its own read is the criteria for
    // this stage. (The units list is read once by the host on mount, not per tab,
    // so it is no evidence the tab opened: the first run of this probe asserted
    // that and failed on a correct product.)
    const stageRead = opened.filter((n) => n.method === 'GET' && n.url.includes(`/records/${fx.bedId}/exit-criteria`) && decodeURIComponent(n.url).includes(`stage=${INSTALL}`))
    const unitsReadAtMount = net.slice(0, mark).filter((n) => n.method === 'GET' && n.url.endsWith(`/test-beds/${fx.bedId}/units`))
    const dbUnitsA = await unitsOf(fx.bedId)
    const pane = await page.evaluate((v) => {
      const btn = document.querySelector(`${v} [data-testid="tb-units-derive"]`)
      btn?.scrollIntoView({ block: 'center' })
      const r = btn?.getBoundingClientRect()
      const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null
      return {
        sub: document.querySelector(`${v} [data-testid="tb-units-sub"]`)?.textContent.trim(),
        button: btn ? { text: btn.textContent.trim(), disabled: btn.disabled, inViewport: r.top >= 0 && r.bottom <= innerHeight, hit: hit === btn } : null,
        correction: document.querySelector(`${v} [data-testid="tb-units-correction-text"]`)?.textContent.trim() ?? null,
      }
    }, V)
    check(stageRead.length >= 1 && unitsReadAtMount.length >= 1, 'the tab really loaded: the stage loader read this stage, and the pane had its units list', `${stageRead.length} stage read(s), ${unitsReadAtMount.length} units read(s) at mount`)
    check(nonGet.length === 0, 'opening the tab sent ZERO non-GET requests, any origin', nonGet.map((n) => `${n.method} ${n.url}`).join(', ') || 'none')
    check(derives.length === 0, 'and no /units/derive request at all', `${derives.length}`)
    check(dbUnitsA.length === 0, 'the DATABASE still holds 0 units for the bed', `${dbUnitsA.length}`)
    check(!!pane.button && !pane.button.disabled && pane.button.inViewport && pane.button.hit && pane.button.text === 'Create the missing units', 'the button is offered, enabled, in view and reachable by a click', JSON.stringify(pane))
    check(/3 planned, 0 built/.test(pane.sub ?? ''), 'the pane says 3 planned, 0 built', pane.sub)
    // MEASURE FIRST, CAPTURE SECOND, and capture the PAGE (Verification 4).
    await page.screenshot({ path: `${OUT}p1-install-tab-fresh-1440.png` })

    console.log('\n=== B the button derives ===')
    const markB = net.length
    await page.click(`${V} [data-testid="tb-units-derive"]`)
    await waitFor(() => net.slice(markB).some((n) => n.url.includes('/units/derive') && n.done))
    await page.waitForFunction((v) => /3 planned, 3 built/.test(document.querySelector(`${v} [data-testid="tb-units-sub"]`)?.textContent ?? ''), { timeout: 20000 }, V).catch(() => {})
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    const clickReqs = net.slice(markB)
    const derivesB = clickReqs.filter((n) => n.method === 'POST' && n.url.includes('/units/derive'))
    const nonGetB = clickReqs.filter((n) => n.method !== 'GET' && n.method !== 'OPTIONS')
    const dbUnitsB = await unitsOf(fx.bedId)
    const subB = await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-units-sub"]`)?.textContent.trim(), V)
    check(derivesB.length === 1 && derivesB[0].status === 200, 'the click sent exactly ONE derive POST, answered 200', derivesB.map((n) => `${n.method} ${n.status}`).join(', '))
    check(nonGetB.length === 1, 'and no other write', `${nonGetB.length} non-GET`)
    check(dbUnitsB.length === 3, 'the DATABASE now holds 3 units (SafeSight 2 + Air Quality 1)', `${dbUnitsB.length}`)
    check(/3 planned, 3 built/.test(subB ?? ''), 'the pane reads them back: 3 planned, 3 built', subB)
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  if (fx) {
    const t = await tearDown(TAG)
    console.log(`\nteardown: removed ${t.removed.length} (${t.removed.map((r) => r.record_type).join(',')}), remaining ${t.remaining}`)
  }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
