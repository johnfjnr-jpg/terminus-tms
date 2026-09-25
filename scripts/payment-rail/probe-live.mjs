// ── R-PT2 LIVE: THE RAIL, THE TOP ALIGNMENT, AND WHAT SURVIVED ──────────
//
// The claim R-PT2 is really about is TOP ALIGNMENT: the money starts at the
// same height in both modes. That is one number read twice, so it is measured
// as a number rather than inferred from the markup.
//
// And the direction round's assertions are re-run IN THE NEW POSITION, because
// moving a control is exactly when its geometry stops being what it was.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payment-rail/probe-live.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payment-rail/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'raillive'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '   ' + detail : ''}`)
}
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const px = (s) => { const n = (s.match(/[\d.]+/g) ?? []).map(Number); return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 } }
const contrast = (fg, bg) => {
  const f = px(fg), b = px(bg)
  const over = f.rgb.map((v, i) => Math.round(v * f.a + b.rgb[i] * (1 - f.a)))
  const [x, y] = [lum(over), lum(b.rgb)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
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
    await p.setViewport({ width, height: 1800 })
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
  const shot = async (n) => {
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    await p.screenshot({ path: `${OUT}${n}.png` })
    console.log(`     ${n}.png ${statSync(`${OUT}${n}.png`).size} bytes`)
  }
  const read = () => p.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect()
      return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) } }
    const rail = q('#deal-payment-rail'); const content = q('#deal-payment-content')
    const card = q('.payment-card')
    // The FIRST money element in the content column, whichever mode.
    const money = content?.querySelector('#deal-opex-table, #deal-capex-year-slot > *') ?? null
    const notes = [...document.querySelectorAll('.ring-radio-note')]
    const ground = (e) => { let n = e, bg = 'rgba(0, 0, 0, 0)'
      while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement }
      return bg }
    const slider = q('[data-testid="deal-payment-mode-toggle"]')
    const cs = slider ? getComputedStyle(slider, '::after') : null
    const bs = slider ? getComputedStyle(slider, '::before') : null
    const sr = slider ? slider.getBoundingClientRect() : null
    const m = cs ? new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform) : null
    const knobL = sr ? sr.left + (parseFloat(cs.left) || 0) + m.e : null
    const trackL = sr ? sr.left + (parseFloat(bs.left) || 0) : null
    const trackR = trackL !== null ? trackL + (parseFloat(bs.width) || 0) : null
    // RELATIVE TO THE CARD, not to the viewport. The first version read
    // `getBoundingClientRect().top` for each mode and compared 2183 against
    // 755 - two different SCROLL POSITIONS, because the capture between them
    // scrolls the region into view. The claim is a height within the panel, so
    // it is measured from the panel.
    const cardTop = card ? card.getBoundingClientRect().top : 0
    const moneyOffset = money ? Math.round(money.getBoundingClientRect().top - cardTop) : null
    return {
      rail: box(rail), content: box(content), money: box(money), moneyOffset,
      cardInner: card ? Math.round(card.clientWidth - 32) : null,
      railClips: rail ? rail.scrollWidth > rail.clientWidth + 1 : null,
      contentClips: content ? content.scrollWidth > content.clientWidth + 1 : null,
      cardClips: card ? card.scrollWidth > card.clientWidth + 1 : null,
      radios: document.querySelectorAll('#deal-payment-rail [data-structure]').length,
      notes: notes.map((n) => ({ text: n.textContent.trim(), color: getComputedStyle(n).color, bg: ground(n),
        clipped: n.scrollWidth > n.clientWidth + 1,
        lines: Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight)) })),
      knobL, knobR: knobL !== null ? knobL + (parseFloat(cs.width) || 0) : null, trackL, trackR,
      opexActive: q('[data-testid="deal-mode-label-opex"]')?.dataset.active,
      opexColor: q('[data-testid="deal-mode-label-opex"]') ? getComputedStyle(q('[data-testid="deal-mode-label-opex"]')).color : null,
      sliderInRail: !!rail && !!slider && rail.contains(slider),
    }
  })

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await land(width)
    let r = await read()
    check(r.sliderInRail, 'the slider is in the rail')
    check(r.rail.left < r.content.left, 'the rail is to the LEFT of the content',
      `rail ${r.rail.left}, content ${r.content.left}`)
    console.log(`     rail ${r.rail.w}px, content ${r.content.w}px, card inner ${r.cardInner}px`)
    check(!r.railClips && !r.contentClips && !r.cardClips, 'nothing clips',
      `rail ${r.railClips}, content ${r.contentClips}, card ${r.cardClips}`)
    check(r.radios === 3, 'CAPEX: the three radios are in the rail', `${r.radios}`)
    for (const n of r.notes) {
      const c = contrast(n.color, n.bg)
      // AND AT 1440 IT READS ON ONE LINE, which is what the Phase 0 measurement
      // meant by "no clipping": 178px was the text's own width and the row also
      // carries a ring and a gap. At 1240 the rail narrows and wrapping is the
      // ruled fallback, so the line count is only asserted at the wider width.
      const oneLine = n.lines <= 1
      check(c >= 4.5 && !n.clipped && (width === 1240 || oneLine),
        `the note "${n.text.slice(0, 22)}" reads`,
        `${c.toFixed(2)}:1, clipped ${n.clipped}, ${n.lines} line(s)`)
    }
    const capexMoneyTop = r.moneyOffset
    console.log(`     CAPEX money starts ${capexMoneyTop}px below the top of the panel`)
    await shot(`capex-${width}`)

    await p.click('[data-testid="deal-payment-mode-toggle"]')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
    r = await read()
    check(r.radios === 0, 'OPEX: no radios in the rail', `${r.radios}`)
    check(!r.railClips && !r.contentClips && !r.cardClips, 'nothing clips under OPEX',
      `rail ${r.railClips}, content ${r.contentClips}, card ${r.cardClips}`)
    console.log(`     OPEX money starts ${r.moneyOffset}px below the top of the panel`)
    // THE CLAIM R-PT2 IS ABOUT, as one number read twice.
    check(Math.abs(r.moneyOffset - capexMoneyTop) <= 2,
      'the money starts at the SAME height in both modes',
      `CAPEX ${capexMoneyTop}px, OPEX ${r.moneyOffset}px below the panel top`)
    // AND THE DIRECTION ROUND'S CLAIMS, RE-RUN IN THE NEW POSITION.
    check(Math.abs(r.knobL - r.trackL) <= 6, 'the knob is still at the LEFT end under OPEX',
      `knob ${Math.round(r.knobL)}, track ${Math.round(r.trackL)}`)
    check(r.opexActive === 'true' && r.opexColor === 'rgb(102, 204, 153)',
      'and the highlight is unchanged', `${r.opexColor}`)
    await shot(`opex-${width}`)
  }
} finally { await b.close(); await tearDown(TAG) }

const bad = checks.filter((x) => !x).length
console.log(`\n${checks.length - bad} of ${checks.length} checks passed`)
if (bad) process.exit(1)
