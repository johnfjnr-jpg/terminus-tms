// ── S1's ESTATE-WIDE GUARD, AND S2, N1/N2, N5, N6, N7 ───────────────────
//
// S1: every numeric input's rendered width sits within 100% to 135% of its
// format string measured IN THAT INPUT'S OWN COMPUTED FONT. Out of band names
// the control and both numbers.
//
// THE MEASUREMENT IS TAKEN IN THE PAGE, in the input's own resolved font,
// because that is the only place the font exists. A width computed in Node
// against an assumed font would be a second reader of the type scale
// (Verification 20) and would agree with the screen only by luck.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('sizing/probe-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { FORMATS, widestValueFor, formatFor } from '../../src/lib/field-formats.js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/sizing/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'sizelive'
const FAST = process.env.C_FAST === '1'
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const { oppId } = await freshOpportunity(TAG)
const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, whtPct: 15, gstPct: 8, fxContingency: 3,
  lumpSumCost: 250000, installResp: 'Terminus Contractor - Per Unit',
  factoring: { enabled: true, ratePct: 2, termMonths: 36, method: 'straight' },
  milestones: [{ month: 1, label: 'Contract start', pct: 40 }],
  contractorMilestones: [{ month: 1, label: 'Contract start', pct: 50 }],
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const land = async (width) => {
    await p.setViewport({ width, height: 2100 })
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
    /* ── WAIT ON A LIVE, VISIBLE CONTROL, AND THE FIRST VERSION DID NOT ────
       It waited on `/Invoicing/` in `document.body.textContent`, which the
       RETIRED `#deal-form-vanilla` block satisfies: that markup is still in the
       document, renders nothing, and carries the same words. The wait returned
       before the Commercials tab had rendered, and the guard then measured a
       page with 148 inputs of which ZERO were visible - and reported "0 of 0
       within band", which is a clean reading from a detector that never ran.

       Verification 7's clause exactly: when a surface is being replaced, the
       old one is the state your wait must not accept. Waiting on a control
       being VISIBLE cannot be satisfied by a corpse. */
    await p.waitForFunction(() => {
      const el = document.querySelector('#deal-ssExisting')
      return !!el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    }, { timeout: 30000 })
    // The fonts decide every measurement below, so the wait is on THEM rather
    // than on a delay that usually covers them.
    await p.evaluate(() => document.fonts?.ready ?? Promise.resolve())
    await p.evaluate(() => new Promise((r) => setTimeout(r, 700)))
  }
  const measureAll = (formats) => p.evaluate((FMT) => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const dead = (e) => !!e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
    const c = document.createElement('canvas').getContext('2d')
    return [...document.querySelectorAll('input')]
      .filter((e) => vis(e) && !dead(e))
      .map((e) => {
        const key = e.id || e.getAttribute('data-testid') || ''
        const spec = FMT[key]
        if (!spec) return null
        const cs = getComputedStyle(e)
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        return {
          key, w: e.getBoundingClientRect().width,
          fmt: spec.format,
          specW: c.measureText(spec.spec).width,
          valueW: c.measureText(spec.widest).width,
          font: `${cs.fontSize} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`,
        }
      }).filter(Boolean)
  }, formats)
  const shot = async (name) => {
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
    await p.screenshot({ path: `${OUT}${name}.png` })
    return `${OUT}${name}.png`
  }

  // The registry, flattened for the page: one object, sent once.
  const formats = {}
  const KNOWN = [
    'deal-ssExisting', 'deal-ssNew', 'deal-aqm', 'deal-hemir', 'deal-duration',
    'deal-recoveryMonths', 'deal-factoring-termMonths', 'deal-targetMargin',
    'deal-warrantyPct', 'deal-whtPct', 'deal-gstPct', 'deal-fxContingency',
    'deal-factoring-ratePct', 'deal-lumpCost', 'deal-inSsExisting', 'deal-inSsNew',
    'deal-inAqm', 'deal-inHemir',
    ...['hwSs', 'hwSsNew', 'hwAq', 'hwHemir', 'hwWarranty', 'inSsEx', 'inSsNew', 'inAqm', 'inHemir', 'hoSs', 'hoAq', 'hoHemir']
      .map((k) => `deal-margin-${k}`),
    ...[0, 1, 2, 3, 4].flatMap((i) => [`deal-ms-${i}-month`, `deal-ms-${i}-pct`, `deal-ms-${i}-usd`,
      `deal-cm-${i}-month`, `deal-cm-${i}-pct`, `deal-cm-${i}-usd`]),
    ...['ss', 'aq', 'hemir'].flatMap((k) => [`deal-opexfee-${k}`, `deal-opexmargin-${k}`, `deal-opexunits-${k}`]),
  ]
  for (const id of KNOWN) {
    const f = formatFor(id)
    if (f) formats[id] = { format: f, spec: FORMATS[f], widest: widestValueFor(f) }
  }

  const COMBOS = FAST ? [['capex', 'twoPhase']]
    : [['capex', 'twoPhase'], ['capex', 'hybrid'], ['opex', 'twoPhase']]
  const WIDTHS = FAST ? [1440] : [1920, 1440, 1240]
  const seen = new Set()
  for (const width of WIDTHS) {
    for (const [mode, structure] of COMBOS) {
      /* FACTORING FOLLOWS THE MODE'S STATE, so N5's colour comparison is
         between two toggles in the SAME state. Comparing an `is-on` toggle
         with an off one reads as a colour mismatch and says nothing about
         whether the two controls share a dress. */
      const fxOn = mode === 'opex'
      await api('PATCH', `/opportunities/${oppId}`, { payload: { ...base, structure, paymentMode: mode,
        factoring: { enabled: fxOn, ratePct: 2, termMonths: 36, method: 'straight' } } })
      await land(width)
      console.log(`\n── ${width}  ${mode.toUpperCase()} / ${structure} ──`)
      const rows = await measureAll(formats)
      let band = 0, out = []
      for (const r of rows) {
        seen.add(r.key)
        const ratio = r.w / r.specW
        if (ratio >= 1 && ratio <= 1.35) band++
        else out.push(`${r.key} is ${Math.round(r.w)}px against a ${Math.round(r.specW)}px `
          + `"${FORMATS[r.fmt]}" = ${Math.round(ratio * 100)}%`)
        // AND IT MUST HOLD THE VALUE, which the band alone does not guarantee:
        // a digit is wider than an `x`, so 100% of the format string can clip.
        if (r.w < r.valueW) out.push(`${r.key} is ${Math.round(r.w)}px and its widest value `
          + `needs ${Math.round(r.valueW)}px, so it CLIPS`)
      }
      check(rows.length > 0, `S1 the guard sees numeric inputs at all (${rows.length})`)
      check(out.length === 0, `S1 every numeric input within 100-135% of its format`
        + (out.length ? `\n         ${out.join('\n         ')}` : ` (${band} of ${rows.length})`))

      // ── N5: the mode control's track and knob ARE the factoring one's ──
      const tog = await p.evaluate(() => {
        const g = (s, w) => { const e = document.querySelector(s); if (!e) return null
          const cs = getComputedStyle(e, w)
          return `${cs.width}x${cs.height} r${cs.borderTopLeftRadius} left:${cs.left}` }
        const col = (s, w) => { const e = document.querySelector(s); if (!e) return null
          const cs = getComputedStyle(e, w); return `${cs.backgroundColor}|${cs.borderTopColor}` }
        const M = '[data-testid="deal-payment-mode-toggle"]', F = '[data-testid="deal-factoring-toggle"]'
        return { mTrack: g(M, '::before'), fTrack: g(F, '::before'),
          mKnob: g(M, '::after'), fKnob: g(F, '::after'),
          mTrackCol: col(M, '::before'), fTrackCol: col(F, '::before'),
          mKnobCol: col(M, '::after'), fKnobCol: col(F, '::after'),
          sTrack: g('[data-testid="deal-method-toggle"]', '::before'),
          sKnob: g('[data-testid="deal-method-toggle"]', '::after') }
      })
      check(tog.mTrack === tog.fTrack, `N5 the mode TRACK equals the factoring track (${tog.mTrack} / ${tog.fTrack})`)
      check(tog.mKnob === tog.fKnob, `N5 the mode KNOB equals the factoring knob (${tog.mKnob} / ${tog.fKnob})`)
      check(tog.mTrackCol === tog.fTrackCol && tog.mKnobCol === tog.fKnobCol,
        `N5 the colours match (${tog.mTrackCol} / ${tog.fTrackCol})`)
      // ONLY WHEN IT EXISTS. M11 removes it with factoring off, and a null
      // compared to a null passes while asserting nothing (Verification 14).
      if (fxOn) {
        check(!!tog.sTrack && tog.sTrack === tog.fTrack && tog.sKnob === tog.fKnob,
          `N5 the repayment selector matches too (${tog.sTrack} / ${tog.fTrack})`)
      }

      // ── N6: invoicing ABOVE the money ─────────────────────────────────
      const geo = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const box = (s) => { const e = typeof s === 'string' ? document.querySelector(s) : s
          if (!e) return null; const r = e.getBoundingClientRect()
          return { t: r.top, b: r.bottom, l: r.left, r: r.right } }
        const sched = [...document.querySelectorAll('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')]
          .filter(vis)[0]
        const firstFigure = (root) => { if (!root) return null
          const e = [...root.querySelectorAll('.ys-row, .ms-grid-row, tbody tr, .opex-row')].filter(vis)[0]
          return e ? box(e) : null }
        return {
          inv: box('#deal-invoicing-toggle'), sched: box(sched),
          invTops: [...document.querySelectorAll('#deal-invoicing-toggle .ring-radio')]
            .map((e) => Math.round(e.getBoundingClientRect().top)),
          units: box('#deal-units-card'), install: box('#deal-section-2'),
          unitRow1: box('.unit-cards .unit-card:not(.unit-card--head)'),
          installRow1: (() => { const t = document.querySelector('#deal-section-2 tbody tr')
            return t ? box(t) : null })(),
          // THE PITCH IS THE SECOND TERM N1 NEEDS: aligning the first rows is
          // a spacing fix, keeping EVERY subsequent row level is a shared row
          // grid. Measured so the report can say which.
          unitPitch: (() => { const r = [...document.querySelectorAll('.unit-cards .unit-card:not(.unit-card--head)')]
            return r.length > 1 ? Math.round(r[1].getBoundingClientRect().top - r[0].getBoundingClientRect().top) : null })(),
          installPitch: (() => { const r = [...document.querySelectorAll('#deal-section-2 tbody tr')]
            return r.length > 1 ? Math.round(r[1].getBoundingClientRect().top - r[0].getBoundingClientRect().top) : null })(),
          msFirst: firstFigure(document.querySelector('#deal-milestones-tbody')),
          hostFirst: firstFigure(document.querySelector('#deal-hybrid-schedule')),
          opexFirst: firstFigure(document.querySelector('#deal-opex-table')),
          opexYearFirst: firstFigure(document.querySelector('#deal-opex-year-slot')),
        }
      })
      if (geo.inv && geo.sched) {
        check(geo.inv.b <= geo.sched.t + 2,
          `N6 invoicing renders ABOVE the money (${Math.round(geo.inv.b)} above ${Math.round(geo.sched.t)})`)
      }
      check(geo.invTops.length === 2 && new Set(geo.invTops).size === 1,
        `N6 the invoicing radios are horizontal (${JSON.stringify(geo.invTops)})`)

      /* ── N1 IS MEASURED AND NOT ASSERTED, AND THE REPORT SAYS WHY ───────
         N1 asks the Units rows to top-align with the Installation panel's
         per-unit lines, "each subsequent row level". Measured, that is not a
         spacing fix: the two lists differ in BOTH terms.

         The numbers are printed on every run so the finding stays measured
         rather than remembered. An assertion here would be red for something
         deliberately not built, which would gate the round on a scope
         discovery rather than report it. */
      if (geo.unitRow1 && geo.installRow1) {
        console.log(`    N1 MEASURED, NOT BUILT: first unit row at ${Math.round(geo.unitRow1.t)}, `
          + `first install row at ${Math.round(geo.installRow1.t)}, `
          + `offset ${Math.round(geo.installRow1.t - geo.unitRow1.t)}px`)
        console.log(`       row pitch: units ${geo.unitPitch ?? '?'}px, install ${geo.installPitch ?? '?'}px`)
      }

      // ── N7: two tables sharing a row start their figures level ────────
      if (structure === 'hybrid' && geo.msFirst && geo.hostFirst) {
        check(Math.abs(geo.msFirst.t - geo.hostFirst.t) <= 4,
          `N7 Hybrid: milestones and hosting first figure rows are level `
          + `(${Math.round(geo.msFirst.t)} against ${Math.round(geo.hostFirst.t)})`)
      }
      if (mode === 'opex' && geo.opexFirst && geo.opexYearFirst) {
        check(Math.abs(geo.opexFirst.t - geo.opexYearFirst.t) <= 4,
          `N7 OPEX: per-unit and yearly first figure rows are level `
          + `(${Math.round(geo.opexFirst.t)} against ${Math.round(geo.opexYearFirst.t)})`)
      }

      // ── S2: one font per role across the commercial panels ────────────
      const roles = await p.evaluate(() => {
        const one = (sel) => { const e = document.querySelector(sel); if (!e) return null
          const cs = getComputedStyle(e); return `${cs.fontSize} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}` }
        return {
          unitsLabel: one('.unit-cards .unit-card .deal-field-label, .unit-cards .unit-card label span'),
          installLabel: one('#deal-section-2 label'),
          unitsCell: one('.unit-cards .unit-card input'),
          installCell: one('#deal-section-2 tbody input'),
        }
      })
      check(roles.unitsLabel && roles.installLabel && roles.unitsLabel === roles.installLabel,
        `S2 the Units and Installation LABEL fonts are equal (${roles.unitsLabel} / ${roles.installLabel})`)
      check(roles.unitsCell && roles.installCell && roles.unitsCell === roles.installCell,
        `S2 the Units and Installation CELL fonts are equal (${roles.unitsCell} / ${roles.installCell})`)
      console.log(`    photograph ${await shot(`live-${width}-${mode}-${structure}`)}`)
    }
  }
  console.log(`\nnumeric inputs the guard measured across all states: ${seen.size}`)
} finally { await b.close(); await tearDown(TAG) }
console.log(`\n${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
