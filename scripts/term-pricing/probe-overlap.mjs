#!/usr/bin/env node
// ── TERM PRICING: NO OVERPRINT, NO TRACK BELOW ITS CONTENT, ON EVERY TAB ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/probe-overlap.mjs [--only=tp|opex] [--inject=<name>] [--live-margins]
//
// Runs the shared STRUCTURAL detector (scripts/lib/ink-overlap.mjs) at every
// width from 1240 to 1920 in steps of 40 (A2), in every state.
//
// RE-POINTED by TP_TABS (John, 2026-10-11): the screen is three tabs, and the
// sweep covers every tab in every state:
//   Pricing        OPEX and CAPEX, Settings collapsed and expanded, as a
//                  non-admin and as an admin (the only tab an admin changes);
//   Payment terms  WHT off, split (5% / 10%, grossed up, CPI published 3% from
//                  year 3) and borne (10%), each under OPEX and four CAPEX
//                  shapes: the default, Monthly instalments over 12, G-C2's
//                  three milestones, and T4-G1's milestones still being entered;
//   Quote          the same states where a quote prices, tax detail off and on.
// And the deal form's OPEX card (OPEX_RESET Q1), on a fixture built through the
// API the way the screen builds a deal.
//
// RETIRED by TP_TABS, QUOTED NOT DELETED, with the layout they measured: B2
// "term buttons in rows of five" (the ladder row is the term's selector, T-2),
// TP_INPUTS I1 to I4 (the Inputs card), and their injections `six-a-row`,
// `i1-wrap` and `i3-height`. `shrink` re-points from `.tp-units` to the units
// row, and `capex-schedule-wide` to the fitted (tax-detail) schedule.
//
// THE ADMIN STATE IS BUILT DIRECTLY, AND SAID SO (Verification 47's clause).
// The probe account is not an admin; the screen reads one field, `isAdmin`,
// from GET /api/term-pricing, so that one field is flipped in the browser's
// copy of the real response. It proves the admin LAYOUT only.
//
// EVERY VERDICT NEEDS A POPULATION (Verification 14): each state asserts it
// was REACHED, and the detector its atoms, before its zero is counted.
//
// --inject=<name> applies an in-page fault for calibration. No file is touched.
//
// UNWIRED: needs a browser, a live server and a session.

import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { inkOverlaps, shrunkBelowContent } from '../lib/ink-overlap.mjs'
const puppeteer = await loadPuppeteer('probe-overlap.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const BASE = process.env.TMS_BASE ?? 'http://127.0.0.1:3000'
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
const ONLY = arg('only')
const INJECT = arg('inject')
const SHOTS = arg('shots')
const WIDTHS = []
for (let w = 1240; w <= 1920; w += 40) WIDTHS.push(w)
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]

