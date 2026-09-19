// ── V8: THE REASON LINE RESERVES NO SPACE WHEN IT DOES NOT RENDER ───────
//
// The criterion rows must sit tight and EQUAL: a row whose criterion has a
// recorded reason and one whose criterion has none should differ by the height
// of the reason and by nothing else.
//
// Measured as a RELATIONSHIP between rows rather than as a property of one
// (Verification 4's mechanism clause): the gap between two rows WITHOUT reasons
// is compared against the gap between two other rows without reasons, and
// against the row that has one.
//
// UNWIRED. Run: TBSP_RUN=<label> ... node --env-file=.env scripts/walk3/probe-v8.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('walk3/probe-v8.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/walk-3/${RUN}/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `W3-V8-${Date.now()}`
const V = '#view-test-bed-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  // ONE criterion carries a reason and the rest carry none. That is the state
  // the finding is about: the rows must differ by the reason and nothing else.
  await call('POST', `/test-beds/${fx.bedId}/scores`, { criterion: 'scoreRolloutPath', score: 4 })
  const r = await call('POST', `/test-beds/${fx.bedId}/scores`, {
    criterion: 'scoreRolloutPath', score: 5, reason: 'the rollout path firmed up after the site visit' })
  if (r.status >= 300) throw new Error(`scoring: ${r.status} ${JSON.stringify(r.data)}`)

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
    await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
    await page.click(`${V} [data-testid="tb-tab-btn-stage-Qualification"]`)
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-select-scoreRolloutPath"]`), { timeout: 20000 }, V)
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })

    const m = await page.evaluate((v) => {
      const rows = [...document.querySelectorAll(`${v} .tb-score-row[data-criterion]`)]
      const read = (row) => {
        const r = row.getBoundingClientRect()
        const head = row.querySelector('.tb-score-head')?.getBoundingClientRect()
        const cur = row.querySelector('[data-testid^="tb-score-current-"]')
        const asks = row.querySelector('[data-testid^="tb-score-asks-"]')?.getBoundingClientRect()
        return {
          key: row.getAttribute('data-criterion'),
          top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
          headBottom: head ? Math.round(head.bottom) : null,
          hasReason: !!cur,
          // The space between the head and the next thing in the row. This is
          // where a line that renders nothing would still be taking room.
          headToAsks: head && asks ? Math.round(asks.top - head.bottom) : null,
          headH: head ? Math.round(head.height) : null,
          // The NAME's own height is the honest grouping key: it is set by the
          // criterion's text and by nothing this round can change, so two rows
          // with equal names must render equal. Grouping by HEAD height cannot
          // see space reserved INSIDE the head - calibrated, and that injection
          // came back silent until this line existed.
          nameH: (() => {
            const n = row.querySelector('.tb-score-name')?.getBoundingClientRect()
            return n ? Math.round(n.height) : null
          })(),
          // And every remaining gap inside the row, so a reserved line shows up
          // wherever it is rather than only where it was expected.
          asksToToggle: (() => {
            const t = row.querySelector('.anchors-toggle')?.getBoundingClientRect()
            return asks && t ? Math.round(t.top - asks.bottom) : null
          })(),
          toggleToBottom: (() => {
            const t = row.querySelector('.anchors-toggle')?.getBoundingClientRect()
            return t ? Math.round(r.bottom - t.bottom) : null
          })(),
        }
      }
      return rows.map(read)
    }, V)
    evidence.rows = m
    console.log('\n=== the criterion rows ===')
    for (const r of m) console.log(`  ${String(r.key).padEnd(34)} h=${String(r.h).padEnd(4)} headH=${String(r.headH).padEnd(4)} head>asks=${String(r.headToAsks).padEnd(4)} asks>toggle=${String(r.asksToToggle).padEnd(4)} toggle>end=${String(r.toggleToBottom).padEnd(4)} reason=${r.hasReason}`)

    const withReason = m.filter((r) => r.hasReason)
    const without = m.filter((r) => !r.hasReason)
    check(withReason.length >= 1 && without.length >= 2,
      'the surface has both kinds of row, so the comparison is not vacuous',
      `${withReason.length} with a reason, ${without.length} without`)

    // THE CLAIM. Rows WITHOUT a reason must all leave the same gap under their
    // head, and it must be the gap a row with nothing to say needs - not the
    // gap a reason would have taken.
    const gaps = without.map((r) => r.headToAsks).filter((g) => g !== null)
    const spread = Math.max(...gaps) - Math.min(...gaps)
    check(spread <= 1, 'V8: every row without a reason leaves the SAME gap under its head',
      `gaps ${JSON.stringify(gaps)}, spread ${spread}px`)

    // ── COMPARE LIKE WITH LIKE ─────────────────────────────────────────
    //
    // The first version of this check compared raw row heights and read a 57px
    // spread as a finding. It was measuring NAME WRAP: "Clear Use Case
    // Requirements and Metrics" takes three lines, so its head is 77px against
    // 35px, and the measurability question the same. That is content, not
    // reserved space - a measure aimed at the wrong axis of a property with
    // more than one (Verification 33).
    //
    // Grouped by head height, every row must be the same total: the reason
    // must cost NOTHING outside the head.
    // STRUCTURALLY COMPARABLE ROWS ONLY. The measurability row has no question,
    // no definitions toggle and no anchors - `headToAsks` is null for it - so
    // grouping it with a criterion row by head height alone compared a 98px row
    // against a 155px one and called the difference a finding. Same fault as
    // the version above, one level down.
    const byName = new Map()
    for (const r of m) {
      if (r.nameH === null || r.headToAsks === null) continue
      const list = byName.get(r.nameH) ?? []
      list.push(r)
      byName.set(r.nameH, list)
    }
    let worst = 0
    let worstHead = 0
    for (const [, list] of byName) {
      const hs = list.map((r) => r.h)
      const heads = list.map((r) => r.headH)
      worst = Math.max(worst, Math.max(...hs) - Math.min(...hs))
      worstHead = Math.max(worstHead, Math.max(...heads) - Math.min(...heads))
    }
    check(worst <= 2, 'V8: a row with a reason is no taller than one without, at the same name height',
      `worst total spread within a name-height group: ${worst}px`)
    // And the head itself, because space reserved INSIDE the head moves the
    // whole row down without changing any gap BETWEEN its parts.
    check(worstHead <= 2, 'V8: and no row reserves space inside its head for a reason it is not showing',
      `worst head spread within a name-height group: ${worstHead}px`)

    // And every row's internal gaps are identical, so no row is holding space
    // for something it is not rendering.
    const shapes = new Set(m.filter((r) => r.headToAsks !== null)
      .map((r) => `${r.headToAsks}/${r.asksToToggle}/${r.toggleToBottom}`))
    check(shapes.size === 1, 'V8: and every row has the same internal spacing',
      `${shapes.size} distinct shape(s): ${[...shapes].join(', ')}`)
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-stage-scoring-card"]`)?.scrollIntoView({ block: 'center' }), V)
    await new Promise((r) => setTimeout(r, 150))
    await page.screenshot({ path: `${OUT}v8-rows-1440.png` })
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
