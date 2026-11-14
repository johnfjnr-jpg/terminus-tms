// DEAL RADAR Phase 3: the overlay follows an IN-PAGE move, with no reload.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/deal-radar/probe-inpage-move.mjs
//
// UNWIRED, deliberately: a round proof that builds and tears down a fixture.
//
// The stage-change instant is cached per record load. This asserts the cache
// does not outlive a move made on the same page: before the click, a record
// that never moved draws no overlay; after clicking the real Next Stage
// control, and with NO navigation or reload by the probe, the radar on the new
// stage draws its overlay as of the request's closed_at.
//
// Counterfactual for the wait: "a radar drawn for Solution Alignment" cannot
// be satisfied by the pre-click page, which has that tab's radar already. So
// the wait is on the svg's data-as-of, which the pre-click page cannot carry
// because the record had never moved.
import { readFileSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'

const puppeteer = await loadPuppeteer('deal-radar/probe-inpage-move.mjs')
const TAG = 'DRMOVE' + Date.now().toString(36).toUpperCase()
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) pass++; else fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`) }

const fx = await freshOpportunity(TAG)
await api('POST', `/opportunities/${fx.oppId}/assessment-reviewed`, {})
const b = await puppeteer.launch({ headless: 'new' })
let navigations = 0
try {
  const p = await b.newPage()
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) navigations++ })
  await p.setViewport({ width: 1440, height: 1100 })
  await p.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), fx.oppId)
  await p.waitForFunction((id) => currentOppDetailId === id && Array.isArray(oppLenses), { timeout: 30000 }, fx.oppId)
  const qKey = await p.evaluate(() => oppStageTabKey('Qualification'))
  const saKey = await p.evaluate(() => oppStageTabKey('Solution Alignment'))
  await p.evaluate((k) => document.querySelector(`#view-opportunity-detail [data-opp-tab="${k}"]`).click(), qKey)
  await p.waitForFunction((k) => !!document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar[data-stage="Qualification"]`), { timeout: 15000 }, qKey)
  const before = await p.evaluate((k) => document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar`).dataset.overlay, qKey)
  check(before === 'absent', `before the move: no overlay on a record that never moved (${before})`)
  await p.waitForFunction(() => { const x = document.getElementById('opp-next-stage-btn'); return x && !x.disabled }, { timeout: 15000 })
  const navBefore = navigations
  await p.click('#opp-next-stage-btn')
  const req = await (async () => {
    for (let i = 0; i < 40; i++) {
      const rows = must(await db.from('transition_requests').select('status, closed_at').eq('record_id', fx.oppId), 'requests')
      if (rows[0]?.closed_at) return rows[0]
      await new Promise((r) => setTimeout(r, 250))
    }
    return null
  })()
  check(!!req && req.status === 'approved', `the click moved the record (request ${req?.status}, closed_at ${req?.closed_at})`)
  const stamped = await p.waitForFunction((k) => document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar[data-stage="Solution Alignment"]`)?.dataset.asOf ?? null,
    { timeout: 20000 }, saKey).then((h) => h.jsonValue()).catch(() => null)
  check(!!stamped && !!req && Date.parse(stamped) === Date.parse(req.closed_at),
    `after the move, on the same page: the new stage's radar draws its overlay as of the move (${stamped})`)
  check(navigations === navBefore, `no navigation or reload happened in between (${navigations - navBefore})`)
} finally {
  await b.close()
  await tearDown(TAG)
  const left = must(await db.from('records').select('reference_code, record_type, deleted_at').in('id', [fx.oppId, fx.contactId]), 'teardown')
  for (const x of left) console.log(`teardown: ${x.record_type} ${x.reference_code ?? ''} deleted_at ${x.deleted_at}`)
  check(left.length === 2 && left.every((x) => !!x.deleted_at), 'the fixture is soft-deleted')
}
console.log(`${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
