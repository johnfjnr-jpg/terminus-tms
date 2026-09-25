// ── F5: CAN THE MILESTONES AND THE HOSTING SCHEDULE SHARE A ROW? ────────
//
// THE FIRST ANSWER TO THIS WAS MINE AND IT WAS WRONG, TWICE OVER, so the
// method is stated here rather than left in the shape of the code:
//
//   1. `querySelector('a, b, c')` returns the first element in DOCUMENT
//      ORDER matching ANY selector, not the first selector that matches. The
//      group is an ancestor of the grid, so `#deal-hybrid-group .ms-grid,
//      #deal-hybrid-group` matched the GROUP.
//   2. `scrollWidth` on a block-level element is its LAID-OUT width. Both
//      readings were therefore the column width, reported as two independent
//      measurements that happened to sum to more than the column. A number
//      that is the answer restated cannot fail (V47).
//
// So each subtree is CLONED into an offscreen `width: max-content` host with
// the real fonts, which is what the rail round used and what reports an
// intrinsic width. Calibrated: the clone of a known-width element must come
// back within a pixel of it.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payment-fix/probe-f5-width.mjs')
import { readFileSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'payfixf5'
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

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
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
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2200)))
    const r = await p.evaluate(() => {
      const host = document.createElement('div')
      host.style.cssText = 'position:absolute;left:-9999px;top:0;width:max-content'
      document.body.appendChild(host)
      const intrinsic = (el) => {
        if (!el) return null
        host.innerHTML = ''
        const c = el.cloneNode(true)
        c.style.width = 'max-content'
        c.classList.remove('hidden')
        host.appendChild(c)
        const w = Math.ceil(host.getBoundingClientRect().width)
        host.innerHTML = ''
        return w
      }
      // CALIBRATION, AND THE FIRST ONE WAS WRONG: an EMPTY div with
      // `width:321px` clones back as 0, because the clone's own
      // `width:max-content` overrides the fixed width and there is no content
      // to size to. It read `0 against 321` and that is the instrument
      // reporting nothing, not the element being narrow.
      //
      // So the calibration element carries CONTENT of a known width, which is
      // what `max-content` is supposed to find. Both directions: a 321px child
      // reads 321, and a 640px child reads 640, so the number tracks the
      // subject rather than being a constant.
      const calFor = (px) => {
        const cal = document.createElement('div')
        const kid = document.createElement('div')
        kid.style.cssText = `width:${px}px`
        cal.appendChild(kid)
        document.body.appendChild(cal)
        const w = intrinsic(cal)
        cal.remove()
        return w
      }
      const calRead = `${calFor(321)}/321 and ${calFor(640)}/640`

      const group = document.querySelector('#deal-hybrid-group')
      const kids = group ? [...group.children] : []
      const gap = group ? parseFloat(getComputedStyle(group).columnGap || '0') || 0 : 0
      const out = {
        calibration: calRead,
        contentW: Math.round(document.querySelector('#deal-payment-content')?.clientWidth ?? 0),
        railW: Math.round(document.querySelector('#deal-payment-rail')?.getBoundingClientRect().width ?? 0),
        cardW: Math.round(document.querySelector('.deal-payment-region')?.clientWidth
          ?? document.querySelector('#deal-hybrid-group')?.parentElement?.clientWidth ?? 0),
        gap,
        milestones: intrinsic(kids[0]),
        hostingCol: intrinsic(kids[1]),
        // the schedule ALONE, without the invoicing radios above it
        schedule: intrinsic(document.querySelector('#deal-hybrid-schedule')),
        msGrid: intrinsic(document.querySelector('#deal-milestones-tbody')),
      }
      host.remove()
      return out
    })
    const pair = (r.milestones ?? 0) + (r.schedule ?? 0) + (r.gap || 24)
    console.log(`\n═════ ${width} ═════   calibration clone ${r.calibration}`)
    console.log(`  card ${r.cardW}  =  rail ${r.railW} + content ${r.contentW}`)
    console.log(`  milestones column intrinsic   ${r.milestones}px   (grid alone ${r.msGrid}px)`)
    console.log(`  hosting schedule intrinsic    ${r.schedule}px     (with invoicing radios ${r.hostingCol}px)`)
    console.log(`  the pair + ${r.gap || 24}px gap  =  ${pair}px`)
    console.log(`  BESIDE THE RAIL (${r.contentW}px available) : ${pair <= r.contentW ? 'FITS' : `OVER BY ${pair - r.contentW}px`}`)
    console.log(`  FULL CARD WIDTH (${r.cardW}px available)    : ${pair <= r.cardW ? 'FITS' : `OVER BY ${pair - r.cardW}px`}`)
  }
} finally { await b.close(); await tearDown(TAG) }
