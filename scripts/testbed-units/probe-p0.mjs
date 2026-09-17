// ── TEST BED UNITS PHASE 0: MEASURE BEFORE BUILD ─────────────────────────
//
// Read-only against the product. Every record is a tagged fixture made through
// the API and torn down by tag (units are reached as children of the tagged
// bed). Sections, each on its OWN fixture so no claim consumes another's state
// (Verification 7's fixture clause):
//
//   P01  measurability recorded through the real control, read back from the DB
//   P04  R1: opening the Installation tab POSTs /units/derive; what it wrote.
//        That fixture's Installation tab is not touched again.
//   P03  B4: a unit save through the real row; then the three contract breaks
//        separated through the API, each with its database read-back
//   P05  L2/L3/L4 on the live surface: count fields, the lock, correction, unit fields
//   P06  the second contact in an already-linked role, and the same contact twice
//
// UNWIRED: builds live records and drives a browser.
// Run: TBUNITS_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-units/probe-p0.mjs [P01 P04 P03 P05 P06]
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('testbed-units/probe-p0.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBUNITS_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBUNITS_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-units/${RUN}/`
mkdirSync(OUT, { recursive: true })
const SECTIONS = process.argv.slice(2).length ? process.argv.slice(2) : ['P01', 'P04', 'P03', 'P05', 'P06']
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const STAMP = Date.now()
const V = '#view-test-bed-detail'
const INSTALL = 'Installation and Commissioning'
const log = (s) => console.log(s)
const evidence = {}
// api-client THROWS on a non-2xx and carries the status and body; a refusal is data here.
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const latestPayload = async (id) => must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).maybeSingle(), `latest revision ${id}`)
const unitsOf = async (bedId) => must(await db.from('records').select('id,status,created_at,deleted_at')
  .eq('record_type', 'unit').eq('parent_record_id', bedId).is('deleted_at', null).order('created_at'), 'units')
const setCounts = async (bedId, counts) => {
  const rev = (await call('GET', `/test-beds/${bedId}`)).data.latest_revision_number
  return call('PATCH', `/test-beds/${bedId}`, { payload: counts, expected_revision: rev })
}
const TAGS = []
const fixture = async (label) => { const tag = `TBUNITS-${label}-${STAMP}`; TAGS.push(tag); return { tag, ...(await freshTestBed(tag)) } }

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
const net = []
page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
page.on('requestfinished', async (r) => { const e = net.find((n) => n.req === r); if (!e) return; e.status = r.response()?.status() ?? null; try { e.resp = await r.response()?.text() } catch { e.resp = null } e.done = true })
page.on('requestfailed', (r) => { const e = net.find((n) => n.req === r); if (e) { e.done = true; e.status = 'failed' } })
const since = (i, pred) => net.slice(i).filter(pred)
const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))
const show = (n) => n ? { method: n.method, url: n.url, body: n.body, status: n.status, resp: (n.resp ?? '').slice(0, 300) } : null
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
await page.reload({ waitUntil: 'networkidle0' })
const openBed = async (fx) => {
  await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
  await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, fx.tag)
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
}
const tab = async (key) => {
  await page.click(`${V} [data-testid="tb-tab-btn-${key}"]`)
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
  await frames()
}

