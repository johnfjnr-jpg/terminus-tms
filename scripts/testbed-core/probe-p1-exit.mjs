// ── ROUND A PHASE 1: THE EXIT-CRITERIA TICK, LIVE ────────────────────────
//
// P0.3's re-run proves the panel renders what the route sends. It cannot see
// the WRITE half, so this drives it on the real screen against a tagged
// fixture Test Bed at Qualification, reading other stages through the tabs
// (the route answers any `?stage=`):
//
//   T1  Monitoring and Analysis: the one real tick key renders tickable and
//       visible; the summary names to_stage.
//   T2  tick: the PATCH body carries an ISO timestamp, the stored payload holds
//       it, and after the recompute the row's SERVER met is true.
//   T3  untick: the PATCH body carries null and the stored key is gone.
//   T4  a refused tick (409, made real by moving the record out of band) says
//       why in the panel and leaves the row as it was.
//   T5  Installation: the labelled `installer_account_id` row is computed,
//       and a click on it sends no PATCH.
//   T6  the door: the record handed to another owner, the tick row is inert to
//       the mouse AND to the keyboard, and no PATCH is sent.
//
// Every write claim is read from the DATABASE, not from a status code
// (Verification 40). Measurements precede captures, and captures are of the
// page (Verification 4). UNWIRED: builds live records and drives a browser.
//
// Run: TBCORE_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-core/probe-p1-exit.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin, handOver } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('probe-p1-exit.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBCORE_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-core/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBCORE-P1-${Date.now()}`
const FIELD = 'exitMonAllMeetingActionsCompleted'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

const storedPayload = async (id) => must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).single(), 'rev')

