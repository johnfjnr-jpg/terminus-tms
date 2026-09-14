// The completion surface, photographed as production opens it.
//
// WHY A FIXTURE: the probe identity owns NONE of the 6 live leads, so the door
// correctly neutralises Qualify on every one and the surface cannot be opened.
// V47's clause - where one account cannot reach the state, build it and say so.
// The lead is created THROUGH THE ROUTE, the way the system makes one.
//
// TEARDOWN IS SOFT (V11) and enumerated from the DATABASE by the tag the
// fixture carries, never from a file this script wrote.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('shot-completion.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
// THE ESTATE'S THROWING CLIENT, not a raw fetch. The gate refused this file's
// first version for exactly that: a bare fetch bypasses the client, so a
// non-2xx goes silent. V9's ratchet clause - the refusal was information
// about the probe, not an obstacle in front of it.
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/contact-swap/`
mkdirSync(OUT, { recursive: true })
const TAG = process.argv[2] ?? 'today'
const W = Number(process.argv[3] ?? 1440)
const MARK = 'SWAPSHOT-FIXTURE'

const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('BUNDLE IS STALE'); process.exit(2) }
console.log('bundle freshness: OK')

const inds = await api('GET', '/industries')
const industryId = inds.data?.[0]?.id
if (!industryId) { console.error('no industry'); process.exit(2) }

// Only the seven REQUIRED fields, so the address group and summary are missing
// and the completion surface has something to show.
// FULL=1 fills every field the surface renders, leaving only `summary` (which
// is edited OUTSIDE the surface, by R3's mark-don't-point rule) unfilled. The
// surface then opens - summary still blocks - showing fourteen POPULATED
// fields and no asterisks, which is the closest the current build can come to
// "this surface as a detail view of a complete record" without building it.
const FULL = process.env.FULL === '1'
const made = await api('POST', '/contacts', {
  name: `${MARK} Ada`, company: `${MARK} Co`, jobRole: 'Engineer',
  email: 'swapshot@example.com', mobile: '+60123456789',
  industry_id: industryId, source: 'Web',
  ...(FULL ? {
    linkedin: 'https://www.linkedin.com/in/ada-swapshot/',
    address: '12 Jalan Ampang', address2: 'Level 8, Menara Bangsar',
    city: 'Kuala Lumpur', postcode: '50450', country: 'Malaysia', region: 'APAC',
  } : {}),
})
const leadId = made.data?.id ?? made.data?.record?.id
console.log(`fixture lead: ${leadId}`)

let shot = null
const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-qualify-${id}"]`),
    { timeout: 25000 }, leadId)

  const owned = await page.evaluate((id) =>
    !document.querySelector(`[data-testid="lead-card-${id}"]`)?.classList.contains('is-not-mine'), leadId)
  console.log(`  fixture is owned by the probe identity (door open): ${owned}`)

  await page.click(`[data-testid="lead-qualify-${leadId}"]`)
  // Counterfactual: this testid exists ONLY once the completion surface opened.
  await page.waitForFunction((id) =>
    !!document.querySelector(`[data-testid="lead-incomplete-${id}"]`), { timeout: 20000 }, leadId)
  await new Promise((r) => setTimeout(r, 900))

  await page.screenshot({ path: `${OUT}completion-${TAG}-${W}.png`, fullPage: false })
  shot = await page.evaluate((id) => {
    const s = document.querySelector(`[data-testid="lead-incomplete-${id}"]`)
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const inputs = [...s.querySelectorAll('input,select,textarea')].filter(vis)
    return {
      eyebrow: s.querySelector('.eyebrow')?.textContent ?? null,
      visibleOpenInputs: inputs.length,
      displayRows: s.querySelectorAll('[data-key]').length,
      saveLabel: s.querySelector('[data-testid^="lead-fix-save-"]')?.textContent ?? null,
      hasCancel: !!s.querySelector('[data-testid^="lead-incomplete-close-"]'),
      accountSection: !!s.querySelector('[data-testid^="lead-account-"]'),
      surfaceHeight: Math.round(s.getBoundingClientRect().height),
      viewportH: window.innerHeight,
    }
  }, leadId)
  console.log('  COMPLETION SURFACE:', JSON.stringify(shot))
} finally {
  await browser.close()
  // TEARDOWN, enumerated from the DATABASE by tag, soft only.
  const found = must(await db.from('record_revisions')
    .select('record_id,payload').ilike('payload->>name', `${MARK}%`), 'find')
  const ids = [...new Set(found.map((r) => r.record_id))]
  console.log(`\nteardown: ${ids.length} fixture record(s) found by tag`)
  for (const id of ids) {
    must(await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null), 'soft')
  }
  const left = must(await db.from('records').select('id,deleted_at').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']), 'recheck')
  const live = left.filter((r) => !r.deleted_at)
  console.log(`  re-queried: ${left.length} record(s), ${live.length} still live  ${live.length === 0 ? 'CLEAN' : 'RESIDUE'}`)
}
