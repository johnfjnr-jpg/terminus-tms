// ── V4: DOES SAVING A NOTE RAISE THE DISCARD MODAL? ─────────────────────
//
// John's finding, on a fresh record. This REPRODUCES it before anything is
// fixed, because "reproduce, then name the mechanism" is the instruction and
// because a fix built against a guessed cause is a fix nobody can check.
//
// The claim is about what a person meets: type a note, press Save, and see
// whether a dialogue asking to DISCARD appears. So the probe reads the modal,
// not a flag.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/walk3/probe-v4.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('walk3/probe-v4.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBUNITS_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/walk-3/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `W3-V4-${Date.now()}`
const C = '#view-contact-detail'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const evidence = {}
let opp
try {
  opp = await freshOpportunity(TAG)
  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    const net = []
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), req: r, done: false }) })
    page.on('requestfinished', (r) => { const e = net.find((n) => n.req === r); if (e) { e.status = r.response()?.status() ?? null; e.done = true } })
    await page.setViewport({ width: 1440, height: 1000 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('contact-detail', id), opp.contactId)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-add-note-btn"]`), { timeout: 30000 }, C)
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 30000 })

    // The discard dialogue, read as a PERSON meets it: on screen and asking.
    const modal = () => page.evaluate(() => {
      const el = document.getElementById('discard-confirm-modal')
      if (!el) return { present: false }
      const cs = getComputedStyle(el)
      return {
        present: true,
        shown: cs.display !== 'none' && !el.hidden && cs.visibility !== 'hidden',
        text: (el.innerText ?? '').trim().slice(0, 120),
      }
    })
    // Nothing has been touched, so nothing may be dirty. Asserted so the
    // reproduction below cannot be explained by a stray edit of the probe's own.
    const clean = await page.evaluate((c) => ({
      dirtyIndicator: document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.hidden ?? null,
      saveDisabled: document.querySelector(`${c} [data-testid="save-all"]`)?.disabled ?? null,
    }), C)
    evidence.beforeAnything = { ...clean, modal: await modal() }
    console.log(`\n=== a fresh record, nothing touched ===\n  ${JSON.stringify(evidence.beforeAnything)}`)
    check(clean.saveDisabled === true, 'the record is genuinely clean before the note is typed',
      JSON.stringify(clean))

    // Type a note and press Save. This is the whole of John's gesture.
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await page.waitForFunction((c) => document.querySelector(`${c} [data-testid="cd-new-note-input"]`), { timeout: 10000 }, C)
    await page.type(`${C} [data-testid="cd-new-note-input"]`, 'a first note on a fresh record')
    const afterTyping = await page.evaluate((c) => ({
      dirtyIndicatorHidden: document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.hidden ?? null,
      saveDisabled: document.querySelector(`${c} [data-testid="save-all"]`)?.disabled ?? null,
    }), C)
    evidence.afterTyping = afterTyping
    console.log(`  after typing the note: ${JSON.stringify(afterTyping)}`)

    const mark = net.length
    await page.click(`${C} [data-testid="cd-add-note-btn"]`)
    await new Promise((r) => setTimeout(r, 600))
    const m = await modal()
    const wrote = net.slice(mark).find((n) => n.method === 'PATCH' && /\/api\/contacts\/[^/]+$/.test(n.url))
    evidence.onSave = { modal: m, patch: wrote ? { status: wrote.status ?? null } : null }
    console.log(`\n=== pressing Save on the note ===\n  ${JSON.stringify(evidence.onSave)}`)
    await page.screenshot({ path: `${OUT}v4-on-save-1440.png` })

    // THE CLAIM. A save must never raise a dialogue that threatens to discard.
    check(!m.shown, 'V4: saving a note does NOT raise the discard dialogue',
      m.shown ? `the dialogue is on screen: "${m.text}"` : 'no dialogue')
    // And it must actually save, or "no dialogue" is satisfied by nothing
    // happening at all (Verification 14).
    const stored = must(await db.from('record_revisions').select('payload')
      .eq('record_id', opp.contactId).order('revision_number', { ascending: false }).limit(1), 'payload')[0]?.payload ?? {}
    const notes = stored.notes ?? []
    check(notes.some((n) => String(n.text ?? '').includes('a first note on a fresh record')),
      'V4: and the note is in the database, so "no dialogue" is not "nothing happened"',
      `${notes.length} note(s), patch ${wrote?.status ?? 'none'}`)
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
