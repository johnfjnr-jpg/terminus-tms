// DEAL RADAR Phase 4, addition A: the failed-read path of the overlay.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/deal-radar/probe-radar-unavailable.mjs <opportunity id> [stage]
//
// UNWIRED, deliberately: a round proof against a named live record that has
// changed stage, so its radar normally draws an overlay.
//
// The overlay's instant comes from two reads: GET /records/:id/history and
// GET /records/:id/transition-requests. A failed read is NOT "never moved",
// so the radar must say it could not tell rather than draw nothing silently.
// Each read is failed IN THE PAGE (request interception answers 500; no
// server change), one at a time, and the stage tab asserts:
//   - no overlay polygon, and svg data-overlay="unavailable"
//   - the aria-label says the last stage change could not be read
//   - the Last stage key is absent
//   - the lens rows are byte-identical to an unstubbed load of the same tab
//
// The unstubbed baseline is asserted FIRST to carry an overlay, or "no
// overlay" below would be true of a record that never moved (Verification 14).
// Each stubbed run also proves its stub was hit and the OTHER read answered.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'

const [ID, STAGE = 'Qualification'] = process.argv.slice(2)
if (!ID) { console.error('usage: probe-radar-unavailable.mjs <opportunity id> [stage]'); process.exit(2) }
const puppeteer = await loadPuppeteer('deal-radar/probe-radar-unavailable.mjs')
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) pass++; else fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`) }
const READS = {
  history: new RegExp(`/api/records/${ID}/history(\\?|$)`),
  requests: new RegExp(`/api/records/${ID}/transition-requests(\\?|$)`),
}

const b = await puppeteer.launch({ headless: 'new' })
const load = async (stub) => {
  const p = await b.newPage()
  const seen = { stubbed: 0, history: [], requests: [] }
  await p.setRequestInterception(true)
  p.on('request', (rq) => {
    const u = rq.url()
    if (rq.method() === 'GET' && stub && READS[stub].test(u)) {
      seen.stubbed++
      return rq.respond({ status: 500, contentType: 'application/json', body: '{"error":"stubbed by probe-radar-unavailable"}' })
    }
    rq.continue()
  })
  p.on('response', (rs) => {
    for (const [k, re] of Object.entries(READS)) if (rs.request().method() === 'GET' && re.test(rs.url())) seen[k].push(rs.status())
  })
  await p.setViewport({ width: 1440, height: 1100 })
  await p.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((rid) => navigate('opportunity-detail', rid), ID)
  await p.waitForFunction((rid) => currentOppDetailId === rid && Array.isArray(oppLenses), { timeout: 30000 }, ID)
  const key = await p.evaluate((s) => oppStageTabKey(s), STAGE)
  await p.evaluate((k) => document.querySelector(`#view-opportunity-detail [data-opp-tab="${k}"]`).click(), key)
  await p.waitForFunction((k, s) => !!document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar[data-stage="${s}"]`), { timeout: 15000 }, key, STAGE)
  const m = await p.evaluate((k) => {
    const blk = document.querySelector(`#opp-stage-criteria-${k} .opp-lens-rollups`)
    const svg = blk.querySelector('svg.opp-radar')
    return {
      overlay: svg.dataset.overlay ?? null,
      asOf: svg.dataset.asOf ?? null,
      thenPolys: svg.querySelectorAll('polygon.opp-radar-then').length,
      nowPolys: svg.querySelectorAll('polygon.opp-radar-now').length,
      aria: svg.getAttribute('aria-label') ?? '',
      thenKey: blk.querySelectorAll('.opp-radar-key--then').length,
      nowKey: blk.querySelectorAll('.opp-radar-key--now').length,
      rows: [...blk.querySelectorAll('.opp-lens-rollup')].map((r) => r.outerHTML).join('\n'),
      rowCount: blk.querySelectorAll('.opp-lens-rollup').length,
    }
  }, key)
  await p.close()
  return { m, seen }
}

try {
  console.log(`== baseline, no stub: ${ID.slice(0, 8)} at ${STAGE}`)
  const base = await load(null)
  check(base.m.overlay === 'present' && base.m.thenPolys === 1 && !!base.m.asOf,
    `the unstubbed tab draws an overlay, so its absence below means something (${base.m.overlay}, as of ${base.m.asOf})`)
  check(base.m.thenKey === 1, 'and its Last stage key')
  check(base.m.rowCount > 0, `the baseline has lens rows to compare (${base.m.rowCount})`)
  check(!/could not be read/.test(base.m.aria), 'the baseline label does not say the read failed')

  for (const stub of ['history', 'requests']) {
    const other = stub === 'history' ? 'requests' : 'history'
    console.log(`\n== the ${stub} read fails`)
    const r = await load(stub)
    check(r.seen.stubbed >= 1, `the stub was hit (${r.seen.stubbed}), and the page saw ${r.seen[stub].join(',') || 'nothing'}`)
    check(r.seen[other].length >= 1 && r.seen[other].every((s) => s === 200), `the ${other} read answered (${r.seen[other].join(',') || 'nothing'})`)
    check(r.m.overlay === 'unavailable', `svg data-overlay is "unavailable" (${r.m.overlay})`)
    check(r.m.thenPolys === 0 && r.m.asOf === null, `no overlay is drawn (${r.m.thenPolys} polygons, as of ${r.m.asOf})`)
    check(r.m.nowPolys === 1 && r.m.nowKey === 1, 'the Now shape and its key are still drawn')
    check(/The last stage change could not be read\./.test(r.m.aria) && !/At the last stage change/.test(r.m.aria),
      `the label says the last stage change could not be read: "${r.m.aria.slice(-60)}"`)
    check(r.m.thenKey === 0, `the Last stage key is absent (${r.m.thenKey})`)
    check(r.m.rows === base.m.rows, `the ${r.m.rowCount} lens rows are byte-identical to the unstubbed load`)
  }
} finally { await b.close() }
console.log(`${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
