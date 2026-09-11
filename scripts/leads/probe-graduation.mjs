// R9: A LEAD THAT QUALIFIES GRADUATES OFF THE LEADS PIPELINE.
//
//   The Leads screen shows Unqualified and Nurture only. On qualification a
//   lead graduates off the Leads pipeline and is worked as a Contact.
//
// BOTH HALVES, AND BY MEMBERSHIP RATHER THAN BY A HEADING. "No Qualified
// group" is satisfied by a screen that renders no groups at all, by a fetch
// that failed, and by a lead that was never qualified. So this follows ONE
// record by id across both screens, before and after the transition:
//
//   before  on Leads, not on Contacts
//   after   NOT on Leads, on Contacts
//
// The before half is what makes the after half mean anything: without it, "not
// on Leads" is equally true of a record that never arrived.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-graduation.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const TAG = 'p4grad'
const OUT = `${ROOT}/.verify/leads/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const call = async (m, p, b) => (await api(m, p, b)).data
const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED'); process.exit(2)
}

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const industry = (await call('GET', '/industries'))[0]
  const account = (await call('GET', '/accounts'))[0]
  const lead = await call('POST', '/contacts', {
    name: `${TAG} Lead`, company: 'Graduate Holdings', jobRole: 'Head of Infrastructure',
    email: `${TAG}@example.invalid`, mobile: '+65 9000 0013', source: 'Direct Outreach',
    linkedin: 'https://example.invalid/in/grad', industry_id: industry.id,
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })

  // WAIT ON A COMPLETED FETCH, not on the list existing. The list exists from
  // the previous visit, so waiting on it reads the OLD data - which is exactly
  // what happened: a lead that had just qualified still read as present on the
  // Leads screen, and the probe reported R9 unbuilt.
  const onLeads = async () => {
    const before = await page.evaluate(() => document.getElementById('live-leads-rows')
      ?.querySelector('[data-testid="leads-list"]')?.getAttribute('data-fetch') ?? null)
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((prev) => {
      const el = document.getElementById('live-leads-rows')?.querySelector('[data-testid="leads-list"]')
      return !!el && el.getAttribute('data-fetch') !== prev
    }, { polling: 100, timeout: 20000 }, before)
    return page.evaluate((id) => {
      const c = document.getElementById('live-leads-rows')
      return {
        present: !!c.querySelector(`[data-testid="lead-card-${id}"]`),
        groups: [...c.querySelectorAll('[data-testid^="lead-group-title-"]')].map((e) => e.textContent.trim()),
        cards: c.querySelectorAll('[data-testid^="lead-card-"]').length,
      }
    }, lead.id)
  }
  const onContacts = async () => {
    await page.evaluate(() => navigate('contacts'))
    await page.waitForFunction(() => {
      const v = document.getElementById('view-contacts')
      return !!v && !v.classList.contains('hidden')
    }, { polling: 150, timeout: 20000 })
    // The Contacts grid is the vanilla one and publishes no such counter, so
    // this waits on its rows being rendered at all and then polls for the
    // name - bounded, and never a bare delay.
    const found = await page.waitForFunction((name) => {
      const v = document.getElementById('view-contacts')
      if (!v || v.classList.contains('hidden')) return false
      return (v.innerText ?? '').includes(name) ? true : null
    }, { polling: 200, timeout: 8000 }, `${TAG} Lead`).then(() => true).catch(() => false)
    return { present: found }
  }

  // ── BEFORE ──────────────────────────────────────────────────────────
  const leadsBefore = await onLeads()
  const contactsBefore = await onContacts()
  check('BEFORE: the Unqualified lead IS on the Leads screen',
    leadsBefore.present, `groups ${JSON.stringify(leadsBefore.groups)}, ${leadsBefore.cards} cards`)
  check('BEFORE: and is NOT on Contacts', !contactsBefore.present, `${contactsBefore.present}`)

  // ── QUALIFY IT, through the real gate ───────────────────────────────
  await call('PATCH', `/contacts/${lead.id}`, { payload: {
    address: '1 Graduate Way', city: 'Singapore', postcode: '018956',
    country: 'Singapore', region: 'Asia Pacific', summary: 'Ready to qualify.' } })
  await call('POST', `/contacts/${lead.id}/link-account`, { account_id: account.id })
  await call('POST', `/records/${lead.id}/transition`, { to_stage: 'Qualified' })
  const status = must(await db.from('records').select('status').eq('id', lead.id), 'status')[0].status
  check('the lead is Qualified in the database', status === 'Qualified', status)

  // ── AFTER ───────────────────────────────────────────────────────────
  const leadsAfter = await onLeads()
  await page.screenshot({ path: `${OUT}p4-graduated.png`, fullPage: true })
  const contactsAfter = await onContacts()

  check('AFTER: the Qualified lead has LEFT the Leads screen',
    !leadsAfter.present, `present=${leadsAfter.present}, ${leadsAfter.cards} cards remain`)
  check('AFTER: and it appears on Contacts', contactsAfter.present, `${contactsAfter.present}`)
  check('the Leads screen shows ONLY Unqualified and Nurture (R9)',
    leadsAfter.groups.length === 2
      && leadsAfter.groups.some((g) => /^Unqualified/.test(g))
      && leadsAfter.groups.some((g) => /^Nurture/.test(g)),
    JSON.stringify(leadsAfter.groups))
  check('empty stage headings are SHOWN (R10)',
    leadsAfter.groups.some((g) => /\s0$/.test(g)) || leadsAfter.groups.length === 2,
    JSON.stringify(leadsAfter.groups))
  check('no stage-mismatch warning: the pipeline names match the configuration',
    !(await page.evaluate(() => !!document.querySelector('[data-testid="leads-stage-mismatch"]'))),
    'the LEADS_PIPELINE guard is quiet')

  await page.close()
} finally {
  await browser.close()
  const swept = await tearDown(TAG)
  console.log(`\n  teardown: ${swept.removed.length} swept, ${swept.remaining} remaining`)
}
const failed = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - failed.length}/${results.length} verified`)
process.exit(failed.length ? 1 : 0)
