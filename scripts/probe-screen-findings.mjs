#!/usr/bin/env node
// The four remaining screen-read findings, measured at 1240 and 1920 before any
// of them is touched. Round 41 item 6.
//
// THE CENSUS QUESTION IS "ABSORBED OR LIVE", and it is a measurement rather than
// a reading: two of the four sit on surfaces that item 3 rebuilt, so the honest
// answer needs the number now rather than the number in the report that raised
// them. CLAUDE.md Verification 15: a criterion expressed as a measurement at one
// viewport stops describing the thing it was written about.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-screen-findings.mjs')
import { readFileSync, mkdirSync } from 'fs'

const ROOT = new URL('../', import.meta.url).pathname
const OUT = ROOT + '.verify/findings/'
mkdirSync(OUT, { recursive: true })
const session = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
const OPP = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()

const measure = async (width) => {
  await page.setViewport({ width, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('opportunity-detail', id), OPP)
  await page.waitForFunction(() => {
    const el = document.getElementById('deal-contract-net')
    return el && /\$[1-9]/.test(el.textContent)
  }, { timeout: 20000 })
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-opp-tab]')].find((b) => /commercial/i.test(b.textContent))
    if (t) t.click()
  })
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && !p.classList.contains('hidden')
  }, { timeout: 20000 })
  // The panel being unhidden is not the cash flow grid having a WIDTH, and
  // having a width is not the ResizeObserver having RUN. Both of the first two
  // waits were satisfied in the state before the class was applied, which is
  // Verification 7 twice over: a condition the old state already meets.
  //
  // Two frames after layout is a settling step rather than a fixed delay: the
  // observer callback is queued for the frame after the resize, so a second
  // frame is the first moment its effect is guaranteed observable.
  await page.waitForFunction(() => {
    const el = document.getElementById('deal-cashflow-grid')
    return el && el.clientWidth > 0
  }, { timeout: 20000 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  return page.evaluate(() => {
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) } }
    // Glyph extents, not box extents: a nowrap cell that overflows its box still
    // reports a box width, and the collision is between the INK.
    const ink = (el) => { if (!el) return null; const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) } }

    // ── FINDING 3: the invoiced-fee row ────────────────────────────────
    const ysRows = [...document.querySelectorAll('#deal-year-schedule .ys-row')]
    const ysData = ysRows.map((row) => {
      const cells = [...row.children].map((c) => ({ text: c.textContent.trim(), box: rect(c), ink: ink(c), overflows: c.scrollWidth > c.clientWidth + 1 }))
      // A collision is one cell's ink starting before the previous cell's ink ends.
      const collisions = []
      for (let i = 1; i < cells.length; i++) {
        if (cells[i].ink && cells[i - 1].ink && cells[i].ink.left < cells[i - 1].ink.right) {
          collisions.push(`${cells[i - 1].text} | ${cells[i].text}`)
        }
      }
      return { cells, collisions, head: row.classList.contains('head') }
    })

    // ── FINDING 4: the cash flow grid ──────────────────────────────────
    const grid = document.getElementById('deal-cashflow-grid')
    const scroller = grid?.closest('.cashflow-scroll') ?? grid
    const cfRows = grid ? [...grid.querySelectorAll('*')].filter((e) => /Cumulative cash position/i.test(e.textContent) && e.children.length === 0) : []
    const cumRow = cfRows[0]?.parentElement ?? null
    const lastCell = cumRow ? cumRow.lastElementChild : null
    const cashflow = {
      scrollerBox: rect(scroller),
      scrollW: scroller ? scroller.scrollWidth : null,
      clientW: scroller ? scroller.clientWidth : null,
      overflows: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : null,
      cumRowLastCell: lastCell ? { text: lastCell.textContent.trim(), box: rect(lastCell), ink: ink(lastCell) } : null,
      // NOT "clipped": that is true of every horizontal scroller by definition
      // and answers a different question from the finding. The first version of
      // this probe reported it as the measure and it read true before and after
      // the fix, which is Verification 18's signature exactly - a calibration
      // that does not move has failed to run rather than passed.
      //
      // The finding is that a figure sliced at a hard edge READS AS A VALUE.
      // What is measurable is whether the boundary announces itself.
      hasFade: scroller ? scroller.classList.contains('is-scrollable') : null,
      maskApplied: scroller ? (getComputedStyle(scroller).maskImage !== 'none'
        || getComputedStyle(scroller).webkitMaskImage !== 'none') : null,
    }

    // ── FINDING 5: save order ──────────────────────────────────────────
    const sv = document.getElementById('btn-save-version')
    const sc = document.getElementById('btn-save-deal')
    const order = {
      saveVersionTop: rect(sv)?.y ?? null,
      saveChangesTop: rect(sc)?.y ?? null,
      versionIsAbove: (sv && sc) ? rect(sv).y < rect(sc).y : null,
      documentOrder: (sv && sc) ? (sv.compareDocumentPosition(sc) & Node.DOCUMENT_POSITION_FOLLOWING ? 'version then changes' : 'changes then version') : null,
    }

    // ── FINDING 6: the achieved margin double render ───────────────────
    const one = document.getElementById('deal-achieved-margin')
    const two = document.getElementById('deal-terms-achieved-margin')
    const style = (el) => { if (!el) return null; const c = getComputedStyle(el); return { text: el.textContent.trim(), fontSize: c.fontSize, fontWeight: c.fontWeight, color: c.color, cls: el.className, top: rect(el).y } }
    const margin = { strip: style(one), card: style(two) }

    // ── THE CONDITION ON THE SUPERSESSION. Round 41 item 5 ─────────────
    //
    // The business's own condition: the second side-by-side ships ONLY if the
    // installation text survives 1240. If the three paragraphs wrap mid-word,
    // clip, or fall below readable width, the build stops.
    //
    // READABLE WIDTH is stated as a measure rather than assumed: typography's
    // working range for a line of prose is roughly 45 to 90 characters, and the
    // measure here is the characters that fit on a line at the rendered font
    // size, computed from a measured average glyph advance rather than a guess.
    const col2 = document.getElementById('deal-section-2')
    // HIDDEN IS NOT CRUSHED, and the first version of this could not tell them
    // apart: a hidden paragraph has a zero box, which the readable-width test
    // reported as "below readable width". Two of six read as failures on both
    // widths for a reason that had nothing to do with the layout. Verification
    // 14: a comparison reached with nothing on either side is not a comparison.
    // They are measured separately, in the installation state that shows them.
    const notes = col2
      ? [...col2.querySelectorAll('.field-note')]
        .filter((p) => p.textContent.trim().length > 60 && p.getBoundingClientRect().width > 0)
      : []
    const probeEl = document.createElement('span')
    const install = notes.map((p) => {
      const cs = getComputedStyle(p)
      const r = p.getBoundingClientRect()
      // Average advance for this font at this size, measured on the paragraph's
      // own text rather than assumed from the font size.
      probeEl.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`
      probeEl.textContent = p.textContent.trim()
      document.body.appendChild(probeEl)
      const advance = probeEl.getBoundingClientRect().width / Math.max(1, probeEl.textContent.length)
      probeEl.remove()
      const lineHeight = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.4)
      return {
        text: p.textContent.trim().slice(0, 44) + '…',
        chars: p.textContent.trim().length,
        boxW: Math.round(r.width),
        charsPerLine: Math.round(r.width / advance),
        lines: Math.round(r.height / lineHeight),
        // A word wider than its box is what "wrap mid-word" looks like in CSS:
        // the browser either overflows it or breaks it. Both are failures.
        overflows: p.scrollWidth > p.clientWidth + 1,
        wordBreak: cs.overflowWrap === 'break-word' || cs.wordBreak === 'break-all',
      }
    })
    const colW = col2 ? Math.round(col2.getBoundingClientRect().width) : null

    return { ysData, cashflow, order, margin, install, colW, viewportH: window.innerHeight }
  })
}

const out = {}
for (const w of [1240, 1920]) out[w] = await measure(w)

// THE OTHER INSTALLATION STATE, so the two paragraphs hidden under per-unit are
// measured in the state that shows them rather than reported as unmeasurable.
// The condition is about the column, and the column holds different prose
// depending on who installs.
const lumpSum = {}
for (const w of [1240, 1920]) {
  await page.setViewport({ width: w, height: 1000 })
  await page.evaluate(() => {
    const sel = document.getElementById('deal-installResp')
    if (!sel) return
    sel.value = [...sel.options].find((o) => /lump sum/i.test(o.value))?.value ?? sel.value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  lumpSum[w] = await page.evaluate(() => {
    const col2 = document.getElementById('deal-section-2')
    const probeEl = document.createElement('span')
    return [...col2.querySelectorAll('.field-note')]
      .filter((p) => p.textContent.trim().length > 60 && p.getBoundingClientRect().width > 0)
      .map((p) => {
        const cs = getComputedStyle(p)
        const r = p.getBoundingClientRect()
        probeEl.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`
        probeEl.textContent = p.textContent.trim()
        document.body.appendChild(probeEl)
        const advance = probeEl.getBoundingClientRect().width / Math.max(1, probeEl.textContent.length)
        probeEl.remove()
        const lineHeight = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.4)
        return { text: p.textContent.trim().slice(0, 44) + '…', boxW: Math.round(r.width),
          charsPerLine: Math.round(r.width / advance), lines: Math.round(r.height / lineHeight),
          overflows: p.scrollWidth > p.clientWidth + 1 }
      })
  })
}

