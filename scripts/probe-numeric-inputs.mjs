// ── EVERY NUMERIC INPUT REFUSES TEXT, BY TYPE NOT BY OPT-IN ──────────────
//
// U1, 2026-09-04, and it is a RECURRING report - which is the finding. The
// guard was real, correct and delegated, and OPT-IN by class: index.html
// carries 31 inputs declared numeric or decimal and NOT ONE carried .int-only,
// so the guard covered exactly the two milestone-month fields whose author
// remembered it. Each previous report fixed the fields it named.
//
// This probe types letters into EVERY numeric input the page actually renders,
// so a new field cannot ship without the constraint and cannot ship without
// being covered here either.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const puppeteer = await loadPuppeteer('numeric-inputs')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const { oppId } = await freshOpportunity(process.argv[2] ?? 'R41NUM')

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
await page.waitForFunction(() => {
  const p = document.getElementById('opp-tab-commercial')
  return p && !p.classList.contains('hidden') && getComputedStyle(p).visibility === 'visible'
}, { timeout: 20000 })
await new Promise((r) => setTimeout(r, 600))

// Every VISIBLE numeric input on this screen, found the same way the guard
// finds them, so the probe cannot cover a different population than the fix.
const fields = await page.evaluate(() => [...document.querySelectorAll(
  'input[inputmode="numeric"], input[inputmode="decimal"], input.int-only')]
  .filter((el) => el.offsetParent !== null && el.id)
  .map((el) => ({ id: el.id, decimal: el.getAttribute('inputmode') === 'decimal' })))

record('the screen actually renders numeric inputs to test',
  fields.length >= 10, `${fields.length} visible numeric inputs`)

const bad = []
for (const f of fields) {
  const got = await page.evaluate(async (id) => {
    const el = document.getElementById(id)
    el.focus()
    el.value = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
    // Typed one character at a time, as a person does, so the guard is
    // exercised on each keystroke rather than on one paste.
    for (const ch of 'sr1g2') {
      el.value += ch
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return el.value
  }, f.id)
  if (/[^0-9.]/.test(got)) bad.push(`${f.id}="${got}"`)
}
record('NO numeric input accepts letters', bad.length === 0,
  bad.length ? bad.slice(0, 6).join(', ') : `${fields.length} fields, all clean`)

// A DECIMAL FIELD KEEPS ITS POINT. Stripping to digits would turn 1.5 into 15,
// which is a worse correction than the letters it was written to remove.
const dec = fields.find((f) => f.decimal)
if (dec) {
  const got = await page.evaluate((id) => {
    const el = document.getElementById(id)
    el.focus(); el.value = ''
    for (const ch of '1.5x') { el.value += ch; el.dispatchEvent(new Event('input', { bubbles: true })) }
    return el.value
  }, dec.id)
  record('a decimal field keeps ONE point and drops the letter', got === '1.5', `${dec.id}="${got}"`)
} else {
  console.log('SKIP  no decimal-mode field visible on this screen to exercise')
}

// AND AN INTEGER FIELD DOES NOT KEEP A POINT.
const int = fields.find((f) => !f.decimal)
if (int) {
  const got = await page.evaluate((id) => {
    const el = document.getElementById(id)
    el.focus(); el.value = ''
    for (const ch of '1.5') { el.value += ch; el.dispatchEvent(new Event('input', { bubbles: true })) }
    return el.value
  }, int.id)
  record('an integer field drops the point too', got === '15', `${int.id}="${got}"`)
}

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
