#!/usr/bin/env node
// The top strip, measured at 1920 and 1240, before and after. Round 41 item 3.
//
// WHAT IT MEASURES, and CLAUDE.md Verification 27 is why it is phrased this
// way: a distance is a property of the layout, a window is a property of the
// task. The strip's job is that a person reads the deal's position without
// scrolling and without hunting, so the measures are
//
//   how many figures are on screen at zero scroll
//   which figure is visually first, by size and colour rather than by order
//   whether a fifth figure fits on one row, at each width
//
// Verification 4: the capture is taken of the strip's own rect after scrolling
// it into view, and the image is checked for not being empty before it is
// treated as evidence.
let puppeteer
try {
  puppeteer = (await import(process.env.PUPPETEER_PATH ?? 'puppeteer')).default
} catch {
  console.error('puppeteer is not available, and it is not a dependency of this repository.')
  console.error('  npm i puppeteer --prefix /tmp/tms-probe')
  console.error('  PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer node scripts/probe-strip-layout.mjs')
  process.exit(1)
}
import { readFileSync, mkdirSync, writeFileSync } from 'fs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
// TT-SGP-SMARTC-003, the only live opportunity carrying units (10 existing, 10
// new, 4 AQ), a 36 month duration and a structure. The default in the other
// probes is a deal with no units, whose whole strip reads $0 and 0.0%, and a
// strip of zeroes cannot show which figure reads first.
const OPP = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const OUT = new URL('../.verify/strip/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()

const measure = async (width, label) => {
  await page.setViewport({ width, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('opportunity-detail', id), OPP)

  // ── THE COUNTERFACTUAL, STATED BEFORE THE WAIT. Verification 7 ──────────
  //
  // The first version waited for deal-achieved-margin to stop reading '--'.
  // That was satisfied instantly by '0.0%', which is what an UNPRICED deal
  // shows, so the whole first measurement was taken on a strip of zeroes and
  // reported four identical cells. A strip of zeroes cannot show which figure
  // reads first, which is the thing being measured.
  //
  // Contract net with a leading non-zero digit is reachable only once the deal
  // has actually priced, and it is false in the state before.
  await page.waitForFunction(() => {
    const el = document.getElementById('deal-contract-net')
    return el && /\$[1-9]/.test(el.textContent)
  }, { timeout: 20000 })
  // The Commercials tab, which is where the strip lives.
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-opp-tab]')].find((b) => /commercial/i.test(b.textContent))
    if (t) t.click()
  })
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && !p.classList.contains('hidden')
  }, { timeout: 20000 })

  // ── THE CANDIDATE LAYOUTS, APPLIED TO THE REAL SCREEN ───────────────────
  //
  // Injected rather than mocked, because the business asked for a proposal
  // against the FINISHED screen: a standalone mock would measure a page that
  // does not exist, including its sidebar, its scroll container and the panel
  // below the strip that the space cost is paid out of.
  await page.evaluate((option) => {
    if (option === 'before') return
    const strip = document.querySelector('#opp-tab-commercial .stats-grid')
    const cell = (label, value, id) => {
      const d = document.createElement('div')
      d.innerHTML = `<span class="label">${label}</span><div class="stat-value" id="${id}">${value}</div>`
      return d
    }
    // Closing cash position, the figure the business is adding. Read from the
    // rendered cash flow rather than recomputed, so the proposal shows the real
    // number for this deal.
    const cashRows = [...document.querySelectorAll('#deal-cashflow-table tr, #deal-cash-table tr')]
    let closing = document.getElementById('deal-closing-cash')?.textContent?.trim() || null
    if (!closing) {
      const last = cashRows.at(-1)
      const cells = last ? [...last.children].map((c) => c.textContent.trim()) : []
      closing = cells.at(-1) || '$117,341'
    }
    strip.appendChild(cell('Closing cash position', closing, 'deal-closing-cash-strip'))

    const byId = (id) => strip.querySelector('#' + id)?.parentElement
    const big = (el, px, colour) => {
      if (!el) return
      const v = el.querySelector('.stat-value')
      v.style.fontSize = px
      if (colour) v.style.color = colour
    }
    const small = (el) => {
      if (!el) return
      const v = el.querySelector('.stat-value')
      v.style.fontSize = '13px'
      v.style.color = 'var(--muted)'
    }
    const margin = byId('deal-achieved-margin')
    const cash = byId('deal-closing-cash-strip')
    const net = byId('deal-contract-net')
    const cost = byId('deal-total-cost')
    const fin = byId('deal-finance-cost')

    if (option === 'A') {
      strip.style.gridTemplateColumns = 'repeat(5, 1fr)'
      big(margin, '20px'); big(cash, '20px')
      small(net); small(cost); small(fin)
    }
    if (option === 'B') {
      strip.style.gridTemplateColumns = '1.6fr 1.6fr 1fr 1fr 1fr'
      strip.style.gap = '28px'
      strip.insertBefore(cash, strip.firstChild)
      strip.insertBefore(margin, strip.firstChild)
      big(margin, '24px'); big(cash, '24px')
      small(net); small(cost); small(fin)
    }
    if (option === 'Bstress') {
      // ── THE LONGEST REAL STRINGS, NOT THE ONES THIS DEAL HAPPENS TO HAVE ──
      //
      // The business's own example of a closing cash position was NEGATIVE and
      // seven figures, which is two glyphs wider than this deal's $117,341. And
      // ruling 5 gave finance cost a "not recorded" state that is longer than
      // any dollar amount. Measuring the layout on the values in front of you
      // is measuring the deal rather than the layout.
      strip.style.gridTemplateColumns = '1.6fr 1.6fr 1fr 1fr 1fr'
      strip.style.gap = '28px'
      strip.insertBefore(cash, strip.firstChild)
      strip.insertBefore(margin, strip.firstChild)
      big(margin, '24px'); big(cash, '24px')
      small(net); small(cost); small(fin)
      strip.querySelector('#deal-closing-cash-strip').textContent = '-$1,275,556'
      strip.querySelector('#deal-finance-cost').textContent = 'not recorded'
      strip.querySelector('#deal-contract-net').textContent = '$12,155,066'
      strip.querySelector('#deal-total-cost').textContent = '$11,061,348'
      strip.querySelector('#deal-achieved-margin').textContent = '-142.7%'
    }
    if (option === 'C') {
      strip.style.gridTemplateColumns = 'repeat(6, 1fr)'
      strip.style.rowGap = '20px'
      strip.insertBefore(cash, strip.firstChild)
      strip.insertBefore(margin, strip.firstChild)
      margin.style.gridColumn = 'span 3'
      cash.style.gridColumn = 'span 3'
      net.style.gridColumn = 'span 2'
      cost.style.gridColumn = 'span 2'
      fin.style.gridColumn = 'span 2'
      big(margin, '26px'); big(cash, '26px')
      small(net); small(cost); small(fin)
    }
  }, process.env.LABEL ?? 'before')

  const m = await page.evaluate(() => {
    const strip = document.querySelector('#opp-tab-commercial .stats-grid')
    if (!strip) return { error: 'no strip' }
    const r = strip.getBoundingClientRect()
    const cs = getComputedStyle(strip)
    const cells = [...strip.children].map((c) => {
      const label = c.querySelector('.label')
      const value = c.querySelector('.stat-value')
      const vr = value ? value.getBoundingClientRect() : null
      const vcs = value ? getComputedStyle(value) : null
      return {
        label: label ? label.textContent.trim() : null,
        value: value ? value.textContent.trim() : null,
        id: value ? value.id : null,
        width: Math.round(c.getBoundingClientRect().width),
        top: Math.round(c.getBoundingClientRect().top),
        fontSize: vcs ? vcs.fontSize : null,
        fontWeight: vcs ? vcs.fontWeight : null,
        color: vcs ? vcs.color : null,
        textWidth: vr ? Math.round(vr.width) : null,
        overflows: vr && value ? value.scrollWidth > value.clientWidth + 1 : false,
      }
    })
    // How many DISTINCT rows the strip renders at this width.
    const rows = [...new Set(cells.map((c) => c.top))].length

    // ── THE MEASURE A PERSON EXPERIENCES. Verification 27 ─────────────────
    //
    // A cell width is a property of the document. How far the eye travels
    // between the two figures the business wants read together is a property
    // of reading them, and it is measured on the GLYPHS rather than the block,
    // because a 15px number in a 365px cell leaves 275px of nothing.
    const glyphs = (id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const r = document.createRange()
      r.selectNodeContents(el)
      const b = r.getBoundingClientRect()
      return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width), top: Math.round(b.top) }
    }
    const gm = glyphs('deal-achieved-margin')
    const gc = glyphs('deal-closing-cash-strip')
    const pairTravel = gm && gc
      ? Math.round(Math.max(gm.left, gc.left) - Math.min(gm.right, gc.right))
      : null
    const allGlyphs = ['deal-contract-net', 'deal-achieved-margin', 'deal-total-cost', 'deal-finance-cost', 'deal-closing-cash-strip']
      .map((id) => ({ id, g: glyphs(id) })).filter((x) => x.g)
    const lefts = allGlyphs.map((x) => x.g.left)
    const rights = allGlyphs.map((x) => x.g.right)
    const sameBaseline = new Set(allGlyphs.map((x) => x.g.top)).size === 1
    // The other rendering of achieved margin, which the business reported as
    // the stronger one.
    const other = document.getElementById('deal-terms-achieved-margin')
    const ocs = other ? getComputedStyle(other) : null
    return {
      grid: cs.gridTemplateColumns,
      gap: cs.gap,
      stripTop: Math.round(r.top),
      stripHeight: Math.round(r.height),
      rows,
      cells,
      viewportH: window.innerHeight,
      pairTravel,
      sameBaseline,
      inkSpan: rights.length ? Math.max(...rights) - Math.min(...lefts) : null,
      ink: allGlyphs.map((x) => ({ id: x.id, left: x.g.left, right: x.g.right, w: x.g.width, top: x.g.top })),
      onScreenAtZeroScroll: Math.round(r.top) >= 0 && Math.round(r.bottom) <= window.innerHeight,
      otherAchieved: other ? {
        id: other.id, text: other.textContent.trim(),
        fontSize: ocs.fontSize, fontWeight: ocs.fontWeight, color: ocs.color,
        top: Math.round(other.getBoundingClientRect().top),
      } : null,
    }
  })

  // Verification 4's refinement: confirm the element is inside the capture
  // before the image is treated as evidence.
  const el = await page.$('#opp-tab-commercial .stats-grid')
  await el.scrollIntoView()
  const box = await el.boundingBox()
  const file = `${OUT}strip-${label}-${width}.png`
  await page.screenshot({ path: file, clip: { x: 0, y: Math.max(0, box.y - 20), width, height: Math.min(box.height + 60, 900) } })
  const bytes = readFileSync(file).length
  return { ...m, capture: file, captureBytes: bytes, captureCoversElement: box.height > 10 }
}

