// ── is-scrollable, IN A BROWSER, BOTH DIRECTIONS ─────────────────────────
//
// The last name on the adoption ratchet. It cannot be measured in jsdom at all:
// scrollWidth and clientWidth are both 0 there and ResizeObserver is undefined,
// so the class is false for every possible markup. This is the measurement that
// closes it, and it is taken both ways - a grid that overflows carries the
// class, one that fits does not - because "present" alone would pass on a
// render that applied it unconditionally.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '/Users/johnfryatt/terminus-tms/scripts/lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '/Users/johnfryatt/terminus-tms/scripts/fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms/'
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d) })
const puppeteer = await loadPuppeteer('scrollable')
const { oppId } = await freshOpportunity('F-SCROLL')

try {
  const SESSION = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @' + (m.location()?.url ?? '')) })
  // NARROW, so a long grid must overflow. The class is about the viewport as
  // much as the content.
  await page.setViewport({ width: 1240, height: 800 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(SESSION))
  await page.reload({ waitUntil: 'networkidle0' })
  if (await page.evaluate(() => !document.getElementById('view-auth')?.classList.contains('hidden'))) {
    throw new Error('NOT SIGNED IN, so nothing below measures the app')
  }
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 20000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  // WAIT ON THE PANEL ITSELF, not on the container having any child: React's
  // root gets a child before the panel's own tree is what is in it, and the
  // first reading of this probe measured that gap and reported the mount
  // missing on an app where it was working.
  await page.waitForFunction(() => !!document.querySelector('#deal-form-root [data-testid="deal-panel"]'),
    { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial'); return p && !p.classList.contains('hidden')
  }, { timeout: 20000 })
  await page.waitForFunction(() => !!document.getElementById('deal-cashflow-grid'), { timeout: 20000 })

  check('THE REACT PANEL IS MOUNTED, and the vanilla markup is hidden',
    await page.evaluate(() => !!document.querySelector('#deal-form-root [data-testid="deal-panel"]')
      && !!document.getElementById('deal-form-vanilla')?.classList.contains('hidden')))

  const setDuration = async (months) => {
    await page.evaluate((m) => {
      const el = document.getElementById('deal-duration')
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(el, String(m)); el.dispatchEvent(new Event('input', { bubbles: true }))
    }, months)
    // Wait on the GRID, never a delay: the column count is what changes.
    await page.waitForFunction((m) => {
      const g = document.getElementById('deal-cashflow-grid')
      return g && g.querySelectorAll('.cf-row.head .cf-cell').length === m
    }, { timeout: 20000 }, months)
    // One frame for the ResizeObserver to run after the columns change.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    return page.evaluate(() => {
      const g = document.getElementById('deal-cashflow-grid')
      return { has: g.classList.contains('is-scrollable'), sw: g.scrollWidth, cw: g.clientWidth }
    })
  }

  const wide = await setDuration(60)
  check('A GRID THAT OVERFLOWS CARRIES is-scrollable', wide.has,
    `scrollWidth ${wide.sw} vs clientWidth ${wide.cw}`)
  check('and it really does overflow, so the class is not decoration',
    wide.sw > wide.cw + 1, `${wide.sw} > ${wide.cw} + 1`)

  const narrow = await setDuration(3)
  check('A GRID THAT FITS DOES NOT', !narrow.has,
    `scrollWidth ${narrow.sw} vs clientWidth ${narrow.cw}`)
  check('and it really does fit, so the absence is not a broken observer',
    narrow.sw <= narrow.cw + 1, `${narrow.sw} <= ${narrow.cw} + 1`)

  check('no page errors', errs.filter((e) => !e.includes('favicon')).length === 0,
    errs.filter((e) => !e.includes('favicon')).join(' | '))
  await browser.close()
} catch (err) {
  R.push({ n: 'PROBE THREW: ' + String(err.message).slice(0, 140), p: false, d: '' })
} finally {
  // IN A FINALLY. A probe that dies mid-run still owns its fixture.
  await tearDown()
}

const failed = R.filter((r) => !r.p)
console.log(JSON.stringify({ totals: `${R.length - failed.length}/${R.length}`, results: R }, null, 1))
