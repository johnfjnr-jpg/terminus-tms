#!/usr/bin/env node
// ── TERM_PRICING Phase 2: the static mockup, generated ───────────────────
//
//   node prototypes/term-pricing/build-mockup.mjs
//
// Writes prototypes/term-pricing/index.html. Every figure on the page is
// computed here by the Phase 1 engine and embedded as text, so the mockup
// cannot show a number the engine would not produce. The page itself is
// static: no import, no network, no database. Its toggles switch between
// states precomputed below.
//
// Allowlisted as an importer of the engine in
// scripts/tests/term-pricing-isolation.test.mjs.
//
// Demo inputs are the Phase 0 catalog as read on 2026-10-01 and the spec's
// section 3 defaults. They are fixed in the mockup; the screen (Phase 3) reads
// both live.
//
// TERM_PRICING_2 (John, 2026-10-02): regenerated from the APPROVED screen, with
// spec v1.3's ten-term TERMS, the typed WHT with Gross up and Split WHT, the
// escalator start year, and L1 to L3. A static page cannot price a typed
// value, so its controls take the screen's shape and a mock-only state strip
// chooses between precomputed engine states.
//
// UNWIRED: a build script for a prototype page, run by hand.

import { writeFileSync } from 'node:fs'
import { priceQuote, termLadder, formatMoney, formatPct } from '../../src/lib/term-pricing.js'

const PRODUCTS = [
  { key: 'safesight', label: 'SafeSight' },
  { key: 'air_quality', label: 'AQ' },
  { key: 'hemir', label: 'HEMIR' },
]

const PARAMS = {
  TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120],
  ANCHOR_TERM: 36,
  ANCHOR_MARGIN: { safesight: '90', air_quality: '90', hemir: '90' },
  SHORT_TERM_MARGIN: { safesight: '90', air_quality: '90', hemir: '90' },
  PROFIT_STEP: '0.00',
  VOLUME_BANDS: [
    { from: 1, discountPct: '0' }, { from: 10, discountPct: '5' },
    { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' },
  ],
  HW_UPFRONT_MARGIN: '20',
  MARGIN_FLOOR: '25',
  CURRENCY: 'USD',
  costs: {
    safesight: { hwCost: '8000.00', hostingMonthly: '200.00' },
    air_quality: { hwCost: '2000.00', hostingMonthly: '100.00' },
    hemir: { hwCost: '100000.00', hostingMonthly: '500.00' },
  },
}
const CATALOG = { batch: 'Initial catalog', from: '2026-08-27' }

const UNITS = { safesight: 120, air_quality: 40, hemir: 2 }
const GST = '9'
// The states the strip offers. The screen takes any rate and any start year.
const ESCALATORS = {
  none: { escalatorPct: null, escalatorStartYear: 2, rate: '', start: 2 },
  y2: { escalatorPct: '3', escalatorStartYear: 2, rate: '3', start: 2 },
  y3: { escalatorPct: '3', escalatorStartYear: 3, rate: '3', start: 3 },
}
const WHT = {
  none: { whtPct: null },
  ten: { whtPct: '10' },
  split: { whtSplit: true, whtHwPct: '5', whtSaasPct: '10' },
}
const GROSS = { off: false, on: true }

const m = formatMoney
const pc = (r) => formatPct(r, 1)
const vs = (saving, isAnchor) => {
  if (isAnchor) return 'list'
  const s = formatPct(saving, 1)
  return s.startsWith('-') ? `+${s.slice(1)}%` : `−${s}%`
}
const label = (k) => PRODUCTS.find((p) => p.key === k)?.label ?? k

// ── Precompute every state the page can show ─────────────────────────────

const ladders = {}
// A1: one ladder per structure. Under CAPEX each row carries the upfront and
// the year-1 service fee from the CAPEX quote at that term.
for (const s of ['opex', 'capex']) for (const [ek, e] of Object.entries(ESCALATORS)) {
  ladders[`${s}|${ek}`] = termLadder({ units: UNITS, paymentStructure: s, escalatorPct: e.escalatorPct, escalatorStartYear: e.escalatorStartYear }, PARAMS).map((r) => ({
    term: r.termMonths, anchor: r.isAnchor, monthly: m(r.monthlyTotalCents), vs: vs(r.savingVsAnchor, r.isAnchor),
    upfront: r.upfrontCents === null ? null : m(r.upfrontCents),
    service: r.monthlyServiceCents === null ? null : m(r.monthlyServiceCents),
    vsKind: r.isAnchor ? 'list' : (r.savingVsAnchor.n < 0n ? 'premium' : 'saving'),
    tcv: m(r.tcvNetCents), margin: pc(r.grossMargin), flag: r.belowMarginFloor,
  }))
}

