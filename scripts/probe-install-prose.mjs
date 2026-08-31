#!/usr/bin/env node
// The Installation section with its prose removed. Round 41, fix-panel item 1.
//
// ── WHAT IS MEASURED, AND WHY IT IS NOT A HEIGHT ───────────────────────────
//
// CLAUDE.md Verification 27: a distance is a property of the layout, a window
// is a property of the task. "Section 2 got 190px shorter" is a property of the
// document and would read as an improvement whatever it did to the screen.
//
// The task this section serves is CHOOSING AN INSTALLATION BASIS AND SEEING
// WHAT IT COSTS. So the measure is the both-visible window: the number of
// scroll positions from which the responsibility picklist and the first row of
// the installation pricing table are on screen together. That is the business's
// own argument for the removal, stated as something a person experiences: the
// consequence is SHOWN by the table switching, so the control and the table
// have to be visible at the same time for the argument to hold.
//
// ── BEFORE IS INJECTED, AND THE LIMIT OF THAT IS STATED ────────────────────
//
// The five removed elements are re-inserted into the live page with their
// shipped classes, inline styles and text. They were static markup with no
// behaviour, except the two rendered ones, whose text is pasted from what the
// renderer produced for this deal. So the injection is faithful for LAYOUT,
// which is what is being measured.
//
// It is NOT a substitute for the real prior build and is not claimed as one.
// Verification 18's warning applies: the injection is calibrated below by
// asserting the five elements are present in BEFORE and absent in AFTER, and by
// requiring the measured window to differ. An injection that changes nothing has
// failed to run.
let puppeteer
try {
  puppeteer = (await import(process.env.PUPPETEER_PATH ?? 'puppeteer')).default
} catch {
  const { existsSync, readFileSync: rf } = await import('fs')
  const dir = process.env.PUPPETEER_PATH
  if (dir && existsSync(`${dir}/package.json`)) {
    const entry = JSON.parse(rf(`${dir}/package.json`, 'utf8')).exports?.['.']?.import
    if (entry) puppeteer = (await import(new URL(entry, `file://${dir}/`).href)).default
  }
  if (!puppeteer) {
    console.error('puppeteer is not available, and it is not a dependency of this repository.')
    console.error('  npm i puppeteer --prefix /tmp/tms-probe')
    console.error('  PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer node scripts/probe-install-prose.mjs')
    process.exit(1)
  }
}
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'fs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
// The same priced deal probe-strip-layout uses: units, a duration and a
// structure. An unpriced deal renders a table of zeroes, which is still a table
// and still measurable, but the capture would show nothing a reader can judge.
const OPP = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const OUT = new URL('../.verify/install/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const REMOVED = {
  respStatic: 'Who installs, and therefore whether installation cost sits in this deal at all.',
  respPerOption: 'Installation cost rises with every unit. Use when the unit count may still move.',
  lumpStatic: "The contractor's fixed price for the whole installation. Used only when responsibility is Terminus Contractor, Lump Sum.",
  basis: 'Rates from batch "Launch pricing 2026", effective 2026-01-01. AQ Sensor and HEMIR use the existing-infrastructure figure; their new-infrastructure rates are held in the catalog and have no row on this tab.',
  infra: 'Existing infrastructure means mounting on poles, columns or buildings already in place. New infrastructure means we supply and erect the mount, which costs more and takes longer.',
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()

const load = async (width) => {
  await page.setViewport({ width, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('opportunity-detail', id), OPP)

  // ── THE COUNTERFACTUAL, STATED BEFORE THE WAIT. Verification 7 ──────────
  //
  // THE FIRST VERSION OF THIS WAIT WAS STALE-SATISFIABLE AND IS RECORDED
  // RATHER THAN QUIETLY REPLACED, because it failed in the exact shape the
  // rule describes and it was written by somebody who had just re-read it.
  //
  // It clicked the Commercials tab immediately after navigate(), then waited on
  // a condition whose else-branch returned TRUE. Both halves were already
  // satisfied before the record loaded: the tab panel is not hidden in the
  // pre-load state, and the select's default value is not Per Unit, so the
  // ternary took the branch that returns true unconditionally. The wait
  // resolved on the empty screen, the probe set the picklist, and populateForm
  // then arrived, overwrote uiState.installResp from the payload and re-hid the
  // table. The 20s timeout that followed was the only reason it was noticed.
  //
  // What is false in the pre-load state and true only once THIS deal has
  // priced: contract net with a leading non-zero digit. Borrowed from
  // probe-strip-layout, which measures the same record.
  await page.waitForFunction(() => {
    const el = document.getElementById('deal-contract-net')
    return el && /\$[1-9]/.test(el.textContent)
  }, { timeout: 25000 })
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-opp-tab]')].find((b) => /commercial/i.test(b.textContent))
    if (t) t.click()
  })
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && !p.classList.contains('hidden')
  }, { timeout: 20000 })
  // Force the Per Unit basis, which is the state where the table exists at all.
  await page.evaluate(() => {
    const sel = document.getElementById('deal-installResp')
    sel.value = 'Terminus Contractor - Per Unit'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForFunction(() => {
    const t = document.getElementById('deal-install-table')
    return t && !t.classList.contains('hidden')
  }, { timeout: 20000 })
}

const inject = async (removed) => page.evaluate((R) => {
  const p = (cls, style, text, id) => {
    const el = document.createElement('p')
    el.className = cls
    el.setAttribute('style', style)
    el.textContent = text
    if (id) el.id = id
    el.dataset.injectedBefore = '1'
    return el
  }
  const sel = document.getElementById('deal-installResp')
  sel.after(p('field-note', 'margin-top:6px', R.respStatic))
  sel.nextElementSibling.after(p('field-note', 'margin-top:4px', R.respPerOption, 'deal-installResp-note'))
  const lump = document.getElementById('deal-lumpCost')
  lump.after(p('field-note', 'margin-top:6px', R.lumpStatic))
  const table = document.getElementById('deal-install-table')
  table.before(p('field-note', 'margin:0 0 10px', R.infra))
  table.parentElement.insertBefore(p('field-note', 'margin:0 0 10px', R.basis, 'deal-install-basis'),
    table.previousElementSibling)
}, removed)

// ── THE MEASURE ────────────────────────────────────────────────────────────
//
// Both-visible window: over every scroll position of the real scroll container,
// in 10px steps, count the positions where the picklist and the first table row
// are both fully inside the viewport. Reported in pixels of scroll travel.
const window_ = async () => page.evaluate(() => {
  // THE SCROLLER IS DERIVED, NOT NAMED. The first version named `.detail-scroll`
  // with document.scrollingElement as a fallback. That class does not exist on
  // this screen, so every run fell through to the document, whose scrollMax is
  // 0 because the app scrolls an inner pane. The loop then ran exactly one
  // iteration at y=0 and reported a window of 0px at three widths and 10px at
  // the fourth, which reads as a real measurement and was none.
  //
  // Caught by the calibration refusing a result where the number did not move,
  // which is Verification 18 doing the job it exists for: a calibration that
  // does not move the number has failed to run, not passed. Verification 12's
  // family too, a search that never ran reading exactly like a true negative.
  //
  // Walking for the first ancestor that ACTUALLY scrolls survives the class
  // being renamed and cannot silently select an element that does not move.
  const scrollerOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      if (n.scrollHeight - n.clientHeight > 1) return n
    }
    return document.scrollingElement
  }
  const ctl = document.getElementById('deal-installResp')
  const row = document.querySelector('#deal-install-table tbody tr')
  const scroller = scrollerOf(ctl)
  // THE FRAME IS THE SCROLLER'S OWN RECT, not the viewport. The pane sits below
  // a fixed header, so a row at y=40 is inside the viewport and behind the
  // header. What the person can see of this pane is the pane.
  const frame = scroller === document.scrollingElement
    ? { top: 0, bottom: window.innerHeight }
    : scroller.getBoundingClientRect()
  const max = scroller.scrollHeight - scroller.clientHeight
  const before = scroller.scrollTop
  let hits = 0, first = null, last = null
  for (let y = 0; y <= max; y += 10) {
    scroller.scrollTop = y
    const a = ctl.getBoundingClientRect(), b = row.getBoundingClientRect()
    const vis = (r) => r.top >= frame.top && r.bottom <= frame.bottom
    if (vis(a) && vis(b)) { hits++; if (first === null) first = y; last = y }
  }
  scroller.scrollTop = before
  return { windowPx: hits * 10, firstAt: first, lastAt: last, scrollMax: max,
    scroller: scroller === document.scrollingElement ? 'document' : (scroller.className || scroller.tagName) }
})

