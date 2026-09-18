// ── THE CONTACT VISIBILITY CHECK ────────────────────────────────────────
//
// W8b made the SHARED edit bar sticky, and the Contact does not use it: ruling
// A1 moved its Save and Discard into the header row. So the question W1 asks -
// can a person with unsaved changes see how to save them - has to be asked of
// the Contact separately, and this asks it.
//
// The claim is about a PERSON's viewport: with a dirty field on a long record
// at 1440, are the header's Save and Discard on screen at FULL scroll? A
// property of the controls would not answer it (Verification 4's mechanism
// clause), so this scrolls the surface's own scroller to its end and reads the
// controls' rects against the viewport.
//
// It is a MEASUREMENT FIRST. The ruling is conditional: if they are on screen,
// the number is recorded and nothing changes.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-contact-visibility.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-contact-visibility.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-CV-${Date.now()}`
const C = '#view-contact-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const evidence = {}
let opp
try {
  opp = await freshOpportunity(TAG)
  // A LONG record: notes are what make a contact long in real use, so the
  // length is built the way the surface gets it rather than by inflating one
  // field (Verification 47).
  const rev = (await call('GET', `/contacts/${opp.contactId}`)).data.latest_revision_number
  const notes = Array.from({ length: 40 }, (_, i) => ({
    at: new Date(Date.now() - i * 86400000).toISOString(),
    by: 'john+test@terminustechnologies.io',
    text: `Note ${40 - i}: a call summary of the kind this surface accumulates, long enough to occupy a row.`,
  }))
  const w = await call('PATCH', `/contacts/${opp.contactId}`, { payload: { notes }, expected_revision: rev })
  check(w.status < 300, 'the record is made long the way the surface makes one long', `${w.status}, ${notes.length} notes`)

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('contact-detail', id), opp.contactId)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-add-note-btn"]`), { timeout: 30000 }, C)
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })
    // Show every note, so the page is as long as this record can make it.
    await page.evaluate((c) => document.querySelector(`${c} [data-testid="cd-notes-show-all"]`)?.click(), C)
    await new Promise((r) => setTimeout(r, 300))

    // Dirty a field, which is what brings Save and Discard out at all.
    const field = await page.evaluate((c) => document.querySelector(`${c} [data-testid^="display-"]`)?.getAttribute('data-testid') ?? null, C)
    check(!!field, 'there is an editable row to dirty', String(field))
    await page.click(`${C} [data-testid="${field}"]`)
    const name = String(field).replace('display-', '')
    await page.waitForFunction((c, n) => document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] textarea`), { timeout: 10000 }, C, name)
    await page.type(`${C} [data-field="${name}"] input, ${C} [data-field="${name}"] textarea`, 'x')
    await page.click(`${C} [data-testid="cd-header"]`)
    await page.waitForFunction((c) => !!document.querySelector(`${c} [data-testid="save-all"]`), { timeout: 10000 }, C)

    const m = await page.evaluate((c) => {
      const save = document.querySelector(`${c} [data-testid="save-all"]`)
      const discard = document.querySelector(`${c} [data-testid="discard-all"]`)
      if (!save) return { present: false }
      // The surface's own scroller, not the window: this estate scrolls an
      // inner container and scrolling the window would move nothing.
      let el = save.parentElement
      let scroller = document.scrollingElement
      while (el && el !== document.body) {
        const cs = getComputedStyle(el)
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 40) { scroller = el; break }
        el = el.parentElement
      }
      scroller.scrollTop = scroller.scrollHeight
      const s = save.getBoundingClientRect()
      const d = discard?.getBoundingClientRect()
      const onScreen = (r) => !!r && r.bottom > 0 && r.top < innerHeight && r.height > 0
      return {
        present: true,
        scrollable: Math.round(scroller.scrollHeight - scroller.clientHeight),
        scrolled: Math.round(scroller.scrollTop),
        save: { top: Math.round(s.top), bottom: Math.round(s.bottom) },
        discard: d ? { top: Math.round(d.top), bottom: Math.round(d.bottom) } : null,
        vh: innerHeight,
        saveOnScreen: onScreen(s), discardOnScreen: onScreen(d),
        headerPosition: getComputedStyle(save.closest('[data-testid="cd-header"]') ?? save).position,
      }
    }, C)
    evidence.contact = m
    console.log(`\n=== the Contact header at full scroll, 1440x900 ===\n  ${JSON.stringify(m, null, 1)}`)
    check(m.present, 'a change exists, so Save and Discard are rendered at all')
    check(m.scrollable > 400, 'the record is genuinely long, so the question is not vacuous',
      `${m.scrollable}px of scroll`)
    // THE QUESTION ITSELF. Reported either way: the ruling is conditional, so
    // this check states the answer rather than demanding one.
    check(m.saveOnScreen && m.discardOnScreen,
      'THE ANSWER: Save and Discard are on screen at full scroll',
      JSON.stringify({ save: m.save, discard: m.discard, viewport: m.vh, scrolled: m.scrolled }))
    await page.screenshot({ path: `${OUT}contact-full-scroll-1440.png` })
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length}, remaining ${t.remaining}`)
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