const quotes = {}
for (const T of PARAMS.TERMS) for (const s of ['opex', 'capex']) for (const [ek, e] of Object.entries(ESCALATORS)) for (const [wk, w] of Object.entries(WHT)) for (const [gk, g] of Object.entries(GROSS)) {
  const q = priceQuote({ units: UNITS, termMonths: T, paymentStructure: s, escalatorPct: e.escalatorPct, escalatorStartYear: e.escalatorStartYear,
    gstPct: GST, whtGrossUp: g, ...w }, PARAMS)
  quotes[`${T}|${s}|${ek}|${wk}|${gk}`] = {
    monthly: m(q.monthlyTotalCents),
    tcvNet: m(q.tcvNetCents), grossUp: m(q.tax.grossUpCents), gst: m(q.tax.gstCents), tcvIncl: m(q.tax.tcvInclGstCents),
    invoiced: m(q.tax.invoicedCents), wht: m(q.tax.whtCents), whtBorne: m(q.tax.whtBorneCents), received: m(q.tax.receivedCents),
    cost: m(q.totalCostCents), profit: m(q.grossProfitCents), margin: pc(q.grossMargin),
    afterWht: q.marginAfterWht ? pc(q.marginAfterWht) : null,
    floor: pc(q.marginFloor), flag: q.belowMarginFloor,
    capex: q.capex ? { upfront: m(q.capex.upfrontCents), service: m(q.capex.monthlyServiceCents) } : null,
    schedule: q.schedule.map((r) => ({
      when: r.kind === 'upfront' ? 'Upfront (hardware)' : `Months ${r.fromMonth} to ${r.toMonth}`,
      count: r.count, net: m(r.netCents), gst: m(r.gstCents), invoiceIncl: m(r.invoiceInclGstCents),
      invoice: m(r.invoiceCents), wht: m(r.whtCents), borne: r.whtBorne, received: m(r.receivedCents),
      lines: (r.lines ?? []).map((l) => ({
        when: l.kind === 'hardware' ? 'Hardware line' : 'Software as a service line',
        net: m(l.netCents), invoice: m(l.invoiceCents), gst: m(l.gstCents), invoiceIncl: m(l.invoiceInclGstCents),
        wht: m(l.whtCents), received: m(l.receivedCents),
      })),
    })),
    lines: q.lines.map((l) => ({
      product: label(l.product), units: l.units, monthly: m(l.monthlyByYear[0]),
      bands: l.bands.map((b) => ({
        range: b.to === null ? `${b.from}+` : `${b.from} to ${b.to}`, discount: `${b.discountPct}%`,
        units: b.units, fee: m(b.feeByYear[0]), monthly: m(BigInt(b.units) * b.feeByYear[0]),
      })),
    })),
  }
}

