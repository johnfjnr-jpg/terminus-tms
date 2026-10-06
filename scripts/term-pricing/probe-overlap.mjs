#!/usr/bin/env node
// ── TERM_PRICING_2 A1, A2, A3 and Q1: NO OVERPRINT, NO TRACK BELOW ITS CONTENT ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/term-pricing/probe-overlap.mjs [--only=tp|opex] [--inject=<name>]
//
// Runs the shared STRUCTURAL detector (scripts/lib/ink-overlap.mjs) at every
// width from 1240 to 1920 in steps of 40 (A2), in every state:
//
//   Term Pricing: OPEX and CAPEX, Settings collapsed and expanded, as a
//   non-admin and as an admin.
//   The deal form's OPEX card (OPEX_RESET Q1), on a fixture built through the
//   API the way the screen builds a deal.
//
// THE ADMIN STATE IS BUILT DIRECTLY, AND SAID SO (Verification 47's clause).
// The probe account is not an admin, and making one is a live write to
// `system_roles` that this round has no ruling for. The screen reads one field,
// `isAdmin`, from GET /api/term-pricing and nothing about how it got there, so
// that one field is flipped in the browser's copy of the real response. Every
// other byte is the route's own. It proves the admin LAYOUT only; the admin
// WRITE path is proven over HTTP elsewhere (probe-live.mjs, E3).
//
// EVERY VERDICT NEEDS A POPULATION (Verification 14): a state that never
// rendered has no atoms and no overlaps, which reads exactly like a pass. Each
// state therefore asserts it was REACHED before its zero is counted.
//
// --inject=<name> applies an in-page fault for calibration. No file is touched:
//   label-input   the GST input is pulled up over its own label text
//   shrink        a Term Pricing input row is forced narrower than its content
//   lost-root     the Term Pricing root selector is wrong (population check)
//   six-a-row     the term buttons lay out six to a row (B2)
//   l2-borderless the disabled start-year select loses its border (L2)
//   i1-wrap       the deal-terms row is too narrow for its groups, so it wraps (I1)
//   i3-height     Split WHT puts the WHT fields on a line of their own (I3)
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
  // Pulled UP into its own label's text. The first version pulled it LEFT, and
  // came back SILENT: measured, the label text sits ABOVE the input (text
  // bottom 191, input top 199), so a sideways move overlapped nothing.
  'label-input': '[data-testid="tp-gst"] { margin-top: -16px !important; }',
  shrink: '.tp-units > * { width: 20px !important; min-width: 0 !important; flex: none !important; }',
  // B2: six to a row is the shape the screen had before this round.
  'six-a-row': '.tp-seg.tp-terms { grid-template-columns: repeat(6, max-content) !important; }',
  // L2 and L3: the two shapes John's approval ruled out.
  'l2-borderless': '.tp-num.tp-select:disabled { border-color: transparent !important; }',
  // TILE_FIT calibrations (E2): a planted per-tile size must fire the shared-
  // size check; a planted 8px floor must fire F3 (the row shrinks below 13px
  // instead of wrapping).
  'per-tile-size': '#view-term-pricing .tp-figures > div:nth-child(3) .tp-v { font-size: 12px !important; }',
  'floor-8': '#view-term-pricing .tp-figures { --tp-fig-min: 8 !important; }',
  // TP_INPUTS: L3's halves are retired with the layout they measured.
  'i1-wrap': '[data-testid="tp-deal-row"] { max-width: 600px !important; }',
  'i3-height': '[data-testid="tp-wht-saas"] { margin-top: 40px !important; }',
}