// Captures, of the regions the findings are in, after scrolling them into view.
for (const [w, sel, name] of [[1240, '#deal-section-5', 'section5'], [1920, '#deal-section-5', 'section5'],
  [1240, '#deal-sections-1-2', 'intake'], [1920, '#deal-sections-1-2', 'intake'],
  [1240, '#deal-section-6', 'cashflow'], [1920, '#deal-section-6', 'cashflow']]) {
  await page.setViewport({ width: w, height: 1200 })
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView(), sel)
  await new Promise((r) => setTimeout(r, 400))
  const el = await page.$(sel)
  if (!el) continue
  const box = await el.boundingBox()
  const file = `${OUT}${name}-${w}.png`
  await page.screenshot({ path: file, clip: { x: 0, y: Math.max(0, box.y), width: w, height: Math.min(box.height, 1200) } })
  console.log(`  capture ${file} (${readFileSync(file).length} bytes)`)
}
await browser.close()

for (const [w, m] of Object.entries(out)) {
  console.log(`\n══ ${w}px ═══════════════════════════════════════════════`)
  console.log('  FINDING 3, the invoiced-fee row:')
  if (!m.ysData.length) console.log('    no year-schedule rows rendered')
  for (const row of m.ysData) {
    console.log(`    ${row.head ? 'head' : 'data'}: ${row.cells.map((c) => `"${c.text}"${c.overflows ? ' OVERFLOWS' : ''}`).join('  ')}`)
    console.log(`      ink: ${row.cells.map((c) => c.ink ? `${c.ink.left}-${c.ink.right}` : '-').join('  ')}`)
    console.log(`      collisions: ${row.collisions.length ? row.collisions.join(' ; ') : 'none'}`)
  }
  console.log('  FINDING 4, the cash flow grid:')
  console.log(`    scroller ${m.cashflow.scrollerBox?.w}px wide, content ${m.cashflow.scrollW}px, overflows: ${m.cashflow.overflows}`)
  console.log(`    cumulative row last cell: ${JSON.stringify(m.cashflow.cumRowLastCell)}`)
  console.log(`    overflow announced: class ${m.cashflow.hasFade}, mask applied ${m.cashflow.maskApplied}`)
  console.log('  FINDING 5, save order:')
  console.log(`    Save version at y=${m.order.saveVersionTop}, Save changes at y=${m.order.saveChangesTop}, version above: ${m.order.versionIsAbove} (${m.order.documentOrder})`)
  console.log(`  ITEM 5 CONDITION, the installation column is ${m.colW}px:`)
  for (const p of m.install) {
    const verdict = p.overflows ? 'OVERFLOWS' : p.charsPerLine < 45 ? 'BELOW READABLE WIDTH' : 'ok'
    console.log(`    ${String(p.charsPerLine).padStart(3)} chars/line, ${p.lines} lines, box ${p.boxW}px  ${verdict}  "${p.text}"`)
  }
  console.log(`  ITEM 5 CONDITION, lump sum installation, same column:`)
  for (const p of (lumpSum[w] ?? [])) {
    const verdict = p.overflows ? 'OVERFLOWS' : p.charsPerLine < 45 ? 'BELOW READABLE WIDTH' : 'ok'
    console.log(`    ${String(p.charsPerLine).padStart(3)} chars/line, ${p.lines} lines, box ${p.boxW}px  ${verdict}  "${p.text}"`)
  }
  console.log('  FINDING 6, the achieved margin renderings:')
  console.log(`    strip: ${JSON.stringify(m.margin.strip)}`)
  console.log(`    card : ${JSON.stringify(m.margin.card)}`)
}