// ── The page ─────────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const paramRows = [
  ['TERMS', 'Terms offered (months, comma separated)', PARAMS.TERMS.join(', ')],
  ['ANCHOR_TERM', 'List-price term', `${PARAMS.ANCHOR_TERM} months`],
  ['PROFIT_STEP', 'Extra profit per term step above the anchor, per unit', `${PARAMS.CURRENCY} ${PARAMS.PROFIT_STEP}`],
  ['HW_UPFRONT_MARGIN', 'Margin on the hardware price, CAPEX upfront', `${PARAMS.HW_UPFRONT_MARGIN}%`],
  ['MARGIN_FLOOR', 'Whole-deal margin below this shows a flag', `${PARAMS.MARGIN_FLOOR}%`],
  ['CURRENCY', 'Currency', PARAMS.CURRENCY],
]

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Term Pricing (mockup)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&f[]=satoshi@300,400,500&display=swap" rel="stylesheet">
<style>
  /* Tokens copied from frontend/style.css so the mockup wears the estate's palette. */
  :root {
    --dark: #1A1B23; --black: #15161C; --white: #F2F2F0; --green: #66CC99;
    --attention: #EDB45A; --red: #e06c6c;
    --hairline: rgba(242,242,240,0.12); --hairline-strong: rgba(242,242,240,0.22);
    --muted: rgba(242,242,240,0.5); --muted-2: rgba(242,242,240,0.32);
    --heading: "General Sans", -apple-system, sans-serif;
    --body: "Satoshi", -apple-system, sans-serif;
    --mono: "JetBrains Mono", monospace;
  }
  * { box-sizing: border-box; }
  /* A class's display would override the hidden attribute (CLAUDE.md
     Verification 4), and .pair and .figures > div both carry one. */
  [hidden] { display: none !important; }
  body { margin: 0; background: var(--dark); color: var(--white); font-family: var(--body); font-size: 14px; }
  .shell { display: grid; grid-template-columns: 200px minmax(0, 1fr); min-height: 100vh; }
  .sidebar { background: var(--black); border-right: 1px solid var(--hairline); padding: 20px 12px; }
  .brand { font-family: var(--heading); font-weight: 600; letter-spacing: 0.08em; font-size: 13px; margin-bottom: 24px; }
  .brand span { color: var(--muted); font-weight: 400; }
  .nav { display: flex; flex-direction: column; gap: 2px; }
  .nav div { padding: 7px 10px; border-radius: 4px; color: var(--muted); font-size: 13px; }
  .nav div.dim { color: var(--muted-2); }
  .nav div.on { color: var(--white); background: rgba(102,204,153,0.12); box-shadow: inset 2px 0 0 var(--green); }
  main { padding: 24px 32px 48px; max-width: 1680px; }
  .eyebrow { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  h1 { font-family: var(--heading); font-weight: 500; font-size: 24px; margin: 4px 0 4px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
  .mock-note { border: 1px dashed var(--hairline-strong); color: var(--muted); font-size: 12px; padding: 8px 12px; border-radius: 4px; margin-bottom: 20px; }
  /* TERM_PRICING_2: one column, as the approved screen. The Inputs groups wrap
     at their content widths in two halves (L3: packed from the left). */
  .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
  .inputs-body, .half { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 18px 28px; }
  .half { flex: 0 1 auto; justify-content: flex-start; }
  .seg.terms { display: grid; grid-template-columns: repeat(5, max-content); }
  .pair { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0 14px; }
  .pair.stack { flex-direction: column; align-items: flex-start; gap: 0; }
  .switches { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 14px; }
  input.pct, select.pct { display: block; width: 110px; }
  select.pct { background: var(--dark); border: 1px solid var(--hairline-strong); color: var(--white); border-radius: 4px; padding: 7px 8px; font-family: var(--mono); font-size: 13px; }
  select.pct:disabled { border-color: var(--hairline); background: transparent; color: var(--muted); }
  .toggle { position: relative; display: inline-flex; align-items: center; white-space: nowrap; background: transparent; border: 1px solid var(--hairline-strong); color: var(--muted); border-radius: 4px; padding: 6px 12px 6px 48px; font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
  .toggle::before { content: ""; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 26px; height: 14px; border-radius: 7px; border: 1px solid var(--hairline-strong); background: rgba(242,242,240,0.06); }
  .toggle::after { content: ""; position: absolute; left: 14px; top: 50%; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); transform: translateY(-50%); }
  .toggle.on { border-color: var(--green); color: var(--green); }
  .toggle.on::before { background: rgba(102,204,153,0.25); border-color: var(--green); }
  .toggle.on::after { background: var(--green); transform: translate(12px, -50%); }
  .mock-states { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; }
  .card { background: var(--black); border: 1px solid var(--hairline); border-radius: 6px; padding: 16px 18px; }
  .card + .card { margin-top: 20px; }
  .card h2 { font-family: var(--heading); font-weight: 500; font-size: 15px; margin: 0 0 12px; }
  .card h2 .hint { font-family: var(--body); font-weight: 400; font-size: 12px; color: var(--muted); margin-left: 8px; }
  label.f { display: block; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 14px 0 6px; }
  .units { display: grid; grid-template-columns: repeat(3, 72px); gap: 8px; }
  .units div { display: flex; flex-direction: column; gap: 4px; }
  .units span { font-size: 12px; color: var(--muted); }
  input.num { background: var(--dark); border: 1px solid var(--hairline-strong); color: var(--white); border-radius: 4px; padding: 7px 8px; font-family: var(--mono); font-size: 13px; width: 100%; text-align: right; }
  input.num:disabled { color: var(--white); opacity: 1; }
  .seg { display: flex; flex-wrap: wrap; gap: 4px; }
  .seg button { background: transparent; border: 1px solid var(--hairline-strong); color: var(--muted); border-radius: 4px; padding: 6px 9px; font-family: var(--mono); font-size: 12px; cursor: pointer; }
  .seg button.on { color: var(--dark); background: var(--green); border-color: var(--green); }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  table { border-collapse: collapse; width: 100%; }
  /* Headers may wrap, as the screen's: nowrap pushed the schedule past its card at 1240. */
  th { font-family: var(--mono); font-weight: 400; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-align: right; vertical-align: bottom; padding: 6px 10px; border-bottom: 1px solid var(--hairline-strong); }
  th:first-child, td:first-child { text-align: left; }
  td:first-child { font-family: var(--body); font-size: 13.5px; }
  td.code { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  /* A1: two columns only where both fit at natural width. */
  .settings-grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 28px; }
  .settings-grid > * { flex: 1 1 auto; }
  td { font-family: var(--mono); font-size: 13px; text-align: right; padding: 8px 10px; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
  tr.ladder { cursor: pointer; }
  tr.ladder:hover td { background: rgba(242,242,240,0.03); }
  tr.ladder.on td { background: rgba(102,204,153,0.10); }
  tr.ladder.on td:first-child { box-shadow: inset 2px 0 0 var(--green); }
  .saving { color: var(--green); }
  .premium { color: var(--muted); }
  .figures { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0; border: 1px solid var(--hairline); border-radius: 6px; }
  .figures > div[hidden] { display: none; }
  .figures > div { padding: 12px 14px; border-right: 1px solid var(--hairline); min-width: 0; }
  .figures > div:last-child { border-right: 0; }
  /* As the screen (TERM_PRICING Phase 3): a figure never breaks mid-number,
     and steps down a size below 1600. The old overflow-wrap broke "366,976.85"
     over two lines at 1240, seen in the regenerated capture. */
  .figures .v { font-family: var(--mono); font-size: 18px; margin-top: 6px; white-space: nowrap; }
  .figures .v.lead { font-size: 22px; }
  @media (max-width: 1599px) {
    .figures > div { padding: 12px 10px; }
    .figures .v { font-size: 14px; }
    .figures .v.lead { font-size: 16px; }
  }
  .chip { display: inline-block; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 7px; border-radius: 3px; border: 1px solid var(--hairline-strong); color: var(--muted); margin-top: 8px; }
  .chip.flag { border-color: var(--attention); color: var(--attention); }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .lines td.band { color: var(--muted); }
  .lines td.band:first-child { padding-left: 22px; font-size: 12.5px; }
  details summary { cursor: pointer; color: var(--muted); font-size: 12px; margin-top: 12px; }
  .admin-tag { font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--hairline-strong); border-radius: 3px; padding: 2px 6px; margin-left: 8px; vertical-align: middle; }
  .btn { background: transparent; border: 1px solid var(--green); color: var(--green); border-radius: 4px; padding: 7px 14px; font-family: var(--body); font-size: 13px; cursor: pointer; }
  .btn:disabled { border-color: var(--hairline-strong); color: var(--muted-2); cursor: default; }
  input.set { background: var(--dark); border: 1px solid var(--hairline-strong); color: var(--white); border-radius: 4px; padding: 5px 7px; font-family: var(--mono); font-size: 12.5px; width: 120px; text-align: right; }
  input.set:disabled { border-color: transparent; background: transparent; }
  .viewas { float: right; }
</style>
</head>
<body>
<div class="shell">
  <nav class="sidebar">
    <div class="brand">TERMINUS <span>· TMS</span></div>
    <div class="nav">
      <div class="dim">Dashboard</div><div>Leads</div><div>Contacts</div><div>Accounts</div><div>Test Beds</div><div>Opportunities</div>
      <div class="on">Term Pricing</div><div>Approvals</div>
    </div>
  </nav>
  <main>
    <div class="eyebrow">Quote calculator</div>
    <h1>Term Pricing</h1>
    <div class="sub">Longer contracts give the client a lower monthly fee; Terminus earns the 36-month profit on every term from 36 up. Margin is margin on price throughout.</div>
    <div class="mock-note">MOCKUP of the approved screen (TERM_PRICING_2, John 2026-10-02). Units are fixed at 120 SafeSight, 40 AQ and 2 HEMIR. Term, payment structure, the ladder rows, Gross up and Split WHT are live; the typed escalator and WHT rates are set by the mockup-only strip below, because a static page cannot price a typed value. Every figure is the engine's. Not connected to any record.
      <div class="mock-states">
        <span>Escalator <span class="seg" id="m-esc"><button data-e="none">0</button><button data-e="y2">3% from year 2</button><button data-e="y3">3% from year 3</button></span></span>
        <span>WHT rate <span class="seg" id="m-wht"><button data-w="none">0</button><button data-w="ten">10</button></span></span>
      </div>
    </div>

    <div class="grid">
      <div>
        <section class="card">
          <h2>Inputs</h2>
          <div class="inputs-body">
          <div class="half">
          <div>
          <label class="f">Units per product</label>
          <div class="units">
            ${PRODUCTS.map((p) => `<div><span>${p.label}</span><input class="num" value="${UNITS[p.key]}" disabled></div>`).join('')}
          </div>
          </div><div>
          <label class="f">Term (months)</label>
          <div class="seg terms" id="terms">${PARAMS.TERMS.map((t) => `<button data-term="${t}">${t}</button>`).join('')}</div>
          </div>
          </div>
          <div class="half">
          <div>
          <label class="f">Payment structure</label>
          <div class="seg" id="structure"><button data-s="opex">OPEX monthly</button><button data-s="capex">CAPEX hardware upfront</button></div>
          <div class="pair">
            <div><label class="f">Annual escalator %</label><input class="num pct" id="esc-rate" placeholder="0" readonly></div>
            <div id="esc-start-wrap"><label class="f">Starts in year</label><select class="pct" id="esc-start"></select></div>
          </div>
          <div class="small muted" id="esc-none" style="margin-top:8px"></div>
          </div><div>
          <label class="f">GST %</label><input class="num pct" value="${GST}" disabled>
          <div id="wht-single"><label class="f">WHT %</label><input class="num pct" id="wht-rate" placeholder="0" readonly></div>
          <div class="pair stack" id="wht-pair">
            <div><label class="f">WHT on hardware %</label><input class="num pct" value="5" readonly></div>
            <div><label class="f">WHT on software as a service %</label><input class="num pct" value="10" readonly></div>
          </div>
          <div class="switches">
            <button type="button" class="toggle" role="switch" id="sw-gross">Gross up</button>
            <button type="button" class="toggle" role="switch" id="sw-split">Split WHT</button>
          </div>
          </div>
          </div>
          </div>
        </section>


      </div>

      <div>
        <section class="card">
          <h2>Term ladder <span class="hint">the same units at every term; select a row to quote it</span></h2>
          <table>
            <thead id="ladder-head"></thead>
            <tbody id="ladder"></tbody>
          </table>
        </section>

        <section class="card">
          <h2>Quote <span class="hint" id="quote-hint"></span></h2>
          <div class="figures">
            <div><div class="eyebrow" id="q-monthly-label">Monthly total (year 1)</div><div class="v lead" id="q-monthly"></div></div>
            <div><div class="eyebrow">TCV (net)</div><div class="v" id="q-tcv"></div></div>
            <div id="q-grossup-tile"><div class="eyebrow">WHT gross-up</div><div class="v" id="q-grossup"></div></div>
            <div><div class="eyebrow">GST</div><div class="v" id="q-gst"></div></div>
            <div><div class="eyebrow">TCV incl. GST</div><div class="v" id="q-tcvincl"></div></div>
            <div><div class="eyebrow">Margin on price</div><div class="v" id="q-margin"></div><div id="q-flag"></div><div class="small" id="q-after-wht" style="margin-top:8px"></div></div>
          </div>
          <div class="split" style="margin-top:16px">
            <div>
              <div class="eyebrow" style="margin-bottom:6px" id="lines-label">Product lines (bands count per line)</div>
              <table class="lines"><thead><tr><th>Line</th><th>Units</th><th>Fee / unit / mo</th><th>Monthly</th></tr></thead><tbody id="q-lines"></tbody></table>
            </div>
            <div>
              <div class="eyebrow" style="margin-bottom:6px">Profit</div>
              <table><tbody>
                <tr><td>TCV (net)</td><td id="p-tcv"></td></tr>
                <tr><td>Hardware and hosting cost</td><td id="p-cost"></td></tr>
                <tr><td>Gross profit</td><td id="p-profit"></td></tr>
                <tr><td>WHT borne by Terminus</td><td id="p-borne"></td></tr>
              </tbody></table>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Payment schedule <span class="hint" id="sched-hint"></span></h2>
          <table class="lines">
            <thead><tr><th>When</th><th>Invoices</th><th>Net fee</th><th>Invoice (pre-GST)</th><th>GST</th><th>Invoice incl. GST</th><th id="th-wht">WHT</th><th>Terminus receives</th></tr></thead>
            <tbody id="schedule"></tbody>
          </table>
          <div class="small muted" style="margin-top:8px" id="sched-note"></div>
        </section>

        <section class="card">
          <h2>States <span class="hint">how the screen marks them</span></h2>
          <div class="small">Below the margin floor: <span class="chip flag">Below the 25.0% floor</span> <span class="muted">The quote still prices; the flag never refuses.</span></div>
          <div class="small" style="margin-top:10px">Above it: <span class="chip">Above the 25.0% floor</span></div>
          <div class="small" style="margin-top:10px">A term that is not offered, or no units: the quote area shows the reason in place of figures, for example <span class="muted">"An 18-month term is not offered. Choose one of: ${PARAMS.TERMS.join(', ')} months."</span></div>
        </section>
      </div>
    </div>
    <section class="card" style="margin-top:20px">
          <h2>Settings <span class="admin-tag">admin</span>
            <span class="viewas seg" id="viewas"><button data-v="admin">Admin view</button><button data-v="sales">Salesperson view</button></span>
            <button class="btn" id="settings-toggle" style="margin-left:12px; padding:4px 10px; font-size:12px" aria-controls="settings-body"></button>
          </h2>
          <!-- Q5: collapsed by default, so the page opens on the ladder and quote.
               The hidden attribute sits on a wrapper with no display rule of its own
               (CLAUDE.md Verification 4: a class's display would override it). -->
          <div id="settings-body" hidden>
          <div class="small muted" id="admin-note"></div>
          <div class="settings-grid" style="margin-top:10px">
            <div>
              <table>
                <thead><tr><th>Parameter</th><th>Key</th><th>Value</th></tr></thead>
                <tbody>
                  ${paramRows.map(([k, d, v]) => `<tr><td>${esc(d)}</td><td class="code">${k}</td><td><input class="set" style="width:${k === 'TERMS' ? 330 : 120}px" value="${esc(v)}" disabled data-admin-edit></td></tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div>
              <table>
                <thead><tr><th>Product</th><th>Anchor margin</th><th>Short-term margin</th><th>HW cost / unit</th><th>Hosting / unit / mo</th></tr></thead>
                <tbody>
                  ${PRODUCTS.map((p) => `<tr><td>${p.label}</td><td><input class="set" style="width:64px" value="${PARAMS.ANCHOR_MARGIN[p.key]}%" disabled data-admin-edit></td><td><input class="set" style="width:64px" value="${PARAMS.SHORT_TERM_MARGIN[p.key]}%" disabled data-admin-edit></td><td>${m(BigInt(PARAMS.costs[p.key].hwCost.replace('.', '')))}</td><td>${m(BigInt(PARAMS.costs[p.key].hostingMonthly.replace('.', '')))}</td></tr>`).join('')}
                </tbody>
              </table>
              <div class="small muted" style="margin-top:6px">Costs are read from Base Cost Data (${CATALOG.batch}, effective ${CATALOG.from}) and are not edited here.</div>
              <table style="margin-top:14px">
                <thead><tr><th>Volume band (units per product line)</th><th>Discount on the monthly fee</th></tr></thead>
                <tbody>
                  ${PARAMS.VOLUME_BANDS.map((b, i, a) => `<tr><td>${i + 1 < a.length ? `${b.from} to ${a[i + 1].from - 1}` : `${b.from} and above`}</td><td><input class="set" style="width:64px" value="${b.discountPct}%" disabled data-admin-edit></td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div style="margin-top:14px; text-align:right"><button class="btn" id="save-settings" disabled>Save settings</button></div>
          </div>
    </section>
    <p class="small muted" style="margin-top:28px">Figures generated by src/lib/term-pricing.js (docs/pricing-spec.md v1.3) from prototypes/term-pricing/build-mockup.mjs.</p>
  </main>
</div>
<script>
const LADDERS = ${JSON.stringify(ladders)};
const QUOTES = ${JSON.stringify(quotes)};
const state = { term: 60, s: 'opex', e: 'none', w: 'none', g: 'off', split: false, v: 'admin', open: false };
const lastYear = (t) => Math.ceil(t / 12);
const $ = (id) => document.getElementById(id);
const text = (el, s) => { el.textContent = s; };
function seg(id, attr, key) {
  for (const b of $(id).querySelectorAll('button')) {
    b.classList.toggle('on', String(state[key]) === b.dataset[attr]);
    b.onclick = () => {
      state[key] = key === 'term' ? Number(b.dataset[attr]) : b.dataset[attr];
      // As the screen: a shorter term pulls the start year back inside it.
      if (state.e === 'y3' && lastYear(state.term) < 3) state.e = 'y2';
      render();
    };
  }
}
function render() {
  seg('terms', 'term', 'term'); seg('structure', 's', 's'); seg('m-esc', 'e', 'e'); seg('m-wht', 'w', 'w'); seg('viewas', 'v', 'v');
  // The escalator controls, as the screen draws them.
  const ly = lastYear(state.term), rateOn = state.e !== 'none';
  $('esc-rate').value = rateOn ? '3' : '';
  $('esc-start-wrap').hidden = ly < 2;
  $('esc-start').innerHTML = [2, 3].filter((y) => y <= ly).map((y) => '<option value="' + y + '">' + y + '</option>').join('');
  $('esc-start').value = state.e === 'y3' ? '3' : '2';
  $('esc-start').disabled = !rateOn;
  $('esc-start').onchange = () => { state.e = $('esc-start').value === '3' ? 'y3' : 'y2'; render(); };
  text($('esc-none'), ly < 2 && rateOn ? 'A ' + state.term + '-month term has no year 2, so the escalator has no effect.' : '');
  // WHT: the typed rate, or the split pair; one Gross up switch for both.
  $('wht-rate').value = state.w === 'ten' ? '10' : '';
  $('wht-single').hidden = state.split; $('wht-pair').hidden = !state.split;
  for (const [id, on, flip] of [['sw-gross', state.g === 'on', () => { state.g = state.g === 'on' ? 'off' : 'on' }], ['sw-split', state.split, () => { state.split = !state.split }]]) {
    $(id).classList.toggle('on', on); $(id).setAttribute('aria-checked', String(on)); $(id).onclick = () => { flip(); render(); };
  }
  const lad = $('ladder'); lad.innerHTML = '';
  const capexLadder = state.s === 'capex';
  $('ladder-head').innerHTML = '<tr><th>Term</th>' + (capexLadder ? '<th>Upfront</th><th>Monthly service fee (year 1)</th>' : '<th>Monthly fee (year 1)</th>') + '<th>vs 36 months, this deal</th><th>TCV (net)</th><th>Margin on price</th></tr>';
  for (const r of LADDERS[state.s + '|' + state.e]) {
    const tr = document.createElement('tr');
    tr.className = 'ladder' + (r.term === state.term ? ' on' : '');
    tr.innerHTML = '<td>' + r.term + ' months</td>' + (capexLadder ? '<td>' + r.upfront + '</td><td>' + r.service + '</td>' : '<td>' + r.monthly + '</td>') + '<td class="' + r.vsKind + '">' + r.vs + '</td><td>' + r.tcv + '</td><td>' + r.margin + '%</td>';
    tr.onclick = () => { state.term = r.term; render(); };
    lad.appendChild(tr);
  }
  const q = QUOTES[[state.term, state.s, state.e, state.split ? 'split' : state.w, state.g].join('|')];
  text($('quote-hint'), state.term + ' months, ' + (state.s === 'opex' ? 'OPEX' : 'CAPEX')
    + (rateOn && ly > 1 ? ', 3% annual escalator from year ' + (state.e === 'y3' ? 3 : 2) : '') + (state.split ? ', split WHT' : ''));
  // L1: with Gross up on, TCV (net) + WHT gross-up + GST = TCV incl. GST.
  $('q-grossup-tile').hidden = state.g !== 'on'; text($('q-grossup'), q.grossUp);
  text($('q-monthly-label'), state.s === 'capex' ? 'Monthly service fee (year 1)' : 'Monthly total (year 1)');
  text($('q-monthly'), state.s === 'capex' ? q.capex.service : q.monthly); text($('q-tcv'), q.tcvNet); text($('q-gst'), q.gst); text($('q-tcvincl'), q.tcvIncl);
  text($('q-margin'), q.margin + '%');
  // Q4: shown only when WHT is borne; the engine returns null otherwise.
  text($('q-after-wht'), q.afterWht ? 'Margin on price after WHT: ' + q.afterWht + '%' : '');
  $('q-flag').innerHTML = q.flag ? '<span class="chip flag">Below the ' + q.floor + '% floor</span>' : '<span class="chip">Above the ' + q.floor + '% floor</span>';
  // Ruled 2026-10-01: under CAPEX these OPEX fees are what TCV is priced from,
  // not what the client is invoiced, so the table says so.
  text($('lines-label'), state.s === 'capex' ? 'Pricing basis (OPEX fees)' : 'Product lines (bands count per line)');
  const lines = $('q-lines'); lines.innerHTML = '';
  for (const l of q.lines) {
    lines.insertAdjacentHTML('beforeend', '<tr><td>' + l.product + '</td><td>' + l.units + '</td><td></td><td>' + l.monthly + '</td></tr>');
    for (const b of l.bands) lines.insertAdjacentHTML('beforeend', '<tr><td class="band">units ' + b.range + ' at ' + b.discount + ' off</td><td class="band">' + b.units + '</td><td class="band">' + b.fee + '</td><td class="band">' + b.monthly + '</td></tr>');
  }
  text($('p-tcv'), q.tcvNet); text($('p-cost'), q.cost); text($('p-profit'), q.profit); text($('p-borne'), q.whtBorne);
  // "borne" lives in the header, not in every cell: per cell it widened the
  // column enough to overflow the page at 1240 (measured).
  text($('th-wht'), q.whtBorne !== '0.00' ? 'WHT borne' : (q.wht !== '0.00' ? 'WHT (grossed up)' : 'WHT'));
  const sch = $('schedule'); sch.innerHTML = '';
  for (const r of q.schedule) {
    const when = r.when + (state.s === 'capex' && state.split && r.when !== 'Upfront (hardware)' ? ' (service)' : '');
    sch.insertAdjacentHTML('beforeend', '<tr><td>' + when + '</td><td>' + r.count + '</td><td>' + r.net + '</td><td>' + r.invoice + '</td><td>' + r.gst + '</td><td>' + r.invoiceIncl + '</td><td>' + r.wht + '</td><td>' + r.received + '</td></tr>');
    for (const l of r.lines) sch.insertAdjacentHTML('beforeend', '<tr><td class="band">' + l.when + '</td><td class="band"></td><td class="band">' + l.net + '</td><td class="band">' + l.invoice + '</td><td class="band">' + l.gst + '</td><td class="band">' + l.invoiceIncl + '</td><td class="band">' + l.wht + '</td><td class="band">' + l.received + '</td></tr>');
  }
  text($('sched-hint'), state.s === 'opex' ? (state.split ? 'one invoice a month, as a hardware line and a service line' : 'one invoice a month for the term') : 'hardware upfront, then a monthly service fee');
  text($('sched-note'), state.s === 'capex'
    ? 'Upfront ' + q.capex.upfront + ' plus the monthly service fees ties to TCV ' + q.tcvNet + ' exactly, the same TCV as OPEX; the upfront carries any rounding residue.' + (rateOn ? ' The service fee escalates like the OPEX fee.' : '')
    : 'Net fees times months equal TCV ' + q.tcvNet + ' exactly. GST is added on top of each invoice; WHT applies to the fee before GST.');
  $('settings-body').hidden = !state.open;
  text($('settings-toggle'), state.open ? 'Collapse' : 'Expand');
  $('settings-toggle').setAttribute('aria-expanded', String(state.open));
  $('settings-toggle').onclick = () => { state.open = !state.open; render(); };
  const admin = state.v === 'admin';
  for (const el of document.querySelectorAll('[data-admin-edit]')) el.disabled = !admin;
  $('save-settings').disabled = !admin;
  $('save-settings').style.display = admin ? '' : 'none';
  text($('admin-note'), admin
    ? 'You are an admin. A change applies to every quote priced after it is saved.'
    : 'Only an admin can change these. They are shown so every quote can be explained.');
}
render();
</script>
</body>
</html>
`

writeFileSync(new URL('./index.html', import.meta.url), html)
console.log(`wrote prototypes/term-pricing/index.html (${html.length} chars, ${Object.keys(quotes).length} quotes, ${Object.keys(ladders).length} ladders)`)
