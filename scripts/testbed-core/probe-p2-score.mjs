// ── ROUND A PHASE 2: A REAL SCORE, END TO END, READ BACK FROM THE DATABASE ─
//
// The closing proof R9 asks for. Against a tagged fixture Test Bed at
// Qualification, on the real screen:
//
//   S1  Qualification offers the criteria whose stage rows name it, in the
//       route's order, and the measurability row (P0.2's claim, closed).
//   S2  Site Assessment offers its own, and no measurability row.
//   S3  the entry LOCK, live: a required level locks the other selects, names
//       the criterion, moves focus into the box; typing the reason releases it.
//   S4  pending marks: each drafted score marks its exit-criteria row "unsaved".
//   S5  Record: one FLAT body per criterion in panel order, each accepted, and
//       the DATABASE holds the entries (value, reason, author, stage); after the
//       reload the screen shows them and the exit rows read met from the server.
//   S6  measurability Yes, saved at once, read back from the database.
//   S7  partial failure: the SECOND of three POSTs is answered by the browser
//       with the server's own captured refusal body; the run stops, the message
//       names both, the database holds only the first, the rest stay drafted.
//   S8  the door: handed to another owner, the selects and both write controls
//       are inert and nothing is sent.
//
// Every write claim is read from the database. Measurements precede captures.
// UNWIRED: builds live records and drives a browser.
// Run: TBCORE_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-core/probe-p2-score.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin, handOver } from '../fixtures.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('probe-p2-score.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBCORE_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-core/${RUN}/`
mkdirSync(OUT, { recursive: true })
const CAPTURED = JSON.parse(readFileSync(`${ROOT}/frontend-react/src/__tests__/fixtures/scoring-live.json`, 'utf8'))
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBCORE-P2-${Date.now()}`
const V = '#view-test-bed-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))
const stored = async (id) => must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).single(), 'rev')
const last = (arr) => (Array.isArray(arr) && arr.length ? [...arr].sort((a, b) => String(a.at).localeCompare(String(b.at))).at(-1) : null)

let fx
try {
  fx = await freshTestBed(TAG)
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}`)
  const browser = await puppeteer.launch({ headless: 'new' })
  const net = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1200 })
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
    const finish = async (r) => {
      const e = net.find((n) => n.req === r); if (!e) return
      e.status = r.response()?.status() ?? null
      try { e.resp = await r.response()?.text() } catch { e.resp = null }
      e.done = true
    }
    page.on('requestfinished', finish)
    page.on('requestfailed', (r) => { const e = net.find((n) => n.req === r); if (e) { e.done = true; e.status = 'failed' } })
    const since = (i, pred) => net.slice(i).filter(pred)
    const scorePosts = (i) => since(i, (n) => n.method === 'POST' && n.url.endsWith(`/test-beds/${fx.bedId}/scores`))
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)) } return false }

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    const open = async () => {
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-tab-btn-stage-Qualification"]`), { timeout: 30000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
    }
    const stage = async (name) => {
      await page.click(`${V} [data-testid="tb-tab-btn-stage-${name}"]`)
      await page.waitForFunction((v, s) => {
        const c = document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`)
        return c && c.dataset.stage === s && document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"][data-stage="${s}"]`)
      }, { timeout: 20000 }, V, name)
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 })
      await frames(page)
    }
    const card = () => page.evaluate((v) => {
      const c = document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`)
      return { hidden: c.hidden, display: getComputedStyle(c).display, height: c.getBoundingClientRect().height,
        keys: [...c.querySelectorAll('[data-testid^="tb-score-select-"]')].map((s) => s.dataset.testid.replace('tb-score-select-', '')),
        measurability: !!c.querySelector('[data-testid="tb-score-measurability"]'),
        lockNote: c.querySelector('[data-testid="tb-score-lock-note"]')?.textContent ?? null,
        disabled: Object.fromEntries([...c.querySelectorAll('select')].map((s) => [s.dataset.testid, s.disabled])),
        active: document.activeElement?.dataset?.testid ?? null,
        error: c.querySelector('[data-testid="tb-score-error"]')?.textContent ?? null,
        recordDisabled: c.querySelector('[data-testid="tb-score-record"]')?.disabled ?? null,
        values: Object.fromEntries([...c.querySelectorAll('[data-testid^="tb-score-value-"]')].map((s) => [s.dataset.testid.replace('tb-score-value-', ''), s.textContent])),
        drafts: Object.fromEntries([...c.querySelectorAll('[data-testid^="tb-score-select-"]')].map((s) => [s.dataset.testid.replace('tb-score-select-', ''), s.value])),
        measValue: c.querySelector('[data-testid="tb-measurability-value"]')?.textContent ?? null }
    }, V)
    const pendingRows = () => page.evaluate((v) => [...document.querySelectorAll(`${v} [data-testid="tb-stage-exit-criteria-list"] .tb-crit-row`)]
      .filter((r) => r.querySelector('[data-testid="tb-crit-pending-tag"]')).map((r) => r.dataset.field), V)
    const metOf = (field) => page.evaluate((v, f) => [...document.querySelectorAll(`${v} [data-testid="tb-stage-exit-criteria-list"] .tb-crit-row`)]
      .find((r) => r.dataset.field === f)?.dataset.met ?? null, V, field)
    const pick = async (key, value) => { await page.select(`${V} [data-testid="tb-score-select-${key}"]`, value); await frames(page) }

    await open()
    const crit = JSON.parse(net.find((n) => n.done && n.url.startsWith('/api/scoring-criteria')).resp)
    const atStage = (s) => crit.filter((c) => (c.stages ?? []).some((x) => x.stage === s)).map((c) => c.criterion_key)
    const nameOf = (k) => crit.find((c) => c.criterion_key === k)?.name ?? k
    const needs = (k) => String(crit.find((c) => c.criterion_key === k).levels.find((l) => l.reason_required).value)
    const free = (k) => String(crit.find((c) => c.criterion_key === k).levels.find((l) => !l.reason_required).value)

    console.log('\n=== S1 Qualification ===')
    await stage('Qualification')
    let c1 = await card()
    check(!c1.hidden && c1.display !== 'none' && c1.height > 0, 'the scoring card is VISIBLE', JSON.stringify({ hidden: c1.hidden, display: c1.display, height: c1.height }))
    check(JSON.stringify(c1.keys) === JSON.stringify(atStage('Qualification')) && c1.keys.length > 0, 'it offers the criteria whose stage rows name Qualification, in the route\'s order', `${c1.keys.length}: ${c1.keys.join(',')}`)
    check(c1.measurability, 'the measurability row is on Qualification')
    check(c1.recordDisabled === true, 'with nothing drafted, Record scores is disabled')

    console.log('\n=== S2 Site Assessment ===')
    await stage('Site Assessment')
    const c2 = await card()
    check(JSON.stringify(c2.keys) === JSON.stringify(atStage('Site Assessment')) && c2.keys.length > 0 && c2.keys.length !== c1.keys.length, 'Site Assessment offers its own, different set', c2.keys.join(','))
    check(!c2.measurability && !c2.hidden, 'and no measurability row, on a visible card')

    console.log('\n=== S3 the entry lock, live ===')
    await stage('Qualification')
    const [K1, K2] = c1.keys
    await pick(K2, needs(K2))
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-lock-note"]`), { timeout: 10000 }, V).catch(() => {})
    const c3 = await card()
    check(c3.lockNote === `Add the Reason for ${nameOf(K2)} before scoring anything else.`, 'a required level shows the lock note naming the criterion', JSON.stringify(c3.lockNote))
    check(c3.disabled[`tb-score-select-${K1}`] === true && c3.disabled['tb-measurability-select'] === true && c3.disabled[`tb-score-select-${K2}`] === false, 'the OTHER selects and measurability lock; the blocking one does not')
    check(c3.active === `tb-score-reason-${K2}`, 'focus moved into its reason box', c3.active)
    await page.type(`${V} [data-testid="tb-score-reason-${K2}"]`, 'Live probe: no sponsor named yet.')
    await frames(page)
    const c3b = await card()
    check(c3b.lockNote === null && c3b.disabled[`tb-score-select-${K1}`] === false, 'typing the reason RELEASES the lock')

    console.log('\n=== S4 pending marks ===')
    await pick(K1, free(K1))
    const pend = await pendingRows()
    check(JSON.stringify([...pend].sort()) === JSON.stringify([K1, K2].sort()), 'each drafted score marks its exit row "unsaved", and only those', pend.join(','))
    await page.screenshot({ path: `${OUT}p2-drafted-1920.png` })

    console.log('\n=== S5 Record, read back from the database ===')
    const before5 = await stored(fx.bedId)
    let mark = net.length
    await page.click(`${V} [data-testid="tb-score-record"]`)
    await waitFor(() => scorePosts(mark).filter((n) => n.done).length === 2)
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 })
    await frames(page)
    const p5 = scorePosts(mark)
    check(JSON.stringify(p5.map((n) => JSON.parse(n.body))) === JSON.stringify([
      { criterion: K1, score: Number(free(K1)) },
      { criterion: K2, score: Number(needs(K2)), reason: 'Live probe: no sponsor named yet.' },
    ]), 'two FLAT bodies, in panel order, the reason only where given', p5.map((n) => n.body).join(' | '))
    check(p5.every((n) => n.status === 201), 'the real route ACCEPTED both', p5.map((n) => n.status).join(','))
    const after5 = await stored(fx.bedId)
    const e1 = last(after5.payload[K1]); const e2 = last(after5.payload[K2])
    check(after5.revision_number === before5.revision_number + 2, 'two new revisions in the database', `${before5.revision_number} -> ${after5.revision_number}`)
    check(e1?.value === Number(free(K1)) && e1?.by === OWNER.user.email && e1?.stage === 'Qualification', `the DATABASE holds ${K1}`, JSON.stringify(e1))
    check(e2?.value === Number(needs(K2)) && e2?.reason === 'Live probe: no sponsor named yet.', `the DATABASE holds ${K2} WITH its reason`, JSON.stringify(e2))
    const c5 = await card()
    check(c5.values[K1] === free(K1) && c5.values[K2] === needs(K2) && c5.drafts[K1] === '' && c5.drafts[K2] === '', 'after the reload the screen shows the stored values and the drafts are gone', JSON.stringify({ v: c5.values, d: c5.drafts }))
    check((await pendingRows()).length === 0, 'no pending marks remain')
    const met1 = await metOf(K1)
    check(met1 === 'true', 'the exit row now reads met FROM THE SERVER', `data-met ${met1}`)
    check(c5.error === null, 'no failure message')

    console.log('\n=== S6 measurability ===')
    mark = net.length
    const before6 = await stored(fx.bedId)
    await page.select(`${V} [data-testid="tb-measurability-select"]`, 'yes')
    await waitFor(() => since(mark, (n) => n.method === 'POST' && n.url.endsWith('/measurability') && n.done).length === 1)
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 })
    await frames(page)
    const m6 = since(mark, (n) => n.url.endsWith('/measurability'))
    const after6 = await stored(fx.bedId)
    check(m6.length === 1 && m6[0].body === '{"confirmed":true}' && m6[0].status === 201, 'Yes saved at once as {"confirmed":true}, accepted', `${m6[0]?.body} ${m6[0]?.status}`)
    check(last(after6.payload.measurabilityConfirmed)?.value === true && after6.revision_number === before6.revision_number + 1, 'the DATABASE holds the confirmation')
    check((await card()).measValue === 'Yes', 'the screen shows Yes')
    await page.screenshot({ path: `${OUT}p2-recorded-1920.png` })

    console.log('\n=== S7 partial failure, the second POST refused with the server\'s own body ===')
    const [, , K3, K4, K5] = c1.keys
    for (const k of [K3, K4, K5]) await pick(k, free(k))
    const refusal = CAPTURED.refusals.revisionWithoutReason
    let seen = 0
    await page.setRequestInterception(true)
    const intercept = (r) => {
      if (r.method() === 'POST' && r.url().endsWith(`/test-beds/${fx.bedId}/scores`) && ++seen === 2) {
        r.respond({ status: refusal.status, contentType: 'application/json', body: JSON.stringify(refusal.body) })
      } else r.continue()
    }
    page.on('request', intercept)
    const before7 = await stored(fx.bedId)
    mark = net.length
    await page.click(`${V} [data-testid="tb-score-record"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-error"]`), { timeout: 30000 }, V).catch(() => {})
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 })
    page.off('request', intercept)
    await page.setRequestInterception(false)
    await frames(page)
    const p7 = scorePosts(mark)
    const after7 = await stored(fx.bedId)
    const c7 = await card()
    check(p7.length === 2, 'the run STOPPED at the refusal: the third was never sent', `${p7.length} POSTs: ${p7.map((n) => `${JSON.parse(n.body).criterion}=${n.status}`).join(', ')}`)
    check(c7.error === `Recorded ${nameOf(K3)}. ${nameOf(K4)} could not be recorded: ${refusal.body.error}`, 'the message names what was and was not recorded', JSON.stringify(c7.error))
    check(!!last(after7.payload[K3]) && !after7.payload[K4] && !after7.payload[K5] && after7.revision_number === before7.revision_number + 1, 'the DATABASE holds the first only', `rev ${before7.revision_number} -> ${after7.revision_number}`)
    check(c7.drafts[K3] === '' && c7.drafts[K4] === free(K4) && c7.drafts[K5] === free(K5), 'the recorded one cleared; the refused and the unsent stay drafted for a retry', JSON.stringify(c7.drafts))
    await page.screenshot({ path: `${OUT}p2-partial-1920.png` })

    console.log('\n=== S8 the door ===')
    const other = must(await db.from('records').select('owner_id').eq('record_type', 'test_bed').is('deleted_at', null).neq('owner_id', OWNER.user.id).limit(1).single(), 'other').owner_id
    await handOver(fx.bedId, other)
    await page.reload({ waitUntil: 'networkidle0' })
    await open()
    await stage('Qualification')
    await page.waitForFunction((v) => [...document.querySelectorAll(`${v} [data-testid="tb-stage-scoring-card"] select`)].every((s) => s.disabled), { timeout: 10000 }, V).catch(() => {})
    const c8 = await card()
    const before8 = await stored(fx.bedId)
    mark = net.length
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-score-record"]`)?.click(), V)
    await page.evaluate((v) => { const s = document.querySelector(`${v} [data-testid="tb-measurability-select"]`); s.value = 'no'; s.dispatchEvent(new Event('change', { bubbles: true })) }, V)
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 })
    const after8 = await stored(fx.bedId)
    check(Object.values(c8.disabled).every(Boolean) && c8.recordDisabled === true, 'every score select, measurability and Record are inert on an unowned record', JSON.stringify(c8.disabled))
    check(since(mark, (n) => n.method === 'POST').length === 0 && after8.revision_number === before8.revision_number, 'a forced click and a forced change send NOTHING, and the record is unchanged')
    check(net.filter((n) => n.method === 'POST' && n.url.includes('/scores')).length >= 4, 'CALIBRATION: the same listener saw the score POSTs earlier in this run')
  } finally {
    await browser.close()
    writeFileSync(`${OUT}p2-network.json`, JSON.stringify(net.map(({ req, ...n }) => n), null, 1))
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
