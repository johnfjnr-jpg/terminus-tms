// ── E2: THE ROW TOTAL TIES TO units x fee x term, FROM THE CLICK ────────
//
// R-TL1a, driven on a REAL Lump Sum OPEX deal in a browser: the fee is typed
// into the cell a person types into, and the Contract Total is read off the
// screen a person reads.
//
// ── WHY THE CLICK AND NOT THE MODEL ─────────────────────────────────────
//
// The model tests already assert this arithmetic. What they cannot show is that
// the figure a person TYPES reaches the allocation and comes back unchanged in
// the cell beside it: the panel recomputes locally, and a rule that holds in
// `buildDealInputs` and not in the panel's own recompute would leave the screen
// disagreeing with the saved record.
//
// BOTH INSTALLATION MODES, per E2 as amended. The defect was specific to Lump
// Sum and the fix must not have bought it at per-unit's expense.
//
// UNWIRED: needs a browser, a live server and a session.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-e2-fee-ties-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/test-log-1/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'E2FEETIES'

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const SS_EXISTING = 11, SS_NEW = 10, TERM = 60
const N = SS_EXISTING + SS_NEW

const { oppId } = await freshOpportunity(TAG)
// The deal is saved through the ROUTE, so the panel opens on a record the
// system produced rather than on values a probe pushed into a form.
await api('PATCH', `/opportunities/${oppId}`, {
  payload: {
    paymentMode: 'opex', structure: 'single',
    ssExisting: SS_EXISTING, ssNew: SS_NEW, aqm: 9, hemir: 0,
    duration: TERM, targetMargin: 30, warrantyPct: 0,
    installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
    invoicing: 'monthly',
  },
  expected_revision: (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number,
})

const money = (s) => Number(String(s).replace(/[^0-9.-]/g, ''))

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.setViewport({ width: 1920, height: 1200 })
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
  }, { timeout: 25000 })
  await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await p.waitForFunction(() => !!document.querySelector('[data-testid="deal-opex-table"]'), { timeout: 25000 })
  await p.evaluate(() => document.fonts.ready)

  /** Type into the fee cell the way a person does, then let React settle. */
  const typeFee = async (v) => {
    await p.evaluate((val) => {
      const e = document.querySelector('[data-testid="deal-opexfee-ss"]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(e, val)
      e.dispatchEvent(new Event('input', { bubbles: true }))
    }, v)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }
  const read = () => p.evaluate(() => {
    const t = (s) => (document.querySelector(s)?.textContent ?? '').trim()
    const v = (s) => document.querySelector(s)?.value ?? ''
    return {
      total: t('[data-testid="deal-opextotal-ss"]'),
      fee: v('[data-testid="deal-opexfee-ss"]'),
      margin: v('[data-testid="deal-opexmargin-ss"]'),
      marginOverride: document.querySelector('[data-testid="deal-opexmargin-ss"]')?.dataset.override,
      installResp: v('#deal-installResp') || t('#deal-installResp'),
    }
  })

  // ── THE COUNTERFACTUAL FIRST: what the row says with NO fee stored ────
  const before = await read()
  check(!!before.total, 'the OPEX table renders a SafeSight total to begin with', before.total)

  // ── LUMP SUM, THE SHAPE THE DEFECT LIVED IN ──────────────────────────
  console.log('\n=== LUMP SUM ===')
  for (const fee of [500, 800]) {
    await typeFee(String(fee))
    const m = await read()
    const want = fee * N * TERM
    check(money(m.total) === want,
      `a $${fee} fee gives exactly ${N} x ${fee} x ${TERM} = ${want.toLocaleString()}`,
      `screen reads ${m.total}`)
    check(Number(m.fee) === fee, `and the fee cell still reads ${fee}`, m.fee)
    // R-TL2 from the click, on the same keystroke: typing a fee clears the
    // margin override, so the cell stops claiming a decision.
    check(m.marginOverride === 'false',
      'and the margin cell is not dressed as an override', `override=${m.marginOverride}`)
  }
  await p.screenshot({ path: `${OUT}e2-lump-sum.png` })

  // ── AND PER UNIT, WHICH THE FIX MUST NOT HAVE COST ───────────────────
  console.log('\n=== PER UNIT ===')
  await p.evaluate(() => {
    const sel = document.querySelector('#deal-installResp')
    if (!sel) return
    const opt = [...sel.options].find((o) => /Per Unit/.test(o.textContent || o.value))
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(sel, opt ? opt.value : sel.value)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const mode = await read()
  check(/Per Unit/i.test(String(mode.installResp)), 'the deal is now per-unit installation',
    String(mode.installResp))
  for (const fee of [500, 800]) {
    await typeFee(String(fee))
    const m = await read()
    const want = fee * N * TERM
    check(money(m.total) === want,
      `a $${fee} fee gives exactly ${want.toLocaleString()} per-unit too`, `screen reads ${m.total}`)
  }
  await p.screenshot({ path: `${OUT}e2-per-unit.png` })

  check(errs.length === 0, 'no page errors throughout', errs.join(' | '))
} finally {
  await b.close()
  await tearDown(TAG)
}

const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} E2 checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
