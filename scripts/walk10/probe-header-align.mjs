// ITEM 1: DO THE COLUMN LABELS SIT OVER THEIR COLUMNS?
//
// The walk-4 O5/O6 pattern: assert the RELATIONSHIP between a header and the
// cell beneath it, on the live DOM, rather than a CSS property of either.
// A header that happens to look right is not the claim; a header whose left
// edge tracks its column's left edge is.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk10/probe-header-align.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk10/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const opps = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
const links = must(await db.from('record_contacts').select('record_id')
  .in('record_id', opps.map((o) => o.id)), 'links')
const counts = {}
for (const l of links) counts[l.record_id] = (counts[l.record_id] ?? 0) + 1
const richest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
const rec = opps.find((o) => o.id === richest[0])
console.log(`measured on ${rec.reference_code}, ${richest[1]} linked contacts`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), rec.id)
    let settled = true
    try {
      await p.waitForFunction(() => {
        const v = document.getElementById('view-opportunity-detail')
        return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
          && !document.querySelector('.wrap.is-loading')
          && v.querySelectorAll('[data-testid^="kc-row-"]').length > 0
      }, { timeout: 45000 })
    } catch { settled = false }
    if (!settled) { check(false, `the Opportunity settled at ${width}`); continue }
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => document.querySelector('[data-testid="ref-key-contacts"]')
      ?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    // ── ARMED, WHICH IS THE STATE A PERSON IS IN WHEN THEY LOOK ─────────
    //
    // The Record button is `hidden` until a stance is changed, so a resting
    // card measures a cell that is missing one of its controls. Changing the
    // select reveals it and the flex cell grows - and whether the HEADERS
    // follow is the whole question.
    await p.evaluate(() => {
      const sel = document.querySelector('[data-testid^="kc-stance-"]')
      const opt = [...sel.options].find((o) => o.value)
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(sel, opt.value)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const kc = document.querySelector('[data-testid="ref-key-contacts"]')
      const heads = [...kc.querySelectorAll('.kc-table thead th')]
      const firstRow = kc.querySelector('.kc-table tbody tr')
      const cells = [...firstRow.querySelectorAll('td')]
      const box = (e) => { const r = e.getBoundingClientRect()
        return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) } }
      // THE GLYPHS, NOT THE BOXES. A box measure can be exact while what a
      // person sees is off: the cell's own content may sit somewhere other
      // than its left edge. A Range over the text gives where the ink starts.
      const inkLeft = (e) => {
        if (!e) return null
        const ctl = e.querySelector('select, input, button:not([hidden])')
        if (ctl) return Math.round(ctl.getBoundingClientRect().left)
        const r = document.createRange(); r.selectNodeContents(e)
        const rects = [...r.getClientRects()]
        return rects.length ? Math.round(Math.min(...rects.map((x) => x.left))) : null
      }
      return {
        pairs: heads.map((h, i) => ({
          label: (h.textContent ?? '').trim() || '(blank)',
          head: box(h), cell: cells[i] ? box(cells[i]) : null,
          headInk: inkLeft(h), cellInk: inkLeft(cells[i]),
        })),
        // AND THE ADD ROW, which is a separate flex row below the table and
        // therefore shares NO column system with it at all.
        addRow: [...kc.querySelectorAll('.kc-add > *')].map((e) => ({
          t: (e.getAttribute('data-testid') ?? e.tagName), l: Math.round(e.getBoundingClientRect().left),
        })),
        // THE CAUSE, if there is one: a cell that has left the table's own
        // column algorithm is no longer a table-cell.
        // ONE COLUMN SYSTEM: every cell in the body row is a real table-cell,
        // so the header columns and the body's are the same columns. A cell
        // that is not `table-cell` has left the table's own algorithm.
        displays: cells.map((c) => getComputedStyle(c).display),
        recordShown: !!kc.querySelector('[data-testid^="kc-record-"]:not([hidden])'),
        headDisplays: heads.map((h) => getComputedStyle(h).display),
        visible: getComputedStyle(kc).visibility === 'visible',
        // ITEM 2: the card's buttons wear the estate's treatment. Verification
        // 7: a control that replaces another inherits the ROLE, and a role
        // carries a treatment - asserted as the CLASS, not as a colour.
        addBtnClass: kc.querySelector('[data-testid="kc-add"]')?.className ?? '',
        recordBtnClass: kc.querySelector('[data-testid^="kc-record-"]')?.className ?? '',
        // ── THE STANCE CONTROLS, ROW BY ROW ───────────────────────────────
        // One row is ARMED and the rest are not, so its cell holds three
        // controls and theirs hold two. If the flex row lets them size
        // differently, the selects and notes stop forming a column down the
        // card - which is what "the labels do not sit over their columns"
        // looks like in use, even when every header box is exact.
        stanceRows: [...kc.querySelectorAll('.kc-stance')].map((s) => ({
          armed: !!s.querySelector('button:not([hidden])'),
          sel: Math.round(s.querySelector('select').getBoundingClientRect().width),
          selL: Math.round(s.querySelector('select').getBoundingClientRect().left),
          noteL: Math.round(s.querySelector('input').getBoundingClientRect().left),
          noteW: Math.round(s.querySelector('input').getBoundingClientRect().width),
        })),
        // ITEM 3: no id may appear twice in the whole document.
        dupIds: (() => { const seen = {}, d = new Set()
          for (const e of document.querySelectorAll('[id]')) {
            if (seen[e.id]) d.add(e.id); seen[e.id] = 1 }
          return [...d] })(),
      }
    })
    console.log(`\n=== ${width}px ===`)
    console.log(`  cell displays  : ${JSON.stringify(m.displays)}`)
    console.log(`  Record button revealed (the armed state): ${m.recordShown}`)
    for (const pr of m.pairs) {
      const d = pr.cell ? pr.head.l - pr.cell.l : null
      const inkD = (pr.headInk !== null && pr.cellInk !== null) ? pr.headInk - pr.cellInk : null
      console.log(`  ${String(pr.label).padEnd(9)} box ${pr.head.l}/${pr.cell?.l} drift ${d}`
        + `   INK ${pr.headInk}/${pr.cellInk} drift ${inkD}`)
    }
    console.log(`  the add row starts at: ${JSON.stringify(m.addRow)}`)
    check(m.visible, `the card is visible at ${width}`)
    check(m.displays.every((d) => d === 'table-cell'),
      `ITEM 1 every cell is a real table-cell, so ONE column system governs at ${width}`,
      JSON.stringify(m.displays))
    check(m.headDisplays.every((d) => d === 'table-cell'),
      `ITEM 1 and so is every header at ${width}`, JSON.stringify(m.headDisplays))
    // THE CLAIM A PERSON CAN SEE: the LABEL's ink over its COLUMN's ink.
    for (const pr of m.pairs) {
      if (pr.headInk === null || pr.cellInk === null) continue
      check(Math.abs(pr.headInk - pr.cellInk) <= 3,
        `ITEM 1 the "${pr.label}" LABEL sits over its data at ${width}`,
        `label ink ${pr.headInk}, data ink ${pr.cellInk}, drift ${pr.headInk - pr.cellInk}px`)
    }
    // THE CLAIM, as a relationship: every label starts where its column does.
    for (const pr of m.pairs) {
      if (!pr.cell) continue
      check(Math.abs(pr.head.l - pr.cell.l) <= 2,
        `ITEM 1 "${pr.label}" sits over its column at ${width}`,
        `header at ${pr.head.l}, column at ${pr.cell.l}, drift ${pr.head.l - pr.cell.l}px`)
    }
    check(/\bbtn-sm\b/.test(m.addBtnClass),
      `ITEM 2 the Add button wears the estate's treatment at ${width}`,
      JSON.stringify(m.addBtnClass))
    check(/\bbtn-sm\b/.test(m.recordBtnClass),
      `ITEM 2 and so does Record, beside it at ${width}`,
      JSON.stringify(m.recordBtnClass))
    console.log(`  stance rows: ${JSON.stringify(m.stanceRows)}`)
    const selWidths = new Set(m.stanceRows.map((r) => r.sel))
    const noteLefts = new Set(m.stanceRows.map((r) => r.noteL))
    check(selWidths.size === 1,
      `ITEM 1 every row's stance select is the SAME width at ${width}`,
      `${[...selWidths].join(', ')}`)
    check(noteLefts.size === 1,
      `ITEM 1 and every row's note starts at the same x at ${width}`,
      `${[...noteLefts].join(', ')}`)
    check(m.dupIds.length === 0,
      `ITEM 3 no id is duplicated anywhere in the document at ${width}`,
      `${m.dupIds.length}: ${m.dupIds.slice(0, 6).join(', ')}`)
    await p.screenshot({ path: `${OUT}header-align-${width}.png` })
  }
} finally { await b.close() }
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
