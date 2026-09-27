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
import { A1_ROSTER } from '../../src/lib/a1-roster.js'

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

/* `everOver` is declared OUT here with the other counters because the ratchet's
   shrink clause is scored after the `finally`, and a `const` inside the `try` is
   not in scope there. The same mistake cost the sizing round a crashed run. */
let states = 0, STATES = 0, threw = null
const everOver = new Set()
/* R-A1P: what the walk actually found, per state, scored after the `finally`
   for the same reason `everOver` is - a `const` inside the `try` is not in
   scope there. `rosterSeen` maps a container key to the states it was found
   in, so the report can say WHERE a container went missing rather than only
   that it did. */
const rosterSeen = new Map()
const statesWalked = []
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
    /* ── A SIGN AND A CURRENCY SYMBOL TOGETHER ARE STILL A FIGURE ──────────
       This allowed ONE leading symbol, so "- $564,000" matched nothing and was
       taken for a LABEL. It surfaced when a calibration widened the statement:
       A1 then paired a cost figure with the figure beside it, reported an 8px
       gap over three rows, and the injection that should have blown the
       backstop came back SILENT. A detector that mistakes a figure for a label
       does not report a wrong gap, it reports the wrong ROW. */
    const FIG = /^[-(]?\s*\$?\s*[\d,]+(\.\d+)?\s*%?\)?$/
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
      /* ── GROUPED BY THE ROW THEY RENDER ON, NOT BY COUNTING CHILDREN ─────
         This chunked `children` in runs of `cols`, which assumes every child is
         one cell and that they arrive in row order. R-US1's cards break both:
         a title and a note SPAN the row, the heads are placed on track 3 rather
         than first, and the cells carry explicit `grid-row`. Chunked, the runs
         straddled rows and no group looked like a label beside a figure.

         SO THE PRODUCT GRID FELL OUT OF THIS WALK ENTIRELY - the estate's main
         pricing surface, measured zero times, and nothing said so: A1 reports
         what it FINDS, and a container it cannot parse is simply absent from a
         list of containers. It was caught by an injection that stretched that
         grid by 680px and came back SILENT.

         Grouping by rendered top is what a row IS. A spanning title lands alone
         and is skipped for having one cell, which is correct. */
      /* ── A ROW IS CELLS THAT OVERLAP VERTICALLY, NOT CELLS THAT SHARE A TOP
         Grouping on `Math.round(top)` looked exact and was wrong: these rows are
         `align-items: baseline`, so a statement row's six cells sat at tops
         3134, 3135 and 3136 and split into THREE groups. It survived while some
         group still held two cells. Widen the statement and the spread grows
         until none does, and THE WHOLE CONTAINER LEAVES THE WALK - which is how
         the A1 injection came back silent on a row it should have blown apart.

         Two cells are in one row when their vertical spans overlap by more than
         half the shorter of them. That is what a reader means by a row, and it
         is indifferent to baseline alignment, to differing cell heights and to
         sub-pixel rounding. */
      const boxes = kids.map((k) => ({ k, r: k.getBoundingClientRect() }))
        .filter((x) => x.r.height > 0)
        .sort((a, b) => a.r.top - b.r.top)
      const grouped = []
      for (const b of boxes) {
        const row = grouped[grouped.length - 1]
        if (row) {
          const top = Math.max(row.top, b.r.top), bot = Math.min(row.bottom, b.r.bottom)
          const shorter = Math.min(row.bottom - row.top, b.r.height)
          if (bot - top > shorter / 2) {
            row.cells.push(b)
            row.top = Math.min(row.top, b.r.top)
            row.bottom = Math.max(row.bottom, b.r.bottom)
            continue
          }
        }
        grouped.push({ top: b.r.top, bottom: b.r.bottom, cells: [b] })
      }
      return grouped
        .map((g) => g.cells.sort((x, y) => x.r.left - y.r.left).map((x) => x.k))
        .filter((row) => row.length >= 2)
    }
    const seen = new Map()
    /* ── SCOPED TO THE VIEW UNDER TEST, NOT THE DOCUMENT ────────────────
       The first run reported a 598px offender called `lead-card-body
       tb-top-row`, which is the LEADS card: this app is one document with
       several screens resident at once, so a document-wide walk answers for
       whatever is in the DOM (Verification 25's population clause). */
    const root = document.querySelector('#view-opportunity-detail') ?? document
    /* ── `section` TOO, AND ITS ABSENCE COST THE MAIN SURFACE ──────────────
       This read `table, div`. R-US1's cards are `<section>` elements, so the
       product grid and the installation panel were not in the population at
       all: the estate's main pricing surface, measured zero times, while A1
       went on reporting nine healthy containers. A list of containers says
       nothing about the one it never looked at.

       Enumerating by TAG is the fault Verification 19 names, and it failed here
       exactly as that rule says it does: on the unrecorded instance. */
    const containers = [...root.querySelectorAll('table, div, section')]
      .filter((e) => vis(e) && !dead(e))
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
      /* R-A1P: the population, recorded before anything is measured. A gap
         assertion reads what the walk FOUND; this reads what it found
         NOTHING of, which is the thing no amount of measuring can report. */
      statesWalked.push(`${width} ${combo}`)
      for (const r of rows) {
        if (!rosterSeen.has(r.key)) rosterSeen.set(r.key, [])
        rosterSeen.get(r.key).push(`${width} ${combo}`)
      }
      if (process.env.C_TRACE) {
        const t = await p.evaluate((sel) => {
          const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          const e = [...document.querySelectorAll(sel)].filter(vis)[0]
          if (!e) return { why: 'no visible element for ' + sel }
          const cs = getComputedStyle(e)
          const kids = [...e.children].filter(vis)
          const tops = kids.map((k) => Math.round(k.getBoundingClientRect().top))
          return {
            display: cs.display,
            cols: cs.gridTemplateColumns,
            colCount: cs.gridTemplateColumns.split(' ').filter(Boolean).length,
            kids: kids.length,
            distinctTops: [...new Set(tops)].length,
            tops: tops.slice(0, 8),
            texts: kids.slice(0, 6).map((k) => (k.textContent ?? '').trim().slice(0, 14)),
          }
        }, process.env.C_TRACE)
        console.log(`  TRACE ${process.env.C_TRACE} ${JSON.stringify(t)}`)
      }
      if (process.env.C_STMT) {
        const s = await p.evaluate(() => {
          const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          const FIG = /^[-(]?\s*\$?\s*[\d,]+(\.\d+)?\s*%?\)?$/
          return [...document.querySelectorAll('.stmt-row-line')].filter(vis).map((r) => ({
            cols: getComputedStyle(r).gridTemplateColumns,
            box: Math.round(r.getBoundingClientRect().width),
            cells: [...r.children].filter(vis).map((c) => {
              const t = (c.textContent ?? '').trim()
              const b = c.getBoundingClientRect()
              const range = document.createRange()
              range.selectNodeContents(c)
              const ink = range.getBoundingClientRect()
              return { t: t.slice(0, 18), fig: FIG.test(t),
                l: Math.round(b.left), r: Math.round(b.right),
                il: Math.round(ink.left), ir: Math.round(ink.right) }
            }),
          }))
        })
        for (const r of s) {
          console.log(`  STMT ${r.box}px [${r.cols}]`)
          for (const c of r.cells) {
            console.log(`       ${c.fig ? 'FIG' : '   '} box ${c.l}..${c.r}  ink ${c.il}..${c.ir}  "${c.t}"`)
          }
        }
      }
      if (process.env.C_SHOT) {
        /* PICTURES ONLY, IN A RUN OF THEIR OWN. A capture suppresses the
           scrollbar and does not put it back (Verification 4), so a shot taken
           mid-state perturbs every check after it. This block runs only when
           asked, and a run that sets it is not offered as a verdict. */
        await p.evaluate(() => {
          document.querySelector('.stmt')?.scrollIntoView({ block: 'center' })
        })
        await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
        const name = `.verify/adjacency/stmt-${width}-${combo.replace(/[^a-z0-9]+/gi, '-')}.png`
        await p.screenshot({ path: name })
        const seen = await p.evaluate(() => {
          const e = document.querySelector('.stmt')
          if (!e) return 'no .stmt'
          const r = e.getBoundingClientRect()
          return `.stmt ${Math.round(r.width)}x${Math.round(r.height)} at top ${Math.round(r.top)} of ${innerHeight}`
        })
        console.log(`  SHOT ${name}  ${seen}`)
      }
      if (process.env.C_SPLIT === '1') {
        const sp = await p.evaluate(() => {
          const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          const g = document.querySelector('#deal-product-grid')
          if (!g) return { why: 'no #deal-product-grid in the document' }
          if (!vis(g)) return { why: 'the grid is in the document but not visible' }
          const cs = getComputedStyle(g)
          const tracks = cs.gridTemplateColumns.split(' ').map((t) => parseFloat(t))
          const gap = parseFloat(cs.columnGap) || 0
          const sum = (a) => a.reduce((x, y) => x + y, 0)
          const units = tracks.slice(0, 4), inst = tracks.slice(4)
          const panel = document.querySelector('#deal-section-1')
          const resp = document.querySelector('#deal-installResp')
          return {
            tracks: tracks.map((t) => Math.round(t)).join(' '), gap,
            unitsW: Math.round(sum(units) + gap * (units.length - 1)),
            instW: inst.length ? Math.round(sum(inst) + gap * (inst.length - 1)) : 0,
            panelW: panel ? Math.round(panel.getBoundingClientRect().width) : null,
            gridClient: g.clientWidth, gridScroll: g.scrollWidth,
            panelClient: panel ? panel.clientWidth : null,
            panelScroll: panel ? panel.scrollWidth : null,
            docScroll: document.documentElement.scrollWidth,
            docClient: document.documentElement.clientWidth,
            respW: resp ? Math.round(resp.getBoundingClientRect().width) : null,
          }
        })
        if (sp && sp.why) console.log(`  SPLIT ${sp.why}`)
        else if (sp) {
          const chrome = 34 // 16px padding each side plus a 1px border
          const need = sp.instW ? sp.unitsW + chrome + sp.instW + chrome + 24 : null
          console.log(`  SPLIT tracks [${sp.tracks}] gap ${sp.gap}`)
          if (process.env.C_CG === '1') {
            const cg = await p.evaluate(() => {
              const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
              const g = document.querySelector('#deal-contractor-group')
              if (!g || !vis(g)) return null
              const box = g.getBoundingClientRect()
              const rows = [...g.querySelectorAll('*')].filter(vis).map((e) => {
                const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
                return { tag: e.tagName, cls: (e.className || '').toString().split(' ')[0],
                  w: Math.round(r.width), right: Math.round(r.right),
                  ws: cs.whiteSpace, disp: cs.display,
                  txt: (e.textContent ?? '').trim().slice(0, 26) }
              })
              rows.sort((a, b) => b.right - a.right)
              return { box: { w: Math.round(box.width), right: Math.round(box.right) },
                scroll: g.scrollWidth, client: g.clientWidth, top: rows.slice(0, 4) }
            })
            if (cg) {
              console.log(`  CG group ${cg.box.w}w right ${cg.box.right}  scroll ${cg.scroll} client ${cg.client}`)
              cg.top.forEach((r) => console.log(`  CG   ${r.tag}.${r.cls} ${r.w}w right ${r.right} ${r.disp} ws:${r.ws} "${r.txt}"`))
            }
          }
          if (process.env.C_LUMP === '1') {
            const lump = await p.evaluate(() => {
              const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
              const cg = document.querySelector('#deal-contractor-group')
              if (!cg || !vis(cg)) return { why: 'no visible contractor group in this state' }
              /* MAX-CONTENT MEASURED, NOT INFERRED: the group is a block and
                 fills the panel, so its rendered width says nothing about what
                 it NEEDS. Set in the browser only and put back before
                 returning. */
              const prev = cg.style.width
              cg.style.width = 'max-content'
              const need = cg.scrollWidth
              cg.style.width = prev
              const head = document.querySelector('#deal-contractor-group .cm-grid-head')
              const resp = document.querySelector('#deal-installResp')
              const note = document.querySelector('#deal-lump-summary')
              const w = (e) => e && vis(e) ? Math.round(e.getBoundingClientRect().width) : null
              return { need, head: w(head), resp: w(resp), note: w(note) }
            })
            if (!lump.why) {
              const wide = await p.evaluate(() => {
                const cg = document.querySelector('#deal-contractor-group')
                if (!cg) return []
                const box = cg.getBoundingClientRect()
                return [...cg.querySelectorAll('*')]
                  .map((e) => ({ e, r: e.getBoundingClientRect() }))
                  .filter((x) => x.r.width > 0 && x.r.right > box.right - 1)
                  .slice(0, 4)
                  .map((x) => `${x.e.tagName}.${(x.e.className || '').toString().split(' ')[0]} `
                    + `${Math.round(x.r.width)}w right ${Math.round(x.r.right)} vs box ${Math.round(box.right)}`)
              })
              wide.forEach((w) => console.log(`  WIDEST ${w}`))
            }
            if (lump.why) console.log(`  LUMP ${lump.why}`)
            else console.log(`  LUMP install content needs ${lump.need}  (grid head ${lump.head}, resp ${lump.resp}, note ${lump.note})`)
          }
          if (process.env.C_COLS === '1') {
            const cols = await p.evaluate(() => {
              const g = document.querySelector('#deal-product-grid')
              const n = getComputedStyle(g).gridTemplateColumns.split(' ').length
              const kids = [...g.children].filter((e) => e.checkVisibility())
              const out = []
              for (let c = 0; c < n; c++) {
                const cells = kids.filter((_, i) => i % n === c)
                const widest = cells.map((e) => {
                  const inp = e.querySelector('input')
                  const r = e.getBoundingClientRect()
                  return { w: Math.round(r.width), inp: inp ? Math.round(inp.getBoundingClientRect().width) : null,
                    t: (e.textContent ?? '').trim().slice(0, 18) }
                })
                const head = widest[0]
                const maxInp = Math.max(0, ...widest.map((x) => x.inp ?? 0))
                out.push(`c${c}: box ${head.w} input ${maxInp || '-'} "${head.t}"`)
              }
              return out
            })
            cols.forEach((c) => console.log(`  COLS ${c}`))
          }
          if (process.env.C_WRAP === '1') {
            const wrapped = await p.evaluate(() => {
              const g = document.querySelector('#deal-product-grid')
              const heads = [...g.querySelectorAll('.ig-head')]
              const before = getComputedStyle(g).gridTemplateColumns
              const prev = heads.map((h) => h.style.whiteSpace)
              // IN THE BROWSER ONLY: nothing on disk is touched, and it is put
              // back before the measurement returns.
              heads.forEach((h) => { h.style.whiteSpace = 'normal'; h.style.overflowWrap = 'anywhere' })
              g.style.width = 'auto'
              const after = getComputedStyle(g).gridTemplateColumns
              const w = g.scrollWidth
              heads.forEach((h, i) => { h.style.whiteSpace = prev[i]; h.style.overflowWrap = '' })
              g.style.width = ''
              return { before, after, w }
            })
            console.log(`  WRAP before [${wrapped.before.split(' ').map((t) => Math.round(parseFloat(t))).join(' ')}]`)
            console.log(`  WRAP after  [${wrapped.after.split(' ').map((t) => Math.round(parseFloat(t))).join(' ')}]  grid would be ${wrapped.w}px`)
          }
          console.log(`  SPLIT overflow: grid ${sp.gridScroll} in ${sp.gridClient}`
            + `  panel ${sp.panelScroll} in ${sp.panelClient}`
            + `  document ${sp.docScroll} in ${sp.docClient}`)
          console.log(`  SPLIT units half ${sp.unitsW}  install half ${sp.instW}  resp ${sp.respW}  panel ${sp.panelW}`
            + (need ? `  two cards need ${need} of ${sp.panelW}` : '  (no install half in this state)'))
        }
      }
      if (process.env.C_HEADS === '1') {
        const h = await p.evaluate(() => {
          const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          const m = (sel) => { const e = [...document.querySelectorAll(sel)].filter(vis)[0]
            if (!e) return 'ABSENT'
            const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
            return `top ${r.top.toFixed(1)} bot ${r.bottom.toFixed(1)} ${r.height.toFixed(1)}h pad ${cs.paddingTop}/${cs.paddingBottom} mar ${cs.marginTop}/${cs.marginBottom} border ${cs.borderTopWidth}/${cs.borderBottomWidth}` }
          return { grid: m('#deal-product-grid'), cg: m('#deal-contractor-group'),
            igHead: m('#deal-product-grid .ig-head'), cmHead: m('#deal-contractor-group .cm-grid-head'),
            cmRow: m('#deal-contractor-group .cm-grid-row'), igCell: m('[data-testid^="ig-units-"]') }
        })
        for (const [k, v] of Object.entries(h)) console.log(`  HEADS ${k.padEnd(7)} ${v}`)
        const w2d = await p.evaluate(() => {
          const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          const m = (sel) => { const e = [...document.querySelectorAll(sel)].filter(vis)[0]
            if (!e) return 'ABSENT'
            const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
            return `[${Math.round(r.left)}..${Math.round(r.right)}] x [${Math.round(r.top)}..${Math.round(r.bottom)}] ${cs.display} row ${cs.gridRow} mar ${cs.marginTop}/${cs.marginBottom}` }
          return { radios: m('#deal-invoicing-toggle'), head: m('.opex-year-head, .capex-year-head, .hg-colhead--right'),
            body: m('#deal-opex-year-slot, #deal-capex-year-slot, #deal-hybrid-schedule'),
            container: m('#deal-opex-tables') }
        })
        for (const [k, v] of Object.entries(w2d)) console.log(`  W2BOX ${k.padEnd(9)} ${v}`)
      }
      if (process.env.C_W1 === '1') {
        const w1 = await p.evaluate(() => {
          const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
          const b = (sel) => { const e = document.querySelector(sel)
            if (!e || !vis(e)) return null
            const r = e.getBoundingClientRect(); return { w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), bot: Math.round(r.bottom) } }
          const panel = b('#deal-section-1')
          const grid = b('#deal-product-grid')
          const cg = b('#deal-contractor-group')
          // W2: does anything overprint anything on the schedule stack?
          const parts = [['radios', '#deal-invoicing-toggle'],
            ['head', '.opex-year-head, .capex-year-head, .hg-colhead--right'],
            ['body', '#deal-opex-year-slot'], ['body2', '#deal-capex-year-slot'],
            ['body3', '#deal-hybrid-schedule']]
            .map(([n, s]) => [n, b(s)]).filter(([, r]) => r)
          const hits = []
          for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
            const [na, a] = parts[i], [nb, bb] = parts[j]
            const ox = Math.min(a.r, bb.r) - Math.max(a.l, bb.l)
            const oy = Math.min(a.bot, bb.bot) - Math.max(a.t, bb.t)
            if (ox > 0 && oy > 0) hits.push(`${na} x ${nb} overlap ${ox}x${oy}`)
          }
          /* THE CONTRACTOR GRID'S CONTENT WIDTH, NOT ITS BLOCK WIDTH. It is a
             block today so it fills the panel, and "needs 2022 of 1556" would
             be measuring the container rather than what it holds. */
          /* THE GRID'S OWN ROWS, not every descendant: the group also holds a
             prose warning that wraps to whatever it is given, so measuring all
             descendants measures the container again. */
          const rows = [...document.querySelectorAll('#deal-contractor-group .cm-grid-row, #deal-contractor-group .cm-grid-head, #deal-contractor-group [class*="grid-row"], #deal-contractor-group table')]
            .filter(vis).map((e) => e.getBoundingClientRect())
          const cgContent = rows.length ? Math.round(Math.max(...rows.map((r) => r.width))) : null
          const kinds = [...new Set([...document.querySelectorAll('#deal-contractor-group > *, #deal-contractor-group > * > *')]
            .filter(vis).map((e) => `${e.tagName}.${(e.className || '').toString().split(' ')[0]}:${Math.round(e.getBoundingClientRect().width)}`))]
          return { panel, grid, cg, cgContent, kinds, hits }
        })
        console.log(`  W1 panel ${w1.panel ? w1.panel.w : '-'}w  grid ${w1.grid ? w1.grid.w : '-'}w  contractor ${w1.cg ? w1.cg.w : '-'}w`
          + (w1.cgContent ? `  contractor CONTENT ${w1.cgContent}w` : '')
          + (w1.grid && w1.cgContent && w1.panel ? `  side-by-side needs ${w1.grid.w + w1.cgContent + 24} of ${w1.panel.w}` : ''))
        if (w1.kinds) console.log(`  W1 children: ${w1.kinds.join('  ')}`)
        console.log(`  W2 intersections: ${w1.hits.length ? w1.hits.join('; ') : 'none'}`)
      }
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

      /* ── W2: NOTHING ON THE SCHEDULE STACK OVERPRINTS ANYTHING ────────
         John's finding 2026-09-26, and it is about the guard above. A5
         asserted the radios' box sits ABOVE the schedule and PASSED WHILE THE
         TEXT OVERPRINTED, because it measured the radios against the schedule's
         BODY and the HEADING sits between them: the one element they collided
         with was the one nothing compared them to. Being above the body says
         nothing about what is in between.

         THIS JOINS THE ESTATE GUARD FAMILY at every A5 site, so an overprint is
         red wherever a control group sits on a panel rather than only where it
         was found. */
      const w2 = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const one = (sels) => sels.map((s) => document.querySelector(s)).find((e) => e && vis(e))
        /* ── THE INK, NOT THE BOX, AND THE BOX MISSED THE FIRST ONE ─────────
           Measured box against box, the factoring card came back clean while
           "REPAYMENT METHOD" was visibly printing through "STRAIGHT-LINE": the
           label's box is a 4px column and its TEXT overflows it. An element's
           box is where the layout put it; the ink is what a reader sees, and
           overprint is a claim about the ink.

           So each part's extent is its box UNION the rects of its own text,
           which is the same Range measurement A1 uses for a label's right
           edge. */
        const inkOf = (e) => {
          const r = e.getBoundingClientRect()
          let { left, right, top, bottom } = r
          const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            if (!n.nodeValue || !n.nodeValue.trim()) continue
            const rg = document.createRange(); rg.selectNodeContents(n)
            const b = rg.getBoundingClientRect()
            if (b.width <= 0 || b.height <= 0) continue
            left = Math.min(left, b.left); right = Math.max(right, b.right)
            top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom)
          }
          return { left, right, top, bottom }
        }
        /* ── EVERY SITE WHERE A CONTROL GROUP SITS ON A PANEL, which is what
           John's ruling asks for: overprint red everywhere, not only where it
           was found. The PO factoring card is one of those sites, and reading
           the 1920 screenshot found it overprinting there too - "REPAYMENT
           METHOD" wrapping into "STRAIGHT-LINE" - which the schedule-only
           version of this check could not have seen. */
        const parts = [
          ['radios', one(['#deal-invoicing-toggle'])],
          ['heading', one(['.opex-year-head', '.capex-year-head', '.hg-colhead--right'])],
          ['schedule', one(['#deal-opex-year-slot', '#deal-capex-year-slot', '#deal-hybrid-schedule'])],
          ['repay label', one(['.po-row label'])],
          ['repay control', one(['#deal-factoring-method-toggle'])],
          ['factoring toggle', one(['#deal-factoring-toggle'])],
        ].filter(([, e]) => e).map(([n, e]) => [n, inkOf(e)])
        const hits = []
        for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
          const [na, a] = parts[i], [nb, b] = parts[j]
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (ox > 0 && oy > 0) hits.push(`${na} x ${nb} by ${Math.round(ox)}x${Math.round(oy)}px`)
        }
        return { n: parts.length, hits }
      })
      check(w2.n >= 2, `W2 there are boxes to compare on the schedule stack (${w2.n})`)
      check(w2.hits.length === 0, `W2 no box on the schedule stack intersects another`
        + (w2.hits.length ? `\n         ${w2.hits.join('\n         ')}` : ' (radios, heading, schedule)'))

      /* ── P1: AN ELEMENT'S INK INCLUDES ITS PAINTED BORDERS ──────────────
         John's ruling 2026-09-27, and it closes a limit this guard recorded
         about itself. `inkOf` above unions an element's BOX with its TEXT,
         which is what a reader sees of a LABEL. It cannot see a RULE. A
         painted border is ink too, and a rule drawn across a word is the
         plainest overprint there is.

         THE CLAIM IS STATED AS A RELATION, not as a CSS property (Verification
         4's clause): for any element that paints a bottom rule and holds text,
         the text must not continue BELOW that rule. `border-bottom-width` being
         1px is how the rule is achieved; "nothing is struck through" is what
         was claimed.

         MEASURED BEFORE IT WAS WRITTEN, which is how the bound was chosen. The
         Units head band pins every head to one line box
         (`--w1-head-h`, composed as "the field-label line box, 8px of padding
         each side and the 1px rule") and R-US4 then accepted a two-line Rate
         heading. At 1920 the three one-line heads end 11px ABOVE their rule and
         "Hosting cost/mth" ends 5px BELOW it. The tolerance is 1px, which is
         under the healthy margin by an order of magnitude and over the
         sub-pixel noise that rounding produces. */
      const rules = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const root = document.querySelector('#view-opportunity-detail') ?? document
        const out = []
        for (const e of [...root.querySelectorAll('*')].filter(vis)) {
          const cs = getComputedStyle(e)
          const bw = parseFloat(cs.borderBottomWidth) || 0
          if (bw <= 0 || cs.borderBottomStyle === 'none') continue
          // A transparent rule paints nothing, so it cannot strike anything.
          if (/^rgba\(.*,\s*0\)$/.test(cs.borderBottomColor)) continue
          const box = e.getBoundingClientRect()
          if (box.width <= 0 || box.height <= 0) continue
          // ITS OWN text only. A neighbour's text crossing this rule is a
          // different claim with a different fix, and is not what was ruled.
          const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
          let worst = null
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            if (!n.nodeValue || !n.nodeValue.trim()) continue
            const rg = document.createRange(); rg.selectNodeContents(n)
            const t = rg.getBoundingClientRect()
            if (t.width <= 0 || t.height <= 0) continue
            const past = t.bottom - box.bottom
            if (worst === null || past > worst.past) {
              worst = { past, text: n.nodeValue.trim().slice(0, 22) }
            }
          }
          if (worst && worst.past > 1) {
            out.push(`${(e.id || e.className || e.tagName).toString().slice(0, 34)} `
              + `"${worst.text}" runs ${Math.round(worst.past)}px past its own rule`)
          }
        }
        return out
      })
      check(rules.length === 0, `P1 no painted rule is struck through its own text`
        + (rules.length ? `:\n         ${rules.join('\n         ')}` : ' (every ruled element checked)'))

      /* ── P4: AUTOFILL, PROVED AT THE MECHANISM ──────────────────────────
         John's ruling 2026-09-27, and the ruling asked for honesty about what
         a probe can and cannot simulate. This one CAN: Chrome's DevTools
         protocol has `CSS.forcePseudoState`, which puts a real element into
         the real `:-webkit-autofill` state, and the stylesheet then matches or
         does not.

         WHAT IT DOES NOT SIMULATE, stated because the difference matters: it
         does not fill the control, so no value arrives and nothing is typed.
         It drives the PSEUDO-CLASS, which is the only thing the rule keys on,
         so it tests exactly the claim the rule makes and nothing about
         Chrome's decision to offer a completion in the first place.

         MEASURED UNSTYLED FIRST, which is what makes the green mean something:
         an input with no rule computes `rgb(232, 240, 254)` on black in this
         state. That is the white box in John's screenshot, and it is the value
         this check would read if the rule stopped matching. */
      /* THE EXPECTATION IS READ FROM AN ORDINARY INPUT, NOT FROM THE TOKEN.
         The first version compared `getPropertyValue('--black')` against the
         computed shadow and failed on a healthy estate: the token is `#15161C`
         and the computed value is `rgb(21, 22, 28)`. Same colour, two
         spellings, and a guard comparing them reports a defect that is not
         there. Reading a real input's own computed background is also the
         truer statement of the claim - an autofilled input should look like
         the inputs beside it, whatever the tokens are called. */
      const af = await p.evaluate(() => {
        const ref = document.querySelector('#deal-targetMargin, input')
        if (!ref) return null
        const cs = getComputedStyle(ref)
        return { black: cs.backgroundColor, white: cs.color }
      })
      const afHits = []
      for (const sel of ['#deal-lumpCost', '#deal-cm-0-pct', '#deal-targetMargin']) {
        const there = await p.evaluate((s) => !!document.querySelector(s), sel)
        if (!there) continue
        let got = null
        try {
          const cdp = await p.createCDPSession()
          const doc = await cdp.send('DOM.getDocument')
          const { nodeId } = await cdp.send('DOM.querySelector',
            { nodeId: doc.root.nodeId, selector: sel })
          await cdp.send('CSS.enable')
          await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['autofill'] })
          got = await p.evaluate((s) => {
            const cs = getComputedStyle(document.querySelector(s))
            return { bg: cs.backgroundColor, fill: cs.webkitTextFillColor, shadow: cs.boxShadow }
          }, sel)
          /* THE PHOTOGRAPH THE RULING ASKED FOR, taken WHILE the pseudo-class
             is forced, because a capture after releasing it is a picture of an
             ordinary input. Measurements above are already taken, so the
             capture cannot perturb them (Verification 4's clause). */
          /* ONLY WHERE THE BOX IS ACTUALLY ON SCREEN, AND THE FIRST VERSION
             WAS NOT. `#deal-lumpCost` exists in every state and is inside a
             `hidden` group unless the responsibility is Lump Sum, so the shot
             fired in all fifteen and the LAST one won - a picture of the
             statement with no lump sum box in it. Caught by opening the image,
             which is Verification 4's own remedy and its clause: confirm the
             element is inside the captured region before treating the picture
             as evidence.

             Now it is gated on the control being visible, and the combo is in
             the filename so a state cannot overwrite another's evidence
             (Verification 44's naming clause). */
          if (process.env.C_SHOT && sel === '#deal-lumpCost') {
            const seen = await p.evaluate((s) => {
              const e = document.querySelector(s)
              if (!e || !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null
              e.scrollIntoView({ block: 'center' })
              const r = e.getBoundingClientRect()
              return { top: Math.round(r.top), h: Math.round(r.height) }
            }, sel)
            if (seen) {
              await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
              const name = `${OUT}autofilled-${width}-${combo.replace(/[^a-z0-9]+/gi, '-')}.png`
              await p.screenshot({ path: name })
              console.log(`  SHOT ${name}  (:autofill forced, box at ${seen.top} h${seen.h})`)
            }
          }
          await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
          await cdp.detach()
        } catch (e) {
          afHits.push(`${sel}: could not force the state (${String(e.message).slice(0, 50)})`)
          continue
        }
        /* THE INSET SHADOW IS THE BACKGROUND, so that is what is asserted.
           `backgroundColor` still reports the UA's own value in this state,
           which is exactly why a rule setting `background-color` does not
           work and this one does. */
        const ok = !!af && got.shadow.includes(af.black) && got.fill === af.white
        if (!ok) afHits.push(`${sel}: shadow "${got.shadow.slice(0, 44)}" fill ${got.fill}`)
      }
      check(afHits.length === 0, `P4 an autofilled input wears the estate's tokens`
        + (afHits.length ? `:\n         ${afHits.join('\n         ')}`
          : ` (forced :autofill, repainted to ${af.black} on ${af.white})`))

      /* ── W1: THE GRID AND THE MILESTONE TABLE SIT SIDE BY SIDE ─────────
         Only where the contractor group renders, which is Lump Sum. Asserted as
         a RELATIONSHIP between two elements rather than as the CSS that
         achieves it. */
      const w1c = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const bx = (sel) => { const e = document.querySelector(sel)
          return e && vis(e) ? e.getBoundingClientRect() : null }
        const grid = bx('#deal-product-grid')
        const cg = bx('#deal-contractor-group')
        if (!grid || !cg) return { present: false }
        const firstProduct = [...document.querySelectorAll('[data-testid^="ig-units-"]')].filter(vis)[0]
        const firstMs = [...document.querySelectorAll('#deal-contractor-group .cm-grid-row')].filter(vis)[0]
        return { present: true,
          gridRight: Math.round(grid.right), cgLeft: Math.round(cg.left),
          vOverlap: Math.round(Math.min(grid.bottom, cg.bottom) - Math.max(grid.top, cg.top)),
          rowGap: firstProduct && firstMs
            ? Math.round(firstMs.getBoundingClientRect().top - firstProduct.getBoundingClientRect().top)
            : null,
          panelTopGap: (() => {
            const a = bx('#deal-product-grid'), b = bx('#deal-install-panel')
            return a && b ? Math.round(b.top - a.top) : null
          })() }
      })
      if (w1c.present) {
        check(w1c.cgLeft >= w1c.gridRight,
          `W1 the milestone table sits RIGHT of the product grid `
          + `(grid ends ${w1c.gridRight}, table starts ${w1c.cgLeft})`)
        check(w1c.vOverlap > 0,
          `W1 and BESIDE it rather than below (${w1c.vOverlap}px of shared vertical span)`)
        /* ── RE-POINTED BY R-US3, 2026-09-27 ──────────────────────────────
           W1 asserted the milestone table's first figure row level with the
           product grid's. R-US1 puts the milestone table INSIDE the
           Installation card, and John's ruling is explicit that under Lump Sum
           NO ROW CORRESPONDENCE IS REQUIRED, because milestones are not
           products: there is nothing for milestone 1 to pair with.

           What survives, and is what W1 was really about, is that the two sit
           SIDE BY SIDE and start together. The pairing claim moves to Per Unit,
           where the rows do correspond, and is asserted by N2 and R-US3 on
           every state rather than only where a contractor group renders. */
        check(w1c.panelTopGap !== null && Math.abs(w1c.panelTopGap) <= 2,
          `R-US3 the two panels TOP-ALIGN (${w1c.panelTopGap}px apart)`)
      }

      /* ── R-US4: CONTENT FITS ITS OWN CONTAINER ────────────────────────
         John's ruling 2026-09-27, and it closes a class nothing watched. W2
         sees two elements INTERSECTING. A1 sees a gap between a label and a
         figure. Neither can see an element whose own content is wider than
         itself: it intersects nothing and its gaps are fine, and the merged
         grid did exactly that at 1240, 947px of content in an 876px box,
         running past the right edge of every panel beneath it.

         `scrollWidth` against `clientWidth` is the measurement, with one pixel
         of tolerance for sub-pixel rounding. */
      const fit = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const over = []
        for (const sel of ['#deal-section-1', '#deal-product-grid', '.units-row',
          '#deal-contractor-group', '#deal-po-factoring', '.deal-payment-region',
          '#deal-opex-tables', '#deal-hybrid-group']) {
          const e = document.querySelector(sel)
          if (!e || !vis(e)) continue
          if (e.scrollWidth > e.clientWidth + 1) {
            over.push(`${sel}: ${e.scrollWidth} of ${e.clientWidth}, over by ${e.scrollWidth - e.clientWidth}px`)
          }
        }
        return over
      })
      /* ── THE CARRIED PAIR, HELD BY A RATCHET RATHER THAN EXEMPTED ──────
         `#deal-po-factoring` and the region that contains it overflow at the
         widths where the card is narrower than the 292px repayment control.
         That is R-ADJ1's ACCEPTED TRADE-OFF, ruled after the alternative was
         measured to starve the hybrid schedule, and closing it means re-opening
         a ruling rather than fixing a defect.

         So they are named, not excused: the list MAY ONLY SHRINK, an entry that
         stops overflowing must leave it, and anything not on it is red. That is
         the shape the dead-selector ratchet already uses, and it keeps the
         class closed for everything new while the ruled pair waits on John. */
      /* `.deal-payment-region` LEFT THIS LIST BECAUSE THE RATCHET SAID SO. It
         was carried with the card it contains, and once the card's overflow
         stopped extending the region's own scroll width the shrink clause
         reported it healed. An entry that stops overflowing leaves; that is the
         half of a ratchet that stops it rotting into a list of excuses. */
      const CARRIED = ['#deal-po-factoring', '.deal-payment-region']
      const fresh = fit.filter((f) => !CARRIED.some((c) => f.startsWith(`${c}:`)))
      const healed = CARRIED.filter((c) => !fit.some((f) => f.startsWith(`${c}:`)))

      /* ── THE EXEMPTION IS NAMED, BOUNDED AND DIRECTIONAL ──────────────────
         R-ADJ1 ruled this overflow acceptable after the alternative was
         measured to starve the hybrid schedule: below 1360 the factoring card
         returns to its percentage and the 292px repayment control does not fit
         it. The ruling turned on WHICH WAY it overflows - rightward, into empty
         space, rather than leftward across the gap and over the schedule - so
         that is what the guard asserts, not merely that it is allowed.

         A bare name on an exemption list rots into an excuse. A direction and a
         bound cannot: the day it grows, or turns left, this is red. */
      const fx = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const card = document.querySelector('#deal-po-factoring')
        if (!card || !vis(card)) return null
        const b = card.getBoundingClientRect()
        let right = b.right, left = b.left
        for (const e of card.querySelectorAll('*')) {
          if (!vis(e)) continue
          const r = e.getBoundingClientRect()
          if (r.width <= 0) continue
          right = Math.max(right, r.right); left = Math.min(left, r.left)
        }
        return { over: Math.round(right - b.right), under: Math.round(b.left - left) }
      })
      if (fx) {
        check(fx.under <= 0,
          `R-ADJ1 the factoring card's content never spills LEFT, across the gap `
          + `(${fx.under}px past its left edge)`)
        check(fx.over <= 100,
          `R-ADJ1 its accepted rightward overflow stays within 100px (${fx.over}px)`)
      }
      check(fresh.length === 0, `R-US4 every panel's content fits its own box`
        + (fresh.length ? `\n         ${fresh.join('\n         ')}` : ' (eight containers checked)'))
      /* THE SHRINK CLAUSE ONLY APPLIES WHERE THE PAIR CAN OVERFLOW. Above
         1360 the factoring card is 340px and the 292px control FITS, so the
         entries correctly do not appear and asserting they must would fail on
         the widths where R-ADJ1 works. */
      /* THE SHRINK CLAUSE IS JUDGED OVER THE WHOLE RUN, NOT PER STATE, and the
         first version got that wrong twice. Above 1360 the factoring card is
         340px and the control FITS; and the region it sits in overflows in some
         1240 states and not others. An entry earns its place by overflowing
         SOMEWHERE, so it is scored once, after every state. */
      for (const c of CARRIED) if (fit.some((f) => f.startsWith(`${c}:`))) everOver.add(c)

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
/* ── R-A1P: A1 ASSERTS ITS POPULATION ───────────────────────────────────
   John's ruling 2026-09-27. A guard that reports what it FINDS cannot report
   what it has stopped finding, and twice in one round a container left this
   walk silently: `#deal-product-grid` when R-US1 made the cards `<section>`,
   and `.stmt-row-line` when a baseline-aligned row stopped grouping. The
   second was hiding a 703px gap on the statement's Total cost row the whole
   time, behind a guard reading 142 of 142.

   BOTH DIRECTIONS, which is Verification 19's remedy rather than a second
   thought: a rostered container MISSING is a red, and a container found that
   nobody rostered is a red too. A one-way list rots, because the estate grows
   containers faster than anybody remembers to register them.

   SCORED OVER THE STATES ACTUALLY WALKED, WHICH IS NOT THE SAME AS ONLY ON A
   COMPLETE RUN. The first version of this gated on `states === STATES`, so any
   run that threw skipped the check entirely - a silent skip wearing a pass
   (Verification 14), and it hid this check from its own calibration: the
   injection hid the product grid, the probe threw before walking one state,
   and the assertion written for exactly that fault never ran.

   The scope is already right without the gate. `statesWalked` lists only
   states whose walk COMPLETED, and each rostered container is asked for in
   those states alone, so a partial run reports real absences over what it did
   measure rather than artefacts of stopping. */