const shoot = async (file) => {
  // Verification 4, refined: scroll the section into view, take the rect AFTER
  // scrolling, and confirm the capture is not empty before treating it as
  // evidence. A blank image is not a failed check, it is no check.
  const rect = await page.evaluate(() => {
    const s = document.getElementById('deal-section-2')
    s.scrollIntoView({ block: 'start' })
    const host = document.getElementById('deal-install-table').getBoundingClientRect()
    const a = s.getBoundingClientRect()
    return { x: Math.max(0, a.x - 8), y: Math.max(0, a.y - 8),
      width: Math.min(window.innerWidth - Math.max(0, a.x - 8), a.width + 16),
      height: Math.min(window.innerHeight - Math.max(0, a.y - 8), Math.max(a.height, host.bottom - a.y) + 16) }
  })
  await page.screenshot({ path: file, clip: rect })
  const bytes = statSync(file).size
  return { bytes, rect }
}

const rows = []
// A scroller that cannot scroll is not a weaker reading, it is no reading, so
// it is refused rather than reported. Verification 18.
const fatal = []
for (const width of [1240, 1920]) {
  for (const state of ['before', 'after']) {
    await load(width)
    if (state === 'before') await inject(REMOVED)
    // CALIBRATION of the injection itself: five present in before, zero in after.
    const injected = await page.evaluate(() => document.querySelectorAll('[data-injected-before]').length)
    const w = await window_()
    const file = `${OUT}install-${width}-${state}.png`
    const { bytes, rect } = await shoot(file)
    rows.push({ width, state, injected, ...w, bytes, capture: `${Math.round(rect.width)}x${Math.round(rect.height)}` })
    if (w.scrollMax === 0) fatal.push(`${width}/${state}: the scroller reports scrollMax 0, so the window loop ran once and measured nothing`)
  }
}

