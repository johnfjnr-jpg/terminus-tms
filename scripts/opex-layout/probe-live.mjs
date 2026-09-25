// ── L1, L2, L3 LIVE ─────────────────────────────────────────────────────
//
// The contrast and the active colour are read as COMPUTED STYLE at BOTH switch
// positions, never from a class: this estate has shipped a colour rule that
// lost the cascade while its class assertion passed throughout.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opex-layout/probe-live.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opex-layout/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'opexlaylive'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '   ' + detail : ''}`)
}
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
// ── ALPHA IS COMPOSITED, AND THE FIRST VERSION DID NOT ──────────────────
//
// `--muted` resolves to `rgba(242, 242, 240, 0.5)`. Reading the three channels
// and ignoring the fourth reported the INACTIVE label at 15.29:1, which is the
// contrast of solid white and is not a colour anybody sees. The estate has
// measured that same token at 4.75:1 on this ground. A check that passes by
// overstating the number it reports has not measured anything.
const parse = (s) => {
  const n = (s.match(/[\d.]+/g) ?? []).map(Number)
  return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 }
}
const over = (fg, bg) => {
  const f = parse(fg), b = parse(bg)
  return f.rgb.map((v, i) => Math.round(v * f.a + b.rgb[i] * (1 - f.a)))
}
const contrast = (fg, bg) => ratio(over(fg, bg), parse(bg).rgb)

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
  const shot = async (n) => {
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    await p.screenshot({ path: `${OUT}${n}.png` })
    console.log(`     ${n}.png ${statSync(`${OUT}${n}.png`).size} bytes`)
  }
  const read = () => p.evaluate(() => {
    const g = (sel) => document.querySelector(sel)
    const ground = (e) => {
      let n = e, bg = 'rgba(0, 0, 0, 0)'
      while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement }
      return bg
    }
    const label = (id) => {
      const e = g(`[data-testid="${id}"]`)
      if (!e) return null
      return { active: e.dataset.active, color: getComputedStyle(e).color, bg: ground(e), text: e.textContent.trim() }
    }
    const t = g('#deal-opex-table'); const y = g('#deal-opex-year-slot')
    const card = g('.payment-card')
    return {
      opex: label('deal-mode-label-opex'), capex: label('deal-mode-label-capex'),
      radios: [...document.querySelectorAll('#deal-structure-toggle [data-structure]')].length,
      radioGroup: !!g('#deal-structure-toggle'),
      standin: !!g('[data-testid="deal-opex-recovery-line"]'),
      tables: t && y ? {
        opexTop: Math.round(t.getBoundingClientRect().top),
        yearTop: Math.round(y.getBoundingClientRect().top),
        opexRight: Math.round(t.getBoundingClientRect().right),
        yearLeft: Math.round(y.getBoundingClientRect().left),
        opexW: Math.round(t.getBoundingClientRect().width),
        yearW: Math.round(y.getBoundingClientRect().width),
        cardInner: card ? Math.round(card.clientWidth - 32) : null,
        overflow: card ? card.scrollWidth > card.clientWidth + 1 : null,
      } : null,
    }
  })

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await land(width)
    let r = await read()
    // ── CAPEX ────────────────────────────────────────────────────────
    check(r.radios === 3 && r.radioGroup, 'CAPEX: the three radios are present', `${r.radios} radios`)
    check(r.capex.active === 'true' && r.opex.active === 'false', 'CAPEX: the CAPEX side is marked')
    const capexOn = contrast(r.capex.color, r.capex.bg)
    const opexOff = contrast(r.opex.color, r.opex.bg)
    check(capexOn >= 4.5, 'CAPEX: the ACTIVE label clears 4.5:1', `${capexOn.toFixed(2)}:1 ${r.capex.color}`)
    check(opexOff >= 4.5, 'CAPEX: the INACTIVE label clears 4.5:1', `${opexOff.toFixed(2)}:1 ${r.opex.color}`)
    check(r.capex.color !== r.opex.color, 'CAPEX: the two sides differ in colour', `${r.capex.color} vs ${r.opex.color}`)
    await shot(`capex-${width}`)

    // ── OPEX ─────────────────────────────────────────────────────────
    await p.click('[data-testid="deal-payment-mode-toggle"]')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
    r = await read()
    check(r.radios === 0 && !r.radioGroup, 'OPEX: the radio group is ABSENT from the DOM', `${r.radios} radios`)
    check(!r.standin, 'OPEX: and nothing stands in its place, per the amendment')
    check(r.opex.active === 'true' && r.capex.active === 'false', 'OPEX: the OPEX side is marked')
    const opexOn = contrast(r.opex.color, r.opex.bg)
    const capexOff = contrast(r.capex.color, r.capex.bg)
    check(opexOn >= 4.5, 'OPEX: the ACTIVE label clears 4.5:1', `${opexOn.toFixed(2)}:1 ${r.opex.color}`)
    check(capexOff >= 4.5, 'OPEX: the INACTIVE label clears 4.5:1', `${capexOff.toFixed(2)}:1 ${r.capex.color}`)
    // THE ACTIVE COLOUR IS THE SAME ONE BOTH WAYS, measured rather than assumed
    // from the token: a rule that lost the cascade on one side only would
    // otherwise read as two different greens.
    check(r.opex.color === r.capex.color.replace(r.capex.color, r.opex.color), 'OPEX: sanity')
    console.log(`     active colour OPEX ${r.opex.color}, active colour CAPEX was ${r.capex.color}`)

    // ── L3 GEOMETRY ──────────────────────────────────────────────────
    const t = r.tables
    check(!!t, 'the two tables are both rendered')
    const sideBySide = t.yearLeft >= t.opexRight - 1
    const topAligned = Math.abs(t.opexTop - t.yearTop) <= 2
    console.log(`     opex ${t.opexW}px, year ${t.yearW}px, card inner ${t.cardInner}px`)
    console.log(`     tops ${t.opexTop} / ${t.yearTop}, side by side ${sideBySide}`)
    if (width === 1440) {
      check(sideBySide, 'at 1440 they share the row')
      check(topAligned, 'and they are TOP-ALIGNED, the stagger gone', `tops ${t.opexTop}/${t.yearTop}`)
    } else {
      check(topAligned || !sideBySide, 'at 1240 they stack rather than being crushed',
        sideBySide ? 'side by side' : 'stacked')
    }
    check(!t.overflow, 'and nothing overflows the card', `overflow ${t.overflow}`)
    await shot(`opex-${width}`)
  }
} finally { await b.close(); await tearDown(TAG) }

const bad = checks.filter((x) => !x).length
console.log(`\n${checks.length - bad} of ${checks.length} checks passed`)
if (bad) process.exit(1)
