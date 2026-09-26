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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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

/* ── THE RUN EMITS ITS OWN NUMBERS TO A FILE, AND THE COUNT IS READ FROM IT ─
   Every line this probe prints is teed into `live-run.txt`, and no pass count
   is claimed from a terminal that scrolled. The previous run of this probe
   produced nine screenshots and a pass count that existed nowhere on disk,
   which is a hand-carried number by the time it reaches a report (Evidence:
   every number describing a run is emitted by the run).

   Written in a `catch`/`finally` so a run that THROWS still leaves what it
   measured, and the file states how many states it reached so a partial run
   cannot be read as a complete one. */
const RESULTS = `${OUT}live-run.txt`
const LOG = []
const emit = console.log.bind(console)
console.log = (...a) => { const line = a.map((x) => typeof x === 'string' ? x : String(x)).join(' ')
  LOG.push(line); emit(line) }
const flush = () => { writeFileSync(RESULTS, LOG.join('\n') + '\n') }

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

/* Declared OUT here because the `catch` and the summary both read them, and a
   `let` inside the `try` is not in scope in either. */
let states = 0, STATES = 0, threw = null

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
  STATES = WIDTHS.length * COMBOS.length
  console.log(`sizing live probe   ${new Date().toISOString()}`)
  console.log(`opportunity ${oppId}   tag ${TAG}   fast ${FAST ? 'yes' : 'no'}`)
  console.log(`widths ${WIDTHS.join(', ')}   combos `
    + COMBOS.map(([m, st]) => `${m}/${st}`).join(', ')
    + `   states ${STATES}`)
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
        /* ── THE ROW CLASSES ARE READ FROM THE COMPONENTS, ONE PER RENDERER ─
           Guessed once as `.ys-row` and found nothing, which under the old
           `if` guard made N7 a silent skip. The second guess was no better:
           `YearScheduleView` renders TWO row classes, `.ds-row` when the
           schedule kind is `hybrid` and `.ys-line` otherwise, so fixing the
           hybrid slot left the OPEX slot reporting "not found" - a miss that
           looked like a measurement.

           Each class below names its renderer. Two classes in the first
           version matched NOTHING IN THE ESTATE: `.ys-row` is in the
           stylesheet and in no markup, and `.opex-row` is in neither, so the
           OPEX per-unit row was only ever found by the `tbody tr` fallback.

             .ds-row     YearScheduleView, kind 'hybrid'   panelParts.tsx:59
             .ys-line    YearScheduleView, the year stack  panelParts.tsx:82
             .ms-grid-row  MilestoneGrid
             tbody tr    OpexTable and the install table (real tables) */
        const firstFigure = (root) => { if (!root) return null
          const e = [...root.querySelectorAll('.ds-row, .ys-line, .ms-grid-row, tbody tr')].filter(vis)[0]
          return e ? box(e) : null }
        return {
          inv: box('#deal-invoicing-toggle'), sched: box(sched),
          invTops: [...document.querySelectorAll('#deal-invoicing-toggle .ring-radio')]
            .map((e) => Math.round(e.getBoundingClientRect().top)),
          units: box('#deal-units-card'), install: box('#deal-section-2'),
          /* N1 PAIRS THE ROWS, so it reads every row's top rather than the
             first and a pitch. Pitch is a proxy for "the rest of them line
             up"; the tops ARE the claim.

             THE TOTAL ROW IS NOT A PER-UNIT ROW: the install tbody ends with
             the cost/price total, which has no unit row to pair with. The
             product rows are identified by CARRYING a units cell rather than
             by position, so the pairing survives a row being added. */
          /* ── RE-POINTED BY R-SZ2 TO THE MERGED GRID'S OWN CELLS ───────
             `.unit-card` and `#deal-install-table` are retired. N1's claim is
             unchanged and its subjects are now the two HALVES of one product
             row: the units cell and the rate cell.

             THIS IS STILL A REAL MEASUREMENT AND NOT A TAUTOLOGY, which is
             the thing to check when a claim becomes structural. Two cells of
             one grid row share a track only while they ARE in one grid row:
             an `align-self`, a stray `display: block` on a half, a wrapper
             element reintroduced around either half, or a template that
             stops accounting for every cell all separate them, and the
             calibration injects exactly that. */
          unitRows: [...document.querySelectorAll('[data-testid^="ig-units-"]')]
            .filter(vis).map((e) => Math.round(e.getBoundingClientRect().top)),
          installRows: [...document.querySelectorAll('[data-testid^="ig-rate-"]')]
            .filter(vis).map((e) => Math.round(e.getBoundingClientRect().top)),
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

      /* ── N1: THE TWO ROW LISTS PAIR OFF, ROW BY ROW ─────────────────────
         John, 2026-09-26: the Units card rows top-align with the Installation
         per-unit rows, in the same dress. ASSERTED, not printed - it is what
         this round builds, and a finding the round is about that produces no
         assertion is the shape the N7 silent skip already wore once.

         PAIRED TOPS RATHER THAN A FIRST ROW AND A PITCH. Equal pitch is a
         proxy; the tops are the claim, and at 1920 the pitches differed (68
         against 53) while at 1440 they did not, so a pitch check would have
         passed two thirds of the states the claim fails.

         TWO PIXELS, FOR SUB-PIXEL ROUNDING ONLY: a hairline resolves to 0.5px
         at some device ratios and these tops are read as rounded integers. It
         is not a budget for a layout that nearly aligns. */
      check(geo.unitRows.length > 0 && geo.installRows.length > 0,
        `N1 both row lists are present (${geo.unitRows.length} unit, ${geo.installRows.length} install)`)
      check(geo.unitRows.length === geo.installRows.length,
        `N1 the lists hold the same number of product rows `
        + `(${geo.unitRows.length} unit / ${geo.installRows.length} install)`)
      {
        const off = geo.unitRows.map((u, i) => geo.installRows[i] === undefined ? null
          : geo.installRows[i] - u)
        check(off.length > 0 && off.every((d) => d !== null && Math.abs(d) <= 2),
          `N1 every Units row is level with its Installation row `
          + `(offsets ${JSON.stringify(off)})`)
      }

      /* ── N7: TWO TABLES SHARING A ROW START THEIR FIGURES LEVEL ─────────
         John, 2026-09-26: under Hybrid, and wherever two tables share a row,
         the first figure rows top-align.

         THE SUBJECTS ARE ASSERTED TO EXIST, AND THAT IS THE WHOLE LESSON HERE.
         The first version wrapped both comparisons in `if (a && b)`, so when a
         selector found nothing the checks silently did not run: the suite
         reported 84 of 84 with the string "N7" appearing NOWHERE in it, which
         is a silent skip wearing a pass (Verification 14). The comparison is
         still guarded below, but absence now FAILS on its own line first, so
         the guard cannot hide anything. */
      if (structure === 'hybrid') {
        check(!!geo.msFirst && !!geo.hostFirst,
          `N7 Hybrid: both figure rows were found `
          + `(milestones ${geo.msFirst ? 'found' : 'NOT FOUND'}, `
          + `hosting ${geo.hostFirst ? 'found' : 'NOT FOUND'})`)
        if (geo.msFirst && geo.hostFirst) {
          check(Math.abs(geo.msFirst.t - geo.hostFirst.t) <= 2,
            `N7 Hybrid: milestones and hosting first figure rows are level `
            + `(${Math.round(geo.msFirst.t)} against ${Math.round(geo.hostFirst.t)}, `
            + `offset ${Math.round(geo.msFirst.t - geo.hostFirst.t)}px)`)
        }
      }
      if (mode === 'opex') {
        check(!!geo.opexFirst && !!geo.opexYearFirst,
          `N7 OPEX: both figure rows were found `
          + `(per-unit ${geo.opexFirst ? 'found' : 'NOT FOUND'}, `
          + `yearly ${geo.opexYearFirst ? 'found' : 'NOT FOUND'})`)
        if (geo.opexFirst && geo.opexYearFirst) {
          check(Math.abs(geo.opexFirst.t - geo.opexYearFirst.t) <= 2,
            `N7 OPEX: per-unit and yearly first figure rows are level `
            + `(${Math.round(geo.opexFirst.t)} against ${Math.round(geo.opexYearFirst.t)}, `
            + `offset ${Math.round(geo.opexFirst.t - geo.opexYearFirst.t)}px)`)
        }
      }

      // ── S2: one font per role across the commercial panels ────────────
      const roles = await p.evaluate(() => {
        const one = (sel) => { const e = document.querySelector(sel); if (!e) return null
          const cs = getComputedStyle(e); return `${cs.fontSize} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}` }
        /* ── RE-POINTED BY R-SZ2 ──────────────────────────────────────────
           S2 asks for ONE token per role across the commercial panels. The
           two panels it compared are one grid now, so the comparison that
           still means something is between the grid's COLUMN HEADS and the
           form's FIELD LABELS - the two places the label role is rendered on
           this surface - and between the grid's own two kinds of cell. */
        return {
          unitsLabel: one('#deal-product-grid .ig-head'),
          installLabel: one('#deal-intake-head .form-group label'),
          unitsCell: one('[data-testid^="ig-units-"] input'),
          installCell: one('[data-testid^="ig-rate-"] input'),
        }
      })
      check(!!roles.unitsLabel && !!roles.installLabel && roles.unitsLabel === roles.installLabel,
        `S2 the grid HEAD and the form LABEL fonts are equal (${roles.unitsLabel} / ${roles.installLabel})`)
      check(!!roles.unitsCell && !!roles.installCell && roles.unitsCell === roles.installCell,
        `S2 the units and rate CELL fonts are equal (${roles.unitsCell} / ${roles.installCell})`)
      console.log(`    photograph ${await shot(`live-${width}-${mode}-${structure}`)}`)
      states++
    }
  }
  console.log(`\nnumeric inputs the guard measured across all states: ${seen.size}`)
} catch (e) {
  threw = e
  console.log(`\nTHE RUN THREW, so every count below is over the states it reached:`)
  console.log(String(e && e.stack ? e.stack : e))
} finally { await b.close(); await tearDown(TAG) }
console.log(`\nstates completed: ${states} of ${STATES}`)
console.log(`${pass} of ${pass + fail} checks passed`)
console.log(threw ? `RUN INCOMPLETE` : states === STATES ? `RUN COMPLETE` : `RUN INCOMPLETE`)
console.log(`written by the run to ${RESULTS}`)
flush()
process.exit(fail || threw || states !== STATES ? 1 : 0)
