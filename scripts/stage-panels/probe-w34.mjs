// ── W3, W4 AND W2, LIVE AT 1440 ─────────────────────────────────────────
//
// Three walk findings on one screen, each measured as a RELATIONSHIP between
// two elements rather than as a CSS property (Verification 4): "on its label's
// line" is two boxes overlapping vertically, "beside the score" is a box to the
// RIGHT of the select and level with it, and a date format is read off the
// rendered text.
//
// W4's save path is proven UNCHANGED by recording a re-score through the moved
// control and reading it back from the database, because moving a box in the
// DOM is exactly the change that can quietly unbind its handler.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-w34.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-w34.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-W34-${Date.now()}`
const V = '#view-test-bed-detail'
const QUAL = 'Qualification'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const payloadOf = async (id) => (must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'payload')[0] ?? {}).payload ?? {}
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  // A count with units behind it, so the Commercials row is LOCKED: the state
  // W3 is about, built the way the system builds it (derive, not an insert).
  await call('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: '2' }, expected_revision: rev })
  const derived = await call('POST', `/test-beds/${fx.bedId}/units/derive`, {})
  const units = must(await db.from('records').select('id').eq('record_type', 'unit')
    .eq('parent_record_id', fx.bedId).is('deleted_at', null), 'units')
  check(derived.status < 300 && units.length === 2,
    'the fixture has real units behind the count, so the row is genuinely locked',
    `${derived.status}, ${units.length} units`)
  // A score with a history entry, so W2 has a date on screen to read.
  // The second is a REVISION, and the route requires a reason for one: the
  // fixture is built the way the system builds the state rather than the way
  // this probe would find convenient (Verification 47).
  for (const [score, reason] of [[4, null], [5, 'the first site visit improved it']]) {
    const body = { criterion: 'scoreRolloutPath', score }
    if (reason) body.reason = reason
    const r = await call('POST', `/test-beds/${fx.bedId}/scores`, body)
    if (r.status >= 300) throw new Error(`scoring: ${r.status} ${JSON.stringify(r.data)}`)
  }

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    const net = []
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), req: r, done: false }) })
    page.on('requestfinished', (r) => { const e = net.find((n) => n.req === r); if (e) { e.status = r.response()?.status() ?? null; e.done = true } })
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })

    // ── W3, on Commercials ────────────────────────────────────────────
    await page.click(`${V} [data-testid="tb-tab-btn-commercials"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-count-locked-safesightCameras"]`), { timeout: 20000 }, V)
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 })
    const w3 = await page.evaluate((v) => {
      const row = document.querySelector(`${v} [data-testid="tb-count-locked-safesightCameras"]`)
      if (!row) return null
      const label = row.querySelector('.field-row-label')?.getBoundingClientRect()
      const value = row.querySelector('.field-row-display')?.getBoundingClientRect()
      // A neighbour that is an ordinary editable row, for the alignment to be
      // measured AGAINST rather than in isolation.
      const peer = document.querySelector(`${v} [data-testid="display-hemirSensors"]`)?.getBoundingClientRect()
      const peerLabel = document.querySelector(`${v} [data-field="hemirSensors"] .field-row-label`)?.getBoundingClientRect()
      return {
        text: row.textContent.trim(),
        readonly: row.getAttribute('data-readonly'),
        colour: getComputedStyle(row.querySelector('.field-row-display')).color,
        peerColour: peer ? getComputedStyle(document.querySelector(`${v} [data-testid="display-hemirSensors"]`)).color : null,
        label: label && { top: Math.round(label.top), left: Math.round(label.left) },
        value: value && { top: Math.round(value.top), left: Math.round(value.left) },
        peerOffset: peer && peerLabel ? Math.round(peer.left - peerLabel.left) : null,
        ownOffset: value && label ? Math.round(value.left - label.left) : null,
      }
    }, V)
    evidence.w3 = w3
    console.log(`\n=== W3, the locked count at 1440 ===\n  ${JSON.stringify(w3)}`)
    check(!!w3, 'the locked row renders')
    check(!!w3 && Math.abs(w3.value.top - w3.label.top) <= 6,
      'W3: the value sits on its label\'s LINE, not below it',
      w3 ? `label top ${w3.label.top}, value top ${w3.value.top}` : '')
    check(!!w3 && w3.ownOffset === w3.peerOffset,
      'W3: and it starts where every other row\'s value starts, so the column holds',
      w3 ? `locked +${w3.ownOffset}px, editable neighbour +${w3.peerOffset}px` : '')
    check(!!w3 && !/Locked:/.test(w3.text) && !/Installation and Commissioning/.test(w3.text),
      'W3 ruling: the superseded sentence is gone from the row', w3 ? JSON.stringify(w3.text) : '')
    check(!!w3 && w3.readonly === 'true' && w3.colour !== w3.peerColour,
      'W3 ruling: and the lock is VISIBLE, dimmed against an editable neighbour',
      w3 ? `${w3.colour} against ${w3.peerColour}` : '')
    await page.screenshot({ path: `${OUT}w3-commercials-1440.png` })

    // ── W4 and W2, on Qualification ───────────────────────────────────
    await page.click(`${V} [data-testid="tb-tab-btn-stage-${QUAL}"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-select-scoreRolloutPath"]`), { timeout: 20000 }, V)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
    await page.select(`${V} [data-testid="tb-score-select-scoreRolloutPath"]`, '3')
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-reason-scoreRolloutPath"]`), { timeout: 10000 }, V)
    const w4 = await page.evaluate((v) => {
      const box = (sel) => { const el = document.querySelector(`${v} ${sel}`); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) } }
      return {
        select: box('[data-testid="tb-score-select-scoreRolloutPath"]'),
        reason: box('[data-testid="tb-score-reason-scoreRolloutPath"]'),
        row: box('[data-testid="tb-score-scoreRolloutPath"]'),
        anchors: box('[data-testid="tb-anchors-toggle-scoreRolloutPath"]'),
      }
    }, V)
    evidence.w4 = w4
    console.log(`\n=== W4, the reason beside the score at 1440 ===\n  ${JSON.stringify(w4)}`)
    // CAPTURED HERE, with the reason open, because the claim is about this
    // state: the save below clears the draft and takes the box away with it, so
    // a capture after it shows a row the finding is not about (Verification 44's
    // clause on an artefact that depicts the wrong moment).
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-score-scoreRolloutPath"]`)?.scrollIntoView({ block: 'center' }), V)
    await new Promise((r) => setTimeout(r, 150))
    await page.screenshot({ path: `${OUT}w4-reason-beside-1440.png` })
    check(!!w4.reason && !!w4.select && w4.reason.left > w4.select.right,
      'W4: the reason sits to the RIGHT of the score control',
      `select right ${w4.select?.right}, reason left ${w4.reason?.left}`)
    check(!!w4.reason && !!w4.select && Math.abs(w4.reason.top - w4.select.top) <= 24,
      'W4: and level with it, so the two read as one line of work',
      `select top ${w4.select?.top}, reason top ${w4.reason?.top}`)
    check(!!w4.reason && !!w4.anchors && w4.reason.bottom <= w4.anchors.top + 2,
      'W4: and ABOVE the definitions, which is where it used to sit below',
      `reason bottom ${w4.reason?.bottom}, definitions top ${w4.anchors?.top}`)
    check(!!w4.reason && !!w4.row && w4.reason.w >= 260,
      'W4: and it uses the width R2 gave the row rather than a crushed remainder',
      `reason ${w4.reason?.w}px of a ${w4.row?.w}px row`)

    // W2: every date this round's files render. The history entries are where
    // they are, and the history is COLLAPSED until somebody opens it: the first
    // run read zero dates and its own "every date is dd/mm/yyyy" assertion
    // passed on an empty list, which is Verification 14's vacuous truth caught
    // by the check that exists to catch it.
    await page.click(`${V} [data-testid="tb-score-history-scoreRolloutPath"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-entry"]`), { timeout: 10000 }, V)
    const w2 = await page.evaluate((v) => [...document.querySelectorAll(`${v} [data-testid="tb-score-entry"] .ref-notes-when`)]
      .map((el) => el.textContent.trim()), V)
    evidence.w2 = w2
    console.log(`\n=== W2, the dates this round renders ===\n  ${JSON.stringify(w2)}`)
    check(w2.length > 0, 'there are dates on screen to read, so the claim is not vacuous', String(w2.length))
    check(w2.every((t) => /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(t)),
      'W2: every date this round renders shows dd/mm/yyyy', JSON.stringify(w2))

    // W4's save path, unchanged: the moved box still feeds the same write.
    const before = (await payloadOf(fx.bedId)).scoreRolloutPath ?? []
    const mark = net.length
    await page.type(`${V} [data-testid="tb-score-reason-scoreRolloutPath"]`, 'the site visit changed the rollout path again')
    await page.click(`${V} [data-testid="tb-score-record"]`)
    await waitFor(() => net.slice(mark).some((n) => n.method === 'POST' && n.url.endsWith('/scores') && n.done))
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 20000 })
    const post = net.slice(mark).find((n) => n.method === 'POST' && n.url.endsWith('/scores'))
    const after = (await payloadOf(fx.bedId)).scoreRolloutPath ?? []
    check(post?.status === 201 && after.length === before.length + 1 && after.at(-1).value === 3,
      'W4: a re-score through the MOVED control is recorded and read back from the database',
      JSON.stringify({ status: post?.status, entries: after.length, last: after.at(-1)?.value }))
    check(after.at(-1)?.reason === 'the site visit changed the rollout path again',
      'W4: and the reason typed in the moved box is what was stored',
      JSON.stringify(after.at(-1)?.reason))
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`)?.scrollIntoView({ block: 'center' }), V)
    await page.screenshot({ path: `${OUT}w4-scoring-1440.png` })
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
