// ── W5: JOHN'S OWN WALK PAIRS, DRIVEN FAST ──────────────────────────────
//
// The defect is not a missing reload. It is that every record writer reads the
// held revision from a closure that only refreshes when `load()` RESOLVES, so
// two writes issued before the first one's reload lands carry the SAME number
// and the second is refused.
//
// So the pairs are driven WITHOUT waiting between them: the second click goes
// in while the first write is still in flight, which is what a person does and
// what no test had ever done.
//
// RED FIRST on the tree before the queue: each pair produces a 409 and the
// stale banner. GREEN after: both writes land, in order, read back from the
// database.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-w5-pairs.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-w5-pairs.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-W5P-${Date.now()}`
const V = '#view-test-bed-detail'
const MON = 'Monitoring and Analysis'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const payloadOf = async (id) => (must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'payload')[0] ?? {})
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  await call('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: '1' }, expected_revision: rev })
  await call('POST', `/test-beds/${fx.bedId}/scores`, { criterion: 'scoreRolloutPath', score: 4 })

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    const net = []
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
    page.on('requestfinished', (r) => { const e = net.find((n) => n.req === r); if (e) { e.status = r.response()?.status() ?? null; e.done = true } })
    const settle = () => page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    const open = async () => {
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
      await settle()
    }
    // What the person sees when a write is refused. Read from the banner the
    // host writes, so the claim is about the SCREEN rather than a status code.
    const banner = () => page.evaluate((v) => {
      const el = document.querySelector(`${v} [data-testid="tb-band-feedback"], ${v} .field-save-feedback, ${v} [data-testid="tb-feedback"]`)
      return el ? el.textContent.trim() : (document.body.innerText.match(/(moved on while you were working|changed in another session)[^\n]*/)?.[0] ?? null)
    }, V)
    const patches = () => net.filter((n) => n.method === 'PATCH' && /\/api\/test-beds\/[^/]+$/.test(n.url))
    const revisionsOf = (n) => { try { return JSON.parse(n.body ?? '{}').expected_revision ?? null } catch { return null } }

    // ── PAIR 1: Save changes, then Add note ─────────────────────────────
    await open()
    const before1 = (await payloadOf(fx.bedId)).revision_number
    let mark = net.length
    await page.click(`${V} [data-testid="tb-tab-btn-commercials"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="display-airQualitySensors"]`), { timeout: 20000 }, V)
    await page.click(`${V} [data-testid="display-airQualitySensors"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-field="airQualitySensors"] input`), { timeout: 10000 }, V)
    await page.type(`${V} [data-field="airQualitySensors"] input`, '3')
    await page.click(`${V} [data-testid="tb-detail-name"]`)
    await page.waitForFunction((v) => { const b = document.querySelector(`${v} [data-testid="edit-bar"]`); return b && !b.hidden }, { timeout: 10000 }, V)
    await page.click(`${V} [data-testid="cd-add-note-btn"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="cd-new-note-input"]`), { timeout: 10000 }, V)
    await page.type(`${V} [data-testid="cd-new-note-input"]`, 'a note typed straight after the save')
    // ── THE PAIR, IN ONE TASK ──────────────────────────────────────────
    //
    // Both clicks dispatched inside a single `evaluate`, so they land before
    // React re-renders. Two awaited `page.click` calls are not the same thing:
    // measured, the first click's re-render reset the note control between
    // them and the second write was never sent at all, which reads as the
    // defect being absent. This is the shape a person produces and the shape
    // the closure defect needs.
    mark = net.length
    await page.evaluate((v) => {
      document.querySelector(`${v} [data-testid="save-all"]`).click()
      document.querySelector(`${v} [data-testid="cd-add-note-btn"]`).click()
    }, V)
    await settle()
    const p1 = net.slice(mark).filter((n) => n.method === 'PATCH' && /\/api\/test-beds\/[^/]+$/.test(n.url))
    const after1 = await payloadOf(fx.bedId)
    evidence.pair1 = { sent: p1.map((n) => ({ status: n.status, expected: revisionsOf(n) })), banner: await banner() }
    console.log(`\n=== PAIR 1: Save changes, then Add note ===\n  ${JSON.stringify(evidence.pair1)}`)
    check(p1.length === 2, 'pair 1: both writes were sent', String(p1.length))
    check(p1.every((n) => n.status < 300), 'pair 1: BOTH are accepted, neither refused',
      JSON.stringify(p1.map((n) => n.status)))
    check(new Set(p1.map(revisionsOf)).size === p1.length,
      'pair 1: and the second carried a DIFFERENT revision from the first',
      JSON.stringify(p1.map(revisionsOf)))
    check(String(after1.payload?.airQualitySensors ?? '') === '3'
      && (after1.payload?.notes ?? []).some((n) => String(n.text ?? '').includes('straight after the save')),
      'pair 1: and BOTH writes are in the database, in order',
      JSON.stringify({ revision: after1.revision_number, sensors: after1.payload?.airQualitySensors, notes: (after1.payload?.notes ?? []).length }))
    check(!/moved on while you were working|changed in another session/.test(evidence.pair1.banner ?? ''),
      'pair 1: and no stale banner was shown', JSON.stringify(evidence.pair1.banner))

    // ── PAIR 2: tick a criterion, then Add note ─────────────────────────
    await open()
    await page.click(`${V} [data-testid="tb-tab-btn-stage-${MON}"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} .tb-crit-row--tickable`), { timeout: 20000 }, V)
    await settle()
    await page.click(`${V} [data-testid="cd-add-note-btn"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="cd-new-note-input"]`), { timeout: 10000 }, V)
    await page.type(`${V} [data-testid="cd-new-note-input"]`, 'a note typed straight after the tick')
    mark = net.length
    await page.evaluate((v) => {
      document.querySelector(`${v} .tb-crit-row--tickable`).click()
      document.querySelector(`${v} [data-testid="cd-add-note-btn"]`).click()
    }, V)
    await settle()
    const p2 = net.slice(mark).filter((n) => n.method === 'PATCH' && /\/api\/test-beds\/[^/]+$/.test(n.url))
    const after2 = await payloadOf(fx.bedId)
    evidence.pair2 = { sent: p2.map((n) => ({ status: n.status, expected: revisionsOf(n) })), banner: await banner() }
    console.log(`\n=== PAIR 2: tick a criterion, then Add note ===\n  ${JSON.stringify(evidence.pair2)}`)
    check(p2.length === 2 && p2.every((n) => n.status < 300),
      'pair 2: both writes sent and BOTH accepted', JSON.stringify(p2.map((n) => n.status)))
    check(!!after2.payload?.exitMonAllMeetingActionsCompleted
      && (after2.payload?.notes ?? []).some((n) => String(n.text ?? '').includes('straight after the tick')),
      'pair 2: and both are in the database, the tick and the note',
      JSON.stringify({ tick: after2.payload?.exitMonAllMeetingActionsCompleted, notes: (after2.payload?.notes ?? []).length }))

    // ── PAIR 3: Record scores, then tick ────────────────────────────────
    await open()
    await page.click(`${V} [data-testid="tb-tab-btn-stage-${MON}"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} .tb-crit-row--tickable`), { timeout: 20000 }, V)
    await settle()
    // Untick first, so the tick in this pair is a real state change.
    await page.click(`${V} .tb-crit-row--tickable`)
    await settle()
    await page.click(`${V} [data-testid="tb-tab-btn-stage-Qualification"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-select-scoreRolloutPath"]`), { timeout: 20000 }, V)
    await settle()
    await page.select(`${V} [data-testid="tb-score-select-scoreRolloutPath"]`, '5')
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-reason-scoreRolloutPath"]`), { timeout: 10000 }, V)
    await page.type(`${V} [data-testid="tb-score-reason-scoreRolloutPath"]`, 'raised after the review')
    mark = net.length
    await page.click(`${V} [data-testid="tb-score-record"]`)
    // The tick lives on another stage tab, so the pair is the score and the
    // tick reached as fast as the tab can be opened: still inside the score's
    // own reload.
    await page.click(`${V} [data-testid="tb-tab-btn-stage-${MON}"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} .tb-crit-row--tickable`), { timeout: 20000 }, V)
    await page.click(`${V} .tb-crit-row--tickable`)
    await settle()
    const p3 = net.slice(mark)
    const after3 = await payloadOf(fx.bedId)
    const scoreP = p3.find((n) => n.method === 'POST' && n.url.endsWith('/scores'))
    const tickP = p3.filter((n) => n.method === 'PATCH' && /\/api\/test-beds\/[^/]+$/.test(n.url))
    evidence.pair3 = { score: scoreP?.status ?? null, ticks: tickP.map((n) => ({ status: n.status, expected: revisionsOf(n) })), banner: await banner() }
    console.log(`\n=== PAIR 3: Record scores, then tick ===\n  ${JSON.stringify(evidence.pair3)}`)
    check(scoreP?.status === 201 && tickP.length >= 1 && tickP.every((n) => n.status < 300),
      'pair 3: the score and the tick are both accepted', JSON.stringify(evidence.pair3))
    check(!!after3.payload?.exitMonAllMeetingActionsCompleted
      && (after3.payload?.scoreRolloutPath ?? []).at(-1)?.value === 5,
      'pair 3: and both are in the database',
      JSON.stringify({ tick: !!after3.payload?.exitMonAllMeetingActionsCompleted, lastScore: (after3.payload?.scoreRolloutPath ?? []).at(-1)?.value }))

    await page.screenshot({ path: `${OUT}w5-pairs-1440.png` })
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  if (fx) { const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length}, remaining ${t.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
