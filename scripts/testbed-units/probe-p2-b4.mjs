// ── TEST BED UNITS PHASE 2 (audit B4 + ruling R3), LIVE ──────────────────
//
// Owned tagged fixture, one SafeSight unit created deliberately by the derive
// route (the button's path), then:
//
//   A  the CLIENT save: a serial typed into the row and blurred reaches
//      PATCH /test-beds/:id/units/:unitId with a FLAT body naming serialNumber,
//      is answered 200, is stored, and is still there after a reload.
//   B  the SERVER refusal (R3): a body carrying no recognised key is answered
//      400 with a sentence naming what it refused, and appends NO revision.
//      The positive control follows, so the refusal is not "the route is dead".
//
// UNWIRED: builds live records and drives a browser.
// Run: TBUNITS_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-units/probe-p2-b4.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('testbed-units/probe-p2-b4.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBUNITS_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-units/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBUNITS-P2-${Date.now()}`
const V = '#view-test-bed-detail'
const INSTALL = 'Installation and Commissioning'
const SERIAL = `SN-${Date.now()}`
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const unitRev = async (id) => must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).maybeSingle(), 'unit revision')
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

let fx
try {
  fx = await freshTestBed(TAG)
  const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  await call('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: 1, airQualitySensors: 0, hemirSensors: 0 }, expected_revision: rev })
  await call('POST', `/test-beds/${fx.bedId}/units/derive`, {})
  const units = must(await db.from('records').select('id').eq('record_type', 'unit').eq('parent_record_id', fx.bedId).is('deleted_at', null), 'units')
  const unit = units[0]
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}; unit ${unit.id}`)

  const browser = await puppeteer.launch({ headless: 'new' })
  const net = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000 })
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
    page.on('requestfinished', async (r) => { const e = net.find((n) => n.req === r); if (!e) return; e.status = r.response()?.status() ?? null; try { e.resp = await r.response()?.text() } catch { e.resp = null } e.done = true })
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
    const open = async () => {
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
      await page.click(`${V} [data-testid="tb-tab-btn-stage-${INSTALL}"]`)
      await page.waitForFunction((v, id) => document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`), { timeout: 20000 }, V, unit.id)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
      await frames(page)
    }
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await open()

    console.log('\n=== A the client save ===')
    const before = await unitRev(unit.id)
    const mark = net.length
    await page.click(`${V} [data-testid="tb-unit-serial-${unit.id}"]`)
    await page.type(`${V} [data-testid="tb-unit-serial-${unit.id}"]`, SERIAL)
    await page.click(`${V} [data-testid="tb-units-sub"]`)
    await waitFor(() => net.slice(mark).some((n) => n.method === 'PATCH' && n.done))
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    await frames(page)
    const patch = net.slice(mark).find((n) => n.method === 'PATCH')
    const body = patch?.body ? JSON.parse(patch.body) : null
    const after = await unitRev(unit.id)
    const row = await page.evaluate((v, id) => ({ state: document.querySelector(`${v} [data-testid="tb-unit-state-${id}"]`)?.textContent ?? null, value: document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`)?.value ?? null }), V, unit.id)
    check(patch?.url === `/api/test-beds/${fx.bedId}/units/${unit.id}`, 'the save goes to the REAL route, PATCH /test-beds/:id/units/:unitId', patch?.url)
    check(!!body && !('payload' in body) && body.serialNumber === SERIAL, 'the body is FLAT and names serialNumber', JSON.stringify(body))
    check(patch?.status === 200, 'the route answered 200', String(patch?.status))
    check(after?.payload?.serialNumber === SERIAL, 'the DATABASE holds the typed serial', JSON.stringify({ before: before?.payload?.serialNumber ?? null, after: after?.payload?.serialNumber ?? null }))
    check((after?.revision_number ?? 0) === (before?.revision_number ?? 0) + 1, 'exactly one new unit revision', `${before?.revision_number} -> ${after?.revision_number}`)
    check(row.state === 'Saved', 'the row says Saved', JSON.stringify(row))
    await page.reload({ waitUntil: 'networkidle0' })
    await open()
    const reloaded = await page.evaluate((v, id) => document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`)?.value ?? null, V, unit.id)
    check(reloaded === SERIAL, 'and it is still on the screen after a reload', String(reloaded))
    await page.evaluate((v, id) => document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`)?.scrollIntoView({ block: 'center' }), V, unit.id)
    await frames(page)
    await page.screenshot({ path: `${OUT}p2-unit-serial-1440.png` })
  } finally { await browser.close() }

  console.log('\n=== B the server refusal (R3) ===')
  const base = `/test-beds/${fx.bedId}/units/${unit.id}`
  const attempt = async (label, body) => {
    const b4 = await unitRev(unit.id)
    const res = await call('PATCH', base, { ...body, expected_revision: b4?.revision_number ?? null })
    const af = await unitRev(unit.id)
    const detail = { status: res.status, error: res.data?.error ?? null, revision: `${b4?.revision_number} -> ${af?.revision_number}` }
    console.log(`  ${label}: ${JSON.stringify(detail)}`)
    return { ...detail, moved: (af?.revision_number ?? 0) !== (b4?.revision_number ?? 0), stored: af?.payload?.serialNumber ?? null }
  }
  const wrapped = await attempt('a WRAPPED body, the shape the client used to send', { payload: { serial: 'SN-WRAPPED' } })
  check(wrapped.status === 400, 'a wrapped body is REFUSED 400, not answered 200', String(wrapped.status))
  check(!wrapped.moved, 'and no revision is appended for it', wrapped.revision)
  check(/serialNumber|latitude|longitude|stateSource|state/.test(wrapped.error ?? ''), 'the refusal NAMES what it would accept', wrapped.error ?? 'no message')
  const unknown = await attempt('an UNKNOWN key', { nonsense: 'x' })
  check(unknown.status === 400, 'an unknown key is REFUSED 400', String(unknown.status))
  check(!unknown.moved, 'and no revision is appended for it', unknown.revision)
  const oldName = await attempt('the OLD field name, flat', { serial: 'SN-FLAT-SERIAL' })
  check(oldName.status === 400, 'the old field name alone is REFUSED 400', String(oldName.status))
  const good = await attempt('the positive control: a flat serialNumber', { serialNumber: `${SERIAL}-B` })
  check(good.status === 200 && good.stored === `${SERIAL}-B` && good.moved, 'the route still ACCEPTS a real key, stores it and moves the revision', JSON.stringify(good))
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
