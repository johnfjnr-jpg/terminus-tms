// ── LIVE PROOF: THE STAGED CONTRACTOR ROW PAIR REACHES THE SCREEN ────────
//
// R-N1 extended, John 2026-09-28. The engine fix has a VISIBLE consequence
// nobody has ever seen, and this is the probe that looks at it.
//
// `buildCashFlowRows` (frontend-react/src/deal/cashflow.ts:58) branches on
// `contractorStaged`:
//
//   staged false  ->  ONE row,  "Hardware, warranty and installation"
//   staged true   ->  TWO rows, "Hardware and warranty"
//                               "Contractor milestone payment"
//
// `contractorStaged` was false on every deal the system could save, so the
// SECOND row has never rendered on a real record in the life of this estate.
// The component test that touches it hands the renderer a hand-built cash flow
// object, so it has never been reached from a payload either.
//
// ── THE COUNTERFACTUAL, STATED FIRST (Verification 7) ────────────────────
//
// "Two rows appear" is satisfied by a page that always shows two rows. So the
// SAME record is measured twice: once with the schedule and once with it
// cleared, and the claim is that the pair appears in the first and the single
// row in the second. Without the second half this probe would pass on a
// surface that ignored the schedule entirely, which is the defect it exists to
// prove fixed.
//
// UNWIRED: needs a browser, a live server and a signed-in session. Recorded as
// unwired rather than silently absent, per Verification 9's clause.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('golden-deals/probe-staged-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
// NOT from fixtures.mjs, which does not export it. `api(method, path, body)`,
// and it answers a { data } envelope.
import { api } from '../api-client.mjs'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/golden-deals/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'gdstaged'

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const LUMP = 214000
// The shape a save produces: pct only, no usd. The route refuses a usd.
const SCHEDULE = [
  { month: 1, label: 'Contract start', pct: 40 },
  { month: 5, label: 'Installation complete', pct: 35 },
  { month: 9, label: 'Go live', pct: 25 },
]
const DEAL = {
  paymentMode: 'capex', structure: 'twoPhase',
  ssExisting: 22, ssNew: 14, aqm: 7, hemir: 3,
  duration: 60, recoveryMonths: 18, targetMargin: 30, warrantyPct: 4,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: LUMP,
  invoicing: 'annual',
}

const opp = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  /** Reads the cash flow row labels and the contractor row's cells. */
  const readCashFlow = () => p.evaluate(() => {
    const grid = document.getElementById('deal-cashflow-grid')
    if (!grid) return { grid: false }
    const text = (e) => (e.textContent || '').trim()
    // The label cells are the first cell of each row. Read them by their own
    // text rather than by a class, so this survives a restyle.
    const labels = [...grid.querySelectorAll('.cf-row-label, [data-cf-label]')].map(text)
    const rowFor = (label) => {
      const cell = [...grid.querySelectorAll('*')].find((e) =>
        text(e) === label && e.children.length === 0)
      if (!cell) return null
      const row = cell.parentElement
      return [...row.children].slice(1).map(text)
    }
    return {
      grid: true,
      all: [...new Set([...grid.querySelectorAll('*')]
        .filter((e) => e.children.length === 0 && /^[A-Z]/.test(text(e)) && text(e).length > 8)
        .map(text))],
      labels,
      staged: rowFor('Contractor milestone payment'),
      hwAndWarranty: rowFor('Hardware and warranty'),
      unstaged: rowFor('Hardware, warranty and installation'),
    }
  })

  const openDeal = async () => {
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await p.waitForFunction(() => document.getElementById('deal-cashflow-grid'), { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  let rev = opp.revision
  const save = async (payload) => {
    const r = await api('PATCH', `/opportunities/${opp.oppId}`, {
      payload, expected_revision: rev,
    })
    // THE PRECONDITION COMES FROM THE LAST ACCEPTED RESPONSE, never from a
    // rendered number (Architecture 13).
    rev = r.revision_number ?? r.data?.revision_number ?? rev + 1
  }

  for (const width of [1920, 1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    console.log(`\n=== ${width}px ===`)

    // ── THE COUNTERFACTUAL FIRST: no schedule, so ONE row ────────────────
    errs.length = 0
    await save({ ...DEAL, contractorMilestones: [] })
    await openDeal()
    const without = await readCashFlow()
    check(without.grid, `the cash flow grid renders at ${width}`)
    check(!!without.unstaged, `WITHOUT a schedule the single combined row renders at ${width}`,
      without.unstaged ? '' : `labels seen: ${JSON.stringify(without.all).slice(0, 220)}`)
    check(!without.staged, `WITHOUT a schedule there is NO contractor row at ${width}`)

    // ── THEN THE CLAIM: the schedule, so the PAIR ───────────────────────
    await save({ ...DEAL, contractorMilestones: SCHEDULE })
    await openDeal()
    const withIt = await readCashFlow()
    check(!!withIt.hwAndWarranty, `WITH a schedule the row splits to "Hardware and warranty" at ${width}`)
    check(!!withIt.staged, `WITH a schedule the "Contractor milestone payment" row RENDERS at ${width}`,
      withIt.staged ? '' : `labels seen: ${JSON.stringify(withIt.all).slice(0, 220)}`)
    check(!withIt.unstaged, `and the combined row is GONE at ${width}`)

    // ── AND THE FIGURES ARE IN THE RIGHT MONTHS ─────────────────────────
    if (withIt.staged) {
      const nums = withIt.staged.map((t) => Number(String(t).replace(/[^0-9.-]/g, '')) || 0)
      const nonZero = nums.map((n, i) => [i + 1, n]).filter(([, n]) => n !== 0)
      const total = nums.reduce((a, n) => a + Math.abs(n), 0)
      check(Math.abs(total - LUMP) < 1,
        `the contractor row sums to the lump sum at ${width}`,
        `read ${total}, lump sum ${LUMP}`)
      check(nonZero.length === 3 && nonZero.map(([m]) => m).join(',') === '1,5,9',
        `and it pays in months 1, 5 and 9 only at ${width}`,
        JSON.stringify(nonZero))
    }
    check(errs.length === 0, `no page errors at ${width}`, errs.join(' | '))

    // ── THE CAPTURE HAS TO CONTAIN THE THING ────────────────────────────
    //
    // Verification 4's refined clause. A fullPage capture of this screen puts
    // the cash flow grid thousands of pixels down, so the image is technically
    // complete and unreadable, which is a blank image wearing diligence. The
    // grid is scrolled into view and the VIEWPORT is captured.
    //
    // A viewport capture, not an element capture: photographing the element
    // whose geometry is the claim suppresses the scrollbar and does not put it
    // back. Geometry is not the claim here, and the habit is kept anyway.
    await p.evaluate(() => document.getElementById('deal-cashflow-grid')
      ?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const inView = await p.evaluate(() => {
      const r = document.getElementById('deal-cashflow-grid')?.getBoundingClientRect()
      return r ? r.top < window.innerHeight && r.bottom > 0 : false
    })
    check(inView, `the cash flow grid is inside the captured region at ${width}`)
    await p.screenshot({ path: `${OUT}staged-${width}.png` })
  }
} finally {
  await b.close()
  await tearDown(TAG)
}

const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} checks passed`)
process.exit(pass === checks.length ? 0 : 1)