try {
  if (SECTIONS.includes('P01')) {
    log('\n=== P0.1 measurability, live write through the real control ===')
    const fx = await fixture('P01')
    const before = await latestPayload(fx.bedId)
    await openBed(fx)
    await tab('stage-Qualification')
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-measurability-select"]`), { timeout: 20000 }, V)
    const ctl = await page.evaluate((v) => { const s = document.querySelector(`${v} [data-testid="tb-measurability-select"]`); const r = s.getBoundingClientRect(); return { disabled: s.disabled, visible: r.width > 0 && r.height > 0, value: document.querySelector(`${v} [data-testid="tb-measurability-value"]`)?.textContent.trim() } }, V)
    log(`  control before: ${JSON.stringify(ctl)}`)
    const mark = net.length
    await page.select(`${V} [data-testid="tb-measurability-select"]`, 'yes')
    await waitFor(() => since(mark, (n) => n.url.endsWith('/measurability') && n.done).length >= 1)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    await frames()
    const post = since(mark, (n) => n.url.endsWith('/measurability'))[0]
    const after = await latestPayload(fx.bedId)
    const series = after?.payload?.measurabilityConfirmed
    const shown = await page.evaluate((v) => ({ value: document.querySelector(`${v} [data-testid="tb-measurability-value"]`)?.textContent.trim(), entry: document.querySelector(`${v} [data-testid="tb-measurability-entry"]`)?.textContent.trim() ?? null, error: document.querySelector(`${v} [data-testid="tb-measurability-error"]`)?.textContent ?? null }), V)
    const gate = (await call('GET', `/records/${fx.bedId}/exit-criteria?stage=Qualification`)).data
    const req = (gate.requirements ?? []).find((r) => r.field === 'measurabilityConfirmed')
    evidence.P01 = { request: show(post), revisionBefore: before?.revision_number, revisionAfter: after?.revision_number, series, shown, gateRow: req ?? null }
    log(`  request: ${JSON.stringify(show(post))}`)
    log(`  database: revision ${before?.revision_number} -> ${after?.revision_number}; payload.measurabilityConfirmed = ${JSON.stringify(series)}`)
    log(`  screen after: ${JSON.stringify(shown)}`)
    log(`  gate row: ${JSON.stringify(req ?? null)}`)
    log(`  VERDICT ${post?.status && post.status < 300 && Array.isArray(series) && series.at(-1)?.value === true && req?.met === true ? 'WRITE PROVEN: sent, stored true, shown, and the gate reads it met' : 'NOT PROVEN (see shape above)'}`)
  }

  if (SECTIONS.includes('P04')) {
    log('\n=== P0.4 R1: opening the Installation tab derives units ===')
    const fx = await fixture('P04')
    const counts = await setCounts(fx.bedId, { safesightCameras: 2, airQualitySensors: 1, hemirSensors: 0 })
    log(`  counts set through the API: ${counts.status}`)
    const unitsBefore = await unitsOf(fx.bedId)
    await openBed(fx)
    const beforeTab = since(0, (n) => n.url.includes(`/test-beds/${fx.bedId}/units/derive`)).length
    const mark = net.length
    await tab(`stage-${INSTALL}`)
    await waitFor(() => since(mark, (n) => n.url.endsWith('/units/derive') && n.done).length >= 1, 10000)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    const derive = since(mark, (n) => n.url.endsWith('/units/derive'))
    const unitsAfter = await unitsOf(fx.bedId)
    const clicksOnInstall = 0
    evidence.P04 = { derivePostsBeforeTab: beforeTab, derivePosts: derive.map(show), unitsBefore: unitsBefore.length, unitsAfter: unitsAfter.map((u) => ({ id: u.id, status: u.status, created_at: u.created_at })), bed: fx.bedId, tag: fx.tag }
    log(`  derive POSTs before the tab was opened: ${beforeTab}`)
    log(`  derive POSTs caused by opening the tab (no click inside it): ${derive.length} ${JSON.stringify(derive.map(show))}`)
    log(`  units in the database: ${unitsBefore.length} before -> ${unitsAfter.length} after`)
    for (const u of unitsAfter) log(`    unit ${u.id} ${u.status} created ${u.created_at}  (recorded for teardown under ${fx.tag})`)
    log(`  interactions with this fixture's Installation tab after the capture: ${clicksOnInstall}`)
    log(`  VERDICT ${derive.length >= 1 && unitsAfter.length > unitsBefore.length ? 'R1 REPRODUCED: a read created unit records' : 'NOT REPRODUCED'}`)
    await tab('reference')
  }

  if (SECTIONS.includes('P03')) {
    log('\n=== P0.3 B4: a unit save, and its three contract breaks ===')
    const fx = await fixture('P03')
    await setCounts(fx.bedId, { safesightCameras: 1, airQualitySensors: 0, hemirSensors: 0 })
    // The units are made DELIBERATELY, the way the "Create the missing units"
    // button makes them, so this fixture's units do not depend on R1.
    const made = await call('POST', `/test-beds/${fx.bedId}/units/derive`, {})
    const units = await unitsOf(fx.bedId)
    const unit = units[0]
    log(`  explicit derive: ${made.status}, units ${units.length}; unit ${unit?.id}`)
    const unitRev = async () => latestPayload(unit.id)
    await openBed(fx)
    const mark = net.length
    await tab(`stage-${INSTALL}`)
    await page.waitForFunction((v, id) => document.querySelector(`${v} [data-testid="tb-unit-serial-${id}"]`), { timeout: 20000 }, V, unit.id)
    const r0 = await unitRev()
    const m2 = net.length
    await page.click(`${V} [data-testid="tb-unit-serial-${unit.id}"]`)
    await page.type(`${V} [data-testid="tb-unit-serial-${unit.id}"]`, 'SN-P03-UI')
    await page.click(`${V} [data-testid="tb-units-sub"]`)
    await waitFor(() => since(m2, (n) => n.method === 'PATCH' && n.done).length >= 1)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    await frames()
    const uiPatch = since(m2, (n) => n.method === 'PATCH')[0]
    const rowState = await page.evaluate((v, id) => document.querySelector(`${v} [data-testid="tb-unit-state-${id}"]`)?.textContent ?? null, V, unit.id)
    const r1 = await unitRev()
    log(`  derive POSTs on opening this fixture's tab: ${since(mark, (n) => n.url.endsWith('/units/derive')).length} (R1, idempotent here: units already exist)`)
    log(`  UI save: ${JSON.stringify(show(uiPatch))}`)
    log(`  row says: ${JSON.stringify(rowState)}; unit revision ${r0?.revision_number} -> ${r1?.revision_number}; serialNumber ${JSON.stringify(r1?.payload?.serialNumber ?? null)}`)
    // Breaks 2 and 3, separated. Each is one change from the client's request.
    const base = `/test-beds/${fx.bedId}/units/${unit.id}`
    const step = async (label, body) => {
      const before = await unitRev()
      const res = await call('PATCH', base, { ...body, expected_revision: before?.revision_number ?? null })
      const after = await unitRev()
      const row = { label, body, status: res.status, resp: JSON.stringify(res.data).slice(0, 200), revision: `${before?.revision_number} -> ${after?.revision_number}`, serialNumberStored: after?.payload?.serialNumber ?? null, keysStored: Object.keys(after?.payload ?? {}) }
      log(`  ${label}: ${JSON.stringify(row)}`)
      return row
    }
    const b2 = await step('break 1 fixed only (real route), body still WRAPPED as the client sends it', { payload: { serial: 'SN-WRAPPED' } })
    const b3 = await step('breaks 1 and 2 fixed (flat body), field still named serial', { serial: 'SN-FLAT-SERIAL' })
    const ok = await step('all three fixed: flat serialNumber on the real route (positive control)', { serialNumber: 'SN-CONTROL' })
    evidence.P03 = { unit: unit.id, uiSave: show(uiPatch), rowState, uiRevision: `${r0?.revision_number} -> ${r1?.revision_number}`, uiStored: r1?.payload?.serialNumber ?? null, b2, b3, control: ok }
  }

  if (SECTIONS.includes('P05')) {
    log('\n=== P0.5 L2 / L3 / L4 on the live unit surface ===')
    const fx = await fixture('P05')
    await setCounts(fx.bedId, { safesightCameras: 2, airQualitySensors: 1, hemirSensors: 0 })
    await call('POST', `/test-beds/${fx.bedId}/units/derive`, {})
    const units = await unitsOf(fx.bedId)
    await openBed(fx)
    await tab('commercials')
    const commercials = await page.evaluate((v) => {
      const row = (k) => { const d = document.querySelector(`${v} [data-testid="display-${k}"]`); if (!d) return null
        const fr = d.closest('.field-row'); return { value: d.textContent.trim(), readonly: fr?.getAttribute('data-readonly'), tabindex: d.getAttribute('tabindex'), lockedNote: /lock/i.test(fr?.textContent ?? '') } }
      return { safesightCameras: row('safesightCameras'), airQualitySensors: row('airQualitySensors'), hemirSensors: row('hemirSensors'),
        anyLockText: [...document.querySelectorAll(`${v} *`)].some((e) => e.childElementCount === 0 && /locked/i.test(e.textContent)) }
    }, V)
    log(`  Commercials count rows with units existing (SafeSight 2, Air Quality 1): ${JSON.stringify(commercials)}`)
    // L3's consequence, measured: edit a locked count and save.
    let lockSave = null
    const disp = await page.$(`${V} [data-testid="display-safesightCameras"]`)
    log(`  step: display row for safesightCameras found: ${!!disp}`)
    if (disp) {
      await disp.click(); await frames()
      const input = await page.$(`${V} [data-testid="edit-safesightCameras"] input`)
      log(`  step: editor input found: ${!!input}`)
      if (input) {
        await input.click({ clickCount: 3 }); await input.type('3')
        const mark = net.length
        const save = await page.$(`${V} [data-testid="save-all"]`)
        log(`  step: save-all found: ${!!save}, disabled: ${save ? await save.evaluate((b) => b.disabled) : null}`)
        if (save) { await save.click() } else { await page.keyboard.press('Enter') }
        await waitFor(() => since(mark, (n) => n.method === 'PATCH' && n.done).length >= 1, 8000)
        log(`  step: PATCHes after save: ${since(mark, (n) => n.method === 'PATCH').length}`)
        await new Promise((r) => setTimeout(r, 1500)); await frames()
        const p = since(mark, (n) => n.method === 'PATCH')[0]
        const said = await page.evaluate((v) => [...document.querySelectorAll(`${v} .msg-error, ${v} [role="alert"], ${v} [data-testid="tb-save-feedback"]`)].map((e) => e.textContent.trim()).filter(Boolean), V)
        lockSave = { saveControlFound: !!save, request: show(p), screenSays: said }
      } else lockSave = { editorOpened: false }
    }
    log(`  editing a locked count on Commercials: ${JSON.stringify(lockSave)}`)
    const payloadAfter = (await latestPayload(fx.bedId))?.payload
    log(`  stored safesightCameras after the attempt: ${JSON.stringify(payloadAfter?.safesightCameras)}`)
    log('  step: reloading for the Installation read')
    await page.reload({ waitUntil: 'networkidle0' })
    await openBed(fx)
    log('  step: bed open; opening Installation tab')
    await tab(`stage-${INSTALL}`)
    log('  step: Installation tab open')
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-units-pane"]`), { timeout: 20000 }, V)
    const install = await page.evaluate((v, INS) => {
      const pane = document.querySelector(`${v} [data-testid="tb-units-pane"]`)
      const rows = [...pane.querySelectorAll('[data-testid^="tb-unit-"]')].filter((e) => /^tb-unit-[0-9a-f-]{36}$/.test(e.getAttribute('data-testid')))
      const first = rows[0]
      return {
        sub: pane.querySelector('[data-testid="tb-units-sub"]')?.textContent.trim(),
        rowsOnOpenTab: rows.length,
        firstRowControls: first ? [...first.querySelectorAll('input,select,textarea,button')].map((c) => `${c.tagName.toLowerCase()}:${c.getAttribute('data-testid')}`) : [],
        firstRowText: first?.textContent.trim() ?? null,
        lockedLine: document.querySelector(`${v} [data-testid="tb-count-locked"]`)?.textContent.trim() ?? null,
        correctionArea: pane.querySelector('[data-testid="tb-units-correction"]')?.innerHTML.length ?? null,
        correctionText: pane.querySelector('[data-testid="tb-units-correction"]')?.textContent.trim() ?? null,
        anyReasonInput: !!document.querySelector(`${v} input[placeholder*="reason" i], ${v} input[placeholder*="why" i]`),
      }
    }, V, INSTALL)
    log(`  Installation tab, unit surface: ${JSON.stringify(install)}`)
    const unitApi = (await call('GET', `/test-beds/${fx.bedId}/units`)).data
    log(`  what GET /units returns per unit (keys): ${JSON.stringify(Object.keys(unitApi?.[0] ?? {}))}`)
    await page.screenshot({ path: `${OUT}p05-install-units-1440.png` })
    evidence.P05 = { units: units.length, commercials, lockSave, storedAfter: payloadAfter?.safesightCameras, install, unitKeys: Object.keys(unitApi?.[0] ?? {}) }
  }

  if (SECTIONS.includes('P06')) {
    log('\n=== P0.6 a second contact in an already-linked role ===')
    const fx = await fixture('P06')
    const industry = (await call('GET', '/industries')).data[0].id
    const mk = async (label) => {
      const c = (await call('POST', '/contacts', { name: `${fx.tag} ${label}`, company: `${fx.tag} Holdings`, email: `${fx.tag.toLowerCase()}-${label.toLowerCase()}@example.invalid`,
        mobile: '+65 9000 0001', industry_id: industry, source: 'Direct Outreach', jobRole: 'Head of Infrastructure', city: 'Singapore', country: 'Singapore', region: 'Asia Pacific' })).data
      await call('POST', `/contacts/${c.id}/link-account`, { account_id: fx.accountId })
      return c.id
    }
    const alpha = await mk('Alpha'); const beta = await mk('Beta')
    const ROLE = 'Client Commercial Buyer'
    const link = (cid) => call('POST', `/test-beds/${fx.bedId}/buyer-contacts`, { role: ROLE, contact_id: cid })
    const rows = async () => must(await db.from('record_contacts').select('contact_id,role').eq('record_id', fx.bedId), 'record_contacts')
    const first = await link(alpha)
    const second = await link(beta)
    const afterSecond = await rows()
    const bed = (await call('GET', `/test-beds/${fx.bedId}`)).data
    const same = await link(alpha)
    const afterSame = await rows()
    const audit = must(await db.from('audit_log').select('action').eq('record_id', fx.bedId).eq('action', 'buyer_contact_linked'), 'audit')
    evidence.P06 = { first: { status: first.status, resp: first.data }, secondDifferentContact: { status: second.status, resp: second.data, rows: afterSecond }, getReturnsForRole: (bed.buyer_contacts ?? bed.buyers ?? null), sameContactAgain: { status: same.status, resp: same.data, rows: afterSame }, auditLinked: audit.length }
    log(`  first link (Alpha): ${first.status} ${JSON.stringify(first.data)}`)
    log(`  SECOND contact (Beta), same role: ${second.status} ${JSON.stringify(second.data)}; rows for the role: ${afterSecond.filter((r) => r.role === ROLE).length}`)
    log(`  GET /test-beds/:id buyer field: ${JSON.stringify(bed.buyer_contacts ?? bed.buyers ?? Object.keys(bed).filter((k) => /buyer|contact/i.test(k)))}`)
    log(`  SAME contact (Alpha) again, same role: ${same.status} ${JSON.stringify(same.data)}; rows for the role: ${afterSame.filter((r) => r.role === ROLE).length}`)
    log(`  audit rows buyer_contact_linked: ${audit.length}`)
  }
} catch (e) {
  log(`  FAIL  the probe did not complete: ${e.stack?.split('\n').slice(0, 3).join(' | ')}`)
  process.exitCode = 1
} finally {
  await browser.close()
  writeFileSync(`${OUT}p0-evidence.json`, JSON.stringify(evidence, null, 2))
  for (const tag of TAGS) {
    const t = await tearDown(tag)
    log(`teardown ${tag}: removed ${t.removed.length} (${t.removed.map((r) => r.record_type).join(',')}), remaining ${t.remaining}`)
  }
}
