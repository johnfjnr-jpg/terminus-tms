// R1, third pass. The second pass read 0 matches for "e" while the database
// says three account names contain one. Verification 14: the failure detail
// carries the CAUSE's own answer, so this reads the input's VALUE back beside
// the match count. Two candidate causes and they are not the same finding:
//   - the probe's replace did not land (a probe fault), or
//   - the picker does not re-filter on a replaced query (a product defect).
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0c-lcuf.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/lcuf/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const industry = must(await db.from('industries').select('id').limit(1), 'ind')[0]
const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
  owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), 'lead')
must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
  payload: { name: 'lcuf0c Picker', company: 'UI Fixes Co', source: 'Referral', jobRole: 'Head',
    email: 'lcuf0c@example.invalid', mobile: '+65 9000 0179', linkedin: 'https://example.invalid/in/x',
    address: '1 Way', city: 'Singapore', postcode: '069118', country: 'Singapore', region: 'APAC',
    summary: 'Ready.' }, created_by: OWNER.user.id }).select().single(), 'rev')

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
    { timeout: 25000 }, r.id)
  await page.click(`[data-testid="lead-qualify-${r.id}"]`)
  await page.waitForSelector(`[data-testid="lead-account-step-${r.id}"]`, { timeout: 15000 })
  const sel = `[data-testid="lead-account-step-${r.id}"] [data-testid="cd-link-search"]`
  const read = async (label) => {
    // Yield first: Verification 6's framework clause, never assert in the same
    // synchronous evaluation as the interaction.
    await new Promise((x) => setTimeout(x, 350))
    const s = await page.evaluate((x) => {
      const step = document.querySelector(`[data-testid="lead-account-step-${x}"]`)
      const input = step.querySelector('[data-testid="cd-link-search"]')
      const res = step.querySelector('[data-testid="cd-link-results"]')
      const boxes = [...res.querySelectorAll('button')].filter((b) => b.dataset.testid !== 'cd-link-create')
      const create = step.querySelector('[data-testid="cd-link-create"]')
      const cr = create?.getBoundingClientRect(); const ir = input.getBoundingClientRect()
      return { value: input.value, n: boxes.length, labels: boxes.map((b) => b.textContent.trim()),
        rows: new Set(boxes.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        createShown: !!create,
        createRightOfInput: cr ? cr.left >= ir.right - 2 && cr.top < ir.bottom : null,
        createBelowInput: cr ? cr.top >= ir.bottom - 2 : null }
    }, r.id)
    console.log(`  ${label.padEnd(26)} input="${s.value}"  ${s.n} boxes/${s.rows} row(s)  create ${s.createShown ? (s.createRightOfInput ? 'RIGHT of input' : s.createBelowInput ? 'BELOW input' : 'elsewhere') : 'hidden'}   ${JSON.stringify(s.labels)}`)
    return s
  }
  console.log('R1: the picker, keystroke by keystroke')
  await page.click(sel)
  await page.keyboard.type('a'); const a1 = await read('type "a"')
  await page.keyboard.press('Backspace'); await read('backspace to empty')
  await page.keyboard.type('e'); const e1 = await read('type "e" from empty')
  // The second pass used triple-click + type. Re-run exactly that, to see
  // whether the 0 was the replace failing rather than the filter.
  await page.click(sel, { clickCount: 3 })
  await page.keyboard.type('o'); const o1 = await read('triple-click, type "o"')
  await page.click(sel, { clickCount: 3 })
  await page.keyboard.type('zzz'); await read('triple-click, type "zzz"')
  console.log(`\n  VERDICT: replace lands = ${o1.value === 'o'}   filter re-runs on replace = ${o1.n > 0}`)
  console.log(`  "e" from empty gave ${e1.n} boxes with input="${e1.value}"`)
  await page.screenshot({ path: `${OUT}lcuf-p0c-picker-zzz-1920.png`, clip: await page.evaluate((x) => {
    const b = document.querySelector(`[data-testid="lead-card-${x}"]`).getBoundingClientRect()
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: Math.min(b.height, 700) } }, r.id) })
} finally {
  await browser.close()
  await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
  const live = must(await db.from('records').select('id').eq('id', r.id).is('deleted_at', null), 'teardown')
  console.log(`\nteardown: 1 soft-deleted, ${live.length} still live`)
}
