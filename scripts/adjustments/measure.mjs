// ── THE ADJUSTMENTS ROUND'S MEASUREMENT PROBE ────────────────────────────
//
// Phase 0 read the stylesheet. A stylesheet is not a rendered box, so every
// number this round acts on is taken here instead.
//
// It answers four questions and nothing else:
//   P1  do the two heads share one subgrid track, and where is the border
//       painted relative to the head's own text?
//   P2  what are the Installation head band's and the milestone grid's real
//       tracks, and where does the `%` header sit against its input?
//   P4  what does an autofilled input compute to, and can this probe reach
//       the pseudo-class at all?
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('adjustments/measure.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/adjustments/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'adjmeas'
const lines = []
const say = (s) => { lines.push(s); console.log(s) }

const { oppId } = await freshOpportunity(TAG)
const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, whtPct: 15, gstPct: 8, fxContingency: 3,
  lumpSumCost: 250000,
  factoring: { enabled: true, ratePct: 2, termMonths: 36, method: 'straight' },
  milestones: [{ month: 1, label: 'Contract start', pct: 40 }],
  contractorMilestones: [{ month: 1, label: 'Contract start', pct: 50 }],
  installResp: 'Terminus Contractor - Lump Sum',
  paymentMode: 'capex', structure: 'twoPhase',
}
await api('PATCH', `/opportunities/${oppId}`, { payload: base })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.setViewport({ width: 1920, height: 2100 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
  await p.waitForFunction(() => {
    const el = document.getElementById('view-opportunity-detail')
    return !!el && !el.classList.contains('hidden')
  }, { timeout: 40000 })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1400)))
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
      .find((x) => x.textContent.trim() === 'Commercials')
    el?.click()
  })
  await p.waitForFunction(() => {
    const el = document.querySelector('#deal-ssExisting')
    return !!el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  }, { timeout: 30000 })
  await p.evaluate(() => document.fonts?.ready ?? Promise.resolve())
  await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))

  // ── P1: THE HEAD BAND ──────────────────────────────────────────────────
  say('\n── P1: the head band, and whether the pin is still load bearing ──')
  const p1 = await p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const heads = [...document.querySelectorAll('.units-row .ig-head')].filter(vis)
    const textRect = (e) => {
      const r = document.createRange(); r.selectNodeContents(e)
      const b = r.getBoundingClientRect()
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }
    }
    return {
      parentRows: getComputedStyle(document.querySelector('.units-row')).gridTemplateRows,
      cardRows: [...document.querySelectorAll('.units-row > .panel-card')]
        .map((c) => getComputedStyle(c).gridTemplateRows),
      heads: heads.map((h) => {
        const cs = getComputedStyle(h)
        const b = h.getBoundingClientRect()
        const t = textRect(h)
        return {
          text: (h.textContent ?? '').trim().slice(0, 28),
          panel: h.closest('.panel-card')?.id ?? '?',
          boxTop: Math.round(b.top), boxBottom: Math.round(b.bottom),
          boxH: Math.round(b.height),
          cssHeight: cs.height, gridRow: cs.gridRowStart,
          borderBottom: cs.borderBottomWidth,
          textTop: t.top, textBottom: t.bottom, textH: t.h,
          // THE DEFECT, STATED AS A RELATION: the rule is painted at the box's
          // bottom edge, so a text bottom BELOW it is a strike-through.
          textBelowRuleBy: Math.round(t.bottom - b.bottom),
        }
      }),
    }
  })
  say(`  .units-row rows      ${p1.parentRows}`)
  p1.cardRows.forEach((r, i) => say(`  card ${i} rows         ${r}`))
  for (const h of p1.heads) {
    say(`  ${h.panel.padEnd(20)} "${h.text}"`)
    say(`      box ${h.boxTop}..${h.boxBottom} (h ${h.boxH}, css ${h.cssHeight}, row ${h.gridRow}, border ${h.borderBottom})`)
    say(`      ink ${h.textTop}..${h.textBottom} (h ${h.textH})   text past the rule: ${h.textBelowRuleBy}px`)
  }

  // ── P2: THE HEAD BAND'S COLUMNS AND THE MILESTONE GRID ─────────────────
  say('\n── P2: the Installation head band and the milestone columns ──')
  const p2 = await p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const band = document.querySelector('#deal-intake-head')
    const groups = [...(band?.children ?? [])].filter(vis).map((g) => {
      const b = g.getBoundingClientRect()
      return { id: g.id || g.className, left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top) }
    })
    const head = document.querySelector('.cm-grid-head')
    const row = document.querySelector('.cm-grid-row')
    const cell = (e, i) => {
      const k = [...(e?.children ?? [])][i]
      if (!k) return null
      const b = k.getBoundingClientRect()
      const r = document.createRange(); r.selectNodeContents(k)
      const t = r.getBoundingClientRect()
      const inp = k.matches('input, select') ? k : k.querySelector('input, select')
      const ib = inp?.getBoundingClientRect()
      return {
        text: (k.textContent ?? '').trim().slice(0, 12),
        left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width),
        inkLeft: Math.round(t.left), inkRight: Math.round(t.right),
        inputW: ib ? Math.round(ib.width) : null,
        inputLeft: ib ? Math.round(ib.left) : null,
        inputRight: ib ? Math.round(ib.right) : null,
      }
    }
    return {
      panel: (() => {
        const e = document.querySelector('#deal-install-panel')
        const b = e.getBoundingClientRect()
        return { w: Math.round(b.width), left: Math.round(b.left), right: Math.round(b.right),
          scrollW: e.scrollWidth, clientW: e.clientWidth }
      })(),
      bandCols: band ? getComputedStyle(band).gridTemplateColumns : null,
      groups,
      cmCols: head ? getComputedStyle(head).gridTemplateColumns : null,
      cgVars: (() => {
        const g = document.querySelector('[data-testid="contractor-grid"]')
        if (!g) return 'no contractor-grid'
        const rows = g.querySelectorAll('.cm-grid-row').length
        return `pct=${g.style.getPropertyValue('--cm-pct-w') || 'UNSET'} `
          + `amt=${g.style.getPropertyValue('--cm-amt-w') || 'UNSET'} rows=${rows}`
      })(),
      headCells: [0, 1, 2, 3].map((i) => cell(head, i)),
      rowCells: [0, 1, 2, 3].map((i) => cell(row, i)),
    }
  })
  say(`  install panel  w ${p2.panel.w} (scroll ${p2.panel.scrollW} / client ${p2.panel.clientW})`)
  say(`  band columns   ${p2.bandCols}`)
  for (const g of p2.groups) say(`      ${String(g.id).padEnd(24)} ${g.left}..${g.right}  top ${g.top}`)
  say(`  cm-grid cols   ${p2.cmCols}`)
  say(`  contractor vars ${p2.cgVars}`)
  const NAMES = ['Month', 'Milestone', '%', 'Amount']
  for (let i = 0; i < 4; i++) {
    const h = p2.headCells[i], r = p2.rowCells[i]
    if (!h) continue
    say(`      ${NAMES[i].padEnd(10)} track ${h.left}..${h.right} (${h.w}px)`)
    say(`        head ink ${h.inkLeft}..${h.inkRight}   "${h.text}"`)
    if (r?.inputW !== null && r) say(`        input    ${r.inputLeft}..${r.inputRight} (${r.inputW}px)`)
  }

  // ── P4: CAN THIS PROBE REACH THE AUTOFILL PSEUDO-CLASS AT ALL? ──────────
  say('\n── P4: the autofill state, and what the probe can actually reach ──')
  const target = '#deal-lumpCost'
  const before = await p.evaluate((sel) => {
    const e = document.querySelector(sel)
    if (!e) return { why: 'no element' }
    const cs = getComputedStyle(e)
    return { bg: cs.backgroundColor, color: cs.color, shadow: cs.boxShadow }
  }, target)
  say(`  ${target} normal   bg ${before.bg}  color ${before.color}`)
  say(`  ${target} shadow   ${before.shadow}`)

  /* CAN THE PSEUDO-CLASS BE FORCED? `Emulation.setEmulatedMedia` cannot do it
     and there is no CDP command that sets `:autofill` on an arbitrary input;
     `Autofill.trigger` drives a credit-card form and needs a card. So the
     answer is recorded rather than worked around, and the report says which
     half of the claim the probe could reach. */
  let forced = null
  try {
    const cdp = await p.createCDPSession()
    const { nodeId } = await cdp.send('DOM.getDocument').then(async (d) =>
      cdp.send('DOM.querySelector', { nodeId: d.root.nodeId, selector: target }))
    await cdp.send('CSS.enable')
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['autofill'] })
    forced = await p.evaluate((sel) => {
      const cs = getComputedStyle(document.querySelector(sel))
      return { bg: cs.backgroundColor, color: cs.color, shadow: cs.boxShadow }
    }, target)
    say(`  CSS.forcePseudoState(['autofill'])  ACCEPTED`)
    say(`      bg ${forced.bg}  color ${forced.color}`)
    say(`      shadow ${forced.shadow}`)
  } catch (e) {
    say(`  CSS.forcePseudoState(['autofill'])  REFUSED: ${String(e.message).slice(0, 90)}`)
  }
  writeFileSync(`${OUT}measure.txt`, lines.join('\n') + '\n')
  say(`\nwritten by the run to ${OUT}measure.txt`)
} finally {
  await b.close()
  await tearDown(TAG)
}
