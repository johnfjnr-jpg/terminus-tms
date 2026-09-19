// ── R-V7: THE UNSAVED COST TREATMENT IN --attention, AT 1440 ─────────────
//
// The token's VALUE is guarded by scripts/tests/attention-token.test.mjs,
// which asserts the six derived requirements rather than the hex. This probe
// answers the different question that no test can: does the treatment reach
// the screen, and what does it look like.
//
// MEASUREMENTS FIRST, CAPTURE SECOND, and the capture is of the PAGE
// (Verification 4's capture clause: Puppeteer suppresses the scrollbar to take
// an ELEMENT capture and does not put it back).
//
// UNWIRED, and deliberately: it needs a browser, a live server and a signed-in
// session, and it creates a Test Bed. It exists to produce the image John rules
// the colour on.
// Run: PUPPETEER_PATH=... node scripts/walk3/probe-rv7-shot.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-rv7-shot.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'w3v7'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

// THE EXPECTED COLOUR IS READ FROM THE STYLESHEET, never typed here. A hex in
// this file would be a second reader of the token (Verification 20), and it
// would go on passing after somebody retuned the token.
const css = readFileSync(`${ROOT}/frontend/style.css`, 'utf8')
const TOKEN = /--attention:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1]
if (!TOKEN) { console.error('no --attention in style.css'); process.exit(2) }
const rgb = `rgb(${[1, 3, 5].map((i) => parseInt(TOKEN.substr(i, 2), 16)).join(', ')})`
console.log(`--attention is ${TOKEN} = ${rgb}\n`)

const tb = await freshTestBed(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-card-summary"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 30000 })
  await p.click('[data-testid="tb-tab-btn-commercials"]')
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-card-rates-hardware"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 30000 })

  // ── THE STATE THE TREATMENT IS FOR: a total computed from a DRAFT ─────
  // Entered by keyboard, which is R-K's own path, so the two builds are shown
  // working together rather than only apart.
  await p.focus('[data-testid="display-safesightCameras"]')
  await p.keyboard.press('Enter')
  await p.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'input-safesightCameras',
    { timeout: 10000 }).catch(() => false)
  await p.keyboard.type('8')
  await p.keyboard.press('Enter')
  await p.keyboard.type('120')
  await p.keyboard.press('Enter')

  // WAIT ON THE MARKER, which only an unsaved total produces. The card exists
  // either way, so waiting on the card would be satisfied by the saved state.
  await p.waitForSelector('[data-testid="tb-cost-preview-marker"]', { timeout: 20000 })

  // Scroll it into view BEFORE measuring, so the capture can contain it and
  // the geometry below is the geometry a person sees.
  await p.evaluate(() => document.querySelector('[data-testid="tb-cost-card-summary"]')
    ?.scrollIntoView({ block: 'center' }))
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const m = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const badge = v.querySelector('[data-testid="tb-cost-preview-marker"]')
    const card = v.querySelector('[data-testid="tb-cost-card-summary"]')
    const title = card?.querySelector('.pg-card-title')
    const bs = badge && getComputedStyle(badge), cs = card && getComputedStyle(card)
    const br = badge?.getBoundingClientRect(), cr = card?.getBoundingClientRect()
    return {
      text: badge?.textContent?.trim() ?? null,
      colour: bs?.color ?? null,
      badgeBorder: bs?.borderTopColor ?? null,
      cardBorder: cs?.borderTopColor ?? null,
      cardHasClass: card?.classList.contains('tb-cost-card-unsaved') ?? false,
      // A RELATIONSHIP, not a CSS property: the marker sits in the card's own
      // title, which is the thing the Round 17A note says it must do.
      inTitle: !!(title && badge && title.contains(badge)),
      inView: br ? br.top >= 0 && br.bottom <= window.innerHeight : false,
      cardTop: cr ? Math.round(cr.top) : null,
      viewportH: window.innerHeight,
    }
  })
  console.log(`  ${JSON.stringify(m)}\n`)

  check(m.text === 'unsaved', `the marker reads "unsaved" (${m.text})`)
  check(m.inTitle, 'and it sits in the summary card\'s own title, not elsewhere on the page')
  check(m.colour === rgb, `the badge TEXT is --attention ${rgb} (computed ${m.colour})`)
  check(m.badgeBorder === rgb, `the badge BORDER is --attention (computed ${m.badgeBorder})`)
  check(m.cardHasClass, 'the summary card carries tb-cost-card-unsaved')
  check(m.cardBorder === rgb, `the CARD border is --attention (computed ${m.cardBorder})`)
  // CONFIRM THE ELEMENT IS IN THE CAPTURED REGION before the image counts as
  // evidence: a blank capture is not a failed check, it is no check.
  check(m.inView, `the card is inside the viewport being captured (top ${m.cardTop} of ${m.viewportH})`)

  const shot = `${OUT}rv7-attention-1440-${tb.bedId.slice(0, 8)}.png`
  await p.screenshot({ path: shot })
  console.log(`\n  screenshot: ${shot}`)
} finally {
  await b.close()
  await tearDown(TAG)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