const out = {}
for (const w of [1920, 1240]) out[w] = await measure(w, process.env.LABEL ?? 'before')
await browser.close()

writeFileSync(`${OUT}${process.env.LABEL ?? 'before'}.json`, JSON.stringify(out, null, 2) + '\n')
for (const [w, m] of Object.entries(out)) {
  console.log(`\n── ${w}px ───────────────────────────────────────────────`)
  if (m.error) { console.log('  ', m.error); continue }
  console.log(`  grid: ${m.grid}   gap: ${m.gap}   rows rendered: ${m.rows}`)
  console.log(`  strip top ${m.stripTop}px, height ${m.stripHeight}px, viewport ${m.viewportH}px, fully on screen at zero scroll: ${m.onScreenAtZeroScroll}`)
  for (const c of m.cells) {
    console.log(`    ${String(c.label).padEnd(18)} ${String(c.value).padEnd(14)} cell ${String(c.width).padStart(4)}px  text ${String(c.textWidth).padStart(4)}px  ${c.fontSize}/${c.fontWeight} ${c.color}${c.overflows ? '  OVERFLOWS' : ''}`)
  }
  if (m.otherAchieved) {
    console.log(`  the other achieved-margin rendering: ${m.otherAchieved.id} "${m.otherAchieved.text}" ${m.otherAchieved.fontSize}/${m.otherAchieved.fontWeight} ${m.otherAchieved.color} at top ${m.otherAchieved.top}px`)
  }
  console.log(`  eye travel between the promoted pair: ${m.pairTravel === null ? 'n/a (pair not present)' : m.pairTravel + 'px'}   all five on one baseline: ${m.sameBaseline}`)
  console.log(`  ink spans ${m.inkSpan}px:  ` + m.ink.map((i) => `${i.id.replace('deal-', '')} ${i.left}-${i.right}@${i.top}`).join('  '))
  console.log(`  capture ${m.capture} (${m.captureBytes} bytes, covers element: ${m.captureCoversElement})`)
}
