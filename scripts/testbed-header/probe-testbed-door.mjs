// R11: THE DOOR ON THE TEST BED VIEW, BOTH DIRECTIONS.
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
const puppeteer = await loadPuppeteer('probe-testbed-door.mjs')
import { readFileSync } from 'fs'
import { enumerateControlsInPage, classifyControl } from '../lib/enumerate-controls.mjs'
import { admin, freshTestBed, tearDown } from '../fixtures.mjs'
import { startKeepAlive } from '../lib/keep-alive.mjs'
startKeepAlive({ everyMs: 60000 })

const session = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = process.env.TBDOOR_TAG ?? 'tbdoor'

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id
if (!OTHER) throw new Error('the probe account does not exist; refusing to guess an owner id')

const mine = await freshTestBed(`${TAG}-own`)
const theirs = await freshTestBed(`${TAG}-other`)
must(await db.from('records').update({ owner_id: OTHER }).eq('id', theirs.bedId).select('id'), 'hand over')

const browser = await puppeteer.launch({ headless: 'new' })
const rows = []
for (const [label, bedId] of [['not mine', theirs.bedId], ['mine', mine.bedId]]) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((rid) => navigate('test-bed-detail', rid), bedId)
  // A condition the PREVIOUS state cannot satisfy, and one that waits for the
  // render to settle rather than for data to arrive.
  await page.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
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
    const v = document.getElementById('view-test-bed-detail')
    const all = window.__enum('view-test-bed-detail')
    const tally = { total: all.length, write: 0, writeReachable: 0, navAlive: 0, discAlive: 0 }
    const live = []
    for (const r of all) {
      const c = window.__classify(r)
      if (c.write) { tally.write++; if (c.reachable) { tally.writeReachable++; live.push(r) } }
      if (c.nav && c.reachable) tally.navAlive++
      if (c.disclosure && c.reachable) tally.discAlive++
    }
    return { klass: v.classList.contains('is-not-mine'), ...tally,
      first: live.slice(0, 3).map((r) => `${r.tag}#${r.id ?? '-'}.${(r.cls ?? '-').split(' ')[0]}`) }
  })
  rows.push({ label, ...state })
  await page.close()
}
await browser.close()

console.log('\n  THE DOOR ON THE TEST BED VIEW\n')
console.log('  record     is-not-mine  controls  write  write-REACHABLE  nav alive  disclosure alive')
for (const r of rows) {
  console.log(`  ${r.label.padEnd(10)} ${String(r.klass).padEnd(12)} ${String(r.total).padStart(8)} ${String(r.write).padStart(6)} ` +
    `${String(r.writeReachable).padStart(16)} ${String(r.navAlive).padStart(10)} ${String(r.discAlive).padStart(17)}`)
  if (r.writeReachable) console.log(`             still reachable: ${r.first.join(' | ')}`)
}

const not = rows.find((r) => r.label === 'not mine')
const own = rows.find((r) => r.label === 'mine')
const fail = []
if (!not.klass) fail.push('the unowned bed does not carry is-not-mine')
if (own.klass) fail.push('YOUR OWN bed carries is-not-mine')
if (not.writeReachable !== 0) fail.push(`${not.writeReachable} write controls reachable on an unowned bed`)
if (own.writeReachable === 0) fail.push('NOTHING is reachable on your own bed either, so the door is not discriminating')
if (not.navAlive === 0) fail.push('navigation is dead on the unowned bed, so a read-only record stops being readable')

console.log('')
if (fail.length) for (const f of fail) console.log('  FAILED  ' + f)
else console.log('  PASS  write controls closed on another user\'s bed, navigation alive, your own untouched')
await tearDown(`${TAG}-own`)
await tearDown(`${TAG}-other`)
process.exit(fail.length ? 1 : 0)