async function signedIn(browser, { admin = false } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1240, height: 1100 })
  // TERMS AS v1.3 (B1), IN THE BROWSER'S COPY ONLY, AND SAID SO. The live
  // setting is John's to change after the push and this round does not touch
  // it, so B2's rows of five are measured against the spec's ten-term default
  // by rewriting that one field of the real response. --live-terms measures
  // the live setting instead.
  const terms = process.argv.includes('--live-terms') ? null : [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]
  await page.evaluateOnNewDocument((admin, terms) => {
    const real = window.fetch
    window.fetch = async (...a) => {
      const res = await real(...a)
      const url = String(a[0]?.url ?? a[0])
      if (!/\/api\/term-pricing(\?|$)/.test(url) || !res.ok) return res
      const body = await res.clone().json()
      const out = { ...body, ...(admin ? { isAdmin: true } : {}),
        settings: { ...body.settings, ...(terms ? { TERMS: terms } : {}) } }
      return new Response(JSON.stringify(out), { status: res.status, headers: res.headers })
    }
  }, admin, terms)
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

// B2 as a RELATION between elements, not a CSS property (Verification 4's
// clause): the buttons read in term order, five to a row, and each column
// lines up.
async function rowsOfFive(page) {
  return page.evaluate(() => {
    const bs = [...document.querySelectorAll('#view-term-pricing [data-testid^="tp-term-"]')]
    const r = bs.map((b) => { const x = b.getBoundingClientRect(); return { t: Number(b.textContent), top: Math.round(x.top), left: Math.round(x.left) } })
    const problems = []
    for (let i = 1; i < r.length; i++) if (r[i].t <= r[i - 1].t) problems.push(`out of term order at ${r[i].t}`)
    for (let i = 0; i < r.length; i++) {
      const row = Math.floor(i / 5), first = r[row * 5]
      if (r[i].top !== first.top) problems.push(`${r[i].t} is not on row ${row + 1}`)
      if (i % 5 && r[i].left <= r[i - 1].left) problems.push(`${r[i].t} is not right of ${r[i - 1].t}`)
      if (i >= 5 && Math.abs(r[i].left - r[i - 5].left) > 1) problems.push(`${r[i].t} is not under ${r[i - 5].t}`)
    }
    if (r.length > 5 && !(r[5].top > r[0].top)) problems.push('the second row is not below the first')
    return { n: r.length, terms: r.map((x) => x.t).join(','), problems }
  })
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
      mkdirSync(`${ROOT}prototypes/term-pricing/screens`, { recursive: true })
      const file = `${ROOT}prototypes/term-pricing/screens/${process.env.TP_RUN ?? 'tp2'}-${width}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`
      // Where the root sits IN the capture, so a reader can crop to it without guessing.
      const box = await page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && [Math.round(r.top), Math.round(r.bottom)] }, rootSel)
      await page.screenshot({ path: file })
      console.log(`SHOT  ${file.slice(ROOT.length)}  root y ${box?.join('..')}`)
      await page.setViewport({ width, height: 1100 })
    }
  }
}

