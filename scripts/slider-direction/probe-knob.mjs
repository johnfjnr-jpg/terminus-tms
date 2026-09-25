// ── THE KNOB SITS ON THE SIDE OF THE ACTIVE MODE ────────────────────────
//
// John's screenshot: with OPEX active and its label green, the knob rendered on
// the RIGHT, toward CAPEX. The knob and the highlight disagreed.
//
// MEASURED AS GEOMETRY, NOT AS A CLASS. The knob is a `::after` pseudo-element
// moved by a `transform`, so the claim is where its centre actually lands
// relative to the two labels - the assertion a rule that lost the cascade
// cannot satisfy. Stated as a RELATIONSHIP between three elements rather than
// as a CSS property of one.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('slider-direction/probe-knob.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/slider-direction/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'sliderdir'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '   ' + detail : ''}`)
}
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
} })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const land = async (width) => {
    await p.setViewport({ width, height: 1700 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2200)))
  }
  const knob = () => p.evaluate(() => {
    const btn = document.querySelector('[data-testid="deal-payment-mode-toggle"]')
    const opex = document.querySelector('[data-testid="deal-mode-label-opex"]')
    const capex = document.querySelector('[data-testid="deal-mode-label-capex"]')
    if (!btn || !opex || !capex) return null
    const cs = getComputedStyle(btn, '::after')
    // THE TRANSFORM IS A MATRIX, and its horizontal translate is `e`. Reading
    // the declared string would read the stylesheet; this reads what the
    // browser resolved, which is the only thing the eye sees.
    const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform)
    const r = btn.getBoundingClientRect()
    const left = parseFloat(cs.left) || 0
    const w = parseFloat(cs.width) || 0
    const centre = r.left + left + m.e + w / 2
    const mid = (e) => { const b = e.getBoundingClientRect(); return b.left + b.width / 2 }
    // THE TRACK'S OWN BOX, so "at the end" can be asserted rather than a
    // distance that a knob which barely moved still satisfies.
    const bs = getComputedStyle(btn, '::before')
    const trackL = r.left + (parseFloat(bs.left) || 0)
    const trackR = trackL + (parseFloat(bs.width) || 0)
    return {
      centre, translateX: m.e, trackLeft: r.left, btnW: Math.round(r.width),
      knobL: centre - w / 2, knobR: centre + w / 2, trackL, trackR,
      opexMid: mid(opex), capexMid: mid(capex),
      toOpex: Math.abs(centre - mid(opex)), toCapex: Math.abs(centre - mid(capex)),
      greenOpex: getComputedStyle(opex).color, greenCapex: getComputedStyle(capex).color,
      activeOpex: opex.dataset.active, activeCapex: capex.dataset.active,
      aria: btn.getAttribute('aria-checked'),
    }
  })
  const shot = async (n) => {
    await p.evaluate(() => document.querySelector('.opex-switch')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    await p.screenshot({ path: `${OUT}${n}.png`, clip: await p.evaluate(() => {
      const e = document.querySelector('.payment-card')
      const r = e.getBoundingClientRect()
      return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: Math.min(900, r.width + 16), height: 220 }
    }) })
    console.log(`     ${n}.png ${statSync(`${OUT}${n}.png`).size} bytes`)
  }

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await land(width)

    // ── CAPEX ACTIVE: the knob belongs on the RIGHT, toward CAPEX ────
    let k = await knob()
    check(!!k, 'the slider and both labels are on screen')
    check(k.activeCapex === 'true' && k.aria === 'false', 'CAPEX is the active mode', `aria-checked ${k.aria}`)
    console.log(`     knob centre ${Math.round(k.centre)}  OPEX label ${Math.round(k.opexMid)}  CAPEX label ${Math.round(k.capexMid)}`)
    check(k.toCapex < k.toOpex, 'CAPEX active: the knob is nearer the CAPEX label',
      `${Math.round(k.toCapex)}px to CAPEX against ${Math.round(k.toOpex)}px to OPEX`)
    // ── AND IT IS AT THE END OF ITS TRACK ────────────────────────────
    //
    // The "nearer the active label" test alone is satisfied by a knob that has
    // barely moved, because the two labels are not symmetric about the track:
    // OPEX is four characters and CAPEX five. Measured - with the inherited
    // 12px travel the knob sat mid-track and the test still passed, by four
    // pixels. A knob "on the side of the active mode" is at that side's END.
    check(Math.abs(k.knobR - k.trackR) <= 6, 'CAPEX active: and it is at the RIGHT end of the track',
      `knob right ${Math.round(k.knobR)} against track right ${Math.round(k.trackR)}`)
    const capexGreen = k.greenCapex
    await shot(`capex-${width}`)

    // ── OPEX ACTIVE: the knob belongs on the LEFT, toward OPEX ───────
    await p.click('[data-testid="deal-payment-mode-toggle"]')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 700)))
    k = await knob()
    check(k.activeOpex === 'true' && k.aria === 'true', 'OPEX is the active mode', `aria-checked ${k.aria}`)
    console.log(`     knob centre ${Math.round(k.centre)}  OPEX label ${Math.round(k.opexMid)}  CAPEX label ${Math.round(k.capexMid)}`)
    check(k.toOpex < k.toCapex, 'OPEX active: the knob is nearer the OPEX label',
      `${Math.round(k.toOpex)}px to OPEX against ${Math.round(k.toCapex)}px to CAPEX`)
    check(Math.abs(k.knobL - k.trackL) <= 6, 'OPEX active: and it is at the LEFT end of the track',
      `knob left ${Math.round(k.knobL)} against track left ${Math.round(k.trackL)}`)
    // THE HIGHLIGHT AND THE ARIA STAY AS BUILT, asserted rather than assumed:
    // a fix that moved the knob by moving the highlight would satisfy the
    // assertion above and undo L1.
    check(k.greenOpex === capexGreen, 'the active green is the SAME colour it was on the other side',
      `${k.greenOpex}`)
    check(k.activeCapex === 'false', 'and only one side is marked')
    await shot(`opex-${width}`)
  }
} finally { await b.close(); await tearDown(TAG) }

const bad = checks.filter((x) => !x).length
console.log(`\n${checks.length - bad} of ${checks.length} checks passed`)
if (bad) process.exit(1)
