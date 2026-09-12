// UI STANDARDS, Phase 0: the per-panel inconsistency inventory.
//
// READ-ONLY except its own fixtures. Nothing on the card is changed.
//
// EVERY CLAIM IS A RELATIONSHIP BETWEEN TWO ELEMENTS, never a property of
// one. S1 is "the save control is on the header line, right-aligned", which
// is save-vs-header and save-vs-panel-right; S3 is field-vs-header. The last
// round shipped a dropdown 730px below its card with `position: absolute`
// reading PASS, so a property is not evidence about a layout.
//
// Artefacts are `uis-p0-*` (Verification 44's lineage clause).
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-panels.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/uis/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const px = (n) => (n === null || n === undefined ? '--' : `${Math.round(n)}`)

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }

const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const NOTE = (t, at) => ({ text: t, at, by: 'john+test@terminustechnologies.io' })
const mk = async (label, payload) => {
  const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
    owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
    payload: { name: `uis0 ${label}`, company: 'Standards Co', source: 'Referral', ...payload },
    created_by: OWNER.user.id }).select().single(), `rev ${label}`)
  return r
}
// One fixture per claim group (Verification 7): the panels lead is read and
// edited; the picker lead is consumed by opening Qualify.
const panels = await mk('Panels', {
  summary: 'A summary of the lead.',
  notes: [NOTE('A note.', '2026-09-12T06:14:09.321Z'), NOTE('Another.', '2026-09-11T22:02:41.000Z'),
          NOTE('A third.', '2026-09-10T01:45:00.000Z')],
  followUpDate: '2026-10-01', followUpDescription: 'Call them back' })
const picker = await mk('Picker', {
  jobRole: 'Head', email: 'uis0@example.invalid', mobile: '+65 9000 0201',
  linkedin: 'https://example.invalid/in/x', address: '1 Way', city: 'Singapore',
  postcode: '069118', country: 'Singapore', region: 'APAC', summary: 'Ready.' })
const created = [panels.id, picker.id]
console.log(`fixtures: ${created.join(' ')}\n`)

