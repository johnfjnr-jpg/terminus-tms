// WALK 8 ITEM 2: THE OPPORTUNITY RENDERS WHOLE AFTER THE REMOVAL.
//
// Two of this round's claims moved HERE from `index.html`, because the markup
// they were asserted against rendered nothing and the live DOM is the only
// place they were ever checkable:
//
//   - the deal form's SECTION PARENTAGE (was class-rules.test.mjs)
//   - the top schedule row's WRAP (was commercials-wiring FINDING 3)
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk8/probe-deal-whole.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk8/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w8whole'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const opp = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    errs.length = 0
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await p.waitForFunction(() => document.getElementById('deal-section-6'), { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const parentOf = (id) => document.getElementById(id)?.parentElement?.id || null
      const row = document.getElementById('deal-top-schedule-row')
      const rcs = row ? getComputedStyle(row) : null
      const ys = document.getElementById('deal-year-schedule')
      return {
        // The whole surface, not just the bits this round touched.
        sections: ['deal-sections-1-2', 'deal-section-3', 'deal-section-4',
          'deal-section-5', 'deal-section-6'].map((id) => ({ id, present: !!document.getElementById(id) })),
        parents: {
          'deal-sections-1-2': parentOf('deal-sections-1-2'),
          'deal-section-1': parentOf('deal-section-1'),
          'deal-section-2': parentOf('deal-section-2'),
          'deal-section-3': parentOf('deal-section-3'),
          'deal-section-6': parentOf('deal-section-6'),
        },
        cashflowInSix: !!document.getElementById('deal-section-6')
          ?.querySelector('#deal-cashflow-grid'),
        vanillaGone: !document.getElementById('deal-form-vanilla')
          && !document.getElementById('deal-version-vanilla'),
        // DUPLICATE IDS: the whole point of the removal. Scoped to the DEAL
        // and VERSION ids, which are the ones the two blocks duplicated. A
        // whole-document count also catches three contact ids that belong to
        // another surface and another round - reporting those here would be
        // claiming a fix this change did not make.
        dupes: (() => { const seen = {}, d = new Set()
          for (const e of document.querySelectorAll('[id]')) {
            if (seen[e.id]) d.add(e.id); seen[e.id] = 1 }
          return [...d].filter((id) => /^(deal|btn-save-version|btn-issue-version|btn-request-pricing|btn-open-approval|pricing-approval|latch-)/.test(id)) })(),
        dupesEverywhere: (() => { const seen = {}, d = new Set()
          for (const e of document.querySelectorAll('[id]')) {
            if (seen[e.id]) d.add(e.id); seen[e.id] = 1 }
          return [...d] })(),
        topRow: rcs ? { display: rcs.display, wrap: rcs.flexWrap, gap: rcs.gap } : null,
        // FINDING 3's real claim: the year cells do not overlap.
        yearCells: ys ? [...ys.querySelectorAll('.ys-cell, .ys-total')].map((e) => {
          const r = e.getBoundingClientRect()
          return { l: Math.round(r.left), r: Math.round(r.right), t: (e.textContent || '').trim().slice(0, 10) }
        }) : [],
      }
    })
    console.log(`\n=== ${width}px ===`)
    check(m.vanillaGone, `both retired blocks are gone from the live DOM at ${width}`)
    check(m.sections.every((s) => s.present),
      `ITEM 2 every deal section renders at ${width}`,
      m.sections.filter((s) => !s.present).map((s) => s.id).join(', ') || 'all five')
    // MOVED FROM class-rules: the parentage, on the elements a person sees.
    check(m.parents['deal-section-1'] === 'deal-sections-1-2'
      && m.parents['deal-section-2'] === 'deal-sections-1-2',
      `ITEM 2 sections 1 and 2 are side by side inside the intake wrapper at ${width}`,
      JSON.stringify(m.parents))
    check(m.parents['deal-sections-1-2'] === m.parents['deal-section-3']
      && m.parents['deal-section-3'] === m.parents['deal-section-6'],
      `ITEM 2 and the wrapper, 3 and 6 are siblings of one another at ${width}`,
      JSON.stringify(m.parents))
    check(m.cashflowInSix, `ITEM 2 the cash flow grid is inside section 6 at ${width}`)
    check(errs.length === 0, `ITEM 2 the Opportunity renders with NO page errors at ${width}`,
      errs.join(' | '))
    check(m.dupes.length === 0,
      `ITEM 2 and NO deal or version id is duplicated any more at ${width}`,
      `${m.dupes.length}: ${m.dupes.slice(0, 6).join(', ')}`)
    // CARRIED, NOT CLAIMED: three contact ids are still duplicated, on a
    // surface this round did not touch. Printed so the number is on the
    // record rather than quietly filtered out of it.
    console.log(`  still duplicated elsewhere (not this round's): `
      + `${m.dupesEverywhere.length} -> ${m.dupesEverywhere.join(', ') || 'none'}`)
    // MOVED FROM commercials-wiring FINDING 3, and stated as the OUTCOME.
    // The markup carried `flex-wrap:wrap` inline and the assertion read that
    // literal; what the finding is about is year cells not overlapping.
    if (m.yearCells.length > 1) {
      const overlap = m.yearCells.some((c, i) =>
        i > 0 && c.l < m.yearCells[i - 1].r - 1)
      check(!overlap, `FINDING 3 the year cells do not overlap at ${width}`,
        JSON.stringify(m.yearCells))
    } else {
      console.log(`  NOTE ${width}: this deal shows no year schedule, so FINDING 3 is not exercised here`)
    }
    console.log(`  top schedule row: ${JSON.stringify(m.topRow)}`)
    await p.screenshot({ path: `${OUT}deal-whole-${width}.png` })
  }
} finally { await b.close(); await tearDown([TAG]) }
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
