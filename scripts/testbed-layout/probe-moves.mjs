// R1/R2/R3 proof, plus the design risk R3 carries: ONE draft store, not two.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-moves.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/testbed-layout/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = admin(), TAG = 'tbmv'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }
const tb = await freshTestBed(TAG)
console.log(`test bed ${tb.bedId}\n`)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1400 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    return !!v && !!v.querySelector('[data-testid="tb-card-summary"]')
  }, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1400))

  const geo = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const r = (t) => { const e = v.querySelector(`[data-testid="${t}"]`); return e ? e.getBoundingClientRect() : null }
    const count = (t) => v.querySelectorAll(`[data-testid="${t}"]`).length
    const sum = r('tb-card-summary'), notes = r('tb-card-notes')
    const site = r('tb-card-site'), dates = r('tb-card-dates')
    const hdr = r('tb-header')
    return {
      summaryCount: count('tb-card-summary'), notesCount: count('tb-card-notes'),
      sameTopRow: sum && notes ? Math.abs(sum.top - notes.top) < 8 : null,
      topRowBelowHeader: sum && hdr ? sum.top > hdr.top : null,
      datesBesideSite: site && dates ? Math.abs(site.top - dates.top) < 8 : null,
      datesTops: site && dates ? [Math.round(site.top), Math.round(dates.top)] : null,
      sensorsOnReference: !!r('tb-card-sensors'),
      // RE-POINTED 2026-09-15, L3: one flat Commercials card became three
      // titled rate cards, so this reads the first of them.
      commercialsOnReference: !!r('tb-card-rates-hardware'),
    }
  })
  console.log(`  ${JSON.stringify(geo)}`)
  check(geo.summaryCount === 1 && geo.notesCount === 1, 'R1: exactly ONE Summary and ONE Notes render')
  check(geo.sameTopRow === true, 'R1: Summary and Notes share one row')
  check(geo.topRowBelowHeader === true, 'R1: that row is at the TOP, under the name')
  check(geo.datesBesideSite === true, `R2: Key Dates sits BESIDE Site Details (tops ${JSON.stringify(geo.datesTops)})`)
  // R3 IS REVERTED. StageTabs unmounts each panel on tab switch, so
  // TestBedPanel - which owns the draft store and would do the portalling -
  // does not exist while Commercials is active. That is a PRE-EXISTING bug
  // (unsaved edits are discarded on every tab switch, today) and the decision
  // about it is John's. So these two cards must be back where they were.
  check(geo.sensorsOnReference === true && geo.commercialsOnReference === true,
    'R3 REVERTED: Sensor Counts and Commercials are back on Reference, unchanged')
  await p.screenshot({ path: `${OUT}moves-reference.png` })

} finally {
  await b.close(); await tearDown(TAG); console.log('\nteardown done')
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
