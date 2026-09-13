// LEADS - DETAILS CONSOLIDATION, Phase 0. Read-only except its own fixtures.
//
// R1's instruction is explicit: CONFIRM THE CAUSE, DO NOT ASSUME. So the
// highlight is reproduced live and its source read off the element - which
// class, applied by what - rather than inferred from the stylesheet.
//
// R4a asks whether the in-card surface can ALREADY render with nothing
// missing. That is answered by rendering it against a COMPLETE lead, not by
// reading the component.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-ldc.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/ldc/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }

const industry = must(await db.from('industries').select('id').limit(1), 'i')[0]
const mk = async (label, payload) => {
  const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
    owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
    payload: { name: `ldc0 ${label}`, company: 'Consolidation Co', source: 'Referral', ...payload },
    created_by: OWNER.user.id }).select().single(), `rev ${label}`)
  return r
}
const FULL = {
  jobRole: 'Head of Ops', email: 'ldc0@example.invalid', mobile: '+65 9000 0301',
  linkedin: 'https://example.invalid/in/x', address: '1 Way', address2: 'Unit 2',
  city: 'Singapore', postcode: '069118', country: 'Singapore', region: 'APAC',
  summary: 'A complete lead.',
}
// R1 needs a lead with something MISSING to complete; R4a needs one with
// NOTHING missing. Verification 7: one fixture per claim.
const partial = await mk('Partial', { ...FULL, city: '', postcode: '' })
const complete = await mk('Complete', FULL)
const created = [partial.id, complete.id]
console.log(`fixtures: partial=${partial.id} complete=${complete.id}\n`)

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
      { timeout: 25000 }, id)
  }
  const shot = async (id, name) => {
    const el = await page.$(`[data-testid="lead-card-${id}"]`)
    if (el) await el.screenshot({ path: `${OUT}${name}` })
  }
  // The treatment of a field, read OFF THE ELEMENT: which classes it carries
  // and what they compute to. Not inferred from the stylesheet.
  const treatment = (id, keys) => page.evaluate((x, ks) => Object.fromEntries(ks.map((k) => {
    const e = document.querySelector(`[data-testid="lead-fix-${k}-${x}"]`)
    if (!e) return [k, null]
    const s = getComputedStyle(e)
    return [k, { cls: e.className, bg: s.backgroundColor, border: s.borderBottomColor,
      outline: s.outlineStyle, marked: !!document.querySelector(`[data-testid="lead-needs-${k}-${x}"]`) }]
  })), id, keys)

  // ── R1: THE AFTER-SAVE HIGHLIGHT ──────────────────────────────────────
  console.log('=== R1: the highlight, before and after a save ===')
  await go(partial.id)
  await page.click(`[data-testid="lead-qualify-${partial.id}"]`)
  await page.waitForSelector(`[data-testid="lead-incomplete-${partial.id}"]`, { timeout: 15000 })
  const before = await treatment(partial.id, ['city', 'postcode', 'email'])
  console.log('  BEFORE the save:')
  for (const [k, v] of Object.entries(before))
    console.log(`    ${k.padEnd(9)} marked=${String(v?.marked).padEnd(5)} cls="${v?.cls}" bg=${v?.bg} borderBottom=${v?.border}`)
  await shot(partial.id, 'ldc-p0-before-save.png')

  await page.click(`[data-testid="lead-fix-city-${partial.id}"]`)
  await page.keyboard.type('Singapore')
  await page.click(`[data-testid="lead-fix-save-${partial.id}"]`)
  await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-fix-error-${x}"]`)
    || !document.querySelector(`[data-testid="lead-incomplete-${x}"]`), { timeout: 20000 }, partial.id)
  await new Promise((r) => setTimeout(r, 600))
  const stillOpen = await page.evaluate((x) =>
    !!document.querySelector(`[data-testid="lead-incomplete-${x}"]`), partial.id)
  console.log(`  the surface is still open after the save: ${stillOpen}`)
  if (stillOpen) {
    const after = await treatment(partial.id, ['city', 'postcode', 'email'])
    console.log('  AFTER the save:')
    for (const [k, v] of Object.entries(after))
      console.log(`    ${k.padEnd(9)} marked=${String(v?.marked).padEnd(5)} cls="${v?.cls}" bg=${v?.bg} borderBottom=${v?.border}`)
    const changed = Object.keys(before).filter((k) =>
      before[k] && after[k] && (before[k].cls !== after[k].cls || before[k].bg !== after[k].bg))
    console.log(`  fields whose TREATMENT changed across the save: [${changed.join(', ')}]`)
    console.log(`  city was completed; is it still marked? ${after.city?.marked}`)
    await shot(partial.id, 'ldc-p0-after-save.png')
  }

  // ── R4a: CAN THE SURFACE RENDER WITH NOTHING MISSING? ─────────────────
  console.log('\n=== R4a: the same surface against a COMPLETE lead ===')
  await page.reload({ waitUntil: 'networkidle0' })
  await go(complete.id)
  await page.click(`[data-testid="lead-qualify-${complete.id}"]`)
  await new Promise((r) => setTimeout(r, 1500))
  const state = await page.evaluate((x) => {
    const surface = document.querySelector(`[data-testid="lead-incomplete-${x}"]`)
    const step = document.querySelector(`[data-testid="lead-account-step-${x}"]`)
    return {
      completionSurface: !!surface,
      accountStep: !!step,
      eyebrow: surface?.querySelector('.eyebrow')?.textContent?.trim() ?? null,
      fieldsRendered: surface ? surface.querySelectorAll('input, select, textarea').length : 0,
      markers: surface ? surface.querySelectorAll('[data-testid^="lead-needs-"]').length : 0,
    }
  }, complete.id)
  console.log(`  completion surface opened: ${state.completionSurface}`)
  console.log(`  account step opened instead: ${state.accountStep}`)
  console.log(`  eyebrow: ${JSON.stringify(state.eyebrow)}`)
  console.log(`  fields rendered: ${state.fieldsRendered}   missing markers: ${state.markers}`)
  await shot(complete.id, 'ldc-p0-complete-lead.png')

  // ── R2: THE NEW LEAD GRID ─────────────────────────────────────────────
  console.log('\n=== R2: the New Lead grid as it renders ===')
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForSelector('#btn-new-contact', { timeout: 15000 })
  await page.click('#btn-new-contact')
  await page.waitForSelector('[data-testid="new-lead-grid"]', { timeout: 15000 })
  const grid = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="new-lead-grid"]')
    const modal = g.closest('.modal-panel, [class*="modal"], #new-contact-form')
    const scroll = g.querySelector('.new-lead-scroll')
    const table = g.querySelector('table')
    const th = [...g.querySelectorAll('th')]
    const firstCell = g.querySelector('td')
    const input = firstCell?.querySelector('input, select, textarea')
    const cs = (e) => (e ? getComputedStyle(e) : null)
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect()
      return { w: Math.round(b.width), h: Math.round(b.height) } }
    return {
      modalClass: modal?.className ?? '(none)', modalWidth: r(modal)?.w ?? null,
      scrollPresent: !!scroll,
      scrollOverflowY: cs(scroll)?.overflowY ?? null,
      scrollHeight: scroll?.scrollHeight ?? null, clientHeight: scroll?.clientHeight ?? null,
      scrolls: scroll ? scroll.scrollHeight > scroll.clientHeight : null,
      columns: th.length,
      tableBorderCollapse: cs(table)?.borderCollapse ?? null,
      thBorder: cs(th[0])?.borderBottom ?? null,
      cellBorder: cs(firstCell)?.border ?? null,
      inputBorderBottom: cs(input)?.borderBottom ?? null,
      inputWidth: r(input)?.w ?? null,
      firstCellWidth: r(firstCell)?.w ?? null,
    }
  })
  for (const [k, v] of Object.entries(grid)) console.log(`  ${k.padEnd(20)} ${JSON.stringify(v)}`)
  await page.screenshot({ path: `${OUT}ldc-p0-grid.png` })

  // scroll persistence, and what SAVE does
  await page.evaluate(() => { const s = document.querySelector('.new-lead-scroll'); if (s) s.scrollTop = 120 })
  const scrolled = await page.evaluate(() => document.querySelector('.new-lead-scroll')?.scrollTop)
  await page.evaluate(() => { const b = document.getElementById('btn-close-new-contact')
    || document.querySelector('#new-contact-form [data-testid="nlg-cancel"]'); b?.click() })
  await new Promise((r) => setTimeout(r, 400))
  await page.click('#btn-new-contact')
  await page.waitForSelector('[data-testid="new-lead-grid"]', { timeout: 10000 })
  const reopened = await page.evaluate(() => document.querySelector('.new-lead-scroll')?.scrollTop)
  console.log(`\n  scrollTop set to ${scrolled}, on reopen it is ${reopened}  => PERSISTS: ${reopened === scrolled && scrolled > 0}`)
} finally {
  await browser.close()
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').in('id', created).is('deleted_at', null), 'td')
  console.log(`\nteardown: ${created.length} soft-deleted, ${live.length} still live`)
}