if (statesWalked.length) {
  /* EACH ENTRY IS ASKED WHICH OF THE WALKED STATES SHOULD CARRY IT, and is
     asserted found in ALL of them. An entry no walked state matches is not a
     pass and not a failure: this run cannot speak to it, so it is NAMED in
     the result rather than quietly counted as satisfied. */
  const missing = []
  const skipped = []
  for (const r of A1_ROSTER) {
    const owed = statesWalked.filter((s) => r.inState(s))
    if (!owed.length) { skipped.push(`${r.key} (${r.when})`); continue }
    const seen = rosterSeen.get(r.key) ?? []
    const absent = owed.filter((s) => !seen.includes(s))
    if (absent.length) {
      missing.push(`${r.key} (${r.what}) absent from ${absent.length} of the ${owed.length} states it is rostered for: ${absent.join(', ')}`)
    }
  }
  check(missing.length === 0, `R-A1P every rostered container was FOUND and MEASURED`
    + (missing.length ? `:\n         ${missing.join('\n         ')}`
      : ` (${A1_ROSTER.length - skipped.length} of ${A1_ROSTER.length} rostered, over ${statesWalked.length} states)`)
    + (skipped.length ? `\n         not carried by any state this run walked, so untested here: ${skipped.join(', ')}` : ''))

  const known = new Set(A1_ROSTER.map((r) => r.key))
  const stranger = [...rosterSeen.keys()].filter((k) => !known.has(k))
  check(stranger.length === 0, `R-A1P every container the walk found is ROSTERED`
    + (stranger.length ? `, and these are not: ${stranger.join(', ')}`
      : ` (${rosterSeen.size} found)`))
}
/* AND THE RATCHET IS ONLY MEANINGFUL IF SOMETHING WAS MEASURED. On the run
   that threw before walking any state, `everOver` was empty, so this fired and
   said both carried entries "never overflowed and must leave it" - a shrink
   verdict from an instrument that measured nothing (Verification 13: a count
   of zero from an instrument never shown reaching one is not a measurement).
   The run already fails on `states !== STATES`, so skipping here removes a
   false finding without weakening the ratchet on any run that walked. */
if (states > 0) {
  const CARRIED = ['#deal-po-factoring', '.deal-payment-region']
  const dead = CARRIED.filter((c) => !everOver.has(c))
  check(dead.length === 0, `R-US4 the carried list only shrinks, judged over the whole run`
    + (dead.length ? `: ${dead.join(', ')} never overflowed and must leave it`
      : ` (${CARRIED.length} entries, each still real)`))
}
console.log(`\nstates completed: ${states} of ${STATES}`)
console.log(`${pass} of ${pass + fail} checks passed`)
console.log(threw || states !== STATES ? 'RUN INCOMPLETE' : 'RUN COMPLETE')
console.log(`written by the run to ${RESULTS}`)
flush()
process.exit(fail || threw || states !== STATES ? 1 : 0)
