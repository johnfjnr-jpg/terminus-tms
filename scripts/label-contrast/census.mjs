#!/usr/bin/env node
// ── LABEL_CONTRAST Phase 0: every text style as PAINTED, with its contrast ──
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/label-contrast/census.mjs [--json <file>]
//
// For every visible, non-blank text node on Term Pricing (Settings expanded,
// Split WHT and Gross up on, so every label renders) and on the Commercials tab
// of an OPEX opportunity fixture, it records the parent element's COMPUTED
// colour, size, weight, tracking, case and family, and the background that is
// actually behind it: ancestors' backgrounds composited from the page up,
// because the estate's quiet colours are ALPHA colours and their contrast
// depends on what they sit on. The text colour is composited over that
// background too, then WCAG 2.x contrast is taken.
//
// Styles are grouped by signature and named by where they are used (tag and
// classes, and sample text). The token a colour came from is inferred from the
// declared values in frontend/style.css's :root, matched on the computed rgba.
//
// Measures; changes nothing. UNWIRED: needs a browser, a live server and a session.

import { readFileSync, writeFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('label-contrast/census.mjs')

const ROOT = new URL('../../', import.meta.url).pathname
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
const JSON_OUT = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null
// --css <file>: inject a stylesheet in the browser only, to measure a PROPOSAL
// with the same instrument as the current state. Nothing on disk is changed.
const CSS_IN = process.argv.includes('--css') ? readFileSync(process.argv[process.argv.indexOf('--css') + 1], 'utf8') : null
// --rules <file>: a JSON list of selectors; reports which render on each screen.
const RULES = process.argv.includes('--rules') ? JSON.parse(readFileSync(process.argv[process.argv.indexOf('--rules') + 1], 'utf8')) : null
const rendered = { 'term-pricing': [], commercials: [] }
const whichRender = (sels) => sels.filter((s) => { try { return [...document.querySelectorAll(s)].some((e) => e.checkVisibility() && e.textContent.trim()) } catch { return false } })

// Tokens as declared, so a computed colour can be named. Read from the file,
// not restated (Verification 20).
const css = readFileSync(`${ROOT}frontend/style.css`, 'utf8')
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')))
const tokens = {}
for (const m of css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gim)) if (!(m[1] in tokens)) tokens[m[1]] = m[2].trim()
void root

