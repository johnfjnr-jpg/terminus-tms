// WALK 4 PHASE 0: the Commercials tab, measured before anything is built.
//
// Answers O3's section order, O2's notes header, O5's Month field and O6's
// milestone alignment. Builds nothing and decides nothing.
//
// MEASURED ON A SURFACE THAT HAS INITIALISED, COMPUTED AND BEEN EXERCISED.
// The deal panel builds 40 ids and 30 classes by innerHTML once the calculator
// has run, and the hybrid group does not exist at all until the structure is
// switched, so a census taken on first paint reads static markup and calls it
// the screen.
//
// `.is-loading > *` is `visibility: hidden`, which PRESERVES LAYOUT: every
// child keeps a correct non-zero box while invisible, so the class is the only
// honest signal that the record has arrived.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk4/probe-p0-commercials.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk4/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w4p0'

const opp = await freshOpportunity(TAG)
console.log(`opportunity ${opp.oppId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    const c = document.getElementById('detail-company')
    return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 25000 })

  // ── Q5: THE NOTES HEADER ROW, while the band is in view ────────────────
  const notes = await p.evaluate(() => {
    const card = document.querySelector('[data-testid="opp-card-notes"]')
    if (!card) return { present: false }
    const rect = (e) => e ? e.getBoundingClientRect() : null
    const head = card.querySelector('[data-testid="cd-notes-header-row"]')
    const kids = head ? [...head.children] : []
    const expand = card.querySelector('[data-testid="cd-notes-expand"]')
    return {
      present: true,
      headerChildren: kids.map((k) => ({
        tag: k.tagName.toLowerCase(),
        testid: k.getAttribute('data-testid') ?? '-',
        text: (k.textContent ?? '').trim().slice(0, 24),
        top: Math.round(rect(k).top), left: Math.round(rect(k).left),
      })),
      rangePresent: !!expand,
      rangeTop: expand ? Math.round(rect(expand).top) : null,
      headTop: head ? Math.round(rect(head).top) : null,
      // The claim O2 collapses: are NOTES, LATEST FIRST and the range buttons
      // on ONE line? Equal tops is the row test; a count of children cannot
      // see a wrap.
      distinctTops: [...new Set([...kids, ...(expand ? [expand] : [])]
        .map((e) => Math.round(rect(e).top)))].length,
    }
  })
  console.log('=== Q5: the Notes card header ===')
  if (!notes.present) console.log('  the notes card is absent')
  else {
    for (const c of notes.headerChildren) console.log(`  header child  ${c.testid.padEnd(24)} ${c.tag.padEnd(6)} top=${c.top} left=${c.left}  ${JSON.stringify(c.text)}`)
    console.log(`  range buttons present: ${notes.rangePresent}  (this record has 0 notes)`)
    console.log(`  DISTINCT TOPS across the header row and the range group: ${notes.distinctTops}`)
  }

  // ── Q1: THE COMMERCIALS SECTION ORDER ──────────────────────────────────
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
      .find((x) => /commercial/i.test(x.textContent ?? ''))
    t?.click()
  })
  await p.waitForFunction(() => {
    const panel = document.getElementById('opp-tab-commercial')
    return !!panel && panel.querySelectorAll('.deal-section, .section-title').length > 2
  }, { timeout: 25000 })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const order = await p.evaluate(() => {
    const panel = document.getElementById('opp-tab-commercial')
    // EXCLUDING THE RETIRED VANILLA BLOCK. The first run read 28 titles, 17 of
    // them at y=0, because `#deal-form-vanilla` is a full duplicate of this
    // screen that renders nothing and is already carried as its own item. A
    // title inside it is not a section of the live surface.
    const titles = [...panel.querySelectorAll('.section-title, .pg-card-title')]
      .filter((t) => !t.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla'))
      .map((t) => {
        const r = t.getBoundingClientRect()
        const sec = t.closest('section, .deal-section, .pg-card')
        return {
          text: (t.textContent ?? '').trim().slice(0, 34),
          id: sec?.id || '-',
          top: Math.round(r.top + window.scrollY),
        }
      })
      .filter((t) => t.text)
      .sort((a, b) => a.top - b.top)
    return titles
  })
  console.log('\n=== Q1: the Commercials sections, in RENDER order, top to bottom ===')
  order.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}.  y=${String(t.top).padStart(5)}  ${t.id.padEnd(22)} ${t.text}`))

  // ── Q3: HYBRID, THE MILESTONE GRID AND THE MONTH FIELD ─────────────────
  await p.evaluate(() => {
    const el = document.querySelector('[data-structure="hybrid"]')
    el?.click()
  })
  await p.waitForFunction(() => {
    const g = document.getElementById('deal-hybrid-group')
    return !!g && !g.classList.contains('hidden')
  }, { timeout: 15000 })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const grid = await p.evaluate(() => {
    const group = document.getElementById('deal-hybrid-group')
    const outer = group?.querySelector('table.doc-table')
    const ths = outer ? [...outer.querySelectorAll('thead th')] : []
    const inner = group?.querySelector('[data-testid="milestone-grid"] table')
    const firstRow = inner?.querySelector('tbody tr')
    const cells = firstRow ? [...firstRow.children] : []
    const r = (e) => e.getBoundingClientRect()
    // The ids are `deal-ms-<i>-month`, read from census.ts rather than guessed:
    // the first version of this probe typed `deal-ms1-month` and measured null,
    // which reads as "there is no Month field" rather than as a wrong selector.
    const monthInput = document.querySelector('[data-testid="deal-ms-1-month"], #deal-ms-1-month')
    const cs = monthInput ? getComputedStyle(monthInput) : null
    return {
      // STRUCTURE, not a count: which table is inside which.
      innerInsideOuterTbody: !!(inner && outer && outer.querySelector('tbody')?.contains(inner)),
      outerHeaderCount: ths.length,
      headerXs: ths.map((t) => ({ text: (t.textContent ?? '').trim(), left: Math.round(r(t).left), width: Math.round(r(t).width) })),
      fieldXs: cells.map((c) => ({ left: Math.round(r(c).left), width: Math.round(r(c).width) })),
      month: monthInput ? {
        width: Math.round(r(monthInput).width),
        maxLength: monthInput.getAttribute('maxlength'),
        borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomColor,
        borderLeft: cs.borderLeftWidth + ' ' + cs.borderLeftColor,
        borderTop: cs.borderTopWidth + ' ' + cs.borderTopColor,
        borderRight: cs.borderRightWidth + ' ' + cs.borderRightColor,
      } : null,
      // The two hybrid panels, as they sit today.
      panels: [...(group?.children ?? [])].map((c) => ({
        top: Math.round(r(c).top + window.scrollY), left: Math.round(r(c).left),
        width: Math.round(r(c).width),
        text: (c.textContent ?? '').trim().slice(0, 36).replace(/\s+/g, ' '),
      })),
    }
  })
  console.log('\n=== Q3/O6: the milestone grid ===')
  console.log(`  the field table is nested INSIDE the header table's tbody: ${grid.innerInsideOuterTbody}`)
  console.log(`  header cells: ${grid.outerHeaderCount}`)
  for (const h of grid.headerXs) console.log(`    header  ${h.text.padEnd(18)} left=${String(h.left).padStart(5)} width=${h.width}`)
  grid.fieldXs.forEach((f, i) => console.log(`    field ${i + 1}              left=${String(f.left).padStart(5)} width=${f.width}`))
  const offsets = grid.headerXs.map((h, i) => grid.fieldXs[i] ? h.left - grid.fieldXs[i].left : null)
  console.log(`  HEADER-TO-FIELD OFFSET per column: ${JSON.stringify(offsets)}`)
  console.log('\n=== Q3/O5: the Month field ===')
  console.log(`  ${JSON.stringify(grid.month, null, 2).replace(/\n/g, '\n  ')}`)
  console.log('\n=== O4: the hybrid group as it renders today ===')
  grid.panels.forEach((p2, i) => console.log(`  panel ${i + 1}  y=${p2.top} left=${p2.left} width=${p2.width}  ${JSON.stringify(p2.text)}`))

  for (const w of [1440, 1240]) {
    await p.setViewport({ width: w, height: 1200 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await p.screenshot({ path: `${OUT}p0-commercials-hybrid-${w}.png` })
    console.log(`\ncaptured p0-commercials-hybrid-${w}.png`)
  }
} finally {
  await b.close()
  await tearDown(TAG)
}
