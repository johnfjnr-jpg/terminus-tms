// ── THE HOOK ADOPTS ONLY FROM A RECORD-ADVANCING RESPONSE ────────────────
//
// T4, 2026-09-02. `revision_number` is ambiguous: a deal_sheet_versions row has
// one and it means the revision the version was TAKEN at. Issuing returned that
// row, the hook adopted its number, the forward-only rule rejected it, and the
// holder was left one revision behind - refusing the next save of either kind.
//
// The correctness now sits at the single READER: the hook demands
// `record_revision_number`, which only a record-advancing response sets and a
// version-shaped row cannot carry.
//
// BOTH DIRECTIONS, because either alone proves nothing: a version-shaped
// response must NOT advance the holder, and a genuine one MUST.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-revision-adoption.mjs')
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const TAG = process.argv[2] ?? 'R41ADOPT'
const { oppId } = await freshOpportunity(`${TAG}AD`)
const trueRev = async () => (await admin().from('record_revisions')
  .select('revision_number').eq('record_id', oppId)
  .order('revision_number', { ascending: false }).limit(1).maybeSingle()).data?.revision_number

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
await page.waitForFunction(() => window.getOppLoadedRevision?.() != null, { timeout: 25000 })
const held = () => page.evaluate(() => window.getOppLoadedRevision())

record('the holder starts level with the record', await held() === await trueRev(),
  `held ${await held()} record ${await trueRev()}`)

// ── A GENUINE record-advancing response MUST advance the holder ──────────
const before = await held()
await page.evaluate(async (id) => { await window.oppPatch(id, { payload: { warrantyPct: 3 } }) }, oppId)
record('a record-advancing write ADVANCES the holder',
  await held() > before && await held() === await trueRev(),
  `held ${before} -> ${await held()}, record ${await trueRev()}`)

// ── A VERSION-SHAPED response must NOT ──────────────────────────────────
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const INPUTS = { targetMargin: 30 }
const ver = await page.evaluate(async (id, inputs, rates) => {
  const r = await window.api('POST', `/api/opportunities/${id}/deal-sheet-versions`,
    { inputs, rates, reason: 'adoption probe', expected_revision: window.getOppLoadedRevision() })
  return { ok: r.ok, id: r.data?.id, err: r.data?.error }
}, oppId, INPUTS, frozenRates(resolveRates(INPUTS, LIVE)))
record('a version is taken', ver.ok, ver.ok ? '' : String(ver.err))

// The raw shape, fed to the hook, with NO record_revision_number: the hook must
// ignore it. Driven through the real client so nothing is simulated.
const heldBeforeFake = await held()
await page.evaluate((id) => {
  window.__noteRevisionForTest?.(`/api/deal-sheet-versions/x`, { record_id: id, revision_number: 1 })
}, oppId)
record('a version-shaped response does NOT move the holder',
  await held() === heldBeforeFake,
  `held ${heldBeforeFake} -> ${await held()} (a stale version revision_number was offered)`)

// ── AND THE OLD DEFECT, END TO END ──────────────────────────────────────
const beforeIssue = await held()
const issued = await page.evaluate(async (vid) => {
  const r = await window.api('POST', `/api/deal-sheet-versions/${vid}/issue`)
  return { ok: r.ok, rrn: r.data?.record_revision_number, vrn: r.data?.revision_number }
}, ver.id)
record('issuing reports the RECORD revision, not the version\'s',
  Number.isInteger(issued.rrn) && issued.rrn !== issued.vrn,
  `record_revision_number=${issued.rrn} version revision_number=${issued.vrn}`)
record('and the holder follows the record after issuing',
  await held() === await trueRev(),
  `held ${beforeIssue} -> ${await held()}, record ${await trueRev()}`)

const save = await page.evaluate(async (id) => {
  const r = await window.oppPatch(id, { payload: { warrantyPct: 5 } })
  return { ok: r.ok, status: r.status, error: r.data?.error }
}, oppId)
record('THE NEXT SAVE IS NOT REFUSED, which is the defect gone',
  save.ok, save.ok ? `-> ${save.status}` : `-> ${save.status} ${String(save.error).slice(0, 70)}`)

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
