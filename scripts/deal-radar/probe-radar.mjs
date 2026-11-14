// DEAL RADAR Phase 3: the radar's proofs a to d and f, read from the DOM.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/deal-radar/probe-radar.mjs <outfile> <opportunity id>...
//
// UNWIRED, deliberately: a round proof run by hand against named records, the
// shape scripts/deal-dynamics/probe-rollups.mjs set. It is not a standing check,
// because its population is a list of live records chosen for what they carry.
//
// WHAT IT ASSERTS, per record, per assessed stage tab, ALL FROM THE PAGE'S DOM:
//   a  each "now" vertex sits at met/total of the ring radius along its own
//      axis, met and total read from the row beside it (0.5px on screen)
//   b  an axis is dashed in --attention iff fewer than half its criteria at the
//      stage carry an entry, counted HERE from the page's payload rather than
//      by the function that drew it; the label follows its axis
//   c  the overlay is present iff the record has changed stage, its stamp is
//      the latest of the two sources as computed HERE from the database, and
//      its vertices are lensRollupAt at that instant
//   d  axes in lens sort_order (read from the database), labels COM ORG TEC LEG DD
//   R-RAD5 exactly one radar per stage block, drawn for that block's stage
//   R-RAD8 legend keys match what is drawn; R-RAD10 the label says the figures
//   f  no non-GET request reaches /api while the probe drives the page
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadPuppeteer } from '../lib/puppeteer.mjs'

const [outFile, ...ids] = process.argv.slice(2)
if (!outFile || !ids.length) { console.error('usage: probe-radar.mjs <outfile> <opportunity id>...'); process.exit(2) }
const puppeteer = await loadPuppeteer('deal-radar/probe-radar.mjs')
const BASE = 'http://127.0.0.1:3000'
const STAGES = ['Qualification', 'Solution Alignment', 'Proposal', 'Evaluation', 'Negotiating']
const LABELS = ['COM', 'ORG', 'TEC', 'LEG', 'DD'] // the brief's literal, proof d
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))

