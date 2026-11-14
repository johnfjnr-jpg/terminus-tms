// DEAL RADAR Phase 3, addition B: a NON-DEGENERATE overlay, built the way the
// system builds one.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/deal-radar/probe-overlay-fixture.mjs <outdir>
//
// UNWIRED, deliberately: a round proof. It creates a fixture, so it is run by
// hand and tears its fixture down at the end.
//
// THE SEQUENCE, every write through a real route as john+test:
//   1. freshOpportunity: a contact, qualified, converted through the API
//   2. scores on four lenses at Qualification, through the Assessment tab's
//      click path (pick a level, Record)
//   3. the Qualification exit criterion through its route, then the move to
//      Solution Alignment through POST /records/:id/transition-requests, the
//      route the Next Stage control calls. Qualification needs no approval
//      track, so the request closes approved and the record moves.
//   4. further scores after the move, through the same click path
//   5. the radar on the Solution Alignment and Qualification tabs, read from
//      the DOM and compared with a HAND expectation derived from steps 2 and 4,
//      and with lensRollupAt at the transition instant
// Nothing writes records.status or audit_log directly.
import { readFileSync, writeFileSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'

const OUT = process.argv[2]
if (!OUT) { console.error('usage: probe-overlay-fixture.mjs <outdir>'); process.exit(2) }
const puppeteer = await loadPuppeteer('deal-radar/probe-overlay-fixture.mjs')
const TAG = 'DRADAR' + Date.now().toString(36).toUpperCase()
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))
let pass = 0, fail = 0
const lines = []
const say = (l) => { lines.push(l); console.log(l) }
const check = (ok, what) => { if (ok) pass++; else fail++; say(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`) }

// What is scored, and what each choice MEANS, written before the run. Levels
// are the live scales: 4 and 5 satisfy on the five-level evidence scale, 3
// does not; 1 (Not applicable) satisfies on the three-level legal scale.
const BEFORE = [
  ['Commercial', 'assessCommBudgetConfirmed', 4],
  ['Organisational', 'assessOrgEconomicBuyer', 4],
  ['Organisational', 'assessOrgChampion', 3],
  ['Organisational', 'assessOrgPrioritisation', 5],
  ['Technical', 'assessTechNeedDefinition', 4],
  ['Legal', 'assessLegalProcurementRoute', 1],
]
const AFTER = [
  ['Commercial', 'assessCommMetricsValue', 4],
  ['Commercial', 'assessCommFundingMechanism', 5],
  ['Organisational', 'assessOrgChampion', 4, 'Revised after the stage change: the champion is now confirmed.'],
  ['Technical', 'assessTechSolutionFit', 4],
]
// The hand expectation, met of total, lens sort_order. Totals are the live
// criteria counts per stage (Qualification 1 4 1 1 4, Solution Alignment
// 7 8 7 7 4).
const EXPECT = {
  'Solution Alignment': { then: [[1, 7], [2, 8], [1, 7], [1, 7], [0, 4]], now: [[3, 7], [3, 8], [2, 7], [1, 7], [0, 4]] },
  Qualification: { then: [[1, 1], [2, 4], [1, 1], [1, 1], [0, 4]], now: [[1, 1], [3, 4], [1, 1], [1, 1], [0, 4]] },
}

const fx = await freshOpportunity(TAG)
const rec0 = must(await db.from('records').select('id, owner_id, status, reference_code').eq('id', fx.oppId).single(), 'record')
check(rec0.owner_id === S.user.id && rec0.status === 'Qualification',
  `fixture ${TAG}: ${rec0.reference_code} at ${rec0.status}, owned by the session user (${rec0.owner_id === S.user.id})`)

const browser = await puppeteer.launch({ headless: 'new' })
const writes = []
let p
const open = async (width = 1440) => {
  if (p) await p.close()
  p = await browser.newPage()
  p.on('response', (r) => { const q = r.request(); if (q.method() !== 'GET' && q.url().includes('/api/')) writes.push(`${q.method()} ${q.url().replace(/^.*\/api/, '')} ${r.status()}`) })
  p.on('pageerror', (e) => { fail++; say(`  FAIL page error: ${e.message}`) })
  await p.setViewport({ width, height: 1100 })
  await p.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), fx.oppId)
  await p.waitForFunction((id) => currentOppDetailId === id && Array.isArray(oppCriteria) && Array.isArray(oppLenses), { timeout: 30000 }, fx.oppId)
}
// One lens at a time: open its pane, pick, give a reason where one is set, Record.
const score = async (list) => {
  for (const [lens, key, value, reason] of list) {
    await p.evaluate(() => document.querySelector('#view-opportunity-detail [data-opp-tab="assessment"]').click())
    const paneKey = await p.evaluate((n) => oppLensKey(n), lens)
    await p.evaluate((k) => document.querySelector(`#opp-assessment-mount-strip .sub-tab[data-sub-tab="${k}"]`).click(), paneKey)
    await p.waitForFunction((k, c, v) => !document.getElementById(`opp-assessment-mount-pane-${k}`).classList.contains('hidden')
      && !!document.querySelector(`label[for="opp-assess-lv-${c}-${v}"]`), { timeout: 10000 }, paneKey, key, value)
    const n0 = writes.length
    await p.click(`label[for="opp-assess-lv-${key}-${value}"]`)
    await p.waitForFunction((k) => oppAssessDraft[k] !== undefined, { timeout: 5000 }, key)
    if (reason) {
      await p.click(`#opp-assess-reason-${key}`, { clickCount: 3 })
      await p.keyboard.press('Backspace')
      await p.keyboard.type(reason)
    }
    await p.click('#opp-assess-savebar-record')
    const fb = await p.waitForFunction(() => /^Saved \d+ of \d+/.test(document.getElementById('opp-assess-savebar-feedback')?.textContent ?? '')
      && document.getElementById('opp-assess-savebar-feedback').textContent, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null)
    const sent = writes.slice(n0)
    check(!!fb && sent.length === 1 && / 201$/.test(sent[0]), `scored ${lens} ${key} = ${value} by click: "${fb}" (${sent.join(', ')})`)
  }
}
const series = async () => {
  const r = must(await db.from('record_revisions').select('payload').eq('record_id', fx.oppId)
    .order('revision_number', { ascending: false }).limit(1).single(), 'revision')
  return r.payload
}

