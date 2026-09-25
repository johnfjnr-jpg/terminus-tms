// ── F5 IS STOPPED: PHOTOGRAPH THE OPTIONS ───────────────────────────────
//
// John's standing rule, 2026-09-25: "Where a measured constraint forces a
// layout choice the brief does not cover, STOP and photograph the options for
// John's ruling. Never ship an unrequested arrangement."
//
// THE CONSTRAINT, MEASURED. F5 asks for the milestones table and the hosting
// breakdown side by side, top-aligned, BESIDE THE RAIL. Their intrinsic widths
// are 397px and 389px; with the 20px grid gap the pair needs 806px. The content
// column beside the rail has 453px at 1240 and 529px at 1440. Over by 353px and
// 277px. The stop condition in F5's own wording is met at both widths.
//
// So this script SHIPS NOTHING. It injects each candidate, photographs Hybrid
// at both widths, restores byte for byte, and leaves the tree where it found
// it. The options are John's to choose between.
//
// Verification 44 throughout: full-path keys, the snapshot asserted before the
// first injection, a byte comparison after every one, an in-flight marker, and
// every stop path is also a restore path.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payment-fix/photograph-f5.mjs')
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payment-fix/`
const SNAP = `${OUT}f5-snapshots`
const MARKER = `${SNAP}/IN-FLIGHT`
mkdirSync(SNAP, { recursive: true })
const key = (p) => p.replaceAll('/', '_')
const abs = (p) => `${ROOT}/${p}`
const S5 = 'frontend-react/src/deal/section5.tsx'

const CONTENT_SLOT = "              {opexOn ? null : <div id=\"deal-capex-year-slot\">{yearSchedule}</div>}"
const HYBRID_OPEN = '          <div id="deal-hybrid-group" className={vis.hybridGroup ? \'\' : \'hidden\'}>'

const OPTIONS = [
  { id: 'today', title: 'TODAY, for comparison: the schedule renders TWICE under Hybrid',
    edits: [] },
  { id: 'A', title: 'OPTION A: side by side at FULL CARD WIDTH, below the rail row',
    note: 'F3 collapses to the Hybrid grid. This is the pre-rail-round arrangement '
      + 'F5 names, top-aligned, and it FITS (806 of 876 at 1240). What it is not is '
      + 'BESIDE the rail: the content column beside the rail renders nothing under Hybrid.',
    edits: [{ find: CONTENT_SLOT,
      put: "              {opexOn || effectiveStructure(ui) === 'hybrid' ? null : <div id=\"deal-capex-year-slot\">{yearSchedule}</div>}" }] },
  { id: 'B', title: 'OPTION B: BESIDE the rail, stacked rather than side by side',
    note: 'F3 collapses to the content column. Everything sits beside the rail and '
      + 'nothing is empty, but the two tables stack: each fits 453px alone, the pair '
      + 'does not. This trades F5\'s "side by side" for F5\'s "beside the rail".',
    edits: [
      { find: CONTENT_SLOT,
        put: "              {opexOn ? null : (\n                <div id=\"deal-capex-year-slot\">\n                  {effectiveStructure(ui) === 'hybrid' ? (\n                    <div id=\"deal-hybrid-milestones-inline\">\n                      <p className=\"label\">Customer payment milestones (hardware)</p>\n                      <div className=\"ms-grid-head\"><div>Month</div><div>Project milestone</div><div>%</div><div>USD</div></div>\n                      <div>{milestoneGrid}</div>\n                    </div>\n                  ) : null}\n                  {yearSchedule}\n                </div>\n              )}" },
      { find: HYBRID_OPEN, put: '          <div id="deal-hybrid-group" className="hidden">' },
    ] },
  { id: 'C', title: 'OPTION C: side by side BESIDE the rail, which is what F5 asked for',
    note: 'Photographed so the cost is visible rather than argued. The pair needs '
      + '806px and the column has 453px at 1240, so the grid compresses: this is what '
      + '"it does not fit" looks like on the screen.',
    edits: [
      { find: CONTENT_SLOT,
        put: "              {opexOn ? null : <div id=\"deal-capex-year-slot\">{effectiveStructure(ui) === 'hybrid' ? null : yearSchedule}</div>}" },
      { find: HYBRID_OPEN,
        put: '          <div id="deal-hybrid-group" className={vis.hybridGroup ? \'\' : \'hidden\'} style={{ maxWidth: 453 }}>' },
    ] },
]

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run died mid-injection.`)
  process.exit(2)
}
const originalS5 = readFileSync(abs(S5), 'utf8')
writeFileSync(`${SNAP}/${key(S5)}`, originalS5)
if (!existsSync(`${SNAP}/${key(S5)}`)) {
  console.error('REFUSING: the snapshot does not exist after writing it'); process.exit(2)
}
writeFileSync(MARKER, new Date().toISOString())
const restore = (what) => {
  writeFileSync(abs(S5), readFileSync(`${SNAP}/${key(S5)}`, 'utf8'))
  if (readFileSync(abs(S5), 'utf8') !== originalS5) {
    console.error(`STOP: ${S5} did not restore byte for byte after ${what}`)
    console.error(`The marker is LEFT in place on purpose. Restore from ${SNAP}.`)
    process.exit(3)
  }
}

