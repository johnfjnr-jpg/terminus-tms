// R-O3: THE COMMERCIALS SECTIONS RENDER IN THE ORDER JOHN RULED.
//
//   Structural Terms, Units and Installation, Payment Terms, Cash Flow,
//   Deal Sheet, Versions.
//
// ── WHY THIS FILE EXISTS, AND THE DISPOSITION OF WHAT CAME BEFORE ────────
//
// Nothing guarded the live order. Three assertions LOOK like order guards:
//
//   scripts/tests/latches.test.mjs:52          slices between deal-section-4
//                                              and deal-section-5
//   scripts/tests/latches.test.mjs:54          slices between the stats grid
//                                              and deal-sections-1-2
//   scripts/tests/commercials-wiring.test.mjs:548
//                                              deal-cashflow-grid after
//                                              deal-section-6
//
// EVERY ONE READS frontend/index.html, AND EVERY ID THEY NAME IS INSIDE THE
// RETIRED #deal-form-vanilla BLOCK, confirmed by byte offset. They are not
// wrong and they are not order guards for this screen: they assert the shape
// of markup that renders nothing, which is CLAUDE.md's standing qualification
// on those suites.
//
// DISPOSITION, one line each, per Verification 41:
//   latches.test.mjs:52, :54        KEPT. They are about the vanilla block's
//                                   own structure, which is what the retired
//                                   surface's tripwires are for.
//   commercials-wiring.test.mjs:548 KEPT, same reason.
//   all three                       NOT re-pointed here. Re-pointing 52
//                                   assertions across 8 suites off the corpse
//                                   is the queued #ref-vanilla retirement
//                                   item, and doing three of them piecemeal
//                                   would leave the other 49 looking guarded.
//
// So this probe is the detector, and the reorder it guards is in DealPanel.tsx.
//
// THE CLAIM IS AN ORDER, so the assertion is the SEQUENCE, read off the
// rendered document by vertical position. A set of present sections would be
// satisfied by any arrangement of them.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk4/probe-section-order.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk4/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w4order'

const EXPECTED = [
  'Structural Terms',
  'Units Required and Installation',
  'Payment Terms',
  'Cash flow (USD)',
  'Deal Sheet Summary',
  'Versions',
]

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const opp = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  for (const width of [1440, 1240]) {
    const p = await b.newPage()
    await p.setViewport({ width, height: 1200 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      const c = document.getElementById('detail-company')
      return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      return !!panel && panel.querySelectorAll('.deal-section').length > 1
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const seen = await p.evaluate((wanted) => {
      const panel = document.getElementById('opp-tab-commercial')
      // EXCLUDING THE RETIRED BLOCKS BY NAME. A census of this panel without
      // the exclusion reads 28 titles, 17 of them at y=0, because
      // #deal-form-vanilla is a full duplicate of this screen.
      return [...panel.querySelectorAll('.section-title, .pg-card-title')]
        .filter((t) => !t.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla'))
        .map((t) => ({ text: (t.textContent ?? '').trim(), top: Math.round(t.getBoundingClientRect().top + window.scrollY) }))
        .filter((t) => wanted.includes(t.text))
        .sort((a, b2) => a.top - b2.top)
        .map((t) => t.text)
    }, EXPECTED)

    console.log(`\n=== ${width}px ===`)
    seen.forEach((t, i) => console.log(`  ${i + 1}. ${t}`))
    check(seen.length === EXPECTED.length,
      'all six ruled sections render, so the order claim is not vacuous',
      `${seen.length} of ${EXPECTED.length}`)
    check(JSON.stringify(seen) === JSON.stringify(EXPECTED),
      'R-O3 the sections render in the ruled order',
      seen.join(' -> '))
    await p.close()
  }
} finally { await b.close(); await tearDown(TAG) }

const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
