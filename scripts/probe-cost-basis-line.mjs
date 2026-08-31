#!/usr/bin/env node
// The cost basis data line, inside Show detail. Round 41, decision 3.
//
// ── ALL FOUR BANDS ARE CAPTURED, NOT JUST THE ONE THE DATA PRODUCES ────────
//
// Every batch in the live catalog is dated 2026-08-27, so `current` is the only
// band any run of this application has ever rendered. Capturing only that would
// photograph the state nobody needs to look at and leave the three that carry a
// warning unseen. CLAUDE.md Verification 24, stated for a band rather than a
// parameter: a display exercised only at its default is a display nobody has
// seen.
//
// The three others are produced by moving the CATALOG DATE, not by writing text
// into the element: the page then runs its own resolver, its own stalenessBand
// call and its own class assignment, so what is captured is the real rendering
// path. Verification 20 - the probe must not become a second reader that agrees
// with the first by construction.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-cost-basis-line.mjs')
import { readFileSync, mkdirSync, statSync } from 'fs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const OPP = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const OUT = new URL('../.verify/basis/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// as_of dates chosen from the shipped thresholds rather than guessed: the live
// batch is effective 2026-08-27, and 217 days is ageing, 492 is stale.
const CASES = [
  { key: 'current', asOf: null },
  { key: 'ageing', asOf: '2027-04-01' },
  { key: 'stale', asOf: '2028-01-01' },
  { key: 'undated', asOf: null, undate: true },
]

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const rows = []

for (const width of [1240, 1920]) {
  for (const c of CASES) {
    await page.setViewport({ width, height: 900 })

    // ── THE BAND IS PRODUCED BY CHANGING THE DATA, NOT THE ELEMENT ────────
    //
    // The catalog response is intercepted and its `as_of` moved, or every
    // product's effective_from blanked. The page then does everything else
    // itself: catalogToRates, ageInDays against as_of, stalenessBand, the class
    // assignment and the paint. Nothing about the band is written by the probe.
    //
    // THE FIRST VERSION WROTE THE ELEMENT INSTEAD, via a window hook that does
    // not exist because renderCatalogNotice is module-scoped. It produced four
    // IDENTICAL rows at each width and would have been read as "all four bands
    // render the same", which is a finding rather than a failure. It was caught
    // by the probe reporting whether its own hook was reachable. Verification
    // 18: a calibration that does not move the number has failed to run.
    const cdp = await page.createCDPSession()
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/base-costs*', requestStage: 'Response' }] })
    cdp.on('Fetch.requestPaused', async (e) => {
      try {
        const body = await cdp.send('Fetch.getResponseBody', { requestId: e.requestId })
        const json = JSON.parse(body.base64Encoded ? Buffer.from(body.body, 'base64').toString('utf8') : body.body)
        if (c.asOf) json.as_of = c.asOf
        if (c.undate) for (const p of json.products ?? []) p.effective_from = null
        await cdp.send('Fetch.fulfillRequest', {
          requestId: e.requestId, responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify(json)).toString('base64'),
        })
      } catch { await cdp.send('Fetch.continueRequest', { requestId: e.requestId }).catch(() => {}) }
    })

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate((id) => navigate('opportunity-detail', id), OPP)
    // Verification 7. False before this deal prices; true only after.
    await page.waitForFunction(() => {
      const el = document.getElementById('deal-contract-net')
      return el && /\$[1-9]/.test(el.textContent)
    }, { timeout: 25000 })
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('[data-opp-tab]')].find((b) => /commercial/i.test(b.textContent))
      if (t) t.click()
    })
    await page.waitForFunction(() => {
      const p = document.getElementById('opp-tab-commercial')
      return p && !p.classList.contains('hidden')
    }, { timeout: 20000 })
    await page.evaluate(() => document.getElementById('btn-toggle-detail').click())
    await page.waitForFunction(() => {
      const p = document.getElementById('deal-detail-panel')
      return p && !p.classList.contains('hidden')
    }, { timeout: 10000 })

    const state = await page.evaluate(() => {
      const v = document.getElementById('deal-catalog-basis')
      const a = document.getElementById('deal-catalog-age')
      const cs = (el) => { const s = getComputedStyle(el); return { size: s.fontSize, color: s.color } }
      // THE STATEMENT MUST BE ON ITS OWN LINE, measured rather than assumed from
      // the stylesheet. The first two attempts both had a rule that read
      // correctly and laid out beside the value at one width and below it at the
      // other, and every other reading in this probe passed on both.
      const vr = v.getBoundingClientRect(), ar = a.getBoundingClientRect()
      return { value: v.textContent, valueStyle: cs(v), age: a.textContent, ageClass: a.className,
        ageStyle: cs(a), ownLine: a.textContent === '' ? null : ar.top - vr.top > 6 }
    })

    const file = `${OUT}basis-${width}-${c.key}.png`
    const rect = await page.evaluate(() => {
      const n = document.getElementById('deal-catalog-notice')
      n.scrollIntoView({ block: 'center' })
      const r = n.getBoundingClientRect()
      const head = document.getElementById('deal-detail-heading').getBoundingClientRect()
      return { x: Math.max(0, r.x - 12), y: Math.max(0, head.y - 12),
        width: Math.min(window.innerWidth - Math.max(0, r.x - 12), Math.max(r.width, 620) + 24),
        height: Math.min(window.innerHeight - Math.max(0, head.y - 12), (r.bottom - head.y) + 60) }
    })
    await page.screenshot({ path: file, clip: rect })
    rows.push({ width, band: c.key, ...state, bytes: statSync(file).size })
    await cdp.send('Fetch.disable').catch(() => {})
    await cdp.detach().catch(() => {})
  }
}

