// Phase 1: both modes of the shared surface, on OWNED records, plus a real
// create through the shell's own dialogue.
//
// TWO FIXTURES, because the claim is about two modes and one record cannot be
// in both. Created through the real route; the contact one is promoted to
// Qualified by admin write (V47: the surface reads the state, not how the
// record reached it). Torn down SOFT, enumerated from the database by tag.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p1-modes.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/contact-mode/`
mkdirSync(OUT, { recursive: true })
const MARK = 'CMODE'
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const checks = []
const check = (ok, what) => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`) }

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('BUNDLE STALE'); process.exit(2) }

const industry = (await api('GET', '/industries')).data[0]
const mk = async (suffix) => {
  const r = await api('POST', '/contacts', {
    name: `${MARK} ${suffix}`, company: `${MARK} Co`, jobRole: 'Engineer',
    email: `${suffix}@example.com`, mobile: '+60123456789',
    industry_id: industry.id, source: 'Web', address: '1 Fixture Street',
    city: 'Singapore', postcode: '018956', country: 'Singapore', region: 'APAC',
    summary: 'A contact-mode fixture.',
  })
  return r.data?.id ?? r.data?.record?.id
}
const leadId = await mk('Lead')
const contactId = await mk('Contact')
const acct = must(await db.from('records').select('id').eq('record_type', 'account')
  .is('deleted_at', null).limit(1), 'acct')[0]
must(await db.from('records').update({ status: 'Qualified', parent_record_id: acct.id })
  .eq('id', contactId), 'promote')
console.log(`lead    ${leadId}\ncontact ${contactId}\n`)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })

  const open = async (id, expectName) => {
    await page.evaluate((r) => navigate('contact-detail', r), id)
    await page.waitForFunction((n) => {
      const v = document.getElementById('view-contact-detail')
      return !!v && v.querySelector('[data-testid="cd-lead-name"]')?.textContent === n
    }, { timeout: 25000 }, expectName)
    await new Promise((r) => setTimeout(r, 1200))
    return page.evaluate(() => {
      const v = document.getElementById('view-contact-detail')
      const t = (x) => v.querySelector(`[data-testid="${x}"]`)
      return {
        title: t('cd-title')?.textContent ?? null,
        chip: t('cd-status')?.textContent ?? null,
        nurture: !!t('cd-btn-park'),
        qualify: !!t('cd-btn-qualify'),
        createControl: !!t('cd-create'),
        createMenu: !!t('cd-create-menu'),
        inlineButtons: !!t('cd-create-test-bed') || !!t('cd-create-opportunity'),
      }
    })
  }

  // ── CONTACT MODE ───────────────────────────────────────────────────────
  const c = await open(contactId, `${MARK} Contact`)
  console.log(`  contact: ${JSON.stringify(c)}`)
  check(c.title === 'Contact details', `R1 the title reads "${c.title}"`)
  check(c.chip === null, 'R2 no status chip')
  check(c.nurture === false, 'R3 no Nurture')
  check(c.createControl === true, 'R4 one Create control is present')
  check(c.inlineButtons === false, 'R4 and the two inline buttons are gone')
  check(c.createMenu === false, 'R4 the menu starts closed')
  await page.screenshot({ path: `${OUT}contact-mode-1440.png`, fullPage: false })

  // the menu, and that it ANCHORS to its trigger (V4: a relationship, never a
  // CSS property - `position:absolute` is true of a menu parked anywhere).
  await page.click('[data-testid="cd-create"]')
  await page.waitForFunction(() =>
    !!document.querySelector('[data-testid="cd-create-menu"]'), { timeout: 8000 })
  const geo = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="cd-create"]').getBoundingClientRect()
    const m = document.querySelector('[data-testid="cd-create-menu"]').getBoundingClientRect()
    return { dTop: Math.round(m.top - b.bottom), dRight: Math.round(Math.abs(m.right - b.right)), mw: Math.round(m.width) }
  })
  console.log(`  menu geometry: ${JSON.stringify(geo)}`)
  check(Math.abs(geo.dTop) < 24 && geo.dRight < 24,
    `R4 the menu HANGS OFF its trigger (top gap ${geo.dTop}px, right offset ${geo.dRight}px)`)
  check(!!(await page.$('[data-testid="cd-create-test-bed"]'))
    && !!(await page.$('[data-testid="cd-create-opportunity"]')), 'R4 both kinds are in the menu')
  await page.screenshot({ path: `${OUT}contact-mode-menu-1440.png`, fullPage: false })

  // ── THE CREATE ACTUALLY CREATES ────────────────────────────────────────
  await page.click('[data-testid="cd-create-test-bed"]')
  const dialogue = await page.waitForFunction(() => {
    const m = document.getElementById('new-test-bed-modal')
    return !!m && !m.classList.contains('hidden')
  }, { timeout: 15000 }).then(() => true).catch(() => false)
  check(dialogue, "R4 the SHELL'S OWN name dialogue opened")
  await page.screenshot({ path: `${OUT}contact-mode-dialogue-1440.png`, fullPage: false })
  await page.evaluate(() => {
    const i = document.getElementById('new-test-bed-name')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(i, 'CMODE Bed From Contact')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('#new-test-bed-save')
  await new Promise((r) => setTimeout(r, 3000))
  const beds = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', 'CMODE Bed From Contact%'), 'beds')
  check(beds.length > 0, `R4 a Test Bed WAS created from the contact (${beds.length} found)`)
  check((beds[0]?.payload?.initialLead ?? '') === `${MARK} Contact`,
    `R4 and it carries the contact as its lead ("${beds[0]?.payload?.initialLead}")`)

  // ── LEAD MODE, WHICH MUST NOT HAVE MOVED ───────────────────────────────
  const l = await open(leadId, `${MARK} Lead`)
  console.log(`  lead:    ${JSON.stringify(l)}`)
  check(l.title === 'Lead details', `LEAD UNCHANGED: the title reads "${l.title}"`)
  check(l.chip === 'UNQUALIFIED', `LEAD UNCHANGED: the chip reads "${l.chip}"`)
  check(l.nurture === true, 'LEAD UNCHANGED: Nurture is still there')
  check(l.qualify === true, 'LEAD UNCHANGED: Qualify is still there')
  check(l.createControl === false, 'LEAD UNCHANGED: no create, which was always true of a lead')
  await page.screenshot({ path: `${OUT}lead-mode-1440.png`, fullPage: false })

  // ── THE DOOR ───────────────────────────────────────────────────────────
  const notMine = must(await db.from('records').select('id,owner_id')
    .eq('record_type', 'contact').eq('status', 'Qualified').is('deleted_at', null)
    .neq('owner_id', S.user.id).limit(1), 'nm')[0]
  // ITS OWN NAME, not "not the previous one". The first version waited for
  // the heading to DIFFER from the lead's, which is true while the element is
  // still absent - a wait the old state already satisfies (V7). It returned
  // mid-render and produced "0 of 0 fields editable", a comparison with
  // nothing on either side (V14), which is what gave the fault away.
  const nmName = (must(await db.from('record_revisions').select('payload,revision_number')
    .eq('record_id', notMine.id).order('revision_number', { ascending: false })
    .limit(1), 'nmname')[0]?.payload?.name) ?? ''
  await page.evaluate((r) => navigate('contact-detail', r), notMine.id)
  await page.waitForFunction((n) => {
    const v = document.getElementById('view-contact-detail')
    return !!v && v.querySelector('[data-testid="cd-lead-name"]')?.textContent === n
      && v.querySelectorAll('.lead-complete-cell').length > 0
  }, { timeout: 25000 }, nmName)
  await new Promise((r) => setTimeout(r, 1400))
  const door = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const inputs = [...v.querySelectorAll('.lead-complete-cell input, .lead-complete-cell select')].filter(vis)
    const create = v.querySelector('[data-testid="cd-create"]')
    return {
      editable: inputs.filter((e) => !e.disabled).length,
      visible: inputs.length,
      createPresent: !!create,
      createDead: !!create && (create.disabled || create.classList.contains('is-not-mine')
        || !!create.closest('.is-not-mine')),
      backAlive: !v.querySelector('[data-testid="cd-back"]')?.disabled,
    }
  })
  console.log(`  non-owner: ${JSON.stringify(door)}`)
  // BOTH SIDES MUST EXIST before the comparison means anything (V14).
  check(door.visible >= 14, `the non-owner can READ the fields (${door.visible} rendered)`)
  check(door.visible >= 14 && door.editable === 0,
    `THE DOOR IS SHUT: ${door.editable} of ${door.visible} fields editable`)
  check(door.createPresent === true, 'the Create control RENDERS for a non-owner, so the next line is not vacuous')
  check(door.createDead === true, 'and CREATE is neutralised for a non-owner - it is a write')
  check(door.backAlive === true, 'and the way OUT survives')
  await page.screenshot({ path: `${OUT}nonowner-1440.png`, fullPage: false })
} finally {
  await browser.close()
  const found = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', `${MARK}%`), 'find')
  const ids = [...new Set(found.map((r) => r.record_id))]
  for (const r of ids) {
    must(await db.from('records').update({ deleted_at: new Date().toISOString() })
      .eq('id', r).is('deleted_at', null), 'soft')
  }
  const left = must(await db.from('records').select('id,deleted_at')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']), 're')
  console.log(`\nteardown: ${left.length} found (contacts AND anything created from them), ${left.filter((r) => !r.deleted_at).length} still live`)
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
process.exit(bad.length ? 1 : 0)