console.log('\n  INSTALLATION SECTION, prose removed. Round 41 item 1.\n')
console.log('  width  state   injected  both-visible window  scroll range   capture      png')
for (const r of rows) {
  console.log(`  ${String(r.width).padEnd(6)} ${r.state.padEnd(7)} ${String(r.injected).padEnd(9)} ` +
    `${(r.windowPx + 'px').padEnd(20)} ${String(r.firstAt ?? '-').padStart(5)}..${String(r.lastAt ?? '-').padEnd(6)} ` +
    `${r.capture.padEnd(12)} ${(r.bytes / 1024).toFixed(0)}KB`)
}

const fail = [...fatal]
for (const w of [1240, 1920]) {
  const b = rows.find(r => r.width === w && r.state === 'before')
  const a = rows.find(r => r.width === w && r.state === 'after')
  if (b.injected !== 5) fail.push(`${w}: the injection put ${b.injected} elements back, not 5`)
  if (a.injected !== 0) fail.push(`${w}: ${a.injected} injected elements survived into the after state`)
  if (b.bytes < 3000 || a.bytes < 3000) fail.push(`${w}: a capture is under 3KB and is probably blank`)
  if (b.windowPx === a.windowPx) fail.push(`${w}: the window did not move, so the injection changed nothing measurable`)
}
console.log('')
if (fail.length) { for (const f of fail) console.log('  CALIBRATION FAILED  ' + f); }
else console.log('  CALIBRATION  5 injected in before, 0 in after, no blank capture, the window moved at both widths')
writeFileSync(`${OUT}measurements.json`, JSON.stringify(rows, null, 2))
console.log(`\n  captures and measurements: ${OUT}\n`)
await browser.close()
process.exit(fail.length ? 1 : 0)
