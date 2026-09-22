// C1 LIVE: THE STATEMENT ON THE REAL SURFACE
//
// Two claims a unit test cannot make:
//
//   1. THE STRIP TRACKS A CHANGE MADE IN THE OLD PANELS. The statement and
//      the pricing cards are two surfaces over one derivation, and the whole
//      argument of the round is that they cannot disagree. Driving a margin
//      box in the detail panel and watching the strip move is what says so.
//
//   2. IT FITS AND IT READS. Four money columns beside a label at 1240 is the
//      layout question, and Verification 4's remedy is to open the picture.
//
// THE ROW TEST IS A RELATIONSHIP, NOT A CSS PROPERTY. "The columns line up"
// is the header cell and its column sharing a left edge, measured; asserting
// `display: grid` would be asserting the mechanism (Verification 4's clause).
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('dealsheet/probe-c1-statement.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/dealsheet/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const TAG = 'c1stmt'

let fx
const b = await puppeteer.launch({ headless: 'new' })
try {
  fx = await freshOpportunity(TAG)
  // A DRIVEN DEAL: hardware, a lump-sum installation with a schedule,
  // hosting over a term, factoring and withholding tax, so every line the
  // statement renders has a figure behind it.
  await api('PATCH', `/opportunities/${fx.oppId}`, {
    payload: {
      ssExisting: 20, aqm: 2, hemir: 2, duration: 60,
      targetMargin: 30, warrantyPct: 2,
      installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
      whtPct: 15, gstPct: 9, grossUp: true,
      milestones: [
        { month: 2, label: 'Contract start', pct: 40 },
        { month: 6, label: 'Installation complete', pct: 40 },
        { month: 12, label: 'Go live', pct: 20 },
      ],
      factoring: { enabled: true, ratePct: 1.2, termMonths: 6, method: 'straight' },
    },
  })
  console.log(`fixture ${TAG}: ${fx.oppId}`)

  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1100 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), fx.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    // WAIT ON THE STATEMENT ITSELF, which only the new build can satisfy.
    // The counterfactual is the old page, which has no such element at all.
    await p.waitForFunction(() =>
      !!document.querySelector('[data-testid="stmt-strip-revenue"]')?.textContent?.trim(),
      { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)

    const read = () => p.evaluate(() => {
      const t = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? null
      return {
        revenue: t('stmt-strip-revenue'), cost: t('stmt-strip-cost'),
        profit: t('stmt-strip-profit'), margin: t('stmt-strip-margin'),
        target: t('stmt-strip-target'),
        rowRevenue: t('stmt-revenue-total'), rowTotalCost: t('stmt-total-cost-total'),
        rowProfit: t('stmt-profit'), rowMargin: t('stmt-margin'),
        hwTotal: t('stmt-in-hardware-total'), inTotal: t('stmt-in-installation-total'),
      }
    })
    const before = await read()
    console.log(`  strip: revenue ${before.revenue}  cost ${before.cost}`
      + `  profit ${before.profit}  margin ${before.margin}  (${before.target})`)

    // ── THE STRIP AND THE SHEET ARE ONE DERIVATION ─────────────────────
    check(!!before.revenue && before.revenue === before.rowRevenue,
      'the strip\'s REVENUE equals the statement\'s revenue row',
      `${before.revenue} / ${before.rowRevenue}`)
    check(!!before.profit && before.profit === before.rowProfit,
      'the strip\'s PROFIT equals the RESULT profit', `${before.profit} / ${before.rowProfit}`)
    check(!!before.margin && before.margin === before.rowMargin,
      'the strip\'s MARGIN equals the RESULT margin', `${before.margin} / ${before.rowMargin}`)

    // ── THE COLUMNS LINE UP: a relationship, on the leaves ─────────────
    const align = await p.evaluate(() => {
      const head = [...document.querySelectorAll('.stmt-colhead span')]
      const row = document.querySelector('[data-testid="stmt-row-revenue"] .stmt-row-line')
      const cells = [...row.children]
      // The last four of each are the money columns.
      const h = head.slice(-4).map((e) => Math.round(e.getBoundingClientRect().right))
      const c = cells.slice(-4).map((e) => Math.round(e.getBoundingClientRect().right))
      return { h, c, drift: h.map((x, i) => Math.abs(x - c[i])) }
    })
    check(align.drift.every((d) => d <= 1),
      'every column header sits over its own column', `drift ${JSON.stringify(align.drift)}`)

    // ── THE STRIP IS STICKY ────────────────────────────────────────────
    const sticky = await p.evaluate(async () => {
      const el = document.querySelector('[data-testid="stmt-strip"]')
      const cs = getComputedStyle(el)
      const topBefore = Math.round(el.getBoundingClientRect().top)
      const sc = document.scrollingElement
      const holder = el.closest('.detail-tab-panel') ?? sc
      const target = holder.scrollHeight > holder.clientHeight ? holder : sc
      const was = target.scrollTop
      target.scrollTop = was + 600
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const topAfter = Math.round(el.getBoundingClientRect().top)
      const moved = target.scrollTop - was
      target.scrollTop = was
      return { position: cs.position, topBefore, topAfter, moved }
    })
    // GATED ON THE SCROLL HAVING HAPPENED: "it did not move" is exactly what
    // a page that could not scroll reports (Verification 14).
    if (sticky.moved > 0) {
      check(Math.abs(sticky.topAfter - sticky.topBefore) < sticky.moved / 2,
        'the strip stays put while the sheet scrolls under it',
        `top ${sticky.topBefore} -> ${sticky.topAfter} over ${sticky.moved}px of scroll`)
    } else {
      check(sticky.position === 'sticky',
        'the strip is sticky (the panel did not scroll here, so position is what is left to assert)',
        `position ${sticky.position}`)
    }

    // ── EXPAND ALL, AND THE DRAWERS ARE READ-ONLY ──────────────────────
    await p.click('[data-testid="stmt-expand-all"]')
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const drawers = await p.evaluate(() => {
      const all = [...document.querySelectorAll('[data-testid^="stmt-drawer-"]')]
      return {
        total: all.length,
        open: all.filter((d) => !d.hidden).length,
        // VISIBLE, not merely not-hidden: an attribute assertion is not a
        // visibility assertion, and `.stmt-drawer` could be given a display
        // that beats [hidden].
        visible: all.filter((d) => d.getBoundingClientRect().height > 0).length,
        inputs: document.querySelectorAll('[data-testid="deal-statement"] input, [data-testid="deal-statement"] select, [data-testid="deal-statement"] textarea').length,
      }
    })
    check(drawers.total > 0 && drawers.open === drawers.total,
      'expand all opens every drawer', `${drawers.open} of ${drawers.total}`)
    check(drawers.visible === drawers.total,
      'and they are VISIBLE, not merely un-hidden', `${drawers.visible} of ${drawers.total}`)
    check(drawers.inputs === 0,
      'C1 IS READ-ONLY: the statement contains no input, select or textarea',
      `${drawers.inputs} found`)

    if (width === 1440) {
      // ── THE STRIP TRACKS A CHANGE MADE IN THE OLD PANELS ─────────────
      await p.evaluate(() => {
        const t = document.querySelector('[data-testid="btn-toggle-detail"]')
        if (t && t.getAttribute('aria-expanded') !== 'true') t.click()
      })
      await p.waitForFunction(() => !!document.querySelector('[data-testid="deal-margin-hwSs"]'),
        { timeout: 20000 })
      await p.click('[data-testid="deal-margin-hwSs"]')
      await p.type('[data-testid="deal-margin-hwSs"]', '55', { delay: 20 })
      await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
      const after = await read()
      console.log(`  after typing 55% into the OLD panel's SafeSight margin:`)
      console.log(`  strip: revenue ${after.revenue}  profit ${after.profit}  margin ${after.margin}`)
      check(after.revenue !== before.revenue,
        'the strip REVENUE moved when a margin changed in the old panel',
        `${before.revenue} -> ${after.revenue}`)
      check(after.margin !== before.margin,
        'and the strip MARGIN moved with it', `${before.margin} -> ${after.margin}`)
      check(after.revenue === after.rowRevenue && after.margin === after.rowMargin,
        'and the strip and the sheet still agree AFTER the change',
        `${after.revenue} / ${after.rowRevenue}`)
    }

    await p.evaluate(() => document.querySelector('[data-testid="deal-statement"]')
      ?.scrollIntoView({ block: 'start' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}c1-statement-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('[data-testid="deal-statement"]').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0
    })
    check(inView, `the statement is inside the captured region at ${width}`, shot)
  }
} finally {
  await b.close()
  if (fx) { await tearDown(TAG); console.log(`\ntorn down: ${TAG}`) }
}
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)

