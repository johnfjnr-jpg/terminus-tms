// ── THE FACTORING TERM DEFAULTS FROM THE RECOVERY PERIOD ─────────────────
//
// W5, ruled 2026-09-03, and ruled DELIBERATELY OPPOSITE to W1's probability.
// The business's reason, recorded because the two look alike and are not:
// probability is derived from an EXTERNAL FACT, the stage, so it re-derives
// whenever that fact changes; the term is a STARTING POINT the salesperson
// tunes against cash flow, so it is an initial value that respects the
// override. Architecture 11.
//
// Three clauses, all measured: it writes when the term is empty; it never
// overwrites a term already set; and cleared stays cleared.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const puppeteer = await loadPuppeteer('term-from-recovery')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const TAG = process.argv[2] ?? 'R41TERM'

const make = async (tag, factoring) => {
  const { oppId } = await freshOpportunity(tag)
  const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
  await api('PATCH', `/opportunities/${oppId}`,
    { payload: { ssNew: 10, duration: 36, factoring }, expected_revision: rev })
  return oppId
}
// Two deals: one with NO term recorded, one with a term the salesperson set.
const empty = await make(`${TAG}E`, { enabled: true, ratePct: 1.5, method: 'straight' })
const preset = await make(`${TAG}P`, { enabled: true, ratePct: 1.5, termMonths: 9, method: 'straight' })

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })

const openDeal = async (id) => {
  await page.evaluate((x) => navigate('opportunity-detail', x), id)
  await page.waitForFunction(() => !!document.getElementById('deal-factoring-toggle'), { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  // VISIBILITY, not geometry: a visibility:hidden panel still has layout, so a
  // width>0 wait is already satisfied in the state being waited out.
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && !p.classList.contains('hidden') && getComputedStyle(p).visibility === 'visible'
  }, { timeout: 20000 })
}
const type = async (id, text) => {
  await page.focus(`#${id}`)
  // CLEARED THE WAY A PERSON CLEARS IT. Assigning value = '' fires no input
  // event, so the field looks emptied and nothing knows it was touched - the
  // probe's first version reported "cleared stays cleared" as broken because of
  // that alone, on a feature that handles a real clear correctly.
  await page.evaluate((x) => {
    const e = document.getElementById(x)
    e.value = ''
    e.dispatchEvent(new Event('input', { bubbles: true }))
  }, id)
  if (text) await page.type(`#${id}`, text)
  // BLUR, because the default fires on a settled value rather than per keystroke.
  await page.evaluate((x) => document.getElementById(x)?.blur(), id)
  await new Promise((r) => setTimeout(r, 250))
}
const val = (id) => page.evaluate((x) => document.getElementById(x)?.value ?? null, id)

// ── 1. AN EMPTY TERM TAKES THE RECOVERY PERIOD ───────────────────────────
await openDeal(empty)
// THE NOT-RECORDED STATE IS CONSTRUCTED, NOT ASSUMED. system_defaults carries
// factoringTermMonths = 12, applied when factoring is enabled, so a new deal
// does NOT arrive with an empty term. Clearing it is how a person reaches the
// state this rule is about, and it also exercises "cleared stays cleared"
// having been cleared BEFORE any recovery is entered.
console.log(`      (term as the system default leaves it: "${await val('deal-factoring-termMonths')}")`)
await type('deal-factoring-termMonths', '')
await page.evaluate(() => { const u = document.getElementById('deal-factoring-termMonths')
  u.dispatchEvent(new Event('change', { bubbles: true })) })
record('the term can be left not recorded', (await val('deal-factoring-termMonths')) === '',
  `term="${await val('deal-factoring-termMonths')}"`)
await type('deal-recoveryMonths', '24')
// ── CLAUSE 1 CANNOT BE REACHED FROM OUTSIDE, AND THAT IS THE FINDING ────
//
// Measured: PATCHing factoring with termMonths: null comes back as 12. The
// server applies system_defaults.factoringTermMonths on EVERY write, so no deal
// can arrive with the term not recorded while factoring is on, and the only way
// to an empty field is to clear it - which is the person having their say and
// correctly ends the defaulting.
//
// So the two clauses are in tension THROUGH THE SERVER, not in the client: an
// arrives-empty deal would take the recovery period, and one cannot exist.
// Reported rather than asserted, because a check that cannot reach its state is
// not evidence either way.
const afterRecovery = await val('deal-factoring-termMonths')
console.log(`SKIP  clause 1 not exercisable: the term cannot ARRIVE empty. `
  + `Cleared in-session then recovery entered -> term="${afterRecovery}", which is `
  + `"cleared stays cleared" holding, not clause 1 failing.`)

// ── 2. A TERM ALREADY SET IS NEVER OVERWRITTEN ───────────────────────────
await openDeal(preset)
record('the second deal carries a term the salesperson set',
  (await val('deal-factoring-termMonths')) === '9', `term="${await val('deal-factoring-termMonths')}"`)
await type('deal-recoveryMonths', '36')
record('changing recovery does NOT overwrite a term already set',
  (await val('deal-factoring-termMonths')) === '9',
  `recovery=36, term still "${await val('deal-factoring-termMonths')}"`)

// ── 3. CLEARED STAYS CLEARED ─────────────────────────────────────────────
// Architecture 11's clause that separates an initial value from a fallback: a
// default does not quietly reappear once the person has had their say, and
// emptying the field IS having their say.
await type('deal-factoring-termMonths', '')
await type('deal-recoveryMonths', '48')
record('a CLEARED term stays cleared when recovery changes again',
  (await val('deal-factoring-termMonths')) === '',
  `recovery=48, term="${await val('deal-factoring-termMonths')}"`)

await browser.close()
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
