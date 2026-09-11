// A2, A4, A6 on the LIVE Lead Detail screen.
//
// Phase 0 named the instrument for these: the door census enumerates controls
// mechanically, but blur, Escape and navigation are only observable in a real
// document. This is that probe, and it is deliberately a MEASUREMENT first -
// it reports what the screen does before anything is built, so A2's "highlight"
// is identified rather than assumed.
//
// BUNDLE FRESHNESS FIRST, per the standing requirement recorded in the brief:
// the served bundle is a second reader of the source, and P1 proved a stale
// label ships behind a green suite. This refuses to measure a stale bundle.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-lead-detail-behaviour.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const TAG = 'leadbeh'
const OUT = `${ROOT}/.verify/leads/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const call = async (m, p, b) => (await api(m, p, b)).data

try {
  execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' })
  console.log('  bundle freshness: PASS (the served bundle is this source)')
} catch (e) {
  console.error('  bundle freshness: FAIL - refusing to measure a stale bundle.')
  console.error(`  ${(e.stdout ?? e.stderr ?? '').toString().slice(-300)}`)
  process.exit(2)
}

let lead = null
const browser = await puppeteer.launch({ headless: 'new' })
try {
  const industry = (await call('GET', '/industries'))[0]
  lead = await call('POST', '/contacts', {
    name: `${TAG} Lead`, company: 'Behaviour Holdings', jobRole: 'Head of Infrastructure',
    email: `${TAG}@example.invalid`, mobile: '+65 9000 0005', source: 'Direct Outreach',
    industry_id: industry.id,
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })

  const openLead = async () => {
    await page.evaluate((id) => navigate('contact-detail', id), lead.id)
    await page.waitForFunction(() => {
      const v = document.getElementById('view-contact-detail')
      return v && !v.classList.contains('is-loading') && v.textContent.includes('Behaviour Holdings')
    }, { polling: 150, timeout: 30000 })
  }
  await openLead()

  // ── A2: WHAT IS THE "FOCUS HIGHLIGHT", AND DOES IT PERSIST? ─────────────
  //
  // Open one row, then open another, and report the FIRST row's state. The
  // brief says a highlight persists after moving to another field; this names
  // what persists rather than assuming it is a CSS focus ring.
  // ONE INTERACTION, THEN YIELD, THEN ASSERT. The first version of this did
  // both clicks and all three reads inside ONE page.evaluate and reported every
  // row closed - because React re-renders asynchronously and a synchronous read
  // after a synchronous dispatch measures the PREVIOUS frame. Verification 6's
  // clause, hit exactly as written.
  const snapIn = (name) => `(() => {
    const q = (t) => document.querySelector('[data-testid="' + t + '"]')
    const r = document.querySelector('.field-row[data-field="${name}"]')
    const edit = q('edit-${name}'), disp = q('display-${name}')
    return {
      open: edit ? !edit.hasAttribute('hidden') : null,
      dirty: r ? r.getAttribute('data-dirty') : null,
      rowClass: r ? r.className : null,
      displayFocused: disp === document.activeElement,
      active: document.activeElement ? (document.activeElement.getAttribute('data-testid') || document.activeElement.tagName) : null,
    }
  })()`
  const snap = (name) => page.evaluate(snapIn(name))
  // Plain concatenation, not a nested template. The first attempt built these
  // selectors with a template inside a template and emitted the literal text
  // "${n}" into the query, which matched nothing and timed out - a probe fault
  // that reads exactly like "the row will not open".
  const clickRow = async (name) => {
    await page.evaluate((n) => {
      const el = document.querySelector('[data-testid="display-' + n + '"]')
      if (!el) throw new Error('no display row for ' + n)
      el.click()
    }, name)
    await page.waitForFunction((n) => {
      const e = document.querySelector('[data-testid="edit-' + n + '"]')
      return !!e && !e.hasAttribute('hidden')
    }, { polling: 50, timeout: 5000 }, name)
  }
  await clickRow('company')
  const afterFirst = await snap('company')
  await clickRow('jobRole')
  const a2 = { afterFirst, companyAfterSecond: await snap('company'), jobRoleAfterSecond: await snap('jobRole') }
  console.log('\n  A2 - what happens to row 1 when row 2 is opened:')
  console.log(`     company, just opened:        ${JSON.stringify(a2.afterFirst)}`)
  console.log(`     company, after opening next: ${JSON.stringify(a2.companyAfterSecond)}`)
  console.log(`     jobRole, now open:           ${JSON.stringify(a2.jobRoleAfterSecond)}`)

  // ── A4: DOES A DIRTY EDIT SURVIVE NAVIGATION? ───────────────────────────
  const a4 = await page.evaluate(() => {
    const q = (t) => document.querySelector(`[data-testid="${t}"]`)
    const el = q('input-company')
    if (!el) return { typed: false }
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(el, 'EDITED NOT SAVED')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return { typed: true, dirtyCount: q('dirty-count')?.textContent ?? null }
  })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    return !v || v.hasAttribute('hidden') || v.offsetParent === null
  }, { polling: 150, timeout: 15000 }).catch(() => {})
  await openLead()
  const a4back = await page.evaluate(() => {
    const q = (t) => document.querySelector(`[data-testid="${t}"]`)
    return {
      dirtyCount: q('dirty-count')?.textContent ?? null,
      barHidden: q('edit-bar')?.hasAttribute('hidden') ?? null,
      companyDisplay: q('display-company')?.textContent?.trim() ?? null,
      companyOpen: q('edit-company') ? !q('edit-company').hasAttribute('hidden') : null,
      inputValue: q('input-company')?.value ?? null,
    }
  })
  console.log('\n  A4 - a dirty edit, then navigate away and back:')
  console.log(`     before leaving: typed=${a4.typed} dirty=${JSON.stringify(a4.dirtyCount)}`)
  console.log(`     after returning: ${JSON.stringify(a4back)}`)
  console.log(`     VERDICT: ${a4back.dirtyCount && a4back.dirtyCount !== '0 changes'
    ? 'EDIT SURVIVED navigation - the A4 regression is present'
    : 'no edit survived'}`)

  await page.screenshot({ path: `${OUT}lead-detail-behaviour.png`, fullPage: false })
  console.log(`\n  screenshot ${OUT}lead-detail-behaviour.png`)
} finally {
  await browser.close()
  const swept = await tearDown(TAG)
  console.log(`  teardown: ${swept.removed.length} swept, ${swept.remaining} remaining`)
}
