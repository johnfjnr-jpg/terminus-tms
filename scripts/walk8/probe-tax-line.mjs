// WALK 8 ITEM 1: the tax line, on one line, in the ruled order.
//
// ONE LINE IS NOT "EQUAL TOPS". `.terms-wht-pair` is `align-items: flex-end`,
// so three controls of different heights on ONE line have three different
// tops. Walk 5 recorded the remedy after reporting a wrapped header as one
// line twice: a shared line is a shared CENTRE, tested with an overlap that
// cannot be satisfied by two rows touching.
//
// AND THE CARD MUST NOT OVERFLOW. The hygiene round's measure read the flex
// container's own right edge, which is not where its children end, and called
// a row hanging 146px outside the card "inside".
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk8/probe-tax-line.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk8/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w8tax'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const opp = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await p.waitForFunction(() => document.querySelector('.terms-wht-pair'), { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => document.querySelector('.terms-wht-pair')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const row = document.querySelector('.terms-wht-pair')
      const card = row.closest('.pg-card')
      const kids = [...row.children]
      const box = (e) => { const r = e.getBoundingClientRect()
        return { t: r.top, b: r.bottom, l: Math.round(r.left), r: Math.round(r.right),
          c: r.top + r.height / 2, w: Math.round(r.width) } }
      const bs = kids.map(box)
      // A SHARED LINE: every item's vertical CENTRE falls inside every other
      // item's box. Two stacked rows cannot satisfy that, and two items that
      // merely touch cannot either.
      const shared = bs.every((a) => bs.every((z) => a.c > z.t && a.c < z.b))
      const cardBox = card.getBoundingClientRect()
      const cs = getComputedStyle(card)
      const inner = { l: cardBox.left + parseFloat(cs.paddingLeft),
        r: cardBox.right - parseFloat(cs.paddingRight) }
      return {
        order: kids.map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26)),
        shared, childrenRight: Math.max(...bs.map((x) => x.r)), innerRight: Math.round(inner.r),
        cardW: Math.round(cardBox.width),
        wht: document.getElementById('deal-whtPct')?.getAttribute('placeholder'),
        gst: document.getElementById('deal-gstPct')?.getAttribute('placeholder'),
        whtW: Math.round(document.getElementById('deal-whtPct').getBoundingClientRect().width),
        // NOTHING CLIPPED: a placeholder wider than its box is cut silently.
        clipped: [...row.querySelectorAll('input')]
          .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.id),
        visible: getComputedStyle(card).visibility === 'visible'
          && cardBox.top < innerHeight && cardBox.bottom > 0,
      }
    })
    console.log(`\n=== ${width}px ===`)
    console.log(`  card ${m.cardW}px   order ${JSON.stringify(m.order)}`)
    console.log(`  children end ${m.childrenRight} against the card's inner edge ${m.innerRight}`)
    check(m.visible, `the card is in the captured region and visible at ${width}`)
    check(JSON.stringify(m.order) ===
      // RE-POINTED BY WALK 11 D2. The ruled order is unchanged; the WHT
      // label shortened to the estate's abbreviation so the line fits a
      // standard card, which is the same ruling that retired the span.
      JSON.stringify(['WHT % ?', 'Gross up disabled', 'GST % ?']),
      `ITEM 1 the ruled ORDER: WHT, gross-up, GST at ${width}`, JSON.stringify(m.order))
    check(m.childrenRight <= m.innerRight + 1,
      `ITEM 1 and the line stays inside its card at ${width}`,
      `${m.childrenRight} against ${m.innerRight}`)
    check(m.wht === 'not recorded' && m.gst === 'not recorded',
      `ITEM 1 both rates say "not recorded" at ${width}`, `${m.wht} / ${m.gst}`)
    check(m.clipped.length === 0,
      `ITEM 1 and neither placeholder is clipped at ${width}`, JSON.stringify(m.clipped))
    if (width === 1440) {
      check(m.shared, 'ITEM 1 ONE LINE at 1440: every item shares the others\' vertical span')
    } else {
      // STATED, NOT ASSERTED GREEN. At 1240 `.terms-cards` has ONE column, so
      // there is no second column to span and the card is 460px by the cap
      // John ruled untouched. Recorded so the report cannot overclaim.
      console.log(`  NOTE 1240: one line = ${m.shared} (one column exists here, so the span cannot widen it)`)
    }
    await p.screenshot({ path: `${OUT}tax-line-${width}.png` })
  }
} finally { await b.close(); await tearDown([TAG]) }
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
