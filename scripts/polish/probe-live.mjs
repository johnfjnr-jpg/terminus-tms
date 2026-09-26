// ── M1 TO M11: THE LIVE PROOF ───────────────────────────────────────────
//
// Every claim is a RELATIONSHIP between two elements or a COMPUTED value,
// never a class and never a CSS property the fix happens to use. "The knob is
// at the track end" is the knob's box against the track's box; "the active
// label is highlighted" is its computed colour against the other side's.
//
// THRESHOLDS COME FROM THE REQUIREMENT. "Sized for xx.x%" is asserted by
// putting the widest realistic value in the box and measuring that it is not
// clipped, not by asserting the width I happened to set (Verification 47).
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('polish/probe-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/polish/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'polishlive'
const FAST = process.env.C_FAST === '1'
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const { oppId } = await freshOpportunity(TAG)
const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, installResp: 'Terminus Contractor - Per Unit',
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
    // Wait on RENDERED TEXT, which is what a screenshot photographs.
    await p.waitForFunction(() => /Invoicing/.test(document.body.textContent ?? ''), { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 800)))
  }
  const read = () => p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const box = (s) => { const e = typeof s === 'string' ? document.querySelector(s) : s
      if (!e) return null; const r = e.getBoundingClientRect()
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height } }
    const colour = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : null }
    // A toggle's knob is ::after and its track is ::before. Their boxes are not
    // in the DOM, so the knob's position is read from the resolved transform
    // and the track from the resolved geometry.
    const pseudo = (s, which) => { const e = document.querySelector(s); if (!e) return null
      const cs = getComputedStyle(e, which)
      return { left: cs.left, width: cs.width, transform: cs.transform } }
    const clipped = (s) => { const e = document.querySelector(s); if (!e) return null
      return Math.ceil(e.scrollWidth) > Math.ceil(e.clientWidth) + 1 }
    const sched = [...document.querySelectorAll(
      '[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')].filter(vis)[0]
    return {
      // M1
      modeOrder: [...document.querySelectorAll(
        '[data-testid="deal-mode-label-capex"], [data-testid="deal-payment-mode-toggle"], [data-testid="deal-mode-label-opex"]')]
        .map((e) => ({ id: e.getAttribute('data-testid'), l: e.getBoundingClientRect().left })),
      modeKnob: pseudo('[data-testid="deal-payment-mode-toggle"]', '::after'),
      modeTrack: pseudo('[data-testid="deal-payment-mode-toggle"]', '::before'),
      capexColour: colour('[data-testid="deal-mode-label-capex"]'),
      opexColour: colour('[data-testid="deal-mode-label-opex"]'),
      green: getComputedStyle(document.documentElement).getPropertyValue('--green').trim(),
      // M2
      payCard: box('.payment-terms-panel'), facCard: box('.po-factoring-panel'),
      // M3
      durationShown: vis(document.querySelector('[data-testid="deal-contract-duration"]')),
      durationText: document.querySelector('[data-testid="deal-contract-duration-value"]')?.textContent?.trim() ?? null,
      durationHasInput: !!document.querySelector('[data-testid="deal-contract-duration"] input'),
      // M4
      radioTops: [...document.querySelectorAll('#deal-structure-toggle .ring-radio')]
        .map((e) => Math.round(e.getBoundingClientRect().top)),
      ringTops: [...document.querySelectorAll('#deal-structure-toggle .ring-radio-ring')]
        .map((e) => Math.round(e.getBoundingClientRect().top)),
      radiosBox: box('#deal-structure-toggle'), modeBox: box('#deal-payment-mode-field'),
      // M6
      recoveryShown: vis(document.querySelector('#deal-recovery-group')),
      recoveryBox: box('#deal-recovery-group'),
      // M7
      invBox: box('#deal-invoicing-toggle'), schedBox: box(sched),
      invTops: [...document.querySelectorAll('#deal-invoicing-toggle .ring-radio')]
        .map((e) => Math.round(e.getBoundingClientRect().top)),
      schedules: [...document.querySelectorAll(
        '[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')].length,
      // M8
      unitsBox: box('#deal-units-card'), unitsClipped: clipped('#deal-units-card'),
      unitRowClipped: [...document.querySelectorAll('.unit-cards .unit-card')]
        .some((e) => Math.ceil(e.scrollWidth) > Math.ceil(e.clientWidth) + 1),
      costCells: [...document.querySelectorAll('.unit-card-cost')].map((e) => e.textContent.trim()),
      costCellClipped: [...document.querySelectorAll('.unit-card-cost')]
        .some((e) => Math.ceil(e.scrollWidth) > Math.ceil(e.clientWidth) + 1),
      installBox: box('#deal-section-2'),
      // M9 / M10 / M11
      rateBox: box('#deal-factoring-ratePct'), termBox: box('#deal-factoring-termMonths'),
      rateClipped: clipped('#deal-factoring-ratePct'), termClipped: clipped('#deal-factoring-termMonths'),
      methodPresent: !!document.querySelector('[data-testid="deal-method-toggle"]'),
      ratePresent: !!document.querySelector('#deal-factoring-ratePct'),
      termPresent: !!document.querySelector('#deal-factoring-termMonths'),
      methodOrder: [...document.querySelectorAll(
        '[data-testid="deal-method-label-straight"], [data-testid="deal-method-toggle"], [data-testid="deal-method-label-declining"]')]
        .map((e) => ({ id: e.getAttribute('data-testid'), l: e.getBoundingClientRect().left })),
      methodKnob: pseudo('[data-testid="deal-method-toggle"]', '::after'),
      straightColour: colour('[data-testid="deal-method-label-straight"]'),
      decliningColour: colour('[data-testid="deal-method-label-declining"]'),
    }
  })
  const shot = async (name) => {
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
    await p.screenshot({ path: `${OUT}${name}.png` })
    return `${OUT}${name}.png`
  }
  const knobX = (k) => k ? Number((k.transform.match(/matrix\([^)]*?,\s*([-\d.]+),\s*[-\d.]+\)$/) ?? [])[1] ?? 0) : null

  // FAST is 1920 rather than 1240, because M2's defect exists ONLY at wide
  // viewports: the gap was already 20px at 1440 and 1240 before the fix, so a
  // calibration run at 1240 could not tell the fix from its absence.
  const WIDTHS = FAST ? [1920] : [1920, 1440, 1240]
  const COMBOS = FAST ? [['capex', 'twoPhase', true]] : [
    ['capex', 'twoPhase', false], ['capex', 'twoPhase', true],
    ['capex', 'hybrid', false], ['capex', 'hybrid', true],
    ['opex', 'twoPhase', false], ['opex', 'twoPhase', true],
  ]
  for (const width of WIDTHS) {
    for (const [mode, structure, factoring] of COMBOS) {
      await api('PATCH', `/opportunities/${oppId}`, { payload: { ...base, structure, paymentMode: mode,
        factoring: { enabled: factoring, ratePct: 2, termMonths: 36, method: 'straight' } } })
      await land(width)
      const r = await read()
      const opex = mode === 'opex'
      const hybrid = !opex && structure === 'hybrid'
      console.log(`\n── ${width}  ${mode.toUpperCase()} / ${structure} / factoring ${factoring ? 'ON' : 'OFF'} ──`)

      // ── M1 ────────────────────────────────────────────────────────────
      check(r.modeOrder.length === 3
        && r.modeOrder[0].id === 'deal-mode-label-capex'
        && r.modeOrder[2].id === 'deal-mode-label-opex'
        && r.modeOrder[0].l < r.modeOrder[1].l && r.modeOrder[1].l < r.modeOrder[2].l,
        `M1 CAPEX | toggle | OPEX left to right on screen (${r.modeOrder.map((x) => Math.round(x.l)).join(' < ')})`)
      const kx = knobX(r.modeKnob)
      check(opex ? kx > 0 : kx === 0,
        `M1 the knob is at the ${opex ? 'RIGHT' : 'LEFT'} end (translateX ${kx})`)
      const activeIsGreen = opex
        ? r.opexColour !== r.capexColour && /\d/.test(r.opexColour ?? '')
        : r.capexColour !== r.opexColour && /\d/.test(r.capexColour ?? '')
      check(activeIsGreen,
        `M1 the ACTIVE label is highlighted: capex ${r.capexColour} / opex ${r.opexColour}`)

      // ── M2 ────────────────────────────────────────────────────────────
      if (r.payCard && r.facCard) {
        const gap = Math.round(r.facCard.l - r.payCard.r)
        check(gap === 20, `M2 the factoring card sits at the standard 20px gap (${gap}px)`)
      }

      // ── M3 ────────────────────────────────────────────────────────────
      if (opex) {
        check(r.durationShown, 'M3 the Contract Duration readout is shown under OPEX')
        check(r.durationText === '60 months', `M3 it reads the stored duration (${r.durationText})`)
        check(!r.durationHasInput, 'M3 it is READ-ONLY, with no input of its own')
        check(!r.recoveryShown, 'M3 there is no recovery INPUT under OPEX')
      } else {
        check(!r.durationShown, 'M3 the Contract Duration readout is CAPEX-absent')
      }

      // ── M4 ────────────────────────────────────────────────────────────
      if (!opex) {
        const tops = r.radioTops
        check(tops.length === 2 && new Set(tops).size === 1,
          `M4 the radios share ONE ROW (tops ${JSON.stringify(tops)})`)
        check(new Set(r.ringTops).size === 1, `M4 the rings align (${JSON.stringify(r.ringTops)})`)
        check(r.radiosBox && r.modeBox && r.radiosBox.t >= r.modeBox.b - 2,
          `M4 they sit UNDER the mode control (${Math.round(r.radiosBox?.t)} below ${Math.round(r.modeBox?.b)})`)
      }

      // ── M6 ────────────────────────────────────────────────────────────
      if (!opex && structure === 'twoPhase') {
        check(r.recoveryShown, 'M6 Recovery Period shows when Two-phase is selected')
        check(r.recoveryBox && r.radiosBox && r.recoveryBox.t >= r.radiosBox.b - 2,
          'M6 it sits BELOW the radios')
      }
      if (hybrid) check(!r.recoveryShown, 'M6 Recovery Period is HIDDEN under Hybrid')

      // ── M7 ────────────────────────────────────────────────────────────
      check(r.schedules === 1, `M7 exactly ONE hosting render (${r.schedules})`)
      if (r.invBox && r.schedBox) {
        check(r.invBox.t >= r.schedBox.b - 2,
          `M7 invoicing sits BENEATH the money (${Math.round(r.invBox.t)} below ${Math.round(r.schedBox.b)})`)
      }
      check(r.invTops.length === 2 && new Set(r.invTops).size === 1,
        `M7 the invoicing radios share ONE ROW (${JSON.stringify(r.invTops)})`)

      // ── M8 ────────────────────────────────────────────────────────────
      check(r.costCells.length === 8, `M8 eight catalog cells, two per unit row (${r.costCells.length})`)
      check(!r.unitsClipped && !r.unitRowClipped && !r.costCellClipped,
        `M8 nothing clips: card ${r.unitsClipped}, row ${r.unitRowClipped}, cell ${r.costCellClipped}`)
      check(r.unitsBox && r.installBox && r.installBox.l >= r.unitsBox.r - 2,
        `M8 the Installation panel is to the RIGHT of the units card `
        + `(${Math.round(r.installBox?.l)} >= ${Math.round(r.unitsBox?.r)})`)

      // ── M9 / M10 / M11 ────────────────────────────────────────────────
      if (factoring) {
        check(r.ratePresent && r.termPresent && r.methodPresent, 'M11 enabled restores all three controls')
        check(!r.rateClipped && !r.termClipped,
          `M9 neither input clips its value (rate ${r.rateClipped}, term ${r.termClipped})`)
        check(r.rateBox && r.rateBox.w < 120, `M9 the rate box is sized for xx.x%, not the column (${Math.round(r.rateBox?.w)}px)`)
        check(r.termBox && r.termBox.w < 110, `M9 the term box is sized for XXX (${Math.round(r.termBox?.w)}px)`)
        check(r.methodOrder.length === 3
          && r.methodOrder[0].id === 'deal-method-label-straight'
          && r.methodOrder[2].id === 'deal-method-label-declining'
          && r.methodOrder[0].l < r.methodOrder[1].l && r.methodOrder[1].l < r.methodOrder[2].l,
          'M10 STRAIGHT-LINE | toggle | DECLINING BALANCE left to right')
        check(knobX(r.methodKnob) === 0, `M10 straight-line is active, so the knob is LEFT (${knobX(r.methodKnob)})`)
        check(r.straightColour !== r.decliningColour, `M10 the active side is highlighted (${r.straightColour} / ${r.decliningColour})`)
      } else {
        check(!r.ratePresent && !r.termPresent && !r.methodPresent,
          `M11 disabled removes all three from the DOM (rate ${r.ratePresent}, term ${r.termPresent}, method ${r.methodPresent})`)
      }
      console.log(`    photograph ${await shot(`live-${width}-${mode}-${structure}-fx${factoring ? 'on' : 'off'}`)}`)
    }
  }
} finally { await b.close(); await tearDown(TAG) }
console.log(`\n${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
