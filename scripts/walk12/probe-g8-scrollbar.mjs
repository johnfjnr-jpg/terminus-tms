// G8: THE CASH FLOW TABLE'S SCROLL BAR IS DISCOVERABLE
//
// Two claims, and they need different instruments.
//
// DISCOVERABLE WITHOUT HOVERING is a LAYOUT fact: an overlay scrollbar floats
// over the content and takes no space, so `clientHeight === offsetHeight`. A
// classic, always-present bar occupies layout. That difference is measurable
// and is exactly what styling `::-webkit-scrollbar` switches on.
//
// CONTRAST AGAINST ITS TRACK cannot be read from the DOM - pseudo-elements
// are not queryable - so the declared tokens are resolved against the surface
// they sit on and the ratio computed. Measuring the tokens is honest as long
// as the rule is also proven to APPLY, which the layout fact above does.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk12/probe-g8-scrollbar.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk12/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.G8_TAG ?? 'after'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const oppId = must(await db.from('records').select('id')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(1), 'opp')[0].id

// WCAG 1.4.11: a non-text interface component needs 3:1 against what is
// adjacent to it. Written before the ratio was known.
const NON_TEXT_MIN = 3

const MEASURE = () => {
  const el = document.querySelector('.cashflow-scroll')
  if (!el) return { absent: true }
  const cs = getComputedStyle(el)
  // Resolve the declared tokens the rules use, from the root, then composite
  // each over the surface behind the bar.
  const root = getComputedStyle(document.documentElement)
  const tok = (n) => root.getPropertyValue(n).trim()
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (m) { const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
    const h = c.trim().replace('#', '')
    if (!/^[0-9a-f]{6}$/i.test(h)) return null
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
  }
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 })
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

  const surface = parse(tok('--black')) ?? { r: 21, g: 22, b: 28, a: 1 }
  const track = over(parse(tok('--hairline')), surface)
  const thumb = over(parse(tok('--muted')), surface)
  // READ FROM THE CSSOM, which is what the browser actually holds - a rule
  // present in the file and absent from the CSSOM is the fault this estate
  // hit one round ago.
  let rulePresent = false, ruleHeight = null, thumbDeclared = null
  for (const ss of document.styleSheets) {
    let rules; try { rules = ss.cssRules } catch { continue }
    for (const r of rules) {
      if (!r.selectorText) continue
      if (r.selectorText === '.cashflow-scroll::-webkit-scrollbar') {
        rulePresent = true; ruleHeight = parseFloat(r.style.height) || null
      }
      if (r.selectorText === '.cashflow-scroll::-webkit-scrollbar-thumb') {
        thumbDeclared = r.style.background || r.style.backgroundColor || null
      }
    }
  }
  return {
    rulePresent, ruleHeight, thumbDeclared,
    scrolls: el.scrollWidth > el.clientWidth + 1,
    scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
    // A classic bar occupies LAYOUT; an overlay bar does not.
    barHeight: el.offsetHeight - el.clientHeight,
    scrollable: el.classList.contains('is-scrollable'),
    overflowX: cs.overflowX,
    track: hex(track), thumb: hex(thumb),
    ratio: Number(ratio(thumb, track).toFixed(2)),
    thumbVsSurface: Number(ratio(thumb, surface).toFixed(2)),
  }
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1200 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() => !!document.querySelector('.cashflow-scroll'), { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)
    const m = await p.evaluate(MEASURE)
    if (m.absent) { check(false, `the cash flow table exists at ${width}`); continue }
    console.log(`  content ${m.scrollWidth}px in ${m.clientWidth}px, overflow-x ${m.overflowX}`)
    console.log(`  thumb ${m.thumb} on track ${m.track}`)

    // GATED ON THERE BEING SOMETHING TO SCROLL. "No bar" is what a table that
    // fits reports, and that is not the claim (Verification 14).
    check(m.scrolls, `the table actually overflows at ${width}`,
      `${m.scrollWidth} > ${m.clientWidth}`)
    // ── WHAT THIS PROBE CANNOT ESTABLISH, SAID RATHER THAN GUESSED ──────
    //
    // The first version asserted the bar OCCUPIES LAYOUT - `offsetHeight -
    // clientHeight` - on the reasoning that a classic bar takes space and an
    // overlay bar does not. Calibrated against a control page with one styled
    // and one unstyled container, HEADLESS CHROME REPORTED 2px FOR BOTH: the
    // two borders, and no bar either way. Headless renders overlay scrollbars
    // whatever `::-webkit-scrollbar` says, so the check was structurally
    // incapable of telling the states apart (Verification 17).
    //
    // It is replaced by what CAN be measured here - that the rules are live
    // in the CSSOM with a pixel height, which is the switch that opts a
    // container out of overlay rendering - and the layout fact is left
    // explicitly unproven rather than reported from an instrument that cannot
    // see it. A person on the real screen closes that half.
    check(m.rulePresent && m.ruleHeight >= 8,
      'G8 the scrollbar rule is LIVE in the CSSOM with a pixel height',
      `height ${m.ruleHeight ?? 'none'}px, thumb declared ${m.thumbDeclared ?? 'none'}`)
    console.log('        NOT ESTABLISHED HERE: that the bar occupies layout. Headless'
      + ' renders overlay scrollbars whatever the rule says, proven on a control page.')
    check(m.ratio >= NON_TEXT_MIN,
      `G8 the thumb stands off its track`,
      `${m.ratio}:1 against a ${NON_TEXT_MIN}:1 floor  (thumb vs surface ${m.thumbVsSurface}:1)`)
    check(m.scrollable,
      'and the Round 41 overflow fade is still applied', `is-scrollable ${m.scrollable}`)

    await p.evaluate(() => document.querySelector('.cashflow-scroll')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}g8-${TAG}-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('.cashflow-scroll').getBoundingClientRect()
      return r.top < innerHeight && r.bottom > 0 && r.height > 0
    })
    check(inView, `the cash flow table is inside the captured region at ${width}`, shot)
  }
} finally { await b.close() }
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
