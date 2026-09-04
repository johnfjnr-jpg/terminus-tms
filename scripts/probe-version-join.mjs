// ── THE VERSION/APPROVAL JOIN, AND THE BANNER AS A LIVE SURFACE ──────────
//
// 2026-09-04. On TT-SGP-SMARTC-118 a version with TWO fully-approved requests
// read "not approved", and a DRAFT that was never requested carried another
// version's rejection - because an approval was matched to a version by
// revision_number, which pairs them only when nothing changed in between.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { admin } from './fixtures.mjs'
import { api } from './api-client.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const puppeteer = await loadPuppeteer('version-join')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const db = admin()

const { data: rec, error } = await db.from('records')
  .select('id, reference_code').eq('reference_code', 'TT-SGP-SMARTC-118').maybeSingle()
if (error) throw error
if (!rec) { console.log('SKIP  TT-SGP-SMARTC-118 is not present; the join test needs its history'); process.exit(0) }

// ── FIX 1: EACH VERSION'S STATE, THROUGH THE API THE PANEL READS ─────────
const vers = (await api('GET', `/opportunities/${rec.id}/deal-sheet-versions`)).data ?? []
const by = (m, n) => vers.find((v) => v.major === m && v.minor === n)
record('V3.0 with two approved requests reads APPROVED',
  by(3, 0)?.approval?.state === 'approved', `state=${by(3, 0)?.approval?.state}`)
record('V1.0, the version actually rejected, reads REJECTED',
  by(1, 0)?.approval?.state === 'rejected', `state=${by(1, 0)?.approval?.state}`)
record('V1.1, a draft never requested, no longer inherits that rejection',
  by(1, 1)?.approval?.state === 'none', `state=${by(1, 1)?.approval?.state}`)
record('V2.0, approved then re-priced, reads SUPERSEDED',
  by(2, 0)?.approval?.state === 'superseded', `state=${by(2, 0)?.approval?.state}`)

// ── FIX 2: THE BANNER SHOWS THE CURRENT VERSION'S CURRENT STATE ──────────
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), rec.id)
await page.waitForFunction(() => !!document.getElementById('opp-rejected-banner'), { timeout: 25000 })
// Wait on the VERSIONS being known, since the banner's review half reads them.
await page.waitForFunction(() => (window.oppCurrentVersionRejection?.() ?? 'unset') !== 'unset',
  { timeout: 20000 }).catch(() => null)
await new Promise((r) => setTimeout(r, 1500))

const banner = await page.evaluate(() => {
  const el = document.getElementById('opp-rejected-banner')
  return {
    shown: !!el && !el.classList.contains('hidden') && el.innerHTML.length > 0,
    text: (el?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
    currentRejection: window.oppCurrentVersionRejection?.() ?? null,
  }
})
record('at V3, the V1 rejection is NOT narrated in a banner',
  !banner.shown, banner.shown ? `"${banner.text}"` : 'no banner, which is the current state')
record('and the current version is not itself rejected',
  banner.currentRejection === null, `${JSON.stringify(banner.currentRejection)}`)

// ── FIX 3: A REFUSED WRITE SAYS SO ───────────────────────────────────────
// A write to somebody else's record is refused by RLS and cannot be recovered
// by any retry, which is the unrecoverable case the watch list named.
const { data: other, error: oErr } = await db.from('records')
  .select('id, reference_code, owner_id').eq('record_type', 'opportunity')
  .is('deleted_at', null).neq('owner_id', session.user.id).limit(1).maybeSingle()
if (oErr) throw oErr
await page.evaluate((id) => navigate('opportunity-detail', id), other.id)
await page.waitForFunction(() => !!document.getElementById('opp-write-refused'), { timeout: 25000 })
await new Promise((r) => setTimeout(r, 1200))
// innerHTML IS NOT VISIBILITY. The first version of this asserted on
// innerHTML.length and PASSED with innerText empty - the banner had markup, real
// geometry and `visibility: hidden` from the loading state, so the check was
// green on a message nobody could read. Verification 4's rule in an assertion:
// presence is not legibility.
const refused = await page.evaluate(async (id) => {
  const r = await window.oppPatch(id, { payload: { warrantyPct: 9 } })
  return { ok: r.ok, status: r.status }
}, other.id)
await page.waitForFunction(() => {
  const el = document.getElementById('opp-write-refused')
  return el && !el.classList.contains('hidden')
    && getComputedStyle(el).visibility === 'visible'
    && el.innerText.trim().length > 0
}, { timeout: 15000 }).catch(() => null)
const seen = await page.evaluate(() => {
  const el = document.getElementById('opp-write-refused')
  return {
    visible: !!el && getComputedStyle(el).visibility === 'visible'
      && !el.classList.contains('hidden'),
    text: (el?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 88),
  }
})
record('a write that cannot be recovered is REFUSED', refused.ok === false, `-> ${refused.status}`)
record('and the screen SAYS SO, in words a person can read',
  seen.visible && /not saved/i.test(seen.text) && seen.text.length > 30,
  seen.text ? `"${seen.text}"` : 'NOTHING READABLE - the watch-list defect')

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
