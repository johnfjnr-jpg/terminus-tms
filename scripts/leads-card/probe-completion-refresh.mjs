// COMPLETION SURFACE FIX, Phase 0: measurement only. Nothing is changed.
//
// ── ITS SCREENSHOTS ARE NAMED FOR THIS PHASE, DELIBERATELY ──────────────
//
// This probe was copied from the Phase 0 measurement one and inherited its
// output filenames, so its first run OVERWROTE the images the Phase 0 report
// cites as evidence of the defect. Verification 44 is about backups keyed on
// a basename; the same fault reaches any artefact named after a run rather
// than after the run that made it.
//
// THE INSTRUMENT, named because R1 asks for it: the surface's `*` markers
// carry `data-testid="lead-needs-<key>-<id>"` and are rendered from the
// `blocking` prop. So "which fields are marked" is readable from the DOM
// without inferring anything, and "what the server says is missing" is
// readable from exit-criteria. The claim is that those two agree after a
// save; the measurement is the two lists side by side, before and after.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-csfix.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/csfix/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const TAG = 'p1cs'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const say = (h) => console.log(`\n${h}`)

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED'); process.exit(2)
}
const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const mk = async (label, payload) => {
  const r = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: OWNER.user.id, industry_id: industry.id,
  }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({
    record_id: r.id, revision_number: 1,
    payload: { name: `${TAG} ${label}`, ...payload }, created_by: OWNER.user.id,
  }).select().single(), `rev ${label}`)
  return r
}
const COMPLETE_BUT = (omit) => {
  const all = {
    company: 'CS Co', jobRole: 'Head', email: `${TAG}@example.invalid`,
    mobile: '+65 9000 0144', source: 'Referral', linkedin: 'https://example.invalid/in/x',
    address: '1 CS Way', address2: 'Unit 9', city: 'Singapore', postcode: '069118',
    country: 'Singapore', region: 'APAC', summary: 'a summary',
  }
  for (const k of omit) delete all[k]
  return all
}
// Missing three: address, postcode and summary. Enough that a partial save
// leaves genuinely-empty fields behind, which is what makes the claim real.
const lead = await mk('Stale', COMPLETE_BUT(['address', 'postcode', 'summary']))
// R2's consequence case: everything but Summary.
const onlySummary = await mk('OnlySummary', COMPLETE_BUT(['summary']))
const created = [lead.id, onlySummary.id]