let closedAt = null
try {
  // ── 2. before the move
  await open()
  await score(BEFORE)
  const pre = await series()
  check(BEFORE.every(([, k, v]) => (pre[k] ?? []).at(-1)?.value === v), 'every pre-move score is in the record, as its latest entry')

  // ── 3. the move, through the routes the screen calls
  await api('POST', `/opportunities/${fx.oppId}/assessment-reviewed`, {})
  const raised = (await api('POST', `/records/${fx.oppId}/transition-requests`, { to_stage: 'Solution Alignment', kind: 'transition' })).data
  const recMoved = must(await db.from('records').select('status').eq('id', fx.oppId).single(), 'record')
  const reqRows = must(await db.from('transition_requests').select('id, kind, status, closed_at, from_stage, to_stage').eq('record_id', fx.oppId), 'requests')
  const auditT = must(await db.from('audit_log').select('id').eq('record_id', fx.oppId).eq('action', 'transition'), 'audit')
  closedAt = reqRows[0]?.closed_at ?? null
  check(raised.status === 'approved' && recMoved.status === 'Solution Alignment' && reqRows.length === 1 && !!closedAt,
    `moved by the transition-requests route: request ${raised.status}, record now ${recMoved.status}, closed_at ${closedAt}; audit transition rows ${auditT.length}`)
  const lastPre = Math.max(...BEFORE.map(([, k]) => Date.parse((pre[k] ?? []).at(-1)?.at)))
  check(lastPre < Date.parse(closedAt), `every pre-move entry predates the move (${new Date(lastPre).toISOString()} < ${closedAt})`)

  // ── 4. after the move: a fresh page, so the radar reads the moved record
  await open()
  await score(AFTER)
  const post = await series()
  check(AFTER.every(([, k, v]) => (post[k] ?? []).at(-1)?.value === v && Date.parse((post[k] ?? []).at(-1)?.at) > Date.parse(closedAt)),
    'every post-move score is in the record, after the move')

  // ── 5. the radar, on a fresh page
  for (const width of [1440]) {
    await open(width)
    for (const stage of ['Solution Alignment', 'Qualification']) {
      const key = await p.evaluate((s) => oppStageTabKey(s), stage)
      await p.evaluate((k) => document.querySelector(`#view-opportunity-detail [data-opp-tab="${k}"]`).click(), key)
      await p.waitForFunction((k, s) => !!document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar[data-stage="${s}"]`), { timeout: 15000 }, key, stage)
      const m = await p.evaluate((k, s) => {
        const svg = document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar`)
        const blk = svg.closest('.opp-lens-rollups')
        const pts = (el) => el ? el.getAttribute('points').trim().split(/\s+/).map((q) => q.split(',').map(Number)) : null
        const sp = [...svg.querySelectorAll('line.opp-radar-spoke')].map((l) => [+l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')])
        const asOf = svg.dataset.asOf ?? null
        return { asOf, overlay: svg.dataset.overlay, sp, now: pts(svg.querySelector('polygon.opp-radar-now')), then: pts(svg.querySelector('polygon.opp-radar-then')),
          scale: svg.getBoundingClientRect().width / svg.viewBox.baseVal.width,
          rows: [...blk.querySelectorAll('.opp-lens-rollup')].map((r) => [+r.dataset.met, +r.dataset.total]),
          lib: asOf ? oppLenses.map((l) => window.tmsLensRollupAt(l.id, oppCriteria, currentOppPayload, s, asOf)) : null,
          keys: [...blk.querySelectorAll('.opp-radar-key')].map((x) => x.textContent.trim()), aria: svg.getAttribute('aria-label') }
      }, key, stage)
      const [cx, cy] = m.sp[0]
      const r = Math.hypot(m.sp[0][2] - cx, m.sp[0][3] - cy)
      const frac = (q) => Math.hypot(q[0] - cx, q[1] - cy) / r
      const px = (a, b) => Math.abs(a - b) * r * m.scale
      const want = EXPECT[stage]
      say(`\n${width} ${stage}: overlay ${m.overlay}, as of ${m.asOf}`)
      check(m.overlay === 'present' && Date.parse(m.asOf) === Date.parse(closedAt), `the overlay is drawn as of the transition instant (${m.asOf} vs ${closedAt})`)
      check(JSON.stringify(m.rows) === JSON.stringify(want.now), `the rows read the hand expectation for now: ${m.rows.map((x) => x.join('/')).join(' ')}`)
      const nowErr = want.now.map(([a, t], i) => px(frac(m.now[i]), a / t))
      check(nowErr.every((e) => e <= 0.5), `now vertices = the hand expectation (worst ${Math.max(...nowErr).toFixed(3)}px)`)
      const thenHand = want.then.map(([a, t], i) => px(frac(m.then[i]), a / t))
      check(thenHand.every((e) => e <= 0.5), `last-stage vertices = the HAND expectation ${want.then.map((x) => x.join('/')).join(' ')} (worst ${Math.max(...thenHand).toFixed(3)}px)`)
      const thenLib = m.lib.map((e, i) => px(frac(m.then[i]), e.total ? e.met / e.total : 0))
      check(thenLib.every((e) => e <= 0.5), `last-stage vertices = lensRollupAt at the transition instant ${m.lib.map((e) => `${e.met}/${e.total}`).join(' ')} (worst ${Math.max(...thenLib).toFixed(3)}px)`)
      const differ = m.now.map((q, i) => Math.hypot(q[0] - m.then[i][0], q[1] - m.then[i][1]) * m.scale > 0.5)
      const nd = differ.filter(Boolean).length
      if (stage === 'Solution Alignment') check(nd >= 2, `the overlay differs from the solid shape on at least two axes (${nd}: ${differ.map((d, i) => d ? ['COM', 'ORG', 'TEC', 'LEG', 'DD'][i] : null).filter(Boolean).join(' ')})`)
      else say(`  (Qualification differs on ${nd} axis, ORG only, as expected)`)
      check(m.then.some((q) => frac(q) * r * m.scale > 0.5), 'NON-DEGENERATE: at least one last-stage vertex is off the centre')
      check(m.keys.includes('Last stage') && m.aria.includes('At the last stage change:'), 'the Last stage key and the label\'s last-stage figures are shown')
      if (stage === 'Solution Alignment') {
        await p.evaluate((k) => document.querySelector(`#opp-stage-criteria-${k} .opp-lens-rollups`).scrollIntoView({ block: 'center' }), key)
        await p.evaluate(() => new Promise((res) => setTimeout(res, 300)))
        await p.screenshot({ path: `${OUT}/dr-p3-B-${width}-solution-alignment.png` })
      }
    }
  }
} finally {
  await browser.close()
  // ── teardown, and the list of what it soft-deleted
  await tearDown(TAG)
  const left = must(await db.from('records').select('id, record_type, reference_code, deleted_at').in('id', [fx.oppId, fx.contactId]), 'teardown')
  for (const x of left) say(`teardown: ${x.record_type} ${x.reference_code} ${x.id} deleted_at ${x.deleted_at}`)
  check(left.length === 2 && left.every((x) => !!x.deleted_at), 'the fixture opportunity and its contact are soft-deleted')
}
writeFileSync(`${OUT}/dr-p3-B.json`, JSON.stringify({ TAG, oppId: fx.oppId, contactId: fx.contactId, closedAt, lines, writes, pass, fail }, null, 2))
say(`\nwrites made: ${writes.length} (${writes.map((w) => w.split(' ').slice(0, 2).join(' ')).join('; ')})`)
say(`${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