function census() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a), a: 1,
  })
  const bgOf = (el) => {
    const chain = []
    for (let e = el; e; e = e.parentElement) chain.push(e)
    let bg = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 }
    if (bg.a < 1) bg = over(bg, { r: 255, g: 255, b: 255, a: 1 })
    for (const e of chain.reverse()) {
      const c = parse(getComputedStyle(e).backgroundColor)
      if (c && c.a > 0) bg = over(c, bg)
    }
    return bg
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const vis = (e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  const out = []
  const w = document.createTreeWalker(document.querySelector('.app-content-scroll') ?? document.body, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement
    if (!n.nodeValue.trim() || !el || !vis(el)) continue
    if (el.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla, script, style')) continue
    const cs = getComputedStyle(el)
    const fg = parse(cs.color); const bg = bgOf(el)
    if (!fg) continue
    const painted = over(fg, bg)
    const cls = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList.length ? '.' + [...e.classList].slice(0, 3).join('.') : ''}`
    out.push({
      color: cs.color, size: cs.fontSize, weight: cs.fontWeight, tracking: cs.letterSpacing, transform: cs.textTransform,
      family: cs.fontFamily.split(',')[0].replace(/"/g, ''),
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      contrast: Math.round(ratio(painted, bg) * 100) / 100,
      where: `${el.parentElement ? cls(el.parentElement) + ' > ' : ''}${cls(el)}`,
      text: n.nodeValue.trim().slice(0, 30),
    })
  }
  return out
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1240, height: 1100 })
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
if (CSS_IN) await page.addStyleTag({ content: CSS_IN })

const samples = []
// Term Pricing, every label rendered.
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('[data-testid="tp-ladder"]'), { timeout: 15000 })
await page.click('[data-testid="tp-settings-toggle"]')
await page.click('[data-testid="tp-wht-split"]')
await page.click('[data-testid="tp-wht-grossup"]')
await page.evaluate(() => document.fonts.ready)
for (const s of await page.evaluate(census)) samples.push({ screen: 'term-pricing', ...s })
if (RULES) rendered['term-pricing'] = await page.evaluate(whichRender, RULES)

// Commercials tab, OPEX fixture.
const { freshOpportunity, tearDown } = await import('../fixtures.mjs')
const { api } = await import('../api-client.mjs')
const TAG = 'lc0A'
try {
  const { oppId } = await freshOpportunity(TAG)
  const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
  await api('PATCH', `/opportunities/${oppId}`, { expected_revision: rev, payload: {
    paymentMode: 'opex', structure: 'single', ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
    duration: 60, warrantyPct: 0, installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000,
    invoicing: 'monthly', targetMargin: 30 } })
  await page.evaluate((id) => window.navigate('opportunity-detail', id), oppId)
  await page.waitForFunction(() => { const v = document.getElementById('view-opportunity-detail'); return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading') }, { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => !!document.querySelector('[data-testid="deal-opex-table"]'), { timeout: 25000 })
  await page.evaluate(() => document.fonts.ready)
  for (const s of await page.evaluate(census)) samples.push({ screen: 'commercials', ...s })
  if (RULES) rendered.commercials = await page.evaluate(whichRender, RULES)
} finally {
  await tearDown(TAG)
  await browser.close()
}

// Name the colour by token where the computed rgba matches a declared one.
const norm = (c) => c.replace(/\s+/g, '').replace(/^rgb\(([^)]+)\)$/, 'rgba($1,1)').toLowerCase()
const hex = (h) => { const v = h.replace('#', ''); return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},1)` }
const byValue = {}
for (const [k, v] of Object.entries(tokens)) {
  const val = v.startsWith('#') && v.length === 7 ? hex(v) : v.startsWith('rgb') ? norm(v) : null
  if (val && !byValue[val]) byValue[val] = k
}
const groups = new Map()
for (const s of samples) {
  const key = [s.color, s.size, s.weight, s.tracking, s.transform, s.family].join(' | ')
  if (!groups.has(key)) groups.set(key, { ...s, token: byValue[norm(s.color)] ?? '(no token)', n: 0, screens: new Set(), wheres: new Map(), contrasts: new Set(), bgs: new Set() })
  const g = groups.get(key)
  g.n++; g.screens.add(s.screen); g.contrasts.add(s.contrast); g.bgs.add(s.bg)
  g.wheres.set(s.where, (g.wheres.get(s.where) ?? []).concat(s.text))
}
const rows = [...groups.values()].sort((a, b) => b.n - a.n)
for (const g of rows) {
  const cs = [...g.contrasts].sort((a, b) => a - b)
  console.log(`\n${g.token}  ${g.color}  ${g.size} w${g.weight} ${g.tracking} ${g.transform} ${g.family}  x${g.n}  [${[...g.screens].join(', ')}]`)
  console.log(`   contrast ${cs[0]}${cs.length > 1 ? ` to ${cs[cs.length - 1]}` : ''} on ${[...g.bgs].join(', ')}`)
  for (const [w, t] of [...g.wheres.entries()].slice(0, 6)) console.log(`   ${w}  "${t.slice(0, 3).join('", "')}"${t.length > 3 ? ` +${t.length - 3}` : ''}`)
  if (g.wheres.size > 6) console.log(`   ... ${g.wheres.size - 6} more sites`)
}
if (RULES) for (const [k, v] of Object.entries(rendered)) console.log(`\nRENDERS ON ${k}: ${v.join(' | ')}`)
console.log(`\n${samples.length} text nodes, ${rows.length} styles; tokens read: ${Object.keys(tokens).length}`)
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(rows.map((g) => ({ ...g, screens: [...g.screens], contrasts: [...g.contrasts], bgs: [...g.bgs], wheres: [...g.wheres.entries()] })), null, 1))