const TAG = process.env.C_TAG ?? 'payfixf5shots'
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Per Unit',
  structure: 'hybrid', paymentMode: 'capex',
  milestones: [
    { month: 1, label: 'Contract start', pct: 40 },
    { month: 6, label: 'Hardware delivered to site', pct: 30 },
    { month: 12, label: 'Installation complete', pct: 30 },
  ],
} })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const opt of OPTIONS) {
    for (const e of opt.edits) {
      const src = readFileSync(abs(S5), 'utf8')
      const n = src.split(e.find).length - 1
      if (n !== 1) {
        console.error(`STOP: option ${opt.id} anchor matches ${n} times, not once`)
        restore('a refused anchor'); rmSync(MARKER, { force: true }); process.exit(4)
      }
      writeFileSync(abs(S5), src.replace(e.find, e.put))
      if (readFileSync(abs(S5), 'utf8') === src) {
        console.error(`STOP: option ${opt.id} did not change the file`)
        restore('an edit that did not land'); rmSync(MARKER, { force: true }); process.exit(5)
      }
    }
    execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    console.log(`\n── ${opt.title}`)
    if (opt.note) console.log(`   ${opt.note}`)
    for (const width of [1440, 1240]) {
      await p.setViewport({ width, height: 1900 })
      await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
      await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
      await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
      await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
      await p.evaluate(() => {
        const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
          .find((x) => x.textContent.trim() === 'Commercials')
        el?.click()
      })
      await p.waitForFunction(() => /Customer payment milestones/.test(document.body.textContent ?? ''),
        { timeout: 30000 })
      await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
      // MEASURE FIRST, CAPTURE SECOND. A screenshot suppresses the scrollbar
      // and does not put it back, so every reading is taken before the shutter.
      const m = await p.evaluate(() => {
        const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const n = [...document.querySelectorAll('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')]
        /* ── SCOPED TO WHAT IS VISIBLE, AND THE FIRST VERSION WAS NOT ──────
           `document.querySelector('.ms-grid-head')` matched the copy inside
           `#deal-form-vanilla`, the retired block `frontend/index.html` still
           carries. It renders nothing and has no geometry, so every comparison
           against it was false - the estate's own standing qualification
           (Verification 41) arriving in this round's probe.

           A document-wide selector answers for whatever is in the DOM, not for
           the thing under test (Verification 25). */
        // The milestones COLUMN, which is what is being placed, reached through
        // its header because the header is the part with a stable class.
        const ms = [...document.querySelectorAll('.ms-grid-head')].find(vis)?.parentElement
        const over = (e) => e ? Math.max(0, Math.ceil(e.scrollWidth - e.clientWidth)) : 0
        /* ── THE FIRST VERSION OF THIS READ FALSE EVERYWHERE ───────────────
           It took `n.find(vis)`, the FIRST visible schedule, and compared the
           milestone grid against it. Under today's DOUBLE render that is the
           content-column copy beside the rail, not the one in the Hybrid grid,
           so it answered about the wrong table and returned a constant. A
           detector that cannot produce both verdicts is not a detector
           (Verification 9), and this one was about to be printed as data.

           Stated properly, "side by side" is a RELATIONSHIP and is true of a
           PAIR: the two boxes overlap vertically and do not overlap
           horizontally. Asked of every visible schedule, so the answer does not
           depend on which one the query happened to reach first. */
        /* ── AND THE THIRD FAULT WAS THE THRESHOLD, WHICH COULD NOT BE MET ──
           `vOverlap > 20` against `.ms-grid-head`, an element measured at 14px
           TALL (top 2914, bottom 2928). The threshold was larger than the
           subject, so no arrangement on earth could satisfy it and the field
           was a constant `false` while the screenshot plainly showed the two
           tables side by side.

           Two corrections. The subject is the milestones COLUMN, not its 14px
           header row - the header was never the thing being placed. And the
           threshold is PROPORTIONAL to the smaller box rather than an absolute
           number picked without reference to what it measures (Verification
           47: take the threshold from the requirement).

           Recorded rather than quietly fixed because it took three attempts,
           and the first two were also mine: a document-wide selector matching
           the retired `#deal-form-vanilla` copy, and `.find(vis)` taking the
           first of two schedules. Verification 18 exactly - one green reading
           with several independent causes, each invisible until the previous
           one was fixed, and a calibration that does not move the number has
           failed to run rather than passed. */
        const sbs = (a, c) => {
          const x = a.getBoundingClientRect(), y = c.getBoundingClientRect()
          const vOverlap = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)
          const hOverlap = Math.min(x.right, y.right) - Math.max(x.left, y.left)
          return vOverlap >= Math.min(x.height, y.height) * 0.5 && hOverlap <= 0
        }
        return {
          renders: n.length, visible: n.filter(vis).length,
          sideBySide: !!ms && n.filter(vis).some((c) => sbs(ms, c)),
          overflow: over(document.querySelector('#deal-hybrid-group'))
            + over(document.querySelector('#deal-capex-year-slot')),
        }
      })
      await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
      await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
      const file = `${OUT}f5-${opt.id}-${width}.png`
      await p.screenshot({ path: file })
      console.log(`   ${width}: schedule rendered ${m.renders}, VISIBLE ${m.visible}`
        + `, side by side ${m.sideBySide}, overflow ${m.overflow}px   ${file}`)
    }
    restore(`option ${opt.id}`)
  }
} finally {
  restore('the sweep')
  rmSync(MARKER, { force: true })
  execSync('npm run build:react', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  await b.close(); await tearDown(TAG)
}
console.log('\nThe tree is restored and the bundle rebuilt. Nothing here was shipped.')
