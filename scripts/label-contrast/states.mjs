#!/usr/bin/env node
// ── LABEL_CONTRAST P1 and P2: disabled vs enabled, active vs inactive ──────
//
//   PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
//     node --env-file=.env scripts/label-contrast/states.mjs [--css <file>] [--tag <name>]
//
// P1 (John, 2026-10-03). Every disabled control that paints in --muted must
// stay visibly dimmer than its enabled form. Measured on the REAL states where
// the screen can produce them (the start-year select with and without a rate;
// Save settings for an admin, clean and dirty), and for every other disabled
// control found on Term Pricing and the Commercials tab by clearing `disabled`
// inside one synchronous read and restoring it before anything can paint.
// The figure is enabled contrast over disabled contrast; below 1.5 is a STOP.
//
// P2. Sidebar nav, opportunity tabs, stage strip: the active item against the
// inactive ones. Reported are the contrast between the two TEXT colours, and
// whether anything besides colour marks the active one (background, border,
// box-shadow, weight). A colour-only difference below 1.5:1 is a STOP.
//
// The admin view is built in the browser's copy of the real GET response
// (isAdmin), as probe-overlap.mjs does; it proves the layout, not the write.
//
// UNWIRED: needs a browser, a live server and a session.
import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('label-contrast/states.mjs')
const ROOT = new URL('../../', import.meta.url).pathname
const OUT = `${ROOT}prototypes/label-contrast`
mkdirSync(OUT, { recursive: true })
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const CSS_IN = arg('--css', null) ? readFileSync(arg('--css'), 'utf8') : null
const TAG = arg('--tag', 'p2')
const session = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]

// In-page helpers, passed as source so each evaluate is self-contained.
const HELPERS = `
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const over = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 })
  const bgOf = (el) => { const ch = []; for (let e = el; e; e = e.parentElement) ch.push(e); let bg = parse(getComputedStyle(document.body).backgroundColor); for (const e of ch.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) bg = over(c, bg) } return bg }
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  // OPACITY IS PART OF THE PAINT. Disabled buttons carry opacity 0.5 (or 0.4)
  // as well as a colour; the first run ignored it and read a disabled Save
  // as bright as an enabled one. The text's alpha is multiplied by the
  // element's opacity and every ancestor's.
  const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o }
  const textOf = (el) => { const c = parse(getComputedStyle(el).color); return over({ ...c, a: c.a * opacityOf(el) }, bgOf(el)) }
  const contrast = (el) => Math.round(ratio(textOf(el), bgOf(el)) * 100) / 100
`

let failures = 0
const check = (ok, claim, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`) }
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1240, height: 1100 })
await page.evaluateOnNewDocument(() => {
  const real = window.fetch
  window.fetch = async (...a) => {
    const res = await real(...a)
    if (!/\/api\/term-pricing(\?|$)/.test(String(a[0]?.url ?? a[0])) || !res.ok) return res
    const body = await res.clone().json()
    return new Response(JSON.stringify({ ...body, isAdmin: true }), { status: res.status, headers: res.headers })
  }
})
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${ref}-auth-token`, JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => typeof window.navigate === 'function' && !document.getElementById('app-shell').classList.contains('hidden'))
if (CSS_IN) await page.addStyleTag({ content: CSS_IN })
const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
const measure = (sel) => page.evaluate(new Function('sel', `${HELPERS} const e = document.querySelector(sel); return e ? { c: contrast(e), disabled: !!e.disabled, color: getComputedStyle(e).color, border: getComputedStyle(e).borderTopColor } : null`), sel)
const shot = async (sel, name) => {
  await page.mouse.move(1, 1); await settle()
  const r = await page.$eval(sel, (e) => { e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x - 10, y: b.y - 34, width: b.width + 20, height: b.height + 44 } })
  await settle()
  const r2 = await page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 34), width: b.width + 20, height: b.height + 44 } })
  void r
  await page.screenshot({ path: `${OUT}/lc-${TAG}-${name}.png`, clip: r2 })
}

// ── P1, the real states ──────────────────────────────────────────────────
await page.evaluate(() => window.navigate('term-pricing'))
await page.waitForFunction(() => document.querySelector('[data-testid="tp-ladder"]'), { timeout: 15000 })
const sel = '[data-testid="tp-escalator-start"]'
const selOff = await measure(sel)
await shot(sel, 'start-year-disabled')
await page.focus('[data-testid="tp-escalator"]'); await page.keyboard.type('3'); await settle()
const selOn = await measure(sel)
await shot(sel, 'start-year-enabled')
check(selOff?.disabled === true && selOn?.disabled === false && selOn.c / selOff.c >= 1.5,
  `P1 start-year select: enabled ${selOn?.c}:1, disabled ${selOff?.c}:1, ratio ${(selOn?.c / selOff?.c).toFixed(2)}`,
  JSON.stringify({ disabledBorder: selOff?.border, enabledBorder: selOn?.border }))
await page.focus('[data-testid="tp-escalator"]'); await page.keyboard.press('Backspace'); await settle()

await page.click('[data-testid="tp-settings-toggle"]')
await page.waitForSelector('[data-testid="tp-settings-save"]')
const save = '[data-testid="tp-settings-save"]'
const saveOff = await measure(save)
await shot(save, 'save-disabled')
const field = '[data-testid="tp-set-MARGIN_FLOOR"]'
const was = await page.$eval(field, (e) => e.value)
await page.focus(field); await page.keyboard.type('5'); await settle()
const saveOn = await measure(save)
await shot(save, 'save-enabled')
check(saveOff?.disabled === true && saveOn?.disabled === false && saveOn.c / saveOff.c >= 1.5,
  `P1 Save settings: enabled ${saveOn?.c}:1, disabled ${saveOff?.c}:1, ratio ${(saveOn?.c / saveOff?.c).toFixed(2)}`,
  JSON.stringify({ disabledBorder: saveOff?.border, enabledBorder: saveOn?.border }))
