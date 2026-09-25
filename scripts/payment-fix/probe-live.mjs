// ── F1, F2, F4: THE LIVE PROOF ──────────────────────────────────────────
//
// Every claim below is a RELATIONSHIP BETWEEN TWO ELEMENTS, never a CSS
// property. "Same size" is the mode toggle measured against the factoring
// toggle; "one gutter" is every ring measured against every other ring. A
// property assertion - `padding: 0` gone, `align-items: flex-start` present -
// would pass on a control parked anywhere on the page.
//
// THRESHOLDS COME FROM THE REQUIREMENT, NOT FROM THE RESULT (V47). "Same size"
// and "one gutter" both mean equal, so the tolerance is 1px of subpixel
// rounding, fixed before anything was measured.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payment-fix/probe-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payment-fix/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'payfixlive'
// Equal means equal: 1px of subpixel rounding, fixed before anything was read.
const TOL = 1
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const { oppId } = await freshOpportunity(TAG)
const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
  milestones: [
    { month: 1, label: 'Contract start', pct: 40 },
    { month: 6, label: 'Hardware delivered to site', pct: 30 },
    { month: 12, label: 'Installation complete', pct: 30 },
  ],
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const land = async (width) => {
    await p.setViewport({ width, height: 1900 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    // Wait on RENDERED TEXT, which is what a screenshot photographs, rather
    // than on a control count the old surface would also satisfy.
    await p.waitForFunction(() => /Invoicing/.test(
      document.querySelector('#deal-payment-rail')?.textContent ?? ''), { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 600)))
  }
  const read = () => p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const box = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null }
    const rail = document.querySelector('#deal-payment-rail')
    const mode = document.querySelector('[data-testid="deal-payment-mode-toggle"]')
    const fact = document.querySelector('[data-testid="deal-factoring-toggle"]')
    const mb = mode?.getBoundingClientRect(), fb = fact?.getBoundingClientRect()
    const cs = (e, k) => e ? getComputedStyle(e)[k] : null
    const rings = [...document.querySelectorAll('#deal-payment-rail .ring-radio-ring')]
      .filter(vis).map((e) => ({ x: e.getBoundingClientRect().left,
        label: e.parentElement?.textContent?.slice(0, 22) ?? '?' }))
    return {
      modeVisible: vis(mode), factVisible: vis(fact),
      modeText: mode?.textContent?.trim() ?? null,
      modeW: mb ? +mb.width.toFixed(1) : null, modeH: mb ? +mb.height.toFixed(1) : null,
      factW: fb ? +fb.width.toFixed(1) : null, factH: fb ? +fb.height.toFixed(1) : null,
      modePadL: cs(mode, 'paddingLeft'), factPadL: cs(fact, 'paddingLeft'),
      modeFont: cs(mode, 'fontSize'), factFont: cs(fact, 'fontSize'),
      // THE SWITCH ITSELF: the track is ::before and the knob is ::after. This
      // is the geometry `.opex-slider` used to override (a 40x16 track and a
      // 10px knob against the factoring toggle's 26x14 and 8px), so it is the
      // dimension "same size" is actually about.
      modeTrack: mode ? `${getComputedStyle(mode, '::before').width}x${getComputedStyle(mode, '::before').height}` : null,
      factTrack: fact ? `${getComputedStyle(fact, '::before').width}x${getComputedStyle(fact, '::before').height}` : null,
      modeKnob: mode ? `${getComputedStyle(mode, '::after').width}x${getComputedStyle(mode, '::after').height}` : null,
      factKnob: fact ? `${getComputedStyle(fact, '::after').width}x${getComputedStyle(fact, '::after').height}` : null,
      flanking: document.querySelectorAll('[data-testid^="deal-mode-label-"]').length,
      rings,
      invInRail: !!rail?.querySelector('#deal-invoicing-toggle'),
      recInRail: !!rail?.querySelector('#deal-recovery-group, #deal-recovery-readonly'),
      invTop: box('#deal-invoicing-toggle')?.top ?? null,
      radiosBottom: box('#deal-structure-toggle')?.bottom ?? null,
      /* ── DOES THE HEADING BELONG TO ITS OWN GROUP? ────────────────────
         Found by opening a screenshot on which all 90 checks were green:
         `INVOICING` rendered flush under the Hybrid radio's explanation and
         read as part of it.

         The requirement is a RELATIONSHIP and is stated as one: a heading must
         sit nearer the radio it introduces than the group it follows. No pixel
         count appears in the assertion, so it survives any future change to the
         rail's spacing and cannot be satisfied by a number read off a result. */
      invLabelGaps: (() => {
        const g = document.querySelector('#deal-invoicing-toggle')
        const prev = document.querySelector('#deal-structure-toggle')
        const label = g?.querySelector('.label')
        const firstRadio = g?.querySelector('.ring-radio')
        if (!g || !label || !firstRadio) return null
        const lb = label.getBoundingClientRect(), rb = firstRadio.getBoundingClientRect()
        const above = prev ? prev.getBoundingClientRect().bottom : null
        return { toOwnRadio: +(rb.top - lb.bottom).toFixed(1),
          toGroupAbove: above === null ? null : +(lb.top - above).toFixed(1) }
      })(),
      invGroups: document.querySelectorAll('[data-invoicing]').length,
      topRow: !!document.querySelector('#deal-top-schedule-row'),
    }
  })
  const shot = async (name) => {
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
    // MEASURE FIRST, CAPTURE SECOND, and capture the PAGE: an element capture
    // suppresses the scrollbar and does not put it back.
    await p.screenshot({ path: `${OUT}${name}.png` })
    return `${OUT}${name}.png`
  }

  /* C_FAST runs ONE combination, for the calibration harness only. The full
     matrix is what proves the build; the fast path is what makes injecting
     into it affordable. The combination chosen is the one carrying every
     assertion - CAPEX/twoPhase shows all five radios, the recovery input and
     both toggles - so nothing a calibration needs is outside it. */
  const FAST = process.env.C_FAST === '1'
  const WIDTHS = FAST ? [1240] : [1440, 1240]
  const COMBOS = FAST ? [['capex', 'twoPhase']] : [['capex', 'twoPhase'], ['capex', 'single'],
    ['capex', 'hybrid'], ['opex', 'single']]
  for (const width of WIDTHS) {
    for (const [mode, structure] of COMBOS) {
      await api('PATCH', `/opportunities/${oppId}`, { payload: { ...base, structure, paymentMode: mode } })
      await land(width)
      const r = await read()
      console.log(`\n── ${width}  ${mode.toUpperCase()} / ${structure} ──`)

      // ── F1 ──────────────────────────────────────────────────────────
      check(r.modeVisible && r.factVisible, 'both toggles are visible (not merely present)')
      /* ── THE FIRST VERSION OF THIS CHECK WAS AIMED AT THE WRONG AXIS ────
         It asserted the two buttons were the same WIDTH and failed at 108.5
         against 185, on a build where the height, padding, font and switch were
         already identical. The gap is the label: `CAPEX` against `FACTORING
         DISABLED`, in an inline-flex button that sizes to its content.

         Forcing those equal would mean padding one control to match the other's
         WORDING, which is not what a shared component is. "Size" for this
         control is the component's own geometry - the height it occupies and
         the switch it draws - and width is a function of the text, in both.
         Verification 33: name the dimensions and assert each, rather than
         asserting "the size" of something that has more than one.

         So the width is still READ and printed, as the thing that legitimately
         differs, and the assertion is on what the component owns. */
      check(Math.abs(r.modeH - r.factH) <= TOL,
        `F1 SAME HEIGHT: mode ${r.modeH} against factoring ${r.factH}`
        + `  (widths ${r.modeW} and ${r.factW}, which are the two labels)`)
      check(r.modeTrack === r.factTrack && r.modeKnob === r.factKnob,
        `F1 SAME SWITCH: track ${r.modeTrack}/${r.factTrack}, knob ${r.modeKnob}/${r.factKnob}`)
      check(r.modePadL === r.factPadL && r.modeFont === r.factFont,
        `F1 same dress: padding ${r.modePadL}/${r.factPadL}, font ${r.modeFont}/${r.factFont}`)
      check(r.flanking === 0, `F1 no flanking labels (${r.flanking})`)
      check(r.modeText === (mode === 'opex' ? 'OPEX' : 'CAPEX'),
        `F1 the control names its mode: "${r.modeText}"`)

      // ── F2 ──────────────────────────────────────────────────────────
      const xs = r.rings.map((g) => g.x)
      const spread = xs.length ? +(Math.max(...xs) - Math.min(...xs)).toFixed(1) : -1
      check(xs.length >= 2 && spread <= TOL,
        `F2 ONE GUTTER across ${xs.length} rings, spread ${spread}px  [${xs.map((v) => v.toFixed(0)).join(', ')}]`)

      // ── F4 ──────────────────────────────────────────────────────────
      check(r.invInRail, 'F4 the invoicing radios are in the rail')
      check(r.invGroups === 2, `F4 exactly one invoicing group (${r.invGroups} radios)`)
      check(!r.topRow, 'F4 the old top schedule row is gone')
      if (structure !== 'hybrid' && mode !== 'opex') {
        check(r.recInRail, 'F4 the recovery period stays with them, in the rail')
      }
      if (r.invLabelGaps && r.invLabelGaps.toGroupAbove !== null) {
        const { toOwnRadio, toGroupAbove } = r.invLabelGaps
        check(toOwnRadio < toGroupAbove,
          `F4 the INVOICING heading belongs to its own group: ${toOwnRadio}px to its radio, `
          + `${toGroupAbove}px to the group above`)
      }
      if (r.radiosBottom !== null && r.invTop !== null) {
        check(r.invTop >= r.radiosBottom,
          `F4 invoicing sits BENEATH the recovery radios (${r.invTop.toFixed(0)} below ${r.radiosBottom.toFixed(0)})`)
      }
      console.log(`    photograph ${await shot(`live-${width}-${mode}-${structure}`)}`)
    }
  }
} finally { await b.close(); await tearDown(TAG) }
console.log(`\n${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