let fx
try {
  fx = await freshTestBed(TAG)
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}`)
  const browser = await puppeteer.launch({ headless: 'new' })
  const net = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1200 })
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url(), body: r.postData() ?? null, req: r, done: false }) })
    page.on('requestfinished', async (r) => {
      const e = net.find((n) => n.req === r); if (!e) return
      e.status = r.response()?.status(); try { e.resp = await r.response().text() } catch { e.resp = null }
      e.done = true
    })
    const waitReq = async (pred, from, ms = 20000) => {
      const t = Date.now()
      while (Date.now() - t < ms) { const h = net.slice(from).find((n) => n.done && pred(n)); if (h) return h; await new Promise((r) => setTimeout(r, 50)) }
      return null
    }
    const patchesSince = (i) => net.slice(i).filter((n) => n.method === 'PATCH' && n.url.includes(`/test-beds/${fx.bedId}`))
    const V = '#view-test-bed-detail'
    const openStage = async (stage) => {
      const mark = net.length
      await page.click(`${V} [data-testid="tb-tab-btn-stage-${stage}"]`)
      await page.waitForFunction((v, s) => document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"][data-stage="${s}"]`), { timeout: 20000 }, V, stage)
      const resp = await waitReq((n) => n.url.includes('/exit-criteria') && n.url.includes(encodeURIComponent(stage)), mark)
      await frames(page)
      return JSON.parse(resp.resp)
    }
    const rowState = () => page.evaluate((v, f) => {
      const row = document.querySelector(`${v} [data-testid="tb-crit-${f}"]`)
      if (!row) return null
      const r = row.getBoundingClientRect()
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { ariaChecked: row.getAttribute('aria-checked'), dataMet: row.dataset.met, role: row.getAttribute('role'),
        tabindex: row.getAttribute('tabindex'), ariaDisabled: row.getAttribute('aria-disabled'),
        height: r.height, display: getComputedStyle(row).display, pointerEvents: getComputedStyle(row).pointerEvents,
        hit: !!at && (at === row || row.contains(at)),
        feedback: document.querySelector(`${v} [data-testid="tb-crit-feedback"]`)?.textContent ?? null }
    }, V, FIELD)

    const boot = async () => {
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
      await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
      await page.reload({ waitUntil: 'networkidle0' })
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-tab-btn-stage-Qualification"]`), { timeout: 30000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    }
    await boot()

    console.log('\n=== T1 Monitoring and Analysis renders the real tick key ===')
    const mon = await openStage('Monitoring and Analysis')
    const t1 = await page.evaluate((v) => {
      const p = document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"]`)
      return { summary: p.querySelector('[data-testid="tb-crit-summary"]')?.textContent, rows: p.querySelectorAll('.tb-crit-row').length,
        tickables: [...p.querySelectorAll('[role="checkbox"]')].map((e) => e.dataset.field) }
    }, V)
    const out = mon.requirements.filter((r) => !r.met).length
    check(t1.summary === `${out} of ${mon.requirements.length} outstanding to move to ${mon.to_stage}:`, 'summary counts all requirements and names to_stage', t1.summary)
    check(JSON.stringify(t1.tickables) === JSON.stringify([FIELD]), 'exactly one tickable row, the real tick key', JSON.stringify(t1.tickables))
    const s1 = await rowState()
    check(!!s1 && s1.height > 0 && s1.display !== 'none' && s1.hit, 'the tick row is VISIBLE and a click at its centre reaches it', JSON.stringify(s1))
    check(s1?.ariaChecked === 'false' && s1?.dataMet === 'false', 'it starts unticked by the server\'s met')

    console.log('\n=== T2 tick ===')
    let mark = net.length
    const before2 = await storedPayload(fx.bedId)
    await page.click(`${V} [data-testid="tb-crit-${FIELD}"]`)
    const p2 = await waitReq((n) => n.method === 'PATCH' && n.url.includes(`/test-beds/${fx.bedId}`), mark)
    const body2 = p2 ? JSON.parse(p2.body) : null
    check(p2?.status === 200, 'the tick PATCH was accepted', `status ${p2?.status}`)
    check(typeof body2?.payload?.[FIELD] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(body2.payload[FIELD]), 'its body carries an ISO timestamp, not a boolean', JSON.stringify(body2?.payload))
    check(body2?.expected_revision === before2.revision_number, 'it carries the revision precondition', `${body2?.expected_revision} vs stored ${before2.revision_number}`)
    await waitReq((n) => n.url.includes('/exit-criteria') && n.url.includes('Monitoring'), mark + 1)
    await page.waitForFunction((v, f) => document.querySelector(`${v} [data-testid="tb-crit-${f}"]`)?.dataset.met === 'true', { timeout: 20000 }, V, FIELD).catch(() => {})
    const s2 = await rowState()
    const after2 = await storedPayload(fx.bedId)
    check(after2.revision_number === before2.revision_number + 1 && after2.payload[FIELD] === body2?.payload?.[FIELD], 'the STORED payload holds that timestamp at the next revision', `rev ${before2.revision_number} -> ${after2.revision_number}`)
    check(s2?.ariaChecked === 'true' && s2?.dataMet === 'true', 'after the recompute the row is ticked by the SERVER\'s met', JSON.stringify({ a: s2?.ariaChecked, m: s2?.dataMet }))
    await page.screenshot({ path: `${OUT}p1-ticked-1920.png` })

    console.log('\n=== T3 untick ===')
    mark = net.length
    await page.click(`${V} [data-testid="tb-crit-${FIELD}"]`)
    const p3 = await waitReq((n) => n.method === 'PATCH' && n.url.includes(`/test-beds/${fx.bedId}`), mark)
    const body3 = p3 ? JSON.parse(p3.body) : null
    check(p3?.status === 200 && body3?.payload && body3.payload[FIELD] === null, 'the untick PATCH sends null and is accepted', JSON.stringify(body3?.payload))
    await page.waitForFunction((v, f) => document.querySelector(`${v} [data-testid="tb-crit-${f}"]`)?.dataset.met === 'false', { timeout: 20000 }, V, FIELD).catch(() => {})
    const after3 = await storedPayload(fx.bedId)
    check(!(FIELD in after3.payload), 'the stored key is GONE, not stored as null or false', `keys: ${Object.keys(after3.payload).filter((k) => k.startsWith('exit')).join(',') || 'none'}`)
    const s3 = await rowState()
    check(s3?.ariaChecked === 'false' && s3?.dataMet === 'false', 'the row reads unticked by the server')

    console.log('\n=== T4 a refused tick says why and leaves the row alone ===')
    // Out of band, through the ordinary route: the record moves on, so the
    // screen's revision is stale and the tick answers 409.
    await api('PATCH', `/test-beds/${fx.bedId}`, { payload: { summary: `${TAG} moved` }, expected_revision: after3.revision_number })
    const before4 = await storedPayload(fx.bedId)
    mark = net.length
    await page.click(`${V} [data-testid="tb-crit-${FIELD}"]`)
    const p4 = await waitReq((n) => n.method === 'PATCH' && n.url.includes(`/test-beds/${fx.bedId}`), mark)
    await page.waitForFunction((v) => (document.querySelector(`${v} [data-testid="tb-crit-feedback"]`)?.textContent ?? '') !== '', { timeout: 20000 }, V).catch(() => {})
    const s4 = await rowState()
    const after4 = await storedPayload(fx.bedId)
    check(p4?.status === 409, 'the stale tick was refused 409', `status ${p4?.status}`)
    check(/^Could not update: /.test(s4?.feedback ?? ''), 'the panel says why', JSON.stringify(s4?.feedback))
    check(s4?.ariaChecked === 'false' && after4.revision_number === before4.revision_number && !(FIELD in after4.payload), 'the row and the stored record are unchanged')
    await page.screenshot({ path: `${OUT}p1-refused-1920.png` })

    console.log('\n=== T5 Installation: a labelled non-key field is read-only ===')
    const inst = await openStage('Installation and Commissioning')
    const installerReq = inst.requirements.find((r) => r.field === 'installer_account_id')
    check(!!installerReq?.label, 'the live Installation response carries the labelled installer_account_id rule', JSON.stringify(installerReq))
    const t5 = await page.evaluate((v) => {
      const p = document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"]`)
      const row = [...p.querySelectorAll('.tb-crit-row')].find((e) => e.dataset.field === 'installer_account_id')
      return row ? { cls: row.className, role: row.getAttribute('role'), tabindex: row.getAttribute('tabindex'), text: row.textContent.trim(), height: row.getBoundingClientRect().height, tickables: p.querySelectorAll('[role="checkbox"]').length } : null
    }, V)
    check(!!t5 && t5.height > 0 && t5.cls.includes('tb-crit-row--computed') && t5.role === null && t5.tabindex === null && t5.tickables === 0, 'the Installer row renders, visible, computed, with no role and no tab stop', JSON.stringify(t5))
    mark = net.length
    await page.evaluate((v) => [...document.querySelectorAll(`${v} .tb-crit-row`)].find((e) => e.dataset.field === 'installer_account_id').scrollIntoView({ block: 'center' }), V)
    const hit = await page.evaluate((v) => { const row = [...document.querySelectorAll(`${v} .tb-crit-row`)].find((e) => e.dataset.field === 'installer_account_id'); const r = row.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, on: row.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) } }, V)
    await page.mouse.click(hit.x, hit.y)
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 })
    check(hit.on && patchesSince(mark).length === 0, 'a real click ON the Installer row sends no PATCH', `click landed on row: ${hit.on}; PATCHes: ${patchesSince(mark).length}`)

    console.log('\n=== T6 the door, on somebody else\'s record ===')
    const other = must(await db.from('records').select('owner_id').eq('record_type', 'test_bed').is('deleted_at', null).neq('owner_id', OWNER.user.id).limit(1).single(), 'other').owner_id
    await handOver(fx.bedId, other)
    await boot()
    await openStage('Monitoring and Analysis')
    await page.waitForFunction((v, f) => document.querySelector(`${v} [data-testid="tb-crit-${f}"]`)?.getAttribute('aria-disabled') === 'true', { timeout: 10000 }, V, FIELD).catch(() => {})
    const s6 = await rowState()
    const before6 = await storedPayload(fx.bedId)
    mark = net.length
    await page.evaluate((v, f) => { const r = document.querySelector(`${v} [data-testid="tb-crit-${f}"]`); r.scrollIntoView({ block: 'center' }) }, V, FIELD)
    const c6 = await page.evaluate((v, f) => { const r = document.querySelector(`${v} [data-testid="tb-crit-${f}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, V, FIELD)
    await page.mouse.click(c6.x, c6.y)
    await page.evaluate((v, f) => document.querySelector(`${v} [data-testid="tb-crit-${f}"]`).focus(), V, FIELD)
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 })
    const after6 = await storedPayload(fx.bedId)
    check(s6?.ariaDisabled === 'true' && s6?.tabindex === '-1' && s6?.pointerEvents === 'none', 'the door marks the tick row inert (aria-disabled, no tab stop, no pointer events)', JSON.stringify({ ad: s6?.ariaDisabled, ti: s6?.tabindex, pe: s6?.pointerEvents }))
    check(patchesSince(mark).length === 0, 'mouse, Space and Enter on the unowned row send NO PATCH', `PATCHes: ${patchesSince(mark).length}`)
    check(after6.revision_number === before6.revision_number, 'the unowned record is unchanged')
    const writesSeen = net.filter((n) => n.method === 'PATCH').length
    check(writesSeen >= 3, 'CALIBRATION: the same listener saw the owner\'s PATCHes earlier in this run', `${writesSeen} PATCHes captured`)
    await page.screenshot({ path: `${OUT}p1-door-1920.png` })
  } finally {
    await browser.close()
    writeFileSync(`${OUT}p1-network.json`, JSON.stringify(net.map(({ req, ...n }) => n), null, 1))
  }
} finally {
  const r = await tearDown(TAG)
  console.log(`\nteardown: removed ${r.removed.length} (${r.removed.map((x) => x.record_type).join(',')}), remaining ${r.remaining}, handedBack ${r.handedBack}`)
  if (fx) {
    const left = must(await db.from('records').select('id,deleted_at').or(`id.eq.${fx.bedId},id.eq.${fx.accountId},parent_record_id.eq.${fx.bedId}`), 'left')
    console.log(`  live after teardown: ${left.filter((l) => !l.deleted_at).length} of ${left.length}`)
  }
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks PASS`)
  process.exitCode = failed.length ? 1 : 0
}
