// ── DB READ-BACK ON EVERY STORED VALUE THIS ROUND'S CONTROLS TOUCH ──────
//
// M10 says "stored value unchanged, both directions driven and read back", and
// the round says read back on every stored value touched. The controls that
// moved write four keys: `factoringMethod` (M10), `paymentMode` and `structure`
// (M1, M4, M6) and `invoicing` (M7).
//
// DRIVEN THROUGH THE SCREEN, then read from the DATABASE, never from the
// screen that just claimed it. A value read back from the control that wrote
// it is one reader asked twice.
//
// UNWIRED: needs a browser, a live server, a signed-in session, the service key.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('polish/probe-readback.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
mkdirSync(`${ROOT}/.verify/polish/`, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = process.env.C_TAG ?? 'polishrb'
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, recoveryMonths: 12, installResp: 'Terminus Contractor - Per Unit',
  structure: 'twoPhase', paymentMode: 'capex', invoicing: 'annual',
  factoring: { enabled: true, ratePct: 2, termMonths: 36, method: 'straight' },
} })
const stored = async () => {
  const r = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  return { rev: r.revision_number, p: r.payload }
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.setViewport({ width: 1600, height: 1900 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
  await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
      .find((x) => x.textContent.trim() === 'Commercials')
    el?.click()
  })
  await p.waitForFunction(() => /Invoicing/.test(document.body.textContent ?? ''), { timeout: 30000 })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))

  const clickAndSave = async (sel, label) => {
    const before = await stored()
    const hit = await p.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return 'missing'
      el.scrollIntoView({ block: 'center' })
      el.click()
      return 'clicked'
    }, sel)
    if (hit !== 'clicked') { check(false, `${label}: the control ${sel} is not on the screen`); return null }
    // ONE INTERACTION, THEN YIELD, THEN ACT. React re-renders asynchronously,
    // so a save dispatched in the same evaluation reads the previous frame.
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    /* ── THE SECTION'S OWN SAVE, AND THE FIRST VERSION TOOK ANY BUTTON ────
       It searched the whole document for an enabled button whose text matched
       /save/, and the page carries at least six: the assessment save bar, an
       inline buyer contact, an account create, a test bed create. Most are
       INVISIBLE, belonging to other surfaces resident in the same document, so
       the click landed on something that was not this panel and all seven
       checks failed identically at 16s.

       A uniform failure across unrelated claims is the environment or the
       harness, never seven separate defects (Verification 48), and a
       document-wide selector answers for whatever is in the DOM rather than
       for the thing under test (Verification 25).

       The panel gives each section its own save with its own test id. */
    const saved = await p.evaluate(() => {
      const btns = [...document.querySelectorAll('[data-testid^="section-save-"]')]
        .filter((b) => !b.disabled && b.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      if (!btns.length) return `no enabled section save (${document.querySelectorAll('[data-testid^="section-save-"]').length} present)`
      btns[0].scrollIntoView({ block: 'center' })
      btns[0].click()
      return 'saved'
    })
    if (saved !== 'saved') { check(false, `${label}: ${saved}`); return null }
    // WAIT ON THE DATABASE, which is the authority, rather than on the screen.
    for (let i = 0; i < 40; i++) {
      await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
      const now = await stored()
      if (now.rev > before.rev) return { before, after: now }
    }
    check(false, `${label}: no new revision landed within 16s`)
    return null
  }

  console.log('\n── M10: the repayment method, driven BOTH ways ──')
  let r = await clickAndSave('[data-testid="deal-method-toggle"]', 'method to declining')
  if (r) {
    check(r.after.p.factoring?.method === 'declining',
      `stored method is "${r.after.p.factoring?.method}" after one click`)
    check(r.after.p.factoring?.enabled === true, 'factoring is still enabled')
    check(Number(r.after.p.factoring?.ratePct) === 2 && Number(r.after.p.factoring?.termMonths) === 36,
      `rate and term unchanged (${r.after.p.factoring?.ratePct}, ${r.after.p.factoring?.termMonths})`)
  }
  r = await clickAndSave('[data-testid="deal-method-toggle"]', 'method back to straight')
  if (r) {
    check(r.after.p.factoring?.method === 'straight',
      `stored method is "${r.after.p.factoring?.method}" after the second click`)
  }

  console.log('\n── M4 and M6: the structure radio ──')
  r = await clickAndSave('[data-structure="hybrid"]', 'structure to hybrid')
  if (r) check(r.after.p.structure === 'hybrid', `stored structure is "${r.after.p.structure}"`)
  r = await clickAndSave('[data-structure="twoPhase"]', 'structure back to twoPhase')
  if (r) check(r.after.p.structure === 'twoPhase', `stored structure is "${r.after.p.structure}"`)

  console.log('\n── M7: the invoicing radio ──')
  r = await clickAndSave('[data-invoicing="monthly"]', 'invoicing to monthly')
  if (r) check(r.after.p.invoicing === 'monthly', `stored invoicing is "${r.after.p.invoicing}"`)

  console.log('\n── M1: the mode toggle ──')
  r = await clickAndSave('[data-testid="deal-payment-mode-toggle"]', 'mode to OPEX')
  if (r) {
    check(r.after.p.paymentMode === 'opex', `stored paymentMode is "${r.after.p.paymentMode}"`)
    check(r.after.p.structure === 'single',
      `OPEX stores the single-phase structure ("${r.after.p.structure}")`)
  }
  r = await clickAndSave('[data-testid="deal-payment-mode-toggle"]', 'mode back to CAPEX')
  if (r) {
    check(r.after.p.paymentMode === 'capex', `stored paymentMode is "${r.after.p.paymentMode}"`)
    // THE DEFECT R-PT3 LEFT BEHIND: coming back used to leave `single`, which
    // no CAPEX radio matches, so the group rendered with nothing selected.
    check(r.after.p.structure === 'twoPhase',
      `returning to CAPEX lands on a structure a radio can show ("${r.after.p.structure}")`)
    const active = await p.evaluate(() => [...document.querySelectorAll('#deal-structure-toggle .ring-radio.active')]
      .map((e) => e.dataset.structure))
    check(active.length === 1, `and exactly one radio is selected on screen (${JSON.stringify(active)})`)
  }
} finally { await b.close(); await tearDown(TAG) }
console.log(`\n${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
