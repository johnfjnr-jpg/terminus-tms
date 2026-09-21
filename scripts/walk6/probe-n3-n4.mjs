// N3 and N4, proven on the live surfaces.
//
// N3 IS A POSITION, so it is measured as a RELATIONSHIP between three
// elements: the name, the band and the stats banner. The comment at the band's
// own markup records why - a round told to move that band "into the header"
// put it 433px down the page and every assertion passed, because they asked
// whether the band was INTACT rather than where it SAT.
//
// N4 IS A SHARED TREATMENT, so it is measured by COMPARING the two banners
// rather than by asserting either one's border. A copied literal passes an
// assertion about one banner; only the comparison can see whether they match.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk6/probe-n3-n4.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, freshTestBed, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk6/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w6n34'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const opp = await freshOpportunity(TAG)
const bed = await freshTestBed(TAG)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const settle = async (testid) => {
    await p.waitForFunction((t) => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      if (!v || v.classList.contains('is-loading')) return false
      const el = v.querySelector(`[data-testid="${t}"], #${t}`)
      return !!el && getComputedStyle(el).visibility === 'visible'
    }, { timeout: 25000 }, testid)
    // THE CHEVRON IS ASYNC AND THE STATS ARE NOT, so waiting on the stats is a
    // wait the pre-chevron state already satisfies. Measured: the strip reads 0
    // children at that moment and 8 a moment later, and a screenshot taken
    // between the two shows an empty 36px band that reads exactly like a
    // defect. Wait for the strip to be POPULATED before capturing.
    await p.waitForFunction(() => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      const strip = v && v.querySelector('.chevron-strip')
      return !strip || strip.children.length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  for (const width of [1440, 1240]) {
    console.log(`\n=== ${width}px ===`)
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await settle('opp-headline')

    const n3 = await p.evaluate(() => {
      const top = (sel) => {
        const e = document.querySelector(sel)
        return e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null
      }
      const band = document.getElementById('opp-band-root')
      return {
        name: top('#ref-display-name'),
        band: band && band.children.length ? Math.round(band.getBoundingClientRect().top + window.scrollY) : null,
        bandHasContent: !!band && band.children.length > 0,
        headline: top('#opp-headline'),
        chevron: top('#opp-chevron-wrap'),
        tabs: top('#opp-detail-tabs'),
      }
    })
    console.log(`  name ${n3.name}  band ${n3.band}  headline ${n3.headline}  chevron ${n3.chevron}  tabs ${n3.tabs}`)

    check(n3.bandHasContent,
      `N3 the band still renders, so the ordering checks are not vacuous at ${width}`)
    check(n3.band !== null && n3.name !== null && n3.band > n3.name,
      `N3 the band renders AFTER the opportunity name at ${width}`,
      `name ${n3.name}, band ${n3.band}`)
    check(n3.band !== null && n3.headline !== null && n3.band < n3.headline,
      `N3 and ABOVE the stats banner at ${width}`,
      `band ${n3.band}, headline ${n3.headline}`)
    check(n3.headline !== null && n3.chevron !== null && n3.headline < n3.chevron,
      `N3 and the banner and chevron keep their own order at ${width}`,
      `headline ${n3.headline}, chevron ${n3.chevron}`)

    // ── N4: THE TWO BANNERS, COMPARED ───────────────────────────────────
    const oppBanner = await p.evaluate(() => {
      const e = document.getElementById('opp-headline')
      if (!e) return null
      const cs = getComputedStyle(e)
      const cell = e.firstElementChild ? getComputedStyle(e.firstElementChild) : null
      return { border: cs.border, background: cs.backgroundColor, gap: cs.gap,
        cellBg: cell?.backgroundColor ?? null }
    })
    await p.evaluate((id) => navigate('test-bed-detail', id), bed.bedId)
    await settle('tb-header-stats')
    const bedBanner = await p.evaluate(() => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      const e = v?.querySelector('[data-testid="tb-header-stats"]')
      if (!e) return null
      const cs = getComputedStyle(e)
      const cell = e.firstElementChild ? getComputedStyle(e.firstElementChild) : null
      return { border: cs.border, background: cs.backgroundColor, gap: cs.gap,
        cellBg: cell?.backgroundColor ?? null }
    })
    console.log(`  opportunity banner: ${JSON.stringify(oppBanner)}`)
    console.log(`  test bed banner   : ${JSON.stringify(bedBanner)}`)

    check(!!oppBanner && !!bedBanner, `N4 both banners render at ${width}`)
    check(!!oppBanner?.border && oppBanner.border !== 'none' && oppBanner.border !== '',
      `N4 the Opportunity banner has a border to share at ${width}`, oppBanner?.border)
    check(oppBanner?.border === bedBanner?.border,
      `N4 the Test Bed banner takes the SAME border at ${width}`,
      `${oppBanner?.border} vs ${bedBanner?.border}`)
    check(oppBanner?.background === bedBanner?.background,
      `N4 and the same hairline ground at ${width}`,
      `${oppBanner?.background} vs ${bedBanner?.background}`)
    check(oppBanner?.gap === bedBanner?.gap,
      `N4 and the same gap, which is what makes the rules visible at ${width}`,
      `${oppBanner?.gap} vs ${bedBanner?.gap}`)
    check(!!bedBanner?.cellBg && bedBanner.cellBg === oppBanner?.cellBg,
      `N4 and its cells paint the same ground, or the banner is one solid block`,
      `${oppBanner?.cellBg} vs ${bedBanner?.cellBg}`)

    await p.screenshot({ path: `${OUT}n4-testbed-${width}.png` })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await settle('opp-headline')
    await p.screenshot({ path: `${OUT}n3-opp-${width}.png` })
    console.log(`  captured n3-opp-${width}.png and n4-testbed-${width}.png`)
  }
} finally {
  await b.close()
  await tearDown([TAG])
}
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
