// R9: the allowlist enumeration is replaced by the census instrument.
//
// THE CLAIM IS ABOUT WHAT THE INSTRUMENT CAN SEE, so the calibration compares
// the two enumerations on the SAME page against the SAME injected control.
//
// The old allowlist was `input, textarea, select` plus four class names. A
// widget that is none of those - a div declaring role="button" with its own
// handler, which is exactly the ring-radio's shape - is invisible to it and
// must be visible to the replacement.
//
// Injected into the live page rather than reasoned about, and removed again.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('calibrate-enumeration.mjs')
import { readFileSync } from 'fs'
import { enumerateControlsInPage } from '../lib/enumerate-controls.mjs'

const session = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const ID = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const OLD_ALLOWLIST = 'input, textarea, select, .ref-field-display, .cd-name-display, .deal-toggle, [role="switch"]'

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((rid) => navigate('opportunity-detail', rid), ID)
await page.waitForFunction((want) => {
  const v = document.getElementById('view-opportunity-detail')
  if (!v || v.classList.contains('is-loading')) return false
  if (!document.querySelector(`[data-record-id="${want}"]`)) return false
  const n = v.querySelectorAll('input, textarea, select').length
  window.__s = (window.__s && window.__s.n === n) ? { n, h: window.__s.h + 1 } : { n, h: 1 }
  return window.__s.h >= 4
}, { polling: 300, timeout: 25000 }, ID)

await page.evaluate((e) => { window.__enum = new Function('return ' + e)() },
  enumerateControlsInPage.toString())

const result = await page.evaluate((allowlist) => {
  const view = document.getElementById('view-opportunity-detail')
  const panel = view.querySelector('.detail-tab-panel:not([hidden])') ?? view
  const count = (sel) => view.querySelectorAll(sel).length
  const before = { allow: count(allowlist), census: window.__enum(view.id).length }

  // THE WIDGET THE ALLOWLIST CANNOT SEE: a div that declares itself a button
  // and carries its own handler. Not an input, not one of the four classes.
  const el = document.createElement('div')
  el.id = 'probe-injected-widget'
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')
  el.setAttribute('onclick', 'void 0')
  el.textContent = 'injected'
  panel.appendChild(el)

  const after = { allow: count(allowlist), census: window.__enum(view.id).length }
  const foundByCensus = window.__enum(view.id).some((r) => r.id === 'probe-injected-widget')
  const foundByAllowlist = [...view.querySelectorAll(allowlist)].some((n) => n.id === 'probe-injected-widget')
  el.remove()
  const restored = { allow: count(allowlist), census: window.__enum(view.id).length }
  return { before, after, restored, foundByCensus, foundByAllowlist }
}, OLD_ALLOWLIST)

await browser.close()

console.log('\n  THE SAME PAGE, THE SAME INJECTED WIDGET, TWO ENUMERATIONS\n')
console.log(`  old allowlist   before ${result.before.allow}  with widget ${result.after.allow}  ` +
  `-> saw it: ${result.foundByAllowlist}`)
console.log(`  census          before ${result.before.census}  with widget ${result.after.census}  ` +
  `-> saw it: ${result.foundByCensus}`)
console.log(`\n  the replacement enumerates ${result.before.census - result.before.allow} more controls on this page`)
console.log(`  page restored: allowlist ${result.restored.allow}, census ${result.restored.census}`)

const caught = result.foundByCensus && !result.foundByAllowlist
const restored = result.restored.census === result.before.census
console.log(`\n  CAUGHT by the replacement and MISSED by the allowlist: ${caught}`)
console.log(`  page restored to its pre-injection state:                ${restored}`)
process.exit(caught && restored ? 0 : 1)
