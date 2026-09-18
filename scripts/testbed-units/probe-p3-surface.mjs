// ── TEST BED UNITS PHASE 3, LIVE: THE UNIT SURFACE ──────────────────────
//
// Owned tagged fixture, counts SafeSight 2 / Air Quality 1, units created
// deliberately through the derive route:
//   L4  all four unit fields saved from the row and read back from the DATABASE
//   L2  a count correction applied with its reason, visible after a reload
//   L3  the Commercials count for a type with units renders locked, with the
//       sentence naming where to correct it; a type with none stays editable
//   R8  the installer list is closed on a fresh Installation tab, and typing opens it
//
// UNWIRED: builds live records and drives a browser.
// Run: TBUNITS_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-units/probe-p3-surface.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('testbed-units/probe-p3-surface.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBUNITS_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-units/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBUNITS-P3-${Date.now()}`
const V = '#view-test-bed-detail'
const INSTALL = 'Installation and Commissioning'
const SERIAL = `SN-${Date.now()}`
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const unitPayload = async (id) => (must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).maybeSingle(), 'unit revision') ?? {})
const bedPayload = async (id) => (must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).maybeSingle(), 'bed revision') ?? {})
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

let fx
try {
  fx = await freshTestBed(TAG)
  const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  await call('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: 2, airQualitySensors: 1, hemirSensors: 0 }, expected_revision: rev })
  await call('POST', `/test-beds/${fx.bedId}/units/derive`, {})
  const units = (await call('GET', `/test-beds/${fx.bedId}/units`)).data
  const unit = units.find((u) => u.type === 'SafeSight')
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}; units ${units.length}; row ${unit.id}`)

  const browser = await puppeteer.launch({ headless: 'new' })
  const net = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000 })
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
    page.on('requestfinished', async (r) => { const e = net.find((n) => n.req === r); if (!e) return; e.status = r.response()?.status() ?? null; try { e.resp = await r.response()?.text() } catch { e.resp = null } e.done = true })
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
    const openInstall = async () => {
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
      await page.click(`${V} [data-testid="tb-tab-btn-stage-${INSTALL}"]`)
      await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-units-pane"]`), { timeout: 20000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
      await frames(page)
    }
    const typeInto = async (testid, value) => {
      const sel = `${V} [data-testid="${testid}"]`
      await page.click(sel, { clickCount: 3 })
      await page.type(sel, value)
    }
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await openInstall()

    console.log('\n=== R8 the installer list on a fresh Installation tab ===')
    const fresh = await page.evaluate((v) => ({
      search: !!document.querySelector(`${v} [data-testid="tb-installer-search"]`),
      results: document.querySelectorAll(`${v} .tb-installer-result`).length,
      nomatch: !!document.querySelector(`${v} [data-testid="tb-installer-nomatch"]`),
      resultsText: document.querySelector(`${v} [data-testid="tb-installer-results"]`)?.textContent.trim() ?? '',
    }), V)
    check(fresh.search && fresh.results === 0 && !fresh.nomatch && fresh.resultsText === '', 'the installer list is CLOSED until somebody types', JSON.stringify(fresh))
    await page.screenshot({ path: `${OUT}p3-installer-closed-1440.png` })
    await typeInto('tb-installer-search', 'a')
    await frames(page)
    const typed = await page.evaluate((v) => document.querySelectorAll(`${v} .tb-installer-result`).length, V)
    check(typed > 0, 'and typing opens it', `${typed} result(s)`)
    await typeInto('tb-installer-search', '')
    await page.keyboard.press('Backspace')
    await frames(page)
    const cleared = await page.evaluate((v) => document.querySelectorAll(`${v} .tb-installer-result`).length, V)
    check(cleared === 0, 'and clearing the box closes it again', `${cleared} result(s)`)

    console.log('\n=== L4 the four unit fields ===')
    const rowNow = await page.evaluate((v, id) => ({
      index: document.querySelector(`${v} [data-testid="tb-unit-index-${id}"]`)?.textContent ?? null,
      serial: !!document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`),
      lat: !!document.querySelector(`${v} [data-testid="tb-unit-latitude-${id}"]`),
      lon: !!document.querySelector(`${v} [data-testid="tb-unit-longitude-${id}"]`),
      state: [...(document.querySelector(`${v} [data-testid="tb-unit-state-select-${id}"]`)?.options ?? [])].map((o) => o.value),
    }), V, unit.id)
    check(!!rowNow.index && rowNow.serial && rowNow.lat && rowNow.lon && rowNow.state.join() === 'Planned,Installed,Faulty,Removed', 'the row offers index, serial, latitude, longitude and the four states', JSON.stringify(rowNow))
    const mark = net.length
    await typeInto(`tb-unit-serial-${unit.id}`, SERIAL)
    await page.click(`${V} [data-testid="tb-units-sub"]`)
    await typeInto(`tb-unit-latitude-${unit.id}`, '1.2345')
    await page.click(`${V} [data-testid="tb-units-sub"]`)
    await typeInto(`tb-unit-longitude-${unit.id}`, '103.8198')
    await page.click(`${V} [data-testid="tb-units-sub"]`)
    await page.select(`${V} [data-testid="tb-unit-state-select-${unit.id}"]`, 'Installed')
    await waitFor(() => net.slice(mark).filter((n) => n.method === 'PATCH' && n.done).length >= 4)
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 20000 })
    await frames(page)
    const patches = net.slice(mark).filter((n) => n.method === 'PATCH' && n.url.includes('/units/'))
    const stored = await unitPayload(unit.id)
    const status = must(await db.from('records').select('status').eq('id', unit.id).single(), 'unit status')
    const rowState = await page.evaluate((v, id) => document.querySelector(`${v} [data-testid="tb-unit-state-${id}"]`)?.textContent ?? null, V, unit.id)
    check(patches.length === 4 && patches.every((p) => p.status === 200), 'four saves, each its own flat PATCH, all accepted', patches.map((p) => `${p.status}:${Object.keys(JSON.parse(p.body)).filter((k) => k !== 'expected_revision').join()}`).join(' | '))
    check(stored.payload?.serialNumber === SERIAL && String(stored.payload?.latitude) === '1.2345' && String(stored.payload?.longitude) === '103.8198',
      'the DATABASE holds the serial, the latitude and the longitude', JSON.stringify({ serialNumber: stored.payload?.serialNumber, latitude: stored.payload?.latitude, longitude: stored.payload?.longitude }))
    check(status.status === 'Installed', 'and the unit\'s STATE is Installed on the record', status.status)
    check(rowState === 'Saved', 'the row reports its own save', String(rowState))
    await page.evaluate((v, id) => document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`)?.scrollIntoView({ block: 'center' }), V, unit.id)
    await frames(page)
    await page.screenshot({ path: `${OUT}p3-unit-row-1440.png` })
    await openInstall()
    const reread = await page.evaluate((v, id) => ({
      serial: document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`)?.value ?? null,
      lat: document.querySelector(`${v} [data-testid="tb-unit-latitude-${id}"]`)?.value ?? null,
      lon: document.querySelector(`${v} [data-testid="tb-unit-longitude-${id}"]`)?.value ?? null,
      state: document.querySelector(`${v} [data-testid="tb-unit-state-select-${id}"]`)?.value ?? null,
    }), V, unit.id)
    check(reread.serial === SERIAL && reread.lat === '1.2345' && reread.lon === '103.8198' && reread.state === 'Installed', 'and all four are on the screen after a reload', JSON.stringify(reread))

    console.log('\n=== L2 the count correction ===')
    const gate = await page.evaluate((v) => {
      const apply = document.querySelector(`${v} [data-testid="tb-cc-apply"]`)
      return { offered: !!apply, disabledEmpty: apply?.disabled ?? null }
    }, V)
    check(gate.offered && gate.disabledEmpty === true, 'the open type offers a correction, and Apply is dead with nothing filled in', JSON.stringify(gate))
    await typeInto('tb-cc-count', '5')
    await frames(page)
    const afterCount = await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-cc-apply"]`)?.disabled, V)
    check(afterCount === true, 'still dead with a count and no reason')
    await typeInto('tb-cc-reason', 'two were never installed')
    await frames(page)
    const afterBoth = await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-cc-apply"]`)?.disabled, V)
    check(afterBoth === false, 'and live once both are filled in')
    const mark2 = net.length
    await page.click(`${V} [data-testid="tb-cc-apply"]`)
    await waitFor(() => net.slice(mark2).some((n) => n.method === 'PATCH' && n.url === `/api/test-beds/${fx.bedId}` && n.done))
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 20000 })
    await frames(page)
    const cc = net.slice(mark2).find((n) => n.method === 'PATCH' && n.url === `/api/test-beds/${fx.bedId}`)
    const ccBody = cc?.body ? JSON.parse(cc.body) : null
    const bedAfter = await bedPayload(fx.bedId)
    check(cc?.status === 200 && ccBody?.countCorrectionReason === 'two were never installed' && ccBody?.payload?.safesightCameras === '5',
      'Apply sent the vanilla\'s body and the server accepted it', JSON.stringify({ status: cc?.status, body: ccBody }))
    check(String(bedAfter.payload?.safesightCameras) === '5', 'the DATABASE holds the corrected count', String(bedAfter.payload?.safesightCameras))
    await openInstall()
    const afterReload = await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-units-sub"]`)?.textContent.trim(), V)
    const plannedNow = Number(bedAfter.payload?.safesightCameras ?? 0) + Number(bedAfter.payload?.airQualitySensors ?? 0) + Number(bedAfter.payload?.hemirSensors ?? 0)
    check(new RegExp(`^${plannedNow} planned`).test(afterReload ?? ''), 'and the corrected count is on the screen after a reload', `${afterReload} (payload sums to ${plannedNow})`)

    console.log('\n=== L3 the locked count where it is edited ===')
    await page.click(`${V} [data-testid="tb-tab-btn-commercials"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-card-sensors"]`), { timeout: 20000 }, V)
    await frames(page)
    const lock = await page.evaluate((v) => {
      const el = document.querySelector(`${v} [data-testid="tb-count-locked-safesightCameras"]`)
      el?.scrollIntoView({ block: 'center' })
      return {
        locked: el?.textContent.replace(/\s+/g, ' ').trim() ?? null,
        editableSafe: !!document.querySelector(`${v} [data-testid="display-safesightCameras"]`),
        hemirLocked: !!document.querySelector(`${v} [data-testid="tb-count-locked-hemirSensors"]`),
        hemirEditable: !!document.querySelector(`${v} [data-testid="display-hemirSensors"]`),
      }
    }, V)
    const safeUnits = must(await db.from('records').select('id').eq('record_type', 'unit').eq('parent_record_id', fx.bedId).is('deleted_at', null), 'units now').length - 1 // less the one Air Quality slot
    check(!!lock.locked && new RegExp(`Locked: ${safeUnits} units? exist`).test(lock.locked) && /Installation and Commissioning/.test(lock.locked) && !lock.editableSafe,
      'the SafeSight count renders locked, naming the count and where to correct it', JSON.stringify(lock))
    check(!lock.hemirLocked && lock.hemirEditable, 'and a type with no units stays an ordinary editable field', JSON.stringify(lock))
    await frames(page)
    await page.screenshot({ path: `${OUT}p3-commercials-locked-1440.png` })
    // The server's backstop is still there, and it is what the lock exists to
    // spare a person: the same change without a reason, through the route.
    const refused = await call('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: 9 }, expected_revision: bedAfter.revision_number })
    check(refused.status === 400 && /locked/i.test(refused.data?.error ?? ''), 'the server still refuses a reasonless count change', `${refused.status} ${refused.data?.error ?? ''}`)
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
