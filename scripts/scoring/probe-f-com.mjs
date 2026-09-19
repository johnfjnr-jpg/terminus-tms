// ── F-COM: MEASURE ONLY. The Opportunity Commercials tab's white background ─
//
// John: it renders on a WHITE background with labels overlapping inputs.
// NOTHING IS BUILT. This establishes which component, which mechanism, and
// whether anything already records it.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('scoring/probe-f-com.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/scoring/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'v9fcom'
const opp = await freshOpportunity(TAG)
const oppId = opp.oppId ?? opp.opportunityId
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  const errors = []
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`) })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await p.waitForFunction(() => !!document.getElementById('opp-tab-commercial'), { timeout: 30000 })
  await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await p.evaluate(() => new Promise((r) => setTimeout(r, 3000)))

  const m = await p.evaluate(() => {
    const panel = document.getElementById('opp-tab-commercial')
    const root = document.getElementById('deal-form-root')
    const vanilla = document.getElementById('deal-form-vanilla')
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect()
      const cs = getComputedStyle(e)
      return { w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor,
        hidden: e.hasAttribute('hidden') || cs.display === 'none', children: e.children.length } }
    // Which ancestor actually paints a light background, if any.
    const painters = []
    for (const e of panel.querySelectorAll('*')) {
      const bg = getComputedStyle(e).backgroundColor
      const m2 = /rgba?\((\d+), (\d+), (\d+)/.exec(bg)
      if (m2 && Number(m2[1]) > 200 && Number(m2[2]) > 200 && Number(m2[3]) > 200) {
        painters.push(`${e.tagName.toLowerCase()}#${e.id || ''}.${(e.className || '').toString().slice(0, 40)} -> ${bg}`)
      }
    }
    return {
      seamPresent: typeof window.initOpportunityDealPanel === 'function',
      root: box(root), vanilla: box(vanilla),
      panelBg: getComputedStyle(panel).backgroundColor,
      lightPainters: painters.slice(0, 8), lightCount: painters.length,
    }
  })
  console.log(JSON.stringify(m, null, 1))
  console.log(`\nerrors on the page: ${errors.length}`)
  for (const e of errors.slice(0, 6)) console.log(`  ${e}`)
  // ── THE CAPTURE MUST CONTAIN THE PANEL ──────────────────────────────────
  //
  // The first version scrolled the panel to `block: 'start'` and took a
  // fullPage shot, and produced a picture of empty background - a clean image
  // of nothing under a report about a white panel. Caught by opening it.
  //
  // Scroll one of the WHITE INPUTS into the middle instead, confirm it is in
  // the viewport, and capture the viewport rather than the page.
  const framed = await p.evaluate(() => {
    const el = document.getElementById('deal-ssExisting') ?? document.getElementById('deal-form-root')
    el?.scrollIntoView({ block: 'center' })
    const r = el?.getBoundingClientRect()
    return r ? { top: Math.round(r.top), inView: r.top >= 0 && r.bottom <= window.innerHeight, w: Math.round(r.width) } : null
  })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  console.log(`  the white inputs are inside the captured region: ${JSON.stringify(framed)}`)
  await p.screenshot({ path: `${OUT}f-com-1440-${oppId.slice(0, 8)}.png` })
  console.log(`\nscreenshot: ${OUT}f-com-1440-${oppId.slice(0, 8)}.png`)
} finally { await b.close(); await tearDown(TAG) }
