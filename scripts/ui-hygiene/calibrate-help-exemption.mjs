// Calibrating the help exemption BOTH WAYS, structurally.
//
// The claim is not "help-dots survive". It is that the door distinguishes a
// thing DECLARED AS CONTENT from a thing declared as a control, whatever it is
// called. So the test injects two spans that are identical in every respect
// except their role, into the live page, and lets the real door act on them.
//
// A class-name exemption would pass the first and fail the second, which is the
// .btn-text defect this replaced.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('calibrate-help-exemption.mjs')
import { readFileSync } from 'fs'

const session = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const NOT_MINE = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((rid) => navigate('opportunity-detail', rid), NOT_MINE)
await page.waitForFunction((want) => {
  const v = document.getElementById('view-opportunity-detail')
  if (!v || v.classList.contains('is-loading')) return false
  if (!document.querySelector(`[data-record-id="${want}"]`)) return false
  const n = v.querySelectorAll('input, textarea, select').length
  window.__s = (window.__s && window.__s.n === n) ? { n, h: window.__s.h + 1 } : { n, h: 1 }
  return window.__s.h >= 4
}, { polling: 300, timeout: 25000 }, NOT_MINE)

const out = await page.evaluate(() => {
  // SCOPED TO THE VIEW UNDER TEST. A document-wide query for
  // `.detail-tab-panel:not([hidden])` also matches panels in OTHER views,
  // which are display:none rather than [hidden], so the injected spans landed
  // outside #view-opportunity-detail and the door never saw them. The failure
  // read as "the rule does not neutralise a role=button span", which is a
  // product claim, and it was the harness.
  const view = document.getElementById('view-opportunity-detail')
  const panel = view.querySelector('.detail-tab-panel:not([hidden])') ?? view
  window.__panelId = panel.id || '(view root)'
  window.__inView = view.contains(panel)
  const mk = (id, role) => {
    const el = document.createElement('span')
    el.id = id
    el.setAttribute('role', role)
    el.setAttribute('tabindex', '0')
    el.className = 'probe-injected'      // deliberately NOT help-dot
    el.textContent = '?'
    panel.appendChild(el)
    return el
  }
  // Identical but for the role. Inserting them is a childList mutation, which
  // is what the door observes, so the real sweep runs on them.
  mk('probe-role-note', 'note')
  mk('probe-role-button', 'button')
  return new Promise((resolve) => setTimeout(() => {
    // DIAGNOSTIC: did the observer fire at all? Run the sweep by hand and
    // report both states, so "the rule is wrong" and "the observer did not
    // fire" cannot be confused.
    const before = {
      note: document.getElementById('probe-role-note')?.getAttribute('tabindex'),
      button: document.getElementById('probe-role-button')?.getAttribute('tabindex'),
    }
    try { window.applyReadOnlyControls?.('view-opportunity-detail', true) } catch (e) { window.__err = String(e) }
    const after = {
      note: document.getElementById('probe-role-note')?.getAttribute('tabindex'),
      button: document.getElementById('probe-role-button')?.getAttribute('tabindex'),
    }
    window.__diag = { panel: window.__panelId, inView: window.__inView, before, after, hasFn: typeof window.applyReadOnlyControls, err: window.__err ?? null }
    const read = (id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const cs = getComputedStyle(el)
      return { ti: el.getAttribute('tabindex'), inert: el.classList.contains('is-inert-action'),
        ariaDisabled: el.getAttribute('aria-disabled'), pe: cs.pointerEvents }
    }
    resolve({ note: read('probe-role-note'), button: read('probe-role-button'), diag: window.__diag })
  }, 900))
})
await browser.close()

const note = out.note, btn = out.button
console.log('\n  THE SAME SPAN, DIFFERING ONLY IN ROLE, under the door on an unowned record\n')
console.log(`  role="note"    tabindex=${note?.ti}  inert=${note?.inert}  pointer-events=${note?.pe}`)
console.log(`  role="button"  tabindex=${btn?.ti}  inert=${btn?.inert}  pointer-events=${btn?.pe}`)

const noteAlive = note && note.ti === '0' && !note.inert
const buttonDead = btn && btn.ti === '-1' && btn.inert
console.log(`\n  diagnostic: ${JSON.stringify(out.diag)}`)
console.log(`\n  content stays alive:      ${noteAlive}`)
console.log(`  control is neutralised:   ${buttonDead}`)
console.log(`  the door distinguishes them by ROLE, not by class name: ${noteAlive && buttonDead}`)
process.exit(noteAlive && buttonDead ? 0 : 1)
