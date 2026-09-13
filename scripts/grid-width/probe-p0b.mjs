// ── PHASE 0b: TWO THINGS THE FIRST PASS COULD NOT SETTLE ─────────────────
//
// 1. CAN THIS INSTRUMENT SEE A SCROLL BAR AT ALL? `offsetHeight -
//    clientHeight` read 0 at every width. That is consistent with TWO very
//    different worlds: a platform overlay scrollbar that has no layout
//    height, or a headless browser that renders no scrollbar ever. The
//    second would make the measure useless and the reading meaningless.
//    Verification 17: show the probe returning a DIFFERENT value on a
//    known-different state before trusting the one it gave.
//
// 2. WHY DOES JOHN SEE IT OPEN AT MOBILE? The first pass read
//    `scrollLeft = 0` and NAME visible on a FIRST open. The modal persists
//    in the DOM between opens - `openNewLeadModal` only removes `hidden` -
//    and `NewLeadGrid` resets `scrollTop` and NOT `scrollLeft`. So the
//    hypothesis is that a REOPEN keeps wherever you scrolled to.
//    Verification 26: that is an inference and needs its own measurement.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('grid-width/probe-p0b.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/gridw/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction(() => !!document.getElementById('btn-new-contact'), { timeout: 20000 })
  const open = async () => {
    await page.evaluate(() => document.getElementById('btn-new-contact').click())
    await page.waitForFunction(() =>
      document.querySelectorAll('[data-testid^="nlg-th-"]').length >= 15, { timeout: 20000 })
    await new Promise((r) => setTimeout(r, 500))
  }
  await open()

  console.log('=== 1. CAN THE INSTRUMENT SEE A SCROLL BAR? ===')
  const cal = await page.evaluate(() => {
    const s = document.querySelector('.new-lead-scroll')
    const before = s.offsetHeight - s.clientHeight
    // Force a CLASSIC, always-laid-out scrollbar and re-measure.
    const st = document.createElement('style')
    st.id = 'cal-bar'
    st.textContent = `.new-lead-scroll::-webkit-scrollbar{height:14px;width:14px}
      .new-lead-scroll::-webkit-scrollbar-thumb{background:#888}`
    document.head.appendChild(st)
    s.offsetHeight // force layout
    const after = s.offsetHeight - s.clientHeight
    st.remove()
    s.offsetHeight
    const reverted = s.offsetHeight - s.clientHeight
    return { before, after, reverted }
  })
  console.log(`  height with the page as it is      : ${cal.before}px`)
  console.log(`  height with ::-webkit-scrollbar 14px: ${cal.after}px`)
  console.log(`  height after removing the injection : ${cal.reverted}px`)
  console.log(cal.after > cal.before
    ? `  CALIBRATED: the instrument CAN see a scroll bar. The 0 is a real absence,\n              not a blind measure - the platform bar is an OVERLAY with no layout height.`
    : `  *** USELESS MEASURE: headless renders no scrollbar in either state. A\n      different instrument is needed and the 0 above means nothing. ***`)

  console.log('\n=== 2. DOES A REOPEN KEEP THE SCROLL POSITION? ===')
  const r = await page.evaluate(() => {
    const s = document.querySelector('.new-lead-scroll')
    return { firstOpenScrollLeft: s.scrollLeft }
  })
  console.log(`  first open, scrollLeft            : ${r.firstOpenScrollLeft}`)
  // Scroll the way a person reaching a far column does.
  await page.evaluate(() => { document.querySelector('.new-lead-scroll').scrollLeft = 1400 })
  await new Promise((res) => setTimeout(res, 200))
  const moved = await page.evaluate(() => {
    const s = document.querySelector('.new-lead-scroll')
    const sb = s.getBoundingClientRect()
    const ths = [...document.querySelectorAll('[data-testid^="nlg-th-"]')]
    const fully = ths.filter((t) => { const q = t.getBoundingClientRect()
      return q.left >= sb.left - 0.5 && q.right <= sb.right + 0.5 })
    return { scrollLeft: s.scrollLeft, first: fully[0]?.dataset.testid, name: fully.some(t=>t.dataset.testid==='nlg-th-name') }
  })
  console.log(`  after scrolling to 1400           : scrollLeft ${moved.scrollLeft}, first visible ${moved.first}, NAME visible ${moved.name}`)
  // Close and reopen, exactly as a person does.
  await page.evaluate(() => document.getElementById('btn-close-new-contact').click())
  await new Promise((res) => setTimeout(res, 400))
  await open()
  const re = await page.evaluate(() => {
    const s = document.querySelector('.new-lead-scroll')
    const sb = s.getBoundingClientRect()
    const ths = [...document.querySelectorAll('[data-testid^="nlg-th-"]')]
    const fully = ths.filter((t) => { const q = t.getBoundingClientRect()
      return q.left >= sb.left - 0.5 && q.right <= sb.right + 0.5 })
    return { scrollLeft: s.scrollLeft, first: fully[0]?.dataset.testid, name: fully.some(t=>t.dataset.testid==='nlg-th-name') }
  })
  console.log(`  REOPENED                          : scrollLeft ${re.scrollLeft}, first visible ${re.first}, NAME visible ${re.name}`)
  console.log(re.scrollLeft > 0
    ? `  REPRODUCED: the reopen keeps the horizontal position. NAME is off-screen\n              left on the second open, which is what the walk reported.`
    : `  NOT REPRODUCED by this path: the reopen resets. The walk's cause is elsewhere.`)
  await page.screenshot({ path: `${OUT}p0b-reopened-1920.png` })
} finally { await browser.close() }
