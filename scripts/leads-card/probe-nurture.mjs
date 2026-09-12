// R2: Nurture opens the follow-up dialogue and moves the lead.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-nurture.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/leads-card/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const TAG = 'p2nurt'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}`); if (d) console.log(`        ${d}`) }
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch { process.exit(2) }
const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const lead = must(await db.from('records').insert({
  record_type: 'contact', status: 'Unqualified', owner_id: OWNER.user.id, industry_id: industry.id,
}).select().single(), 'lead')
must(await db.from('record_revisions').insert({
  record_id: lead.id, revision_number: 1,
  payload: { name: `${TAG} ToNurture`, company: 'Nurt Co' }, created_by: OWNER.user.id,
}).select().single(), 'rev')
const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-card-${id}"]`),
    { timeout: 20000 }, lead.id)

  await page.click(`[data-testid="lead-nurture-${lead.id}"]`)
  await page.waitForSelector('[data-testid="nurture-dialog"]', { timeout: 10000 })
  check('Nurture opens the follow-up dialogue', true, 'date and reason')

  // REFUSES WITHOUT A DATE, which is the gate Unqualified -> Nurture carries.
  await page.type('[data-testid="nurture-reason"]', 'Budget deferred to next quarter')
  await page.click('[data-testid="nurture-save"]')
  await page.waitForSelector('[data-testid="nurture-error"]', { timeout: 8000 })
  const err = await page.$eval('[data-testid="nurture-error"]', (e) => e.textContent)
  check('it refuses without a follow-up date', /date is required/i.test(err), `"${err}"`)
  await page.screenshot({ path: `${OUT}p2-nurture.png` })

  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="nurture-date"]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(el, '2026-12-01')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  // THE COUNTER, NOT THE DIALOGUE CLOSING. The dialogue closes BEFORE the
  // list's reload resolves, so waiting on its absence reads the pipeline
  // mid-refresh - the first run found the status already Nurture in the
  // database and the card still under Unqualified on screen. P4 built
  // `data-fetch` for exactly this and the counter is the real state.
  const fetchesBefore = await page.$eval('[data-testid="leads-list"]', (e) => e.dataset.fetch)
  await page.click('[data-testid="nurture-save"]')
  await page.waitForFunction((before) => {
    const el = document.querySelector('[data-testid="leads-list"]')
    return !document.querySelector('[data-testid="nurture-dialog"]')
      && el && el.dataset.fetch !== before
  }, { timeout: 20000 }, fetchesBefore)

  const after = must(await db.from('records').select('status').eq('id', lead.id).single(), 'after')
  const rev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', lead.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  check('the lead moves to Nurture', after.status === 'Nurture', `status ${after.status}`)
  check('and the date and reason are recorded first',
    rev.payload?.followUpDate === '2026-12-01' && /Budget deferred/.test(String(rev.payload?.followUpDescription)),
    `date ${rev.payload?.followUpDate}, reason "${String(rev.payload?.followUpDescription).slice(0, 40)}"`)
  const group = await page.evaluate((id) => {
    const c = document.querySelector(`[data-testid="lead-card-${id}"]`)
    return c?.closest('section.lead-group')?.getAttribute('data-testid')?.replace('lead-group-', '') ?? null
  }, lead.id)
  check('and the card moves into the Nurture group', group === 'Nurture', `group: ${group}`)
  await page.screenshot({ path: `${OUT}p2-nurtured.png` })
} finally {
  await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', lead.id)
  console.log(`\n  soft deleted 1`)
  await browser.close()
}
const f = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - f.length}/${results.length} checks pass`)
process.exit(f.length ? 1 : 0)
