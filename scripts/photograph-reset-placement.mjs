// ── PHOTOGRAPH: THE PLACEMENT THE MOCKUP DOES NOT SETTLE ────────────────
//
// The brief says any placement the mockup does not settle is a STOP and a
// photograph. This takes the photograph, and it measures rather than argues.
//
// THE QUESTION. The mockup's card holds ONLY the OPEX table, so "beneath the
// table" and "at the foot of the card" are the same place in the picture. The
// real card carries a second column - invoicing, and the monthly schedule -
// which is taller than the three-row fee table, so the two places separate.
//
// NOTHING IS DECIDED AND NOTHING IS BUILT. Candidate B is applied IN THE PAGE
// and never written to the stylesheet: the committed state is candidate A
// throughout, and the page is put back before the run ends.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('photograph-reset-placement.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/opex-reset/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'RESETPLACE'

const say = (k, v) => console.log(`  ${k.padEnd(34)} ${v}`)

const { oppId } = await freshOpportunity(TAG)
const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
await api('PATCH', `/opportunities/${oppId}`, {
  payload: {
    paymentMode: 'opex', structure: 'single',
    ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
    duration: 60, targetMargin: 30, warrantyPct: 0,
    installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
    invoicing: 'monthly',
    opexUnitFees: { ss: 700 }, opexUnitMargins: { aq: 41 },
  },
  expected_revision: rev,
})

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1920, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await p.waitForFunction(() => !!document.querySelector('[data-testid="deal-opex-reset"]'),
      { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    /** The three numbers that separate the candidates. */
    const measure = () => p.evaluate(() => {
      const t = document.querySelector('[data-testid="deal-opex-table"]')
      const btn = document.querySelector('[data-testid="deal-opex-reset"]')
      const card = t?.closest('.pg-card') ?? t?.parentElement?.parentElement
      const tr = t.getBoundingClientRect(), br = btn.getBoundingClientRect()
      const cr = card?.getBoundingClientRect()
      return {
        gapBelowTable: Math.round(br.top - tr.bottom),
        rightEdgeGap: Math.round(tr.right - br.right),
        cardHeight: cr ? Math.round(cr.height) : null,
        btnTop: Math.round(br.top),
      }
    })

    const shoot = async (name) => {
      await p.evaluate(() => document.querySelector('[data-testid="deal-opex-table"]')
        ?.scrollIntoView({ block: 'center' }))
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const ok = await p.evaluate(() => {
        const t = document.querySelector('[data-testid="deal-opex-table"]')
        const btn = document.querySelector('[data-testid="deal-opex-reset"]')
        const tr = t?.getBoundingClientRect(), br = btn?.getBoundingClientRect()
        // BOTH must be in the region: a capture showing the table and not the
        // control cannot settle a question about where the control is.
        const vis = (r) => r && r.top < window.innerHeight && r.bottom > 0
        return vis(tr) && vis(br)
      })
      console.log(`    capture ${name}-${width}: table AND control in region = ${ok}`)
      await p.screenshot({ path: `${OUT}${name}-${width}.png` })
    }

    console.log(`\n=== ${width}px ===`)
    console.log('  CANDIDATE A, as committed: grid-row 4, the foot of the card')
    const a = await measure()
    say('gap below the table', `${a.gapBelowTable}px`)
    say('right edge inside the table s', `${a.rightEdgeGap}px`)
    say('card height', `${a.cardHeight}px`)
    await shoot('candidate-a')

    // ── CANDIDATE B, IN THE PAGE ONLY ──────────────────────────────────
    //
    // The table and the control are wrapped in one box that takes the table's
    // own grid area, so the control follows the table's last row directly
    // instead of the card's foot. Applied by script, never committed.
    console.log('\n  CANDIDATE B, in-page only: the control follows the table s last row')
    await p.evaluate(() => {
      const t = document.querySelector('[data-testid="deal-opex-table"]')
      const row = document.querySelector('.opex-reset-row')
      const grid = t.parentElement
      const wrap = document.createElement('div')
      wrap.id = 'candidate-b-wrap'
      wrap.style.gridColumn = '1'
      wrap.style.gridRow = '2 / span 2'
      wrap.style.alignSelf = 'start'
      wrap.style.minWidth = '0'
      grid.insertBefore(wrap, t)
      wrap.appendChild(t)
      wrap.appendChild(row)
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const bb = await measure()
    say('gap below the table', `${bb.gapBelowTable}px`)
    say('right edge inside the table s', `${bb.rightEdgeGap}px`)
    say('card height', `${bb.cardHeight}px`)
    say('card height change vs A', `${bb.cardHeight - a.cardHeight}px`)
    await shoot('candidate-b')

    // ── AND PUT THE PAGE BACK, PROVED ──────────────────────────────────
    const restored = await p.evaluate(() => {
      const wrap = document.getElementById('candidate-b-wrap')
      if (!wrap) return false
      const grid = wrap.parentElement
      const t = wrap.querySelector('table'), row = wrap.querySelector('.opex-reset-row')
      grid.insertBefore(t, wrap); grid.insertBefore(row, wrap)
      wrap.remove()
      return !document.getElementById('candidate-b-wrap')
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const back = await measure()
    say('page restored', `${restored}, gap back to ${back.gapBelowTable}px`)
    if (!restored || back.gapBelowTable !== a.gapBelowTable) {
      console.log('    STOPPING: the page was not put back as it was found')
      process.exitCode = 1
    }
  }
} finally {
  await b.close()
  await tearDown(TAG)
}
console.log('\nPhotographs in .verify/opex-reset/. Nothing was committed and nothing was decided.')
