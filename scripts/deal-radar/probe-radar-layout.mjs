// DEAL RADAR Phase 3, proof e: the radar in the Exit criteria card at 1240,
// 1440 and 1920, measured, then photographed.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/deal-radar/probe-radar-layout.mjs <outdir> <id>:<stage>...
//
// UNWIRED, deliberately: a round proof. The standing layout checks for this
// card are the stage-tab pass in scripts/adjacency/probe-gaps.mjs.
//
// MEASURE FIRST, CAPTURE SECOND, and a PAGE capture, never an element capture
// of the thing whose geometry is the claim (CLAUDE.md Verification 4).
// The claims, each a relationship rather than a CSS property:
//   - the radar is 280 x 210 (the mockup of record), centred in its block, and
//     inside it; the legend and every row fit their boxes
//   - the order is heading, radar, legend, rows (Option A of record)
//   - the axis labels render at or above the 11px floor
//   - the legend keys share ONE row
//   - no ink overprints anywhere in the card, and no grid or flex child is
//     narrower than its content (scripts/lib/ink-overlap.mjs)
import { readFileSync, writeFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { inkOverlaps, shrunkBelowContent } from '../lib/ink-overlap.mjs'

const [OUT, ...targets] = process.argv.slice(2)
if (!OUT || !targets.length) { console.error('usage: probe-radar-layout.mjs <outdir> <id>:<stage>...'); process.exit(2) }
const puppeteer = await loadPuppeteer('deal-radar/probe-radar-layout.mjs')
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))
let pass = 0, fail = 0
const lines = []
const say = (l) => { lines.push(l); console.log(l) }
const check = (ok, what) => { if (ok) pass++; else fail++; say(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`) }
const writes = []
const rows = []
const b = await puppeteer.launch({ headless: 'new' })
try {
  for (const t of targets) {
    const [id, stage] = t.split(':')
    for (const W of [1240, 1440, 1920]) {
      const p = await b.newPage()
      p.on('request', (rq) => { if (rq.method() !== 'GET' && rq.url().includes('/api/')) writes.push(rq.url()) })
      await p.setViewport({ width: W, height: 1100 })
      await p.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
      await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
      await p.evaluate((rid) => navigate('opportunity-detail', rid), id)
      await p.waitForFunction((rid) => currentOppDetailId === rid && Array.isArray(oppLenses), { timeout: 30000 }, id)
      const key = await p.evaluate((s) => oppStageTabKey(s), stage)
      await p.evaluate((k) => document.querySelector(`#view-opportunity-detail [data-opp-tab="${k}"]`).click(), key)
      await p.waitForFunction((k, s) => !!document.querySelector(`#opp-stage-criteria-${k} svg.opp-radar[data-stage="${s}"]`), { timeout: 15000 }, key, stage)
      await p.evaluate(() => document.fonts?.ready ?? Promise.resolve())
      const root = `#opp-stage-criteria-${key}`
      const m = await p.evaluate((k) => {
        const card = document.getElementById(`opp-stage-criteria-${k}`)
        const blk = card.querySelector('.opp-lens-rollups')
        const svg = blk.querySelector('svg.opp-radar'), leg = blk.querySelector('.opp-radar-legend')
        const bx = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height } }
        const B = bx(blk), Sv = bx(svg), L = bx(leg), C = bx(card.closest('.pg-card') ?? card)
        const head = bx(blk.querySelector('.opp-lens-rollups-h'))
        const firstRow = bx(blk.querySelector('.opp-lens-rollup'))
        const labels = [...svg.querySelectorAll('text.opp-radar-label')].map((x) => x.getBoundingClientRect().height)
        const fontPx = parseFloat(getComputedStyle(svg.querySelector('text.opp-radar-label')).fontSize) * (Sv.w / svg.viewBox.baseVal.width)
        const keys = [...leg.querySelectorAll('.opp-radar-key')].map((x) => Math.round(x.getBoundingClientRect().top))
        return { card: C, block: B, svg: Sv, legend: L, head, firstRow, labels, fontPx, keys,
          blockFits: blk.scrollWidth <= blk.clientWidth + 1, legendFits: leg.scrollWidth <= leg.clientWidth + 1,
          cardFits: card.scrollWidth <= card.clientWidth + 1 }
      }, key)
      const ink = await p.evaluate(inkOverlaps, root)
      const shrunk = await p.evaluate(shrunkBelowContent, root)
      const tag = `${id.slice(0, 8)} ${stage} ${W}`
      say(`\n== ${tag}: card ${Math.round(m.card.w)} x ${Math.round(m.card.h)}, block ${Math.round(m.block.w)}, svg ${Math.round(m.svg.w)} x ${Math.round(m.svg.h)}`)
      check(Math.round(m.svg.w) === 280 && Math.round(m.svg.h) === 210, 'the radar is the mockup\'s 280 x 210')
      check(m.svg.l >= m.block.l - 0.5 && m.svg.r <= m.block.r + 0.5, `the radar sits inside its block (${Math.round(m.svg.l - m.block.l)}px and ${Math.round(m.block.r - m.svg.r)}px either side)`)
      check(Math.abs((m.svg.l - m.block.l) - (m.block.r - m.svg.r)) <= 1, 'and is centred in it')
      check(m.head.b <= m.svg.t && m.svg.b <= m.legend.t && m.legend.b <= m.firstRow.t, 'Option A order: heading, radar, legend, rows')
      check(m.blockFits && m.legendFits && m.cardFits, 'the card, the block and the legend fit their boxes')
      check(m.fontPx >= 11, `axis labels render at ${m.fontPx.toFixed(2)}px, at or above the 11px floor`)
      check(new Set(m.keys).size === 1, `the legend's ${m.keys.length} keys share one row`)
      check(!ink.missing && ink.atoms > 0 && ink.hits.length === 0, `no ink overprints in the card (${ink.atoms} atoms)${ink.hits.length ? ': ' + ink.hits.join('; ') : ''}`)
      check(!shrunk.missing && shrunk.hits.length === 0, `no grid or flex child narrower than its content (${shrunk.items} items)${shrunk.hits.length ? ': ' + shrunk.hits.join('; ') : ''}`)
      rows.push({ tag, cardW: Math.round(m.card.w), cardH: Math.round(m.card.h), radarAndLegendH: Math.round(m.legend.b - m.svg.t) })
      // capture LAST
      await p.evaluate((k) => document.querySelector(`#opp-stage-criteria-${k} .opp-lens-rollups`).scrollIntoView({ block: 'center' }), key)
      await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
      await p.screenshot({ path: `${OUT}/dr-p3-${id.slice(0, 8)}-${stage.replace(/\s+/g, '-').toLowerCase()}-${W}.png` })
      await p.close()
    }
  }
  // The mockup of record, photographed beside the live captures.
  const mp = await b.newPage()
  await mp.setViewport({ width: 1000, height: 520 })
  await mp.goto(`file://${process.cwd()}/prototypes/deal-radar-option-b.html`, { waitUntil: 'load' })
  await mp.screenshot({ path: `${OUT}/dr-p3-mockup-of-record.png` })
} finally { await b.close() }
for (const r of rows) say(`  ${r.tag}: card ${r.cardW} wide, ${r.cardH} tall; radar and legend take ${r.radarAndLegendH}px`)
check(writes.length === 0, `no non-GET request reached /api (${writes.length})`)
writeFileSync(`${OUT}/dr-p3-layout.json`, JSON.stringify({ rows, lines, pass, fail }, null, 2))
say(`${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
