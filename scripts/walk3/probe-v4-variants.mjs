// ── V4: WHICH SEQUENCE ACTUALLY RAISES IT? ──────────────────────────────
//
// The plain reproduction came back CLEAN: on a fresh record with an untouched
// form, saving a note does not raise the dialogue and the note lands. So the
// trigger is conditional, and this finds which condition - because a fix built
// against a guessed cause is a fix nobody can check, and "could not reproduce"
// is not an answer while sequences remain untried.
//
// Each variant runs on ITS OWN fixture. Two claims sharing one record is how a
// probe ends up measuring the state a previous claim left behind
// (Verification 7's fixture clause).
//
// UNWIRED. Run: TBSP_RUN=<label> ... node --env-file=.env scripts/walk3/probe-v4-variants.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('walk3/probe-v4-variants.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/walk-3/${RUN}/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const C = '#view-contact-detail'
const results = []
const evidence = {}
const tags = []

const puppeteerLaunch = () => puppeteer.launch({ headless: 'new' })

async function variant(label, drive) {
  const tag = `W3-V4V-${Date.now()}-${label.replace(/[^a-z0-9]+/gi, '').slice(0, 8)}`
  tags.push(tag)
  const opp = await freshOpportunity(tag)
  const browser = await puppeteerLaunch()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1000 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('contact-detail', id), opp.contactId)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-add-note-btn"]`), { timeout: 30000 }, C)
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })
    await drive(page)
    // Open the note box, type, and press Save.
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-new-note-input"]`), { timeout: 10000 }, C)
    await page.type(`${C} [data-testid="cd-new-note-input"]`, `note for ${label}`)
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await new Promise((r) => setTimeout(r, 600))
    const m = await page.evaluate((c) => {
      const el = document.getElementById('discard-confirm-modal')
      const cs = el ? getComputedStyle(el) : null
      return {
        modalShown: !!el && cs.display !== 'none' && !el.hidden && cs.visibility !== 'hidden',
        dirtyHidden: document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.hidden ?? null,
        dirtyText: document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.textContent?.trim() ?? null,
      }
    }, C)
    evidence[label] = m
    results.push({ label, ...m })
    console.log(`  ${m.modalShown ? 'RAISES ' : 'clean   '} ${label.padEnd(46)} ${JSON.stringify(m)}`)
    if (m.modalShown) await page.screenshot({ path: `${OUT}v4-${label.replace(/[^a-z0-9]+/gi, '-')}.png` })
  } finally { await browser.close() }
}

try {
  // 1. A field row OPENED and not typed in. A person clicks a field to read it.
  await variant('a field row opened and not typed in', async (page) => {
    const f = await page.evaluate((c) => document.querySelector(`${c} [data-testid^="display-"]`)?.getAttribute('data-testid') ?? null, C)
    await page.click(`${C} [data-testid="${f}"]`)
    await new Promise((r) => setTimeout(r, 250))
  })

  // 2. A field TYPED IN and then reverted with Escape (ruling A3).
  await variant('a field typed in then reverted with Escape', async (page) => {
    const f = await page.evaluate((c) => document.querySelector(`${c} [data-testid^="display-"]`)?.getAttribute('data-testid') ?? null, C)
    await page.click(`${C} [data-testid="${f}"]`)
    const name = String(f).replace('display-', '')
    await page.waitForFunction((c, n) => document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] textarea`), { timeout: 10000 }, C, name)
    await page.type(`${C} [data-field="${name}"] input, ${C} [data-field="${name}"] textarea`, 'zz')
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 250))
  })

  // 3. A SECOND note, after one has already been saved.
  await variant('a second note after one was already saved', async (page) => {
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-new-note-input"]`), { timeout: 10000 }, C)
    await page.type(`${C} [data-testid="cd-new-note-input"]`, 'the first note')
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await new Promise((r) => setTimeout(r, 900))
  })

  // 4. A field genuinely dirty, which is the case the guard was WRITTEN for.
  await variant('a field genuinely left dirty (the designed case)', async (page) => {
    const f = await page.evaluate((c) => document.querySelector(`${c} [data-testid^="display-"]`)?.getAttribute('data-testid') ?? null, C)
    await page.click(`${C} [data-testid="${f}"]`)
    const name = String(f).replace('display-', '')
    await page.waitForFunction((c, n) => document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] textarea`), { timeout: 10000 }, C, name)
    await page.type(`${C} [data-field="${name}"] input, ${C} [data-field="${name}"] textarea`, 'zz')
    await page.click(`${C} [data-testid="cd-header"]`)
    await new Promise((r) => setTimeout(r, 250))
  })
} catch (e) {
  console.log(`  FAIL  the variants did not complete: ${e.message}`)
  results.push({ label: 'the variants completed', modalShown: null })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  for (const t of tags) { const r = await tearDown(t); console.log(`teardown ${t}: removed ${r.removed.length}, remaining ${r.remaining}`) }
}
const raising = results.filter((r) => r.modalShown === true)
console.log(`\n${raising.length} of ${results.length} sequences raise the dialogue: ${raising.map((r) => r.label).join('; ') || 'none'}`)
