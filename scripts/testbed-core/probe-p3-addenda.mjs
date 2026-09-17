// ── ROUND A PHASE 3 ADDENDA: A REAL MID-RUN REFUSAL, AND THE CARD'S WIDTHS ─
//
// (a) Phase 2's S7 answered the second POST from the browser with a captured
//     body, so it could not say the SERVER refuses mid-run. Here the server
//     does. Three scores are drafted on the screen; then the SECOND criterion is
//     scored OUT OF BAND through the route, as a second person would. The screen
//     does not know, so it sends that criterion without a reason, and the server
//     refuses it for real as a revision needing one. The outcome is read back
//     from the database.
//
//     Honest about the mechanism: had the screen known the criterion was already
//     scored, it would have refused locally (the revision lock). A real server
//     refusal from the UI therefore needs the two to disagree, which is also the
//     one way it happens in use.
//
// (b) The scoring card measured at 1240, 1920 and 3440 before any capture:
//     host width, horizontal overflow, every head's children inside its row,
//     no clipped name or select. SELF-CALIBRATED: a browser-only style that
//     forces a head wider than the card must make the overflow checks FIRE,
//     and removing it must make them pass again.
//
// UNWIRED: builds live records and drives a browser.
// Run: TBCORE_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-core/probe-p3-addenda.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('probe-p3-addenda.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBCORE_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-core/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBCORE-P3A-${Date.now()}`
const V = '#view-test-bed-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))
const stored = async (id) => must(await db.from('record_revisions').select('revision_number,payload')
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
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
    page.on('requestfinished', async (r) => {
      const e = net.find((n) => n.req === r); if (!e) return
      e.status = r.response()?.status() ?? null
      try { e.resp = await r.response()?.text() } catch { e.resp = null }
      e.done = true
    })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-tab-btn-stage-Qualification"]`), { timeout: 30000 }, V)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
    await page.click(`${V} [data-testid="tb-tab-btn-stage-Qualification"]`)
    await page.waitForFunction((v) => { const c = document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`); return c && c.dataset.stage === 'Qualification' && !c.hidden }, { timeout: 20000 }, V)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    const crit = JSON.parse(net.find((n) => n.done && n.url.startsWith('/api/scoring-criteria')).resp)
    const Q = crit.filter((c) => (c.stages ?? []).some((s) => s.stage === 'Qualification'))
    const free = (c) => String(c.levels.find((l) => !l.reason_required).value)
    const [A, B, C] = Q

    // ── (b) widths, with one draft open so the anchors and reason box are measured too
    console.log('\n=== (b) the scoring card at three widths ===')
    await page.select(`${V} [data-testid="tb-score-select-${A.criterion_key}"]`, free(A))
    await frames(page)
    const measure = () => page.evaluate((v) => {
      const card = document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`)
      const host = card.parentElement.getBoundingClientRect()
      const r = card.getBoundingClientRect()
      const heads = [...card.querySelectorAll('.tb-score-head')]
      const outside = heads.filter((h) => [...h.children].some((ch) => {
        const cr = ch.getBoundingClientRect(); return cr.left < r.left - 1 || cr.right > r.right + 1
      })).length
      const clipped = [...card.querySelectorAll('.tb-score-name, .tb-score-value, .tb-score-select, .tb-score-asks, .tb-score-anchor-text, textarea')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1).length
      return { cardWidth: Math.round(r.width), hostWidth: Math.round(host.width), rows: card.querySelectorAll('.tb-score-row').length,
        heads: heads.length, headsWithChildOutside: outside, clipped,
        cardOverflowX: card.scrollWidth > card.clientWidth + 1,
        docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }
    }, V)
    const clean = (m) => m.rows > 0 && m.headsWithChildOutside === 0 && m.clipped === 0 && !m.cardOverflowX && !m.docOverflowX && m.cardWidth <= m.hostWidth
    for (const w of [1240, 1920, 3440]) {
      await page.setViewport({ width: w, height: 1200 })
      await frames(page)
      const m = await measure()
      check(clean(m), `${w}: every row inside the card, nothing clipped, no horizontal overflow`, JSON.stringify(m))
      if (w === 1240) {
        await page.evaluate(() => { const s = document.createElement('style'); s.id = 'p3-calibration'; s.textContent = '[data-testid="tb-stage-scoring-card"] .tb-score-head { min-width: 3000px }'; document.head.appendChild(s) })
        await frames(page)
        const bad = await measure()
        check(!clean(bad), 'CALIBRATION: a head forced wider than the card makes the width checks FIRE', JSON.stringify(bad))
        await page.evaluate(() => document.getElementById('p3-calibration').remove())
        await frames(page)
        check(clean(await measure()), 'CALIBRATION: removing it makes them pass again')
      }
    }
    for (const w of [1240, 3440]) {
      await page.setViewport({ width: w, height: 1200 })
      await frames(page)
      await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`).scrollIntoView({ block: 'start' }), V)
      await frames(page)
      await page.screenshot({ path: `${OUT}p3-scoring-card-${w}.png` })
    }
    await page.setViewport({ width: 1920, height: 1200 })
    await frames(page)

    // ── (a) a REAL mid-run refusal
    console.log('\n=== (a) the server refuses the second of three, for real ===')
    await page.select(`${V} [data-testid="tb-score-select-${B.criterion_key}"]`, free(B))
    await page.select(`${V} [data-testid="tb-score-select-${C.criterion_key}"]`, free(C))
    await frames(page)
    const locked = await page.evaluate((v) => !!document.querySelector(`${v} [data-testid="tb-score-lock-note"]`), V)
    check(!locked, 'three first-score drafts at free levels: no reason is asked for, as far as the screen knows')
    // OUT OF BAND: the second criterion is scored through the route, as a second person would.
    const oob = await api('POST', `/test-beds/${fx.bedId}/scores`, { criterion: B.criterion_key, score: Number(free(B)) })
    const before = await stored(fx.bedId)
    check(oob.status === 201 && (before.payload[B.criterion_key] ?? []).length === 1, `out of band, ${B.criterion_key} is now scored once in the database`, `status ${oob.status}`)
    const mark = net.length
    await page.click(`${V} [data-testid="tb-score-record"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-error"]`), { timeout: 30000 }, V).catch(() => {})
    await page.waitForNetworkIdle({ idleTime: 1200, timeout: 30000 })
    await frames(page)
    const posts = net.slice(mark).filter((n) => n.method === 'POST' && n.url.endsWith(`/test-beds/${fx.bedId}/scores`))
    const refused = posts[1]
    const serverError = refused?.resp ? JSON.parse(refused.resp).error : null
    check(posts.length === 2 && posts[0].status === 201 && refused?.status === 400, 'the SERVER accepted the first and refused the second; the third was never sent',
      posts.map((n) => `${JSON.parse(n.body).criterion}=${n.status}`).join(', '))
    check(refused && !('reason' in JSON.parse(refused.body)), 'the refused body carried no reason, exactly as the screen believed it needed none', refused?.body)
    check(/revis/i.test(serverError ?? ''), 'the refusal is the server\'s REVISION rule, not some other reason', JSON.stringify(serverError))
    const msg = await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-score-error"]`)?.textContent ?? null, V)
    check(msg === `Recorded ${A.name}. ${B.name} could not be recorded: ${serverError}`, 'the message names both, with the server\'s own words', JSON.stringify(msg))
    const after = await stored(fx.bedId)
    check(after.revision_number === before.revision_number + 1, 'exactly one new revision', `${before.revision_number} -> ${after.revision_number}`)
    check((after.payload[A.criterion_key] ?? []).length === 1, `the DATABASE holds ${A.criterion_key}`)
    check((after.payload[B.criterion_key] ?? []).length === 1, `the DATABASE holds ONLY the out-of-band entry for ${B.criterion_key}`)
    check(!after.payload[C.criterion_key], `the DATABASE holds nothing for ${C.criterion_key}`)
    const state = await page.evaluate((v, keys) => Object.fromEntries(keys.map((k) => [k, {
      draft: document.querySelector(`${v} [data-testid="tb-score-select-${k}"]`).value,
      value: document.querySelector(`${v} [data-testid="tb-score-value-${k}"]`).textContent,
      lock: document.querySelector(`${v} [data-testid="tb-score-lock-note"]`)?.textContent ?? null,
    }])), V, [A.criterion_key, B.criterion_key, C.criterion_key])
    check(state[A.criterion_key].draft === '' && state[B.criterion_key].draft === free(B) && state[C.criterion_key].draft === free(C),
      'the recorded draft cleared; the refused and the unsent stay for a retry', JSON.stringify(state))
    check(state[B.criterion_key].value === free(B), 'after the reload the screen shows the out-of-band score it did not know about')
    check(/Add the Reason for/.test(state[B.criterion_key].lock ?? ''), 'and now KNOWS it is a revision: the lock asks for the reason the server wanted', JSON.stringify(state[B.criterion_key].lock))
    await page.screenshot({ path: `${OUT}p3-real-refusal-1920.png` })
  } finally {
    await browser.close()
    writeFileSync(`${OUT}p3-addenda-network.json`, JSON.stringify(net.map(({ req, ...n }) => n), null, 1))
  }
} finally {
  const r = await tearDown(TAG)
  console.log(`\nteardown: removed ${r.removed.length}, remaining ${r.remaining}`)
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks PASS`)
  process.exitCode = failed.length ? 1 : 0
}
