// ── V4: DOES THE NOTE SAVE ACTUALLY LOSE THE FIELD EDIT? ────────────────
//
// The dialogue exists because of NotesHistory's own note: "the add ends in a
// reload, which would discard another open field." That is the claim, and it
// is the one thing nobody has measured.
//
// Reading `useFieldRows` says drafts are dropped ONLY when the SUBJECT changes,
// and a reload of the same record does not change it - so the loss the dialogue
// warns about may not happen at all. Reading is not evidence (build discipline
// 2), so this drives it: dirty a field, add a note, accept the dialogue, and
// look for the edit afterwards.
//
// UNWIRED. Run: TBSP_RUN=<label> ... node --env-file=.env scripts/walk3/probe-v4-loss.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('walk3/probe-v4-loss.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/walk-3/${RUN}/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `W3-V4L-${Date.now()}`
const C = '#view-contact-detail'
const TYPED = 'ZZTOPCITY'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const evidence = {}
let opp
try {
  opp = await freshOpportunity(TAG)
  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('contact-detail', id), opp.contactId)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-add-note-btn"]`), { timeout: 30000 }, C)
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })

    // Dirty a text field with a value nothing else could produce.
    const f = await page.evaluate((c) => document.querySelector(`${c} [data-testid^="display-"]`)?.getAttribute('data-testid') ?? null, C)
    const name = String(f).replace('display-', '')
    await page.click(`${C} [data-testid="${f}"]`)
    await page.waitForFunction((c, n) => document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] textarea`), { timeout: 10000 }, C, name)
    await page.type(`${C} [data-field="${name}"] input, ${C} [data-field="${name}"] textarea`, TYPED)
    await page.click(`${C} [data-testid="cd-header"]`)
    await new Promise((r) => setTimeout(r, 250))
    const before = await page.evaluate((c) => document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.textContent?.trim() ?? null, C)
    check(/1 unsaved/.test(before ?? ''), 'a field is genuinely dirty before the note', String(before))

    // Add a note. The dialogue is expected here - that IS the finding.
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-new-note-input"]`), { timeout: 10000 }, C)
    await page.type(`${C} [data-testid="cd-new-note-input"]`, 'a note added while a field was dirty')
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await new Promise((r) => setTimeout(r, 500))
    const raised = await page.evaluate(() => {
      const el = document.getElementById('discard-confirm-modal')
      const cs = el ? getComputedStyle(el) : null
      return !!el && cs.display !== 'none' && !el.hidden
    })
    check(raised, 'the dialogue is raised, which is the finding being measured')
    await page.screenshot({ path: `${OUT}v4-dialogue-1440.png` })

    // ACCEPT IT. "Discard" is the button that proceeds with the note save, and
    // it is named for the loss the dialogue claims is about to happen.
    await page.evaluate(() => {
      const el = document.getElementById('discard-confirm-modal')
      const btn = [...el.querySelectorAll('button')].find((b) => /discard/i.test(b.textContent ?? ''))
      btn.click()
    })
    await new Promise((r) => setTimeout(r, 1200))
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 20000 })

    // THE MEASUREMENT. Is the field edit still there after the note saved?
    const after = await page.evaluate((c, n, typed) => {
      const el = document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] textarea`)
      const display = document.querySelector(`${c} [data-testid="display-${n}"]`)
      return {
        dirty: document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.textContent?.trim() ?? null,
        editorValue: el ? el.value : null,
        displayText: display ? display.textContent.trim() : null,
        typedSurvives: (el ? el.value : (display?.textContent ?? '')).includes(typed),
      }
    }, C, name, TYPED)
    evidence.afterAccepting = { field: name, before, after }
    console.log(`\n=== after accepting the dialogue and saving the note ===\n  ${JSON.stringify(after)}`)

    // THE CLAIM THE DIALOGUE MAKES. If the edit survives, the dialogue is
    // warning about a loss that does not happen.
    check(after.typedSurvives === false || after.typedSurvives === true,
      'the state after the save was readable', JSON.stringify(after.typedSurvives))
    console.log(after.typedSurvives
      ? '\n  >>> THE EDIT SURVIVED. The dialogue warns about a loss that does not occur.'
      : '\n  >>> THE EDIT WAS LOST. The dialogue is honest and the fix must PRESERVE the edit.')
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  const t = await tearDown(TAG); console.log(`teardown: removed ${t.removed.length}, remaining ${t.remaining}`)
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