const browser = await puppeteer.launch({ headless: 'new' })
try {
  if (ONLY !== 'opex') {
    const TP = INJECT === 'lost-root' ? '#view-term-pricing-gone' : '#view-term-pricing'
    for (const admin of [false, true]) {
      const page = await signedIn(browser, { admin })
      await page.evaluate(() => window.navigate('term-pricing'))
      await page.waitForFunction(() => document.querySelector('#view-term-pricing [data-testid="tp-ladder"]'), { timeout: 15000 })
      // QUOTE_PANEL: the demo deal's units, so every figure is as wide as a real
      // deal makes it. The schedule overflowed only with figures this size, and
      // the opening state's one unit could not have shown it.
      await typeInto(page, 'tp-units-safesight', '120')
      await typeInto(page, 'tp-units-air_quality', '40')
      await typeInto(page, 'tp-units-hemir', '2')
      // SPLIT WHT OFF is the opening state, escalator 0 (its start year
      // disabled). SPLIT WHT ON sets both rates and Gross up, and the
      // escalator to 3% from year 3 at 60 months, so the start-year select is
      // live: the B3, B4 and B6 controls in both of the states John reviews.
      // QUOTE_PANEL E3 adds WHT BORNE: one rate, Gross up off, with the
      // escalator still on, so the profit table carries its whole-deal WHT
      // rows and the pricing table its escalator note.
      for (const wstate of ['off', 'on', 'borne']) {
        const split = wstate === 'on'
        if (wstate === 'borne') {
          await setSwitch(page, 'tp-wht-split', false)
          await setSwitch(page, 'tp-wht-grossup', false)
          await typeInto(page, 'tp-wht', '10')
        }
        if (split) {
          await page.click('[data-testid="tp-term-60"]')
          await typeInto(page, 'tp-escalator', '3')
          await page.select('[data-testid="tp-escalator-start"]', '3')
          await setSwitch(page, 'tp-wht-split', true)
          await setSwitch(page, 'tp-wht-grossup', true)
          await typeInto(page, 'tp-wht-hw', '5')
          await typeInto(page, 'tp-wht-saas', '10')
        }
        for (const mode of ['opex', 'capex']) {
          await page.click(`[data-testid="tp-${mode}"]`)
          for (const open of [false, true]) {
            const isOpen = await page.$eval('[data-testid="tp-settings-toggle"]', (e) => e.getAttribute('aria-expanded') === 'true')
            if (isOpen !== open) await page.click('[data-testid="tp-settings-toggle"]')
            const label = `tp ${admin ? 'admin' : 'non-admin'} ${mode} wht-${wstate} settings-${open ? 'open' : 'closed'}`
            await sweep(page, TP, label, async (p) => {
              const s = await p.evaluate((m) => ({
                mode: document.querySelector(`[data-testid="tp-${m}"]`)?.getAttribute('aria-pressed') === 'true',
                open: !!document.querySelector('[data-testid="tp-settings-body"]'),
                adminSave: !!document.querySelector('[data-testid="tp-settings-save"]'),
                ladder: !!document.querySelector('#view-term-pricing [data-testid="tp-ladder"]'),
                split: document.querySelector('[data-testid="tp-wht-split"]')?.getAttribute('aria-checked') === 'true',
                single: !!document.querySelector('[data-testid="tp-wht"]'),
                pair: !!document.querySelector('[data-testid="tp-wht-hw"]') && !!document.querySelector('[data-testid="tp-wht-saas"]'),
                start: document.querySelector('[data-testid="tp-escalator-start"]')?.disabled,
                whtRows: !!document.querySelector('[data-testid="tp-profit-wht"]'),
              }), mode)
              // An admin with Settings open has a Save; a non-admin never does.
              // Split on hides the single rate and shows the pair (B4); the
              // start year is live only with a rate (B6).
              const ok = s.mode && s.ladder && s.open === open && (open ? s.adminSave === admin : true)
                && s.split === split && s.single === !split && s.pair === split && s.start === (wstate === 'off')
                && s.whtRows === (wstate === 'borne')
              return { ok, detail: JSON.stringify(s), minAtoms: open ? 200 : 120 }
            }, async (p, where) => {
              const b2 = await rowsOfFive(p)
              check(b2.n >= 10 && b2.problems.length === 0, `${where}: B2 term buttons in rows of five, in term order (${b2.terms})`, b2.problems.slice(0, 6).join('; '))
              const m = await p.evaluate(() => {
                const cents = (id) => { const t = document.querySelector(`[data-testid="${id}"]`)?.textContent.trim(); return t == null ? null : String(BigInt(t.replace(/[,.]/g, ''))) }
                const sel = document.querySelector('[data-testid="tp-escalator-start"]')
                const lab = sel?.closest('label')

                return {
                  tcv: cents('tp-q-tcv'), up: cents('tp-q-grossup'), gst: cents('tp-q-gst'), incl: cents('tp-q-tcvincl'),
                  grossUpOn: document.querySelector('[data-testid="tp-wht-grossup"]')?.getAttribute('aria-checked') === 'true',
                  selBorder: sel && getComputedStyle(sel).borderTopColor, selLeft: sel && Math.round(sel.getBoundingClientRect().left),
                  labLeft: lab && Math.round(lab.getBoundingClientRect().left), selDisabled: sel?.disabled,
                }
              })
              // L1: present exactly when Gross up is on, and the tiles foot either way.
              const sum = [m.tcv, m.up ?? '0', m.gst].reduce((a, x) => a + BigInt(x), 0n)
              check(!!m.tcv && !!m.gst && !!m.incl && (m.up !== null) === m.grossUpOn && sum === BigInt(m.incl),
                `${where}: L1 TCV (net)${m.grossUpOn ? ' + WHT gross-up' : ''} + GST = TCV incl. GST`, JSON.stringify(m))
              // L2: a disabled select still has a visible border and sits under its label.
              if (m.selDisabled) {
                check(!/rgba\(.*,\s*0\)$|transparent/.test(m.selBorder) && m.selLeft === m.labLeft,
                  `${where}: L2 the disabled start-year select has a border, under its label`, JSON.stringify({ border: m.selBorder, sel: m.selLeft, label: m.labLeft }))
              }
              // ── QUOTE_PANEL overflow ruling: every table in the panel fits the
              // panel's content box, and "Terminus receives" is visible without
              // scrolling. A relation between elements, not a CSS property.
              const fit = await p.evaluate(() => {
                const card = document.querySelector('#view-term-pricing [aria-label="Quote"]')
                const cs = getComputedStyle(card), b = card.getBoundingClientRect()
                const right = b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)
                const over = [...card.querySelectorAll('table')].map((t) => ({ id: t.dataset.testid, by: Math.round((t.getBoundingClientRect().right - right) * 10) / 10 })).filter((x) => x.by > 0.5)
                const head = [...card.querySelectorAll('[data-testid="tp-schedule"] thead th')].at(-1)
                return { over, cardScrolls: card.scrollWidth > card.clientWidth + 1, receives: head?.textContent.trim(), receivesRight: head && Math.round(head.getBoundingClientRect().right - right) }
              })
              check(fit.over.length === 0 && !fit.cardScrolls && fit.receives === 'Terminus receives' && fit.receivesRight <= 0.5,
                `${where}: every Quote table fits the panel, "Terminus receives" visible`, JSON.stringify(fit))
              // ── TILE_FIT (F1 to F3): every figure inside its tile; one shared
              // size per row with the lead in proportion; never under 13px; and
              // when the row wraps, every tile the same width.
              const tiles = await p.evaluate(() => {
                const row = document.querySelector('#view-term-pricing [aria-label="Quote"] .tp-figures')
                const ratio = parseFloat(getComputedStyle(row).getPropertyValue('--tp-fig-lead-ratio'))
                const out = { outside: [], sizes: [], lead: null, ratio, wrapped: row.classList.contains('tp-figures--wrap'), widths: [] }
                for (const t of row.children) {
                  const cs = getComputedStyle(t), b = t.getBoundingClientRect()
                  const left = b.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)
                  const right = b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)
                  out.widths.push(Math.round(b.width))
                  const v = t.querySelector('.tp-v')
                  if (!v) continue
                  const r = document.createRange(); r.selectNodeContents(v); const fb = r.getBoundingClientRect()
                  if (fb.left < left - 0.5 || fb.right > right + 0.5) out.outside.push(`${v.textContent.trim()} by ${Math.round(Math.max(left - fb.left, fb.right - right))}px`)
                  const fs = parseFloat(getComputedStyle(v).fontSize)
                  if (v.classList.contains('tp-lead')) out.lead = fs; else out.sizes.push(fs)
                }
                return out
              })
              const std = tiles.sizes[0]
              check(tiles.outside.length === 0, `${where}: TILE_FIT every figure inside its tile`, tiles.outside.join('; '))
              check(tiles.sizes.length > 0 && tiles.sizes.every((s) => Math.abs(s - std) < 0.05) && Math.abs(tiles.lead - std * tiles.ratio) < 0.1,
                `${where}: TILE_FIT one shared size (${std}px), lead in proportion (${tiles.lead}px)`, JSON.stringify(tiles))
              check(std >= 13 && (!tiles.wrapped || Math.max(...tiles.widths) - Math.min(...tiles.widths) <= 1),
                `${where}: TILE_FIT F3 never under 13px${tiles.wrapped ? ', wrapped with equal tiles' : ''}`, JSON.stringify({ std, wrapped: tiles.wrapped, widths: tiles.widths }))
              // ── TP_INPUTS I1 to I4, as relations between elements ──────────
              const inputs = () => p.evaluate(() => {
                const card = document.querySelector('#view-term-pricing [aria-label="Inputs"]')
                const kids = (id) => [...document.querySelectorAll(`[data-testid="${id}"] > *`)].map((e) => e.getBoundingClientRect())
                const deal = kids('tp-deal-row'), tax = kids('tp-tax-row')
                const spread = (xs) => Math.round(Math.max(...xs) - Math.min(...xs))
                const fields = ['tp-gst', 'tp-wht', 'tp-wht-hw', 'tp-wht-saas'].map((t) => document.querySelector(`[data-testid="${t}"]`)).filter(Boolean)
                  .map((i) => ({ t: i.dataset.testid, w: Math.round(i.getBoundingClientRect().width), dx: Math.round(i.getBoundingClientRect().left - i.closest('label').getBoundingClientRect().left) }))
                return {
                  h: Math.round(card.getBoundingClientRect().height),
                  dealTops: deal.length ? spread(deal.map((r) => r.top)) : null, dealN: deal.length,
                  taxBottoms: tax.length ? spread(tax.map((r) => r.bottom)) : null, taxN: tax.length,
                  fields, note: document.querySelector('[data-testid="tp-tax-note"]')?.textContent.trim(),
                  split: document.querySelector('[data-testid="tp-wht-split"]')?.getAttribute('aria-checked') === 'true',
                }
              })
              const a = await inputs()
              const NOTE = 'WHT applies to each invoice line before GST. GST is added on top of every invoice.'
              const SPLIT_NOTE = ' With Split WHT on, OPEX invoices carry a hardware line and a SaaS line.'
              const rowsOk = (x) => x.dealN === 3 && x.dealTops <= 1 && x.taxN === (x.split ? 5 : 4) && x.taxBottoms <= 1
              check(rowsOk(a), `${where}: I1 deal terms one row of three groups, tax one row`, JSON.stringify({ dealN: a.dealN, dealTops: a.dealTops, taxN: a.taxN, taxBottoms: a.taxBottoms }))
              check(a.fields.length === (a.split ? 3 : 2) && a.fields.every((f) => f.w <= 60 && f.dx === 0),
                `${where}: I2 GST and WHT inputs two digits wide, under their labels`, JSON.stringify(a.fields))
              check(a.note === NOTE + (a.split ? SPLIT_NOTE : ''), `${where}: I4 the tax note reads for split ${a.split ? 'on' : 'off'}`, JSON.stringify(a.note))
              // I3: toggle Split WHT, measure, toggle back. The card's height must not move.
              await p.click('[data-testid="tp-wht-split"]')
              await p.waitForFunction((v) => document.querySelector('[data-testid="tp-wht-split"]')?.getAttribute('aria-checked') === String(v), {}, !a.split)
              await settle(p)
              const b = await inputs()
              await p.click('[data-testid="tp-wht-split"]')
              await p.waitForFunction((v) => document.querySelector('[data-testid="tp-wht-split"]')?.getAttribute('aria-checked') === String(v), {}, a.split)
              await settle(p)
              const c = await inputs()
              check(b.split === !a.split && a.h === b.h && c.h === a.h && rowsOk(b),
                `${where}: I3 toggling Split WHT keeps the card's height (${a.h}px) and the tax row one line`, JSON.stringify({ heights: [a.h, b.h, c.h], toggled: { taxN: b.taxN, taxBottoms: b.taxBottoms, dealTops: b.dealTops } }))
            })
          }
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
