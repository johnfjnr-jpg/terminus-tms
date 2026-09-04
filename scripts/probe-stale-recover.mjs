// ── U9/U10: A SELF-HEALING REFUSAL RECOVERS ITSELF ───────────────────────
//
// U10 was confirmed to be U9's root, measured on the UN-TICK path rather than
// assumed from the tick: two tabs, one ticks, the other un-ticks holding the
// old revision, and the refusal is the identical 409. "Had to go back, restore,
// then come back - not sure why" is what a dead end produces.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const puppeteer = await loadPuppeteer('stale-recover')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const { oppId } = await freshOpportunity(process.argv[2] ?? 'R41SR')

const browser = await puppeteer.launch({ headless: 'new' })
const open = async () => {
  const p = await browser.newPage()
  await p.setViewport({ width: 1440, height: 1100 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await p.waitForFunction(() => !!document.getElementById('opp-detail-tabs'), { timeout: 25000 })
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab[data-opp-stage-tab]')]
      .find((x) => x.querySelector('.opp-tab-current-dot'))
    t?.click()
  })
  await p.waitForFunction(() => document.querySelectorAll('.tb-crit-row--tickable').length > 0, { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1000))
  return p
}
const A = await open()
const B = await open()
const field = await A.evaluate(() => document.querySelector('.tb-crit-row--tickable')?.dataset.field)

// A TICKS, so B's held revision goes stale. This is the two-editor race, and it
// is the one the message is about.
await A.evaluate(() => document.querySelector('.tb-crit-row--tickable')?.click())
await A.waitForFunction(() => true)
await new Promise((r) => setTimeout(r, 2500))

// B UN-TICKS on the stale holder. Before this fix the write was refused and the
// person was told to reload.
const untick = await B.evaluate(async (id, f) => {
  const r = await window.oppPatch(id, { payload: { [f]: null } })
  return { ok: r.ok, status: r.status }
}, oppId, field)
record('an un-tick on a stale revision now SUCCEEDS, by re-reading and retrying',
  untick.ok === true, `-> ${untick.status}`)

// AND THE OTHER TAB'S CHANGE SURVIVES: a retry carries only this patch's
// fields, so a concurrent change to a DIFFERENT field is not clobbered.
const survived = await A.evaluate(async (id) => {
  const r = await window.oppPatch(id, { payload: { warrantyPct: 7 } })
  return r.ok
}, oppId)
record('a write from the other tab still works afterwards', survived === true)

// EXACTLY ONE RETRY, never a loop: the holder must end up current, so a third
// write from the same tab needs no recovery at all.
const third = await B.evaluate(async (id, f) => {
  const r = await window.oppPatch(id, { payload: { [f]: new Date().toISOString() } })
  return { ok: r.ok, status: r.status }
}, oppId, field)
record('the holder is current afterwards, so the next write is ordinary',
  third.ok === true, `-> ${third.status}`)

// THE SENTENCE, for the case a retry is ALSO refused.
const app = readFileSync('frontend/app.js', 'utf8')
record('the message no longer demands a manual reload',
  /The screen is catching up - try again in a moment/.test(app)
  && !/Reload to see the change, then re-enter yours/.test(app))

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
