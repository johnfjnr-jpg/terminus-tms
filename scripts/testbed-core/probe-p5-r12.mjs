// ── ROUND A RULING R12, LIVE: THE BLOCKED LIST AND THE HOST'S OWN RELOAD ──
//
// Against a tagged fixture Test Bed at Qualification:
//
//   R8   Next Stage is refused 422 and the itemised list renders; it is STILL
//        THERE after a switch to Reference and back.
//   R12  a real host save (a use case added through the Reference sub-tab, one
//        PATCH answered 200 and the record reloaded by the host) leaves the
//        list GONE; the database holds the use case; the element survives with
//        its id, and the next attempt renders into it again.
//
// Calibrated by live-specs/p5-r12.mjs: the host reload no longer clearing, and
// the clear running on every render.
//
// UNWIRED: builds live records and drives a browser.
// Run: TBCORE_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-core/probe-p5-r12.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('probe-p5-r12.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBCORE_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-core/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBCORE-P5R12-${Date.now()}`
const V = '#view-test-bed-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

let fx
try {
  fx = await freshTestBed(TAG)
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}`)
  const browser = await puppeteer.launch({ headless: 'new' })
  const net = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1200 })
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), req: r, done: false }) })
    page.on('requestfinished', async (r) => {
      const e = net.find((n) => n.req === r); if (!e) return
      e.status = r.response()?.status() ?? null
      try { e.resp = await r.response()?.text() } catch { e.resp = null }
      e.done = true
    })
    const since = (i, pred) => net.slice(i).filter(pred)
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
    const tab = async (key, ready) => {
      await page.click(`${V} [data-testid="tb-tab-btn-${key}"]`)
      await page.waitForFunction(ready, { timeout: 20000 }, V)
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 })
      await frames(page)
    }
    const feedback = () => page.evaluate((v) => {
      const byId = document.querySelectorAll('#tb-next-stage-feedback')
      const el = byId[0]
      return { byId: byId.length, sameAsTestid: el === document.querySelector(`${v} [data-testid="tb-next-stage-feedback"]`),
        blocked: !!el && el.textContent.includes('Transition blocked.'), items: el ? el.querySelectorAll('.blocking-list li').length : 0,
        html: el ? el.innerHTML.length : -1 }
    }, V)
    const stageReady = (v) => document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"][data-stage="Qualification"]`)
    const attempt = async () => {
      const mark = net.length
      await page.click(`${V} [data-testid="tb-next-stage-btn"]`)
      await waitFor(() => since(mark, (n) => n.url.endsWith('/transition') && n.done).length === 1)
      await page.waitForFunction(() => document.getElementById('tb-next-stage-feedback')?.querySelector('.blocking-list li'), { timeout: 10000 }).catch(() => {})
      await frames(page)
      const t = since(mark, (n) => n.url.endsWith('/transition'))[0]
      return { status: t?.status, blocking: t?.resp ? (JSON.parse(t.resp).blocking ?? []).length : -1 }
    }

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, ref) => [...document.querySelectorAll(`${v} [data-testid="tb-detail-name"]`)].some((h) => h.textContent.includes(ref)), { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })

    console.log('\n=== R8: a refusal, then a tab switch ===')
    await tab('stage-Qualification', stageReady)
    const a1 = await attempt()
    const f1 = await feedback()
    check(a1.status === 422 && a1.blocking > 0 && f1.blocked && f1.items === a1.blocking, 'Next Stage refused 422 and the itemised list renders, every item', `${a1.status}, ${a1.blocking} items; ${JSON.stringify(f1)}`)
    await tab('reference', (v) => document.querySelector(`${v} [data-testid="tb-ref-subtabs-btn-useCases"]`))
    await tab('stage-Qualification', stageReady)
    const f2 = await feedback()
    check(f2.blocked && f2.items === a1.blocking, 'R8: the list is STILL THERE after a switch to Reference and back', JSON.stringify(f2))

    console.log('\n=== R12: a host save and the reload after it ===')
    await tab('reference', (v) => document.querySelector(`${v} [data-testid="tb-ref-subtabs-btn-useCases"]`))
    await page.click(`${V} [data-testid="tb-ref-subtabs-btn-useCases"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-usecase-input"]`), { timeout: 20000 }, V)
    const before = await feedback()
    check(before.blocked && before.items === a1.blocking, 'before the save the list is present (so its absence afterwards means something)', JSON.stringify(before))
    const text = `${TAG} use case`
    await page.type(`${V} [data-testid="tb-usecase-input"]`, text)
    const mark = net.length
    await page.click(`${V} [data-testid="tb-usecase-add"]`)
    await waitFor(() => since(mark, (n) => n.method === 'PATCH' && n.url === `/api/test-beds/${fx.bedId}` && n.done).length === 1)
    const patch = since(mark, (n) => n.method === 'PATCH' && n.url === `/api/test-beds/${fx.bedId}`)[0]
    await waitFor(() => since(mark, (n) => n.method === 'GET' && n.url === `/api/test-beds/${fx.bedId}` && n.done).length >= 1)
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 })
    await frames(page)
    const reloads = since(mark, (n) => n.method === 'GET' && n.url === `/api/test-beds/${fx.bedId}` && n.done).length
    check(patch?.status === 200 && reloads >= 1, 'the save was accepted and the HOST reloaded the record', `PATCH ${patch?.status}; GET /test-beds/:id after it = ${reloads}`)
    const rec = must(await db.from('record_revisions').select('revision_number,payload').eq('record_id', fx.bedId).order('revision_number', { ascending: false }).limit(1).single(), 'latest revision')
    check(Array.isArray(rec.payload?.useCases) && rec.payload.useCases.includes(text), 'the DATABASE holds the use case just saved', JSON.stringify(rec.payload?.useCases ?? null))
    const hostOnView = await page.evaluate((v) => !document.querySelector(v).classList.contains('hidden') && !!document.querySelector(`${v} [data-testid="tb-usecase-input"]`), V)
    const f3 = await feedback()
    check(hostOnView && f3.byId === 1 && f3.sameAsTestid && !f3.blocked && f3.items === 0 && f3.html === 0, 'R12: after the host reload the list is GONE, the element remains with its id, and the view never left', JSON.stringify({ hostOnView, ...f3 }))
    await page.screenshot({ path: `${OUT}p5-r12-after-save-1920.png` })

    await tab('stage-Qualification', stageReady)
    const f4 = await feedback()
    check(!f4.blocked && f4.items === 0, 'and it stays gone on the stage tab', JSON.stringify(f4))
    const a2 = await attempt()
    const f5 = await feedback()
    check(a2.status === 422 && f5.blocked && f5.items === a2.blocking, 'the next attempt renders into the same element again', `${a2.status}, ${a2.blocking} items; ${JSON.stringify(f5)}`)
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
