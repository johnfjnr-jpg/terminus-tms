// LEADS CARD CLEANUP, Phase 0: TARGETED CONFIRMATION.
//
// A prior Phase 0 measured these. This re-reads them on the tree the build
// will start from, because "it was true yesterday" is not a measurement of
// today - and it costs one run.
//
// No lead fixture is needed: the New Lead grid is a blank form.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-confirm.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/lcc/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }

const PRIOR = { inputWidth: 110, cellWidth: 118, contentWidth: 370, columns: 15,
  modalWidth: 1480, scrolls: false, cellBorder: '' }
const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForSelector('#btn-new-contact', { timeout: 20000 })
  await page.click('#btn-new-contact')
  await page.waitForSelector('[data-testid="new-lead-grid"]', { timeout: 15000 })
  const LONG = 'Wolfeschlegelsteinhausenbergerdorff Holdings International'
  for (let i = 0; i < 6; i++) {
    const sel = `[data-testid="nlg-name-${i}"]`
    if (!await page.$(sel)) break
    await page.click(sel); await page.keyboard.type(i === 0 ? LONG : `Row ${i}`)
  }
  const now = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="new-lead-grid"]')
    const modal = g.closest('.modal-panel-batch')
    const scroll = g.querySelector('.new-lead-scroll')
    const input = g.querySelector('[data-testid="nlg-name-0"]')
    const cell = input.closest('td')
    const th = g.querySelector('th')
    const w = (e) => Math.round(e.getBoundingClientRect().width)
    return {
      columns: g.querySelectorAll('th').length,
      modalWidth: w(modal),
      cellBorder: getComputedStyle(cell).borderBottomWidth === '0px' ? '' : getComputedStyle(cell).borderBottom,
      thBorderAlpha: getComputedStyle(th).borderBottomColor,
      inputBorderAlpha: getComputedStyle(input).borderBottomColor,
      inputWidth: w(input), cellWidth: w(cell), contentWidth: input.scrollWidth,
      cropped: input.scrollWidth > input.clientWidth,
      scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
      scrolls: scroll.scrollHeight > scroll.clientHeight,
      scrollMaxHeight: getComputedStyle(scroll).maxHeight,
      scrollFlex: getComputedStyle(scroll).flex,
      modalMaxHeight: getComputedStyle(modal).maxHeight,
      rows: g.querySelectorAll('tbody tr').length,
    }
  })
  console.log('=== R2 confirmation, against the prior Phase 0 ===')
  for (const [k, v] of Object.entries(now)) {
    const p = PRIOR[k]
    const mark = p === undefined ? '     ' : (String(p) === String(v) ? 'SAME ' : 'MOVED')
    console.log(`  ${mark} ${k.padEnd(18)} ${JSON.stringify(v)}${p !== undefined && String(p) !== String(v) ? `   (was ${JSON.stringify(p)})` : ''}`)
  }
  // EVERY LINE TREATMENT IN THE TABLE, read per side. The prior Phase 0
  // asked for the `border` SHORTHAND, which computes to "" whenever the four
  // sides differ - and reported that as "the cells have NO border". A cell
  // with a bottom border and no sides reads exactly like a cell with none.
  const lines = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="new-lead-grid"]')
    const one = (label, el) => { if (!el) return [label, null]
      const s = getComputedStyle(el)
      return [label, { top: s.borderTopWidth + ' ' + s.borderTopColor,
        bottom: s.borderBottomWidth + ' ' + s.borderBottomColor,
        right: s.borderRightWidth + ' ' + s.borderRightColor }] }
    const input = g.querySelector('[data-testid="nlg-name-0"]')
    const sel = g.querySelector('select')
    return Object.fromEntries([
      one('th', g.querySelector('th')),
      one('td', input.closest('td')),
      one('tr', input.closest('tr')),
      one('input', input),
      one('select', sel),
    ])
  })
  console.log('\n  EVERY LINE TREATMENT, per side:')
  for (const [k, v] of Object.entries(lines))
    console.log(`    ${k.padEnd(7)} bottom ${v?.bottom ?? '-'}   right ${v?.right ?? '-'}`)
  const distinct = new Set(Object.values(lines).filter(Boolean)
    .map((v) => v.bottom).filter((b) => !b.startsWith('0px')))
  console.log(`    DISTINCT non-zero bottom treatments: ${distinct.size}  ${[...distinct].join('  |  ')}`)

  console.log('\n  THE THREE CLAIMS:')
  console.log(`    the cells have NO border:            ${now.cellBorder === ''}`)
  console.log(`    header and input borders DIFFER:     ${now.thBorderAlpha !== now.inputBorderAlpha}   (${now.thBorderAlpha} vs ${now.inputBorderAlpha})`)
  console.log(`    the value is CROPPED:                ${now.cropped}   ${now.contentWidth}px of content in a ${now.inputWidth}px input`)
  console.log(`    it does NOT scroll:                  ${!now.scrolls}   scrollHeight ${now.scrollHeight} == clientHeight ${now.clientHeight}`)
  console.log(`    and the cause: the container is uncapped and flexes to the modal`)
  console.log(`      .new-lead-scroll max-height ${now.scrollMaxHeight}, flex ${now.scrollFlex}; modal max-height ${now.modalMaxHeight}`)
  await page.screenshot({ path: `${OUT}lcc-p0-grid-before.png` })

  // What SAVE does today, measured rather than cited.
  const saveable = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="nlg-save"]')
    return b ? !b.disabled : null
  })
  console.log(`\n  Save is enabled with rows typed: ${saveable}`)
  console.log('  (the save path itself is not exercised here: it would create live leads)')
} finally { await browser.close() }
