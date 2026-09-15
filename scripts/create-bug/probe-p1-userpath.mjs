// Phase 1: the USER PATH, driven by CLICKING the controls a person clicks.
//
// NOTHING HERE CALLS createFromContact. R4's probe clicked the trigger too and
// passed - the defect arrived later - but its assertion was that the menu was
// IN THE DOM. The menu was in the DOM the whole time this bug existed; it was
// hidden. So the assertion here is VISIBILITY, which is what a person has.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p1-userpath.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/create-bug/`
mkdirSync(OUT, { recursive: true })
const MARK = 'CFIX'
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const checks = []
const check = (ok, what) => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`) }
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('BUNDLE STALE'); process.exit(2) }

const industry = (await api('GET', '/industries')).data[0]
const id = (await api('POST', '/contacts', {
  name: `${MARK} Contact`, company: `${MARK} Co`, jobRole: 'Engineer',
  email: 'cfix@example.com', mobile: '+60123456789', industry_id: industry.id,
  source: 'Web', address: '1 Fixture Street', city: 'Singapore', postcode: '018956',
  country: 'Singapore', region: 'APAC', summary: 'A create-fix fixture.',
})).data?.id
const acct = must(await db.from('records').select('id').eq('record_type', 'account')
  .is('deleted_at', null).limit(1), 'acct')[0]
must(await db.from('records').update({ status: 'Qualified', parent_record_id: acct.id }).eq('id', id), 'promote')

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1100 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((r) => navigate('contact-detail', r), id)
  await p.waitForFunction((n) => {
    const v = document.getElementById('view-contact-detail')
    return !!v && v.querySelector('[data-testid="cd-lead-name"]')?.textContent === n
  }, { timeout: 25000 }, `${MARK} Contact`)
  await new Promise((r) => setTimeout(r, 1200))

  const shown = () => p.evaluate(() => {
    const m = document.querySelector('[data-testid="cd-create-menu"]')
    if (!m) return { inDom: false, visible: false }
    const r = m.getBoundingClientRect()
    return { inDom: true, visible: r.height > 0 && r.width > 0 && !m.classList.contains('hidden') }
  })

  check((await shown()).inDom === false, 'the menu starts closed')
  // THE CLICK. Not a call.
  await p.click('[data-testid="cd-create"]')
  await new Promise((r) => setTimeout(r, 800))
  const open = await shown()
  console.log(`  after clicking Create: ${JSON.stringify(open)}`)
  check(open.inDom === true, 'CLICKING Create renders the menu')
  check(open.visible === true,
    'and the menu is VISIBLE - the assertion the old probe lacked, because the bug left it in the DOM and hidden')
  await p.screenshot({ path: `${OUT}p1-menu-open.png` })

  // THE SECOND CLICK, still a click.
  await p.click('[data-testid="cd-create-test-bed"]')
  const dlg = await p.waitForFunction(() => {
    const m = document.getElementById('new-test-bed-modal')
    return !!m && !m.classList.contains('hidden') && m.getBoundingClientRect().height > 0
  }, { timeout: 15000 }).then(() => true).catch(() => false)
  check(dlg, 'clicking Test Bed opens the shared dialogue')
  await p.screenshot({ path: `${OUT}p1-dialogue.png` })

  await p.evaluate(() => {
    const i = document.getElementById('new-test-bed-name')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(i, 'CFIX Bed From Detail')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await p.click('#new-test-bed-save')
  await new Promise((r) => setTimeout(r, 3000))
  const beds = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', 'CFIX Bed From Detail%'), 'beds')
  check(beds.length > 0, `a Test Bed was created from the DETAIL screen by clicking (${beds.length})`)
  check((beds[0]?.payload?.initialLead ?? '') === `${MARK} Contact`,
    `and it carries the contact ("${beds[0]?.payload?.initialLead}")`)

  // Escape still closes it, and the LIST is not regressed by the scoping.
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((r) => navigate('contact-detail', r), id)
  await p.waitForFunction(() => !!document.querySelector('[data-testid="cd-create"]'), { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 900))
  await p.click('[data-testid="cd-create"]')
  await new Promise((r) => setTimeout(r, 500))
  check((await shown()).visible === true, 'it opens again on a fresh load')
  await p.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 500))
  check((await shown()).inDom === false, 'and Escape closes it')

  await p.evaluate(() => navigate('contacts'))
  await p.waitForFunction(() => document.querySelectorAll('.contact-create-trigger').length > 0, { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 1200))
  await p.click('.contact-create-trigger')
  await new Promise((r) => setTimeout(r, 700))
  const listOpen = await p.evaluate(() =>
    [...document.querySelectorAll('.contact-create-hover .contact-create-dropdown')]
      .filter((d) => !d.classList.contains('hidden')).length)
  check(listOpen === 1, `THE LIST IS NOT REGRESSED by the scoping: ${listOpen} menu open on click`)
  await p.click('body')
  await new Promise((r) => setTimeout(r, 500))
  const listClosed = await p.evaluate(() =>
    [...document.querySelectorAll('.contact-create-hover .contact-create-dropdown')]
      .filter((d) => !d.classList.contains('hidden')).length)
  check(listClosed === 0, 'and the list still closes on an outside click')
  await p.screenshot({ path: `${OUT}p1-list.png` })
} finally {
  await b.close()
  const found = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', `${MARK}%`), 'find')
  const ids = [...new Set(found.map((r) => r.record_id))]
  for (const r of ids) {
    must(await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r).is('deleted_at', null), 'soft')
  }
  const left = must(await db.from('records').select('id,deleted_at').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']), 're')
  console.log(`\nteardown: ${left.length} found, ${left.filter((r) => !r.deleted_at).length} live`)
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
process.exit(bad.length ? 1 : 0)