let failures = 0, passes = 0
const check = (ok, claim, detail = '') => {
  if (ok) passes++; else failures++
  if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `\n        ${detail}` : ''}`)
}
const settle = (p) => p.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))

const INJECTIONS = {
  // Pulled UP into its own label's text (the label sits above the input).
  'label-input': '[data-testid="tp-gst"] { margin-top: -26px !important; }',
  // A units input forced narrower than its content.
  shrink: '.tp-units-row .tp-num { width: 20px !important; min-width: 0 !important; flex: none !important; }',
  'l2-borderless': '.tp-num.tp-select:disabled { border-color: transparent !important; }',
  // TILE_FIT calibrations (E2): a planted per-tile size must fire the shared-
  // size check; a planted 8px floor must fire F3.
  'per-tile-size': '#view-term-pricing .tp-figures > div:nth-child(2) .tp-v { font-size: 12px !important; }',
  'floor-8': '#view-term-pricing .tp-figures { --tp-fig-min: 8 !important; }',
  // The per-camera figures pushed over the monthly fee column (160px: the ink
  // gap measured 94px at 1240 and 128px at 1920).
  'percam-over-fee': '[data-testid^="tp-ladder-percam-"] { position: relative; left: -160px; }',
  // The tax-detail schedule's fitting switched off (its figure size pinned)
  // must fire the Quote fit check wherever the fitting was doing the work.
  'capex-schedule-wide': '.tp-table.tp-schedule.tp-schedule-fit td { font-size: 14px !important; }',
  // TP_TABS: the summary column forced beside the work at every width must
  // fire where the view cannot hold both (the container query's reason).
  'side-by-side': '.tp-grid { grid-template-columns: minmax(0, 1fr) 360px !important; grid-template-areas: "main side" "main next" !important; }',
}

async function signedIn(browser, { admin = false } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1240, height: 1100 })
  // TERMS AS v1.3 (B1) and MARGINS AS THE SPEC (R1), IN THE BROWSER'S COPY
  // ONLY, AND SAID SO. --live-terms and --live-margins measure the live ones.
  const terms = process.argv.includes('--live-terms') ? null : [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]
  const m = { safesight: '90', air_quality: '90', hemir: '90' }
  const margins = process.argv.includes('--live-margins') ? null : { ANCHOR_MARGIN: m, SHORT_TERM_MARGIN: m }
  await page.evaluateOnNewDocument((admin, terms, margins) => {
    const real = window.fetch
    window.fetch = async (...a) => {
      const res = await real(...a)
      const url = String(a[0]?.url ?? a[0])
      if (!/\/api\/term-pricing(\?|$)/.test(url) || !res.ok) return res
      const body = await res.clone().json()
      const out = { ...body, ...(admin ? { isAdmin: true } : {}),
        settings: { ...body.settings, ...(terms ? { TERMS: terms } : {}), ...(margins ?? {}) } }
      return new Response(JSON.stringify(out), { status: res.status, headers: res.headers })
    }
  }, admin, terms, margins)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
  if (INJECT && INJECTIONS[INJECT]) await page.addStyleTag({ content: INJECTIONS[INJECT] })
  return page
}

// Select the field's content and type with REAL keys (React dedupes a value
// write), then read it back before anything is measured.
async function typeInto(page, testid, value) {
  const sel = `[data-testid="${testid}"]`
  await page.focus(sel)
  await page.$eval(sel, (e) => e.select())
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
  const got = await page.$eval(sel, (e) => e.value)
  if (got !== value) throw new Error(`typing into ${testid}: wanted ${JSON.stringify(value)}, it holds ${JSON.stringify(got)}`)
}
async function setSwitch(page, testid, on) {
  const sel = `[data-testid="${testid}"]`
  if ((await page.$eval(sel, (e) => e.getAttribute('aria-checked'))) !== String(on)) await page.click(sel)
  await page.waitForFunction((s, v) => document.querySelector(s)?.getAttribute('aria-checked') === String(v), {}, sel, on)
}
// T-1: open a tab and wait on THAT panel.
async function openTab(page, name) {
  await page.click(`[data-testid="tp-tab-${name}"]`)
  await page.waitForSelector(`[data-testid="tp-panel-${name}"]`, { timeout: 6000 })
}

// The payment shapes, on the Payment terms tab. Idempotent: each first returns
// the milestone table to one row.
async function shape(page, s) {
  await page.click(`[data-testid="tp-basis-${s === 'opex' ? 'opex' : 'capex'}"]`)
  if (s === 'opex') return
  const rows = () => page.$$eval('[data-testid^="tp-ms-key-"]', (x) => x.length)
  if (s === 'two-phase') {
    await page.click('[data-testid="tp-capex-hardware"]')
    await page.click('[data-testid="tp-capex-two_phase"]')
    await page.waitForSelector('[data-testid="tp-capex-instalments"]')
    return
  }
  await page.click('[data-testid="tp-capex-hybrid"]')
  await page.waitForSelector('[data-testid="tp-ms-key-0"]')
  while ((await rows()) > 1) await page.click(`[data-testid="tp-ms-remove-${(await rows()) - 1}"]`)
  if (s === 'default') {
    await page.click('[data-testid="tp-capex-hardware"]')
    await typeInto(page, 'tp-ms-share-0', '100')
  } else {
    await page.click('[data-testid="tp-capex-custom"]')
    await typeInto(page, 'tp-capex-amount', '1000000.00')
    if (s === 'incomplete') {
      // T4-G1: 50% at contract start, 30% at installation, 20% still to go.
      await typeInto(page, 'tp-ms-share-0', '50')
      await page.click('[data-testid="tp-ms-add"]'); await page.waitForSelector('[data-testid="tp-ms-key-1"]')
      await page.select('[data-testid="tp-ms-key-1"]', 'Installation complete')
      await typeInto(page, 'tp-ms-month-1', '4'); await typeInto(page, 'tp-ms-share-1', '30')
      await page.waitForSelector('[data-testid="tp-ms-remaining"]')
      return
    }
    await typeInto(page, 'tp-ms-share-0', '30')
    await page.click('[data-testid="tp-ms-add"]'); await page.waitForSelector('[data-testid="tp-ms-key-1"]')
    await page.select('[data-testid="tp-ms-key-1"]', 'Hardware delivered to site')
    await typeInto(page, 'tp-ms-month-1', '3'); await typeInto(page, 'tp-ms-share-1', '40')
    await page.click('[data-testid="tp-ms-add"]'); await page.waitForSelector('[data-testid="tp-ms-key-2"]')
    await page.select('[data-testid="tp-ms-key-2"]', 'Commissioning')
    await typeInto(page, 'tp-ms-month-2', '6'); await typeInto(page, 'tp-ms-share-2', '30')
  }
  // Wait on the state itself: the quote prices.
  await page.waitForFunction(() => !document.querySelector('[data-testid="tp-ready"]') && !document.querySelector('[data-testid="tp-next-payment"]')?.disabled, { timeout: 6000 })
}
// The WHT states, on the Payment terms tab.
async function whtState(page, w) {
  if (w === 'off') {
    await page.click('[data-testid="tp-wht-none"]')
    await page.click('[data-testid="tp-cpi-none"]')
  } else if (w === 'split') {
    // A CPI with the start year live, so the CPI controls are in the state too.
    await page.click('[data-testid="tp-cpi-published"]')
    await page.waitForSelector('[data-testid="tp-escalator"]')
    await typeInto(page, 'tp-escalator', '3')
    await page.select('[data-testid="tp-escalator-start"]', '3')
    await page.click('[data-testid="tp-wht-split"]')
    await typeInto(page, 'tp-wht-hw', '5'); await typeInto(page, 'tp-wht-saas', '10')
    await setSwitch(page, 'tp-wht-grossup', true)
  } else {
    await page.click('[data-testid="tp-wht-single"]')
    await typeInto(page, 'tp-wht', '10')
    await setSwitch(page, 'tp-wht-grossup', false)
  }
}

async function sweep(page, rootSel, label, reached, extra) {
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 1100 })
    await settle(page)
    const where = `${label} at ${width}`
    const r = await reached(page)
    check(r.ok, `${where}: the state was reached`, r.detail)
    if (!r.ok) continue
    const ink = await page.evaluate(inkOverlaps, rootSel)
    check(!ink.missing && ink.atoms >= r.minAtoms, `${where}: the detector has a population`, `${ink.atoms} atoms, need ${r.minAtoms}${ink.missing ? ', ROOT MISSING' : ''}`)
    check(ink.hits.length === 0, `${where}: nothing overprints anything (${ink.atoms} atoms)`, ink.hits.slice(0, 8).join('\n        '))
    const sh = await page.evaluate(shrunkBelowContent, rootSel)
    check(sh.items > 0 && sh.hits.length === 0, `${where}: no grid or flex item narrower than its content (${sh.items} items)`, sh.hits.slice(0, 8).join('\n        '))
    if (extra) await extra(page, where)
    if (SHOTS && SHOTS.split(',').map(Number).includes(width)) {
      const h = await page.evaluate(() => document.querySelector('.app-content-scroll')?.scrollHeight ?? 1100)
      await page.setViewport({ width, height: Math.max(1100, h + 40) })
      await settle(page)
      mkdirSync(`${ROOT}prototypes/term-pricing-tabs/built`, { recursive: true })
      const file = `${ROOT}prototypes/term-pricing-tabs/built/${process.env.TP_RUN ?? 'sweep'}-${width}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`
      await page.screenshot({ path: file })
      console.log(`SHOT  ${file.slice(ROOT.length)}`)
      await page.setViewport({ width, height: 1100 })
    }
  }
}

// ── The checks that hold on every tab ─────────────────────────────────────
// The two columns sit side by side only when the summary does not squeeze the
// work: the main column is never narrower than its widest table needs.
const layout = (p) => p.evaluate(() => {
  const grid = document.querySelector('#view-term-pricing .tp-grid')
  if (!grid) return { ok: true, none: true }
  const main = grid.querySelector('.tp-main'), side = grid.querySelector('.tp-side')
  const m = main?.getBoundingClientRect(), s = side?.getBoundingClientRect()
  const sideBySide = !!m && !!s && Math.abs(m.top - s.top) < 2 && s.left > m.left
  const tables = [...(main?.querySelectorAll('table') ?? [])].filter((t) => t.scrollWidth > t.parentElement.clientWidth + 1).map((t) => t.dataset.testid)
  return { ok: tables.length === 0, sideBySide, tables }
})

// The Quote tab: every table fits its card, L1 on the tax detail's Total row,
// and TILE_FIT on the tiles.
async function quoteChecks(p, where, taxOn) {
  const fit = await p.evaluate(() => {
    const over = []
    for (const card of document.querySelectorAll('#view-term-pricing [data-testid="tp-panel-quote"] .tp-card')) {
      const cs = getComputedStyle(card), b = card.getBoundingClientRect()
      const right = b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)
      for (const t of card.querySelectorAll('table')) { const by = Math.round((t.getBoundingClientRect().right - right) * 10) / 10; if (by > 0.5) over.push(`${t.dataset.testid} by ${by}`) }
      if (card.scrollWidth > card.clientWidth + 1) over.push(`${card.dataset.testid} scrolls`)
    }
    const head = [...document.querySelectorAll('#view-term-pricing [data-testid="tp-schedule"] thead th')].at(-1)
    return { over, last: head?.textContent.trim() }
  })
  check(fit.over.length === 0 && fit.last === (taxOn ? 'Terminus receives' : 'Invoice'), `${where}: every Quote table fits its card, the last column (${fit.last}) visible`, JSON.stringify(fit))
  if (taxOn) {
    // L1 (N6): TCV (net) + WHT gross-up + GST = TCV incl. GST, on the Total row,
    // where the gross-up is what the invoices carry above their nets.
    const t = await p.$$eval('#view-term-pricing [data-testid="tp-sched-total"] td', (c) => c.map((x) => x.textContent.trim()))
    const c = (s) => BigInt(String(s).replace(/[,.]/g, ''))
    const net = c(t.at(-6)), invoiced = c(t.at(-5)), gst = c(t.at(-4)), incl = c(t.at(-3))
    check(net > 0n && invoiced >= net && net + (invoiced - net) + gst === incl, `${where}: L1 TCV (net) + WHT gross-up + GST = TCV incl. GST`, JSON.stringify(t))
  }
  // TILE_FIT (F1 to F3): every figure inside its tile; one shared size with
  // the lead in proportion; never under 13px; equal tiles when wrapped.
  const tiles = await p.evaluate(() => {
    const row = document.querySelector('#view-term-pricing .tp-figures')
    const ratio = parseFloat(getComputedStyle(row).getPropertyValue('--tp-fig-lead-ratio'))
    const out = { outside: [], sizes: [], lead: null, ratio, wrapped: row.classList.contains('tp-figures--wrap'), widths: [] }
    for (const t of row.children) {
      const cs = getComputedStyle(t), b = t.getBoundingClientRect()
      const left = b.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)
      const right = b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)
      out.widths.push(Math.round(b.width))
      for (const el of [t.querySelector('.tp-v'), t.querySelector('.tp-label')]) {
        if (!el) continue
        const r = document.createRange(); r.selectNodeContents(el); const fb = r.getBoundingClientRect()
        if (fb.left < left - 0.5 || fb.right > right + 0.5) out.outside.push(`${el.textContent.trim()} by ${Math.round(Math.max(left - fb.left, fb.right - right))}px`)
      }
      const v = t.querySelector('.tp-v')
      const fs = parseFloat(getComputedStyle(v).fontSize)
      if (v.classList.contains('tp-lead')) out.lead = fs; else out.sizes.push(fs)
    }
    return out
  })
  const std = tiles.sizes[0]
  check(tiles.outside.length === 0, `${where}: TILE_FIT every figure and label inside its tile`, tiles.outside.join('; '))
  check(tiles.sizes.length > 0 && tiles.sizes.every((s) => Math.abs(s - std) < 0.05) && Math.abs(tiles.lead - std * tiles.ratio) < 0.1,
    `${where}: TILE_FIT one shared size (${std}px), lead in proportion (${tiles.lead}px)`, JSON.stringify(tiles))
  check(std >= 13 && (!tiles.wrapped || Math.max(...tiles.widths) - Math.min(...tiles.widths) <= 1),
    `${where}: TILE_FIT F3 never under 13px${tiles.wrapped ? ', wrapped with equal tiles' : ''}`, JSON.stringify({ std, wrapped: tiles.wrapped, widths: tiles.widths }))
}

const browser = await puppeteer.launch({ headless: 'new' })
try {
  if (ONLY !== 'opex') {
    const TP = INJECT === 'lost-root' ? '#view-term-pricing-gone' : '#view-term-pricing'
    const panel = (p, name) => p.evaluate((n) => !!document.querySelector(`#view-term-pricing [data-testid="tp-panel-${n}"]`), name)
    for (const admin of [false, true]) {
      const page = await signedIn(browser, { admin })
      await page.evaluate(() => window.navigate('term-pricing'))
      await page.waitForFunction(() => document.querySelector('#view-term-pricing [data-testid="tp-ladder"]'), { timeout: 15000 })
      // The demo deal's units, so every figure is as wide as a real deal makes it.
      await typeInto(page, 'tp-units-safesight', '120')
      await typeInto(page, 'tp-units-air_quality', '40')
      await typeInto(page, 'tp-units-hemir', '2')
      await page.click('[data-testid="tp-ladder-60"]')

      // ── Pricing: OPEX and CAPEX, Settings closed and open. ────────────────
      for (const basis of ['opex', 'capex']) {
        await openTab(page, 'payment'); await page.click(`[data-testid="tp-basis-${basis}"]`); await openTab(page, 'pricing')
        for (const open of [false, true]) {
          const isOpen = await page.$eval('[data-testid="tp-settings-toggle"]', (e) => e.getAttribute('aria-expanded') === 'true')
          if (isOpen !== open) await page.click('[data-testid="tp-settings-toggle"]')
          await sweep(page, TP, `pricing ${admin ? 'admin' : 'non-admin'} ${basis} settings-${open ? 'open' : 'closed'}`, async (p) => {
            const s = await p.evaluate(() => ({
              ladder: !!document.querySelector('#view-term-pricing [data-testid="tp-ladder"]'),
              breakdown: !!document.querySelector('#view-term-pricing [data-testid="tp-breakdown"]'),
              price: !!document.querySelector('#view-term-pricing [data-testid="tp-price"]'),
              open: !!document.querySelector('[data-testid="tp-settings-body"]'),
              adminSave: !!document.querySelector('[data-testid="tp-settings-save"]'),
              basis: document.querySelector('[data-testid="tp-head-basis"]')?.textContent.trim(),
            }))
            const ok = (await panel(p, 'pricing')) && s.ladder && s.breakdown && s.price && s.open === open && (open ? s.adminSave === admin : true) && s.basis === basis.toUpperCase()
            return { ok, detail: JSON.stringify(s), minAtoms: open ? 300 : 200 }
          }, async (p, where) => {
            const l = await layout(p)
            check(l.ok, `${where}: no table in the work column wider than it`, JSON.stringify(l))
          })
        }
        const isOpen = await page.$eval('[data-testid="tp-settings-toggle"]', (e) => e.getAttribute('aria-expanded') === 'true')
        if (isOpen) await page.click('[data-testid="tp-settings-toggle"]')
      }
      // Payment terms and Quote do not depend on the admin flag; swept once.
      if (admin) { await page.close(); continue }

      // ── Payment terms and Quote: every WHT state, every payment shape. ────
      for (const w of ['off', 'split', 'borne']) {
        await openTab(page, 'payment')
        await whtState(page, w)
        for (const s of ['opex', 'default', 'two-phase', 'milestones', 'incomplete']) {
          await openTab(page, 'payment')
          await shape(page, s)
          const label = `${s} wht-${w}`
          await sweep(page, TP, `payment terms ${label}`, async (p) => {
            const st = await p.evaluate(() => ({
              capexSecs: !!document.querySelector('[data-testid="tp-sec-amount"]'),
              remaining: !!document.querySelector('[data-testid="tp-ms-remaining"]'),
              ready: !document.querySelector('[data-testid="tp-ready"]'),
              wht: ['none', 'single', 'split'].find((k) => document.querySelector(`[data-testid="tp-wht-${k}"]`)?.getAttribute('aria-pressed') === 'true'),
              start: document.querySelector('[data-testid="tp-escalator-start"]')?.disabled,
            }))
            const ok = (await panel(p, 'payment')) && st.capexSecs === (s !== 'opex') && st.remaining === (s === 'incomplete') && st.ready === (s !== 'incomplete')
              && st.wht === { off: 'none', split: 'split', borne: 'single' }[w] && st.start === (w === 'split' ? false : undefined)
            return { ok, detail: JSON.stringify(st), minAtoms: s === 'opex' ? 40 : 120 }
          }, async (p, where) => {
            const l = await layout(p)
            check(l.ok, `${where}: no table in the work column wider than it`, JSON.stringify(l))
            // L2: a disabled select still has a visible border.
            const sel = await p.evaluate(() => { const e = document.querySelector('[data-testid="tp-escalator-start"]'); return e && e.disabled ? getComputedStyle(e).borderTopColor : null })
            if (sel) check(!/rgba\(.*,\s*0\)$|transparent/.test(sel), `${where}: L2 the disabled start-year select has a border`, sel)
          })
          if (s === 'incomplete') continue
          await openTab(page, 'quote')
          for (const taxOn of [false, true]) {
            await setSwitch(page, 'tp-tax-detail', taxOn)
            await sweep(page, TP, `quote ${label} tax-${taxOn ? 'on' : 'off'}`, async (p) => {
              const st = await p.evaluate(() => ({
                tiles: document.querySelectorAll('#view-term-pricing [data-testid="tp-figures"] > div').length,
                cols: document.querySelectorAll('#view-term-pricing [data-testid="tp-schedule"] thead th').length,
                capexTile: !!document.querySelector('[data-testid="tp-q-capex"]'),
              }))
              const cols = (s === 'opex' ? 3 : 4) + (taxOn ? 5 : 0)
              const ok = (await panel(p, 'quote')) && st.cols === cols && st.capexTile === (s !== 'opex') && st.tiles >= 3
              return { ok, detail: JSON.stringify(st), minAtoms: 80 }
            }, (p, where) => quoteChecks(p, where, taxOn))
          }
          await setSwitch(page, 'tp-tax-detail', false)
        }
      }
      await page.close()
    }
  }

  if (ONLY !== 'tp') {
    const { freshOpportunity, tearDown } = await import('../fixtures.mjs')
    const { api } = await import('../api-client.mjs')
    const TAG = 'tp2ovA'
    try {
      const { oppId } = await freshOpportunity(TAG)
      const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
      // The OPEX_RESET probe's deal B shape: the one Q1 was measured on.
      await api('PATCH', `/opportunities/${oppId}`, { expected_revision: rev, payload: {
        paymentMode: 'opex', structure: 'single', ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
        duration: 60, warrantyPct: 0, installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
        invoicing: 'monthly', targetMargin: 30 } })
      const page = await signedIn(browser)
      await page.evaluate((id) => window.navigate('opportunity-detail', id), oppId)
      await page.waitForFunction(() => { const v = document.getElementById('view-opportunity-detail'); return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading') }, { timeout: 25000 })
      await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
      await page.waitForFunction(() => !!document.querySelector('[data-testid="deal-opex-table"]'), { timeout: 25000 })
      await sweep(page, '#deal-opex-tables', 'deal OPEX card', async (p) => {
        const s = await p.evaluate(() => ({
          table: document.querySelectorAll('[data-testid="deal-opex-table"] tbody tr').length,
          years: !!document.querySelector('#deal-opex-year-slot')?.textContent.match(/Year 1/),
        }))
        return { ok: s.table > 0 && s.years, detail: JSON.stringify(s), minAtoms: 40 }
      })
      // ── LABEL_CONTRAST (John, 2026-10-03, option a): the intake heading ──
      // The lump-sum input and the Installation responsibility select share
      // their top and bottom edges; the units-and-installation section fits its
      // track; and the intake heading's own squeeze is cleared. The shrink check
      // on the whole section covers both of the last two.
      await sweep(page, '#deal-section-1', 'deal units and installation', async (p) => {
        const s = await p.evaluate(() => ({
          lump: !!document.querySelector('#deal-lumpCost'), resp: !!document.querySelector('#deal-installResp'),
        }))
        return { ok: s.lump && s.resp, detail: JSON.stringify(s), minAtoms: 40 }
      }, async (p, where) => {
        const e = await p.evaluate(() => {
          const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(b.top * 10) / 10, b: Math.round(b.bottom * 10) / 10 } }
          return { lump: r('#deal-lumpCost'), resp: r('#deal-installResp'), lumpLabelLines: Math.round(document.querySelector('#deal-lumpCost-group label, #deal-lumpCost-group .deal-field-label, #deal-lumpCost-group span')?.getBoundingClientRect().height ?? 0) }
        })
        check(Math.abs(e.lump.t - e.resp.t) <= 1 && Math.abs(e.lump.b - e.resp.b) <= 1,
          `${where}: the lump-sum input and the responsibility select share top and bottom edges`, JSON.stringify(e))
      })
      if (SHOTS) {
        for (const width of [1240, 1920]) {
          await page.setViewport({ width, height: 1100 })
          await settle(page)
          await page.$eval('#deal-install-panel', (el) => el.scrollIntoView({ block: 'center' }))
          await settle(page)
          await page.mouse.move(1, 1)
          const r = await page.$eval('#deal-install-panel', (el) => { const b = el.getBoundingClientRect(); return { x: b.x - 12, y: b.y - 12, width: b.width + 24, height: b.height + 24 } })
          const file = `${ROOT}prototypes/label-contrast/lc-installation-${width}.png`
          await page.screenshot({ path: file, clip: r })
          console.log(`SHOT  ${file.slice(ROOT.length)}`)
        }
      }
      await page.close()
    } finally {
      await tearDown(TAG)
    }
  }
} finally {
  await browser.close()
}
console.log(`\n${failures === 0 ? 'ALL PASS' : 'FAILURES'}: ${passes} pass, ${failures} fail${INJECT ? ` (injection: ${INJECT})` : ''}`)
process.exit(failures === 0 ? 0 : 1)
