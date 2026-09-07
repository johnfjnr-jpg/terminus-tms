// ── ROUND 6 PHASE 2 ITEM 3: THE VISUAL COMPARISON ───────────────────────
//
// React against the vanilla, three widths, on EXERCISED states.
//
// ── THE COMPARISON PROVES ITS CAPTURES ARE OF DIFFERENT THINGS ──────────
//
// Round 5's reconciliation of Round 2: that round reported identical outer
// boxes for the two implementations - 140x1693 to the pixel - and it was ONE
// TREE CAPTURED TWICE. Identical geometry between two independent renderings
// is a TELL, not a result. So this asserts which implementation it captured,
// on each capture, before it compares anything.
//
// THE VANILLA IS REACHED BY THE LOAD-ORDER REVERT AT RUNTIME: its module is
// injected and re-assigns window.loadContactDetail after the bundle has, which
// is exactly what restoring the script tag does.
import { readFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = process.env.SNAP || (ROOT + '.verify/visual-contact')
mkdirSync(OUT, { recursive: true })
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })
const puppeteer = await loadPuppeteer('visual-contact')
let browser = null

const unwrap = (r, w) => { if (!r.ok) throw new Error(`${w}: ${r.status}`); return r.data }
const industries = unwrap(await api('GET', '/industries'), 'industries')
const contact = unwrap(await api('POST', '/contacts', {
  name: 'R6VIS Contact', company: 'R6VIS Holdings', email: 'r6vis@example.invalid',
  mobile: '+65 9000 0004', industry_id: industries[0].id, source: 'Referral',
  jobRole: 'Head of Infrastructure', linkedin: 'https://example.invalid/in/v',
  address: '4 Fixture Street', address2: 'Level 4', city: 'Singapore',
  postcode: '018959', country: 'Singapore', region: 'Asia Pacific',
  summary: 'A fixture for the visual comparison.',
}), 'create')

const WIDTHS = [1240, 1920, 3440]

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  /** Loads the app, optionally reverting to the vanilla first. */
  const boot = async (impl) => {
    await page.reload({ waitUntil: 'networkidle0' })
    if (impl === 'vanilla') {
      // THE LOAD-ORDER REVERT, at runtime. The vanilla re-assigns
      // window.loadContactDetail AFTER the bundle has, so its view runs and the
      // React mount never does - which is what restoring the tag achieves.
      await page.evaluate(() => new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = '/contact-detail.js'
        s.onload = resolve
        s.onerror = () => reject(new Error('contact-detail.js did not load'))
        document.body.appendChild(s)
      }))
    }
    await page.waitForFunction(() => typeof window.loadContactDetail === 'function', { timeout: 25000 })
    await page.evaluate((x) => navigate('contact-detail', x), contact.id)
    await page.waitForFunction(() => {
      const v = document.getElementById('view-contact-detail')
      return v && !v.classList.contains('is-loading')
        && v.querySelectorAll('[data-key]').length > 0
    }, { timeout: 30000 })
    await settle()
  }

  /** Which implementation is on screen, measured rather than assumed. */
  const identify = () => page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    return {
      react: !!v?.querySelector('[data-testid="contact-panel"]'),
      vanillaRows: !!v?.querySelector('#cd-contact-rows .ref-field'),
      rows: v?.querySelectorAll('[data-key]').length ?? 0,
    }
  })

  /** Opens two rows and types, so the bar is counting and editors are open. */
  const exercise = (impl) => page.evaluate((i) => {
    const open = (k) => (i === 'react'
      ? document.querySelector(`[data-testid="display-${k}"]`)
      : document.getElementById(`cd-display-${k}`))?.click()
    open('city'); open('postcode')
    const set = (k, v) => {
      const el = i === 'react'
        ? document.querySelector(`[data-testid="input-${k}"]`)
        : document.getElementById(`cd-input-${k}`)
      if (!el) return
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set('city', 'Kuala Lumpur'); set('postcode', '50000')
  }, impl)

  const measure = () => page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }
    const rows = [...v.querySelectorAll('[data-key]')]
    return {
      view: box(v),
      rows: rows.length,
      firstRow: box(rows[0]),
      openEditors: [...v.querySelectorAll('input, select, textarea')]
        .filter((e) => e.offsetParent !== null).length,
      overflowX: v.scrollWidth > v.clientWidth + 1,
      barText: (v.querySelector('[data-testid="edit-bar"]')
        ?? document.getElementById('cd-below-grid'))?.innerText?.trim()?.slice(0, 40) ?? null,
    }
  })

  const captures = {}
  for (const impl of ['react', 'vanilla']) {
    captures[impl] = {}
    for (const w of WIDTHS) {
      await page.setViewport({ width: w, height: 1000 })
      await boot(impl)
      const id = await identify()
      await exercise(impl)
      await settle()
      captures[impl][w] = { id, m: await measure() }
      await page.screenshot({ path: `${OUT}/${impl}-${w}.png`, fullPage: false })
    }
  }

  // ── THE TWO CAPTURES ARE OF DIFFERENT IMPLEMENTATIONS ─────────────────
  for (const w of WIDTHS) {
    check(`${w}: the REACT capture is the React panel`,
      captures.react[w].id.react && !captures.react[w].id.vanillaRows,
      JSON.stringify(captures.react[w].id))
    check(`${w}: the VANILLA capture is the vanilla`,
      captures.vanilla[w].id.vanillaRows && !captures.vanilla[w].id.react,
      JSON.stringify(captures.vanilla[w].id))
  }

  // ── AND THEN THE COMPARISON ───────────────────────────────────────────
  for (const w of WIDTHS) {
    const r = captures.react[w].m
    const v = captures.vanilla[w].m
    check(`${w}: both render the same 15 rows`, r.rows === 15 && v.rows === 15,
      `react ${r.rows}, vanilla ${v.rows}`)
    check(`${w}: neither overflows horizontally`, !r.overflowX && !v.overflowX,
      `react ${r.overflowX}, vanilla ${v.overflowX}`)
    check(`${w}: the row is a usable width on both`,
      (r.firstRow?.w ?? 0) > 300 && (v.firstRow?.w ?? 0) > 300,
      `react ${r.firstRow?.w}, vanilla ${v.firstRow?.w}`)
    check(`${w}: exercising OPENED editors on both`, r.openEditors > 0 && v.openEditors > 0,
      `react ${r.openEditors}, vanilla ${v.openEditors}`)
  }

  console.log('\nMEASUREMENTS')
  for (const w of WIDTHS) {
    console.log(`  ${w}  react  ${JSON.stringify(captures.react[w].m)}`)
    console.log(`  ${w}  vanilla ${JSON.stringify(captures.vanilla[w].m)}`)
  }
  console.log(`\nScreenshots in ${OUT}`)
  check('99. no page errors', errs.length === 0, errs.join(' | '))
} finally {
  if (browser) await browser.close()
  await tearDown()
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
