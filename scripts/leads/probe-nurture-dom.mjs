// R1's surface half, verified by LIVE DOM.
//
// The instruction is explicit: where P1 touches a surface, verify by live DOM
// rather than by the suites. Two reasons it matters here beyond the rule.
//
// The standing qualification is in force - 52 assertions across 8 gate suites
// are made against dead -vanilla markup, so their green says nothing about a
// live screen.
//
// AND THE REACT SUITE PASSED 932/932 WITH THE STRING CHANGED, which is the
// sharper reason. If any test asserted "Parked lead", changing it to "Nurture
// lead" would have gone red. Nothing did, so the label is UNASSERTED and the
// suite is not evidence about it either way. Only the screen is.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-nurture-dom.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const API = 'http://localhost:3000/api'
const TAG = 'leaddom'
const OUT = `${ROOT}/.verify/leads/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

// Every call here is setup and every one must succeed, so the shared client's
// throw-on-non-2xx IS the assertion. Nothing is expected to refuse.
const call = async (method, path, body) => (await api(method, path, body)).data

let lead = null
try {
  const industry = (await call('GET', '/industries'))[0]
  lead = await call('POST', '/contacts', {
    name: `${TAG} Lead`, company: 'DOM Holdings', jobRole: 'Head of Infrastructure',
    email: `${TAG}@example.invalid`, mobile: '+65 9000 0004', source: 'Direct Outreach',
    industry_id: industry.id,
  })
  await call('PATCH', `/contacts/${lead.id}`, { payload: { followUpDate: '2026-12-01' } })
  await call('POST', `/records/${lead.id}/transition`, { to_stage: 'Nurture' })
  const status = must(await db.from('records').select('status').eq('id', lead.id), 'status')[0].status
  console.log(`  fixture is at status: ${status}`)

  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('contact-detail', id), lead.id)

  // Wait on a condition the PREVIOUS screen cannot satisfy: this record's own
  // id present AND the view settled (Verification 7's counterfactual).
  await page.waitForFunction((want) => {
    const v = document.getElementById('view-contact-detail')
    if (!v || v.classList.contains('is-loading')) return false
    return v.textContent.includes(want)
  }, { polling: 200, timeout: 30000 }, 'DOM Holdings')

  const seen = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const t = v?.innerText ?? ''
    // CASE-INSENSITIVE, and that is a correction rather than a convenience.
    // The first version tested /Nurture lead/ and failed against a live screen
    // that was correct: the element is CSS `text-transform: uppercase`, and
    // innerText returns the TRANSFORMED text, so the DOM reads "NURTURE LEAD".
    // An assertion about what a person SEES has to match what is rendered, not
    // what the source typed.
    return { hasNurture: /nurture lead/i.test(t), hasParked: /parked/i.test(t),
      snippet: t.split('\n').filter(Boolean).slice(0, 6).join(' | ') }
  })
  console.log(`  live DOM says "Nurture lead": ${seen.hasNurture}`)
  console.log(`  live DOM still says "Parked": ${seen.hasParked}`)
  console.log(`  header: ${seen.snippet.slice(0, 130)}`)

  const el = await page.$('#view-contact-detail')
  await el.screenshot({ path: `${OUT}nurture-lead.png` })
  console.log(`  screenshot ${OUT}nurture-lead.png`)
  await browser.close()

  // BOTH halves. "Nurture lead" appearing is not enough on its own: the old
  // label must be GONE, which is the second claim a move always needs.
  if (!seen.hasNurture || seen.hasParked) {
    console.log('\n  FAILED')
    process.exit(1)
  }
  console.log('\n  PASS: the relabel is on the screen, and the old label is not')
} finally {
  const swept = await tearDown(TAG)
  console.log(`  teardown: ${swept.removed.length} swept, ${swept.remaining} remaining`)
}