const browser = await puppeteer.launch({ headless: 'new' })
const INVENTORY = []
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
      { timeout: 25000 }, id)
  }
  const shot = async (id, name) => {
    const el = await page.$(`[data-testid="lead-card-${id}"]`)
    if (el) await el.screenshot({ path: `${OUT}${name}` })
  }

  // ── THE MEASURING FUNCTION, ONE DEFINITION FOR EVERY PANEL ───────────
  // Verification 20's remedy: every panel is judged by the same code, so two
  // panels cannot disagree about what "on the header line" means.
  // INSTALLED WITH evaluateOnNewDocument, so it survives the reloads between
  // surfaces. Injected with `page.evaluate` it was wiped by the first reload
  // and the three overlay surfaces died on "not a function" - the same
  // attachment-point fault Verification 45 records, arriving on a helper
  // rather than on a sampler.
  await page.evaluateOnNewDocument(() => {
    window.__uisMeasure = (panelSel, opts) => {
      const p = document.querySelector(panelSel)
      if (!p) return { missing: panelSel }
      const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect()
        return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height } }
      const q = (s) => (s ? p.querySelector(s) : null)
      const panel = R(p)
      const header = R(q(opts.header))
      const title = R(q(opts.title))
      const secondary = R(q(opts.secondary))
      const field = R(q(opts.field))
      const save = R(q(opts.save))
      const discard = R(q(opts.discard))
      // Every native control in the panel, with its classes: S5's live half.
      const controls = [...p.querySelectorAll('button, input, textarea, select')].map((e) => ({
        tag: e.tagName.toLowerCase(), testid: e.dataset.testid ?? '',
        cls: e.className || '', disabled: !!e.disabled }))
      return { panel, header, title, secondary, field, save, discard, controls }
    }
  })
  await page.reload({ waitUntil: 'networkidle0' })

  const near = (a, b, t = 8) => a !== null && b !== null && Math.abs(a - b) < t
  const classify = (m) => {
    if (!m.save) return 'NO SAVE CONTROL'
    if (m.header && near(m.save.top, m.header.top, 10)) return 'ON HEADER LINE'
    if (m.field && m.save.top >= m.field.bottom - 4) return 'BELOW THE FIELD'
    if (m.field && near(m.save.top, m.field.top, 12) && m.save.left >= m.field.right - 8) return 'BESIDE THE FIELD'
    if (m.field && m.save.top >= m.field.bottom - 40) return 'FOOTER ROW'
    return 'ELSEWHERE'
  }
  const report = (name, m, note) => {
    if (m.missing) { console.log(`  ${name}: NOT PRESENT (${m.missing})`); return }
    const s1 = classify(m)
    const oneLine = m.header && m.title
      && (!m.secondary || near(m.title.top, m.secondary.top))
      && (!m.save || near(m.title.top, m.save.top, 10))
    const s3 = m.field && m.header ? Math.round(m.field.left - m.header.left) : null
    const rightAligned = m.save && m.panel ? Math.round(m.panel.right - m.save.right) : null
    const unclassed = m.controls.filter((c) => !c.cls.trim())
    console.log(`  ${name}`)
    console.log(`    S1 save placement      ${s1}${m.save && m.header ? `   (save.top ${px(m.save.top)} vs header.top ${px(m.header.top)}, field.bottom ${px(m.field?.bottom)})` : ''}`)
    console.log(`    S1 right-aligned       ${rightAligned === null ? 'n/a' : `${rightAligned}px from the panel's right edge`}`)
    console.log(`    S2 header on ONE line  ${m.header ? (oneLine ? 'YES' : 'NO') : 'NO HEADER AT ALL'}`)
    console.log(`    S3 field vs header L   ${s3 === null ? 'n/a' : `${s3}px`}`)
    console.log(`    S4 discard present     ${m.discard ? 'yes' : 'NO'}`)
    console.log(`    S5 controls            ${m.controls.length}, unclassed ${unclassed.length}${unclassed.length ? ': ' + unclassed.map((c) => c.testid || c.tag).join(' ') : ''}`)
    if (note) console.log(`    note                   ${note}`)
    INVENTORY.push({ name, s1, rightAligned, oneLine: !!oneLine, s3, discard: !!m.discard,
      controls: m.controls.length, unclassed: unclassed.length })
  }

  await go(panels.id)
  const ID = panels.id
  console.log('=== THE INLINE PANELS, as the card renders them ===\n')

  report('SUMMARY', await page.evaluate((x) => window.__uisMeasure(`[data-testid="lead-summary-${x}"]`, {
    header: '.card-col-head', title: '.lead-card-col-title', secondary: null,
    field: `[data-testid="lead-summary-input-${x}"]`, save: `[data-testid="lead-summary-save-${x}"]`,
    discard: null }), ID))

  report('NOTES', await page.evaluate((x) => window.__uisMeasure(`[data-testid="lead-notes-${x}"]`, {
    header: '[data-testid="cd-notes-header-row"]', title: '[data-testid="cd-notes-title"]',
    secondary: '.label', field: '[data-testid="cd-new-note-input"]',
    save: '[data-testid="cd-add-note-btn"]', discard: '[data-testid="cd-note-discard"]' }), ID),
    'the input is closed here; measured again open below')

  report('FOLLOW-UP TASK  [FROZEN]', await page.evaluate((x) => window.__uisMeasure(`[data-testid="lead-followup-${x}"]`, {
    header: '.cd-card-head', title: '.cd-card-title', secondary: '[data-testid="cd-followup-dirty"]',
    field: '[data-testid="cd-followUpDate"]', save: '[data-testid="cd-followup-save"]',
    discard: null }), ID))

  report('CARD ACTIONS', await page.evaluate((x) => window.__uisMeasure(`[data-testid="lead-actions-${x}"]`, {
    header: null, title: null, secondary: null, field: null,
    save: `[data-testid="lead-qualify-${x}"]`, discard: null }), ID))

  // NOTES with its editor OPEN, which is when the save control matters.
  await page.click(`[data-testid="lead-notes-${ID}"] [data-testid="cd-add-note-btn"]`)
  await page.waitForSelector(`[data-testid="lead-notes-${ID}"] [data-testid="cd-new-note-input"]`, { timeout: 8000 })
  console.log('')
  report('NOTES (editor open)', await page.evaluate((x) => window.__uisMeasure(`[data-testid="lead-notes-${x}"]`, {
    header: '[data-testid="cd-notes-header-row"]', title: '[data-testid="cd-notes-title"]',
    secondary: '.label', field: '[data-testid="cd-new-note-input"]',
    save: '[data-testid="cd-add-note-btn"]', discard: '[data-testid="cd-note-discard"]' }), ID))
  await shot(ID, 'uis-p0-panels-1920.png')
  await page.click(`[data-testid="lead-notes-${ID}"] [data-testid="cd-note-discard"]`)

  // ── S4: DIRTY BEHAVIOUR, DRIVEN ─────────────────────────────────────
  console.log('\n=== S4: dirty and save, driven per panel ===\n')
  const s4 = async (name, fieldSel, saveSel, typeText) => {
    const before = await page.evaluate((s) => {
      const e = document.querySelector(s); return e ? e.disabled : null }, saveSel)
    await page.click(fieldSel)
    await page.keyboard.type(typeText)
    await new Promise((r) => setTimeout(r, 250))
    const after = await page.evaluate((s) => {
      const e = document.querySelector(s); return e ? e.disabled : null }, saveSel)
    console.log(`  ${name.padEnd(22)} save disabled before an edit: ${String(before).padEnd(5)}  after: ${after}`
      + `   ${before === true && after === false ? 'CONFORMS' : 'DOES NOT CONFORM'}`)
    return { name, before, after }
  }
  await s4('SUMMARY', `[data-testid="lead-summary-input-${ID}"]`, `[data-testid="lead-summary-save-${ID}"]`, 'x')
  await s4('FOLLOW-UP [FROZEN]', `[data-testid="cd-followUpDescription"]`, `[data-testid="cd-followup-save"]`, 'x')
  await page.reload({ waitUntil: 'networkidle0' }); await go(ID)
  await page.click(`[data-testid="lead-notes-${ID}"] [data-testid="cd-add-note-btn"]`)
  await page.waitForSelector(`[data-testid="lead-notes-${ID}"] [data-testid="cd-new-note-input"]`, { timeout: 8000 })
  await s4('NOTES', `[data-testid="lead-notes-${ID}"] [data-testid="cd-new-note-input"]`,
    `[data-testid="lead-notes-${ID}"] [data-testid="cd-add-note-btn"]`, 'x')

  // ── THE OVERLAY SURFACES ────────────────────────────────────────────
  console.log('\n=== THE OVERLAY SURFACES ===\n')
  await page.reload({ waitUntil: 'networkidle0' }); await go(ID)
  await page.click(`[data-testid="lead-address-${ID}"]`)
  await page.waitForSelector(`[data-testid="address-popup-${ID}"]`, { timeout: 10000 })
  report('ADDRESS POPUP  [modal]', await page.evaluate((x) => window.__uisMeasure(`[data-testid="address-popup-${x}"]`, {
    header: '.eyebrow', title: '.eyebrow', secondary: null,
    field: `[data-testid="addr-address-${x}"]`, save: `[data-testid="addr-save-${x}"]`,
    discard: `[data-testid="addr-close-${x}"]` }), ID))
  await page.screenshot({ path: `${OUT}uis-p0-address-1920.png` })
  await page.click(`[data-testid="addr-close-${ID}"]`)

  await page.reload({ waitUntil: 'networkidle0' }); await go(ID)
  await page.click(`[data-testid="lead-nurture-${ID}"]`)
  await page.waitForSelector('[data-testid="nurture-dialog"]', { timeout: 10000 })
  report('NURTURE DIALOG  [modal]', await page.evaluate(() => window.__uisMeasure('[data-testid="nurture-dialog"]', {
    header: '.eyebrow', title: '.eyebrow', secondary: '.sub',
    field: '[data-testid="nurture-date"]', save: '[data-testid="nurture-save"]',
    discard: '[data-testid="nurture-cancel"]' })))
  await page.screenshot({ path: `${OUT}uis-p0-nurture-1920.png` })
  await page.click('[data-testid="nurture-cancel"]')

  await page.reload({ waitUntil: 'networkidle0' }); await go(picker.id)
  await page.click(`[data-testid="lead-qualify-${picker.id}"]`)
  await page.waitForSelector(`[data-testid="acct-picker-${picker.id}"]`, { timeout: 12000 })
  report('ACCOUNT PICKER', await page.evaluate((x) => window.__uisMeasure(`[data-testid="lead-account-step-${x}"]`, {
    header: '.eyebrow', title: '.eyebrow', secondary: null,
    field: `[data-testid="acct-search-${x}"]`, save: `[data-testid="acct-create-${x}"]`,
    discard: `[data-testid="acct-cancel-${x}"]` }), picker.id))
  await shot(picker.id, 'uis-p0-picker-1920.png')

  console.log('\n=== SUMMARY OF THE INVENTORY ===')
  const placements = [...new Set(INVENTORY.map((i) => i.s1))]
  console.log(`  DISTINCT save-control placements on ONE card: ${placements.length}`)
  for (const p of placements)
    console.log(`    ${p.padEnd(18)} ${INVENTORY.filter((i) => i.s1 === p).map((i) => i.name).join(', ')}`)
  console.log(`  panels with a header on ONE line: ${INVENTORY.filter((i) => i.oneLine).length} of ${INVENTORY.length}`)
  console.log(`  panels with a DISCARD:            ${INVENTORY.filter((i) => i.discard).length} of ${INVENTORY.length}`)
  console.log(`  panels with unclassed controls:   ${INVENTORY.filter((i) => i.unclassed > 0).length} of ${INVENTORY.length}`)
  writeFileSync(`${OUT}inventory.json`, JSON.stringify(INVENTORY, null, 1))
} finally {
  await browser.close()
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').in('id', created).is('deleted_at', null), 'teardown')
  console.log(`\nteardown: ${created.length} soft-deleted, ${live.length} still live`)
}
