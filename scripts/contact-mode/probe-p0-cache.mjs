// Phase 0 Q1's caveat, measured rather than reasoned.
//
// `window.createFromContact` warns when the contact already has a linked
// record of that type. It finds the contact's NAME in `contactsCache`, a
// module-scope `let` in app.js - so it is NOT on window and cannot be read
// from a probe (Migration Round 2's declaration table). The OBSERVABLE
// consequence is measured instead: which modal opens.
//
// NO WRITES. The dialogue is opened and closed; Save is never clicked.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-cache.mjs')
import { readFileSync } from 'node:fs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const SUBJECT = process.argv[2]

const whichModal = async (page) => page.evaluate(() => {
  const open = (id) => {
    const el = document.getElementById(id)
    return !!el && !el.classList.contains('hidden')
  }
  return { warning: open('linked-records-modal'), name: open('new-test-bed-modal') }
})

const b = await puppeteer.launch({ headless: 'new' })
const run = async (label, viaList) => {
  const page = await b.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  if (viaList) {
    await page.evaluate(() => navigate('contacts'))
    await page.waitForFunction(() =>
      document.querySelectorAll('#contacts-rows [onclick*="contact-detail"]').length > 0,
    { timeout: 20000 }).catch(() => {})
  }
  await page.evaluate((id) => navigate('contact-detail', id), SUBJECT)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    return !!v && !!v.querySelector('[data-testid="contact-host"]')
  }, { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 1200))
  const before = await whichModal(page)
  await page.evaluate((id) => window.createFromContact(id, 'opportunity'), SUBJECT)
  await new Promise((r) => setTimeout(r, 2000))
  const after = await whichModal(page)
  console.log(`  ${label.padEnd(34)} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
  await page.close()
  return after
}
console.log(`subject ${SUBJECT} (3 existing linked opportunities)\n`)
const viaList = await run('visited the Contacts list first', true)
const direct = await run('landed on contact-detail directly', false)
await b.close()

const say = (r) => (r.warning ? 'WARNING shown' : r.name ? 'name dialogue, NO warning' : 'nothing opened')
console.log(`\n  via the list : ${say(viaList)}`)
console.log(`  direct       : ${say(direct)}`)
console.log(viaList.warning && !direct.warning
  ? '\n  => THE WARNING DEPENDS ON HAVING VISITED THE LIST.'
  : viaList.warning && direct.warning
    ? '\n  => the warning fires on BOTH paths.'
    : '\n  => inconclusive: it did not fire even via the list. Read before trusting.')