const serverMissing = async (id) =>
  ((await api('GET', `/records/${id}/exit-criteria`)).data.blocking ?? [])
    .map((b) => b.field).sort()

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const go = async (id) => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
      { timeout: 20000 }, id)
  }
  const surfaceState = async (id) => page.evaluate((x) => {
    const marks = [...document.querySelectorAll(`[data-testid^="lead-needs-"][data-testid$="-${x}"]`)]
      .map((e) => e.getAttribute('data-testid').replace('lead-needs-', '').replace(`-${x}`, '')).sort()
    const val = (k) => {
      const el = document.querySelector(`[data-testid="lead-fix-${k}-${x}"]`)
      return el ? el.value : '(no input)'
    }
    const err = document.querySelector(`[data-testid="lead-fix-error-${x}"]`)
    return {
      marks,
      address: val('address'), postcode: val('postcode'), summary: val('summary'),
      message: err ? err.textContent.trim() : null,
    }
  }, id)

  // ── 1. R1: THE STALENESS ──────────────────────────────────────────────
  say('1. R1: what recomputes on an in-surface save, and what does not')
  await go(lead.id)
  await page.click(`[data-testid="lead-qualify-${lead.id}"]`)
  await page.waitForSelector(`[data-testid="lead-incomplete-${lead.id}"]`, { timeout: 15000 })
  const before = await surfaceState(lead.id)
  console.log(`  BEFORE  markers: [${before.marks.join(', ')}]`)
  console.log(`          server:  [${(await serverMissing(lead.id)).join(', ')}]`)
  await page.screenshot({ path: `${OUT}p1-before-save.png` })

  // Fill exactly ONE of the three, so a correct surface would drop one star.
  const sel = `[data-testid="lead-fix-address-${lead.id}"]`
  await page.click(sel); await page.type(sel, '12 Recompute Road')
  await page.click(`[data-testid="lead-fix-save-${lead.id}"]`)
  await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-fix-error-${x}"]`),
    { timeout: 20000 }, lead.id)
  const after = await surfaceState(lead.id)
  const serverAfter = await serverMissing(lead.id)
  console.log(`  AFTER   markers: [${after.marks.join(', ')}]`)
  console.log(`          server:  [${serverAfter.join(', ')}]`)
  console.log(`          message: "${after.message}"`)
  console.log(`          values:  address="${after.address}" postcode="${after.postcode}" summary="${after.summary}"`)
  const staleMarks = after.marks.filter((m) => !serverAfter.includes(m))
  console.log(`\n  MARKERS STALE: ${staleMarks.length > 0}   stale stars on: [${staleMarks.join(', ')}]`)
  const FAIL = []
  if (staleMarks.length) FAIL.push(`markers stale after in-surface save: ${staleMarks}`)
  if (after.address !== '12 Recompute Road') FAIL.push(`value stale after in-surface save: "${after.address}"`)
  if (!after.marks.includes('postcode')) FAIL.push('a genuinely empty field LOST its star')
  if (!/2 still/.test(after.message ?? '')) FAIL.push(`count wrong: "${after.message}"`)
  global.__FAIL = FAIL
  const persisted = must(await db.from('record_revisions').select('payload')
    .eq('record_id', lead.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  console.log(`  the save DID persist: address="${persisted.payload?.address}"`)
  console.log(`  the field VALUE on screen after save: "${after.address}"`)
  await page.screenshot({ path: `${OUT}p1-after-save.png` })

  // ── 2. R1 CROSS-SURFACE: THE ADDRESS POPUP ────────────────────────────
  say('2. R1 cross-surface: does the address popup path recompute the markers?')
  await page.click(`[data-testid="lead-address-${lead.id}"]`)
  await page.waitForSelector(`[data-testid="address-popup-${lead.id}"]`, { timeout: 10000 })
  const psel = `[data-testid="addr-postcode-${lead.id}"]`
  await page.click(psel); await page.type(psel, '049999')
  await page.click(`[data-testid="addr-save-${lead.id}"]`)
  await page.waitForFunction((x) => !document.querySelector(`[data-testid="address-popup-${x}"]`),
    { timeout: 20000 }, lead.id)
  await new Promise((r) => setTimeout(r, 2500))
  const afterPopup = await surfaceState(lead.id)
  const serverAfterPopup = await serverMissing(lead.id)
  console.log(`  surface still open: ${afterPopup.marks.length > 0 || afterPopup.address !== '(no input)'}`)
  console.log(`  AFTER POPUP markers: [${afterPopup.marks.join(', ')}]`)
  console.log(`              server:  [${serverAfterPopup.join(', ')}]`)
  console.log(`              values:  address="${afterPopup.address}" postcode="${afterPopup.postcode}"`)
  const staleAfterPopup = afterPopup.marks.filter((m) => !serverAfterPopup.includes(m))
  console.log(`  MARKERS STALE AFTER POPUP: ${staleAfterPopup.length > 0}  [${staleAfterPopup.join(', ')}]`)
  if (staleAfterPopup.length) global.__FAIL.push(`markers stale after popup: ${staleAfterPopup}`)
  if (afterPopup.postcode !== '049999') global.__FAIL.push(`popup value stale: "${afterPopup.postcode}"`)

  // ── 3. R2: TWO EDITORS OF ONE FIELD ───────────────────────────────────
  say('3. R2: is Summary editable in both places at once?')
  const two = await page.evaluate((x) => {
    const inSurface = document.querySelector(`[data-testid="lead-fix-summary-${x}"]`)
    const inCard = document.querySelector(`[data-testid="lead-summary-input-${x}"]`)
    return {
      surfaceEditor: !!inSurface, surfaceTag: inSurface?.tagName ?? null,
      surfaceValue: inSurface?.value ?? null,
      cardEditor: !!inCard, cardTag: inCard?.tagName ?? null, cardValue: inCard?.value ?? null,
      cardSave: !!document.querySelector(`[data-testid="lead-summary-save-${x}"]`),
      surfaceSave: !!document.querySelector(`[data-testid="lead-fix-save-${x}"]`),
    }
  }, lead.id)
  console.log(`  completion surface editor: ${two.surfaceEditor} <${two.surfaceTag}> value="${two.surfaceValue}"`)
  console.log(`  card Summary panel editor: ${two.cardEditor} <${two.cardTag}> value="${two.cardValue}"`)
  console.log(`  both save controls present: surface ${two.surfaceSave}, card ${two.cardSave}`)
  const drift = await page.evaluate((x) => ({
    surface: document.querySelector(`[data-testid="lead-fix-summary-${x}"]`)?.value ?? '(no editor)',
    card: document.querySelector(`[data-testid="lead-summary-input-${x}"]`)?.value ?? '(no editor)',
  }), lead.id)
  console.log(`  after typing into the SURFACE: surface="${drift.surface}" card="${drift.card}"`)
  if (two.surfaceEditor) global.__FAIL.push('R2: the completion surface STILL edits Summary')
  if (!two.cardEditor) global.__FAIL.push('R2: the card lost its Summary editor')
  await page.screenshot({ path: `${OUT}p1-one-editor.png` })

  // ── 4. R2's CONSEQUENCE ───────────────────────────────────────────────
  say('4. R2 consequence: can Summary be the ONLY missing field?')
  const onlyMissing = await serverMissing(onlySummary.id)
  console.log(`  a lead complete but for Summary blocks on: [${onlyMissing.join(', ')}]`)
  console.log(`  Summary-only case is reachable: ${onlyMissing.length === 1 && onlyMissing[0] === 'summary'}`)
  await go(onlySummary.id)
  await page.click(`[data-testid="lead-qualify-${onlySummary.id}"]`)
  await page.waitForSelector(`[data-testid="lead-incomplete-${onlySummary.id}"]`, { timeout: 15000 })
  const only = await page.evaluate((x) => {
    const s = document.querySelector(`[data-testid="lead-incomplete-${x}"]`)
    return {
      marks: [...s.querySelectorAll('[data-testid^="lead-needs-"]')].length,
      inputs: s.querySelectorAll('input, select, textarea').length,
      text: s.textContent.replace(/\s+/g, ' ').slice(0, 120),
    }
  }, onlySummary.id)
  console.log(`  the surface shows ${only.inputs} inputs and ${only.marks} marker(s)`)
  const pointer = await page.evaluate((x) =>
    document.querySelector(`[data-testid="lead-summary-pointer-${x}"]`)?.textContent?.trim() ?? null,
  onlySummary.id)
  console.log(`  R5 pointer: ${pointer ? `"${pointer}"` : 'ABSENT'}`)
  if (!pointer) global.__FAIL.push('R5: no pointer to the card panel on the Summary-only surface')
  const starOnly = await page.evaluate((x) =>
    !!document.querySelector(`[data-testid="lead-needs-summary-${x}"]`), onlySummary.id)
  if (!starOnly) global.__FAIL.push('R5: Summary is not marked required')
  await page.screenshot({ path: `${OUT}p1-only-summary.png` })
} finally {
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  console.log(`\n  soft deleted ${created.length}`)
  await browser.close()
}
const F = global.__FAIL ?? ['the run did not reach the assertions']
console.log(F.length ? `\n  ${F.length} FAILING:\n    ${F.join('\n    ')}` : '\n  ALL CLAIMS HOLD')
process.exit(F.length ? 1 : 0)
