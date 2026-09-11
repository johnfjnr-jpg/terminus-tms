// A5: THE DOOR ON THE LEAD VIEW, BOTH DIRECTIONS.
//
// Phase 0 measured that this view had NO door at all - neither the CSS half
// nor the JS half - so every write on somebody else's lead was reachable by
// mouse and by keyboard. This is R11's Test Bed probe pointed at
// view-contact-detail, deliberately the same instrument rather than a new one.
//
// Reuses the shared enumerator, which is the structure of record for what
// counts as a control (previous round's R16). A new instrument imports it and
// never re-decides classification - two instruments disagreeing about a
// sub-tab panel is what that ruling exists to prevent.
//
// TWO RECORDS IS THE INSTRUMENT. A probe that only visited an unowned bed
// would report "everything is locked" against a build that locks everything,
// including your own.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-lead-door.mjs')
import { readFileSync } from 'fs'
import { enumerateControlsInPage, classifyControl } from '../lib/enumerate-controls.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { startKeepAlive } from '../lib/keep-alive.mjs'
startKeepAlive({ everyMs: 60000 })

const session = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = process.env.LEADDOOR_TAG ?? 'leaddoor'

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id
if (!OTHER) throw new Error('the probe account does not exist; refusing to guess an owner id')

// A LEAD APIECE. Built through the API the way a person makes one, then one
// handed to the other account by admin write - the state a single account
// cannot reach on its own, built directly and said so (Verification 47).
const industry = (await api('GET', '/industries')).data[0]
const makeLead = async (label) => (await api('POST', '/contacts', {
  name: `${TAG}-${label} Lead`, company: 'Door Holdings', jobRole: 'Head of Infrastructure',
  email: `${TAG}@example.invalid`, mobile: '+65 9000 0006', source: 'Direct Outreach',
  industry_id: industry.id,
})).data
const mine = await makeLead('own')
const theirs = await makeLead('other')
must(await db.from('records').update({ owner_id: OTHER }).eq('id', theirs.id).select('id'), 'hand over')

const browser = await puppeteer.launch({ headless: 'new' })
const rows = []
for (const [label, recId] of [['not mine', theirs.id], ['mine', mine.id]]) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((rid) => navigate('contact-detail', rid), recId)
  // A condition the PREVIOUS state cannot satisfy, and one that waits for the
  // render to settle rather than for data to arrive.
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    if (!v || v.classList.contains('is-loading')) return false
    if (!(v.innerText ?? '').trim()) return false
    const n = v.querySelectorAll('input, textarea, select').length
    window.__s = (window.__s && window.__s.n === n) ? { n, h: window.__s.h + 1 } : { n, h: 1 }
    return window.__s.h >= 4
  }, { polling: 300, timeout: 30000 })

  await page.evaluate((e, c) => {
    window.__enum = new Function('return ' + e)()
    window.__classify = new Function('return ' + c)()
  }, enumerateControlsInPage.toString(), classifyControl.toString())

  const state = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const all = window.__enum('view-contact-detail')
    const tally = { total: all.length, write: 0, writeReachable: 0, navAlive: 0, discAlive: 0 }
    const live = []
    for (const r of all) {
      const c = window.__classify(r)
      if (c.write) { tally.write++; if (c.reachable) { tally.writeReachable++; live.push(r) } }
      if (c.nav && c.reachable) tally.navAlive++
      if (c.disclosure && c.reachable) tally.discAlive++
    }
    // THE FIVE WRITES JOHN NAMED, BY NAME. A count of 0 reachable is satisfied
    // by a view that rendered none of them - Verification 19's clause: an
    // enumeration must fail on the unrecorded instance, not pass on an empty
    // one. Each is looked for in the POPULATION and then asked whether it is
    // reachable, so "absent" and "neutralised" cannot be confused.
    const named = {
      // the field editors, as a group: any display row that opens an editor
      fields: all.filter((r) => (r.cls ?? '').includes('field-row-display')),
      qualify: all.filter((r) => (r.id ?? '') === 'cd-btn-qualify'),
      nurture: all.filter((r) => /park|nurture/i.test(`${r.id ?? ''} ${r.text ?? ''}`)),
      addNote: all.filter((r) => /add note/i.test(`${r.id ?? ''} ${r.text ?? ''}`)),
      followUp: all.filter((r) => /follow ?up/i.test(`${r.id ?? ''} ${r.text ?? ''}`)),
    }
    const byName = {}
    for (const [k, list] of Object.entries(named)) {
      byName[k] = { present: list.length, reachable: list.filter((r) => window.__classify(r).reachable).length }
    }
    return { klass: v.classList.contains('is-not-mine'), ...tally, byName,
      first: live.slice(0, 3).map((r) => `${r.tag}#${r.id ?? '-'}.${(r.cls ?? '-').split(' ')[0]}`) }
  })
  rows.push({ label, ...state })
  await page.close()
}
const browser2 = browser

