// THE BASELINE, taken BEFORE anything changes.
//
// Phase 0's own closing note: "no live measurement of contact-detail - it
// was read, not driven. Phase 1 must screenshot it BEFORE, or the parity
// claim has no baseline." This is that screenshot, plus a census of what
// the screen offers, so "nothing was lost" is a comparison rather than an
// assertion.
//
// READ-ONLY. It drives a REAL Qualified contact and changes nothing.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-baseline.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/rsc/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }

// A REAL Qualified contact - the population the screen actually serves.
// Not a fixture: the claim is about what the ten live contacts see.
const real = must(await db.from('records')
  .select('id,parent_record_id,owner_id')
  .eq('record_type', 'contact').eq('status', 'Qualified')
  .is('deleted_at', null).limit(10), 'q')
const mine = real.filter((r) => r.owner_id === OWNER.user.id)
console.log(`  ${real.length} live Qualified contacts; ${mine.length} owned by the probe identity`)
const subject = mine[0] ?? real[0]
console.log(`  baseline subject: ${subject.id}  (owned by me: ${subject.owner_id === OWNER.user.id})\n`)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const shots = {}
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1400 })
    await page.evaluate((id) => navigate('contact-detail', id), subject.id)
    await page.waitForFunction(() => {
      const v = document.getElementById('view-contact-detail')
      return !!v && !v.classList.contains('hidden')
        && !!v.querySelector('[data-testid="cd-card-contact"], [data-testid="contact-panel"]')
    }, { timeout: 25000 })
    await new Promise((r) => setTimeout(r, 900))
    const el = await page.$('#view-contact-detail')
    await el.screenshot({ path: `${OUT}rsc-baseline-${w}.png` })
    shots[w] = true
  }
  // THE CAPABILITY CENSUS, live: what a person can actually reach today.
  const live = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const t = (id) => !!v.querySelector(`[data-testid="${id}"]`)
    const controls = [...v.querySelectorAll('button, input, textarea, select')]
    return {
      cards: [...v.querySelectorAll('[data-testid^="cd-card-"]')].map((e) => e.dataset.testid),
      qualify: t('cd-btn-qualify'), park: t('cd-btn-park'),
      createSection: t('cd-create-section'),
      createTestBed: t('cd-create-test-bed'), createOpportunity: t('cd-create-opportunity'),
      accountStatus: v.querySelector('[data-testid="cd-account-status"]')?.textContent?.trim() ?? null,
      notes: t('cd-notes'), followUp: t('cd-card-followup'),
      controlCount: controls.length,
      fieldRows: v.querySelectorAll('.field-row').length,
    }
  })
  console.log('=== THE BASELINE, live ===')
  for (const [k, val] of Object.entries(live)) console.log(`  ${k.padEnd(18)} ${JSON.stringify(val)}`)
  writeFileSync(`${OUT}baseline.json`, JSON.stringify({ subject: subject.id, live }, null, 1))
  console.log(`\n  captured at 1240, 1920, 3440: ${Object.keys(shots).join(' ')}`)
  console.log('  NOTHING WAS CHANGED by this probe.')
} finally { await browser.close() }
