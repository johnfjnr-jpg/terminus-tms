// R7: the Industry picker PREFILLS from the record, and still carries NO
// missing-marker because the server sees the column satisfied.
//
// BOTH HALVES ARE ASSERTED (C23: mode governs framing, the server governs
// marks). Asserting only the prefill would pass on a build that also started
// marking a satisfied field, which is the other direction of the same defect.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-r7-industry.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/contact-swap/`
mkdirSync(OUT, { recursive: true })
const TAG = process.argv[2] ?? 'r7'
const MARK = 'R7FIXTURE'
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('BUNDLE STALE - would measure code that is not this tree'); process.exit(2) }

const inds = (await api('GET', '/industries')).data
const industry = inds[1] ?? inds[0]
console.log(`industry to set: ${industry.name} (${industry.id})`)

const made = await api('POST', '/contacts', {
  name: `${MARK} Ada`, company: `${MARK} Co`, jobRole: 'Engineer',
  email: 'r7@example.com', mobile: '+60123456789',
  industry_id: industry.id, source: 'Web',
})
const leadId = made.data?.id ?? made.data?.record?.id

const checks = []
const check = (ok, what) => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`) }

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-qualify-${id}"]`),
    { timeout: 25000 }, leadId)
  await page.click(`[data-testid="lead-qualify-${leadId}"]`)
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-fix-industry_id-${id}"]`),
    { timeout: 20000 }, leadId)
  await new Promise((r) => setTimeout(r, 700))

  const seen = await page.evaluate((id) => {
    const sel = document.querySelector(`[data-testid="lead-fix-industry_id-${id}"]`)
    const opt = sel && sel.tagName === 'SELECT' ? sel.options[sel.selectedIndex] : null
    return {
      tag: sel?.tagName ?? null,
      value: sel?.value ?? null,
      shownText: opt?.textContent ?? null,
      asterisk: !!document.querySelector(`[data-testid="lead-needs-industry_id-${id}"]`),
      // A control: a field the server DOES consider missing must still mark,
      // or "no asterisk" would be true of a build that marks nothing at all.
      addressAsterisk: !!document.querySelector(`[data-testid="lead-needs-address-${id}"]`),
    }
  }, leadId)
  console.log(`  observed: ${JSON.stringify(seen)}`)

  check(seen.value === industry.id, `the picker PREFILLS the record's industry (${seen.value} === ${industry.id})`)
  check(seen.shownText === industry.name, `it shows the NAME not the id (${seen.shownText})`)
  check(seen.asterisk === false, 'Industry carries NO missing-marker, because the server sees it satisfied')
  check(seen.addressAsterisk === true, 'CONTROL: a genuinely missing field DOES still mark, so the line above is not vacuous')

  await page.screenshot({ path: `${OUT}r7-industry-${TAG}.png`, fullPage: false })
} finally {
  await browser.close()
  const found = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', `${MARK}%`), 'find')
  const ids = [...new Set(found.map((r) => r.record_id))]
  for (const id of ids) {
    must(await db.from('records').update({ deleted_at: new Date().toISOString() })
      .eq('id', id).is('deleted_at', null), 'soft')
  }
  const left = must(await db.from('records').select('id,deleted_at')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']), 're')
  console.log(`\nteardown: ${left.length} found, ${left.filter((r) => !r.deleted_at).length} still live`)
}
const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} pass`)
process.exit(failed.length ? 1 : 0)
