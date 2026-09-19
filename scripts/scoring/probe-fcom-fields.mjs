// ── F-COM: the Commercials panel's inputs wear the estate's field treatment ─
//
// Two claims, because John reported two things and they have different causes:
//   COLOUR  no input on the panel renders a white background
//   LAYOUT  no input overlaps its own label in the Units required card
//
// A colour rule alone would leave the overlap, and a layout fix alone would
// leave the white - so each is asserted separately and each has to fail on its
// own before the fix (Verification 33: name the dimensions and assert each).
//
// UNWIRED: browser, live server, signed-in session; creates an Opportunity.
// Run: PUPPETEER_PATH=... node scripts/scoring/probe-fcom-fields.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('scoring/probe-fcom-fields.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/scoring/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'v9fc2'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

// The expected treatment is READ FROM THE STYLESHEET, never typed here: the
// panel must match what the estate already gives every other field.
const css = readFileSync(`${ROOT}/frontend/style.css`, 'utf8')
const BLACK = /--black:\s*(#[0-9a-fA-F]{6})/.exec(css)[1]
const expect = `rgb(${[1, 3, 5].map((i) => parseInt(BLACK.substr(i, 2), 16)).join(', ')})`
console.log(`the estate's field background is --black ${BLACK} = ${expect}\n`)

const opp = await freshOpportunity(TAG)
const oppId = opp.oppId ?? opp.opportunityId
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
  // ── WAIT FOR THE RECORD, NOT FOR STATIC MARKUP ─────────────────────────
  //
  // `#opp-tab-commercial` is in index.html, so it exists from page load and
  // waiting for it is satisfied before anything has been fetched. The first
  // version clicked the tab at that moment, measured an unmounted panel and
  // reported ZERO inputs - while the capture taken moments later showed the
  // panel perfectly. Verification 7's counterfactual: the condition was already
  // true in the state the probe must not measure.
  await p.waitForFunction(() => !!document.getElementById('opp-assessment-mount-strip'),
    { timeout: 30000 })
  await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  const mounted = await p.waitForFunction(() => {
    const e = document.getElementById('deal-ssExisting')
    return !!e && e.getBoundingClientRect().width > 0
  }, { timeout: 30000 }).then(() => true).catch(() => false)
  check(mounted, 'the React deal panel is mounted and laid out, so what follows is a measurement')

  const m = await p.evaluate(() => {
    const root = document.getElementById('deal-form-root')
    const inputs = [...root.querySelectorAll('input')]
      .filter((e) => e.type !== 'checkbox' && e.type !== 'radio')
    const white = inputs.filter((e) => getComputedStyle(e).backgroundColor === 'rgb(255, 255, 255)')
    const bgs = {}
    for (const e of inputs) { const c = getComputedStyle(e).backgroundColor; bgs[c] = (bgs[c] ?? 0) + 1 }
    // ── THE LAYOUT CLAIM, AND THE FIRST VERSION ASKED THE WRONG QUESTION ──
    //
    // It tested whether the input's box INTERSECTS its label's box and found
    // none, while the screenshot plainly showed the two colliding. Both were
    // right: the boxes ABUT rather than overlap, and a white box hard against
    // the end of a label reads as sitting on it.
    //
    // THE MECHANISM IS SHARPER THAN "OVERLAP". `.unit-cards .unit-card` declares
    // `grid-template-columns: minmax(0, 1fr) 72px` with a 12px gap - a label
    // column and a number column. The React panel puts BOTH the label span and
    // the input inside ONE `.deal-field` wrapper, so the card's grid receives a
    // single child, the second column is never used, and the two sit inline
    // against each other.
    //
    // So the claim is a RELATIONSHIP with a threshold taken from the estate's
    // own declaration rather than from what was measured (Verification 47):
    // the input starts at least the card's declared gap to the right of where
    // its label ends, on the rows the card means to lay out in two columns.
    const CARD_GAP = 12
    const crowded = []
    for (const e of inputs) {
      const card = e.closest('.unit-cards .unit-card')
      if (!card) continue
      const lbl = e.closest('.deal-field')?.querySelector('.deal-field-label')
      if (!lbl) continue
      const a = e.getBoundingClientRect(), c = lbl.getBoundingClientRect()
      if (a.width === 0 || c.width === 0) continue
      const sameLine = a.top < c.bottom && c.top < a.bottom
      const gap = a.left - c.right
      if (sameLine && gap < CARD_GAP) crowded.push(`${e.id}: gap ${Math.round(gap)}px`)
    }
    return { total: inputs.length, white: white.length, whiteIds: white.slice(0, 4).map((e) => e.id),
      backgrounds: bgs, crowded, crowdedCount: crowded.length }
  })
  console.log(`  ${JSON.stringify(m, null, 1)}\n`)

  check(m.total > 20, `the panel's inputs were found and measured (${m.total})`)
  check(m.white === 0,
    `F-COM colour: NO input renders a white background (${m.white} of ${m.total} white: ${JSON.stringify(m.whiteIds)})`)
  check(m.backgrounds[expect] > 0,
    `and they wear the estate's own field background ${expect} (${m.backgrounds[expect] ?? 0} do)`)
  check(m.crowdedCount === 0,
    `F-COM layout: in Units required no input sits against its label (${m.crowdedCount}: ${JSON.stringify(m.crowded.slice(0, 5))})`)

  const framed = await p.evaluate(() => {
    const el = document.getElementById('deal-ssExisting')
    el?.scrollIntoView({ block: 'center' })
    const r = el?.getBoundingClientRect()
    return r ? { inView: r.top >= 0 && r.bottom <= window.innerHeight, top: Math.round(r.top) } : null
  })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  check(!!framed?.inView, `the Units required card is inside the captured region (top ${framed?.top})`)
  const shot = `${OUT}fcom-fields-1440-${oppId.slice(0, 8)}.png`
  await p.screenshot({ path: shot })
  console.log(`\n  screenshot: ${shot}`)
} finally { await b.close(); await tearDown(TAG) }

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