console.log('\n  COST BASIS DATA LINE, inside Show detail. Round 41 decision 3.\n')
for (const r of rows) {
  console.log(`  ${r.width}  ${r.band.padEnd(8)} value: ${JSON.stringify(r.value)}`)
  console.log(`        ${''.padEnd(8)} value style ${r.valueStyle.size} ${r.valueStyle.color}`)
  console.log(`        ${''.padEnd(8)} age class "${r.ageClass}" style ${r.ageStyle.size} ${r.ageStyle.color}`)
  console.log(`        ${''.padEnd(8)} age: ${JSON.stringify(String(r.age).slice(0, 76))}  png ${(r.bytes / 1024).toFixed(0)}KB`)
}
// ── THE CALIBRATION, and it is the whole reason the first version was caught ──
//
// Four bands must produce four DIFFERENT age classes at each width, and the
// value must be identical across all four, because the basis is the same batch
// whatever its age. Both halves matter: the first proves the injection reached
// the render path, the second proves it did not reach anything else.
const problems = []
for (const width of [1240, 1920]) {
  const at = rows.filter(r => r.width === width)
  const classes = at.map(r => r.ageClass)
  if (new Set(classes).size !== 4) problems.push(`${width}: the four bands produced ${new Set(classes).size} distinct age classes, not 4`)
  // THE BATCH NAME may not move between bands: it is the same batch whatever its
  // age, and if it moves the injection reached more than the age. The DATE may,
  // and in the undated case must, because that case blanks it at source.
  const nameOf = (v) => String(v).split(' · ')[0]
  if (new Set(at.map(r => nameOf(r.value))).size !== 1) problems.push(`${width}: the batch name moved between bands, so the injection reached more than the age`)
  for (const r of at.filter(r => r.band !== 'undated')) {
    if (!/effective \d{4}-\d{2}-\d{2}$/.test(r.value)) problems.push(`${width}/${r.band}: the value does not end in an effective date: ${JSON.stringify(r.value)}`)
  }
  const und = at.find(r => r.band === 'undated')
  if (!/date not recorded$/.test(und.value)) problems.push(`${width}/undated: an absent date renders as ${JSON.stringify(und.value)} rather than saying it is not recorded`)
  const cur = at.find(r => r.band === 'current')
  if (cur.age !== '') problems.push(`${width}: a current basis rendered an age statement`)
  for (const r of at.filter(r => r.band !== 'current')) {
    if (!r.age) problems.push(`${width}/${r.band}: no statement rendered`)
    if (!r.ageClass.includes(`deal-catalog-${r.band}`)) problems.push(`${width}/${r.band}: class is "${r.ageClass}"`)
    if (r.ownLine !== true) problems.push(`${width}/${r.band}: the statement is on the same line as the basis value`)
  }
  if (at.some(r => r.bytes < 3000)) problems.push(`${width}: a capture is under 3KB and is probably blank`)
}
console.log('')
if (problems.length) for (const p of problems) console.log('  CALIBRATION FAILED  ' + p)
else console.log('  CALIBRATION  four distinct bands at both widths, one unchanging basis value, no blank capture')
console.log(`  captures: ${OUT}\n`)
await browser.close()
process.exit(problems.length ? 1 : 0)