// Put the field back exactly; nothing is ever saved by this probe.
await page.$eval(field, (e) => e.select()); await page.keyboard.press('Backspace'); await page.keyboard.type(was); await settle()
const back = await page.$eval(save, (e) => e.disabled)
check(back === true, 'the settings field is restored, so Save is disabled again (nothing was saved)')

// ── P1, every other disabled control on the two screens ──────────────────
const others = () => page.evaluate(new Function(`${HELPERS}
  const vis = (e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  const out = []
  for (const e of document.querySelectorAll('.app-content-scroll button:disabled, .app-content-scroll input:disabled, .app-content-scroll select:disabled')) {
    if (!vis(e) || e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')) continue
    const off = contrast(e)
    e.disabled = false
    const on = contrast(e)
    e.disabled = true
    out.push({ id: e.dataset.testid || e.id || e.textContent.trim().slice(0, 24) || e.tagName, off, on, ratio: Math.round(on / off * 100) / 100, muted: /0\\.75\\)|0\\.5\\)/.test(getComputedStyle(e).color) })
  }
  return out`))
const tpOthers = await others()
// The sidebar marks the CURRENT view, so it is measured here, on Term Pricing,
// where that view's link is active. The opportunity view marks no nav link.
const navPair = await page.evaluate(new Function(`${HELPERS}
  const a = document.querySelector('.nav-link.active'), i = document.querySelector('.nav-link:not(.active)')
  if (!a || !i) return null
  const cue = (e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, bb: c.borderBottomColor + ' ' + c.borderBottomWidth, shadow: c.boxShadow, weight: c.fontWeight } }
  const ca = cue(a), ci = cue(i)
  return { activeText: a.textContent.trim(), inactiveText: i.textContent.trim(), textRatio: Math.round(ratio(textOf(a), textOf(i)) * 100) / 100,
    activeContrast: contrast(a), inactiveContrast: contrast(i), otherCues: Object.keys(ca).filter((k) => ca[k] !== ci[k]) }`))
check(!!navPair && (navPair.otherCues.length > 0 || navPair.textRatio >= 1.5),
  `P2 sidebar nav: active "${navPair?.activeText}" ${navPair?.activeContrast}:1, inactive "${navPair?.inactiveText}" ${navPair?.inactiveContrast}:1; text colours differ ${navPair?.textRatio}:1; also marked by ${navPair?.otherCues.join(', ') || 'NOTHING but colour'}`)
await shot('.sidebar', 'nav')

// ── P2 and the Commercials disabled controls need an opportunity ─────────
const { freshOpportunity, tearDown } = await import('../fixtures.mjs')
const FIX = 'lcsA'
let comOthers = []
try {
  const { oppId } = await freshOpportunity(FIX)
  await page.evaluate((id) => window.navigate('opportunity-detail', id), oppId)
  await page.waitForFunction(() => { const v = document.getElementById('view-opportunity-detail'); return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading') }, { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => document.querySelector('#view-opportunity-detail .detail-tab.active'), { timeout: 25000 })
  await settle()
  comOthers = await others()
  const pairs = await page.evaluate(new Function(`${HELPERS}
    const cue = (e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, bb: c.borderBottomColor + ' ' + c.borderBottomWidth, shadow: c.boxShadow, weight: c.fontWeight } }
    const pair = (name, activeSel, inactiveSel) => {
      const a = document.querySelector(activeSel), i = document.querySelector(inactiveSel)
      if (!a || !i) return { name, missing: !a ? activeSel : inactiveSel }
      const ta = textOf(a), ti = textOf(i)
      const ca = cue(a), ci = cue(i)
      const other = Object.keys(ca).filter((k) => ca[k] !== ci[k])
      return { name, activeText: a.textContent.trim().slice(0, 20), inactiveText: i.textContent.trim().slice(0, 20),
        textRatio: Math.round(ratio(ta, ti) * 100) / 100, activeContrast: contrast(a), inactiveContrast: contrast(i), otherCues: other }
    }
    return [
      pair('opportunity tabs', '#view-opportunity-detail .detail-tab.active', '#view-opportunity-detail .detail-tab:not(.active)'),
      pair('stage strip', '#view-opportunity-detail .chevron-item.current', '#view-opportunity-detail .chevron-item:not(.current):not(.completed)'),
    ]`))
  for (const p of pairs) {
    if (p.missing) { check(false, `P2 ${p.name}: found both states`, `missing ${p.missing}`); continue }
    const ok = p.otherCues.length > 0 || p.textRatio >= 1.5
    check(ok, `P2 ${p.name}: active "${p.activeText}" ${p.activeContrast}:1, inactive "${p.inactiveText}" ${p.inactiveContrast}:1; text colours differ ${p.textRatio}:1; also marked by ${p.otherCues.join(', ') || 'NOTHING but colour'}`)
  }
  for (const [name, s] of [['tabs', '#opp-detail-tabs'], ['stage-strip', '#opp-chevron-strip']]) {
    const exists = await page.$(s)
    if (exists) await shot(s.split(',')[0], name)
  }
} finally {
  await tearDown(FIX)
}
for (const o of [...tpOthers.map((x) => ({ s: 'term-pricing', ...x })), ...comOthers.map((x) => ({ s: 'commercials', ...x }))]) {
  check(o.ratio >= 1.5, `P1 ${o.s} disabled "${o.id}": enabled ${o.on}:1, disabled ${o.off}:1, ratio ${o.ratio}${o.muted ? '' : ' (does not paint in --muted)'}`)
}
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