console.log('\n  THE DOOR ON THE LEAD VIEW\n')
console.log('  record     is-not-mine  controls  write  write-REACHABLE  nav alive  disclosure alive')
for (const r of rows) {
  console.log(`  ${r.label.padEnd(10)} ${String(r.klass).padEnd(12)} ${String(r.total).padStart(8)} ${String(r.write).padStart(6)} ` +
    `${String(r.writeReachable).padStart(16)} ${String(r.navAlive).padStart(10)} ${String(r.discAlive).padStart(17)}`)
  if (r.writeReachable) console.log(`             still reachable: ${r.first.join(' | ')}`)
}

const not = rows.find((r) => r.label === 'not mine')
const own = rows.find((r) => r.label === 'mine')
const fail = []
if (!not.klass) fail.push('the unowned lead does not carry is-not-mine')
if (own.klass) fail.push('YOUR OWN lead carries is-not-mine')
if (not.writeReachable !== 0) fail.push(`${not.writeReachable} write controls reachable on an unowned lead`)
if (own.writeReachable === 0) fail.push('NOTHING is reachable on your own lead either, so the door is not discriminating')
if (not.navAlive === 0) fail.push('navigation is dead on the unowned lead, so a read-only record stops being readable')

// Declared absent, with the reason and the phase that ends it. See below.
const NOT_YET_RENDERED = new Set(['followUp'])

console.log('\n  THE FIVE NAMED WRITES, present vs reachable')
console.log('  write            not mine            mine')
for (const k of Object.keys(not.byName)) {
  const n = not.byName[k], o = own.byName[k]
  console.log(`  ${k.padEnd(16)} ${String(n.present).padStart(2)} present, ${String(n.reachable).padStart(2)} reachable` +
    `   ${String(o.present).padStart(2)} present, ${String(o.reachable).padStart(2)} reachable`)
  // Absent is not the same as neutralised, and only one of them is the door
  // working. A write that never rendered is reported, not counted as closed.
  if (n.present === 0) {
    // NOT YET RENDERED IS A DECLARED STATE, not a pass and not a failure.
    //
    // P1 built the follow-up task as a writable pair of payload keys and said
    // plainly that nothing renders it; P3 gives it a panel. Until then "0
    // reachable" is true because there is nothing there, which is exactly the
    // shape Verification 19 warns about - an enumeration that passes on an
    // empty population.
    //
    // SHRINK-ONLY, like the unbounded-select allowlist: the moment P3 renders
    // it, `present` moves off 0, the declaration is stale, and this goes RED
    // telling the next person to assert it properly. A control cannot arrive
    // uncovered.
    if (NOT_YET_RENDERED.has(k)) console.log(`  ${' '.repeat(16)} ^ ${k} is declared NOT YET RENDERED (P3 gives it a panel)`)
    else fail.push(`${k}: NOT PRESENT on the unowned lead, so "0 reachable" says nothing about the door`)
  } else if (NOT_YET_RENDERED.has(k)) {
    fail.push(`${k}: now RENDERS, so the not-yet-rendered declaration is stale - remove it and assert the door on it`)
  } else if (n.reachable !== 0) fail.push(`${k}: ${n.reachable} reachable on an unowned lead`)
  if (o.present > 0 && o.reachable === 0) fail.push(`${k}: dead on YOUR OWN lead too, so the door is not discriminating`)
}

