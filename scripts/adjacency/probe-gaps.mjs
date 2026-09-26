// ── A1: THE LABEL-TO-FIGURE GAP, ESTATE-WIDE ─────────────────────────────
//
// John's finding, 2026-09-26: a row that pairs a label with figures must keep
// the label and the figures ADJACENT. The merged per-product grid stretched its
// label column to the panel, so a product name and its unit count sat most of a
// screen apart.
//
// THE ROWS ARE FOUND BY STRUCTURE, NOT BY NAME. Verification 19: an enumeration
// by class name fails on the unrecorded instance, and this guard exists because
// a NEW grid went wrong. A row qualifies when its first cell is a non-numeric
// label and some later cell in the same row is a figure. Any container holding
// such rows is walked, whatever it is called.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('adjacency/probe-gaps.mjs')
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/adjacency/`
mkdirSync(OUT, { recursive: true })
const RESULTS = `${OUT}gaps-run.txt`
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'adjgap'
const FAST = process.env.C_FAST === '1'
/* ── A1's TWO CLAUSES, DERIVED IN THE BRIEF FROM THE ESTATE'S OWN ROWS ────
   INVARIANCE is the operative rule: every row the estate ships is content-sized
   and its gap is the same at 1920, 1440 and 1240. Only a row sized to the PANEL
   drifts, which is the defect.
   BACKSTOP is the number A1 asks for, set above the estate's worst shipped row
   (the C2 statement's achieved-margin line at 570px) and below the defect. */
/* ── SUPERSEDED, QUOTED NOT DELETED: `INVARIANCE = 8`, "every row the estate
   ships is content-sized and constant within 8px across the three widths".
   MEASURED, THAT IS FALSE. Rows reflow at 1240 and several move: `pg-row`
   reads 84/84/284, `ds-row` 191/191/119, `stmt-row-line` 570/570/510. A spread
   rule flags most of the deal screen, none of which is a named finding.

   THE DISCRIMINATOR IS DIRECTION, NOT SPREAD. The defect GROWS WITH THE PANEL,
   42 -> 171 -> 651 and 477 -> 677 -> 1157: more width, more gap. The estate's
   rows grow at the NARROW end, where a label wraps, which is a reflow and not
   a row sized to its container. Positive growth across the full 680px of width
   range tops out at +72px on `ds-row`; the defect is +609 and +680. */
const GROWTH = Number(process.env.C_GROWTH ?? 100)
const BACKSTOP = Number(process.env.C_BACKSTOP ?? 600)

let pass = 0, fail = 0
const LOG = []
const emit = console.log.bind(console)
console.log = (...a) => { const l = a.map((x) => typeof x === 'string' ? x : String(x)).join(' ')
  LOG.push(l); emit(l) }
const flush = () => { writeFileSync(RESULTS, LOG.join('\n') + '\n') }
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const { oppId } = await freshOpportunity(TAG)
const base = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, whtPct: 15, gstPct: 8, fxContingency: 3,
  lumpSumCost: 250000,
  factoring: { enabled: true, ratePct: 2, termMonths: 36, method: 'straight' },
  milestones: [{ month: 1, label: 'Contract start', pct: 40 }],
  contractorMilestones: [{ month: 1, label: 'Contract start', pct: 50 }],
}

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
    await p.waitForFunction(() => {
      const el = document.querySelector('#deal-ssExisting')
      return !!el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    }, { timeout: 30000 })
    await p.evaluate(() => document.fonts?.ready ?? Promise.resolve())
    await p.evaluate(() => new Promise((r) => setTimeout(r, 700)))
  }

  const shot = async (name) => {
    await p.evaluate(() => document.querySelector('#deal-product-grid')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
    await p.screenshot({ path: `${OUT}${name}.png` })
  }
  /* MEASURE FIRST, CAPTURE SECOND, and never photograph the element whose own
     geometry is the claim: Puppeteer suppresses the scrollbar for an element
     capture and does not put it back. These are PAGE captures, taken after
     every measurement in the state. */
  const shotAt = async (sel, name) => {
    const found = await p.evaluate((s) => {
      const e = document.querySelector(s)
      if (!e) return false
      e.scrollIntoView({ block: 'center' })
      return true
    }, sel)
    if (!found) return
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
    await p.screenshot({ path: `${OUT}${name}.png` })
  }
  const walk = () => p.evaluate(() => {
    const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const dead = (e) => !!e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
    const txt = (e) => (e.textContent ?? '').trim()
    /* A FIGURE IS A NUMBER OR A BOX THAT HOLDS ONE. Both count, because half
       these rows are read-only cells and half are inputs, and a rule that saw
       only one kind would pass the grid this guard was written for. */
    const FIG = /^[$(\-]?\s*[\d,]+(\.\d+)?\s*%?\)?$/
    const isFigure = (e) => {
      const i = e.querySelector('input')
      if (i) return true
      const t = txt(e)
      return t.length > 0 && t.length < 24 && (FIG.test(t) || t === '—' || t === '-')
    }
    const isLabel = (e) => {
      if (e.querySelector('input, select')) return false
      const t = txt(e)
      return t.length > 1 && !FIG.test(t)
    }
    /* ── A CELL IS A LEAF, AND THIS IS WHAT THE FIRST RUN GOT WRONG ────────
       It reported an 808px offender, `lead-card-body tb-top-row`, which is the
       opportunity band: a GRID OF CARDS. The walker chunked whole panels into
       a "row", took the Summary card's heading as a label and something inside
       the Notes panel as a figure, and measured the distance between two
       unrelated components.

       Checked before excluding it, rather than assumed to be another screen: it
       is genuinely inside `#view-opportunity-detail`, so scoping the walk did
       not and should not have removed it. What disqualifies it is that its
       cells are CONTAINERS, and a row pairing a label with figures has cells
       that hold a value and nothing else. */
    const leaf = (e) => {
      const kids = e.querySelectorAll('*')
      if (kids.length > 6) return false
      for (const k of kids) {
        if (k.tagName === 'TABLE') return false
        const d = getComputedStyle(k).display
        if (d === 'grid' || d === 'table') return false
      }
      return true
    }
    const rowsOf = (c) => {
      // A row is a run of sibling cells. Tables give it directly; grids and
      // flex rows give it by their own children.
      if (c.tagName === 'TABLE') return [...c.querySelectorAll('tbody tr')].map((r) => [...r.children])
      const cs = getComputedStyle(c)
      const kids = [...c.children].filter(vis)
      /* FLEX ROWS COUNT. The first version took grids only, and the statement
         lines and the yearly stack are flex, so the two structures A1's bound
         is supposed to be DERIVED FROM were not in the population at all. */
      if (cs.display === 'flex' && cs.flexDirection.startsWith('row')) {
        return kids.length >= 2 ? [kids] : []
      }
      if (cs.display !== 'grid') return []
      const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length
      if (cols < 2) return []
      const out = []
      for (let i = 0; i + cols <= kids.length; i += cols) out.push(kids.slice(i, i + cols))
      return out
    }
    const seen = new Map()
    /* ── SCOPED TO THE VIEW UNDER TEST, NOT THE DOCUMENT ────────────────
       The first run reported a 598px offender called `lead-card-body
       tb-top-row`, which is the LEADS card: this app is one document with
       several screens resident at once, so a document-wide walk answers for
       whatever is in the DOM (Verification 25's population clause). */
    const root = document.querySelector('#view-opportunity-detail') ?? document
    const containers = [...root.querySelectorAll('table, div')].filter((e) => vis(e) && !dead(e))
    for (const c of containers) {
      let rows
      try { rows = rowsOf(c) } catch { continue }
      if (!rows.length) continue
      for (const cells of rows) {
        if (cells.length < 2) continue
        /* ── THE LABEL IS THE FIRST CELL THAT IS ONE, NOT CELL ZERO ────────
           `cells[0]` looked obviously right and rejected all fourteen visible
           C2 statement rows, which are one of the two structures A1's bound is
           derived from. `.stmt-row-line` leads with an EXPANDER cell holding a
           chevron, so the label is the second cell. A leading icon, twisty or
           spacer cell is common enough that position is the wrong rule. */
        const li = cells.findIndex((x) => vis(x) && isLabel(x) && leaf(x))
        if (li < 0) continue
        const label = cells[li]
        const fig = cells.slice(li + 1).find((x) => vis(x) && leaf(x) && isFigure(x))
        if (!fig) continue
        /* ── THE GAP IS FROM THE LABEL'S TEXT, NOT FROM ITS CELL ──────────
           The first version measured cell to cell and reported the merged
           product grid at 16px while a product name sat most of a screen from
           its unit count. A STRETCHED LABEL CELL KEEPS ITS CELL GAP: the box
           runs to meet the figure and the text stops far short, so the cell
           measure is blind to exactly the fault this guard exists for
           (Verification 33, a measure aimed at the wrong axis).

           The text's own right edge comes from a Range over the label's text
           nodes, which is where the reader's eye actually leaves the label. */
        const textRight = (e) => {
          let best = null
          const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            if (!n.nodeValue || !n.nodeValue.trim()) continue
            const r = document.createRange(); r.selectNodeContents(n)
            const b = r.getBoundingClientRect()
            if (b.width > 0 && (best === null || b.right > best)) best = b.right
          }
          return best
        }
        const lb = label.getBoundingClientRect(), fb = fig.getBoundingClientRect()
        const lr = textRight(label) ?? lb.right
        if (fb.left < lr) continue // stacked or overlapping, not a gap
        const gap = Math.round(fb.left - lr)
        const key = c.id || c.className || c.tagName
        if (!seen.has(key)) seen.set(key, { key, rows: 0, min: Infinity, max: -Infinity, sample: '' })
        const s = seen.get(key)
        s.rows++
        if (gap < s.min) s.min = gap
        if (gap > s.max) { s.max = gap; s.sample = txt(label).slice(0, 30) }
      }
    }
    return [...seen.values()].sort((a, z) => z.max - a.max)
  })

  /* Both responsibility states, both factoring states, and every
     mode/structure combination the brief names. */
  /* ── FAST REACHES EVERY STATE THE CALIBRATION INJECTS INTO ──────────────
     It was one combo, capex/twoPhase/Per Unit, and four of six injections came
     back SILENT because of it: the lump-sum field is HIDDEN under Per Unit so
     A4 had nothing to measure, the OPEX placement is not rendered under CAPEX
     so A5's injection touched a rule no state used, and the statement's worst
     row only exceeds the backstop in the states this combo is not. Verification
     51's caveat: confirm an injection COULD have fired before reading its
     silence. Three combos and two widths cover all six. */
  const COMBOS = FAST ? [['capex', 'twoPhase', 'Terminus Contractor - Per Unit', true],
      ['opex', 'twoPhase', 'Terminus Contractor - Per Unit', true],
      ['capex', 'twoPhase', 'Terminus Contractor - Lump Sum', true]]
    : [['capex', 'twoPhase', 'Terminus Contractor - Per Unit', true],
      ['capex', 'hybrid', 'Terminus Contractor - Per Unit', true],
      ['opex', 'twoPhase', 'Terminus Contractor - Per Unit', true],
      ['capex', 'twoPhase', 'Terminus Contractor - Lump Sum', true],
      ['capex', 'twoPhase', 'Terminus Contractor - Per Unit', false]]
  /* FAST KEEPS TWO WIDTHS, because A1's operative clause compares the SAME row
     at the widest and the narrowest. At one width the growth check has nothing
     to compare and skips, so a calibration of it would inject into a check that
     never ran and score the silence as a missing detector. */
  const WIDTHS = FAST ? [1920, 1240] : [1920, 1440, 1240]
  STATES = WIDTHS.length * COMBOS.length
  console.log(`adjacency gap probe   ${new Date().toISOString()}`)
  console.log(`opportunity ${oppId}   growth allowance ${GROWTH}px   backstop ${BACKSTOP}px   states ${STATES}`)

  /* ── COLLECTED FIRST, ASSERTED AFTER, because A1's operative clause is
     about the SAME row at THREE widths. A per-width assertion cannot see a gap
     that grows with the panel, which is the whole finding. */
  const seen = new Map()   // combo -> container -> width -> max gap
  for (const [mode, structure, resp, fxOn] of COMBOS) {
    const combo = `${mode}/${structure}/${resp.replace('Terminus Contractor - ', '')}/fx-${fxOn ? 'on' : 'off'}`
    seen.set(combo, new Map())
    for (const width of WIDTHS) {
      await api('PATCH', `/opportunities/${oppId}`, { payload: { ...base, structure,
        paymentMode: mode, installResp: resp,
        factoring: { enabled: fxOn, ratePct: 2, termMonths: 36, method: 'straight' } } })
      await land(width)
      await p.evaluate(() => {
        const all = [...document.querySelectorAll('#view-opportunity-detail *')]
        for (const e of all) {
          const t = (e.textContent ?? '').trim()
          if (t.length < 30 && /^(expand all|show detail)$/i.test(t)) { e.click(); break }
        }
      })
      await p.evaluate(() => new Promise((r) => setTimeout(r, 600)))
      console.log(`\n── ${width}  ${combo} ──`)
      const rows = await walk()
      if (process.env.C_DIAG === '1') {
        const d = await p.evaluate(() => {
          const box = (sel) => { const e = document.querySelector(sel); if (!e) return 'ABSENT'
            const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
            return `${Math.round(r.width)}w [${Math.round(r.left)}..${Math.round(r.right)}] pad ${cs.paddingLeft}/${cs.paddingRight}` }
          return {
            panel: box('#deal-po-factoring'), fields: box('#deal-factoring-fields'),
            row: box('.po-row'), toggleWrap: box('#deal-factoring-method-toggle'),
            toggleBtn: box('#deal-method-toggle'),
            straight: box('[data-testid="deal-method-label-straight"]'),
            declining: box('[data-testid="deal-method-label-declining"]'),
            rate: box('#deal-factoring-ratePct'),
          }
        })
        for (const [k, v] of Object.entries(d)) console.log(`  DIAG ${k.padEnd(11)} ${v}`)
      }
      for (const r of rows) {
        const over = r.max > BACKSTOP
        console.log(`  ${over ? 'OVER ' : '     '}${String(r.max).padStart(5)}px max  ${String(r.min).padStart(4)}px min  ${String(r.rows).padStart(3)} rows  ${r.key.slice(0, 44)}  "${r.sample}"`)
        const byC = seen.get(combo)
        if (!byC.has(r.key)) byC.set(r.key, {})
        byC.get(r.key)[width] = r.max
      }
      /* ── A4: A LABEL AND ITS VALUE NEVER TOUCH ────────────────────────
         John's finding: the panel read "LUMP SUM COST250000". Every control's
         own label is measured against it: stacked is fine, side by side is
         fine, TOUCHING is not. 6px is the smallest separation the estate's own
         stacked fields use, so anything below it is two strings running
         together rather than a layout. */
      const touching = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const dead = (e) => !!e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
        const root = document.querySelector('#view-opportunity-detail')
        if (!root) return []
        const out = []
        for (const c of root.querySelectorAll('input, select')) {
          if (!vis(c) || dead(c)) continue
          const lab = c.closest('label') ?? (c.id ? root.querySelector(`label[for="${c.id}"]`) : null)
          if (!lab || !vis(lab)) continue
          let best = null
          const w = document.createTreeWalker(lab, NodeFilter.SHOW_TEXT)
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            if (!n.nodeValue || !n.nodeValue.trim()) continue
            const r = document.createRange(); r.selectNodeContents(n)
            const b = r.getBoundingClientRect()
            if (b.width > 0 && (best === null || b.bottom > best.bottom)) best = b
          }
          if (!best) continue
          const cb = c.getBoundingClientRect()
          // Stacked: the label's last line ends above the control.
          if (best.bottom <= cb.top + 1) continue
          const gap = cb.left - best.right
          if (gap < 6) out.push(`${c.id || c.name || c.tagName} label "${(best.width > 0 ? lab.textContent : '').trim().slice(0, 28)}" gap ${Math.round(gap)}px`)
        }
        return out
      })
      check(touching.length === 0, `A4 no label touches its value`
        + (touching.length ? `\n         ${touching.join('\n         ')}` : ` (checked every visible control)`))

      /* ── A3: THE HIDDEN HALF'S TRACKS COLLAPSE ────────────────────────── */
      const tracks = await p.evaluate(() => {
        const g = document.querySelector('#deal-product-grid')
        if (!g) return null
        return { n: getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length,
          half: g.getAttribute('data-install-half') }
      })
      check(!!tracks, 'A3 the product grid is present')
      if (tracks) {
        check(tracks.n === (tracks.half === 'true' ? 8 : 4),
          `A3 the grid has ${tracks.half === 'true' ? 8 : 4} column tracks when the install half is `
          + `${tracks.half === 'true' ? 'shown' : 'hidden'} (${tracks.n})`)
      }

      /* ── A6: THE PO FACTORING CARD'S THREE CONTROLS END AT ONE EDGE ────
         Asserted as computed geometry rather than as the CSS that achieves it:
         where three controls end relative to each other is the claim, and
         `grid-template-columns` is only how it is done (Verification 4's
         clause, a mechanism is not an outcome). */
      const fx6 = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const r = (sel) => { const e = document.querySelector(sel)
          return e && vis(e) ? Math.round(e.getBoundingClientRect().right) : null }
        return {
          rate: r('#deal-factoring-ratePct'),
          term: r('#deal-factoring-termMonths'),
          method: r('#deal-factoring-method-toggle'),
          declining: r('[data-testid="deal-method-label-declining"]'),
          straight: r('[data-testid="deal-method-label-straight"]'),
          fieldsPresent: !!document.querySelector('#deal-factoring-fields'),
          repayLabelBottom: (() => { const e = document.querySelector('.po-row label')
            return e && vis(e) ? Math.round(e.getBoundingClientRect().bottom) : null })(),
          methodTop: (() => { const e = document.querySelector('#deal-factoring-method-toggle')
            return e && vis(e) ? Math.round(e.getBoundingClientRect().top) : null })(),
        }
      })
      if (fxOn) {
        check(fx6.rate !== null && fx6.term !== null && fx6.method !== null,
          `A6 the three controls are all present (rate ${fx6.rate}, term ${fx6.term}, method ${fx6.method})`)
        if (fx6.rate !== null && fx6.term !== null && fx6.method !== null) {
          /* ── R-ADJ1: A6 HOLDS FULLY ABOVE 1360, AND STACKS BELOW IT ──────
             John's ruling. At 1240 the region cannot carry the milestones
             column, the repayment control and the hybrid schedule at once, so
             the row stacks and the card returns to its percentage. The claim
             at that width is the STACK, asserted rather than dropped: a width
             where nothing is checked is where a layout goes quietly wrong. */
          if (width > 1360) {
            const edges = [fx6.rate, fx6.term, fx6.method]
            check(Math.max(...edges) - Math.min(...edges) <= 1,
              `A6 rate, term and repayment right-align to one edge `
              + `(${fx6.rate} / ${fx6.term} / ${fx6.method})`)
          } else {
            check(fx6.repayLabelBottom !== null && fx6.methodTop !== null
              && fx6.repayLabelBottom <= fx6.methodTop + 1,
              `A6 at ${width} the repayment row STACKS, label above control `
              + `(label bottom ${fx6.repayLabelBottom}, control top ${fx6.methodTop})`)
            check(fx6.rate === fx6.term,
              `A6 at ${width} the rate and term still share an edge (${fx6.rate} / ${fx6.term})`)
          }
        }
        /* THE FLANKING LABELS RIDE WITH THE CONTROL, per the ruled layout. */
        check(fx6.straight !== null && fx6.declining !== null && fx6.straight < fx6.declining,
          `A6 STRAIGHT-LINE sits left of DECLINING BALANCE (${fx6.straight} < ${fx6.declining})`)
      } else {
        /* M11's claim, unchanged and re-asserted here because A6 is measured in
           BOTH factoring states and absence is the other one. */
        check(fx6.fieldsPresent === false,
          `A6 with factoring off the rate, term and method are ABSENT, not merely hidden`)
      }

      /* ── A5: THE RADIOS SIT WITH THE NUMBERS THEY CHANGE ──────────────
         Two claims, and the second is the one a geometry check cannot make:
         the group is immediately above the schedule, AND the schedule is the
         one it changes. A control parked above the wrong panel satisfies
         geometry perfectly. */
      const a5 = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const box = (sel) => { const e = document.querySelector(sel)
          return e && vis(e) ? e.getBoundingClientRect() : null }
        const g = box('#deal-invoicing-toggle')
        const sched = box('#deal-opex-year-slot') ?? box('#deal-hybrid-schedule') ?? box('#deal-capex-year-slot')
        const which = box('#deal-opex-year-slot') ? 'opex' : box('#deal-hybrid-schedule') ? 'hybrid'
          : box('#deal-capex-year-slot') ? 'capex' : 'none'
        if (!g || !sched) return { which, ok: false }
        return { which, ok: true,
          above: Math.round(sched.top - g.bottom),
          overlap: Math.round(Math.min(g.right, sched.right) - Math.max(g.left, sched.left)),
          schedWidth: Math.round(sched.width) }
      })
      check(a5.ok, `A5 the invoicing group and a schedule are both rendered (${a5.which})`)
      if (a5.ok) {
        check(a5.above >= 0 && a5.above <= 60,
          `A5 the radios sit IMMEDIATELY above the ${a5.which} schedule (${a5.above}px between them)`)
        check(a5.overlap > a5.schedWidth * 0.5,
          `A5 the radios sit OVER that schedule's column, not beside it `
          + `(${a5.overlap}px of ${a5.schedWidth}px)`)
      }
      /* DRIVEN: the schedule it sits on is the schedule it changes. */
      const a5drive = await p.evaluate(async () => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        /* ── THE SCHEDULE IS ITS HEAD AND ITS BODY, AND THE FIRST VERSION
           READ ONLY THE BODY. It reported no change and that was true of what
           it read: the yearly AMOUNTS are the same either way, and what
           Monthly changes is the head, "Invoiced fee, annual in advance"
           against its monthly wording. The head is a SIBLING of the slot
           because R-SZ2 moved it out so it could share a grid track, so a
           reader of the slot alone cannot see the thing the control does. */
        const sched = () => {
          /* ── THE FIRST VISIBLE ONE, NOT THE FIRST ONE THAT EXISTS ────────
             `??` falls through on null and not on hidden. Under CAPEX the
             hybrid schedule is still in the document inside a `hidden` group,
             so the chain stopped on an invisible element and the whole driven
             check read `null` before and `null` after - reporting "no change"
             for a reading it never took. Presence is not visibility, and the
             geometry check above got this right by measuring boxes. */
          const body = ['#deal-opex-year-slot', '#deal-hybrid-schedule', '#deal-capex-year-slot']
            .map((sel) => document.querySelector(sel)).find((e) => e && vis(e))
          if (!body) return null
          const head = ['.opex-year-head', '.capex-year-head', '.hg-colhead--right']
            .map((sel) => document.querySelector(sel)).find((e) => e && vis(e))
          const t = (e) => e && vis(e) ? (e.textContent ?? '') : ''
          return `${t(head)} | ${t(body)}`.replace(/\s+/g, ' ').trim()
        }
        const radio = (v) => [...document.querySelectorAll('#deal-invoicing-toggle [data-invoicing]')]
          .find((e) => e.getAttribute('data-invoicing') === v)
        const before = sched()
        const m = radio('monthly'); if (!m) return { before, err: 'no monthly radio' }
        m.click()
        await new Promise((r) => setTimeout(r, 700))
        const after = sched()
        const a = radio('annual'); a?.click()
        await new Promise((r) => setTimeout(r, 700))
        return { before, after, restored: sched() }
      })
      check(!!a5drive.before && !!a5drive.after && a5drive.before !== a5drive.after,
        `A5 toggling Monthly CHANGES the schedule the radios sit on`
        + (a5drive.err ? ` (${a5drive.err})` : '')
        + `\n         before: ${String(a5drive.before).slice(0, 90)}`
        + `\n         after:  ${String(a5drive.after).slice(0, 90)}`)
      check(a5drive.restored === a5drive.before,
        `A5 and switching back restores it, so the change was the toggle's`)

      /* ── N2, CARRIED FROM THE SIZING ROUND AND NUMBERED HERE ──────────
         The sizing round recorded N2 as UNRECOVERED and refused to invent a
         sentence for it. John's rider gives it one: row pairing and dress
         equality. Both halves of a product row pair off, and they wear the
         same dress - which is what "in the same dress" meant in N1 and was
         never asserted, only built. */
      const n2 = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const units = [...document.querySelectorAll('[data-testid^="ig-units-"]')].filter(vis)
        const rates = [...document.querySelectorAll('[data-testid^="ig-rate-"]')].filter(vis)
        const dress = (e) => { const cs = getComputedStyle(e)
          return `${cs.fontSize}/${cs.fontFamily.split(',')[0].replace(/["']/g, '')}/${cs.paddingTop}/${cs.paddingBottom}/${cs.borderBottomWidth}` }
        return {
          nUnits: units.length, nRates: rates.length,
          pairs: units.map((u, i) => rates[i] ? Math.round(rates[i].getBoundingClientRect().top - u.getBoundingClientRect().top) : null),
          dressU: units.map(dress), dressR: rates.map(dress),
        }
      })
      if (n2.nRates > 0) {
        check(n2.nUnits === n2.nRates,
          `N2 the two halves hold the same number of rows (${n2.nUnits} / ${n2.nRates})`)
        check(n2.pairs.length > 0 && n2.pairs.every((d) => d !== null && Math.abs(d) <= 2),
          `N2 every row PAIRS across the halves (offsets ${JSON.stringify(n2.pairs)})`)
        check(new Set([...n2.dressU, ...n2.dressR]).size === 1,
          `N2 both halves wear ONE dress (${[...new Set([...n2.dressU, ...n2.dressR])].join(' | ')})`)
      }

      /* ── THE PLACEHOLDER-FORMAT RULE ──────────────────────────────────
         A placeholder carries a value FITTING the field's format, never prose.
         S1 sizes a box to its format, so this is measurable: the placeholder's
         own text, measured in the box's own font, fits the box. */
      const ph = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const dead = (e) => !!e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
        const root = document.querySelector('#view-opportunity-detail')
        if (!root) return []
        const c = document.createElement('canvas').getContext('2d')
        const out = []
        for (const i of root.querySelectorAll('input')) {
          if (!vis(i) || dead(i) || !i.placeholder) continue
          const cs = getComputedStyle(i)
          c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
          const w = c.measureText(i.placeholder).width
          const inner = i.getBoundingClientRect().width
            - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
          if (w > inner + 0.5) out.push(`${i.id || i.name}: "${i.placeholder}" needs ${Math.round(w)}px in ${Math.round(inner)}px`)
        }
        return out
      })
      check(ph.length === 0, `A-PH every placeholder fits its box`
        + (ph.length ? `\n         ${[...new Set(ph)].join('\n         ')}` : ' (measured in each box\'s own font)'))

      check(rows.length > 0, `A1 the walk found label+figure rows at all (${rows.length} containers)`)
      const over = rows.filter((r) => r.max > BACKSTOP)
      check(over.length === 0, `A1 backstop: no gap exceeds ${BACKSTOP}px`
        + (over.length ? `\n         ${over.map((o) => `${o.key.slice(0, 40)} at ${o.max}px ("${o.sample}")`).join('\n         ')}` : ''))
      const tag = `${width}-${mode}-${structure}-${resp.includes('Lump') ? 'lump' : 'perunit'}-fx${fxOn ? 'on' : 'off'}`
      await shot(`gaps-${tag}`)
      /* THE TWO SURFACES THE RULING ASKS TO SEE, photographed where they are
         rather than wherever the product grid happens to leave the page. */
      await shotAt('#deal-po-factoring', `card-${tag}`)
      await shotAt('.stmt-result', `stmt-${tag}`)
      states++
    }
    /* ── A1's OPERATIVE CLAUSE ─────────────────────────────────────────── */
    const byC = seen.get(combo)
    const widest = Math.max(...WIDTHS), narrowest = Math.min(...WIDTHS)
    const drifted = []
    for (const [key, byW] of byC) {
      if (byW[widest] === undefined || byW[narrowest] === undefined) continue
      const growth = byW[widest] - byW[narrowest]
      if (growth > GROWTH) drifted.push(`${key.slice(0, 40)} ${WIDTHS.map((w) => `${w}:${byW[w] ?? '-'}`).join(' ')} grew ${growth}px`)
    }
    check(byC.size > 0, `A1 growth had containers to compare (${byC.size}) in ${combo}`)
    check(drifted.length === 0, `A1 no row's gap GROWS with the panel by more than ${GROWTH}px`
      + (drifted.length ? `\n         ${drifted.join('\n         ')}` : ` (${byC.size} containers)`))
  }
} catch (e) {
  threw = e
  console.log(`\nTHE RUN THREW, so every count below is over the states it reached:`)
  console.log(String(e && e.stack ? e.stack : e))
} finally { await b.close(); await tearDown(TAG) }
console.log(`\nstates completed: ${states} of ${STATES}`)
console.log(`${pass} of ${pass + fail} checks passed`)
console.log(threw || states !== STATES ? 'RUN INCOMPLETE' : 'RUN COMPLETE')
console.log(`written by the run to ${RESULTS}`)
flush()
process.exit(fail || threw || states !== STATES ? 1 : 0)