let pass = 0, fail = 0
const lines = []
const say = (l) => { lines.push(l); console.log(l) }
const check = (ok, what) => { if (ok) pass++; else fail++; say(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`) }

const lenses = must(await db.from('scoring_lenses').select('id, name, sort_order').order('sort_order'), 'lenses')

// The ORACLE for R-RAD4's source, written from the ruling rather than imported.
async function expectedStageChange(id) {
  const audit = must(await db.from('audit_log').select('timestamp').eq('record_id', id).eq('action', 'transition'), 'audit')
  const reqs = must(await db.from('transition_requests').select('closed_at').eq('record_id', id)
    .eq('kind', 'transition').eq('status', 'approved'), 'requests')
  const all = [...audit.map((a) => a.timestamp), ...reqs.map((r) => r.closed_at)].filter(Boolean)
  all.sort((x, y) => Date.parse(y) - Date.parse(x))
  return { at: all[0] ?? null, audit: audit.length, requests: reqs.length }
}

const browser = await puppeteer.launch({ headless: 'new' })
const writes = []
const out = { at: new Date().toISOString(), records: {} }
let dashedSeen = 0, solidSeen = 0
try {
  for (const id of ids) {
    const sc = await expectedStageChange(id)
    say(`\n== ${id}  stage change: ${sc.at ?? 'none'} (audit ${sc.audit}, approved requests ${sc.requests})`)
    const p = await browser.newPage()
    p.on('request', (rq) => { if (rq.method() !== 'GET' && rq.url().includes('/api/')) writes.push(`${rq.method()} ${rq.url()}`) })
    p.on('pageerror', (e) => { fail++; say(`  FAIL page error: ${e.message}`) })
    await p.setViewport({ width: 1440, height: 1100 })
    await p.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
    await p.evaluate((rid) => navigate('opportunity-detail', rid), id)
    await p.waitForFunction((rid) => currentOppDetailId === rid && Array.isArray(oppCriteria) && Array.isArray(oppLenses),
      { timeout: 30000 }, id)
    out.records[id] = { stageChange: sc, stages: {} }
    for (const stage of STAGES) {
      const key = await p.evaluate((s) => oppStageTabKey(s), stage)
      const hasTab = await p.evaluate((k) => !!document.querySelector(`#view-opportunity-detail [data-opp-tab="${k}"]`), key)
      if (!hasTab) { say(`  -- ${stage}: no tab`); continue }
      await p.evaluate((k) => document.querySelector(`#view-opportunity-detail [data-opp-tab="${k}"]`).click(), key)
      // THIS stage's radar: the svg names the stage it was drawn for, so no
      // other tab's panel can satisfy the wait.
      const ready = await p.waitForFunction((k, s) => !!document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar[data-stage="${s}"]`)
        && document.querySelectorAll(`#opp-stage-criteria-${k} .opp-lens-rollup`).length === oppLenses.length,
      { timeout: 15000 }, key, stage).then(() => true).catch(() => false)
      check(ready, `${stage}: a radar drawn for this stage, beside ${lenses.length} rows`)
      if (!ready) continue

      const m = await p.evaluate((k, s, asOf) => {
        const blk = document.querySelector(`#opp-stage-criteria-${k} .opp-lens-rollups`)
        const svgs = blk.querySelectorAll('svg.opp-radar')
        const svg = svgs[0]
        const vb = svg.viewBox.baseVal
        const scale = svg.getBoundingClientRect().width / vb.width
        const pts = (el) => el ? el.getAttribute('points').trim().split(/\s+/).map((q) => q.split(',').map(Number)) : null
        const spokes = [...svg.querySelectorAll('line.opp-radar-spoke')].map((l) => {
          const cs = getComputedStyle(l)
          return { lens: l.dataset.lens, x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'), x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2'),
            dash: cs.strokeDasharray, stroke: cs.stroke }
        })
        const labels = [...svg.querySelectorAll('text.opp-radar-label')].map((t) => ({ text: t.textContent, x: +t.getAttribute('x'), y: +t.getAttribute('y'), fill: getComputedStyle(t).fill }))
        const rows = [...blk.querySelectorAll('.opp-lens-rollup')].map((r) => ({ lens: r.dataset.lens, met: +r.dataset.met, total: +r.dataset.total }))
        // The page's own colour for the token, resolved the way the stroke is.
        const probe = document.createElement('span'); probe.style.color = 'var(--attention)'; blk.appendChild(probe)
        const attention = getComputedStyle(probe).color; probe.remove()
        // Coverage, counted HERE from the payload: criteria in the lens at this
        // stage carrying ANY entry. Not lensRollupAt, which drew the axis.
        const scored = oppLenses.map((l) => {
          const mine = oppCriteria.filter((c) => c.lens_id === l.id && (c.stages ?? []).some((x) => x.stage === s))
          const n = mine.filter((c) => Array.isArray(currentOppPayload?.[c.criterion_key]) && currentOppPayload[c.criterion_key].length > 0).length
          return { scored: n, total: mine.length }
        })
        const thenExpected = asOf ? oppLenses.map((l) => window.tmsLensRollupAt(l.id, oppCriteria, currentOppPayload, s, asOf)) : null
        return {
          svgCount: svgs.length, stage: svg.dataset.stage, overlay: svg.dataset.overlay, asOf: svg.dataset.asOf ?? null,
          role: svg.getAttribute('role'), aria: svg.getAttribute('aria-label'), scale,
          now: pts(svg.querySelector('polygon.opp-radar-now')), then: pts(svg.querySelector('polygon.opp-radar-then')),
          thenCount: svg.querySelectorAll('polygon.opp-radar-then').length,
          spokes, labels, rows, attention, scored, thenExpected,
          keys: [...blk.querySelectorAll('.opp-radar-key')].map((x) => x.textContent.trim()),
          px: { w: Math.round(svg.getBoundingClientRect().width), h: Math.round(svg.getBoundingClientRect().height) },
        }
      }, key, stage, sc.at)
      out.records[id].stages[stage] = m
      const n = lenses.length
      const cx = m.spokes[0]?.x1, cy = m.spokes[0]?.y1
      const r = Math.hypot(m.spokes[0].x2 - cx, m.spokes[0].y2 - cy)
      const tol = 0.5 / m.scale // 0.5 screen px, in viewBox units

      // R-RAD5
      check(m.svgCount === 1 && m.stage === stage, `R-RAD5 exactly one radar in this block, drawn for ${stage} (${m.svgCount}, "${m.stage}")`)
      // d: order and labels
      check(m.spokes.length === n && m.spokes.every((sp, i) => sp.lens === lenses[i].name),
        `d axes in lens sort_order: ${m.spokes.map((sp) => sp.lens).join(', ')}`)
      check(JSON.stringify(m.labels.map((l) => l.text)) === JSON.stringify(LABELS), `d labels ${m.labels.map((l) => l.text).join(' ')}`)
      const onAxis = (x, y, i) => { // the point lies along spoke i, outward
        const sp = m.spokes[i], ax = sp.x2 - cx, ay = sp.y2 - cy, px = x - cx, py = y - cy
        return Math.abs(ax * py - ay * px) / Math.hypot(ax, ay) <= tol * 4 && (ax * px + ay * py) >= -tol
      }
      check(m.labels.every((l, i) => Math.abs(Math.atan2(l.x - cx, cy - l.y) - Math.atan2(m.spokes[i].x2 - cx, cy - m.spokes[i].y2)) < 0.35),
        'd each label sits off the end of its own axis')
      check(Math.abs(Math.atan2(m.spokes[0].x2 - cx, cy - m.spokes[0].y2)) < 1e-6 && (m.spokes[1].x2 > cx),
        'd the first axis points straight up and the second is to its right (clockwise)')
      // a: vertices from the rows beside them
      const aErr = m.rows.map((row, i) => {
        const want = row.total ? row.met / row.total : 0
        const [x, y] = m.now[i]
        const got = Math.hypot(x - cx, y - cy) / r
        return { lens: row.lens, want, got, errPx: Math.abs(got - want) * r * m.scale, on: want === 0 || onAxis(x, y, i) }
      })
      check(m.rows.every((row, i) => row.lens === lenses[i].name), 'a the rows and the axes name the same lenses in the same order')
      check(aErr.every((e) => e.errPx <= 0.5 && e.on),
        `a now: distance / radius = met / total on every axis (worst ${Math.max(...aErr.map((e) => e.errPx)).toFixed(3)}px)`
        + (aErr.some((e) => e.errPx > 0.5 || !e.on) ? ` ${JSON.stringify(aErr)}` : ''))
      // b: coverage
      const bad = m.spokes.map((sp, i) => {
        const c = m.scored[i]
        const low = c.total > 0 && c.scored / c.total < 0.5
        const dashed = sp.dash !== 'none' && sp.dash !== ''
        const amber = sp.stroke === m.attention
        const labelAmber = m.labels[i].fill === m.attention
        if (low) dashedSeen++; else solidSeen++
        return { lens: sp.lens, c, low, dashed, amber, labelAmber, ok: low === dashed && low === amber && low === labelAmber }
      })
      check(bad.every((x) => x.ok), `b dashed and amber iff scored/total < 0.5: `
        + bad.map((x) => `${x.lens.split(' ').map((w) => w[0]).join('')} ${x.c.scored}/${x.c.total}${x.low ? ' DASHED' : ''}`).join(', ')
        + (bad.some((x) => !x.ok) ? ` ${JSON.stringify(bad.filter((x) => !x.ok))}` : ''))
      // c: overlay
      if (sc.at) {
        check(m.thenCount === 1 && m.overlay === 'present', `c overlay present (${m.thenCount}, ${m.overlay})`)
        check(!!m.asOf && Date.parse(m.asOf) === Date.parse(sc.at), `c its stamp is the database's latest stage change (${m.asOf} vs ${sc.at})`)
        if (m.then && m.thenExpected) {
          const cErr = m.thenExpected.map((e, i) => {
            const want = e.total ? e.met / e.total : 0
            const [x, y] = m.then[i]
            return Math.abs(Math.hypot(x - cx, y - cy) / r - want) * r * m.scale
          })
          check(cErr.every((e) => e <= 0.5), `c last-stage vertices = lensRollupAt at that instant (worst ${Math.max(...cErr).toFixed(3)}px; `
            + `${m.thenExpected.map((e) => `${e.met}/${e.total}`).join(' ')})`)
          const nowDiff = m.now.map(([x, y], i) => Math.hypot(x - m.then[i][0], y - m.then[i][1]) * m.scale > 0.5).filter(Boolean).length
          out.records[id].stages[stage].axesDiffering = nowDiff
          say(`       now and last stage differ on ${nowDiff} of ${n} axes`)
        }
        check(m.keys.includes('Last stage'), 'R-RAD8 the Last stage key is shown with the overlay')
        check(m.aria.includes('At the last stage change:'), 'R-RAD10 the label states the last-stage figures')
      } else {
        check(m.thenCount === 0 && m.overlay === 'absent', `c no overlay on a record that never changed stage (${m.thenCount}, ${m.overlay})`)
        check(!m.keys.includes('Last stage'), 'R-RAD8 and no Last stage key')
      }
      // R-RAD8 remaining keys
      check(m.keys.includes('Now'), 'R-RAD8 the Now key is shown')
      check(m.keys.includes('Under half scored') === bad.some((x) => x.low), `R-RAD8 Under half scored shown iff a dashed axis is (${bad.some((x) => x.low)})`)
      // R-RAD10
      const named = m.rows.every((row) => m.aria.includes(row.total ? `${row.lens} ${row.met} of ${row.total}` : `${row.lens} none at this stage`))
      const lowNames = bad.filter((x) => x.low).map((x) => x.lens)
      check(m.role === 'img' && named && (lowNames.length ? m.aria.includes(`Fewer than half scored: ${lowNames.join(', ')}.`) : !m.aria.includes('Fewer than half')),
        'R-RAD10 role img; the label states each lens\'s met of total and names the low-coverage lenses')
      check(m.px.w === 280 && m.px.h === 210, `mockup size 280 x 210 (${m.px.w} x ${m.px.h})`)
    }
    await p.close()
  }
} finally { await browser.close() }
check(dashedSeen > 0 && solidSeen > 0, `b both cases seen on real data: ${dashedSeen} dashed axes, ${solidSeen} solid`)
check(writes.length === 0, `f no non-GET request reached /api (${writes.length})${writes.length ? ' ' + writes.join(', ') : ''}`)
writeFileSync(outFile, JSON.stringify({ ...out, lines, pass, fail }, null, 2))
say(`\n${pass} of ${pass + fail} checks passed; written ${outFile}`)
process.exit(fail ? 1 : 0)
