// ── V4, THE CLASS: WHICH OF THE FOUR PROMPTS IS HONEST? ─────────────────
//
// Build discipline 8: fix the class, not the instance the failure named. Four
// controls on the Contact raise the same discard prompt from the same `dirty`
// flag - add a note, link an account, save-and-park, and Back. The note's
// premise was measured FALSE. This asks the same question of the other three
// rather than reasoning from the first.
//
// The question, per control: with a field genuinely dirty, does accepting the
// prompt actually lose the edit?
//
// UNWIRED. Run: TBSP_RUN=<label> ... node --env-file=.env scripts/walk3/probe-v4-siblings.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('walk3/probe-v4-siblings.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/walk-3/${RUN}/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const C = '#view-contact-detail'
const TYPED = 'ZZTOPCITY'
const rows = []
const tags = []

async function measure(label, act) {
  const tag = `W3-SIB-${Date.now()}-${label.replace(/[^a-z0-9]+/gi, '').slice(0, 6)}`
  tags.push(tag)
  const opp = await freshOpportunity(tag)
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

    const f = await page.evaluate((c) => document.querySelector(`${c} [data-testid^="display-"]`)?.getAttribute('data-testid') ?? null, C)
    const name = String(f).replace('display-', '')
    await page.click(`${C} [data-testid="${f}"]`)
    await page.waitForFunction((c, n) => document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] textarea`), { timeout: 10000 }, C, name)
    await page.type(`${C} [data-field="${name}"] input, ${C} [data-field="${name}"] textarea`, TYPED)
    await page.click(`${C} [data-testid="cd-header"]`)
    await new Promise((r) => setTimeout(r, 250))

    await act(page)
    await new Promise((r) => setTimeout(r, 500))
    const raised = await page.evaluate(() => {
      const el = document.getElementById('discard-confirm-modal')
      const cs = el ? getComputedStyle(el) : null
      return !!el && cs.display !== 'none' && !el.hidden
    })
    let survives = null
    if (raised) {
      await page.evaluate(() => {
        const el = document.getElementById('discard-confirm-modal')
        const btn = [...el.querySelectorAll('button')].find((b) => /discard/i.test(b.textContent ?? ''))
        btn.click()
      })
      await new Promise((r) => setTimeout(r, 1500))
      survives = await page.evaluate((c, n, typed) => {
        const el = document.querySelector(`${c} [data-field="${n}"] input, ${c} [data-field="${n}"] textarea`)
        const display = document.querySelector(`${c} [data-testid="display-${n}"]`)
        const onScreen = !!document.querySelector(`${c} [data-testid="cd-add-note-btn"]`)
          && getComputedStyle(document.querySelector(c)).display !== 'none'
        if (!onScreen) return 'left the surface'
        return (el ? el.value : (display?.textContent ?? '')).includes(typed)
      }, C, name, TYPED)
    }
    rows.push({ label, raised, survives })
    console.log(`  ${String(raised).padEnd(5)}  ${String(survives).padEnd(16)}  ${label}`)
  } finally { await browser.close() }
}

try {
  console.log('  raised survives          control')
  await measure('add a note', async (page) => {
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-new-note-input"]`), { timeout: 10000 }, C)
    await page.type(`${C} [data-testid="cd-new-note-input"]`, 'a note')
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
  })
  await measure('link an account', async (page) => {
    const opened = await page.evaluate((c) => {
      const b = [...document.querySelectorAll(`${c} button`)].find((x) => /link to account/i.test(x.textContent ?? ''))
      if (b) { b.click(); return true } return false
    }, C)
    if (!opened) throw new Error('no Link to Account control')
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate((c) => {
      const sel = document.querySelector(`${c} select`)
      if (sel && sel.options.length > 1) {
        sel.value = [...sel.options].find((o) => o.value)?.value
        sel.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const b = [...document.querySelectorAll(`${c} button`)].find((x) => /^link$/i.test((x.textContent ?? '').trim()))
      b?.click()
    }, C)
  })
  await measure('Back', async (page) => {
    await page.click(`${C} [data-testid="cd-back"]`)
  })
} catch (e) {
  console.log(`  FAIL  the siblings sweep did not complete: ${e.message}`)
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(rows, null, 2))
  for (const t of tags) { const r = await tearDown(t); console.log(`teardown ${t}: removed ${r.removed.length}, remaining ${r.remaining}`) }
}
console.log('\nA prompt is HONEST when the edit does not survive accepting it.')
for (const r of rows) {
  const verdict = r.raised === false ? 'never raised'
    : r.survives === true ? 'FALSE PREMISE: the edit survives'
    : r.survives === 'left the surface' ? 'honest: the surface is gone'
    : 'honest: the edit is lost'
  console.log(`  ${r.label.padEnd(18)} ${verdict}`)
}
