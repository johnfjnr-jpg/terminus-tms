// D2: DOES THE TAX LINE FIT ON ONE LINE INSIDE A STANDARD 460px CARD?
//
// ── THE MEASURE, AND WHY THE OBVIOUS ONE IS WRONG HERE ───────────────────
//
// Verification 4's recorded remedy for a wrap is "assert the cells share ONE
// ROW, by equal getBoundingClientRect().top". That remedy assumes items are
// top-aligned. `.terms-wht-pair` is `align-items: flex-end`, so three items of
// DIFFERENT HEIGHTS legitimately have three different tops while sitting on
// one line.
//
// The Phase 0 probe used the top test and reported "2 rows" for a 447px row
// inside a 902px box, which is impossible. That is Verification 33's shape: a
// measure aimed at the wrong axis of a property that has more than one.
//
// THE MEASURE USED HERE IS THE CONTAINER'S OWN HEIGHT against its tallest
// item. A flex line is exactly as tall as its tallest item, so a container
// taller than that has more than one line - and it is true whatever the
// alignment, which the top test is not. The bottom-grouping is reported
// beside it as a second, independent reading.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk11/probe-d2-fit.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk11/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.D2_TAG ?? 'before'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const opp = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(1), 'opp')[0]

// Measured INSIDE the page so the reading and the calibration use one
// definition of "lines", never two (Verification 20).
const MEASURE = () => {
  const pair = document.querySelector('.terms-wht-pair')
  if (!pair) return { absent: true }
  const pr = pair.getBoundingClientRect()
  const cs = getComputedStyle(pair)
  const items = [...pair.children].map((c) => {
    const r = c.getBoundingClientRect()
    return {
      label: (c.querySelector('label')?.textContent ?? c.textContent).trim().slice(0, 24),
      w: Math.round(r.width), h: Math.round(r.height),
      top: Math.round(r.top), bottom: Math.round(r.bottom),
    }
  })
  const gap = parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0
  const tallest = Math.max(...items.map((i) => i.h))
  // THE PADDING IS SUBTRACTED, and it is not a refinement. `.terms-field-row`
  // carries `padding: 9px 0`, so the container is 18px taller than its content
  // whatever the line count. Left in, one line reads 1.26 and two reads 2.26,
  // and both happen to round to the right answer - which is luck, not a
  // measurement, and the third line would round to 3.26 and still work until
  // some padding changed.
  const card = pair.closest('.pg-card')
  const ccs = getComputedStyle(card)
  const usable = Math.round(card.getBoundingClientRect().width
    - parseFloat(ccs.paddingLeft) - parseFloat(ccs.paddingRight)
    - parseFloat(ccs.borderLeftWidth) - parseFloat(ccs.borderRightWidth))
  const contentH = Math.round(pr.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom))
  return {
    items, gap, tallest,
    pairH: Math.round(pr.height), contentH,
    // ONE LINE is the content box being no taller than its tallest item.
    lines: Math.max(1, Math.round((contentH + gap) / (tallest + gap))),
    bottomGroups: new Set(items.map((i) => i.bottom)).size,
    sum: items.reduce((s, i) => s + i.w, 0) + gap * Math.max(0, items.length - 1),
    usable,
    cardW: Math.round(card.getBoundingClientRect().width),
    spans: ccs.gridColumn,
  }
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() => document.querySelector('.terms-wht-pair')?.getBoundingClientRect().width > 0,
      { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(MEASURE)
    console.log(`  items : ${m.items.map((i) => `${i.label} ${i.w}x${i.h}`).join(' | ')}`)
    console.log(`  card ${m.cardW}px (grid-column ${m.spans}), usable ${m.usable}px`)
    console.log(`  sum incl ${m.gap}px gaps = ${m.sum}px   content height ${m.contentH}px, tallest item ${m.tallest}px`)
    console.log(`  LINES = ${m.lines}   (bottom-groups reading: ${m.bottomGroups})`)

    // ── THE CALIBRATION, BOTH DIRECTIONS, ON THE LIVE ELEMENT ───────────
    // An instrument that always says ONE LINE would pass the claim below
    // without measuring anything, so it is made to say TWO first.
    const forced = await p.evaluate(() => {
      const pair = document.querySelector('.terms-wht-pair')
      const card = pair.closest('.pg-card')
      const prev = card.style.width
      card.style.width = '240px'                 // narrow enough that it must wrap
      void card.offsetHeight
      const r = (() => {
        const pr = pair.getBoundingClientRect()
        const hs = [...pair.children].map((c) => Math.round(c.getBoundingClientRect().height))
        const cs2 = getComputedStyle(pair)
        const gap = parseFloat(cs2.rowGap) || 0
        const tallest = Math.max(...hs)
        const ch = Math.round(pr.height - parseFloat(cs2.paddingTop) - parseFloat(cs2.paddingBottom))
        return Math.max(1, Math.round((ch + gap) / (tallest + gap)))
      })()
      card.style.width = prev
      void card.offsetHeight
      return r
    })
    check(forced > 1, `the LINES measure can read more than one`, `forced narrow -> ${forced} lines`)

    const back = await p.evaluate(MEASURE)
    check(back.lines === m.lines && back.cardW === m.cardW,
      'the forced state was restored before the real reading was kept',
      `${back.lines} lines, ${back.cardW}px`)

    // THE REQUIREMENT, written before the number was known: the three
    // controls read across on ONE line inside a STANDARD card, at both
    // widths. Not "the sum is under some figure I just measured".
    check(m.cardW <= 460, 'the Tax card is a STANDARD card, not a spanning one', `${m.cardW}px`)
    check(m.lines === 1, 'the tax line is ONE line', `${m.lines} line(s), ${m.sum}px into ${m.usable}px`)
    console.log(`  headroom: ${m.usable - m.sum}px`)

    // THE POSITION IS A RELATIONSHIP BETWEEN TWO CARDS, not a property of one
    // (Verification 4). "Beside Currency" is only answerable by comparing the
    // two boxes, and at one column it is answerable only as "directly below".
    const pos = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('.terms-cards > .pg-card')].map((c) => {
        const r = c.getBoundingClientRect()
        return { t: c.querySelector('.pg-card-title')?.textContent.trim(),
          x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }
      })
      const cur = cards.find((c) => c.t === 'Currency')
      const tax = cards.find((c) => c.t === 'Tax Adjustments')
      return { cards, sameRow: cur && tax ? cur.y === tax.y : null,
        order: cards.map((c) => c.t),
        taxFollowsCurrency: cards.findIndex((c) => c.t === 'Tax Adjustments')
          === cards.findIndex((c) => c.t === 'Currency') + 1 }
    })
    console.log(`  cards: ${pos.cards.map((c) => `${c.t} @${c.x},${c.y}`).join('  |  ')}`)
    check(pos.taxFollowsCurrency, 'Tax Adjustments takes the grid position immediately after Currency')
    console.log(`  Currency and Tax on the SAME ROW: ${pos.sameRow}`
      + (pos.sameRow ? '' : '  (a 3-card, 2-column grid puts the third on row 2)'))

    await p.evaluate(() => document.querySelector('.terms-cards')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    // MEASURE FIRST, CAPTURE SECOND, and capture the PAGE: an element capture
    // suppresses the scrollbar and does not put it back.
    const shot = `${OUT}d2-${TAG}-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('.terms-cards').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.width > 0
    })
    check(inView, `the cards are inside the captured region at ${width}`, shot)
  }
} finally { await b.close() }
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
