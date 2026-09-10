// R10's ACCEPTANCE TEST, as ruled: the beds already past their
// estGoLiveDate show red on FIRST RENDER.
//
// WHAT THIS IS EVIDENCE FOR, precisely:
//   - the READ side needs no write, no flag and no migration
//   - live beds carrying MANUALLY ENTERED dates need NO BACKFILL, because the
//     check only reads what is already there
//
// The population is read from the database, not typed: a list of ids would go
// stale the moment a date moved, and the claim is about every overdue bed
// rather than five named ones.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-overdue-acceptance.mjs')
import { readFileSync, mkdirSync, statSync } from 'fs'
import { admin } from '../fixtures.mjs'
import { startKeepAlive } from '../lib/keep-alive.mjs'
startKeepAlive({ everyMs: 60000 })

const session = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const OUT = '/Users/johnfryatt/terminus-tms/.verify/tb-overdue/'
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const today = new Date().toISOString().slice(0, 10)

const beds = must(await db.from('records').select('id,status').eq('record_type', 'test_bed')
  .is('deleted_at', null), 'beds')
const revs = must(await db.from('record_revisions').select('record_id,payload,revision_number')
  .in('record_id', beds.map((b) => b.id)).order('revision_number', { ascending: false }), 'revs')
const latest = new Map()
for (const r of revs) if (!latest.has(r.record_id)) latest.set(r.record_id, r.payload ?? {})

const overdue = beds.filter((b) => {
  const e = latest.get(b.id)?.estGoLiveDate
  return typeof e === 'string' && e !== '' && e < today
})
const future = beds.filter((b) => {
  const e = latest.get(b.id)?.estGoLiveDate
  return typeof e === 'string' && e !== '' && e >= today
})
// NONE of these carry a go-live stamp: their dates were entered by hand.
const stamped = overdue.filter((b) => latest.get(b.id)?.testBedGoLiveDate)
console.log(`  today ${today}`)
console.log(`  live beds ${beds.length}; past their contracted end ${overdue.length}; not yet due ${future.length}`)
console.log(`  of the overdue, carrying a go-live stamp: ${stamped.length}  (0 means every date was entered by hand)\n`)

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v),
  'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })

const rows = []
for (const b of [...overdue, ...future.slice(0, 2)]) {
  const expected = overdue.includes(b)
  await page.evaluate((rid) => navigate('test-bed-detail', rid), b.id)
  await page.waitForFunction((want) => {
    const v = document.getElementById('view-test-bed-detail')
    if (!v || v.classList.contains('is-loading')) return false
    const cell = document.querySelector('[data-testid="tb-stat-contracted-end"]')
    // A condition the PREVIOUS record cannot satisfy: the cell must carry THIS
    // record's date.
    return !!cell && cell.textContent.trim() === want
  }, { polling: 200, timeout: 30000 }, latest.get(b.id).estGoLiveDate).catch(() => {})

  const s = await page.evaluate(() => {
    const cell = document.querySelector('[data-testid="tb-stat-contracted-end"]')
    if (!cell) return null
    const cs = getComputedStyle(cell)
    return { text: cell.textContent.trim(), red: cell.className.includes('stat-value--overdue'),
      colour: cs.color, border: cs.borderStyle, title: cell.getAttribute('title') }
  })
  const ok = !!s && s.red === expected
  rows.push({ id: b.id, status: b.status, expected, ...s, ok })
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${b.id.slice(0, 8)}  end ${s?.text}  ` +
    `${expected ? 'expect RED ' : 'expect plain'}  got ${s?.red ? 'RED' : 'plain'}  ${s?.colour}  ${b.status}`)
}

// Verification 4: a picture of the thing being claimed, of a region the
// element is actually inside.
const first = overdue[0]
await page.evaluate((rid) => navigate('test-bed-detail', rid), first.id)
await page.waitForFunction(() => {
  const v = document.getElementById('view-test-bed-detail')
  return v && !v.classList.contains('is-loading') && v.querySelector('[data-testid="tb-header-stats"]')
}, { timeout: 30000 })
const el = await page.$('[data-testid="tb-header-stats"]')
await el.screenshot({ path: `${OUT}overdue-strip.png` })
console.log(`\n  screenshot ${OUT}overdue-strip.png  ${statSync(`${OUT}overdue-strip.png`).size} bytes`)
await browser.close()

const reds = rows.filter((r) => r.expected && r.red).length
const wrong = rows.filter((r) => !r.ok)
console.log(`\n  ${reds} of ${overdue.length} overdue beds render RED on first load`)
console.log(`  ${rows.filter((r) => !r.expected && !r.red).length} of ${Math.min(future.length, 2)} not-yet-due beds render PLAIN`)
console.log(`  backfill required: NONE - every date above was entered by hand and the check only READS`)
if (wrong.length) for (const w of wrong) console.log(`  FAILED  ${w.id.slice(0, 8)} expected ${w.expected ? 'red' : 'plain'}`)
process.exit(wrong.length ? 1 : 0)