// ── A6: AN UNOWNED LEAD SHOWS THE OWNER'S SAVED DATA ─────────────────────
//
// John's acceptance test, verbatim: edit a field on an unowned lead (A5 blocks
// the write), navigate away and back, confirm the screen renders the OWNER's
// saved data with no local edit surviving.
//
// A6 is RESOLVED BY A4 + A5, so this is the proof that the two together do
// what neither does alone: A5 stops the edit being made, A4 stops any edit
// that did get made from outliving the visit.
{
  const page = await browser2.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  const open = async () => {
    await page.evaluate((rid) => navigate('contact-detail', rid), theirs.id)
    await page.waitForFunction(() => {
      const v = document.getElementById('view-contact-detail')
      return !!v && !v.classList.contains('is-loading') && (v.innerText ?? '').includes('Door Holdings')
    }, { polling: 150, timeout: 30000 })
  }
  await open()

  // 1. TRY TO EDIT. A5 should refuse the row entirely.
  const attempt = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="display-company"]')
    d?.click()
    return { clicked: !!d }
  })
  await new Promise((r) => setTimeout(r, 400))
  const afterClick = await page.evaluate(() => {
    const e = document.querySelector('[data-testid="edit-company"]')
    return { editorOpen: e ? !e.hasAttribute('hidden') : null,
      dirty: document.querySelector('[data-testid="dirty-count"]')?.textContent ?? null,
      shown: document.querySelector('[data-testid="display-company"]')?.textContent?.trim() ?? null }
  })

  // 2. AWAY AND BACK.
  await page.evaluate(() => navigate('leads'))
  await new Promise((r) => setTimeout(r, 500))
  await open()
  const afterReturn = await page.evaluate(() => ({
    shown: document.querySelector('[data-testid="display-company"]')?.textContent?.trim() ?? null,
    dirty: document.querySelector('[data-testid="dirty-count"]')?.textContent ?? null,
    barHidden: document.querySelector('[data-testid="edit-bar"]')?.hasAttribute('hidden') ?? null,
  }))
  // Verification 4: a picture of the claim, of a region the thing is in.
  await page.screenshot({ path: '/Users/johnfryatt/terminus-tms/.verify/leads/unowned-lead.png' })
  await page.close()

  console.log('\n  A6 - an unowned lead, edit attempted, then away and back')
  console.log(`     clicked the row:   ${attempt.clicked}`)
  console.log(`     editor opened:     ${afterClick.editorOpen}   (A5 must refuse it)`)
  console.log(`     shown after click: ${JSON.stringify(afterClick.shown)}`)
  console.log(`     after return:      ${JSON.stringify(afterReturn)}`)

  if (afterClick.editorOpen) fail.push('A6: the editor OPENED on an unowned lead, so A5 did not block the write')
  if (afterReturn.shown !== 'Door Holdings') {
    fail.push(`A6: the screen shows ${JSON.stringify(afterReturn.shown)}, not the OWNER's saved data`)
  }
  if (afterReturn.dirty && afterReturn.dirty !== '0 changes') {
    fail.push(`A6: a local edit survived - the bar reads ${afterReturn.dirty}`)
  }
}

console.log('')
if (fail.length) for (const f of fail) console.log('  FAILED  ' + f)
else console.log('  PASS  write controls closed on another user\'s lead, navigation alive, your own untouched')
await browser2.close()
await tearDown(TAG)
process.exit(fail.length ? 1 : 0)
